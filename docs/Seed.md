---
layout: readme
title: SEED — .me
---

# 𓇗 SEED

The **seed** is the single root from which an entire `.me` identity grows. Everything cryptographic in the kernel — your public fingerprint, your secret branches, your compound identities — derives from this one value.

```ts
new ME(seed)
```

That's it. No network call, no namespace, no server. A seed is just a string — and from that string, an entire reactive graph becomes possible.

---

## What a seed actually is

A seed is **not hashed when you provide it literally**. If you call `new ME("jabellae")`, the kernel uses `"jabellae"` *as-is* as the seed — no derivation happens at that step:

```ts
function resolveSeed(seed: unknown): string {
  const normalized = normalizeSeedInput(seed);
  const resolved = normalized ?? readStoredSeed() ?? generateSeed();
  persistSeed(resolved);
  return resolved;
}
```

If you call `new ME()` with nothing, the kernel either:
1. reuses whatever seed was last persisted in this runtime (`localStorage` in the browser), or
2. generates a fresh 32-byte cryptographically random seed via `crypto.getRandomValues`.

Either way — literal, reused, or random — once you have a seed, everything else is deterministic.

---

## What grows from the seed

### Public identity fingerprint

```ts
identityHash = keccak256("this.me/identity:v1::" + seed)
```

This is the one irreversible, one-way hash the kernel computes from your seed. It's safe to share — it proves "this came from a particular seed" without revealing the seed itself. See it live in the [.me README demo](https://neurons-me.github.io/.me/) — type any name and watch the `identityHash` update.

### Compound seeds — identity from two human-meaningful strings

Most people don't want to remember a 64-character hex string. So `.me` also supports deriving a seed from a `who` (handle) and a `secret` (passphrase):

```ts
new ME(who, secret)
// seed = keccak256("me.seed/compound:v1::" + who + "::" + secret)
```

Same `who` + same `secret`, anywhere, any device, any time → the exact same seed. No server required to reconstruct your identity. This is what makes a `.me` identity **sovereign** — it doesn't live anywhere except in your memory of two strings.

An existing kernel instance can also be re-seeded this way at runtime via the internal `ME_RESEED` symbol, which re-derives `seed`, `identityHash`, and rebuilds the kernel's index in place.

### What the seed does *not* protect

This is the part people most often get wrong: **the root seed does not encrypt your secret branches.**

```ts
me.wallet["_"]("vault-key")
```

Secret-scoped paths derive their own encryption key material from the scope secret you pass in (`"vault-key"` above) — chained through `computeEffectiveSecret`, which starts from a fixed literal `"root"`, *not* from your kernel's seed. So a public, literal, easily-guessable seed (like a username) does not weaken your secret branches at all — they were never protected by seed secrecy in the first place. Seed secrecy and branch secrecy are two independent concerns. See [Secrets](https://neurons-me.github.io/.me/docs/Axioms.html) for the full model.

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

- A seed is the one input every `.me` identity starts from.
- Literal seeds are used as-is; omitted seeds are generated or reused; compound seeds (`who` + `secret`) are derived deterministically via keccak256.
- `identityHash` is the public, one-way fingerprint of a seed — safe to share, never reversible.
- The seed does not gate secret-branch encryption — that's a fully independent mechanism, scoped per path.
- A seed alone is sovereign and portable. Tying it to a namespace others can verify is a separate, optional step.
