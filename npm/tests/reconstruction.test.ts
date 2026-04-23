/// <reference types="node" />
import { randomBytes } from "node:crypto";
import ME from "this.me";

let passed = 0;
let failed = 0;
const results: string[] = [];

function test(label: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      results.push(`  ✅ ${label}`);
    })
    .catch((error: any) => {
      failed++;
      results.push(`  ❌ ${label}`);
      results.push(`     → ${error?.message ?? String(error)}`);
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual(a: unknown, b: unknown, message: string): void {
  if (a !== b) {
    throw new Error(
      `${message}\n     got:      ${JSON.stringify(a)}\n     expected: ${JSON.stringify(b)}`,
    );
  }
}

function assertNotEqual(a: unknown, b: unknown, message: string): void {
  if (a === b) {
    throw new Error(`${message} — values were equal: ${JSON.stringify(a)}`);
  }
}

function getIdentity(me: any): { hash: string; expression: string | null } {
  const identity = me[Symbol.for("me.identity")];
  if (!identity) throw new Error("me.identity not found on kernel");
  return identity;
}

function getSeed(me: any): string {
  const seed = me[Symbol.for("me.seed")];
  if (seed === undefined) throw new Error("me.seed not found on kernel");
  return seed;
}

async function main(): Promise<void> {
  console.log("\n════════════════════════════════════════════");
  console.log(" SECTION 1 — Basic Determinism");
  console.log(" Same seed → same identity. Always.");
  console.log("════════════════════════════════════════════");

  await test("simple string seed produces stable identity", () => {
    const me1 = new (ME as any)("luna");
    const me2 = new (ME as any)("luna");
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "same seed 'luna' must produce same identity hash",
    );
  });

  await test("12-word phrase seed produces stable identity", () => {
    const seed = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "same 12-word seed must produce same identity hash",
    );
  });

  await test("hex string seed produces stable identity", () => {
    const seed = "a3f8c2d1e4b7f2a91c3e5d8f2a4b6c8e";
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "same hex seed must produce same identity hash",
    );
  });

  await test("sentence as seed produces stable identity", () => {
    const seed = "my dog is called luna and she is 7 years old";
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "same sentence seed must produce same identity hash",
    );
  });

  await test("unicode seed produces stable identity", () => {
    const seed = "שם קודם למקום — identity before place";
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "unicode seed must produce same identity hash",
    );
  });

  await test("single character seed produces stable identity", () => {
    const me1 = new (ME as any)("x");
    const me2 = new (ME as any)("x");
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "single char seed must produce same identity hash",
    );
  });

  await test("very long seed produces stable identity", () => {
    const seed = "a".repeat(10_000);
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "long seed must produce same identity hash",
    );
  });

  await test("256-bit random seed produces stable identity", () => {
    const seed = randomBytes(32).toString("hex");
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "256-bit random seed must produce stable identity hash",
    );
  });

  console.log("\n════════════════════════════════════════════");
  console.log(" SECTION 2 — Isolation");
  console.log(" Different seeds → different identities.");
  console.log("════════════════════════════════════════════");

  await test("'luna' and 'luna2' produce different identities", () => {
    const me1 = new (ME as any)("luna");
    const me2 = new (ME as any)("luna2");
    assertNotEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "'luna' and 'luna2' must not collide",
    );
  });

  await test("'jose' and 'JOSE' produce different identities", () => {
    const me1 = new (ME as any)("jose");
    const me2 = new (ME as any)("JOSE");
    assertNotEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "seeds are case-sensitive — 'jose' ≠ 'JOSE'",
    );
  });

  await test("'abc' and 'abc ' (trailing space) produce different identities", () => {
    const me1 = new (ME as any)("abc");
    const me2 = new (ME as any)("abc ");
    assertNotEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "trailing space must produce different identity",
    );
  });

  await test("ten different seeds all produce distinct identities", () => {
    const seeds = [
      "alpha", "beta", "gamma", "delta", "epsilon",
      "zeta", "eta", "theta", "iota", "kappa",
    ];
    const hashes = seeds.map((seed) => getIdentity(new (ME as any)(seed)).hash);
    const unique = new Set(hashes);
    assertEqual(
      unique.size,
      seeds.length,
      `all ${seeds.length} seeds must produce distinct identity hashes`,
    );
  });

  await test("anagram seeds produce different identities", () => {
    const me1 = new (ME as any)("listen");
    const me2 = new (ME as any)("silent");
    assertNotEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "anagram seeds must not collide — order matters",
    );
  });

  console.log("\n════════════════════════════════════════════");
  console.log(" SECTION 3 — Reconstruction");
  console.log(" Wipe. Reconstruct. Prove identical.");
  console.log("════════════════════════════════════════════");

  await test("reconstruction from seed produces identical identity hash", () => {
    const seed = "this is my sovereign identity phrase";

    let me1: any = new (ME as any)(seed);
    me1.profile.name("José Abella");
    me1.profile.city("Veracruz");
    const hash1 = getIdentity(me1).hash;

    me1 = null;

    const me2: any = new (ME as any)(seed);
    const hash2 = getIdentity(me2).hash;
    assertEqual(hash1, hash2, "reconstructed identity must match original");
  });

  await test("reconstruction produces same namespace key material", () => {
    const seed = "reconstruct me from this phrase";
    const me1 = new (ME as any)(seed);
    const me2 = new (ME as any)(seed);
    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "namespace key derivation must be identical across instances",
    );
  });

  await test("reconstruction works after writing secret scope data", () => {
    const seed = "secret scope reconstruction test";

    const me1: any = new (ME as any)(seed);
    me1.wallet["_"]("vault-secret");
    me1.wallet.balance(1000);
    const hash1 = getIdentity(me1).hash;

    const me2: any = new (ME as any)(seed);
    const hash2 = getIdentity(me2).hash;
    assertEqual(
      hash1,
      hash2,
      "secret scope writes must not affect identity hash reconstruction",
    );
  });

  await test("three independent reconstructions all produce same hash", () => {
    const seed = "triple reconstruction proof";
    const hash1 = getIdentity(new (ME as any)(seed)).hash;
    const hash2 = getIdentity(new (ME as any)(seed)).hash;
    const hash3 = getIdentity(new (ME as any)(seed)).hash;

    assertEqual(hash1, hash2, "first and second reconstruction must match");
    assertEqual(hash2, hash3, "second and third reconstruction must match");
  });

  console.log("\n════════════════════════════════════════════");
  console.log(" SECTION 4 — Seed Privacy");
  console.log(" Seed never appears in memory, snapshot, or paths.");
  console.log("════════════════════════════════════════════");

  await test("seed does not appear in memory log", () => {
    const seed = "private-seed-must-not-leak";
    const me: any = new (ME as any)(seed);
    me.profile.name("test");

    const memories = me["!"]?.inspect?.()?.memories ?? [];
    const memoryString = JSON.stringify(memories);
    assert(
      !memoryString.includes(seed),
      `seed must not appear in memory log — found: ${seed}`,
    );
  });

  await test("seed does not appear in snapshot export", () => {
    const seed = "snapshot-must-not-contain-seed";
    const me: any = new (ME as any)(seed);
    me.profile.name("test");

    const snapshot = me["!"]?.snapshot?.export?.();
    const snapshotString = JSON.stringify(snapshot ?? {});
    assert(
      !snapshotString.includes(seed),
      "seed must not appear in snapshot export",
    );
  });

  await test("seed not readable through proxy path", () => {
    const seed = "proxy-must-not-expose-seed";
    const me: any = new (ME as any)(seed);
    const pathRead = me("seed");
    assertNotEqual(
      pathRead,
      seed,
      "me('seed') path read must not return the kernel seed",
    );
  });

  await test("seed not enumerable on proxy surface", () => {
    const seed = "enumeration-must-not-expose-seed";
    const me: any = new (ME as any)(seed);
    const keys = Object.keys(me);
    assert(
      !keys.includes("seed"),
      "'seed' must not appear in Object.keys(me)",
    );
  });

  console.log("\n════════════════════════════════════════════");
  console.log(" SECTION 5 — Symbol Access");
  console.log(" Kernel internals accessible only via Symbols.");
  console.log("════════════════════════════════════════════");

  await test("me[Symbol.for('me.seed')] returns the seed", () => {
    const seed = "symbol-access-test";
    const me: any = new (ME as any)(seed);
    assertEqual(
      getSeed(me),
      seed,
      "Symbol access must return the exact seed passed in",
    );
  });

  await test("me[Symbol.for('me.identity')] returns hash and expression", () => {
    const seed = "identity-symbol-test";
    const me: any = new (ME as any)(seed);
    const identity = getIdentity(me);

    assert(typeof identity.hash === "string", "identity.hash must be a string");
    assert(identity.hash.length > 0, "identity.hash must not be empty");
    assert(
      identity.expression === null || identity.expression === undefined,
      `identity.expression must start empty — got: ${identity.expression}`,
    );
  });

  await test("identity hash is a valid hex string", () => {
    const me: any = new (ME as any)("hex-validation-test");
    const { hash } = getIdentity(me);
    assert(
      /^[0-9a-f]+$/i.test(hash),
      `identity hash must be hex — got: ${hash}`,
    );
  });

  await test("identity hash has fixed 64-hex length", () => {
    const short = getIdentity(new (ME as any)("x")).hash;
    const long = getIdentity(new (ME as any)("a".repeat(10_000))).hash;
    assertEqual(short.length, 64, "short-seed identity hash must be 64 hex chars");
    assertEqual(long.length, 64, "long-seed identity hash must be 64 hex chars");
  });

  await test("me[Symbol.for('me.expression')] returns null before @ is called", () => {
    const me: any = new (ME as any)("expression-test");
    const expression = me[Symbol.for("me.expression")];
    assert(
      expression === null || expression === undefined,
      `expression must be null before @() — got: ${expression}`,
    );
  });

  await test("root @ sets active expression and escape plane mirrors it", () => {
    const me: any = new (ME as any)("root-expression-test");
    me["@"]("jabellae");

    assertEqual(
      me[Symbol.for("me.expression")],
      "jabellae",
      "root @ must update the active expression slot",
    );
    assertEqual(
      getIdentity(me).expression,
      "jabellae",
      "identity symbol must expose the active expression",
    );
    assertEqual(
      me["!"].currentExpression(),
      "jabellae",
      "escape plane currentExpression() must mirror the symbol expression",
    );
    assertEqual(
      JSON.stringify(me["!"].identity()),
      JSON.stringify(getIdentity(me)),
      "escape plane identity() must mirror the symbol identity payload",
    );
  });

  await test("scoped @ keeps claim behavior without replacing the kernel active expression", () => {
    const me: any = new (ME as any)("scoped-expression-test");
    me["@"]("jabellae");
    me.profile["@"]("worker");

    assertEqual(
      me[Symbol.for("me.expression")],
      "jabellae",
      "scoped @ must not replace the kernel active expression",
    );
    assertEqual(
      getIdentity(me).expression,
      "jabellae",
      "scoped @ must leave identity.expression anchored to the root active expression",
    );
  });

  console.log("\n════════════════════════════════════════════");
  console.log(" SECTION 6 — Cross-Instance Mathematical Proof");
  console.log(" identity = f(seed). Nothing else matters.");
  console.log("════════════════════════════════════════════");

  await test("identity hash is independent of write history", () => {
    const seed = "write-history-independence";
    const me1: any = new (ME as any)(seed);

    const me2: any = new (ME as any)(seed);
    me2.profile.name("Jose");
    me2.profile.city("Veracruz");
    me2.work.title("Engineer");
    me2.work.company("neurons.me");

    assertEqual(
      getIdentity(me1).hash,
      getIdentity(me2).hash,
      "identity hash must not depend on what was written into the kernel",
    );
  });

  await test("identity hash is independent of creation time", async () => {
    const seed = "time-independence-test";
    const hash1 = getIdentity(new (ME as any)(seed)).hash;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const hash2 = getIdentity(new (ME as any)(seed)).hash;
    assertEqual(hash1, hash2, "identity hash must not depend on creation time");
  });

  await test("identity hash is independent of process state", () => {
    const seed = "process-state-independence";
    for (let i = 0; i < 100; i++) {
      new (ME as any)(`noise-kernel-${i}`);
    }

    const hash1 = getIdentity(new (ME as any)(seed)).hash;
    const hash2 = getIdentity(new (ME as any)(seed)).hash;
    assertEqual(
      hash1,
      hash2,
      "identity hash must not be affected by other kernel instances in process",
    );
  });

  await test("web3 analogy — same mnemonic always derives same address", () => {
    const mnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const instances = Array.from(
      { length: 5 },
      () => getIdentity(new (ME as any)(mnemonic)).hash,
    );
    const allSame = instances.every((hash) => hash === instances[0]);
    assert(
      allSame,
      "all 5 instances from same mnemonic must produce identical identity hash",
    );
  });

  console.log("\n════════════════════════════════════════════");
  console.log(" RECONSTRUCTION TEST SUMMARY");
  console.log("════════════════════════════════════════════\n");

  results.forEach((result) => console.log(result));

  const total = passed + failed;
  console.log(`\n${passed}/${total} tests passed`);

  if (failed > 0) {
    console.log("\n❌ RECONSTRUCTION PROOF FAILED");
    console.log(`   ${failed} test(s) failed — the seed primitive is not correct.`);
    process.exit(1);
  }

  console.log("\n✅ RECONSTRUCTION PROOF COMPLETE");
  console.log("   same seed → same identity");
  console.log("   always. deterministically. on any device.");
  console.log("   the seed is the self.");
}

await main();
