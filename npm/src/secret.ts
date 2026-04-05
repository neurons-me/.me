import { xorDecrypt, xorEncrypt } from "./crypto.js";
import { isIdentityRef, isPointer } from "./operators.js";
import type {
  EncryptedBlob,
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import { hashFn } from "./utils.js";

export function bumpSecretEpoch(self: MEKernelLike): void {
  self.secretEpoch++;
  self.scopeCache.clear();
  self.effectiveSecretCache.clear();
  self.decryptedBranchCache.clear();
}

export function computeEffectiveSecret(self: MEKernelLike, path: SemanticPath): string {
  const pathKey = path.join(".");
  const hit = self.effectiveSecretCache.get(pathKey);
  if (hit && hit.epoch === self.secretEpoch) return hit.value;

  let noiseKey: string | null = null;
  let noiseValue: string | null = null;
  if (self.localNoises[""] !== undefined) {
    noiseKey = "";
    noiseValue = self.localNoises[""];
  }

  for (let i = 1; i <= path.length; i++) {
    const k = path.slice(0, i).join(".");
    if (self.localNoises[k] !== undefined) {
      noiseKey = k;
      noiseValue = self.localNoises[k];
    }
  }

  let seed = "root";
  if (noiseValue) {
    seed = hashFn("noise::" + noiseValue);
  } else if (self.localSecrets[""]) {
    seed = hashFn(seed + "::" + self.localSecrets[""]);
  }

  for (let i = 1; i <= path.length; i++) {
    const p = path.slice(0, i).join(".");
    if (self.localSecrets[p]) {
      if (noiseKey !== null) {
        if (noiseKey === "") {
          // allow all below root
        } else {
          const noisePrefix = noiseKey + ".";
          if (!(p === noiseKey || p.startsWith(noisePrefix))) continue;
        }
      }
      seed = hashFn(seed + "::" + self.localSecrets[p]);
    }
  }

  const out = seed === "root" ? "" : seed;
  self.effectiveSecretCache.set(pathKey, { epoch: self.secretEpoch, value: out });
  return out;
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
  const scopeKey = scope.join(".");
  const blob = getChunkBlob(self, scope, chunkId);
  if (!blob) return undefined;
  const ck = chunkCacheKey(scopeKey, chunkId);
  const hit = self.decryptedBranchCache.get(ck);
  if (hit && hit.epoch === self.secretEpoch && hit.blob === blob) return hit.data;

  const data = xorDecrypt(blob, scopeSecret, scope);
  if (!data || typeof data !== "object") return undefined;
  self.decryptedBranchCache.set(ck, { epoch: self.secretEpoch, blob, data });
  return data;
}

export function resolveBranchScope(self: MEKernelLike, path: SemanticPath): SemanticPath | null {
  const pathKey = path.join(".");
  const hit = self.scopeCache.get(pathKey);
  if (hit && hit.epoch === self.secretEpoch) return hit.scope ? [...hit.scope] : null;

  let best: SemanticPath | null = null;
  if (self.localSecrets[""]) best = [];
  for (let i = 1; i <= path.length; i++) {
    const p = path.slice(0, i);
    const k = p.join(".");
    if (self.localSecrets[k]) best = p;
  }
  self.scopeCache.set(pathKey, { epoch: self.secretEpoch, scope: best ? [...best] : null });
  return best;
}
