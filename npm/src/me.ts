// me/npm/src/me.ts
/**
 * 𓋹 .me Semantic Kernel 
 * ---------------------------------------------------------
 * Core Logic & O(k) Complexity Architecture
 * Designed and Authored by: J. Abella Eggleton (suiGn)
 * Location: Cordoba, Veracruz, Mexico | 2026
 * 
 * Intellectual Property Note:
 * This kernel implements a custom Inverted Dependency Index 
 * and a Hermetic RPN Evaluator for deterministic inference.
 * Licensed under MIT.
 * ---------------------------------------------------------
 */
import type {
  Memory,
  MeTargetAst,
  SemanticPath,
  StoredWrappedKey,
  EncryptedBlob,
  MappingInstruction,
  OperatorRegistry,
  P256PublicKeyCoordinates,
  WrappedSecretClass,
  WrappedSecretPolicy,
  WrappedSecretV1,
} from "./types.js";
import {
  isMemory,
  isPointer,
  isIdentityRef,
  normalizeAndValidateUsername,
  splitPath,
  pathStartsWith,
} from "./operators.js";
import {
  xorEncrypt,
  xorDecrypt,
  isEncryptedBlob,
  exportP256PublicKey,
  generateP256KeyPair,
  importP256PublicKey,
  unwrapSecretV1,
  wrapSecretV1,
} from "./crypto.js";
import { handleCall as handleCallFn } from "./handleCall.js";
import { normalizeCall } from "./normalizeCall.js";
// Proxy type for ME: allows callable and property access
export type MEProxy = ME & {
  [key: string]: any;
  (...args: any[]): MEProxy;
};
// me.ts
// Runtime semántico + cripto fractal basado en triadas:
// me(expression)
// Secret scoping (kernel-only): use `_("secret")` to declare a secret scope at a path.
// Example: me.layer1._("ABC").then.anything.below(...)
// Read: me("a.b.c") -> returns resolved value (decrypts if needed). Reading a scope root (e.g. me("layer1")) returns `undefined` on purpose (stealth).
const OP_DEFINE = "+";
// Hash simple portable (FNV-1a 32-bit, como antes)
function hashFn(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

/**
 * The `.me` semantic kernel.
 *
 * `ME` is both:
 *
 * - a stateful kernel that stores semantic memories, indexes, secrets, and derivations
 * - a callable proxy runtime that lets you navigate and execute semantic paths like `me.profile.name("Ana")`
 *
 * Practical mental model:
 *
 * - property access builds a semantic path
 * - calling `()` writes, reads, or invokes an operator at that path
 * - explicit class methods such as `inspect()`, `explain()`, `exportSnapshot()`, and `replayMemories()`
 *   are the debugging, replay, and hydration surface around that runtime
 *
 * If you are reading the generated API docs:
 *
 * - this class page shows the explicit TypeScript class members
 * - the full language surface also includes the proxy/DSL behavior documented in
 *   `Runtime Surface`, `Proxy Calls`, `Operators`, and `Syntax`
 */
export class ME {
  [key: string]: any;
  private static readonly RUNTIME_ESCAPE_TOKEN = "!";

  static generateP256KeyPair = generateP256KeyPair;
  static exportP256PublicKey = exportP256PublicKey;
  static importP256PublicKey = importP256PublicKey;
  static wrapSecretV1(input: {
    secret: Uint8Array | string;
    recipientPublicKey: CryptoKey | P256PublicKeyCoordinates;
    kid: string;
    class: WrappedSecretClass;
    publicKey?: P256PublicKeyCoordinates;
    policy?: WrappedSecretPolicy;
  }): Promise<WrappedSecretV1> {
    return wrapSecretV1(input);
  }
  static unwrapSecretV1(
    envelope: WrappedSecretV1,
    recipientPrivateKey: CryptoKey,
    output: "bytes" | "utf8" = "bytes",
  ): Promise<Uint8Array | string> {
    return unwrapSecretV1(envelope, recipientPrivateKey, output);
  }
  // Secret local por ruta ("a.b.c" -> secret declarado en ese nivel)
  private localSecrets: Record<string, string> = {};
  private localNoises: Record<string, string> = {};
  // Encrypted branch blobs stored at scope roots ("wallet" -> cipherblob)
  private encryptedBranches: Record<string, EncryptedBlob | Record<string, EncryptedBlob>> = {};
  // Wrapped key envelopes persist with the kernel snapshot. Private keys do not.
  private keySpaces: Record<string, StoredWrappedKey> = {};
  private recipientKeyring: Record<string, CryptoKey> = {};
  // Derived read index (path -> latest committed value). Canonical truth is memory log.
  private index: Record<string, any> = {};
  // Runtime log lives as a semantic node, but is updated via a kernel write (no extra events).
  // This avoids the infinite recursion problem of: postulate -> write memory -> postulate -> ...
  private _memories: Memory[] = [];
  private derivations: Record<
    string,
    {
      expression: string;
      evalScope: SemanticPath;
      refs: Array<{ label: string; path: string }>;
      lastComputedAt: number;
    }
  > = {};
  private refSubscribers: Record<string, string[]> = {};
  // Recompute strategy:
  // - eager: recompute subscribers immediately on writes (current behavior)
  // - lazy: mark downstream derivations stale and recompute on read
  private recomputeMode: "eager" | "lazy" = "eager";
  // Per-reference monotonic versions used by lazy mode.
  private refVersions: Record<string, number> = {};
  // Snapshot of dependency versions at the last successful recompute per target.
  private derivationRefVersions: Record<string, Record<string, number>> = {};
  // Lazy dirty-set: derived targets that must be refreshed on read.
  private staleDerivations = new Set<string>();
  // Security-structure cache: only invalidates when secret/noise topology changes.
  private secretEpoch = 0;
  private scopeCache = new Map<string, { epoch: number; scope: SemanticPath | null }>();
  private effectiveSecretCache = new Map<string, { epoch: number; value: string }>();
  private decryptedBranchCache = new Map<string, { epoch: number; blob: EncryptedBlob; data: any }>();
  private readonly secretChunkSize = 256;
  private readonly secretHashBuckets = 16;
  private readonly unsafeEval = false;
  get memories(): Memory[] {
    return this._memories;
  }

  // Explicit debug API (kept outside DSL semantics).
  inspect(opts?: { last?: number }): {
    memories: Memory[];
    index: Record<string, any>;
    encryptedScopes: string[];
    secretScopes: string[];
    noiseScopes: string[];
    recomputeMode: "eager" | "lazy";
    staleDerivations: number;
  } {
    const last = opts?.last;
    const memories =
      typeof last === "number" && Number.isFinite(last) && last > 0
        ? this._memories.slice(-Math.floor(last))
        : this._memories.slice();
    return {
      memories,
      index: { ...this.index },
      encryptedScopes: Object.keys(this.encryptedBranches),
      secretScopes: Object.keys(this.localSecrets),
      noiseScopes: Object.keys(this.localNoises),
      recomputeMode: this.recomputeMode,
      staleDerivations: this.staleDerivations.size,
    };
  }

  setRecomputeMode(mode: "eager" | "lazy"): this {
    this.recomputeMode = mode;
    return this;
  }

  getRecomputeMode(): "eager" | "lazy" {
    return this.recomputeMode;
  }

  installRecipientKey(recipientKeyId: string, privateKey: CryptoKey): this {
    const keyId = String(recipientKeyId || "").trim();
    if (!keyId) throw new Error("installRecipientKey(...) requires a recipient key id.");
    this.recipientKeyring[keyId] = privateKey;
    return this;
  }

  uninstallRecipientKey(recipientKeyId: string): this {
    const keyId = String(recipientKeyId || "").trim();
    if (!keyId) return this;
    delete this.recipientKeyring[keyId];
    return this;
  }

  storeWrappedKey(keyId: string, envelope: WrappedSecretV1, options?: { recipientKeyId?: string }): this {
    const normalizedKeyId = String(keyId || "").trim();
    if (!normalizedKeyId) throw new Error("storeWrappedKey(...) requires a key id.");
    if (!envelope || envelope.version !== 1) {
      throw new Error("storeWrappedKey(...) requires a valid WrappedSecretV1 envelope.");
    }

    this.keySpaces[normalizedKeyId] = this.cloneValue({
      envelope,
      recipientKeyId: options?.recipientKeyId,
    });
    return this;
  }

  execute(rawTarget: string | MeTargetAst, body?: any): any {
    const target = this.normalizeExecutableTarget(rawTarget);

    switch (target.namespace) {
      case "self":
        return this.handleSelfTarget(target.operation, target.path, body);
      case "kernel":
        return this.handleKernelTarget(target.operation, target.path, body);
      default:
        throw new Error(
          `External me target "${target.namespace}" must be resolved by cleaker or monad.ai before reaching the local kernel.`,
        );
    }
  }

  private bumpSecretEpoch(): void {
    this.secretEpoch++;
    this.scopeCache.clear();
    this.effectiveSecretCache.clear();
    this.decryptedBranchCache.clear();
  }

  explain(path: string): {
    path: string;
    value: any;
    derivation: null | {
      expression: string;
      inputs: Array<{ label: string; path: string; value: any; origin: "public" | "stealth"; masked: boolean }>;
    };
    meta: {
      dependsOn: string[];
      lastComputedAt?: number;
    };
  } {
    const target = this.normalizeSelectorPath(String(path ?? "").split(".").filter(Boolean));
    const key = target.join(".");
    if (this.recomputeMode === "lazy") this.ensureTargetFresh(key);
    const value = this.readPath(target);
    const d = this.derivations[key];
    if (!d) {
      return {
        path: key,
        value,
        derivation: null,
        meta: { dependsOn: [] },
      };
    }

    const inputs = d.refs.map((r) => {
      const refParts = this.normalizeSelectorPath(r.path.split(".").filter(Boolean));
      const refScope = this.resolveBranchScope(refParts);
      const isStealth = !!(refScope && refScope.length > 0 && pathStartsWith(refParts, refScope));
      const raw = this.readPath(refParts);
      return {
        label: r.label,
        path: r.path,
        value: isStealth ? "●●●●" : raw,
        origin: (isStealth ? "stealth" : "public") as "public" | "stealth",
        masked: isStealth,
      };
    });

    return {
      path: key,
      value,
      derivation: {
        expression: d.expression,
        inputs,
      },
      meta: {
        dependsOn: d.refs.map((r) => r.path),
        lastComputedAt: d.lastComputedAt,
      },
    };
  }

  private cloneValue<T>(value: T): T {
    const sc = (globalThis as any).structuredClone;
    if (typeof sc === "function") return sc(value);
    return JSON.parse(JSON.stringify(value));
  }

  private handleSelfTarget(operation: string, rawPath: string, body?: any): any {
    const keyPath = this.parseKeySpacePath(rawPath);
    if (keyPath.isKeySpace) {
      return this.handleKeySpaceTarget(operation, keyPath.keyId, body);
    }

    const path = this.normalizeExecutablePath(rawPath);

    switch (operation) {
      case "read":
        return this.readPath(path.parts);
      case "write":
        if (!path.key) throw new Error("self:write requires a semantic path.");
        if (body === undefined) throw new Error("self:write requires a body payload.");
        return this.postulate(path.parts, body);
      case "inspect":
        return this.inspectAtPath(path.key);
      case "explain":
        if (!path.key) throw new Error("self:explain requires a semantic path.");
        return this.explain(path.key);
      default:
        throw new Error(`Unsupported self operation: ${operation}`);
    }
  }

  private handleKernelTarget(operation: string, rawPath: string, body?: any): any {
    const path = this.normalizeExecutablePath(rawPath);
    const key = path.key;

    switch (operation) {
      case "read":
        return this.handleKernelRead(key);
      case "export":
        return this.handleKernelExport(key);
      case "import":
        if (body === undefined) throw new Error("kernel:import requires a payload.");
        return this.handleKernelImport(key, body);
      case "replay":
        if (body === undefined) throw new Error("kernel:replay requires a payload.");
        return this.handleKernelReplay(key, body);
      case "rehydrate":
        if (body === undefined) throw new Error("kernel:rehydrate requires a payload.");
        return this.handleKernelRehydrate(key, body);
      case "get":
        return this.handleKernelGet(key);
      case "set":
        if (body === undefined) throw new Error("kernel:set requires a payload.");
        return this.handleKernelSet(key, body);
      default:
        throw new Error(`Unsupported kernel operation: ${operation}`);
    }
  }

  private handleKernelRead(key: string): any {
    switch (key) {
      case "memory":
      case "memories":
      case "logs":
        return this.cloneValue(this.memories);
      case "snapshot":
        return this.exportSnapshot();
      case "mode":
      case "recompute.mode":
        return this.getRecomputeMode();
      default:
        throw new Error(`Unsupported kernel:read path: ${key || "<root>"}`);
    }
  }

  private handleKernelExport(key: string): any {
    switch (key) {
      case "memory":
      case "memories":
      case "logs":
        return this.cloneValue(this.memories);
      case "snapshot":
        return this.exportSnapshot();
      default:
        throw new Error(`Unsupported kernel:export path: ${key || "<root>"}`);
    }
  }

  private handleKernelImport(key: string, body: any): any {
    switch (key) {
      case "snapshot":
        this.importSnapshot(body ?? {});
        return this.exportSnapshot();
      default:
        throw new Error(`Unsupported kernel:import path: ${key || "<root>"}`);
    }
  }

  private handleKernelReplay(key: string, body: any): any {
    switch (key) {
      case "memory":
      case "memories":
      case "logs":
        if (!Array.isArray(body)) throw new Error("kernel:replay/memory requires a Memory[] payload.");
        this.replayMemories(body);
        return this.cloneValue(this.memories);
      default:
        throw new Error(`Unsupported kernel:replay path: ${key || "<root>"}`);
    }
  }

  private handleKernelRehydrate(key: string, body: any): any {
    switch (key) {
      case "snapshot":
        this.rehydrate(body ?? {});
        return this.exportSnapshot();
      default:
        throw new Error(`Unsupported kernel:rehydrate path: ${key || "<root>"}`);
    }
  }

  private handleKernelGet(key: string): any {
    switch (key) {
      case "mode":
      case "recompute.mode":
        return this.getRecomputeMode();
      default:
        throw new Error(`Unsupported kernel:get path: ${key || "<root>"}`);
    }
  }

  private handleKernelSet(key: string, body: any): any {
    switch (key) {
      case "mode":
      case "recompute.mode":
        if (body !== "eager" && body !== "lazy") {
          throw new Error(`kernel:set/${key} only accepts "eager" or "lazy".`);
        }
        this.setRecomputeMode(body);
        return this.getRecomputeMode();
      default:
        throw new Error(`Unsupported kernel:set path: ${key || "<root>"}`);
    }
  }

  private handleKeySpaceTarget(operation: string, keyId: string | null, body?: any): any {
    switch (operation) {
      case "read":
        if (!keyId) {
          return this.cloneValue(this.keySpaces);
        }
        return this.readWrappedKey(keyId);
      case "write":
        if (!keyId) throw new Error("self:write/keys requires a key id.");
        if (body === undefined) throw new Error("self:write/keys requires a payload.");
        return this.writeWrappedKey(keyId, body);
      case "open":
      case "use":
        if (!keyId) throw new Error(`self:${operation}/keys requires a key id.`);
        return this.openWrappedKey(keyId, body);
      default:
        throw new Error(`Unsupported keys operation: ${operation}`);
    }
  }

  private inspectAtPath(scopeKey: string) {
    const snapshot = this.inspect();
    if (!scopeKey) return snapshot;

    const matchesScope = (candidate: string) =>
      candidate === scopeKey || candidate.startsWith(scopeKey + ".");

    return {
      path: scopeKey,
      value: this.readPath(scopeKey.split(".").filter(Boolean)),
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

  private parseKeySpacePath(rawPath: string): { isKeySpace: boolean; keyId: string | null } {
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

  private readWrappedKey(keyId: string): WrappedSecretV1 {
    const entry = this.keySpaces[keyId];
    if (!entry) throw new Error(`Key space "${keyId}" was not found.`);
    return this.cloneValue(entry.envelope);
  }

  private writeWrappedKey(keyId: string, body: any): WrappedSecretV1 {
    const envelope =
      body && typeof body === "object" && body.envelope
        ? (body.envelope as WrappedSecretV1)
        : (body as WrappedSecretV1);
    const recipientKeyId =
      body && typeof body === "object" && typeof body.recipientKeyId === "string"
        ? body.recipientKeyId
        : undefined;

    this.storeWrappedKey(keyId, envelope, { recipientKeyId });
    return this.readWrappedKey(keyId);
  }

  private openWrappedKey(
    keyId: string,
    body?: { recipientKeyId?: string; recipientPrivateKey?: CryptoKey; output?: "bytes" | "utf8" },
  ): Promise<Uint8Array | string> {
    const entry = this.keySpaces[keyId];
    if (!entry) throw new Error(`Key space "${keyId}" was not found.`);

    const output = body?.output === "utf8" ? "utf8" : "bytes";
    const inlinePrivateKey = body?.recipientPrivateKey;
    const resolvedRecipientKeyId = body?.recipientKeyId ?? entry.recipientKeyId;
    const recipientPrivateKey =
      inlinePrivateKey ??
      (resolvedRecipientKeyId ? this.recipientKeyring[resolvedRecipientKeyId] : undefined);

    if (!recipientPrivateKey) {
      throw new Error(
        `No recipient private key is available to open "${keyId}". Install one first or pass it inline.`,
      );
    }

    return unwrapSecretV1(entry.envelope, recipientPrivateKey, output);
  }

  private normalizeExecutableTarget(rawTarget: string | MeTargetAst): MeTargetAst {
    if (typeof rawTarget === "string") return this.parseExecutableTarget(rawTarget);
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

  private parseExecutableTarget(rawTarget: string): MeTargetAst {
    const raw = String(rawTarget ?? "").trim();
    if (!raw) throw new Error("execute(...) received an empty me target.");

    const withoutScheme = raw.startsWith("me://") ? raw.slice(5) : raw;
    const colonIndex = this.findTopLevelIndex(withoutScheme, ":");
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

    const { namespace, contextRaw } = this.splitTargetNamespace(namespaceWithContext, raw);
    return {
      scheme: "me",
      namespace,
      operation,
      path,
      raw,
      contextRaw,
    };
  }

  private splitTargetNamespace(
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

  private normalizeExecutablePath(rawPath: string): { key: string; parts: SemanticPath } {
    const dotted = String(rawPath ?? "")
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/\//g, ".");
    const parts = dotted
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    const normalized = this.normalizeSelectorPath(parts);
    return {
      key: normalized.join("."),
      parts: normalized,
    };
  }

  private findTopLevelIndex(input: string, needle: string): number {
    let depth = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (char === "[") depth++;
      else if (char === "]") depth = Math.max(0, depth - 1);
      else if (char === needle && depth === 0) return i;
    }
    return -1;
  }

  exportSnapshot(): {
    memories: Memory[];
    localSecrets: Record<string, string>;
    localNoises: Record<string, string>;
    encryptedBranches: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
    keySpaces: Record<string, StoredWrappedKey>;
    operators: Record<string, { kind: string }>;
  } {
    return this.cloneValue({
      memories: this._memories,
      localSecrets: this.localSecrets,
      localNoises: this.localNoises,
      encryptedBranches: this.encryptedBranches,
      keySpaces: this.keySpaces,
      operators: this.operators,
    });
  }

  importSnapshot(snapshot: {
    memories?: Memory[];
    localSecrets?: Record<string, string>;
    localNoises?: Record<string, string>;
    encryptedBranches?: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
    keySpaces?: Record<string, StoredWrappedKey>;
    operators?: Record<string, { kind: string }>;
  }): void {
    const data = this.cloneValue(snapshot ?? {});
    this._memories = Array.isArray(data.memories)
      ? data.memories
      : [];
    this.localSecrets = data.localSecrets && typeof data.localSecrets === "object" ? data.localSecrets : {};
    this.localNoises = data.localNoises && typeof data.localNoises === "object" ? data.localNoises : {};
    this.bumpSecretEpoch();
    this.encryptedBranches =
      data.encryptedBranches && typeof data.encryptedBranches === "object" ? data.encryptedBranches : {};
    this.keySpaces = data.keySpaces && typeof data.keySpaces === "object" ? data.keySpaces : {};
    this.derivations = {};
    this.refSubscribers = {};
    this.refVersions = {};
    this.derivationRefVersions = {};
    this.staleDerivations.clear();

    const defaults: Record<string, { kind: string }> = {
      "_": { kind: "secret" },
      "~": { kind: "noise" },
      "__": { kind: "pointer" },
      "->": { kind: "pointer" },
      "@": { kind: "identity" },
      "=": { kind: "eval" },
      "?": { kind: "query" },
      "-": { kind: "remove" },
    };
    this.operators =
      data.operators && typeof data.operators === "object"
        ? { ...defaults, ...data.operators }
        : defaults;

    this.rebuildIndex();
  }

  rehydrate(snapshot: {
    memories?: Memory[];
    localSecrets?: Record<string, string>;
    localNoises?: Record<string, string>;
    encryptedBranches?: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
    keySpaces?: Record<string, StoredWrappedKey>;
    operators?: Record<string, { kind: string }>;
  }): void {
    this.importSnapshot(snapshot);
  }

  learn(memory: unknown): void {
    const next = this.cloneValue(memory ?? {}) as Partial<Memory>;
    const path = String(next.path || "")
      .split(".")
      .filter(Boolean);

    if (next.operator === "_") {
      this.postulate([...path, "_"], typeof next.expression === "string" ? next.expression : "***");
      return;
    }
    if (next.operator === "~") {
      this.postulate([...path, "~"], typeof next.expression === "string" ? next.expression : "***");
      return;
    }
    if (next.operator === "@") {
      const id =
        (next.expression && (next.expression as any).__id) ||
        (next.value && (next.value as any).__id) ||
        next.value;
      if (typeof id === "string" && id.length > 0) this.postulate([...path, "@"], id);
      return;
    }
    if (next.operator === "__" || next.operator === "->") {
      const ptr =
        (next.expression && (next.expression as any).__ptr) ||
        (next.value && (next.value as any).__ptr) ||
        next.value;
      if (typeof ptr === "string" && ptr.length > 0) this.postulate([...path, "__"], ptr);
      return;
    }
    if (next.operator === "-") {
      this.removeSubtree(path);
      return;
    }
    if (next.operator === "=" || next.operator === "?") {
      this.postulate(path, next.value, next.operator);
      return;
    }

    this.postulate(path, next.expression, next.operator ?? null);
  }

  replayMemories(memories: Memory[]): void {
    this.localSecrets = {};
    this.localNoises = {};
    this.encryptedBranches = {};
    this.keySpaces = {};
    this.bumpSecretEpoch();
    this.index = {};
    this._memories = [];
    this.derivations = {};
    this.refSubscribers = {};
    this.refVersions = {};
    this.derivationRefVersions = {};
    this.staleDerivations.clear();

    for (const t of memories || []) {
      const path = String(t.path || "")
        .split(".")
        .filter(Boolean);

      if (t.operator === "_") {
        this.postulate([...path, "_"], typeof t.expression === "string" ? t.expression : "***");
        continue;
      }
      if (t.operator === "~") {
        this.postulate([...path, "~"], typeof t.expression === "string" ? t.expression : "***");
        continue;
      }
      if (t.operator === "@") {
        const id =
          (t.expression && (t.expression as any).__id) || (t.value && (t.value as any).__id) || t.value;
        if (typeof id === "string" && id.length > 0) this.postulate([...path, "@"], id);
        continue;
      }
      if (t.operator === "__" || t.operator === "->") {
        const ptr =
          (t.expression && (t.expression as any).__ptr) || (t.value && (t.value as any).__ptr) || t.value;
        if (typeof ptr === "string" && ptr.length > 0) this.postulate([...path, "__"], ptr);
        continue;
      }
      if (t.operator === "-") {
        this.removeSubtree(path);
        continue;
      }

      // For derived/query memories, commit final resolved value at the same path.
      if (t.operator === "=" || t.operator === "?") {
        this.postulate(path, t.value, t.operator);
        continue;
      }

      this.postulate(path, t.expression, t.operator);
    }
    this.rebuildIndex();
  }

  // Kernel operator registry (editable through me["+"]("op", kind))
  // kind: "secret" | "pointer" | "identity" | "custom" | "remove" | "eval" | "query" | "noise"
  private operators: Record<string, { kind: string }> = {
    "_": { kind: "secret" },
    "~": { kind: "noise" },
    "__": { kind: "pointer" },
    "->": { kind: "pointer" },
    "@": { kind: "identity" },
    "=": { kind: "eval" },
    "?": { kind: "query" },
    "-": { kind: "remove" },
  };

  /**
   * Constructor base:
   *  me = new ME(expression?)
   *
   * Esto es equivalente a llamar:
   *   me(expression) en la raíz.
   */
  constructor(expression?: any) {
    this.localSecrets = {};
    this.localNoises = {};
    this.encryptedBranches = {};
    this.keySpaces = {};
    this.recipientKeyring = {};
    this.bumpSecretEpoch();
    this.index = {};
    this.operators = {
      "_": { kind: "secret" },
      "~": { kind: "noise" },
      "__": { kind: "pointer" },
      "->": { kind: "pointer" },
      "@": { kind: "identity" },
      "=": { kind: "eval" },
      "?": { kind: "query" },
      "-": { kind: "remove" },
    };
    this._memories = [];
    // Si hay triada inicial, la registramos en la raíz ("")
    if (expression !== undefined) {
      this.postulate([], expression);
    }
    this.rebuildIndex();
    const rootProxy = this.createProxy([]);
    Object.setPrototypeOf(rootProxy as any, ME.prototype);
    Object.assign(rootProxy as any, this);
    return rootProxy as unknown as ME;
  }

  private isRemoveCall(path: SemanticPath, expression: any): { targetPath: SemanticPath } | null {
    if (path.length === 0) return null;
    const { scope, leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "remove") return null;
    // Allow:
    //   me.foo.bar["-"]()          -> removes subtree rooted at foo.bar
    //   me["-"]("a.b.c")           -> removes subtree rooted at a.b.c (root operator)
    //   me.foo["-"]("x.y")         -> removes subtree rooted at foo.x.y (relative)
    if (expression === undefined || expression === null) {
      return { targetPath: scope };
    }

    if (typeof expression === "string") {
      const rel = expression.split(".").filter(Boolean);
      const targetPath = [...scope, ...rel];
      return { targetPath };
    }

    return null;
  }

  // ---------------------------------------------------------
  // Proxy infinito: me.foo.bar(...triada)
  // ---------------------------------------------------------
  private createProxy(path: SemanticPath): MEProxy {
    const self = this;
    const fn: any = (...args: any[]) => {
      return handleCallFn(
        {
          createProxy: (p) => self.createProxy(p),
          normalizeArgs: (a) => self.normalizeArgs(a),
          readPath: (p) => self.readPath(p),
          postulate: (p, e) => self.postulate(p, e),
          opKind: (op) => self.opKind(op),
          splitPath,
          isMemory,
        },
        path,
        args
      );
    };

    return new Proxy(fn, {
      get(target, prop) {
        if (typeof prop === "symbol") return (target as any)[prop];
        if (prop === ME.RUNTIME_ESCAPE_TOKEN) {
          return self.createRuntimeProxy([]);
        }
        // Support direct access to real instance methods/props.
        // IMPORTANT: if the property exists on the ME instance prototype (methods like `postulate`, etc)
        // or is a real data accessor (like `memories` getter), we should return it.
        if (prop in self) {
          const existing = (self as any)[prop];
          if (typeof existing === "function") return existing.bind(self);
          return existing;
        }

        // Everything else is semantic path chaining.
        const newPath = [...path, String(prop)];
        return self.createProxy(newPath);
      },
      apply(target, _thisArg, args) {
        // When invoked, always go through the function we created (fn) via `target` to preserve chaining.
        return Reflect.apply(target as any, undefined, args);
      },
    }) as MEProxy;
  }

  private describeRuntimeMethod(
    path: string,
    call: (...args: any[]) => unknown,
    docs: string,
    signature: string,
  ) {
    return {
      kind: "method",
      path,
      docs,
      signature,
      call,
    };
  }

  private buildRuntimeSurface(): Record<string, any> {
    return {
      docs: {
        kind: "runtime-surface",
        description:
          "Reflective runtime plane for .me. Use me['!'] to access inspection, replay, snapshots, and kernel controls.",
        namespaces: ["inspect", "explain", "memories", "snapshot", "runtime", "methods"],
      },
      inspect: this.describeRuntimeMethod(
        "inspect",
        (opts?: { last?: number }) => this.inspect(opts),
        "Return a debug snapshot of memories, index, scopes, and recompute state.",
        "inspect(opts?: { last?: number }): { memories, index, encryptedScopes, secretScopes, noiseScopes, recomputeMode, staleDerivations }",
      ),
      explain: this.describeRuntimeMethod(
        "explain",
        (path: string) => this.explain(path),
        "Explain how a derived value was computed, including dependency inputs and masking for stealth sources.",
        "explain(path: string): { path, value, derivation, meta }",
      ),
      memories: {
        docs: "Memory log helpers and replay controls.",
        list: this.describeRuntimeMethod(
          "memories.list",
          () => this.memories,
          "Return the current memory log.",
          "memories.list(): Memory[]",
        ),
        replay: this.describeRuntimeMethod(
          "memories.replay",
          (memories: Memory[]) => this.replayMemories(memories),
          "Reset kernel state and replay a memory log into the current kernel.",
          "memories.replay(memories: Memory[]): void",
        ),
      },
      snapshot: {
        docs: "Snapshot import/export helpers for full kernel state.",
        export: this.describeRuntimeMethod(
          "snapshot.export",
          () => this.exportSnapshot(),
          "Export the current kernel snapshot, including memories, secrets, noises, encrypted branches, key spaces, and operators.",
          "snapshot.export(): Snapshot",
        ),
        import: this.describeRuntimeMethod(
          "snapshot.import",
          (snapshot: {
            memories?: Memory[];
            localSecrets?: Record<string, string>;
            localNoises?: Record<string, string>;
            encryptedBranches?: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
            keySpaces?: Record<string, StoredWrappedKey>;
            operators?: Record<string, { kind: string }>;
          }) => this.importSnapshot(snapshot),
          "Import a full snapshot into the current kernel and rebuild runtime state.",
          "snapshot.import(snapshot: Snapshot): void",
        ),
        rehydrate: this.describeRuntimeMethod(
          "snapshot.rehydrate",
          (snapshot: {
            memories?: Memory[];
            localSecrets?: Record<string, string>;
            localNoises?: Record<string, string>;
            encryptedBranches?: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
            keySpaces?: Record<string, StoredWrappedKey>;
            operators?: Record<string, { kind: string }>;
          }) => this.rehydrate(snapshot),
          "Alias for importSnapshot that emphasizes bringing a kernel back to life from a persisted snapshot.",
          "snapshot.rehydrate(snapshot: Snapshot): void",
        ),
      },
      runtime: {
        docs: "Kernel execution and recomputation controls.",
        getRecomputeMode: this.describeRuntimeMethod(
          "runtime.getRecomputeMode",
          () => this.getRecomputeMode(),
          "Return the current recomputation mode.",
          "runtime.getRecomputeMode(): 'eager' | 'lazy'",
        ),
        setRecomputeMode: this.describeRuntimeMethod(
          "runtime.setRecomputeMode",
          (mode: "eager" | "lazy") => this.setRecomputeMode(mode),
          "Set recomputation mode for derivations.",
          "runtime.setRecomputeMode(mode: 'eager' | 'lazy'): this",
        ),
      },
      methods: {
        docs: "Self-described method registry for the runtime surface.",
        inspect: null,
        explain: null,
        exportSnapshot: null,
        importSnapshot: null,
        rehydrate: null,
        replayMemories: null,
        getRecomputeMode: null,
        setRecomputeMode: null,
      },
    };
  }

  private createRuntimeProxy(path: string[]): any {
    const self = this;
    const fn: any = (...args: any[]) => {
      const resolved = self.resolveRuntimeValue(path);
      if (typeof resolved === "function") {
        return resolved(...args);
      }
      if (resolved && typeof resolved === "object" && typeof (resolved as any).call === "function") {
        return (resolved as any).call(...args);
      }
      if (path.length === 0) return self.describeRuntimeSurface();
      return resolved;
    };

    return new Proxy(fn, {
      get(target, prop) {
        if (typeof prop === "symbol") return (target as any)[prop];
        const key = String(prop);
        const nextPath = [...path, key];
        const resolved = self.resolveRuntimeValue(nextPath);
        if (resolved === undefined) return undefined;
        if (resolved === null) return null;
        if (Array.isArray(resolved)) return resolved;
        if (typeof resolved === "function") return self.createRuntimeProxy(nextPath);
        if (typeof resolved === "object") return self.createRuntimeProxy(nextPath);
        return resolved;
      },
      apply(target, _thisArg, args) {
        return Reflect.apply(target as any, undefined, args);
      },
    });
  }

  private describeRuntimeSurface() {
    return {
      kind: "runtime-surface",
      escape: ME.RUNTIME_ESCAPE_TOKEN,
      description:
        "Use me['!'] to enter the reflective runtime plane. This plane exposes snapshots, replay, explainability, and kernel controls.",
      namespaces: ["inspect", "explain", "memories", "snapshot", "runtime", "methods"],
    };
  }

  private resolveRuntimeValue(path: string[]): unknown {
    const surface = this.buildRuntimeSurface();

    surface.methods.inspect = surface.inspect;
    surface.methods.explain = surface.explain;
    surface.methods.exportSnapshot = surface.snapshot.export;
    surface.methods.importSnapshot = surface.snapshot.import;
    surface.methods.rehydrate = surface.snapshot.rehydrate;
    surface.methods.replayMemories = surface.memories.replay;
    surface.methods.getRecomputeMode = surface.runtime.getRecomputeMode;
    surface.methods.setRecomputeMode = surface.runtime.setRecomputeMode;

    if (path.length === 0) return surface;

    let ref: any = surface;
    for (const segment of path) {
      if (ref == null) return undefined;
      ref = ref[segment];
    }
    return ref;
  }

  // Normaliza args:
  //   ()       → expression = undefined
  //   (expr)   → expr
  // Preserve operator multi-arg calls like:
  //   me["+"]("=", "eval")
  //   me["?"](["a.b"], fn)
  // For normal writes, keep single-arg semantics.
  // NOTE: secrets are declared structurally via _("..."), not as args.
  private normalizeArgs(args: any[]): any {
    if (args.length === 0) return undefined;
    if (args.length === 1) return args[0];
    return args;
  }

  private opKind(op: string): string | null {
    const hit = this.operators[op];
    return hit?.kind ?? null;
  }

  private isSecretScopeCall(path: SemanticPath, expression: any): { scopeKey: string } | null {
    if (path.length === 0) return null;
    const { scope, leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "secret") return null;
    if (typeof expression !== "string") return null;
    return { scopeKey: scope.join(".") };
  }

  private isNoiseScopeCall(path: SemanticPath, expression: any): { scopeKey: string } | null {
    if (path.length === 0) return null;
    const { scope, leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "noise") return null;
    if (typeof expression !== "string") return null;
    return { scopeKey: scope.join(".") };
  }

  private isPointerCall(path: SemanticPath, expression: any): { targetPath: string } | null {
    if (path.length === 0) return null;
    const { leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "pointer") return null;
    if (typeof expression !== "string") return null;
    const targetPath = expression.trim().replace(/^\./, "");
    if (!targetPath) return null;
    return { targetPath };
  }

  private isIdentityCall(path: SemanticPath, expression: any): { id: string; targetPath: SemanticPath } | null {
    // Allow identity operator both at root and at any path:
    //   ME()["@"]("jabellae")         -> stores identity at root (path="")
    //   me.profile["@"]("foo")         -> stores identity at scope "profile"

    // Root form: me["@"]("id") is represented as path=["@"].
    // This must return a chainable proxy via postulate -> handleCall.
    if (path.length === 1 && this.opKind(path[0]) === "identity") {
      if (typeof expression !== "string") return null;
      const id = normalizeAndValidateUsername(expression);
      return { id, targetPath: [] };
    }

    // Non-root form: me.something["@"]("id")
    const { scope, leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "identity") return null;
    if (typeof expression !== "string") return null;
    const id = normalizeAndValidateUsername(expression);
    return { id, targetPath: scope };
  }

  private isEvalCall(
    path: SemanticPath,
    expression: any
  ):
    | { mode: "thunk"; targetPath: SemanticPath; thunk: Function }
    | { mode: "assign"; targetPath: SemanticPath; name: string; expr: string }
    | null {
    // Supported:
    //   me["="](() => expr)                 -> returns computed value (root) OR assigns (non-root)
    //   me.foo.bar["="](() => expr)         -> assigns result to foo.bar
    //   me.foo["="]("net", "a - b")        -> assigns derived value to foo.net
    //   me.foo["="](["net", "a - b"])      -> same as above
    if (path.length === 0) return null;
    const { scope, leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "eval") return null;
    // Thunk form
    if (typeof expression === "function") {
      return { mode: "thunk", targetPath: scope, thunk: expression };
    }

    // Assign form: [name, expr] or (name, expr) packed by normalizeArgs as an array
    if (Array.isArray(expression) && expression.length >= 2) {
      const name = String(expression[0] ?? "").trim();
      const expr = String(expression[1] ?? "").trim();
      if (!name || !expr) return null;
      return { mode: "assign", targetPath: scope, name, expr };
    }

    return null;
  }

  private isQueryCall(
    path: SemanticPath,
    expression: any
  ): { targetPath: SemanticPath; paths: string[]; fn?: Function } | null {
    // Supported:
    //   me["?"](["a.b", "c.d"], fn?)
    //   me["?"](["a.b", "c.d"])
    //   me.foo["?"](["x.y"], fn?)      -> assigns result to foo
    //   me.foo["?"]("x.y", "z.k")     -> variadic, packed by normalizeArgs into an array
    if (path.length === 0) return null;
    const { scope, leaf } = splitPath(path);
    if (!leaf) return null;
    if (this.opKind(leaf) !== "query") return null;
    let pathsArg: any = null;
    let fn: Function | undefined;
    // normalize args: expression may be either:
    //  - tuple array: [pathsArray, fn]
    //  - a paths array directly: ["a.b", "c.d"]
    //  - variadic packed array: ["a.b", "c.d", "e.f"]
    if (Array.isArray(expression) && expression.length > 0) {
      const looksLikeTuple =
        Array.isArray(expression[0]) &&
        (expression.length === 1 || typeof expression[1] === "function");
      if (looksLikeTuple) {
        pathsArg = expression[0];
        fn = typeof expression[1] === "function" ? (expression[1] as Function) : undefined;
      } else {
        pathsArg = expression;
      }
    } else {
      return null;
    }

    if (!Array.isArray(pathsArg) || pathsArg.length === 0) return null;
    const paths = pathsArg
      .map((p: any) => String(p))
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);
    if (paths.length === 0) return null;
    return { targetPath: scope, paths, fn };
  }

  private isDefineOpCall(path: SemanticPath, expression: any): { op: string; kind: string } | null {
    // Only allow defining operators at root: me["+"]("op", "kind")
    if (path.length !== 1) return null;
    const leaf = path[0];
    if (leaf !== OP_DEFINE) return null;
    if (!Array.isArray(expression) || expression.length < 2) return null;
    const op = String(expression[0] ?? "").trim();
    const kind = String(expression[1] ?? "").trim();
    if (!op || !kind) return null;
    // protect core define operator from being overwritten
    if (op === OP_DEFINE) return null;
    return { op, kind };
  }

  private getPrevMemoryHash(): string {
    const prev = this._memories[this._memories.length - 1];
    return prev?.hash ?? "";
  }

  private extractExpressionRefs(expr: string): string[] {
    const raw = String(expr ?? "").trim();
    if (!raw) return [];
    const seg = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`;
    const tokenRegex = new RegExp(String.raw`__ptr(?:\.${seg})*|${seg}(?:\.${seg})*`, "g");
    const reserved = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
    const refs = new Set<string>();
    const m = raw.match(tokenRegex) || [];
    for (const t of m) {
      if (reserved.has(t)) continue;
      refs.add(t);
    }
    return Array.from(refs);
  }

  private resolveRefPath(label: string, evalScope: SemanticPath): string | null {
    if (!label || label.startsWith("__ptr.")) return null;
    const parts = this.normalizeSelectorPath(label.split(".").filter(Boolean));
    if (parts.length === 0) return null;
    const rel = this.normalizeSelectorPath([...evalScope, ...parts]).join(".");
    const abs = this.normalizeSelectorPath(parts).join(".");
    // Prefer relative binding for bare labels and fallback to absolute for dotted roots.
    if (!label.includes(".")) return rel;
    return abs;
  }

  private unregisterDerivation(targetKey: string): void {
    const old = this.derivations[targetKey];
    if (!old) return;
    for (const ref of old.refs) {
      const arr = this.refSubscribers[ref.path] || [];
      this.refSubscribers[ref.path] = arr.filter((t) => t !== targetKey);
      if (this.refSubscribers[ref.path].length === 0) delete this.refSubscribers[ref.path];
    }
    delete this.derivations[targetKey];
    delete this.derivationRefVersions[targetKey];
    this.staleDerivations.delete(targetKey);
  }

  private getRefVersion(refPath: string): number {
    return this.refVersions[refPath] ?? 0;
  }

  private bumpRefVersion(refPath: string): void {
    this.refVersions[refPath] = this.getRefVersion(refPath) + 1;
  }

  private snapshotDerivationRefVersions(targetKey: string): void {
    const d = this.derivations[targetKey];
    if (!d) return;
    const snap: Record<string, number> = {};
    for (const ref of d.refs) snap[ref.path] = this.getRefVersion(ref.path);
    this.derivationRefVersions[targetKey] = snap;
  }

  private registerDerivation(targetPath: SemanticPath, evalScope: SemanticPath, expr: string): void {
    const targetKey = targetPath.join(".");
    this.unregisterDerivation(targetKey);

    const labels = this.extractExpressionRefs(expr);
    const refs: Array<{ label: string; path: string }> = [];
    const seen = new Set<string>();
    for (const label of labels) {
      const resolved = this.resolveRefPath(label, evalScope);
      if (!resolved) continue;
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      refs.push({ label, path: resolved });
      const arr = this.refSubscribers[resolved] || [];
      if (!arr.includes(targetKey)) arr.push(targetKey);
      this.refSubscribers[resolved] = arr;
    }

    this.derivations[targetKey] = {
      expression: expr,
      evalScope: [...evalScope],
      refs,
      lastComputedAt: Date.now(),
    };
    this.snapshotDerivationRefVersions(targetKey);
    this.staleDerivations.delete(targetKey);
  }

  private recomputeTarget(targetKey: string): boolean {
    const d = this.derivations[targetKey];
    if (!d) return false;
    const targetPath = this.normalizeSelectorPath(targetKey.split(".").filter(Boolean));
    const evaluated = this.tryEvaluateAssignExpression(d.evalScope, d.expression);
    this.postulate(targetPath, evaluated.ok ? evaluated.value : d.expression, "=");
    d.lastComputedAt = Date.now();
    this.snapshotDerivationRefVersions(targetKey);
    this.staleDerivations.delete(targetKey);
    return true;
  }

  private isDerivationVersionStale(targetKey: string): boolean {
    const d = this.derivations[targetKey];
    if (!d) return false;
    const snap = this.derivationRefVersions[targetKey] || {};
    for (const ref of d.refs) {
      if ((snap[ref.path] ?? 0) !== this.getRefVersion(ref.path)) return true;
    }
    return false;
  }

  private ensureTargetFresh(targetKey: string, visiting: Set<string> = new Set()): boolean {
    if (this.recomputeMode !== "lazy") return false;
    const d = this.derivations[targetKey];
    if (!d) return false;
    if (visiting.has(targetKey)) return false;
    visiting.add(targetKey);

    for (const ref of d.refs) {
      if (this.derivations[ref.path]) this.ensureTargetFresh(ref.path, visiting);
    }

    const needsRefresh = this.staleDerivations.has(targetKey) || this.isDerivationVersionStale(targetKey);
    let changed = false;
    if (needsRefresh) changed = this.recomputeTarget(targetKey);

    visiting.delete(targetKey);
    return changed;
  }

  private invalidateFromPath(path: SemanticPath): void {
    const root = this.normalizeSelectorPath(path).join(".");
    if (!root) return;
    this.bumpRefVersion(root);

    if (this.recomputeMode === "lazy") {
      // True lazy mode: O(1) write path.
      // We only bump the changed ref version and defer graph traversal/recompute to read-time.
      return;
    }

    const queue: string[] = [root];
    const seenTargets = new Set<string>();

    while (queue.length > 0) {
      const changed = queue.shift()!;
      const subs = this.refSubscribers[changed] || [];
      for (const target of subs) {
        if (seenTargets.has(target)) continue;
        seenTargets.add(target);
        const updated = this.recomputeTarget(target);
        if (updated) queue.push(target);
      }
    }
  }

  private clearDerivationsByPrefix(prefixPath: SemanticPath): void {
    const prefix = prefixPath.join(".");
    for (const target of Object.keys(this.derivations)) {
      if (prefix === "" || target === prefix || target.startsWith(prefix + ".")) {
        this.unregisterDerivation(target);
      }
    }
  }

  private commitMemoryOnly(
    targetPath: SemanticPath,
    operator: string | null,
    expression: any,
    value: any
  ): Memory {
    const pathStr = targetPath.join(".");
    const effectiveSecret = this.computeEffectiveSecret(targetPath);
    const prevHash = this.getPrevMemoryHash();
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
    this._memories.push(memory);
    this.applyMemoryToIndex(memory);
    return memory;
  }

  private commitValueMapping(
    targetPath: SemanticPath,
    expression: any,
    operator: string | null = null
  ): Memory {
    let storedValue: any = expression;
    const pathStr = targetPath.join(".");
    // 2) Calcular secretos efectivos fractales
    const effectiveSecret = this.computeEffectiveSecret(targetPath);
    // Guard: if a caller tries to write into a hidden scope via a userland alias (e.g. `.secret("x")`)
    // without having declared a kernel scope (`_(...)`), DO NOT auto-create an encrypted branch.
    // This keeps secret scoping purely structural.
    const scope = this.resolveBranchScope(targetPath);
    if (scope && scope.length === 0 && this.localSecrets[""] && !this.localSecrets[pathStr]) {
      // root secret is allowed to encrypt leaves (value-level), so no-op here
    }

    // 3) Escribir expresión en el árbol semántico (vía log + índice derivado)
    // Secret scope -> encryptedBranches only (stealth). Non-secret -> index stores ciphertext/plain.
    if (scope && scope.length > 0) {
      const scopeSecret = this.computeEffectiveSecret(scope);
      const rel = targetPath.slice(scope.length);
      const chunkId = this.getChunkId(targetPath, scope);
      let branchObj: any = {};
      if (scopeSecret) {
        const dec = this.getDecryptedChunk(scope, scopeSecret, chunkId);
        if (dec && typeof dec === "object") branchObj = this.cloneValue(dec);
      }

      // Mutate branch object at relative path
      if (rel.length === 0) {
        // root expression under scope
        if (typeof branchObj !== "object" || branchObj === null) branchObj = {};
        branchObj["expression"] = expression;
      } else {
        let ref = branchObj;
        for (let i = 0; i < rel.length - 1; i++) {
          const part = rel[i];
          if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
          ref = ref[part];
        }
        ref[rel[rel.length - 1]] = expression;
      }

      // Re-encrypt and store at scope root.
      if (scopeSecret) {
        const blob = xorEncrypt(branchObj, scopeSecret, scope);
        this.setChunkBlob(scope, chunkId, blob, scopeSecret);
      }
      storedValue = expression;
    } else if (effectiveSecret) {
      // value-level encryption (root secret or explicit path secret with no defined scope)
      // Do NOT encrypt pointer/identity marker objects; keep them structural.
      // ALSO: derived/eval/query operator outputs should stay readable as plain values.
      //       (You can still store secrets by putting them under a secret scope branch.)
      const shouldEncryptValue = operator !== "=" && operator !== "?";
      if (isPointer(expression) || isIdentityRef(expression) || !shouldEncryptValue) {
        storedValue = expression;
      } else {
        storedValue = xorEncrypt(expression, effectiveSecret, targetPath);
      }
    } else {
      storedValue = expression;
    }

    return this.commitMemoryOnly(targetPath, operator, expression, storedValue);
  }

  private commitMapping(instruction: MappingInstruction, fallbackOperator: string | null = null): Memory | undefined {
    switch (instruction.op) {
      case "set":
        return this.commitValueMapping(instruction.path, instruction.value, fallbackOperator);
      case "ptr":
        return this.commitValueMapping(instruction.path, instruction.value, "__");
      case "id":
        return this.commitValueMapping(instruction.path, instruction.value, "@");
      case "secret": {
        if (typeof instruction.value !== "string") return undefined;
        const scopeKey = instruction.path.join(".");
        this.localSecrets[scopeKey] = instruction.value;
        this.bumpSecretEpoch();
        return this.commitMemoryOnly(instruction.path, "_", "***", "***");
      }
      default:
        return undefined;
    }
  }

  private tryResolveEvalTokenValue(
    token: string,
    evalScopePath: SemanticPath
  ): { ok: true; value: any } | { ok: false } {
    // Special pointer namespace: resolve from pointer target first.
    if (token.startsWith("__ptr.")) {
      const raw = this.getIndex(evalScopePath);
      if (!isPointer(raw)) return { ok: false };
      const ptrSuffix = token.slice("__ptr.".length).split(".").filter(Boolean);
      const ptrPath = [...raw.__ptr.split(".").filter(Boolean), ...ptrSuffix];
      const ptrValue = this.readPath(ptrPath);
      if (ptrValue === undefined || ptrValue === null) return { ok: false };
      return { ok: true, value: ptrValue };
    }

    const tokenParts = token.split(".").filter(Boolean);
    const relativePath = [...evalScopePath, ...tokenParts];
    let value = this.readPath(relativePath);
    if (value === undefined || value === null) {
      value = this.readPath(tokenParts);
    }
    if (value === undefined || value === null) return { ok: false };
    return { ok: true, value };
  }

  private tokenizeEvalExpression(
    raw: string
  ):
    | Array<
        | { kind: "literal"; value: any }
        | { kind: "identifier"; value: string }
        | { kind: "op"; value: string }
        | { kind: "lparen" }
        | { kind: "rparen" }
      >
    | null {
    const tokens: Array<
      | { kind: "literal"; value: any }
      | { kind: "identifier"; value: string }
      | { kind: "op"; value: string }
      | { kind: "lparen" }
      | { kind: "rparen" }
    > = [];

    const seg = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`;
    const tokenRe = new RegExp(String.raw`^(?:__ptr(?:\.${seg})*|${seg}(?:\.${seg})*)`);
    const reservedValues: Record<string, any> = {
      true: true,
      false: false,
      null: null,
      undefined: undefined,
      NaN: NaN,
      Infinity: Infinity,
    };
    const twoCharOps = new Set([">=", "<=", "==", "!=", "&&", "||"]);
    const oneCharOps = new Set(["+", "-", "*", "/", "%", "<", ">", "!"]);

    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      if (ch === "(") {
        tokens.push({ kind: "lparen" });
        i++;
        continue;
      }
      if (ch === ")") {
        tokens.push({ kind: "rparen" });
        i++;
        continue;
      }

      const two = raw.slice(i, i + 2);
      if (twoCharOps.has(two)) {
        tokens.push({ kind: "op", value: two });
        i += 2;
        continue;
      }

      if (oneCharOps.has(ch)) {
        tokens.push({ kind: "op", value: ch });
        i++;
        continue;
      }

      if (/\d/.test(ch) || (ch === "." && /\d/.test(raw[i + 1] ?? ""))) {
        let j = i;
        while (j < raw.length && /[0-9]/.test(raw[j])) j++;
        if (raw[j] === ".") {
          j++;
          while (j < raw.length && /[0-9]/.test(raw[j])) j++;
        }
        if (raw[j] === "e" || raw[j] === "E") {
          let k = j + 1;
          if (raw[k] === "+" || raw[k] === "-") k++;
          let hasExpDigit = false;
          while (k < raw.length && /[0-9]/.test(raw[k])) {
            hasExpDigit = true;
            k++;
          }
          if (!hasExpDigit) return null;
          j = k;
        }
        const n = Number(raw.slice(i, j));
        if (!Number.isFinite(n)) return null;
        tokens.push({ kind: "literal", value: n });
        i = j;
        continue;
      }

      const m = raw.slice(i).match(tokenRe);
      if (m && m[0]) {
        const token = m[0];
        if (Object.prototype.hasOwnProperty.call(reservedValues, token)) {
          tokens.push({ kind: "literal", value: reservedValues[token] });
        } else {
          tokens.push({ kind: "identifier", value: token });
        }
        i += token.length;
        continue;
      }

      return null;
    }

    return tokens;
  }

  private tryEvaluateAssignExpression(
    evalScopePath: SemanticPath,
    expr: string
  ): { ok: true; value: number | boolean } | { ok: false } {
    const raw = String(expr ?? "").trim();
    if (!raw) return { ok: false };

    if (!/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(raw)) return { ok: false };
    if (this.unsafeEval) return { ok: false };

    const tokens = this.tokenizeEvalExpression(raw);
    if (!tokens || tokens.length === 0) return { ok: false };

    const precedence: Record<string, number> = {
      "u-": 7,
      "!": 7,
      "*": 6,
      "/": 6,
      "%": 6,
      "+": 5,
      "-": 5,
      "<": 4,
      "<=": 4,
      ">": 4,
      ">=": 4,
      "==": 3,
      "!=": 3,
      "&&": 2,
      "||": 1,
    };
    const rightAssoc = new Set(["u-", "!"]);
    const out: Array<{ kind: "literal"; value: any } | { kind: "identifier"; value: string } | { kind: "op"; value: string }> = [];
    const ops: Array<{ kind: "op"; value: string } | { kind: "lparen" }> = [];

    type Prev = "start" | "value" | "op" | "lparen" | "rparen";
    let prev: Prev = "start";

    for (const token of tokens) {
      if (token.kind === "literal" || token.kind === "identifier") {
        out.push(token);
        prev = "value";
        continue;
      }

      if (token.kind === "lparen") {
        ops.push(token);
        prev = "lparen";
        continue;
      }

      if (token.kind === "rparen") {
        let found = false;
        while (ops.length > 0) {
          const top = ops.pop()!;
          if (top.kind === "lparen") {
            found = true;
            break;
          }
          out.push(top);
        }
        if (!found) return { ok: false };
        prev = "rparen";
        continue;
      }

      let op = token.value;
      if (op === "-" && (prev === "start" || prev === "op" || prev === "lparen")) {
        op = "u-";
      } else if (op === "!" && (prev === "value" || prev === "rparen")) {
        return { ok: false };
      } else if (op !== "!" && (prev === "start" || prev === "op" || prev === "lparen")) {
        return { ok: false };
      }

      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.kind !== "op") break;
        const pTop = precedence[top.value] ?? -1;
        const pCur = precedence[op] ?? -1;
        if (pCur < 0) return { ok: false };
        const shouldPop = rightAssoc.has(op) ? pCur < pTop : pCur <= pTop;
        if (!shouldPop) break;
        out.push(ops.pop() as { kind: "op"; value: string });
      }
      ops.push({ kind: "op", value: op });
      prev = "op";
    }

    if (prev === "op" || prev === "lparen" || prev === "start") return { ok: false };

    while (ops.length > 0) {
      const top = ops.pop()!;
      if (top.kind === "lparen") return { ok: false };
      out.push(top);
    }

    const toFiniteNumber = (v: any): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
      return null;
    };

    const stack: any[] = [];
    for (const token of out) {
      if (token.kind === "literal") {
        stack.push(token.value);
        continue;
      }

      if (token.kind === "identifier") {
        const resolved = this.tryResolveEvalTokenValue(token.value, evalScopePath);
        if (!resolved.ok) return { ok: false };
        stack.push(resolved.value);
        continue;
      }

      const op = token.value;
      if (op === "u-" || op === "!") {
        if (stack.length < 1) return { ok: false };
        const a = stack.pop();
        if (op === "u-") {
          const n = toFiniteNumber(a);
          if (n === null) return { ok: false };
          stack.push(-n);
        } else {
          stack.push(!Boolean(a));
        }
        continue;
      }

      if (stack.length < 2) return { ok: false };
      const b = stack.pop();
      const a = stack.pop();

      if (op === "&&" || op === "||") {
        stack.push(op === "&&" ? Boolean(a) && Boolean(b) : Boolean(a) || Boolean(b));
        continue;
      }

      if (op === "==" || op === "!=") {
        stack.push(op === "==" ? a == b : a != b);
        continue;
      }

      if (op === "<" || op === "<=" || op === ">" || op === ">=") {
        const an = toFiniteNumber(a);
        const bn = toFiniteNumber(b);
        if (an === null || bn === null) return { ok: false };
        if (op === "<") stack.push(an < bn);
        if (op === "<=") stack.push(an <= bn);
        if (op === ">") stack.push(an > bn);
        if (op === ">=") stack.push(an >= bn);
        continue;
      }

      const an = toFiniteNumber(a);
      const bn = toFiniteNumber(b);
      if (an === null || bn === null) return { ok: false };
      let outNum: number;
      if (op === "+") outNum = an + bn;
      else if (op === "-") outNum = an - bn;
      else if (op === "*") outNum = an * bn;
      else if (op === "/") outNum = an / bn;
      else if (op === "%") outNum = an % bn;
      else return { ok: false };
      if (!Number.isFinite(outNum)) return { ok: false };
      stack.push(outNum);
    }

    if (stack.length !== 1) return { ok: false };
    const result = stack[0];
    if (typeof result === "number" && Number.isFinite(result)) return { ok: true, value: result };
    if (typeof result === "boolean") return { ok: true, value: result };
    return { ok: false };
  }

  // ---------------------------------------------------------
  // Postulate: semantic write at a given path
  // ---------------------------------------------------------
  private postulate(path: SemanticPath, expression: any, operator: string | null = null): any {
    let targetPath = path;
    // Operator definition (kernel-only): me["+"]("op", "kind")
    const def = this.isDefineOpCall(targetPath, expression);
    if (def) {
      // Kernel-only: do not generate memories
      this.operators[def.op] = { kind: def.kind };
      return;
    }

    // Gradual delegation path:
    // normalizeCall -> commitMapping for: set, secret, pointer, identity
    const { leaf } = splitPath(targetPath);
    const leafKind = leaf ? this.opKind(leaf) : null;
    const maybeDelegableKind =
      leafKind === null || leafKind === "secret" || leafKind === "pointer" || leafKind === "identity";
    if (maybeDelegableKind) {
      const normalized = normalizeCall(this.operators as OperatorRegistry, { path: targetPath, expression });
      if (normalized.kind === "commit") {
        const supportedOps = new Set(["set", "secret", "ptr", "id"]);
        const delegable = normalized.instructions.every((i) => supportedOps.has(i.op));
        if (delegable) {
          let out: Memory | undefined;
          const changed: SemanticPath[] = [];
          for (const instruction of normalized.instructions) {
            const maybe = this.commitMapping(instruction, operator);
            if (maybe) {
              out = maybe;
              changed.push(maybe.path.split(".").filter(Boolean));
            }
          }
          if (out) {
            for (const c of changed) this.invalidateFromPath(c);
            return out;
          }
        }
      }
    }

    // Eval operator: evaluate a thunk and optionally assign the result
    //   me["="](() => expr)               -> records a memory only
    //   me.foo.bar["="](() => expr)       -> assigns evaluated result to foo.bar
    //   me.foo["="]("net", "a - b")       -> assigns derived value to foo.net
    //   me.foo["="](["net", "a - b"])     -> same as above
    const ev = this.isEvalCall(targetPath, expression);
    if (ev) {
      if (ev.mode === "thunk") {
        const value = ev.thunk();
        // root eval: me["="](() => ...) returns the computed value
        if (ev.targetPath.length === 0) {
          return value;
        }

        // assign evaluated result to the destination path (path without the operator leaf)
        return this.postulate(ev.targetPath, value, "=");
      }

      // String-expression assign form
      // Example: me.wallet["="]("net", "wallet.income - wallet.expenses.rent")
      // If expression is arithmetic and resolvable from current state, store computed value.
      // Otherwise keep the declarative expression string.
      if (this.pathContainsIterator(ev.targetPath)) {
        const indices = this.collectIteratorIndices(ev.targetPath);
        let out: any = undefined;
        for (const idx of indices) {
          const targetScope = this.normalizeSelectorPath(this.substituteIteratorInPath(ev.targetPath, idx));
          const assignTarget = this.normalizeSelectorPath([...targetScope, ev.name]);
          const expr = this.substituteIteratorInExpression(ev.expr, idx);
          this.registerDerivation(assignTarget, targetScope, expr);
          const evaluated = this.tryEvaluateAssignExpression(targetScope, expr);
          out = this.postulate(assignTarget, evaluated.ok ? evaluated.value : expr, "=");
        }
        return out;
      }

      if (this.pathContainsFilterSelector(ev.targetPath)) {
        const scopes = this.collectFilteredScopes(ev.targetPath);
        let out: any = undefined;
        for (const rawScope of scopes) {
          const targetScope = this.normalizeSelectorPath(rawScope);
          const assignTarget = this.normalizeSelectorPath([...targetScope, ev.name]);
          this.registerDerivation(assignTarget, targetScope, ev.expr);
          const evaluated = this.tryEvaluateAssignExpression(targetScope, ev.expr);
          out = this.postulate(assignTarget, evaluated.ok ? evaluated.value : ev.expr, "=");
        }
        return out;
      }

      const assignTarget = this.normalizeSelectorPath([...ev.targetPath, ev.name]);
      const evalScope = this.normalizeSelectorPath(ev.targetPath);
      this.registerDerivation(assignTarget, evalScope, ev.expr);
      const evaluated = this.tryEvaluateAssignExpression(evalScope, ev.expr);
      if (evaluated.ok) {
        return this.postulate(assignTarget, evaluated.value, "=");
      }
      return this.postulate(assignTarget, ev.expr, "=");
    }

    // Query operator: collect values from paths and optionally transform
    //   me["?"](["a.b","c.d"])                   -> records collected array as a memory
    //   me["?"](["a.b","c.d"], (a,b)=>...)       -> records fn(a,b) as a memory
    //   me.foo["?"](["a.b"], (a)=>...)           -> assigns result to foo
    const q = this.isQueryCall(targetPath, expression);
    if (q) {
      const values = q.paths.map((p) => this.readPath(p.split(".").filter(Boolean)));
      const out = q.fn ? (q.fn as any)(...values) : values;
      // root query: me["?"](...) returns the result
      if (q.targetPath.length === 0) {
        return out;
      }

      // assign collected result at destination path
      return this.postulate(q.targetPath, out, "?");
    }

    // Remove operator
    const rm = this.isRemoveCall(targetPath, expression);
    if (rm) {
      this.removeSubtree(rm.targetPath);
      return;
    }

    // Noise declaration nodes:
    //   me.layer1["~"]("NOISE") -> declares a noise override for scope `layer1`
    // Record an operator memory without leaking the noise value.
    const noiseCall = this.isNoiseScopeCall(targetPath, expression);
    if (noiseCall) {
      this.localNoises[noiseCall.scopeKey] = expression;
      this.bumpSecretEpoch();
      const scopePath = noiseCall.scopeKey ? noiseCall.scopeKey.split(".").filter(Boolean) : [];
      return this.commitMemoryOnly(scopePath, "~", "***", "***");
    }

    const memory = this.commitValueMapping(targetPath, expression, operator);
    this.invalidateFromPath(targetPath);
    return memory;
  }

  private removeSubtree(targetPath: SemanticPath) {
    this.clearDerivationsByPrefix(targetPath);
    let securityTopologyChanged = false;
    // Remove secrets declared at/under this path (excluding root unless targetPath is root)
    const prefix = targetPath.join(".");
    for (const key of Object.keys(this.localSecrets)) {
      if (prefix === "") {
        // wiping root removes all
        delete this.localSecrets[key];
        securityTopologyChanged = true;
        continue;
      }
      if (key === prefix || key.startsWith(prefix + ".")) {
        delete this.localSecrets[key];
        securityTopologyChanged = true;
      }
    }

    // Remove noises declared at/under this path
    for (const key of Object.keys(this.localNoises)) {
      if (prefix === "") {
        delete this.localNoises[key];
        securityTopologyChanged = true;
        continue;
      }
      if (key === prefix || key.startsWith(prefix + ".")) {
        delete this.localNoises[key];
        securityTopologyChanged = true;
      }
    }
    if (securityTopologyChanged) this.bumpSecretEpoch();

    // Remove encrypted branch blobs at/under this path
    for (const key of Object.keys(this.encryptedBranches)) {
      if (prefix === "") {
        delete this.encryptedBranches[key];
        this.clearScopeChunkCache(key);
        continue;
      }
      if (key === prefix || key.startsWith(prefix + ".")) {
        delete this.encryptedBranches[key];
        this.clearScopeChunkCache(key);
        continue;
      }

      // If target is inside a secret branch scope, mutate that branch object
      // and re-encrypt it so nested deletes become visible on reads.
      const scope = key.split(".").filter(Boolean);
      if (!pathStartsWith(targetPath, scope) || targetPath.length <= scope.length) continue;
      const scopeSecret = this.computeEffectiveSecret(scope);
      if (!scopeSecret) continue;
      const chunkId = this.getChunkId(targetPath, scope);
      let branchObj = this.getDecryptedChunk(scope, scopeSecret, chunkId);
      let writeChunkId = chunkId;
      if (!branchObj && chunkId !== "default") {
        branchObj = this.getDecryptedChunk(scope, scopeSecret, "default");
        writeChunkId = "default";
      }
      if (!branchObj || typeof branchObj !== "object") continue;
      branchObj = this.cloneValue(branchObj);

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
        this.setChunkBlob(scope, writeChunkId, nextBlob, scopeSecret);
      }
    }

    // (optional but helpful) Record a memory/declaration for auditing.
    const pathStr = targetPath.join(".");
    const timestamp = Date.now();
    const effectiveSecret = this.computeEffectiveSecret(targetPath);
    const prevHash = this.getPrevMemoryHash();
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
    this._memories.push(memory);
    this.applyMemoryToIndex(memory);
  }

  // ---------------------------------------------------------
  // Fractal secret: combina todos los secrets a lo largo de la ruta, o noise acts as a new root for chaining
  // ---------------------------------------------------------
  private computeEffectiveSecret(path: SemanticPath): string {
    const pathKey = path.join(".");
    const hit = this.effectiveSecretCache.get(pathKey);
    if (hit && hit.epoch === this.secretEpoch) return hit.value;

    // 0) Noise root: pick the deepest noise declared along the path.
    // If present, it becomes the new base seed for subsequent secret chaining *below it*.
    let noiseKey: string | null = null;
    let noiseValue: string | null = null;
    if (this.localNoises[""] !== undefined) {
      noiseKey = "";
      noiseValue = this.localNoises[""];
    }

    for (let i = 1; i <= path.length; i++) {
      const k = path.slice(0, i).join(".");
      if (this.localNoises[k] !== undefined) {
        noiseKey = k;
        noiseValue = this.localNoises[k];
      }
    }

    // Base seed is either a noise-derived seed or the default "root".
    let seed = "root";
    if (noiseValue) {
      seed = hashFn("noise::" + noiseValue);
    } else if (this.localSecrets[""]) {
      // Root secret participates only when there is no overriding noise.
      seed = hashFn(seed + "::" + this.localSecrets[""]);
    }

    // 1) Normal secret chaining, but only from the noise position downward.
    // If noiseKey is null, we chain secrets from root through the full path.
    // If noiseKey is set, we chain only secrets at/under that noise scope.
    const startDepth = noiseKey === null ? 1 : noiseKey === "" ? 0 : noiseKey.split(".").filter(Boolean).length;
    for (let i = 1; i <= path.length; i++) {
      const p = path.slice(0, i).join(".");
      if (this.localSecrets[p]) {
        // If we have a noiseKey, only apply secrets at or below that noise scope.
        if (noiseKey !== null) {
          if (noiseKey === "") {
            // allow all below root
          } else {
            const noisePrefix = noiseKey + ".";
            if (!(p === noiseKey || p.startsWith(noisePrefix))) continue;
          }
        }
        seed = hashFn(seed + "::" + this.localSecrets[p]);
      }
    }

    // If nothing contributed, return empty.
    // (This preserves old behavior where an empty effectiveSecret means "no encryption" for non-secret writes.)
    const out = seed === "root" ? "" : seed;
    this.effectiveSecretCache.set(pathKey, { epoch: this.secretEpoch, value: out });
    return out;
  }


  // ---------------------------------------------------------
  // Índice derivado
  // ---------------------------------------------------------
  private applyMemoryToIndex(t: Memory): void {
    const p = t.path;
    const pathParts = p.split(".").filter(Boolean);
    if (t.operator === "_") {
      // Declaring a non-root secret scope must immediately hide that prefix from public index.
      if (pathParts.length > 0) this.removeIndexPrefix(pathParts);
      return;
    }
    const scope = this.resolveBranchScope(pathParts);
    const inSecret = scope && scope.length > 0 && pathStartsWith(pathParts, scope);
    if (t.operator === "-") {
      if (p === "") {
        for (const k of Object.keys(this.index)) delete this.index[k];
        return;
      }
      const prefix = p + ".";
      for (const k of Object.keys(this.index)) {
        if (k === p || k.startsWith(prefix)) delete this.index[k];
      }
      return;
    }

    if (inSecret) return;
    this.index[p] = t.value;
  }

  private removeIndexPrefix(prefixPath: SemanticPath): void {
    const prefix = prefixPath.join(".");
    if (!prefix) return;
    const dot = prefix + ".";
    for (const k of Object.keys(this.index)) {
      if (k === prefix || k.startsWith(dot)) delete this.index[k];
    }
  }

  private rebuildIndex() {
    const next: Record<string, any> = {};
    const orderedMemories = this._memories
      .map((t, i) => ({ t, i }))
      .sort((a, b) => {
        if (a.t.timestamp !== b.t.timestamp) return a.t.timestamp - b.t.timestamp;
        if (a.t.hash !== b.t.hash) return a.t.hash < b.t.hash ? -1 : 1;
        return a.i - b.i;
      })
      .map((x) => x.t);

    this.index = next;
    for (const t of orderedMemories) {
      this.applyMemoryToIndex(t);
    }
  }

  private getIndex(path: SemanticPath): any {
    return this.index[path.join(".")];
  }

  private setIndex(path: SemanticPath, value: any): void {
    this.index[path.join(".")] = value;
  }

  private resolveIndexPointerPath(path: SemanticPath, maxHops = 8): { path: SemanticPath; raw: any } {
    let curPath = path;
    for (let i = 0; i < maxHops; i++) {
      const exactRaw = this.getIndex(curPath);
      if (isPointer(exactRaw)) {
        curPath = exactRaw.__ptr.split(".").filter(Boolean);
        continue;
      }

      // Support pointer prefixes:
      // if `a.b` is a pointer to `x.y`, then reading `a.b.c` should resolve to `x.y.c`.
      let redirected = false;
      for (let prefixLen = curPath.length - 1; prefixLen >= 0; prefixLen--) {
        const prefix = curPath.slice(0, prefixLen);
        const prefixRaw = this.getIndex(prefix);
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

  private chunkCacheKey(scopeKey: string, chunkId: string): string {
    return `${scopeKey}::${chunkId}`;
  }

  private clearScopeChunkCache(scopeKey: string): void {
    const prefix = `${scopeKey}::`;
    for (const k of Array.from(this.decryptedBranchCache.keys())) {
      if (k.startsWith(prefix)) this.decryptedBranchCache.delete(k);
    }
  }

  private getChunkId(path: SemanticPath, scope: SemanticPath): string {
    const rel = path.slice(scope.length);
    if (rel.length === 0) return "root";
    const head = rel[0] || "root";
    const next = rel[1];
    if (next === undefined) return `${head}_root`;
    const n = Number(next);
    if (Number.isFinite(n) && String(n) === String(next)) {
      return `${head}_${Math.floor(Math.abs(n) / this.secretChunkSize)}`;
    }
    const h = parseInt(hashFn(String(next)).slice(-6), 16) % this.secretHashBuckets;
    return `${head}_h${h}`;
  }

  private setAtPath(obj: any, rel: SemanticPath, value: any): void {
    if (rel.length === 0) return;
    let ref = obj;
    for (let i = 0; i < rel.length - 1; i++) {
      const part = rel[i];
      if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
      ref = ref[part];
    }
    ref[rel[rel.length - 1]] = value;
  }

  private flattenLeaves(node: any, rel: SemanticPath, out: Array<{ rel: SemanticPath; value: any }>): void {
    if (isPointer(node) || isIdentityRef(node) || node === null || typeof node !== "object" || Array.isArray(node)) {
      out.push({ rel, value: node });
      return;
    }
    const keys = Object.keys(node);
    if (keys.length === 0) {
      out.push({ rel, value: node });
      return;
    }
    for (const k of keys) this.flattenLeaves(node[k], [...rel, k], out);
  }

  private migrateLegacyScopeToChunks(scope: SemanticPath, legacyBlob: EncryptedBlob, scopeSecret: string): void {
    const scopeKey = scope.join(".");
    const legacyObj = xorDecrypt(legacyBlob, scopeSecret, scope);
    if (!legacyObj || typeof legacyObj !== "object") {
      this.encryptedBranches[scopeKey] = { default: legacyBlob };
      return;
    }

    const leaves: Array<{ rel: SemanticPath; value: any }> = [];
    this.flattenLeaves(legacyObj, [], leaves);
    const chunkObjs: Record<string, any> = {};
    for (const leaf of leaves) {
      const chunkId = this.getChunkId([...scope, ...leaf.rel], scope);
      if (!chunkObjs[chunkId] || typeof chunkObjs[chunkId] !== "object") chunkObjs[chunkId] = {};
      this.setAtPath(chunkObjs[chunkId], leaf.rel, leaf.value);
    }

    const next: Record<string, EncryptedBlob> = {};
    for (const [chunkId, chunkObj] of Object.entries(chunkObjs)) {
      next[chunkId] = xorEncrypt(chunkObj, scopeSecret, scope);
    }
    this.encryptedBranches[scopeKey] = next;
    this.clearScopeChunkCache(scopeKey);
  }

  private ensureScopeChunks(scope: SemanticPath, scopeSecret: string): Record<string, EncryptedBlob> {
    const scopeKey = scope.join(".");
    const current = this.encryptedBranches[scopeKey];
    if (!current) {
      const next: Record<string, EncryptedBlob> = {};
      this.encryptedBranches[scopeKey] = next;
      return next;
    }
    if (typeof current === "string") {
      this.migrateLegacyScopeToChunks(scope, current as EncryptedBlob, scopeSecret);
      return this.encryptedBranches[scopeKey] as Record<string, EncryptedBlob>;
    }
    return current as Record<string, EncryptedBlob>;
  }

  private getChunkBlob(scope: SemanticPath, chunkId: string): EncryptedBlob | undefined {
    const scopeKey = scope.join(".");
    const current = this.encryptedBranches[scopeKey];
    if (!current) return undefined;
    if (typeof current === "string") return chunkId === "default" ? (current as EncryptedBlob) : undefined;
    return (current as Record<string, EncryptedBlob>)[chunkId];
  }

  private setChunkBlob(scope: SemanticPath, chunkId: string, blob: EncryptedBlob, scopeSecret: string): void {
    const scopeKey = scope.join(".");
    const chunks = this.ensureScopeChunks(scope, scopeSecret);
    chunks[chunkId] = blob;
    this.decryptedBranchCache.delete(this.chunkCacheKey(scopeKey, chunkId));
    // Intentionally do NOT mirror encrypted blobs into the index.
    // The index should not reveal that a secret scope even exists.
  }

  private getDecryptedChunk(scope: SemanticPath, scopeSecret: string, chunkId: string): any | undefined {
    const scopeKey = scope.join(".");
    const blob = this.getChunkBlob(scope, chunkId);
    if (!blob) return undefined;
    const ck = this.chunkCacheKey(scopeKey, chunkId);
    const hit = this.decryptedBranchCache.get(ck);
    if (hit && hit.epoch === this.secretEpoch && hit.blob === blob) return hit.data;

    const data = xorDecrypt(blob, scopeSecret, scope);
    if (!data || typeof data !== "object") return undefined;
    this.decryptedBranchCache.set(ck, { epoch: this.secretEpoch, blob, data });
    return data;
  }

  private resolveBranchScope(path: SemanticPath): SemanticPath | null {
    const pathKey = path.join(".");
    const hit = this.scopeCache.get(pathKey);
    if (hit && hit.epoch === this.secretEpoch) return hit.scope ? [...hit.scope] : null;

    // pick the deepest scope root that has a secret declared
    let best: SemanticPath | null = null;
    if (this.localSecrets[""]) best = [];
    for (let i = 1; i <= path.length; i++) {
      const p = path.slice(0, i);
      const k = p.join(".");
      if (this.localSecrets[k]) best = p;
    }
    this.scopeCache.set(pathKey, { epoch: this.secretEpoch, scope: best ? [...best] : null });
    return best;
  }

  private normalizeSelectorPath(path: SemanticPath): SemanticPath {
    const out: SemanticPath = [];
    for (const segment of path) {
      const s = String(segment).trim();
      if (!s) continue;
      const firstBracket = s.indexOf("[");
      if (firstBracket === -1) {
        out.push(s);
        continue;
      }

      const base = s.slice(0, firstBracket).trim();
      const tail = s.slice(firstBracket);
      if (base) out.push(base);

      // Phase 1: support [1], ["key"], ['key'], and chained selectors [1][2].
      const matches = Array.from(tail.matchAll(/\[([^\]]*)\]/g));
      const reconstructed = matches.map((m) => m[0]).join("");
      if (reconstructed !== tail) {
        // Malformed selector tail: keep raw tail segment to avoid destructive parsing.
        out.push(tail);
        continue;
      }

      for (const m of matches) {
        let selector = (m[1] ?? "").trim();
        if (
          (selector.startsWith('"') && selector.endsWith('"')) ||
          (selector.startsWith("'") && selector.endsWith("'"))
        ) {
          selector = selector.slice(1, -1);
        }
        if (!selector) continue;
        out.push(selector);
      }
    }
    return out;
  }

  private pathContainsIterator(path: SemanticPath): boolean {
    return path.some((segment) => segment.includes("[i]"));
  }

  private substituteIteratorInPath(path: SemanticPath, indexValue: string): SemanticPath {
    return path.map((segment) => segment.split("[i]").join(`[${indexValue}]`));
  }

  private substituteIteratorInExpression(expr: string, indexValue: string): string {
    return String(expr ?? "").split("[i]").join(`[${indexValue}]`);
  }

  private collectIteratorIndices(path: SemanticPath): string[] {
    // MVP: derive indices from public index keys.
    // Example: path "...lote[i]" -> prefix "...lote", then pick immediate children.
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
    for (const key of Object.keys(this.index)) {
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

  private parseFilterExpression(
    expr: string
  ): { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string } | null {
    const s = String(expr ?? "").trim();
    const m = s.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
    if (!m) return null;
    const left = m[1].trim();
    const op = m[2] as ">" | "<" | ">=" | "<=" | "==" | "!=";
    const right = m[3].trim();
    if (!left || !right) return null;
    return { left, op, right };
  }

  private parseLogicalFilterExpression(
    expr: string
  ): {
    clauses: Array<{ left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }>;
    ops: Array<"&&" | "||">;
  } | null {
    const raw = String(expr ?? "").trim();
    if (!raw) return null;
    const parts = raw.split(/\s*(&&|\|\|)\s*/).filter((p) => p.length > 0);
    if (parts.length === 0) return null;

    const clauses: Array<{ left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }> = [];
    const ops: Array<"&&" | "||"> = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        const c = this.parseFilterExpression(parts[i]);
        if (!c) return null;
        clauses.push(c);
      } else {
        const op = parts[i] as "&&" | "||";
        if (op !== "&&" && op !== "||") return null;
        ops.push(op);
      }
    }
    if (clauses.length === 0) return null;
    if (ops.length !== Math.max(0, clauses.length - 1)) return null;
    return { clauses, ops };
  }

  private compareValues(left: any, op: ">" | "<" | ">=" | "<=" | "==" | "!=", right: any): boolean {
    switch (op) {
      case ">":
        return left > right;
      case "<":
        return left < right;
      case ">=":
        return left >= right;
      case "<=":
        return left <= right;
      case "==":
        return left == right; // intentional loose compare for DSL friendliness
      case "!=":
        return left != right; // intentional loose compare for DSL friendliness
      default:
        return false;
    }
  }

  private parseLiteralOrPath(raw: string): { kind: "literal"; value: any } | { kind: "path"; parts: SemanticPath } {
    const s = raw.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return { kind: "literal", value: s.slice(1, -1) };
    }
    if (s === "true") return { kind: "literal", value: true };
    if (s === "false") return { kind: "literal", value: false };
    if (s === "null") return { kind: "literal", value: null };
    const n = Number(s);
    if (Number.isFinite(n)) return { kind: "literal", value: n };
    return { kind: "path", parts: this.normalizeSelectorPath(s.split(".").filter(Boolean)) };
  }

  private resolveRelativeFirst(scope: SemanticPath, parts: SemanticPath): any {
    const rel = this.readPath([...scope, ...parts]);
    if (rel !== undefined && rel !== null) return rel;
    return this.readPath(parts);
  }

  private evaluateFilterClauseForScope(
    scope: SemanticPath,
    clause: { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }
  ): boolean {
    const leftParts = this.normalizeSelectorPath(clause.left.split(".").filter(Boolean));
    const leftValue = this.resolveRelativeFirst(scope, leftParts);
    if (leftValue === undefined || leftValue === null) return false;

    const rightParsed = this.parseLiteralOrPath(clause.right);
    const rightValue =
      rightParsed.kind === "literal"
        ? rightParsed.value
        : this.resolveRelativeFirst(scope, rightParsed.parts);
    if (rightValue === undefined || rightValue === null) return false;

    return this.compareValues(leftValue, clause.op, rightValue);
  }

  private evaluateLogicalFilterForScope(scope: SemanticPath, expr: string): boolean {
    const parsed = this.parseLogicalFilterExpression(expr);
    if (!parsed) return false;
    let acc = this.evaluateFilterClauseForScope(scope, parsed.clauses[0]);
    for (let i = 1; i < parsed.clauses.length; i++) {
      const v = this.evaluateFilterClauseForScope(scope, parsed.clauses[i]);
      const op = parsed.ops[i - 1];
      acc = op === "&&" ? acc && v : acc || v;
    }
    return acc;
  }

  private collectChildrenForPrefix(prefix: SemanticPath): string[] {
    const out = new Set<string>();
    for (const key of Object.keys(this.index)) {
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

  private parseSelectorSegment(segment: string): { base: string; selector: string } | null {
    const s = String(segment ?? "").trim();
    const first = s.indexOf("[");
    const last = s.lastIndexOf("]");
    if (first <= 0 || last <= first) return null;
    if (last !== s.length - 1) return null;
    const base = s.slice(0, first).trim();
    const selector = s.slice(first + 1, last).trim();
    if (!base || !selector) return null;
    return { base, selector };
  }

  private parseSelectorKeys(selector: string): string[] | null {
    const s = selector.trim();

    // Phase 4a: explicit multi-select array syntax: [[1,3,5]] or [["a","b"]]
    if (s.startsWith("[") && s.endsWith("]")) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
      return parts.map((p) => {
        if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
          return p.slice(1, -1);
        }
        return p;
      });
    }

    // Phase 4b: range syntax: [1..10]
    const range = s.match(/^(-?\d+)\s*\.\.\s*(-?\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const step = start <= end ? 1 : -1;
      const out: string[] = [];
      // Guard against pathological huge ranges in this MVP.
      const maxSpan = 10000;
      if (Math.abs(end - start) > maxSpan) return null;
      for (let n = start; step > 0 ? n <= end : n >= end; n += step) out.push(String(n));
      return out;
    }

    return null;
  }

  private parseTransformSelector(selector: string): { varName: string; expr: string } | null {
    const s = selector.trim();
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(.+)$/);
    if (!m) return null;
    const varName = m[1].trim();
    const expr = m[2].trim();
    if (!varName || !expr) return null;
    return { varName, expr };
  }

  private evaluateTransformPath(path: SemanticPath): any {
    const selPos = path.findIndex((segment) => {
      const parsed = this.parseSelectorSegment(segment);
      if (!parsed) return false;
      return this.parseTransformSelector(parsed.selector) !== null;
    });
    if (selPos === -1) return undefined;

    const parsedSeg = this.parseSelectorSegment(path[selPos]);
    if (!parsedSeg) return undefined;
    const transform = this.parseTransformSelector(parsedSeg.selector);
    if (!transform) return undefined;

    const collectionPrefix = [...path.slice(0, selPos), parsedSeg.base];
    const suffix = path.slice(selPos + 1);
    // Phase 5 MVP: transformation selector is a terminal projection for now.
    if (suffix.length > 0) return undefined;

    const children = this.collectChildrenForPrefix(collectionPrefix);
    const out: Record<string, any> = {};
    for (const child of children) {
      const scope = [...collectionPrefix, child];
      // Replace "x." by relative path access at current scope.
      // Example: x.kilos * 0.9 -> kilos * 0.9
      const expr = transform.expr.replace(
        new RegExp(String.raw`\b${transform.varName}\.`, "g"),
        ""
      );
      const evaluated = this.tryEvaluateAssignExpression(scope, expr);
      if (evaluated.ok) {
        out[child] = evaluated.value;
      }
    }
    return out;
  }

  private evaluateSelectionPath(path: SemanticPath): any {
    const selPos = path.findIndex((segment) => this.parseSelectorSegment(segment) !== null);
    if (selPos === -1) return undefined;

    const parsed = this.parseSelectorSegment(path[selPos]);
    if (!parsed) return undefined;

    const keys = this.parseSelectorKeys(parsed.selector);
    if (keys === null) return undefined;

    const collectionPrefix = [...path.slice(0, selPos), parsed.base];
    const suffix = path.slice(selPos + 1);
    const out: Record<string, any> = {};

    for (const key of keys) {
      const scope = [...collectionPrefix, key];
      const value =
        suffix.length === 0
          ? this.buildPublicSubtree(scope)
          : this.readPath([...scope, ...suffix]);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  private buildPublicSubtree(prefix: SemanticPath): any {
    const prefixKey = prefix.join(".");
    const root: any = {};
    let wroteAny = false;
    for (const [k, v] of Object.entries(this.index)) {
      if (k === prefixKey) {
        // leaf value directly at prefix
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

  private evaluateFilterPath(path: SemanticPath): any {
    const filterPos = path.findIndex((segment) => this.parseLogicalFilterExpression(segment) !== null);
    if (filterPos === -1) return undefined;

    const filterExpr = path[filterPos];

    const collectionPrefix = path.slice(0, filterPos);
    const suffix = path.slice(filterPos + 1);
    if (collectionPrefix.length === 0) return undefined;

    const children = this.collectChildrenForPrefix(collectionPrefix);
    const out: Record<string, any> = {};

    for (const child of children) {
      const scope = [...collectionPrefix, child];
      if (!this.evaluateLogicalFilterForScope(scope, filterExpr)) continue;

      if (suffix.length === 0) {
        out[child] = this.buildPublicSubtree(scope);
      } else {
        out[child] = this.readPath([...scope, ...suffix]);
      }
    }

    return out;
  }

  private pathContainsFilterSelector(path: SemanticPath): boolean {
    return path.some((segment) => {
      const parsed = this.parseSelectorSegment(segment);
      if (!parsed) return false;
      return this.parseLogicalFilterExpression(parsed.selector) !== null;
    });
  }

  private collectFilteredScopes(path: SemanticPath): SemanticPath[] {
    const selPos = path.findIndex((segment) => {
      const parsed = this.parseSelectorSegment(segment);
      if (!parsed) return false;
      return this.parseLogicalFilterExpression(parsed.selector) !== null;
    });
    if (selPos === -1) return [];

    const parsed = this.parseSelectorSegment(path[selPos]);
    if (!parsed) return [];

    const collectionPrefix = [...path.slice(0, selPos), parsed.base];
    const tail = path.slice(selPos + 1);
    const children = this.collectChildrenForPrefix(collectionPrefix);
    const out: SemanticPath[] = [];
    for (const child of children) {
      const scope = [...collectionPrefix, child];
      if (!this.evaluateLogicalFilterForScope(scope, parsed.selector)) continue;
      out.push([...scope, ...tail]);
    }
    return out;
  }

  private readPath(path: SemanticPath): any {
    const transformed = this.evaluateTransformPath(path);
    if (transformed !== undefined) return transformed;

    const selected = this.evaluateSelectionPath(path);
    if (selected !== undefined) return selected;

    path = this.normalizeSelectorPath(path);
    if (this.recomputeMode === "lazy") {
      const key = path.join(".");
      if (this.derivations[key]) this.ensureTargetFresh(key);
    }
    const filtered = this.evaluateFilterPath(path);
    if (filtered !== undefined) return filtered;

    // 1) Secret scopes (non-root) live ONLY in encryptedBranches.
    const scope = this.resolveBranchScope(path);
    if (scope && scope.length > 0 && pathStartsWith(path, scope)) {
      if (path.length === scope.length) return undefined; // hide scope root
      const scopeSecret = this.computeEffectiveSecret(scope);
      if (!scopeSecret) return null;
      const chunkId = this.getChunkId(path, scope);
      let branchObj = this.getDecryptedChunk(scope, scopeSecret, chunkId);
      if (!branchObj && chunkId !== "default") {
        branchObj = this.getDecryptedChunk(scope, scopeSecret, "default");
      }
      if (!branchObj) return undefined;
      const rel = path.slice(scope.length);
      let ref: any = branchObj;
      for (const part of rel) {
        if (!ref || typeof ref !== "object") return undefined;
        ref = ref[part];
      }
      if (isPointer(ref)) return this.readPath(ref.__ptr.split(".").filter(Boolean));
      if (isIdentityRef(ref)) return this.cloneValue(ref);
      if (ref && typeof ref === "object") return this.cloneValue(ref);
      return ref;
    }

    // 2) Non-secret: read from derived index, resolve pointers, decrypt if needed.
    // Keep direct pointer reads structural: me("a.ptr") -> { __ptr: "x.y" }.
    const directRaw = this.getIndex(path);
    if (isPointer(directRaw)) return directRaw;
    const resolved = this.resolveIndexPointerPath(path);
    const raw = resolved.raw;
    if (raw === undefined) {
      // If pointer resolution redirected to another path (often into a secret scope),
      // delegate once to the resolved target.
      const samePath =
        resolved.path.length === path.length &&
        resolved.path.every((part, i) => part === path[i]);
      if (!samePath) return this.readPath(resolved.path);
      return undefined;
    }
    if (isPointer(raw)) return this.readPath(raw.__ptr.split(".").filter(Boolean));
    if (isIdentityRef(raw)) return raw;
    if (!isEncryptedBlob(raw)) return raw;
    // IMPORTANT:
    // Decrypt using the caller's requested path, not the pointer-resolved path.
    // This avoids mismatch when a pointer hops across a noise boundary.
    const effectiveSecret = this.computeEffectiveSecret(path);
    if (!effectiveSecret) return null;
    return xorDecrypt(raw, effectiveSecret, path);
  }
}
