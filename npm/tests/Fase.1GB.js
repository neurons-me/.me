import ME from "../dist/me.es.js";

const MB = 1024 * 1024;
const TARGET_BYTES = 1024 * MB;
const DEFAULT_DIMS = 1536;
const CHUNK_SAMPLE_READS = 25;

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function formatMb(bytes) {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    rss: m.rss,
    heapUsed: m.heapUsed,
    heapTotal: m.heapTotal,
    external: m.external,
  };
}

function diffSnapshot(after, before) {
  return {
    rss: after.rss - before.rss,
    heapUsed: after.heapUsed - before.heapUsed,
    heapTotal: after.heapTotal - before.heapTotal,
    external: after.external - before.external,
  };
}

function logSnapshot(label, snap) {
  console.log(
    `${label} rss=${formatMb(snap.rss)} heapUsed=${formatMb(snap.heapUsed)} heapTotal=${formatMb(snap.heapTotal)} external=${formatMb(snap.external)}`,
  );
}

function createCallableMe() {
  return new ME();
}

function generateEmbedding(index, dims) {
  const out = new Array(dims);
  for (let j = 0; j < dims; j++) {
    out[j] = ((index * 31 + j * 17) % 1000) / 1000;
  }
  return out;
}

function estimateItemBytes(dims) {
  const embeddingBytes = dims * 4;
  const idBytes = 4;
  const timestampBytes = 8;
  const textBytes = 64;
  const metadataBytes = 64;
  return embeddingBytes + idBytes + timestampBytes + textBytes + metadataBytes;
}

function computeTargetCount(dims = DEFAULT_DIMS, targetBytes = TARGET_BYTES) {
  return Math.max(1000, Math.floor(targetBytes / estimateItemBytes(dims)));
}

function generateItems(count, dims) {
  const now = Date.now();
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = {
      id: i,
      embedding: generateEmbedding(i, dims),
      timestamp: now - i * 1000,
      text: `memory-item-${i}`,
      kind: "episodic",
      processed: i % 2 === 0,
    };
  }
  return out;
}

