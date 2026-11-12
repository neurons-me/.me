---
layout: gui-doc
title: ".me — Phase benchmarks"
description: "Phase 2 (disk persistence and write pressure) and Phase 3 (exact and IVF vector search) of the .me kernel: what each measures, its script, command and the published results, measured on this.me 3.6.4 / 3.7.0."
image: https://neurons-me.github.io/.me/docs/assets/card-benchmarks.webp
mepath:
  - text: Benchmarks
    url: https://neurons-me.github.io/.me/docs/Benchmarks/
crumb: Phases
view_content_name: "Doc - .me — Phase benchmarks"
view_content_category: "Docs"
---

# Phases

The performance phases that took the kernel from in-memory writes to a disk-backed store with vector search. **Phase 2** measures persistence and sustained write pressure; **Phase 3** measures exact and approximate (IVF) vector search over an encrypted collection.

> **Kernel version.** The published numbers below are from **this.me 3.6.4** (2026-04-19) and **3.7.0** (2026-04-21, the sustained-write rate). The machine was not recorded. They have **not been re-run on 4.x**; read them as the closure signals of those versions, not as 4.2.1 figures.

## Setup {#setup}

Node ≥ 22.6 (the `.ts` files run directly). All commands run from `Typescript/`, after building the kernel (the scripts import `dist/`).

```bash
git clone https://github.com/neurons-me/.me.git && cd .me/Typescript
npm install
npm run build
```

## Phase 2: disk persistence and write pressure {#phase-2}

**What it measures.** Writing large corpora of 1536-dimension vectors through `DiskStore` with a bounded hot set: incremental disk persistence, `explain()` lookup latency as the store grows on disk, and sustained write and rewrite pressure (throughput, post-GC heap, retained bytes) over millions of writes.

- Scripts: [Phase.2.0.smoke.test.js](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.2.0.smoke.test.js) (10 MB smoke), [Phase.2.0.incremental-disk.js](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.2.0.incremental-disk.js) (1 GB target), [Phase.2.1.explain-lookup.js](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.2.1.explain-lookup.js), [Phase.2.2.write-pressure.test.js](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.2.2.write-pressure.test.js) (2,000,000 vectors), [Phase.2.3.rewrite-pressure.test.js](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.2.3.rewrite-pressure.test.js) (200,000 rewrites over a 4,096 working set), [benchmark-100.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark-100.ts), [benchmark.vector-corpus.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.vector-corpus.ts)

```bash
npm run test:phase2:smoke:disk
npm run bench:phase2:explain
npm run bench:phase2:write
npm run bench:phase2:rewrite
node tests/Benchmarks/benchmark-100.ts
npm run bench:phase3:vector:corpus
```

**Published results** (this.me 3.6.4, 3.7.0 where marked):

| measurement | result |
|---|---|
| encrypted vectors, leaf writes (`benchmark-100.ts`) | 100,000 in 0.9 min, **1,886 vectors/s**, ~122 MB post-GC heap |
| sustained write, 1536-dim vectors (3.7.0) | **~700 vectors/s** |
| corpus storage (`benchmark.vector-corpus.ts`) | chunked columnar envelopes, `Float32Array` payloads, chunk-read heap delta ~2.7 MB |

Phase 1 before it (batch writes, `Phase.1GB.js`) closed with 14–20 ms per 100-item chunk and a ceiling of ~137,300 items before the V8 heap ran out (~1,660 MB), same version.

## Phase 3: exact and IVF vector search {#phase-3}

**What it measures.** Search over a collection-scoped encrypted vector branch: `searchExact()` as the correctness baseline, then the IVF sidecar index (`buildVectorIndex()`, `searchVector()`) against it. Latency (p95), recall@10, chunks read per query and speedup, at 10,000 / 50,000 / 100,000 vectors, on a realistic corpus (`chunk_coherent`) and a hostile one (`legacy_fragmented`).

- Scripts: [Phase.3.0.search-exact.test.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.3.0.search-exact.test.ts), [Phase.3.1.ivf.test.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Phases/Phase.3.1.ivf.test.ts) (correctness tests), [benchmark.search-exact-scale.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.search-exact-scale.ts), [benchmark.ivf-vs-exact.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.ivf-vs-exact.ts), [benchmark.ivf-tuning.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.ivf-tuning.ts)

```bash
npm run test:phase3
npm run bench:phase3:exact-scale
npm run bench:phase3:ivf-vs-exact
npm run bench:phase3:ivf-tuning
```

**Published results** (this.me 3.6.4, 100,000 vectors):

| corpus | exact p95 | IVF p95 | recall@10 | chunks / query | speedup |
|---|---:|---:|---:|---:|---:|
| `chunk_coherent` (realistic) | 77,129 ms | 3,318 ms | 1.000 | 18.4 | **23.2×** |
| `legacy_fragmented` (hostile) | 166,604 ms | 19,353 ms | 1.000 | 97.6 | 8.6× |

Open at the time: the build cost of large IVF indexes.

## More {#more}

<div class="doc-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/.me/docs/Benchmarks/benchmarks.html"><img src="https://suign.github.io/assets/imgs/me.png" alt="Kernel benchmarks"><span class="card-kind">Kernel · 4.2.1</span><span class="card-title">Kernel benchmarks</span><span class="card-desc">Benchmarks 1–11 and the fire test, re-run on 4.2.0, with the cost timeline to 4.2.1.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Benchmarks/Secret-Scope/"><img src="https://neurons-me.github.io/.me/docs/assets/card-seed.webp" alt="Secret scope benchmarks"><span class="card-kind">Secret scope · 4.2.0</span><span class="card-title">Secret scope &amp; scaling</span><span class="card-desc">Secret vs public branches: write and read cost, p50/p95 across node counts.</span></a>
</div>
