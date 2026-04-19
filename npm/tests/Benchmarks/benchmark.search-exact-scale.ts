import fs from "node:fs";
import ME from "this.me";

const { DiskStore } = ME;

const MB = 1024 * 1024;
const SIZES = String(process.env.SIZES || "10000,50000,100000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0)
  .map((value) => Math.floor(value));
const BATCH = Number(process.env.BATCH_SIZE) || 256;
const DIMS = Number(process.env.DIMS) || 1536;
const QUERIES = Number(process.env.QUERIES) || 8;
const K = Number(process.env.K) || 10;
const MAX_HOT_BYTES = Number(process.env.MAX_HOT_BYTES) || 250_000_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    heapUsed: m.heapUsed,
    rss: m.rss,
  };
}

function makeClusterCenter(cluster: number): Float32Array {
  const out = new Float32Array(DIMS);
  const base = cluster % 16;
  for (let i = 0; i < DIMS; i++) {
    out[i] = i % 16 === base ? 1 : 0.05;
  }
  return out;
}

function makeVector(index: number): Float32Array {
  const cluster = Math.floor(index / 64);
  const center = makeClusterCenter(cluster);
  const out = new Float32Array(DIMS);
  for (let i = 0; i < DIMS; i++) {
    const noise = (((index + 1) * 17 + i * 13) % 1000) / 1000;
    out[i] = center[i] + noise * 0.01;
  }
  return out;
}

function buildItems(start: number, size: number) {
  const now = Date.now();
  return Array.from({ length: size }, (_, offset) => {
    const index = start + offset;
    return {
      id: index,
      embedding: makeVector(index),
      timestamp: now - index * 1000,
      text: `record-${index}`,
      kind: "embedding-record",
      cluster: Math.floor(index / 64),
    };
  });
}

function resolveBatchWriter(me: any) {
  const candidates = [
    typeof me?._commitIndexedBatch === "function"
      ? (startIndex: number, items: any[]) => me._commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?.commitIndexedBatch === "function"
      ? (startIndex: number, items: any[]) => me.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
  ].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error("commitIndexedBatch is not reachable for benchmark.search-exact-scale.ts");
  }

  return candidates[0] as (startIndex: number, items: any[]) => void;
}

function makeQueryIndexes(total: number, queries: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= queries; i++) {
    out.push(i * Math.floor(total / (queries + 1)));
  }
  return out.filter((index, pos, arr) => index >= 0 && index < total && arr.indexOf(index) === pos);
}

