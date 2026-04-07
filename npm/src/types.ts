// -----------------------------
// Core runtime data shapes
// -----------------------------
export type OperatorToken =
  | "_" // secret scope declaration
  | "~" // noise scope declaration
  | "__" // pointer declaration
  | "->" // pointer declaration (alias)
  | "@" // identity declaration
  | "=" // eval/derive
  | "?" // collect/query
  | "-" // remove
  | "+" // operator define (kernel-only)
  | string;

export type OperatorKind =
  | "secret"
  | "noise"
  | "pointer"
  | "identity"
  | "eval"
  | "query"
  | "remove"
  | "custom";

export interface OperatorRegistryEntry {
  kind: OperatorKind;
}

export type OperatorRegistry = Record<OperatorToken, OperatorRegistryEntry>;
/**
 * Public semantic log item exposed by `.me` surfaces such as inspect(),
 * `me.memories`, and exported snapshots.
 */
export interface Memory {
  /** semantic destination path (where the write/claim lands). root is "" */
  path: string;
  /** operator used to produce this memory (null for normal writes) */
  operator: string | null;
  /** expression as provided by the user (pre-eval / pre-resolve). */
  expression?: any;
  /** value that was actually committed at `path` (post-eval / post-collect; may be encrypted) */
  value: any;
  /** portable hash (FNV-1a 32-bit in me.ts) */
  hash: string;
  /** previous memory hash for chain integrity (genesis = "") */
  prevHash?: string;
  timestamp: number;
}

/**
 * Internal kernel memory record.
 * This preserves forensic fields that should not cross the public API boundary.
 */
export interface KernelMemory extends Memory {
  /** computed by ME kernel (fractal secret chaining + noise override) */
  effectiveSecret?: string;
}

export type ReplayMemoryInput = Memory | KernelMemory;
// -----------------------------
// Structural marker values
// -----------------------------
export type MePointer = { __ptr: string };
export type MeIdentityRef = { __id: string };
export type MeMarker = MePointer | MeIdentityRef;
export type EncryptedBlob = `0x${string}`;

// -----------------------------
// Wrapped secret envelopes (v1)
// -----------------------------
export type WrappedSecretClass = "identity-key" | "app-secret" | "data-key";
export type WrappedSecretUsage = "sign" | "decrypt" | "derive";

export interface P256PublicKeyCoordinates {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

export interface WrappedSecretPolicy {
  appId?: string;
  usage?: WrappedSecretUsage[];
  label?: string;
  /**
   * Declarative policy hint only.
   * This does not prove Secure Enclave / TPM attestation by itself.
   */
  hardwareBound?: boolean;
}

export interface WrappedSecretEncryptionV1 {
  kex: "ECDH-ES";
  kdf: "HKDF-SHA-256";
  aead: "AES-256-GCM";
  iv: string;
  salt: string;
  tag: string;
  ciphertext: string;
  ephemeralPK: P256PublicKeyCoordinates;
}

export interface WrappedSecretV1 {
  version: 1;
  class: WrappedSecretClass;
  kid: string;
  /**
   * Public key corresponding to the wrapped secret material when the secret
   * represents an asymmetric keypair. Optional for generic app/data secrets.
   */
  publicKey?: P256PublicKeyCoordinates;
  encryption: WrappedSecretEncryptionV1;
  policy?: WrappedSecretPolicy;
}

export interface StoredWrappedKey {
  envelope: WrappedSecretV1;
  recipientKeyId?: string;
}

// -----------------------------
// me:// executable targets
// -----------------------------
export interface MeTargetAst {
  scheme: "me";
  namespace: string;
  operation: string;
  path: string;
  raw?: string;
  /**
   * Optional raw context segment preserved for higher layers such as cleaker
   * and monad.ai. The `.me` kernel does not interpret transport context.
   */
  contextRaw?: string | null;
}
// -----------------------------
// Path / call representation
// -----------------------------
export type SemanticPath = string[];

// Opaque ME instance shape (runtime class lives in `me.ts`).
// Useful for typing APIs without importing the class type.
export type MEInstance = Record<string, any>;
// Proxy surface type used by ME's infinite chaining API.
// Note: we intentionally do NOT reference the concrete `ME` class here,
// so this types-only module can be imported without circular deps.
export type MEProxy = {
  [key: string]: any;
  (...args: any[]): MEProxy;
};

/**
 * What ME routing produces when a Proxy chain is invoked.
 */
export interface OperatorCall {
  /** Raw path array for the call site, including operator leaf if present. */
  path: SemanticPath;

