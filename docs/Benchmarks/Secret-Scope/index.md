---
layout: gui-doc
title: ".me — Secret scope benchmarks"
description: "What a secret scope costs in the .me kernel: secret vs public branches, write and first-read cost across node counts, measured on this.me 4.2.0, plus the branch-scale benchmark (no published results yet)."
image: https://neurons-me.github.io/.me/docs/assets/card-seed.webp
mepath:
  - text: Benchmarks
    url: https://neurons-me.github.io/.me/docs/Benchmarks/
crumb: Secret-Scope
view_content_name: "Doc - .me — Secret scope benchmarks"
view_content_category: "Docs"
---

# Secret scope &amp; scaling

A secret scope (`me.finance["_"]("key")`) seals everything under it: values are stored encrypted and read through the branch key. These benchmarks measure what that costs next to the same workload on a public branch. The cost is the secret path itself: branch key derivation and cache, sealing and opening values (v3: Keccak-256 counter-mode keystream + HMAC-Keccak256 tag), stealth-boundary checks.

Measured on **this.me 4.2.0** (2026-10-10, shared Linux VM, Intel Xeon, 8 vCPU, 16 GiB, Node 22.23.3), next to the pre-4.1.0 build on the same machine; the first published figures were on an Apple M2. Both runs are on the [kernel benchmarks page](https://neurons-me.github.io/.me/docs/Benchmarks/benchmarks.html#benchmark-9--secret-scope-performance-impact).

## Setup {#setup}

Node ≥ 22.6. All commands run from `Typescript/`.

```bash
git clone https://github.com/neurons-me/.me.git && cd .me/Typescript
npm install
npm run build
```

## 1. Secret vs public branch (#9) {#secret-vs-public}

**What it measures.** The same workload on a public branch and on a secret branch: 600 nodes, lazy mode, write the shared factor then read one output. Median of 5 runs.

- Script: [benchmark.9.secret-scope-impact.test.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts)

```bash
node tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts
```

| | public p95 | secret p95 | secret / public |
|---|---:|---:|---:|
| Apple M2, pre-4.1.0 (published) | 0.044 ms | 0.604 ms | ~14× |
| this.me 4.2.0, Xeon VM | not re-measured | **1.64 ms** | (pre-4.1.0, same VM: 1.62 ms) |

Secret reads stay in the low-millisecond envelope; 4.2.0 is within 2% of the previous build.

## 2. Secret push vs pull (#11) {#push-vs-pull}

**What it measures.** Write cost (push) and first-read cost (pull) for public and secret branches at 100 / 300 / 600 nodes, lazy mode. Median of 5 runs.

- Script: [benchmark.11.secret-push-vs-pull.test.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts)

```bash
node tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts
```

Published (Apple M2, pre-4.1.0), p95 in ms:

| nodes | public write | secret write | public read | secret read | read slowdown |
|---:|---:|---:|---:|---:|---:|
| 100 | 0.0126 | 0.0464 | 0.0499 | 0.392 | 7.7× |
| 300 | 0.0045 | 0.0327 | 0.0275 | 0.311 | 11.1× |
| 600 | 0.0041 | 0.0355 | 0.0247 | 0.550 | 22.6× |

On this.me 4.2.0 (Xeon VM) the secret read p95 at 600 nodes is **1.34 ms** (pre-4.1.0 on the same VM: 1.49 ms). Writes stay cheap in both planes; secret reads cost more and grow with node count.

## 3. Secret branch at scale {#branch-scale}

**What it measures.** Full-branch reads, cold vs warm, leaf vs branch, and snapshot rehydration, public vs secret, at 1,000 / 10,000 / 100,000 / 250,000 records with 256- and 1536-dimension embeddings (11 runs each; sizes set with `BENCH_SECRET_SCALE_N` and `BENCH_SECRET_SCALE_EMBED`).

- Script: [benchmark.secret-branch-scale.test.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/benchmark.secret-branch-scale.test.ts)

```bash
node --expose-gc tests/Benchmarks/benchmark.secret-branch-scale.test.ts
```

**No published results yet**: this one has not been run for the docs on any version.

## More {#more}

<div class="doc-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/.me/docs/Benchmarks/benchmarks.html"><img src="https://suign.github.io/assets/imgs/me.png" alt="Kernel benchmarks"><span class="card-kind">Kernel · 4.2.1</span><span class="card-title">Kernel benchmarks</span><span class="card-desc">Benchmarks 1–11 and the fire test, re-run on 4.2.0, with the cost timeline to 4.2.1.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Benchmarks/Phases/"><img src="https://neurons-me.github.io/.me/docs/assets/card-benchmarks.webp" alt="Phase benchmarks"><span class="card-kind">Phases · 3.6.4</span><span class="card-title">Phases</span><span class="card-desc">Disk persistence, write pressure and vector search (exact vs IVF).</span></a>
</div>
