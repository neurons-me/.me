# Kernel Benchmarks ​

## Benchmark Overview ​

This suite validates a single systems claim:

- Public-path recomputation should be bounded by dependency complexity (`k`), not dataset size (`n`).
- Secret-path overhead must be measurable, bounded, and continuously improved without changing DSL semantics.
## Performance Phases (Closed Status) ​

The kernel now has three completed performance phases:

PhaseWhat ClosedLatest Closure SignalPhase 1Batch write viability + lightweight journal hygieneStable `14ms-20ms` batch writes per 100-item chunk, practical ceiling around `137,300` items before V8 heap residency became the limiter.Phase 2Bounded residency + columnar secret vector corpusColumnar secret chunks validated, `Float32Array` payload round-trip confirmed, and the 100k encrypted leaf-write microbenchmark reached `1886 vps` with roughly `122MB` post-GC heap.Phase 3Exact baseline + IVF sidecar searchOn a realistic chunk-coherent corpus, `100k` vectors now search at `3.32s p95` with `recall@10 = 1.000`, `18.4` chunks/query, and `23.2x` speedup over exact scan.## Phase Closure Summary ​

### Phase 1 | Batch Write Path and Journal Discipline ​

Benchmarks:

- `tests/Fase.1GB.js`
- `tests/Benchmarks/Fase.1.Final.BenchmarkReport.js`
What Phase 1 proved:

- The batch write path remained stable deep into the run instead of degrading quadratically.
- `commitIndexedBatch()` no longer retained full batch payloads in `_memories`; audit entries stayed lightweight.
- The practical ceiling was live V8 heap residency, not write-path collapse or journal duplication.
Key closure numbers:

- Typical batch latency: `14ms-20ms` per 100-item chunk
- Practical ceiling: `~137,300` items before heap OOM
- Peak heap region observed: `~1660MB`
### Phase 2 | Bounded Residency and Secret Vector Storage ​

Benchmarks:

- `tests/Benchmarks/benchmark.vector-corpus.ts`
- `tests/Benchmarks/benchmark-100.ts`
What Phase 2 closed:

- Secret vector corpora now write as chunked columnar envelopes instead of tree-shaped JS payloads.
- Chunk reads come back as `Float32Array` payloads, not `Array.from()` materializations.
- The write path moved from “heap residency risk” to a stable, disk-backed bounded-residency model.
Key closure signals:

- `benchmark.vector-corpus.ts`: `columnarWrites > 0`, `Float32Array` payload confirmed, chunk-read heap delta `~2.7MB`
- `benchmark-100.ts` (leaf-write microbenchmark): `100k` encrypted vectors in `0.9min`, `1886 vps`, `~122MB` post-GC heap
### Phase 3 | Exact Search + IVF Sidecar ​

Benchmarks:

- `tests/Fase.3.0.search-exact.test.ts`
- `tests/Benchmarks/benchmark.search-exact-scale.ts`
- `tests/Benchmarks/benchmark.ivf-vs-exact.ts`
- `tests/Benchmarks/benchmark.ivf-tuning.ts`
What Phase 3 closed:

- `searchExact()` established a correctness baseline before approximate search.
- IVF became a persistent sidecar outside the kernel log, with explicit `buildVectorIndex()` and `searchVector()` APIs.
- Candidate-cap tuning, chunk-aware build, and realistic-vs-hostile corpus separation made ANN behavior measurable instead of anecdotal.
Official `100k` closure profiles:

CorpusExact p95IVF p95Recall@10Chunks / QuerySpeedup`chunk_coherent` (realistic)`77129.34ms``3318.42ms``1.000``18.40``23.2x``legacy_fragmented` (hostile)`166603.63ms``19353.27ms``1.000``97.60``8.6x`Interpretation:

- The realistic corpus is now the README-grade claim.
- The hostile corpus remains part of the suite to document worst-case chunk fragmentation honestly.
- The remaining Phase 3 caveat is build cost for large IVF indexes; search behavior itself is now closed for the realistic profile.
## Benchmark Matrix ​