async function runScalePoint(total: number) {
  const tmp = `/tmp/me-phase3-search-scale-${total}`;
  fs.rmSync(tmp, { recursive: true, force: true });

  const me: any = new ME(`search-scale-${total}`, {
    store: new DiskStore({ baseDir: tmp, maxHotBytes: MAX_HOT_BYTES }),
  });

  me.memory.episodic["_"](`search-scale-secret-${total}`);
  me._enablePersistSecretBranchDebug?.(true);

  const writer = resolveBatchWriter(me);
  const ingestStartedAt = performance.now();
  for (let start = 0; start < total; start += BATCH) {
    const size = Math.min(BATCH, total - start);
    writer(start, buildItems(start, size));
  }
  const ingestMs = performance.now() - ingestStartedAt;
  const persist = me._takePersistSecretBranchDebugWindow?.() ?? {};
  assert((persist.columnarWrites ?? 0) > 0, `expected columnar writes for N=${total}`);

  global.gc?.();
  const postIngestMem = memorySnapshot();

  const coldIndex = Math.min(total - 1, 0);
  const coldQuery = makeVector(coldIndex);
  const coldStartedAt = performance.now();
  const coldResult = me.searchExact("memory.episodic", coldQuery, { k: K });
  const coldMs = performance.now() - coldStartedAt;
  assert(coldResult.hits.length === K, `expected ${K} cold hits for N=${total}`);
  assert(
    coldResult.hits.some((hit: { index: number }) => hit.index === coldIndex),
    `expected cold top-${K} to contain ${coldIndex}, got ${coldResult.hits.map((hit: { index: number }) => hit.index).join(",")}`,
  );

  const warmLatencies: number[] = [];
  for (const queryIndex of makeQueryIndexes(total, QUERIES)) {
    const query = makeVector(queryIndex);
    const startedAt = performance.now();
    const result = me.searchExact("memory.episodic", query, { k: K });
    warmLatencies.push(performance.now() - startedAt);
    assert(result.hits.length === K, `expected ${K} warm hits for N=${total}`);
    assert(
      result.hits.some((hit: { index: number }) => hit.index === queryIndex),
      `expected warm top-${K} to contain ${queryIndex}, got ${result.hits.map((hit: { index: number }) => hit.index).join(",")} for N=${total}`,
    );
  }

  const warmSingle = me.searchExact("memory.episodic", makeVector(0), { k: K });

  global.gc?.();
  const postSearchMem = memorySnapshot();

  return {
    total,
    ingestMs,
    ingestVps: total / Math.max(ingestMs / 1000, 0.001),
    columnarWrites: persist.columnarWrites ?? 0,
    scannedChunks: warmSingle.scannedChunks,
    scannedVectors: warmSingle.scannedVectors,
    coldMs,
    warmSingleMs: warmSingle.tookMs,
    warmP50: percentile(warmLatencies, 50),
    warmP95: percentile(warmLatencies, 95),
    postIngestHeap: postIngestMem.heapUsed,
    postSearchHeap: postSearchMem.heapUsed,
    postSearchRss: postSearchMem.rss,
  };
}

async function main() {
  console.log("============================================================");
  console.log(".me PHASE 3.0 — SEARCH EXACT SCALING");
  console.log("============================================================");
  console.log(`Sizes: ${SIZES.map((value) => value.toLocaleString()).join(", ")}`);
  console.log(`Batch: ${BATCH} | Dims: ${DIMS} | Queries: ${QUERIES} | K: ${K}`);
  console.log("Secret scope: memory.episodic");

  const rows = [];
  for (const total of SIZES) {
    const result = await runScalePoint(total);
    rows.push({
      vectors: result.total,
      ingest_vps: result.ingestVps.toFixed(0),
      chunks: result.scannedChunks,
      cold_ms: result.coldMs.toFixed(2),
      warm_p50_ms: result.warmP50.toFixed(2),
      warm_p95_ms: result.warmP95.toFixed(2),
      heap_post_ingest_mb: (result.postIngestHeap / MB).toFixed(1),
      heap_post_search_mb: (result.postSearchHeap / MB).toFixed(1),
    });

    console.log(`\n[N=${result.total.toLocaleString()}]`);
    console.log(`Columnar writes: ${result.columnarWrites}`);
    console.log(`scannedChunks: ${result.scannedChunks} | scannedVectors: ${result.scannedVectors}`);
    console.log(`Ingest: ${(result.ingestMs / 1000).toFixed(2)}s | ${result.ingestVps.toFixed(0)} vps`);
    console.log(`Cold: ${result.coldMs.toFixed(2)}ms`);
    console.log(`Warm: p50=${result.warmP50.toFixed(2)}ms | p95=${result.warmP95.toFixed(2)}ms | single=${result.warmSingleMs.toFixed(2)}ms`);
    console.log(`Heap post-ingest: ${formatMb(result.postIngestHeap)}`);
    console.log(`Heap post-search: ${formatMb(result.postSearchHeap)} | RSS: ${formatMb(result.postSearchRss)}`);
  }

  console.log("\n--- Comparison Table ---");
  console.table(rows);
  console.log("PASS: exact search scaling baseline recorded.\n");
}

main().catch((error) => {
  console.error("\nFAIL: benchmark.search-exact-scale.ts");
  console.error(error);
  process.exitCode = 1;
});
