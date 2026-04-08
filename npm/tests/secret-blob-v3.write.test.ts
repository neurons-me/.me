/// <reference types="node" />
import assert from "node:assert/strict";
import ME from "this.me";
import { detectBlobVersion } from "../src/crypto.ts";
import type { EncryptedBlob } from "../src/types.ts";

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`✅ ${name}`);
    })
    .catch((err) => {
      console.error(`❌ ${name}`);
      throw err;
    });
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function flipLastHexNibble(blob: EncryptedBlob): EncryptedBlob {
  const hex = String(blob).slice(2);
  const last = hex.slice(-1).toLowerCase();
  const next = last === "a" ? "b" : "a";
  return `0x${hex.slice(0, -1)}${next}`;
}

function getMemoryValue(snapshot: any, path: string): EncryptedBlob {
  const memory = snapshot.memories.find((entry: any) => entry.path === path);
  if (!memory) throw new Error(`No memory found at "${path}".`);
  return memory.value as EncryptedBlob;
}

function getBranchChunk(snapshot: any, scopeKey: string, chunkId: string): EncryptedBlob {
  const entry = snapshot.encryptedBranches[scopeKey];
  if (!entry || typeof entry === "string") {
    throw new Error(`No chunk map found for scope "${scopeKey}".`);
  }
  const blob = entry[chunkId];
  if (!blob) throw new Error(`No chunk "${chunkId}" found under "${scopeKey}".`);
  return blob as EncryptedBlob;
}

function setBranchChunk(snapshot: any, scopeKey: string, chunkId: string, blob: EncryptedBlob): void {
  const entry = snapshot.encryptedBranches[scopeKey];
  if (!entry || typeof entry === "string") {
    throw new Error(`No chunk map found for scope "${scopeKey}".`);
  }
  entry[chunkId] = blob;
}

function makeBranchFixture(): any {
  const me: any = new ME();
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);
  me.wallet.note("private-savings");
  return me;
}

function makeRootFixture(): any {
  const me: any = new ME();
  me["_"]("root-secret");
  me.profile.name("RootPrivate");
  me.profile.mode("locked");
  return me;
}

async function main(): Promise<void> {
  console.log("\n### Secret Blob V3 Write");

  await test("default write now emits v3 branch blobs", () => {
    const me: any = makeBranchFixture();
    const snapshot = me.exportSnapshot();

    assert.equal(detectBlobVersion(getBranchChunk(snapshot, "wallet", "balance_root")), "v3");
    assert.equal(detectBlobVersion(getBranchChunk(snapshot, "wallet", "note_root")), "v3");
    assert.equal(me("wallet.balance"), 100);
  });

  await test("default write now emits v3 value-level blobs", () => {
    const me: any = makeRootFixture();
    const snapshot = me.exportSnapshot();

    assert.equal(detectBlobVersion(getMemoryValue(snapshot, "profile.name")), "v3");
    assert.equal(me("profile.name"), "RootPrivate");
  });

  await test("forcing v2 still emits v2 branch blobs and remains readable", () => {
    const me: any = new ME();
    me.setSecretBlobVersionForTesting("v2");
    me.wallet["_"]("steel-door");
    me.wallet.balance(100);
    me.wallet.note("private-savings");

    const snapshot = me.exportSnapshot();

    assert.equal(detectBlobVersion(getBranchChunk(snapshot, "wallet", "balance_root")), "v2");
    assert.equal(detectBlobVersion(getBranchChunk(snapshot, "wallet", "note_root")), "v2");
    assert.equal(me("wallet.balance"), 100);
    assert.equal(me("wallet.note"), "private-savings");
  });

  await test("forcing v2 still emits v2 value-level blobs and remains readable", () => {
    const me: any = new ME();
    me.setSecretBlobVersionForTesting("v2");
    me["_"]("root-secret");
    me.profile.name("RootPrivate");
    me.profile.mode("locked");

    const snapshot = me.exportSnapshot();

    assert.equal(detectBlobVersion(getMemoryValue(snapshot, "profile.name")), "v2");
    assert.equal(me("profile.name"), "RootPrivate");
    assert.equal(me("profile.mode"), "locked");
  });

  await test("migrateEncryptedBranchesToV3 migrates v2 chunks and preserves history", () => {
    const me: any = new ME();
    me.setSecretBlobVersionForTesting("v2");
    me.wallet["_"]("steel-door");
    me.wallet.balance(100);
    me.wallet.note("private-savings");
    const before = clone(me.exportSnapshot());
    const report = me.migrateEncryptedBranchesToV3();
    const after = me.exportSnapshot();

    assert.equal(report.migratedScopes, 1);
    assert.equal(report.errors, 0);
    assert.ok(report.migratedChunks >= 1);
    assert.equal(detectBlobVersion(getBranchChunk(after, "wallet", "balance_root")), "v3");
    assert.equal(me("wallet.balance"), 100);
    assert.equal(me("wallet.note"), "private-savings");
    assert.deepEqual(after.memories, before.memories);
  });

  await test("migrateEncryptedBranchesToV3 skips already-v3 chunks", () => {
    const me: any = new ME();
    me.wallet["_"]("steel-door");
    me.setSecretBlobVersionForTesting("v3");
    me.wallet.balance(100);

    const report = me.migrateEncryptedBranchesToV3();

    assert.equal(report.migratedScopes, 0);
    assert.equal(report.migratedChunks, 0);
    assert.equal(report.errors, 0);
    assert.ok(report.skipped >= 1);
    assert.equal(me("wallet.balance"), 100);
  });

  await test("tampering after migration still fails closed", () => {
    const me: any = makeBranchFixture();
    me.migrateEncryptedBranchesToV3();
    const snapshot = clone(me.exportSnapshot());
    setBranchChunk(
      snapshot,
      "wallet",
      "balance_root",
      flipLastHexNibble(getBranchChunk(snapshot, "wallet", "balance_root")),
    );

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    const value = restored("wallet.balance");
    assert.ok(value === undefined || value === null);
  });

  console.log("✅ Secret blob v3 write suite passed");
}

await main();
