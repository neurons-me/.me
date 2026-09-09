# Identity-Bound Secret Derivation

**neurons.me / suiGn**
**Status: IMPLEMENTED (v2). §9.1 (memory.expression plaintext) and §9.2 (Monad integration) are now
CLOSED — see their entries in §9 for what "closed" concretely means and how it was verified. §10
records a subsequent adversarial security battery run against this implementation: 3 real bugs found
and fixed (a closed-scope-becomes-public leak, an unauthenticated root rotation, and a non-atomic
Monad snapshot save), each with a regression test — see §10 for the summary and
`tests/Security/README.md` for the full detail.** This
document originally recorded a target shape with nothing implemented (2026-09-08 draft). It now
describes a working, closed-loop version: a private, identity-bound root (`identity-root.ts`), a v4
blob format that requires it (`crypto.ts`), kernel wiring for its lifecycle (`identity-context.ts`),
v3→v4 migration (`identity-migration.ts`), a disk-safe snapshot contract (`core-snapshot.ts`) whose
memory log no longer carries plaintext for any protected write (`core-write.ts`), and a real,
process-boundary-verified integration with `modules/monad/Typescript`. Every claim below about
*current* code is fact-checked against the code in this PR, not inferred — file + line/function
references are given throughout. Section 9 ("Limitaciones y pendientes") is the authoritative list of
what is **not** done as of the original implementation; §10 is the authoritative list of what the
subsequent adversarial battery found, fixed, and left open — do not assume anything absent from both
lists is finished.
**License:** CC0 1.0 Universal — Public Domain

---

## 0. The one-sentence version

