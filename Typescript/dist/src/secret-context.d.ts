import { MEBlobV3KeyCacheEntry, MEKernelLike, SemanticPath } from './types.ts';
export declare function bumpSecretEpoch(self: MEKernelLike): void;
export declare function computeEffectiveSecret(self: MEKernelLike, path: SemanticPath): string;
export declare function resolveBranchScope(self: MEKernelLike, path: SemanticPath): SemanticPath | null;
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
export declare function collectSecretChainV3(self: MEKernelLike, targetPath: SemanticPath, mode: "branch" | "value"): Uint8Array[];
/**
 * Retorna las keys derivadas v3 desde el cache compartido o las deriva usando
 * la ruta oficial del runtime. Se comparte entre value reads y branch reads.
 * @internal
 */
export declare function getOrDeriveV3Keys(self: MEKernelLike, path: SemanticPath, mode: "branch" | "value"): MEBlobV3KeyCacheEntry;
