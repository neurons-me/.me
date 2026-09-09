import { bumpSecretEpoch } from "./secret.ts";
import { toKernelMemories, toPublicMemories } from "./memory-redaction.ts";
import type {
  MEKernelLike,
  MESnapshot,
  MESnapshotInput,
} from "./types.ts";
import {
  cloneValue,
  createDefaultOperators,
} from "./utils.ts";

/** Bumped when the disk-safe shape of exportSnapshot()'s output changes. */
const SNAPSHOT_FORMAT_VERSION = 2;
const SECRET_REDACTION_PLACEHOLDER = "***";

function deriveOwnerScope(localSecrets: Record<string, string>): string | null {
  const values = Object.values(localSecrets);
  return values.length > 0 ? values[values.length - 1] : null;
}

/**
 * Topology only: every declared scope key, value replaced by the same
 * "***" placeholder the memory log already uses for `_()`/`~()` entries
 * (see `commitMemoryOnly` callers in core-write.ts). This is what makes
 * `exportSnapshot()` disk-safe (Option B — nothing session-only reaches
 * disk unencrypted) while still letting a freshly-hydrated kernel know a
 * path is protected (`resolveBranchScope` only checks truthiness).
 */
function redactSecretMap(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(map)) out[key] = SECRET_REDACTION_PLACEHOLDER;
  return out;
}

/**
 * Portable, disk-safe snapshot. `localSecrets`/`localNoises` here carry ONLY
 * the "***" topology placeholder — never the real `_()`/`~()` values, and
 * never the unwrapped identity root. `identityRoot` is the wrapped
 * (ciphertext) envelope, safe to persist as-is. See
 * typedocs/Identity-Bound-Secrets.md "Persistencia" for the full contract
 * and `tests/identity-bound-secrets.test.ts` for the behavioral proof.
 */
export function exportSnapshot(self: MEKernelLike): MESnapshot {
  return cloneValue({
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    memories: toPublicMemories(self._memories),
    localSecrets: redactSecretMap(self.localSecrets),
    localNoises: redactSecretMap(self.localNoises),
    encryptedBranches: self.branchStore.exportData(),
    keySpaces: self.keySpaces,
    operators: self.operators,
    identityRoot: self.identityRootEnvelope ? self.identityRootEnvelope : null,
    migrationV4: self.migrationV4 ?? {},
    migrationV4Values: self.migrationV4Values ?? {},
  });
}

/**
 * Restores kernel state from a snapshot. `localSecrets`/`localNoises` are
 * stored EXACTLY as given — this function does not distinguish a real
 * secret value from a "***" placeholder. The disk-safe guarantee comes from
 * what `exportSnapshot()` chooses to emit (always redacted), not from
 * hydrate() refusing real values; a caller that deliberately constructs a
 * snapshot with real secret material (tests, or a controlled in-process
 * hand-off) is supplying it explicitly, which is not the "silent recovery"
 * Option B forbids.
 *
 * The identity root, if present, is restored as its WRAPPED envelope only —
 * `identityRootUnwrapped` always starts null after hydrate(). Nothing here
 * ever unlocks the identity automatically.
 */
export function hydrate(self: MEKernelLike, snapshot: MESnapshotInput): void {
  const data = cloneValue(snapshot ?? {});
  self._memories = Array.isArray(data.memories)
    ? toKernelMemories(data.memories)
    : [];
  self.localSecrets = data.localSecrets && typeof data.localSecrets === "object" ? data.localSecrets : {};
  self.localNoises = data.localNoises && typeof data.localNoises === "object" ? data.localNoises : {};
  (self as any)._ownerScope = deriveOwnerScope(self.localSecrets);
  (self as any)._currentCallerScope = undefined;
  self.identityRootEnvelope =
    data.identityRoot && typeof data.identityRoot === "object" ? data.identityRoot : null;
  self.identityRootId = self.identityRootEnvelope ? self.identityRootEnvelope.rootId : null;
  if (self.identityRootUnwrapped) self.identityRootUnwrapped.fill(0);
  self.identityRootUnwrapped = null;
  self.migrationV4 = data.migrationV4 && typeof data.migrationV4 === "object" ? data.migrationV4 : {};
  self.migrationV4Values =
    data.migrationV4Values && typeof data.migrationV4Values === "object" ? data.migrationV4Values : {};
  bumpSecretEpoch(self);
  self.branchStore.importData(
    data.encryptedBranches && typeof data.encryptedBranches === "object" ? data.encryptedBranches : {},
  );
  self.keySpaces = data.keySpaces && typeof data.keySpaces === "object" ? data.keySpaces : {};
  self.derivations = {};
  self.refSubscribers = {};
  self.refVersions = {};
  self.derivationRefVersions = {};
  self.staleDerivations.clear();
  self.lastRecomputeWaveByTarget = {};
  self.activeRecomputeWave = null;

  const defaults = createDefaultOperators();
  self.operators =
    data.operators && typeof data.operators === "object"
      ? { ...defaults, ...data.operators }
      : defaults;

  self.rebuildIndex();
}

export function importSnapshot(self: MEKernelLike, snapshot: MESnapshotInput): void {
  hydrate(self, snapshot);
}

export function rehydrate(self: MEKernelLike, snapshot: MESnapshotInput): void {
  hydrate(self, snapshot);
}
