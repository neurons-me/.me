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

function emptyPersistDebugWindow() {
  return {
    writes: 0,
    columnarWrites: 0,
    maxBranchBytes: 0,
    maxCacheSeedBytes: 0,
    maxEncryptableBytes: 0,
    maxBlobBytes: 0,
    totalLoadChunkMs: 0,
    totalMaterializeMs: 0,
    totalCloneMs: 0,
    totalColumnarMaterializeMs: 0,
    totalPrepareColumnarMs: 0,
    totalEncryptMs: 0,
    totalSetBlobMs: 0,
    maxLoadChunkMs: 0,
    maxMaterializeMs: 0,
    maxCloneMs: 0,
    maxColumnarMaterializeMs: 0,
    maxPrepareColumnarMs: 0,
    maxEncryptMs: 0,
    maxSetBlobMs: 0,
  };
}

function takePersistDebugWindow(me) {
  if (typeof me?._takePersistSecretBranchDebugWindow === "function") {
    return me._takePersistSecretBranchDebugWindow();
  }

  const debug = me?.__persistSecretBranchDebug;
  const window = debug?.window ?? emptyPersistDebugWindow();
  if (debug) debug.window = emptyPersistDebugWindow();
  return window;
}

function structuralSnapshot(me) {
  const s = me;
  const store = s?.branchStore;
  const hot = typeof store?.getHotStats === "function" ? store.getHotStats() : {};
  const idx = typeof store?.getIndexStats === "function" ? store.getIndexStats() : {};

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
    hotEntries: hot.entries ?? 0,
    hotUsedMB: hot.usedBytes ? (hot.usedBytes / MB).toFixed(1) : "0.0",
    hotMaxMB: hot.maxBytes ? (hot.maxBytes / MB).toFixed(1) : "0.0",
    idxScopes: idx.scopes ?? 0,
    idxChunks: idx.chunks ?? 0,
    idxPointers: idx.pointers ?? 0,
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
  if (typeof me?._enablePersistSecretBranchDebug === "function") {
    me._enablePersistSecretBranchDebug(true);
  }

  me.memory["_"]("fase-2-pressure");

  const writeBatch = resolveBatchWriter(me);
  const t0 = performance.now();

  console.log(
    `Target: ${TOTAL.toLocaleString()} vectors | Hot: ${formatMb(MAX_HOT_BYTES)} | Batch: ${BATCH} | Dims: ${DIMS}`
  );
  console.log(
    `Heartbeat: cada ${(HEARTBEAT_EVERY_MS / 1000).toFixed(1)}s | primer reporte: ${FIRST_REPORT_AT.toLocaleString()} vectores | siguientes: ${REPORT_EVERY.toLocaleString()}`
  );
  console.log("vectors | preGCHeap | postGCHeap | retained | diskMB | genMs | commitMs | loadMs | matMs | cloneMs | colMs | prepMs | encMs | setMs | vps | mems | hotEnt | hotMB/max | idxScp | idxChk | idxPtr | decCache | stale | scopes | pWr | colWr | brMB | seedMB | encMB | blobMB");

  let lastReportAt = 0;
  let nextCountReportAt = Math.min(TOTAL, Math.max(BATCH, FIRST_REPORT_AT));
  let lastHeartbeatAt = t0;
  let processedCount = 0;
  let lastPostGcHeap = 0;
  let peakPreGcHeap = 0;
  let peakPostGcHeap = 0;
  let peakRss = 0;
  let peakRetained = 0;
  let peakBranchBytes = 0;
  let peakCacheSeedBytes = 0;
  let peakEncryptableBytes = 0;
  let peakBlobBytes = 0;
  let peakLoadWindowMs = 0;
  let peakMaterializeWindowMs = 0;
  let peakCloneWindowMs = 0;
  let peakColumnarWindowMs = 0;
  let peakPrepareWindowMs = 0;
  let peakEncryptWindowMs = 0;
  let peakSetBlobWindowMs = 0;
  let peakLoadSingleMs = 0;
  let peakMaterializeSingleMs = 0;
  let peakCloneSingleMs = 0;
  let peakColumnarSingleMs = 0;
  let peakPrepareSingleMs = 0;
  let peakEncryptSingleMs = 0;
  let peakSetBlobSingleMs = 0;
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
      const persist = {
        ...emptyPersistDebugWindow(),
        ...takePersistDebugWindow(me),
      };
      peakBranchBytes = Math.max(peakBranchBytes, persist.maxBranchBytes);
      peakCacheSeedBytes = Math.max(peakCacheSeedBytes, persist.maxCacheSeedBytes);
      peakEncryptableBytes = Math.max(peakEncryptableBytes, persist.maxEncryptableBytes);
      peakBlobBytes = Math.max(peakBlobBytes, persist.maxBlobBytes);
      peakLoadWindowMs = Math.max(peakLoadWindowMs, persist.totalLoadChunkMs);
      peakMaterializeWindowMs = Math.max(peakMaterializeWindowMs, persist.totalMaterializeMs);
      peakCloneWindowMs = Math.max(peakCloneWindowMs, persist.totalCloneMs);
      peakColumnarWindowMs = Math.max(peakColumnarWindowMs, persist.totalColumnarMaterializeMs);
      peakPrepareWindowMs = Math.max(peakPrepareWindowMs, persist.totalPrepareColumnarMs);
      peakEncryptWindowMs = Math.max(peakEncryptWindowMs, persist.totalEncryptMs);
      peakSetBlobWindowMs = Math.max(peakSetBlobWindowMs, persist.totalSetBlobMs);
      peakLoadSingleMs = Math.max(peakLoadSingleMs, persist.maxLoadChunkMs);
      peakMaterializeSingleMs = Math.max(peakMaterializeSingleMs, persist.maxMaterializeMs);
      peakCloneSingleMs = Math.max(peakCloneSingleMs, persist.maxCloneMs);
      peakColumnarSingleMs = Math.max(peakColumnarSingleMs, persist.maxColumnarMaterializeMs);
      peakPrepareSingleMs = Math.max(peakPrepareSingleMs, persist.maxPrepareColumnarMs);
      peakEncryptSingleMs = Math.max(peakEncryptSingleMs, persist.maxEncryptMs);
      peakSetBlobSingleMs = Math.max(peakSetBlobSingleMs, persist.maxSetBlobMs);
      const prefix = shouldCountReport ? "" : "[heartbeat] ";

      console.log(
        `${prefix}${Math.round(processed / 1000)}k | ` +
        `${formatMb(preGc.heapUsed)} | ` +
        `${formatMb(postGc.heapUsed)} | ` +
        `${formatMb(retained)} | ` +
        `${formatMb(logSize)} | ` +
        `${generateMs.toFixed(0)} | ` +
        `${commitMs.toFixed(0)} | ` +
        `${persist.totalLoadChunkMs.toFixed(0)} | ` +
        `${persist.totalMaterializeMs.toFixed(0)} | ` +
        `${persist.totalCloneMs.toFixed(0)} | ` +
        `${persist.totalColumnarMaterializeMs.toFixed(0)} | ` +
        `${persist.totalPrepareColumnarMs.toFixed(0)} | ` +
        `${persist.totalEncryptMs.toFixed(0)} | ` +
        `${persist.totalSetBlobMs.toFixed(0)} | ` +
        `${vps.toFixed(0)}`
        + ` | ${struct.memories}`
        + ` | ${struct.hotEntries}`
        + ` | ${struct.hotUsedMB}/${struct.hotMaxMB}`
        + ` | ${struct.idxScopes}`
        + ` | ${struct.idxChunks}`
        + ` | ${struct.idxPointers}`
        + ` | ${struct.decryptedChunkCache}`
        + ` | ${struct.staleDerivations}`
        + ` | ${struct.branchStoreScopes}`
        + ` | ${persist.writes}`
        + ` | ${persist.columnarWrites}`
        + ` | ${formatMb(persist.maxBranchBytes)}`
        + ` | ${formatMb(persist.maxCacheSeedBytes)}`
        + ` | ${formatMb(persist.maxEncryptableBytes)}`
        + ` | ${formatMb(persist.maxBlobBytes)}`
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
  console.log(`Peak branchObj: ${formatMb(peakBranchBytes)}`);
  console.log(`Peak cacheSeed: ${formatMb(peakCacheSeedBytes)}`);
  console.log(`Peak encryptable: ${formatMb(peakEncryptableBytes)}`);
  console.log(`Peak blob: ${formatMb(peakBlobBytes)}`);
  console.log(`Peak load window: ${peakLoadWindowMs.toFixed(0)}ms`);
  console.log(`Peak materialize window: ${peakMaterializeWindowMs.toFixed(0)}ms`);
  console.log(`Peak clone window: ${peakCloneWindowMs.toFixed(0)}ms`);
  console.log(`Peak columnar window: ${peakColumnarWindowMs.toFixed(0)}ms`);
  console.log(`Peak prepare window: ${peakPrepareWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt window: ${peakEncryptWindowMs.toFixed(0)}ms`);
  console.log(`Peak setChunkBlob window: ${peakSetBlobWindowMs.toFixed(0)}ms`);
  console.log(`Peak load single: ${peakLoadSingleMs.toFixed(0)}ms`);
  console.log(`Peak materialize single: ${peakMaterializeSingleMs.toFixed(0)}ms`);
  console.log(`Peak clone single: ${peakCloneSingleMs.toFixed(0)}ms`);
  console.log(`Peak columnar single: ${peakColumnarSingleMs.toFixed(0)}ms`);
  console.log(`Peak prepare single: ${peakPrepareSingleMs.toFixed(0)}ms`);
  console.log(`Peak encrypt single: ${peakEncryptSingleMs.toFixed(0)}ms`);
  console.log(`Peak setChunkBlob single: ${peakSetBlobSingleMs.toFixed(0)}ms`);
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