BenchmarkFileWhat It Proves#5 Sustained Mutation`tests/Benchmarks/benchmark.5.sustained-mutation.test.ts`Throughput stability over long mutation streams; p95 drift over time windows.#6 Fan-Out Sensitivity`tests/Benchmarks/benchmark.6.fanout-sensitivity.test.ts`Latency as fan-out grows; `k` (dependents recomputed) equals the fan-out.#7 Cold vs Warm`tests/Benchmarks/benchmark.7.cold-warm-profiles.test.ts`Separation of cold setup cost vs warm and steady-state runtime.#8 Explain Overhead`tests/Benchmarks/benchmark.8.explain-overhead.test.ts`Observability overhead of `explain(path)` vs baseline mutation/read loops.#9 Secret-Scope Impact`tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts`Public vs secret latency envelope under equivalent workloads.#10 Push vs Pull`tests/Benchmarks/benchmark.10.push-vs-pull.test.ts`Isolation of write-only (`push`) and first-read-after-write (`pull`) in eager vs lazy modes.#11 Secret Push vs Pull`tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts`Secret/public split of push vs pull; confirms secret-path cost structure after chunking/cache refactors.Regression Gate`tests/Benchmarks/benchmark.regression-gate.test.ts`CI pass/fail checks: exact `k` per write, zero recompute on shadowed inputs, linear scaling ratio, and stealth masking correctness.Vector Corpus`tests/Benchmarks/benchmark.vector-corpus.ts`Validates columnar secret vector chunks, typed payload round-trip, and chunk-read heap discipline.Exact Search Scale`tests/Benchmarks/benchmark.search-exact-scale.ts`Shows how exact vector search scales by chunk count and where decrypted-chunk cache thrash begins.IVF vs Exact`tests/Benchmarks/benchmark.ivf-vs-exact.ts`Compares exact scan and IVF sidecar on the same corpus.IVF Tuning`tests/Benchmarks/benchmark.ivf-tuning.ts`Sweeps `nlist`, `nprobe`, and candidate caps; now also supports realistic and hostile corpus generators.## Latest Verified Local Runs ​

Machine: Apple M2, 8 GB RAM, macOS (Darwin 25.5), Node v24.13.1. Run context: `2026-09-26`, 5 rounds alternating the pre-fix and post-fix builds; values are medians across rounds.

Notes:

- **Measurement correction.** Before `2026-09-26`, `#5`–`#11` and the regression gate measured writes that recomputed nothing: their formulas read a root-level name without a dot (`value * master`, `value * factor`, `base * rate`), and a reference-resolution bug subscribed those derivations to the wrong path. The tables below are re-measured after the fix (see `CHANGELOG.md`). Earlier numbers for these benchmarks should not be cited.
- `#9` and `#11` are the most sensitive to ambient machine load, so they should be read as performance envelopes, not hard SLAs.
- The historical pre-5.4/5.5 secret baseline still lives in `tests/Benchmarks/BASELINE-5-FINAL.md` (same caveat applies to its public rows).

### #5 Throughput Under Sustained Mutation

2,000 writes, each recomputing 4,000 dependents (eager). Median of 5 runs.

| Metric | Value (ms) |
|---|---:|
| p50 | 65.7 |
| p95 | 103.2 |
| max | 1,150 – 4,400 (range over runs) |

Windowed p50 rises from `58.1ms` (first 200 writes) to `75.8ms` (last 200); windowed p95 drift ranges `−18%` to `+273%` across runs (median `+123%`).

Interpretation:

- `k` is constant (4,000 per write), yet per-write cost grows with history: every recompute appends a memory, so the log reaches ~8 million entries and GC pauses grow.
- Recompute is O(k); the cost of each write is not fully independent of log size. This is the next optimization target (skip unchanged writes, compact/snapshot the log).

### #6 Fan-Out Sensitivity Curves

One write to `master` with `fanout` dependents, eager mode. Median of 5 runs.

| Fanout | k | inputs | p50 (ms) | p95 (ms) |
|---:|---:|---:|---:|---:|
| 10 | 10 | 2 | 0.129 | 0.268 |
| 100 | 100 | 2 | 1.19 | 1.43 |
| 500 | 500 | 2 | 5.92 | 6.72 |
| 1000 | 1000 | 2 | 11.97 | 14.02 |
| 2500 | 2500 | 2 | 32.97 | 38.58 |
| 5000 | 5000 | 2 | 69.87 | 79.55 |

Interpretation:

- Latency grows linearly with the dependents actually recomputed, about 12–14 µs each: O(k) with k = fan-out.
- `k` is `explain().meta.k` (the recompute wave); `inputs` is the formula's reference count. The earlier table reported `inputs` as `k` and measured a write that recomputed nothing.

### #7 Cold vs Warm Runtime Profiles

`cold` = first read of an already-computed output (no write); `warm` = first write + read; `steady` = 80 more write+read cycles. Median of 5 runs.

| Nodes | Cold (ms) | Warm (ms) | Steady Avg (ms) | Steady Min (ms) |
|---:|---:|---:|---:|---:|
| 100 | 0.175 | 3.96 | 2.14 | 1.36 |
| 1000 | 0.012 | 17.4 | 17.9 | 15.2 |
| 5000 | 0.022 | 103.9 | 103.1 | 83.7 |

Interpretation:

- Reads of computed values are sub-millisecond at every size.
- Writes cost in proportion to the dependents they recompute; warm ≈ steady, so there is no separate warm-up penalty.

### #8 Explain Overhead Budget

Write+read with 3,000 dependents (eager), with and without `explain(path)`. Median of 5 runs.

| Mode | p50 (ms) | p95 (ms) |
|---|---:|---:|
| baseline | 42.85 | 49.91 |
| with_explain | 43.94 | 58.73 |

