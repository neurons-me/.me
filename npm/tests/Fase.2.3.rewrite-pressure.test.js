import * as ThisMeModule from "../dist/me.es.js";
import fs from "node:fs";

const ME = ThisMeModule.default;
const { DiskStore } = ME;

const MB = 1024 * 1024;
const TOTAL_REWRITES = Number(process.env.TOTAL_REWRITES) || 200_000;
const WORKING_SET = Number(process.env.WORKING_SET) || 4_096;
const BATCH = Number(process.env.BATCH_SIZE) || 512;
const DIMS = Number(process.env.DIMS) || 1536;
const REPORT_EVERY = Number(process.env.REPORT_EVERY) || 10_000;
const MAX_HOT_BYTES = Number(process.env.MAX_HOT_BYTES) || 250_000_000;
const FIRST_REPORT_AT = Number(process.env.FIRST_REPORT_AT) || Math.min(REPORT_EVERY, 10_000);
const HEARTBEAT_EVERY_MS = Number(process.env.HEARTBEAT_EVERY_MS) || 5_000;
const MAX_POST_GC_HEAP_BYTES = Number(process.env.MAX_POST_GC_HEAP_BYTES) || 600 * MB;
const MAX_RETAINED_BYTES = Number(process.env.MAX_RETAINED_BYTES) || 250 * MB;
const WRITE_BRANCH_CACHE = /^(1|true|on)$/i.test(process.env.WRITE_BRANCH_CACHE || "");
const WRITE_BRANCH_CACHE_LIMIT = Number(process.env.WRITE_BRANCH_CACHE_LIMIT) || 8;

function formatMb(bytes) {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function formatMs(ms) {
  return Number(ms || 0).toFixed(1);
}

function memorySnapshot() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    rss: mem.rss,
  };
}

function generateEmbedding(index, dims, revision) {
  const out = new Array(dims);
  for (let j = 0; j < dims; j++) {
    out[j] = ((index * 31 + revision * 29 + j * 17) % 1000) / 1000;
  }
  return out;
}

