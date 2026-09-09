import * as Utils from "./utils.ts";
import { MemoryStore } from "./instance-store.ts";
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
  MERecomputeWave,
  MEVectorIndex,
  StoredWrappedKey,
  IdentityRootEnvelope,
  MEMigrationV4Status,
} from "./types.ts";

export type MemoryState = {
  index: Record<string, any>;
  /**
   * Which entry currently "backs" each key in `index` — i.e. the winner
   * of that path under Axiom A9's order, `(seq asc, hash asc)` for modern
   * entries (falling back to `(timestamp asc, hash asc)` only when NEITHER
   * side being compared has a `seq` — see `compareLWW`, core-index.ts).
   * Lets `applyMemoryToIndex` enforce the SAME rule on every incremental
   * live write that `rebuildIndex()` already enforced on a full replay,
   * instead of live writes using plain arrival-order. Must be
   * cleared/rebuilt in lockstep with `index` everywhere `index` is reset
   * or has keys deleted — a stale winner left behind after a real `index`
   * deletion would wrongly block a legitimate future write to that path.
   */
  indexWinner: Record<string, { timestamp: number; seq?: number; hash: string }>;
  /**
   * Next value to assign to a NEW memory's `seq` field — a monotonic,
   * per-instance Lamport-style scalar clock (see `Memory.seq`, types.ts,
   * and Axiom A9, typedocs/Axioms.md). Incremented once per genuinely NEW
   * memory record (never on replay of an already-`seq`'d entry — that
   * entry keeps its own original `seq`). Restored after any full index
   * rebuild (`rebuildIndex()`, including via `hydrate()`) as
   * `max(seq present in _memories) + 1`, so writes made after a restart
   * continue the same sequence rather than colliding with restored
   * history — the same rule a future merge of a genuinely different
   * node's history would use to advance past it.
   */
  seqCounter: number;
  _memories: KernelMemory[];
};

export type SecretState = {
  localSecrets: Record<string, string>;
  localNoises: Record<string, string>;
  /**
   * Durable topology: every scope key (`""` for root, or a dotted branch
   * path) that has EVER had `_()` called on it in this kernel's lifetime.
   * Unlike `localSecrets`, this never holds the secret VALUE — only the
   * KEY, so it is safe to keep around after `lockIdentity()` wipes
   * `localSecrets`, and safe to persist to disk. It exists specifically so
   * a scope declared at the ROOT (`me["_"](...)`) or any other value-mode
   * scope has the same durable "this path is protected" evidence that
   * `branchStore.listScopes()` already gives branch-mode scopes for free —
   * see `hasExistingProtectedAncestor` in core-write.ts and
   * typedocs/Identity-Bound-Secrets.md's root-scope-after-lock finding.
   * Cleared only on a full identity transition (`ME_RESEED`), never on lock.
   */
  protectedScopeKeys: Set<string>;
  branchStore: NonNullable<MEOptions["store"]>;
  // v3 is the default write format from Corte 4. v2 remains available for rollback/tests.
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
  v4KeyCache: Map<string, MEBlobV3KeyCacheEntry>;
  vectorIndexes: Map<string, MEVectorIndex>;
  secretChunkSize: number;
  secretHashBuckets: number;
  /**
   * Identity-Bound Secrets (see typedocs/Identity-Bound-Secrets.md).
   * `identityRootEnvelope` is ciphertext — safe to persist to disk.
   * `identityRootUnwrapped` and `identityRootId` are session-only and are
   * never written by `exportSnapshot()`; they exist only while unlocked.
   */
  identityRootEnvelope: IdentityRootEnvelope | null;
  identityRootUnwrapped: Uint8Array | null;
  identityRootId: string | null;
  /** Per-scope / per-value-path v3->v4 migration bookkeeping. Not secret. */
  migrationV4: Record<string, MEMigrationV4Status>;
  migrationV4Values: Record<string, MEMigrationV4Status>;
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
      indexWinner: {},
      seqCounter: 0,
      _memories: [],
    },
    secrets: {
      localSecrets: {},
      localNoises: {},
      protectedScopeKeys: new Set(),
      branchStore: options.store ?? new MemoryStore(),
      secretBlobVersion: "v3",
      keySpaces: {},
      recipientKeyring: {},
      secretEpoch: 0,
      scopeCache: new Map(),
      effectiveSecretCache: new Map(),
      decryptedBranchCache: new Map(),
      writeBranchCache: new Map(),
      decryptedValueCache: new Map(),
      v3KeyCache: new Map(),
      v4KeyCache: new Map(),
      vectorIndexes: new Map(),
      secretChunkSize: 256,
      secretHashBuckets: 16,
      identityRootEnvelope: null,
      identityRootUnwrapped: null,
      identityRootId: null,
      migrationV4: {},
      migrationV4Values: {},
    },
    derivation: {
      derivations: {},
      refSubscribers: {},
      recomputeMode: "eager",
      refVersions: {},
      derivationRefVersions: {},
      staleDerivations: new Set(),
      lastRecomputeWaveByTarget: {},
      activeRecomputeWave: null,
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
