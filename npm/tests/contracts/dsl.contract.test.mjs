import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";
import {
  clone,
  flipLastHexNibble,
  hashFn,
  legacyXorEncrypt,
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

console.log("\n### DSL Contract Tests (Phase 6)");

test("boot + basic set/get", () => {
  const me = new ME();
  assert.equal(typeof me, "function");
  me.profile.name("Abella");
  me.profile.age(30);
  assert.equal(me("profile.name"), "Abella");
  assert.equal(me("profile.age"), 30);
});

test("constructor bootstrap preserves callable proxy after rehydrate", () => {
  const me = new ME();
  me.profile.name("Bootstrap");
  me.wallet["_"]("ctor-steel-door");
  me.wallet.balance(7);

  const snapshot = me.exportSnapshot();
  const restored = new ME();

  assert.equal(typeof restored, "function");
  assert.equal(typeof restored["!"].inspect, "function");

  restored.rehydrate(snapshot);

  assert.equal(restored("profile.name"), "Bootstrap");
  assert.equal(restored("wallet.balance"), 7);
  assert.equal(typeof restored["!"].snapshot.export, "function");
});

test("execute dispatch keeps kernel and keyspace routes stable", () => {
  const me = new ME();

  me.execute("me://self:write/profile/name", "Dispatch");
  assert.equal(me.execute("me://self:read/profile/name"), "Dispatch");

  assert.equal(me.execute("me://kernel:get/recompute.mode"), "eager");
  assert.equal(me.execute("me://kernel:set/recompute.mode", "lazy"), "lazy");
  assert.equal(me.execute("me://kernel:read/recompute.mode"), "lazy");

  const envelope = { version: 1, kid: "app-key" };
  me.execute("me://self:write/keys/app", envelope);
  assert.deepEqual(me.execute("me://self:read/keys/app"), envelope);
});

test("mutation helpers preserve learn + replay semantics", () => {
  const me = new ME();

  me.learn({ path: "profile.name", expression: "Writer" });
  me.learn({ path: "vault", operator: "_", expression: "steel-door" });
  me.learn({ path: "vault.balance", expression: 25 });
  me.learn({ path: "profile.primary", operator: "__", value: { __ptr: "vault" } });
  me.learn({ path: "profile.legacy", expression: "remove-me" });
  me.learn({ path: "profile.legacy", operator: "-" });

  const memories = me.execute("me://kernel:export/memory");
  const restored = new ME();
  restored.execute("me://kernel:replay/memory", memories);

  assert.equal(restored("profile.name"), "Writer");
  assert.equal(restored("vault"), undefined);
  assert.equal(restored("vault.balance"), 25);
  assert.equal(restored("profile.primary.balance"), 25);
  assert.notEqual(restored("profile.legacy"), "remove-me");
});

test("public memory surfaces redact effectiveSecret and stay replayable", () => {
  const me = new ME();
  me.profile.name("Public");
  me.vault["_"]("steel-door");
  me.vault.balance(33);

  const inspected = me.inspect().memories;
  const snapshot = me.exportSnapshot();

  assert.equal(inspected.some((memory) => Object.hasOwn(memory, "effectiveSecret")), false);
  assert.equal(snapshot.memories.some((memory) => Object.hasOwn(memory, "effectiveSecret")), false);

  const replayed = new ME();
  replayed.replayMemories(inspected);

  assert.equal(replayed("profile.name"), "Public");
  assert.equal(replayed("vault"), undefined);
  assert.equal(replayed("vault.balance"), 33);
});

test("snapshot import accepts both public and legacy memory payloads", () => {
  const me = new ME();
  me.profile.name("Legacy");
  me.vault["_"]("steel-door");
  me.vault.balance(44);

  const publicSnapshot = me.exportSnapshot();
  const publicRestored = new ME();
  publicRestored.importSnapshot(publicSnapshot);

  assert.equal(publicRestored("profile.name"), "Legacy");
  assert.equal(publicRestored("vault"), undefined);
  assert.equal(publicRestored("vault.balance"), 44);

  const legacySnapshot = clone(publicSnapshot);
  legacySnapshot.memories = clone(me._memories);

  const legacyRestored = new ME();
  legacyRestored.importSnapshot(legacySnapshot);

  assert.equal(legacyRestored("profile.name"), "Legacy");
  assert.equal(legacyRestored("vault"), undefined);
  assert.equal(legacyRestored("vault.balance"), 44);
});

test("phase1 selector [] fixed id", () => {
  const me = new ME();
  me.finca.lote[1].kilos(100);
  me.finca.lote[1].precio(45);
  assert.equal(me("finca.lote[1].kilos"), 100);
  assert.equal(me("finca.lote[1].precio"), 45);
});

test("phase2 iterator broadcast [i] with '='", () => {
  const me = new ME();
  me.finca.lote[1].kilos(100);
  me.finca.lote[1].precio(45);
  me.finca.lote[2].kilos(120);
  me.finca.lote[2].precio(50);

  me.finca["lote[i]"]["="]("total", "finca.lote[i].kilos * finca.lote[i].precio");

  assert.equal(me("finca.lote[1].total"), 4500);
  assert.equal(me("finca.lote[2].total"), 6000);
});

test("phase3 filter read + phase3.1 logical filters", () => {
  const me = new ME();
  me.finca.lote[1].kilos(100);
  me.finca.lote[1].precio(45);
  me.finca.lote[2].kilos(120);
  me.finca.lote[2].precio(50);
  me.finca.lote[3].kilos(130);
  me.finca.lote[3].precio(40);

  const andFilter = me("finca.lote[kilos > 100 && precio >= 50].kilos");
  const orFilter = me("finca.lote[kilos > 125 || precio == 45].precio");
  assert.deepEqual(andFilter, { "2": 120 });
  assert.deepEqual(orFilter, { "1": 45, "3": 40 });
});

test("phase3.1 filtered broadcast for '='", () => {
  const me = new ME();
  me.transporte.camion[1].km(500);
  me.transporte.camion[1].diesel(100);
  me.transporte.camion[2].km(1000);
  me.transporte.camion[2].diesel(350);
  me.transporte.camion[3].km(700);
  me.transporte.camion[3].diesel(120);

  me.transporte["camion[diesel > 200]"]["="]("alerta", "true");

  assert.equal(me("transporte.camion[1].alerta"), undefined);
  assert.equal(me("transporte.camion[2].alerta"), true);
  assert.equal(me("transporte.camion[3].alerta"), undefined);
});

test("phase4 multi-select and range", () => {
  const me = new ME();
  me.finca.lote[1].kilos(100);
  me.finca.lote[2].kilos(120);
  me.finca.lote[3].kilos(80);
  me.finca.lote[4].kilos(130);

  assert.deepEqual(me("finca.lote[[1,3,4]].kilos"), { "1": 100, "3": 80, "4": 130 });
  assert.deepEqual(me("finca.lote[2..4].kilos"), { "2": 120, "3": 80, "4": 130 });
});

test("phase5 transform projection", () => {
  const me = new ME();
  me.finca.lote[1].kilos(100);
  me.finca.lote[2].kilos(120);
  me.finca.lote[3].kilos(80);

  const projected = me("finca.lote[x => x.kilos * 0.9]");
  assert.deepEqual(projected, { "1": 90, "2": 108, "3": 72 });
});

test("runtime escape plane exposes reflective kernel helpers", () => {
  const me = new ME();
  me.profile.name("Abella");

  assert.equal(me["!"].docs.kind, "runtime-surface");
  assert.deepEqual(me["!"].docs.namespaces, [
    "inspect",
    "explain",
    "memories",
    "snapshot",
    "runtime",
    "methods",
  ]);

  const inspect = me["!"].inspect();
  assert.equal(Array.isArray(inspect.memories), true);
  assert.equal(inspect.index["profile.name"], "Abella");

  assert.equal(me["!"].methods.inspect.path, "inspect");
  assert.equal(typeof me["!"].methods.inspect.docs, "string");
  assert.equal(me["!"].runtime.getRecomputeMode(), "eager");

  me["!"].runtime.setRecomputeMode("lazy");
  assert.equal(me["!"].runtime.getRecomputeMode(), "lazy");

  const snapshot = me["!"].snapshot.export();
  const me2 = new ME();
  me2["!"].snapshot.import(snapshot);
  assert.equal(me2("profile.name"), "Abella");
});

test("explicit guest scope does not collapse back to owner scope", () => {
  const me = new ME();
  me.finance["_"]("k-2026");
  me.finance.fuel_price(99);
  me.finance.public_note("visible only to owner scope");

  assert.equal(me("finance.fuel_price"), 99);
  assert.equal(me("finance.public_note"), "visible only to owner scope");
  assert.equal(me.as(null)("finance.fuel_price"), undefined);
  assert.equal(me.as(null)("finance.public_note"), undefined);
});

test("explain() masks stealth inputs while keeping public inputs visible", () => {
  const me = new ME();
  me.finance["_"]("k-2026");
  me.finance.fuel_price(24.5);
  me.fleet.trucks[1].fuel(100);
  me.fleet.trucks[1]["="]("cost", "fuel * finance.fuel_price");
  me("fleet.trucks[1].cost");

  const explanation = me.explain("fleet.trucks.1.cost");
  assert.ok(explanation.derivation);

  const fuelInput = explanation.derivation.inputs.find((input) => input.path === "fleet.trucks.1.fuel");
  const priceInput = explanation.derivation.inputs.find((input) => input.path === "finance.fuel_price");

  assert.ok(fuelInput);
  assert.equal(fuelInput.origin, "public");
  assert.equal(fuelInput.masked, false);
  assert.equal(fuelInput.value, 100);

  assert.ok(priceInput);
  assert.equal(priceInput.origin, "stealth");
  assert.equal(priceInput.masked, true);
  assert.equal(priceInput.value, "●●●●");
});

test("secret branch blobs are non-deterministic across identical writes", () => {
  const me = new ME();
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);

  const firstBlob = me.encryptedBranches.wallet.balance_root;
  assert.equal(typeof firstBlob, "string");

  me.wallet.balance(100);
  const secondBlob = me.encryptedBranches.wallet.balance_root;

  assert.notEqual(secondBlob, firstBlob);
  assert.equal(me("wallet"), undefined);
  assert.equal(me("wallet.balance"), 100);
});

