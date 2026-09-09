/**
 * Kernel glue for Identity-Bound Secrets. Wires `identity-root.ts` (pure
 * crypto) into `ME` instances: where the wrapped root lives, session-only
 * unwrap state, and the explicit lock/unlock/password-change/reseed/backup
 * operations. See typedocs/Identity-Bound-Secrets.md for the full design.
 *
 * Placement decision (constraint #1 of the task): the wrapped root envelope
 * lives in `.me` kernel state itself, next to `#seed` — NOT in Cleaker.
 * Reasons, recorded here since this is the actual load-bearing decision:
 *   - The kernel already privately owns material of exactly this kind
 *     (`#seed`). The wrapped envelope is ciphertext and requires no
 *     additional trust boundary beyond what the kernel already has.
 *   - No inverse dependency is introduced from the kernel toward Cleaker —
 *     this module imports nothing from `cleaker`.
 *   - Monad's persistence (`modules/monad/Typescript/src/kernel/manager.ts`)
 *     already round-trips whatever `exportSnapshot()`/`hydrate()` produce
 *     through `snapshot.json`. Because the envelope is ciphertext, it rides
 *     that existing pipeline for free — no new Monad-side storage needed.
 *   - Cleaker's claim record (`Surface-Identity-Claims.md`) remains a valid
 *     *alternative* location for a future multi-device recovery story, but
 *     is out of scope here — nothing about this module's shape forecloses
 *     moving the envelope there later (it is a self-contained JSON value).
 */
import {
  changeIdentityRootPassword,
  cloneIdentityRootEnvelope,
  generateIdentityRoot,
  unwrapIdentityRoot,
  wrapIdentityRoot,
  assertIdentityRootEnvelopeShape,
  IdentityRootFormatError,
  DEFAULT_PBKDF2_ITERATIONS,
} from "./identity-root.ts";
import type { IdentityRootEnvelope } from "./identity-root.ts";
import { bumpSecretEpoch } from "./secret-context.ts";
import type { MEKernelLike } from "./types.ts";

function wipe(bytes: Uint8Array | null | undefined): void {
  if (bytes) bytes.fill(0);
}

export function hasIdentityRoot(self: MEKernelLike): boolean {
  return self.identityRootEnvelope !== null;
}

export function isIdentityUnlocked(self: MEKernelLike): boolean {
  return self.identityRootUnwrapped !== null;
}

export function currentIdentityRootId(self: MEKernelLike): string | null {
  return self.identityRootId;
}

/**
 * Create a brand new identity root for this kernel and leave it unlocked
 * for the rest of this session (the caller just supplied the password that
 * protects it, so there is nothing to "recover" — this is not the Option B
 * silent-recovery case, it's the creation flow). Refuses to overwrite an
 * existing root; call `rotateIdentityRoot` for that, explicitly.
 */
export async function createIdentityRoot(
  self: MEKernelLike,
  password: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
): Promise<{ rootId: string }> {
  if (self.identityRootEnvelope) {
    throw new Error("An identity root already exists for this kernel. Use rotateIdentityRoot() to replace it.");
  }
  const { rootId, root } = generateIdentityRoot();
  try {
    self.identityRootEnvelope = await wrapIdentityRoot(root, rootId, password, iterations);
    self.identityRootId = rootId;
    self.identityRootUnwrapped = Uint8Array.from(root);
  } finally {
    wipe(root);
  }
  bumpSecretEpoch(self);
  return { rootId };
}

/**
 * Unlock the identity root for this session. Per Option B, this NEVER also
 * restores branch `_()`/`~()` secrets — those remain whatever they already
 * were in `localSecrets`/`localNoises` (normally empty after a fresh
 * process start). Throws (no fallback, no silent "treat as public") on a
 * wrong password or missing/corrupt envelope.
 */
export async function unlockIdentity(self: MEKernelLike, password: string): Promise<{ rootId: string }> {
  if (!self.identityRootEnvelope) {
    throw new Error("No identity root exists for this kernel yet. Call createIdentityRoot() first.");
  }
  const root = await unwrapIdentityRoot(self.identityRootEnvelope, password);
  wipe(self.identityRootUnwrapped);
  self.identityRootUnwrapped = root;
  self.identityRootId = self.identityRootEnvelope.rootId;
  bumpSecretEpoch(self);
  return { rootId: self.identityRootId };
}

