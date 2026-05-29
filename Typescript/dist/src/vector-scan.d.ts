import { MEKernelLike, MESearchExactOptions, MESearchExactResult, SemanticPath } from './types.ts';
export declare function searchExact(self: MEKernelLike, scopePath: string | SemanticPath, query: ArrayLike<number>, options?: MESearchExactOptions): MESearchExactResult;
