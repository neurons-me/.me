import fs from "node:fs";
import ME from "this.me";

const { DiskStore } = ME;

const TOTAL = 4096;
const BATCH = 256;
const DIMS = 256;
const QUERIES = 8;
const K = 10;
const IVF_K = 16;
const IVF_NPROBE = 2;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
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
  const cluster = Math.floor(index / BATCH);
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
      cluster: Math.floor(index / BATCH),
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
    throw new Error("commitIndexedBatch is not reachable for Fase.3.1.ivf.test.ts");
  }

  return candidates[0] as (startIndex: number, items: any[]) => void;
}

async function main() {
  const tmp = "/tmp/me-phase3-ivf";
  fs.rmSync(tmp, { recursive: true, force: true });

  const me: any = new ME("search-ivf", {
    store: new DiskStore({ baseDir: tmp, maxHotBytes: 250_000_000 }),
  });
  me.memory.episodic["_"]("search-ivf-secret");

  const writer = resolveBatchWriter(me);
  for (let start = 0; start < TOTAL; start += BATCH) {
    const size = Math.min(BATCH, TOTAL - start);
    writer(start, buildItems(start, size));
  }

  const build = me.buildVectorIndex("memory.episodic", {
    k: IVF_K,
    nprobe: IVF_NPROBE,
    maxTrainingVectors: 1024,
    iterations: 4,
  });

  assert(build.persisted === true, "expected IVF index to persist on DiskStore");
  assert(typeof build.indexPath === "string" && build.indexPath.length > 0, "expected IVF indexPath");

  const latencies: number[] = [];
  const recalls: number[] = [];
  const candidateChunks: number[] = [];
  const decryptedChunks: number[] = [];

  for (let q = 1; q <= QUERIES; q++) {
    const queryIndex = q * Math.floor(TOTAL / (QUERIES + 1));
    const query = makeVector(queryIndex);
    const exact = me.searchExact("memory.episodic", query, { k: K });
    const startedAt = performance.now();
    const approx = me.searchVector("memory.episodic", query, { k: K, nprobe: IVF_NPROBE });
    latencies.push(performance.now() - startedAt);
    candidateChunks.push(approx.candidateChunks);
    decryptedChunks.push(approx.decryptedChunks);

    const exactIds = new Set(exact.hits.map((hit: { index: number }) => hit.index));
    const overlap = approx.hits.filter((hit: { index: number }) => exactIds.has(hit.index)).length;
    recalls.push(overlap / K);
  }

  const meReloaded: any = new ME("search-ivf", {
    store: new DiskStore({ baseDir: tmp, maxHotBytes: 250_000_000 }),
  });
  meReloaded.memory.episodic["_"]("search-ivf-secret");
  const reloaded = meReloaded.searchVector("memory.episodic", makeVector(0), { k: K, nprobe: IVF_NPROBE });
  assert(reloaded.hits.length === K, `expected ${K} hits after reload, got ${reloaded.hits.length}`);

  const avgRecall = recalls.reduce((sum, value) => sum + value, 0) / recalls.length;
  const avgCandidateChunks = candidateChunks.reduce((sum, value) => sum + value, 0) / candidateChunks.length;
  const avgDecryptedChunks = decryptedChunks.reduce((sum, value) => sum + value, 0) / decryptedChunks.length;

  console.log("============================================================");
  console.log(".me FASE 3.1 — IVF SIDECAR");
  console.log("============================================================");
  console.log(`Vectors: ${TOTAL.toLocaleString()} | Batch: ${BATCH} | Dims: ${DIMS}`);
  console.log(`Build: ${build.tookMs.toFixed(2)}ms | k=${build.k} | nprobe=${build.nprobe}`);
  console.log(`Index path: ${build.indexPath}`);
  console.log(`p50: ${percentile(latencies, 50).toFixed(2)}ms`);
  console.log(`p95: ${percentile(latencies, 95).toFixed(2)}ms`);
  console.log(`avg recall@${K}: ${avgRecall.toFixed(3)}`);
  console.log(`avg candidateChunks: ${avgCandidateChunks.toFixed(2)}`);
  console.log(`avg decryptedChunks: ${avgDecryptedChunks.toFixed(2)}`);

  assert(avgRecall >= 0.9, `expected avg recall >= 0.9, got ${avgRecall.toFixed(3)}`);
  assert(avgCandidateChunks < 16, `expected avg candidate chunks < 16, got ${avgCandidateChunks.toFixed(2)}`);
  assert(avgDecryptedChunks <= avgCandidateChunks, "decryptedChunks should not exceed candidateChunks");
  console.log("PASS: IVF sidecar persists and reduces chunk visits while preserving recall.\n");
}

main().catch((error) => {
  console.error("\nFAIL: Fase.3.1.ivf.test.ts");
  console.error(error);
  process.exitCode = 1;
});
