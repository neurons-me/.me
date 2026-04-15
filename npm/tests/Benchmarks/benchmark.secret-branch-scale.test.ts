import ME from "this.me";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);
type Plane = "public" | "secret";
type Scenario =
  | "full_branch_read"
  | "cold_vs_warm"
  | "leaf_vs_branch"
  | "snapshot_rehydrate";

type DatasetSpec = {
  count: number;
  embeddingDim: number;
  charsPerRecord: number;
  estimatedPayloadBytes: number;
  payloadBytes: number;
  records: string[];
};

type PlaneRuntime = {
  me: CallableMe;
  branchPath: string;
  leafPath: string;
};

type BenchRow = Record<string, string | number>;

const RUNS = envNumber("BENCH_SECRET_SCALE_RUNS", 11);
const EMBEDDING_CHAR_DIVISOR = Math.max(1, envNumber("BENCH_SECRET_SCALE_EMBED_DIV", 4));
const EMBEDDING_POOL_SIZE = Math.max(1, envNumber("BENCH_SECRET_SCALE_POOL", 1024));
const MAX_ESTIMATED_PAYLOAD_MB = envNumber("BENCH_SECRET_SCALE_MAX_MB", 0);
const N_VALUES = envCsvNumbers("BENCH_SECRET_SCALE_N", [1000, 10000, 100000, 250000]);
const EMBEDDING_DIMS = envCsvNumbers("BENCH_SECRET_SCALE_EMBED", [256, 1536]);
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function envCsvNumbers(name: string, fallback: number[]): number[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values : fallback;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toMb(bytes: number): number {
  return bytes / (1024 * 1024);
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function hr(label: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(label);
  console.log("=".repeat(60));
}

function runGc(): void {
  const maybeGc = (globalThis as any).gc;
  if (typeof maybeGc === "function") maybeGc();
}

function makeEmbeddingString(length: number, seed: number): string {
  const prefix = seed.toString(36).padStart(4, "0") + ":";
  if (length <= prefix.length) return prefix.slice(0, length);

  let out = prefix;
  while (out.length < length) {
    const idx = (seed + out.length) % ALPHABET.length;
    out += ALPHABET[idx];
  }
  return out.slice(0, length);
}

function estimatePayloadBytes(count: number, charsPerRecord: number): number {
  if (count <= 0) return 2;
  return 2 + count * (charsPerRecord + 3) - 1;
}

function buildDataset(count: number, embeddingDim: number): DatasetSpec {
  const charsPerRecord = Math.max(16, Math.ceil(embeddingDim / EMBEDDING_CHAR_DIVISOR));
  const estimatedPayloadBytes = estimatePayloadBytes(count, charsPerRecord);
  const poolSize = Math.min(count, EMBEDDING_POOL_SIZE);
  const pool = Array.from({ length: poolSize }, (_, i) => makeEmbeddingString(charsPerRecord, i));
  const records = Array.from({ length: count }, (_, i) => pool[i % pool.length]);
  const payloadBytes = Buffer.byteLength(JSON.stringify(records), "utf8");

  return {
    count,
    embeddingDim,
    charsPerRecord,
    estimatedPayloadBytes,
    payloadBytes,
    records,
  };
}

function shouldSkip(spec: DatasetSpec): string | null {
  if (MAX_ESTIMATED_PAYLOAD_MB <= 0) return null;
  const estimatedMb = toMb(spec.estimatedPayloadBytes);
  if (estimatedMb <= MAX_ESTIMATED_PAYLOAD_MB) return null;
  return `estimated payload ${estimatedMb.toFixed(2)}MB exceeds BENCH_SECRET_SCALE_MAX_MB=${MAX_ESTIMATED_PAYLOAD_MB}`;
}

function makeSkipRow(scenario: Scenario, plane: Plane, spec: DatasetSpec, reason: string): BenchRow {
  return {
    scenario,
    plane,
    n: spec.count,
    embedding_dim: spec.embeddingDim,
    payload_mb: round(toMb(spec.estimatedPayloadBytes), 2),
    chars_per_record: spec.charsPerRecord,
    skipped: reason,
  };
}

function setupPlane(spec: DatasetSpec, plane: Plane): PlaneRuntime {
  const me = new ME() as CallableMe;

  if (plane === "public") {
    me.archive.public.records(spec.records);
    return {
      me,
      branchPath: "archive.public.records",
      leafPath: `archive.public.records[${Math.floor(spec.count / 2)}]`,
    };
  }

  me.archive.secret["_"]("secret-branch-scale-2026");
  me.archive.secret.records(spec.records);
  return {
    me,
    branchPath: "archive.secret.records",
    leafPath: `archive.secret.records[${Math.floor(spec.count / 2)}]`,
  };
}

function setupIndexedLeafPlane(spec: DatasetSpec, plane: Plane): PlaneRuntime {
  const me = new ME() as CallableMe;
  const leafIndex = Math.floor(spec.count / 2);

  if (plane === "public") {
    for (let i = 0; i < spec.count; i++) {
      me.archive.public.records_indexed[i](spec.records[i]);
    }
    return {
      me,
      branchPath: "archive.public.records_indexed",
      leafPath: `archive.public.records_indexed[${leafIndex}]`,
    };
  }

  me.archive.secret["_"]("secret-branch-scale-2026");
  for (let i = 0; i < spec.count; i++) {
    me.archive.secret.records_indexed[i](spec.records[i]);
  }
  return {
    me,
    branchPath: "archive.secret.records_indexed",
    leafPath: `archive.secret.records_indexed[${leafIndex}]`,
  };
}

function expectBranch(value: unknown, count: number): void {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`Expected branch read to return array(${count}), got ${Array.isArray(value) ? value.length : typeof value}`);
  }
}

