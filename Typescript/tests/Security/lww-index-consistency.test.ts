/// <reference types="node" />
/**
 * REGRESSION — live writes and rebuildIndex() could disagree (Axiom A9),
 * and the fix for that itself broke plain sequential writes
 *
 * Two rounds of a real finding here, both fixed, both covered below:
 *
 * ROUND 1 — live vs. rebuild divergence. Two writes to the SAME path
 * sharing a millisecond timestamp could make a live (in-process) kernel
 * read one value while a fresh `hydrate()` of that same kernel's own
 * `exportSnapshot()` read a DIFFERENT one — confirmed with FIXED,
 * forced-equal timestamps (no reliance on millisecond-collision luck), on
 * a completely PUBLIC path (nothing secret-specific about it): ~40-50% of
 * trials disagreed. Root cause: `applyMemoryToIndex` (core-index.ts) is
 * the one function that writes `self.index[path]`, but `commitMemoryOnly`
 * called it once per live write in real program-call order with NO
 * comparison, while `rebuildIndex()` sorted ALL memories by
 * `(timestamp, hash)` first — two different effective rules behind one
 * function, depending on who called it.
 *
 * ROUND 2 — fixing round 1 by making live writes obey `(timestamp, hash)`
 * broke something more fundamental: plain SEQUENTIAL writes on the SAME
 * process, e.g. `me.order.price(100); me.order.price(200);` (this is the
 * README's own documented reactivity example), can ALSO share a
 * millisecond, and `(timestamp, hash)` has no notion of "the second one
 * happened after the first" — it just compares hashes, which is
 * content-dependent and can just as easily favor the FIRST write. That
 * silently broke the single most basic write semantic this kernel has:
 * the second of two sequential writes must always win.
 *
 * FIX: a monotonic per-instance logical clock, `Memory.seq` (types.ts) —
 * a Lamport-style scalar counter, incremented once per genuinely NEW
 * memory, NEVER reset except by a full identity transition or explicit
 * replay-from-scratch. `compareLWW` (core-index.ts) now orders MODERN
 * entries (both sides have a real `seq`) by `(seq asc, hash asc)` —
 * `timestamp` is no longer part of that comparison at all, only kept on
 * the record for display. `seq` alone already resolves any two writes
 * from the SAME local history with zero collisions, immune to the
 * physical clock (including it moving backward) — hash only remains the
 * tiebreak for the case A9 was actually about: genuinely concurrent
 * writers whose logical clocks might coincide after a future merge (no
 * such merge exists in this codebase yet). LEGACY entries (neither side
 * has `seq` — persisted before this field existed) still fall back to the
 * ORIGINAL `(timestamp, hash)` rule, unchanged, for full backward
 * compatibility with already-persisted logs.
 *
 * `rebuildIndex()`'s sort and `applyMemoryToIndex`'s live/incremental
 * winner check both call the ONE shared `compareLWW` — the thing that
 * makes it impossible for live and replay to silently drift apart again.
 */
