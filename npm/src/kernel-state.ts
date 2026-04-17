import * as Utils from "./utils.js";
import { MemoryStore } from "./instance-store.js";
import type {
  MEBlobV3KeyCacheEntry,
  KernelMemory,
  MEBranchScopeCacheEntry,
  EncryptedBranchPlane,
  MEDecryptedBranchCacheEntry,
  MEDecryptedValueCacheEntry,
  MEDerivationRecord,
  MEEffectiveSecretCacheEntry,
  MEOptions,
  StoredWrappedKey,
} from "./types.js";

export type MemoryState = {
  index: Record<string, any>;
  _memories: KernelMemory[];
};

export type SecretState = {
  localSecrets: Record<string, string>;
  localNoises: Record<string, string>;
  branchStore: NonNullable<MEOptions["store"]>;
  // v3 is the default write format from Corte 4. v2 remains available for rollback/tests.
  secretBlobVersion: "v2" | "v3";
  keySpaces: Record<string, StoredWrappedKey>;
  recipientKeyring: Record<string, CryptoKey>;
  secretEpoch: number;
  scopeCache: Map<string, MEBranchScopeCacheEntry>;
  effectiveSecretCache: Map<string, MEEffectiveSecretCacheEntry>;
  decryptedBranchCache: Map<string, MEDecryptedBranchCacheEntry>;
  decryptedValueCache: Map<string, MEDecryptedValueCacheEntry>;
  v3KeyCache: Map<string, MEBlobV3KeyCacheEntry>;
  secretChunkSize: number;
  secretHashBuckets: number;
};

export type DerivationState = {
  derivations: Record<string, MEDerivationRecord>;
  refSubscribers: Record<string, string[]>;
  recomputeMode: "eager" | "lazy";
  refVersions: Record<string, number>;
  derivationRefVersions: Record<string, Record<string, number>>;
  staleDerivations: Set<string>;
};

export type ConfigState = {
  unsafeEval: boolean;
  operators: Record<string, { kind: string }>;
};

export type KernelState = {
  memory: MemoryState;
  secrets: SecretState;
  derivation: DerivationState;
  config: ConfigState;
};

export type KernelFields =
  & MemoryState
  & SecretState
  & DerivationState
  & ConfigState;

export function createInitialKernelState(options: MEOptions = {}): KernelState {
  return {
    memory: {
      index: {},
      _memories: [],
    },
    secrets: {
      localSecrets: {},
      localNoises: {},
      branchStore: options.store ?? new MemoryStore(),
      secretBlobVersion: "v3",
      keySpaces: {},
      recipientKeyring: {},
      secretEpoch: 0,
      scopeCache: new Map(),
      effectiveSecretCache: new Map(),
      decryptedBranchCache: new Map(),
      decryptedValueCache: new Map(),
      v3KeyCache: new Map(),
      secretChunkSize: 256,
      secretHashBuckets: 16,
    },
    derivation: {
      derivations: {},
      refSubscribers: {},
      recomputeMode: "eager",
      refVersions: {},
      derivationRefVersions: {},
      staleDerivations: new Set(),
    },
    config: {
      unsafeEval: false,
      operators: Utils.createDefaultOperators(),
    },
  };
}

export function createInitialKernelFields(options: MEOptions = {}): KernelFields {
  const state = createInitialKernelState(options);
  const fields = {
    ...state.memory,
    ...state.secrets,
    ...state.derivation,
    ...state.config,
  } satisfies KernelFields;

  return fields;
}
