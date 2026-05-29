import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);
type KernelMode = "eager" | "lazy";
type Plane = "public" | "secret";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function setupPlane(nodeCount: number, plane: Plane, mode: KernelMode): CallableMe {
  const me = new ME() as CallableMe;
  if (typeof (me as any).setRecomputeMode === "function") (me as any).setRecomputeMode(mode);

  if (plane === "public") {
    me.factor(1);
    for (let i = 1; i <= nodeCount; i++) {
      me.pub[i].value(100 + (i % 17));
      me.pub[i]["="]("out", "value * factor");
    }
    me(`pub[${nodeCount}].out`);
    return me;
  }

  me.secure["_"]("bench-secret-2026");
  me.secure.factor(1);
  for (let i = 1; i <= nodeCount; i++) {
    me.secure.data[i].value(100 + (i % 17));
    me.secure.data[i]["="]("out", "value * secure.factor");
  }
  me(`secure.data[${nodeCount}].out`);
  return me;
}

function runDualPlane(nodeCount: number, iterations: number, plane: Plane, mode: KernelMode) {
  const me = setupPlane(nodeCount, plane, mode);
  const mutationOnly: number[] = [];
  const firstReadAfterMutation: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const next = (i % 97) + 2;

    const t0 = performance.now();
    if (plane === "public") me.factor(next);
    else me.secure.factor(next);
    mutationOnly.push(performance.now() - t0);

    const t1 = performance.now();
    if (plane === "public") me(`pub[${nodeCount}].out`);
    else me(`secure.data[${nodeCount}].out`);
    firstReadAfterMutation.push(performance.now() - t1);
  }

  return {
    plane,
    mode,
    nodeCount,
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
  console.log(".me BENCHMARK #11: SECRET PUSH VS PULL");
  console.log("========================================================\n");

  const mode = (process.env.BENCH11_MODE as KernelMode | undefined) ?? "lazy";
  const nodeCounts = String(process.env.BENCH11_N ?? "100,300,600")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const iterations = Number(process.env.BENCH11_ITERS ?? "120");

  console.log(`mode=${mode} | nodeCounts=${nodeCounts.join(",")} | iterations=${iterations}`);

  const rows: Array<Record<string, string | number>> = [];
  for (const n of nodeCounts) {
    for (const plane of ["public", "secret"] as const) {
      process.stderr.write(`> run plane=${plane} n=${n}... `);
      const r = runDualPlane(n, iterations, plane, mode);
      rows.push({
        mode: r.mode,
        plane: r.plane,
        nodes: r.nodeCount,
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

  const byNodes = new Map<number, { public?: any; secret?: any }>();
  for (const row of rows) {
    const n = Number(row.nodes);
    const hit = byNodes.get(n) || {};
    if (row.plane === "public") hit.public = row;
    if (row.plane === "secret") hit.secret = row;
    byNodes.set(n, hit);
  }

  const slowdownRows: Array<Record<string, string | number>> = [];
  for (const [n, pair] of byNodes) {
    if (!pair.public || !pair.secret) continue;
    const pubMutationP95 = Number(pair.public.mutation_p95_ms);
    const secMutationP95 = Number(pair.secret.mutation_p95_ms);
    const pubReadP95 = Number(pair.public.read_p95_ms);
    const secReadP95 = Number(pair.secret.read_p95_ms);

    slowdownRows.push({
      nodes: n,
      mutation_p95_slowdown_x: pubMutationP95 > 0 ? (secMutationP95 / pubMutationP95).toFixed(2) : "n/a",
      read_p95_slowdown_x: pubReadP95 > 0 ? (secReadP95 / pubReadP95).toFixed(2) : "n/a",
    });
  }

  console.log("\nSecret/Public p95 slowdown ratios:");
  console.table(slowdownRows);
}

start().catch(console.error);
