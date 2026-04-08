import ME from "this.me";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);
type PerfStat = { calls: number; totalMs: number; samples: number[] };
type PerfCollector = {
  enabled: boolean;
  stats: Record<string, PerfStat>;
  counters: Record<string, number>;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createPerfCollector(): PerfCollector {
  return {
    enabled: true,
    stats: {},
    counters: {},
  };
}

function runWithPerf<T>(fn: () => T): { result: T; perf: PerfCollector } {
  const perf = createPerfCollector();
  (globalThis as any).__ME_PERF__ = perf;
  try {
    return { result: fn(), perf };
  } finally {
    perf.enabled = false;
    delete (globalThis as any).__ME_PERF__;
  }
}

function setupBranchSecret(nodeCount: number): CallableMe {
  const me = new ME() as CallableMe;
  me.secure["_"]("bench-secret-2026");
  for (let i = 1; i <= nodeCount; i++) {
    me.secure.data[i].value(100 + (i % 17));
  }
  return me;
}

function setupValueSecret(nodeCount: number): CallableMe {
  const me = new ME() as CallableMe;
  me["_"]("root-secret-bench-2026");
  for (let i = 1; i <= nodeCount; i++) {
    me.private[i].value(100 + (i % 17));
  }
  return me;
}

function setupPublic(nodeCount: number): CallableMe {
  const me = new ME() as CallableMe;
  for (let i = 1; i <= nodeCount; i++) {
    me.publicData[i].value(100 + (i % 17));
  }
  return me;
}

function measureReadLoop(iterations: number, reader: (i: number) => unknown): number[] {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    reader(i);
    latencies.push(performance.now() - t0);
  }
  return latencies;
}

function summarizeLatencies(scenario: string, latencies: number[]) {
  return {
    scenario,
    calls: latencies.length,
    avg_ms: average(latencies).toFixed(4),
    p50_ms: percentile(latencies, 50).toFixed(4),
    p95_ms: percentile(latencies, 95).toFixed(4),
    p99_ms: percentile(latencies, 99).toFixed(4),
  };
}

function summarizePerfStats(perf: PerfCollector) {
  return Object.entries(perf.stats)
    .map(([metric, stat]) => ({
      metric,
      calls: stat.calls,
      avg_ms: (stat.calls > 0 ? stat.totalMs / stat.calls : 0).toFixed(4),
      p95_ms: percentile(stat.samples, 95).toFixed(4),
      total_ms: stat.totalMs.toFixed(4),
    }))
    .sort((a, b) => Number(b.total_ms) - Number(a.total_ms));
}

function summarizeCache(perf: PerfCollector) {
  const hits = Number(perf.counters["secret-storage.getDecryptedChunk.cache.hit"] || 0);
  const misses = Number(perf.counters["secret-storage.getDecryptedChunk.cache.miss"] || 0);
  const total = hits + misses;
  return [{
    hits,
    misses,
    hit_ratio_pct: total > 0 ? ((hits / total) * 100).toFixed(2) : "n/a",
  }];
}

function principalHotspot(perf: PerfCollector): string {
  const top = summarizePerfStats(perf)[0];
  return top ? `${top.metric} (${top.total_ms}ms total)` : "n/a";
}

function printScenario(name: string, latencies: number[], perf: PerfCollector): void {
  console.log(`\n--- ${name} ---`);
  console.table([summarizeLatencies(name, latencies)]);
  console.table(summarizePerfStats(perf));
  console.table(summarizeCache(perf));
  console.log(`hotspot principal: ${principalHotspot(perf)}`);
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #12: SECRET READ HOTSPOTS");
  console.log("========================================================\n");

  const nodeCount = Number(process.env.BENCH12_N ?? "300");
  const iterations = Number(process.env.BENCH12_ITERS ?? "240");

  console.log(`nodeCount=${nodeCount} | iterations=${iterations}`);

  const branchHot = setupBranchSecret(nodeCount);
  branchHot(`secure.data[${nodeCount}].value`);
  {
    const { result: latencies, perf } = runWithPerf(() =>
      measureReadLoop(iterations, () => branchHot(`secure.data[${nodeCount}].value`))
    );
    printScenario("branch-hot-read", latencies, perf);
  }

  const valueHot = setupValueSecret(nodeCount);
  valueHot(`private[${nodeCount}].value`);
  {
    const { result: latencies, perf } = runWithPerf(() =>
      measureReadLoop(iterations, () => valueHot(`private[${nodeCount}].value`))
    );
    printScenario("value-hot-read", latencies, perf);
  }

  const branchWide = setupBranchSecret(nodeCount);
  branchWide("secure.data[1].value");
  {
    const { result: latencies, perf } = runWithPerf(() =>
      measureReadLoop(iterations, (i) => branchWide(`secure.data[${(i % nodeCount) + 1}].value`))
    );
    printScenario("branch-wide-read", latencies, perf);
  }

  const publicMixed = setupPublic(nodeCount);
  const secretMixed = setupBranchSecret(nodeCount);
  publicMixed(`publicData[${nodeCount}].value`);
  secretMixed(`secure.data[${nodeCount}].value`);

  const publicLatencies = measureReadLoop(iterations, (i) => publicMixed(`publicData[${(i % nodeCount) + 1}].value`));
  const { result: secretLatencies, perf: secretMixedPerf } = runWithPerf(() =>
    measureReadLoop(iterations, (i) => secretMixed(`secure.data[${(i % nodeCount) + 1}].value`))
  );

  console.log("\n--- mixed-public-vs-secret ---");
  console.table([
    summarizeLatencies("mixed-public", publicLatencies),
    summarizeLatencies("mixed-secret", secretLatencies),
  ]);
  console.table(summarizePerfStats(secretMixedPerf));
  console.table(summarizeCache(secretMixedPerf));
  console.log(
    `read p95 slowdown x: ${
      percentile(publicLatencies, 95) > 0
        ? (percentile(secretLatencies, 95) / percentile(publicLatencies, 95)).toFixed(2)
        : "n/a"
    }`,
  );
  console.log(`hotspot principal: ${principalHotspot(secretMixedPerf)}`);
}

start().catch(console.error);
