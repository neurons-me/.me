---
layout: readme
title: Rust .me Benchmark Map
image: https://neurons-me.github.io/docs/assets/img/me.png
---

# Rust .me Benchmarks

This directory contains the Rust benchmark ground for the `.me` kernel port.

The benchmarks are executable binaries, not hard regression thresholds. Their
job is to keep the kernel honest while the Rust implementation catches up to
the TypeScript semantic contract: append-only memory, path selectors, reactive
derivations, secret scopes, lazy/eager recomputation, traceability, hydration,
and public/owner projections.

Always run them in release mode:

```bash
cargo run --release --bin <benchmark-name>
```

## Coverage

| TypeScript benchmark area | Rust binary | What it checks |
| --- | --- | --- |
| Algorithmic scaling / O(k) isolation | `bench-ok` | Irrelevant public nodes do not affect the recompute wave for a small dependent set. |
| Sustained mutation | `bench-sustained` | Repeated writes do not cause progressive latency drift. |
| Fan-out sensitivity | `bench-fanout` | A global dependency can drive many subscribers without accidental O(k^2) metadata cloning. |
| Cold vs warm runtime | `bench-cold-warm` | Snapshot hydration cost is paid at startup; warm mutation remains small. |
| Explain overhead | `bench-explain-overhead` | `explain()` remains cheap enough to keep derivations auditable. |
| Secret-scope impact | `bench-secret-scope` | Secret writes/read paths are measured separately from derivation runtime cost. |
| Push vs pull | `bench-push-pull` | Eager mode pays on write; lazy mode defers recompute until first fresh read. |
| Secret push vs pull | `bench-secret-push-pull` | Lazy public and secret branches are compared across multiple node counts. |

## Commands

```bash
cargo run --release --bin bench-ok
cargo run --release --bin bench-sustained
cargo run --release --bin bench-fanout
cargo run --release --bin bench-cold-warm
cargo run --release --bin bench-explain-overhead
cargo run --release --bin bench-secret-scope
cargo run --release --bin bench-push-pull
cargo run --release --bin bench-secret-push-pull
```

## Reading The Results

`k` is the semantic recompute wave size. It should track the number of actual
dependent targets touched by a write or fresh read, not total memory size.

Public hot paths should stay very small. Secret paths are expected to cost more
on write because stored memories are encrypted, but owner reads can remain
cheap while the live owner index is hydrated.

Lazy mode does not mean "free write." It still marks dependent derivations
stale. The win is that it avoids recomputing every subscriber until a fresh read
actually asks for a target.

## Run #001

`this-me` v0.3.0 · Aug 26, 2026 · 4:37 PM CST · Suis-MacBook-Air.local

Release mode command:

```bash
for bin in bench-ok bench-sustained bench-fanout bench-cold-warm \
  bench-explain-overhead bench-secret-scope bench-push-pull \
  bench-secret-push-pull; do
  cargo run --release --bin "$bin"
done
```

### 1. O(k) Recompute Isolation

Irrelevant public nodes do not affect the recompute wave. `k` stayed at `1`
while total memories grew past 10,000.

| N | p50 ms | p95 ms | max ms | k | result | memories |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.018125 | 0.041083 | 0.481208 | 1 | 69 | 453 |
| 100 | 0.006291 | 0.013708 | 0.044542 | 1 | 69 | 543 |
| 1,000 | 0.006625 | 0.015542 | 0.085042 | 1 | 69 | 1,443 |
| 5,000 | 0.006333 | 0.007417 | 0.009542 | 1 | 69 | 5,443 |
| 10,000 | 0.006750 | 0.008750 | 0.022500 | 1 | 69 | 10,443 |

### 2. Sustained Mutation

2,000 consecutive mutations over 4,000 nodes stayed stable. p95 drift was
negative in this run, meaning the late window was faster than the first window.

| p50 ms | p95 ms | p99 ms | max ms | p95 drift |
| ---: | ---: | ---: | ---: | ---: |
| 0.008916 | 0.016541 | 0.029125 | 0.216084 | -51.21% |

### 3. Fan-Out Sensitivity

This benchmark intentionally changes the number of real dependents. The wave
size tracks actual subscribers (`k = fanout`), not unrelated memory.

| fanout | iterations | k | p50 ms | p95 ms | p99 ms | max ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 120 | 10 | 0.120125 | 0.173458 | 0.236042 | 0.252750 |
| 100 | 120 | 100 | 0.611250 | 1.122042 | 1.141500 | 1.581333 |
| 500 | 40 | 500 | 3.794375 | 10.172458 | 10.625166 | 10.625166 |
| 1,000 | 20 | 1,000 | 8.087166 | 9.932875 | 9.932875 | 9.932875 |
| 2,500 | 8 | 2,500 | 21.176292 | 23.303583 | 23.303583 | 23.303583 |
| 5,000 | 4 | 5,000 | 43.027000 | 46.648417 | 46.648417 | 46.648417 |

