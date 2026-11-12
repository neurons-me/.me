---
layout: gui-doc
title: ".me — Kernel benchmarks"
image: https://neurons-me.github.io/.me/docs/assets/kernel-timeline-og.jpg
description: "How the cost of each .me kernel benchmark moved across versions, 3.9.1 through 4.2.1 (latest on npm), measured on one machine."
mepath:
  - text: Benchmarks
    url: https://neurons-me.github.io/.me/docs/Benchmarks/
crumb: Kernel
scripts:
  - /assets/kernel-timeline/kernel-timeline.js?v=2
view_content_name: "Doc - .me — Kernel benchmarks"
view_content_category: "Docs"
---

# .me Kernel — Benchmark Results

## Cost across kernel versions

Each line is one benchmark, measured on every kernel build from 3.9.1 to 4.2.1, on the same machine in interleaved rounds. **Relative** puts each line's first comparable build at 1.0, so a line going up means that version made the same work slower; **ms** shows the medians themselves. Hover or tap a version for its milliseconds and commit; the numbered markers explain the steps. 4.2.1 is on npm as `latest` (`npm i this.me@4.2.1`).

<div class="kernel-timeline" data-src="{{ '/docs/Benchmarks/data/kernel-timeline.json' | relative_url }}" markdown="1">

The interactive chart needs JavaScript. The same numbers, per build and benchmark, with the commit behind each step: [kernel-timeline.json]({{ '/docs/Benchmarks/data/kernel-timeline.json' | relative_url }}); how they were measured and how to add a version: [timeline/README.md](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/timeline).

</div>

### Known limits

- **Sustained writes drift as the log grows.** Recompute is O(k): each write recomputes only its dependents. But every recompute appends a memory, and the cost per write rises with the history: in Benchmark 5 (4,000 dependents per write, k constant) the windowed p95 drift on 4.2.0 is +38% (+35% on the pre-4.1.0 build), and p50 rises +36% from the first to the last window (+32%). 4.2.1 changes formula evaluation, not the log, so it does not fix this; that needs log compaction or snapshotting.
- **Mixed machines.** The published 5–11 numbers below were measured on an Apple M2 (Node 24.13.1); the timeline above and the 4.2.0 re-run on a shared Linux VM (Intel Xeon 8 vCPU, Node 22.23.3), about 2× slower. Compare builds only within the timeline, or within one table, never milliseconds across machines.
- **p95 on a shared VM is noisy.** Single rounds can sit far from the median (on the timeline, one round of the 2,000-dependent write on 4.2.1 took 52.5 ms against a 40.3 ms median), so read medians and p50 first.

Run with: `node tests/fire.test.ts` (benchmarks section)

All benchmarks measure the kernel's reactive recompute engine under realistic conditions.
Hardware-agnostic: times will vary per machine — what matters is the **shape** (growth with `k`, ratios).

## Re-run on this.me 4.2.0 (2026-10-10)

All of 1–11 and the fire test were re-run on 4.2.0, and the builds behind the published numbers were re-run next to it on the same machine: 3.9.1 for 1–4, the pre-4.1.0 build with the reference fix for 5–11. 5 rounds alternating the builds, medians. Machine: shared Linux VM, Intel Xeon 8 vCPU, 16 GiB, Node 22.23.3. It is about 2× slower than the M2 behind the published 5–11 numbers, so compare the last column, not the milliseconds. Logs, script and medians: [results/kernel-v4.2.0/](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/results/kernel-v4.2.0).

**What did not change:** every k is identical (k = 2 in 1–4, k = fan-out in 6 and 10 eager, k = 1 lazy), latency still grows linearly with k, and all 17 fire-test tasks pass. 4.2.0 also runs 7 new pointer contract tests and the stricter secret-replay contracts.

**Benchmarks 1–4: 4.2.0 against 3.9.1** (one write each, ms)

