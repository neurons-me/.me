import type {
  KernelMemory,
  Memory,
  ReplayMemoryInput,
} from "./types.js";

export function toPublicMemory(memory: ReplayMemoryInput): Memory {
  const { effectiveSecret: _effectiveSecret, ...publicMemory } = memory as KernelMemory;
  return { ...publicMemory };
}

export function toPublicMemories(memories: ReplayMemoryInput[]): Memory[] {
  return memories.map(toPublicMemory);
}

export function toKernelMemory(memory: ReplayMemoryInput): KernelMemory {
  return { ...memory };
}

export function toKernelMemories(memories: ReplayMemoryInput[]): KernelMemory[] {
  return memories.map(toKernelMemory);
}
