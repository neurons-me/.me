---
image: https://neurons-me.github.io/.me/docs/assets/og-seed.jpg
layout: gui-doc
title: "SEED — .me"
description: "The seed is the root value a .me kernel derives its identity from: how it is generated, derived, and stored."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
crumb: Seed
related:
  - me.html
  - Primitives.html
  - Axioms.html
  - Architecture.html
---

# 𓇗 SEED

The **seed** is the root value a `.me` kernel is constructed from. Its public fingerprint (`identityHash`) and its signing keys (`prove()`) are derived from it.

```ts
new ME(seed)
```

No network call, no namespace, no server. A seed is a string held by the kernel, and everything derived from it is computed locally.

> Randomness can create a root once. Determinism reproduces its results from that same root. The two are compatible.

---

## Four concepts

| Concept | What it means in `.me` |
|---|---|
| **Seed** | The string the kernel holds as its root (`#seed`). |
| **Generation** | Creating a new root from randomness. Happens once; the result is unpredictable. |
| **Derivation** | Computing a value from inputs with a fixed function. Same inputs, same output, on any device. |
| **Storage** | Where a root is kept between sessions, and in what form (plaintext or encrypted). |

A root can be generated once and then reproduced by derivation every time after. Generation and derivation are not alternatives; most identities use both.

---

## The three constructors

```ts
new ME("jabellae")        // literal seed
new ME(username, secret)  // compound seed, derived
new ME()                  // anonymous seed, reused or generated
```

| Construction | Where the seed comes from | Saved to the anonymous slot? |
|---|---|---|
| `new ME("jabellae")` | The string itself, as-is. No hashing at this step. | No |
| `new ME(username, secret)` | `deriveCompoundSeed(username, secret)`, deterministic. | No |
| `new ME()` | The stored anonymous seed, or 32 fresh random bytes. | Yes, the kernel tries to keep it |

### `new ME("jabellae")` — literal seed

The string is used directly as the seed (`normalizeSeedInput` only converts non-strings with `String()`).

This form is useful for explaining the API and for tests. It is **not a private identity**: anyone who knows the text `"jabellae"` can construct the same kernel and reproduce everything derived from it, including `identityHash` and the `prove()` signing key. A literal seed is only as private as the string.

### `new ME(username, secret)` — compound seed

```ts
const COMPOUND_SEED_DOMAIN = "me.seed/compound:v1::";

function deriveCompoundSeed(who: string, secret: string): string {
  return keccak256(COMPOUND_SEED_DOMAIN + who + "::" + secret);
}
```

Same `who` + same `secret`, on any device, at any time, gives the same seed. The constructor also sets `who` as the active expression, which `prove()` requires.

An existing kernel can be re-seeded the same way at runtime through the internal `ME_RESEED` symbol. It re-derives `seed` and `identityHash`, clears the identity root and any `_()`/`~()` values held from the previous identity, and rebuilds the index.

