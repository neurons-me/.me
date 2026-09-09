# Identity-Bound Secrets — Adversarial Security Battery

Status: **active, all tests green** (see "Comandos" for how to verify that yourself).
This battery is additional adversarial testing on top of the already-implemented
and already-closed Identity-Bound Secrets feature described in full in
[`../../typedocs/Identity-Bound-Secrets.md`](../../typedocs/Identity-Bound-Secrets.md).
Read that document first — this README does not repeat the design, only the
adversarial coverage built on top of it.

This is not a cryptographic audit. It is a structured attempt, by one engineer
using the tools above, to break the stated contract from the outside — and,
where it broke, to fix it within that contract and prove the fix with a
regression test. Treat it as one input to a real security review, not a
substitute for one.

---

## 1. Attack model and its limits

Five actor/state classes, kept explicitly distinct throughout every test file
(each test that touches one of these says so in its own name/comment):

| # | Actor | What they have | What they must NOT get |
|---|---|---|---|
| A | Storage thief | A full copy of `encryptedBranches`/`exportSnapshot()` output, no credentials | Plaintext of anything protected |
| B | Sibling identity | Same paths, same `_()`/`~()` secret *strings*, a **different** identity root | Another identity's plaintext, even with byte-identical secrets |
| C | Owner, identity unlocked, branch secret not supplied | A live, unlocked kernel reference | Branch content whose `_()` wasn't resupplied this session (Option B) |
| D | Stale/incomplete/manipulated storage | Tampered, truncated, or old-format blobs | Successful decrypt of tampered data; corruption of what wasn't touched |
| E | Process interrupted mid-operation | A kill signal at an arbitrary point during save/migration | A corrupted on-disk file, or silent loss of already-durable state |

**What this battery explicitly does NOT promise, and never claims to test:**

- **Protection against an attacker who controls the unlocked process itself.**
  If code runs inside a kernel that is already unlocked with the right branch
  secrets supplied, it can read whatever that session can read — that is not a
  bug, it's what "unlocked" means. `root-lifecycle.test.ts`'s rotate-auth
  regression is the one place this line gets close: it closes a gap where a
  caller did *not* need to unlock at all, which is different from "the
  process is already unlocked."
- **Metadata/traffic-analysis privacy.** Scope-path keys, chunk counts, and
  ciphertext sizes are plaintext on disk by design (§3.6 of the doc). Nothing
  here tries to hide that a path exists, only its content and its `_()`/`~()`
  declaration value.
- **Independent cryptographic review of the primitives themselves**
  (HMAC-Keccak256 construction, PBKDF2 parameterization). This battery tests
  the *implementation's* behavior under adversarial input — tampering,
  truncation, format confusion, KDF bounds — not the abstract security of the
  chosen primitives. See `crypto-tamper.test.ts`'s file comment for the
  explicit "roundtrip alone doesn't prove correctness" framing the task asked
  for.
- **Multi-writer/concurrency as a supported feature.** It isn't one; see
  §7 below.

**Confidentiality vs. metadata vs. rollback — kept as three different
properties, not conflated:**
- *Content confidentiality*: can an attacker read the plaintext? (crypto-tamper,
  isolation, leakage)
