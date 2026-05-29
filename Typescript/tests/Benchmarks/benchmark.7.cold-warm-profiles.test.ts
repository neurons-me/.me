import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function runProfiles(nodeCount: number, steadyIterations: number) {
  const me = new ME() as CallableMe;
  for (let i = 1; i <= nodeCount; i++) {
    me.data[i].base(100 + (i % 9));
  }
  me.rate(0.16);
  me.data["[i]"]["="]("total", "base + (base * rate)");

  const coldStart0 = performance.now();
  me(`data[${nodeCount}].total`);
  const coldFirstReadMs = performance.now() - coldStart0;

  const warmMutation0 = performance.now();
  me.rate(0.2);
  me(`data[${nodeCount}].total`);
  const warmMutationReadMs = performance.now() - warmMutation0;

  const steadyLatencies: number[] = [];
  for (let i = 0; i < steadyIterations; i++) {
    const t0 = performance.now();
    me.rate(0.16 + ((i % 5) * 0.01));
    me(`data[${nodeCount}].total`);
    steadyLatencies.push(performance.now() - t0);
  }

  return {
    nodeCount,
    coldFirstReadMs,
    warmMutationReadMs,
    steadyAvgMs: avg(steadyLatencies),
    steadyMinMs: Math.min(...steadyLatencies),
    steadyMaxMs: Math.max(...steadyLatencies),
  };
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #7: COLD VS WARM RUNTIME PROFILES");
  console.log("========================================================\n");

  const rows = [];
  for (const n of [100, 1000, 5000]) {
    const r = await runProfiles(n, 80);
    rows.push({
      nodes: r.nodeCount,
      cold_ms: r.coldFirstReadMs.toFixed(4),
      warm_ms: r.warmMutationReadMs.toFixed(4),
      steady_avg_ms: r.steadyAvgMs.toFixed(4),
      steady_min_ms: r.steadyMinMs.toFixed(4),
      steady_max_ms: r.steadyMaxMs.toFixed(4),
    });
  }

  console.table(rows);
}

start().catch(console.error);
