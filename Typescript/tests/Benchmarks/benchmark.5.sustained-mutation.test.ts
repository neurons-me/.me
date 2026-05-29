import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function runSustainedMutation(nodeCount: number, updates: number, windowSize: number) {
  const me = new ME() as CallableMe;

  for (let i = 1; i <= nodeCount; i++) me.items[i].value(10 + (i % 7));
  me.factor(1);
  me.items["[i]"]["="]("score", "value * factor");
  me("items[1].score"); // warmup

  const allLatencies: number[] = [];
  const windows: Array<{ start: number; end: number; p50: number; p95: number; p99: number }> = [];

  for (let i = 1; i <= updates; i++) {
    const t0 = performance.now();
    me.factor((i % 17) + 1);
    me(`items[${nodeCount}].score`);
    const dt = performance.now() - t0;
    allLatencies.push(dt);
  }

  for (let i = 0; i < allLatencies.length; i += windowSize) {
    const chunk = allLatencies.slice(i, i + windowSize);
    if (chunk.length === 0) continue;
    windows.push({
      start: i + 1,
      end: i + chunk.length,
      p50: percentile(chunk, 50),
      p95: percentile(chunk, 95),
      p99: percentile(chunk, 99),
    });
  }

  return {
    nodeCount,
    updates,
    overall: {
      p50: percentile(allLatencies, 50),
      p95: percentile(allLatencies, 95),
      p99: percentile(allLatencies, 99),
      max: Math.max(...allLatencies),
    },
    windows,
  };
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #5: THROUGHPUT UNDER SUSTAINED MUTATION");
  console.log("========================================================\n");

  const result = await runSustainedMutation(4000, 2000, 200);

  console.log("Summary:");
  console.table([result.overall]);
  console.log("Windowed p95 drift check:");
  console.table(
    result.windows.map((w) => ({
      window: `${w.start}-${w.end}`,
      p50_ms: w.p50.toFixed(4),
      p95_ms: w.p95.toFixed(4),
      p99_ms: w.p99.toFixed(4),
    }))
  );

  const first = result.windows[0]?.p95 ?? 0;
  const last = result.windows[result.windows.length - 1]?.p95 ?? 0;
  const drift = first > 0 ? (last - first) / first : 0;
  console.log(`p95 drift: ${(drift * 100).toFixed(2)}%`);
}

start().catch(console.error);