function expectLeaf(value: unknown, charsPerRecord: number): void {
  if (typeof value !== "string" || value.length !== charsPerRecord) {
    throw new Error(`Expected leaf read to return string(${charsPerRecord}), got ${typeof value}:${String(value).length}`);
  }
}

function sampleLatency(iterations: number, reader: () => unknown, verify: (value: unknown) => void): number[] {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const value = reader();
    const t1 = performance.now();
    if (i === 0) verify(value);
    latencies.push(t1 - t0);
  }
  return latencies;
}

function measureMemoryDelta(reader: () => unknown, verify: (value: unknown) => void): { rssMb: number; heapMb: number } {
  runGc();
  const before = process.memoryUsage();
  const value = reader();
  verify(value);
  const after = process.memoryUsage();
  return {
    rssMb: round(toMb(after.rss - before.rss), 2),
    heapMb: round(toMb(after.heapUsed - before.heapUsed), 2),
  };
}

function summarizeLatencies(latencies: number[]): { medianMs: number; p95Ms: number; p99Ms: number } {
  return {
    medianMs: round(median(latencies)),
    p95Ms: round(percentile(latencies, 95)),
    p99Ms: round(percentile(latencies, 99)),
  };
}

async function measureFullBranchRead(count: number, embeddingDim: number): Promise<BenchRow[]> {
  const spec = buildDataset(count, embeddingDim);
  const skipReason = shouldSkip(spec);
  if (skipReason) {
    return [
      makeSkipRow("full_branch_read", "public", spec, skipReason),
      makeSkipRow("full_branch_read", "secret", spec, skipReason),
    ];
  }

  const rows: BenchRow[] = [];
  for (const plane of ["public", "secret"] as const) {
    process.stderr.write(`> full_branch_read plane=${plane} n=${count} embed=${embeddingDim}... `);
    const runtime = setupPlane(spec, plane);
    expectBranch(runtime.me(runtime.branchPath), spec.count);
    const latencies = sampleLatency(RUNS, () => runtime.me(runtime.branchPath), (value) => expectBranch(value, spec.count));
    const mem = measureMemoryDelta(() => runtime.me(runtime.branchPath), (value) => expectBranch(value, spec.count));
    const summary = summarizeLatencies(latencies);

    rows.push({
      scenario: "full_branch_read",
      plane,
      n: spec.count,
      embedding_dim: spec.embeddingDim,
      payload_mb: round(toMb(spec.payloadBytes), 2),
      chars_per_record: spec.charsPerRecord,
      runs: RUNS,
      median_ms: summary.medianMs,
      p95_ms: summary.p95Ms,
      p99_ms: summary.p99Ms,
      rss_delta_mb: mem.rssMb,
      heap_delta_mb: mem.heapMb,
      note: "warm steady-state branch read",
    });
    process.stderr.write("done.\n");
  }

  return rows;
}

