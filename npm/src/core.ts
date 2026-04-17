import {
  decryptBlobV3WithDerivedKeys,
  detectBlobVersion,
  isEncryptedBlob,
  xorDecrypt,
} from "./crypto.js";
import {
  handleKernelTarget,
  normalizeExecutablePath,
  normalizeExecutableTarget,
} from "./core-dispatch.js";
import {
  getIndex,
  resolveIndexPointerPath,
} from "./core-index.js";
import {
  handleKeySpaceTarget,
  parseKeySpacePath,
} from "./core-keyspace.js";
import {
  buildPublicSubtree,
  collectChildrenForPrefix,
  collectFilteredScopes,
  collectIteratorIndices,
  evaluateFilterClauseForScope,
  evaluateFilterPath,
  evaluateLogicalFilterForScope,
  evaluateSelectionPath,
  evaluateTransformPath,
  pathContainsFilterSelector,
  resolveRelativeFirst,
} from "./core-read.js";
import { toPublicMemories } from "./memory-redaction.js";
import {
  isIdentityRef,
  isPointer,
  pathStartsWith,
} from "./operators.js";
import { getOrDeriveV3Keys } from "./secret-context.js";
import {
  computeEffectiveSecret,
  getChunkId,
  getDecryptedChunk,
  resolveBranchScope,
} from "./secret.js";
import type {
  MeTargetAst,
  MEInspectResult,
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import {
  cloneValue,
  normalizeSelectorPath,
} from "./utils.js";

const MAX_DECRYPTED_VALUE_CACHE_ENTRIES = 128;

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

function cloneCachedValue<T>(value: T): T {
  if (value && typeof value === "object") return cloneValue(value);
  return value;
}

function getCachedValueDecrypt(self: MEKernelLike, path: SemanticPath, blob: `0x${string}`): any {
  const cacheKey = path.join(".");
  const hit = self.decryptedValueCache.get(cacheKey);
  if (hit && hit.epoch === self.secretEpoch && hit.blob === blob) {
    touchLruEntry(self.decryptedValueCache, cacheKey, hit);
    return cloneCachedValue(hit.data);
  }
  return undefined;
}

function setCachedValueDecrypt(self: MEKernelLike, path: SemanticPath, blob: `0x${string}`, value: any): any {
  const cacheKey = path.join(".");
  const cachedValue = cloneCachedValue(value);
  touchLruEntry(self.decryptedValueCache, cacheKey, {
    epoch: self.secretEpoch,
    blob,
    data: cachedValue,
  });
  trimLruCache(self.decryptedValueCache, MAX_DECRYPTED_VALUE_CACHE_ENTRIES);
  return cloneCachedValue(cachedValue);
}

export {
  commitIndexedBatch,
  commitMapping,
  commitMemoryOnly,
  commitValueMapping,
  learn,
  postulate,
  removeSubtree,
  replayMemories,
} from "./core-write.js";

export {
  getRecomputeMode,
  handleKernelExport,
  handleKernelGet,
  handleKernelImport,
  handleKernelRead,
  handleKernelRehydrate,
  handleKernelReplay,
  handleKernelSet,
  handleKernelTarget,
  normalizeExecutablePath,
  normalizeExecutableTarget,
  parseExecutableTarget,
  setRecomputeMode,
  splitTargetNamespace,
} from "./core-dispatch.js";
export {
  applyMemoryToIndex,
  getIndex,
  rebuildIndex,
  removeIndexPrefix,
  resolveIndexPointerPath,
  setIndex,
} from "./core-index.js";
export {
  handleKeySpaceTarget,
  installRecipientKey,
  openWrappedKey,
  parseKeySpacePath,
  readWrappedKey,
  storeWrappedKey,
  uninstallRecipientKey,
  writeWrappedKey,
} from "./core-keyspace.js";
export {
  exportSnapshot,
  importSnapshot,
  rehydrate,
} from "./core-snapshot.js";
export {
  buildPublicSubtree,
  collectChildrenForPrefix,
  collectFilteredScopes,
  collectIteratorIndices,
  evaluateFilterClauseForScope,
  evaluateFilterPath,
  evaluateLogicalFilterForScope,
  evaluateSelectionPath,
  evaluateTransformPath,
  pathContainsFilterSelector,
  resolveRelativeFirst,
} from "./core-read.js";

export function inspect(self: MEKernelLike, opts?: { last?: number }): MEInspectResult {
  const last = opts?.last;
  const memories =
    typeof last === "number" && Number.isFinite(last) && last > 0
      ? self._memories.slice(-Math.floor(last))
      : self._memories.slice();
  return {
    memories: toPublicMemories(memories),
    index: { ...self.index },
    encryptedScopes: self.branchStore.listScopes(),
    secretScopes: Object.keys(self.localSecrets),
    noiseScopes: Object.keys(self.localNoises),
    recomputeMode: self.recomputeMode,
    staleDerivations: self.staleDerivations.size,
  };
}

export function execute(self: MEKernelLike, rawTarget: string | MeTargetAst, body?: any): any {
  const target = normalizeExecutableTarget(self, rawTarget);

  switch (target.namespace) {
    case "self":
      return handleSelfTarget(self, target.operation, target.path, body);
    case "kernel":
      return handleKernelTarget(self, target.operation, target.path, body);
    default:
      throw new Error(
        `External me target "${target.namespace}" must be resolved by cleaker or monad.ai before reaching the local kernel.`,
      );
  }
}

export function handleSelfTarget(
  self: MEKernelLike,
  operation: string,
  rawPath: string,
  body?: any,
): any {
  const keyPath = parseKeySpacePath(rawPath);
  if (keyPath.isKeySpace) {
    return handleKeySpaceTarget(self, operation, keyPath.keyId, body);
  }

  const path = normalizeExecutablePath(rawPath);

  switch (operation) {
    case "read":
      return self.readPath(path.parts);
    case "write":
      if (!path.key) throw new Error("self:write requires a semantic path.");
      if (body === undefined) throw new Error("self:write requires a body payload.");
      return self.postulate(path.parts, body);
    case "inspect":
      return inspectAtPath(self, path.key);
    case "explain":
      if (!path.key) throw new Error("self:explain requires a semantic path.");
      return self.explain(path.key);
    default:
      throw new Error(`Unsupported self operation: ${operation}`);
  }
}

export function inspectAtPath(self: MEKernelLike, scopeKey: string) {
  const snapshot = self.inspect();
  if (!scopeKey) return snapshot;

  const matchesScope = (candidate: string) =>
    candidate === scopeKey || candidate.startsWith(scopeKey + ".");

  return {
    path: scopeKey,
    value: self.readPath(scopeKey.split(".").filter(Boolean)),
    memories: snapshot.memories.filter((memory) => matchesScope(memory.path)),
    index: Object.fromEntries(
      Object.entries(snapshot.index).filter(([path]) => matchesScope(path)),
    ),
    encryptedScopes: snapshot.encryptedScopes.filter(matchesScope),
    secretScopes: snapshot.secretScopes.filter(matchesScope),
    noiseScopes: snapshot.noiseScopes.filter(matchesScope),
    recomputeMode: snapshot.recomputeMode,
    staleDerivations: snapshot.staleDerivations,
  };
}

export function readPath(self: MEKernelLike, rawPath: SemanticPath): any {
  const transformed = evaluateTransformPath(self, rawPath);
  if (transformed !== undefined) return transformed;

  const selected = evaluateSelectionPath(self, rawPath);
  if (selected !== undefined) return selected;

  const path = normalizeSelectorPath(rawPath);
  if (self.recomputeMode === "lazy") {
    const key = path.join(".");
    if (self.derivations[key]) self.ensureTargetFresh(key);
  }
  const filtered = evaluateFilterPath(self, path);
  if (filtered !== undefined) return filtered;

  const scope = resolveBranchScope(self, path);
  if (scope && scope.length > 0 && pathStartsWith(path, scope)) {
    if (path.length === scope.length) return undefined;
    const scopeSecret = computeEffectiveSecret(self, scope);
    if (!scopeSecret) return null;
    const chunkId = getChunkId(self, path, scope);
    let branchObj = getDecryptedChunk(self, scope, scopeSecret, chunkId);
    if (!branchObj && chunkId !== "default") {
      branchObj = getDecryptedChunk(self, scope, scopeSecret, "default");
    }
    if (!branchObj) return undefined;
    const rel = path.slice(scope.length);
    let ref: any = branchObj;
    for (const part of rel) {
      if (!ref || typeof ref !== "object") return undefined;
      ref = ref[part];
    }
    if (isPointer(ref)) return self.readPath(ref.__ptr.split(".").filter(Boolean));
    if (isIdentityRef(ref)) return cloneValue(ref);
    if (ref && typeof ref === "object") return cloneValue(ref);
    return ref;
  }

  const directRaw = getIndex(self, path);
  if (isPointer(directRaw)) return directRaw;
  const resolved = resolveIndexPointerPath(self, path);
  const raw = resolved.raw;
  if (raw === undefined) {
    const samePath =
      resolved.path.length === path.length &&
      resolved.path.every((part, i) => part === path[i]);
    if (!samePath) return self.readPath(resolved.path);
    return undefined;
  }
  if (isPointer(raw)) return self.readPath(raw.__ptr.split(".").filter(Boolean));
  if (isIdentityRef(raw)) return raw;
  if (!isEncryptedBlob(raw)) return raw;
  const blobVersion = detectBlobVersion(raw);
  if (blobVersion === "v3") {
    try {
      const cached = getCachedValueDecrypt(self, path, raw);
      if (cached !== undefined) return cached;
      const keys = getOrDeriveV3Keys(self, path, "value");
      const value = decryptBlobV3WithDerivedKeys(raw, keys);
      if (value === null || value === undefined) return value;
      return setCachedValueDecrypt(self, path, raw, value);
    } catch {
      return null;
    }
  }
  const effectiveSecret = computeEffectiveSecret(self, path);
  if (!effectiveSecret) return null;
  return xorDecrypt(raw, effectiveSecret, path);
}
