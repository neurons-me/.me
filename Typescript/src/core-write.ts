import {
  encryptBlobV3WithDerivedKeys,
  encryptBlobV4WithDerivedKeys,
  xorEncrypt,
} from "./crypto.ts";
import {
  clearDerivationsByPrefix,
  invalidateFromPath,
  registerDerivation,
} from "./derivation.ts";
import { tryEvaluateAssignExpression } from "./evaluator.ts";
import { normalizeCall } from "./normalizeCall.ts";
import { ME_SET_ACTIVE_EXPRESSION_SYMBOL } from "./kernel-symbols.ts";
import {
  isDefineOpCall,
  isIdentityRef,
  isNoiseScopeCall,
  isEvalCall,
  isPointer,
  isQueryCall,
  isRemoveCall,
  pathStartsWith,
  splitPath,
} from "./operators.ts";
import {
  bumpSecretEpoch,
  clearScopeChunkCache,
  computeEffectiveSecret,
  createBranchContainerForRel,
  getChunkId,
  getChunkBlob,
  getChunkRelativePath,
  getDecryptedChunk,
  primeDecryptedBranchCache,
  resolveBranchScope,
  setAtPath,
  setChunkBlob,
} from "./secret.ts";
import { materializeDecryptedChunk } from "./secret-storage.ts";
import { getOrDeriveV3Keys, getOrDeriveV4Keys } from "./secret-context.ts";
import {
  materializeColumnarData,
  prepareColumnarChunkForEncryption,
  shouldUseColumnarEncoding,
} from "./secret-storage-columnar.ts";
import type {
  KernelMemory,
  MappingInstruction,
  MEKernelLike,
  OperatorRegistry,
  ReplayMemoryInput,
  SemanticPath,
} from "./types.ts";
import {
  toKernelMemories,
} from "./memory-redaction.ts";
import {
  cloneValue,
  getPrevMemoryHash,
  hashFn,
  normalizeSelectorPath,
  pathContainsIterator,
  substituteIteratorInExpression,
  substituteIteratorInPath,
} from "./utils.ts";
import {
  collectFilteredScopes,
  collectIteratorIndices,
  pathContainsFilterSelector,
} from "./core-read.ts";

type PersistSecretBranchDebugWindow = {
  writes: number;
  columnarWrites: number;
  maxBranchBytes: number;
  maxCacheSeedBytes: number;
  maxEncryptableBytes: number;
  maxBlobBytes: number;
  totalLoadChunkMs: number;
  totalMaterializeMs: number;
  totalCloneMs: number;
  totalColumnarMaterializeMs: number;
  totalPrepareColumnarMs: number;
  totalKeyDeriveMs: number;
  totalEncryptMs: number;
  totalSetBlobMs: number;
  maxLoadChunkMs: number;
  maxMaterializeMs: number;
  maxCloneMs: number;
  maxColumnarMaterializeMs: number;
  maxPrepareColumnarMs: number;
  maxKeyDeriveMs: number;
  maxEncryptMs: number;
  maxSetBlobMs: number;
  writeCacheHits: number;
  writeCacheMisses: number;
  totalWriteCacheHitMs: number;
  maxWriteCacheHitMs: number;
};

function createPersistSecretBranchDebugWindow(): PersistSecretBranchDebugWindow {
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
    writeCacheHits: 0,
    writeCacheMisses: 0,
    totalWriteCacheHitMs: 0,
    maxWriteCacheHitMs: 0,
  };
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function estimateDebugBytes(value: any, seen = new WeakSet<object>()): number {
  if (value == null) return 0;

  const valueType = typeof value;
  if (valueType === "string") return value.length * 2;
  if (valueType === "number") return 8;
  if (valueType === "boolean") return 4;
  if (valueType === "bigint") return 8;
  if (valueType === "symbol" || valueType === "function" || valueType === "undefined") return 0;

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return value.byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof Date) return 8;

  if (typeof value === "object") {
    if (seen.has(value)) return 0;
    seen.add(value);

    if (Array.isArray(value)) {
      let total = 24;
      for (const item of value) total += estimateDebugBytes(item, seen);
      return total;
    }

    let total = 32;
    for (const [key, entry] of Object.entries(value)) {
      total += key.length * 2;
      total += estimateDebugBytes(entry, seen);
    }
    return total;
  }

  return 0;
}

function recordPersistSecretBranchDebug(
  self: MEKernelLike,
  branchObj: any,
  cacheSeed: any,
  encryptable: any,
  blob: any,
  useColumnar: boolean,
  keyDeriveMs: number,
  encryptMs: number,
  setBlobMs: number,
  columnarMaterializeMs: number,
  prepareColumnarMs: number,
): void {
  const debug = (self as any).__persistSecretBranchDebug;
  if (!debug?.enabled) return;

  const window = debug.window ?? (debug.window = createPersistSecretBranchDebugWindow());
  const branchBytes = estimateDebugBytes(branchObj);
  const cacheSeedBytes = estimateDebugBytes(cacheSeed);
  const encryptableBytes = estimateDebugBytes(encryptable);
  const blobBytes = estimateDebugBytes(blob);

  window.writes += 1;
  if (useColumnar) window.columnarWrites += 1;
  window.maxBranchBytes = Math.max(window.maxBranchBytes, branchBytes);
  window.maxCacheSeedBytes = Math.max(window.maxCacheSeedBytes, cacheSeedBytes);
  window.maxEncryptableBytes = Math.max(window.maxEncryptableBytes, encryptableBytes);
  window.maxBlobBytes = Math.max(window.maxBlobBytes, blobBytes);
  window.totalColumnarMaterializeMs += columnarMaterializeMs;
  window.totalPrepareColumnarMs += prepareColumnarMs;
  window.totalKeyDeriveMs += keyDeriveMs;
  window.totalEncryptMs += encryptMs;
  window.totalSetBlobMs += setBlobMs;
  window.maxColumnarMaterializeMs = Math.max(window.maxColumnarMaterializeMs, columnarMaterializeMs);
  window.maxPrepareColumnarMs = Math.max(window.maxPrepareColumnarMs, prepareColumnarMs);
  window.maxKeyDeriveMs = Math.max(window.maxKeyDeriveMs, keyDeriveMs);
  window.maxEncryptMs = Math.max(window.maxEncryptMs, encryptMs);
  window.maxSetBlobMs = Math.max(window.maxSetBlobMs, setBlobMs);
}

