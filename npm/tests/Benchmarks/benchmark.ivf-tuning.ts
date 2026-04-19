import fs from "node:fs";
import ME from "this.me";

const { DiskStore } = ME;

const MB = 1024 * 1024;
const DEFAULT_SIZES = [50_000, 100_000];
const DEFAULT_NLISTS: Record<number, number[]> = {
  50_000: [256, 512],
  100_000: [512, 1024],
};
const DEFAULT_NPROBES = [3, 5, 8, 12, 20];
const DEFAULT_CAPS: Record<number, number[]> = {
  50_000: [48, 80, 128],
  100_000: [80, 128, 192, 256],
};

const SIZES = parseNumberList(process.env.SIZES, DEFAULT_SIZES);
const NPROBES = parseNumberList(process.env.NPROBES, DEFAULT_NPROBES);
const BATCH = Number(process.env.BATCH_SIZE) || 256;
const DIMS = Number(process.env.DIMS) || 1536;
const LATENCY_QUERIES = Number(process.env.QUERIES) || 5;
const RECALL_QUERIES = Number(process.env.RECALL_QUERIES) || Math.min(LATENCY_QUERIES, 5);
const K = Number(process.env.K) || 10;
const MAX_HOT_BYTES = Number(process.env.MAX_HOT_BYTES) || 250_000_000;
const TRAINING_MULTIPLIER = Number(process.env.TRAINING_MULTIPLIER) || 8;
const MIN_TRAINING_VECTORS = Number(process.env.MIN_TRAINING_VECTORS) || 4096;
const ITERATIONS = Number(process.env.ITERATIONS) || 10;
const CHUNK_REPRESENTATIVES = Number(process.env.CHUNK_REPRESENTATIVES) || 4;
const DATASET_MODE = String(process.env.DATASET_MODE || "chunk_coherent").trim().toLowerCase();
const CHUNK_SIGMA = Number(process.env.CHUNK_SIGMA) || 0.05;
const LEGACY_CLUSTER_SPAN = Number(process.env.LEGACY_CLUSTER_SPAN) || 64;
const LEGACY_CLUSTER_FAMILIES = Number(process.env.LEGACY_CLUSTER_FAMILIES) || 16;

function parseNumberList(input: string | undefined, fallback: number[]): number[] {
  const raw = String(input || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  return raw.length > 0 ? raw : fallback;
}

function nlistsForSize(total: number): number[] {
  const envKey = `NLISTS_${total}`;
  return parseNumberList(process.env[envKey], DEFAULT_NLISTS[total] || [Math.max(1, Math.round(Math.sqrt(total)))]);
}

function capsForSize(total: number): number[] {
  const envKey = `CAPS_${total}`;
  return parseNumberList(process.env[envKey], DEFAULT_CAPS[total] || []);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)}MB`;
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
    throw new Error("commitIndexedBatch is not reachable for benchmark.ivf-tuning.ts");
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

function pickSubset(values: number[], count: number): number[] {
  if (count <= 0 || values.length === 0) return [];
  if (count >= values.length) return [...values];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.min(values.length - 1, Math.floor(((i + 0.5) * values.length) / count));
    out.push(values[index]);
  }
  return out.filter((value, pos, arr) => arr.indexOf(value) === pos);
}

function chooseTrainingVectors(total: number, nlist: number): number {
  const requested = Math.max(MIN_TRAINING_VECTORS, nlist * TRAINING_MULTIPLIER);
  return Math.min(total, requested);
}

async function prepareCorpus(total: number) {
  const tmp = `/tmp/me-phase3-ivf-tuning-${total}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  chunkCenterCache.clear();

  const me: any = new ME(`ivf-tuning-${total}`, {
    store: new DiskStore({ baseDir: tmp, maxHotBytes: MAX_HOT_BYTES }),
  });
  me.memory.episodic["_"](`ivf-tuning-secret-${total}`);
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
  return { me, tmp, ingestMs, persist, postIngestMem };
}

