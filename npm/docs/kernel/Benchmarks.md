# Kernel Benchmarks

## Benchmark Overview
This suite validates a single systems claim:

- Public-path recomputation should be bounded by dependency complexity (`k`), not dataset size (`n`).
- Secret-path overhead must be measurable, bounded, and continuously improved without changing DSL semantics.

## Benchmark Matrix
| Benchmark | File | What It Proves |
|---|---|---|
| #5 Sustained Mutation | `tests/Benchmarks/benchmark.5.sustained-mutation.test.ts` | Throughput stability over long mutation streams; p95 drift over time windows. |
| #6 Fan-Out Sensitivity | `tests/Benchmarks/benchmark.6.fanout-sensitivity.test.ts` | Latency behavior as fan-out grows, with constant derivation complexity `k`. |
| #7 Cold vs Warm | `tests/Benchmarks/benchmark.7.cold-warm-profiles.test.ts` | Separation of cold setup cost vs warm and steady-state runtime. |
| #8 Explain Overhead | `tests/Benchmarks/benchmark.8.explain-overhead.test.ts` | Observability overhead of `explain(path)` vs baseline mutation/read loops. |
| #9 Secret-Scope Impact | `tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts` | Public vs secret latency envelope under equivalent workloads. |
| #10 Push vs Pull | `tests/Benchmarks/benchmark.10.push-vs-pull.test.ts` | Isolation of write-only (`push`) and first-read-after-write (`pull`) in eager vs lazy modes. |
| #11 Secret Push vs Pull | `tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts` | Secret/public split of push vs pull; confirms secret-path cost structure after chunking/cache refactors. |
| Regression Gate | `tests/Benchmarks/benchmark.regression-gate.test.ts` | CI pass/fail checks for p95 latency, `k` complexity bound, and stealth masking correctness. |

## Latest Verified Local Runs
Machine: `Suis-MacBook-Air`  
Run context: isolated local runs on `April 9, 2026`

Notes:

- The tables below were taken from isolated runs on the current branch.
- `#9` and `#11` are the most sensitive to ambient machine load, so they should be read as performance envelopes, not hard SLAs.
- The historical pre-5.4/5.5 secret baseline still lives in `tests/Benchmarks/BASELINE-5-FINAL.md`.

### #5 Throughput Under Sustained Mutation
| Metric | Value (ms) |
|---|---:|
| p50 | 0.0061 |
| p95 | 0.0096 |
| p99 | 0.0162 |
| max | 0.9394 |

Windowed p95 drift: `-42.28%` (end window vs start window).

Interpretation:
- No upward drift under sustained updates.
- Throughput remains stable as history grows.

### #6 Fan-Out Sensitivity Curves
| Fanout | k | p50 (ms) | p95 (ms) | p99 (ms) |
|---:|---:|---:|---:|---:|
| 10 | 2 | 0.0110 | 0.0192 | 0.1016 |
| 100 | 2 | 0.0075 | 0.0140 | 0.0300 |
| 500 | 2 | 0.0070 | 0.0101 | 0.0139 |
| 1000 | 2 | 0.0057 | 0.0097 | 0.0196 |
| 2500 | 2 | 0.0052 | 0.0076 | 0.0120 |
| 5000 | 2 | 0.0046 | 0.0056 | 0.0081 |

Interpretation:
- `k` stays constant at `2`.
- Latency stays in micro-to-low-millisecond range across fanout values.

### #7 Cold vs Warm Runtime Profiles
| Nodes | Cold (ms) | Warm (ms) | Steady Avg (ms) | Steady Min (ms) | Steady Max (ms) |
|---:|---:|---:|---:|---:|---:|
| 100 | 0.1846 | 0.0909 | 0.0229 | 0.0091 | 0.4603 |
| 1000 | 0.0078 | 0.0101 | 0.0056 | 0.0050 | 0.0108 |
| 5000 | 0.0116 | 0.0108 | 0.0059 | 0.0046 | 0.0132 |

Interpretation:
- Cold penalty is isolated.
- Warm/steady paths are consistently fast.

### #8 Explain Overhead Budget
| Mode | p50 (ms) | p95 (ms) | p99 (ms) |
|---|---:|---:|---:|
| baseline | 0.0071 | 0.0139 | 0.0238 |
| with_explain | 0.0113 | 0.0173 | 0.0282 |