function recordLoadMutableSecretBranchDebug(
  self: MEKernelLike,
  loadChunkMs: number,
  materializeMs: number,
  cloneMs: number,
): void {
  const debug = (self as any).__persistSecretBranchDebug;
  if (!debug?.enabled) return;

  const window = debug.window ?? (debug.window = createPersistSecretBranchDebugWindow());
  window.totalLoadChunkMs += loadChunkMs;
  window.totalMaterializeMs += materializeMs;
  window.totalCloneMs += cloneMs;
  window.maxLoadChunkMs = Math.max(window.maxLoadChunkMs, loadChunkMs);
  window.maxMaterializeMs = Math.max(window.maxMaterializeMs, materializeMs);
  window.maxCloneMs = Math.max(window.maxCloneMs, cloneMs);
}

function touchLruEntry<K, V>(cache: Map<K, V>, key: K, value: V): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
}

function trimLruCache<K, V>(cache: Map<K, V>, limit: number): void {
  while (cache.size > limit) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    cache.delete(oldest.value);
  }
}

function writeBranchCacheLimit(self: MEKernelLike): number {
  const configured = Number((self as any).__writeBranchCacheConfig?.limit);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  return 8;
}

function isWriteBranchCacheEnabled(self: MEKernelLike): boolean {
  return (self as any).__writeBranchCacheConfig?.enabled === true;
}

function recordWriteBranchCacheLookup(self: MEKernelLike, hit: boolean, hitMs: number): void {
  const debug = (self as any).__persistSecretBranchDebug;
  if (!debug?.enabled) return;
  const window = debug.window ?? (debug.window = createPersistSecretBranchDebugWindow());
  if (hit) {
    window.writeCacheHits += 1;
    window.totalWriteCacheHitMs += hitMs;
    window.maxWriteCacheHitMs = Math.max(window.maxWriteCacheHitMs, hitMs);
  } else {
    window.writeCacheMisses += 1;
  }
}

function readWriteBranchCache(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
  blob: any,
): any | undefined {
  if (!isWriteBranchCacheEnabled(self)) return undefined;
  const startedAt = nowMs();
  const ck = `${scope.join(".")}::${chunkId}`;
  const hit = self.writeBranchCache.get(ck);
  if (hit && hit.epoch === self.secretEpoch && hit.blob === blob) {
    touchLruEntry(self.writeBranchCache, ck, hit);
    recordWriteBranchCacheLookup(self, true, nowMs() - startedAt);
    return hit.data;
  }
  recordWriteBranchCacheLookup(self, false, 0);
  return undefined;
}

function seedWriteBranchCache(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
  blob: any,
  data: any,
): void {
  if (!isWriteBranchCacheEnabled(self)) return;
  const ck = `${scope.join(".")}::${chunkId}`;
  touchLruEntry(self.writeBranchCache, ck, {
    epoch: self.secretEpoch,
    blob,
    data,
  });
  trimLruCache(self.writeBranchCache, writeBranchCacheLimit(self));
}

function registerStealthScope(self: MEKernelLike, scopePath: SemanticPath, scopeValue: string): void {
  const normalizedScopePath = normalizeSelectorPath(scopePath);
  const scopeKey = normalizedScopePath.join(".");
  self.localSecrets[scopeKey] = scopeValue;
  self.protectedScopeKeys.add(scopeKey);
  (self as any)._ownerScope = scopeValue;
}

export function learn(self: MEKernelLike, memory: unknown): void {
  const next = cloneValue(memory ?? {}) as Partial<ReplayMemoryInput>;
  const path = String(next.path || "")
    .split(".")
    .filter(Boolean);

  if (next.operator === "_") {
    self.postulate([...path, "_"], typeof next.expression === "string" ? next.expression : "***");
    return;
  }
  if (next.operator === "~") {
    self.postulate([...path, "~"], typeof next.expression === "string" ? next.expression : "***");
    return;
  }
  if (next.operator === "@") {
    const id =
      (next.expression && (next.expression as any).__id) ||
      (next.value && (next.value as any).__id) ||
      next.value;
    if (typeof id === "string" && id.length > 0) self.postulate([...path, "@"], id);
    return;
  }
  if (next.operator === "__" || next.operator === "->") {
    const ptr =
      (next.expression && (next.expression as any).__ptr) ||
      (next.value && (next.value as any).__ptr) ||
      next.value;
    if (typeof ptr === "string" && ptr.length > 0) self.postulate([...path, "__"], ptr);
    return;
  }
  if (next.operator === "-") {
    self.removeSubtree(path);
    return;
  }
  if (next.operator === "=" || next.operator === "?") {
    self.postulate(path, next.value, next.operator);
    return;
  }

  applyGenericReplayWrite(self, path, next.expression, next.operator ?? null, next.value);
}