function computeExactBaseline(me: any, total: number, queryIndexes: number[]) {
  const exactLatencies: number[] = [];
  const baseline = new Map<number, Set<number>>();

  for (const queryIndex of queryIndexes) {
    const query = makeVector(queryIndex);
    const startedAt = performance.now();
    const exact = me.searchExact("memory.episodic", query, { k: K });
    exactLatencies.push(performance.now() - startedAt);
    baseline.set(queryIndex, new Set(exact.hits.map((hit: { index: number }) => hit.index)));
  }

  return {
    queryIndexes,
    exactLatencies,
    exactP50: percentile(exactLatencies, 50),
    exactP95: percentile(exactLatencies, 95),
    baseline,
  };
}

function buildIndex(
  me: any,
  total: number,
  nlist: number,
) {
  const buildStartedAt = performance.now();
  const build = me.buildVectorIndex("memory.episodic", {
    k: nlist,
    nprobe: Math.max(1, Math.min(nlist, NPROBES[0] || 1)),
    maxTrainingVectors: chooseTrainingVectors(total, nlist),
    iterations: ITERATIONS,
    chunkRepresentativesPerChunk: CHUNK_REPRESENTATIVES,
  });
  const buildMs = performance.now() - buildStartedAt;
  assert(build.persisted === true, `expected persisted IVF index for N=${total}, nlist=${nlist}`);

  return {
    buildMs,
    build,
  };
}

function readCachedIndexStats(me: any, scopeKey = "memory.episodic") {
  const index = me?.vectorIndexes?.get?.(scopeKey);
  if (!index || !Array.isArray(index.postingLists)) {
    return {
      postingListSizeAvg: 0,
      postingListSizeMax: 0,
    };
  }

  const sizes = index.postingLists.map((entries: unknown) => Array.isArray(entries) ? entries.length : 0);
  const total = sizes.reduce((sum: number, value: number) => sum + value, 0);
  return {
    postingListSizeAvg: total / Math.max(1, sizes.length),
    postingListSizeMax: sizes.reduce((max: number, value: number) => Math.max(max, value), 0),
  };
}

function runCombination(
  me: any,
  queryIndexes: number[],
  baseline: Map<number, Set<number>>,
  nprobe: number,
  maxCandidateChunks: number,
) {

  const ivfLatencies: number[] = [];
  const coarseLatencies: number[] = [];
  const exactPassLatencies: number[] = [];
  const recalls: number[] = [];
  const candidateChunks: number[] = [];
  const decryptedChunks: number[] = [];

  for (const queryIndex of queryIndexes) {
    const query = makeVector(queryIndex);
    const startedAt = performance.now();
    const approx = me.searchVector("memory.episodic", query, { k: K, nprobe, maxCandidateChunks });
    ivfLatencies.push(performance.now() - startedAt);
    coarseLatencies.push(approx.coarseMs);
    exactPassLatencies.push(approx.exactMs);
    candidateChunks.push(approx.candidateChunks);
    decryptedChunks.push(approx.decryptedChunks);

    const exactIds = baseline.get(queryIndex);
    if (exactIds) {
      const overlap = approx.hits.filter((hit: { index: number }) => exactIds.has(hit.index)).length;
      recalls.push(overlap / K);
    }
  }

  global.gc?.();
  const postSearchMem = memorySnapshot();

  return {
    nprobe,
    maxCandidateChunks,
    ivfP50: percentile(ivfLatencies, 50),
    ivfP95: percentile(ivfLatencies, 95),
    coarseP95: percentile(coarseLatencies, 95),
    exactPassP95: percentile(exactPassLatencies, 95),
    avgRecall: recalls.reduce((sum, value) => sum + value, 0) / Math.max(1, recalls.length),
    recallSamples: recalls.length,
    avgCandidateChunks: candidateChunks.reduce((sum, value) => sum + value, 0) / Math.max(1, candidateChunks.length),
    avgDecryptedChunks: decryptedChunks.reduce((sum, value) => sum + value, 0) / Math.max(1, decryptedChunks.length),
    postSearchHeap: postSearchMem.heapUsed,
    postSearchRss: postSearchMem.rss,
  };
}