  /**
   * The normalized expression passed into postulate.
   * - 0 args -> undefined
   * - 1 arg  -> that arg
   * - 2+ args -> packed array
   */
  expression: any;

  /**
   * When called at root path.length===0 and expression is a string that looks like a path,
   * ME biases to GET. Operators should not override that routing.
   */
  isRoot: boolean;
}

/**
 * Operator recognition can either match (and then execute) or pass.
 */
export type OperatorMatch =
  | { matched: false }
  | {
      matched: true;
      /** The operator token that matched (e.g. "_", "=") */
      token: OperatorToken;
      /** The operator kind from the registry */
      kind: OperatorKind;
      /**
       * The destination path that should receive the semantic write (operator leaf removed
       * or otherwise transformed). In me.ts this is typically `scope`.
       */
      targetPath: SemanticPath;
      /**
       * The expression to write after the operator transforms it.
       * e.g. pointer operator turns expression:string into {__ptr:string}
       */
      rewrittenExpression?: any;
      /**
       * If operator is producing a semantic memory, what should be recorded as `operator`.
       * (me.ts uses "__" for both "__" and "->" pointer calls).
       */
      memoryOperator?: string;
      /**
       * Some operators return a value instead of writing when invoked at root.
       * - root "=" thunk returns computed value
       * - root "?" returns collected/transformed output
       */
      returnsValueAtRoot?: boolean;
    };

// -----------------------------
// Kernel hooks (ME provides these)
// -----------------------------

/**
 * A minimal “kernel facade” for operator modules.
 * These are *capabilities* the ME kernel must expose so ops can behave exactly like me.ts.
 */
export interface OperatorKernel {
  // --- registry
  opKind(op: string): OperatorKind | null;
  operators?: OperatorRegistry;

  // --- path helpers
  splitPath(path: SemanticPath): { scope: SemanticPath; leaf: string | null };

  // --- storage planes (public + secret + config)
  localSecrets?: Record<string, string>;
  localNoises?: Record<string, string>;
  encryptedBranches?: Record<string, EncryptedBlob>;

  // canonical log + index
  memories?: KernelMemory[];
  rebuildIndex(): void;

  // --- crypto & secret derivation
  computeEffectiveSecret(path: SemanticPath): string;
  xorEncrypt(value: any, secret: string, path: SemanticPath): EncryptedBlob;
  xorDecrypt(blob: EncryptedBlob, secret: string, path: SemanticPath): any;
  isEncryptedBlob(v: any): v is EncryptedBlob;

  // --- marker construction & tests
  makePointer(targetPath: string): MePointer;
  isPointer(v: any): v is MePointer;

  makeIdentityRef(id: string): MeIdentityRef;
  isIdentityRef(v: any): v is MeIdentityRef;

  // --- reads/writes
  /**
   * Read semantic data using the same rules as me.ts:
   * - Secret scope roots return undefined (stealth)
   * - Secret interior reads decrypt from encryptedBranches
   * - Public reads come from index and decrypt value-level blobs
   */
  readPath(path: SemanticPath): any;

  /**
   * Append an event to memories and rebuild index.
   * Operators that are “kernel-only” should avoid emitting memories.
   */
  commitMemory?(t: KernelMemory): void;

  /**
   * Remove a subtree: deletes matching localSecrets/localNoises/encryptedBranches and emits a "-" memory.
   */
  removeSubtree(targetPath: SemanticPath): void;

  /**
   * For ops that need username normalization.
   */
  normalizeAndValidateUsername(input: string): string;

  /**
   * Portable hash function used to populate Memory.hash
   */
  hashFn(input: string): string;

  /**
   * Current time. me.ts uses Date.now().
   */
  now(): number;
}

// -----------------------------
// Operator results
// -----------------------------

/**
 * Operators in me.ts can yield:
 * - a Memory (most writes)
 * - undefined (kernel-only or removals)
 * - a returned value for root "=" thunk and root "?" query
 */
export type OperatorResult = KernelMemory | any | undefined;

// -----------------------------
// Operator handler interface
// -----------------------------

export interface OperatorHandler {
  /**
   * Return a match if this operator applies to the call.
   * IMPORTANT: matching depends on:
   * - operator token at leaf
   * - operator registry kind
   * - argument shape (string / function / array)
   * - whether called at root vs non-root
   */
  match(call: OperatorCall, kernel: OperatorKernel): OperatorMatch;

