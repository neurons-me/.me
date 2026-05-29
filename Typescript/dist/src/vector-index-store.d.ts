import { MEKernelLike, MEVectorIndex, SemanticPath } from './types.ts';
export declare function vectorIndexKey(scope: SemanticPath): string;
export declare function resolveVectorIndexPath(self: MEKernelLike, scope: SemanticPath): string | null;
export declare function cacheVectorIndex(self: MEKernelLike, scope: SemanticPath, index: MEVectorIndex): void;
export declare function getCachedVectorIndex(self: MEKernelLike, scope: SemanticPath): MEVectorIndex | null;
export declare function persistVectorIndex(self: MEKernelLike, scope: SemanticPath, index: MEVectorIndex): {
    persisted: boolean;
    path: string | null;
};
export declare function loadVectorIndex(self: MEKernelLike, scope: SemanticPath): MEVectorIndex | null;
