import {
  decryptBlobV3,
  detectBlobVersion,
  xorDecrypt,
  xorEncrypt,
} from "./crypto.js";
import { isIdentityRef, isPointer } from "./operators.js";
import { collectSecretChainV3 } from "./secret-context.js";
import type {
  EncryptedBlob,
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import { hashFn } from "./utils.js";

const MAX_DECRYPTED_BRANCH_CACHE_ENTRIES = 64;

function getPerfSink(): any | null {
  const sink = (globalThis as any).__ME_PERF__;
  if (!sink || sink.enabled !== true) return null;
  if (!sink.stats) sink.stats = {};
  if (!sink.counters) sink.counters = {};
  return sink;
}

function recordPerfSample(key: string, durationMs: number): void {
  const sink = getPerfSink();
  if (!sink) return;
  const stat = sink.stats[key] || (sink.stats[key] = { calls: 0, totalMs: 0, samples: [] });
  stat.calls++;
  stat.totalMs += durationMs;
  stat.samples.push(durationMs);
}

function incrementPerfCounter(key: string): void {
  const sink = getPerfSink();
  if (!sink) return;
  sink.counters[key] = (sink.counters[key] || 0) + 1;
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
}

export function getChunkId(self: MEKernelLike, path: SemanticPath, scope: SemanticPath): string {
  const rel = path.slice(scope.length);
  if (rel.length === 0) return "root";
  const head = rel[0] || "root";
  const next = rel[1];
  if (next === undefined) return `${head}_root`;
  const n = Number(next);
  if (Number.isFinite(n) && String(n) === String(next)) {
    return `${head}_${Math.floor(Math.abs(n) / self.secretChunkSize)}`;
  }
  const h = parseInt(hashFn(String(next)).slice(-6), 16) % self.secretHashBuckets;
  return `${head}_h${h}`;
}

export function setAtPath(obj: any, rel: SemanticPath, value: any): void {
  if (rel.length === 0) return;
  let ref = obj;
  for (let i = 0; i < rel.length - 1; i++) {
    const part = rel[i];
    if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
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
    self.encryptedBranches[scopeKey] = { default: legacyBlob };
    return;
  }

  const leaves: Array<{ rel: SemanticPath; value: any }> = [];
  flattenLeaves(legacyObj, [], leaves);
  const chunkObjs: Record<string, any> = {};
  for (const leaf of leaves) {
    const chunkId = getChunkId(self, [...scope, ...leaf.rel], scope);
    if (!chunkObjs[chunkId] || typeof chunkObjs[chunkId] !== "object") chunkObjs[chunkId] = {};
    setAtPath(chunkObjs[chunkId], leaf.rel, leaf.value);
  }

  const next: Record<string, EncryptedBlob> = {};
  for (const [chunkId, chunkObj] of Object.entries(chunkObjs)) {
    next[chunkId] = xorEncrypt(chunkObj, scopeSecret, scope);
  }
  self.encryptedBranches[scopeKey] = next;
  clearScopeChunkCache(self, scopeKey);
}

export function ensureScopeChunks(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
): Record<string, EncryptedBlob> {
  const scopeKey = scope.join(".");
  const current = self.encryptedBranches[scopeKey];
  if (!current) {
    const next: Record<string, EncryptedBlob> = {};
    self.encryptedBranches[scopeKey] = next;
    return next;
  }
  if (typeof current === "string") {
    migrateLegacyScopeToChunks(self, scope, current as EncryptedBlob, scopeSecret);
    return self.encryptedBranches[scopeKey] as Record<string, EncryptedBlob>;
  }
  return current as Record<string, EncryptedBlob>;
}

export function getChunkBlob(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
): EncryptedBlob | undefined {
  const scopeKey = scope.join(".");
  const current = self.encryptedBranches[scopeKey];
  if (!current) return undefined;
  if (typeof current === "string") return chunkId === "default" ? (current as EncryptedBlob) : undefined;
  return (current as Record<string, EncryptedBlob>)[chunkId];
}

export function setChunkBlob(
  self: MEKernelLike,
  scope: SemanticPath,
  chunkId: string,
  blob: EncryptedBlob,
  scopeSecret: string,
): void {
  const scopeKey = scope.join(".");
  const chunks = ensureScopeChunks(self, scope, scopeSecret);
  chunks[chunkId] = blob;
  self.decryptedBranchCache.delete(chunkCacheKey(scopeKey, chunkId));
}

export function getDecryptedChunk(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkId: string,
): any | undefined {
  const totalStart = performance.now();
  const scopeKey = scope.join(".");
  const blob = getChunkBlob(self, scope, chunkId);
  if (!blob) {
    recordPerfSample("secret-storage.getDecryptedChunk.total", performance.now() - totalStart);
    return undefined;
  }
  const ck = chunkCacheKey(scopeKey, chunkId);
  const hit = self.decryptedBranchCache.get(ck);
  if (hit && hit.epoch === self.secretEpoch && hit.blob === blob) {
    incrementPerfCounter("secret-storage.getDecryptedChunk.cache.hit");
    touchLruEntry(self.decryptedBranchCache, ck, hit);
    recordPerfSample("secret-storage.getDecryptedChunk.total", performance.now() - totalStart);
    return hit.data;
  }
  incrementPerfCounter("secret-storage.getDecryptedChunk.cache.miss");

  const version = detectBlobVersion(blob);
  let data: any = null;
  if (version === "v3") {
    try {
      const start = performance.now();
      const chain = collectSecretChainV3(self, scope, "branch");
      data = decryptBlobV3(blob, chain, "branch", scope);
      recordPerfSample("secret-storage.getDecryptedChunk.v3", performance.now() - start);
    } catch {
      data = null;
    }
  } else {
    const start = performance.now();
    data = xorDecrypt(blob, scopeSecret, scope);
    recordPerfSample("secret-storage.getDecryptedChunk.v2_legacy", performance.now() - start);
  }
  if (!data || typeof data !== "object") {
    recordPerfSample("secret-storage.getDecryptedChunk.total", performance.now() - totalStart);
    return undefined;
  }
  touchLruEntry(self.decryptedBranchCache, ck, { epoch: self.secretEpoch, blob, data });
  trimLruCache(self.decryptedBranchCache, MAX_DECRYPTED_BRANCH_CACHE_ENTRIES);
  recordPerfSample("secret-storage.getDecryptedChunk.total", performance.now() - totalStart);
  return data;
}
