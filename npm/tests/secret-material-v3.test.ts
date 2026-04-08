/// <reference types="node" />
import assert from "node:assert/strict";
import ME from "this.me";
import { deriveSecretMaterialV3 } from "../src/crypto.ts";
import {
  collectSecretChainV3,
  computeEffectiveSecret,
} from "../src/secret-context.ts";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    throw err;
  }
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function chainHex(chain: Uint8Array[]): string[] {
  return chain.map((segment) => hex(segment));
}

function makeBranchFixture(): any {
  const me = new ME();
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);
  me.wallet.note("private");
  return me;
}

function makeRootFixture(): any {
  const me = new ME();
  me["_"]("root-secret");
  me.profile.name("RootPrivate");
  return me;
}

function makeNoiseFixture(noiseValue = "noise-A", nestedSecret = "beta"): any {
  const me = new ME();
  me.wallet["_"]("alpha");
  me.wallet.hidden.note("alpha-note");
  me.wallet["~"](noiseValue);
  me.wallet.hidden["_"](nestedSecret);
  me.wallet.hidden.seed("beta-seed");
  return me;
}

console.log("\n### Secret Material V3");

test("same input yields the same chain and the same 32-byte material", () => {
  const me = makeBranchFixture();
  const chainA = collectSecretChainV3(me, ["wallet", "balance"], "value");
  const chainB = collectSecretChainV3(me, ["wallet", "balance"], "value");

  assert.deepEqual(chainHex(chainA), chainHex(chainB));

  const materialA = deriveSecretMaterialV3(chainA, "this.me/blob/v3/value");
  const materialB = deriveSecretMaterialV3(chainB, "this.me/blob/v3/value");

  assert.equal(materialA.length, 32);
  assert.equal(hex(materialA), hex(materialB));
});

test("branch and value diverge for the same secret path", () => {
  const me = makeBranchFixture();
  const branchChain = collectSecretChainV3(me, ["wallet", "balance"], "branch");
  const valueChain = collectSecretChainV3(me, ["wallet", "balance"], "value");

  assert.notDeepEqual(chainHex(branchChain), chainHex(valueChain));
  assert.notEqual(
    hex(deriveSecretMaterialV3(branchChain, "this.me/blob/v3/branch")),
    hex(deriveSecretMaterialV3(valueChain, "this.me/blob/v3/value")),
  );
});

test("sibling leaves share branch material but diverge at value level", () => {
  const me = makeBranchFixture();
  const branchBalance = collectSecretChainV3(me, ["wallet", "balance"], "branch");
  const branchNote = collectSecretChainV3(me, ["wallet", "note"], "branch");
  const valueBalance = collectSecretChainV3(me, ["wallet", "balance"], "value");
  const valueNote = collectSecretChainV3(me, ["wallet", "note"], "value");

  assert.deepEqual(chainHex(branchBalance), chainHex(branchNote));
  assert.equal(
    hex(deriveSecretMaterialV3(branchBalance, "this.me/blob/v3/branch")),
    hex(deriveSecretMaterialV3(branchNote, "this.me/blob/v3/branch")),
  );
  assert.notEqual(
    hex(deriveSecretMaterialV3(valueBalance, "this.me/blob/v3/value")),
    hex(deriveSecretMaterialV3(valueNote, "this.me/blob/v3/value")),
  );
});

test("changing the active noise boundary changes derived material", () => {
  const a = makeNoiseFixture("noise-A");
  const b = makeNoiseFixture("noise-B");

  const materialA = deriveSecretMaterialV3(
    collectSecretChainV3(a, ["wallet", "hidden", "seed"], "value"),
    "this.me/blob/v3/value",
  );
  const materialB = deriveSecretMaterialV3(
    collectSecretChainV3(b, ["wallet", "hidden", "seed"], "value"),
    "this.me/blob/v3/value",
  );

  assert.notEqual(hex(materialA), hex(materialB));
});

test("changing a relevant nested secret changes derived material", () => {
  const a = makeNoiseFixture("noise-A", "beta");
  const b = makeNoiseFixture("noise-A", "gamma");

  const materialA = deriveSecretMaterialV3(
    collectSecretChainV3(a, ["wallet", "hidden", "seed"], "value"),
    "this.me/blob/v3/value",
  );
  const materialB = deriveSecretMaterialV3(
    collectSecretChainV3(b, ["wallet", "hidden", "seed"], "value"),
    "this.me/blob/v3/value",
  );

  assert.notEqual(hex(materialA), hex(materialB));
});

test("branch mode rejects the root secret scope", () => {
  const me = makeRootFixture();
  assert.throws(
    () => collectSecretChainV3(me, ["profile", "name"], "branch"),
    /root secret scope/i,
  );
});

test("legacy effective secret behavior remains unchanged", () => {
  const me = makeNoiseFixture("noise-A", "beta");
  const path = ["wallet", "hidden", "seed"] as const;
  const before = computeEffectiveSecret(me, [...path]);

  const chain = collectSecretChainV3(me, [...path], "value");
  deriveSecretMaterialV3(chain, "this.me/blob/v3/value");
  deriveSecretMaterialV3(chain, "this.me/blob/v3/enc");
  deriveSecretMaterialV3(chain, "this.me/blob/v3/mac");

  const after = computeEffectiveSecret(me, [...path]);
  assert.equal(after, before);
});

console.log("✅ Secret material v3 suite passed");