export function replayMemories(self: MEKernelLike, memories: ReplayMemoryInput[]): void {
  self.localSecrets = {};
  self.localNoises = {};
  self.protectedScopeKeys.clear();
  self.branchStore.clear();
  self.keySpaces = {};
  (self as any)._ownerScope = null;
  (self as any)._currentCallerScope = undefined;
  bumpSecretEpoch(self);
  self.index = {};
  self.indexWinner = {};
  self.seqCounter = 0;
  self._memories = [];
  self.derivations = {};
  self.refSubscribers = {};
  self.refVersions = {};
  self.derivationRefVersions = {};
  self.staleDerivations.clear();
  self.lastRecomputeWaveByTarget = {};
  self.activeRecomputeWave = null;

  for (const t of toKernelMemories(memories || [])) {
    const path = String(t.path || "")
      .split(".")
      .filter(Boolean);

    if (t.operator === "_") {
      self.postulate([...path, "_"], typeof t.expression === "string" ? t.expression : "***");
      continue;
    }
    if (t.operator === "~") {
      self.postulate([...path, "~"], typeof t.expression === "string" ? t.expression : "***");
      continue;
    }
    if (t.operator === "@") {
      const id =
        (t.expression && (t.expression as any).__id) || (t.value && (t.value as any).__id) || t.value;
      if (typeof id === "string" && id.length > 0) self.postulate([...path, "@"], id);
      continue;
    }
    if (t.operator === "__" || t.operator === "->") {
      const ptr =
        (t.expression && (t.expression as any).__ptr) || (t.value && (t.value as any).__ptr) || t.value;
      if (typeof ptr === "string" && ptr.length > 0) self.postulate([...path, "__"], ptr);
      continue;
    }
    if (t.operator === "-") {
      self.removeSubtree(path);
      continue;
    }

    if (t.operator === "=" || t.operator === "?") {
      self.postulate(path, t.value, t.operator);
      continue;
    }

    applyGenericReplayWrite(self, path, t.expression, t.operator, t.value);
  }
  self.rebuildIndex();
}

/**
 * Shared generic-write replay logic for `learn()`/`replayMemories()`.
 *
 * `learn()` serves two different callers, and this function must tell them
 * apart:
 *  1. Application code instructing a fresh, real write (e.g. the DSL
 *     contract tests' `me.learn({ path: "vault.balance", expression: 25 })`)
 *     — `expression` is real, actionable data, and must go through the full
 *     `postulate()` pipeline exactly as before this function existed, so a
 *     protected target still gets properly encrypted.
 *  2. Replaying an entry that came FROM an already-exported memory log
 *     (`exportSnapshot()`/`me.memories`) — for a protected write,
 *     `commitValueMapping` redacted its `expression` to
 *     `MEMORY_LOG_SECRET_PLACEHOLDER` at write time (alongside `value`; see
 *     Identity-Bound-Secrets.md §3.5/§9.1). Re-running that placeholder
 *     through `postulate()` would silently overwrite real content with the
 *     literal string "***".
 *
 * The two are told apart by the one signal that actually distinguishes
 * them: whether `expression` IS the redaction placeholder. Only case 2 skips
 * `postulate()`, re-appending the entry verbatim via `commitMemoryOnly`
 * instead:
 *
 * - Value-mode secrets: `value` already holds real, reusable ciphertext
 *   (only `expression` was redacted) — reusing it directly reconstructs
 *   the exact same readable state once the real secret is resupplied,
 *   with zero information lost.
 * - Branch-scope secrets: neither `expression` nor `value` on a single log
 *   entry ever carried reconstructable content (branch content lives in
 *   `encryptedBranches`, a separate plane `hydrate()` already restores
 *   directly). Re-appending the entry keeps the audit trail and topology
 *   (the scope stays correctly marked protected) without fabricating
 *   wrong branch content; real content must be restored by also copying
 *   `encryptedBranches` (`me.encryptedBranches = source.encryptedBranches`)
 *   the same way `hydrate()`/`exportSnapshot()` already transport it.
 */
function applyGenericReplayWrite(
  self: MEKernelLike,
  path: SemanticPath,
  expression: any,
  operator: string | null,
  value: any,
): void {
  if (expression === MEMORY_LOG_SECRET_PLACEHOLDER) {
    commitMemoryOnly(self, path, operator, expression, value);
    return;
  }
  self.postulate(path, expression, operator);
}

export function commitMemoryOnly(
  self: MEKernelLike,
  targetPath: SemanticPath,
  operator: string | null,
  expression: any,
  value: any,
): KernelMemory {
  const pathStr = targetPath.join(".");
  const effectiveSecret = computeEffectiveSecret(self, targetPath);
  const prevHash = getPrevMemoryHash(self);
  const hashInput = JSON.stringify({
    path: pathStr,
    operator,
    expression,
    value,
    effectiveSecret,
    prevHash,
  });
  const hash = hashFn(hashInput);
  const timestamp = Date.now();
  const seq = self.seqCounter++;
  const memory: KernelMemory = {
    path: pathStr,
    operator,
    expression,
    value,
    effectiveSecret,
    hash,
    prevHash,
    timestamp,
    seq,
  };
  self._memories.push(memory);
  self.applyMemoryToIndex(memory);
  return memory;
}