  /**
   * Execute behavior.
   * This function may:
   * - mutate kernel config (define operator)
   * - write memories / encrypt branches / update secrets/noises
   * - return a value (root eval/query) or a Memory
   */
  execute(match: Extract<OperatorMatch, { matched: true }>, call: OperatorCall, kernel: OperatorKernel): OperatorResult;
}

export interface OperatorModule {
  /**
   * The operator tokens this module is responsible for.
   * (e.g. ["_"] or ["__", "->"]).
   */
  tokens: OperatorToken[];

  /**
   * Optional: kind(s) this module expects.
   */
  kinds?: OperatorKind[];

  handler: OperatorHandler;
}

// -----------------------------
// Pure mapping proposal types
// -----------------------------

/**
 * Canonical operation tags for blind kernel commits.
 * This coexists with legacy `operator` semantics during migration.
 */
export type MappingOp = "set" | "secret" | "noise" | "ptr" | "id" | "derive" | "query" | "remove";

/**
 * Proxy/router-level invocation before semantic normalization.
 */
export interface MappingIntent {
  path: SemanticPath;
  expression: any;
}

/**
 * Normalized mapping instruction ready for kernel commit.
 */
export interface MappingInstruction {
  path: SemanticPath;
  op: MappingOp;
  value: any;
  meta?: Record<string, any>;
}

/**
 * Output of the semantic normalization layer.
 * - "commit": produce one or more instructions for storage.
 * - "return": immediate runtime value (root eval/query-like paths), with optional side commits.
 */
export type NormalizedCall =
  | {
      kind: "commit";
      instructions: MappingInstruction[];
    }
  | {
      kind: "return";
      value: any;
      instructions?: MappingInstruction[];
    };

// -----------------------------
// Exact semantics (me.ts invariants)
// -----------------------------

/**
 * Invariants that MUST hold for an extracted-ops architecture to remain compatible with current me.ts.
 */
export const OperatorInvariants = {
  /**
   * Root GET bias:
   * - me("a.b") is always readPath
   * - me("username") is always readPath
   * - me("@foo") / me("_secret") / me("~noise") are always readPath-style routing
   */
  rootGetBias: true,

  /**
   * Secret scopes are structural and stealth:
   * - A non-root secret scope root (e.g. "wallet") must NOT appear in the public index.
   * - Reading the scope root returns undefined.
   * - Values under the scope are stored only inside encryptedBranches blob at the scope root.
   */
  secretScopesAreStealth: true,

  /**
   * Secret/noise declarations must not leak their raw string in Memory.
   * me.ts records expression/value as "***" for those operator memories.
   */
  scopeDeclarationRedaction: true,

  /**
   * Pointer/identity markers are structural and must not be encrypted.
   */
  markersAreNeverEncrypted: true,

  /**
   * "=" thunk:
   * - If invoked at root: returns computed value (no write)
   * - Else: assigns evaluated value into targetPath (operator "=")
   * "=" assign-string form stores expression string in <targetPath>.<name>
   */
  evalReturningAtRoot: true,

  /**
   * "?" collect:
   * - Root returns output (no write)
   * - Else assigns output at targetPath (operator "?")
   */
  queryReturningAtRoot: true,

  /**
   * "-" remove deletes:
   * - localSecrets entries at/under subtree
   * - localNoises entries at/under subtree
   * - encryptedBranches blobs at/under subtree
   * And emits a "-" memory.
   */
  removeIsDeep: true,

  /**
   * Operator define ("+") is kernel-only:
   * - Only at root
   * - Updates operator registry
   * - Emits NO memory
   */
  defineIsKernelOnly: true,
} as const;

// -----------------------------
// Optional helper typings for later extraction
// -----------------------------

export type BuiltinOperatorModules =
  | "define"
  | "secret"
  | "noise"
  | "pointer"
  | "identity"
  | "eval"
  | "query"
  | "remove";

export interface OperatorSystemSpec {
  registry: OperatorRegistry;
  modules: OperatorModule[];
}

// -----------------------------
// Internal ME kernel extraction types
// -----------------------------

export type MERecomputeMode = "eager" | "lazy";

export interface MEDerivationRecord {
  expression: string;
  evalScope: SemanticPath;
  refs: Array<{ label: string; path: string }>;
  lastComputedAt: number;
}

export interface MEBranchScopeCacheEntry {
  epoch: number;
  scope: SemanticPath | null;
}

export interface MEEffectiveSecretCacheEntry {
  epoch: number;
  value: string;
}

export interface MEDecryptedBranchCacheEntry {
  epoch: number;
  blob: EncryptedBlob;
  data: any;
}

export interface MEInspectResult {
  memories: Memory[];
  index: Record<string, any>;
  encryptedScopes: string[];
  secretScopes: string[];
  noiseScopes: string[];
  recomputeMode: MERecomputeMode;
  staleDerivations: number;
}

export interface MEExplainResult {
  path: string;
  value: any;
  derivation: null | {
    expression: string;
    inputs: Array<{
      label: string;
      path: string;
      value: any;
      origin: "public" | "stealth";
      masked: boolean;
    }>;
  };
  meta: {
    dependsOn: string[];
    lastComputedAt?: number;
  };
}

/**
 * Portable public snapshot shape.
 * Memory records exported here are redacted and never expose `effectiveSecret`.
 */
export interface MESnapshot {
  memories: Memory[];
  localSecrets: Record<string, string>;
  localNoises: Record<string, string>;
  encryptedBranches: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
  keySpaces: Record<string, StoredWrappedKey>;
  operators: Record<string, { kind: string }>;
}

/**
 * Snapshot import shape.
 * Accepts both modern redacted memories and legacy/internal memory payloads.
 */
export interface MESnapshotInput {
  memories?: ReplayMemoryInput[];
  localSecrets?: Record<string, string>;
  localNoises?: Record<string, string>;
  encryptedBranches?: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
  keySpaces?: Record<string, StoredWrappedKey>;
  operators?: Record<string, { kind: string }>;
}

export interface MEWrappedKeyOpenOptions {
  recipientKeyId?: string;
  recipientPrivateKey?: CryptoKey;
  output?: "bytes" | "utf8";
}

export interface MERuntimeMethodDescriptor {
  kind: "method";
  path: string;
  docs: string;
  signature: string;
  call: (...args: any[]) => unknown;
}

export interface MEKernelLike extends Record<string, any> {
  localSecrets: Record<string, string>;
  localNoises: Record<string, string>;
  encryptedBranches: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
  keySpaces: Record<string, StoredWrappedKey>;
  recipientKeyring: Record<string, CryptoKey>;
  index: Record<string, any>;
  _memories: KernelMemory[];
  derivations: Record<string, MEDerivationRecord>;
  refSubscribers: Record<string, string[]>;
  recomputeMode: MERecomputeMode;
  refVersions: Record<string, number>;
  derivationRefVersions: Record<string, Record<string, number>>;
  staleDerivations: Set<string>;
  secretEpoch: number;
  scopeCache: Map<string, MEBranchScopeCacheEntry>;
  effectiveSecretCache: Map<string, MEEffectiveSecretCacheEntry>;
  decryptedBranchCache: Map<string, MEDecryptedBranchCacheEntry>;
  readonly secretChunkSize: number;
  readonly secretHashBuckets: number;
  readonly unsafeEval: boolean;
  operators: Record<string, { kind: string }>;
  memories: Memory[];