| benchmark | published (3.9.x) | 3.9.1, this machine | 4.2.0, this machine | 4.2.0 / 3.9.1 |
|---|---:|---:|---:|---:|
| #1 write, N = 5,000 (k = 2) | 0.054 | 0.115 | 0.170 | 1.48× |
| #2 write, n = 10,000 (k = 2) | 0.052 | 0.109 | 0.138 | 1.26× |
| #3 write, n = 10,000 (k = 2) | 0.079 | 0.133 | 0.362 | 2.73× |
| #4 deep nesting, 500 levels (k = 2) | 13.2 | 19.3 | 20.9 | 1.08× |
| #4 wide broadcast, 1,000 (k = 2) | 0.086 | 0.204 | 0.275 | 1.35× |
| #4 financial, 5,000 tx (k = 2) | 0.079 | 0.167 | 0.358 | 2.14× |

**Benchmarks 5–11: 4.2.0 against the pre-4.1.0 build** (ms)

| benchmark | published (M2) | pre-4.1.0, this machine | 4.2.0, this machine | 4.2.0 / pre-4.1.0 |
|---|---:|---:|---:|---:|
| #5 sustained writes, p50 (k = 4,000) | 65.7 | 134 | 139 | 1.04× |
| #5 sustained writes, p95 | 103 | 180 | 200 | 1.11× |
| #6 fan-out 100, p50 | 1.19 | 2.09 | 2.26 | 1.08× |
| #6 fan-out 1,000, p50 | 12.0 | 22.2 | 25.3 | 1.14× |
| #6 fan-out 5,000, p50 | 69.9 | 141 | 154 | 1.09× |
| #7 warm write, 5,000 | 104 | 146 | 181 | 1.24× |
| #7 steady write, 5,000 | 103 | 172 | 177 | 1.03× |
| #8 write + read, 3,000 deps, p50 | 42.9 | 79.6 | 91.5 | 1.15× |
| #9 secret branch, p95 | 0.604 | 1.62 | 1.64 | 1.02× |
| #10 eager write, fan-out 5,000 | 69.8 | 138 | 163 | 1.18× |
| #10 eager first read, 5,000 | 0.020 | 0.057 | 0.039 | 0.68× |
| #10 lazy write, 5,000 | 0.003 | 0.004 | 0.005 | 1.05× |
| #10 lazy first read, 5,000 | 0.017 | 0.025 | 0.026 | 1.04× |
| #11 secret read p95, 600 | 0.550 | 1.49 | 1.34 | 0.90× |

Ratios on 4.2.0 (same machine, pre-4.1.0 in brackets): #5 windowed p95 drift +38% (+35%), first-to-last window p50 +36% (+32%); #8 `explain()` p95 overhead −7% (+15%), within noise; #9 secret p95 ≈ 13.7× public (12.4×); #11 secret/public read p95 6.9× / 13.7× / 22.7× at 100 / 300 / 600 nodes (9.6× / 11.0× / 34.7×).

**Regressions:** eager writes are 4–24% slower than on the pre-4.1.0 build (most rows 8–18%). The single writes in 1–4 are 1.08–2.7× slower than on 3.9.1 (+0.03 to +0.23 ms for the sub-millisecond ones); for #1, #3 and #4 financial the 5-round ranges do not overlap. Bisected across the 14 builds of the timeline above: the largest gaps, the first write after building a large dataset (#3 at 10,000 nodes, #4 at 5,000), are warm-up, not dataset size. The first write costs about the same at 2,000, 10,000 and 40,000 nodes (0.36–0.38 ms on 4.0.2 + the reference fix, 0.52–0.73 ms on 4.1.0), and on a second fresh kernel in the same process it drops to 0.15–0.25 ms on every build. What remains is a fixed per-write cost of about 20–25 µs (#1 at N = 5,000: 0.133 ms on 4.0.2 + the reference fix, 0.158 ms on 4.1.0, 0.163 ms on 4.2.0), from the topological recompute (8976ad3) and the `[]` path parser (c573192, 8c9d725). 4.2.1 cuts the steady single write by about 32% (0.073 → 0.049 ms on the timeline) and every eager line by 29–30%. **Improvements:** eager first reads are ~30% faster (#10), and secret reads at 600 nodes ~10% faster (#11); #9 is unchanged.