type BatchRelEntry = {
  rel: SemanticPath;
  value: any;
};

function computeBatchHash(items: any[]): string {
  const first = items[0];
  const last = items[items.length - 1];
  const middle = items.length > 2 ? items[Math.floor(items.length / 2)] : null;

  return hashFn(JSON.stringify({
    count: items.length,
    firstId: first?.id ?? null,
    lastId: last?.id ?? null,
    middleId: middle?.id ?? null,
  }));
}

function commitBatchMemoryOnly(
  self: MEKernelLike,
  basePath: SemanticPath,
  startIndex: number,
  items: any[],
  operator: string | null,
): KernelMemory {
  const pathStr = "commitIndexedBatch";
  const effectiveSecret = computeEffectiveSecret(self, basePath);
  const prevHash = getPrevMemoryHash(self);
  const timestamp = Date.now();
  const metadata = {
    basePath: basePath.join("."),
    startIndex,
    count: items.length,
    batchHash: computeBatchHash(items),
    firstId: items[0]?.id ?? null,
    lastId: items[items.length - 1]?.id ?? null,
  };
  const hashInput = JSON.stringify({
    path: pathStr,
    operator,
    expression: metadata,
    value: metadata,
    effectiveSecret,
    prevHash,
  });
  const hash = hashFn(hashInput);
  const seq = self.seqCounter++;
  const memory: KernelMemory = {
    path: pathStr,
    operator,
    expression: metadata,
    value: metadata,
    effectiveSecret,
    hash,
    prevHash,
    timestamp,
    seq,
  };
  self._memories.push(memory);
  self.applyMemoryToIndex(memory);
  return memory;
}

function loadMutableSecretBranch(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkId: string,
): any {
  let branchObj: any = {};
  const blob = getChunkBlob(self, scope, chunkId);
  if (blob) {
    const cached = readWriteBranchCache(self, scope, chunkId, blob);
    if (cached && typeof cached === "object") {
      const cloneStartedAt = nowMs();
      const cloned = cloneValue(cached);
      const cloneMs = nowMs() - cloneStartedAt;
      recordLoadMutableSecretBranchDebug(self, 0, 0, cloneMs);
      return cloned;
    }
  }
  const loadChunkStartedAt = nowMs();
  const dec = getDecryptedChunk(self, scope, scopeSecret, chunkId);
  const loadChunkMs = nowMs() - loadChunkStartedAt;
  let materializeMs = 0;
  let cloneMs = 0;
  if (dec && typeof dec === "object") {
    const materializeStartedAt = nowMs();
    const materialized = materializeDecryptedChunk(dec as any);
    materializeMs = nowMs() - materializeStartedAt;
    if (materialized && typeof materialized === "object") {
      const cloneStartedAt = nowMs();
      branchObj = cloneValue(materialized);
      cloneMs = nowMs() - cloneStartedAt;
    }
  }
  recordLoadMutableSecretBranchDebug(self, loadChunkMs, materializeMs, cloneMs);
  return branchObj;
}

function isEmptyPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

/**
 * Selects the write format for a new protected blob (branch or value).
 * - `secretBlobVersion === "v2"` is an explicit rollback/testing escape
 *   hatch (`setSecretBlobVersionForTesting`) and always wins.
 * - Otherwise: v4 whenever this kernel has an identity root unlocked this
 *   session — Identity-Bound Secrets' "new protected writes use v4".
 * - Otherwise: v3, exactly as before this feature existed. A kernel that
 *   never opts into `createIdentityRoot()`/`unlockIdentity()` sees no
 *   behavior change at all — v3 stays the default, untouched.
 */
function encryptForWrite(
  self: MEKernelLike,
  path: SemanticPath,
  mode: "branch" | "value",
  encryptable: any,
  legacySecret: string,
): any {
  if (self.secretBlobVersion === "v2") {
    return xorEncrypt(encryptable, legacySecret, path);
  }
  if (self.identityRootUnwrapped) {
    const keys = getOrDeriveV4Keys(self, path, mode);
    return encryptBlobV4WithDerivedKeys(encryptable, keys);
  }
  const keys = getOrDeriveV3Keys(self, path, mode);
  return encryptBlobV3WithDerivedKeys(encryptable, keys);
}

function persistSecretBranch(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkId: string,
  branchObj: any,
  primeDecryptedCache = true,
): void {
  const useColumnar = Array.isArray(branchObj) && shouldUseColumnarEncoding(branchObj);
  let columnarMaterializeMs = 0;
  let prepareColumnarMs = 0;
  let cacheSeed = branchObj;
  let encryptable = branchObj;
  if (useColumnar) {
    const columnarMaterializeStartedAt = nowMs();
    cacheSeed = materializeColumnarData(branchObj);
    columnarMaterializeMs = nowMs() - columnarMaterializeStartedAt;
    const prepareColumnarStartedAt = nowMs();
    encryptable = prepareColumnarChunkForEncryption(cacheSeed);
    prepareColumnarMs = nowMs() - prepareColumnarStartedAt;
  }

  let keyDeriveMs = 0;
  const encryptStartedAt = nowMs();
  const deriveStartedAt = nowMs();
  const blob = encryptForWrite(self, scope, "branch", encryptable, scopeSecret);
  keyDeriveMs = self.secretBlobVersion === "v2" ? 0 : nowMs() - deriveStartedAt;
  const encryptMs = nowMs() - encryptStartedAt;
  const setBlobStartedAt = nowMs();
  setChunkBlob(self, scope, chunkId, blob, scopeSecret);
  const setBlobMs = nowMs() - setBlobStartedAt;
  seedWriteBranchCache(self, scope, chunkId, blob, branchObj);
  recordPersistSecretBranchDebug(
    self,
    branchObj,
    cacheSeed,
    encryptable,
    blob,
    useColumnar,
    keyDeriveMs,
    encryptMs,
    setBlobMs,
    columnarMaterializeMs,
    prepareColumnarMs,
  );
  if (primeDecryptedCache) {
    primeDecryptedBranchCache(self, scope, chunkId, cacheSeed);
  }
}

