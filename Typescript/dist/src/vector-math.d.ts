import { MESearchHit } from './types.js';
export declare function dotProduct(a: Float32Array, b: Float32Array): number;
export declare function l2Norm(a: Float32Array): number;
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
export declare function cosineSimilarityAt(query: Float32Array, haystack: Float32Array, offset: number, dims: number, queryNorm?: number): number;
export declare function l2Normalize(v: Float32Array): Float32Array;
export declare function pushTopK(hits: MESearchHit[], hit: MESearchHit, k: number): void;