- *Metadata visibility*: what can an attacker learn just from shapes/sizes/keys
  existing on disk, independent of content? (documented, not hidden — §3.6;
  `leakage.test.ts`'s "protected state is internally recognizable... without
  ever surfacing" test is the one place this line is drawn precisely)
- *Rollback/staleness detection*: can an attacker present old-but-genuine
  ciphertext as current? **Not defended against or tested here** — this
  kernel has no anti-replay/freshness mechanism for branch ciphertext
  (a scope's stored blob is just "the current value"; there is no
  monotonic counter or freshness proof). Recorded as a real, unresolved gap
  in §8 below, not silently assumed away.

---

## 2. Comandos / how to run this

```bash
# Kernel-level battery (me/Typescript) — all sections, one command:
cd me/Typescript
npm run test:security                      # node tests/Security/run-all.mjs

# One section at a time (each is independently runnable and documents its
# own scope in its file header):
node tests/Security/isolation.test.ts
node tests/Security/scopes-and-noise.test.ts
node tests/Security/leakage.test.ts
node tests/Security/crypto-tamper.test.ts
node tests/Security/root-lifecycle.test.ts
node tests/Security/replay-restart.test.ts
node tests/Security/migration.test.ts
node tests/Security/generative.test.ts

# Pre-existing acceptance suite (11 tests, one per original task's
# acceptance list) — unchanged in contract, extended in coverage by this
# battery, not duplicated by it:
npm run test:identity-bound-secrets

# Full kernel test suite (now includes test:security):
npm run test

# Monad-level battery (real processes, real persistence) — modules/monad/Typescript:
cd ../../modules/monad/Typescript
npm run test:security                       # vitest run tests/Security/ tests/Identity/
npx vitest run tests/Security/snapshotDurability.test.ts
npx vitest run tests/Security/processInterruption.process.test.ts
npx vitest run tests/Identity/identityRootPersistence.process.test.ts   # pre-existing, not duplicated

# Full monad test suite:
npm test
npm run build   # tsc + prebuild vitest gate
```

Any source change to `me/Typescript/src/**` requires `npm run build` in
`me/Typescript` before the kernel-side security tests (which import
`dist/me.es.js`, matching this repo's existing convention) will see it —
this bit both this battery and the original PR; documented here so it
doesn't bite the next person.

---

## 3. Requirement → file/test matrix

Task section numbers refer to the original Spanish task specification this
battery was built from.

| Task § | Requirement (paraphrased) | File(s) |
|---|---|---|
| 1 | Isolation between identities | `isolation.test.ts` |
| 2 | Scopes, inheritance, noise | `scopes-and-noise.test.ts` |
| 3 | Information leakage (markers across snapshot/disk/replay/errors) | `leakage.test.ts`, plus extends `../identity-bound-secrets.test.ts` test 8 |
| 4 | Cryptographic/format manipulation | `crypto-tamper.test.ts` |
| 5 | Root lifecycle | `root-lifecycle.test.ts` |
| 6 | Replay and restart | `replay-restart.test.ts` |
| 7 | Migration v3→v4 | `migration.test.ts`, plus extends `../identity-bound-secrets.test.ts` test 10 |
| 8 | Real Monad processes | `modules/monad/Typescript/tests/Security/snapshotDurability.test.ts`, `processInterruption.process.test.ts`, plus pre-existing `modules/monad/Typescript/tests/Identity/identityRootPersistence.process.test.ts` |
| 9 | Generative/scale testing | `generative.test.ts` |

---

## 4. Fallos encontrados, reproducción mínima, corrección

Three real bugs were found and fixed. All three are demonstrated by a
regression test that fails on the pre-fix code and passes on the fix — not
just asserted.

### 4.1 A closed scope could become public simply by lacking its secret

**Severity: the most serious of the three — a genuine plaintext confidentiality leak.**

**Where:** `me/Typescript/src/core-write.ts`, `commitValueMapping`.

**Repro (pre-fix):**
```js
const me = new ME();
await me.createIdentityRoot("password");
me.vault["_"]("real-secret");
me.vault.leaf("REAL-SECRET-VALUE");   // properly encrypted

me.lockIdentity();                    // clears localSecrets — vault's secret is gone
me.vault.leaf("PLAINTEXT-INJECTED");  // NO error, NO secret required

// pre-fix: this returned "PLAINTEXT-INJECTED" — a real, public, plaintext
// write into me.index at a path that is supposed to be protected forever.
console.log(me("vault.leaf"));
```
`resolveBranchScope` only ever looks at `self.localSecrets` (this session's
*current* declarations). Once `lockIdentity()` clears it, a write to a path
that had real, persisted branch ciphertext from an earlier session fell
through `commitValueMapping`'s final `else` branch — the one meant for
genuinely-never-protected public paths — and got written straight into the
public memory log and index as plaintext. No error, no warning: a caller
who forgot the kernel was locked (or a restarted process that never got its
secret resupplied) would silently leak whatever it wrote next, in the clear,
at a path anyone with ordinary public read access could see. This is
squarely the exact case §2 of the task calls out: *"No permitir que un scope
cerrado se convierta en público por faltar secretos."*

**Fix:** `commitValueMapping` now checks, before falling through to a public
write, whether the target path falls under a scope that already has real
ciphertext in `self.branchStore` (`hasExistingProtectedAncestor`, new
helper) — independent of whether that scope's secret is active *this*
session. If it does, the write is refused the same way a
wrong-secret write already was: no plaintext persisted, existing ciphertext
untouched, a redacted placeholder in the memory log for audit continuity,
and the index entry removed so a subsequent public read still resolves to
the ordinary stealth-safe "nothing" — not the literal placeholder string.

**Regression test:** `scopes-and-noise.test.ts` → "a write with the WRONG
scope secret does not destroy the existing ciphertext" plus the direct
no-secret-at-all case is exercised throughout `isolation.test.ts` and was
the scenario the generative battery (`generative.test.ts`) surfaced first,
before being isolated into a minimal repro during triage.

**A second, related leak found while fixing the first:** the fix above
routes refused writes through the same "redacted placeholder in the memory
log" path branch-scoped writes already use — but `core-index.ts`'s
`applyMemoryToIndex` re-resolves `resolveBranchScope` *at index-rebuild
time*, which can be a different session state than write time (the clearest
real case: `ME_RESEED`/identity transition clears `localSecrets` and then
replays the whole memory log via `rebuildIndex()`). Without a second guard,
a *historical, legitimately-encrypted* write's `"***"` placeholder — not
real content, but a marker distinguishing "something was written here from
nothing ever was" — would land in the public index and be readable via an
ordinary `me()` call after a reseed, weakening the closed/absent
indistinguishability §3.4 documents. Fixed with a direct guard in
`applyMemoryToIndex`: a memory entry whose `value` and `expression` are both
the redaction placeholder is never index-eligible, regardless of what
`inSecret` computes for it right now.

**Regression test:** `isolation.test.ts` → "cache warming with an authorized
identity does not leak into a later different identity in the same process"
(reads `wallet.balance` after a full `ME_RESEED` and asserts `undefined`,
not the literal `"***"`).

### 4.2 `rotateIdentityRoot()` had no authentication gate at all

**Where:** `me/Typescript/src/identity-context.ts`, `rotateIdentityRoot`.

**Repro (pre-fix):**
```js
const owner = new ME();
await owner.createIdentityRoot("real-password");
owner.wallet["_"]("secret");
owner.wallet.balance(1010);
owner.lockIdentity();                 // never unlocked again

// Attacker holds a reference to `owner` but knows NO password at all.
await owner.rotateIdentityRoot("attacker-password", {
  acknowledgeExistingV4CiphertextBecomesUnreadable: true,
});
// pre-fix: this SUCCEEDED unconditionally. The owner's real envelope is
// gone, replaced by the attacker's; the owner's old password now fails.
```
Every other credential-changing operation in the lifecycle
(`changeIdentityPassword`) verifies the *old* password before acting.
`rotateIdentityRoot` verified nothing beyond a boolean acknowledgement flag
— it didn't even require the identity to be unlocked. A caller with a bare
object reference to a *locked* kernel (e.g. an exposed API surface, a
shared process, a supply-chain foothold) could destroy and replace the
owner's real root with zero secret knowledge — an authentication bypass
enabling takeover/denial-of-service, not merely a data-confidentiality
issue.

**Fix:** `rotateIdentityRoot` now throws if an envelope already exists and
the identity is not currently unlocked — the same trust bar
`changeIdentityPassword` already enforces (proof of prior ownership this
session). Minting a *first* root via `rotateIdentityRoot` on a kernel with
no existing envelope is unaffected (nothing to protect yet).

**Regression test:** `root-lifecycle.test.ts` → "REGRESSION (fixed bug):
rotateIdentityRoot() must require the identity to already be unlocked..."
— constructs exactly the repro above, asserts the call now rejects, and
confirms the owner's real root/data survived the attempt untouched and is
still recoverable with the real password.

### 4.3 `saveSnapshot()` was not crash-safe; a corrupted read could cascade into silent data loss

**Where:** `modules/monad/Typescript/src/kernel/manager.ts`.

**Repro (pre-fix, reasoned + now covered by tests):** `saveSnapshot()`
called `writeFileSync(snapshotPath, json)` directly, in place. A process
killed mid-write (`SIGKILL`, OOM-kill, host crash — §6E/§8 of the task)
could leave a truncated `snapshot.json`. `getKernel()`'s existing
catch-and-warn fallback then silently started a **fresh, near-empty**
kernel from that point on. The dangerous part: the *next* `saveSnapshot()`
call (e.g. the very next `SIGTERM`) would overwrite that same path with the
near-empty state — permanently destroying whatever the *last good* snapshot
actually held, not merely the unconfirmed tail write. This is exactly the
task's "ausencia de sobrescritura con un estado vacío tras fallo"
requirement, violated.

**Fix, two parts:**
1. `saveSnapshot()` now writes to a temp file in the same directory and
   `renameSync`s it into place. A same-directory rename is atomic at the
   filesystem level — a kill mid-write can no longer produce a truncated
   `snapshot.json`; either the previous complete file survives, or the new
   complete file replaces it.
2. `getKernel()`, on a hydration failure, now quarantines the bad file
   (renamed to `snapshot.json.corrupted-<timestamp>`) *before* falling back
   to a fresh kernel — so the next `saveSnapshot()` writes a new file
   instead of silently erasing the only copy of whatever was recoverable.

**Regression tests:**
`modules/monad/Typescript/tests/Security/snapshotDurability.test.ts` (deterministic, in-process):
- atomic write leaves no leftover temp file after success;
- a stale leftover temp file from a simulated kill never corrupts the real file;
- **the actual regression:** a corrupted `snapshot.json` is quarantined, and
  a subsequent `saveSnapshot()` from the fresh kernel does **not** delete or
  overwrite the quarantined evidence file;
- `saveSnapshot()` with no kernel ever instantiated is a safe no-op (doesn't
  fabricate an empty file).

`modules/monad/Typescript/tests/Security/processInterruption.process.test.ts`
(real child processes, real `SIGKILL`): a rapid write+save loop killed at a
randomized point, repeated across 6 independent trials — `snapshot.json`, if
present at all, is always valid JSON, never truncated. **Honesty about what
this specific test can and can't prove:** a `SIGKILL` landing precisely
mid-`writeFileSync`/mid-`renameSync` is a narrow timing window for a
small JSON payload, so these process trials mostly demonstrate "no
regression under realistic conditions" rather than reliably forcing the race
that the old code was vulnerable to — the *deterministic* proof of the fix
is `snapshotDurability.test.ts`'s corrupted-file-quarantine test, which
doesn't depend on timing at all. Documented here rather than overclaiming
what the process-level trials establish on their own.

---

## 5. Real characteristics documented, not changed (not bugs — verified, then explained)

Two behaviors were found during testing that look like bugs at first but are
either out of this task's contract to change, or are the kernel correctly
doing what it's designed to do. Both are covered by tests that assert the
*actual* (safe) behavior, not a silently-weakened one:

- **Noise is scope-wide and reflects the CURRENT session state, not a
  per-write snapshot of it** (`scopes-and-noise.test.ts`). Declaring `~()`
  on a scope *after* an earlier write to that same scope makes the earlier
  write unreadable under the new noise context — fails closed (no leak, no
  corruption, no throw), and is fully recoverable by re-deriving under the
  original context. This is inherited unchanged from v3
  (`collectLineageSegments`/`findActiveNoiseBoundary`, shared verbatim
  between v3 and v4) — fixing it would mean keying branch derivation by
  per-write-time context instead of per-scope current-session-state, an
  architecture change to code this task's contract says stays untouched
  ("v3 stays exactly as it is"). `tests/identity-bound-secrets.test.ts`'s
  own test 8 already avoids this exact ordering in its comments, for the
  same reason.
- **`hydrate()`'s redacted noise placeholder acts as an *active* (always
  mismatching) noise value, not "no noise"** (`scopes-and-noise.test.ts`,
  "DOCUMENTED FOOTGUN"). A caller reconstructing a session after `hydrate()`
  must explicitly re-declare the real `~()` value for any scope that had one
  — simply leaving it alone does not mean "no noise," it means "noise is
  active with a placeholder value that will never match." Safe (fails
  closed), but worth knowing before debugging a mysteriously-closed scope
  after a restart.