This is one way to obtain a seed, not the only one. In this form the name and the secret are the recipe for the seed: whoever knows both can rebuild it, and changing the secret changes the identity. That is different from a name that *identifies* and a secret that *unlocks* a root created earlier (see [Recoverable identity](#a-generated-identity-recoverable-by-phrase) below).

### `new ME()` — anonymous seed

With no arguments, the kernel:

1. reuses the seed already stored for anonymous use in this runtime (in memory, then `localStorage` under `DEFAULT_SEED_STORAGE_KEY = "this.me.seed:v1"`), or
2. generates a new one with `generateSeed()`: 32 bytes from `crypto.getRandomValues`, hex-encoded. If secure randomness is unavailable it throws instead of falling back.

It then tries to persist that seed, so the same browser origin gets the same anonymous seed after a reload.

**Anonymous** means no identity recognized by others has been established yet. It does not mean ephemeral: when `localStorage` is available, the seed survives reloads. It is lost only when that storage is cleared or unavailable (then it lives only in memory for the process).

---

## A generated identity, recoverable by phrase

The `.GUI` registration flow (`Claim.tsx`, `core/identity/recoveryPhrase.ts`) uses randomness once and derivation afterward:

1. **Generation, once.** `generateRecoveryPhrase()` creates a 12-word BIP-39 phrase from 128 bits of CSPRNG entropy (`@scure/bip39`). It is generated once per registration form and kept for retries.
2. **Derivation, always.** `deriveIdentityRootBytesFromPhrase(words)` turns the phrase into a 32-byte root:

   ```ts
   const bip39Seed = await mnemonicToSeedWebcrypto(phrase, "");
   return deriveHkdfBytes(bip39Seed, "this.me/bip39-recovery:v1", "this.me/bip39-auth-root:v1", 32);
   ```

   The same 12 words always give the same root. The hex form is passed to the kernel as a literal seed: `new ME(identityRootHex)`, followed by `me["@"](username)`.
3. **Storage, encrypted.** After the backup is confirmed, the root is wrapped under the user's password with `wrapIdentityRoot` (PBKDF2-SHA-256, 600,000 iterations by default, AES-256-GCM) and stored per namespace under `this.me.identity-vault:v1:<namespace>`. The raw root is never written to `localStorage`.

Here the password does not create the identity. It unlocks a local copy of a root that was generated earlier. Changing the password re-wraps the same root; the identity stays the same. If the vault is lost, `RecoverAccount.tsx` re-derives the same root from the phrase and stores it under a new password.

Compare the two mechanisms:

| | Name + secret (`new ME(who, secret)`) | Generated root, recoverable by phrase |
|---|---|---|
| Where the root comes from | Derived from name and secret | Generated once from random entropy (the phrase) |
| What reproduces it | The same name and secret | The same 12 words |
| What the password does | It is part of the recipe | It only unlocks the locally stored copy |
| Changing the password | Changes the identity | Keeps the identity |

In `createCleakerSession`, if no `identityRootHex` is passed, the session falls back to `new ME(username, password, { namespace })`; the code notes that in that case the identity is the password, with no independent backup.

---

## Storage: what the kernel persists

```ts
function resolveSeed(seed: unknown): string {
  const normalized = normalizeSeedInput(seed);
  // Explicit seed (literal, or compound from deriveCompoundSeed): return it,
  // never write it to DEFAULT_SEED_STORAGE_KEY.
  if (normalized !== undefined) return normalized;

  // Anonymous fallback only.
  const resolved = readStoredSeed() ?? generateSeed();
  persistSeed(resolved);
  return resolved;
}
```

- An explicit seed, literal or compound, is returned directly. It is not written to `localStorage`, and it does not replace the in-memory anonymous seed either, so a later `new ME()` can never pick it up.
- Only the anonymous path calls `persistSeed()`.

Earlier versions passed every seed through `persistSeed(resolved)`, which wrote explicit seeds, including compound seeds, in plaintext to the single shared slot `this.me.seed:v1`, readable by any script on the same origin. That was changed in commit `4b46d1d` and is covered by `tests/Security/seed-persistence.test.ts`. An anonymous seed stored by an older version is still read from the same key, so no migration is needed.

Keeping an explicit root between sessions is the caller's job, in encrypted form: for example `wrapIdentityRoot` / `unwrapIdentityRoot`, as the `.GUI` vault does.

---

## What grows from the seed

### Public identity fingerprint

```ts
identityHash = keccak256("this.me/identity:v1::" + seed)
```

A one-way hash of the seed. It can be shared: it shows two kernels come from the same seed without revealing the seed. See it live in the [.me README demo](https://neurons-me.github.io/.me/): type any name and watch the `identityHash` update.

### Signing key for `prove()`

```ts
branchSeed = deriveHkdfBytes(seed, "me.prove.v1", activeExpression, 32)  // deriveBranchProofSeed
```

`prove()` signs a payload with an Ed25519 key derived from the seed and the active expression. This is why the seed must stay private when it is used as an identity: whoever has the seed can produce the same signatures.

### What the seed does *not* protect

The kernel seed is not an input to secret-branch encryption, in any blob format.

```ts
me.wallet["_"]("vault-key")
```

How a secret branch is encrypted depends on the blob format. The kernel picks it per write (`encryptForWrite`) and detects it per read (`detectBlobVersion`):

- **v3, the default.** Used when no identity root is unlocked. Keys come from `deriveSecretMaterialV3` over `collectSecretChainV3`: a domain label, the mode, the scope path, the anchor path, the noise boundary, and the `_()` / `~()` values along the path. Nothing private other than those scope secrets is in the chain. For v3, branch secrecy depends only on the scope secrets, so a public or guessable seed does not weaken it. (`computeEffectiveSecret`, which folds the same lineage into one string starting from the literal `"root"`, is the input for the legacy v2 format.)
- **v4, Identity-Bound Secrets.** Used for new writes when an identity root is unlocked in the session (`createIdentityRoot(password)` or `unlockIdentity(password)`). Keys come from `deriveSecretMaterialV4`, which uses that identity root as the HMAC key over the same kind of chain. Without the unlocked root, v4 blobs cannot be decrypted even with the right scope secrets. This identity root is generated by `generateIdentityRoot()` (CSPRNG, 32 bytes), wrapped under the password, and is **not** the kernel seed and not derived from username or password.

So in both formats, seed secrecy and branch secrecy are separate concerns. What changes is that v3 depends only on the scope secrets, while v4 also requires the unlocked identity root. Existing v3 data keeps decrypting as before; `migrateEncryptedBranchesToV4()` (and `migrateEncryptedValuesToV4()` for values) re-encrypts it into v4 when both the scope secret and the identity root are available. See [Axioms](https://neurons-me.github.io/.me/docs/Axioms.html) for the full model.

---

## Seed vs. namespace claim

A seed by itself proves nothing to anyone else — it's just math you can run alone. **Claiming a namespace** (binding a handle like `jabellae` to a specific running surface, so other people can find and verify "this is really jabellae") is a different, optional layer that lives in `cleaker` and `monad`, not in `.me`. The seed is the expression; the claim is what happens when you express it somewhere with witnesses.

| | Seed | Namespace claim |
|---|---|---|
| Where it lives | `.me` (pure, local) | `cleaker` + `monad` (namespace, network) |
| Needs a network? | No | Yes |
| Proves ownership to others? | No | Yes |
| Can exist without the other? | Yes — always | No — needs a seed/identity to claim |

---

## Summary

- The seed is the root a `.me` kernel starts from. `identityHash` and the `prove()` signing key are derived from it.
- Randomness can create a root once; determinism reproduces its results from that root. Both are used.
- `new ME("text")` uses the text as-is: fine for examples, not private. `new ME(who, secret)` derives the seed with `deriveCompoundSeed`. `new ME()` reuses or generates an anonymous random seed.
- Only the anonymous seed is persisted by the kernel. Explicit and compound seeds are never written to `localStorage`.
- A phrase-generated root (the `.GUI` registration) is created once from randomness, reproduced from the same 12 words, and unlocked locally by a password. Name + secret is a different mechanism, where the two strings are the recipe.
- The seed does not encrypt secret branches. v3 depends on the scope secrets; v4 also requires an unlocked identity root, which is separate from the seed.
- Tying a seed to a namespace others can verify is a separate, optional step.
