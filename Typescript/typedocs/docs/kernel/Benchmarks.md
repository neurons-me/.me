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

BenchmarkFileWhat It Proves#5 Sustained Mutation`tests/Benchmarks/benchmark.5.sustained-mutation.test.ts`Throughput stability over long mutation streams; p95 drift over time windows.#6 Fan-Out Sensitivity`tests/Benchmarks/benchmark.6.fanout-sensitivity.test.ts`Latency behavior as fan-out grows, with constant derivation complexity `k`.#7 Cold vs Warm`tests/Benchmarks/benchmark.7.cold-warm-profiles.test.ts`Separation of cold setup cost vs warm and steady-state runtime.#8 Explain Overhead`tests/Benchmarks/benchmark.8.explain-overhead.test.ts`Observability overhead of `explain(path)` vs baseline mutation/read loops.#9 Secret-Scope Impact`tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts`Public vs secret latency envelope under equivalent workloads.#10 Push vs Pull`tests/Benchmarks/benchmark.10.push-vs-pull.test.ts`Isolation of write-only (`push`) and first-read-after-write (`pull`) in eager vs lazy modes.#11 Secret Push vs Pull`tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts`Secret/public split of push vs pull; confirms secret-path cost structure after chunking/cache refactors.Regression Gate`tests/Benchmarks/benchmark.regression-gate.test.ts`CI pass/fail checks for p95 latency, `k` complexity bound, and stealth masking correctness.Vector Corpus`tests/Benchmarks/benchmark.vector-corpus.ts`Validates columnar secret vector chunks, typed payload round-trip, and chunk-read heap discipline.Exact Search Scale`tests/Benchmarks/benchmark.search-exact-scale.ts`Shows how exact vector search scales by chunk count and where decrypted-chunk cache thrash begins.IVF vs Exact`tests/Benchmarks/benchmark.ivf-vs-exact.ts`Compares exact scan and IVF sidecar on the same corpus.IVF Tuning`tests/Benchmarks/benchmark.ivf-tuning.ts`Sweeps `nlist`, `nprobe`, and candidate caps; now also supports realistic and hostile corpus generators.## Latest Verified Local Runs ​

Machine: `Suis-MacBook-Air` Run context: isolated local runs on `April 18-19, 2026`

Notes:

- The tables below were taken from isolated runs on the current branch.
- `#9` and `#11` are the most sensitive to ambient machine load, so they should be read as performance envelopes, not hard SLAs.
- The historical pre-5.4/5.5 secret baseline still lives in `tests/Benchmarks/BASELINE-5-FINAL.md`.
### #5 Throughput Under Sustained Mutation ​

MetricValue (ms)p500.0074p950.0109p990.0165max0.7165Windowed p95 drift: `-40.97%` (end window vs start window).

Interpretation:

- No upward drift under sustained updates.
- Throughput remains stable as history grows.
### #6 Fan-Out Sensitivity Curves ​

Fanoutkp50 (ms)p95 (ms)p99 (ms)1020.01280.02040.093910020.00860.01480.029050020.00810.01090.0156100020.00650.00820.0104250020.00640.00790.0132500020.00620.00930.0111Interpretation:

- `k` stays constant at `2`.
- Latency stays in micro-to-low-millisecond range across fanout values.
### #7 Cold vs Warm Runtime Profiles ​

NodesCold (ms)Warm (ms)Steady Avg (ms)Steady Min (ms)Steady Max (ms)1000.17150.08920.01440.01080.090710000.01160.01230.00660.00580.012050000.01350.01400.00690.00570.0155Interpretation:

- Cold penalty is isolated.
- Warm/steady paths are consistently fast.
### #8 Explain Overhead Budget ​

Modep50 (ms)p95 (ms)p99 (ms)baseline0.00870.01540.0370with_explain0.01410.01980.0298`p95` overhead: `28.11%`.

Interpretation:

- `explain(path)` adds bounded overhead while preserving traceability.
- Absolute overhead remains sub-millisecond, making it production-safe for real-time auditing.
### #9 Secret-Scope Performance Impact ​

Latest isolated run:

Scopep50 (ms)p95 (ms)p99 (ms)public0.01020.01750.1177secret0.32770.36840.6566Interpretation:

- Secret path remains slower than public by design cost: crypto, stealth boundary logic, and lazy refresh/write-back.
- In absolute terms, secret `p95` stays well below `1ms` for this scenario.
- Compared with the March 2026 historical baseline in `BASELINE-5-FINAL.md` (`4.6503ms` secret `p95`), the current local value remains roughly `92%` lower in absolute `p95`.
- Slowdown percentages still look dramatic because the public path is already extremely close to the timer floor.
### #10 Push vs Pull (Eager vs Lazy) ​

Selected row from the latest isolated run (`fanout = 5000`):

ModeFanoutkMutation p95 (ms)Read p95 (ms)eager500020.00360.0033lazy500020.00360.0036Interpretation:

- Both modes remain low-latency in steady-state.
- `push` and `first-read-after-write` stay measurable as separate costs, which is the benchmark's main purpose.
- Single-run outliers can appear at lower fanouts, so this benchmark is best read as a shape test rather than a one-number SLA.
### #11 Secret Push vs Pull (Shared v3 Key Cache + Lazy Recompute) ​

PlaneNodesMutation p95 (ms)Read p95 (ms)public1000.00870.0131secret1000.04060.4040public3000.00450.0058secret3000.02810.1945public6000.00430.0048secret6000.02520.3084Slowdown ratios (secret/public p95):

NodesMutation slowdown xRead slowdown x1004.67x30.84x3006.24x33.53x6005.86x64.25xInterpretation:

- Secret mutation cost stays in low-sub-millisecond territory.
- Secret read cost is still the noisiest part of the runtime because this benchmark couples crypto with lazy derivation refresh and write-back.
- In absolute terms, the latest isolated run still kept secret read `p95` below `1ms` at `100` and `600` nodes, and around `0.35ms` at `300` nodes.
## Regression and Vector Search Status ​

Latest gates now cover both the original kernel loop and the vector-search stack:

- `latency_p95`: ✅ kernel mutation/read loop remains in the low-millisecond envelope
- `complexity_k`: ✅ `k=2` remains stable across fanout and graph size tests
- `stealth_masking`: ✅ secret origins remain masked in `explain()`
- `searchExact`: ✅ correctness baseline established before ANN
- `IVF realistic`: ✅ `100k`, `recall@10 = 1.000`, `IVF p95 = 3318.42ms`
- `IVF hostile`: ✅ `100k`, `recall@10 = 1.000`, `IVF p95 = 19353.27ms`
## What Is Proven Now ​

- Public-path performance is stable and effectively bounded by small `k`.
- Lazy/eager recompute modes are operational and benchmarked.
- Explainability overhead is measurable and bounded.
- Secret-path cost is no longer monolithic; shared v3 key reuse removed the worst cold branch-derivation penalty.
- Secret reads are still the most expensive path, but they now sit in the sub-millisecond envelope for the main `#9` scenario on isolated runs.
- Privacy and semantic invariants remain intact while performance work lands.
- The secret vector corpus is now genuinely columnar and typed, with `Float32Array` payloads on the hot path.
- Exact vector search is correct and measurable.
- IVF sidecars are now part of the supported runtime story, with separate realistic and hostile closure profiles.
## Next Optimization Frontier ​

- On the kernel side, the next real frontier is still separating lazy derivation refresh from full memory append/hash-chain write-back on internal recomputes.
- On the vector side, the next frontier is IVF build cost and finer posting selectivity, not correctness.
- That is a structural systems task, not just another round of micro-optimizations.