`p95` overhead: `24.92%`.

Interpretation:
- `explain(path)` adds bounded overhead while preserving traceability.
- Absolute overhead remains sub-millisecond, making it production-safe for real-time auditing.

### #9 Secret-Scope Performance Impact
Repeated isolated runs on `April 9, 2026`:

| Scope | p50 (ms) | p95 (ms) | p99 (ms) |
|---|---:|---:|---:|
| public | 0.0088 - 0.0095 | 0.0162 - 0.0170 | 0.0233 - 0.1565 |
| secret | 0.5785 - 0.6073 | 0.7475 - 0.8788 | 1.0762 - 1.5146 |

Interpretation:
- Secret path remains slower than public by design cost: crypto, stealth boundary logic, and lazy refresh/write-back.
- In absolute terms, secret `p95` is now consistently sub-millisecond in isolated local runs for this scenario.
- Compared with the March 2026 historical baseline in `BASELINE-5-FINAL.md` (`4.6503ms` secret `p95`), the current local envelope is roughly `81% - 84%` lower in absolute `p95`.
- Slowdown percentages still look dramatic because the public path is already extremely close to the timer floor.

### #10 Push vs Pull (Eager vs Lazy)
Selected row from the latest isolated run (`fanout = 5000`):

| Mode | Fanout | k | Mutation p95 (ms) | Read p95 (ms) |
|---|---:|---:|---:|---:|
| eager | 5000 | 2 | 0.0515 | 0.0478 |
| lazy | 5000 | 2 | 0.0038 | 0.0035 |

Interpretation:
- Both modes remain low-latency in steady-state.
- `push` and `first-read-after-write` stay measurable as separate costs, which is the benchmark's main purpose.
- Single-run outliers can appear at lower fanouts, so this benchmark is best read as a shape test rather than a one-number SLA.

### #11 Secret Push vs Pull (Shared v3 Key Cache + Lazy Recompute)
| Plane | Nodes | Mutation p95 (ms) | Read p95 (ms) |
|---|---:|---:|---:|
| public | 100 | 0.0173 | 0.0237 |
| secret | 100 | 0.0472 | 0.7461 |
| public | 300 | 0.0047 | 0.0047 |
| secret | 300 | 0.0408 | 0.3542 |
| public | 600 | 0.0042 | 0.0040 |
| secret | 600 | 0.0403 | 0.6410 |

Slowdown ratios (secret/public p95):

| Nodes | Mutation slowdown x | Read slowdown x |
|---:|---:|---:|
| 100 | 2.73x | 31.48x |
| 300 | 8.68x | 75.36x |
| 600 | 9.60x | 160.25x |

Interpretation:
- Secret mutation cost stays in low-sub-millisecond territory.
- Secret read cost is still the noisiest part of the runtime because this benchmark couples crypto with lazy derivation refresh and write-back.
- In absolute terms, the latest isolated run still kept secret read `p95` below `1ms` at `100` and `600` nodes, and around `0.35ms` at `300` nodes.

## Regression Gate Status
Latest gate output:

- `latency_p95`: ✅ `0.0201ms` (threshold `20ms`)
- `complexity_k`: ✅ `k=2` (threshold `<=4`)
- `stealth_masking`: ✅ `origin=stealth`, `masked=true`, `value=●●●●`

## What Is Proven Now
- Public-path performance is stable and effectively bounded by small `k`.
- Lazy/eager recompute modes are operational and benchmarked.
- Explainability overhead is measurable and bounded.
- Secret-path cost is no longer monolithic; shared v3 key reuse removed the worst cold branch-derivation penalty.
- Secret reads are still the most expensive path, but they now sit in the sub-millisecond envelope for the main `#9` scenario on isolated runs.
- Privacy and semantic invariants remain intact while performance work lands.

## Next Optimization Frontier
- If we chase the final secret-latency gap, the next real frontier is no longer "more cache."
- It is separating lazy derivation refresh from full memory append/hash-chain write-back on internal recomputes.
- That is a semantic refactor, not just a micro-optimization, so it should be driven by product usage traces rather than benchmark vanity alone.
