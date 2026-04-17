import { deriveBlobV3Keys } from "./crypto.ts";
import type {
  MEBlobV3KeyCacheEntry,
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import { hashFn } from "./utils.ts";

const MAX_SCOPE_CACHE_ENTRIES = 256;
const MAX_EFFECTIVE_SECRET_CACHE_ENTRIES = 256;
const MAX_V3_KEY_CACHE_ENTRIES = 256;
const V3_DOMAIN = "this.me/blob/v3";
const V3_NO_NOISE_SENTINEL = "this.me/blob/v3/no-noise";

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

function trimV3KeyCache(self: MEKernelLike): void {
  while (self.v3KeyCache.size > MAX_V3_KEY_CACHE_ENTRIES) {
    const oldest = self.v3KeyCache.keys().next();
    if (oldest.done) return;
    const entry = self.v3KeyCache.get(oldest.value);
    if (entry) {
      entry.encKey.fill(0);
      entry.macKey.fill(0);
      entry.pathContext.fill(0);
    }
    self.v3KeyCache.delete(oldest.value);
  }
}

function utf8Bytes(input: string): Uint8Array {
  const value = String(input ?? "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "utf8"));
  }

  const encoded = unescape(encodeURIComponent(value));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function normalizePathBytes(path: SemanticPath): Uint8Array {
  return utf8Bytes(path.join("."));
}

function findActiveNoiseBoundary(
  self: MEKernelLike,
  path: SemanticPath,
): { key: string | null; value: string | null } {
  let noiseKey: string | null = null;
  let noiseValue: string | null = null;
  if (self.localNoises[""] !== undefined) {
    noiseKey = "";
    noiseValue = self.localNoises[""];
  }

  for (let i = 1; i <= path.length; i++) {
    const key = path.slice(0, i).join(".");
    if (self.localNoises[key] !== undefined) {
      noiseKey = key;
      noiseValue = self.localNoises[key];
    }
  }

  return { key: noiseKey, value: noiseValue };
}

function isSecretAllowedUnderNoise(noiseKey: string | null, secretKey: string): boolean {
  if (noiseKey === null) return true;
  if (noiseKey === "") return true;
  return secretKey === noiseKey || secretKey.startsWith(noiseKey + ".");
}

function encodeLineageSegment(kind: "noise" | "secret", pathKey: string, value: string): Uint8Array {
  return concatBytes(utf8Bytes(kind), new Uint8Array([0]), utf8Bytes(pathKey), new Uint8Array([0]), utf8Bytes(value));
}

function collectLineageSegments(
  self: MEKernelLike,
  anchorPath: SemanticPath,
  activeNoise: { key: string | null; value: string | null },
): Uint8Array[] {
  const out: Uint8Array[] = [];

  if (activeNoise.value !== null) {
    out.push(encodeLineageSegment("noise", activeNoise.key ?? "", activeNoise.value));
  } else if (self.localSecrets[""]) {
    out.push(encodeLineageSegment("secret", "", self.localSecrets[""]));
  }

  for (let i = 1; i <= anchorPath.length; i++) {
    const secretKey = anchorPath.slice(0, i).join(".");
    const secretValue = self.localSecrets[secretKey];
    if (!secretValue) continue;
    if (!isSecretAllowedUnderNoise(activeNoise.key, secretKey)) continue;
    out.push(encodeLineageSegment("secret", secretKey, secretValue));
  }

  return out;
}

export function bumpSecretEpoch(self: MEKernelLike): void {
  self.secretEpoch++;
  self.scopeCache.clear();
  self.effectiveSecretCache.clear();
  self.decryptedBranchCache.clear();
  self.writeBranchCache.clear();
  self.decryptedValueCache.clear();
  for (const cached of self.v3KeyCache.values()) {
    cached.encKey.fill(0);
    cached.macKey.fill(0);
    cached.pathContext.fill(0);
  }
  self.v3KeyCache.clear();
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

/**
 * Order is fixed and must remain stable for v3 derivation:
 * This chain now feeds the default write path, so changing it would be a format break.
 * [0] domain fixed: "this.me/blob/v3"
 * [1] mode: "branch" | "value"
 * [2] resolved scopePath
 * [3] anchorPath (scope for branch, full targetPath for value)
 * [4] active noise boundary path or sentinel "this.me/blob/v3/no-noise"
 * [5+] raw lineage segments in deterministic order (active noise + applicable secrets)
 */
export function collectSecretChainV3(
  self: MEKernelLike,
  targetPath: SemanticPath,
  mode: "branch" | "value",
): Uint8Array[] {
  const scopePath = resolveBranchScope(self, targetPath);
  if (!scopePath) {
    throw new Error(`No secret context active for "${targetPath.join(".")}".`);
  }
  if (mode === "branch" && scopePath.length === 0) {
    throw new Error("Branch v3 derivation does not support the root secret scope.");
  }

  const anchorPath = mode === "branch" ? scopePath : targetPath;
  const activeNoise = findActiveNoiseBoundary(self, anchorPath);
  const noiseBoundaryBytes =
    activeNoise.key === null ? utf8Bytes(V3_NO_NOISE_SENTINEL) : utf8Bytes(activeNoise.key);

  return [
    utf8Bytes(V3_DOMAIN),
    utf8Bytes(mode),
    normalizePathBytes(scopePath),
    normalizePathBytes(anchorPath),
    noiseBoundaryBytes,
    ...collectLineageSegments(self, anchorPath, activeNoise),
  ];
}

/**
 * Retorna las keys derivadas v3 desde el cache compartido o las deriva usando
 * la ruta oficial del runtime. Se comparte entre value reads y branch reads.
 * @internal
 */
export function getOrDeriveV3Keys(
  self: MEKernelLike,
  path: SemanticPath,
  mode: "branch" | "value",
): MEBlobV3KeyCacheEntry {
  const cacheKey = `${mode}::${path.join(".")}`;
  const hit = self.v3KeyCache.get(cacheKey);
  if (hit && hit.epoch === self.secretEpoch) {
    touchLruEntry(self.v3KeyCache, cacheKey, hit);
    return hit;
  }

  const chain = collectSecretChainV3(self, path, mode);
  const derived = deriveBlobV3Keys(chain, mode, path);
  const cached: MEBlobV3KeyCacheEntry = {
    epoch: self.secretEpoch,
    encKey: Uint8Array.from(derived.encKey),
    macKey: Uint8Array.from(derived.macKey),
    pathContext: Uint8Array.from(derived.pathContext),
  };
  touchLruEntry(self.v3KeyCache, cacheKey, cached);
  trimV3KeyCache(self);
  return cached;
}