import { MEConstructor as ME, assert, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("Regression: sequential writes, live vs rebuilt index (Axiom A9 + logical clock)");

function withFrozenClock<T>(ms: number, fn: () => T): T {
  const originalNow = Date.now;
  (Date as any).now = () => ms;
  try {
    return fn();
  } finally {
    (Date as any).now = originalNow;
  }
}

async function main() {
  console.log("\n### Regression — sequential writes, live vs rebuilt index (Axiom A9 + logical clock)");

  await test("the README's own reactivity example: a second write to a dependency must always recompute the derivation, even under a frozen/colliding clock", async () => {
    for (let trial = 0; trial < 12; trial++) {
      const me: any = new ME();
      withFrozenClock(4242, () => {
        me.order.price(100);
        me.order.quantity(5);
        me.order["="]("total", "price * quantity");
        me.order.price(200);
      });
      assert.equal(me("order.price"), 200, `trial ${trial}: second price write must win`);
      assert.equal(me("order.total"), 1000, `trial ${trial}: derivation must recompute off the SECOND price, not the first`);
      const trace = me.explain("order.total");
      assert.equal(trace.value, 1000, `trial ${trial}: explain() must agree`);
    }
  });

  await test("sequential writes to a public path: the SECOND write always wins under a forced-identical timestamp, across many trials with random content", async () => {
    for (let trial = 0; trial < 24; trial++) {
      const me: any = new ME();
      const second = `second-${trial}-${Math.random()}`;
      withFrozenClock(5000, () => {
        me.publicfield(`first-${trial}-${Math.random()}`);
        me.publicfield(second);
      });
      assert.equal(me("publicfield"), second, `trial ${trial}: second sequential write must win regardless of hash`);
    }
  });

  await test("sequential writes survive the physical clock moving BACKWARD between them", async () => {
    const me: any = new ME();
    withFrozenClock(5000, () => {
      me.publicfield("written-at-t5000");
    });
    withFrozenClock(1, () => {
      // A real clock adjustment (NTP correction, VM pause/resume, etc.)
      // could do this; the second write is still causally after the
      // first in THIS process's own history and must still win.
      me.publicfield("written-at-t1-but-causally-later");
    });
    assert.equal(me("publicfield"), "written-at-t1-but-causally-later", "a later local write must win even if the physical clock went backward");
  });

  await test("public path: live index and a fresh rebuild agree, across many colliding-timestamp trials", async () => {
    for (let trial = 0; trial < 24; trial++) {
      const me: any = new ME();
      withFrozenClock(5000, () => {
        me.publicfield(`first-${trial}-${Math.random()}`);
        me.publicfield(`second-${trial}-${Math.random()}`);
      });
      const live = me("publicfield");
      const rebuilt: any = new ME();
      rebuilt.hydrate(me.exportSnapshot());
      assert.equal(rebuilt("publicfield"), live, `trial ${trial}: rebuild must match live`);
      assert.equal(rebuilt.index?.publicfield, me.index?.publicfield, `trial ${trial}: raw index must match too`);
    }
  });

  await test("protected (root-scope) path: DECRYPTED live value and a fresh hydrate+unlock+resupply agree, across many trials — not just raw ciphertext", async () => {
    for (let trial = 0; trial < 12; trial++) {
      const me: any = new ME();
      await me.createIdentityRoot(`lww-protected-password-${trial}`);
      me["_"](`lww-protected-secret-${trial}`);
      const second = `second-${trial}-${Math.random()}`;
      withFrozenClock(6000, () => {
        me.topsecret(`first-${trial}-${Math.random()}`);
        me.topsecret(second);
      });
      // The point of this test per the task: compare the DECRYPTED read,
      // not the raw index string (which is opaque ciphertext and would
      // trivially "match" or "not match" without proving the underlying
      // plaintext winner is the same one on both sides) — AND that it's
      // specifically the causally-second write, not an arbitrary one.
      const liveDecrypted = me("topsecret");
      assert.equal(liveDecrypted, second, `trial ${trial}: live decrypted value must be the second (causally later) write`);

      const rebuilt: any = new ME();
      rebuilt.hydrate(me.exportSnapshot());
      await rebuilt.unlockIdentity(`lww-protected-password-${trial}`);
      rebuilt["_"](`lww-protected-secret-${trial}`);
      const rebuiltDecrypted = rebuilt("topsecret");

      assert.equal(rebuiltDecrypted, liveDecrypted, `trial ${trial}: decrypted rebuild must match decrypted live`);

      // Also confirm the persisted ciphertext itself corresponds to that
      // same winner: re-deriving from the raw index value on a THIRD,
      // independently-hydrated instance must decrypt to the identical
      // plaintext too — proving the ciphertext on disk, not just an
      // in-memory read, backs the declared winner.
      const third: any = new ME();
      third.hydrate(me.exportSnapshot());
      await third.unlockIdentity(`lww-protected-password-${trial}`);
      third["_"](`lww-protected-secret-${trial}`);
      assert.equal(third("topsecret"), liveDecrypted, `trial ${trial}: independently-hydrated ciphertext must decrypt to the same winner`);
    }
  });

  await test("the exact same set of writes (seq, timestamp, and hash all preserved) converges to the same result regardless of replay/arrival order", async () => {
    // Build two REAL, valid, colliding-timestamp memory entries once —
    // entries[1] is the causally-second write and carries the higher
    // `seq`, which decides the outcome under A9's REVISED mechanism (round
    // 1 of this test asserted a hash-based winner here — correct under the
    // ordering mechanism A9 used at the time, not wrong; see the file
    // header for what changed and why the old rule still applies to
    // records that predate `seq`).
    const source: any = new ME();
    withFrozenClock(7000, () => {
      source.publicfield("order-value-A");
      source.publicfield("order-value-B");
    });
    const entries = source.inspect().memories.filter((m: any) => m.path === "publicfield" && m.operator === null);
    assert.equal(entries.length, 2, "expected exactly two competing memory entries");
    assert.equal(entries[0].timestamp, entries[1].timestamp, "sanity: same timestamp");
    assert.ok(entries[1].seq > entries[0].seq, "sanity: entries[1] is the causally-second write");

    const forward: any = new ME();
    forward.applyMemoryToIndex(entries[0]);
    forward.applyMemoryToIndex(entries[1]);

    const reverse: any = new ME();
    reverse.applyMemoryToIndex(entries[1]);
    reverse.applyMemoryToIndex(entries[0]);

    assert.equal(forward.index?.publicfield, reverse.index?.publicfield, "forward and reverse application order must converge to the same winner");
    assert.equal(forward.index?.publicfield, "order-value-B", "converged winner must be the causally-second (higher-seq) entry, regardless of replay order");
  });

  await test("deleting a path clears its recorded LWW winner — a later write is not blocked by stale winner metadata", async () => {
    const me: any = new ME();
    withFrozenClock(8000, () => {
      me.publicfield("original-value");
    });
    me["-"]("publicfield");
    assert.equal(me("publicfield"), undefined, "sanity: deleted");

    // A NEW write, at an EARLIER frozen timestamp than the deleted entry
    // (timestamp is no longer even part of the modern-entry comparison,
    // but this also proves no stale winner of ANY kind survived delete).
    withFrozenClock(1, () => {
      me.publicfield("new-value-after-delete");
    });
    assert.equal(me("publicfield"), "new-value-after-delete", "a write after delete must not be blocked by stale winner metadata");
  });

  await test("rehydrating from a snapshot does not carry over stale indexWinner/seqCounter state from before hydrate", async () => {
    const me: any = new ME();
    withFrozenClock(9000, () => {
      me.publicfield("pre-hydrate-value");
    });
    const snapshot = me.exportSnapshot();

    const restored: any = new ME();
    // Poison this instance's OWN prior state before hydrating — including
    // its seqCounter, by writing several times — to prove hydrate() fully
    // replaces index/indexWinner/seqCounter rather than merging with
    // whatever was there before (rebuildIndex(), which hydrate() calls,
    // must restore seqCounter from the HYDRATED _memories only).
    withFrozenClock(999999, () => {
      restored.publicfield("should-be-fully-discarded-1");
      restored.publicfield("should-be-fully-discarded-2");
      restored.publicfield("should-be-fully-discarded-3");
    });
    restored.hydrate(snapshot);
    assert.equal(restored("publicfield"), "pre-hydrate-value", "hydrate() must fully replace prior index/indexWinner state, not merge with it");

    // A write right after hydrate must win against the hydrated entry (it's
    // causally later) — proving seqCounter was correctly restored to
    // continue past the HYDRATED history's own seq, not left at 0 (which
    // would tie or lose) and not left at the poisoned instance's much
    // higher pre-hydrate counter (which this write would then lose to,
    // if that leaked through instead of being discarded).
    restored.publicfield("post-hydrate-value");
    assert.equal(restored("publicfield"), "post-hydrate-value", "post-hydrate writes must continue the HYDRATED seq sequence, neither restarting at 0 nor leaking the discarded pre-hydrate counter");
  });

  await test("branch-mode (named scope) writes are untouched by this fix — they never went through self.index at all", async () => {
    // Documents the coverage boundary asked about: `operator === null`
    // value-mode writes ARE covered (verified above, including protected
    // root-scope ones — root-scope secrets are value-mode). Branch-mode
    // secrets (`me.somePath["_"](...)`) are a DIFFERENT mechanism entirely:
    // their content lives in `branchStore`/`encryptedBranches`, never in
    // `self.index` (applyMemoryToIndex's `if (inSecret) return;` skips
    // indexing them outright) — so this LWW fix has nothing to do for them,
    // and this test exists to make that boundary explicit rather than
    // silently assumed.
    const me: any = new ME();
    await me.createIdentityRoot("lww-branch-boundary-password");
    me.wallet["_"]("wallet-secret-lww");
    withFrozenClock(10000, () => {
      me.wallet.balance(111);
      me.wallet.balance(222);
    });
    assert.equal(me("wallet.balance"), 222, "sanity: branch-mode still resolves to the last real write (its own mechanism, unrelated to self.index/indexWinner)");
    assert.equal(me.index?.["wallet.balance"], undefined, "confirms branch-mode content was never in self.index to begin with — out of this fix's scope by construction, not by omission");
  });

  await test("legacy (seq-less) entries still resolve via the ORIGINAL (timestamp, hash) rule, unchanged — backward compatibility", async () => {
    // Simulates a memory log persisted before `seq` existed: construct
    // entries with no `seq` field at all and confirm compareLWW falls back
    // to the exact original rule rather than treating them as "always
    // lose" or throwing.
    const me: any = new ME();
    withFrozenClock(11000, () => {
      me.publicfield("legacy-first");
    });
    const first = { ...me.inspect().memories.find((m: any) => m.path === "publicfield") };
    delete first.seq;
    withFrozenClock(11000, () => {
      me.publicfield("legacy-second");
    });
    const secondMem = { ...me.inspect().memories.filter((m: any) => m.path === "publicfield")[1] };
    delete secondMem.seq;

    const fresh: any = new ME();
    fresh.applyMemoryToIndex(first);
    fresh.applyMemoryToIndex(secondMem);
    const expected = first.hash > secondMem.hash ? first.value : secondMem.value;
    assert.equal(fresh.index?.publicfield, expected, "two seq-less entries with equal timestamps must still resolve by hash, exactly as A9 originally specified");
  });
}

main()
  .then(() => {
    const ok = summarize();
    process.exitCode = ok ? 0 : 1;
  })
  .catch((error) => {
    console.error("Fatal error running lww-index-consistency.test.ts:", error);
    process.exitCode = 1;
  });
