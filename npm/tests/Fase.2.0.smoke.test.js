import * as ThisMeModule from "../dist/me.es.js";
import fs from "node:fs";

const ME = ThisMeModule.default;
const { DiskStore } = ME;

const MB = 1024 * 1024;
const TARGET_BYTES = (Number(process.env.TARGET_MB) || 10) * MB;
const DEFAULT_DIMS = 1536;
const CHUNK_SIZE = 100;
const MAX_HOT_BYTES = 32 * MB;

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT:", error);
  process.exit(1);
});

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function formatMb(bytes) {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    rss: m.rss,
    heapUsed: m.heapUsed,
  };
}

function forceGc() {
  if (typeof global.gc === "function") global.gc();
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
  return Math.max(CHUNK_SIZE, Math.floor(targetBytes / estimateItemBytes(dims)));
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

function resolveBatchWriter(me) {
  const candidates = [
    typeof me?._commitIndexedBatch === "function"
      ? (startIndex, items) => me._commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?.commitIndexedBatch === "function" && me.commitIndexedBatch?.then === undefined
      ? (startIndex, items) => me.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?.kernel?.commitIndexedBatch === "function"
      ? (startIndex, items) => me.kernel.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?._kernel?.commitIndexedBatch === "function"
      ? (startIndex, items) => me._kernel.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
  ].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error("commitIndexedBatch is not reachable from the smoke-test runtime.");
  }

  return candidates[0];
}

async function writeChunk(me, chunk, startIndex, chunkLabel) {
  const batchWrite = resolveBatchWriter(me);
  const startedAt = performance.now();
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT: commitIndexedBatch no resolvio en 5s")), 5000);
  });

  await Promise.race([Promise.resolve(batchWrite(startIndex, chunk)), timeout]);
  return performance.now() - startedAt;
}

async function main() {
  console.log("\n============================================================");
  console.log("FASE 2.0 SMOKE TEST");
  console.log("============================================================\n");

  const dims = DEFAULT_DIMS;
  const count = computeTargetCount(dims, TARGET_BYTES);
  const chunkCount = Math.ceil(count / CHUNK_SIZE);
  const tmp = "/tmp/me-fase2-smoke";

  console.log(`target bytes: ${formatMb(TARGET_BYTES)}`);
  console.log(`estimated item bytes: ${estimateItemBytes(dims)} bytes`);
  console.log(`generated item count: ${count}`);
  console.log(`chunk size: ${CHUNK_SIZE}`);
  console.log(`chunk count: ${chunkCount}`);

  fs.rmSync(tmp, { recursive: true, force: true });

  const me = new ME("sui", {
    store: new DiskStore({
      baseDir: tmp,
      maxHotBytes: MAX_HOT_BYTES,
    }),
  });

  me.memory["_"]("fase-2-smoke");

  const writeLatencies = [];
  let peakHeap = 0;
  let peakRss = 0;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(count, start + CHUNK_SIZE);
    const chunkLabel = `chunk ${chunkIndex + 1}/${chunkCount}`;
    const chunk = generateItemsRange(start, end, dims);

    forceGc();
    const elapsed = await writeChunk(me, chunk, start, chunkLabel);
    const mem = memorySnapshot();
    writeLatencies.push(elapsed);
    peakHeap = Math.max(peakHeap, mem.heapUsed);
    peakRss = Math.max(peakRss, mem.rss);
    console.log(` ${chunkLabel} write=${formatMs(elapsed)} heap=${formatMb(mem.heapUsed)} rss=${formatMb(mem.rss)}`);
  }

  const logPath = `${tmp}/branch-store.log`;
  const logSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

  const readT0 = performance.now();
  const recoveredId = me("memory.episodic.0.id");
  const readT1 = performance.now();

  const explainT0 = performance.now();
  const trace = me.explain("memory.episodic.0.id");
  const explainT1 = performance.now();

  console.table([
    {
      targetMB: Number((TARGET_BYTES / MB).toFixed(1)),
      chunkCount,
      diskLogMB: Number((logSize / MB).toFixed(2)),
      writeP50Ms: Number(percentile(writeLatencies, 50).toFixed(2)),
      writeP95Ms: Number(percentile(writeLatencies, 95).toFixed(2)),
      peakHeapMB: Number((peakHeap / MB).toFixed(2)),
      peakRssMB: Number((peakRss / MB).toFixed(2)),
      readMs: Number((readT1 - readT0).toFixed(2)),
      explainMs: Number((explainT1 - explainT0).toFixed(2)),
    },
  ]);

  if (logSize <= 0) throw new Error("DiskStore no escribio branch-store.log");
  if (recoveredId !== 0) throw new Error(`Lectura inconsistente desde DiskStore: ${recoveredId}`);
  if (trace.path !== "memory.episodic.0.id") throw new Error(`explain() devolvio path inesperado: ${trace.path}`);
  if (trace.value !== 0) throw new Error(`explain() devolvio valor inesperado: ${trace.value}`);

  console.log("\nPASS: Fase 2.0 smoke test completed.\n");
}

main().catch((error) => {
  console.error("\nFAIL: Fase 2.0 smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
