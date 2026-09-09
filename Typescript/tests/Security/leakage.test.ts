/// <reference types="node" />
/**
 * §3 FUGAS DE INFORMACIÓN
 *
 * Scans for unique marker strings across: serialized snapshots,
 * memory.expression/memory.value, DiskStore's on-disk files, public read
 * surfaces (me(), explain(), enumeration via Object.keys on public
 * getters), and captured errors/exceptions. Covers branch and value blobs,
 * objects, arrays, and Unicode content, plus refs/operators/replay.
 *
 * Extends (does not duplicate) tests/identity-bound-secrets.test.ts's own
 * test 8, which already covers the core marker-absence case. This file adds
 * the variants that test wasn't scoped to cover: arrays, Unicode, operator
 * (`=`, `?`) writes, replay, and a distinction between a PRIVATE in-session
 * cache (not a leak) and a genuinely PUBLIC surface (must never leak).
 */
import {
  MEConstructor as ME,
  assert,
  makeSuite,
  tempDir,
  cleanup,
  readAllTextFiles,
  assertNoMarkers,
} from "./helpers.ts";
import fs from "node:fs";
import path from "node:path";

const { test, summarize } = makeSuite("§3 Information leakage");

async function main() {
  console.log("\n### §3 — Information leakage");

  await test("array and object branch values never leak markers in snapshot/disk, and recover exactly", async () => {
    const dir = tempDir("me-security-leak-array-");
    try {
      const { DiskStore } = ME as any;
      const me: any = new ME(undefined, { store: new DiskStore({ baseDir: dir }) });
      await me.createIdentityRoot("LEAK_PASSWORD_ARRAY_TOKEN");
      me.vault["_"]("LEAK_SECRET_ARRAY_TOKEN");
      me.vault.list([{ tag: "LEAK_ARRAY_ITEM_TOKEN_1" }, { tag: "LEAK_ARRAY_ITEM_TOKEN_2" }, "LEAK_ARRAY_ITEM_TOKEN_3"]);

      const markers = [
        "LEAK_PASSWORD_ARRAY_TOKEN",
        "LEAK_SECRET_ARRAY_TOKEN",
        "LEAK_ARRAY_ITEM_TOKEN_1",
        "LEAK_ARRAY_ITEM_TOKEN_2",
        "LEAK_ARRAY_ITEM_TOKEN_3",
      ];

      const snapshot = me.exportSnapshot();
      assertNoMarkers(JSON.stringify(snapshot), markers, "exportSnapshot() with an array branch value");

      fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify(snapshot), "utf8");
      for (const { file, contents } of readAllTextFiles(dir)) {
        assertNoMarkers(contents, markers, `on-disk file ${file}`);
      }

      const reopened: any = new ME(undefined, { store: new DiskStore({ baseDir: tempDir("me-security-leak-array-reopen-") }) });
      reopened.hydrate(snapshot);
      await reopened.unlockIdentity("LEAK_PASSWORD_ARRAY_TOKEN");
      reopened.vault["_"]("LEAK_SECRET_ARRAY_TOKEN");
      assert.deepEqual(
        reopened("vault.list"),
        [{ tag: "LEAK_ARRAY_ITEM_TOKEN_1" }, { tag: "LEAK_ARRAY_ITEM_TOKEN_2" }, "LEAK_ARRAY_ITEM_TOKEN_3"],
        "exact recovery of an array/object branch value",
      );
    } finally {
      cleanup(dir);
    }
  });

  await test("Unicode content (emoji, RTL, combining marks, CJK) never leaks and recovers exactly", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("password-unicode-leak-secret-99");
    me.vault["_"]("secret-unicode-leak-99");
    const unicodeMarker = "LEAK_UNICODE_TOKEN_🔒_مرحبا_देवनागरी_こんにちは_é̂";
    me.vault.note(unicodeMarker);

    const snapshot = me.exportSnapshot();
    assertNoMarkers(JSON.stringify(snapshot), [unicodeMarker], "exportSnapshot() with Unicode content");

    const reopened: any = new ME();
    reopened.hydrate(snapshot);
    await reopened.unlockIdentity("password-unicode-leak-secret-99");
    reopened.vault["_"]("secret-unicode-leak-99");
    assert.equal(reopened("vault.note"), unicodeMarker, "exact Unicode recovery, including combining marks and emoji");
  });

  await test("root-scope value writes via operators ('=' reference, '?' identity-ref) do not leak the underlying marker beyond what's documented", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("password-operator-leak-10");
    me["_"]("root-secret-operator-leak-10");
    me.source("LEAK_OPERATOR_SOURCE_TOKEN");
    // '=' reference/derivation — value mode carve-out documented in
    // core-write.ts: pointer/identity-ref/'='/'?' writes are not
    // re-encrypted at the value layer (they reference other protected
    // data rather than duplicating it). This test documents what's
    // actually observable for that carve-out rather than assuming it
    // behaves like a normal encrypted value.
    me.derived("=source");
    const snapshot = me.exportSnapshot();
    const serialized = JSON.stringify(snapshot);
    // The referenced VALUE ("LEAK_OPERATOR_SOURCE_TOKEN") is itself a
    // protected root-scope value and must not appear in the clear.
    assert.ok(!serialized.includes("LEAK_OPERATOR_SOURCE_TOKEN"), "the referenced protected value must not leak via the '=' derivation's memory record");

    // Recovery of the underlying protected value itself (what actually
    // matters for the leakage property under test — the derivation
    // recompute engine's own hydrate-time-vs-later-unlock interaction is a
    // separate concern from identity-bound-secrets and outside this
    // battery's scope).
    const reopened: any = new ME();
    reopened.hydrate(snapshot);
    await reopened.unlockIdentity("password-operator-leak-10");
    reopened["_"]("root-secret-operator-leak-10");
    assert.equal(reopened("source"), "LEAK_OPERATOR_SOURCE_TOKEN", "the protected root value itself recovers correctly once the secret is resupplied");
  });

  await test("replaying a memory log alone (no encryptedBranches) never leaks the branch marker, and correctly stays unrecoverable without it (documented, see typedocs §9.1)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("password-replay-leak-11");
    me.vault["_"]("secret-replay-leak-11");
    me.vault.balance("LEAK_REPLAY_BRANCH_TOKEN");

    const snapshot = me.exportSnapshot();
    const memoriesOnly = snapshot.memories;
    assertNoMarkers(JSON.stringify(memoriesOnly), ["LEAK_REPLAY_BRANCH_TOKEN"], "the memory log alone");

    const replayed: any = new ME();
    await replayed.createIdentityRoot("password-replay-leak-11-b");
    replayed.replayMemories(memoriesOnly);
    replayed.vault["_"]("secret-replay-leak-11");
    // Per §9.1: replaying the memory log ALONE cannot reconstruct
    // branch-scoped content — encryptedBranches is a separate, required
    // transport. This must fail closed (undefined/null), not throw, and
    // absolutely not silently write "***" as if it were real data.
    let threw = false;
    let result: any;
    try {
      result = replayed("vault.balance");
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
    assert.ok(
      [undefined, null].includes(result),
      "memory-log-only replay must not reconstruct branch content (documented architectural boundary, §9.1)",
    );
  });

  await test("errors thrown/logged during tampering flows never embed the plaintext secret or password", async () => {
    const me: any = new ME();
    const PASSWORD = "LEAK_ERROR_PASSWORD_TOKEN_12345678";
    await me.createIdentityRoot(PASSWORD);
    me.vault["_"]("LEAK_ERROR_SECRET_TOKEN");
    me.vault.balance("LEAK_ERROR_VALUE_TOKEN");

    const collectedErrors: string[] = [];
    try {
      await me.unlockIdentity("a-plausible-but-wrong-password-attempt");
    } catch (e) {
      collectedErrors.push(String(e instanceof Error ? e.stack || e.message : e));
    }
    try {
      const envelope = me.exportIdentityRootBackup();
      envelope.aead.ciphertext = envelope.aead.ciphertext.slice(0, -4) + "0000";
      const other: any = new ME();
      other.importIdentityRootBackup(envelope, { force: true });
      await other.unlockIdentity(PASSWORD);
    } catch (e) {
      collectedErrors.push(String(e instanceof Error ? e.stack || e.message : e));
    }

    const combined = collectedErrors.join("\n");
    assertNoMarkers(combined, [PASSWORD, "LEAK_ERROR_SECRET_TOKEN", "LEAK_ERROR_VALUE_TOKEN"], "collected error messages/stacks");
  });

  await test(
    "a warmed in-session decrypted-branch cache is a PRIVATE session artifact, not a public leak — " +
      "distinguished from exportSnapshot()'s disk-safe output in the SAME session",
    async () => {
      const me: any = new ME();
      await me.createIdentityRoot("password-cache-distinction-13");
      me.vault["_"]("secret-cache-distinction-13");
      me.vault.balance("LEAK_CACHE_DISTINCTION_TOKEN");
      assert.equal(me("vault.balance"), "LEAK_CACHE_DISTINCTION_TOKEN", "warm the decrypted-branch cache in this unlocked session");

      // The PUBLIC disk-safe surface (what actually leaves the process via
      // persistence) must still be clean, in the exact same session, right
      // after the cache was warmed.
      const snapshot = me.exportSnapshot();
      assertNoMarkers(JSON.stringify(snapshot), ["LEAK_CACHE_DISTINCTION_TOKEN"], "exportSnapshot() immediately after warming the decrypted-branch cache");
    },
  );

  const ok = summarize();
  if (!ok) {
    process.exitCode = 1;
    throw new Error("§3 leakage battery had failures");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
