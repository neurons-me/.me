---
layout: gui-doc
title: "Vector Index"
description: "Exact vs IVF search over an encrypted vector collection: centroids route a query to a few chunks, nprobe trades recall for speed, and layout decides whether the trade holds. Real outputs on npm this.me 4.2.1."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/Vector-Index.html
permalink: /docs/Vector-Index.html
crumb: vector index
image: https://neurons-me.github.io/.me/docs/assets/me-og.jpg
related:
  - Algebra-of-Contexts.html
  - O-k.html
  - https://neurons-me.github.io/digital-space-algebra/
  - https://neurons-me.github.io/mlearning.studio/
view_content_name: "Doc - Vector Index"
view_content_category: "Docs"
---

# ≈ Vector Index

Find the nearest, open the least.

> A vector collection lives under a secret scope, stored in encrypted chunks. Search cost is how many chunks must be opened.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Theory: [Digital Space Algebra](https://neurons-me.github.io/digital-space-algebra/). This page is language-neutral; the implementation is linked at the end.
{: .doc-kernel-more}

## Exact and IVF

| | Opens | Answer |
|---|---|---|
| **exact** `searchExact` | every chunk | the true top k, by definition |
| **IVF** `searchVector` | the chunks near the `nprobe` closest centroids | the true top k only if the neighbours sit in those chunks |

`buildVectorIndex` trains `k` centroids over chunk representatives and writes a sidecar index outside the kernel log. A query compares itself to the centroids first (cheap), then scans only the chosen chunks.

```txt
cost(exact) = all chunks        cost(IVF) ≈ nprobe chunks
recall@k = |IVF top k ∩ exact top k| / k
```

## A small run

1,024 vectors of 256 dimensions in 4 clustered chunks, under a secret scope, on a disk store:

```ts
const me = new ME("vx", { store: new ME.DiskStore({ baseDir: "/tmp/vx" }) });
me.memory.episodic["_"]("k");
// 4 batches of 256 × 256-d vectors via the batch writer the kernel tests use (me._commitIndexedBatch)

me.searchExact("memory.episodic", q, { k: 3 });
// { hits: [600, 659, 541], scannedChunks: 4, scannedVectors: 1024 }

me.buildVectorIndex("memory.episodic", { k: 4, nprobe: 1 });
// { k: 4, nprobe: 1, totalVectors: 1024, totalChunks: 4 }

me.searchVector("memory.episodic", q, { k: 3, nprobe: 1 });
// { hits: [600, 659, 541], candidateChunks: 1, scannedVectors: 256 }
```

Run on Node with npm this.me 4.2.1 (the three methods are exported on `ME`); outputs are the real ones. Same top 3, a quarter of the vectors opened.

## Layout decides

On a Mac with 100k vectors (this.me 4.2.1, nprobe 3):

| Layout | Recall@10 | Speedup vs exact (p95) |
|---|---|---|
| chunk-coherent | **1.000** | 62× |
| fragmented | **0.133** | 40× |

When similar vectors share chunks, IVF returns exactly the exact answer, 62× faster. When they are scattered, it is still fast but misses most of the right answers. Full numbers: [Kernel benchmarks, Phase 3](https://neurons-me.github.io/.me/Typescript/typedocs/kernel/Benchmarks.html#phase-3-ivf-vs-exact-search-100k).

## Status by implementation

| | Exact search | IVF index |
|---|---|---|
| **TypeScript** this.me 4.2.1 | implemented, tested, exported | implemented, tested, exported |
| **Rust** rust-v0.3.3 | none | none |
| **Python** | none | none |

## Implementations

<div class="doc-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/.me/Typescript/typedocs/api/classes/ME.html#buildvectorindex"><img src="https://neurons-me.github.io/.me/docs/assets/card-explain.webp" alt="ME API"><span class="card-kind">TypeScript</span><span class="card-title">ME API: vector methods</span><span class="card-desc">searchExact, buildVectorIndex, searchVector and their options.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/Typescript/typedocs/Phases.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-tests.webp" alt="Phases"><span class="card-kind">TypeScript</span><span class="card-title">Phases</span><span class="card-desc">Phase 3.0 exact search and 3.1 IVF: the tests behind this page.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/Typescript/typedocs/kernel/Benchmarks.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-benchmarks.webp" alt="Kernel benchmarks"><span class="card-kind">TypeScript</span><span class="card-title">Kernel benchmarks</span><span class="card-desc">Phase 3 on a Mac: coherent vs fragmented layouts.</span></a>
</div>

Rust and Python: no implementation yet.