async function main() {
  console.log("N,nlist,nprobe,maxCandidateChunks,buildMs,exactP95,ivfP95,recall,avgChunks,speedup");
  console.log(`# dataset_mode=${DATASET_MODE} chunk_sigma=${CHUNK_SIGMA} chunk_size=${BATCH}`);

  const rows: Array<Record<string, string | number>> = [];

  for (const total of SIZES) {
    const { me, ingestMs, persist, postIngestMem } = await prepareCorpus(total);
    const latencyQueryIndexes = makeQueryIndexes(total, LATENCY_QUERIES);
    const recallQueryIndexes = pickSubset(latencyQueryIndexes, RECALL_QUERIES);
    const exact = computeExactBaseline(me, total, recallQueryIndexes);
    const nlists = nlistsForSize(total);
    const caps = capsForSize(total);

    console.log(`\n[N=${total.toLocaleString()}] Ingest ${(ingestMs / 1000).toFixed(2)}s | ${Math.round(total / Math.max(ingestMs / 1000, 0.001))} vps`);
    console.log(`Columnar writes: ${persist.columnarWrites ?? 0}`);
    console.log(`Exact baseline: p50=${exact.exactP50.toFixed(2)}ms | p95=${exact.exactP95.toFixed(2)}ms | queries=${recallQueryIndexes.length}`);
    console.log(`IVF latency queries: ${latencyQueryIndexes.length}`);
    console.log(`Heap post-ingest: ${formatMb(postIngestMem.heapUsed)} | RSS: ${formatMb(postIngestMem.rss)}`);

    for (const nlist of nlists) {
      const built = buildIndex(me, total, nlist);
      for (const nprobe of NPROBES) {
        const effectiveCaps = caps.length > 0 ? caps : [Math.max(K, nprobe * 4)];
        for (const maxCandidateChunks of effectiveCaps) {
          const result = runCombination(me, latencyQueryIndexes, exact.baseline, nprobe, maxCandidateChunks);
          const speedupP95 = result.ivfP95 > 0 ? exact.exactP95 / result.ivfP95 : 0;
          const chunksPerCentroid = result.avgDecryptedChunks / Math.max(1, nprobe);
          const postingStats = readCachedIndexStats(me);

          console.log(
            `${total},${nlist},${nprobe},${maxCandidateChunks},${built.buildMs.toFixed(0)},${exact.exactP95.toFixed(2)},${result.ivfP95.toFixed(2)},${result.avgRecall.toFixed(3)},${result.avgDecryptedChunks.toFixed(2)},${chunksPerCentroid.toFixed(2)},${postingStats.postingListSizeAvg.toFixed(2)},${speedupP95.toFixed(1)}`,
          );

          rows.push({
            vectors: total,
            nlist,
            nprobe,
            max_candidate_chunks: maxCandidateChunks,
            build_ms: built.buildMs.toFixed(0),
            exact_p95_ms: exact.exactP95.toFixed(2),
            ivf_p95_ms: result.ivfP95.toFixed(2),
            recall_at_10: result.avgRecall.toFixed(3),
            recall_samples: result.recallSamples,
            chunks_per_query: result.avgDecryptedChunks.toFixed(2),
            chunks_per_centroid: chunksPerCentroid.toFixed(2),
            posting_list_size_avg: postingStats.postingListSizeAvg.toFixed(2),
            speedup_p95_x: speedupP95.toFixed(1),
          });
        }
      }
    }
  }

  console.log("\n--- Tuning Table ---");
  console.table(rows);
  console.log("PASS: IVF tuning sweep recorded.");
}

main().catch((error) => {
  console.error("\nFAIL: benchmark.ivf-tuning.ts");
  console.error(error);
  process.exitCode = 1;
});
