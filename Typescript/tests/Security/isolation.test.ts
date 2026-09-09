/// <reference types="node" />
/**
 * §1 AISLAMIENTO ENTRE IDENTIDADES
 *
 * Attack model B (see README.md): "otra identidad que conoce los mismos
 * paths, secretos de rama y noise" — an attacker (or a second legitimate
 * kernel) who knows everything PUBLIC/session-supplied about a target scope
 * (path strings, `_()`/`~()` values) but has a *different* private identity
 * root. None of that knowledge should be sufficient to decrypt v4 ciphertext
 * bound to someone else's root.
 *
 * Distinguishes explicitly (per the task spec) between:
 *   - a vulnerability (identity B opens identity A's data), and
 *   - legitimate recovery (identity A, restored from ITS OWN backup/import,
 *     reopening ITS OWN data — tested at the end of this file, and asserted
 *     to SUCCEED, not fail).
 */
import { MEConstructor as ME, assert, clone, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("§1 Isolation between identities");

async function main() {
  console.log("\n### §1 — Isolation between identities");

  await test("two identities, identical path+secret+noise, wholesale blob copy does not cross-open", async () => {
    const a: any = new ME();
    await a.createIdentityRoot("isolation-password-identity-a-01");
    a.wallet["_"]("shared-secret-string");
    a.wallet.balance(100);

    const b: any = new ME();
    await b.createIdentityRoot("isolation-password-identity-b-01");
    b.wallet["_"]("shared-secret-string");
    b.encryptedBranches = clone(a.encryptedBranches);
    const opened = b("wallet.balance");
    assert.ok(opened === undefined || opened === null, "different root must not open the other's v4 blob");
  });

  await test("copying snapshot/envelope/rootId wholesale from A into B does not grant access without B's own password", async () => {
    const a: any = new ME();
    const { rootId: aRootId } = await a.createIdentityRoot("isolation-password-identity-a-02");
    a.wallet["_"]("shared-secret-string-02");
    a.wallet.balance(200);
    const aSnapshot = a.exportSnapshot();

    // B imports A's full snapshot (envelope, encryptedBranches, rootId — the
    // "attacker with a copy of the storage" case, model A) but does not know
    // A's password.
    const b: any = new ME();
    b.hydrate(aSnapshot);
    assert.equal(b.currentIdentityRootId(), aRootId, "hydrate legitimately restores the same rootId (topology, not a secret)");
    assert.equal(b.isIdentityUnlocked(), false, "importing/hydrating a snapshot never auto-unlocks");
    b.wallet["_"]("shared-secret-string-02");
    const openedWithoutUnlock = b("wallet.balance");
    assert.ok(
      openedWithoutUnlock === undefined || openedWithoutUnlock === null,
      "possessing the envelope+ciphertext+correct scope secret is still not sufficient without the identity password",
    );

    // Wrong password against A's real envelope must fail closed, not open a
    // different (attacker-controlled) derivation.
    await assert.rejects(() => b.unlockIdentity("attacker-guess-does-not-know-real-password"));

    // Sanity: the SAME password (i.e. this is really A's own restore, model
    // "legitimate recovery", not an isolation breach) correctly opens it.
    await b.unlockIdentity("isolation-password-identity-a-02");
    assert.equal(b("wallet.balance"), 200, "the real owner's own password legitimately recovers their own data");
  });

  await test("rootId substitution without the matching private root material fails closed", async () => {
    const owner: any = new ME();
    const { rootId } = await owner.createIdentityRoot("isolation-password-owner-03");
    owner.wallet["_"]("secret-03");
    owner.wallet.balance(33);

    const attacker: any = new ME();
    await attacker.createIdentityRoot("isolation-password-attacker-03");
    // Attacker forges their own envelope's rootId field to match the
    // owner's public rootId (rootId is documented as public/non-secret —
    // this proves that alone is not exploitable).
    const forgedEnvelope = clone(attacker.exportIdentityRootBackup());
    forgedEnvelope.rootId = rootId;
    const forged: any = new ME();
    // importIdentityRootBackup on a kernel with no existing root accepts any
    // shape-valid envelope; forging the rootId field doesn't forge the AEAD
    // AAD binding computed at wrap time (aadFor(rootId) used THEIR real
    // rootId, not the owner's) — so unwrap must fail even under the
    // attacker's own real password.
    forged.importIdentityRootBackup(forgedEnvelope, { force: true });
    await assert.rejects(
      () => forged.unlockIdentity("isolation-password-attacker-03"),
      "forging the public rootId field must not let a mismatched envelope unwrap (AAD binds rootId)",
    );
  });

  await test("cache warming with an authorized identity does not leak into a later different identity in the same process", async () => {
    const kernel: any = new ME();
    await kernel.createIdentityRoot("isolation-password-warm-04");
    kernel.wallet["_"]("secret-04");
    kernel.wallet.balance(44);
    assert.equal(kernel("wallet.balance"), 44, "warm the v4 key cache and decrypted-branch cache");

    // Full identity transition (ME_RESEED) on the SAME kernel object/process.
    kernel("new-identity-who-04", "new-identity-secret-04");
    assert.equal(kernel.hasIdentityRoot(), false, "reseed wipes the old identity root entirely");
    assert.equal(kernel.isIdentityUnlocked(), false);
    // The old scope secret is gone too (Option B / decision #2) — even
    // supplying the exact same secret string again must not resurrect the
    // old cached plaintext, because there is no root to derive v4 keys from
    // at all now, and the old ciphertext for "wallet" isn't reachable
    // through resolveBranchScope until a new `_()` is declared.
    const staleRead = kernel("wallet.balance");
    assert.ok(staleRead === undefined || staleRead === null, "a warmed cache must not survive a full identity transition");

    await kernel.createIdentityRoot("isolation-password-warm-04-second");
    kernel.wallet["_"]("secret-04");
    const freshScopeRead = kernel("wallet.balance");
    assert.ok(
      freshScopeRead === undefined || freshScopeRead === null,
      "the new identity has fresh (empty) branch storage — old ciphertext under the same path/secret string is simply gone, not decrypted from a stale cache",
    );
  });

  await test("repeated identity switch / lock / unlock cycles never cross-open another identity's data", async () => {
    const a: any = new ME();
    await a.createIdentityRoot("isolation-password-cycle-a-05");
    a.wallet["_"]("cycle-secret-a");
    a.wallet.balance(501);

    const b: any = new ME();
    await b.createIdentityRoot("isolation-password-cycle-b-05");
    b.wallet["_"]("cycle-secret-a"); // same secret string, different root
    b.encryptedBranches = clone(a.encryptedBranches);

    for (let i = 0; i < 5; i++) {
      const opened = b("wallet.balance");
      assert.ok(opened === undefined || opened === null, `cycle ${i}: b must not open a's ciphertext`);
      b.lockIdentity();
      assert.equal(b.isIdentityUnlocked(), false);
      await b.unlockIdentity("isolation-password-cycle-b-05");
      b.wallet["_"]("cycle-secret-a");
    }
    // Confirm b's OWN data is unaffected throughout.
    b.wallet.balance(999);
    assert.equal(b("wallet.balance"), 999);
  });

  await test("legitimate recovery: restoring the SAME root with its OWN credentials is recovery, not a violation", async () => {
    const owner: any = new ME();
    const { rootId } = await owner.createIdentityRoot("isolation-password-legit-06");
    owner.wallet["_"]("legit-secret-06");
    owner.wallet.balance(606);

    const backup = owner.exportIdentityRootBackup();
    const branches = clone(owner.encryptedBranches);

    const restored: any = new ME();
    restored.importIdentityRootBackup(backup);
    restored.encryptedBranches = branches;
    await restored.unlockIdentity("isolation-password-legit-06");
    assert.equal(restored.currentIdentityRootId(), rootId);
    restored.wallet["_"]("legit-secret-06");
    assert.equal(restored("wallet.balance"), 606, "the real owner recovering their own root+ciphertext must succeed");
  });

  const ok = summarize();
  if (!ok) {
    process.exitCode = 1;
    throw new Error("§1 isolation battery had failures");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
