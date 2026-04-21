// tests/Demos/Hemisphere_1M.ts
import ME from "this.me";
import assert from "node:assert/strict";
const me = new ME() as any;

console.log(`╔══════════════════════════════════════════════════════════════╗
║.me — Hemisphere Scale: 1M Nodes, Cross-Domain Cascade ║
╚══════════════════════════════════════════════════════════════╝
`);

const N = 1_000_000;
const ZONE_SIZE = 10_000;
const TARGET = 777_777;
const TARGET_ZONE = Math.ceil(TARGET / ZONE_SIZE);

console.log(`\n Allocating ${N} districts...`);

const t0 = performance.now();

// 1M districts with progress logs. The data plane is huge, but only one
// hot lineage is derived across domains. This isolates O(k) cascade cost
// from the cold cardinality of the hemisphere.
for (let i = 1; i <= N; i++) {
  me.geo[i].powerUp(true);

  // Log every 100k so you know it's alive
  if (i % 100_000 === 0) {
    console.log(` ${i / 1000}k districts created... ${(performance.now() - t0).toFixed(0)}ms`);
  }
}

// Seed one hot district whose state will cascade across geo -> grid -> traffic -> services.
me.geo[TARGET].trafficLoad(95);
me.geo[TARGET].hospital(true);

console.log(`\n Setting up cross-domain derivations...`);
me.geo[TARGET]["="]("blackout", "!powerUp");
me.geo[TARGET]["="]("gridlock", "blackout && trafficLoad > 80");
me.geo[TARGET]["="]("hospitalAlert", "hospital && blackout");
me.grid[TARGET_ZONE]["="]("zoneDown", `geo[${TARGET}].gridlock || geo[${TARGET}].hospitalAlert`);
me.traffic["="]("emergencyReroute", `grid[${TARGET_ZONE}].zoneDown`);
me.services["="]("generatorMode", "traffic.emergencyReroute");

const t1 = performance.now();
console.log(`\n Setup complete: ${(t1 - t0).toFixed(0)}ms`);
console.log(` Hot lineage: geo.${TARGET} -> grid.${TARGET_ZONE} -> traffic -> services`);
console.log(` Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0)}MB`);

// Mutate ONE sensor
const t2 = performance.now();
me.geo[TARGET].powerUp(false);
const t3 = performance.now();

console.log(`\n Mutate geo[${TARGET}].powerUp: ${(t3 - t2).toFixed(3)}ms`);

const trace = me.explain("services.generatorMode");

assert.equal(me(`geo[${TARGET}].blackout`), true);
assert.equal(me(`geo[${TARGET}].gridlock`), true);
assert.equal(me(`geo[${TARGET}].hospitalAlert`), true);
assert.equal(me(`grid[${TARGET_ZONE}].zoneDown`), true);
assert.equal(me("traffic.emergencyReroute"), true);
assert.equal(me("services.generatorMode"), true);
assert.equal(trace.expr, "traffic.emergencyReroute");
assert.equal(trace.meta?.k, 6);
assert.deepEqual(trace.meta?.recomputed, [
  `geo.${TARGET}.blackout`,
  `geo.${TARGET}.gridlock`,
  `geo.${TARGET}.hospitalAlert`,
  `grid.${TARGET_ZONE}.zoneDown`,
  "traffic.emergencyReroute",
  "services.generatorMode",
]);

console.log(` explain().k: ${trace.meta?.k}`);
console.log(` explain().recomputed: ${JSON.stringify(trace.meta?.recomputed)}`);
console.log(`\n PASS: 1 sensor → ${trace.meta?.k} nodes → hemisphere reacted in ${(t3 - t2).toFixed(3)}ms`);
