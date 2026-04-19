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
const QUERIES = Number(process.env.QUERIES) || 3;
const K = Number(process.env.K) || 10;
const NPROBE = Number(process.env.NPROBE) || 3;
const MAX_TRAINING_VECTORS = Number(process.env.MAX_TRAINING_VECTORS) || 4096;
const CHUNK_REPRESENTATIVES = Number(process.env.CHUNK_REPRESENTATIVES) || 4;
const MAX_HOT_BYTES = Number(process.env.MAX_HOT_BYTES) || 250_000_000;
const DATASET_MODE = String(process.env.DATASET_MODE || "chunk_coherent").trim().toLowerCase();
const CHUNK_SIGMA = Number(process.env.CHUNK_SIGMA) || 0.05;
const LEGACY_CLUSTER_SPAN = Number(process.env.LEGACY_CLUSTER_SPAN) || 64;
const LEGACY_CLUSTER_FAMILIES = Number(process.env.LEGACY_CLUSTER_FAMILIES) || 16;

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

function hash32(value: number): number {
  let h = value | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

function hashUnit(seed: number): number {
  return hash32(seed) / 0x1_0000_0000;
}

function gaussianish(seed: number): number {
  const u1 = hashUnit(seed);
  const u2 = hashUnit(seed ^ 0x9e3779b9);
  const u3 = hashUnit(seed ^ 0x85ebca6b);
  return ((u1 + u2 + u3) - 1.5) * 2;
}

function normalizeInPlace(vector: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  if (norm <= 0) return vector;
  const inv = 1 / Math.sqrt(norm);
  for (let i = 0; i < vector.length; i++) vector[i] *= inv;
  return vector;
}

function makeLegacyClusterCenter(cluster: number): Float32Array {
  const out = new Float32Array(DIMS);
  const base = cluster % LEGACY_CLUSTER_FAMILIES;
  for (let i = 0; i < DIMS; i++) {
    out[i] = i % LEGACY_CLUSTER_FAMILIES === base ? 1 : 0.05;
  }
  return out;
}

const chunkCenterCache = new Map<number, Float32Array>();

function makeChunkCenter(chunkId: number): Float32Array {
  const cached = chunkCenterCache.get(chunkId);
  if (cached) return cached;
  const center = new Float32Array(DIMS);
  for (let i = 0; i < DIMS; i++) {
    center[i] = gaussianish((chunkId + 1) * 0x9e3779b9 ^ (i + 1) * 0x85ebca6b);
  }
  normalizeInPlace(center);
  chunkCenterCache.set(chunkId, center);
  return center;
}

function makeLegacyVector(index: number): Float32Array {
  const cluster = Math.floor(index / LEGACY_CLUSTER_SPAN);
  const center = makeLegacyClusterCenter(cluster);
  const out = new Float32Array(DIMS);
  for (let i = 0; i < DIMS; i++) {
    const noise = (((index + 1) * 17 + i * 13) % 1000) / 1000;
    out[i] = center[i] + noise * 0.01;
  }
  return out;
}

function makeChunkCoherentVector(index: number): Float32Array {
  const chunkId = Math.floor(index / BATCH);
  const center = makeChunkCenter(chunkId);
  const out = new Float32Array(DIMS);
  for (let i = 0; i < DIMS; i++) {
    const noise = gaussianish((index + 1) * 0x27d4eb2d ^ (i + 1) * 0x165667b1);
    out[i] = center[i] + noise * CHUNK_SIGMA;
  }
  return normalizeInPlace(out);
}

function makeVector(index: number): Float32Array {
  if (DATASET_MODE === "legacy_fragmented") return makeLegacyVector(index);
  return makeChunkCoherentVector(index);
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
      cluster: DATASET_MODE === "legacy_fragmented"
        ? Math.floor(index / LEGACY_CLUSTER_SPAN)
        : Math.floor(index / BATCH),
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
    throw new Error("commitIndexedBatch is not reachable for benchmark.ivf-vs-exact.ts");
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
  const tmp = `/tmp/me-phase3-ivf-vs-exact-${total}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  chunkCenterCache.clear();

  const me: any = new ME(`ivf-vs-exact-${total}`, {
    store: new DiskStore({ baseDir: tmp, maxHotBytes: MAX_HOT_BYTES }),
  });
  me.memory.episodic["_"](`ivf-vs-exact-secret-${total}`);
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

  const buildStartedAt = performance.now();
  const build = me.buildVectorIndex("memory.episodic", {
    k: Math.max(1, Math.round(Math.sqrt(total))),
    nprobe: NPROBE,
    maxTrainingVectors: MAX_TRAINING_VECTORS,
    iterations: 6,
    chunkRepresentativesPerChunk: CHUNK_REPRESENTATIVES,
  });
  const buildMs = performance.now() - buildStartedAt;
  assert(build.persisted === true, `expected persisted IVF index for N=${total}`);

  const queryIndexes = makeQueryIndexes(total, QUERIES);
  const exactLatencies: number[] = [];
  const ivfLatencies: number[] = [];
  const coarseLatencies: number[] = [];
  const exactPassLatencies: number[] = [];
  const recalls: number[] = [];
  const candidateChunks: number[] = [];
  const decryptedChunks: number[] = [];

  for (const queryIndex of queryIndexes) {
    const query = makeVector(queryIndex);

    const exactStartedAt = performance.now();
    const exact = me.searchExact("memory.episodic", query, { k: K });
    exactLatencies.push(performance.now() - exactStartedAt);

    const ivfStartedAt = performance.now();
    const approx = me.searchVector("memory.episodic", query, { k: K, nprobe: NPROBE });
    ivfLatencies.push(performance.now() - ivfStartedAt);
    coarseLatencies.push(approx.coarseMs);
    exactPassLatencies.push(approx.exactMs);
    candidateChunks.push(approx.candidateChunks);
    decryptedChunks.push(approx.decryptedChunks);

    const exactIds = new Set(exact.hits.map((hit: { index: number }) => hit.index));
    const overlap = approx.hits.filter((hit: { index: number }) => exactIds.has(hit.index)).length;
    recalls.push(overlap / K);
  }

  global.gc?.();
  const postSearchMem = memorySnapshot();

  const avgRecall = recalls.reduce((sum, value) => sum + value, 0) / Math.max(1, recalls.length);
  const avgCandidateChunks = candidateChunks.reduce((sum, value) => sum + value, 0) / Math.max(1, candidateChunks.length);
  const avgDecryptedChunks = decryptedChunks.reduce((sum, value) => sum + value, 0) / Math.max(1, decryptedChunks.length);
  const speedupP95 = percentile(ivfLatencies, 95) > 0
    ? percentile(exactLatencies, 95) / percentile(ivfLatencies, 95)
    : 0;

  return {
    total,
    ingestMs,
    ingestVps: total / Math.max(ingestMs / 1000, 0.001),
    buildMs,
    buildK: build.k,
    buildNprobe: build.nprobe,
    columnarWrites: persist.columnarWrites ?? 0,
    exactP50: percentile(exactLatencies, 50),
    exactP95: percentile(exactLatencies, 95),
    ivfP50: percentile(ivfLatencies, 50),
    ivfP95: percentile(ivfLatencies, 95),
    coarseP95: percentile(coarseLatencies, 95),
    exactPassP95: percentile(exactPassLatencies, 95),
    avgRecall,
    avgCandidateChunks,
    avgDecryptedChunks,
    speedupP95,
    postIngestHeap: postIngestMem.heapUsed,
    postSearchHeap: postSearchMem.heapUsed,
    postSearchRss: postSearchMem.rss,
    indexPath: build.indexPath,
  };
}

async function main() {
  console.log("============================================================");
  console.log(".me PHASE 3.1 — IVF VS EXACT");
  console.log("============================================================");
  console.log(`Sizes: ${SIZES.map((value) => value.toLocaleString()).join(", ")}`);
  console.log(`Batch: ${BATCH} | Dims: ${DIMS} | Queries: ${QUERIES} | K: ${K} | nprobe: ${NPROBE}`);
  console.log(`Chunk reps: ${CHUNK_REPRESENTATIVES}`);
  console.log(`Dataset mode: ${DATASET_MODE} | chunk sigma: ${CHUNK_SIGMA}`);
  console.log("Secret scope: memory.episodic");

  const rows = [];
  for (const total of SIZES) {
    const result = await runScalePoint(total);
    rows.push({
      vectors: result.total,
      build_ms: result.buildMs.toFixed(0),
      exact_p95_ms: result.exactP95.toFixed(2),
      ivf_p95_ms: result.ivfP95.toFixed(2),
      recall_at_k: result.avgRecall.toFixed(3),
      chunks_per_query: result.avgDecryptedChunks.toFixed(2),
      speedup_p95_x: result.speedupP95.toFixed(0),
    });

    console.log(`\n[N=${result.total.toLocaleString()}]`);
    console.log(`Columnar writes: ${result.columnarWrites}`);
    console.log(`Build: ${result.buildMs.toFixed(2)}ms | k=${result.buildK} | nprobe=${result.buildNprobe}`);
    console.log(`Index path: ${result.indexPath}`);
    console.log(`Ingest: ${(result.ingestMs / 1000).toFixed(2)}s | ${result.ingestVps.toFixed(0)} vps`);
    console.log(`Exact: p50=${result.exactP50.toFixed(2)}ms | p95=${result.exactP95.toFixed(2)}ms`);
    console.log(`IVF: p50=${result.ivfP50.toFixed(2)}ms | p95=${result.ivfP95.toFixed(2)}ms`);
    console.log(`IVF coarse p95=${result.coarseP95.toFixed(2)}ms | exact-pass p95=${result.exactPassP95.toFixed(2)}ms`);
    console.log(`Recall@${K}: ${result.avgRecall.toFixed(3)}`);
    console.log(`avg candidateChunks: ${result.avgCandidateChunks.toFixed(2)} | avg decryptedChunks: ${result.avgDecryptedChunks.toFixed(2)}`);
    console.log(`Speedup p95: ${result.speedupP95.toFixed(0)}x`);
    console.log(`Heap post-ingest: ${formatMb(result.postIngestHeap)}`);
    console.log(`Heap post-search: ${formatMb(result.postSearchHeap)} | RSS: ${formatMb(result.postSearchRss)}`);
  }

  console.log("\n--- Comparison Table ---");
  console.table(rows);
  console.log("PASS: IVF vs exact benchmark recorded.\n");
}

main().catch((error) => {
  console.error("\nFAIL: benchmark.ivf-vs-exact.ts");
  console.error(error);
  process.exitCode = 1;
});
