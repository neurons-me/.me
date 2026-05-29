import { KernelMemory, Memory, ReplayMemoryInput } from './types.ts';
export declare function toPublicMemory(memory: ReplayMemoryInput): Memory;
export declare function toPublicMemories(memories: ReplayMemoryInput[]): Memory[];
export declare function toKernelMemory(memory: ReplayMemoryInput): KernelMemory;
export declare function toKernelMemories(memories: ReplayMemoryInput[]): KernelMemory[];