The sections below are the previously published numbers: 1–4 from 3.9.x (2026-06-08), 5–11 from the pre-4.1.0 build (2026-09-26, Apple M2). The full fire-test output is on the [Fire test](../Tests/fire.test.html) page; the GTFS runs are under [GTFS-Madrid](GTFS/Madrid/).

## Measurement correction (2026-09-26)

Benchmarks 5–11 and the regression gate previously measured writes that recomputed nothing. Their formulas read a root-level name without a dot (`"value * master"`, `"value * factor"`, `"base * rate"`), and a reference-resolution bug subscribed those derivations to the wrong path, so writing the input never triggered a recompute. Latency therefore did not grow with fan-out, and several tables showed it *falling* as fan-out grew. The bug is fixed (see `Typescript/CHANGELOG.md`) and the numbers below for 5–11 are re-measured. Benchmarks 1–4 write each node's own relative `value`, were not affected, and are unchanged.

Methodology for the re-measured benchmarks: 5 rounds on the same machine, alternating the pre-fix and post-fix builds within each round; each value is the median across the 5 rounds. Machine: Apple M2, 8 GB RAM, macOS (Darwin 25.5), Node v24.13.1.

---

## Benchmark 1 — Algorithmic Scaling

Goal: prove O(k) efficiency. Work stays flat as N grows.

```
> N = 10     | Time: 0.1094  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 100    | Time: 0.0746  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 1000   | Time: 0.0841  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 5000   | Time: 0.0542  ms | Wave k: 2  | Result: 100 | overThreshold: true

┌─────────┬───────┬──────────┬───┬────────┬───────────────┐
│ (index) │ nodes │ duration │ k │ result │ overThreshold │
├─────────┼───────┼──────────┼───┼────────┼───────────────┤
│ 0       │ 10    │ '0.1094' │ 2 │ 100    │ true          │
│ 1       │ 100   │ '0.0746' │ 2 │ 100    │ true          │
│ 2       │ 1000  │ '0.0841' │ 2 │ 100    │ true          │
│ 3       │ 5000  │ '0.0542' │ 2 │ 100    │ true          │
└─────────┴───────┴──────────┴───┴────────┴───────────────┘

✅ SUPERIORITY PROVEN: Response time stayed under 20ms even with 5000 nodes.
✅ ALGORITHMIC CONSTANCY: The actual recompute wave stayed at k=2.
```

**Key insight:** wave k = 2 regardless of N. The engine touches only the actual dependents of the mutated node, not the entire dataset.

✅ completed in 341.71ms

---

## Benchmark 2 — Extended Scaling (CSV)

```
n,time_ms,wave_k,result,over_threshold
10,0.1080,2,100,true
100,0.0534,2,100,true
500,0.0534,2,100,true
1000,0.1051,2,100,true
2500,0.0686,2,100,true
5000,0.0532,2,100,true
7500,0.0518,2,100,true
10000,0.0521,2,100,true
```

k stays 2 at 10,000 nodes. Recompute time does not grow with corpus size.

✅ completed in 1193.38ms

---

## Benchmark 3 — Incremental Processing

```
n,time_ms,wave_k,result,over_threshold,status
10,0.1055,2,100,true,OK
100,0.0533,2,100,true,OK
1000,0.0728,2,100,true,OK
5000,0.0559,2,100,true,OK
10000,0.0789,2,100,true,OK
```

✅ completed in 754.39ms

---

## Benchmark 4 — Multi-Dataset Stress Lab

Three structural shapes: deep nesting, wide broadcast, financial dataset.

**Deep Nesting (500 levels)**
```
> Latency: 13.2138ms
> Wave k: 2
> Mutation path: root.n0.n1...n499.factor  (500-level chain)
> Result before/after: 50 -> 100
> Status: ✅ Reactive
```

