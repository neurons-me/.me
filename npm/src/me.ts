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
import {
  detectBlobVersion,
  enableBlobCryptoDebug,
  encryptBlobV3,
  exportP256PublicKey,
  generateP256KeyPair,
  importP256PublicKey,
  takeBlobCryptoDebugWindow,
  unwrapSecretV1,
  wrapSecretV1,
} from "./crypto.js";
import * as Core from "./core.js";
import * as Derivation from "./derivation.js";
import * as Evaluator from "./evaluator.js";
import { createInitialKernelFields } from "./kernel-state.js";
import { toPublicMemories } from "./memory-redaction.js";
import {
  isDefineOpCall,
  isEvalCall,
  isIdentityCall,
  isNoiseScopeCall,
  isPointerCall,
  isQueryCall,
  isRemoveCall,
  isSecretScopeCall,
  opKind,
} from "./operators.js";
import * as ProxyRuntime from "./proxy.js";
import * as Secret from "./secret.js";
import { collectSecretChainV3 } from "./secret-context.js";
import { enableDiskStoreDebug, takeDiskStoreDebugWindow } from "./instance-store.js";
import type {
  EncryptedBlob,
  EncryptedBranchPlane,
  KernelMemory,
  MappingInstruction,
  MEBranchScopeCacheEntry,
  MEBlobV3KeyCacheEntry,
  MEDecryptedBranchCacheEntry,
  MEDecryptedValueCacheEntry,
  MEDerivationRecord,
  MEEffectiveSecretCacheEntry,
  MEKernelLike,
  MEOptions,
  MEProxy,
  MESnapshot,
  MESnapshotInput,
  MeTargetAst,
  Memory,
  OperatorRegistry,
  ReplayMemoryInput,
  P256PublicKeyCoordinates,
  SemanticPath,
  StoredWrappedKey,
  WrappedSecretClass,
  WrappedSecretPolicy,
  WrappedSecretV1,
} from "./types.js";
import * as Utils from "./utils.js";

export type { MEProxy } from "./types.js";

