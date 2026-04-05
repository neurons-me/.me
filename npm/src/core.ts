import {
  isEncryptedBlob,
  unwrapSecretV1,
  xorDecrypt,
  xorEncrypt,
} from "./crypto.js";
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
import type {
  EncryptedBlob,
  MappingInstruction,
  MeTargetAst,
  Memory,
  MEInspectResult,
  MEKernelLike,
  MESnapshot,
  MESnapshotInput,
  MEWrappedKeyOpenOptions,
  OperatorRegistry,
  SemanticPath,
  StoredWrappedKey,
  WrappedSecretV1,
} from "./types.js";
import {
  cloneValue,
  compareValues,
  createDefaultOperators,
  findTopLevelIndex,
  getPrevMemoryHash,
  hashFn,
  normalizeSelectorPath,
  parseFilterExpression,
  parseLiteralOrPath,
  parseLogicalFilterExpression,
  parseSelectorKeys,
  parseSelectorSegment,
  parseTransformSelector,
  pathContainsIterator,
  substituteIteratorInExpression,
  substituteIteratorInPath,
} from "./utils.js";

export function inspect(self: MEKernelLike, opts?: { last?: number }): MEInspectResult {
  const last = opts?.last;
  const memories =
    typeof last === "number" && Number.isFinite(last) && last > 0
      ? self._memories.slice(-Math.floor(last))
      : self._memories.slice();
  return {
    memories,
    index: { ...self.index },
    encryptedScopes: Object.keys(self.encryptedBranches),
    secretScopes: Object.keys(self.localSecrets),
    noiseScopes: Object.keys(self.localNoises),
    recomputeMode: self.recomputeMode,
    staleDerivations: self.staleDerivations.size,
  };
}

export function setRecomputeMode(self: MEKernelLike, mode: "eager" | "lazy"): MEKernelLike {
  self.recomputeMode = mode;
  return self;
}

export function getRecomputeMode(self: MEKernelLike): "eager" | "lazy" {
  return self.recomputeMode;
}

export function installRecipientKey(
  self: MEKernelLike,
  recipientKeyId: string,
  privateKey: CryptoKey,
): MEKernelLike {
  const keyId = String(recipientKeyId || "").trim();
  if (!keyId) throw new Error("installRecipientKey(...) requires a recipient key id.");
  self.recipientKeyring[keyId] = privateKey;
  return self;
}

export function uninstallRecipientKey(self: MEKernelLike, recipientKeyId: string): MEKernelLike {
  const keyId = String(recipientKeyId || "").trim();
  if (!keyId) return self;
  delete self.recipientKeyring[keyId];
  return self;
}

export function storeWrappedKey(
  self: MEKernelLike,
  keyId: string,
  envelope: WrappedSecretV1,
  options?: { recipientKeyId?: string },
): MEKernelLike {
  const normalizedKeyId = String(keyId || "").trim();
  if (!normalizedKeyId) throw new Error("storeWrappedKey(...) requires a key id.");
  if (!envelope || envelope.version !== 1) {
    throw new Error("storeWrappedKey(...) requires a valid WrappedSecretV1 envelope.");
  }

  self.keySpaces[normalizedKeyId] = cloneValue({
    envelope,
    recipientKeyId: options?.recipientKeyId,
  });
  return self;
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

  const path = normalizeExecutablePath(self, rawPath);

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

export function handleKernelTarget(
  self: MEKernelLike,
  operation: string,
  rawPath: string,
  body?: any,
): any {
  const path = normalizeExecutablePath(self, rawPath);
  const key = path.key;

  switch (operation) {
    case "read":
      return handleKernelRead(self, key);
    case "export":
      return handleKernelExport(self, key);
    case "import":
      if (body === undefined) throw new Error("kernel:import requires a payload.");
      return handleKernelImport(self, key, body);
    case "replay":
      if (body === undefined) throw new Error("kernel:replay requires a payload.");
      return handleKernelReplay(self, key, body);
    case "rehydrate":
      if (body === undefined) throw new Error("kernel:rehydrate requires a payload.");
      return handleKernelRehydrate(self, key, body);
    case "get":
      return handleKernelGet(self, key);
    case "set":
      if (body === undefined) throw new Error("kernel:set requires a payload.");
      return handleKernelSet(self, key, body);
    default:
      throw new Error(`Unsupported kernel operation: ${operation}`);
  }
}

export function handleKernelRead(self: MEKernelLike, key: string): any {
  switch (key) {
    case "memory":
    case "memories":
    case "logs":
      return cloneValue(self.memories);
    case "snapshot":
      return self.exportSnapshot();
    case "mode":
    case "recompute.mode":
      return self.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:read path: ${key || "<root>"}`);
  }
}

export function handleKernelExport(self: MEKernelLike, key: string): any {
  switch (key) {
    case "memory":
    case "memories":
    case "logs":
      return cloneValue(self.memories);
    case "snapshot":
      return self.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:export path: ${key || "<root>"}`);
  }
}