async function measureColdWarmReads(count: number, embeddingDim: number): Promise<BenchRow[]> {
  const spec = buildDataset(count, embeddingDim);
  const skipReason = shouldSkip(spec);
  if (skipReason) {
    return [
      makeSkipRow("cold_vs_warm", "public", spec, skipReason),
      makeSkipRow("cold_vs_warm", "secret", spec, skipReason),
    ];
  }

  const rows: BenchRow[] = [];
  for (const plane of ["public", "secret"] as const) {
    process.stderr.write(`> cold_vs_warm plane=${plane} n=${count} embed=${embeddingDim}... `);
    const runtime = setupPlane(spec, plane);

    runGc();
    const t0 = performance.now();
    const coldValue = runtime.me(runtime.branchPath);
    const coldMs = performance.now() - t0;
    expectBranch(coldValue, spec.count);

    const t1 = performance.now();
    const warmValue = runtime.me(runtime.branchPath);
    const warmMs = performance.now() - t1;
    expectBranch(warmValue, spec.count);

    const mem = measureMemoryDelta(() => runtime.me(runtime.branchPath), (value) => expectBranch(value, spec.count));
    rows.push({
      scenario: "cold_vs_warm",
      plane,
      n: spec.count,
      embedding_dim: spec.embeddingDim,
      payload_mb: round(toMb(spec.payloadBytes), 2),
      chars_per_record: spec.charsPerRecord,
      cold_ms: round(coldMs),
      warm_ms: round(warmMs),
      warm_speedup_x: warmMs > 0 ? round(coldMs / warmMs, 2) : "inf",
      rss_delta_mb: mem.rssMb,
      heap_delta_mb: mem.heapMb,
      note: "first branch read vs immediate cache-hit read",
    });
    process.stderr.write("done.\n");
  }

  return rows;
}

async function measureLeafBranchRead(count: number, embeddingDim: number): Promise<BenchRow[]> {
  const spec = buildDataset(count, embeddingDim);
  const skipReason = shouldSkip(spec);
  if (skipReason) {
    return [
      makeSkipRow("leaf_vs_branch", "public", spec, skipReason),
      makeSkipRow("leaf_vs_branch", "secret", spec, skipReason),
    ];
  }

  const rows: BenchRow[] = [];
  for (const plane of ["public", "secret"] as const) {
    process.stderr.write(`> leaf_vs_branch plane=${plane} n=${count} embed=${embeddingDim}... `);

    const leafRuntime = setupIndexedLeafPlane(spec, plane);
    expectLeaf(leafRuntime.me(leafRuntime.leafPath), spec.charsPerRecord);
    const leafLatencies = sampleLatency(
      RUNS,
      () => leafRuntime.me(leafRuntime.leafPath),
      (value) => expectLeaf(value, spec.charsPerRecord),
    );
    const leafSummary = summarizeLatencies(leafLatencies);

    const branchRuntime = setupPlane(spec, plane);
    expectBranch(branchRuntime.me(branchRuntime.branchPath), spec.count);
    const branchLatencies = sampleLatency(
      RUNS,
      () => branchRuntime.me(branchRuntime.branchPath),
      (value) => expectBranch(value, spec.count),
    );
    const branchSummary = summarizeLatencies(branchLatencies);

    rows.push({
      scenario: "leaf_vs_branch",
      plane,
      n: spec.count,
      embedding_dim: spec.embeddingDim,
      payload_mb: round(toMb(spec.payloadBytes), 2),
      chars_per_record: spec.charsPerRecord,
      leaf_median_ms: leafSummary.medianMs,
      leaf_p95_ms: leafSummary.p95Ms,
      branch_median_ms: branchSummary.medianMs,
      branch_p95_ms: branchSummary.p95Ms,
      branch_over_leaf_x: leafSummary.medianMs > 0 ? round(branchSummary.medianMs / leafSummary.medianMs, 2) : "inf",
      note: "leaf runtime uses indexed writes; branch runtime uses monolithic payload",
    });
    process.stderr.write("done.\n");
  }

  return rows;
}

