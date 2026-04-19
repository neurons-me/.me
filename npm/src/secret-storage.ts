import {
  decryptBlobV3WithDerivedKeys,
  detectBlobVersion,
  xorDecrypt,
  xorEncrypt,
} from "./crypto.js";
import { isIdentityRef, isPointer } from "./operators.js";
import { getOrDeriveV3Keys } from "./secret-context.js";
import type {
  EncryptedBlob,
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import { hashFn } from "./utils.js";
import {
  type ColumnarChunkEnvelope,
  type ColumnarChunkPayload,
  getColumnarItem,
  isColumnarChunkEnvelope,
  materializeColumnarRange,
  reconstructColumnarChunkPayload,
} from "./secret-storage-columnar.js";

const MAX_DECRYPTED_BRANCH_CACHE_ENTRIES = 64;

export type DecryptedChunkData = any | ColumnarChunkEnvelope;

type DecryptedChunkDebugWindow = {
  calls: number;
  hits: number;
  misses: number;
  v2Misses: number;
  v3Misses: number;
  totalHitMs: number;
  totalMissMs: number;
  totalDecryptMs: number;
  totalDecodeMs: number;
  maxHitMs: number;
  maxMissMs: number;
  maxDecryptMs: number;
  maxDecodeMs: number;
};

function createDecryptedChunkDebugWindow(): DecryptedChunkDebugWindow {
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

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function recordDecryptedChunkCacheHit(self: MEKernelLike, hitMs: number): void {
  const debug = (self as any).__decryptedChunkDebug;
  if (!debug?.enabled) return;

  const window = debug.window ?? (debug.window = createDecryptedChunkDebugWindow());
  window.calls += 1;
  window.hits += 1;
  window.totalHitMs += hitMs;
  window.maxHitMs = Math.max(window.maxHitMs, hitMs);
}

function recordDecryptedChunkMiss(
  self: MEKernelLike,
  version: "v2" | "v3",
  missMs: number,
  decryptMs: number,
  decodeMs: number,
): void {
  const debug = (self as any).__decryptedChunkDebug;
  if (!debug?.enabled) return;

  const window = debug.window ?? (debug.window = createDecryptedChunkDebugWindow());
  window.calls += 1;
  window.misses += 1;
  if (version === "v3") window.v3Misses += 1;
  else window.v2Misses += 1;
  window.totalMissMs += missMs;
  window.totalDecryptMs += decryptMs;
  window.totalDecodeMs += decodeMs;
  window.maxMissMs = Math.max(window.maxMissMs, missMs);
  window.maxDecryptMs = Math.max(window.maxDecryptMs, decryptMs);
  window.maxDecodeMs = Math.max(window.maxDecodeMs, decodeMs);
}

export function isColumnarChunkData(data: unknown): data is ColumnarChunkEnvelope {
  return isColumnarChunkEnvelope(data);
}

export function readDecryptedChunkItem(data: DecryptedChunkData, index: number): any {
  if (isColumnarChunkData(data)) return getColumnarItem(data.payload, index);
  if (Array.isArray(data)) return data[index];
  return undefined;
}

export function readDecryptedChunkRange(
  data: DecryptedChunkData,
  start: number,
  end: number,
): any[] {
  if (isColumnarChunkData(data)) return materializeColumnarRange(data.payload, start, end);
  if (Array.isArray(data)) return data.slice(start, end);
  return [];
}

export function materializeDecryptedChunk(data: DecryptedChunkData): any {
  if (isColumnarChunkData(data)) return materializeColumnarRange(data.payload, 0, data.payload.meta.count);
  return data;
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

export function chunkCacheKey(scopeKey: string, chunkId: string): string {
  return `${scopeKey}::${chunkId}`;
}

export function clearScopeChunkCache(self: MEKernelLike, scopeKey: string): void {
  const prefix = `${scopeKey}::`;
  for (const k of Array.from(self.decryptedBranchCache.keys())) {
    if (k.startsWith(prefix)) self.decryptedBranchCache.delete(k);
  }
  for (const k of Array.from(self.writeBranchCache.keys())) {
    if (k.startsWith(prefix)) self.writeBranchCache.delete(k);
  }
}

function parseIndexedSegment(segment: string | undefined): number | null {
  if (typeof segment !== "string" || segment.length === 0) return null;
  const n = Number(segment);
  if (!Number.isInteger(n) || n < 0) return null;
  return String(n) === segment ? n : null;
}

export function createBranchContainerForRel(rel: SemanticPath): any {
  return parseIndexedSegment(rel[0]) !== null ? [] : {};
}

export function getChunkId(self: MEKernelLike, path: SemanticPath, scope: SemanticPath): string {
  const rel = path.slice(scope.length);
  if (rel.length === 0) return "root";
  const rootIndex = parseIndexedSegment(rel[0]);
  if (rootIndex !== null) {
    return `idx_${Math.floor(rootIndex / self.secretChunkSize)}`;
  }
  const head = rel[0] || "root";
  const next = rel[1];
  if (next === undefined) return `${head}_root`;
  const n = parseIndexedSegment(next);
  if (n !== null) {
    return `${head}_${Math.floor(n / self.secretChunkSize)}`;
  }
  const h = parseInt(hashFn(String(next)).slice(-6), 16) % self.secretHashBuckets;
  return `${head}_h${h}`;
}

export function getChunkRelativePath(
  self: MEKernelLike,
  path: SemanticPath,
  scope: SemanticPath,
): SemanticPath {
  const rel = path.slice(scope.length);
  if (rel.length === 0) return rel;
  const rootIndex = parseIndexedSegment(rel[0]);
  if (rootIndex === null) return rel;
  return [String(rootIndex % self.secretChunkSize), ...rel.slice(1)];
}

export function getLegacyChunkIdForPath(
  _self: MEKernelLike,
  path: SemanticPath,
  scope: SemanticPath,
): string | null {
  const rel = path.slice(scope.length);
  const rootIndex = parseIndexedSegment(rel[0]);
  if (rootIndex === null) return null;
  return `${rootIndex}_root`;
}

export function setAtPath(obj: any, rel: SemanticPath, value: any): void {
  if (rel.length === 0) return;
  let ref = obj;
  for (let i = 0; i < rel.length - 1; i++) {
    const part = rel[i];
    const nextPart = rel[i + 1];
    if (!ref[part] || typeof ref[part] !== "object") {
      ref[part] = parseIndexedSegment(nextPart) !== null ? [] : {};
    }
    ref = ref[part];
  }
  ref[rel[rel.length - 1]] = value;
}

export function flattenLeaves(
  node: any,
  rel: SemanticPath,
  out: Array<{ rel: SemanticPath; value: any }>,
): void {
  if (isPointer(node) || isIdentityRef(node) || node === null || typeof node !== "object" || Array.isArray(node)) {
    out.push({ rel, value: node });
    return;
  }
  const keys = Object.keys(node);
  if (keys.length === 0) {
    out.push({ rel, value: node });
    return;
  }
  for (const k of keys) flattenLeaves(node[k], [...rel, k], out);
}

export function migrateLegacyScopeToChunks(
  self: MEKernelLike,
  scope: SemanticPath,
  legacyBlob: EncryptedBlob,
  scopeSecret: string,
): void {
  const scopeKey = scope.join(".");
  const legacyObj = xorDecrypt(legacyBlob, scopeSecret, scope);
  if (!legacyObj || typeof legacyObj !== "object") {
    self.branchStore.setScope(scopeKey, { default: legacyBlob });
    clearScopeChunkCache(self, scopeKey);
    return;
  }

  const leaves: Array<{ rel: SemanticPath; value: any }> = [];
  flattenLeaves(legacyObj, [], leaves);
  const chunkObjs: Record<string, any> = {};
  for (const leaf of leaves) {
    const leafPath = [...scope, ...leaf.rel];
    const chunkId = getChunkId(self, leafPath, scope);
    const localRel = getChunkRelativePath(self, leafPath, scope);
    if (!chunkObjs[chunkId] || typeof chunkObjs[chunkId] !== "object") {
      chunkObjs[chunkId] = createBranchContainerForRel(localRel);
    }
    setAtPath(chunkObjs[chunkId], localRel, leaf.value);
  }

  const next: Record<string, EncryptedBlob> = {};
  for (const [chunkId, chunkObj] of Object.entries(chunkObjs)) {
    next[chunkId] = xorEncrypt(chunkObj, scopeSecret, scope);
  }
  self.branchStore.setScope(scopeKey, next);
  clearScopeChunkCache(self, scopeKey);
}

export function ensureScopeChunks(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
): Record<string, EncryptedBlob> {
  const scopeKey = scope.join(".");
  const current = self.branchStore.getScope(scopeKey);
  if (!current) {
    return {};
  }
  if (typeof current === "string") {
    migrateLegacyScopeToChunks(self, scope, current as EncryptedBlob, scopeSecret);
    return (self.branchStore.getScope(scopeKey) || {}) as Record<string, EncryptedBlob>;
  }
  return current as Record<string, EncryptedBlob>;
}

export function getChunkBlob(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
): EncryptedBlob | undefined {
  const scopeKey = scope.join(".");
  return self.branchStore.getChunk(scopeKey, chunkId);
}

export function setChunkBlob(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
  blob: EncryptedBlob,
  scopeSecret: string,
): void {
  const scopeKey = scope.join(".");
  if (self.branchStore.getScopeMode(scopeKey) === "legacy") {
    ensureScopeChunks(self, scope, scopeSecret);
  }
  self.branchStore.setChunk(scopeKey, chunkId, blob);
  self.decryptedBranchCache.delete(chunkCacheKey(scopeKey, chunkId));
  self.writeBranchCache.delete(chunkCacheKey(scopeKey, chunkId));
}

export function listEncryptedScopes(self: MEKernelLike): string[] {
  return self.branchStore.listScopes();
}

export function deleteEncryptedScope(self: MEKernelLike, scopeKey: string): void {
  self.branchStore.deleteScope(scopeKey);
  clearScopeChunkCache(self, scopeKey);
}

export function primeDecryptedBranchCache(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
  data: any,
): void {
  // Branch writes already hold the clear object in memory, so we seed the cache here
  // and avoid paying a full decrypt on the first read right after mutation.
  const scopeKey = scope.join(".");
  const blob = getChunkBlob(self, scope, chunkId);
  if (!blob) return;
  const ck = chunkCacheKey(scopeKey, chunkId);
  touchLruEntry(self.decryptedBranchCache, ck, {
    epoch: self.secretEpoch,
    blob,
    data,
  });
  trimLruCache(self.decryptedBranchCache, MAX_DECRYPTED_BRANCH_CACHE_ENTRIES);
}

export function getDecryptedChunk(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkId: string,
): DecryptedChunkData | undefined {
  const startedAt = nowMs();
  const scopeKey = scope.join(".");
  const blob = getChunkBlob(self, scope, chunkId);
  if (!blob) return undefined;
  const ck = chunkCacheKey(scopeKey, chunkId);
  const hit = self.decryptedBranchCache.get(ck);
  if (hit && hit.epoch === self.secretEpoch && hit.blob === blob) {
    touchLruEntry(self.decryptedBranchCache, ck, hit);
    recordDecryptedChunkCacheHit(self, nowMs() - startedAt);
    return hit.data as DecryptedChunkData;
  }

  const version = detectBlobVersion(blob);
  let data: unknown = null;
  const decryptStartedAt = nowMs();
  if (version === "v3") {
    try {
      const keys = getOrDeriveV3Keys(self, scope, "branch");
      data = decryptBlobV3WithDerivedKeys(blob, keys);
    } catch {
      data = null;
    }
  } else {
    data = xorDecrypt(blob, scopeSecret, scope);
  }
  const decryptMs = nowMs() - decryptStartedAt;
  let decodeMs = 0;
  if (!data || typeof data !== "object") {
    recordDecryptedChunkMiss(self, version === "v3" ? "v3" : "v2", nowMs() - startedAt, decryptMs, decodeMs);
    return undefined;
  }

  let decoded: DecryptedChunkData;
  if (isColumnarChunkEnvelope(data)) {
    const decodeStartedAt = nowMs();
    const payload = reconstructColumnarChunkPayload((data as ColumnarChunkEnvelope).payload as ColumnarChunkPayload);
    decodeMs = nowMs() - decodeStartedAt;
    decoded = {
      ...(data as ColumnarChunkEnvelope),
      payload,
    };
  } else {
    decoded = data as any;
  }

  touchLruEntry(self.decryptedBranchCache, ck, { epoch: self.secretEpoch, blob, data: decoded });
  trimLruCache(self.decryptedBranchCache, MAX_DECRYPTED_BRANCH_CACHE_ENTRIES);
  recordDecryptedChunkMiss(self, version === "v3" ? "v3" : "v2", nowMs() - startedAt, decryptMs, decodeMs);
  return decoded;
}
