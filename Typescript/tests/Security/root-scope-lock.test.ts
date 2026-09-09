/// <reference types="node" />
/**
 * REGRESSION — root-scope write becomes public after lockIdentity()
 *
 * Found by the adversarial security battery's follow-up architecture audit
 * (typedocs/Architecture/Identity-Namespace-Recovery-Audit.md §0): the
 * "closed scope can't become public" fix
 * (`hasExistingProtectedAncestor` in core-write.ts) only checked
 * `self.branchStore.listScopes()`, which is populated ONLY by branch-mode
 * secrets (`me.somePath["_"](...)`). A ROOT-scope secret
 * (`me["_"](...)`, no named branch) uses value-mode encryption instead,
 * which never writes into `branchStore` at all — so after `lockIdentity()`
 * wiped `localSecrets` down to nothing, a write to a root-secret-protected
 * path fell through every check and landed in the plain public branch,
 * persisting real plaintext into the memory log AND the public index.
 *
 * The fix: a new, durable `self.protectedScopeKeys` set (kernel-state.ts)
 * records every scope key ever passed to `_()` — INCLUDING the root scope
 * (`""`) — and is deliberately NOT cleared by `lockIdentity()` (only by a
 * full identity transition, `ME_RESEED`). `hasExistingProtectedAncestor`
 * now consults it first.
 */
