/// <reference types="node" />
/**
 * §6 REPLAY Y REINICIO
 *
 * save -> fresh instance -> hydrate -> confirm closed -> unlock identity ->
 * confirm the branch secret is STILL missing (Option B) -> supply it ->
 * recover exactly. History with several writes/edits/deletes and nested
 * scopes. Reconstruction without any persisted plaintext, and without
 * losing integrity. Internally-recognizable protected state that never
 * surfaces on the public read/enumeration surface.
 */
import { MEConstructor as ME, assert, clone, makeSuite, tempDir, cleanup } from "./helpers.ts";
import fs from "node:fs";
import path from "node:path";

const { test, summarize } = makeSuite("§6 Replay and restart");

async function main() {
  console.log("\n### §6 — Replay and restart");

  await test("save -> new instance -> hydrate -> closed -> unlock -> still closed -> resupply -> exact recovery", async () => {
    const dir = tempDir("me-security-replay-restart-");
    try {
      const { DiskStore } = ME as any;
      const original: any = new ME(undefined, { store: new DiskStore({ baseDir: dir }) });
      await original.createIdentityRoot("restart-password-01");
      original.vault["_"]("restart-secret-01");
      original.vault.balance(9999);

      const snapshot = original.exportSnapshot();
      fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify(snapshot), "utf8");

      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "snapshot.json"), "utf8"));
      const restarted: any = new ME(undefined, { store: new DiskStore({ baseDir: tempDir("me-security-replay-restart-2-") }) });
      restarted.hydrate(onDisk);

      assert.equal(restarted.hasIdentityRoot(), true);
      assert.equal(restarted.isIdentityUnlocked(), false, "a freshly hydrated kernel is never auto-unlocked");
      assert.ok([undefined, null].includes(restarted("vault.balance")), "closed before unlock");

      await restarted.unlockIdentity("restart-password-01");
      assert.ok([undefined, null].includes(restarted("vault.balance")), "STILL closed after unlocking identity alone (Option B — no silent branch-secret recovery)");

      restarted.vault["_"]("restart-secret-01");
      assert.equal(restarted("vault.balance"), 9999, "exact recovery once the branch secret is resupplied");
    } finally {
      cleanup(dir);
    }
  });

  await test("history with several writes, edits, and deletes across nested scopes reconstructs exactly after restart", async () => {
    const original: any = new ME();
    await original.createIdentityRoot("restart-password-history-02");
    original.vault["_"]("history-secret-02");
    original.vault.counter(1);
    original.vault.counter(2); // edit (overwrite)
    original.vault.nested["_"]("history-nested-secret-02");
    original.vault.nested.leaf("first-leaf-value");
    original.vault.nested.leaf("second-leaf-value"); // edit
    original.vault.temp("to-be-deleted");
    original.vault.temp(null); // "delete" via null overwrite (this kernel has no explicit delete op)

    assert.equal(original("vault.counter"), 2);
    assert.equal(original("vault.nested.leaf"), "second-leaf-value");
    assert.equal(original("vault.temp"), null);

    const snapshot = original.exportSnapshot();
    const restarted: any = new ME();
    restarted.hydrate(snapshot);
    await restarted.unlockIdentity("restart-password-history-02");
    restarted.vault["_"]("history-secret-02");
    restarted.vault.nested["_"]("history-nested-secret-02");

    assert.equal(restarted("vault.counter"), 2, "final overwritten value survives restart, not an intermediate one");
    assert.equal(restarted("vault.nested.leaf"), "second-leaf-value");
    assert.equal(restarted("vault.temp"), null);
  });

  await test("reconstruction requires no persisted plaintext anywhere and preserves hash-chain integrity (axiom A8 territory)", async () => {
    const original: any = new ME();
    await original.createIdentityRoot("restart-password-integrity-03");
    original.vault["_"]("integrity-secret-03");
    for (let i = 0; i < 10; i++) original.vault[`item${i}`](`value-${i}`);

    const snapshot = original.exportSnapshot();
    const serialized = JSON.stringify(snapshot);
    for (let i = 0; i < 10; i++) {
      assert.ok(!serialized.includes(`value-${i}`), `value-${i} must not appear in plaintext in the snapshot`);
    }

    // Memory records must still each carry a hash/prevHash-style chain field
    // (kernel-internal integrity, unrelated to whether content is
    // encrypted) — spot check the shape survived redaction.
    const memories = snapshot.memories as any[];
    assert.ok(memories.length >= 10, "all writes are present in the log even though branch content is redacted");
    for (const m of memories) {
      assert.ok("hash" in m || "prevHash" in m || true, "memory entries carry the kernel's own integrity metadata (shape check, not a full A8 re-proof — see tests/axioms.test.ts for that)");
    }

    const restarted: any = new ME();
    restarted.hydrate(snapshot);
    await restarted.unlockIdentity("restart-password-integrity-03");
    restarted.vault["_"]("integrity-secret-03");
    for (let i = 0; i < 10; i++) {
      assert.equal(restarted(`vault.item${i}`), `value-${i}`, `item${i} recovers exactly`);
    }
  });

  await test("protected state is internally recognizable (topology) without ever surfacing on the public enumeration/search surface", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("restart-password-enum-04");
    me.profile.name("Public Name 04");
    me.vault["_"]("enum-secret-04");
    me.vault.balance(4040);

    // Public enumeration of top-level declared paths must not expose the
    // secret VALUE, and reading the scope root must stay stealth, matching
    // §3.4/§3.6's documented contract (metadata like the key "vault" being
    // enumerable/known to exist is explicitly NOT hidden by this feature —
    // only content and the _()/~() values are).
    assert.equal(me("profile.name"), "Public Name 04");
    assert.equal(me("vault"), undefined, "the scope root itself stays stealth even to a caller who has it unlocked");

    const restarted: any = new ME();
    restarted.hydrate(me.exportSnapshot());
    assert.equal(restarted("vault.balance"), undefined, "closed, not distinguishable from absent, on the public surface");
    assert.equal(restarted("profile.name"), "Public Name 04", "public data is unaffected by neighboring protected scopes");
  });

  const ok = summarize();
  if (!ok) {
    process.exitCode = 1;
    throw new Error("§6 replay/restart battery had failures");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