- **An old envelope copy taken before a password change still opens with
  the old password** (`root-lifecycle.test.ts`, "DOCUMENTED"). Changing a
  password does not revoke copies already obtained — there is no
  server-side revocation list in this design, by design (client-side
  envelope encryption). Documented explicitly so it doesn't get mistaken
  for an oversight later.
- **Mixed v3/v4 blobs in the same scope are read via whichever format the
  blob itself declares**, even with the identity unlocked
  (`crypto-tamper.test.ts`). This is the intentional, documented
  compatibility contract (§4 of the design doc: "v3 ciphertext stays
  readable indefinitely"), not a downgrade attack — a v3 blob still
  requires its own correct v3-derivable secret; there is no protection
  bypass available through it, only tested and confirmed, not assumed.

---

## 6. Cómo se generó/validó cada categoría (breve)

- **Isolation / scopes / lifecycle / migration / replay:** hand-written
  adversarial cases per the task's own enumerated bullet list for each
  section, run against the built `dist/me.es.js` artifact (matching this
  repo's existing test convention).
- **Crypto tampering:** byte-level mutation of real ciphertext (nonce, tag,
  ciphertext body, version byte), truncation at multiple lengths, blob
  swapping across paths/scopes, format-confusion (forged version bytes),
  KDF parameter boundary testing, and a DoS-guard-ordering check (rejection
  must not itself run expensive PBKDF2 work) — all against the actual
  running kernel, not mocked.
- **Leakage:** unique per-test marker strings scanned across
  `exportSnapshot()`, every file `DiskStore` actually writes, error
  messages/stacks, and (as a negative control) the public
  read/explain surface — covering scalars, objects, arrays, and Unicode.
- **Generative (`generative.test.ts`):** a small reference model
  (`makeModel()`) tracks "is this scope's secret currently held, and under
  which noise generation was this specific write made" and is checked
  against the real kernel's answers after reproducible-seed (xorshift32,
  not cryptographic — used only to script scenarios, never as key
  material), fixed-seed sequences of create/write/protect/lock/unlock/noise
  actions. The one direction that's a hard failure is "model says this
  should be CLOSED but the kernel returned real data" (a genuine
  isolation/stealth violation); the reverse direction is logged, not
  failed, since a model that's *more* conservative than the real kernel is
  not itself a security problem. Failing seeds print their seed value for
  reproduction, per the task's explicit "conserva la semilla y reduce la
  secuencia" instruction. Cache-growth bounds (`v4KeyCache`,
  `scopeCache`) are asserted against the LRU constants already documented
  in `secret-context.ts`, not re-derived. Latency numbers are *reported*,
  not asserted against a threshold — this environment/Node-version pairing
  is printed alongside each measurement (per the task's explicit
  instruction to avoid brittle CI timing budgets).

