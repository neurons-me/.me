/// <reference types="node" />
/**
 * DERIVED-FROM-SECRET — public derivations over `_` secret scopes
 *
 * Originated as the characterization test for the ActiveGraph RFC thread
 * (yoheinakajima/activegraph#84), formerly
 * tests/ActiveGraph/secretDerivationReplay.test.ts.
 *
 * Rule:
 * - A value derived from a secret becomes public only through an act of
 *   someone who can open that secret. Declaring a public formula over a
 *   secret path (`me.report["="]("doubled", "vault.balance * 2")`) is the
 *   owner's deliberate, standing disclosure decision: the computed value is
 *   public, the secret input and the formula are not, and every recompute
 *   publishes the new value under that same standing decision.
 * - The kernel guarantees that exposure always passes through a key holder.
 *   To a party without the key the secret is absent, so a derivation that
 *   party declares has nothing to draw from.
 * - The kernel does not, and cannot, prevent readers from inferring things
 *   from data they are entitled to (a public invoice total over private line
 *   prices), nor copying a value once it has been opened to them.
 *
 * `BY DESIGN` cases document disclosure the owner chose. `GUARANTEE` cases
 * document what a keyless party cannot do.
 *
 * Run: node tests/Security/derived-from-secret.test.ts
 */
import { MEConstructor as ME, assert, assertNoMarkers, clone, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("Derived-from-secret");

const A_VALUE = 31337.4242;          // '.' never appears in base64/hex, so no false positives
const B_VALUE = A_VALUE * 2;
const SCOPE_KEY = "AG_SCOPE_SECRET_7f3k";
const B_FORMULA = "vault.balance * 2";
const FX = 3;                        // public input mixed with the secret (price * fuel)
const PASSWORD = "derived-from-secret-password-01";

// Derivations a keyless party might declare over the secret path.
const PROBES: Array<[string, string]> = [
  ["times1", "vault.balance * 1"],   // arithmetic
  ["same", "vault.balance"],         // identity
  ["above", "vault.balance > 30000"], // comparison (one bit)
];
const MIXED: [string, string] = ["mixed", "vault.balance * fx.rate"];

// Anything computed from A that a probe could surface.
const SECRET_MARKERS = [String(A_VALUE), String(A_VALUE * FX)];

function makeSource() {
  const me: any = new ME();
  me.vault["_"](SCOPE_KEY);           // A lives under a secret "_" branch
  me.vault.balance(A_VALUE);
  me.report["="]("doubled", B_FORMULA); // B is a public derivation of A
  return me;
}

function makeSourceWithPublicInput() {
  const me = makeSource();
  me.fx.rate(FX);
  return me;
}

/** Every way this file obtains a kernel that holds the data but not the key. */
async function keylessParties(): Promise<Array<[string, any]>> {
  const snap = clone(makeSourceWithPublicInput().exportSnapshot());

  const hydrated: any = new ME();
  hydrated.hydrate(clone(snap));

  const logOnly: any = new ME();
  logOnly.replayMemories(clone(snap.memories));

  const wrongKey: any = new ME();
  wrongKey.hydrate(clone(snap));
  wrongKey.vault["_"]("NOT_THE_SCOPE_KEY");

  const locked: any = new ME();
  await locked.createIdentityRoot(PASSWORD);
  locked.vault["_"](SCOPE_KEY);
  locked.vault.balance(A_VALUE);
  locked.fx.rate(FX);
  locked.lockIdentity();

  return [
    ["hydrated snapshot", hydrated],
    ["log-only replay", logOnly],
    ["hydrated + wrong key", wrongKey],
    ["owner kernel after lockIdentity()", locked],
  ];
}

function assertNotDerived(value: unknown, context: string) {
  assert.notEqual(value, A_VALUE, `${context}: must not equal the secret`);
  assert.ok(
    typeof value !== "number" && typeof value !== "boolean",
    `${context}: a keyless derivation must not produce a computed value (got ${JSON.stringify(value)})`,
  );
}

function assertNoSecretInDump(me: any, context: string) {
  const snap = me.exportSnapshot();
  assertNoMarkers(JSON.stringify(snap), SECRET_MARKERS, `${context} snapshot`);
  assertNoMarkers(JSON.stringify(snap.memories), SECRET_MARKERS, `${context} memory log`);
}

async function main() {
  console.log("\n### Derived-from-secret: secret A, public derivation B");

  // ── Setup ────────────────────────────────────────────────────────
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

  // ── Hostile full dump ────────────────────────────────────────────
  await test("2. public snapshot + log never contain A raw or the scope key", () => {
    const dump = JSON.stringify(makeSource().exportSnapshot());
    assert.equal(dump.includes(String(A_VALUE)), false, "A raw value must not appear");
    assert.equal(dump.includes(SCOPE_KEY), false, "scope key must not appear");
  });

  await test("2b. BY DESIGN: B's computed value is public (the owner's disclosure); its formula is not logged", () => {
    const snap = makeSource().exportSnapshot();
    const dump = JSON.stringify(snap);
    assert.equal(dump.includes(String(B_VALUE)), true, "B value is logged as its own memory");
    assert.equal(dump.includes(B_FORMULA), false, "B formula is not logged");
    const bMem = snap.memories.filter((m: any) => m.path === "report.doubled");
    assert.ok(bMem.length >= 1, "there is a memory for B");
    assert.equal(bMem.at(-1).value, B_VALUE);
  });

  await test("2c. BY DESIGN: each recompute of B appends a new public memory (standing disclosure declared by the owner)", () => {
    const me = makeSource();
    me.vault.balance(100);
    assert.equal(me("report.doubled"), 200, "B follows A live");
    const snap = me.exportSnapshot();
    const bMems = snap.memories.filter((m: any) => m.path === "report.doubled");
    assert.equal(bMems.at(-1).value, 200, "new B value logged after A changed");
    assert.equal(JSON.stringify(snap).includes('"100"') || JSON.stringify(snap).includes(":100,"), false,
      "new A value not logged raw");
  });

  // ── Replay without key ───────────────────────────────────────────
  await test("3. BY DESIGN: without key, A is absent and the disclosed B is available", () => {
    const snap = clone(makeSource().exportSnapshot());
    const hydrated: any = new ME();
    hydrated.hydrate(snap);
    assert.equal(hydrated("vault.balance"), undefined, "A unreadable without key");
    assert.equal(hydrated("report.doubled"), B_VALUE, "B restored from its logged value");

    const logOnly: any = new ME();
    logOnly.replayMemories(snap.memories);
    assert.equal(logOnly("vault.balance") ?? undefined, undefined, "A absent from log-only replay");
    assert.equal(logOnly("report.doubled"), B_VALUE, "B restored from log alone");
  });

  // ── Replay with key ──────────────────────────────────────────────
  await test("4. with key: A readable, B present", () => {
    const snap = clone(makeSource().exportSnapshot());
    const f: any = new ME();
    f.hydrate(snap);
    f.vault["_"](SCOPE_KEY);
    assert.equal(f("vault.balance"), A_VALUE, "A decrypts with key");
    assert.equal(f("report.doubled"), B_VALUE);
  });

  await test("4b. BY DESIGN: after replay, B is a static value; the formula is not persisted, so the disclosure does not carry over", () => {
    const snap = clone(makeSource().exportSnapshot());
    const f: any = new ME();
    f.hydrate(snap);
    f.vault["_"](SCOPE_KEY);
    f.vault.balance(7);
    assert.equal(f("report.doubled"), B_VALUE, "B does not recompute (formula was not persisted)");
  });

  // ── Keyless parties cannot declare a leaking derivation ──────────
  await test("5. GUARANTEE: a keyless party declaring a derivation over the secret gets nothing computed from it", async () => {
    for (const [label, me] of await keylessParties()) {
      assert.equal(me("vault.balance") ?? undefined, undefined, `${label}: sanity, A is absent`);
      for (const [name, expr] of PROBES) {
        me.probe["="](name, expr);
        assertNotDerived(me(`probe.${name}`), `${label}: probe.${name} = ${expr}`);
      }
      assertNoSecretInDump(me, label);
    }
  });

  await test("6. GUARANTEE: mixing the secret with a public value (price * fuel) reveals nothing to a keyless party", async () => {
    for (const [label, me] of await keylessParties()) {
      assert.equal(me("fx.rate"), FX, `${label}: sanity, the public input is readable`);
      me.probe["="](MIXED[0], MIXED[1]);
      assertNotDerived(me(`probe.${MIXED[0]}`), `${label}: probe.${MIXED[0]} = ${MIXED[1]}`);
      assertNoSecretInDump(me, label);
    }
  });

  await test("7. BY DESIGN (positive control): the owner, holding the key, declaring the same derivations publishes their values", () => {
    const me = makeSourceWithPublicInput();
    for (const [name, expr] of [...PROBES, MIXED]) me.probe["="](name, expr);
    assert.equal(me("probe.times1"), A_VALUE);
    assert.equal(me("probe.same"), A_VALUE);
    assert.equal(me("probe.above"), true);
    assert.equal(me("probe.mixed"), A_VALUE * FX);
    const log = JSON.stringify(me.exportSnapshot().memories);
    assert.ok(log.includes(String(A_VALUE * FX)), "owner-declared derived value is in the public log");
  });

  // ── Owner-declared derivation, carried to a keyless kernel ───────
  await test("8. GUARANTEE: an owner-declared derivation produces no new secret-derived values once the key is gone", async () => {
    // (a) exported, then hydrated without the key: the formula is not in
    // the snapshot, so B keeps its last disclosed value.
    const owner = makeSourceWithPublicInput();
    owner.report["="](MIXED[0], MIXED[1]);
    assert.equal(owner("report.mixed"), A_VALUE * FX, "sanity: owner disclosed A * FX");
    const guest: any = new ME();
    guest.hydrate(clone(owner.exportSnapshot()));
    guest.fx.rate(5);
    assert.equal(guest("report.mixed"), A_VALUE * FX, "hydrated guest: B stays at the last disclosed value");
    assertNoMarkers(JSON.stringify(guest.exportSnapshot()), [String(A_VALUE), String(A_VALUE * 5)], "hydrated guest snapshot");

    // (b) same kernel after lockIdentity(): the derivation is still
    // registered, but a recompute triggered by a public input cannot read A.
    const me: any = new ME();
    await me.createIdentityRoot(PASSWORD);
    me.vault["_"](SCOPE_KEY);
    me.vault.balance(A_VALUE);
    me.fx.rate(FX);
    me.report["="](MIXED[0], MIXED[1]);
    assert.equal(me("report.mixed"), A_VALUE * FX, "sanity: disclosed while unlocked");
    me.lockIdentity();
    me.fx.rate(5);
    assertNotDerived(me("report.mixed"), "locked kernel: recompute after fx.rate changed");
    assertNoMarkers(JSON.stringify(me.exportSnapshot()), [String(A_VALUE), String(A_VALUE * 5)], "locked kernel snapshot");

    // Control: once a key holder opens the scope again, the standing
    // disclosure resumes on the next recompute.
    await me.unlockIdentity(PASSWORD);
    me.vault["_"](SCOPE_KEY);
    me.fx.rate(7);
    assert.equal(me("report.mixed"), A_VALUE * me("fx.rate"), "unlocked + key: recompute resumes");
  });
}

main()
  .then(() => {
    const ok = summarize();
    process.exitCode = ok ? 0 : 1;
  })
  .catch((error) => {
    console.error("Fatal error running derived-from-secret.test.ts:", error);
    process.exitCode = 1;
  });
