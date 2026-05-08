<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me `3.9.0`

**Sovereign computational identity. Works offline. No server. No network.**

`.me` is the kernel — a reactive semantic tree that derives identity from a `(who, secret)` seed using keccak256. If everything else disappears, `.me` still computes.

---

## Install

```bash
npm install this.me
```

---

## Quick Start

```ts
import me from 'this.me'

// Compound seed — deterministic, offline, cryptographic
// compound_seed = keccak256("me.seed/compound:v1::suign::secret")
me('suign', 'secret')

// Write to the semantic tree
me.profile.name('Sui Gn')
me.profile.bio('Building the semantic web.')

// Private branch (encrypted)
me.wallet['_']('wallet-key-2026')
me.wallet.balance(12480)

// Read
console.log(me('profile.name'))    // 'Sui Gn'
console.log(me('wallet.balance'))  // 12480
```

---

## Performance

| | |
|---|---|
| `0.001ms p50` | write enqueue |
| `0.003ms p50` | cascadeLazy 10-dep flush |
| `0.137ms p99` | cascadeLazy 10-dep flush |
| `~700 vps` | sustained write with 1536-dim vectors |
| `23.2×` | IVF speedup over exact scan on 100k corpus |

---

## Reactivity

```ts
me.price(100)
me.quantity(5)
me.total['=']('price * quantity')

me.price(200)
console.log(me('total'))  // 1000 — recomputed automatically
```

True O(K) reactivity — only actual dependents update.

---

## Explainability

```ts
me.explain('total')
// → "total = price * quantity = 200 * 5 = 1000"
```

---

## Role in the NRP stack

`.me` is the root primitive. It operates entirely offline. `cleaker` resolves its identity to a network surface. `monad.ai` exposes it over HTTP.

```
this.me    → sovereign kernel. (who, secret) → compound seed → identity + tree.
cleaker    → resolver. projects .me into a namespace surface.
monad.ai   → daemon. exposes namespace over HTTP. registers on mesh surfaces.
```

When `cleaker` opens a namespace, memories return to the caller and are replayed into `.me` via `me.learn(memory)`. The kernel learns from the network but never depends on it.

---

## Cryptographic set-chemistry

Multiple parties can derive a shared namespace without a server:

```ts
audienceSeed = keccak256("me.seed/audience:v1::" + sort([seed1, seed2]).join("::"))
// frank + ana = ana + frank  (commutative)
// Exists only where the exact seed set is present — no server, no registry
```

---

## Architecture notes (2026-05-08)

NRP chemistry frozen at `nrp-chemistry-v0.1`. Implementation status:

| Primitive | Status |
|---|---|
| `me(who, secret)` compound seed | ✅ |
| `cleaker(me)` default to cleaker.me | ✅ |
| `monad[frank]` scope chain routing | ✅ |
| `POST /.mesh/announce` incoming | ✅ |
| `MONAD_SURFACE_URL` outgoing announce | ✅ |
| `namespace:fallback` / `namespace:failed` events | ✅ |
| KDF domain separation (`SEED` → Ed25519 via HKDF) | ✅ |
| `monads proxy` browser gateway (PAC file) | ✅ |
| `netget reload` CLI (no nginx in PATH needed) | ✅ |
| `surface[]` mesh resolver in bridge | 🔲 planned |
| Audience compound `surface[a+b]` | 🔲 planned |

---

[Quick Start →](./QuickStart) · [Syntax →](./Syntax) · [Operators →](./Operators) · [Axioms →](./Axioms) · [API Reference →](./api/)