### 4. Cold vs Warm Runtime

Snapshot hydration scales with memory count and is paid at startup. Warm
mutation remains tiny after hydration.

| nodes | memories | cold p50 ms | cold p95 ms | first write ms | steady avg ms | steady p95 ms | k |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 102 | 0.150167 | 1.033875 | 0.015209 | 0.006186 | 0.007167 | 1 |
| 1,000 | 1,002 | 1.407541 | 2.465042 | 0.014458 | 0.007588 | 0.009958 | 1 |
| 5,000 | 5,002 | 7.417334 | 9.732250 | 0.019041 | 0.007818 | 0.008833 | 1 |
| 10,000 | 10,002 | 15.973750 | 17.813458 | 0.023708 | 0.006002 | 0.007000 | 1 |

### 5. Explain Overhead

`explain()` is cheap enough to keep derivations inspectable. The measured
baseline was noisier than the explain run here, so the meaningful number is
`explain_only`: p95 around 0.52ms for a 3,000-node derivation wave.

| mode | p50 ms | p95 ms | p99 ms | k |
| --- | ---: | ---: | ---: | ---: |
| baseline | 25.989209 | 41.766708 | 66.253958 | 3,000 |
| with_explain | 25.760792 | 30.925000 | 33.516042 | 3,000 |
| explain_only | 0.205417 | 0.516666 | 0.931125 | 3,000 |

### 6. Secret Scope Impact

Secret direct write/read is slower than public write/read, as expected, but it
is still sub-0.04ms at p95 in this run. Lazy derivation cost was close to public.

| case | scope | p50 ms | p95 ms | p99 ms | k |
| --- | --- | ---: | ---: | ---: | ---: |
| write_read | public | 0.003375 | 0.005916 | 0.025709 | 0 |
| write_read | secret | 0.016083 | 0.032417 | 0.072417 | 0 |
| derivation_lazy | public | 0.563416 | 1.547292 | 2.542917 | 1 |
| derivation_lazy | secret | 0.719416 | 1.695084 | 2.521125 | 1 |

Write/read p95 slowdown: `447.95%`. Lazy derivation p95 slowdown: `9.55%`.

### 7. Push vs Pull

Eager mode pays on mutation. Lazy mode keeps mutation small and defers
subscriber recompute until read.

| mode | fanout | k | mutation p95 ms | read p95 ms |
| --- | ---: | ---: | ---: | ---: |
| eager | 10 | 10 | 0.148416 | 0.003583 |
| eager | 100 | 100 | 2.197833 | 0.006375 |
| eager | 500 | 500 | 6.329666 | 0.013250 |
| eager | 1,000 | 1,000 | 10.653666 | 0.009792 |
| eager | 2,500 | 2,500 | 48.590083 | 0.024125 |
| eager | 5,000 | 5,000 | 58.827542 | 0.022583 |
| lazy | 10 | 1 | 0.006916 | 0.007291 |
| lazy | 100 | 1 | 0.138750 | 0.019417 |
| lazy | 500 | 1 | 2.354125 | 0.069667 |
| lazy | 1,000 | 1 | 2.997041 | 0.060417 |
| lazy | 2,500 | 1 | 5.094000 | 0.088875 |
| lazy | 5,000 | 1 | 8.070334 | 0.098209 |

### 8. Secret Push vs Pull

Lazy public and secret branches remain in the same broad performance envelope
for the measured node counts.

| nodes | public mutation p95 ms | secret mutation p95 ms | public read p95 ms | secret read p95 ms | mutation slowdown | read slowdown |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.170583 | 0.235708 | 0.024750 | 0.027375 | 1.38x | 1.11x |
| 300 | 0.539333 | 0.793042 | 0.033916 | 0.049250 | 1.47x | 1.45x |
| 600 | 2.443334 | 1.601083 | 0.060834 | 0.046958 | 0.66x | 0.77x |

## Current State

Run #001 confirms the Rust port is past boilerplate: it has measurable,
release-mode behavior across public writes, selectors, derivations, hydration,
secret scopes, lazy/eager recompute, and explainability.

The strongest current signal is not "Rust is faster everywhere." The honest
signal is better: Rust already preserves `.me`'s semantic shape while giving
the kernel an embeddable, memory-safe host suitable for monads, local daemons,
robots, Raspberry Pi-class machines, and edge runtime work.

The Rust implementation is allowed to improve internal mechanics, but it should
not change `.me` meaning to chase a number.
