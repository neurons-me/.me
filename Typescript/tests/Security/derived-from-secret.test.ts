// tests/ActiveGraph/secretDerivationReplay.test.ts
//
// A/B boundary test for the ActiveGraph thread (yoheinakajima/activegraph#84).
//
// Question: under a hostile full dump (public snapshot + memory log, no keys),
// does a secret value A leak, and can a public derivation B = f(A) be replayed?
//
// This test adds NOTHING to .me. It only records what the kernel does today.
// Assertions marked "CURRENT BEHAVIOR" document the boundary as it is, not as
// a target. If the kernel changes, update them deliberately.
//
// Run: node tests/ActiveGraph/secretDerivationReplay.test.ts

import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";

const A_VALUE = 31337.4242;          // '.' never appears in base64/hex, so no false positives
const B_VALUE = A_VALUE * 2;
const SCOPE_KEY = "AG_SCOPE_SECRET_7f3k";
const B_FORMULA = "vault.balance * 2";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ✗ ${name}\n    ${err?.message ?? err}`);
  }
}

function makeSource() {
  const me: any = new (ME as any)();
  me.vault["_"](SCOPE_KEY);           // A lives under a secret "_" branch
  me.vault.balance(A_VALUE);
  me.report["="]("doubled", B_FORMULA); // B is a public derivation of A
  return me;
}

async function main() {
  console.log("ActiveGraph A/B: secret A, public derivation B");

  // ── Step 1: setup ────────────────────────────────────────────────
  await test("1. A under `_`, B public derivation of A (live session)", () => {
    const me = makeSource();
    assert.equal(me("report.doubled"), B_VALUE, "B computes from A in-session");
    assert.equal(me("vault"), undefined, "secret branch root is not readable");
    const ex = me.explain("report.doubled");
    const input = ex?.derivation?.inputs?.find((i: any) => i.path === "vault.balance");
    assert.ok(input, "explain lists A as an input of B");
    assert.equal(input.masked, true, "A is masked in explain");
    assert.equal(input.origin, "stealth");
    assert.notEqual(input.value, A_VALUE);
  });

  // ── Step 2: hostile full dump ────────────────────────────────────
  await test("2. public snapshot + log never contain A raw or the scope key", () => {
    const dump = JSON.stringify(makeSource().exportSnapshot());
    assert.equal(dump.includes(String(A_VALUE)), false, "A raw value must not appear");
    assert.equal(dump.includes(SCOPE_KEY), false, "scope key must not appear");
  });

  await test("2b. CURRENT BEHAVIOR: B's computed value IS in the log; its formula is NOT", () => {
    const snap = makeSource().exportSnapshot();
    const dump = JSON.stringify(snap);
    assert.equal(dump.includes(String(B_VALUE)), true, "B value is logged as its own memory");
    assert.equal(dump.includes(B_FORMULA), false, "B formula is not logged");
    const bMem = snap.memories.filter((m: any) => m.path === "report.doubled");
    assert.ok(bMem.length >= 1, "there is a memory for B");
    assert.equal(bMem.at(-1).value, B_VALUE);
  });

  await test("2c. CURRENT BEHAVIOR: each recompute of B appends a new public memory", () => {
    const me = makeSource();
    me.vault.balance(100);
    assert.equal(me("report.doubled"), 200, "B follows A live");
    const snap = me.exportSnapshot();
    const bMems = snap.memories.filter((m: any) => m.path === "report.doubled");
    assert.equal(bMems.at(-1).value, 200, "new B value logged after A changed");
    assert.equal(JSON.stringify(snap).includes('"100"') || JSON.stringify(snap).includes(":100,"), false,
      "new A value not logged raw");
  });

  // ── Step 3: replay without key ───────────────────────────────────
  await test("3. CURRENT BEHAVIOR: without key, A is absent and B IS available", () => {
    const snap = JSON.parse(JSON.stringify(makeSource().exportSnapshot()));
    const hydrated: any = new (ME as any)();
    hydrated.hydrate(snap);
    assert.equal(hydrated("vault.balance"), undefined, "A unreadable without key");
    assert.equal(hydrated("report.doubled"), B_VALUE, "B restored from its logged value");

    const logOnly: any = new (ME as any)();
    logOnly.replayMemories(snap.memories);
    assert.equal(logOnly("vault.balance") ?? undefined, undefined, "A absent from log-only replay");
    assert.equal(logOnly("report.doubled"), B_VALUE, "B restored from log alone");
  });

  // ── Step 4: replay with key ──────────────────────────────────────
  await test("4. with key: A readable, B present", () => {
    const snap = JSON.parse(JSON.stringify(makeSource().exportSnapshot()));
    const f: any = new (ME as any)();
    f.hydrate(snap);
    f.vault["_"](SCOPE_KEY);
    assert.equal(f("vault.balance"), A_VALUE, "A decrypts with key");
    assert.equal(f("report.doubled"), B_VALUE);
  });

  await test("4b. CURRENT BEHAVIOR: after replay, B is a static value, not a live derivation", () => {
    const snap = JSON.parse(JSON.stringify(makeSource().exportSnapshot()));
    const f: any = new (ME as any)();
    f.hydrate(snap);
    f.vault["_"](SCOPE_KEY);
    f.vault.balance(7);
    assert.equal(f("report.doubled"), B_VALUE, "B does not recompute (formula was not persisted)");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