A 500-level deep chain still triggers only k=2 recomputations. The path length does not expand the wave.

**Wide Broadcast (1,000 nodes)**
```
> Latency: 0.0864ms
> Wave k: 2
> Mutation path: sensors.999.factor
> Result before/after: 50 -> 100
> Status: ✅ Reactive
```

**Financial Dataset (5,000 tx)**
```
> Latency: 0.0789ms
> Wave k: 2
> Mutation path: tx.4999.taxRate
> Result before/after: 116 -> 200
> Status: ✅ Reactive
```

✅ completed in 386.57ms

---

## Benchmark 5 — Throughput Under Sustained Mutation

2,000 consecutive writes to `factor`, each recomputing 4,000 dependents (eager), percentile latency per write. Median of 5 runs.

| p50 (ms) | p95 (ms) | max (ms), range over runs |
|---------:|---------:|--------------------------:|
| 65.7     | 103.2    | 1,150 – 4,400             |

Windowed p50 (median of 5 runs):

```
┌──────────────┬──────────┐
│ window       │ p50_ms   │
├──────────────┼──────────┤
│ 1-200        │ 58.1     │
│ 401-600      │ 60.2     │
│ 801-1000     │ 61.1     │
│ 1201-1400    │ 65.2     │
│ 1601-1800    │ 69.1     │
│ 1801-2000    │ 75.8     │
└──────────────┴──────────┘
```

**Per-write cost grows with history.** Each write recomputes the same 4,000 dependents (k is constant), yet p50 rises ~30% from the first to the last window, and the windowed p95 drift ranges from −18% to +273% across runs (median +123%), with GC pauses up to several seconds. The cause is the log itself: every recompute appends a memory, so this run grows the history to ~8 million entries. Recompute is O(k), but the cost of each write is not fully independent of log size. The next measurable optimizations are skipping the write when a recomputed value did not change, and compacting or snapshotting the log.

> Previously published: ~0.007 ms p50 and "p95 drift −30% (gets faster, not slower)". That run recomputed nothing and appended nothing beyond the write itself.

---

## Benchmark 6 — Fan-Out Sensitivity Curves

One write to `master` with `fanout` dependents (`dep[i].result = value * master`, eager mode). Median of 5 runs.

```
┌────────┬──────┬────────┬─────────┬─────────┐
│ fanout │ k    │ inputs │ p50_ms  │ p95_ms  │
├────────┼──────┼────────┼─────────┼─────────┤
│ 10     │ 10   │ 2      │ 0.129   │ 0.268   │
│ 100    │ 100  │ 2      │ 1.19    │ 1.43    │
│ 500    │ 500  │ 2      │ 5.92    │ 6.72    │
│ 1000   │ 1000 │ 2      │ 11.97   │ 14.02   │
│ 2500   │ 2500 │ 2      │ 32.97   │ 38.58   │
│ 5000   │ 5000 │ 2      │ 69.87   │ 79.55   │
└────────┴──────┴────────┴─────────┴─────────┘
```

Latency grows linearly with the number of dependents that actually recompute — about **12–14 µs per dependent** on the reference machine. That is O(k) with k = fan-out: the write touches exactly the dependents of `master`, nothing else. `k` is `explain().meta.k` (dependents recomputed by the wave); `inputs` is the formula's own reference count.

> Previously published: flat ~0.006 ms at every fan-out, falling as fan-out grew, with `k = 2`. That run measured a write that recomputed nothing (reference-resolution bug, see top of page), and its `k` column was the formula's input count, not the recompute wave.

---

## Benchmark 7 — Cold vs Warm Runtime Profiles

`cold` = first read of an already-computed output on a fresh kernel (no write). `warm` = first write to `rate` plus a read. `steady` = 80 further write+read cycles. Eager mode, median of 5 runs.

