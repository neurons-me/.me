import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);
type KernelMode = "eager" | "lazy";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function setupGraph(fanout: number, mode: KernelMode): CallableMe {
  const me = new ME() as CallableMe;
  if (typeof (me as any).setRecomputeMode === "function") {
    (me as any).setRecomputeMode(mode);
  }
  me.master(1);

  for (let i = 1; i <= fanout; i++) {
    me.dep[i].value(i);
    me.dep[i]["="]("result", "value * master");
  }

  // Build dependency map once before measurements.
  me(`dep[${fanout}].result`);
  return me;
}

function runDualAnalysis(fanout: number, iterations: number, mode: KernelMode) {
  const me = setupGraph(fanout, mode);
  const mutationOnly: number[] = [];
  const firstReadAfterMutation: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const nextMaster = (i % 97) + 2;

    // 1) Write-only isolation
    const t0 = performance.now();
    me.master(nextMaster);
    mutationOnly.push(performance.now() - t0);

    // 2) First-read-after-write isolation
    const t1 = performance.now();
    me(`dep[${fanout}].result`);
    firstReadAfterMutation.push(performance.now() - t1);
  }

  const trace = me.explain(`dep.${fanout}.result`);
  return {
    mode,
    fanout,
    k: trace.meta.dependsOn.length,
    mutation_p50: percentile(mutationOnly, 50),
    mutation_p95: percentile(mutationOnly, 95),
    mutation_p99: percentile(mutationOnly, 99),
    read_p50: percentile(firstReadAfterMutation, 50),
    read_p95: percentile(firstReadAfterMutation, 95),
    read_p99: percentile(firstReadAfterMutation, 99),
  };
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #10: PUSH (WRITE) VS PULL (FIRST READ)");
  console.log("========================================================\n");

  const fanouts = [10, 100, 500, 1000, 2500, 5000];
  const iterations = 150;
  const rows = [];
  const modes: KernelMode[] = ["eager", "lazy"];

  for (const mode of modes) {
    console.log(`\nMode: ${mode.toUpperCase()}`);
    for (const fanout of fanouts) {
      process.stderr.write(`> dual analysis mode=${mode} fanout=${fanout}... `);
      const r = runDualAnalysis(fanout, iterations, mode);
      rows.push({
        mode: r.mode,
        fanout: r.fanout,
        k: r.k,
        mutation_p50_ms: r.mutation_p50.toFixed(4),
        mutation_p95_ms: r.mutation_p95.toFixed(4),
        mutation_p99_ms: r.mutation_p99.toFixed(4),
        read_p50_ms: r.read_p50.toFixed(4),
        read_p95_ms: r.read_p95.toFixed(4),
        read_p99_ms: r.read_p99.toFixed(4),
      });
      process.stderr.write("done.\n");
    }
  }

  console.table(rows);
}

start().catch(console.error);
