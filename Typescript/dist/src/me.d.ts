import { exportP256PublicKey, generateP256KeyPair, importP256PublicKey } from './crypto.js';
import { EncryptedBranchPlane, MEOptions, MEVectorIndexBuildOptions, MEVectorIndexBuildResult, MEVectorSearchOptions, MEVectorSearchResult, MESearchExactOptions, MESearchExactResult, MEProofInput, MEProofResult, MESnapshot, MESnapshotInput, MeTargetAst, Memory, ReplayMemoryInput, P256PublicKeyCoordinates, SemanticPath, WrappedSecretClass, WrappedSecretPolicy, WrappedSecretV1 } from './types.js';
export type { MEProxy } from './types.js';
/**
 * The `.me` Semantic Kernel.
 *
 * This is the core class of `.me`. When you do `new ME(seed?)`, you get much more than
 * a normal class instance:
 *
 * - a stateful semantic kernel that manages memories, indexes, secrets, and derivations
 * - a callable proxy that lets you interact with infinite semantic paths like
 *   `me.profile.name("Jose")`, `me("profile.name")`, or `me.wallet["_"]("key")`
 *
 * Important:
 *
 * - this generated page only shows the explicit class API documented below
 * - the main user experience is the callable proxy / DSL, documented in
 *   [Runtime Surface](/Runtime-Surface),
 *   [Proxy Calls](/Proxy-Calls),
 *   [Operators](/Operators), and
 *   [Syntax](/Syntax)
 */