```
┌───────┬──────────┬──────────┬───────────────┬───────────────┐
│ nodes │ cold_ms  │ warm_ms  │ steady_avg_ms │ steady_min_ms │
├───────┼──────────┼──────────┼───────────────┼───────────────┤
│ 100   │ 0.175    │ 3.96     │ 2.14          │ 1.36          │
│ 1000  │ 0.012    │ 17.4     │ 17.9          │ 15.2          │
│ 5000  │ 0.022    │ 103.9    │ 103.1         │ 83.7          │
└───────┴──────────┴──────────┴───────────────┴───────────────┘
```

Reads of computed values are sub-millisecond at every size. Writes cost in proportion to the dependents they recompute, and warm ≈ steady: there is no separate warm-up penalty to absorb.

> Previously published: warm/steady ~0.007–0.014 ms at every size. Those writes recomputed nothing.

---

## Benchmark 8 — Explain Overhead Budget

Cost of calling `explain(path)` on top of a write+read cycle with 3,000 dependents (eager). Median of 5 runs.

```
┌────────────────┬──────────┬──────────┐
│ mode           │ p50_ms   │ p95_ms   │
├────────────────┼──────────┼──────────┤
│ 'baseline'     │ 42.85    │ 49.91    │
│ 'with_explain' │ 43.94    │ 58.73    │
└────────────────┴──────────┴──────────┘
p95 overhead: median +4% (range −5% to +19% across runs)
```

Against a real recompute, `explain()` is within run-to-run noise. Auditable derivation traces at negligible relative cost.

> Previously published: +55% p95 overhead. That was `explain()` measured against a write that did no work.

---

## Benchmark 9 — Secret-Scope Performance Impact

Same workload on a public branch and a secret branch (600 nodes, lazy mode, write the shared factor then read one output). Median of 5 runs.

```
┌──────────┬──────────┬──────────┐
│ scope    │ p50_ms   │ p95_ms   │
├──────────┼──────────┼──────────┤
│ 'public' │ 0.026    │ 0.044    │
│ 'secret' │ 0.532    │ 0.604    │
└──────────┴──────────┴──────────┘
secret-scope p95 slowdown: ~14×
```

Secret branches pay roughly 14× at p95 on this workload. The cost is the secret path itself — branch key derivation and cache, sealing and opening values, stealth-boundary checks — not AES-GCM: branch values are sealed as v3 blobs (Keccak-256 counter-mode keystream + HMAC-Keccak256 tag, `encryptBlobV3WithDerivedKeys` in `src/crypto.ts`). AES-GCM is only used by wrapped-secret envelopes, which this benchmark does not exercise. Design accordingly: keep hot-path reads on public branches; use secret scopes for data at rest.

> Previously published: 27× (2616%). The public side of that comparison did no recompute work (reference-resolution bug), while the secret side did, which inflated the ratio.

---

## Benchmark 10 — Push (Write) vs Pull (First Read)

Eager vs lazy recompute across fan-out sizes: time of the write alone (push) and of the first read after it (pull). Median of 5 runs.

```
┌─────────┬────────┬──────┬─────────────────┬─────────────────┬─────────────┬─────────────┐
│ mode    │ fanout │ k    │ mutation_p50_ms │ mutation_p95_ms │ read_p50_ms │ read_p95_ms │
├─────────┼────────┼──────┼─────────────────┼─────────────────┼─────────────┼─────────────┤
│ 'eager' │ 10     │ 10   │ 0.115           │ 0.248           │ 0.0043      │ 0.0116      │
│ 'eager' │ 100    │ 100  │ 1.15            │ 1.40            │ 0.0040      │ 0.0072      │
│ 'eager' │ 1000   │ 1000 │ 11.76           │ 13.89           │ 0.0078      │ 0.0147      │
│ 'eager' │ 5000   │ 5000 │ 69.77           │ 79.91           │ 0.0196      │ 0.0274      │
│ 'lazy'  │ 10     │ 1    │ 0.0025          │ 0.0035          │ 0.0148      │ 0.0249      │
│ 'lazy'  │ 100    │ 1    │ 0.0030          │ 0.0043          │ 0.0147      │ 0.0190      │
│ 'lazy'  │ 1000   │ 1    │ 0.0030          │ 0.0045          │ 0.0153      │ 0.0227      │
│ 'lazy'  │ 5000   │ 1    │ 0.0030          │ 0.0040          │ 0.0168      │ 0.0265      │
└─────────┴────────┴──────┴─────────────────┴─────────────────┴─────────────┴─────────────┘
```

