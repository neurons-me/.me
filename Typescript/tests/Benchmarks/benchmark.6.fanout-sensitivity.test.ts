import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function runFanout(fanout: number, iterations: number) {
  const me = new ME() as CallableMe;
  me.master(1);

  for (let i = 1; i <= fanout; i++) {
    me.dep[i].value(10 + (i % 5));
    me.dep[i]["="]("result", "value * master");
  }

  me(`dep[${fanout}].result`); // warmup

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    me.master((i % 11) + 1);
    me(`dep[${fanout}].result`);
    latencies.push(performance.now() - t0);
  }

  const trace = me.explain(`dep.${fanout}.result`);
  return {
    fanout,
    iterations,
    k: trace.meta.dependsOn.length,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: Math.max(...latencies),
  };
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #6: FAN-OUT SENSITIVITY CURVES");
  console.log("========================================================\n");

  const fanouts = [10, 100, 500, 1000, 2500, 5000];
  const rows = [];
  for (const fanout of fanouts) {
    process.stderr.write(`> Running fanout=${fanout}... `);
    const r = await runFanout(fanout, 120);
    rows.push({
      fanout: r.fanout,
      k: r.k,
      p50_ms: r.p50.toFixed(4),
      p95_ms: r.p95.toFixed(4),
      p99_ms: r.p99.toFixed(4),
      max_ms: r.max.toFixed(4),
    });
    process.stderr.write("done.\n");
  }

  console.table(rows);
}

start().catch(console.error);
