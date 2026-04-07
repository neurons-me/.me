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
  exportP256PublicKey,
  generateP256KeyPair,
  importP256PublicKey,
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
import type {
  EncryptedBlob,
  KernelMemory,
  MappingInstruction,
  MEBranchScopeCacheEntry,
  MEDecryptedBranchCacheEntry,
  MEDerivationRecord,
  MEEffectiveSecretCacheEntry,
  MEKernelLike,
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
  private static readonly RUNTIME_ESCAPE_TOKEN = ProxyRuntime.RUNTIME_ESCAPE_TOKEN;

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

  private localSecrets!: Record<string, string>;
  private localNoises!: Record<string, string>;
  private encryptedBranches!: Record<string, EncryptedBlob | Record<string, EncryptedBlob>>;
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
  private readonly secretChunkSize!: number;
  private readonly secretHashBuckets!: number;
  private readonly unsafeEval!: boolean;
  private operators!: Record<string, { kind: string }>;

  get memories(): Memory[] {
    return toPublicMemories(this._memories);
  }

  constructor(expression?: any) {
    Object.assign(this, createInitialKernelFields());
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

  inspect(opts?: { last?: number }) {
    return Core.inspect(this as unknown as MEKernelLike, opts);
  }

  setRecomputeMode(mode: "eager" | "lazy"): this {
    return Core.setRecomputeMode(this as unknown as MEKernelLike, mode) as unknown as this;
  }

  getRecomputeMode(): "eager" | "lazy" {
    return Core.getRecomputeMode(this as unknown as MEKernelLike);
  }

  installRecipientKey(recipientKeyId: string, privateKey: CryptoKey): this {
    return Core.installRecipientKey(this as unknown as MEKernelLike, recipientKeyId, privateKey) as unknown as this;
  }

  uninstallRecipientKey(recipientKeyId: string): this {
    return Core.uninstallRecipientKey(this as unknown as MEKernelLike, recipientKeyId) as unknown as this;
  }

  storeWrappedKey(keyId: string, envelope: WrappedSecretV1, options?: { recipientKeyId?: string }): this {
    return Core.storeWrappedKey(this as unknown as MEKernelLike, keyId, envelope, options) as unknown as this;
  }

  execute(rawTarget: string | MeTargetAst, body?: any): any {
    return Core.execute(this as unknown as MEKernelLike, rawTarget, body);
  }

  private bumpSecretEpoch(): void {
    return Secret.bumpSecretEpoch(this as unknown as MEKernelLike);
  }

  explain(path: string) {
    return Derivation.explain(this as unknown as MEKernelLike, path);
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

  exportSnapshot(): MESnapshot {
    return Core.exportSnapshot(this as unknown as MEKernelLike);
  }

  importSnapshot(snapshot: MESnapshotInput): void {
    return Core.importSnapshot(this as unknown as MEKernelLike, snapshot);
  }

  rehydrate(snapshot: MESnapshotInput): void {
    return Core.rehydrate(this as unknown as MEKernelLike, snapshot);
  }

  learn(memory: unknown): void {
    return Core.learn(this as unknown as MEKernelLike, memory);
  }

  replayMemories(memories: ReplayMemoryInput[]): void {
    return Core.replayMemories(this as unknown as MEKernelLike, memories);
  }

  private normalizeArgs(args: any[]): any {
    return ProxyRuntime.normalizeArgs(args);
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

  private readPath(path: SemanticPath): any {
    return Core.readPath(this as unknown as MEKernelLike, path);
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
