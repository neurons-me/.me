/// <reference types="node" />
/**
 * §5 CICLO DE VIDA DE LA RAÍZ
 *
 * Correct/incorrect password; password change preserving rootId/ciphertext;
 * old password rejected after change; lock invalidates access/caches;
 * backup/restore in a new instance; restored root never auto-unlocks branch
 * secrets; reseed/identity transition never carries over old private
 * context; documents that an old envelope copy still opens with its old
 * password (changing password does not revoke copies already taken).
 *
 * Includes the regression test for a real bug found and fixed by this
 * battery: rotateIdentityRoot() previously had NO authentication gate at
 * all when an envelope already existed — a caller holding a reference to a
 * LOCKED kernel (no password knowledge whatsoever) could call it and
 * silently replace the owner's real root/envelope with an attacker-chosen
 * one. Fixed in src/identity-context.ts (see the inline comment there and
 * README.md's "Fallos encontrados" section).
 */
import { MEConstructor as ME, assert, clone, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("§5 Root lifecycle");

async function main() {
  console.log("\n### §5 — Root lifecycle");

  await test("correct password unlocks; incorrect password fails closed", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-password-correct-01");
    me.lockIdentity();
    await assert.rejects(() => me.unlockIdentity("totally-wrong-password-01"));
    assert.equal(me.isIdentityUnlocked(), false);
    await me.unlockIdentity("lifecycle-password-correct-01");
    assert.equal(me.isIdentityUnlocked(), true);
  });

  await test("password change preserves rootId and branch ciphertext byte-for-byte", async () => {
    const me: any = new ME();
    const { rootId } = await me.createIdentityRoot("lifecycle-old-password-02");
    me.wallet["_"]("steel-door-02");
    me.wallet.balance(42);
    const ciphertextBefore = clone(me.encryptedBranches);

    await me.changeIdentityPassword("lifecycle-old-password-02", "lifecycle-new-password-02");
    assert.equal(me.currentIdentityRootId(), rootId, "password change must not rotate the root");
    assert.deepEqual(me.encryptedBranches, ciphertextBefore, "branch ciphertext must be byte-for-byte untouched");
    assert.equal(me("wallet.balance"), 42);
  });

  await test("the previous password is rejected by the updated envelope after a password change", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-old-password-03");
    await me.changeIdentityPassword("lifecycle-old-password-03", "lifecycle-new-password-03");
    me.lockIdentity();
    await assert.rejects(() => me.unlockIdentity("lifecycle-old-password-03"), /wrong password|corrupted/i);
    await me.unlockIdentity("lifecycle-new-password-03");
    assert.equal(me.isIdentityUnlocked(), true);
  });

  await test("changeIdentityPassword itself requires the CORRECT old password (rejects a wrong one)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-real-password-04");
    await assert.rejects(() => me.changeIdentityPassword("totally-wrong-old-password", "lifecycle-attacker-password-04"));
    // Confirm the real password still works — the failed attempt above must
    // not have partially mutated the envelope.
    me.lockIdentity();
    await me.unlockIdentity("lifecycle-real-password-04");
    assert.equal(me.isIdentityUnlocked(), true);
  });

  await test("lock invalidates access even though the ciphertext is unchanged, and clears session secrets", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-password-lock-05");
    me.wallet["_"]("steel-door-05");
    me.wallet.balance(9);
    assert.equal(me("wallet.balance"), 9);

    me.lockIdentity();
    assert.equal(me.isIdentityUnlocked(), false);
    assert.equal(Object.keys(me.localSecrets).length, 0);
    assert.ok([undefined, null].includes(me("wallet.balance")));

    await me.unlockIdentity("lifecycle-password-lock-05");
    assert.ok([undefined, null].includes(me("wallet.balance")), "Option B — unlocking the identity alone never restores branch secrets");
    me.wallet["_"]("steel-door-05");
    assert.equal(me("wallet.balance"), 9, "the data is still intact once the scope secret is resupplied");
  });

  await test("backup/restore in a brand new instance recovers the SAME root", async () => {
    const me: any = new ME();
    const { rootId } = await me.createIdentityRoot("lifecycle-password-backup-06");
    const backup = me.exportIdentityRootBackup();
    assert.equal(backup.rootId, rootId);

    const restored: any = new ME();
    restored.importIdentityRootBackup(backup);
    assert.equal(restored.hasIdentityRoot(), true);
    assert.equal(restored.isIdentityUnlocked(), false, "import alone never unlocks");
    await restored.unlockIdentity("lifecycle-password-backup-06");
    assert.equal(restored.currentIdentityRootId(), rootId);
  });

  await test("a restored root never auto-unlocks branch secrets, even after unlockIdentity", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-password-restore-07");
    me.wallet["_"]("branch-secret-07");
    me.wallet.balance(707);
    const backup = me.exportIdentityRootBackup();
    const branches = clone(me.encryptedBranches);

    const restored: any = new ME();
    restored.importIdentityRootBackup(backup);
    restored.encryptedBranches = branches;
    await restored.unlockIdentity("lifecycle-password-restore-07");
    assert.equal(Object.keys(restored.localSecrets).length, 0, "import+unlock must not restore localSecrets");
    assert.ok([undefined, null].includes(restored("wallet.balance")), "branch secret must still be missing after restore+unlock");
    restored.wallet["_"]("branch-secret-07");
    assert.equal(restored("wallet.balance"), 707);
  });

  await test("reseed (full identity transition) wipes the root and never carries over old private context", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-password-reseed-08");
    me.wallet["_"]("old-identity-secret-08");
    me.wallet.balance(808);
    assert.equal(me("wallet.balance"), 808);

    me("brand-new-who-08", "brand-new-secret-08"); // ME_RESEED
    assert.equal(me.hasIdentityRoot(), false, "reseed must wipe the old identity root entirely, not just lock it");
    assert.equal(me.isIdentityUnlocked(), false);
    assert.equal(me.currentIdentityRootId(), null);
    assert.equal(Object.keys(me.localSecrets).length, 0, "reseed must not carry over old _() declarations");
    assert.equal(Object.keys(me.localNoises).length, 0, "reseed must not carry over old ~() declarations");
  });

  await test("DOCUMENTED (not a bug): an old envelope copy taken before a password change still opens with the old password", async () => {
    // Per typedocs/Identity-Bound-Secrets.md §5: "changing password does not
    // revoke copies already obtained." This is expected for a
    // client-side-encrypted, no-server-revocation-list design — documented
    // here explicitly so it's not mistaken for an oversight.
    const me: any = new ME();
    await me.createIdentityRoot("lifecycle-password-oldcopy-09");
    const oldEnvelopeCopy = me.exportIdentityRootBackup();
    await me.changeIdentityPassword("lifecycle-password-oldcopy-09", "lifecycle-password-oldcopy-09-NEW");

    const fromOldCopy: any = new ME();
    fromOldCopy.importIdentityRootBackup(oldEnvelopeCopy);
    // The OLD copy + OLD password still unlocks — because it's a genuinely
    // separate, still-valid ciphertext object that was never told about the
    // password change (no revocation mechanism exists or is claimed).
    await fromOldCopy.unlockIdentity("lifecycle-password-oldcopy-09");
    assert.equal(fromOldCopy.isIdentityUnlocked(), true, "an old envelope copy is NOT retroactively invalidated by a later password change on a different copy");
  });

  await test(
    "REGRESSION (fixed bug): rotateIdentityRoot() must require the identity to already be " +
      "unlocked when an envelope exists — before the fix, a caller with ZERO password knowledge " +
      "could rotate (destroy+replace) a LOCKED owner's root",
    async () => {
      const owner: any = new ME();
      const { rootId: originalRootId } = await owner.createIdentityRoot("lifecycle-owner-real-password-10");
      owner.wallet["_"]("owner-branch-secret-10");
      owner.wallet.balance(1010);
      owner.lockIdentity();
      assert.equal(owner.isIdentityUnlocked(), false, "test setup: identity is locked, simulating a process that never authenticated");

      // Attacker holds a reference to `owner` (e.g. shared kernel object,
      // exposed API) but does NOT know the password. Before the fix, this
      // call succeeded unconditionally given only the acknowledgement flag.
      await assert.rejects(
        () =>
          owner.rotateIdentityRoot("attacker-chosen-password-10", {
            acknowledgeExistingV4CiphertextBecomesUnreadable: true,
          }),
        /locked/i,
        "rotating a LOCKED root without ever proving ownership must be rejected",
      );

      // Confirm the ORIGINAL root/envelope survived the attempted attack —
      // the real owner can still unlock with their real password.
      assert.equal(owner.currentIdentityRootId(), originalRootId, "a rejected rotate attempt must not have mutated the envelope/rootId");
      await owner.unlockIdentity("lifecycle-owner-real-password-10");
      assert.equal(owner.currentIdentityRootId(), originalRootId);
      owner.wallet["_"]("owner-branch-secret-10");
      assert.equal(owner("wallet.balance"), 1010, "the owner's real data must be completely intact after the rejected attack");

      // Legitimate rotation (proving ownership first via unlockIdentity)
      // must still work — this fix tightens authentication, not the
      // documented rotate contract itself.
      const { rootId: newRootId, previousRootId } = await owner.rotateIdentityRoot("lifecycle-owner-new-password-10", {
        acknowledgeExistingV4CiphertextBecomesUnreadable: true,
      });
      assert.notEqual(newRootId, originalRootId);
      assert.equal(previousRootId, originalRootId);
      assert.equal(owner.currentIdentityRootId(), newRootId);
    },
  );

  await test("rotating a kernel with NO existing root yet (first-time mint via rotate) is unaffected by the fix", async () => {
    const me: any = new ME();
    assert.equal(me.hasIdentityRoot(), false);
    const { rootId } = await me.rotateIdentityRoot("lifecycle-first-mint-password-11", {
      acknowledgeExistingV4CiphertextBecomesUnreadable: true,
    });
    assert.ok(rootId);
    assert.equal(me.isIdentityUnlocked(), true, "minting a root via rotate() on an empty kernel still leaves it unlocked this session, same as createIdentityRoot()");
  });

  const ok = summarize();
  if (!ok) {
    process.exitCode = 1;
    throw new Error("§5 root-lifecycle battery had failures");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
