import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";

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

console.log("✅ Phase 6 contract suite passed");
