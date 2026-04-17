import * as ThisMeModule from "../dist/me.es.js";
import fs from "node:fs";

const ME = ThisMeModule.default;
const { DiskStore } = ME;

const MB = 1024 * 1024;
const TARGET_DISK_BYTES = (Number(process.env.TARGET_DISK_MB) || 500) * MB;
const DEFAULT_DIMS = 1536;
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 250;
const MAX_HOT_BYTES = (Number(process.env.MAX_HOT_MB) || 64) * MB;
const EXPLAIN_PATH = "memory.episodic.0.id";
const LOG_EVERY_CHUNKS = Number(process.env.LOG_EVERY_CHUNKS) || 10;

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
    throw new Error("commitIndexedBatch is not reachable from the Phase 2.1 benchmark runtime.");
  }

  return candidates[0];
}

async function writeChunk(me, chunk, startIndex) {
  const batchWrite = resolveBatchWriter(me);
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT: commitIndexedBatch no resolvio en 5s")), 5000);
  });

  const t0 = performance.now();
  await Promise.race([Promise.resolve(batchWrite(startIndex, chunk)), timeout]);
  return performance.now() - t0;
}

async function main() {
  console.log("\n============================================================");
  console.log("FASE 2.1 EXPLAIN LOOKUP BENCHMARK");
  console.log("============================================================\n");
  console.log(`target disk bytes: ${formatMb(TARGET_DISK_BYTES)}`);
  console.log(`chunk size: ${CHUNK_SIZE}`);
  console.log(`hot cache budget: ${formatMb(MAX_HOT_BYTES)}`);
  console.log(`benchmark explain path: ${EXPLAIN_PATH}`);
  console.log('note: explain(path, { id }) no existe hoy; este benchmark mide el lookup equivalente sobre la API real path-only.');

  const tmp = "/tmp/me-fase2-explain-bench";
  fs.rmSync(tmp, { recursive: true, force: true });

  const me = new ME("sui", {
    store: new DiskStore({
      baseDir: tmp,
      maxHotBytes: MAX_HOT_BYTES,
    }),
  });

  me.memory["_"]("fase-2-explain");

  let nextIndex = 0;
  let chunkIndex = 0;
  let logSize = 0;
  let peakHeap = 0;
  let peakRss = 0;

  while (logSize < TARGET_DISK_BYTES) {
    const start = nextIndex;
    const end = start + CHUNK_SIZE;
    const chunk = generateItemsRange(start, end, DEFAULT_DIMS);
    const elapsed = await writeChunk(me, chunk, start);
    chunkIndex += 1;
    nextIndex = end;

    logSize = fs.existsSync(`${tmp}/branch-store.log`) ? fs.statSync(`${tmp}/branch-store.log`).size : 0;
    const mem = memorySnapshot();
    peakHeap = Math.max(peakHeap, mem.heapUsed);
    peakRss = Math.max(peakRss, mem.rss);

    if (chunkIndex === 1 || chunkIndex % LOG_EVERY_CHUNKS === 0 || logSize >= TARGET_DISK_BYTES) {
      console.log(
        ` chunk=${chunkIndex} items=${nextIndex} write=${formatMs(elapsed)} disk=${formatMb(logSize)} heap=${formatMb(mem.heapUsed)} rss=${formatMb(mem.rss)}`
      );
    }
  }

  forceGc();

  const explainT0 = performance.now();
  const explanation = me.explain(EXPLAIN_PATH);
  const explainT1 = performance.now();
  const explainMs = explainT1 - explainT0;

  const readT0 = performance.now();
  const recoveredId = me(EXPLAIN_PATH);
  const readT1 = performance.now();
  const readMs = readT1 - readT0;

  let verdict = "PASS";
  if (explainMs > 1000) verdict = "FAIL";
  else if (explainMs > 100) verdict = "CHECK";

  console.table([
    {
      diskLogMB: Number((logSize / MB).toFixed(1)),
      itemsWritten: nextIndex,
      chunksWritten: chunkIndex,
      peakHeapMB: Number((peakHeap / MB).toFixed(1)),
      peakRssMB: Number((peakRss / MB).toFixed(1)),
      explainMs: Number(explainMs.toFixed(2)),
      readMs: Number(readMs.toFixed(2)),
      verdict,
    },
  ]);

  console.log(`explain value: ${explanation.value}`);
  console.log(`explain derivation: ${explanation.derivation ? "present" : "none"}`);

  if (logSize < TARGET_DISK_BYTES) {
    throw new Error(`Disk target not reached: ${formatMb(logSize)} < ${formatMb(TARGET_DISK_BYTES)}`);
  }
  if (recoveredId !== 0) {
    throw new Error(`Lookup inconsistente desde disco: ${recoveredId}`);
  }
  if (explanation.value !== 0) {
    throw new Error(`explain() devolvio valor inesperado: ${explanation.value}`);
  }
  if (verdict === "FAIL") {
    throw new Error(`explain() tardó ${formatMs(explainMs)} a ${formatMb(logSize)} en disco; toca optimizar lookup.`);
  }

  console.log(`\n${verdict}: Fase 2.1 explain lookup benchmark completed.\n`);
}

main().catch((error) => {
  console.error("\nFAIL: Fase 2.1 explain lookup benchmark failed.");
  console.error(error);
  process.exitCode = 1;
});
