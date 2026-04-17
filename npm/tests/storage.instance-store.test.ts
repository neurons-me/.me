import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// @ts-ignore -- runtime verification intentionally targets the built artifact.
import ME from "../dist/me.es.js";

type EncryptedBlob = `0x${string}`;
type EncryptedBranchPlane = Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;

const { DiskStore, MemoryStore } = ME as typeof ME & {
  DiskStore: typeof import("../src/instance-store.ts").DiskStore;
  MemoryStore: typeof import("../src/instance-store.ts").MemoryStore;
};

type StoreFactory<T> = () => T;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    throw error;
  }
}

function tempDir(prefix = "me-instance-store-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function flipLastHexNibble(input: EncryptedBlob): EncryptedBlob {
  const head = input.slice(0, -1);
  const tail = input.slice(-1).toLowerCase();
  const next = tail === "f" ? "0" : "f";
  return `${head}${next}` as EncryptedBlob;
}

function runStoreContract<T extends InstanceType<typeof MemoryStore> | InstanceType<typeof DiskStore>>(
  label: string,
  factory: StoreFactory<T>,
) {
  test(`${label}: parity contract`, () => {
    const store = factory();
    try {
      const legacyBlob = "0xaaa111" as EncryptedBlob;
      const balanceBlob = "0xbbb222" as EncryptedBlob;
      const noteBlob = "0xccc333" as EncryptedBlob;

      store.setScope("wallet", legacyBlob);
      assert.equal(store.getScope("wallet"), legacyBlob);
      assert.equal(store.getChunk("wallet", "default"), legacyBlob);
      assert.deepEqual(store.listScopes(), ["wallet"]);
      assert.deepEqual(store.listChunks("wallet"), ["default"]);

      store.setChunk("wallet", "balance_root", balanceBlob);
      store.setChunk("wallet", "note_root", noteBlob);

      const scope = store.getScope("wallet") as Record<string, EncryptedBlob>;
      assert.equal(scope.default, legacyBlob);
      assert.equal(scope.balance_root, balanceBlob);
      assert.equal(scope.note_root, noteBlob);
      assert.deepEqual(store.listChunks("wallet").sort(), ["balance_root", "default", "note_root"]);

      store.deleteChunk("wallet", "note_root");
      assert.equal(store.getChunk("wallet", "note_root"), undefined);

      const exported = store.exportData();
      assert.deepEqual(exported, {
        wallet: {
          default: legacyBlob,
          balance_root: balanceBlob,
        },
      } satisfies EncryptedBranchPlane);
    } finally {
      store.close();
    }
  });
}

console.log("\n### InstanceStore Golden Tests");

runStoreContract("MemoryStore", () => new MemoryStore());

test("DiskStore: persistence survives restart", () => {
  const dir = tempDir("me-disk-store-");
  try {
    const first = new DiskStore({ baseDir: dir, maxHotBytes: 1024 * 1024 });
    first.setChunk("vault", "balance_root", "0xabc123" as EncryptedBlob);
    first.setChunk("vault", "note_root", "0xdef456" as EncryptedBlob);
    first.close();

    const second = new DiskStore({ baseDir: dir, maxHotBytes: 1024 * 1024 });
    try {
      assert.deepEqual(second.listScopes(), ["vault"]);
      assert.deepEqual(second.listChunks("vault").sort(), ["balance_root", "note_root"]);
      assert.equal(second.getChunk("vault", "balance_root"), "0xabc123");
      assert.equal(second.getChunk("vault", "note_root"), "0xdef456");
    } finally {
      second.close();
    }
  } finally {
    cleanup(dir);
  }
});

runStoreContract("DiskStore", () => {
  const dir = tempDir("me-disk-parity-");
  const store = new DiskStore({ baseDir: dir, maxHotBytes: 1024 * 1024 });
  const originalClose = store.close.bind(store);
  store.close = () => {
    originalClose();
    cleanup(dir);
  };
  return store;
});

test("ME: encryptedBranches stays live for the default MemoryStore", () => {
  const me = new ME() as any;
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);

  const chunkId = me.getChunkId(["wallet", "balance"], ["wallet"]);
  const original = me.encryptedBranches.wallet[chunkId];
  me.encryptedBranches.wallet[chunkId] = flipLastHexNibble(original);

  const result = me("wallet.balance");
  assert.ok(result === undefined || result === null);
});

test("ME: DiskStore preserves secret reads, stealth roots, snapshots, and explain()", () => {
  const dir = tempDir("me-disk-kernel-");
  try {
    const me = new ME(undefined, {
      store: new DiskStore({ baseDir: dir, maxHotBytes: 4_000_000 }),
    }) as any;

    me.finance.fuel_price(25);
    me.wallet["_"]("steel-door");
    me.wallet.income(1000);
    me.wallet.expenses.rent(400);
    me.wallet["="]("net", "income - expenses.rent");

    assert.equal(me("finance.fuel_price"), 25);
    assert.equal(me("wallet"), undefined);
    assert.equal(me("wallet.net"), 600);

    const explanation = me.explain("wallet.net");
    assert.equal(explanation.value, 600);
    assert.deepEqual(explanation.meta.dependsOn.sort(), ["expenses.rent", "wallet.income"]);

    const snapshot = me.exportSnapshot();
    assert.ok(snapshot.encryptedBranches.wallet);

    const restoredDir = tempDir("me-disk-kernel-restored-");
    try {
      const restored = new ME(undefined, {
        store: new DiskStore({ baseDir: restoredDir, maxHotBytes: 4_000_000 }),
      }) as any;
      restored.rehydrate(snapshot);

      assert.equal(restored("wallet"), undefined);
      assert.equal(restored("wallet.net"), 600);
      assert.deepEqual(restored.encryptedBranches, snapshot.encryptedBranches);
    } finally {
      cleanup(restoredDir);
    }
  } finally {
    cleanup(dir);
  }
});

console.log("✅ InstanceStore golden suite passed");
