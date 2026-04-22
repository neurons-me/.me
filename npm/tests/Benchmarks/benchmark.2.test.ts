import Me from "this.me";
import assert from "node:assert/strict";

type CallableMe = InstanceType<typeof Me> & ((expr: string) => unknown);

async function runProfile(n: number) {
  const me = new Me() as CallableMe;

  for (let i = 1; i <= n; i++) {
    me.x[i].value(10);
    me.x[i].factor(5);
  }

  me.x["[i]"]["="]("y", "value * factor");
  me.x["[i]"]["="]("overThreshold", "y >= 100");

  assert.equal(me(`x[${n}].y`), 50);
  assert.equal(me(`x[${n}].overThreshold`), false);

  const start = performance.now();
  me.x[n].factor(10);
  const result = me(`x[${n}].y`);
  const overThreshold = me(`x[${n}].overThreshold`);
  const end = performance.now();

  const trace = me.explain(`x.${n}.overThreshold`);

  assert.equal(result, 100);
  assert.equal(overThreshold, true);
  assert.equal(trace.expr, "y >= 100");
  assert.equal(trace.meta?.sourcePath, `x.${n}.factor`);
  assert.equal(trace.meta?.k, 2);
  assert.deepEqual(trace.meta?.recomputed, [
    `x.${n}.y`,
    `x.${n}.overThreshold`,
  ]);

  return {
    n,
    time: (end - start).toFixed(4),
    k: trace.meta?.k ?? 0,
    result,
    overThreshold,
  };
}

async function start() {
  const sizes = [10, 100, 500, 1000, 2500, 5000, 7500, 10000];
  console.log("n,time_ms,wave_k,result,over_threshold");
  for (const n of sizes) {
    const r = await runProfile(n);
    console.log(`${r.n},${r.time},${r.k},${r.result},${r.overThreshold}`);
  }
}

start().catch(console.error);
