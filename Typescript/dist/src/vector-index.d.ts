import { MEKernelLike, MEVectorIndexBuildOptions, MEVectorIndexBuildResult, MEVectorSearchOptions, MEVectorSearchResult, SemanticPath } from './types.js';
export declare function buildVectorIndex(self: MEKernelLike, scopePath: string | SemanticPath, options?: MEVectorIndexBuildOptions): MEVectorIndexBuildResult;
export declare function searchVector(self: MEKernelLike, scopePath: string | SemanticPath, query: ArrayLike<number>, options?: MEVectorSearchOptions): MEVectorSearchResult;
