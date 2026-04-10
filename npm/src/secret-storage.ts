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

const MAX_DECRYPTED_BRANCH_CACHE_ENTRIES = 64;

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
): any | undefined {
  const scopeKey = scope.join(".");
  const blob = getChunkBlob(self, scope, chunkId);
  if (!blob) return undefined;
  const ck = chunkCacheKey(scopeKey, chunkId);
  const hit = self.decryptedBranchCache.get(ck);
  if (hit && hit.epoch === self.secretEpoch && hit.blob === blob) {
    touchLruEntry(self.decryptedBranchCache, ck, hit);
    return hit.data;
  }

  const version = detectBlobVersion(blob);
  let data: any = null;
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
  if (!data || typeof data !== "object") return undefined;
  touchLruEntry(self.decryptedBranchCache, ck, { epoch: self.secretEpoch, blob, data });
  trimLruCache(self.decryptedBranchCache, MAX_DECRYPTED_BRANCH_CACHE_ENTRIES);
  return data;
}
