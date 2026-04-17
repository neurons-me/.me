import * as ThisMeModule from "../dist/me.es.js";
import fs from "node:fs";

const ME = ThisMeModule.default;
const { DiskStore } = ME;

const MB = 1024 * 1024;
const TOTAL = Number(process.env.TOTAL_VECTORS) || 2_000_000;
const BATCH = Number(process.env.BATCH_SIZE) || 1000;
const DIMS = Number(process.env.DIMS) || 1536;
const REPORT_EVERY = Number(process.env.REPORT_EVERY) || 100_000;
const MAX_HOT_BYTES = Number(process.env.MAX_HOT_BYTES) || 250_000_000;
const FIRST_REPORT_AT = Number(process.env.FIRST_REPORT_AT) || Math.min(REPORT_EVERY, 10_000);
const HEARTBEAT_EVERY_MS = Number(process.env.HEARTBEAT_EVERY_MS) || 5_000;
const MAX_POST_GC_HEAP_BYTES = Number(process.env.MAX_POST_GC_HEAP_BYTES) || 600 * MB;
const MAX_RETAINED_BYTES = Number(process.env.MAX_RETAINED_BYTES) || 250 * MB;

function formatMb(bytes) {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function memorySnapshot() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    rss: mem.rss,
  };
}

function generateEmbedding(index, dims) {
  const out = new Array(dims);
  for (let j = 0; j < dims; j++) {
    out[j] = ((index * 31 + j * 17) % 1000) / 1000;
  }
  return out;
}

function generateChunk(start, size, dims = DIMS) {
  const t0 = performance.now();
  const now = Date.now();
  const arr = new Array(size);
  for (let i = 0; i < size; i++) {
    const id = start + i;
    arr[i] = {
      id,
      embedding: generateEmbedding(id, dims),
      timestamp: now - id * 1000,
      text: `memory-item-${id}`,
      kind: "episodic",
      processed: id % 2 === 0,
    };
  }
  const t1 = performance.now();
  return { chunk: arr, generateMs: t1 - t0 };
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
    throw new Error("commitIndexedBatch is not reachable from the Phase 2.2 benchmark runtime.");
  }

  return candidates[0];
}

function forceGc() {
  if (typeof global.gc === "function") global.gc();
}

function structuralSnapshot(me) {
  const s = me;
  const store = s?.branchStore;

  return {
    memories: Array.isArray(s?._memories) ? s._memories.length : 0,
    indexKeys: s?.index && typeof s.index === "object" ? Object.keys(s.index).length : 0,
    derivationKeys: s?.derivations && typeof s.derivations === "object" ? Object.keys(s.derivations).length : 0,
    refSubscriberKeys: s?.refSubscribers && typeof s.refSubscribers === "object" ? Object.keys(s.refSubscribers).length : 0,
    derivationRefVersionKeys:
      s?.derivationRefVersions && typeof s.derivationRefVersions === "object"
        ? Object.keys(s.derivationRefVersions).length
        : 0,
    branchStoreScopes: typeof store?.listScopes === "function" ? store.listScopes().length : 0,
    decryptedChunkCache: s?.decryptedBranchCache?.size ?? 0,
    staleDerivations: s?.staleDerivations?.size ?? 0,
  };
}

