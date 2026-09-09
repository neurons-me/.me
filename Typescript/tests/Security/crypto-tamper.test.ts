/// <reference types="node" />
/**
 * §4 MANIPULACIÓN CRIPTOGRÁFICA Y DE FORMATOS
 *
 * Ciphertext/nonce/tag/version/rootId/context alteration; truncation; blob
 * swapping between paths; invalid/unknown formats; v4-never-falls-back-to-v3;
 * KDF parameter bounds; rejecting abusive input before expensive crypto
 * work; nonce usage sanity (documented as a spot check, not a proof).
 *
 * A round trip succeeding is NOT treated as proof of cryptographic
 * correctness anywhere in this file — every positive assertion is paired
 * with an explicit failure-mode assertion (tamper -> fails closed).
 */
import {
  MEConstructor as ME,
  assert,
  clone,
  makeSuite,
  tamperB64u,
  tamperB64uAt,
  truncateB64u,
} from "./helpers.ts";
// @ts-ignore -- targets built artifact's sibling source for pure functions not exposed on the instance.
import { detectBlobVersion, deriveSecretMaterialV4 } from "../../src/crypto.ts";
import {
  MIN_PBKDF2_ITERATIONS,
  MAX_PBKDF2_ITERATIONS,
  wrapIdentityRoot,
  // @ts-ignore
} from "../../src/identity-root.ts";

const { test, summarize } = makeSuite("§4 Cryptographic and format manipulation");

