<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me `3.9.0`

[![npm](https://img.shields.io/npm/v/this.me)](https://www.npmjs.com/package/this.me) [![docs](https://img.shields.io/badge/docs-neurons--me.github.io-blue)](https://neurons-me.github.io/.me/docs/)

**Sovereign computational identity. Works offline. No server. No network.**

```ts
import me from 'this.me'

me('ana', 'secret')    // compound seed — deterministic, offline, cryptographic
                       // compound_seed = keccak256("me.seed/compound:v1::ana::secret")
```

`.me` is not a server. It is not a tenant. It is the kernel — a sovereign computation that derives identity from a seed and maintains a reactive semantic tree. If everything else disappears, `.me` still computes.

---

## Performance

| | |
|---|---|
| `0.001ms p50` | write enqueue |
| `0.003ms p50` | cascadeLazy 10-dep flush |
| `0.137ms p99` | cascadeLazy 10-dep flush |
| `~700 vps` | sustained write with 1536-dim vectors |
| `1M nodes` | in-memory with sub-ms propagation |
| `23.2×` | IVF search speedup over exact scan on 100k corpus |

---

## Install

```bash
npm install this.me
```

---

## Core: `me(who, secret)`

```ts
import me from 'this.me'

me('suign', 'secret')
// compound_seed = keccak256("me.seed/compound:v1::suign::secret")
// identityHash  = deterministic, reproducible from same (who, secret)
// Same inputs → same kernel everywhere, every time.

me('suign')
// setActiveExpression only — no reseed
// Use when identity is already established and you just want to re-express
```

The compound seed is the whole truth. Derived deterministically. Never transmitted. The seed never leaves the client.

---

## Semantic tree

```ts
import me from 'this.me'

// Identity
me('suign', 'secret')

// Public profile
me.profile.name('Sui Gn')
me.profile.bio('Building the semantic web.')

// Private data (encrypted namespace)
me.wallet['_']('wallet-key-2026')
me.wallet.balance(12480)

// Relationships
me.users.ana.name('Ana')
me.users.pablo.name('Pablo')

// Reference linking
me.friends.ana['->']('users.ana')
me.friends.pablo['->']('users.pablo')

// Derived logic — runs automatically when dependencies change
me.friends['[i]']['=']('isAdult', 'age >= 18')

// Read
console.log(me('profile.name'))   // 'Sui Gn'
console.log(me('wallet.balance')) // 12480 (decrypted for this session)
```

---

## Privacy model

```ts
me.secrets['_']('private-key-2026')   // hidden universe — encrypted branch
me.secrets.notes('Only I can see this.')

me.profile.name('Public Name')         // public branch — readable by anyone
```

Hidden universes (`['_']`) are structurally encrypted. Even the shape of the data is hidden from observers without the key.

---

## Reactivity

```ts
me.price(100)
me.quantity(5)
me.total['=']('price * quantity')

me.price(200)
console.log(me('total'))   // 1000 — recomputed automatically
```

True **O(K) reactivity**: only actual dependents update when a value changes. Propagation is lazy and batched.

---

## Search

```ts
// Exact scan
const results = me.search({ query: 'semantic web', top: 5 })

// IVF approximate nearest-neighbor (23.2× faster on 100k corpus)
me.enableIVF({ nlist: 100 })
const results = me.search({ vector: embedding, top: 5 })
```

---

## Explainability

```ts
me.total['=']('price * quantity')
me.price(200)
me.quantity(5)

me.explain('total')
// → "total = price * quantity = 200 * 5 = 1000"
// Shows full derivation chain, not just the value.
```

---

## Role in the NRP stack

`.me` is the root of the stack. It operates entirely offline. No network, no server, no external service is needed to derive identity or store knowledge:

```
this.me    → sovereign kernel. (who, secret) → compound seed → identity + tree.
cleaker    → resolver. projects .me into a namespace surface (cleaker.me, LAN, etc).
monad.ai   → daemon. exposes the namespace over HTTP. registers on mesh surfaces.
```

When `cleaker` opens a namespace, it returns memories to the caller. Those memories are replayed into `.me` via `me.learn(memory)`. The kernel learns from the network but never depends on it.

### Cryptographic set-chemistry

Multiple parties can derive a shared namespace without a server:

```ts
audienceSeed = keccak256("me.seed/audience:v1::" + sort([seed1, seed2]).join("::"))
```

Properties:
- `frank + ana` = `ana + frank` (commutative — sorted before hashing)
- `frank + ana + luna` → different compound than `frank + ana`
- Remove any party → namespace no longer derivable
- No server. No registry. Exists only where the exact seed set is present.

---

## License

MIT — [github.com/neurons-me/.me](https://github.com/neurons-me/.me)