async function main() {
  console.log("=== FASE 2.2 WRITE-PRESSURE TEST ===");

  const tmp = "/tmp/me-fase2-pressure";
  fs.rmSync(tmp, { recursive: true, force: true });

  const me = new ME("sui", {
    store: new DiskStore({
      baseDir: tmp,
      maxHotBytes: MAX_HOT_BYTES,
    }),
  });

  me.memory["_"]("fase-2-pressure");

  const writeBatch = resolveBatchWriter(me);
  const t0 = performance.now();

  console.log(
    `Target: ${TOTAL.toLocaleString()} vectors | Hot: ${formatMb(MAX_HOT_BYTES)} | Batch: ${BATCH} | Dims: ${DIMS}`
  );
  console.log(
    `Heartbeat: cada ${(HEARTBEAT_EVERY_MS / 1000).toFixed(1)}s | primer reporte: ${FIRST_REPORT_AT.toLocaleString()} vectores | siguientes: ${REPORT_EVERY.toLocaleString()}`
  );
  console.log("vectors | preGCHeap | postGCHeap | retained | diskMB | genMs | commitMs | vps | mems | idxK | derivK | decCache | stale | scopes");

  let lastReportAt = 0;
  let nextCountReportAt = Math.min(TOTAL, Math.max(BATCH, FIRST_REPORT_AT));
  let lastHeartbeatAt = t0;
  let processedCount = 0;
  let lastPostGcHeap = 0;
  let peakPreGcHeap = 0;
  let peakPostGcHeap = 0;
  let peakRss = 0;
  let peakRetained = 0;
  let stopReason = "";

  for (let i = 0; i < TOTAL; i += BATCH) {
    const size = Math.min(BATCH, TOTAL - i);
    const processed = i + size;
    processedCount = processed;
    const { chunk, generateMs } = generateChunk(i, size, DIMS);
    const commitT0 = performance.now();
    writeBatch(i, chunk);
    const commitT1 = performance.now();
    const commitMs = commitT1 - commitT0;

    const now = performance.now();
    const shouldCountReport = processed >= nextCountReportAt || processed >= TOTAL;
    const shouldHeartbeat = now - lastHeartbeatAt >= HEARTBEAT_EVERY_MS;

    if (shouldCountReport || shouldHeartbeat) {
      const elapsedSeconds = (now - t0) / 1000;
      const logSize = fs.existsSync(`${tmp}/branch-store.log`) ? fs.statSync(`${tmp}/branch-store.log`).size : 0;
      const vps = processed / Math.max(1, elapsedSeconds);
      const preGc = memorySnapshot();
      peakPreGcHeap = Math.max(peakPreGcHeap, preGc.heapUsed);
      peakRss = Math.max(peakRss, preGc.rss);
      forceGc();
      const postGc = memorySnapshot();
      peakPostGcHeap = Math.max(peakPostGcHeap, postGc.heapUsed);
      peakRss = Math.max(peakRss, postGc.rss);
      const retained = lastPostGcHeap === 0
        ? postGc.heapUsed
        : Math.max(0, postGc.heapUsed - lastPostGcHeap);
      lastPostGcHeap = postGc.heapUsed;
      peakRetained = Math.max(peakRetained, retained);
      const struct = structuralSnapshot(me);
      const prefix = shouldCountReport ? "" : "[heartbeat] ";

      console.log(
        `${prefix}${Math.round(processed / 1000)}k | ` +
        `${formatMb(preGc.heapUsed)} | ` +
        `${formatMb(postGc.heapUsed)} | ` +
        `${formatMb(retained)} | ` +
        `${formatMb(logSize)} | ` +
        `${generateMs.toFixed(0)} | ` +
        `${commitMs.toFixed(0)} | ` +
        `${vps.toFixed(0)}`
        + ` | ${struct.memories}`
        + ` | ${struct.indexKeys}`
        + ` | ${struct.derivationKeys}`
        + ` | ${struct.decryptedChunkCache}`
        + ` | ${struct.staleDerivations}`
        + ` | ${struct.branchStoreScopes}`
      );

      lastHeartbeatAt = now;
      if (shouldCountReport) {
        lastReportAt = processed;
        nextCountReportAt = Math.min(TOTAL, processed + REPORT_EVERY);
      }

      if (postGc.heapUsed > MAX_POST_GC_HEAP_BYTES) {
        stopReason =
          `postGCHeap ${formatMb(postGc.heapUsed)} > threshold ${formatMb(MAX_POST_GC_HEAP_BYTES)}`;
        break;
      }
      if (retained > MAX_RETAINED_BYTES) {
        stopReason =
          `retained ${formatMb(retained)} > threshold ${formatMb(MAX_RETAINED_BYTES)}`;
        break;
      }
    }

  }

  const ms = performance.now() - t0;
  forceGc();
  const mem = memorySnapshot();
  const logSize = fs.existsSync(`${tmp}/branch-store.log`) ? fs.statSync(`${tmp}/branch-store.log`).size : 0;

  console.log("\n=== RESULTS ===");
  console.log(`Processed: ${processedCount.toLocaleString()} vectors`);
  console.log(`Target: ${TOTAL.toLocaleString()} vectors`);
  console.log(`Time: ${(ms / 1000 / 60).toFixed(1)} min`);
  console.log(`Final post-GC heap: ${formatMb(mem.heapUsed)}`);
  console.log(`Final RSS: ${formatMb(mem.rss)}`);
  console.log(`Peak pre-GC heap: ${formatMb(peakPreGcHeap)}`);
  console.log(`Peak post-GC heap: ${formatMb(peakPostGcHeap)}`);
  console.log(`Peak retained: ${formatMb(peakRetained)}`);
  console.log(`Peak RSS: ${formatMb(peakRss)}`);
  console.log(`Disk log: ${(logSize / 1e9).toFixed(2)} GB`);
  console.log(`Avg: ${(processedCount / (ms / 1000)).toFixed(0)} vps`);
  if (stopReason) {
    console.log(`Early stop: ${stopReason}`);
  }

  const heapOK = mem.heapUsed < MAX_POST_GC_HEAP_BYTES;
  const retainedOK = peakRetained <= MAX_RETAINED_BYTES;
  const diskOK = logSize > 2_000_000_000 || TOTAL < 2_000_000;
  console.log(heapOK ? "PASS: post-GC heap acotado" : "FAIL: post-GC heap explotó");
  console.log(retainedOK ? "PASS: retained controlado" : "FAIL: retained excesivo");
  console.log(diskOK ? "PASS: Spill a disco OK" : "FAIL: No escribió suficiente");

  if (!heapOK || !retainedOK || !diskOK || stopReason) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("CRASH:", error);
  process.exit(1);
});