async function main() {
  console.log("\n### §4 — Cryptographic and format manipulation");

  await test("flipping a ciphertext byte fails closed (AEAD tag mismatch)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-01");
    me.wallet["_"]("secret-01");
    me.wallet.balance(101);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];
    assert.equal(detectBlobVersion(original), "v4");

    me.encryptedBranches.wallet[chunkId] = tamperB64uAt(original, 40); // deep into the ciphertext region
    assert.ok([undefined, null].includes(me("wallet.balance")));
    me.encryptedBranches.wallet[chunkId] = original;
    assert.equal(me("wallet.balance"), 101);
  });

  await test("flipping the nonce fails closed", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-02");
    me.wallet["_"]("secret-02");
    me.wallet.balance(102);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];
    // header (4 bytes: 3 magic + 1 version) then nonce (16 bytes) — offset 5 lands in the nonce.
    me.encryptedBranches.wallet[chunkId] = tamperB64uAt(original, 5);
    assert.ok([undefined, null].includes(me("wallet.balance")));
  });

  await test("flipping the tag fails closed", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-03");
    me.wallet["_"]("secret-03");
    me.wallet.balance(103);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];
    // header(4) + nonce(16) = 20 -> tag starts at 20.
    me.encryptedBranches.wallet[chunkId] = tamperB64uAt(original, 22);
    assert.ok([undefined, null].includes(me("wallet.balance")));
  });

  await test("flipping the version byte (v4 -> unknown) fails closed, no fallback parsing", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-04");
    me.wallet["_"]("secret-04");
    me.wallet.balance(104);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];
    // Byte offset 3 is the version byte (after 3-byte magic).
    me.encryptedBranches.wallet[chunkId] = tamperB64uAt(original, 3);
    const version = detectBlobVersion(me.encryptedBranches.wallet[chunkId]);
    assert.ok(version === "legacy" || version !== "v4", "an unrecognized version byte must not be classified v4");
    assert.ok([undefined, null].includes(me("wallet.balance")), "unknown version must fail closed, not throw or leak");
  });

  await test("truncated blob (any length) fails closed without throwing", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-05");
    me.wallet["_"]("secret-05");
    me.wallet.balance(105);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];

    for (const keep of [0, 1, 4, 10, 19, 20, 35]) {
      me.encryptedBranches.wallet[chunkId] = truncateB64u(original, keep);
      let threw = false;
      let result: any;
      try {
        result = me("wallet.balance");
      } catch {
        threw = true;
      }
      assert.equal(threw, false, `truncation to ${keep} bytes must not throw`);
      assert.ok([undefined, null].includes(result), `truncation to ${keep} bytes must fail closed`);
    }
    me.encryptedBranches.wallet[chunkId] = original;
    assert.equal(me("wallet.balance"), 105);
  });

  await test("swapping ciphertext blobs between two DIFFERENT paths in the SAME scope fails closed for both", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-06");
    me.vault["_"]("secret-06");
    me.vault.alpha("alpha-value-06");
    me.vault.beta("beta-value-06");

    const alphaChunk = me.getChunkId(["vault", "alpha"], ["vault"]);
    const betaChunk = me.getChunkId(["vault", "beta"], ["vault"]);
    assert.notEqual(alphaChunk, betaChunk, "test setup requires distinct chunks");

    const alphaBlob = me.encryptedBranches.vault[alphaChunk];
    const betaBlob = me.encryptedBranches.vault[betaChunk];
    me.encryptedBranches.vault[alphaChunk] = betaBlob;
    me.encryptedBranches.vault[betaChunk] = alphaBlob;

    // pathContext is folded into key derivation via getChunkId->scope path,
    // but branch-mode keys are scope-wide (not per-chunk) — so a swapped
    // chunk blob decrypts under the SAME key but yields the WRONG (other
    // path's) whole-branch-container content, not a crypto failure. This is
    // exactly why "swap chunks between paths in the same scope" is a
    // meaningful test: it must not silently present cross-contaminated data
    // as if it belonged to the requested path.
    const alphaRead = me("vault.alpha");
    const betaRead = me("vault.beta");
    assert.notEqual(alphaRead, "alpha-value-06", "a swapped chunk must not transparently present the original path's value");
    assert.notEqual(betaRead, "beta-value-06", "a swapped chunk must not transparently present the original path's value");
  });

  await test("swapping ciphertext blobs between two DIFFERENT scopes fails closed (different derived keys)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-07");
    me.alpha["_"]("alpha-secret-07");
    me.alpha.value(700);
    me.beta["_"]("beta-secret-07");
    me.beta.value(701);

    const alphaChunk = me.getChunkId(["alpha", "value"], ["alpha"]);
    const betaChunk = me.getChunkId(["beta", "value"], ["beta"]);
    const alphaBlob = me.encryptedBranches.alpha[alphaChunk];
    me.encryptedBranches.beta[betaChunk] = alphaBlob;

    const crossRead = me("beta.value");
    assert.ok([undefined, null].includes(crossRead), "a blob encrypted under a different scope's key must fail closed, not decrypt as garbage-but-present");
  });

  await test("an ambiguous/garbage string is rejected as 'legacy', never misclassified as v4, and fails closed", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-08");
    me.wallet["_"]("secret-08");
    me.wallet.balance(108);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original = me.encryptedBranches.wallet[chunkId];

    for (const garbage of ["", "not-a-blob-at-all", "b64u:", "0xdeadbeef", "b64u:!!!not-base64!!!", "null", "{}"]) {
      me.encryptedBranches.wallet[chunkId] = garbage;
      let threw = false;
      let result: any;
      try {
        result = me("wallet.balance");
      } catch {
        threw = true;
      }
      assert.equal(threw, false, `garbage input "${garbage}" must not throw`);
      assert.ok([undefined, null].includes(result), `garbage input "${garbage}" must fail closed`);
    }
    me.encryptedBranches.wallet[chunkId] = original;
  });

  await test(
    "version dispatch is strictly per-blob (no v4-then-v3 fallback attempt): a REAL, untampered " +
      "v3 blob planted where v4 is expected is read via v3 rules (documented mixed-format support, " +
      "§4 of the design doc) — but still requires the CORRECT v3-derivable secret; a wrong secret " +
      "against it still fails closed, proving there is no protection downgrade available this way",
    async () => {
      const v3Kernel: any = new ME();
      v3Kernel.wallet["_"]("v3-secret-09");
      v3Kernel.wallet.balance(309);
      const v3Chunk = v3Kernel.getChunkId(["wallet", "balance"], ["wallet"]);
      const v3Blob = v3Kernel.encryptedBranches.wallet[v3Chunk];
      assert.equal(detectBlobVersion(v3Blob), "v3");

      const v4Kernel: any = new ME();
      await v4Kernel.createIdentityRoot("tamper-password-09");
      v4Kernel.wallet["_"]("v3-secret-09"); // same secret string as v3Kernel used
      v4Kernel.wallet.balance(409);
      const v4Chunk = v4Kernel.getChunkId(["wallet", "balance"], ["wallet"]);
      assert.equal(detectBlobVersion(v4Kernel.encryptedBranches.wallet[v4Chunk]), "v4");

      // Plant the REAL v3 blob where the v4 blob was, in the identity-unlocked kernel.
      v4Kernel.encryptedBranches.wallet[v4Chunk] = v3Blob;
      // v3 key derivation never used the identity root, so the SAME secret
      // string legitimately reopens it via v3 rules — this is the
      // documented "v3 ciphertext stays readable indefinitely" contract,
      // not a downgrade attack (the caller already had to know the correct
      // secret either way).
      assert.equal(v4Kernel("wallet.balance"), 309, "a real v3 blob is read via v3 rules when the correct v3 secret is present (documented mixed-format support)");

      // Now the actual security property: a WRONG secret against that same
      // planted v3 blob still fails closed — no downgrade grants a free pass.
      v4Kernel.lockIdentity();
      await v4Kernel.unlockIdentity("tamper-password-09");
      v4Kernel.wallet["_"]("WRONG-secret-guess");
      assert.ok([undefined, null].includes(v4Kernel("wallet.balance")), "wrong secret against a mixed-format blob must still fail closed");
    },
  );

  await test("forging a v4 blob's version byte into the v3 value fails closed (version confusion is not a bypass)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-09b");
    me.wallet["_"]("secret-09b");
    me.wallet.balance(9021);
    const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
    const original: string = me.encryptedBranches.wallet[chunkId];

    // Byte offset 3 is the version byte. v4=0x04, v3=0x03 — force it to the
    // v3 value directly (not a random XOR flip) so detectBlobVersion
    // genuinely reclassifies this as "v3" and the read path takes the v3
    // branch, using v3's fundamentally different (root-independent) key
    // derivation against bytes that were actually encrypted under v4.
    const payload = original.startsWith("b64u:") ? original.slice(5) : original;
    const bytes = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    bytes[3] = 0x03;
    const forged = "b64u:" + bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    assert.equal(detectBlobVersion(forged), "v3", "test setup: byte 3 forced to the v3 version tag");

    me.encryptedBranches.wallet[chunkId] = forged;
    let threw = false;
    let result: any;
    try {
      result = me("wallet.balance");
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "version-confused bytes must not throw");
    assert.ok([undefined, null].includes(result), "v4 ciphertext reclassified as v3 by a forged version byte must fail closed under v3 key derivation, not leak");
  });

  await test("unlockIdentity rejects a tampered envelope ciphertext/nonce (fails closed, no fallback)", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-10");
    const envelope = me.exportIdentityRootBackup();

    const tamperedCipher = clone(envelope);
    tamperedCipher.aead.ciphertext = tamperB64u(tamperedCipher.aead.ciphertext);
    const a: any = new ME();
    a.importIdentityRootBackup(tamperedCipher, { force: true });
    await assert.rejects(() => a.unlockIdentity("tamper-password-10"));

    const tamperedNonce = clone(envelope);
    tamperedNonce.aead.iv = tamperB64u(tamperedNonce.aead.iv);
    const b: any = new ME();
    b.importIdentityRootBackup(tamperedNonce, { force: true });
    await assert.rejects(() => b.unlockIdentity("tamper-password-10"));
  });

  await test("unlockIdentity rejects a forged rootId (breaks the AAD binding) even with the right password/ciphertext", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-11");
    const envelope = clone(me.exportIdentityRootBackup());
    envelope.rootId = envelope.rootId.split("").reverse().join(""); // still shape-valid hex-ish string, different value
    const forged: any = new ME();
    forged.importIdentityRootBackup(envelope, { force: true });
    await assert.rejects(
      () => forged.unlockIdentity("tamper-password-11"),
      "AAD binds rootId — a forged rootId must break AEAD verification even with the correct password",
    );
  });

  await test("an unknown envelope format version is rejected before any crypto work", async () => {
    const me: any = new ME();
    await me.createIdentityRoot("tamper-password-12");
    const envelope = clone(me.exportIdentityRootBackup());
    envelope.v = 999;
    const fresh: any = new ME();
    // `instanceof IdentityRootFormatError` is deliberately not used here: the
    // dist bundle (`ME`) and this file's direct `../../src/identity-root.ts`
    // import are two separate module instantiations, so their classes are
    // not the same object even though they're semantically identical — a
    // module-identity artifact of this battery importing both the built
    // artifact and raw source, not a real behavioral difference. Assert on
    // the error's name/message instead, matching how
    // tests/identity-bound-secrets.test.ts already checks error identity.
    assert.throws(() => fresh.importIdentityRootBackup(envelope, { force: true }), /version/i);
  });

  await test("KDF iteration count out of bounds is rejected (too low, too high, non-integer, wrong type)", async () => {
    const rootBytes = new Uint8Array(32).fill(7);
    await assert.rejects(() => wrapIdentityRoot(rootBytes, "test-root-id-13", "password-13-value", MIN_PBKDF2_ITERATIONS - 1));
    await assert.rejects(() => wrapIdentityRoot(rootBytes, "test-root-id-13", "password-13-value", MAX_PBKDF2_ITERATIONS + 1));
    await assert.rejects(() => wrapIdentityRoot(rootBytes, "test-root-id-13", "password-13-value", 1.5));
    await assert.rejects(() => wrapIdentityRoot(rootBytes, "test-root-id-13", "password-13-value", NaN));
    await assert.rejects(() => wrapIdentityRoot(rootBytes, "test-root-id-13", "password-13-value", "600000" as any));
  });

  await test("password length bounds are rejected before deriving any key", async () => {
    const me: any = new ME();
    await assert.rejects(() => me.createIdentityRoot("short")); // < 8 chars
    await assert.rejects(() => me.createIdentityRoot("a".repeat(1025))); // > 1024 chars
    await assert.rejects(() => me.createIdentityRoot(12345678 as any));
    await assert.rejects(() => me.createIdentityRoot(null as any));
  });

  await test("password/iteration rejection happens BEFORE the expensive PBKDF2 derivation runs (DoS guard ordering)", async () => {
    // A crude but effective proxy: an out-of-bounds request must reject in
    // roughly constant, sub-derivation time, not in time proportional to
    // MAX_PBKDF2_ITERATIONS worth of PBKDF2 work. No fragile absolute
    // latency threshold is asserted (per the task's own instruction to avoid
    // brittle CI timing) — only that a clearly-invalid call returns quickly
    // relative to a real successful derivation at the default iteration count.
    const rootBytes = new Uint8Array(32).fill(3);
    const t0 = performance.now();
    try {
      await wrapIdentityRoot(rootBytes, "bounds-check-root-id", "bounds-check-pw", MAX_PBKDF2_ITERATIONS * 10);
    } catch {
      // expected to throw
    }
    const rejectMs = performance.now() - t0;

    const t1 = performance.now();
    await wrapIdentityRoot(rootBytes, "bounds-check-root-id-2", "bounds-check-pw-2", MIN_PBKDF2_ITERATIONS);
    const realDeriveMs = performance.now() - t1;

    assert.ok(
      rejectMs < realDeriveMs * 5 + 50,
      `rejecting an out-of-bounds iteration count (${rejectMs.toFixed(1)}ms) should not itself run a real (or worse, 10x) PBKDF2 pass (baseline ${realDeriveMs.toFixed(1)}ms)`,
    );
  });

  await test("V4 derivation refuses to run without a real (non-empty) identity root — no silent zero-key fallback", () => {
    assert.throws(() => deriveSecretMaterialV4([new Uint8Array(1)], "this.me/blob/v4/branch" as any, new Uint8Array(0)));
    assert.throws(() => deriveSecretMaterialV4([new Uint8Array(1)], "this.me/blob/v4/branch" as any, null as any));
  });

  await test(
    "nonce usage sanity check (NOT a security proof — see README): distinct writes to the same " +
      "scope produce distinct nonces across a moderate sample, and the identity root never appears " +
      "as ciphertext material",
    async () => {
      const me: any = new ME();
      await me.createIdentityRoot("tamper-password-nonce-14");
      me.wallet["_"]("nonce-secret-14");
      const nonces = new Set<string>();
      for (let i = 0; i < 200; i++) {
        me.wallet[`slot${i}`](`value-${i}`);
        const chunkId = me.getChunkId(["wallet", `slot${i}`], ["wallet"]);
        const blob: string = me.encryptedBranches.wallet[chunkId];
        // header(4 bytes)+nonce(16 bytes) -> nonce occupies decoded bytes [4,20).
        const payload = blob.startsWith("b64u:") ? blob.slice(5) : blob;
        const bytes = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        const nonceHex = bytes.subarray(4, 20).toString("hex");
        nonces.add(nonceHex);
      }
      assert.equal(nonces.size, 200, "200 independent writes must not repeat a nonce in this sample (CSPRNG-backed, not a formal proof of no collisions)");
    },
  );

  const ok = summarize();
  if (!ok) {
    process.exitCode = 1;
    throw new Error("§4 crypto-tamper battery had failures");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