Branch-secret keys (`_()`, `~()`) can now optionally bind to a private, random, per-identity root
(v4) in addition to the caller-supplied path/secret/noise strings v3 already used — closing the
structural gap where two kernels with different seeds but identical `_()`/`~()` values produced
byte-identical keys. A new envelope-encrypted root lifecycle (create/unlock/lock/change-password/
rotate/backup/restore) lives in the kernel itself, and `exportSnapshot()` no longer carries real
`_()`/`~()` values in the clear — only a redacted topology placeholder, so a disk-persisted snapshot
(as `modules/monad/Typescript/src/kernel/manager.ts`'s `saveSnapshot()` writes) never leaks session
secrets. v3 is completely untouched: existing ciphertext, existing derivation functions, and existing
default behavior for any kernel that never opts into an identity root are all unchanged.

## 1. Where this started (historical — verified against the pre-this-PR code, kept for context)

**`identityHash` was public, `#seed` was private, and neither touched branch-key derivation.**

- `deriveIdentityHash(seed)` (`me.ts`) is a one-way hash of the seed, returned by `.prove()` and the
  `identity()` runtime method — designed to be disclosed, like a public key.
- `#seed` itself is never returned by any public method.
- Branch-key material came from `collectSecretChainV3` (`secret-context.ts`) →
  `deriveSecretMaterialV3`/`deriveBlobV3Keys` (`crypto.ts`). The chain built there is
  `[domain, mode, scopePath, anchorPath, noiseBoundary, ...lineageSegments]`. Neither `#seed` nor
  `identityHash` appears anywhere in that call chain — **this is still true of v3 today**, by design
  (§4 below: v3 is frozen, not modified).
- Consequence (pre-this-PR, and still true for any kernel/scope that stays on v3): two kernels with
  different seeds that declare the same path with the same `_()`/`~()` values derive byte-identical
  `encKey`/`macKey`. v4 (§3) is the opt-in fix; v3 keeps this property because changing it would be
  the exact "modify v3" move decision #4 forbids.

**`reseed()` (`ME_RESEED`) recomputed `#seed`/`identityHash` from scratch and did not clear
`localSecrets`/`localNoises` — a real identity-transition leak, now fixed (§4.5).**

**The kernel persisted a full, plaintext-enumerable index of the secret tree.** `exportSnapshot()`
serialized `localSecrets`/`localNoises` verbatim, and a branch-scoped write's memory-log `value` field
held the plaintext value even though the *same* value was correctly encrypted separately into
`branchStore`. Both are fixed in this PR (§5).

## 2. Design goals (unchanged from the original draft — this is still the contract)

1. Public navigation stays free. A path with no `_()` anywhere in its ancestry needs no secret to
   read or write.
2. A declared `_()` scope requires private identity material *and* its own secret. Neither alone is
   sufficient.
3. Descendants inherit an unlocked scope for the session — no re-prompting per node.
4. Nested `_()` adds to the applicable lineage; `~()` cuts inherited *secrets*, never the identity
   dependency.
5. Option B: no silent recovery. Unlocking your identity does not automatically unlock every branch.
6. Nothing session-only reaches disk unencrypted.
7. After a restart with no secrets supplied, the kernel still knows a path is protected.
8. Password change ≠ root rotation.

All eight are implemented and covered by `tests/identity-bound-secrets.test.ts` (§8).

## 3. What's implemented

### 3.1 Placement decision (task decision #1)

**The wrapped root envelope lives inside `.me` kernel state itself, next to `#seed`** —
`identity-context.ts`'s header comment records the reasoning in full; summary:

- The kernel already privately owns material of this kind (`#seed`). The envelope is ciphertext and
  needs no additional trust boundary.
- **No inverse dependency from the kernel toward Cleaker** — `identity-context.ts`,
  `identity-root.ts`, and `identity-migration.ts` import nothing from `cleaker`. This was a hard
  constraint from the task and is satisfied by construction (verify: `grep -rn "cleaker" src/identity-*.ts`
  returns nothing).
- Monad's persistence (`modules/monad/Typescript/src/kernel/manager.ts`'s `getKernel()`/
  `saveSnapshot()`) already round-trips whatever `exportSnapshot()`/`hydrate()` produce through
  `snapshot.json`. Because the envelope is ciphertext, it rides that existing pipeline for free — no
  Monad-side code changes were needed for the envelope to persist and survive a restart (verified in
  §8's monad integration check).
- Cleaker's claim record (`modules/cleaker/Typescript/typedocs/Surface-Identity-Claims.md`) remains a
  valid *alternative* location for a future multi-device recovery story. Nothing about this module's
  shape forecloses moving the envelope there later — it's a self-contained JSON value with no
  kernel-internal pointers.
- No private material is ever written to a public claims registry. `identity-context.ts` /
  `identity-root.ts` never call any Cleaker or netget claims API.

### 3.2 Root lifecycle (`identity-root.ts` + `identity-context.ts`)

The root is 32 CSPRNG bytes (`generateIdentityRoot()`, `identity-root.ts`), generated once, with its
own entropy — **not** derived from `(username, password)`, unlike `deriveCompoundSeed`. It is wrapped
(envelope-encrypted) under a password-derived key; the password unlocks the root, it never
regenerates it.

Operations, each a distinct, separately-tested function per task decision #2 — **none of these are
interchangeable, and none is silently substituted for another anywhere in the code**:

| Operation | Function | What changes | What doesn't |
|---|---|---|---|
| Create | `ME#createIdentityRoot(password)` | New root+envelope; unlocked this session | — |
| Unlock | `ME#unlockIdentity(password)` | Session gets the unwrapped root | Envelope, root bytes |
| Lock | `ME#lockIdentity()` | Wipes unwrapped root, `localSecrets`/`localNoises`, all derived-key/plaintext caches | Envelope |
| Change password | `ME#changeIdentityPassword(old, new)` | Envelope re-wrapped under a new key | Root bytes, rootId, all branch ciphertext |
| Rotate | `ME#rotateIdentityRoot(newPassword, {acknowledge...})` | Brand-new root+rootId | v3 ciphertext (unaffected); v4 ciphertext under the OLD root becomes undecryptable — explicit ack required, see §6 |
| Backup | `ME#exportIdentityRootBackup()` | Returns the wrapped (ciphertext) envelope | Nothing — read-only |
| Restore | `ME#importIdentityRootBackup(envelope, {force?})` | Envelope replaces current one | Never unlocks; never restores branch secrets |
| Identity transition | `ME_RESEED` (`me("who","secret")`) | Wipes root, envelope, migration state, `localSecrets`/`localNoises` entirely | — (new identity starts from zero) |

"Reseed" in the pre-existing codebase sense (`ME_RESEED`, changing `(who, secret)` → a new `#seed`)
is **never** treated as a root-lifecycle password change — they are unrelated operations that happen
to share the English word "reseed" in different places; this doc and the code both keep them
textually and functionally separate (`rotateIdentityRoot` vs `ME_RESEED`).

### 3.3 Cryptography

**Two different KDF problems, two different primitives — task decision requires this distinction
explicitly (decision #4: "KDF de contraseña frente a KDF de claves"):**

1. **Password → wrapping key** (`identity-root.ts`'s `deriveWrapKey`): **PBKDF2-HMAC-SHA256** via
   WebCrypto `subtle` (already a dependency of this package for HKDF/ECDH/Ed25519 in `crypto.ts` — no
   new package). 600,000 iterations by default (`DEFAULT_PBKDF2_ITERATIONS`), OWASP 2023 guidance for
   PBKDF2-SHA256; a hard floor of 210,000 (`MIN_PBKDF2_ITERATIONS`) prevents a caller from
   accidentally weakening it; a 16-byte random salt per wrap. This is deliberately **not** a fast
   hash and **not** HKDF alone — the doc's own §6 (now folded into this section) already named that
   exact mistake to avoid.
   - **Why PBKDF2 and not Argon2id/scrypt**: both would be preferable in the abstract (memory-hard),
     but neither has a maintained, zero-new-dependency binding that behaves identically under Node
     and browser WebCrypto the way PBKDF2 does (it's a WebCrypto standard primitive). Introducing
     Argon2id is a real, reasonable future improvement — not done silently here; flagged in §9.
2. **Root → branch keys** (`crypto.ts`'s `deriveSecretMaterialV4`): **HMAC-Keccak256**, the same
   primitive v3 already uses for its own derivation — appropriate because the root is already
   high-entropy (CSPRNG, 32 bytes), a different problem from stretching a low-entropy password.

**Authenticated encryption**: both layers use AEAD.
- The root envelope: **AES-256-GCM** via WebCrypto, random 12-byte nonce per wrap, and AAD binding
  `"this.me/identity-root/v1"` + format version + `rootId` (`identity-root.ts`'s `aadFor`) — so a
  ciphertext can't be replayed against a different rootId or format version even if the key matched.
- v4 blobs: the same HMAC-Keccak keystream+tag AEAD construction v3 already uses (`crypto.ts`,
  `encryptBlobV4WithDerivedKeys`/`decryptBlobV4WithDerivedKeys`) — same magic bytes, version byte
  `0x04` instead of `0x03`. `detectBlobVersion()` now returns `"v4" | "v3" | "v2" | "legacy"`.

**The root is structurally mandatory in v4, not an optional segment.** `deriveSecretMaterialV4(chain,
purpose, identityRoot)` uses `identityRoot` as the HMAC **key**, and the lineage `chain` as the HMAC
**message** — the exact opposite arrangement from how v3 folds every segment into one message. This
means there is no way to compute a v4 key without the root, and no lineage/noise manipulation could
ever "leave it out" the way an optional appended segment could — noise (`~()`) still cuts the lineage
*message* (which secrets are folded in), it structurally cannot cut the root (which isn't a chain
segment at all). `getOrDeriveV4Keys` (`secret-context.ts`) throws `IdentityLockedError` if no root is
unwrapped — callers on the read/write path catch this exactly like a failed decrypt (stealth-safe
`null`), never a fallback to a different format or to public.

**v3 stays exactly as it is.** `deriveSecretMaterialV3`, `deriveBlobV3Keys`,
`encryptBlobV3`/`decryptBlobV3` are byte-for-byte unmodified in this PR (`git diff` on `crypto.ts`
around those functions is empty — verify directly). Everything v4 adds is new functions alongside
them.

**Node/browser support**: everything new (`identity-root.ts`, the v4 additions in `crypto.ts`) uses
only `globalThis.crypto` (WebCrypto) and `TextEncoder`/`Buffer` fallbacks already used elsewhere in
this file — no Node-only or browser-only API. The package's existing `exports` map (`browser`/
`import`/`require`) needed no changes.

**Lock/context-change cache invalidation**: `bumpSecretEpoch` (`secret-context.ts`) now also wipes
and clears `v4KeyCache` in addition to the existing v3/branch/value caches; `lockIdentity()` calls it
after wiping the unwrapped root and `localSecrets`/`localNoises`.

**Documented limit on memory scrubbing**: `identity-context.ts`'s `lockIdentity()` doc comment states
this explicitly — `Uint8Array.fill(0)` overwrites the array's own backing store, but JavaScript has no
guaranteed memory-scrubbing primitive; the engine's GC, and anything that already copied bytes out of
these arrays before the wipe (e.g., a previously-decrypted JSON string still referenced somewhere),
are outside this module's control. This is a best-effort reduction of the exposure window, not a
guarantee of erasure.

### 3.4 Semántica del árbol (implemented, matches §2's goals)

- Public paths remain navigable without any unlock (`resolveBranchScope` unchanged for public paths).
- A child with no `_()` inherits the applicable protection from its nearest `_()` ancestor
  (`resolveBranchScope`'s ancestor walk — unchanged).
- Unlocking a scope (supplying its `_()` secret) makes its descendants navigable for the rest of the
  session (unchanged behavior; v4 adds an *additional* requirement — the identity root — on top of
  this, it doesn't relax it).
- A nested `_()` contributes its secret to the applicable lineage exactly as v3 already did
  (`collectLineageSegments`, shared verbatim between v3 and v4's chain collectors).
- `~()` cuts inherited *secrets* — `collectSecretChainV4` restarts the lineage exactly like v3's
  `collectSecretChainV3` does — but never the identity-root dependency, because the root isn't in the
  lineage list at all (§3.3). `~()`'s semantics were **not** changed into a random generator; it is
  still exactly "whatever value the caller supplies to `~(...)`" (`postulate`'s noise-call handling,
  `core-write.ts`, unmodified).
- Persistent topology vs. session secrets are now separated (§3.5) — a closed branch stays reported
  as closed after a restart even with no secrets/noise supplied, satisfying goal #7.
- No fallback to public read/write, and no silent ciphertext overwrite, on missing unlock material —
  `encryptForWrite` (`core-write.ts`) only ever picks v2 (explicit test escape hatch), v4 (root
  unlocked), or v3 (default) — there is no "give up and write public" branch. Reads that fail to
  derive v4 keys (`IdentityLockedError`) or fail AEAD verification both resolve to the pre-existing
  stealth-safe `null`/`undefined`, exactly like a v3 decrypt failure already did.
- Stealth stays honest for closed scopes: a caller without the right secret gets the same "nothing
  here" result whether the scope was never protected or is protected-but-locked — this was already
  true structurally (`readPath`'s stealth-blocking logic never branches on whether v4/root material
  exists) and nothing in this PR introduces a new observable difference between those two cases
  through `me()`, `explain()`, enumeration, or error messages. See §3.6 for what *is* observable on
  disk (metadata, not content).

### 3.5 Persistence (`core-snapshot.ts`)

`exportSnapshot()` (`SNAPSHOT_FORMAT_VERSION = 2`) now returns:

- `localSecrets`/`localNoises`: **every key present, every value replaced by `"***"`** —
  `redactSecretMap()`. This is the same placeholder `_()`/`~()` declarations already wrote into the
  memory log (`commitMemoryOnly(..., "_", "***", "***")`), reused deliberately so redaction reads
  consistently everywhere. This is the topology marker goal #7 asks for: `resolveBranchScope` only
  checks truthiness, so a hydrated kernel still correctly reports a scope as protected/closed with
  zero real secret material present.
- `identityRoot`: the wrapped envelope as-is (ciphertext, safe to persist), or `null`.
- `migrationV4`/`migrationV4Values`: per-scope / per-value-path migration status (`"pending"` |
  `"migrated"`) — not secret, just bookkeeping.
- `encryptedBranches`, `keySpaces`, `operators`, `memories`: unchanged in shape from before.

`hydrate()` restores all of the above; `identityRootUnwrapped` is **always** set to `null` after
hydrate — nothing in this PR ever auto-unlocks. `hydrate()` still accepts real `localSecrets`/
`localNoises` values if a caller explicitly constructs a snapshot that way (test fixtures, or a
controlled in-process hand-off) — the disk-safe guarantee comes from what `exportSnapshot()` chooses
to emit, not from `hydrate()` refusing real input; this is not the "silent recovery" Option B
forbids, because the caller is supplying the secret directly, not the kernel recovering it from
disk on its own.

**A second, independent leak was found and fixed in the same area**: `commitValueMapping`
(`core-write.ts`) previously set a branch-scoped write's memory-log `value` field to the plaintext
`expression` (`storedValue = expression`) even though the *same* value was correctly encrypted
separately into `branchStore` — this is the exact case the original draft's §1 named
("`storedValue = expression` — plaintext"). It's now `MEMORY_LOG_SECRET_PLACEHOLDER` ("***"). This
was verified safe to change with zero functional impact: `applyMemoryToIndex` (`core-index.ts`)
already skips index population for any `inSecret` path (`if (inSecret) return;`), and
`replayMemories`'/`learn()`'s generic-write case reconstructs from `memory.expression`, never
`memory.value` (`core-write.ts`) — so nothing anywhere reads `memory.value` back for a branch-scoped
write.

**`memory.expression` plaintext leak — CLOSED (see §9.1).** `commitValueMapping` (`core-write.ts`)
now redacts `expression` to `MEMORY_LOG_SECRET_PLACEHOLDER` ("***") at the exact same two points it
already redacted `value`, for both branch mode (unconditionally, `core-write.ts:827-828`) and value
mode (whenever the value is actually encrypted, `core-write.ts:839`) — the local variable is named
`loggedExpression` to make the distinction from the real `expression` used to build the encryptable
content explicit at the call site (`core-write.ts:773-846`). `replayMemories()`/`learn()`
(`core-write.ts:312-410`) no longer try to reconstruct a protected write's real content by re-running
this now-redacted placeholder through the encrypt pipeline — `applyGenericReplayWrite`
(`core-write.ts:446-460`) detects a redacted entry (`expression === MEMORY_LOG_SECRET_PLACEHOLDER`)
and re-appends it verbatim via `commitMemoryOnly` instead of calling `postulate()`. See §9.1 for the
full writeup, including the real architectural consequence this has for `replayMemories()`/`learn()`
(branch-scoped content is no longer reconstructable from the memory log alone — a `encryptedBranches`
transport is required too, mirroring `hydrate()`) and how `tests/identity-bound-secrets.test.ts`'s test
8 now proves both confidentiality (marker absence) and correctness (rehydrate + unlock + resupply
recovers the exact value) together, replacing the prior "KNOWN GAP" canary.

### 3.6 What this does NOT hide, by design

Per the task's explicit instruction not to overclaim: this PR does not attempt to hide *metadata*.
`DiskStore` (`instance-store.ts`, unmodified) still writes plaintext scope-path keys, chunk counts,
and ciphertext sizes to disk — `branchStore.listScopes()`/`listChunks()` already enumerate scope keys
in the clear, and that's unchanged. Nothing in this PR promises to hide access patterns, timing, or
which paths exist — only that a path's *content* and its *`_()`/`~()` declaration value* aren't
readable without the right root+secret, and that closed/absent are indistinguishable from the public
read surface (`me()`, `explain()`, enumeration, errors).

## 4. Compatibility and migration (v3 → v4)

- New protected writes use v4 **once a kernel has an identity root unlocked this session**
  (`encryptForWrite`, `core-write.ts`). A kernel that never calls `createIdentityRoot()`/
  `unlockIdentity()` sees **zero behavior change** — v3 stays the default, exactly as before. This is
  a deliberate, documented scope decision: making v4 unconditionally mandatory would require every
  existing test and caller across this monorepo to adopt an identity root before any `_()` write,
  which is a far larger blast radius than this task's "no debilites tests" / "conserva v3 intacta"
  constraints allow for a first version.
- v3 ciphertext stays readable indefinitely under its own path — `detectBlobVersion` dispatches by
  the blob's own version byte, and a v4 auth failure never falls back to attempting v3/legacy
  (`core.ts`, `secret-storage.ts` — both new `v4` branches `catch { return null; }`, matching the
  existing v3 branches' behavior exactly, no new fallback logic anywhere).
- **Migration** (`identity-migration.ts`) is scope-by-scope (branch) and path-by-path (value),
  resumable and idempotent:
  - `ME#migrateEncryptedBranchesToV4()`: for each `branchStore.listScopes()` entry whose secret is
    currently available AND the identity is unlocked, decrypts under v3, re-encrypts under v4,
    **verifies the fresh v4 blob decrypts back to the same plaintext before ever calling
    `setChunkBlob`** (`identity-migration.ts`'s `migrateBranchesToV4`) — the v3 blob is never touched
    until its v4 replacement is proven correct in memory first. Scopes whose secret isn't available,
    or when the identity is locked, are recorded in `self.migrationV4[scopeKey] = "pending"` and left
    completely alone. Already-v4 chunks are skipped (idempotent); v2/legacy chunks are left as-is
    (out of scope for this migration, not silently touched).
  - `ME#migrateEncryptedValuesToV4()`: root-scope value blobs. **Does not mutate historical memory-log
    entries** — doing so would break the hash-chain integrity axiom (A8,
    `tests/axioms.test.ts`). Instead it decrypts the current v3 value and re-asserts it through the
    normal write path (`commitValueMapping`), which appends a new, properly hash-chained memory entry
    that is automatically v4 (since the identity is unlocked) — the original v3-encrypted historical
    entry is left exactly as it was, which is correct for an append-only log, not a residual bug.
  - Both are covered end-to-end, including the interrupted → resumed → idempotent sequence, by
    `tests/identity-bound-secrets.test.ts` test 10.
- **No original is deleted before verification.** Branch migration verifies in-memory before the one
  and only write; value migration never touches the original at all (append-only). Neither migration
  path deletes old backups/snapshots — `exportSnapshot()`s taken before migration keep whatever
  exposure they already had (documented, not retroactively fixed — consistent with the original
  draft's §5).
- **Hydrate/import never auto-migrates or auto-activates legacy plaintext.** A snapshot with secrets
  in the clear (e.g. an old pre-redaction snapshot, or a hand-built legacy fixture) only becomes
  live/decryptable state if the caller explicitly supplies it as `localSecrets`/`localNoises` input to
  `hydrate()` — ordinary hydration of a *real* (v2-format) `exportSnapshot()` output never does this
  on its own, because real `exportSnapshot()` output is always redacted (§3.5).
- **Rotation is deliberately NOT a full platform in this phase**, per the task's explicit scope
  ("no implementes todavía una plataforma completa de rotación entre raíces"). `rotateIdentityRoot()`
  mints a new root/rootId and requires the caller to pass
  `{ acknowledgeExistingV4CiphertextBecomesUnreadable: true }` — it does **not** re-encrypt existing
  v4 scopes under the new root. `rootId` is tracked precisely (in the envelope, in the snapshot, in
  the migration-status keys) so a future rotate-and-re-encrypt pass has something correct to key off
  of; nothing here forecloses building it. v3 ciphertext is unaffected by rotation either way (it was
  never bound to any root).

## 5. Vocabulary: three different operations (kept from the original draft — now implemented as such)

- **Re-derive** — `getOrDeriveV4Keys`: recompute a branch key from the root + its secrets + path/noise
  context already held this session. Cheap, no data touched.
- **Rotate** — `rotateIdentityRoot()`: generate a new root and start using it going forward. Does not
  re-encrypt existing v4 data in this phase (§4). Real, costly operation once a full re-encrypt pass
  is added.
- **Recover** — `importIdentityRootBackup()` + `unlockIdentity()`: restore the SAME root from a
  backup. A random root with no configured recovery path and no successful unwrap is permanently
  lost, by construction — same category of risk as a BIP-39 seed phrase, not a new risk this feature
  introduces.

## 6. Corrections to the original draft (task decision #4)

- **Mapa actual vs. historial**: §1 above is now explicitly framed as history (pre-this-PR), and every
  claim about current behavior lives in §3 onward with direct references into the code that exists
  now, not a proposal.
- **Derivación v4 frente a modificación de v3**: confirmed and enforced — `deriveSecretMaterialV3` is
  byte-for-byte unchanged; v4 is entirely new functions (§3.3).
- **Estado bloqueado interno frente a stealth público**: `identityRootLocked`/`isIdentityUnlocked()`
  is kernel-internal bookkeeping (a plain boolean derived from whether `identityRootUnwrapped` is
  null) — it is never surfaced through `me()`, `explain()`, enumeration, or error messages. The
  *public* read surface only ever reports the pre-existing "closed"/stealth outcome (§3.4), regardless
  of whether the reason is "no `_()` secret supplied" or "identity locked" or "no root exists yet" —
  these three internally-distinguishable states collapse to the same external "nothing here."
- **KDF de contraseña frente a KDF de claves**: made explicit as two named, separately-documented
  primitives in §3.3 (PBKDF2 for the password; HMAC-Keccak for root→branch-key expansion) — the
  original draft's §6 flagged this as a distinction to make; it's now made.

## 7. API surface (new)

All of the following are plain methods on `ME` instances (reachable through the callable proxy, e.g.
`me.createIdentityRoot(...)`, exactly like the pre-existing `exportSnapshot()`/`hydrate()`):

```
hasIdentityRoot(): boolean
isIdentityUnlocked(): boolean
currentIdentityRootId(): string | null
createIdentityRoot(password: string, iterations?: number): Promise<{ rootId: string }>
unlockIdentity(password: string): Promise<{ rootId: string }>
lockIdentity(): void
changeIdentityPassword(oldPassword: string, newPassword: string): Promise<void>
rotateIdentityRoot(newPassword: string, options: {
  acknowledgeExistingV4CiphertextBecomesUnreadable: boolean;
  iterations?: number;
}): Promise<{ rootId: string; previousRootId: string | null }>
exportIdentityRootBackup(): IdentityRootEnvelope
importIdentityRootBackup(envelope: IdentityRootEnvelope, options?: { force?: boolean }): { rootId: string }
migrateEncryptedBranchesToV4(): { migratedScopes, migratedChunks, pendingScopes, skippedAlreadyV4, skippedOtherFormat, errors }
migrateEncryptedValuesToV4(): { migrated, pending, skippedAlreadyV4, errors }
```

`IdentityRootEnvelope` (`identity-root.ts`) is a plain JSON-safe object:

```
{
  v: 1,
  rootId: string,                 // public, non-secret identifier
  kdf: { name: "PBKDF2", hash: "SHA-256", iterations: number, salt: string /* base64url */ },
  aead: { name: "AES-256-GCM", iv: string, ciphertext: string /* base64url, tag appended */ },
  createdAt: number,
  updatedAt: number,
}
```

## 8. Tests run and results

All commands below were run from `me/Typescript` against this PR's code, on the built `dist/`
artifact where a test imports it (matching the project's existing convention).

- `npx tsc --noEmit` — pass.
- `npm run build` (includes the `test:prebuild` gate: TypeScript check, README examples, all-demos
  run, UMD build/smoke test, and `tests/phases.test.js`'s 11-phase fire test) — pass.
- `npm run test` (`test:ts`, `test:readme`, `test:demos:run-all`, `test:umd`, `test:contracts`,
  `test:identity-bound-secrets` — newly wired into this script, `test:phase2`, `test:phase3`) — pass,
  0 failures.
- Standalone suites not wired into `npm run test` but referenced by `CLAUDE.md`/`AGENTS.md`, run
  directly: `tests/axioms.test.ts` (13/13 axioms), `tests/fire.test.ts`, `tests/bind-namespace.test.ts`,
  `tests/reconstruction.test.ts` (32/32), `tests/secret-blob-v3.read.test.ts`,
  `tests/secret-blob-v3.write.test.ts`, `tests/secret-material-v3.test.ts`,
  `tests/storage.instance-store.test.ts`, `tests/me-uri.test.ts` — all pass.
- `tests/identity-bound-secrets.test.ts` — 11 tests, one per "PRUEBAS DE ACEPTACIÓN" item in the
  task — all pass. Test 8 no longer contains the "KNOWN GAP" canary — see §9.1: it now asserts the
  `BRANCH_VALUE_MARKER` is absent from the serialized snapshot AND that a fresh `ME` instance,
  hydrated from that same JSON, with the identity unlocked and the branch secret resupplied,
  recovers the exact original value (and the nested `vault.hidden` scope too) — confidentiality and
  correctness proved together, not confidentiality alone.
- **Deliberate test-file changes** (documented contract changes, not weakened assertions — see
  inline comments at each site): `tests/phases.test.js` (Phase 7A *and* 7B — 7A is a new change this
  round, see §9.1), `tests/contracts/dsl.contract.test.mjs` (three tests: the two already updated for
  the `value` leak, plus "mutation helpers preserve learn + replay semantics" updated this round for
  the `expression` leak), `tests/contracts/secret-blob-hardening.contract.test.mjs` ("replay from
  public memories preserves secret semantics", updated this round), `tests/storage.instance-store.test.ts`
  (one test), and `tests/secret-blob-v3.read.test.ts` (added a `withRealSecrets` helper) were updated
  because they asserted on a pre-existing insecure (or, for the two updated this round, now
  architecturally-impossible-to-honor-as-written) contract that this task explicitly asks to close.
  Each updated assertion now demonstrates the new, correct behavior: closed-after-hydrate/replay, then
  recovered by explicitly resupplying the secret (and, for branch-scope replay specifically, also
  restoring `encryptedBranches` — see §9.1).
  `tests/contracts/_fixtures/secret-blobs.fixture.mjs`'s branch/mixed/noisy/root-value fixture
  builders now overlay the real secret from the live source kernel back onto the exported snapshot
  (`withRealSecretsOverlay`), since those fixtures represent "the caller already knows this
  snapshot's secret," which `hydrate()` still legitimately supports (§3.5).
- `tests/contracts/dsl.contract.test.mjs`'s "mutation helpers preserve learn + replay semantics" test
  also gained a `waitNextMs()` helper and a documented reordering of its final `learn()` call. This is
  unrelated to secrecy — it fixes an unrelated, pre-existing timing fragility this task's hash-chain
  changes happened to newly expose: Axiom A9 ("Deterministic LWW: timestamp, then hash",
  `tests/axioms.test.ts:535-585`) resolves same-path writes that tie on `Date.now()`'s millisecond by
  comparing freshly-recomputed hashes, which is correct/deterministic by A9's own design but not
  guaranteed to preserve call order — see the inline comment at the fix site for the full trace. No
  production code was changed to work around this; only the test's own timing was made deterministic.
- **Monad persistence integration — now a real process-boundary test, not a reproduction.** See §9.2
  in full. `modules/monad/Typescript/tests/Identity/identityRootPersistence.process.test.ts` spawns
  two genuinely separate Node child processes that both import
  `modules/monad/Typescript/src/kernel/manager.ts` directly (the same module Monad's own HTTP handlers
  import) and exercises create-root → protected write → real `saveSnapshot()` (via Monad's real
  `setupPersistence()` SIGTERM handler, `src/kernel/persist.ts`) → process exit → **fresh process,
  fresh `_kernel` singleton** → `getKernel()` hydrates from the persisted `snapshot.json` → closed →
  `unlockIdentity()` → still closed (Option B) → resupply the branch secret → recovered, plus a
  wrong-password check. Run via `npx vitest run tests/Identity/identityRootPersistence.process.test.ts`
  from `modules/monad/Typescript` — 2/2 pass. The full `npm test` (425 tests, 37 files) and
  `npm run build` also pass with this test included.
- No test was weakened to hide a failure. Where a contract genuinely changed, the assertions were
  rewritten to check the new, correct behavior — never deleted or loosened to a no-op.

## 9. Limitations and what's still pending

### 9.1 The `memory.expression` plaintext gap — CLOSED

**What changed.** `commitValueMapping` (`core-write.ts:773-846`) now redacts `expression` to the same
`MEMORY_LOG_SECRET_PLACEHOLDER` ("***", `core-write.ts:771`) it already redacted `value` to, at both
sites: unconditionally for branch-scope writes (`core-write.ts:827-828`), and for value-mode writes
whenever the value is actually encrypted (`core-write.ts:834,839` — the pointer/identity-ref/`=`/`?`
carve-out that already left `value` unencrypted in value mode, §3.5, correctly leaves `expression`
un-redacted too, since nothing was ever hidden for that specific combination). `exportSnapshot()` and
the public `me.memories` getter (both backed by `toPublicMemory`, `memory-redaction.ts:7-10`) now never
carry real content in either field for a protected write.

**Why this isn't just a redaction tweak — the real behavioral change.** Before this fix,
`learn()`/`replayMemories()`'s generic write case (`core-write.ts:351` and `:407` before this change)
reconstructed a protected write by calling `self.postulate(path, expression, operator)` — i.e.,
re-running the real plaintext through the full encrypt pipeline again. Once `expression` is redacted,
doing that would silently overwrite real content with the literal string `"***"`. The fix
(`applyGenericReplayWrite`, `core-write.ts:446-460`, now called from both `learn()` at `core-write.ts:351`
and `replayMemories()` at `core-write.ts:407`) distinguishes two callers of `learn()` by the one signal
that actually tells them apart — whether `expression === MEMORY_LOG_SECRET_PLACEHOLDER`:
  - **A fresh, real write** (`expression` is real data, e.g. application code calling
    `me.learn({ path: "vault.balance", expression: 25 })` directly) still goes through the full
    `postulate()` pipeline, unchanged from before this fix — a protected target still gets properly
    encrypted.
  - **Replaying an entry from an already-exported memory log** (`expression` is the redaction
    placeholder) is no longer re-derived. Value-mode secrets reuse `value` directly via
    `commitMemoryOnly` — `value` already held real, reusable ciphertext (only `expression` was ever
    redacted for that mode), so this reconstructs the exact same readable state once the real secret
    is resupplied, with zero information lost. Branch-scope secrets re-append the log entry verbatim
    without touching `branchStore` — a single memory-log entry never carried branch content even
    before this fix (branch content lives in `encryptedBranches`, `core-snapshot.ts:50`); real content
    must now be restored separately by also copying `encryptedBranches`
    (`restored.encryptedBranches = source.encryptedBranches` — a pre-existing public getter/setter,
    `me.ts:287-292`), the same two-plane transport `hydrate()`/`exportSnapshot()` already use.

**Consequence for `replayMemories()`/`learn()` on their own (no `hydrate()` involved).** Replaying
*only* a memory log (via `execute("me://kernel:replay/memory", …)` or `learn()` per-entry) can no
longer, by itself, reconstruct branch-scoped secret content — this is the new, correct, secure
contract, and it is a real, deliberate behavior change from before this fix (where it worked, because
`expression` carried the plaintext). It does **not** affect `hydrate()`/`exportSnapshot()` — Monad's
actual persistence path (`modules/monad/Typescript/src/kernel/manager.ts`'s `getKernel()`/
`saveSnapshot()`) — because `hydrate()` never read `memory.expression` for branch reconstruction in
the first place; it restores `encryptedBranches` directly (`core-snapshot.ts:91-93`) and decrypts
lazily on read. Four pre-existing tests asserted the old (leaky) memory-log-alone contract as their
explicit purpose and were updated to prove the new one instead (closed after replay, then recovered
via `encryptedBranches` + resupplying the secret) — see §8 for the full list and the reasoning for
each. This is the same category of update §8 already documents for the `value` field fix in the prior
phase, extended to `expression`.

**Verification.** `tests/identity-bound-secrets.test.ts` test 8 now asserts the branch memory record's
`expression` field equals `"***"` and that `BRANCH_VALUE_MARKER` is absent from the serialized
snapshot (confidentiality), then hydrates a fresh `ME` instance from that exact JSON, unlocks the
identity root, resupplies both the branch secret and (since the original kernel declared `vault`'s
noise boundary before writing `vault.balance`, keeping the scope's derivation stable throughout) the
noise, and confirms `vault.balance` and the nested `vault.hidden.data` both recover their exact
original values (correctness) — proving both properties together, not confidentiality alone. `npx tsc
--noEmit`, `npm run build` (including the Phases 0-8 fire test, Phase 7A included — see §8), and
`npm run test` all pass with zero failures; the standalone suites not wired into `npm run test`
(`tests/axioms.test.ts` 13/13, `tests/fire.test.ts`, `tests/bind-namespace.test.ts`,
`tests/reconstruction.test.ts` 32/32, `tests/secret-blob-v3.read.test.ts`,
`tests/secret-blob-v3.write.test.ts`, `tests/secret-material-v3.test.ts`,
`tests/storage.instance-store.test.ts`, `tests/me-uri.test.ts`) were also re-run directly and all
pass. Phase 0's v3 (non-identity-root) secret-scope behavior and Phase 7B are unchanged in meaning —
their assertions were not touched by this round's changes (Phase 7B was already updated in the prior
phase for the `value` fix); Phase 7A *was* updated this round, since it hit exactly the
memory-log-alone-replay contract described above.

### 9.2 Real Monad integration — CLOSED

**The pnpm dependency pin.** `modules/monad/Typescript/package.json` pinned `"this.me": "^3.9.1"` — a
plain semver range against the **published npm package**. It is now `"this.me": "workspace:*"`
(`modules/monad/Typescript/package.json`), matching the pattern this same file already used for
`cleaker` (`"cleaker": "workspace:*"`). `workspace:*` was chosen over a version-bumped range like
`^4.0.1` deliberately: per pnpm's own workspace-protocol semantics, `workspace:*`/`workspace:^` *force*
resolution to the local workspace package unconditionally, whereas a plain semver range only resolves
locally when the local package's version happens to satisfy it — a coincidence that already broke once
(local `4.0.1` vs. the old `^3.9.1` pin) and could break again the next time either version changes.
No `.npmrc` exists anywhere in this monorepo (root or per-package), so pnpm uses its default
`node-linker` (isolated, symlinked `node_modules`).

**Lockfile diff.** Running `pnpm install` from the monorepo root (`pnpm@10.33.2`, matching the root
`package.json`'s `packageManager` field exactly) produced a **2-line diff** in `pnpm-lock.yaml`: only
`modules/monad/Typescript`'s `this.me` dependency entry changed, from `specifier: ^3.9.1` / `version:
3.9.1` to `specifier: workspace:*` / `version: link:../../../me/Typescript`. `this.me@3.9.1`'s package
entry remains elsewhere in the lockfile (another workspace member still depends on the published
range) — untouched, as expected. No other package in the lockfile changed. This is a narrow,
fully-explainable diff, not mass churn.

**Verified Monad actually loads the local build (not just the lockfile).** After `pnpm install`,
`modules/monad/Typescript/node_modules/this.me` is a real filesystem symlink —
`this.me -> ../../../../me/Typescript` — resolving (`realpath`) to
`/Users/suign/Desktop/Neuroverse/all.this/me/Typescript`, whose own `package.json` reports
`"version": "4.0.1"`. Beyond the symlink, a script run from inside `modules/monad/Typescript`
(`import ME from "this.me"`) confirmed at runtime that the resolved `ME` instance exposes
`createIdentityRoot`, `unlockIdentity`, and `hasIdentityRoot` — APIs that exist only in this local v4
build and never shipped in the published 3.9.1 package — decisive proof the import resolves to local
source, not the registry copy. `this.me`'s `package.json` `exports` map (`me/Typescript/package.json:10-17`)
points `import`/`browser` at `./dist/me.es.js`, so this is the same built artifact
`npm run build` (§8) produces from this PR's `core-write.ts` changes.

**Real process-lifecycle integration test.** `modules/monad/Typescript/tests/Identity/`:
  - `fixtures/identityPersistenceWriter.ts` — imports `getKernel()` from
    `src/kernel/manager.ts` and `setupPersistence()` from `src/kernel/persist.ts` (the exact modules
    Monad's own `server.ts`/`src/index.ts` import), creates an identity root, declares a branch
    secret, writes a protected value, prints a ready marker, then stays alive so the parent test can
    send it a real `SIGTERM` — exercising Monad's actual production graceful-shutdown save path
    (`setupPersistence()`'s handler calling `saveSnapshot()` then `process.exit(0)`), not a manual
    save call standing in for it.
  - `fixtures/identityPersistenceReader.ts` — a genuinely separate process (its own empty `_kernel`
    module singleton) pointed at the same `ME_STATE_DIR`, calling the same real `getKernel()`, which
    hydrates from the writer's persisted `snapshot.json` exactly like a restarted `monad.ai` process
    does, then calls `unlockIdentity()` and resupplies the branch secret directly on the kernel object
    — Monad has no HTTP route for this yet (§9.3), so the test reaches the kernel the same way any
    other in-process Monad code already does, which still exercises Monad's real process and real
    persistence code, the actual requirement.
  - `identityRootPersistence.process.test.ts` — the vitest test spawning both fixtures as real `node
    --import tsx` child processes (not the `tsx` CLI binary, to keep signal delivery to a single real
    process deterministic under load — see the inline comment at the fix site) and asserting the full
    round trip: create-root → protected write → live read confirms it → **SIGTERM** → real
    `saveSnapshot()` runs (asserted via both the child's own `[kernel] snapshot saved to` log line and
    `snapshot.json` existing on disk) → the on-disk JSON is checked to not contain the password,
    branch secret, or the written value in the clear → **fresh child process** → `getKernel()`
    hydrates → closed before unlock → still closed after `unlockIdentity()` alone (Option B) →
    resupplying the branch secret recovers the exact original value. A second test confirms a wrong
    password rejects (`unlockIdentity()` throws) instead of silently "succeeding."
  - Run: `cd modules/monad/Typescript && npx vitest run tests/Identity/identityRootPersistence.process.test.ts`
    — 2/2 pass. `npm test` (425 tests across 37 files, this one included) and `npm run build` both
    pass with no other test affected.

**What this does NOT include (correctly out of scope, not a gap left in silently).** Monad still has
no HTTP route to call `unlockIdentity`/`lockIdentity`/resupply a branch secret over the wire — the
reader fixture calls the kernel object directly, which the task's own instructions say is an
acceptable way to prove the round trip through Monad's real process and persistence code without
scope-creeping into designing an HTTP unlock API (see §9.3, unchanged).

### 9.3 Explicitly out of scope for this phase (per the task's own instructions)

- A full rotate-and-re-encrypt migration platform (§4's rotation section).
- Social recovery, and any "remember this branch's secret for me" vault feature (Option B's
  explicitly-deferred opt-in vault — nothing in this PR persists `_()`/`~()` values anywhere).
- Monad HTTP routes to call `unlockIdentity`/`lockIdentity`/etc. over the wire — this PR (including
  this round's process-lifecycle test, §9.2) is kernel-level only. `modules/monad/Typescript/src/http/`
  was not touched. Wiring this up is real, separate work (auth model for who's allowed to unlock which
  kernel's identity over HTTP, session handling, etc.) that needs its own design pass, not a mechanical
  extension of this PR.
- Cleaker involvement of any kind (§3.1) — by design, not by omission.
- Hiding on-disk *metadata* (scope-path keys, chunk counts/sizes) — §3.6.
- Argon2id/scrypt as the password KDF instead of PBKDF2 — §3.3 records the rationale for the current
  choice and that this is a reasonable future improvement, not a dismissed option.
- v2/legacy branch or value blob migration to v4 — `identity-migration.ts` only handles v3→v4; v2/
  legacy chunks are left untouched (use the pre-existing `migrateEncryptedBranchesToV3()` first if a
  v2→v3→v4 path is needed).

### 9.4 Password/format validation limits (documented, not exhaustive)

`identity-root.ts` enforces a password length floor of 8 characters and a ceiling of 1024, and a
PBKDF2 iteration floor/ceiling — basic guards against obviously-wrong input, not a password-strength
policy (out of scope, same as the original draft already said about the KDF choice itself).

## 10. Adversarial security battery (post-implementation)

**Status: CLOSED for this round.** After the implementation above closed §9.1/§9.2, a separate
adversarial testing pass ran against it — `tests/Security/*.test.ts` (this package) and
`modules/monad/Typescript/tests/Security/*.test.ts` (Monad), full attack model, commands, and
requirement→test matrix in `tests/Security/README.md`. Summary here; that README is the source of
truth for detail.

**Three real bugs found and fixed, each with a minimal reproduction and a regression test** (full
repros in the README):

1. **A closed scope could become public.** `commitValueMapping` (`core-write.ts`) only ever checked
   `self.localSecrets` (this session's current `_()` declarations) before deciding whether a write was
   protected. Once that map was empty for a scope — most simply, right after `lockIdentity()` — a write
   to a path that scope had genuinely, persistently protected fell through to the same code path used
   for paths that were NEVER protected, writing the caller's plaintext straight into the public memory
   log and index. Fixed with a new check, `hasExistingProtectedAncestor` (`core-write.ts`): before
   treating a write as public, it checks whether the target path falls under a scope that already has
   real ciphertext in `self.branchStore`, independent of whether that scope's secret is active this
   session. If so, the write is refused the same way a wrong-secret write already was — no plaintext,
   no ciphertext mutation, a redacted memory-log placeholder for audit continuity. A related second leak
   was found while fixing this: `applyMemoryToIndex` (`core-index.ts`) re-resolves scope membership at
   INDEX-REBUILD time, which can lag session state (the clearest case: `ME_RESEED` clears
   `localSecrets` and then replays the whole log via `rebuildIndex()`) — without a second guard, a
   historical write's `"***"` redaction placeholder would land in the public index as if it were real
   content, distinguishing "something was written here" from "nothing ever was" and weakening the
   closed/absent indistinguishability §3.4 promises. Fixed with a direct guard in
   `applyMemoryToIndex`: an entry whose `value` AND `expression` are both the redaction placeholder is
   never index-eligible, regardless of what the current-session scope resolution says.
2. **`rotateIdentityRoot()` had no authentication gate.** Every other credential-changing operation
   (`changeIdentityPassword`) verifies the OLD password first; `rotateIdentityRoot` verified only a
   boolean acknowledgement flag — not even that the identity was currently unlocked. A caller holding a
   bare reference to a LOCKED kernel could destroy and replace the owner's real root with zero password
   knowledge. Fixed (`identity-context.ts`): rotating an EXISTING root now requires the identity to
   already be unlocked this session — the same trust bar `changeIdentityPassword` already enforces.
   Minting a first root via rotate on a kernel with no existing envelope is unaffected.
3. **Monad's `saveSnapshot()` was not crash-safe.** `writeFileSync(snapshotPath, ...)` wrote in place;
   a process killed mid-write could leave a truncated file, and `getKernel()`'s existing
   catch-and-warn fallback would then start a fresh, near-empty kernel — whose NEXT `saveSnapshot()`
   would silently overwrite the truncated file with that near-empty state, destroying the last GOOD
   snapshot, not just the unconfirmed write. Fixed (`modules/monad/Typescript/src/kernel/manager.ts`):
   `saveSnapshot()` now writes to a temp file and `renameSync`s it into place (atomic at the filesystem
   level); `getKernel()` now quarantines a corrupted file (renamed aside with a timestamp) before
   falling back to a fresh kernel, so a later save can't silently erase it.

**Real characteristics documented, not changed** (verified safe — fail closed, no leak — and out of
this task's contract to alter): noise (`~()`) reflects the CURRENT session's state, not a per-write
snapshot of it, so declaring noise on a scope after an earlier write to it makes that write unreadable
until the original context is restored — inherited unchanged from v3's shared
`collectLineageSegments`/`findActiveNoiseBoundary`, so changing it would mean modifying code this task's
own contract keeps frozen; `hydrate()`'s redacted noise placeholder acts as an ACTIVE (permanently
mismatching) value rather than "no noise," so a caller must explicitly re-declare the real value after
a restore, not just leave it alone; an old envelope copy taken before a password change still opens
with the old password (no server-side revocation list exists or is claimed); and mixed v3/v4 blobs in
one scope are read via whichever format the blob itself declares, even with the identity unlocked —
the documented compatibility contract (§4), not a downgrade bypass, since a v3 blob still requires its
own correct v3-derivable secret.

**Known gaps, left open rather than assumed away:** no rollback/freshness detection exists for branch
ciphertext (an attacker with write access to `encryptedBranches` could replay an OLDER, still
validly-authenticated chunk from the same scope+secret+root — the AEAD tag alone can't detect this);
concurrent writers to the same Monad `ME_STATE_DIR` are documented as unsupported (last save wins, no
merge, no corruption), not silently assumed to work; no SIGKILL-during-migration test exists
specifically (migration only becomes durable via the already-tested `saveSnapshot()` path, so there is
no separate migration-persistence step to interrupt); and this remains adversarial testing, not an
independent cryptographic audit — see `tests/Security/README.md` §7 for the complete, unabridged list.

Commands: `npm run test:security` (this package, wraps `tests/Security/run-all.mjs`); from
`modules/monad/Typescript`, `npm run test:security` (`vitest run tests/Security/ tests/Identity/`).
Both wired into each package's full `npm run test`/`npm test`. All sections green as of this writing —
verify directly rather than trusting this line as it ages.

## 11. Root-scope write-after-lock — CLOSED

Found by `typedocs/Architecture/Identity-Namespace-Recovery-Audit.md` §0 (a follow-up research pass,
not this section's own battery): §10's `hasExistingProtectedAncestor` fix only checked
`self.branchStore.listScopes()`, which branch-mode secrets (`me.somePath["_"](...)`) populate but
value-mode/root-scope secrets (`me["_"](...)`, no named branch) never do. Reproduced and confirmed
directly: after `lockIdentity()` (which used to wipe `localSecrets` down to `{}` with no trace left),
a write to a root-secret-protected path fell through every check into the plain public branch,
persisting real plaintext.

**Fixed** with a new, durable `self.protectedScopeKeys: Set<string>` (`kernel-state.ts`) — every scope
key ever passed to `_()`, including the root scope (`""`), tracked independently of `localSecrets`'
live values and deliberately NOT cleared by `lockIdentity()` (only by a full identity transition,
`ME_RESEED`/`replayMemories`). `hasExistingProtectedAncestor` (`core-write.ts`) now consults it first,
falling back to the `branchStore` check for defense in depth. The refusal path was also corrected to
restore (not delete) any pre-existing index value for the target path — the original fix's blanket
`delete self.index[pathStr]` was itself silently destructive for value-mode paths, since (unlike
branch-mode, whose real ciphertext lives entirely in `branchStore`) `self.index[pathStr]` **is** the
actual retrievable ciphertext for a value-mode path; deleting it would have made the ORIGINAL
pre-attack value unrecoverable too, not just refused the attack. Regression tests:
`tests/Security/root-scope-lock.test.ts` (6/6) — the exact repro, no-modification/full-recovery,
stealth for a never-written-before leaf, a branch-mode non-regression check, and an unprotected-path
non-regression check.

**Found during the same investigation, reported, deliberately NOT fixed this round** (out of the
demonstrated bug's scope — this is data loss, not a public-plaintext leak, and closing it properly
needs `computeEffectiveSecret` to detect a placeholder-tainted derivation chain, not a local check):
a write immediately after `hydrate()` (restart), without resupplying the root-scope secret, does NOT
leak plaintext — `hydrate()`'s `localSecrets[""] = "***"` placeholder makes `computeEffectiveSecret`
derive a non-empty but WRONG key, so the write silently succeeds as real, well-formed ciphertext
(confirmed: `b64u:...`-prefixed, `isEncryptedBlob()`-recognized) — but one encrypted under a key nobody
can ever reconstruct, since `"***"` was never the real secret. A genuinely fresh instance given the
REAL secret afterward gets `null`, not the written value: silent, permanent data loss. Documented and
pinned with its own canary test in `tests/Security/root-scope-lock.test.ts` (last case) so it cannot
regress-by-being-forgotten; must be closed before this mechanism is trusted for real writes performed
in the window right after a restart and before the owner re-supplies their scope secrets.

## 12. Axiom A9 (LWW) — live/rebuild divergence found and closed, formulation updated

Not an Identity-Bound-Secrets bug specifically, but found while chasing a flaky regression test from §11:
two writes to the SAME path sharing a millisecond `timestamp` could make a LIVE kernel read one value
while `hydrate()`-ing that same kernel's own `exportSnapshot()` read a DIFFERENT one — reproduced
deterministically (forced-equal timestamps, not millisecond-collision luck) on a plain PUBLIC path,
nothing secret-specific. Root cause and the first fix (a shared `compareLWW` + `self.indexWinner`,
core-index.ts) are documented in full at `tests/Security/lww-index-consistency.test.ts`'s header.

That first fix then exposed a real limitation in A9's original mechanism against something more basic:
ordinary SEQUENTIAL writes on one process (e.g. the README's own `me.order.price(100);
me.order.price(200);` reactivity example) can also share a millisecond, and `(timestamp, hash)` has no
notion of "which happened after which" — it compares content hashes, which can just as easily favor
the FIRST write as the second. This is a revision of A9, not a bugfix to a rule that was simply wrong:
the axiom's INTENT (the same set of operations converges to the same result regardless of arrival
order) holds throughout; what changed is the ordering MECHANISM. Fixed with a monotonic per-instance
logical clock (`Memory.seq`, types.ts — Lamport-style scalar counter) that decides ties between modern
entries before hash ever gets consulted; `timestamp` stays on the record for display only. Records that
predate `seq` still resolve via the original `(timestamp, hash)` mechanism, unchanged — see
`compareLWW`'s legacy branch, core-index.ts. Full formulation in `typedocs/Axioms.md`'s A9 section
(updated) and `tests/axioms.test.ts`'s A9 case (updated — its own historical hash-tiebreak expectation
for the same-timestamp case was correct under the mechanism A9 used at the time, not wrong; the test's
comments say so explicitly, not silently replaced).

Verified: the README example itself (now a named regression test), sequential writes under a forced
identical timestamp across many trials, sequential writes surviving the physical clock moving
BACKWARD between them, live-vs-rebuild agreement (including decrypted, not just raw-ciphertext,
agreement for protected paths), the same set of writes converging regardless of replay/arrival order,
delete/rehydrate not leaking stale winner or logical-clock state, and legacy (pre-`seq`) entries still
resolving via the original `(timestamp, hash)` rule unchanged — `tests/Security/lww-index-consistency.test.ts`,
10 cases. Not touched: `invalidateFromPath`/derivation recompute is still called unconditionally
regardless of whether a write actually won its LWW comparison (a minor, pre-existing, out-of-scope
inefficiency, not a correctness issue — flagged, not fixed, per the task that authorized this fix).
Not touched either: the Rust port's own equivalent ordering logic, if any — this fix is TypeScript-only;
a Rust parity pass was not part of this task and is a known follow-up.
