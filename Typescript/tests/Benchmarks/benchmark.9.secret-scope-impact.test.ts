import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);
type KernelMode = "eager" | "lazy";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function setupPublic(nodeCount: number, mode: KernelMode): CallableMe {
  const me = new ME() as CallableMe;
  if (typeof (me as any).setRecomputeMode === "function") {
    (me as any).setRecomputeMode(mode);
  }
  me.factor(2);
  for (let i = 1; i <= nodeCount; i++) {
    me.pub[i].value(100 + (i % 11));
    me.pub[i]["="]("out", "value * factor");
  }
  me(`pub[${nodeCount}].out`);
  return me;
}

function setupSecret(nodeCount: number, mode: KernelMode): CallableMe {
  const me = new ME() as CallableMe;
  if (typeof (me as any).setRecomputeMode === "function") {
    (me as any).setRecomputeMode(mode);
  }
  me.secure["_"]("bench-secret-2026");
  me.secure.factor(2);
  for (let i = 1; i <= nodeCount; i++) {
    me.secure.data[i].value(100 + (i % 11));
    me.secure.data[i]["="]("out", "value * secure.factor");
  }
  me(`secure.data[${nodeCount}].out`);
  return me;
}

function measure(me: CallableMe, iterations: number, mutator: (i: number) => void, reader: () => unknown): number[] {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    mutator(i);
    reader();
    latencies.push(performance.now() - t0);
  }
  return latencies;
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK #9: SECRET-SCOPE PERFORMANCE IMPACT");
  console.log("========================================================\n");

  const nodeCount = Number(process.env.BENCH9_N ?? "600");
  const iterations = Number(process.env.BENCH9_ITERS ?? "120");
  const mode = (process.env.BENCH9_MODE as KernelMode | undefined) ?? "lazy";

  console.log(`mode=${mode} | nodeCount=${nodeCount} | iterations=${iterations}`);
  process.stderr.write("> setup public... ");

  const mePublic = setupPublic(nodeCount, mode);
  process.stderr.write("done.\n");
  process.stderr.write("> run public loop... ");
  const publicLatency = measure(
    mePublic,
    iterations,
    (i) => mePublic.factor((i % 7) + 1),
    () => mePublic(`pub[${nodeCount}].out`)
  );
  process.stderr.write("done.\n");

  process.stderr.write("> setup secret... ");
  const meSecret = setupSecret(nodeCount, mode);
  process.stderr.write("done.\n");
  process.stderr.write("> run secret loop... ");
  const secretLatency = measure(
    meSecret,
    iterations,
    (i) => meSecret.secure.factor((i % 7) + 1),
    () => meSecret(`secure.data[${nodeCount}].out`)
  );
  process.stderr.write("done.\n");

  const p95Public = percentile(publicLatency, 95);
  const p95Secret = percentile(secretLatency, 95);
  const slowdownPct = p95Public > 0 ? ((p95Secret - p95Public) / p95Public) * 100 : 0;

  console.table([
    {
      scope: "public",
      p50_ms: percentile(publicLatency, 50).toFixed(4),
      p95_ms: p95Public.toFixed(4),
      p99_ms: percentile(publicLatency, 99).toFixed(4),
    },
    {
      scope: "secret",
      p50_ms: percentile(secretLatency, 50).toFixed(4),
      p95_ms: p95Secret.toFixed(4),
      p99_ms: percentile(secretLatency, 99).toFixed(4),
    },
  ]);

  console.log(`secret-scope p95 slowdown: ${slowdownPct.toFixed(2)}%`);
}

start().catch(console.error);