function generateChunk(start, size, dims = DIMS, revision = 0) {
  const t0 = performance.now();
  const now = Date.now();
  const arr = new Array(size);
  for (let i = 0; i < size; i++) {
    const id = start + i;
    arr[i] = {
      id,
      revision,
      embedding: generateEmbedding(id, dims, revision),
      timestamp: now - revision * 1000 - id,
      text: `rewrite-item-${id}-rev-${revision}`,
      kind: "episodic",
      processed: (id + revision) % 2 === 0,
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
    throw new Error("commitIndexedBatch is not reachable from the Phase 2.3 benchmark runtime.");
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
    writeCacheHits: 0,
    writeCacheMisses: 0,
    totalWriteCacheHitMs: 0,
    maxWriteCacheHitMs: 0,
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

function emptyDecryptDebugWindow() {
  return {
    calls: 0,
    hits: 0,
    misses: 0,
    v2Misses: 0,
    v3Misses: 0,
    totalHitMs: 0,
    totalMissMs: 0,
    totalDecryptMs: 0,
    totalDecodeMs: 0,
    maxHitMs: 0,
    maxMissMs: 0,
    maxDecryptMs: 0,
    maxDecodeMs: 0,
  };
}

function takeDecryptDebugWindow(me) {
  if (typeof me?._takeDecryptedChunkDebugWindow === "function") {
    return me._takeDecryptedChunkDebugWindow();
  }

  const debug = me?.__decryptedChunkDebug;
  const window = debug?.window ?? emptyDecryptDebugWindow();
  if (debug) debug.window = emptyDecryptDebugWindow();
  return window;
}

function emptyBlobCryptoDebugWindow() {
  return {
    encryptCalls: 0,
    decryptCalls: 0,
    maxJsonBytes: 0,
    maxClearBytes: 0,
    maxKeystreamBytes: 0,
    maxCiphertextBytes: 0,
    maxHexBytes: 0,
    maxEncryptResidentBytes: 0,
    maxDecodedBytes: 0,
    maxDecryptClearBytes: 0,
    maxDecryptJsonBytes: 0,
    maxDecryptResidentBytes: 0,
    maxEncryptHeapDelta: 0,
    maxEncryptExternalDelta: 0,
    maxEncryptArrayBuffersDelta: 0,
    maxDecryptHeapDelta: 0,
    maxDecryptExternalDelta: 0,
    maxDecryptArrayBuffersDelta: 0,
  };
}

function takeBlobCryptoDebugWindow(me) {
  if (typeof me?._takeBlobCryptoDebugWindow === "function") {
    return me._takeBlobCryptoDebugWindow();
  }
  return emptyBlobCryptoDebugWindow();
}

function emptyDiskStoreDebugWindow() {
  return {
    appendCalls: 0,
    readCalls: 0,
    flushCalls: 0,
    maxBlobBytes: 0,
    maxRecordBytes: 0,
    maxAppendResidentBytes: 0,
    maxReadBufferBytes: 0,
    maxReadResidentBytes: 0,
    maxFlushIndexBytes: 0,
    maxAppendHeapDelta: 0,
    maxAppendExternalDelta: 0,
    maxAppendArrayBuffersDelta: 0,
    maxReadHeapDelta: 0,
    maxReadExternalDelta: 0,
    maxReadArrayBuffersDelta: 0,
    maxFlushHeapDelta: 0,
    maxFlushExternalDelta: 0,
    maxFlushArrayBuffersDelta: 0,
  };
}

function takeDiskStoreDebugWindow(me) {
  if (typeof me?._takeDiskStoreDebugWindow === "function") {
    return me._takeDiskStoreDebugWindow();
  }
  return emptyDiskStoreDebugWindow();
}

function structuralSnapshot(me) {
  const s = me;
  const store = s?.branchStore;
  const hot = typeof store?.getHotStats === "function" ? store.getHotStats() : {};
  const idx = typeof store?.getIndexStats === "function" ? store.getIndexStats() : {};

  return {
    memories: Array.isArray(s?._memories) ? s._memories.length : 0,
    decryptedChunkCache: s?.decryptedBranchCache?.size ?? 0,
    staleDerivations: s?.staleDerivations?.size ?? 0,
    hotEntries: hot.entries ?? 0,
    hotUsedMB: hot.usedBytes ? (hot.usedBytes / MB).toFixed(1) : "0.0",
    hotMaxMB: hot.maxBytes ? (hot.maxBytes / MB).toFixed(1) : "0.0",
    idxScopes: idx.scopes ?? 0,
    idxChunks: idx.chunks ?? 0,
    idxPointers: idx.pointers ?? 0,
    branchStoreScopes: typeof store?.listScopes === "function" ? store.listScopes().length : 0,
  };
}

async function main() {
  if (WORKING_SET <= 0 || BATCH <= 0 || TOTAL_REWRITES <= 0) {
    throw new Error("WORKING_SET, BATCH_SIZE, and TOTAL_REWRITES must be positive.");
  }
  if (WORKING_SET % BATCH !== 0) {
    throw new Error(`WORKING_SET (${WORKING_SET}) must be divisible by BATCH_SIZE (${BATCH}) for deterministic rewrites.`);
  }

  console.log("=== FASE 2.3 REWRITE-PRESSURE TEST ===");

  const tmp = "/tmp/me-fase2-rewrite";
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
  if (typeof me?._configureWriteBranchCache === "function") {
    me._configureWriteBranchCache(WRITE_BRANCH_CACHE, WRITE_BRANCH_CACHE_LIMIT);
  }
  if (typeof me?._enableDecryptedChunkDebug === "function") {
    me._enableDecryptedChunkDebug(true);
  }
  if (typeof me?._enableBlobCryptoDebug === "function") {
    me._enableBlobCryptoDebug(true);
  }
  if (typeof me?._enableDiskStoreDebug === "function") {
    me._enableDiskStoreDebug(true);
  }

  me.memory["_"]("fase-2-rewrite");

  const writeBatch = resolveBatchWriter(me);
  const secretChunkSize = Number(me?.secretChunkSize) || 256;
  const estimatedChunks = Math.ceil(WORKING_SET / secretChunkSize);
  const windows = WORKING_SET / BATCH;

  console.log(
    `Working set: ${WORKING_SET.toLocaleString()} vectors | rewrite target: ${TOTAL_REWRITES.toLocaleString()} | Batch: ${BATCH} | Dims: ${DIMS}`
  );
  console.log(
    `Chunk size: ${secretChunkSize} | estimated chunks: ${estimatedChunks} | rewrite windows: ${windows} | Hot: ${formatMb(MAX_HOT_BYTES)}`
  );
  console.log(
    `Write cache: ${WRITE_BRANCH_CACHE ? `on (${WRITE_BRANCH_CACHE_LIMIT} entries)` : "off"}`
  );

  console.log("\n[seed]");
  const seedStartedAt = performance.now();
  for (let start = 0; start < WORKING_SET; start += BATCH) {
    const { chunk } = generateChunk(start, BATCH, DIMS, 0);
    writeBatch(start, chunk);
  }
  const seedMs = performance.now() - seedStartedAt;
  takePersistDebugWindow(me);
  takeDecryptDebugWindow(me);
  forceGc();
  const seededMem = memorySnapshot();
  const seededLogSize = fs.existsSync(`${tmp}/branch-store.log`) ? fs.statSync(`${tmp}/branch-store.log`).size : 0;
  console.log(
    `seed complete | time=${formatMs(seedMs)}ms | postGCHeap=${formatMb(seededMem.heapUsed)} | disk=${formatMb(seededLogSize)}`
  );

  const t0 = performance.now();
  console.log("\n[rewrite]");
  console.log(
    `Heartbeat: cada ${(HEARTBEAT_EVERY_MS / 1000).toFixed(1)}s | primer reporte: ${FIRST_REPORT_AT.toLocaleString()} reescrituras | siguientes: ${REPORT_EVERY.toLocaleString()}`
  );
  console.log("rewrites | window | preGCHeap | postGCHeap | extMB | abMB | retained | diskMB | genMs | commitMs | loadMs | matMs | cloneMs | colMs | prepMs | encMs | setMs | eCryMB | dCryMB | recMB | rbufMB | fidxMB | wHit/miss | wHitMs | hit/miss | hitMs | missMs | decMs | decdMs | vps | mems | hotEnt | hotMB/max | idxChk | decCache | pWr | brMB | blobMB");

  let nextCountReportAt = Math.min(TOTAL_REWRITES, Math.max(BATCH, FIRST_REPORT_AT));
  let lastHeartbeatAt = t0;
  let rewrittenCount = 0;
  let lastPostGcHeap = 0;
  let peakPreGcHeap = 0;
  let peakPostGcHeap = 0;
  let peakExternal = 0;
  let peakArrayBuffers = 0;
  let peakRetained = 0;
  let peakRss = 0;
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
  let peakBranchBytes = 0;
  let peakBlobBytes = 0;
  let totalWriteCacheHits = 0;
  let totalWriteCacheMisses = 0;
  let peakWriteCacheHitMs = 0;
  let totalDecryptHits = 0;
  let totalDecryptMisses = 0;
  let totalV2Misses = 0;
  let totalV3Misses = 0;
  let peakHitWindowMs = 0;
  let peakMissWindowMs = 0;
  let peakDecryptWindowMs = 0;
  let peakDecodeWindowMs = 0;
  let peakHitSingleMs = 0;
  let peakMissSingleMs = 0;
  let peakDecryptSingleMs = 0;
  let peakDecodeSingleMs = 0;
  let peakEncryptJsonBytes = 0;
  let peakEncryptClearBytes = 0;
  let peakEncryptKeystreamBytes = 0;
  let peakEncryptCiphertextBytes = 0;
  let peakEncryptHexBytes = 0;
  let peakEncryptResidentBytes = 0;
  let peakDecryptDecodedBytes = 0;
  let peakDecryptClearBytes = 0;
  let peakDecryptJsonBytes = 0;
  let peakDecryptResidentBytes = 0;
  let peakCryptoEncryptHeapDelta = 0;
  let peakCryptoEncryptExternalDelta = 0;
  let peakCryptoEncryptArrayBuffersDelta = 0;
  let peakCryptoDecryptHeapDelta = 0;
  let peakCryptoDecryptExternalDelta = 0;
  let peakCryptoDecryptArrayBuffersDelta = 0;
  let peakDiskRecordBytes = 0;
  let peakDiskAppendResidentBytes = 0;
  let peakDiskReadBufferBytes = 0;
  let peakDiskReadResidentBytes = 0;
  let peakDiskFlushIndexBytes = 0;
  let peakDiskAppendHeapDelta = 0;
  let peakDiskAppendExternalDelta = 0;
  let peakDiskAppendArrayBuffersDelta = 0;
  let peakDiskReadHeapDelta = 0;
  let peakDiskReadExternalDelta = 0;
  let peakDiskReadArrayBuffersDelta = 0;
  let peakDiskFlushHeapDelta = 0;
  let peakDiskFlushExternalDelta = 0;
  let peakDiskFlushArrayBuffersDelta = 0;
  let stopReason = "";

  for (let rewritten = 0, batchIndex = 0; rewritten < TOTAL_REWRITES; rewritten += BATCH, batchIndex++) {
    const size = Math.min(BATCH, TOTAL_REWRITES - rewritten);
    const windowIndex = batchIndex % windows;
    const startIndex = windowIndex * BATCH;
    const revision = batchIndex + 1;
    rewrittenCount = rewritten + size;

    const { chunk, generateMs } = generateChunk(startIndex, size, DIMS, revision);
    const commitT0 = performance.now();
    writeBatch(startIndex, chunk);
    const commitT1 = performance.now();
    const commitMs = commitT1 - commitT0;

    const now = performance.now();
    const shouldCountReport = rewrittenCount >= nextCountReportAt || rewrittenCount >= TOTAL_REWRITES;
    const shouldHeartbeat = now - lastHeartbeatAt >= HEARTBEAT_EVERY_MS;

    if (shouldCountReport || shouldHeartbeat) {
      const elapsedSeconds = (now - t0) / 1000;
      const logSize = fs.existsSync(`${tmp}/branch-store.log`) ? fs.statSync(`${tmp}/branch-store.log`).size : 0;
      const vps = rewrittenCount / Math.max(1, elapsedSeconds);
      const preGc = memorySnapshot();
      peakPreGcHeap = Math.max(peakPreGcHeap, preGc.heapUsed);
      peakExternal = Math.max(peakExternal, preGc.external);
      peakArrayBuffers = Math.max(peakArrayBuffers, preGc.arrayBuffers);
      peakRss = Math.max(peakRss, preGc.rss);
      forceGc();
      const postGc = memorySnapshot();
      peakPostGcHeap = Math.max(peakPostGcHeap, postGc.heapUsed);
      peakExternal = Math.max(peakExternal, postGc.external);
      peakArrayBuffers = Math.max(peakArrayBuffers, postGc.arrayBuffers);
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
      const decrypt = {
        ...emptyDecryptDebugWindow(),
        ...takeDecryptDebugWindow(me),
      };
      const crypto = {
        ...emptyBlobCryptoDebugWindow(),
        ...takeBlobCryptoDebugWindow(me),
      };
      const disk = {
        ...emptyDiskStoreDebugWindow(),
        ...takeDiskStoreDebugWindow(me),
      };

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
      peakBranchBytes = Math.max(peakBranchBytes, persist.maxBranchBytes);
      peakBlobBytes = Math.max(peakBlobBytes, persist.maxBlobBytes);
      totalWriteCacheHits += persist.writeCacheHits;
      totalWriteCacheMisses += persist.writeCacheMisses;
      peakWriteCacheHitMs = Math.max(peakWriteCacheHitMs, persist.maxWriteCacheHitMs);
      totalDecryptHits += decrypt.hits;
      totalDecryptMisses += decrypt.misses;
      totalV2Misses += decrypt.v2Misses;
      totalV3Misses += decrypt.v3Misses;
      peakHitWindowMs = Math.max(peakHitWindowMs, decrypt.totalHitMs);
      peakMissWindowMs = Math.max(peakMissWindowMs, decrypt.totalMissMs);
      peakDecryptWindowMs = Math.max(peakDecryptWindowMs, decrypt.totalDecryptMs);
      peakDecodeWindowMs = Math.max(peakDecodeWindowMs, decrypt.totalDecodeMs);
      peakHitSingleMs = Math.max(peakHitSingleMs, decrypt.maxHitMs);
      peakMissSingleMs = Math.max(peakMissSingleMs, decrypt.maxMissMs);
      peakDecryptSingleMs = Math.max(peakDecryptSingleMs, decrypt.maxDecryptMs);
      peakDecodeSingleMs = Math.max(peakDecodeSingleMs, decrypt.maxDecodeMs);
      peakEncryptJsonBytes = Math.max(peakEncryptJsonBytes, crypto.maxJsonBytes);
      peakEncryptClearBytes = Math.max(peakEncryptClearBytes, crypto.maxClearBytes);
      peakEncryptKeystreamBytes = Math.max(peakEncryptKeystreamBytes, crypto.maxKeystreamBytes);
      peakEncryptCiphertextBytes = Math.max(peakEncryptCiphertextBytes, crypto.maxCiphertextBytes);
      peakEncryptHexBytes = Math.max(peakEncryptHexBytes, crypto.maxHexBytes);
      peakEncryptResidentBytes = Math.max(peakEncryptResidentBytes, crypto.maxEncryptResidentBytes);
      peakDecryptDecodedBytes = Math.max(peakDecryptDecodedBytes, crypto.maxDecodedBytes);
      peakDecryptClearBytes = Math.max(peakDecryptClearBytes, crypto.maxDecryptClearBytes);
      peakDecryptJsonBytes = Math.max(peakDecryptJsonBytes, crypto.maxDecryptJsonBytes);
      peakDecryptResidentBytes = Math.max(peakDecryptResidentBytes, crypto.maxDecryptResidentBytes);
      peakCryptoEncryptHeapDelta = Math.max(peakCryptoEncryptHeapDelta, crypto.maxEncryptHeapDelta);
      peakCryptoEncryptExternalDelta = Math.max(peakCryptoEncryptExternalDelta, crypto.maxEncryptExternalDelta);
      peakCryptoEncryptArrayBuffersDelta = Math.max(
        peakCryptoEncryptArrayBuffersDelta,
        crypto.maxEncryptArrayBuffersDelta,
      );
      peakCryptoDecryptHeapDelta = Math.max(peakCryptoDecryptHeapDelta, crypto.maxDecryptHeapDelta);
      peakCryptoDecryptExternalDelta = Math.max(peakCryptoDecryptExternalDelta, crypto.maxDecryptExternalDelta);
      peakCryptoDecryptArrayBuffersDelta = Math.max(
        peakCryptoDecryptArrayBuffersDelta,
        crypto.maxDecryptArrayBuffersDelta,
      );
      peakDiskRecordBytes = Math.max(peakDiskRecordBytes, disk.maxRecordBytes);
      peakDiskAppendResidentBytes = Math.max(peakDiskAppendResidentBytes, disk.maxAppendResidentBytes);
      peakDiskReadBufferBytes = Math.max(peakDiskReadBufferBytes, disk.maxReadBufferBytes);
      peakDiskReadResidentBytes = Math.max(peakDiskReadResidentBytes, disk.maxReadResidentBytes);
      peakDiskFlushIndexBytes = Math.max(peakDiskFlushIndexBytes, disk.maxFlushIndexBytes);
      peakDiskAppendHeapDelta = Math.max(peakDiskAppendHeapDelta, disk.maxAppendHeapDelta);
      peakDiskAppendExternalDelta = Math.max(peakDiskAppendExternalDelta, disk.maxAppendExternalDelta);
      peakDiskAppendArrayBuffersDelta = Math.max(
        peakDiskAppendArrayBuffersDelta,
        disk.maxAppendArrayBuffersDelta,
      );
      peakDiskReadHeapDelta = Math.max(peakDiskReadHeapDelta, disk.maxReadHeapDelta);
      peakDiskReadExternalDelta = Math.max(peakDiskReadExternalDelta, disk.maxReadExternalDelta);
      peakDiskReadArrayBuffersDelta = Math.max(
        peakDiskReadArrayBuffersDelta,
        disk.maxReadArrayBuffersDelta,
      );
      peakDiskFlushHeapDelta = Math.max(peakDiskFlushHeapDelta, disk.maxFlushHeapDelta);
      peakDiskFlushExternalDelta = Math.max(peakDiskFlushExternalDelta, disk.maxFlushExternalDelta);
      peakDiskFlushArrayBuffersDelta = Math.max(
        peakDiskFlushArrayBuffersDelta,
        disk.maxFlushArrayBuffersDelta,
      );

      const prefix = shouldCountReport ? "" : "[heartbeat] ";
      console.log(
        `${prefix}${Math.round(rewrittenCount / 1000)}k | ` +
        `${windowIndex}/${windows} | ` +
        `${formatMb(preGc.heapUsed)} | ` +
        `${formatMb(postGc.heapUsed)} | ` +
        `${formatMb(postGc.external)} | ` +
        `${formatMb(postGc.arrayBuffers)} | ` +
        `${formatMb(retained)} | ` +
        `${formatMb(logSize)} | ` +
        `${formatMs(generateMs)} | ` +
        `${formatMs(commitMs)} | ` +
        `${formatMs(persist.totalLoadChunkMs)} | ` +
        `${formatMs(persist.totalMaterializeMs)} | ` +
        `${formatMs(persist.totalCloneMs)} | ` +
        `${formatMs(persist.totalColumnarMaterializeMs)} | ` +
        `${formatMs(persist.totalPrepareColumnarMs)} | ` +
        `${formatMs(persist.totalEncryptMs)} | ` +
        `${formatMs(persist.totalSetBlobMs)} | ` +
        `${formatMb(crypto.maxEncryptResidentBytes)} | ` +
        `${formatMb(crypto.maxDecryptResidentBytes)} | ` +
        `${formatMb(disk.maxRecordBytes)} | ` +
        `${formatMb(disk.maxReadBufferBytes)} | ` +
        `${formatMb(disk.maxFlushIndexBytes)} | ` +
        `${persist.writeCacheHits}/${persist.writeCacheMisses} | ` +
        `${formatMs(persist.totalWriteCacheHitMs)} | ` +
        `${decrypt.hits}/${decrypt.misses} | ` +
        `${formatMs(decrypt.totalHitMs)} | ` +
        `${formatMs(decrypt.totalMissMs)} | ` +
        `${formatMs(decrypt.totalDecryptMs)} | ` +
        `${formatMs(decrypt.totalDecodeMs)} | ` +
        `${vps.toFixed(0)}`
        + ` | ${struct.memories}`
        + ` | ${struct.hotEntries}`
        + ` | ${struct.hotUsedMB}/${struct.hotMaxMB}`
        + ` | ${struct.idxChunks}`
        + ` | ${struct.decryptedChunkCache}`
        + ` | ${persist.writes}`
        + ` | ${formatMb(persist.maxBranchBytes)}`
        + ` | ${formatMb(persist.maxBlobBytes)}`
      );

      lastHeartbeatAt = now;
      if (shouldCountReport) {
        nextCountReportAt = Math.min(TOTAL_REWRITES, rewrittenCount + REPORT_EVERY);
      }

      if (postGc.heapUsed > MAX_POST_GC_HEAP_BYTES) {
        stopReason = `postGCHeap ${formatMb(postGc.heapUsed)} > threshold ${formatMb(MAX_POST_GC_HEAP_BYTES)}`;
        break;
      }
      if (retained > MAX_RETAINED_BYTES) {
        stopReason = `retained ${formatMb(retained)} > threshold ${formatMb(MAX_RETAINED_BYTES)}`;
        break;
      }
    }
  }

  const ms = performance.now() - t0;
  forceGc();
  const mem = memorySnapshot();
  const logSize = fs.existsSync(`${tmp}/branch-store.log`) ? fs.statSync(`${tmp}/branch-store.log`).size : 0;

  console.log("\n=== RESULTS ===");
  console.log(`Rewritten: ${rewrittenCount.toLocaleString()} vectors`);
  console.log(`Working set: ${WORKING_SET.toLocaleString()} vectors`);
  console.log(`Time: ${(ms / 1000 / 60).toFixed(1)} min`);
  console.log(`Final post-GC heap: ${formatMb(mem.heapUsed)}`);
  console.log(`Final external: ${formatMb(mem.external)}`);
  console.log(`Final arrayBuffers: ${formatMb(mem.arrayBuffers)}`);
  console.log(`Final RSS: ${formatMb(mem.rss)}`);
  console.log(`Peak pre-GC heap: ${formatMb(peakPreGcHeap)}`);
  console.log(`Peak post-GC heap: ${formatMb(peakPostGcHeap)}`);
  console.log(`Peak external: ${formatMb(peakExternal)}`);
  console.log(`Peak arrayBuffers: ${formatMb(peakArrayBuffers)}`);
  console.log(`Peak retained: ${formatMb(peakRetained)}`);
  console.log(`Peak RSS: ${formatMb(peakRss)}`);
  console.log(`Peak branchObj: ${formatMb(peakBranchBytes)}`);
  console.log(`Peak blob: ${formatMb(peakBlobBytes)}`);
  console.log(`Peak encrypt json: ${formatMb(peakEncryptJsonBytes)}`);
  console.log(`Peak encrypt clear: ${formatMb(peakEncryptClearBytes)}`);
  console.log(`Peak encrypt keystream: ${formatMb(peakEncryptKeystreamBytes)}`);
  console.log(`Peak encrypt ciphertext: ${formatMb(peakEncryptCiphertextBytes)}`);
  console.log(`Peak encrypt hex: ${formatMb(peakEncryptHexBytes)}`);
  console.log(`Peak encrypt resident: ${formatMb(peakEncryptResidentBytes)}`);
  console.log(`Peak decrypt decoded: ${formatMb(peakDecryptDecodedBytes)}`);
  console.log(`Peak decrypt clear: ${formatMb(peakDecryptClearBytes)}`);
  console.log(`Peak decrypt json: ${formatMb(peakDecryptJsonBytes)}`);
  console.log(`Peak decrypt resident: ${formatMb(peakDecryptResidentBytes)}`);
  console.log(`Peak disk record: ${formatMb(peakDiskRecordBytes)}`);
  console.log(`Peak disk append resident: ${formatMb(peakDiskAppendResidentBytes)}`);
  console.log(`Peak disk read buffer: ${formatMb(peakDiskReadBufferBytes)}`);
  console.log(`Peak disk read resident: ${formatMb(peakDiskReadResidentBytes)}`);
  console.log(`Peak disk flush index: ${formatMb(peakDiskFlushIndexBytes)}`);
  console.log(`Peak crypto encrypt heap delta: ${formatMb(peakCryptoEncryptHeapDelta)}`);
  console.log(`Peak crypto encrypt external delta: ${formatMb(peakCryptoEncryptExternalDelta)}`);
  console.log(`Peak crypto encrypt arrayBuffers delta: ${formatMb(peakCryptoEncryptArrayBuffersDelta)}`);
  console.log(`Peak crypto decrypt heap delta: ${formatMb(peakCryptoDecryptHeapDelta)}`);
  console.log(`Peak crypto decrypt external delta: ${formatMb(peakCryptoDecryptExternalDelta)}`);
  console.log(`Peak crypto decrypt arrayBuffers delta: ${formatMb(peakCryptoDecryptArrayBuffersDelta)}`);
  console.log(`Peak disk append heap delta: ${formatMb(peakDiskAppendHeapDelta)}`);
  console.log(`Peak disk append external delta: ${formatMb(peakDiskAppendExternalDelta)}`);
  console.log(`Peak disk append arrayBuffers delta: ${formatMb(peakDiskAppendArrayBuffersDelta)}`);
  console.log(`Peak disk read heap delta: ${formatMb(peakDiskReadHeapDelta)}`);
  console.log(`Peak disk read external delta: ${formatMb(peakDiskReadExternalDelta)}`);
  console.log(`Peak disk read arrayBuffers delta: ${formatMb(peakDiskReadArrayBuffersDelta)}`);
  console.log(`Peak disk flush heap delta: ${formatMb(peakDiskFlushHeapDelta)}`);
  console.log(`Peak disk flush external delta: ${formatMb(peakDiskFlushExternalDelta)}`);
  console.log(`Peak disk flush arrayBuffers delta: ${formatMb(peakDiskFlushArrayBuffersDelta)}`);
  console.log(`Peak load window: ${formatMs(peakLoadWindowMs)}ms`);
  console.log(`Peak materialize window: ${formatMs(peakMaterializeWindowMs)}ms`);
  console.log(`Peak clone window: ${formatMs(peakCloneWindowMs)}ms`);
  console.log(`Peak columnar window: ${formatMs(peakColumnarWindowMs)}ms`);
  console.log(`Peak prepare window: ${formatMs(peakPrepareWindowMs)}ms`);
  console.log(`Peak encrypt window: ${formatMs(peakEncryptWindowMs)}ms`);
  console.log(`Peak setChunkBlob window: ${formatMs(peakSetBlobWindowMs)}ms`);
  console.log(`Peak hit window: ${formatMs(peakHitWindowMs)}ms`);
  console.log(`Peak miss window: ${formatMs(peakMissWindowMs)}ms`);
  console.log(`Peak decrypt window: ${formatMs(peakDecryptWindowMs)}ms`);
  console.log(`Peak decode window: ${formatMs(peakDecodeWindowMs)}ms`);
  console.log(`Peak load single: ${formatMs(peakLoadSingleMs)}ms`);
  console.log(`Peak materialize single: ${formatMs(peakMaterializeSingleMs)}ms`);
  console.log(`Peak clone single: ${formatMs(peakCloneSingleMs)}ms`);
  console.log(`Peak columnar single: ${formatMs(peakColumnarSingleMs)}ms`);
  console.log(`Peak prepare single: ${formatMs(peakPrepareSingleMs)}ms`);
  console.log(`Peak encrypt single: ${formatMs(peakEncryptSingleMs)}ms`);
  console.log(`Peak setChunkBlob single: ${formatMs(peakSetBlobSingleMs)}ms`);
  console.log(`Write-cache hits/misses: ${totalWriteCacheHits}/${totalWriteCacheMisses}`);
  console.log(`Peak write-cache hit: ${formatMs(peakWriteCacheHitMs)}ms`);
  console.log(`Peak hit single: ${formatMs(peakHitSingleMs)}ms`);
  console.log(`Peak miss single: ${formatMs(peakMissSingleMs)}ms`);
  console.log(`Peak decrypt single: ${formatMs(peakDecryptSingleMs)}ms`);
  console.log(`Peak decode single: ${formatMs(peakDecodeSingleMs)}ms`);
  console.log(`Decrypt hits/misses: ${totalDecryptHits}/${totalDecryptMisses} (v3=${totalV3Misses}, v2=${totalV2Misses})`);
  console.log(`Disk log: ${(logSize / 1e9).toFixed(2)} GB`);
  console.log(`Avg: ${(rewrittenCount / (ms / 1000)).toFixed(0)} rewrites/s`);
  if (stopReason) {
    console.log(`Early stop: ${stopReason}`);
  }

  const heapOK = mem.heapUsed < MAX_POST_GC_HEAP_BYTES;
  const retainedOK = peakRetained <= MAX_RETAINED_BYTES;
  console.log(heapOK ? "PASS: post-GC heap acotado" : "FAIL: post-GC heap explotó");
  console.log(retainedOK ? "PASS: retained controlado" : "FAIL: retained excesivo");

  if (!heapOK || !retainedOK || stopReason) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("CRASH:", error);
  process.exit(1);
});
