import { KernelMemory, MappingInstruction, MEKernelLike, ReplayMemoryInput, SemanticPath } from './types.ts';
export declare function learn(self: MEKernelLike, memory: unknown): void;
export declare function replayMemories(self: MEKernelLike, memories: ReplayMemoryInput[]): void;
export declare function commitMemoryOnly(self: MEKernelLike, targetPath: SemanticPath, operator: string | null, expression: any, value: any): KernelMemory;
type BatchRelEntry = {
    rel: SemanticPath;
    value: any;
};
export declare function commitChunkBatch(self: MEKernelLike, scope: SemanticPath, scopeSecret: string, chunkId: string, relEntries: BatchRelEntry[], primeDecryptedCache?: boolean): void;
export declare function commitIndexedBatch(self: MEKernelLike, basePath: SemanticPath, startIndex: number, items: any[], operator?: string | null): KernelMemory[];
export declare function commitValueMapping(self: MEKernelLike, targetPath: SemanticPath, expression: any, operator?: string | null): KernelMemory;
export declare function commitMapping(self: MEKernelLike, instruction: MappingInstruction, fallbackOperator?: string | null): KernelMemory | undefined;
export declare function postulate(self: MEKernelLike, path: SemanticPath, expression: any, operator?: string | null): any;
export declare function removeSubtree(self: MEKernelLike, targetPath: SemanticPath): void;
export {};
