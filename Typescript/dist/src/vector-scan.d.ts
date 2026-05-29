import { MEKernelLike, MESearchExactOptions, MESearchExactResult, SemanticPath } from './types.js';
export declare function searchExact(self: MEKernelLike, scopePath: string | SemanticPath, query: ArrayLike<number>, options?: MESearchExactOptions): MESearchExactResult;
