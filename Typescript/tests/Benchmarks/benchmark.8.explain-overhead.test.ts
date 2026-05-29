import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function setup(nodeCount: number): CallableMe {
  const me = new ME() as CallableMe;
  for (let i = 1; i <= nodeCount; i++) {
    me.nodes[i].value(100 + (i % 13));
  }
  me.factor(2);
  me.nodes["[i]"]["="]("out", "value * factor");
  me(`nodes[${nodeCount}].out`);
  return me;
}

function runLoop(me: CallableMe, nodeCount: number, iterations: number, withExplain: boolean): number[] {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    me.factor((i % 9) + 1);
    me(`nodes[${nodeCount}].out`);
    if (withExplain) me.explain(`nodes.${nodeCount}.out`);
    latencies.push(performance.now() - t0);
  }
  return latencies;
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #8: EXPLAIN OVERHEAD BUDGET");
  console.log("========================================================\n");

  const nodeCount = 3000;
  const iterations = 300;

  const baseline = runLoop(setup(nodeCount), nodeCount, iterations, false);
  const withExplain = runLoop(setup(nodeCount), nodeCount, iterations, true);

  const b95 = percentile(baseline, 95);
  const e95 = percentile(withExplain, 95);
  const overheadPct = b95 > 0 ? ((e95 - b95) / b95) * 100 : 0;

  console.table([
    {
      mode: "baseline",
      p50_ms: percentile(baseline, 50).toFixed(4),
      p95_ms: b95.toFixed(4),
      p99_ms: percentile(baseline, 99).toFixed(4),
    },
    {
      mode: "with_explain",
      p50_ms: percentile(withExplain, 50).toFixed(4),
      p95_ms: e95.toFixed(4),
      p99_ms: percentile(withExplain, 99).toFixed(4),
    },
  ]);

  console.log(`p95 overhead: ${overheadPct.toFixed(2)}%`);
}

start().catch(console.error);
