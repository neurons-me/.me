<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me

##### **100k vectors · 3.32s search · recall 1.0 · fully encrypted · runs local**

Your personal semantic kernel — **own your knowledge**, your way: agents, notes, relationships, wallet, groups, secrets — all in one reactive tree.

**`.me` runs 100% local with end-to-end encryption.** No cloud, no vendor lock.

---

## Installation

```bash
npm install this.me
```

## Quick start

```ts
import ME from "this.me";
const me = new ME();

me["@"]("jabellae");
me.profile.name("José Abella");

me.wallet["_"]("key-2026");
me.wallet.balance(12480);

me.explain("wallet.balance"); // → shows derivation, masks secrets
```

## Core concepts

**Reactive tree** — Change one value, dependents update in O(k).

**Structural privacy** — Mark branches with ["_"] to make them stealth. Roots hide, leaves resolve.

**Native provenance** — Every value carries inputs, expression, origin. Use 

```ts
me.explain(path)
```

**Subjective state** — Same graph, different shapes per viewer via me.as(scope).

## API surface

| Module     | Description                                            |
| ---------- | ------------------------------------------------------ |
| Runtime    | Core class. Get, set, derive, explain.                 |
| Operators  | `["->"]` refs, `["[i]"]["="]` derive, `["_"]` stealth. |
| Axioms     | Invariants: reactivity, privacy, provenance.           |
| Query      | `me("path")`, filters `[age >= 18]`, traversal.        |
| Benchmarks | 100k corpus: 3.32s p95, recall 1.0, 23.2x speedup.     |

## Performance snapshot

April 19, 2026 · 100k encrypted vectors

| Profile   | Corpus            | Exact p95 | IVF p95 |
| --------- | ----------------- | --------- | ------- |
| Realistic | chunk_coherent    | 77.1s     | 3.32s   |
| Hostile   | Legacy_fragmented | 166.6s    | 19.35s  |

Chunks decrypted per query out of 100k total

**MIT License** © 2025 neurons.me 