export function commitChunkBatch(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkId: string,
  relEntries: BatchRelEntry[],
  primeDecryptedCache = true,
): void {
  if (!scopeSecret || relEntries.length === 0) return;

  let branchObj = loadMutableSecretBranch(self, scope, scopeSecret, chunkId);
  if (isEmptyPlainObject(branchObj)) {
    branchObj = createBranchContainerForRel(relEntries[0]?.rel ?? []);
  }
  for (const { rel, value } of relEntries) {
    if (rel.length === 0) {
      if (typeof branchObj !== "object" || branchObj === null) continue;
      branchObj.expression = value;
      continue;
    }

    setAtPath(branchObj, rel, value);
  }

  persistSecretBranch(self, scope, scopeSecret, chunkId, branchObj, primeDecryptedCache);
}

export function commitIndexedBatch(
  self: MEKernelLike,
  basePath: SemanticPath,
  startIndex: number,
  items: any[],
  operator: string | null = null,
): KernelMemory[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const grouped = new Map<string, {
    scope: SemanticPath;
    scopeSecret: string;
    chunkId: string;
    relEntries: BatchRelEntry[];
  }>();
  let touchedPaths: SemanticPath[] = [];

  for (let offset = 0; offset < items.length; offset++) {
    const index = startIndex + offset;
    const targetPath = [...basePath, String(index)];
    const scope = resolveBranchScope(self, targetPath);
    if (!scope || scope.length === 0) {
      commitValueMapping(self, targetPath, items[offset], operator);
      touchedPaths.push(targetPath);
      continue;
    }

    const scopeSecret = computeEffectiveSecret(self, scope);
    if (!scopeSecret) {
      commitValueMapping(self, targetPath, items[offset], operator);
      touchedPaths.push(targetPath);
      continue;
    }

    const chunkId = getChunkId(self, targetPath, scope);
    const rel = getChunkRelativePath(self, targetPath, scope);
    const groupKey = `${scope.join(".")}::${chunkId}`;
    let group = grouped.get(groupKey);
    if (!group) {
      group = { scope, scopeSecret, chunkId, relEntries: [] };
      grouped.set(groupKey, group);
    }
    group.relEntries.push({ rel, value: items[offset] });
    touchedPaths.push(targetPath);
  }

  for (const group of grouped.values()) {
    // Batch ingest is write-optimized: keep the encrypted store hot, but do not
    // seed the decrypted branch cache for every written chunk.
    commitChunkBatch(self, group.scope, group.scopeSecret, group.chunkId, group.relEntries, false);
  }

  for (const targetPath of touchedPaths) {
    invalidateFromPath(self, targetPath);
  }

  const batchMemory = commitBatchMemoryOnly(self, basePath, startIndex, items, operator ?? "batch_set");
  return [batchMemory];
}

/**
 * Placeholder written into a memory record's `value` field in place of a
 * branch-scoped write's plaintext. Matches the "***" convention `_()`/`~()`
 * declarations already use (see `commitMapping`'s "secret" case and the
 * noise-call handling in `postulate`) so redaction reads consistently
 * across the memory log.
 */
export const MEMORY_LOG_SECRET_PLACEHOLDER = "***";

/**
 * True when `targetPath` falls under a scope that is durably known to be
 * protected — i.e. a scope that was genuinely established with `_()` at
 * some point — regardless of whether that scope's secret is active in the
 * CURRENT session. Deliberately separate from `resolveBranchScope` (which
 * only looks at `self.localSecrets`, i.e. session-current declarations):
 * this check is what lets `commitValueMapping` refuse to treat a
 * currently-locked protected path as an ordinary public write.
 *
 * Two independent sources of evidence, both consulted:
 *
 * 1. `self.protectedScopeKeys` — every scope key ever passed to `_()` in
 *    this kernel's lifetime, INCLUDING the root scope (`""`). This is the
 *    fix for a real bug found by the adversarial security audit: the
 *    branchStore-only version below covers named branch scopes (whose
 *    ciphertext durably lives in `branchStore`) but NOT root/value-mode
 *    scopes declared via bare `me["_"](...)`, which never populate
 *    `branchStore` at all — so after `lockIdentity()` (which used to wipe
 *    `localSecrets` with no trace left), a write to a root-secret-protected
 *    path fell all the way through to the plain public branch below,
 *    silently persisting plaintext. `protectedScopeKeys` is topology only
 *    (scope KEYS, never secret VALUES) and is deliberately NOT cleared by
 *    `lockIdentity()` — see kernel-state.ts and identity-context.ts.
 * 2. `self.branchStore.listScopes()` — kept as a second, independent check
 *    for defense in depth, and for backward compatibility with a snapshot
 *    hydrated from before this fix existed (whose `protectedScopeKeys` may
 *    be absent/empty even though real branch ciphertext already exists —
 *    `core-snapshot.ts`'s `hydrate()` also backfills `protectedScopeKeys`
 *    from the hydrated `localSecrets`'/`localNoises`' keys for the same
 *    reason, but this loop covers the case even if that backfill were ever
 *    skipped).
 *
 * See `tests/Security/scopes-and-noise.test.ts` and
 * `tests/Security/root-scope-lock.test.ts` for the regression tests.
 */
