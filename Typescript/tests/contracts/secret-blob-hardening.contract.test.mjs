import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";
import {
  clone,
  makeBranchSecretSnapshot,
  makeLegacySecretSnapshot,
  makeMixedSecretSnapshot,
  makeNoisySecretSnapshot,
  makeValueLevelSecretSnapshot,
  overrideNoise,
  overrideSecret,
  tamperBranchChunk,
  tamperValueMemory,
  transplantScope,
} from "./_fixtures/secret-blobs.fixture.mjs";

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    throw err;
  }
}

console.log("\n### Secret Blob Hardening Contracts (4B.0)");

test("legacy secret snapshot still decrypts correctly", () => {
  const { snapshot } = makeLegacySecretSnapshot();
  const me = new ME();
  me.rehydrate(snapshot);

  assert.equal(me("vault"), undefined);
  assert.equal(me("vault.payload"), 42);
});

test("v2 secret branch snapshot still decrypts correctly", () => {
  const { snapshot } = makeBranchSecretSnapshot();
  const me = new ME();
  me.rehydrate(snapshot);

  assert.equal(me("wallet"), undefined);
  assert.equal(me("wallet.balance"), 100);
  assert.equal(me("wallet.note"), "private-savings");
});

test("mixed public+secret snapshot rehydrates without leaking", () => {
  const { snapshot } = makeMixedSecretSnapshot();
  const me = new ME();
  me.rehydrate(snapshot);

  assert.equal(me("profile.name"), "Mixed");
  assert.equal(me("public.status"), "ok");
  assert.equal(me("wallet"), undefined);
  assert.equal(me("wallet.balance"), 100);
  assert.equal(me("wallet.note"), "private-savings");
});

test("secret root stays stealth after rehydrate", () => {
  const { snapshot } = makeBranchSecretSnapshot();
  const me = new ME();
  me.rehydrate(snapshot);

  assert.equal(me("wallet"), undefined);
});

test("pointer into secret branch still resolves correctly", () => {
  const { snapshot } = makeMixedSecretSnapshot();
  const me = new ME();
  me.rehydrate(snapshot);

  assert.deepEqual(me("profile.primary"), { __ptr: "wallet" });
  assert.equal(me("profile.primary.balance"), 100);
  assert.equal(me("profile.primary.note"), "private-savings");
  assert.equal(me("wallet"), undefined);
});

test("tampered branch blob fails closed", () => {
  const { snapshot } = makeBranchSecretSnapshot();
  const me = new ME();
  me.rehydrate(tamperBranchChunk(snapshot, "wallet"));

  const balance = me("wallet.balance");
  assert.ok(balance === undefined || balance === null);
  assert.equal(me("wallet"), undefined);
});

test("tampered value-level encrypted leaf fails closed", () => {
  const { snapshot } = makeValueLevelSecretSnapshot();
  const me = new ME();
  me.rehydrate(tamperValueMemory(snapshot, "profile.name"));

  const value = me("profile.name");
  assert.ok(value === undefined || value === null);
  assert.equal(me("profile.mode"), "locked");
});

test("wrong secret key fails closed", () => {
  const { snapshot } = makeBranchSecretSnapshot();
  const me = new ME();
  me.rehydrate(overrideSecret(snapshot, "wallet", "wrong-steel-door"));

  const balance = me("wallet.balance");
  assert.ok(balance === undefined || balance === null);
  assert.equal(me("wallet"), undefined);
});

test("wrong noise boundary fails closed", () => {
  const { snapshot } = makeNoisySecretSnapshot();
  const me = new ME();
  me.rehydrate(overrideNoise(snapshot, "wallet", "wrong-noise"));

  const value = me("wallet.hidden.seed");
  assert.ok(value === undefined || value === null);
  assert.equal(me("wallet"), undefined);
});

test("blob copied to sibling scope path does not decrypt", () => {
  const { snapshot } = makeBranchSecretSnapshot();
  const moved = transplantScope(snapshot, "wallet", "purse");
  const me = new ME();
  me.rehydrate(moved);

  assert.equal(me("wallet.balance"), 100);
  const copied = me("purse.balance");
  assert.ok(copied === undefined || copied === null);
  assert.equal(me("purse"), undefined);
});

test("replay from public memories preserves secret semantics", () => {
  const { me: source } = makeMixedSecretSnapshot();
  const memories = clone(source.inspect().memories);
  const restored = new ME();
  restored.replayMemories(memories);

  assert.equal(restored("profile.name"), "Mixed");
  assert.equal(restored("wallet"), undefined);
  assert.equal(restored("wallet.balance"), 100);
  assert.deepEqual(restored("profile.primary"), { __ptr: "wallet" });
  assert.equal(restored("profile.primary.balance"), 100);
});

console.log("✅ Secret blob hardening contract suite passed");
