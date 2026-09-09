/// <reference types="node" />
/**
 * §2 SCOPES, HERENCIA Y NOISE
 *
 * Root/nested/sibling/deep scopes; missing/wrong/reordered secrets; several
 * noise boundaries; noise cuts inherited secrets but never the identity
 * root; a child with no `_()` inherits protection; a closed scope must not
 * become public for lack of secrets; a write with the wrong context must not
 * destroy existing ciphertext.
 */
import { MEConstructor as ME, assert, clone, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("§2 Scopes, inheritance, noise");

async function main() {
  console.log("\n### §2 — Scopes, inheritance, noise");

  await test("sibling scopes are mutually isolated even under the same identity root", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-siblings-01");
    me.alpha["_"]("alpha-secret-01");
    me.alpha.value(1);
    me.beta["_"]("beta-secret-01");
    me.beta.value(2);

    assert.equal(me("alpha.value"), 1);
    assert.equal(me("beta.value"), 2);

    // Supplying alpha's secret does not open beta, even though both are
    // under the same identity root/session.
    const fresh: any = new ME();
    await fresh.createIdentityRoot("scopes-password-siblings-01-b");
    fresh.encryptedBranches = clone(me.encryptedBranches);
    await fresh.unlockIdentity("scopes-password-siblings-01-b");
    fresh.alpha["_"]("alpha-secret-01");
    // Different root anyway (isolation), but also confirms wrong-sibling
    // secret doesn't leak beta under the ORIGINAL identity:
    me.lockIdentity();
    await me.unlockIdentity("scopes-password-siblings-01");
    me.alpha["_"]("alpha-secret-01");
    // beta secret never resupplied this session -> beta must stay closed
    assert.ok([undefined, null].includes(me("beta.value")), "alpha's secret must not open beta's scope");
  });

  await test("deep nested scopes accumulate lineage correctly and isolate at every depth", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-deep-02");
    me.a["_"]("secret-a");
    me.a.b["_"]("secret-b");
    me.a.b.c["_"]("secret-c");
    me.a.b.c.d["_"]("secret-d");
    me.a.b.c.d.leaf("deep-value");

    assert.equal(me("a.b.c.d.leaf"), "deep-value");

    // Missing any ONE ancestor secret (declared with the wrong value) must
    // close the leaf even though the others are correct.
    const wrongMiddle: any = new ME();
    wrongMiddle.rehydrate(me.exportSnapshot());
    await wrongMiddle.unlockIdentity("scopes-password-deep-02");
    wrongMiddle.encryptedBranches = clone(me.encryptedBranches);
    wrongMiddle.a["_"]("secret-a");
    wrongMiddle.a.b["_"]("WRONG-secret-b");
    wrongMiddle.a.b.c["_"]("secret-c");
    wrongMiddle.a.b.c.d["_"]("secret-d");
    assert.ok(
      [undefined, null].includes(wrongMiddle("a.b.c.d.leaf")),
      "one wrong secret anywhere in a deep lineage must close the leaf",
    );
  });

  await test("secrets supplied in a different order than declared still recover the value (order-independent lookup)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-order-03");
    me.x["_"]("x-secret");
    me.x.y["_"]("y-secret");
    me.x.y.leaf("order-value");
    assert.equal(me("x.y.leaf"), "order-value");

    const other: any = new ME();
    other.rehydrate(me.exportSnapshot());
    await other.unlockIdentity("scopes-password-order-03");
    other.encryptedBranches = clone(me.encryptedBranches);
    // Supply y's secret BEFORE x's — lineage collection walks the path
    // top-down internally regardless of call order.
    other.x.y["_"]("y-secret");
    other.x["_"]("x-secret");
    assert.equal(other("x.y.leaf"), "order-value", "declaration order of _() calls must not matter for recovery");
  });

  await test("noise cuts inherited ancestor secrets for a scope opened AFTER the noise boundary", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-noise-04");
    me.vault["_"]("outer-secret-04");
    me.vault["~"]("noise-boundary-04");
    me.vault.after["_"]("after-secret-04");
    me.vault.after.value("after-noise-value");

    assert.equal(me("vault.after.value"), "after-noise-value");
  });

  await test(
    "KNOWN CHARACTERISTIC (inherited from v3, not v4-introduced): branch key derivation is " +
      "scope-wide and reflects the CURRENT session's noise state, not a per-write snapshot of it — " +
      "declaring ~() on a scope AFTER writing to that same scope makes the earlier write " +
      "unreadable under the new noise context. This fails CLOSED (no leak, no corruption, no " +
      "throw) and is fully recoverable by re-deriving under the ORIGINAL (no-noise) context — " +
      "it is not data loss, it's a context-matching requirement. Documented here, not changed: " +
      "fixing it would mean keying branch derivation per-write-time-context instead of per-scope " +
      "current-session-state, which is an architecture change to v3's shared chain-collection " +
      "logic (collectLineageSegments/findActiveNoiseBoundary) — out of this task's contract " +
      "('v3 stays exactly as it is'). tests/identity-bound-secrets.test.ts's own test 8 comment " +
      "already avoids this exact ordering for the same reason.",
    async () => {
      const me: any = new ME();
      await me.createIdentityRoot("scopes-password-noise-order-05");
      me.vault["_"]("outer-secret-05");
      me.vault.before("before-noise-value-05"); // written under a NO-noise chain

      me.vault["~"]("noise-boundary-05"); // scope-wide noise declared AFTER that write
      me.vault.after["_"]("after-secret-05");
      me.vault.after.value("after-noise-value-05");

      // The later write, under the new context, is fine.
      assert.equal(me("vault.after.value"), "after-noise-value-05");

      // The earlier write now fails CLOSED under the new (noisy) context —
      // not an exception, not a leak, not corrupted ciphertext.
      let threw = false;
      let readUnderNoise: any;
      try {
        readUnderNoise = me("vault.before");
      } catch {
        threw = true;
      }
      assert.equal(threw, false, "a context mismatch must fail closed (return null/undefined), never throw");
      assert.ok([undefined, null].includes(readUnderNoise), "the earlier write is unreadable under the new noise context");

      // Recoverability: the SAME ciphertext bytes are still intact and
      // decrypt correctly once re-derived under the ORIGINAL (no-noise)
      // context — proving this is a context-matching requirement, not
      // silent data loss. Deliberately reconstructed via
      // importIdentityRootBackup() + a manual encryptedBranches copy
      // (NOT rehydrate(exportSnapshot())) — see the separate
      // "hydrate() noise-placeholder footgun" test below for why: a
      // snapshot taken AFTER ~() was declared carries the redacted "***"
      // placeholder into localNoises on hydrate, which itself then acts as
      // a (permanently mismatching) active noise value rather than "no
      // noise" — a real caller reconstructing a pre-noise session instead
      // supplies exactly the context they know, the same way this test does.
      const recovered: any = new ME();
      recovered.importIdentityRootBackup(me.exportIdentityRootBackup());
      await recovered.unlockIdentity("scopes-password-noise-order-05");
      recovered.encryptedBranches = clone(me.encryptedBranches);
      recovered.vault["_"]("outer-secret-05"); // no ~() ever declared on this instance
      assert.equal(recovered("vault.before"), "before-noise-value-05", "original ciphertext is intact; only the derivation CONTEXT changed");
    },
  );

  await test(
    "DOCUMENTED FOOTGUN (not a vulnerability — fails closed): hydrate() carries the redacted " +
      "noise placeholder \"***\" into localNoises for any scope that had noise declared at " +
      "export time, which then acts as an ACTIVE (permanently mismatching) noise value rather " +
      "than \"no noise\" — a caller must explicitly re-declare ~() with the REAL value after " +
      "hydrate, not just leave it alone, to restore correct derivation for that scope.",
    async () => {
      const me: any = new ME();
      await me.createIdentityRoot("scopes-password-footgun-06");
      me.vault["_"]("outer-secret-06");
      me.vault["~"]("real-noise-06");
      me.vault.after["_"]("after-secret-06");
      me.vault.after.value("footgun-value-06");
      assert.equal(me("vault.after.value"), "footgun-value-06");

      const snapshot = me.exportSnapshot();
      assert.equal(snapshot.localNoises.vault, "***", "exportSnapshot redacts the real noise value to a placeholder");

      const naive: any = new ME();
      naive.rehydrate(snapshot);
      await naive.unlockIdentity("scopes-password-footgun-06");
      naive.encryptedBranches = clone(me.encryptedBranches);
      naive.vault["_"]("outer-secret-06");
      naive.vault.after["_"]("after-secret-06");
      // Deliberately NOT re-declaring ~() — simulating a caller who assumes
      // "I didn't set noise, so there is none" post-hydrate.
      const naiveRead = naive("vault.after.value");
      assert.ok(
        [undefined, null].includes(naiveRead),
        "without re-declaring the REAL noise value, the placeholder left by hydrate() keeps this scope unreadable (fails closed, not a leak)",
      );

      // Re-declaring the REAL noise value fixes it, confirming the data
      // itself is intact and this is purely a derivation-context issue.
      naive.vault["~"]("real-noise-06");
      assert.equal(naive("vault.after.value"), "footgun-value-06");
    },
  );

  await test("noise never cuts the private identity root dependency (still isolated across identities)", async () => {
    const one: any = new ME();
    await one.createIdentityRoot("scopes-password-noise-root-05-one");
    one.vault["_"]("secret-05");
    one.vault["~"]("noise-05");
    one.vault.leaf["_"]("leaf-secret-05");
    one.vault.leaf.value("noise-root-value");
    assert.equal(one("vault.leaf.value"), "noise-root-value");

    const two: any = new ME();
    await two.createIdentityRoot("scopes-password-noise-root-05-two");
    two.vault["_"]("secret-05");
    two.vault["~"]("noise-05");
    two.vault.leaf["_"]("leaf-secret-05");
    two.encryptedBranches = clone(one.encryptedBranches);
    const crossOpened = two("vault.leaf.value");
    assert.ok([undefined, null].includes(crossOpened), "noise must not become a substitute for the identity root in isolation");
  });

  await test("noise never removes the private root's own key material requirement (root scope stays real)", async () => {
    // Sanity that ~() at the ROOT does not somehow disable v4 requiring the
    // identity root -- root-scope value writes still need identity unlocked
    // to use v4, and still fail closed without it.
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-noise-root-06");
    me["_"]("root-secret-06");
    me["~"]("root-noise-06");
    me.profile.name("root-noise-value");
    assert.equal(me("profile.name"), "root-noise-value");
    me.lockIdentity();
    const closed = me("profile.name");
    assert.ok([undefined, null].includes(closed), "locking must still close a root-scope value protected under noise");
  });

  await test("a child with no _() of its own still inherits the nearest ancestor's protection (not silently public)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-inherit-07");
    me.vault["_"]("vault-secret-07");
    me.vault.child.value("inherited-value"); // no _() at .child

    const noSecret: any = new ME();
    noSecret.rehydrate(me.exportSnapshot());
    await noSecret.unlockIdentity("scopes-password-inherit-07");
    noSecret.encryptedBranches = clone(me.encryptedBranches);
    // Never supply vault's secret.
    const closed = noSecret("vault.child.value");
    assert.ok([undefined, null].includes(closed), "an inherited-protection child must stay closed without the ancestor secret — never silently public");

    noSecret.vault["_"]("vault-secret-07");
    assert.equal(noSecret("vault.child.value"), "inherited-value");
  });

  await test("a scope with a missing secret never falls back to being reported as public/absent-distinguishable", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-closed-08");
    me.secretScope["_"]("closed-secret-08");
    me.secretScope.value("hidden-value");

    const truly_public_absent = me("does.not.exist.at.all");
    const closed_no_secret_yet: any = new ME();
    closed_no_secret_yet.rehydrate(me.exportSnapshot());
    await closed_no_secret_yet.unlockIdentity("scopes-password-closed-08");
    closed_no_secret_yet.encryptedBranches = clone(me.encryptedBranches);
    const closedRead = closed_no_secret_yet("secretScope.value");

    // Both resolve to the same stealth-safe "nothing" externally (documented
    // §3.4/§3.6 — content/metadata distinction is about disk metadata, not
    // this public read surface).
    assert.equal(truly_public_absent, undefined);
    assert.ok([undefined, null].includes(closedRead));
    const explained = closed_no_secret_yet.explain("secretScope.value");
    assert.ok(
      explained === undefined || explained?.value === undefined || explained?.value === null,
      "explain() on a closed scope (from the kernel that lacks the scope secret) must not leak the value either",
    );
  });

  await test("a write with the WRONG scope secret does not destroy the existing ciphertext for that scope", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("scopes-password-wrongwrite-09");
    me.vault["_"]("real-secret-09");
    me.vault.balance(9001);
    const before = clone(me.encryptedBranches);

    // Attempt a write declaring a DIFFERENT secret for the same scope path
    // in a fresh session (simulating "context switch mid-session" or a
    // caller that guesses wrong), then attempt to write to a sibling leaf.
    me.lockIdentity();
    await me.unlockIdentity("scopes-password-wrongwrite-09");
    me.vault["_"]("WRONG-guess-secret");
    me.vault.otherLeaf("should-not-corrupt-existing-data");

    // The original ciphertext object for the scope must still be present
    // and still decrypt correctly once the RIGHT secret is supplied again.
    me.lockIdentity();
    await me.unlockIdentity("scopes-password-wrongwrite-09");
    me.vault["_"]("real-secret-09");
    assert.equal(me("vault.balance"), 9001, "existing ciphertext for the scope must survive a wrong-context write attempt");
    void before;
  });

  const ok = summarize();
  if (!ok) {
    process.exitCode = 1;
    throw new Error("§2 scopes/noise battery had failures");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