function hasExistingProtectedAncestor(self: MEKernelLike, targetPath: SemanticPath): boolean {
  for (const scopeKey of self.protectedScopeKeys) {
    const scopeSegments = scopeKey.split(".").filter(Boolean);
    if (pathStartsWith(targetPath, scopeSegments)) return true;
  }
  for (const scopeKey of self.branchStore.listScopes()) {
    const scopeSegments = scopeKey.split(".").filter(Boolean);
    if (scopeSegments.length === 0) continue;
    if (pathStartsWith(targetPath, scopeSegments)) return true;
  }
  return false;
}

export function commitValueMapping(
  self: MEKernelLike,
  targetPath: SemanticPath,
  expression: any,
  operator: string | null = null,
): KernelMemory {
  let storedValue: any = expression;
  // The value actually written into the memory log's `expression` field.
  // Defaults to the real `expression` (public paths keep full fidelity);
  // redacted below for any write whose `value` is also redacted/encrypted,
  // so the two fields are always redacted together — never `value` alone.
  // See typedocs/Identity-Bound-Secrets.md §3.5/§9.1.
  let loggedExpression: any = expression;
  const pathStr = targetPath.join(".");
  const effectiveSecret = computeEffectiveSecret(self, targetPath);
  const scope = resolveBranchScope(self, targetPath);
  if (scope && scope.length === 0 && self.localSecrets[""] && !self.localSecrets[pathStr]) {
    // root secret is allowed to encrypt leaves (value-level), so no-op here
  }

  if (scope && scope.length > 0) {
    const scopeSecret = computeEffectiveSecret(self, scope);
    const rel = getChunkRelativePath(self, targetPath, scope);
    const chunkId = getChunkId(self, targetPath, scope);
    let branchObj: any = createBranchContainerForRel(rel);
    if (scopeSecret) {
      branchObj = loadMutableSecretBranch(self, scope, scopeSecret, chunkId);
      if (isEmptyPlainObject(branchObj)) {
        branchObj = createBranchContainerForRel(rel);
      }
    }

    if (rel.length === 0) {
      if (typeof branchObj !== "object" || branchObj === null) branchObj = {};
      branchObj.expression = expression;
    } else {
      setAtPath(branchObj, rel, expression);
    }

    if (scopeSecret) {
      persistSecretBranch(self, scope, scopeSecret, chunkId, branchObj);
    }
    // The real value is already correctly encrypted into branchStore above.
    // Historically `storedValue` (the memory log's `value` field) was the
    // plaintext `expression` — see typedocs/Identity-Bound-Secrets.md's
    // "No basta con cambiar toPublicMemory" finding. That was fixed first;
    // `expression` itself carried the same plaintext under a different
    // field name until now (§9.1's "KNOWN GAP"). Neither field is read back
    // for a branch-scoped write: `applyMemoryToIndex` skips `inSecret`
    // paths entirely, and `replayMemories`'s generic case now recognizes a
    // branch-protected target and re-appends the (redacted) log entry
    // verbatim instead of trying to re-derive branch content from it — real
    // content is restored separately via `encryptedBranches`, the same
    // plane `hydrate()` already uses (see §9.1's resolution).
    storedValue = MEMORY_LOG_SECRET_PLACEHOLDER;
    loggedExpression = MEMORY_LOG_SECRET_PLACEHOLDER;
  } else if (effectiveSecret) {
    const shouldEncryptValue = operator !== "=" && operator !== "?";
    if (isPointer(expression) || isIdentityRef(expression) || !shouldEncryptValue) {
      storedValue = expression;
    } else {
      storedValue = encryptForWrite(self, targetPath, "value", expression, effectiveSecret);
      // `storedValue` is now real, reusable ciphertext (not a placeholder) —
      // `replayMemories`/`learn()` reuse it directly on replay instead of
      // re-deriving from `expression`, so redacting `expression` here loses
      // no reconstructive power. See §9.1's resolution.
      loggedExpression = MEMORY_LOG_SECRET_PLACEHOLDER;
    }
  } else if (hasExistingProtectedAncestor(self, targetPath)) {
    // FIX (adversarial security battery, §2 "scopes, herencia y noise"):
    // targetPath is within a scope that has real persisted branch
    // ciphertext, but no secret for that scope is active THIS session
    // (e.g. right after lockIdentity(), or a fresh/restarted process that
    // never re-declared `_()` for it yet). Before this fix, execution fell
    // through to the plain `storedValue = expression` branch below —
    // silently writing the caller's plaintext into the public memory log
    // AND the public index, for a path that is nominally protected
    // forever. That is a real confidentiality leak (anyone with ordinary
    // public read access to the path would see it in the clear) and a
    // "closed scope became public for lack of a secret" violation. Refused
    // the same way a declared-but-wrong-secret branch write already is:
    // no plaintext persisted, no existing ciphertext touched, redacted
    // memory-log placeholder for audit continuity.
    //
    // The index needs care, not a blanket delete: for a VALUE-mode/
    // root-scope path (unlike a branch-mode one, whose real ciphertext
    // lives entirely in `branchStore` and never touches `self.index` at
    // all — `applyMemoryToIndex` skips those), `self.index[pathStr]` IS
    // the actual storage location read back on every future decrypt. A
    // refused write's own `commitMemoryOnly` call still runs
    // `applyMemoryToIndex` on the redacted "***" record (this refusal path
    // isn't recognized as "in secret" by that function, precisely because
    // no session secret is active to recognize it by), which would
    // otherwise leave the literal string "***" sitting in the index as if
    // it were real content. So: capture whatever was there before, let the
    // redacted entry go through, then either restore the PRE-EXISTING real
    // ciphertext untouched (a previously-written protected value must
    // remain exactly as it was, recoverable once unlocked) or, if nothing
    // was there yet (a never-before-written leaf under a locked scope —
    // the "empty scope" case), remove the "***" the indexing just wrote so
    // the path reads back as ordinary stealth-safe absence, not as a
    // literal, distinguishable placeholder (would itself weaken the
    // closed/absent indistinguishability §3.4 relies on).
    const hadPriorIndexValue = Object.prototype.hasOwnProperty.call(self.index, pathStr);
    const priorIndexValue = self.index[pathStr];
    storedValue = MEMORY_LOG_SECRET_PLACEHOLDER;
    loggedExpression = MEMORY_LOG_SECRET_PLACEHOLDER;
    const refusedMemory = commitMemoryOnly(self, targetPath, operator, loggedExpression, storedValue);
    if (hadPriorIndexValue) {
      self.index[pathStr] = priorIndexValue;
    } else {
      delete self.index[pathStr];
    }
    return refusedMemory;
  } else {
    storedValue = expression;
  }

  return commitMemoryOnly(self, targetPath, operator, loggedExpression, storedValue);
}