async function measureSnapshotRehydrate(count: number, embeddingDim: number): Promise<BenchRow[]> {
  const spec = buildDataset(count, embeddingDim);
  const skipReason = shouldSkip(spec);
  if (skipReason) {
    return [
      makeSkipRow("snapshot_rehydrate", "public", spec, skipReason),
      makeSkipRow("snapshot_rehydrate", "secret", spec, skipReason),
    ];
  }

  const rows: BenchRow[] = [];
  for (const plane of ["public", "secret"] as const) {
    process.stderr.write(`> snapshot_rehydrate plane=${plane} n=${count} embed=${embeddingDim}... `);
    const runtime = setupPlane(spec, plane);

    const exportStart = performance.now();
    const snapshot = runtime.me.exportSnapshot();
    const exportMs = performance.now() - exportStart;
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");

    const restored = new ME() as CallableMe;
    const rehydrateStart = performance.now();
    restored.rehydrate(snapshot);
    const rehydrateMs = performance.now() - rehydrateStart;

    const firstReadStart = performance.now();
    const firstReadValue = restored(runtime.branchPath);
    const firstReadMs = performance.now() - firstReadStart;
    expectBranch(firstReadValue, spec.count);

    const mem = measureMemoryDelta(() => restored(runtime.branchPath), (value) => expectBranch(value, spec.count));
    rows.push({
      scenario: "snapshot_rehydrate",
      plane,
      n: spec.count,
      embedding_dim: spec.embeddingDim,
      payload_mb: round(toMb(spec.payloadBytes), 2),
      snapshot_mb: round(toMb(snapshotBytes), 2),
      chars_per_record: spec.charsPerRecord,
      export_ms: round(exportMs),
      rehydrate_ms: round(rehydrateMs),
      first_read_ms: round(firstReadMs),
      rss_delta_mb: mem.rssMb,
      heap_delta_mb: mem.heapMb,
      note: "export snapshot, rehydrate fresh runtime, then first branch read",
    });
    process.stderr.write("done.\n");
  }

  return rows;
}

async function benchmark(): Promise<void> {
  hr(".me BENCHMARK: SECRET BRANCH SCALE");
  console.log(`runs=${RUNS}`);
  console.log(`n=${N_VALUES.join(", ")}`);
  console.log(`embedding_dims=${EMBEDDING_DIMS.join(", ")}`);
  console.log(`embedding_char_divisor=${EMBEDDING_CHAR_DIVISOR} (synthetic packed payload proxy)`);
  console.log(`max_estimated_payload_mb=${MAX_ESTIMATED_PAYLOAD_MB > 0 ? MAX_ESTIMATED_PAYLOAD_MB : "disabled"}`);
  console.log("Tip: run with `node --expose-gc` for cleaner rss_delta_mb numbers.\n");

  const results: BenchRow[] = [];

  for (const count of N_VALUES) {
    for (const embeddingDim of EMBEDDING_DIMS) {
      results.push(...await measureFullBranchRead(count, embeddingDim));
      results.push(...await measureColdWarmReads(count, embeddingDim));
      results.push(...await measureLeafBranchRead(count, embeddingDim));
      results.push(...await measureSnapshotRehydrate(count, embeddingDim));
    }
  }

  console.table(results);
}

benchmark().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