/**
 * The `.me` Semantic Kernel.
 *
 * This is the core class of `.me`. When you do `new ME()`, you get much more than
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
export class ME {
  [key: string]: any;
  private static readonly RUNTIME_ESCAPE_TOKEN = ProxyRuntime.RUNTIME_ESCAPE_TOKEN;

  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static generateP256KeyPair = generateP256KeyPair;
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static exportP256PublicKey = exportP256PublicKey;
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static importP256PublicKey = importP256PublicKey;
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
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
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static unwrapSecretV1(
    envelope: WrappedSecretV1,
    recipientPrivateKey: CryptoKey,
    output: "bytes" | "utf8" = "bytes",
  ): Promise<Uint8Array | string> {
    return unwrapSecretV1(envelope, recipientPrivateKey, output);
  }

  private localSecrets!: Record<string, string>;
  private localNoises!: Record<string, string>;
  private branchStore!: NonNullable<MEOptions["store"]>;
  private secretBlobVersion!: "v2" | "v3";
  private keySpaces!: Record<string, StoredWrappedKey>;
  private recipientKeyring!: Record<string, CryptoKey>;
  private index!: Record<string, any>;
  private _memories!: KernelMemory[];
  private derivations!: Record<string, MEDerivationRecord>;
  private refSubscribers!: Record<string, string[]>;
  private recomputeMode!: "eager" | "lazy";
  private refVersions!: Record<string, number>;
  private derivationRefVersions!: Record<string, Record<string, number>>;
  private staleDerivations!: Set<string>;
  private secretEpoch!: number;
  private scopeCache!: Map<string, MEBranchScopeCacheEntry>;
  private effectiveSecretCache!: Map<string, MEEffectiveSecretCacheEntry>;
  private decryptedBranchCache!: Map<string, MEDecryptedBranchCacheEntry>;
  private writeBranchCache!: Map<string, MEDecryptedBranchCacheEntry>;
  private decryptedValueCache!: Map<string, MEDecryptedValueCacheEntry>;
  private v3KeyCache!: Map<string, MEBlobV3KeyCacheEntry>;
  private readonly secretChunkSize!: number;
  private readonly secretHashBuckets!: number;
  private readonly unsafeEval!: boolean;
  private operators!: Record<string, { kind: string }>;
  _ownerScope: string | null = null;
  _currentCallerScope: string | null | undefined = undefined;

  /**
   * Public redacted memory log.
   * This never exposes internal forensic fields such as `effectiveSecret`.
   */
  get memories(): Memory[] {
    return toPublicMemories(this._memories);
  }

  get encryptedBranches(): EncryptedBranchPlane {
    return this.branchStore.view();
  }

  set encryptedBranches(value: EncryptedBranchPlane) {
    this.branchStore.importData(value && typeof value === "object" ? value : {});
  }

  constructor(expression?: any, options: MEOptions = {}) {
    Object.assign(this, createInitialKernelFields(options));
    this.bumpSecretEpoch();
    if (expression !== undefined) {
      this.postulate([], expression);
    }
    this.rebuildIndex();
    const rootProxy = this.createProxy([]);
    Object.setPrototypeOf(rootProxy as any, ME.prototype);
    Object.assign(rootProxy as any, this);
    return rootProxy as unknown as ME;
  }

  /**
   * Inspect the current runtime state.
   * Returned memories are always public/redacted.
   */
  inspect(opts?: { last?: number }) {
    return Core.inspect(this as unknown as MEKernelLike, opts);
  }

  /**
   * Explain how a semantic path is derived.
   * Useful for debugging pointers, operators, and derived values.
   */
  explain(path: string) {
    return Derivation.explain(this as unknown as MEKernelLike, path);
  }

  /**
   * Execute a raw target string or parsed target AST without going through proxy property access.
   * Useful for tooling, explicit runtime dispatch, and tests.
   */
  execute(rawTarget: string | MeTargetAst, body?: any): any {
    return Core.execute(this as unknown as MEKernelLike, rawTarget, body);
  }

  private cloneValue<T>(value: T): T {
    return Utils.cloneValue(value);
  }

  private handleSelfTarget(operation: string, rawPath: string, body?: any): any {
    return Core.handleSelfTarget(this as unknown as MEKernelLike, operation, rawPath, body);
  }

  private handleKernelTarget(operation: string, rawPath: string, body?: any): any {
    return Core.handleKernelTarget(this as unknown as MEKernelLike, operation, rawPath, body);
  }

  private handleKernelRead(key: string): any {
    return Core.handleKernelRead(this as unknown as MEKernelLike, key);
  }

  private handleKernelExport(key: string): any {
    return Core.handleKernelExport(this as unknown as MEKernelLike, key);
  }

  private handleKernelImport(key: string, body: any): any {
    return Core.handleKernelImport(this as unknown as MEKernelLike, key, body);
  }

  private handleKernelReplay(key: string, body: any): any {
    return Core.handleKernelReplay(this as unknown as MEKernelLike, key, body);
  }

  private handleKernelRehydrate(key: string, body: any): any {
    return Core.handleKernelRehydrate(this as unknown as MEKernelLike, key, body);
  }

  private handleKernelGet(key: string): any {
    return Core.handleKernelGet(this as unknown as MEKernelLike, key);
  }

  private handleKernelSet(key: string, body: any): any {
    return Core.handleKernelSet(this as unknown as MEKernelLike, key, body);
  }

  private handleKeySpaceTarget(operation: string, keyId: string | null, body?: any): any {
    return Core.handleKeySpaceTarget(this as unknown as MEKernelLike, operation, keyId, body);
  }

  private inspectAtPath(scopeKey: string) {
    return Core.inspectAtPath(this as unknown as MEKernelLike, scopeKey);
  }

  private parseKeySpacePath(rawPath: string): { isKeySpace: boolean; keyId: string | null } {
    return Core.parseKeySpacePath(rawPath);
  }

  private readWrappedKey(keyId: string): WrappedSecretV1 {
    return Core.readWrappedKey(this as unknown as MEKernelLike, keyId);
  }

  private writeWrappedKey(keyId: string, body: any): WrappedSecretV1 {
    return Core.writeWrappedKey(this as unknown as MEKernelLike, keyId, body);
  }

  private openWrappedKey(
    keyId: string,
    body?: { recipientKeyId?: string; recipientPrivateKey?: CryptoKey; output?: "bytes" | "utf8" },
  ): Promise<Uint8Array | string> {
    return Core.openWrappedKey(this as unknown as MEKernelLike, keyId, body);
  }

  private normalizeExecutableTarget(rawTarget: string | MeTargetAst): MeTargetAst {
    return Core.normalizeExecutableTarget(this as unknown as MEKernelLike, rawTarget);
  }

  private parseExecutableTarget(rawTarget: string): MeTargetAst {
    return Core.parseExecutableTarget(rawTarget);
  }

  private splitTargetNamespace(
    namespaceWithContext: string,
    rawTarget: string,
  ): { namespace: string; contextRaw: string | null } {
    return Core.splitTargetNamespace(namespaceWithContext, rawTarget);
  }

  private normalizeExecutablePath(rawPath: string): { key: string; parts: SemanticPath } {
    return Core.normalizeExecutablePath(rawPath);
  }

  private findTopLevelIndex(input: string, needle: string): number {
    return Utils.findTopLevelIndex(input, needle);
  }

  /**
   * Export a portable public snapshot.
   * Snapshot memories are redacted and omit internal forensic fields.
   */
  exportSnapshot(): MESnapshot {
    return Core.exportSnapshot(this as unknown as MEKernelLike);
  }

  /**
   * Import a snapshot into the current runtime.
   * Accepts both redacted public snapshots and legacy/internal payloads.
   */
  importSnapshot(snapshot: MESnapshotInput): void {
    return Core.importSnapshot(this as unknown as MEKernelLike, snapshot);
  }

  /**
   * Rehydrate the runtime from a snapshot payload.
   * This is a hydration-oriented alias over the import flow.
   */
  rehydrate(snapshot: MESnapshotInput): void {
    return Core.rehydrate(this as unknown as MEKernelLike, snapshot);
  }

  /**
   * Replay a memory log into the current runtime.
   * Accepts both public `Memory[]` and legacy/internal memory payloads.
   */
  replayMemories(memories: ReplayMemoryInput[]): void {
    return Core.replayMemories(this as unknown as MEKernelLike, memories);
  }

  /**
   * Ingest a single memory-like payload into the runtime.
   * Useful for tools that already operate at the memory-log layer.
   */
  learn(memory: unknown): void {
    return Core.learn(this as unknown as MEKernelLike, memory);
  }

  /**
   * Control whether derivations recompute eagerly or lazily.
   */
  setRecomputeMode(mode: "eager" | "lazy"): this {
    return Core.setRecomputeMode(this as unknown as MEKernelLike, mode) as unknown as this;
  }

  /**
   * Read the current derivation recompute mode.
   */
  getRecomputeMode(): "eager" | "lazy" {
    return Core.getRecomputeMode(this as unknown as MEKernelLike);
  }

  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  installRecipientKey(recipientKeyId: string, privateKey: CryptoKey): this {
    return Core.installRecipientKey(this as unknown as MEKernelLike, recipientKeyId, privateKey) as unknown as this;
  }

  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  uninstallRecipientKey(recipientKeyId: string): this {
    return Core.uninstallRecipientKey(this as unknown as MEKernelLike, recipientKeyId) as unknown as this;
  }

  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  storeWrappedKey(keyId: string, envelope: WrappedSecretV1, options?: { recipientKeyId?: string }): this {
    return Core.storeWrappedKey(this as unknown as MEKernelLike, keyId, envelope, options) as unknown as this;
  }

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
  } {
    const report = {
      migratedScopes: 0,
      migratedChunks: 0,
      skipped: 0,
      errors: 0,
    };

    for (const scopeKey of this.branchStore.listScopes()) {
      const scope = scopeKey.split(".").filter(Boolean);
      const scopeSecret = this.computeEffectiveSecret(scope);
      if (!scopeSecret) {
        report.skipped++;
        continue;
      }

      let migratedInScope = 0;
      try {
        const chunks = this.ensureScopeChunks(scope, scopeSecret);
        const chain = collectSecretChainV3(this as unknown as MEKernelLike, scope, "branch");
        for (const [chunkId, blob] of Object.entries(chunks)) {
          if (detectBlobVersion(blob as EncryptedBlob) === "v3") {
            report.skipped++;
            continue;
          }

          const data = this.getDecryptedChunk(scope, scopeSecret, chunkId);
          if (!data || typeof data !== "object") {
            report.errors++;
            continue;
          }

          this.setChunkBlob(scope, chunkId, encryptBlobV3(data, chain, "branch", scope), scopeSecret);
          migratedInScope++;
          report.migratedChunks++;
        }
      } catch {
        report.errors++;
      } finally {
        this.clearScopeChunkCache(scopeKey);
      }

      if (migratedInScope > 0) {
        report.migratedScopes++;
      }
    }

    return report;
  }

  private bumpSecretEpoch(): void {
    return Secret.bumpSecretEpoch(this as unknown as MEKernelLike);
  }

  private normalizeArgs(args: any[]): any {
    return ProxyRuntime.normalizeArgs(args);
  }

  /**
   * Internal escape hatch for tests and controlled rollback verification.
   * Not part of the public runtime surface.
   */
  private setSecretBlobVersionForTesting(version: "v2" | "v3"): void {
    this.secretBlobVersion = version;
  }

  private opKind(op: string): string | null {
    return opKind(this.operators as OperatorRegistry, op);
  }

  private isSecretScopeCall(path: SemanticPath, expression: any): { scopeKey: string } | null {
    return isSecretScopeCall(this.operators as OperatorRegistry, path, expression);
  }

  private isNoiseScopeCall(path: SemanticPath, expression: any): { scopeKey: string } | null {
    return isNoiseScopeCall(this.operators as OperatorRegistry, path, expression);
  }

  private isPointerCall(path: SemanticPath, expression: any): { targetPath: string } | null {
    return isPointerCall(this.operators as OperatorRegistry, path, expression);
  }

  private isIdentityCall(path: SemanticPath, expression: any): { id: string; targetPath: SemanticPath } | null {
    return isIdentityCall(this.operators as OperatorRegistry, path, expression);
  }

  private isEvalCall(path: SemanticPath, expression: any) {
    return isEvalCall(this.operators as OperatorRegistry, path, expression);
  }

  private isQueryCall(path: SemanticPath, expression: any) {
    return isQueryCall(this.operators as OperatorRegistry, path, expression);
  }

  private isDefineOpCall(path: SemanticPath, expression: any): { op: string; kind: string } | null {
    return isDefineOpCall(path, expression);
  }

  private getPrevMemoryHash(): string {
    return Utils.getPrevMemoryHash(this as unknown as MEKernelLike);
  }

  private extractExpressionRefs(expr: string): string[] {
    return Derivation.extractExpressionRefs(expr);
  }

  private resolveRefPath(label: string, evalScope: SemanticPath): string | null {
    return Derivation.resolveRefPath(this as unknown as MEKernelLike, label, evalScope);
  }

  private unregisterDerivation(targetKey: string): void {
    return Derivation.unregisterDerivation(this as unknown as MEKernelLike, targetKey);
  }

  private getRefVersion(refPath: string): number {
    return Derivation.getRefVersion(this as unknown as MEKernelLike, refPath);
  }

  private bumpRefVersion(refPath: string): void {
    return Derivation.bumpRefVersion(this as unknown as MEKernelLike, refPath);
  }

  private snapshotDerivationRefVersions(targetKey: string): void {
    return Derivation.snapshotDerivationRefVersions(this as unknown as MEKernelLike, targetKey);
  }

  private registerDerivation(targetPath: SemanticPath, evalScope: SemanticPath, expr: string): void {
    return Derivation.registerDerivation(this as unknown as MEKernelLike, targetPath, evalScope, expr);
  }

  private recomputeTarget(targetKey: string): boolean {
    return Derivation.recomputeTarget(this as unknown as MEKernelLike, targetKey);
  }

  private isDerivationVersionStale(targetKey: string): boolean {
    return Derivation.isDerivationVersionStale(this as unknown as MEKernelLike, targetKey);
  }

  private ensureTargetFresh(targetKey: string, visiting: Set<string> = new Set()): boolean {
    return Derivation.ensureTargetFresh(this as unknown as MEKernelLike, targetKey, visiting);
  }

  private invalidateFromPath(path: SemanticPath): void {
    return Derivation.invalidateFromPath(this as unknown as MEKernelLike, path);
  }

  private clearDerivationsByPrefix(prefixPath: SemanticPath): void {
    return Derivation.clearDerivationsByPrefix(this as unknown as MEKernelLike, prefixPath);
  }

  private commitMemoryOnly(
    targetPath: SemanticPath,
    operator: string | null,
    expression: any,
    value: any,
  ): KernelMemory {
    return Core.commitMemoryOnly(this as unknown as MEKernelLike, targetPath, operator, expression, value);
  }

  private commitValueMapping(
    targetPath: SemanticPath,
    expression: any,
    operator: string | null = null,
  ): KernelMemory {
    return Core.commitValueMapping(this as unknown as MEKernelLike, targetPath, expression, operator);
  }

  /**
   * @internal Escape hatch for controlled benchmarks that need the real batch writer
   * without going through the semantic proxy surface.
   */
  private _commitIndexedBatch(
    basePath: SemanticPath,
    startIndex: number,
    items: any[],
    operator: string | null = null,
  ): KernelMemory[] {
    return Core.commitIndexedBatch(this as unknown as MEKernelLike, basePath, startIndex, items, operator);
  }

  /**
   * @internal Benchmark hook: enable per-persist sizing metrics without routing
   * through the semantic proxy plane.
   */
  private _enablePersistSecretBranchDebug(enabled = true): this {
    (this as any).__persistSecretBranchDebug = {
      enabled,
      window: {
        writes: 0,
        columnarWrites: 0,
        maxBranchBytes: 0,
        maxCacheSeedBytes: 0,
        maxEncryptableBytes: 0,
        maxBlobBytes: 0,
        totalLoadChunkMs: 0,
        totalMaterializeMs: 0,
        totalCloneMs: 0,
        totalColumnarMaterializeMs: 0,
        totalPrepareColumnarMs: 0,
        totalKeyDeriveMs: 0,
        totalEncryptMs: 0,
        totalSetBlobMs: 0,
        maxLoadChunkMs: 0,
        maxMaterializeMs: 0,
        maxCloneMs: 0,
        maxColumnarMaterializeMs: 0,
        maxPrepareColumnarMs: 0,
        maxKeyDeriveMs: 0,
        maxEncryptMs: 0,
        maxSetBlobMs: 0,
        writeCacheHits: 0,
        writeCacheMisses: 0,
        totalWriteCacheHitMs: 0,
        maxWriteCacheHitMs: 0,
      },
    };
    return this;
  }

  /**
   * @internal Benchmark hook: drain the current persistSecretBranch window.
   */
  private _takePersistSecretBranchDebugWindow(): {
    writes: number;
    columnarWrites: number;
    maxBranchBytes: number;
    maxCacheSeedBytes: number;
    maxEncryptableBytes: number;
    maxBlobBytes: number;
    totalLoadChunkMs: number;
    totalMaterializeMs: number;
    totalCloneMs: number;
    totalColumnarMaterializeMs: number;
    totalPrepareColumnarMs: number;
    totalKeyDeriveMs: number;
    totalEncryptMs: number;
    totalSetBlobMs: number;
    maxLoadChunkMs: number;
    maxMaterializeMs: number;
    maxCloneMs: number;
    maxColumnarMaterializeMs: number;
    maxPrepareColumnarMs: number;
    maxKeyDeriveMs: number;
    maxEncryptMs: number;
    maxSetBlobMs: number;
    writeCacheHits: number;
    writeCacheMisses: number;
    totalWriteCacheHitMs: number;
    maxWriteCacheHitMs: number;
  } {
    const empty = {
      writes: 0,
      columnarWrites: 0,
      maxBranchBytes: 0,
      maxCacheSeedBytes: 0,
      maxEncryptableBytes: 0,
      maxBlobBytes: 0,
      totalLoadChunkMs: 0,
      totalMaterializeMs: 0,
      totalCloneMs: 0,
      totalColumnarMaterializeMs: 0,
      totalPrepareColumnarMs: 0,
      totalKeyDeriveMs: 0,
      totalEncryptMs: 0,
      totalSetBlobMs: 0,
      maxLoadChunkMs: 0,
      maxMaterializeMs: 0,
      maxCloneMs: 0,
      maxColumnarMaterializeMs: 0,
      maxPrepareColumnarMs: 0,
      maxKeyDeriveMs: 0,
      maxEncryptMs: 0,
      maxSetBlobMs: 0,
      writeCacheHits: 0,
      writeCacheMisses: 0,
      totalWriteCacheHitMs: 0,
      maxWriteCacheHitMs: 0,
    };
    const debug = (this as any).__persistSecretBranchDebug;
    const window = debug?.window ? { ...debug.window } : empty;
    if (debug) debug.window = { ...empty };
    return window;
  }

  /**
   * @internal Benchmark hook: configure the write-path chunk cache used only by
   * mutation flows. Disabled by default.
   */
  private _configureWriteBranchCache(enabled = true, limit = 8): this {
    (this as any).__writeBranchCacheConfig = {
      enabled,
      limit: Math.max(1, Math.floor(limit || 1)),
    };
    if (!enabled) {
      this.writeBranchCache.clear();
    }
    return this;
  }

  /**
   * @internal Benchmark hook: enable blob crypto allocation telemetry.
   */
  private _enableBlobCryptoDebug(enabled = true): this {
    enableBlobCryptoDebug(enabled);
    return this;
  }

  /**
   * @internal Benchmark hook: drain the current blob crypto telemetry window.
   */
  private _takeBlobCryptoDebugWindow(): {
    encryptCalls: number;
    decryptCalls: number;
    totalEncryptJsonMs: number;
    totalEncryptAsciiMs: number;
    totalEncryptKeystreamMs: number;
    totalEncryptXorMs: number;
    totalEncryptEncodeMs: number;
    maxEncryptJsonMs: number;
    maxEncryptAsciiMs: number;
    maxEncryptKeystreamMs: number;
    maxEncryptXorMs: number;
    maxEncryptEncodeMs: number;
    maxJsonBytes: number;
    maxClearBytes: number;
    maxKeystreamBytes: number;
    maxCiphertextBytes: number;
    maxHexBytes: number;
    maxEncryptResidentBytes: number;
    maxDecodedBytes: number;
    maxDecryptClearBytes: number;
    maxDecryptJsonBytes: number;
    maxDecryptResidentBytes: number;
    maxEncryptHeapDelta: number;
    maxEncryptExternalDelta: number;
    maxEncryptArrayBuffersDelta: number;
    maxDecryptHeapDelta: number;
    maxDecryptExternalDelta: number;
    maxDecryptArrayBuffersDelta: number;
  } {
    return takeBlobCryptoDebugWindow();
  }

  /**
   * @internal Benchmark hook: enable DiskStore serialization/allocation telemetry.
   */
  private _enableDiskStoreDebug(enabled = true): this {
    enableDiskStoreDebug(enabled);
    return this;
  }

  /**
   * @internal Benchmark hook: drain the current DiskStore telemetry window.
   */
  private _takeDiskStoreDebugWindow(): {
    appendCalls: number;
    readCalls: number;
    flushCalls: number;
    totalRecordStringifyMs: number;
    totalAppendMs: number;
    totalReadMs: number;
    totalFlushMs: number;
    maxRecordStringifyMs: number;
    maxAppendMs: number;
    maxReadMs: number;
    maxFlushMs: number;
    maxBlobBytes: number;
    maxRecordBytes: number;
    maxAppendResidentBytes: number;
    maxReadBufferBytes: number;
    maxReadResidentBytes: number;
    maxFlushIndexBytes: number;
    maxAppendHeapDelta: number;
    maxAppendExternalDelta: number;
    maxAppendArrayBuffersDelta: number;
    maxReadHeapDelta: number;
    maxReadExternalDelta: number;
    maxReadArrayBuffersDelta: number;
    maxFlushHeapDelta: number;
    maxFlushExternalDelta: number;
    maxFlushArrayBuffersDelta: number;
  } {
    return takeDiskStoreDebugWindow();
  }

  /**
   * @internal Benchmark hook: enable getDecryptedChunk cache/decrypt metrics.
   */
  private _enableDecryptedChunkDebug(enabled = true): this {
    (this as any).__decryptedChunkDebug = {
      enabled,
      window: {
        calls: 0,
        hits: 0,
        misses: 0,
        v2Misses: 0,
        v3Misses: 0,
        totalHitMs: 0,
        totalMissMs: 0,
        totalDecryptMs: 0,
        totalDecodeMs: 0,
        maxHitMs: 0,
        maxMissMs: 0,
        maxDecryptMs: 0,
        maxDecodeMs: 0,
      },
    };
    return this;
  }

  /**
   * @internal Benchmark hook: drain the current getDecryptedChunk window.
   */
  private _takeDecryptedChunkDebugWindow(): {
    calls: number;
    hits: number;
    misses: number;
    v2Misses: number;
    v3Misses: number;
    totalHitMs: number;
    totalMissMs: number;
    totalDecryptMs: number;
    totalDecodeMs: number;
    maxHitMs: number;
    maxMissMs: number;
    maxDecryptMs: number;
    maxDecodeMs: number;
  } {
    const empty = {
      calls: 0,
      hits: 0,
      misses: 0,
      v2Misses: 0,
      v3Misses: 0,
      totalHitMs: 0,
      totalMissMs: 0,
      totalDecryptMs: 0,
      totalDecodeMs: 0,
      maxHitMs: 0,
      maxMissMs: 0,
      maxDecryptMs: 0,
      maxDecodeMs: 0,
    };
    const debug = (this as any).__decryptedChunkDebug;
    const window = debug?.window ? { ...debug.window } : empty;
    if (debug) debug.window = { ...empty };
    return window;
  }

  private commitMapping(instruction: MappingInstruction, fallbackOperator: string | null = null): KernelMemory | undefined {
    return Core.commitMapping(this as unknown as MEKernelLike, instruction, fallbackOperator);
  }

  private tryResolveEvalTokenValue(
    token: string,
    evalScopePath: SemanticPath,
  ): { ok: true; value: any } | { ok: false } {
    return Evaluator.tryResolveEvalTokenValue(this as unknown as MEKernelLike, token, evalScopePath);
  }

  private tokenizeEvalExpression(raw: string) {
    return Evaluator.tokenizeEvalExpression(raw);
  }

  private tryEvaluateAssignExpression(
    evalScopePath: SemanticPath,
    expr: string,
  ): { ok: true; value: number | boolean } | { ok: false } {
    return Evaluator.tryEvaluateAssignExpression(this as unknown as MEKernelLike, evalScopePath, expr);
  }

  private postulate(path: SemanticPath, expression: any, operator: string | null = null): any {
    return Core.postulate(this as unknown as MEKernelLike, path, expression, operator);
  }

  private removeSubtree(targetPath: SemanticPath) {
    return Core.removeSubtree(this as unknown as MEKernelLike, targetPath);
  }

  private computeEffectiveSecret(path: SemanticPath): string {
    return Secret.computeEffectiveSecret(this as unknown as MEKernelLike, path);
  }

  private applyMemoryToIndex(t: KernelMemory): void {
    return Core.applyMemoryToIndex(this as unknown as MEKernelLike, t);
  }

  private removeIndexPrefix(prefixPath: SemanticPath): void {
    return Core.removeIndexPrefix(this as unknown as MEKernelLike, prefixPath);
  }

  private rebuildIndex() {
    return Core.rebuildIndex(this as unknown as MEKernelLike);
  }

  private getIndex(path: SemanticPath): any {
    return Core.getIndex(this as unknown as MEKernelLike, path);
  }

  private setIndex(path: SemanticPath, value: any): void {
    return Core.setIndex(this as unknown as MEKernelLike, path, value);
  }

  private resolveIndexPointerPath(path: SemanticPath, maxHops = 8): { path: SemanticPath; raw: any } {
    return Core.resolveIndexPointerPath(this as unknown as MEKernelLike, path, maxHops);
  }

  private chunkCacheKey(scopeKey: string, chunkId: string): string {
    return Secret.chunkCacheKey(scopeKey, chunkId);
  }

  private clearScopeChunkCache(scopeKey: string): void {
    return Secret.clearScopeChunkCache(this as unknown as MEKernelLike, scopeKey);
  }

  private getChunkId(path: SemanticPath, scope: SemanticPath): string {
    return Secret.getChunkId(this as unknown as MEKernelLike, path, scope);
  }

  private setAtPath(obj: any, rel: SemanticPath, value: any): void {
    return Secret.setAtPath(obj, rel, value);
  }

  private flattenLeaves(node: any, rel: SemanticPath, out: Array<{ rel: SemanticPath; value: any }>): void {
    return Secret.flattenLeaves(node, rel, out);
  }

  private migrateLegacyScopeToChunks(scope: SemanticPath, legacyBlob: EncryptedBlob, scopeSecret: string): void {
    return Secret.migrateLegacyScopeToChunks(this as unknown as MEKernelLike, scope, legacyBlob, scopeSecret);
  }

  private ensureScopeChunks(scope: SemanticPath, scopeSecret: string): Record<string, EncryptedBlob> {
    return Secret.ensureScopeChunks(this as unknown as MEKernelLike, scope, scopeSecret);
  }

  private getChunkBlob(scope: SemanticPath, chunkId: string): EncryptedBlob | undefined {
    return Secret.getChunkBlob(this as unknown as MEKernelLike, scope, chunkId);
  }

  private setChunkBlob(scope: SemanticPath, chunkId: string, blob: EncryptedBlob, scopeSecret: string): void {
    return Secret.setChunkBlob(this as unknown as MEKernelLike, scope, chunkId, blob, scopeSecret);
  }

  private getDecryptedChunk(scope: SemanticPath, scopeSecret: string, chunkId: string): any | undefined {
    return Secret.getDecryptedChunk(this as unknown as MEKernelLike, scope, scopeSecret, chunkId);
  }

  private resolveBranchScope(path: SemanticPath): SemanticPath | null {
    return Secret.resolveBranchScope(this as unknown as MEKernelLike, path);
  }

  private normalizeSelectorPath(path: SemanticPath): SemanticPath {
    return Utils.normalizeSelectorPath(path);
  }

  private pathContainsIterator(path: SemanticPath): boolean {
    return Utils.pathContainsIterator(path);
  }

  private substituteIteratorInPath(path: SemanticPath, indexValue: string): SemanticPath {
    return Utils.substituteIteratorInPath(path, indexValue);
  }

  private substituteIteratorInExpression(expr: string, indexValue: string): string {
    return Utils.substituteIteratorInExpression(expr, indexValue);
  }

  private collectIteratorIndices(path: SemanticPath): string[] {
    return Core.collectIteratorIndices(this as unknown as MEKernelLike, path);
  }

  private parseFilterExpression(
    expr: string,
  ): { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string } | null {
    return Utils.parseFilterExpression(expr);
  }

  private parseLogicalFilterExpression(
    expr: string,
  ): {
    clauses: Array<{ left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }>;
    ops: Array<"&&" | "||">;
  } | null {
    return Utils.parseLogicalFilterExpression(expr);
  }

  private compareValues(left: any, op: ">" | "<" | ">=" | "<=" | "==" | "!=", right: any): boolean {
    return Utils.compareValues(left, op, right);
  }

  private parseLiteralOrPath(raw: string): { kind: "literal"; value: any } | { kind: "path"; parts: SemanticPath } {
    return Utils.parseLiteralOrPath(raw);
  }

  private resolveRelativeFirst(scope: SemanticPath, parts: SemanticPath): any {
    return Core.resolveRelativeFirst(this as unknown as MEKernelLike, scope, parts);
  }

  private evaluateFilterClauseForScope(
    scope: SemanticPath,
    clause: { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string },
  ): boolean {
    return Core.evaluateFilterClauseForScope(this as unknown as MEKernelLike, scope, clause);
  }

  private evaluateLogicalFilterForScope(scope: SemanticPath, expr: string): boolean {
    return Core.evaluateLogicalFilterForScope(this as unknown as MEKernelLike, scope, expr);
  }

  private collectChildrenForPrefix(prefix: SemanticPath): string[] {
    return Core.collectChildrenForPrefix(this as unknown as MEKernelLike, prefix);
  }

  private parseSelectorSegment(segment: string): { base: string; selector: string } | null {
    return Utils.parseSelectorSegment(segment);
  }

  private parseSelectorKeys(selector: string): string[] | null {
    return Utils.parseSelectorKeys(selector);
  }

  private parseTransformSelector(selector: string): { varName: string; expr: string } | null {
    return Utils.parseTransformSelector(selector);
  }

  private evaluateTransformPath(path: SemanticPath): any {
    return Core.evaluateTransformPath(this as unknown as MEKernelLike, path);
  }

  private evaluateSelectionPath(path: SemanticPath): any {
    return Core.evaluateSelectionPath(this as unknown as MEKernelLike, path);
  }

  private buildPublicSubtree(prefix: SemanticPath): any {
    return Core.buildPublicSubtree(this as unknown as MEKernelLike, prefix);
  }

  private evaluateFilterPath(path: SemanticPath): any {
    return Core.evaluateFilterPath(this as unknown as MEKernelLike, path);
  }

  private pathContainsFilterSelector(path: SemanticPath): boolean {
    return Core.pathContainsFilterSelector(this as unknown as MEKernelLike, path);
  }

  private collectFilteredScopes(path: SemanticPath): SemanticPath[] {
    return Core.collectFilteredScopes(this as unknown as MEKernelLike, path);
  }

  private isStealthBlocked(path: SemanticPath, callerScope: string | null): boolean {
    const normalized = Utils.normalizeSelectorPath(path);
    for (let i = normalized.length; i > 0; i--) {
      const ancestorKey = normalized.slice(0, i).join(".");
      const secretScope = this.localSecrets[ancestorKey];
      if (secretScope !== undefined && secretScope !== callerScope) {
        return true;
      }
    }
    return false;
  }

  private readPath(path: SemanticPath): any {
    const callerScope =
      this._currentCallerScope !== undefined
        ? this._currentCallerScope
        : (this._ownerScope ?? null);
    const normalized = Utils.normalizeSelectorPath(path);
    if (this.isStealthBlocked(normalized, callerScope)) {
      return undefined;
    }
    return Core.readPath(this as unknown as MEKernelLike, path);
  }

  as(scope: string | null): ME {
    const prev = this._currentCallerScope;
    this._currentCallerScope = scope;
    try {
      return this.createProxy([]) as unknown as ME;
    } finally {
      this._currentCallerScope = prev;
    }
  }

  withScope<T>(scope: string | null, fn: () => T): T {
    const prev = this._currentCallerScope;
    this._currentCallerScope = scope;
    try {
      return fn();
    } finally {
      this._currentCallerScope = prev;
    }
  }

  private isRemoveCall(path: SemanticPath, expression: any): { targetPath: SemanticPath } | null {
    return isRemoveCall(this.operators as OperatorRegistry, path, expression);
  }

  private createProxy(path: SemanticPath): MEProxy {
    return ProxyRuntime.createProxy(this as unknown as MEKernelLike, path);
  }

  private describeRuntimeMethod(
    path: string,
    call: (...args: any[]) => unknown,
    docs: string,
    signature: string,
  ) {
    return ProxyRuntime.describeRuntimeMethod(this as unknown as MEKernelLike, path, call, docs, signature);
  }

  private buildRuntimeSurface(): Record<string, any> {
    return ProxyRuntime.buildRuntimeSurface(this as unknown as MEKernelLike);
  }

  private createRuntimeProxy(path: string[]): any {
    return ProxyRuntime.createRuntimeProxy(this as unknown as MEKernelLike, path);
  }

  private describeRuntimeSurface() {
    return ProxyRuntime.describeRuntimeSurface();
  }

  private resolveRuntimeValue(path: string[]): unknown {
    return ProxyRuntime.resolveRuntimeValue(this as unknown as MEKernelLike, path);
  }
}