`p95` overhead: median `+4%` (range `−5%` to `+19%` across runs).

Interpretation:

- Against a real recompute, `explain(path)` is within run-to-run noise.
- The earlier `28%`/`55%` figures were `explain()` measured against a write that did no work.

### #9 Secret-Scope Performance Impact

600 nodes, lazy mode. Median of 5 runs.

| Scope | p50 (ms) | p95 (ms) |
|---|---:|---:|
| public | 0.026 | 0.044 |
| secret | 0.532 | 0.604 |

Interpretation:

- Secret `p95` is ~14× public on this workload, and stays below `1ms`.
- The cost is branch key derivation/cache, blob sealing/opening (v3: Keccak-256 counter-mode keystream + HMAC-Keccak256 tag) and stealth-boundary checks. AES-GCM is only used by wrapped-secret envelopes, not here.
- The earlier public row recomputed nothing (reference-resolution bug), which inflated the ratio.

### #10 Push vs Pull (Eager vs Lazy)

Median of 5 runs, selected rows.

| Mode | Fanout | k | Mutation p95 (ms) | Read p95 (ms) |
|---|---:|---:|---:|---:|
| eager | 100 | 100 | 1.40 | 0.0072 |
| eager | 5000 | 5000 | 79.91 | 0.0274 |
| lazy | 100 | 1 | 0.0043 | 0.0190 |
| lazy | 5000 | 1 | 0.0040 | 0.0265 |

Interpretation:

- Eager pays the full fan-out at write time (linear in k); reads are near-free.
- Lazy writes stay flat (~3 µs, version marks only); each read recomputes only the value it asks for (k = 1).
- The earlier table showed both modes flat with `k = 2` because neither was recomputing.

### #11 Secret Push vs Pull (Shared v3 Key Cache + Lazy Recompute)

Median of 5 runs.

| Plane | Nodes | Mutation p95 (ms) | Read p95 (ms) |
|---|---:|---:|---:|
| public | 100 | 0.0126 | 0.0499 |
| secret | 100 | 0.0464 | 0.392 |
| public | 300 | 0.0045 | 0.0275 |
| secret | 300 | 0.0327 | 0.311 |
| public | 600 | 0.0041 | 0.0247 |
| secret | 600 | 0.0355 | 0.550 |

Slowdown ratios (secret/public p95):

| Nodes | Mutation | Read |
|---:|---:|---:|
| 100 | 3.9× | 7.7× |
| 300 | 7.3× | 11.1× |
| 600 | 7.8× | 22.6× |

Interpretation:

- Secret mutation stays in low-sub-millisecond territory; secret read `p95` stays below `1ms`.
- The earlier read ratios (up to 64× here, 142× in `docs/Benchmarks`) compared against a public read that recomputed nothing.

## Regression and Vector Search Status ​

Latest gates now cover both the original kernel loop and the vector-search stack:

- `complexity_k_exact`: ✅ one write to `master` recomputes exactly its dependents (`meta.k` = 1500 and 4000)
- `complexity_k_shadowed`: ✅ a write to a root path every dependent shadows recomputes nothing (1 memory appended, k = 0)
- `scaling_linear`: ✅ `t(5000)/t(500)` within `5..15` (linear = 10, measured ~11); loose ceiling of `200 µs` per dependent
- `stealth_masking`: ✅ secret origins remain masked in `explain()`
- `searchExact`: ✅ correctness baseline established before ANN
- `IVF realistic`: ✅ `100k`, `recall@10 = 1.000`, `IVF p95 = 3318.42ms`
- `IVF hostile`: ✅ `100k`, `recall@10 = 1.000`, `IVF p95 = 19353.27ms`
## What Is Proven Now ​

- Public-path recompute cost is linear in `k`, the number of dependents actually recomputed (~12–14 µs each on an M2), and a write to a shadowed input recomputes nothing.
- Lazy/eager recompute modes are operational and benchmarked.
- Explainability overhead is measurable and bounded.
- Secret-path cost is no longer monolithic; shared v3 key reuse removed the worst cold branch-derivation penalty.
- Secret reads are still the most expensive path (~14× public at p95 in `#9`), and stay in the sub-millisecond envelope.
- Privacy and semantic invariants remain intact while performance work lands.
- The secret vector corpus is now genuinely columnar and typed, with `Float32Array` payloads on the hot path.
- Exact vector search is correct and measurable.
- IVF sidecars are now part of the supported runtime story, with separate realistic and hostile closure profiles.
## Next Optimization Frontier ​

- On the kernel side, the next real frontier is still separating lazy derivation refresh from full memory append/hash-chain write-back on internal recomputes.
- Concretely, measured in `#5`: skip the memory append when a recomputed value did not change, and compact or snapshot the log so per-write cost stops drifting as history grows (~12–14 µs per recomputed dependent today).
- On the vector side, the next frontier is IVF build cost and finer posting selectivity, not correctness.
- That is a structural systems task, not just another round of micro-optimizations.