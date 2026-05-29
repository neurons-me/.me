import { KernelMemory, MEKernelLike, SemanticPath } from './types.js';
export declare function applyMemoryToIndex(self: MEKernelLike, t: KernelMemory): void;
export declare function removeIndexPrefix(self: MEKernelLike, prefixPath: SemanticPath): void;
export declare function rebuildIndex(self: MEKernelLike): void;
export declare function getIndex(self: MEKernelLike, path: SemanticPath): any;
export declare function setIndex(self: MEKernelLike, path: SemanticPath, value: any): void;
export declare function resolveIndexPointerPath(self: MEKernelLike, path: SemanticPath, maxHops?: number): {
    path: SemanticPath;
    raw: any;
};