test("tampered v2 secret blobs fail closed", () => {
  const me = new ME();
  me.setSecretBlobVersionForTesting("v2");
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);

  const snapshot = clone(me.exportSnapshot());
  const chunks = snapshot.encryptedBranches.wallet;
  const chunkKey = Object.keys(chunks)[0];
  chunks[chunkKey] = flipLastHexNibble(chunks[chunkKey]);

  const me2 = new ME();
  me2.rehydrate(snapshot);

  assert.equal(me2("wallet"), undefined);
  assert.equal(me2("wallet.balance"), undefined);
});

test("legacy xor secret snapshots still decrypt after v2 hardening", () => {
  const rawSecret = "legacy-steel-door";
  const effectiveScopeSecret = hashFn(`root::${rawSecret}`);
  const legacyBlob = legacyXorEncrypt({ payload: 42 }, effectiveScopeSecret, ["vault"]);

  const snapshot = {
    memories: [],
    localSecrets: { vault: rawSecret },
    localNoises: {},
    encryptedBranches: {
      vault: {
        payload_root: legacyBlob,
      },
    },
    keySpaces: {},
  };

  const me = new ME();
  me.rehydrate(snapshot);

  assert.equal(me("vault"), undefined);
  assert.equal(me("vault.payload"), 42);
});

test("secret caches stay bounded under broad secret traversal", () => {
  const me = new ME();
  const total = 320;
  me.vault["_"]("bounded-cache");

  for (let i = 0; i < total; i++) {
    me.vault[`entry_${i}`].payload(i);
  }

  for (let i = 0; i < total; i++) {
    assert.equal(me(`vault.entry_${i}.payload`), i);
  }

  assert.equal(me("vault"), undefined);
  assert.ok(me.scopeCache.size <= 256);
  assert.ok(me.effectiveSecretCache.size <= 256);
  assert.ok(me.decryptedBranchCache.size <= 64);
});

console.log("✅ Phase 6 contract suite passed");