import { MEConstructor as ME, assert, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("Regression: root-scope write after lock");

// The actual retrievable ciphertext for a value-mode path lives in
// `self.index[path]`, not in the memory log's `value` field — a refusal is
// allowed (expected) to append its own "***"-redacted audit entry to the
// log, so the log's LAST entry is deliberately not what recoverability
// depends on. See core-write.ts's refusal branch comment.
function rawIndexValue(me: any, path: string): unknown {
  return me.index?.[path];
}

function lastLoggedValue(me: any, path: string): unknown {
  const entries = (me.inspect().memories as any[]).filter((m) => m.path === path);
  return entries.length > 0 ? entries[entries.length - 1].value : undefined;
}

async function main() {
  console.log("\n### Regression — root-scope write becomes public after lockIdentity()");

  await test("root-scope (bare me['_'](...)) write after lock is REJECTED, not public — the exact reported repro", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("root-scope-lock-password-01");
    me["_"]("root-level-secret-string");
    me.topsecret("REAL-SECRET-VALUE");
    assert.equal(me("topsecret"), "REAL-SECRET-VALUE", "sanity: value readable before lock");

    const beforeAttack = rawIndexValue(me, "topsecret");
    assert.notEqual(beforeAttack, "REAL-SECRET-VALUE", "sanity: even the pre-lock write was stored as ciphertext, not plaintext");

    me.lockIdentity();

    // This is the exact repro from the audit: no error expected by the old
    // code, silent plaintext acceptance. Now it must throw/reject.
    let rejected = false;
    try {
      me.topsecret("PLAINTEXT-INJECTED-AFTER-LOCK");
    } catch {
      rejected = true;
    }
    // Some write paths in this kernel signal refusal by leaving the value
    // unchanged + redacted rather than throwing (matching the existing
    // branch-mode refusal convention) — accept either, but the OUTCOME must
    // never be the plaintext landing anywhere.
    const afterAttack = rawIndexValue(me, "topsecret");
    assert.notEqual(afterAttack, "PLAINTEXT-INJECTED-AFTER-LOCK", "the injected plaintext must never be the stored value");
    assert.notEqual(afterAttack, "REAL-SECRET-VALUE", "the refusal must not itself leak the OLD real value in plaintext either");

    // Public read must never show the injected plaintext, whether the write
    // threw or was silently refused.
    assert.ok(
      me("topsecret") !== "PLAINTEXT-INJECTED-AFTER-LOCK",
      "public read must never return the attacker-injected plaintext",
    );
    void rejected;
  });

  await test("rejected write does not modify plaintext, ciphertext, journal, or index — original value fully intact", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("root-scope-lock-password-02");
    me["_"]("root-level-secret-string-02");
    me.topsecret("ORIGINAL-VALUE-02");

    const branchesBefore = JSON.stringify(me.encryptedBranches);
    const memoriesCountBefore = me.inspect().memories.length;
    const rawBefore = rawIndexValue(me, "topsecret");

    me.lockIdentity();
    try {
      me.topsecret("ATTACK-02");
    } catch {
      /* refusal may throw — that's fine, the point is nothing changed */
    }

    assert.equal(JSON.stringify(me.encryptedBranches), branchesBefore, "encryptedBranches must be byte-identical after a refused write");
    const rawAfter = rawIndexValue(me, "topsecret");
    assert.equal(rawAfter, rawBefore, "the stored ciphertext for the target path must be untouched by a refused write");
    // A refusal is allowed to append its own redacted audit entry (matching
    // the branch-mode convention), so >= not ===, but it must never REMOVE
    // history either.
    assert.ok(me.inspect().memories.length >= memoriesCountBefore, "refusal must not delete prior memory history");
    assert.equal(lastLoggedValue(me, "topsecret"), "***", "the refusal itself must still be logged, redacted, for audit continuity");

    await me.unlockIdentity("root-scope-lock-password-02");
    me["_"]("root-level-secret-string-02");
    assert.equal(me("topsecret"), "ORIGINAL-VALUE-02", "original value must recover exactly after unlock + resupply");
  });

  await test("stealth preserved: a refused root-scope write does not make the path distinguishable from absent", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("root-scope-lock-password-03");
    me["_"]("root-level-secret-string-03");
    me.neverwritten("first-value-ever");
    me.lockIdentity();

    // A brand-new field under the SAME (locked) root scope that was NEVER
    // written before this point — the "scopes vacíos" case: there is no
    // prior ciphertext at this exact leaf to compare against, only the
    // scope-level topology evidence.
    try {
      me.brandnewfield("ATTACK-ON-NEVER-WRITTEN-FIELD");
    } catch {
      /* refusal may throw */
    }
    assert.ok(
      [undefined, null].includes(me("brandnewfield")),
      "a refused write to a never-before-written protected field must read back as absent, same as a genuinely unprotected-but-never-set field would from the outside — not as the rejected plaintext",
    );
  });

  await test("branch-mode (named scope) regression check: still rejects exactly as before this fix", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("root-scope-lock-password-04");
    me.wallet["_"]("wallet-secret-04");
    me.wallet.balance(999);
    me.lockIdentity();
    try {
      me.wallet.balance("ATTACK-BRANCH-04");
    } catch {
      /* refusal may throw */
    }
    assert.ok([undefined, null].includes(me("wallet.balance")), "branch-mode protection must remain closed after lock, unaffected by this fix");
    await me.unlockIdentity("root-scope-lock-password-04");
    me.wallet["_"]("wallet-secret-04");
    assert.equal(me("wallet.balance"), 999, "branch-mode value must still recover exactly");
  });

  await test("an ordinary, never-secret-protected path is completely unaffected by this fix", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("root-scope-lock-password-05");
    // Distinct, forced timestamps — this test is about lock/unlock, not
    // about Axiom A9's tie-break (tests/Security/lww-index-consistency.test.ts
    // owns that): two real-clock writes this close together can otherwise
    // land in the same millisecond and make the outcome depend on a hash
    // comparison unrelated to what this test is checking.
    const originalNow = Date.now;
    (Date as any).now = () => 20000;
    me.publicfield("public-value-05");
    (Date as any).now = () => 20001;
    try {
      me.lockIdentity();
      // No secret was ever declared anywhere in this kernel — a public write
      // after lock must still work exactly as before (locking identity does
      // not turn the WHOLE kernel read-only, only paths that were actually
      // protected).
      me.publicfield("public-value-05-updated");
    } finally {
      (Date as any).now = originalNow;
    }
    assert.equal(me("publicfield"), "public-value-05-updated", "unprotected paths must remain freely writable after lock");
  });

  await test("KNOWN, REPORTED, NOT FIXED THIS ROUND: a write immediately after hydrate() (no lockIdentity() involved) does not leak plaintext, but DOES silently encrypt under an unrecoverable key — data loss, not a confidentiality leak", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("root-scope-lock-password-06");
    me["_"]("root-level-secret-string-06");
    me.topsecret("REAL-VALUE-06");

    const snapshot = me.exportSnapshot();
    assert.equal(snapshot.localSecrets[""], "***", "sanity: exportSnapshot redacts the root-scope secret to the topology placeholder");

    const restored: any = new ME();
    restored.hydrate(snapshot);
    // hydrate() carries the "***" placeholder into localSecrets[""], which
    // makes computeEffectiveSecret() derive a NON-EMPTY (but wrong) key —
    // this branch of commitValueMapping never reaches
    // hasExistingProtectedAncestor at all, so this fix does not cover it.
    restored.topsecret("WRITTEN-AFTER-HYDRATE-WITHOUT-RESUPPLY");

    const rawAfterHydrateWrite = rawIndexValue(restored, "topsecret");
    assert.ok(
      typeof rawAfterHydrateWrite === "string" && rawAfterHydrateWrite.startsWith("b64u:"),
      "confirms this is NOT a plaintext leak — it is real (v3/v4) ciphertext, just encrypted under a garbage, unrecoverable-in-general key",
    );
    // NOT asserted here, deliberately: whether a THIRD, freshly-hydrated
    // instance (given the REAL secret) can read this back. It cannot be —
    // discovered while writing this test, this is itself nondeterministic
    // for a second, separate, pre-existing reason unrelated to this fix:
    // `rebuildIndex()` sorts `_memories` by (timestamp, hash, original
    // index) before replaying them into `self.index`
    // (core-index.ts:65-80), and `applyMemoryToIndex`'s "skip re-indexing
    // a secret-protected path during replay" check
    // (`inSecret = scope && scope.length > 0 && ...`, core-index.ts:17-18,
    // 31) only ever matches BRANCH-mode scopes (`scope.length > 0`) — a
    // ROOT-scope path (`scope.length === 0`) is never skipped, so both the
    // original and the corrupted write for the SAME path get replayed
    // into the index on every hydrate/rebuild. When two writes to the same
    // root-scope path land in the same millisecond (as they do here, with
    // no artificial delay), the hash tiebreak can reorder them, so
    // sometimes the corrupted entry ends up applied last (third's read
    // fails, `null`) and sometimes — by that same tiebreak, not by
    // decryption ever actually succeeding with the wrong key — the
    // ORIGINAL entry ends up applied last instead, and a resupplied real
    // secret then correctly decrypts THAT. Confirmed by running this
    // scenario 8x standalone: `third`'s read varied between `null` and the
    // original value across runs, never the corrupted value. This is a
    // second, real, newly-found gap — root-scope entries are not exempted
    // from index replay the way branch-mode ones are, and same-millisecond
    // replay ordering is not guaranteed to be chronological — reported
    // here, not fixed: fixing it belongs with the already-documented,
    // separately-tracked `applyMemoryToIndex`/`rebuildIndex` behavior, not
    // with this bug's fix (`hasExistingProtectedAncestor`), which never
    // reaches this code path at all (see the comment above).
  });
}

main()
  .then(() => {
    const ok = summarize();
    process.exitCode = ok ? 0 : 1;
  })
  .catch((error) => {
    console.error("Fatal error running root-scope-lock.test.ts:", error);
    process.exitCode = 1;
  });
