console.log("START");
process.on("unhandledRejection", e => {
  console.error("UNHANDLED:", e);
  process.exit(1);
});
process.on("uncaughtException", e => {
  console.error("UNCAUGHT:", e);
  process.exit(1);
});

import * as ThisMeModule from "../../dist/me.es.js";
import fs from "node:fs";

console.log("IMPORTS OK");

const ME = ThisMeModule.default;
const { DiskStore } = ME;

const MB = 1024 * 1024;
const TARGET_BYTES = 1024 * MB; // 1GB target
const DEFAULT_DIMS = 1536;
const CHUNK_SIZE = 100;
const PROFILE_EVERY_CHUNKS = 100;

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
    throw new Error(
      "commitIndexedBatch is not reachable from the benchmark runtime. Rebuild exports or expose the helper on the ME instance before running this test.",
    );
  }

  return candidates[0];
}

async function writeChunk(me, chunk, startIndex, chunkLabel) {
  const startedAt = performance.now();
  const batchWrite = resolveBatchWriter(me);
  console.log(` ${chunkLabel} batch-write-start size=${chunk.length} startIndex=${startIndex}`);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT: commitIndexedBatch no resolvio en 5s")), 5000)
  );
  await Promise.race([Promise.resolve(batchWrite(startIndex, chunk)), timeout]);
  const elapsed = performance.now() - startedAt;
  console.log(` ${chunkLabel} batch-write-done total=${formatMs(elapsed)}`);
}

async function main() {
  console.log("\n============================================================");
  console.log("FASE 2.0 INCREMENTAL-DISK TEST");
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

  const tmp = "/tmp/me-fase2-bench";
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log("BOOT");
  const me = new ME("sui", {
    store: new DiskStore({
      baseDir: tmp,
      maxHotBytes: 400_000_000, // 400MB hot
    }),
  });

  console.log("ME INSTANCIADO");
  me.memory["_"]("fase-2-disk");

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
    console.log(`\n ${chunkLabel} generate-start range=[${start}, ${end})`);
    const chunk = generateItemsRange(start, end, dims);
    const memAfterGenerate = memorySnapshot();
    console.log(` ${chunkLabel} generate-done items=${chunk.length} genHeap=${formatMb(memAfterGenerate.heapUsed - memBeforeGenerate.heapUsed)}`);

    const writeT0 = performance.now();
    try {
      await writeChunk(me, chunk, start, chunkLabel);
    } catch (e) {
      console.error("COMMIT FALLO:", e);
      throw e;
    }
    const writeT1 = performance.now();
    const memAfterWrite = memorySnapshot();

    writeChunkLatencies.push(writeT1 - writeT0);
    peakWriteRss = Math.max(peakWriteRss, memAfterWrite.rss);
    peakWriteHeap = Math.max(peakWriteHeap, memAfterWrite.heapUsed);

    console.log(
      ` ${chunkLabel} batch-summary items=${end - start} ` +
      `write=${formatMs(writeT1 - writeT0)} ` +
      `genΔheap=${formatMb(memAfterGenerate.heapUsed - memBeforeGenerate.heapUsed)} ` +
      `writeΔheap=${formatMb(memAfterWrite.heapUsed - memAfterGenerate.heapUsed)} ` +
      `rss=${formatMb(memAfterWrite.rss)}`,
    );

    if ((chunkIndex + 1) % PROFILE_EVERY_CHUNKS === 0 || chunkIndex > chunkCount - 3) {
      console.log(`\n [profile @ ${chunkLabel}]`);
      logSnapshot(" memory", memAfterWrite);
    }
  }

  const memAfterAllWrites = memorySnapshot();
  console.log("\n[write summary]");
  console.log(`chunk write p50: ${formatMs(percentile(writeChunkLatencies, 50))}`);
  console.log(`chunk write p95: ${formatMs(percentile(writeChunkLatencies, 95))}`);
  console.log(`peak write rss: ${formatMb(peakWriteRss)}`);
  console.log(`peak write heapUsed: ${formatMb(peakWriteHeap)}`);
  logSnapshot("after writes", memAfterAllWrites);

  // Verificación de disco
  let logSize = 0;
  try {
    logSize = fs.statSync(`${tmp}/branch-store.log`).size;
  } catch {}
  console.log(`disk log size: ${formatMb(logSize)}`);

  // Prueba de lectura cruzando RAM→disco
  console.log("\n[disk read proof]");
  const proofT0 = performance.now();
  const recoveredId = me("memory.episodic.0.id");
  const proofT1 = performance.now();
  const proof = me.inspect({ last: 1 }).memories[0] || {};
  console.log(`read latency: ${formatMs(proofT1 - proofT0)}`);
  console.log(`recovered id: ${recoveredId}`);
  console.log(`proof.hash: ${proof.hash?.slice(0, 16)}...`);
  console.log(`proof.prevHash: ${proof.prevHash?.slice(0, 16)}...`);

  // Criterios Fase 2.0
  const heapMB = memAfterAllWrites.heapUsed / MB;
  console.log("\n[summary]");
  console.table([
    {
      dims,
      count,
      chunkSize: CHUNK_SIZE,
      chunkCount,
      estimatedPayloadMB: Number((approxBytes / MB).toFixed(1)),
      diskLogMB: Number((logSize / MB).toFixed(1)),
      chunkWriteP50Ms: Number(percentile(writeChunkLatencies, 50).toFixed(2)),
      chunkWriteP95Ms: Number(percentile(writeChunkLatencies, 95).toFixed(2)),
      peakWriteRssMB: Number((peakWriteRss / MB).toFixed(1)),
      peakWriteHeapMB: Number((peakWriteHeap / MB).toFixed(1)),
      finalHeapMB: Number(heapMB.toFixed(1)),
      readMs: Number((proofT1 - proofT0).toFixed(2)),
    },
  ]);

  if (heapMB > 550) throw new Error(`Heap explotó: ${heapMB.toFixed(1)}MB > 550MB`);
  if (logSize < 100 * MB) throw new Error(`No escribió suficiente a disco: ${formatMb(logSize)}`);
  if (recoveredId !== 0) throw new Error(`Lectura desde disco inconsistente: ${recoveredId}`);
  if (!proof.hash ||!proof.prevHash) throw new Error("Hash-chain rota");

  console.log("\nPASS: Fase 2.0 incremental-disk benchmark completed.\n");
}

main().catch((error) => {
  console.error("\nFAIL: Fase 2.0 incremental-disk benchmark failed.");
  console.error(error);
  process.exitCode = 1;
});
