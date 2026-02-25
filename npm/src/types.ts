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
 * Canonical semantic log item in ME.
 * This mirrors the shape in `me.ts` exactly.
 */
export interface Thought {
  /** semantic destination path (where the write/claim lands). root is "" */
  path: string;
  /** operator used to produce this thought (null for normal writes) */
  operator: string | null;
  /** expression as provided by the user (pre-eval / pre-resolve). */
  expression: any;
  /** value that was actually committed at `path` (post-eval / post-collect; may be encrypted) */
  value: any;
  /** computed by ME kernel (fractal secret chaining + noise override) */
  effectiveSecret: string;
  /** portable hash (FNV-1a 32-bit in me.ts) */
  hash: string;
  /** previous thought hash for chain integrity (genesis = "") */
  prevHash?: string;
  timestamp: number;
}
// -----------------------------
// Structural marker values
// -----------------------------
export type MePointer = { __ptr: string };
export type MeIdentityRef = { __id: string };
export type MeMarker = MePointer | MeIdentityRef;
export type EncryptedBlob = `0x${string}`;
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
       * If operator is producing a semantic thought, what should be recorded as `operator`.
       * (me.ts uses "__" for both "__" and "->" pointer calls).
       */
      thoughtOperator?: string;
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
  shortTermMemory?: Thought[];
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
   * Append a thought to shortTermMemory and rebuild index.
   * Operators that are “kernel-only” should avoid emitting thoughts.
   */
  commitThought?(t: Thought): void;

  /**
   * Remove a subtree: deletes matching localSecrets/localNoises/encryptedBranches and emits a "-" thought.
   */
  removeSubtree(targetPath: SemanticPath): void;

  /**
   * For ops that need username normalization.
   */
  normalizeAndValidateUsername(input: string): string;

  /**
   * Portable hash function used to populate Thought.hash
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
 * - a Thought (most writes)
 * - undefined (kernel-only or removals)
 * - a returned value for root "=" thunk and root "?" query
 */
export type OperatorResult = Thought | any | undefined;

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
   * - write thoughts / encrypt branches / update secrets/noises
   * - return a value (root eval/query) or a Thought
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
   * Secret/noise declarations must not leak their raw string in Thought.
   * me.ts records expression/value as "***" for those operator thoughts.
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
   * And emits a "-" thought.
   */
  removeIsDeep: true,

  /**
   * Operator define ("+") is kernel-only:
   * - Only at root
   * - Updates operator registry
   * - Emits NO thought
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
