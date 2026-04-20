import ME from "this.me";
import assert from "node:assert/strict";

const me = new ME() as any;

function show(label: string, value: unknown) {
  console.log(`\n ${label}\n → ${JSON.stringify(value)}`);
}

console.log(`
╔══════════════════════════════════════════════════════════════╗
║       .me — City Scale Benchmark: 10k Districts              ║
║                                                              ║
║       Proves O(k) recompute even when N = 10,000             ║
╚══════════════════════════════════════════════════════════════╝
`);

const N = 10000;
const TARGET = 5001;
const t0 = performance.now();

// 1. Create 10k districts with capacity + currentLoad
for (let i = 1; i <= N; i++) {
  me.districts[i].name(`District ${i}`);
  me.districts[i].capacity(10000);
  // Distribute load: 80% are at 50%, 20% are at 90%
  me.districts[i].currentLoad(i % 5 === 0 ? 9000 : 5000);
}

// 2. Broadcast derivations to all 10k nodes
me.districts["[i]"]["="]("loadPercent", "currentLoad / capacity * 100");
me.districts["[i]"]["="]("overCapacity", "currentLoad > capacity");
me.districts["[i]"]["="]("needsRedirection", "loadPercent > 85");

const t1 = performance.now();
console.log(`\n Setup ${N} districts + 3 derivations: ${(t1 - t0).toFixed(2)}ms`);

// 3. Verify initial state
const overBefore = me("districts[overCapacity == true].name");
show("Districts over capacity before", Object.keys(overBefore).length); // 0
const needRedirectBefore = me("districts[needsRedirection == true].name");
show("Districts needing redirection before", Object.keys(needRedirectBefore).length); // 2000

// 4. Mutate ONE district: push it over capacity
const t2 = performance.now();
me.districts[TARGET].currentLoad(10500); // was 5000, now 10500 > 10000
const t3 = performance.now();

console.log(`\n Mutate districts[${TARGET}].currentLoad: ${(t3 - t2).toFixed(3)}ms`);

// 5. Check that only that district flipped
assert.equal(me(`districts[${TARGET}].overCapacity`), true);
assert.equal(me(`districts[${TARGET}].needsRedirection`), true);
assert.equal(me("districts[5000].overCapacity"), false); // neighbor untouched
assert.equal(me("districts[5002].overCapacity"), false); // neighbor untouched

const overAfter = me("districts[overCapacity == true].name");
show("Districts over capacity after", Object.keys(overAfter).length); // 1
assert.equal(Object.keys(overAfter).length, 1);

// 6. Use explain() to inspect direct dependencies plus the last recompute wave
const trace = me.explain(`districts[${TARGET}].needsRedirection`);
show("explain().dependsOn", trace.meta?.dependsOn);
show("explain().expr", trace.expr);
show("explain().k", trace.meta?.k);
show("explain().recomputed", trace.meta?.recomputed);

console.log(`
  explain("districts[${TARGET}].needsRedirection")
    → {
      "expr": ${JSON.stringify(trace.expr)},
      "dependsOn": ${JSON.stringify(trace.meta?.dependsOn)},
      "k": ${JSON.stringify(trace.meta?.k)},
      "recomputed": ${JSON.stringify(trace.meta?.recomputed)}
    }
`);

assert.equal(trace.expr, "loadPercent > 85");
assert.deepEqual(trace.meta?.dependsOn, [
  `districts.${TARGET}.loadPercent`,
]);
assert.equal(trace.meta?.k, 3);
assert.deepEqual(trace.meta?.recomputed, [
  `districts.${TARGET}.loadPercent`,
  `districts.${TARGET}.overCapacity`,
  `districts.${TARGET}.needsRedirection`,
]);
assert.equal(trace.meta?.sourcePath, `districts.${TARGET}.currentLoad`);

// 7. Benchmark filter re-evaluation
const t4 = performance.now();
const redirectedNow = me("districts[needsRedirection == true].name");
const t5 = performance.now();

show("Re-evaluate filter [needsRedirection == true]",
  `${Object.keys(redirectedNow).length} results in ${(t5 - t4).toFixed(2)}ms`,
);
// 2000 + 1 = 2001 districts match
assert.equal(Object.keys(redirectedNow).length, 2001);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║ PASS: City Scale Benchmark                                   ║
║                                                              ║
║ N = ${String(N).padEnd(57, " ")}║
║ Mutation time: ${`${(t3 - t2).toFixed(3)}ms`.padEnd(46, " ")}║
║ explain().k = ${String(trace.meta?.k).padEnd(49, " ")}║
║ explain().dependsOn = ${JSON.stringify(trace.meta?.dependsOn).padEnd(37, " ")}║
║ Filter scan: ${`${(t5 - t4).toFixed(2)}ms for ${Object.keys(redirectedNow).length} results`.padEnd(45, " ")}║
║                                                              ║
║ Direct dependency metadata holds for the selected node.      ║
╚══════════════════════════════════════════════════════════════╝
`);