export function commitMapping(
  self: MEKernelLike,
  instruction: MappingInstruction,
  fallbackOperator: string | null = null,
): KernelMemory | undefined {
  switch (instruction.op) {
    case "set":
      return commitValueMapping(self, instruction.path, instruction.value, fallbackOperator);
    case "ptr":
      return commitValueMapping(self, instruction.path, instruction.value, "__");
    case "id":
      return commitValueMapping(self, instruction.path, instruction.value, "@");
    case "secret": {
      if (typeof instruction.value !== "string") return undefined;
      const normalizedScopePath = normalizeSelectorPath(instruction.path);
      registerStealthScope(self, normalizedScopePath, instruction.value);
      bumpSecretEpoch(self);
      return commitMemoryOnly(self, normalizedScopePath, "_", "***", "***");
    }
    default:
      return undefined;
  }
}

export function postulate(
  self: MEKernelLike,
  path: SemanticPath,
  expression: any,
  operator: string | null = null,
): any {
  const targetPath = path;
  const def = isDefineOpCall(targetPath, expression);
  if (def) {
    self.operators[def.op] = { kind: def.kind };
    return;
  }

  const { leaf } = splitPath(targetPath);
  const leafKind = leaf ? self.opKind(leaf) : null;
  const maybeDelegableKind =
    leafKind === null || leafKind === "secret" || leafKind === "pointer" || leafKind === "identity";
  if (maybeDelegableKind) {
    const normalized = normalizeCall(self.operators as OperatorRegistry, { path: targetPath, expression });
    if (normalized.kind === "commit") {
      const supportedOps = new Set(["set", "secret", "ptr", "id"]);
      const delegable = normalized.instructions.every((instruction) => supportedOps.has(instruction.op));
      if (delegable) {
        let out: KernelMemory | undefined;
        const changed: SemanticPath[] = [];
        for (const instruction of normalized.instructions) {
          const maybe = commitMapping(self, instruction, operator);
          if (maybe) {
            if (instruction.op === "id" && instruction.path.length === 0 && isIdentityRef(instruction.value)) {
              const setActiveExpression = (self as any)[ME_SET_ACTIVE_EXPRESSION_SYMBOL];
              if (typeof setActiveExpression === "function") {
                setActiveExpression(instruction.value.__id);
              }
            }
            out = maybe;
            changed.push(maybe.path.split(".").filter(Boolean));
          }
        }
        if (out) {
          for (const c of changed) invalidateFromPath(self, c);
          return out;
        }
      }
    }
  }

  const ev = isEvalCall(self.operators as OperatorRegistry, targetPath, expression);
  if (ev) {
    if (ev.mode === "thunk") {
      const value = ev.thunk();
      if (ev.targetPath.length === 0) {
        return value;
      }

      return postulate(self, ev.targetPath, value, "=");
    }

    if (pathContainsIterator(ev.targetPath)) {
      const indices = collectIteratorIndices(self, ev.targetPath);
      let out: any = undefined;
      for (const idx of indices) {
        const targetScope = normalizeSelectorPath(substituteIteratorInPath(ev.targetPath, idx));
        const assignTarget = normalizeSelectorPath([...targetScope, ev.name]);
        const expr = substituteIteratorInExpression(ev.expr, idx);
        registerDerivation(self, assignTarget, targetScope, expr);
        const evaluated = tryEvaluateAssignExpression(self, targetScope, expr);
        out = postulate(self, assignTarget, evaluated.ok ? evaluated.value : expr, "=");
      }
      return out;
    }

    if (pathContainsFilterSelector(self, ev.targetPath)) {
      const scopes = collectFilteredScopes(self, ev.targetPath);
      let out: any = undefined;
      for (const rawScope of scopes) {
        const targetScope = normalizeSelectorPath(rawScope);
        const assignTarget = normalizeSelectorPath([...targetScope, ev.name]);
        registerDerivation(self, assignTarget, targetScope, ev.expr);
        const evaluated = tryEvaluateAssignExpression(self, targetScope, ev.expr);
        out = postulate(self, assignTarget, evaluated.ok ? evaluated.value : ev.expr, "=");
      }
      return out;
    }

    const assignTarget = normalizeSelectorPath([...ev.targetPath, ev.name]);
    const evalScope = normalizeSelectorPath(ev.targetPath);
    registerDerivation(self, assignTarget, evalScope, ev.expr);
    const evaluated = tryEvaluateAssignExpression(self, evalScope, ev.expr);
    if (evaluated.ok) {
      return postulate(self, assignTarget, evaluated.value, "=");
    }
    return postulate(self, assignTarget, ev.expr, "=");
  }

  const q = isQueryCall(self.operators as OperatorRegistry, targetPath, expression);
  if (q) {
    const values = q.paths.map((p) => self.readPath(p.split(".").filter(Boolean)));
    const out = q.fn ? (q.fn as any)(...values) : values;
    if (q.targetPath.length === 0) {
      return out;
    }

    return postulate(self, q.targetPath, out, "?");
  }

  const rm = isRemoveCall(self.operators as OperatorRegistry, targetPath, expression);
  if (rm) {
    self.removeSubtree(rm.targetPath);
    return;
  }

  const noiseCall = isNoiseScopeCall(self.operators as OperatorRegistry, targetPath, expression);
  if (noiseCall) {
    self.localNoises[noiseCall.scopeKey] = expression;
    bumpSecretEpoch(self);
    const scopePath = noiseCall.scopeKey ? noiseCall.scopeKey.split(".").filter(Boolean) : [];
    return commitMemoryOnly(self, scopePath, "~", "***", "***");
  }

  const memory = commitValueMapping(self, targetPath, expression, operator);
  invalidateFromPath(self, targetPath);
  return memory;
}

