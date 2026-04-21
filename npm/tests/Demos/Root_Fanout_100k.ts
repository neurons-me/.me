import ME from "this.me";
import assert from "node:assert/strict";

const me = new ME() as any;

const N = Number(process.env.FANOUT_N ?? "100000");
const TARGET = N;

console.log(`
╔══════════════════════════════════════════════════════════════╗
║      .me — Root Fan-Out: 1 write -> 100k dependents         ║
║                                                              ║
║      Proves O(k) when k itself is intentionally huge         ║
╚══════════════════════════════════════════════════════════════╝
`);

if (typeof me.setRecomputeMode === "function") {
  me.setRecomputeMode("eager");
}

const t0 = performance.now();

me.master.factor(1);
for (let i = 1; i <= N; i++) {
  me.dep[i].value(i);
  me.dep[i]["="]("out", "value * master.factor");

  if (i % 20_000 === 0) {
    console.log(` ${i / 1000}k dependents wired... ${(performance.now() - t0).toFixed(0)}ms`);
  }
}

const t1 = performance.now();
console.log(`\n Setup ${N} root subscribers: ${(t1 - t0).toFixed(2)}ms`);

assert.equal(me("dep[1].out"), 1);
assert.equal(me(`dep[${TARGET}].out`), TARGET);

const t2 = performance.now();
me.master.factor(2);
const t3 = performance.now();

const trace = me.explain(`dep[${TARGET}].out`);

assert.equal(me("master.factor"), 2);
assert.equal(me("dep[1].out"), 2);
assert.equal(me(`dep[${TARGET}].out`), TARGET * 2);
assert.equal(trace.expr, "value * master.factor");
assert.deepEqual(trace.meta?.dependsOn, [`dep.${TARGET}.value`, "master.factor"]);
assert.equal(trace.meta?.k, N);
assert.equal(trace.meta?.sourcePath, "master.factor");
assert.equal(trace.meta?.recomputed?.length, N);
assert.ok(trace.meta?.recomputed?.includes("dep.1.out"));
assert.ok(trace.meta?.recomputed?.includes(`dep.${TARGET}.out`));

const sample = {
  first: trace.meta?.recomputed?.[0],
  last: trace.meta?.recomputed?.[trace.meta.recomputed.length - 1],
  target: `dep.${TARGET}.out`,
};

console.log(`\n Mutate master.factor: ${(t3 - t2).toFixed(3)}ms`);
console.log(` explain().k: ${trace.meta?.k}`);
console.log(` explain().dependsOn: ${JSON.stringify(trace.meta?.dependsOn)}`);
console.log(` recomputed sample: ${JSON.stringify(sample)}`);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║ PASS: Root Fan-Out Benchmark                                 ║
║                                                              ║
║ N = ${String(N).padEnd(57, " ")}║
║ Source mutation: ${"master.factor".padEnd(44, " ")}║
║ Mutation time: ${`${(t3 - t2).toFixed(3)}ms`.padEnd(46, " ")}║
║ explain().k = ${String(trace.meta?.k).padEnd(49, " ")}║
║ Target leaf: ${`dep.${TARGET}.out`.padEnd(48, " ")}║
║                                                              ║
║ This is the opposite of City_Scale: N large, k also large.   ║
╚══════════════════════════════════════════════════════════════╝
`);
