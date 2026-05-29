import { MEBlobV3KeyCacheEntry, KernelMemory, MEBranchScopeCacheEntry, MEDecryptedBranchCacheEntry, MEDecryptedValueCacheEntry, MEDerivationRecord, MEEffectiveSecretCacheEntry, MEOptions, MERecomputeWave, MEVectorIndex, StoredWrappedKey } from './types.ts';
export type MemoryState = {
    index: Record<string, any>;
    _memories: KernelMemory[];
};
export type SecretState = {
    localSecrets: Record<string, string>;
    localNoises: Record<string, string>;
    branchStore: NonNullable<MEOptions["store"]>;
    secretBlobVersion: "v2" | "v3";
    keySpaces: Record<string, StoredWrappedKey>;
    recipientKeyring: Record<string, CryptoKey>;
    secretEpoch: number;
    scopeCache: Map<string, MEBranchScopeCacheEntry>;
    effectiveSecretCache: Map<string, MEEffectiveSecretCacheEntry>;
    decryptedBranchCache: Map<string, MEDecryptedBranchCacheEntry>;
    writeBranchCache: Map<string, MEDecryptedBranchCacheEntry>;
    decryptedValueCache: Map<string, MEDecryptedValueCacheEntry>;
    v3KeyCache: Map<string, MEBlobV3KeyCacheEntry>;
    vectorIndexes: Map<string, MEVectorIndex>;
    secretChunkSize: number;
    secretHashBuckets: number;
};
export type DerivationState = {
    derivations: Record<string, MEDerivationRecord>;
    refSubscribers: Record<string, Set<string>>;
    recomputeMode: "eager" | "lazy";
    refVersions: Record<string, number>;
    derivationRefVersions: Record<string, Record<string, number>>;
    staleDerivations: Set<string>;
    lastRecomputeWaveByTarget: Record<string, MERecomputeWave>;
    activeRecomputeWave: MERecomputeWave | null;
};
export type ConfigState = {
    unsafeEval: boolean;
    operators: Record<string, {
        kind: string;
    }>;
};
export type KernelState = {
    memory: MemoryState;
    secrets: SecretState;
    derivation: DerivationState;
    config: ConfigState;
};
export type KernelFields = MemoryState & SecretState & DerivationState & ConfigState;
export declare function createInitialKernelState(options?: MEOptions): KernelState;
export declare function createInitialKernelFields(options?: MEOptions): KernelFields;
