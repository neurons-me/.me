/// <reference types="node" />
/**
 * Behavioral acceptance tests for Identity-Bound Secrets
 * (typedocs/Identity-Bound-Secrets.md). Each `test()` below is numbered to
 * match the task's "PRUEBAS DE ACEPTACIÓN" list 1-11.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-ignore -- runtime verification intentionally targets the built artifact.
import ME from "../dist/me.es.js";
import { detectBlobVersion } from "../src/crypto.ts";

const { DiskStore } = ME as typeof ME & {
  DiskStore: typeof import("../src/instance-store.ts").DiskStore;
};

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✅ ${name}`))
    .catch((err) => {
      console.error(`❌ ${name}`);
      throw err;
    });
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(normalized, "base64"));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Flips a decoded byte (not a base64 text character — the last base64url
 * *character* of a blob can have unused padding bits that don't map to any
 * real byte, so text-level flipping is unreliable) and re-encodes. Works on
 * either the `"b64u:"`-prefixed v4 format or a bare base64url string such
 * as an identity-root envelope's `aead.ciphertext`/`iv` field.
 */
function tamperB64u(blob: string): string {
  const prefix = blob.startsWith("b64u:") ? "b64u:" : "";
  const payload = prefix ? blob.slice(prefix.length) : blob;
  const bytes = base64UrlToBytes(payload);
  bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0xff;
  return prefix + bytesToBase64Url(bytes);
}

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function main(): Promise<void> {
  console.log("\n### Identity-Bound Secrets — Acceptance Tests");

  // 1. Two identities, same paths/secrets/noise, do not open each other's
  // v4 blobs even when one copies the other's storage wholesale.
  await test("1. cross-identity isolation: same path/secret, different root, ciphertext not interchangeable", async () => {
    const a: any = new ME();
    await a.createIdentityRoot("password-for-identity-a");
    a.wallet["_"]("shared-secret-string");
    a.wallet.balance(100);
    assert.equal(a("wallet.balance"), 100);

    const b: any = new ME();
    await b.createIdentityRoot("password-for-identity-b");
    b.wallet["_"]("shared-secret-string"); // byte-identical path + secret
    b.wallet.balance(999); // b's own value, irrelevant to the assertion below

    // b imports a's encrypted storage wholesale (simulates a stolen disk copy).
    b.encryptedBranches = clone(a.encryptedBranches);
    // Same path, same declared secret string, same noise (none) — but b's
    // identity root differs from a's, so b must not be able to open it.
    const opened = b("wallet.balance");
    assert.ok(opened === undefined || opened === null, "different identity root must not open the other's v4 blob");
  });

  // 2. The correct identity, without the scope's own `_()` secret, still
  // cannot open the branch.
  await test("2. correct identity without the scope secret still cannot open the branch", async () => {
    const owner: any = new ME();
    await owner.createIdentityRoot("password-for-owner-identity");
    owner.wallet["_"]("scope-secret-value");
    owner.wallet.balance(50);

    const backup = owner.exportIdentityRootBackup();
    const sameIdentityNoScopeSecret: any = new ME();
    sameIdentityNoScopeSecret.importIdentityRootBackup(backup);
    await sameIdentityNoScopeSecret.unlockIdentity("password-for-owner-identity");
    sameIdentityNoScopeSecret.encryptedBranches = clone(owner.encryptedBranches);

    // Right identity root, right ciphertext — but the scope's own `_()`
    // secret was never supplied in this session.
    const opened = sameIdentityNoScopeSecret("wallet.balance");
    assert.ok(opened === undefined || opened === null, "identity alone must not be sufficient without the scope secret");

    // Supplying it now (still the same session) opens it correctly —
    // confirms the failure above was really about the missing secret, not
    // a broken identity/root wiring.
    sameIdentityNoScopeSecret.wallet["_"]("scope-secret-value");
    assert.equal(sameIdentityNoScopeSecret("wallet.balance"), 50);
  });

  // 3. Noise cuts inherited secret lineage while identity isolation still holds.
  await test("3. noise cuts inherited lineage and identity isolation still holds", async () => {
    const one: any = new ME();
    await one.createIdentityRoot("password-for-noise-identity-one");
    one.wallet["_"]("alpha-secret");
    one.wallet.hidden.notes("alpha-note");
    one.wallet["~"]("noise-boundary-A");
    one.wallet.hidden["_"]("beta-secret");
    one.wallet.hidden.seed("beta-seed-value");

    // Within the same session, the nested `_()` beyond the noise boundary
    // is reachable — its own secret was supplied.
    assert.equal(one("wallet.hidden.seed"), "beta-seed-value");

    const two: any = new ME();
    await two.createIdentityRoot("password-for-noise-identity-two");
    two.wallet["_"]("alpha-secret");
    two.wallet.hidden.notes("alpha-note");
    two.wallet["~"]("noise-boundary-A");
    two.wallet.hidden["_"]("beta-secret");
    two.wallet.hidden.seed("beta-seed-value");

    // Byte-identical paths, secrets, and noise value — but a different
    // identity root. `two` must not be able to open `one`'s ciphertext.
    two.encryptedBranches = clone(one.encryptedBranches);
    const crossOpened = two("wallet.hidden.seed");
    assert.ok(crossOpened === undefined || crossOpened === null, "noise-scoped ciphertext must still be identity-isolated");
  });

  // 4. Public navigation, nested scopes, and inheritance all work normally
  // once identity-bound secrets are in play.
  await test("4. public navigation, nested scopes, and inheritance work", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("password-for-navigation-identity");
    me.profile.name("Public Person");
    me.wallet["_"]("outer-secret");
    me.wallet.balance(10);
    me.wallet.crypto["_"]("inner-secret"); // nested `_()` adds to the lineage
    me.wallet.crypto.key("nested-key-value");

    assert.equal(me("profile.name"), "Public Person", "public paths need no unlock");
    assert.equal(me("wallet"), undefined, "the scope root itself stays stealth");
    assert.equal(me("wallet.balance"), 10, "unlocked scope is readable this session");
    assert.equal(me("wallet.crypto.key"), "nested-key-value", "nested secret inherits/accumulates correctly");
  });

  // 5. Save/restart leaves scopes closed; supplying the correct context
  // afterward recovers the data without ever reclassifying it as public.
  await test("5. save/restart leaves scopes closed; correct context recovers data", async () => {
    const me: any = new ME();
    const { rootId } = await me.createIdentityRoot("password-for-restart-identity");
    me.wallet["_"]("steel-door");
    me.wallet.balance(777);

    const snapshot = me.exportSnapshot();
    assert.equal(snapshot.localSecrets.wallet, "***", "exportSnapshot() must redact the real secret");
    assert.ok(snapshot.identityRoot, "wrapped identity root envelope must be carried by the snapshot");
    assert.equal(typeof snapshot.identityRoot.aead.ciphertext, "string");

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    assert.equal(restored.hasIdentityRoot(), true);
    assert.equal(restored.isIdentityUnlocked(), false, "unlocking is never automatic after hydrate");
    assert.equal(restored("wallet"), undefined, "scope root stays stealth, not reclassified public");
    assert.equal(restored("wallet.balance"), undefined, "closed scope stays closed until the secret is resupplied");

    await restored.unlockIdentity("password-for-restart-identity");
    assert.equal(restored.currentIdentityRootId(), rootId);
    assert.equal(restored("wallet.balance"), undefined, "unlocking the identity alone still does not restore the branch secret (Option B)");
    restored.wallet["_"]("steel-door");
    assert.equal(restored("wallet.balance"), 777, "supplying the correct context recovers the data");
  });

  // 6. A new password unlocks the SAME root and keeps branch ciphertext
  // intact; the previous password fails against the updated envelope.
  await test("6. password change preserves the root and ciphertext; old password stops working", async () => {
    const me: any = new ME();
    const { rootId } = await me.createIdentityRoot("old-password-value-1");
    me.wallet["_"]("steel-door");
    me.wallet.balance(42);
    const ciphertextBefore = clone(me.encryptedBranches);

    await me.changeIdentityPassword("old-password-value-1", "new-password-value-2");
    assert.equal(me.currentIdentityRootId(), rootId, "password change must not rotate the root");
    assert.deepEqual(me.encryptedBranches, ciphertextBefore, "branch ciphertext must be untouched by a password change");
    assert.equal(me("wallet.balance"), 42, "still readable in-session immediately after the change");

    me.lockIdentity();
    await assert.rejects(() => me.unlockIdentity("old-password-value-1"), /wrong password|corrupted/i);
    await me.unlockIdentity("new-password-value-2");
    me.wallet["_"]("steel-door");
    assert.equal(me("wallet.balance"), 42);
  });

  // 7. Locking, and a full identity transition, both invalidate access and caches.
  await test("7. lock and identity transition invalidate access and caches", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("password-for-lock-identity");
    me.wallet["_"]("steel-door");
    me.wallet.balance(9);
    assert.equal(me("wallet.balance"), 9);

    me.lockIdentity();
    assert.equal(me.isIdentityUnlocked(), false);
    assert.equal(Object.keys(me.localSecrets).length, 0, "lock clears session-supplied _() values");
    const afterLock = me("wallet.balance");
    assert.ok(afterLock === undefined || afterLock === null, "locking invalidates access even though ciphertext is unchanged");

    const other: any = new ME();
    await other.createIdentityRoot("password-for-transition-identity");
    other.wallet["_"]("steel-door");
    other.wallet.balance(5);
    assert.equal(other("wallet.balance"), 5);

    other("new-who", "new-secret"); // ME_RESEED — a full identity transition
    assert.equal(other.hasIdentityRoot(), false, "a new identity starts with no root from the old one");
    assert.equal(other.isIdentityUnlocked(), false);
    assert.equal(Object.keys(other.localSecrets).length, 0, "identity transition must not carry over the old identity's _() values");
  });

  // 8. Snapshots and real generated files never contain the test's own
  // marker strings used as secrets/noise, in the clear. See the note below
  // about `memory.expression` for why a branch-scoped *value* marker is
  // checked separately, as a known and documented (not silently hidden)
  // residual gap rather than folded into the main assertion.
  await test("8. generated snapshot and disk files never contain plaintext secret/noise markers", async () => {
    const MARKERS = [
      "MARKER_PASSWORD_TOKEN",
      "MARKER_SECRET_TOKEN",
      "MARKER_NOISE_TOKEN",
      "MARKER_NESTED_SECRET_TOKEN",
    ];
    const BRANCH_VALUE_MARKER = "MARKER_BRANCH_VALUE_TOKEN";

    const dir = tempDir("me-identity-bound-secrets-");
    try {
      const me: any = new ME(undefined, { store: new DiskStore({ baseDir: dir }) });
      await me.createIdentityRoot("MARKER_PASSWORD_TOKEN");
      me.vault["_"]("MARKER_SECRET_TOKEN");
      // Noise is declared before vault.balance is written (not after) so the
      // scope's effective-secret derivation is stable for the rest of this
      // test: `~()` cuts inherited lineage for whatever is written under it
      // from that point on, so a later write to the SAME scope after a NEW
      // noise declaration would need a different (rotated) key than an
      // earlier one — orthogonal to what this test is proving, so it's
      // avoided here by ordering, not by skipping noise coverage.
      me.vault["~"]("MARKER_NOISE_TOKEN");
      me.vault.balance(BRANCH_VALUE_MARKER);
      me.vault.hidden["_"]("MARKER_NESTED_SECRET_TOKEN");
      me.vault.hidden.data("still-protected-under-hidden");

      const snapshot = me.exportSnapshot();
      const serializedSnapshot = JSON.stringify(snapshot);
      for (const marker of MARKERS) {
        assert.ok(!serializedSnapshot.includes(marker), `exportSnapshot() output must not contain "${marker}"`);
      }

      // The branch write's `value` memory field is fixed (this task's
      // core-write.ts change — see MEMORY_LOG_SECRET_PLACEHOLDER) and must
      // never carry the plaintext marker.
      const branchMemory = (snapshot.memories as any[]).find((m) => m.path === "vault.balance");
      assert.ok(branchMemory, "expected a memory record for vault.balance");
      assert.equal(branchMemory.value, "***", "branch-scoped memory.value must be redacted, not the plaintext");

      // CLOSED (see typedocs/Identity-Bound-Secrets.md §9.1's resolution):
      // `memory.expression` is now also redacted for protected writes —
      // `commitValueMapping` (core-write.ts) redacts it to the same "***"
      // placeholder alongside `value`, in both branch and value mode. This
      // assertion replaces the prior "KNOWN GAP" canary: it now asserts the
      // marker's ABSENCE, and fails loudly if a future change reintroduces
      // the leak.
      assert.equal(branchMemory.expression, "***", "branch-scoped memory.expression must be redacted, not the plaintext");
      assert.ok(
        !serializedSnapshot.includes(BRANCH_VALUE_MARKER),
        "memory.expression must not leak plaintext for protected writes",
      );

      // Confidentiality alone isn't the whole contract — prove the exact same
      // data is still correctly recoverable after a real rehydrate, exactly
      // the way modules/monad/Typescript/src/kernel/manager.ts's
      // getKernel() consumes a persisted snapshot: hydrate() from the
      // disk-safe JSON, unlock the identity root, resupply the branch
      // secrets (Option B — no silent recovery), and read the original
      // values back unchanged.
      const reopened: any = new ME(undefined, { store: new DiskStore({ baseDir: tempDir("me-identity-bound-secrets-reopen-") }) });
      reopened.hydrate(JSON.parse(serializedSnapshot));
      assert.equal(reopened("vault.balance"), undefined, "closed scope must stay closed before unlock+resupply");
      await reopened.unlockIdentity("MARKER_PASSWORD_TOKEN");
      assert.equal(reopened("vault.balance"), undefined, "unlocking identity alone must not silently recover a branch secret");
      reopened.vault["_"]("MARKER_SECRET_TOKEN");
      reopened.vault["~"]("MARKER_NOISE_TOKEN");
      assert.equal(reopened("vault.balance"), BRANCH_VALUE_MARKER, "resupplying the branch secret and noise must recover the exact original value");
      reopened.vault.hidden["_"]("MARKER_NESTED_SECRET_TOKEN");
      assert.equal(
        reopened("vault.hidden.data"),
        "still-protected-under-hidden",
        "nested branch secret must also recover its exact original value",
      );

      // Simulate exactly what modules/monad/Typescript/src/kernel/manager.ts's
      // saveSnapshot() does: JSON.stringify the export and write it to disk.
      const snapshotPath = path.join(dir, "snapshot.json");
      fs.writeFileSync(snapshotPath, serializedSnapshot, "utf8");
      const onDisk = fs.readFileSync(snapshotPath, "utf8");
      for (const marker of MARKERS) {
        assert.ok(!onDisk.includes(marker), `snapshot.json on disk must not contain "${marker}"`);
      }

      // Also check every file DiskStore itself actually wrote for the
      // branch ciphertext (not just the top-level snapshot.json).
      const files = fs.readdirSync(dir, { recursive: true } as any) as string[];
      for (const file of files) {
        const fullPath = path.join(dir, String(file));
        if (!fs.statSync(fullPath).isFile()) continue;
        let contents: string;
        try {
          contents = fs.readFileSync(fullPath, "utf8");
        } catch {
          continue; // not a text file; nothing meaningful to scan
        }
        for (const marker of MARKERS) {
          assert.ok(!contents.includes(marker), `${file} must not contain "${marker}"`);
        }
      }
    } finally {
      cleanup(dir);
    }
  });

  // 9. Ciphertext/context alterations fail closed — no fallback, no data loss.
  await test("9. ciphertext and context tampering fail closed without fallback", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("password-for-tamper-identity");
    me.wallet["_"]("steel-door");
    me.wallet.balance(88);

    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];
    assert.equal(detectBlobVersion(original), "v4");

    me.encryptedBranches.wallet[chunkId] = tamperB64u(original);
    const tamperedRead = me("wallet.balance");
    assert.ok(tamperedRead === undefined || tamperedRead === null, "tampered v4 ciphertext must fail closed, not throw or fall back");

    // Restoring the original ciphertext (no data was actually lost) reads correctly again.
    me.encryptedBranches.wallet[chunkId] = original;
    assert.equal(me("wallet.balance"), 88);

    // Tampering the wrapped root envelope itself must also fail closed —
    // unlockIdentity throws rather than silently accepting bad ciphertext.
    const envelope = me.exportIdentityRootBackup();
    const tamperedEnvelope = clone(envelope);
    tamperedEnvelope.aead.ciphertext = tamperB64u(tamperedEnvelope.aead.ciphertext);
    const other: any = new ME();
    other.importIdentityRootBackup(tamperedEnvelope, { force: true });
    await assert.rejects(() => other.unlockIdentity("password-for-tamper-identity"));
  });

  // 10. An interrupted migration resumes, keeps pendings, and covers both
  // branch and value blobs.
  await test("10. interrupted v3->v4 migration is resumable, idempotent, and covers branch + value blobs", async () => {
    // Branch blobs.
    const branchSource: any = new ME();
    branchSource.wallet["_"]("wallet-secret-value");
    branchSource.wallet.balance(500);
    branchSource.vault["_"]("vault-secret-value");
    branchSource.vault.data(999);

    const migrating: any = new ME();
    migrating.rehydrate(branchSource.exportSnapshot());
    await migrating.createIdentityRoot("password-for-migration-identity");

    // "Interrupted": only wallet's secret is available this session.
    migrating.wallet["_"]("wallet-secret-value");
    const firstPass = migrating.migrateEncryptedBranchesToV4();
    assert.ok(firstPass.migratedScopes >= 1, "wallet should migrate");
    assert.ok(firstPass.pendingScopes.includes("vault"), "vault must be recorded pending, not dropped");
    assert.equal(migrating("wallet.balance"), 500, "migrated scope must still read correctly");

    // Resume: supply the previously-missing secret and migrate again.
    migrating.vault["_"]("vault-secret-value");
    const secondPass = migrating.migrateEncryptedBranchesToV4();
    assert.ok(secondPass.migratedScopes >= 1, "vault should migrate once its secret is available");
    assert.equal(secondPass.pendingScopes.includes("vault"), false);
    assert.equal(migrating("vault.data"), 999);

    // Idempotent: running again touches nothing new and reports no errors.
    const thirdPass = migrating.migrateEncryptedBranchesToV4();
    assert.equal(thirdPass.migratedScopes, 0);
    assert.equal(thirdPass.errors, 0);
    assert.ok(thirdPass.skippedAlreadyV4 >= 2);

    // Value blobs (root-scope leaf writes).
    const valueSource: any = new ME();
    valueSource["_"]("root-secret-value");
    valueSource.profile.name("Migrated Root Value");

    const migratingValues: any = new ME();
    migratingValues.rehydrate(valueSource.exportSnapshot());
    await migratingValues.createIdentityRoot("password-for-value-migration");

    const valuePass1 = migratingValues.migrateEncryptedValuesToV4();
    assert.ok(valuePass1.pending.includes("profile.name"), "value blob pending without its secret");
    assert.equal(valuePass1.migrated, 0);

    migratingValues["_"]("root-secret-value");
    const valuePass2 = migratingValues.migrateEncryptedValuesToV4();
    assert.ok(valuePass2.migrated >= 1);
    assert.equal(migratingValues("profile.name"), "Migrated Root Value");

    const valuePass3 = migratingValues.migrateEncryptedValuesToV4();
    assert.equal(valuePass3.migrated, 0, "already-migrated value blobs are not touched again");
  });

  // 11. Backup/restore recovers the same root; it does not auto-restore
  // branch secrets.
  await test("11. backup/restore recovers the same root without auto-restoring branch secrets", async () => {
    const me: any = new ME();
    const { rootId } = await me.createIdentityRoot("password-for-backup-identity");
    me.wallet["_"]("steel-door");
    me.wallet.balance(321);

    const backup = me.exportIdentityRootBackup();
    assert.equal(backup.rootId, rootId);
    assert.equal(typeof backup.aead.ciphertext, "string");
    assert.ok(!JSON.stringify(backup).includes("steel-door"), "backup must never contain a branch secret");

    const restored: any = new ME();
    restored.importIdentityRootBackup(backup);
    assert.equal(restored.hasIdentityRoot(), true);
    assert.equal(restored.isIdentityUnlocked(), false, "import alone never unlocks");
    assert.equal(Object.keys(restored.localSecrets).length, 0, "import alone never restores branch secrets");

    await restored.unlockIdentity("password-for-backup-identity");
    assert.equal(restored.currentIdentityRootId(), rootId, "unlocking the restored backup recovers the SAME root");
    assert.equal(Object.keys(restored.localSecrets).length, 0, "unlocking still does not auto-restore branch secrets (Option B)");

    restored.encryptedBranches = clone(me.encryptedBranches);
    restored.wallet["_"]("steel-door");
    assert.equal(restored("wallet.balance"), 321, "the recovered root can still open the original ciphertext once the secret is supplied");
  });

  console.log("\n✅ Identity-Bound Secrets acceptance suite passed");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
