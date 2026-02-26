import assert from "node:assert/strict";
import ME from "../dist/me.es.js";

/**
 * FIRE TEST INDEX (0-8)
 *
 * Phase 0: Identity + Secret Scope
 * Phase 1: Structural Navigation + [] Selectors
 * Phase 2: [i] Broadcast with '='
 * Phase 3: Logical Filters in Selectors
 * Phase 3.1: Compound Logic + Filtered Broadcast
 * Phase 4: Range + Multi-Select
 * Phase 5: Transform Projection (Read-Only)
 * Phase 6: Contract Integrity Check
 * Phase 7A: Temporal Rehydration (Replay Equivalence)
 * Phase 7B: Atomic Snapshot Rehydration (Bit-level Portability)
 * Phase 8: Incremental Recompute + Explain
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
console.log(".me KERNEL FIRE TEST (PHASES 0-8)");
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

runPhase(
  "Phase 7A - Temporal Rehydration (Replay)",
  [
    "Thought log can be exported from the current runtime",
    "A new empty instance can replay those thoughts",
    "Replay reconstructs equivalent semantic results",
  ],
  () => {
    const exportedThoughts = me.inspect().thoughts;
    const me2 = new ME();
    me2.replayThoughts(exportedThoughts);

    const originalCost = me("fleet.trucks[2].total_cost");
    const replayedCost = me2("fleet.trucks[2].total_cost");
    assert.equal(replayedCost, originalCost, "Replay failed to recover derived state");

    assert.equal(me2("finance"), undefined, "Replay should preserve stealth secret root");
    assert.equal(me2("finance.fuel_price"), 24.5, "Replay lost secret leaf value");
  }
);

runPhase(
  "Phase 7B - Atomic Snapshot Rehydration",
  [
    "Snapshot exports full kernel state (thoughts + secrets + noises + encrypted branches)",
    "A fresh runtime can import snapshot atomically",
    "Imported runtime preserves exact encrypted structures and semantic outputs",
  ],
  () => {
    const snapshot = me.exportSnapshot();
    const me3 = new ME();
    me3.rehydrate(snapshot);

    assert.deepEqual(me3.inspect().thoughts, me.inspect().thoughts, "Thought log mismatch after snapshot import");
    assert.deepEqual(me3("fleet.trucks[2].total_cost"), me("fleet.trucks[2].total_cost"), "Snapshot lost derived value");
    assert.deepEqual(me3("finance.fuel_price"), me("finance.fuel_price"), "Snapshot lost secret leaf value");

    // Internal encrypted planes should be identical for atomic portability.
    assert.deepEqual(me3.encryptedBranches, me.encryptedBranches, "Encrypted branches mismatch after import");
    assert.deepEqual(me3.localSecrets, me.localSecrets, "Local secret scopes mismatch after import");
    assert.deepEqual(me3.localNoises, me.localNoises, "Local noise scopes mismatch after import");
  }
);

runPhase(
  "Phase 8 - Incremental Recompute + Explain",
  [
    "Derivation dependencies are tracked from '=' expressions",
    "Changing a referenced leaf triggers targeted recompute",
    "explain(path) exposes expression inputs with public/stealth origin",
    "Stealth inputs are masked in explain() while still auditable",
    "Invalid code tokens are rejected and remain declarative strings",
  ],
  () => {
    const t0 = Date.now();
    console.log("   ⏳ Phase 8 loading dataset and derivations...");
    const me8 = new ME();
    me8["@"]("jabellae");
    me8.finance["_"]("super-secret");
    me8.finance.fuel_price(24.5);

    const N = 1200;
    for (let i = 1; i <= N; i++) {
      me8.fleet.trucks[i].fuel(100 + i);
      me8.fleet.trucks[i].km(500 + i * 2);
    }

    me8.fleet["trucks[i]"]["="]("total_cost", "fuel * finance.fuel_price");
    me8.fleet["trucks[i]"]["="]("efficiency", "km / fuel");
    const setupMs = Date.now() - t0;
    console.log(`   ⏱️ setup completed in ${setupMs}ms`);

    const before1 = me8("fleet.trucks[1].total_cost");
    const before2 = me8("fleet.trucks[2].total_cost");
    const before3 = me8("fleet.trucks[3].total_cost");

    const tGlobal = Date.now();
    me8.finance.fuel_price(30);
    const globalRecomputeMs = Date.now() - tGlobal;
    console.log(`   ⏱️ global dependency recompute in ${globalRecomputeMs}ms`);

    const after1 = me8("fleet.trucks[1].total_cost");
    const after2 = me8("fleet.trucks[2].total_cost");
    const after3 = me8("fleet.trucks[3].total_cost");

    assert.equal(after1, (100 + 1) * 30);
    assert.equal(after2, (100 + 2) * 30);
    assert.equal(after3, (100 + 3) * 30);
    assert.ok(after1 !== before1 && after2 !== before2 && after3 !== before3);

    const beforeLocal1 = me8("fleet.trucks[1].total_cost");
    const beforeLocal2 = me8("fleet.trucks[2].total_cost");
    const beforeLocal3 = me8("fleet.trucks[3].total_cost");

    const tLocal = Date.now();
    me8.fleet.trucks[2].fuel(999);
    const localRecomputeMs = Date.now() - tLocal;
    console.log(`   ⏱️ local dependency recompute in ${localRecomputeMs}ms`);

    const afterLocal1 = me8("fleet.trucks[1].total_cost");
    const afterLocal2 = me8("fleet.trucks[2].total_cost");
    const afterLocal3 = me8("fleet.trucks[3].total_cost");

    assert.equal(afterLocal1, beforeLocal1);
    assert.equal(afterLocal2, 999 * 30);
    assert.equal(afterLocal3, beforeLocal3);
    assert.notEqual(afterLocal2, beforeLocal2);

    const trace = me8.explain("fleet.trucks[2].total_cost");
    assert.equal(trace.path, "fleet.trucks.2.total_cost");
    assert.equal(trace.value, 999 * 30);
    assert.ok(trace.derivation);
    assert.equal(trace.derivation.expression, "fuel * finance.fuel_price");
    assert.ok(trace.meta.dependsOn.includes("fleet.trucks.2.fuel"));
    assert.ok(trace.meta.dependsOn.includes("finance.fuel_price"));

    const fuelInput = trace.derivation.inputs.find((x) => x.path === "fleet.trucks.2.fuel");
    const secretInput = trace.derivation.inputs.find((x) => x.path === "finance.fuel_price");

    assert.ok(fuelInput);
    assert.equal(fuelInput.origin, "public");
    assert.equal(fuelInput.masked, false);
    assert.equal(fuelInput.value, 999);

    assert.ok(secretInput);
    assert.equal(secretInput.origin, "stealth");
    assert.equal(secretInput.masked, true);
    assert.equal(secretInput.value, "●●●●");

    // Security: mini evaluator must reject executable JS payloads.
    me8.fleet.trucks[2]["="]("unsafe_expr", "1 + console.log(1)");
    assert.equal(me8("fleet.trucks[2].unsafe_expr"), "1 + console.log(1)");
    console.log(`   ✅ Phase 8 total runtime: ${Date.now() - t0}ms`);
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
