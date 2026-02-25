import assert from "node:assert/strict";
import ME from "../dist/me.es.js";

/**
 * FIRE TEST INDEX (0-6)
 *
 * Phase 0: Identity + Secret Scope
 * Phase 1: Structural Navigation + [] Selectors
 * Phase 2: [i] Broadcast with '='
 * Phase 3: Logical Filters in Selectors
 * Phase 3.1: Compound Logic + Filtered Broadcast
 * Phase 4: Range + Multi-Select
 * Phase 5: Transform Projection (Read-Only)
 * Phase 6: Contract Integrity Check
 */

const me = new ME();
const results = [];

function runPhase(name, checks, fn) {
  console.log(`\n--- ${name} ---`);
  for (const c of checks) console.log(`   • ${c}`);
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`✅ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.error(`❌ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

console.log("\n========================================================");
console.log(".me KERNEL FIRE TEST (PHASES 0-6)");
console.log("========================================================\n");

runPhase(
  "Phase 0 - Identity + Secret Scope",
  [
    "Root identity claim (@) is accepted",
    "Secret scope root stays stealth (undefined)",
    "Secret leaf data remains readable by path",
  ],
  () => {
  me["@"]("jabellae");
  me.finance["_"]("my-secret-key-2026");
  me.finance.fuel_price(24.5);

  assert.equal(me("finance"), undefined, "Secret root must stay stealth");
  assert.equal(me("finance.fuel_price"), 24.5, "Secret leaf should be readable");
  }
);

runPhase(
  "Phase 1 - Structural [] Selectors",
  [
    "Bracket selector writes create indexed nodes",
    "Bracket selector reads resolve exact indexed leaves",
  ],
  () => {
  me.fleet.trucks[1].km(1000);
  me.fleet.trucks[1].fuel(200);
  me.fleet.trucks[2].km(1200);
  me.fleet.trucks[2].fuel(350);
  me.fleet.trucks[3].km(800);
  me.fleet.trucks[3].fuel(150);

  assert.equal(me("fleet.trucks[1].km"), 1000);
  assert.equal(me("fleet.trucks[2].fuel"), 350);
  }
);

runPhase(
  "Phase 2 - [i] Broadcast with '='",
  [
    "One rule is broadcast to all collection members",
    "Each member gets an evaluated contextual result",
  ],
  () => {
  me.fleet["trucks[i]"]["="]("efficiency", "km / fuel");

  assert.equal(me("fleet.trucks[1].efficiency"), 5);
  assert.equal(me("fleet.trucks[2].efficiency"), 1200 / 350);
  assert.equal(me("fleet.trucks[3].efficiency"), 800 / 150);
  }
);

runPhase(
  "Phase 3 - Logical Filters",
  [
    "Single and compound filters return only matching nodes",
    "Filter evaluation works on derived fields",
  ],
  () => {
  const inefficient = me("fleet.trucks[efficiency < 4.5]");
  assert.deepEqual(Object.keys(inefficient).sort(), ["2"]);

  const compound = me("fleet.trucks[efficiency < 4.5 || km > 1100]");
  assert.deepEqual(Object.keys(compound).sort(), ["2"]);
  }
);

runPhase(
  "Phase 3.1 - Filtered Broadcast",
  [
    "Broadcast assignment runs only on nodes matching filter",
    "Non-matching nodes remain unchanged",
  ],
  () => {
  me.fleet["trucks[efficiency < 4.5]"]["="]("alert", "true");

  assert.equal(me("fleet.trucks[1].alert"), undefined);
  assert.equal(me("fleet.trucks[2].alert"), true);
  assert.equal(me("fleet.trucks[3].alert"), undefined);
  }
);

runPhase(
  "Phase 4 - Range + Multi-Select",
  [
    "Range selectors [a..b] slice contiguous subsets",
    "Multi-select selectors [[a,b,c]] slice sparse subsets",
  ],
  () => {
  const rangeReport = me("fleet.trucks[1..2].efficiency");
  const manualReport = me("fleet.trucks[[1,3]].efficiency");

  assert.deepEqual(Object.keys(rangeReport).sort(), ["1", "2"]);
  assert.deepEqual(Object.keys(manualReport).sort(), ["1", "3"]);
  }
);

runPhase(
  "Phase 5 - Transform Projection",
  [
    "Read-only projection computes transformed values",
    "Projection output is numeric per selected member",
  ],
  () => {
  const projection = me("fleet.trucks[x => x.efficiency * 1.2]");

  assert.ok(typeof projection["1"] === "number");
  assert.ok(typeof projection["2"] === "number");
  assert.equal(projection["1"], 6);
  }
);

runPhase(
  "Phase 6 - Contract Integrity",
  [
    "Cross-scope formula (public + secret leaf) computes deterministically",
    "Final invariant equals expected numeric result",
  ],
  () => {
  me.fleet["trucks[i]"]["="]("total_cost", "fuel * finance.fuel_price");
  const truck2Cost = me("fleet.trucks[2].total_cost");
  assert.equal(truck2Cost, 350 * 24.5, "Secret-dependent arithmetic failed");
  }
);

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

console.log("\n========================================================");
console.log(`FIRE TEST SUMMARY: ${passed}/${results.length} phases passed`);
if (failed > 0) {
  console.log(`FAILED: ${failed}`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(` - ${r.name}`);
  }
  process.exitCode = 1;
} else {
  console.log("STATUS: ALL PHASES PASSED");
}
console.log("========================================================\n");
