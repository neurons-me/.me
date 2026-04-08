/// <reference types="node" />
import assert from "node:assert/strict";
import sha3 from "js-sha3";
import ME from "this.me";
import { encryptBlobV3 } from "../src/crypto.ts";
import { collectSecretChainV3 } from "../src/secret-context.ts";

const { keccak256 } = sha3;

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

function flipLastHexNibble(blob: string): string {
  const hex = String(blob).slice(2);
  const last = hex.slice(-1).toLowerCase();
  const next = last === "a" ? "b" : "a";
  return `0x${hex.slice(0, -1)}${next}`;
}

function asciiToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToHex(buf: Uint8Array): `0x${string}` {
  let hex = "";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, "0");
  }
  return `0x${hex}`;
}

function hashFn(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

function legacyXorEncrypt(value: any, secret: string, path: string[]): `0x${string}` {
  const json = JSON.stringify(value);
  const bytes = asciiToBytes(String(json));
  const key = keccak256(secret + ":" + path.join("."));
  const keyBytes = asciiToBytes(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return bytesToHex(out);
}

function makeLegacySecretSnapshot(): { snapshot: any } {
  const rawSecret = "legacy-steel-door";
  const effectiveScopeSecret = hashFn(`root::${rawSecret}`);
  const legacyBlob = legacyXorEncrypt({ payload: 42 }, effectiveScopeSecret, ["vault"]);

  return {
    snapshot: {
      memories: [],
      localSecrets: { vault: rawSecret },
      localNoises: {},
      encryptedBranches: {
        vault: {
          payload_root: legacyBlob,
        },
      },
      keySpaces: {},
      operators: {},
    },
  };
}

function makeBranchFixture(): any {
  const me = new ME();
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);
  me.wallet.note("private-savings");
  return me;
}

function makeRootFixture(): any {
  const me = new ME();
  me["_"]("root-secret");
  me.profile.name("RootPrivate");
  me.profile.mode("locked");
  return me;
}

function makeNoiseFixture(): any {
  const me = new ME();
  me.wallet["_"]("alpha");
  me.wallet["~"]("noise-A");
  me.wallet.hidden["_"]("beta");
  me.wallet.hidden.seed("beta-seed");
  return me;
}

function replaceMemoryValue(snapshot: any, path: string, nextValue: string): any {
  const memory = snapshot.memories.find((entry: any) => entry.path === path);
  if (!memory) throw new Error(`No memory found at "${path}".`);
  memory.value = nextValue;
  return snapshot;
}

async function main(): Promise<void> {
  console.log("\n### Secret Blob V3 Read");

  await test("v3 branch blob reads through normal secret path", () => {
    const source = makeBranchFixture();
    const snapshot = clone(source.exportSnapshot());
    const chain = collectSecretChainV3(source, ["wallet"], "branch");
    snapshot.encryptedBranches.wallet.balance_root = encryptBlobV3(
      { balance: 100 },
      chain,
      "branch",
      ["wallet"],
    );

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    assert.equal(restored("wallet"), undefined);
    assert.equal(restored("wallet.balance"), 100);
  });

  await test("v3 value-level blob reads through normal path", () => {
    const source = makeRootFixture();
    const snapshot = clone(source.exportSnapshot());
    const chain = collectSecretChainV3(source, ["profile", "name"], "value");
    replaceMemoryValue(
      snapshot,
      "profile.name",
      encryptBlobV3("RootPrivate", chain, "value", ["profile", "name"]),
    );

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    assert.equal(restored("profile.name"), "RootPrivate");
    assert.equal(restored("profile.mode"), "locked");
  });

  await test("v2 and legacy blobs remain readable", async () => {
    const v2 = new ME() as any;
    v2.setSecretBlobVersionForTesting("v2");
    v2.wallet["_"]("steel-door");
    v2.wallet.balance(100);
    v2.wallet.note("private-savings");
    const restoredV2: any = new ME();
    restoredV2.rehydrate(v2.exportSnapshot());
    assert.equal(restoredV2("wallet.balance"), 100);

    const { snapshot } = makeLegacySecretSnapshot();
    const restoredLegacy: any = new ME();
    restoredLegacy.rehydrate(snapshot);
    assert.equal(restoredLegacy("vault.payload"), 42);
  });

  await test("tampered v3 branch blob fails closed", () => {
    const source = makeBranchFixture();
    const snapshot = clone(source.exportSnapshot());
    const chain = collectSecretChainV3(source, ["wallet"], "branch");
    snapshot.encryptedBranches.wallet.balance_root = flipLastHexNibble(
      encryptBlobV3({ balance: 100 }, chain, "branch", ["wallet"]),
    );

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    const value = restored("wallet.balance");
    assert.ok(value === undefined || value === null);
  });

  await test("wrong secret for v3 branch blob fails closed", () => {
    const source = makeBranchFixture();
    const snapshot = clone(source.exportSnapshot());
    const chain = collectSecretChainV3(source, ["wallet"], "branch");
    snapshot.encryptedBranches.wallet.balance_root = encryptBlobV3(
      { balance: 100 },
      chain,
      "branch",
      ["wallet"],
    );
    snapshot.localSecrets.wallet = "wrong-steel-door";

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    const value = restored("wallet.balance");
    assert.ok(value === undefined || value === null);
  });

  await test("wrong path for v3 value-level blob fails closed", () => {
    const source = makeRootFixture();
    const snapshot = clone(source.exportSnapshot());
    const chain = collectSecretChainV3(source, ["profile", "name"], "value");
    replaceMemoryValue(
      snapshot,
      "profile.name",
      encryptBlobV3("RootPrivate", chain, "value", ["profile", "name"]),
    );
    snapshot.memories.find((entry: any) => entry.path === "profile.name").path = "profile.alias";

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    const value = restored("profile.alias");
    assert.ok(value === undefined || value === null);
  });

  await test("wrong noise for v3 branch blob fails closed", () => {
    const source = makeNoiseFixture();
    const snapshot = clone(source.exportSnapshot());
    const chain = collectSecretChainV3(source, ["wallet", "hidden"], "branch");
    snapshot.encryptedBranches["wallet.hidden"].seed_root = encryptBlobV3(
      { seed: "beta-seed" },
      chain,
      "branch",
      ["wallet", "hidden"],
    );
    snapshot.localNoises.wallet = "wrong-noise";

    const restored: any = new ME();
    restored.rehydrate(snapshot);

    const value = restored("wallet.hidden.seed");
    assert.ok(value === undefined || value === null);
  });

  console.log("✅ Secret blob v3 read suite passed");
}

await main();