export declare class ME {
    #private;
    [key: string]: any;
    private static readonly RUNTIME_ESCAPE_TOKEN;
    /** @internal Low-level crypto helper kept out of the main public docs surface. */
    static generateP256KeyPair: typeof generateP256KeyPair;
    /** @internal Low-level crypto helper kept out of the main public docs surface. */
    static exportP256PublicKey: typeof exportP256PublicKey;
    /** @internal Low-level crypto helper kept out of the main public docs surface. */
    static importP256PublicKey: typeof importP256PublicKey;
    /** @internal Low-level crypto helper kept out of the main public docs surface. */
    static wrapSecretV1(input: {
        secret: Uint8Array | string;
        recipientPublicKey: CryptoKey | P256PublicKeyCoordinates;
        kid: string;
        class: WrappedSecretClass;
        publicKey?: P256PublicKeyCoordinates;
        policy?: WrappedSecretPolicy;
    }): Promise<WrappedSecretV1>;
    /** @internal Low-level crypto helper kept out of the main public docs surface. */
    static unwrapSecretV1(envelope: WrappedSecretV1, recipientPrivateKey: CryptoKey, output?: "bytes" | "utf8"): Promise<Uint8Array | string>;
    private localSecrets;
    private localNoises;
    private branchStore;
    private secretBlobVersion;
    private keySpaces;
    private recipientKeyring;
    private index;
    private _memories;
    private derivations;
    private refSubscribers;
    private recomputeMode;
    private refVersions;
    private derivationRefVersions;
    private staleDerivations;
    private lastRecomputeWaveByTarget;
    private activeRecomputeWave;
    private secretEpoch;
    private scopeCache;
    private effectiveSecretCache;
    private decryptedBranchCache;
    private writeBranchCache;
    private decryptedValueCache;
    private v3KeyCache;
    private vectorIndexes;
    private readonly secretChunkSize;
    private readonly secretHashBuckets;
    private readonly unsafeEval;
    private operators;
    _ownerScope: string | null;
    _currentCallerScope: string | null | undefined;
    /**
     * Public redacted memory log.
     * This never exposes internal forensic fields such as `effectiveSecret`.
     */
    get memories(): Memory[];
    get encryptedBranches(): EncryptedBranchPlane;
    set encryptedBranches(value: EncryptedBranchPlane);
    constructor(seed?: string, options?: MEOptions);
    /**
     * Inspect the current runtime state.
     * Returned memories are always public/redacted.
     */
    inspect(opts?: {
        last?: number;
    }): import('./types.js').MEInspectResult;
    /**
     * Explain how a semantic path is derived.
     * Useful for debugging pointers, operators, and derived values.
     */
    explain(path: string): import('./types.js').MEExplainResult;
    /**
     * Execute a raw target string or parsed target AST without going through proxy property access.
     * Useful for tooling, explicit runtime dispatch, and tests.
     */
    execute(rawTarget: string | MeTargetAst, body?: any): any;
    /**
     * Exact vector search over a collection-scoped secret branch backed by chunked columnar storage.
     * This is the correctness baseline used before approximate indexes such as IVF.
     */
    searchExact(scopePath: string | SemanticPath, query: ArrayLike<number>, options?: MESearchExactOptions): MESearchExactResult;
    /**
     * Build an approximate IVF sidecar for a collection-scoped secret vector corpus.
     * The sidecar lives outside the kernel log and is intended to reduce chunk decrypts during search.
     */
    buildVectorIndex(scopePath: string | SemanticPath, options?: MEVectorIndexBuildOptions): MEVectorIndexBuildResult;
    /**
     * Approximate vector search backed by the IVF sidecar.
     * Uses centroids for coarse routing and exact scan only on the selected candidate chunks.
     */
    searchVector(scopePath: string | SemanticPath, query: ArrayLike<number>, options?: MEVectorSearchOptions): MEVectorSearchResult;
    private cloneValue;
    private handleSelfTarget;
    private handleKernelTarget;
    private handleKernelRead;
    private handleKernelExport;
    private handleKernelImport;
    private handleKernelReplay;
    private handleKernelRehydrate;
    private handleKernelGet;
    private handleKernelSet;
    private handleKeySpaceTarget;
    private inspectAtPath;
    private parseKeySpacePath;
    private readWrappedKey;
    private writeWrappedKey;
    private openWrappedKey;
    private normalizeExecutableTarget;
    private parseExecutableTarget;
    private splitTargetNamespace;
    private normalizeExecutablePath;
    private findTopLevelIndex;
    /**
     * Export a portable public snapshot.
     * Snapshot memories are redacted and omit internal forensic fields.
     */
    exportSnapshot(): MESnapshot;
    /**
     * Hydrate the runtime from a snapshot payload.
     * This is the primary restore API for bringing a saved kernel back to life in memory.
     */
    hydrate(snapshot: MESnapshotInput): void;
    /**
     * Import a snapshot into the current runtime.
     * Accepts both redacted public snapshots and legacy/internal payloads.
     * Prefer `hydrate()` in user-facing code.
     */
    importSnapshot(snapshot: MESnapshotInput): void;
    /**
     * Rehydrate the runtime from a snapshot payload.
     * Backward-compatible alias for `hydrate()`.
     */
    rehydrate(snapshot: MESnapshotInput): void;
    /**
     * Replay a memory log into the current runtime.
     * Accepts both public `Memory[]` and legacy/internal memory payloads.
     */
    replayMemories(memories: ReplayMemoryInput[]): void;
    /**
     * Ingest a single memory-like payload into the runtime.
     * Useful for tools that already operate at the memory-log layer.
     */
    learn(memory: unknown): void;
    /**
     * Derive a branch-scoped proof for the current active expression.
     * This signs a canonical payload with an Ed25519 key deterministically derived
     * from the root seed and active branch expression.
     */
    prove(input: MEProofInput): Promise<MEProofResult>;
    /**
     * Control whether derivations recompute eagerly or lazily.
     */
    setRecomputeMode(mode: "eager" | "lazy"): this;
    /**
     * Read the current derivation recompute mode.
     */
    getRecomputeMode(): "eager" | "lazy";
    /** @internal Low-level keyring helper kept out of the main public docs surface. */
    installRecipientKey(recipientKeyId: string, privateKey: CryptoKey): this;
    /** @internal Low-level keyring helper kept out of the main public docs surface. */
    uninstallRecipientKey(recipientKeyId: string): this;
    /** @internal Low-level keyring helper kept out of the main public docs surface. */
    storeWrappedKey(keyId: string, envelope: WrappedSecretV1, options?: {
        recipientKeyId?: string;
    }): this;
    /**
     * Re-encrypt existing secret branch chunks into blob v3.
     * This remains useful after v3 became the default write path because older snapshots
     * and mixed runtimes may still carry branch blobs in v2 or legacy layouts.
     * It only touches `encryptedBranches`; it never rewrites historical memories.
     *
     * @internal Maintenance helper for secret-blob upgrades.
     */
    migrateEncryptedBranchesToV3(): {
        migratedScopes: number;
        migratedChunks: number;
        skipped: number;
        errors: number;
    };
    private bumpSecretEpoch;
    private normalizeArgs;
    /**
     * Internal escape hatch for tests and controlled rollback verification.
     * Not part of the public runtime surface.
     */
    private setSecretBlobVersionForTesting;
    private opKind;
    private isSecretScopeCall;
    private isNoiseScopeCall;
    private isPointerCall;
    private isIdentityCall;
    private isEvalCall;
    private isQueryCall;
    private isDefineOpCall;
    private getPrevMemoryHash;
    private extractExpressionRefs;
    private resolveRefPath;
    private unregisterDerivation;
    private getRefVersion;
    private bumpRefVersion;
    private snapshotDerivationRefVersions;
    private registerDerivation;
    private recomputeTarget;
    private isDerivationVersionStale;
    private ensureTargetFresh;
    private invalidateFromPath;
    private clearDerivationsByPrefix;
    private commitMemoryOnly;
    private commitValueMapping;
    /**
     * @internal Escape hatch for controlled benchmarks that need the real batch writer
     * without going through the semantic proxy surface.
     */
    private _commitIndexedBatch;
    /**
     * @internal Benchmark hook: enable per-persist sizing metrics without routing
     * through the semantic proxy plane.
     */
    private _enablePersistSecretBranchDebug;
    /**
     * @internal Benchmark hook: drain the current persistSecretBranch window.
     */
    private _takePersistSecretBranchDebugWindow;
    /**
     * @internal Benchmark hook: configure the write-path chunk cache used only by
     * mutation flows. Disabled by default.
     */
    private _configureWriteBranchCache;
    /**
     * @internal Benchmark hook: enable blob crypto allocation telemetry.
     */
    private _enableBlobCryptoDebug;
    /**
     * @internal Benchmark hook: drain the current blob crypto telemetry window.
     */
    private _takeBlobCryptoDebugWindow;
    /**
     * @internal Benchmark hook: enable DiskStore serialization/allocation telemetry.
     */
    private _enableDiskStoreDebug;
    /**
     * @internal Benchmark hook: drain the current DiskStore telemetry window.
     */
    private _takeDiskStoreDebugWindow;
    /**
     * @internal Benchmark hook: enable getDecryptedChunk cache/decrypt metrics.
     */
    private _enableDecryptedChunkDebug;
    /**
     * @internal Benchmark hook: drain the current getDecryptedChunk window.
     */
    private _takeDecryptedChunkDebugWindow;
    private commitMapping;
    private tryResolveEvalTokenValue;
    private tokenizeEvalExpression;
    private tryEvaluateAssignExpression;
    private postulate;
    private removeSubtree;
    private computeEffectiveSecret;
    private applyMemoryToIndex;
    private removeIndexPrefix;
    private rebuildIndex;
    private getIndex;
    private setIndex;
    private resolveIndexPointerPath;
    private chunkCacheKey;
    private clearScopeChunkCache;
    private getChunkId;
    private setAtPath;
    private flattenLeaves;
    private migrateLegacyScopeToChunks;
    private ensureScopeChunks;
    private getChunkBlob;
    private setChunkBlob;
    private getDecryptedChunk;
    private resolveBranchScope;
    private normalizeSelectorPath;
    private pathContainsIterator;
    private substituteIteratorInPath;
    private substituteIteratorInExpression;
    private collectIteratorIndices;
    private parseFilterExpression;
    private parseLogicalFilterExpression;
    private compareValues;
    private parseLiteralOrPath;
    private resolveRelativeFirst;
    private evaluateFilterClauseForScope;
    private evaluateLogicalFilterForScope;
    private collectChildrenForPrefix;
    private parseSelectorSegment;
    private parseSelectorKeys;
    private parseTransformSelector;
    private evaluateTransformPath;
    private evaluateSelectionPath;
    private buildPublicSubtree;
    private evaluateFilterPath;
    private pathContainsFilterSelector;
    private collectFilteredScopes;
    private isStealthBlocked;
    private readPath;
    as(scope: string | null): ME;
    withScope<T>(scope: string | null, fn: () => T): T;
    private isRemoveCall;
    private createProxy;
    private describeRuntimeMethod;
    private buildRuntimeSurface;
    private createRuntimeProxy;
    private describeRuntimeSurface;
    private resolveRuntimeValue;
}