---

## 7. Pruebas pendientes y limitaciones no resueltas

Honest gaps, not swept under anything:

1. **No rollback/freshness detection for branch ciphertext.** An attacker
   with write access to `encryptedBranches` (model A/D) can replace a
   scope's current chunk with an OLDER, but still validly-authenticated,
   chunk from the same scope+secret+root — the AEAD tag still checks out
   (it was real ciphertext once), and the kernel has no monotonic
   counter/version to detect the rollback. **Not defended against, not
   tested as passing, documented as a real open gap.** A fix would need a
   freshness/version field folded into the AEAD's authenticated context,
   which is a real design decision (task's own instruction: contradictions
   requiring an access-model change are surfaced, not silently implemented)
   — flagged here rather than attempted.
2. **`tests/bind-namespace.test.ts` fails to even load under this
   environment's Node version** (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on an
   unrelated file, `secret-storage-columnar.ts`'s `enum`, which Node's
   native TypeScript stripping doesn't support). Pre-existing, unrelated to
   Identity-Bound Secrets, not touched by this battery — noted here only so
   "standalone suites... run directly" in the design doc's §8 isn't
   mistaken for a claim that still holds under every Node version.
3. **Concurrent-writer support was never implemented and is not tested as
   working** — `processInterruption.process.test.ts`'s "concurrent writers"
   test documents the actual behavior (later save wins outright, no
   corruption, no merge) as a **limit**, explicitly not a feature. If
   multiple monad processes are ever meant to share one `ME_STATE_DIR`
   concurrently, that needs real design work (file locking, a real
   multi-writer protocol) — out of scope here, and this task's instructions
   explicitly said not to invent support that doesn't exist.
