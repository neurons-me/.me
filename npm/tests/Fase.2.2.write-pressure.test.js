//.me/npm/tests/Fase.2.2.write-pressure.test.js
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
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
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
    totalKeyDeriveMs: 0,
    totalEncryptMs: 0,
    totalSetBlobMs: 0,
    maxLoadChunkMs: 0,
    maxMaterializeMs: 0,
    maxCloneMs: 0,
    maxColumnarMaterializeMs: 0,
    maxPrepareColumnarMs: 0,
    maxKeyDeriveMs: 0,
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

function emptyBlobCryptoDebugWindow() {
  return {
    encryptCalls: 0,
    decryptCalls: 0,
    totalEncryptJsonMs: 0,
    totalEncryptAsciiMs: 0,
    totalEncryptKeystreamMs: 0,
    totalEncryptXorMs: 0,
    totalEncryptEncodeMs: 0,
    maxEncryptJsonMs: 0,
    maxEncryptAsciiMs: 0,
    maxEncryptKeystreamMs: 0,
    maxEncryptXorMs: 0,
    maxEncryptEncodeMs: 0,
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
    totalRecordStringifyMs: 0,
    totalAppendMs: 0,
    totalReadMs: 0,
    totalFlushMs: 0,
    maxRecordStringifyMs: 0,
    maxAppendMs: 0,
    maxReadMs: 0,
    maxFlushMs: 0,
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
  if (typeof me?._enableBlobCryptoDebug === "function") {
    me._enableBlobCryptoDebug(true);
  }
  if (typeof me?._enableDiskStoreDebug === "function") {
    me._enableDiskStoreDebug(true);
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
  console.log("vectors | preGCHeap | postGCHeap | extMB | abMB | retained | diskMB | genMs | commitMs | loadMs | matMs | cloneMs | colMs | prepMs | encMs | setMs | appMs | flushMs | readMs | cryMB | recMB | rbufMB | fidxMB | vps | mems | hotEnt | hotMB/max | idxScp | idxChk | idxPtr | decCache | stale | scopes | pWr | colWr | brMB | seedMB | encMB | blobMB");

  let lastReportAt = 0;
  let nextCountReportAt = Math.min(TOTAL, Math.max(BATCH, FIRST_REPORT_AT));
  let lastHeartbeatAt = t0;
  let processedCount = 0;
  let lastPostGcHeap = 0;
  let peakPreGcHeap = 0;
  let peakPostGcHeap = 0;
  let peakExternal = 0;
  let peakArrayBuffers = 0;
  let peakRss = 0;
  let peakRetained = 0;
  let peakBranchBytes = 0;
  let peakCacheSeedBytes = 0;
  let peakEncryptableBytes = 0;
  let peakBlobBytes = 0;
  let peakEncryptJsonBytes = 0;
  let peakEncryptClearBytes = 0;
  let peakEncryptKeystreamBytes = 0;
  let peakEncryptCiphertextBytes = 0;
  let peakEncryptHexBytes = 0;
  let peakEncryptJsonWindowMs = 0;
  let peakEncryptAsciiWindowMs = 0;
  let peakEncryptKeystreamWindowMs = 0;
  let peakEncryptXorWindowMs = 0;
  let peakEncryptEncodeWindowMs = 0;
  let peakEncryptJsonSingleMs = 0;
  let peakEncryptAsciiSingleMs = 0;
  let peakEncryptKeystreamSingleMs = 0;
  let peakEncryptXorSingleMs = 0;
  let peakEncryptEncodeSingleMs = 0;
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
  let peakDiskRecordStringifyWindowMs = 0;
  let peakDiskRecordStringifySingleMs = 0;
  let peakDiskAppendWindowMs = 0;
  let peakDiskReadWindowMs = 0;
  let peakDiskFlushWindowMs = 0;
  let peakDiskAppendSingleMs = 0;
  let peakDiskReadSingleMs = 0;
  let peakDiskFlushSingleMs = 0;
  let peakDiskAppendHeapDelta = 0;
  let peakDiskAppendExternalDelta = 0;
  let peakDiskAppendArrayBuffersDelta = 0;
  let peakDiskReadHeapDelta = 0;
  let peakDiskReadExternalDelta = 0;
  let peakDiskReadArrayBuffersDelta = 0;
  let peakDiskFlushHeapDelta = 0;
  let peakDiskFlushExternalDelta = 0;
  let peakDiskFlushArrayBuffersDelta = 0;
  let peakLoadWindowMs = 0;
  let peakMaterializeWindowMs = 0;
  let peakCloneWindowMs = 0;
  let peakColumnarWindowMs = 0;
  let peakPrepareWindowMs = 0;
  let peakKeyDeriveWindowMs = 0;
  let peakEncryptWindowMs = 0;
  let peakSetBlobWindowMs = 0;
  let peakLoadSingleMs = 0;
  let peakMaterializeSingleMs = 0;
  let peakCloneSingleMs = 0;
  let peakColumnarSingleMs = 0;
  let peakPrepareSingleMs = 0;
  let peakKeyDeriveSingleMs = 0;
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
      const crypto = {
        ...emptyBlobCryptoDebugWindow(),
        ...takeBlobCryptoDebugWindow(me),
      };
      const disk = {
        ...emptyDiskStoreDebugWindow(),
        ...takeDiskStoreDebugWindow(me),
      };
      peakBranchBytes = Math.max(peakBranchBytes, persist.maxBranchBytes);
      peakCacheSeedBytes = Math.max(peakCacheSeedBytes, persist.maxCacheSeedBytes);
      peakEncryptableBytes = Math.max(peakEncryptableBytes, persist.maxEncryptableBytes);
      peakBlobBytes = Math.max(peakBlobBytes, persist.maxBlobBytes);
      peakEncryptJsonBytes = Math.max(peakEncryptJsonBytes, crypto.maxJsonBytes);
      peakEncryptClearBytes = Math.max(peakEncryptClearBytes, crypto.maxClearBytes);
      peakEncryptKeystreamBytes = Math.max(peakEncryptKeystreamBytes, crypto.maxKeystreamBytes);
      peakEncryptCiphertextBytes = Math.max(peakEncryptCiphertextBytes, crypto.maxCiphertextBytes);
      peakEncryptHexBytes = Math.max(peakEncryptHexBytes, crypto.maxHexBytes);
      peakEncryptJsonWindowMs = Math.max(peakEncryptJsonWindowMs, crypto.totalEncryptJsonMs);
      peakEncryptAsciiWindowMs = Math.max(peakEncryptAsciiWindowMs, crypto.totalEncryptAsciiMs);
      peakEncryptKeystreamWindowMs = Math.max(peakEncryptKeystreamWindowMs, crypto.totalEncryptKeystreamMs);
      peakEncryptXorWindowMs = Math.max(peakEncryptXorWindowMs, crypto.totalEncryptXorMs);
      peakEncryptEncodeWindowMs = Math.max(peakEncryptEncodeWindowMs, crypto.totalEncryptEncodeMs);
      peakEncryptJsonSingleMs = Math.max(peakEncryptJsonSingleMs, crypto.maxEncryptJsonMs);
      peakEncryptAsciiSingleMs = Math.max(peakEncryptAsciiSingleMs, crypto.maxEncryptAsciiMs);
      peakEncryptKeystreamSingleMs = Math.max(peakEncryptKeystreamSingleMs, crypto.maxEncryptKeystreamMs);
      peakEncryptXorSingleMs = Math.max(peakEncryptXorSingleMs, crypto.maxEncryptXorMs);
      peakEncryptEncodeSingleMs = Math.max(peakEncryptEncodeSingleMs, crypto.maxEncryptEncodeMs);
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
      peakDiskRecordStringifyWindowMs = Math.max(peakDiskRecordStringifyWindowMs, disk.totalRecordStringifyMs);
      peakDiskRecordStringifySingleMs = Math.max(peakDiskRecordStringifySingleMs, disk.maxRecordStringifyMs);
      peakDiskAppendWindowMs = Math.max(peakDiskAppendWindowMs, disk.totalAppendMs);
      peakDiskReadWindowMs = Math.max(peakDiskReadWindowMs, disk.totalReadMs);
      peakDiskFlushWindowMs = Math.max(peakDiskFlushWindowMs, disk.totalFlushMs);
      peakDiskAppendSingleMs = Math.max(peakDiskAppendSingleMs, disk.maxAppendMs);
      peakDiskReadSingleMs = Math.max(peakDiskReadSingleMs, disk.maxReadMs);
      peakDiskFlushSingleMs = Math.max(peakDiskFlushSingleMs, disk.maxFlushMs);
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
      peakLoadWindowMs = Math.max(peakLoadWindowMs, persist.totalLoadChunkMs);
      peakMaterializeWindowMs = Math.max(peakMaterializeWindowMs, persist.totalMaterializeMs);
      peakCloneWindowMs = Math.max(peakCloneWindowMs, persist.totalCloneMs);
      peakColumnarWindowMs = Math.max(peakColumnarWindowMs, persist.totalColumnarMaterializeMs);
      peakPrepareWindowMs = Math.max(peakPrepareWindowMs, persist.totalPrepareColumnarMs);
      peakKeyDeriveWindowMs = Math.max(peakKeyDeriveWindowMs, persist.totalKeyDeriveMs);
      peakEncryptWindowMs = Math.max(peakEncryptWindowMs, persist.totalEncryptMs);
      peakSetBlobWindowMs = Math.max(peakSetBlobWindowMs, persist.totalSetBlobMs);
      peakLoadSingleMs = Math.max(peakLoadSingleMs, persist.maxLoadChunkMs);
      peakMaterializeSingleMs = Math.max(peakMaterializeSingleMs, persist.maxMaterializeMs);
      peakCloneSingleMs = Math.max(peakCloneSingleMs, persist.maxCloneMs);
      peakColumnarSingleMs = Math.max(peakColumnarSingleMs, persist.maxColumnarMaterializeMs);
      peakPrepareSingleMs = Math.max(peakPrepareSingleMs, persist.maxPrepareColumnarMs);
      peakKeyDeriveSingleMs = Math.max(peakKeyDeriveSingleMs, persist.maxKeyDeriveMs);
      peakEncryptSingleMs = Math.max(peakEncryptSingleMs, persist.maxEncryptMs);
      peakSetBlobSingleMs = Math.max(peakSetBlobSingleMs, persist.maxSetBlobMs);
      const prefix = shouldCountReport ? "" : "[heartbeat] ";

      console.log(
        `${prefix}${Math.round(processed / 1000)}k | ` +
        `${formatMb(preGc.heapUsed)} | ` +
        `${formatMb(postGc.heapUsed)} | ` +
        `${formatMb(postGc.external)} | ` +
        `${formatMb(postGc.arrayBuffers)} | ` +
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
        `${disk.totalAppendMs.toFixed(0)} | ` +
        `${disk.totalFlushMs.toFixed(0)} | ` +
        `${disk.totalReadMs.toFixed(0)} | ` +
        `${formatMb(crypto.maxEncryptResidentBytes)} | ` +
        `${formatMb(disk.maxRecordBytes)} | ` +
        `${formatMb(disk.maxReadBufferBytes)} | ` +
        `${formatMb(disk.maxFlushIndexBytes)} | ` +
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
  console.log(`Peak cacheSeed: ${formatMb(peakCacheSeedBytes)}`);
  console.log(`Peak encryptable: ${formatMb(peakEncryptableBytes)}`);
  console.log(`Peak blob: ${formatMb(peakBlobBytes)}`);
  console.log(`Peak encrypt json: ${formatMb(peakEncryptJsonBytes)}`);
  console.log(`Peak encrypt clear: ${formatMb(peakEncryptClearBytes)}`);
  console.log(`Peak encrypt keystream: ${formatMb(peakEncryptKeystreamBytes)}`);
  console.log(`Peak encrypt ciphertext: ${formatMb(peakEncryptCiphertextBytes)}`);
  console.log(`Peak encrypt encoded: ${formatMb(peakEncryptHexBytes)}`);
  console.log(`Peak encrypt stringify window: ${peakEncryptJsonWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt ascii window: ${peakEncryptAsciiWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt keystream window: ${peakEncryptKeystreamWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt xor window: ${peakEncryptXorWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt encode window: ${peakEncryptEncodeWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt stringify single: ${peakEncryptJsonSingleMs.toFixed(0)}ms`);
  console.log(`Peak encrypt ascii single: ${peakEncryptAsciiSingleMs.toFixed(0)}ms`);
  console.log(`Peak encrypt keystream single: ${peakEncryptKeystreamSingleMs.toFixed(0)}ms`);
  console.log(`Peak encrypt xor single: ${peakEncryptXorSingleMs.toFixed(0)}ms`);
  console.log(`Peak encrypt encode single: ${peakEncryptEncodeSingleMs.toFixed(0)}ms`);
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
  console.log(`Peak disk record stringify window: ${peakDiskRecordStringifyWindowMs.toFixed(0)}ms`);
  console.log(`Peak disk record stringify single: ${peakDiskRecordStringifySingleMs.toFixed(0)}ms`);
  console.log(`Peak disk append window: ${peakDiskAppendWindowMs.toFixed(0)}ms`);
  console.log(`Peak disk flush window: ${peakDiskFlushWindowMs.toFixed(0)}ms`);
  console.log(`Peak disk read window: ${peakDiskReadWindowMs.toFixed(0)}ms`);
  console.log(`Peak disk append single: ${peakDiskAppendSingleMs.toFixed(0)}ms`);
  console.log(`Peak disk flush single: ${peakDiskFlushSingleMs.toFixed(0)}ms`);
  console.log(`Peak disk read single: ${peakDiskReadSingleMs.toFixed(0)}ms`);
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
  console.log(`Peak load window: ${peakLoadWindowMs.toFixed(0)}ms`);
  console.log(`Peak materialize window: ${peakMaterializeWindowMs.toFixed(0)}ms`);
  console.log(`Peak clone window: ${peakCloneWindowMs.toFixed(0)}ms`);
  console.log(`Peak columnar window: ${peakColumnarWindowMs.toFixed(0)}ms`);
  console.log(`Peak prepare window: ${peakPrepareWindowMs.toFixed(0)}ms`);
  console.log(`Peak key-derive window: ${peakKeyDeriveWindowMs.toFixed(0)}ms`);
  console.log(`Peak encrypt window: ${peakEncryptWindowMs.toFixed(0)}ms`);
  console.log(`Peak setChunkBlob window: ${peakSetBlobWindowMs.toFixed(0)}ms`);
  console.log(`Peak load single: ${peakLoadSingleMs.toFixed(0)}ms`);
  console.log(`Peak materialize single: ${peakMaterializeSingleMs.toFixed(0)}ms`);
  console.log(`Peak clone single: ${peakCloneSingleMs.toFixed(0)}ms`);
  console.log(`Peak columnar single: ${peakColumnarSingleMs.toFixed(0)}ms`);
  console.log(`Peak prepare single: ${peakPrepareSingleMs.toFixed(0)}ms`);
  console.log(`Peak key-derive single: ${peakKeyDeriveSingleMs.toFixed(0)}ms`);
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