/**
 * Lock the identity: wipe the unwrapped root from memory and invalidate
 * every derived-key cache and decrypted-plaintext cache (`bumpSecretEpoch`
 * clears `v3KeyCache`/`v4KeyCache`/`decryptedBranchCache`/
 * `decryptedValueCache`/`writeBranchCache`). Also clears session-supplied
 * `localSecrets`/`localNoises`: without the root neither is useful for v4
 * derivation anyway, and per Option B nothing should look "still open" once
 * the identity is locked. Deliberately does NOT clear `protectedScopeKeys`
 * (see kernel-state.ts) — that set holds scope KEYS only, never secret
 * values, and it is the durable evidence `commitValueMapping`'s
 * `hasExistingProtectedAncestor` check (core-write.ts) relies on to refuse
 * a plain public write over a now-locked root-scope/value-mode path.
 * Wiping it here would reopen exactly the bug that check exists to close.
 *
 * Caveat this module cannot fully close: JavaScript has no guaranteed
 * memory-scrubbing primitive. `fill(0)` overwrites the `Uint8Array`'s own
 * backing store, but the engine's GC, JIT string/array interning, and
 * anything that already copied bytes out of these arrays (e.g. a decrypted
 * JSON string produced earlier and still referenced somewhere) are outside
 * this module's control. This is a best-effort reduction of the exposure
 * window, not a guarantee of erasure — documented here rather than implied.
 */
export function lockIdentity(self: MEKernelLike): void {
  wipe(self.identityRootUnwrapped);
  self.identityRootUnwrapped = null;
  self.localSecrets = {};
  self.localNoises = {};
  (self as any)._ownerScope = null;
  bumpSecretEpoch(self);
}

/**
 * Password change: re-wraps the SAME root under a new password. Branch
 * ciphertext is untouched (nothing derived from the root changes). Does not
 * require the identity to currently be unlocked in-session — it re-derives
 * from the envelope + old password directly, and re-verifies the old
 * password in the process (a wrong old password throws, same as unlock).
 * This is a distinct operation from `rotateIdentityRoot` — it must never be
 * silently substituted for one another.
 */
export async function changeIdentityPassword(
  self: MEKernelLike,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (!self.identityRootEnvelope) {
    throw new Error("No identity root exists for this kernel yet.");
  }
  const next = await changeIdentityRootPassword(self.identityRootEnvelope, oldPassword, newPassword);
  self.identityRootEnvelope = next;
  // If we were already unlocked, re-derive session state from the fresh
  // envelope+password rather than trusting the previously-cached bytes —
  // cheap, and keeps "unlocked" meaning "verified against the current
  // envelope" at all times.
  if (self.identityRootUnwrapped) {
    const root = await unwrapIdentityRoot(next, newPassword);
    wipe(self.identityRootUnwrapped);
    self.identityRootUnwrapped = root;
  }
  // No bumpSecretEpoch here on purpose: the root bytes are unchanged, so
  // every derived v4 key and every branch ciphertext is still valid.
}

export interface RotateIdentityRootResult {
  rootId: string;
  previousRootId: string | null;
}

/**
 * Rotate: replace the root itself with a brand new, independently-random
 * one under `newPassword`. This is the "compromise response" operation
 * from the design doc's §4 vocabulary, NOT a password change — the task
 * explicitly scopes a full rotate-and-re-encrypt migration platform OUT of
 * this phase ("no implementes todavía una plataforma completa de rotación
 * entre raíces"), so this function does the minimal, honest thing: it mints
 * a new root/rootId and requires the caller to acknowledge, explicitly,
 * that existing v4 ciphertext encrypted under the OLD root will no longer
 * be derivable from the new one (v3 ciphertext is unaffected either way).
 * A future revision can add a real rotate+re-encrypt pass keyed off
 * `previousRootId` — nothing here forecloses that; `rootId` continues to be
 * tracked precisely so that migration has something to key off of.
 *
 * Authentication gate (fixed by the adversarial security battery,
 * `tests/Security/root-lifecycle.test.ts`): rotation is a "the current
 * owner is invalidating and replacing their own credential" operation, the
 * same trust level `changeIdentityPassword` requires (proof of the OLD
 * password) — it must never be reachable by someone who has merely obtained
 * a reference to a *locked* kernel. Before this fix, `rotateIdentityRoot`
 * had no authentication check at all when an envelope already existed: a
 * caller with no password knowledge could call it on a locked identity and
 * silently destroy the owner's real root/envelope, replacing it with an
 * attacker-chosen one — a takeover/DoS primitive requiring zero secrets.
 * The fix requires the identity to already be unlocked this session (i.e.
 * the caller already proved ownership via `unlockIdentity`/
 * `createIdentityRoot`) before an *existing* root may be rotated. Minting a
 * first root via rotate on a kernel that has none yet is unaffected (no
 * envelope to protect). This does not touch the "process already unlocked"
 * threat model boundary (§ atacante que controla el proceso desbloqueado is
 * still explicitly out of scope) — it closes the gap for a LOCKED identity.
 */
