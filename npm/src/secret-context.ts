import type { MEKernelLike, SemanticPath } from "./types.js";
import { hashFn } from "./utils.js";

const MAX_SCOPE_CACHE_ENTRIES = 256;
const MAX_EFFECTIVE_SECRET_CACHE_ENTRIES = 256;

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

export function bumpSecretEpoch(self: MEKernelLike): void {
  self.secretEpoch++;
  self.scopeCache.clear();
  self.effectiveSecretCache.clear();
  self.decryptedBranchCache.clear();
}

export function computeEffectiveSecret(self: MEKernelLike, path: SemanticPath): string {
  const pathKey = path.join(".");
  const hit = self.effectiveSecretCache.get(pathKey);
  if (hit && hit.epoch === self.secretEpoch) {
    touchLruEntry(self.effectiveSecretCache, pathKey, hit);
    return hit.value;
  }

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
  touchLruEntry(self.effectiveSecretCache, pathKey, { epoch: self.secretEpoch, value: out });
  trimLruCache(self.effectiveSecretCache, MAX_EFFECTIVE_SECRET_CACHE_ENTRIES);
  return out;
}

export function resolveBranchScope(self: MEKernelLike, path: SemanticPath): SemanticPath | null {
  const pathKey = path.join(".");
  const hit = self.scopeCache.get(pathKey);
  if (hit && hit.epoch === self.secretEpoch) {
    touchLruEntry(self.scopeCache, pathKey, hit);
    return hit.scope ? [...hit.scope] : null;
  }

  let best: SemanticPath | null = null;
  if (self.localSecrets[""]) best = [];
  for (let i = 1; i <= path.length; i++) {
    const p = path.slice(0, i);
    const k = p.join(".");
    if (self.localSecrets[k]) best = p;
  }
  touchLruEntry(self.scopeCache, pathKey, { epoch: self.secretEpoch, scope: best ? [...best] : null });
  trimLruCache(self.scopeCache, MAX_SCOPE_CACHE_ENTRIES);
  return best;
}