export function removeSubtree(self: MEKernelLike, targetPath: SemanticPath) {
  clearDerivationsByPrefix(self, targetPath);
  let securityTopologyChanged = false;
  const prefix = targetPath.join(".");
  for (const key of Object.keys(self.localSecrets)) {
    if (prefix === "") {
      delete self.localSecrets[key];
      securityTopologyChanged = true;
      continue;
    }
    if (key === prefix || key.startsWith(prefix + ".")) {
      delete self.localSecrets[key];
      securityTopologyChanged = true;
    }
  }

  for (const key of Object.keys(self.localNoises)) {
    if (prefix === "") {
      delete self.localNoises[key];
      securityTopologyChanged = true;
      continue;
    }
    if (key === prefix || key.startsWith(prefix + ".")) {
      delete self.localNoises[key];
      securityTopologyChanged = true;
    }
  }
  if (securityTopologyChanged) bumpSecretEpoch(self);

  for (const key of self.branchStore.listScopes()) {
    if (prefix === "") {
      self.branchStore.deleteScope(key);
      clearScopeChunkCache(self, key);
      continue;
    }
    if (key === prefix || key.startsWith(prefix + ".")) {
      self.branchStore.deleteScope(key);
      clearScopeChunkCache(self, key);
      continue;
    }

    const scope = key.split(".").filter(Boolean);
    if (!pathStartsWith(targetPath, scope) || targetPath.length <= scope.length) continue;
    const scopeSecret = computeEffectiveSecret(self, scope);
    if (!scopeSecret) continue;
    const chunkId = getChunkId(self, targetPath, scope);
    let branchObj = getDecryptedChunk(self, scope, scopeSecret, chunkId);
    let writeChunkId = chunkId;
    if (!branchObj && chunkId !== "default") {
      branchObj = getDecryptedChunk(self, scope, scopeSecret, "default");
      writeChunkId = "default";
    }
    if (!branchObj || typeof branchObj !== "object") continue;
    branchObj = cloneValue(materializeDecryptedChunk(branchObj as any));

    const rel = targetPath.slice(scope.length);
    let ref: any = branchObj;
    for (let i = 0; i < rel.length - 1; i++) {
      const part = rel[i];
      if (!ref || typeof ref !== "object" || !(part in ref)) {
        ref = null;
        break;
      }
      ref = ref[part];
    }
    if (ref && typeof ref === "object") {
      delete ref[rel[rel.length - 1]];
      persistSecretBranch(self, scope, scopeSecret, writeChunkId, branchObj);
    }
  }

  const pathStr = targetPath.join(".");
  const timestamp = Date.now();
  const effectiveSecret = computeEffectiveSecret(self, targetPath);
  const prevHash = getPrevMemoryHash(self);
  const hashInput = JSON.stringify({
    path: pathStr,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret,
    prevHash,
  });
  const hash = hashFn(hashInput);
  const seq = self.seqCounter++;
  const memory: KernelMemory = {
    path: pathStr,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret,
    hash,
    prevHash,
    timestamp,
    seq,
  };
  self._memories.push(memory);
  self.applyMemoryToIndex(memory);
}