export function handleKernelImport(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "snapshot":
      self.importSnapshot(body ?? {});
      return self.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:import path: ${key || "<root>"}`);
  }
}

export function handleKernelReplay(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "memory":
    case "memories":
    case "logs":
      if (!Array.isArray(body)) throw new Error("kernel:replay/memory requires a Memory[] payload.");
      self.replayMemories(body);
      return cloneValue(self.memories);
    default:
      throw new Error(`Unsupported kernel:replay path: ${key || "<root>"}`);
  }
}

export function handleKernelRehydrate(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "snapshot":
      self.rehydrate(body ?? {});
      return self.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:rehydrate path: ${key || "<root>"}`);
  }
}

export function handleKernelGet(self: MEKernelLike, key: string): any {
  switch (key) {
    case "mode":
    case "recompute.mode":
      return self.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:get path: ${key || "<root>"}`);
  }
}

export function handleKernelSet(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "mode":
    case "recompute.mode":
      if (body !== "eager" && body !== "lazy") {
        throw new Error(`kernel:set/${key} only accepts "eager" or "lazy".`);
      }
      self.setRecomputeMode(body);
      return self.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:set path: ${key || "<root>"}`);
  }
}

export function handleKeySpaceTarget(
  self: MEKernelLike,
  operation: string,
  keyId: string | null,
  body?: any,
): any {
  switch (operation) {
    case "read":
      if (!keyId) {
        return cloneValue(self.keySpaces);
      }
      return readWrappedKey(self, keyId);
    case "write":
      if (!keyId) throw new Error("self:write/keys requires a key id.");
      if (body === undefined) throw new Error("self:write/keys requires a payload.");
      return writeWrappedKey(self, keyId, body);
    case "open":
    case "use":
      if (!keyId) throw new Error(`self:${operation}/keys requires a key id.`);
      return openWrappedKey(self, keyId, body);
    default:
      throw new Error(`Unsupported keys operation: ${operation}`);
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

export function parseKeySpacePath(rawPath: string): { isKeySpace: boolean; keyId: string | null } {
  const trimmed = String(rawPath ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { isKeySpace: false, keyId: null };
  if (trimmed === "keys") return { isKeySpace: true, keyId: null };
  if (trimmed.startsWith("keys/")) {
    return { isKeySpace: true, keyId: trimmed.slice("keys/".length).trim() || null };
  }
  if (trimmed.startsWith("keys.")) {
    return { isKeySpace: true, keyId: trimmed.slice("keys.".length).trim() || null };
  }
  return { isKeySpace: false, keyId: null };
}

export function readWrappedKey(self: MEKernelLike, keyId: string): WrappedSecretV1 {
  const entry = self.keySpaces[keyId];
  if (!entry) throw new Error(`Key space "${keyId}" was not found.`);
  return cloneValue(entry.envelope);
}

export function writeWrappedKey(self: MEKernelLike, keyId: string, body: any): WrappedSecretV1 {
  const envelope =
    body && typeof body === "object" && body.envelope
      ? (body.envelope as WrappedSecretV1)
      : (body as WrappedSecretV1);
  const recipientKeyId =
    body && typeof body === "object" && typeof body.recipientKeyId === "string"
      ? body.recipientKeyId
      : undefined;

  self.storeWrappedKey(keyId, envelope, { recipientKeyId });
  return readWrappedKey(self, keyId);
}

export function openWrappedKey(
  self: MEKernelLike,
  keyId: string,
  body?: MEWrappedKeyOpenOptions,
): Promise<Uint8Array | string> {
  const entry = self.keySpaces[keyId];
  if (!entry) throw new Error(`Key space "${keyId}" was not found.`);

  const output = body?.output === "utf8" ? "utf8" : "bytes";
  const inlinePrivateKey = body?.recipientPrivateKey;
  const resolvedRecipientKeyId = body?.recipientKeyId ?? entry.recipientKeyId;
  const recipientPrivateKey =
    inlinePrivateKey ??
    (resolvedRecipientKeyId ? self.recipientKeyring[resolvedRecipientKeyId] : undefined);

  if (!recipientPrivateKey) {
    throw new Error(
      `No recipient private key is available to open "${keyId}". Install one first or pass it inline.`,
    );
  }

  return unwrapSecretV1(entry.envelope, recipientPrivateKey, output);
}

export function normalizeExecutableTarget(
  self: MEKernelLike,
  rawTarget: string | MeTargetAst,
): MeTargetAst {
  if (typeof rawTarget === "string") return parseExecutableTarget(self, rawTarget);
  if (!rawTarget || typeof rawTarget !== "object") {
    throw new Error("execute(...) requires a me target string or AST.");
  }

  const namespace = String(rawTarget.namespace ?? "").trim();
  const operation = String(rawTarget.operation ?? "").trim().toLowerCase();
  const path = String(rawTarget.path ?? "").trim();
  if (!namespace) throw new Error("Executable me target is missing a namespace.");
  if (!operation) throw new Error("Executable me target is missing an operation.");

  return {
    scheme: "me",
    namespace,
    operation,
    path,
    raw: rawTarget.raw,
    contextRaw: rawTarget.contextRaw ?? null,
  };
}

export function parseExecutableTarget(self: MEKernelLike, rawTarget: string): MeTargetAst {
  const raw = String(rawTarget ?? "").trim();
  if (!raw) throw new Error("execute(...) received an empty me target.");

  const withoutScheme = raw.startsWith("me://") ? raw.slice(5) : raw;
  const colonIndex = findTopLevelIndex(withoutScheme, ":");
  if (colonIndex < 0) {
    throw new Error(`Invalid me target "${raw}": expected ":" between namespace and operation.`);
  }

  const namespaceWithContext = withoutScheme.slice(0, colonIndex).trim();
  const rhs = withoutScheme.slice(colonIndex + 1).trim();
  if (!namespaceWithContext) throw new Error(`Invalid me target "${raw}": missing namespace.`);
  if (!rhs) throw new Error(`Invalid me target "${raw}": missing operation.`);

  const slashIndex = rhs.indexOf("/");
  const operation = (slashIndex >= 0 ? rhs.slice(0, slashIndex) : rhs).trim().toLowerCase();
  const path = (slashIndex >= 0 ? rhs.slice(slashIndex + 1) : "").trim();
  if (!operation) throw new Error(`Invalid me target "${raw}": missing operation.`);

  const { namespace, contextRaw } = splitTargetNamespace(self, namespaceWithContext, raw);
  return {
    scheme: "me",
    namespace,
    operation,
    path,
    raw,
    contextRaw,
  };
}

export function splitTargetNamespace(
  _self: MEKernelLike,
  namespaceWithContext: string,
  rawTarget: string,
): { namespace: string; contextRaw: string | null } {
  const openIndex = namespaceWithContext.indexOf("[");
  if (openIndex < 0) {
    return { namespace: namespaceWithContext, contextRaw: null };
  }

  const closeIndex = namespaceWithContext.lastIndexOf("]");
  if (closeIndex < openIndex || closeIndex !== namespaceWithContext.length - 1) {
    throw new Error(`Invalid me target "${rawTarget}": malformed context segment.`);
  }

  const namespace = namespaceWithContext.slice(0, openIndex).trim();
  const contextRaw = namespaceWithContext.slice(openIndex + 1, closeIndex).trim();
  if (!namespace) throw new Error(`Invalid me target "${rawTarget}": missing namespace before context.`);
  return { namespace, contextRaw: contextRaw || null };
}

export function normalizeExecutablePath(
  _self: MEKernelLike,
  rawPath: string,
): { key: string; parts: SemanticPath } {
  const dotted = String(rawPath ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, ".");
  const parts = dotted
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  const normalized = normalizeSelectorPath(parts);
  return {
    key: normalized.join("."),
    parts: normalized,
  };
}

export function exportSnapshot(self: MEKernelLike): MESnapshot {
  return cloneValue({
    memories: self._memories,
    localSecrets: self.localSecrets,
    localNoises: self.localNoises,
    encryptedBranches: self.encryptedBranches,
    keySpaces: self.keySpaces,
    operators: self.operators,
  });
}

export function importSnapshot(self: MEKernelLike, snapshot: MESnapshotInput): void {
  const data = cloneValue(snapshot ?? {});
  self._memories = Array.isArray(data.memories)
    ? data.memories
    : [];
  self.localSecrets = data.localSecrets && typeof data.localSecrets === "object" ? data.localSecrets : {};
  self.localNoises = data.localNoises && typeof data.localNoises === "object" ? data.localNoises : {};
  bumpSecretEpoch(self);
  self.encryptedBranches =
    data.encryptedBranches && typeof data.encryptedBranches === "object" ? data.encryptedBranches : {};
  self.keySpaces = data.keySpaces && typeof data.keySpaces === "object" ? data.keySpaces : {};
  self.derivations = {};
  self.refSubscribers = {};
  self.refVersions = {};
  self.derivationRefVersions = {};
  self.staleDerivations.clear();

  const defaults = createDefaultOperators();
  self.operators =
    data.operators && typeof data.operators === "object"
      ? { ...defaults, ...data.operators }
      : defaults;

  self.rebuildIndex();
}

export function rehydrate(self: MEKernelLike, snapshot: MESnapshotInput): void {
  self.importSnapshot(snapshot);
}

export function learn(self: MEKernelLike, memory: unknown): void {
  const next = cloneValue(memory ?? {}) as Partial<Memory>;
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

export function replayMemories(self: MEKernelLike, memories: Memory[]): void {
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

  for (const t of memories || []) {
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
): Memory {
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
  const memory: Memory = {
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
): Memory {
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
      const blob = xorEncrypt(branchObj, scopeSecret, scope);
      setChunkBlob(self, scope, chunkId, blob, scopeSecret);
    }
    storedValue = expression;
  } else if (effectiveSecret) {
    const shouldEncryptValue = operator !== "=" && operator !== "?";
    if (isPointer(expression) || isIdentityRef(expression) || !shouldEncryptValue) {
      storedValue = expression;
    } else {
      storedValue = xorEncrypt(expression, effectiveSecret, targetPath);
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
): Memory | undefined {
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
        let out: Memory | undefined;
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
  const memory: Memory = {
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

export function applyMemoryToIndex(self: MEKernelLike, t: Memory): void {
  const p = t.path;
  const pathParts = p.split(".").filter(Boolean);
  if (t.operator === "_") {
    if (pathParts.length > 0) removeIndexPrefix(self, pathParts);
    return;
  }
  const scope = resolveBranchScope(self, pathParts);
  const inSecret = scope && scope.length > 0 && pathStartsWith(pathParts, scope);
  if (t.operator === "-") {
    if (p === "") {
      for (const k of Object.keys(self.index)) delete self.index[k];
      return;
    }
    const prefix = p + ".";
    for (const k of Object.keys(self.index)) {
      if (k === p || k.startsWith(prefix)) delete self.index[k];
    }
    return;
  }

  if (inSecret) return;
  self.index[p] = t.value;
}

export function removeIndexPrefix(self: MEKernelLike, prefixPath: SemanticPath): void {
  const prefix = prefixPath.join(".");
  if (!prefix) return;
  const dot = prefix + ".";
  for (const k of Object.keys(self.index)) {
    if (k === prefix || k.startsWith(dot)) delete self.index[k];
  }
}

export function rebuildIndex(self: MEKernelLike) {
  const next: Record<string, any> = {};
  const orderedMemories = self._memories
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      if (a.t.timestamp !== b.t.timestamp) return a.t.timestamp - b.t.timestamp;
      if (a.t.hash !== b.t.hash) return a.t.hash < b.t.hash ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.t);

  self.index = next;
  for (const t of orderedMemories) {
    applyMemoryToIndex(self, t);
  }
}

export function getIndex(self: MEKernelLike, path: SemanticPath): any {
  return self.index[path.join(".")];
}

export function setIndex(self: MEKernelLike, path: SemanticPath, value: any): void {
  self.index[path.join(".")] = value;
}

export function resolveIndexPointerPath(
  self: MEKernelLike,
  path: SemanticPath,
  maxHops = 8,
): { path: SemanticPath; raw: any } {
  let curPath = path;
  for (let i = 0; i < maxHops; i++) {
    const exactRaw = getIndex(self, curPath);
    if (isPointer(exactRaw)) {
      curPath = exactRaw.__ptr.split(".").filter(Boolean);
      continue;
    }

    let redirected = false;
    for (let prefixLen = curPath.length - 1; prefixLen >= 0; prefixLen--) {
      const prefix = curPath.slice(0, prefixLen);
      const prefixRaw = getIndex(self, prefix);
      if (!isPointer(prefixRaw)) continue;
      const target = prefixRaw.__ptr.split(".").filter(Boolean);
      const suffix = curPath.slice(prefixLen);
      curPath = [...target, ...suffix];
      redirected = true;
      break;
    }
    if (redirected) continue;
    return { path: curPath, raw: exactRaw };
  }
  return { path: curPath, raw: undefined };
}

export function collectIteratorIndices(self: MEKernelLike, path: SemanticPath): string[] {
  const firstIteratorPos = path.findIndex((segment) => segment.includes("[i]"));
  if (firstIteratorPos === -1) return [];

  const prefix: string[] = [];
  for (let i = 0; i <= firstIteratorPos; i++) {
    const segment = path[i];
    if (i === firstIteratorPos) {
      const base = segment.split("[i]").join("").trim();
      if (base) prefix.push(base);
    } else {
      prefix.push(segment);
    }
  }

  const out = new Set<string>();
  for (const key of Object.keys(self.index)) {
    const parts = key.split(".").filter(Boolean);
    if (parts.length <= prefix.length) continue;
    let ok = true;
    for (let i = 0; i < prefix.length; i++) {
      if (parts[i] !== prefix[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.add(parts[prefix.length]);
  }

  return Array.from(out).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
}

export function resolveRelativeFirst(self: MEKernelLike, scope: SemanticPath, parts: SemanticPath): any {
  const rel = self.readPath([...scope, ...parts]);
  if (rel !== undefined && rel !== null) return rel;
  return self.readPath(parts);
}

export function evaluateFilterClauseForScope(
  self: MEKernelLike,
  scope: SemanticPath,
  clause: { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string },
): boolean {
  const leftParts = normalizeSelectorPath(clause.left.split(".").filter(Boolean));
  const leftValue = resolveRelativeFirst(self, scope, leftParts);
  if (leftValue === undefined || leftValue === null) return false;

  const rightParsed = parseLiteralOrPath(clause.right);
  const rightValue =
    rightParsed.kind === "literal"
      ? rightParsed.value
      : resolveRelativeFirst(self, scope, rightParsed.parts);
  if (rightValue === undefined || rightValue === null) return false;

  return compareValues(leftValue, clause.op, rightValue);
}

export function evaluateLogicalFilterForScope(
  self: MEKernelLike,
  scope: SemanticPath,
  expr: string,
): boolean {
  const parsed = parseLogicalFilterExpression(expr);
  if (!parsed) return false;
  let acc = evaluateFilterClauseForScope(self, scope, parsed.clauses[0]);
  for (let i = 1; i < parsed.clauses.length; i++) {
    const v = evaluateFilterClauseForScope(self, scope, parsed.clauses[i]);
    const op = parsed.ops[i - 1];
    acc = op === "&&" ? acc && v : acc || v;
  }
  return acc;
}

export function collectChildrenForPrefix(self: MEKernelLike, prefix: SemanticPath): string[] {
  const out = new Set<string>();
  for (const key of Object.keys(self.index)) {
    const parts = key.split(".").filter(Boolean);
    if (parts.length <= prefix.length) continue;
    let ok = true;
    for (let i = 0; i < prefix.length; i++) {
      if (parts[i] !== prefix[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.add(parts[prefix.length]);
  }
  return Array.from(out);
}

export function evaluateTransformPath(self: MEKernelLike, path: SemanticPath): any {
  const selPos = path.findIndex((segment) => {
    const parsed = parseSelectorSegment(segment);
    if (!parsed) return false;
    return parseTransformSelector(parsed.selector) !== null;
  });
  if (selPos === -1) return undefined;

  const parsedSeg = parseSelectorSegment(path[selPos]);
  if (!parsedSeg) return undefined;
  const transform = parseTransformSelector(parsedSeg.selector);
  if (!transform) return undefined;

  const collectionPrefix = [...path.slice(0, selPos), parsedSeg.base];
  const suffix = path.slice(selPos + 1);
  if (suffix.length > 0) return undefined;

  const children = collectChildrenForPrefix(self, collectionPrefix);
  const out: Record<string, any> = {};
  for (const child of children) {
    const scope = [...collectionPrefix, child];
    const expr = transform.expr.replace(
      new RegExp(String.raw`\b${transform.varName}\.`, "g"),
      "",
    );
    const evaluated = tryEvaluateAssignExpression(self, scope, expr);
    if (evaluated.ok) {
      out[child] = evaluated.value;
    }
  }
  return out;
}

export function evaluateSelectionPath(self: MEKernelLike, path: SemanticPath): any {
  const selPos = path.findIndex((segment) => parseSelectorSegment(segment) !== null);
  if (selPos === -1) return undefined;

  const parsed = parseSelectorSegment(path[selPos]);
  if (!parsed) return undefined;

  const keys = parseSelectorKeys(parsed.selector);
  if (keys === null) return undefined;

  const collectionPrefix = [...path.slice(0, selPos), parsed.base];
  const suffix = path.slice(selPos + 1);
  const out: Record<string, any> = {};

  for (const key of keys) {
    const scope = [...collectionPrefix, key];
    const value =
      suffix.length === 0
        ? buildPublicSubtree(self, scope)
        : self.readPath([...scope, ...suffix]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function buildPublicSubtree(self: MEKernelLike, prefix: SemanticPath): any {
  const prefixKey = prefix.join(".");
  const root: any = {};
  let wroteAny = false;
  for (const [k, v] of Object.entries(self.index)) {
    if (k === prefixKey) {
      return v;
    }
    if (!k.startsWith(prefixKey + ".")) continue;
    const rel = k.slice(prefixKey.length + 1).split(".").filter(Boolean);
    let ref = root;
    for (let i = 0; i < rel.length - 1; i++) {
      const part = rel[i];
      if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
      ref = ref[part];
    }
    ref[rel[rel.length - 1]] = v;
    wroteAny = true;
  }
  return wroteAny ? root : undefined;
}

export function evaluateFilterPath(self: MEKernelLike, path: SemanticPath): any {
  const filterPos = path.findIndex((segment) => parseLogicalFilterExpression(segment) !== null);
  if (filterPos === -1) return undefined;

  const filterExpr = path[filterPos];

  const collectionPrefix = path.slice(0, filterPos);
  const suffix = path.slice(filterPos + 1);
  if (collectionPrefix.length === 0) return undefined;

  const children = collectChildrenForPrefix(self, collectionPrefix);
  const out: Record<string, any> = {};

  for (const child of children) {
    const scope = [...collectionPrefix, child];
    if (!evaluateLogicalFilterForScope(self, scope, filterExpr)) continue;

    if (suffix.length === 0) {
      out[child] = buildPublicSubtree(self, scope);
    } else {
      out[child] = self.readPath([...scope, ...suffix]);
    }
  }

  return out;
}

export function pathContainsFilterSelector(self: MEKernelLike, path: SemanticPath): boolean {
  void self;
  return path.some((segment) => {
    const parsed = parseSelectorSegment(segment);
    if (!parsed) return false;
    return parseLogicalFilterExpression(parsed.selector) !== null;
  });
}

export function collectFilteredScopes(self: MEKernelLike, path: SemanticPath): SemanticPath[] {
  const selPos = path.findIndex((segment) => {
    const parsed = parseSelectorSegment(segment);
    if (!parsed) return false;
    return parseLogicalFilterExpression(parsed.selector) !== null;
  });
  if (selPos === -1) return [];

  const parsed = parseSelectorSegment(path[selPos]);
  if (!parsed) return [];

  const collectionPrefix = [...path.slice(0, selPos), parsed.base];
  const tail = path.slice(selPos + 1);
  const children = collectChildrenForPrefix(self, collectionPrefix);
  const out: SemanticPath[] = [];
  for (const child of children) {
    const scope = [...collectionPrefix, child];
    if (!evaluateLogicalFilterForScope(self, scope, parsed.selector)) continue;
    out.push([...scope, ...tail]);
  }
  return out;
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
  const effectiveSecret = computeEffectiveSecret(self, path);
  if (!effectiveSecret) return null;
  return xorDecrypt(raw, effectiveSecret, path);
}