The trade-off is now visible. Eager pays the whole fan-out at write time (k = fan-out, linear in k) and reads are near-free. Lazy writes stay flat (~3 µs, they only mark versions) and each read recomputes just the value it asks for (k = 1). Full table (500 and 2500 rows): run the benchmark.

> Previously published: both modes flat at ~0.003 ms with `k = 2`. Neither mode was recomputing anything (reference-resolution bug).

---

## Benchmark 11 — Secret Push vs Pull

Isolates mutation cost (push) vs first read cost (pull) for public and secret branches, lazy mode. Median of 5 runs.

```
┌────────┬──────────┬───────┬─────────────────┬─────────────────┬─────────────┬─────────────┐
│ mode   │ plane    │ nodes │ mutation_p50_ms │ mutation_p95_ms │ read_p50_ms │ read_p95_ms │
├────────┼──────────┼───────┼─────────────────┼─────────────────┼─────────────┼─────────────┤
│ 'lazy' │ 'public' │ 100   │ 0.0055          │ 0.0126          │ 0.0248      │ 0.0499      │
│ 'lazy' │ 'secret' │ 100   │ 0.0304          │ 0.0464          │ 0.312       │ 0.392       │
│ 'lazy' │ 'public' │ 300   │ 0.0034          │ 0.0045          │ 0.0169      │ 0.0275      │
│ 'lazy' │ 'secret' │ 300   │ 0.0260          │ 0.0327          │ 0.259       │ 0.311       │
│ 'lazy' │ 'public' │ 600   │ 0.0032          │ 0.0041          │ 0.0168      │ 0.0247      │
│ 'lazy' │ 'secret' │ 600   │ 0.0257          │ 0.0355          │ 0.479       │ 0.550       │
└────────┴──────────┴───────┴─────────────────┴─────────────────┴─────────────┴─────────────┘
```

**Secret/Public p95 slowdown ratios (median of 5 runs):**

| nodes | mutation p95 | read p95 | read p95, previously published |
|-------|--------------|----------|--------------------------------|
| 100   | 3.9×         | 7.7×     | 20×                            |
| 300   | 7.3×         | 11.1×    | 23×                            |
| 600   | 7.8×         | 22.6×    | 142×                           |

Secret reads cost more than public ones and grow with node count; writes stay cheap in both planes. The earlier ratios (up to 142×) compared a public read that recomputed nothing (reference-resolution bug) against a secret read that did the work.

---

## Summary Table

| Benchmark | What it proves                                              |
|-----------|-------------------------------------------------------------|
| 1         | Recompute touches only the written node's dependents (k=2) |
| 2         | Same, extended to 10,000 nodes                             |
| 3         | Incremental processing stability                            |
| 4         | Multi-shape stress (deep / wide / financial)                |
| 5         | Sustained writes: O(k) recompute, but cost drifts up as the log grows |
| 6         | Latency linear in k (~12–14 µs per recomputed dependent)    |
| 7         | Reads sub-ms; writes cost ∝ dependents, no warm-up penalty  |
| 8         | explain() overhead within noise vs. real recompute          |
| 9         | Secret scope cost (~14× public at p95, sub-ms)              |
| 10        | Eager pays k at write; lazy writes flat, reads pull k=1     |
| 11        | Secret push vs pull (read p95 7.7×–22.6× public)            |

Regression gate (`tests/Benchmarks/benchmark.regression-gate.test.ts`): exact `meta.k` per write, zero recompute on shadowed inputs, `t(5000)/t(500)` within 5–15, stealth masking. It fails on the pre-fix kernel.