function forceGc() {
  if (typeof global.gc === "function") {
    global.gc();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readPath(me, path) {
  return me(path);
}

function runSampleReads(me, count, chunkSize) {
  const latencies = [];
  for (let i = 0; i < Math.min(CHUNK_SAMPLE_READS, count); i++) {
    const idx = Math.floor((i * (count - 1)) / Math.max(1, Math.min(CHUNK_SAMPLE_READS, count) - 1 || 1));
    const t0 = performance.now();
    const item = readPath(me, `memory.episodic.${idx}`);
    const t1 = performance.now();
    assert(item && typeof item === "object", `missing item at index ${idx}`);
    assert(Array.isArray(item.embedding), `embedding missing at index ${idx}`);
    assert(item.embedding.length === DEFAULT_DIMS, `embedding dims mismatch at index ${idx}`);
    latencies.push(t1 - t0);
  }

  const chunkLatencies = [];
  const chunkCount = Math.max(1, Math.ceil(count / chunkSize));
  for (let chunkIndex = 0; chunkIndex < Math.min(5, chunkCount); chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const t0 = performance.now();
    const item = readPath(me, `memory.episodic.${start}`);
    const t1 = performance.now();
    assert(item && typeof item === "object", `missing chunk boundary item ${start}`);
    chunkLatencies.push(t1 - t0);
  }

  return {
    itemP50: percentile(latencies, 50),
    itemP95: percentile(latencies, 95),
    chunkBoundaryP50: percentile(chunkLatencies, 50),
    chunkBoundaryP95: percentile(chunkLatencies, 95),
  };
}

async function main() {
  console.log("\n============================================================");
  console.log("FASE 1GB TEST — SECRET BRANCH COLUMNAR / REAL COLD READ");
  console.log("============================================================\n");

  const dims = DEFAULT_DIMS;
  const count = computeTargetCount(dims, TARGET_BYTES);
  const approxBytes = count * estimateItemBytes(dims);
  const chunkSize = 10000;

  console.log(`dims: ${dims}`);
  console.log(`target bytes: ${formatMb(TARGET_BYTES)}`);
  console.log(`estimated item bytes: ${estimateItemBytes(dims)} bytes`);
  console.log(`generated item count: ${count}`);
  console.log(`estimated payload size: ${formatMb(approxBytes)}`);
  console.log(`configured chunk size: ${chunkSize}`);

  forceGc();
  const memBeforeGenerate = memorySnapshot();
  const items = generateItems(count, dims);
  const memAfterGenerate = memorySnapshot();
  console.log("\n[generate]");
  logSnapshot("before", memBeforeGenerate);
  logSnapshot("after ", memAfterGenerate);
  logSnapshot("delta ", diffSnapshot(memAfterGenerate, memBeforeGenerate));

  const writer = createCallableMe();
  writer.memory["_"]("fase-1gb-secret");

  forceGc();
  const memBeforeWrite = memorySnapshot();
  const writeT0 = performance.now();
  writer.memory.episodic(items);
  const writeT1 = performance.now();
  const memAfterWrite = memorySnapshot();

  console.log("\n[write]");
  console.log(`write total: ${formatMs(writeT1 - writeT0)}`);
  logSnapshot("before", memBeforeWrite);
  logSnapshot("after ", memAfterWrite);
  logSnapshot("delta ", diffSnapshot(memAfterWrite, memBeforeWrite));

  const exported = writer.memories();
  assert(Array.isArray(exported) && exported.length > 0, "writer.memories() returned empty state");

  forceGc();
  const memBeforeHydrate = memorySnapshot();
  const reader = createCallableMe();
  const hydrateT0 = performance.now();
  for (const memory of exported) {
    reader.learn(memory);
  }
  const hydrateT1 = performance.now();
  const memAfterHydrate = memorySnapshot();

  console.log("\n[rehydrate]");
  console.log(`hydrate total: ${formatMs(hydrateT1 - hydrateT0)}`);
  logSnapshot("before", memBeforeHydrate);
  logSnapshot("after ", memAfterHydrate);
  logSnapshot("delta ", diffSnapshot(memAfterHydrate, memBeforeHydrate));

  forceGc();
  const memBeforeColdRead = memorySnapshot();
  const coldReadT0 = performance.now();
  const fullBranch = readPath(reader, "memory.episodic");
  const coldReadT1 = performance.now();
  const memAfterColdRead = memorySnapshot();

  assert(Array.isArray(fullBranch), "cold read did not return an array");
  assert(fullBranch.length === count, `cold read length mismatch: expected ${count}, got ${fullBranch.length}`);

  console.log("\n[cold read full branch]");
  console.log(`cold read total: ${formatMs(coldReadT1 - coldReadT0)}`);
  logSnapshot("before", memBeforeColdRead);
  logSnapshot("after ", memAfterColdRead);
  logSnapshot("delta ", diffSnapshot(memAfterColdRead, memBeforeColdRead));

  forceGc();
  const memBeforeHotReads = memorySnapshot();
  const sampleStats = runSampleReads(reader, count, chunkSize);
  const memAfterHotReads = memorySnapshot();

  console.log("\n[hot / selective reads]");
  console.log(`item read p50: ${formatMs(sampleStats.itemP50)}`);
  console.log(`item read p95: ${formatMs(sampleStats.itemP95)}`);
  console.log(`chunk boundary p50: ${formatMs(sampleStats.chunkBoundaryP50)}`);
  console.log(`chunk boundary p95: ${formatMs(sampleStats.chunkBoundaryP95)}`);
  logSnapshot("before", memBeforeHotReads);
  logSnapshot("after ", memAfterHotReads);
  logSnapshot("delta ", diffSnapshot(memAfterHotReads, memBeforeHotReads));

  console.log("\n[summary]");
  console.table([
    {
      dims,
      count,
      estimatedPayloadMB: Number((approxBytes / MB).toFixed(1)),
      writeMs: Number((writeT1 - writeT0).toFixed(2)),
      hydrateMs: Number((hydrateT1 - hydrateT0).toFixed(2)),
      coldReadMs: Number((coldReadT1 - coldReadT0).toFixed(2)),
      itemReadP50Ms: Number(sampleStats.itemP50.toFixed(2)),
      itemReadP95Ms: Number(sampleStats.itemP95.toFixed(2)),
      chunkBoundaryP50Ms: Number(sampleStats.chunkBoundaryP50.toFixed(2)),
      chunkBoundaryP95Ms: Number(sampleStats.chunkBoundaryP95.toFixed(2)),
      rssMB: Number((process.memoryUsage().rss / MB).toFixed(1)),
      heapUsedMB: Number((process.memoryUsage().heapUsed / MB).toFixed(1)),
    },
  ]);

  console.log("\nPASS: Fase 1GB benchmark completed.\n");
}

main().catch((error) => {
  console.error("\nFAIL: Fase 1GB benchmark failed.");
  console.error(error);
  process.exitCode = 1;
});