4. **The `SIGKILL`-during-write process tests are probabilistic, not
   deterministic proof.** See §4.3's honesty note — the deterministic
   coverage for the atomic-write fix is the corrupted-file-quarantine test,
   not the timing-dependent process trials (which still ran, and still
   passed, across multiple trials — they just can't be relied on alone to
   prove the old bug is gone).
5. **No SIGKILL-during-migration test was built.** §8 of the task asks for
   "terminación abrupta durante guardado y migración" — the "guardado"
   (save) half is covered (§4.3); the "migración" half is not, because
   `migrateEncryptedBranchesToV4()`/`migrateEncryptedValuesToV4()` run
   in-process against in-memory kernel state and only become durable via a
   subsequent `saveSnapshot()` (already covered) — there is no
   migration-specific *persistence* step to interrupt independently of the
   save path already tested. If a future version adds incremental/streaming
   migration persistence, this gap should be revisited.
6. **This is not an independent cryptographic audit.** Explicitly stated in
   the design doc's own closing line and repeated here per the task's
   instruction not to imply otherwise.

---

## 8. What's OUT of the security model entirely (by design, not omission)

Per §3.6 of the design doc and confirmed, not just repeated, by this
battery:
- Hiding on-disk metadata (scope-path keys, chunk counts/sizes).
- Protecting against an attacker who already controls the unlocked process.
- Argon2id/scrypt instead of PBKDF2 (documented rationale in the design
  doc, a reasonable future improvement, not a dismissed option).
- A full rotate-and-re-encrypt platform (rotation mints a new root; it does
  not re-encrypt existing v4 data under it in this phase).
- Social recovery / any opt-in "remember this branch's secret for me" vault.
- Monad HTTP routes for `unlockIdentity`/`lockIdentity`/etc. — kernel-level
  only in this phase; nothing on `src/http/` was touched by this feature or
  this battery.
