import * as ThisMeModule from "../dist/me.es.js";

const ME = ThisMeModule.default;
const commitIndexedBatchExport = ThisMeModule.commitIndexedBatch;

const MB = 1024 * 1024;
const TARGET_BYTES = 1024 * MB;
const DEFAULT_DIMS = 1536;
const CHUNK_SIZE = 100;
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

function generateItemsRange(start, end, dims) {
  const now = Date.now();
  const out = new Array(end - start);
  for (let i = start; i < end; i++) {
    out[i - start] = {
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

function resolveBatchWriter(me) {
  const candidates = [
    typeof commitIndexedBatchExport === "function"
      ? (startIndex, items) => commitIndexedBatchExport(me, ["memory", "episodic"], startIndex, items)
      : null,
    typeof me?.commitIndexedBatch === "function"
      ? (startIndex, items) => me.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?._commitIndexedBatch === "function"
      ? (startIndex, items) => me._commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?.kernel?.commitIndexedBatch === "function"
      ? (startIndex, items) => me.kernel.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?._kernel?.commitIndexedBatch === "function"
      ? (startIndex, items) => me._kernel.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
  ].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error(
      "commitIndexedBatch is not reachable from the benchmark runtime. Rebuild exports or expose the helper on the ME instance before running this test.",
    );
  }

  return candidates[0];
}

function writeChunk(me, chunk, startIndex, chunkLabel) {
  const startedAt = performance.now();
  const batchWrite = resolveBatchWriter(me);
  console.log(`  ${chunkLabel} batch-write-start size=${chunk.length} startIndex=${startIndex}`);
  batchWrite(startIndex, chunk);
  const elapsed = performance.now() - startedAt;
  console.log(`  ${chunkLabel} batch-write-done total=${formatMs(elapsed)}`);
}

function runSampleReads(me, count, chunkSize) {
  const latencies = [];
  for (let i = 0; i < Math.min(CHUNK_SAMPLE_READS, count); i++) {
    const idx = Math.floor((i * (count - 1)) / Math.max(1, Math.min(CHUNK_SAMPLE_READS, count) - 1 || 1));
    const t0 = performance.now();
    const item = readPath(me, `memory.episodic.${idx}`);
    const t1 = performance.now();
    assert(item && typeof item === "object", `missing item at index ${idx}`);
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
  console.log("FASE 1GB TEST — SECRET BRANCH COLUMNAR / INCREMENTAL");
  console.log("============================================================\n");

  const dims = DEFAULT_DIMS;
  const count = computeTargetCount(dims, TARGET_BYTES);
  const approxBytes = count * estimateItemBytes(dims);
  const chunkCount = Math.ceil(count / CHUNK_SIZE);

  console.log(`dims: ${dims}`);
  console.log(`target bytes: ${formatMb(TARGET_BYTES)}`);
  console.log(`estimated item bytes: ${estimateItemBytes(dims)} bytes`);
  console.log(`generated item count: ${count}`);
  console.log(`estimated payload size: ${formatMb(approxBytes)}`);
  console.log(`configured chunk size: ${CHUNK_SIZE}`);
  console.log(`chunk count: ${chunkCount}`);

  const writer = createCallableMe();
  writer.memory["_"]("fase-1gb-secret");

  const writeChunkLatencies = [];
  let peakWriteRss = 0;
  let peakWriteHeap = 0;

  console.log("\n[write incremental]");
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(count, start + CHUNK_SIZE);
    const chunkLabel = `chunk ${chunkIndex + 1}/${chunkCount}`;

    forceGc();
    const memBeforeGenerate = memorySnapshot();
    console.log(`\n  ${chunkLabel} generate-start range=[${start}, ${end})`);
    const chunk = generateItemsRange(start, end, dims);
    const memAfterGenerate = memorySnapshot();
    console.log(`  ${chunkLabel} generate-done items=${chunk.length} genHeap=${formatMb(memAfterGenerate.heapUsed - memBeforeGenerate.heapUsed)}`);

    const writeT0 = performance.now();
    writeChunk(writer, chunk, start, chunkLabel);
    const writeT1 = performance.now();
    const memAfterWrite = memorySnapshot();

    writeChunkLatencies.push(writeT1 - writeT0);
    peakWriteRss = Math.max(peakWriteRss, memAfterWrite.rss);
    peakWriteHeap = Math.max(peakWriteHeap, memAfterWrite.heapUsed);

    console.log(
      `  ${chunkLabel} batch-summary items=${end - start} ` +
      `write=${formatMs(writeT1 - writeT0)} ` +
      `genΔheap=${formatMb(memAfterGenerate.heapUsed - memBeforeGenerate.heapUsed)} ` +
      `writeΔheap=${formatMb(memAfterWrite.heapUsed - memAfterGenerate.heapUsed)} ` +
      `rss=${formatMb(memAfterWrite.rss)}`,
    );
  }

  const memAfterAllWrites = memorySnapshot();
  console.log("\n[write summary]");
  console.log(`chunk write p50: ${formatMs(percentile(writeChunkLatencies, 50))}`);
  console.log(`chunk write p95: ${formatMs(percentile(writeChunkLatencies, 95))}`);
  console.log(`peak write rss: ${formatMb(peakWriteRss)}`);
  console.log(`peak write heapUsed: ${formatMb(peakWriteHeap)}`);
  logSnapshot("after writes", memAfterAllWrites);

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

  console.log("\n[rehydrate new instance]");
  console.log(`hydrate total: ${formatMs(hydrateT1 - hydrateT0)}`);
  logSnapshot("before", memBeforeHydrate);
  logSnapshot("after ", memAfterHydrate);
  logSnapshot("delta ", diffSnapshot(memAfterHydrate, memBeforeHydrate));

  forceGc();
  const memBeforeColdRead = memorySnapshot();
  const coldReadT0 = performance.now();
  const firstItem = readPath(reader, "memory.episodic.0");
  const coldReadT1 = performance.now();
  const memAfterColdRead = memorySnapshot();

  assert(firstItem && typeof firstItem === "object", "cold read did not return first item");
  assert(Array.isArray(firstItem.embedding), "cold read first item missing embedding");
  assert(firstItem.embedding.length === dims, `cold read dims mismatch: expected ${dims}, got ${firstItem.embedding.length}`);

  console.log("\n[cold read real / first item]");
  console.log(`cold read first-item total: ${formatMs(coldReadT1 - coldReadT0)}`);
  logSnapshot("before", memBeforeColdRead);
  logSnapshot("after ", memAfterColdRead);
  logSnapshot("delta ", diffSnapshot(memAfterColdRead, memBeforeColdRead));

  forceGc();
  const memBeforeFullRead = memorySnapshot();
  const fullReadT0 = performance.now();
  const fullBranch = readPath(reader, "memory.episodic");
  const fullReadT1 = performance.now();
  const memAfterFullRead = memorySnapshot();

  assert(fullBranch && typeof fullBranch === "object", "full branch read returned nothing");

  console.log("\n[full branch read]");
  console.log(`full branch read total: ${formatMs(fullReadT1 - fullReadT0)}`);
  logSnapshot("before", memBeforeFullRead);
  logSnapshot("after ", memAfterFullRead);
  logSnapshot("delta ", diffSnapshot(memAfterFullRead, memBeforeFullRead));

  forceGc();
  const memBeforeHotReads = memorySnapshot();
  const sampleStats = runSampleReads(reader, count, CHUNK_SIZE);
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
      chunkSize: CHUNK_SIZE,
      chunkCount,
      estimatedPayloadMB: Number((approxBytes / MB).toFixed(1)),
      chunkWriteP50Ms: Number(percentile(writeChunkLatencies, 50).toFixed(2)),
      chunkWriteP95Ms: Number(percentile(writeChunkLatencies, 95).toFixed(2)),
      hydrateMs: Number((hydrateT1 - hydrateT0).toFixed(2)),
      coldFirstItemMs: Number((coldReadT1 - coldReadT0).toFixed(2)),
      fullReadMs: Number((fullReadT1 - fullReadT0).toFixed(2)),
      itemReadP50Ms: Number(sampleStats.itemP50.toFixed(2)),
      itemReadP95Ms: Number(sampleStats.itemP95.toFixed(2)),
      chunkBoundaryP50Ms: Number(sampleStats.chunkBoundaryP50.toFixed(2)),
      chunkBoundaryP95Ms: Number(sampleStats.chunkBoundaryP95.toFixed(2)),
      peakWriteRssMB: Number((peakWriteRss / MB).toFixed(1)),
      peakWriteHeapMB: Number((peakWriteHeap / MB).toFixed(1)),
      rssMB: Number((process.memoryUsage().rss / MB).toFixed(1)),
      heapUsedMB: Number((process.memoryUsage().heapUsed / MB).toFixed(1)),
    },
  ]);

  console.log("\nPASS: Fase 1GB incremental benchmark completed.\n");
}

main().catch((error) => {
  console.error("\nFAIL: Fase 1GB incremental benchmark failed.");
  console.error(error);
  process.exitCode = 1;
});