import ME from "this.me";

const { DiskStore } = ME;

const TOTAL = 4112;
const BATCH = 256;
const DIMS = 256;
const QUERIES = 12;
const K = 10;

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
  const base = cluster % 8;
  for (let i = 0; i < DIMS; i++) {
    out[i] = i % 8 === base ? 1 : 0.05;
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

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
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
    throw new Error("commitIndexedBatch is not reachable for Fase.3.0.search-exact.test.ts");
  }

  return candidates[0] as (startIndex: number, items: any[]) => void;
}

function bruteForceTopK(dataset: Float32Array[], query: Float32Array, k: number): number[] {
  return dataset
    .map((candidate, index) => ({ index, score: cosine(query, candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, k)
    .map((entry) => entry.index);
}

async function main() {
  const tmp = "/tmp/me-phase3-search-exact";
  const me: any = new ME("search-exact", {
    store: new DiskStore({ baseDir: tmp, maxHotBytes: 250_000_000 }),
  });

  me.memory.episodic["_"]("search-exact-secret");
  me._enablePersistSecretBranchDebug?.(true);

  const writer = resolveBatchWriter(me);
  const dataset: Float32Array[] = new Array(TOTAL);

  for (let start = 0; start < TOTAL; start += BATCH) {
    const size = Math.min(BATCH, TOTAL - start);
    const items = buildItems(start, size);
    for (let i = 0; i < items.length; i++) dataset[start + i] = items[i].embedding;
    writer(start, items);
  }

  const persist = me._takePersistSecretBranchDebugWindow?.() ?? {};
  assert((persist.columnarWrites ?? 0) > 0, "expected columnar writes before exact search");

  const coldQueryIndex = 0;
  const coldExpected = bruteForceTopK(dataset, dataset[coldQueryIndex], K);
  const coldStartedAt = performance.now();
  const coldResult = me.searchExact("memory.episodic", dataset[coldQueryIndex], { k: K });
  const coldMs = performance.now() - coldStartedAt;
  assert(coldResult.hits.length === K, `expected ${K} cold hits, got ${coldResult.hits.length}`);
  assert(
    JSON.stringify(coldResult.hits.map((hit: { index: number }) => hit.index)) === JSON.stringify(coldExpected),
    `cold recall mismatch for query ${coldQueryIndex}`,
  );

  const tailQueryIndex = TOTAL - 1;
  const tailExpected = bruteForceTopK(dataset, dataset[tailQueryIndex], K);
  const tailResult = me.searchExact("memory.episodic", dataset[tailQueryIndex], { k: K });
  assert(tailResult.hits.length === K, `expected ${K} tail hits, got ${tailResult.hits.length}`);
  assert(
    JSON.stringify(tailResult.hits.map((hit: { index: number }) => hit.index)) === JSON.stringify(tailExpected),
    `tail recall mismatch for query ${tailQueryIndex}`,
  );

  const latencies: number[] = [];
  for (let q = 1; q <= QUERIES; q++) {
    const queryIndex = q * Math.floor(TOTAL / (QUERIES + 1));
    const query = dataset[queryIndex];
    const expected = bruteForceTopK(dataset, query, K);
    const startedAt = performance.now();
    const result = me.searchExact("memory.episodic", query, { k: K });
    latencies.push(performance.now() - startedAt);

    assert(result.hits.length === K, `expected ${K} hits, got ${result.hits.length}`);
    const actual = result.hits.map((hit: { index: number }) => hit.index);
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      `recall mismatch for query ${queryIndex}\nactual=${actual.join(",")}\nexpected=${expected.join(",")}`,
    );
  }

  const final = me.searchExact("memory.episodic", dataset[0], { k: K });
  assert(final.scannedVectors === TOTAL, `expected scannedVectors=${TOTAL}, got ${final.scannedVectors}`);

  console.log("============================================================");
  console.log(".me FASE 3.0 — SEARCH EXACT");
  console.log("============================================================");
  console.log(`Vectors: ${TOTAL.toLocaleString()} | Batch: ${BATCH} | Dims: ${DIMS}`);
  console.log(`Columnar writes: ${persist.columnarWrites ?? 0}`);
  console.log(`scannedChunks: ${final.scannedChunks}`);
  console.log(`scannedVectors: ${final.scannedVectors}`);
  console.log(`coldMs: ${coldMs.toFixed(2)}ms`);
  console.log(`warmSingleQueryMs: ${final.tookMs.toFixed(2)}ms`);
  console.log(`warm p50: ${percentile(latencies, 50).toFixed(2)}ms`);
  console.log(`warm p95: ${percentile(latencies, 95).toFixed(2)}ms`);
  console.log("PASS: searchExact recall is 1.0 against brute force.\n");
}

main().catch((error) => {
  console.error("\nFAIL: Fase.3.0.search-exact.test.ts");
  console.error(error);
  process.exitCode = 1;
});