  inspect(opts?: { last?: number }): MEInspectResult;
  explain(path: string): MEExplainResult;
  setRecomputeMode(mode: MERecomputeMode): this;
  getRecomputeMode(): MERecomputeMode;
  installRecipientKey(recipientKeyId: string, privateKey: CryptoKey): this;
  uninstallRecipientKey(recipientKeyId: string): this;
  storeWrappedKey(keyId: string, envelope: WrappedSecretV1, options?: { recipientKeyId?: string }): this;
  execute(rawTarget: string | MeTargetAst, body?: any): any;
  exportSnapshot(): MESnapshot;
  importSnapshot(snapshot: MESnapshotInput): void;
  rehydrate(snapshot: MESnapshotInput): void;
  learn(memory: unknown): void;
  replayMemories(memories: ReplayMemoryInput[]): void;
  cloneValue<T>(value: T): T;
  normalizeArgs(args: any[]): any;
  opKind(op: string): string | null;
  postulate(path: SemanticPath, expression: any, operator?: string | null): any;
  readPath(path: SemanticPath): any;
  getIndex(path: SemanticPath): any;
  setIndex(path: SemanticPath, value: any): void;
  normalizeSelectorPath(path: SemanticPath): SemanticPath;
  resolveBranchScope(path: SemanticPath): SemanticPath | null;
  computeEffectiveSecret(path: SemanticPath): string;
  getChunkId(path: SemanticPath, scope: SemanticPath): string;
  getDecryptedChunk(scope: SemanticPath, scopeSecret: string, chunkId: string): any | undefined;
  setChunkBlob(scope: SemanticPath, chunkId: string, blob: EncryptedBlob, scopeSecret: string): void;
  clearScopeChunkCache(scopeKey: string): void;
  ensureTargetFresh(targetKey: string, visiting?: Set<string>): boolean;
  tryEvaluateAssignExpression(evalScopePath: SemanticPath, expr: string): { ok: true; value: number | boolean } | { ok: false };
  registerDerivation(targetPath: SemanticPath, evalScope: SemanticPath, expr: string): void;
  clearDerivationsByPrefix(prefixPath: SemanticPath): void;
  invalidateFromPath(path: SemanticPath): void;
  commitMemoryOnly(targetPath: SemanticPath, operator: string | null, expression: any, value: any): KernelMemory;
  commitValueMapping(targetPath: SemanticPath, expression: any, operator?: string | null): KernelMemory;
  commitMapping(instruction: MappingInstruction, fallbackOperator?: string | null): KernelMemory | undefined;
  applyMemoryToIndex(memory: KernelMemory): void;
  removeIndexPrefix(prefixPath: SemanticPath): void;
  rebuildIndex(): void;
  resolveIndexPointerPath(path: SemanticPath, maxHops?: number): { path: SemanticPath; raw: any };
  parseFilterExpression(expr: string): { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string } | null;
  parseLogicalFilterExpression(expr: string): {
    clauses: Array<{ left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }>;
    ops: Array<"&&" | "||">;
  } | null;
  compareValues(left: any, op: ">" | "<" | ">=" | "<=" | "==" | "!=", right: any): boolean;
  parseLiteralOrPath(raw: string): { kind: "literal"; value: any } | { kind: "path"; parts: SemanticPath };
  resolveRelativeFirst(scope: SemanticPath, parts: SemanticPath): any;
  evaluateFilterClauseForScope(
    scope: SemanticPath,
    clause: { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string },
  ): boolean;
  evaluateLogicalFilterForScope(scope: SemanticPath, expr: string): boolean;
  collectChildrenForPrefix(prefix: SemanticPath): string[];
  parseSelectorSegment(segment: string): { base: string; selector: string } | null;
  parseSelectorKeys(selector: string): string[] | null;
  parseTransformSelector(selector: string): { varName: string; expr: string } | null;
  evaluateTransformPath(path: SemanticPath): any;
  evaluateSelectionPath(path: SemanticPath): any;
  buildPublicSubtree(prefix: SemanticPath): any;
  evaluateFilterPath(path: SemanticPath): any;
  pathContainsFilterSelector(path: SemanticPath): boolean;
  collectFilteredScopes(path: SemanticPath): SemanticPath[];
  pathContainsIterator(path: SemanticPath): boolean;
  substituteIteratorInPath(path: SemanticPath, indexValue: string): SemanticPath;
  substituteIteratorInExpression(expr: string, indexValue: string): string;
  collectIteratorIndices(path: SemanticPath): string[];
  extractExpressionRefs(expr: string): string[];
  resolveRefPath(label: string, evalScope: SemanticPath): string | null;
  unregisterDerivation(targetKey: string): void;
  getRefVersion(refPath: string): number;
  bumpRefVersion(refPath: string): void;
  snapshotDerivationRefVersions(targetKey: string): void;
  recomputeTarget(targetKey: string): boolean;
  isDerivationVersionStale(targetKey: string): boolean;
  removeSubtree(targetPath: SemanticPath): void;
}
