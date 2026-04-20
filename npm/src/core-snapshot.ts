import { bumpSecretEpoch } from "./secret.js";
import { toKernelMemories, toPublicMemories } from "./memory-redaction.js";
import type {
  MEKernelLike,
  MESnapshot,
  MESnapshotInput,
} from "./types.js";
import {
  cloneValue,
  createDefaultOperators,
} from "./utils.js";

function deriveOwnerScope(localSecrets: Record<string, string>): string | null {
  const values = Object.values(localSecrets);
  return values.length > 0 ? values[values.length - 1] : null;
}

export function exportSnapshot(self: MEKernelLike): MESnapshot {
  return cloneValue({
    memories: toPublicMemories(self._memories),
    localSecrets: self.localSecrets,
    localNoises: self.localNoises,
    encryptedBranches: self.branchStore.exportData(),
    keySpaces: self.keySpaces,
    operators: self.operators,
  });
}

export function importSnapshot(self: MEKernelLike, snapshot: MESnapshotInput): void {
  const data = cloneValue(snapshot ?? {});
  self._memories = Array.isArray(data.memories)
    ? toKernelMemories(data.memories)
    : [];
  self.localSecrets = data.localSecrets && typeof data.localSecrets === "object" ? data.localSecrets : {};
  self.localNoises = data.localNoises && typeof data.localNoises === "object" ? data.localNoises : {};
  (self as any)._ownerScope = deriveOwnerScope(self.localSecrets);
  (self as any)._currentCallerScope = undefined;
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

export function rehydrate(self: MEKernelLike, snapshot: MESnapshotInput): void {
  self.importSnapshot(snapshot);
}