export async function rotateIdentityRoot(
  self: MEKernelLike,
  newPassword: string,
  options: { acknowledgeExistingV4CiphertextBecomesUnreadable: boolean; iterations?: number },
): Promise<RotateIdentityRootResult> {
  if (!options?.acknowledgeExistingV4CiphertextBecomesUnreadable) {
    throw new Error(
      "rotateIdentityRoot() replaces the root; any v4 ciphertext encrypted under the previous root will no " +
        "longer be derivable from it. Pass { acknowledgeExistingV4CiphertextBecomesUnreadable: true } to proceed.",
    );
  }
  if (self.identityRootEnvelope && !self.identityRootUnwrapped) {
    throw new Error(
      "An identity root exists for this kernel but is locked. Call unlockIdentity(password) first — " +
        "rotateIdentityRoot() must not be callable without proving ownership of the current root.",
    );
  }
  const previousRootId = self.identityRootId;
  const { rootId, root } = generateIdentityRoot();
  try {
    self.identityRootEnvelope = await wrapIdentityRoot(root, rootId, newPassword, options.iterations);
    self.identityRootId = rootId;
    wipe(self.identityRootUnwrapped);
    self.identityRootUnwrapped = Uint8Array.from(root);
  } finally {
    wipe(root);
  }
  // Every scope's v4 migration status is now moot against the new root.
  self.migrationV4 = {};
  self.migrationV4Values = {};
  bumpSecretEpoch(self);
  return { rootId, previousRootId };
}

/**
 * Export the wrapped envelope for backup. Already ciphertext — safe to
 * write to a file — but the caller is responsible for where it ends up;
 * this function does no I/O. Never returns the raw root.
 */
export function exportIdentityRootBackup(self: MEKernelLike): IdentityRootEnvelope {
  if (!self.identityRootEnvelope) {
    throw new Error("No identity root exists for this kernel yet.");
  }
  return cloneIdentityRootEnvelope(self.identityRootEnvelope);
}

/**
 * Restore a previously-exported envelope. Per Option B this NEVER unlocks
 * automatically and NEVER restores branch secrets — the caller must still
 * call `unlockIdentity(password)` afterward. Refuses to clobber an existing,
 * different root unless `force` is set, to avoid an accidental cross-
 * identity overwrite.
 */
export function importIdentityRootBackup(
  self: MEKernelLike,
  envelope: IdentityRootEnvelope,
  options: { force?: boolean } = {},
): { rootId: string } {
  assertIdentityRootEnvelopeShape(envelope);
  if (self.identityRootEnvelope && self.identityRootEnvelope.rootId !== envelope.rootId && !options.force) {
    throw new IdentityRootFormatError(
      "A different identity root already exists for this kernel. Pass { force: true } to replace it explicitly.",
    );
  }
  self.identityRootEnvelope = cloneIdentityRootEnvelope(envelope);
  self.identityRootId = envelope.rootId;
  wipe(self.identityRootUnwrapped);
  self.identityRootUnwrapped = null;
  bumpSecretEpoch(self);
  return { rootId: envelope.rootId };
}

/**
 * Called on a full identity transition (`ME_RESEED` — new `(who, secret)`
 * compound seed, i.e. a different `#seed`/`identityHash` entirely). Per
 * the task's decision #2: "Una transición de identidad no debe conservar
 * acceso mediante cachés o una raíz de la identidad anterior." Wipes every
 * trace of the previous identity's root — the new identity starts with no
 * root until it explicitly creates or imports one. This is intentionally
 * NOT the same code path as `lockIdentity()` even though the effects
 * overlap, because a reseed additionally discards the envelope and
 * migration bookkeeping themselves (locking keeps the envelope — you can
 * unlock again later; reseeding to a different identity cannot, since the
 * envelope belonged to a `#seed` this kernel no longer has).
 */
export function resetIdentityRootForIdentityTransition(self: MEKernelLike): void {
  wipe(self.identityRootUnwrapped);
  self.identityRootUnwrapped = null;
  self.identityRootEnvelope = null;
  self.identityRootId = null;
  self.migrationV4 = {};
  self.migrationV4Values = {};
  // localSecrets/localNoises/branchStore already get reset by the existing
  // ME_RESEED path via rebuildIndex()+bumpSecretEpoch(); nothing here
  // duplicates that. This function only owns identity-root-specific state.
}
