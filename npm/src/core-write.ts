import { encryptBlobV3, xorEncrypt } from "./crypto.js";
import {
  clearDerivationsByPrefix,
  invalidateFromPath,
  registerDerivation,
} from "./derivation.js";
import { tryEvaluateAssignExpression } from "./evaluator.js";
import { normalizeCall } from "./normalizeCall.js";
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
} from "./operators.js";
import {
  bumpSecretEpoch,
  clearScopeChunkCache,
  computeEffectiveSecret,
  getChunkId,
  getDecryptedChunk,
  resolveBranchScope,
  setChunkBlob,
} from "./secret.js";
import { collectSecretChainV3 } from "./secret-context.js";
import type {
  KernelMemory,
  MappingInstruction,
  MEKernelLike,
  OperatorRegistry,
  ReplayMemoryInput,
  SemanticPath,
} from "./types.js";
import {
  toKernelMemories,
} from "./memory-redaction.js";
import {
  cloneValue,
  getPrevMemoryHash,
  hashFn,
  normalizeSelectorPath,
  pathContainsIterator,
  substituteIteratorInExpression,
  substituteIteratorInPath,
} from "./utils.js";
import {
  collectFilteredScopes,
  collectIteratorIndices,
  pathContainsFilterSelector,
} from "./core-read.js";

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

  self.postulate(path, next.expression, next.operator ?? null);
}

export function replayMemories(self: MEKernelLike, memories: ReplayMemoryInput[]): void {
  self.localSecrets = {};
  self.localNoises = {};
  self.encryptedBranches = {};
  self.keySpaces = {};
  bumpSecretEpoch(self);
  self.index = {};
  self._memories = [];
  self.derivations = {};
  self.refSubscribers = {};
  self.refVersions = {};
  self.derivationRefVersions = {};
  self.staleDerivations.clear();

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

    self.postulate(path, t.expression, t.operator);
  }
  self.rebuildIndex();
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
  const memory: KernelMemory = {
    path: pathStr,
    operator,
    expression,
    value,
    effectiveSecret,
    hash,
    prevHash,
    timestamp,
  };
  self._memories.push(memory);
  self.applyMemoryToIndex(memory);
  return memory;
}

export function commitValueMapping(
  self: MEKernelLike,
  targetPath: SemanticPath,
  expression: any,
  operator: string | null = null,
): KernelMemory {
  let storedValue: any = expression;
  const pathStr = targetPath.join(".");
  const effectiveSecret = computeEffectiveSecret(self, targetPath);
  const scope = resolveBranchScope(self, targetPath);
  if (scope && scope.length === 0 && self.localSecrets[""] && !self.localSecrets[pathStr]) {
    // root secret is allowed to encrypt leaves (value-level), so no-op here
  }

  if (scope && scope.length > 0) {
    const scopeSecret = computeEffectiveSecret(self, scope);
    const rel = targetPath.slice(scope.length);
    const chunkId = getChunkId(self, targetPath, scope);
    let branchObj: any = {};
    if (scopeSecret) {
      const dec = getDecryptedChunk(self, scope, scopeSecret, chunkId);
      if (dec && typeof dec === "object") branchObj = cloneValue(dec);
    }

    if (rel.length === 0) {
      if (typeof branchObj !== "object" || branchObj === null) branchObj = {};
      branchObj.expression = expression;
    } else {
      let ref = branchObj;
      for (let i = 0; i < rel.length - 1; i++) {
        const part = rel[i];
        if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
        ref = ref[part];
      }
      ref[rel[rel.length - 1]] = expression;
    }

    if (scopeSecret) {
      // v3 is the primary write path. v2 remains available only for compatibility and rollback forcing.
      const blob = self.secretBlobVersion === "v2"
        ? xorEncrypt(branchObj, scopeSecret, scope)
        : encryptBlobV3(branchObj, collectSecretChainV3(self, scope, "branch"), "branch", scope);
      setChunkBlob(self, scope, chunkId, blob, scopeSecret);
    }
    storedValue = expression;
  } else if (effectiveSecret) {
    const shouldEncryptValue = operator !== "=" && operator !== "?";
    if (isPointer(expression) || isIdentityRef(expression) || !shouldEncryptValue) {
      storedValue = expression;
    } else {
      storedValue = self.secretBlobVersion === "v2"
        ? xorEncrypt(expression, effectiveSecret, targetPath)
        : encryptBlobV3(expression, collectSecretChainV3(self, targetPath, "value"), "value", targetPath);
    }
  } else {
    storedValue = expression;
  }

  return commitMemoryOnly(self, targetPath, operator, expression, storedValue);
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
      const scopeKey = instruction.path.join(".");
      self.localSecrets[scopeKey] = instruction.value;
      bumpSecretEpoch(self);
      return commitMemoryOnly(self, instruction.path, "_", "***", "***");
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

  for (const key of Object.keys(self.encryptedBranches)) {
    if (prefix === "") {
      delete self.encryptedBranches[key];
      clearScopeChunkCache(self, key);
      continue;
    }
    if (key === prefix || key.startsWith(prefix + ".")) {
      delete self.encryptedBranches[key];
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
    branchObj = cloneValue(branchObj);

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
      const nextBlob = xorEncrypt(branchObj, scopeSecret, scope);
      setChunkBlob(self, scope, writeChunkId, nextBlob, scopeSecret);
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
  const memory: KernelMemory = {
    path: pathStr,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret,
    hash,
    prevHash,
    timestamp,
  };
  self._memories.push(memory);
  self.applyMemoryToIndex(memory);
}
