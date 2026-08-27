# Rust vs TypeScript Mirror Benchmarks

Run #002 · Aug 26, 2026 · Suis-MacBook-Air.local

This file compares the Rust `.me` kernel against the TypeScript `.me` kernel
with a mirror suite: same machine, same operation shapes, same measured
percentiles, and JSON output from both implementations.

Run #002 includes the Rust lazy-invalidation optimization: lazy writes now bump
source path versions and defer dependency freshness checks to `read_fresh()`
instead of walking every subscriber at mutation time.

Raw results:

- [`bench-results/rust-mirror-run-002.json`](bench-results/rust-mirror-run-002.json)
- [`bench-results/rust-mirror-run-001.json`](bench-results/rust-mirror-run-001.json)
- [`bench-results/typescript-mirror-run-001.json`](bench-results/typescript-mirror-run-001.json)

Versions:

| implementation | version |
| --- | --- |
| Rust | `this-me` `0.3.0` |
| TypeScript | `this.me` `4.0.1` |

Commands:

```bash
cd Rust
cargo run --release --bin bench-mirror > bench-results/rust-mirror-run-002.json

cd ../Typescript
node tests/Benchmarks/benchmark.mirror.ts > ../Rust/bench-results/typescript-mirror-run-001.json
```

## What The Mirror Suite Measures

- **O(k) isolation**: many irrelevant nodes, one small dependent line.
- **Sustained mutation**: 2,000 mutations over a 4,000-node memory space.
- **Push vs pull**: eager and lazy recompute across real fanout.
- **Secret scope**: public vs secret direct write/read, plus lazy derivation.

This intentionally excludes vector search and IVF sidecars. Those are currently
TypeScript-only layers, not Rust kernel parity surfaces.

## 1. O(k) Isolation

Lower is better. `rust/ts` below `1.00x` means Rust was faster.

| nodes | Rust p95 ms | TypeScript p95 ms | rust/ts | Rust k | TS k |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.0458 | 0.0334 | 1.37x | 1 | 1 |
| 100 | 0.0079 | 0.0217 | 0.36x | 1 | 1 |
| 1,000 | 0.0217 | 0.0183 | 1.18x | 1 | 1 |
| 5,000 | 0.0142 | 0.0201 | 0.71x | 1 | 1 |
| 10,000 | 0.0095 | 0.0248 | 0.39x | 1 | 1 |

Both kernels preserve the `.me` shape: irrelevant memory does not inflate the
recompute wave. The absolute envelope remains tiny for both implementations.

## 2. Sustained Mutation

| metric | Rust | TypeScript | rust/ts |
| --- | ---: | ---: | ---: |
| p95 ms | 0.0165 | 0.0286 | 0.57x |
| p95 drift | 6.85% | -73.51% | n/a |

Both stay in a very small absolute envelope. Rust had the lower p95. TypeScript
had negative drift in this run, meaning its late window was faster than its first
window.

## 3. Push vs Pull

Eager mode pays when the source changes. Lazy mode should make mutation cheap
and move recompute toward first read.

### Eager Mutation P95

| fanout | Rust p95 ms | TypeScript p95 ms | rust/ts | Rust k | TS k |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.0827 | 0.1187 | 0.70x | 10 | 10 |
| 100 | 0.8529 | 1.2004 | 0.71x | 100 | 100 |
| 500 | 7.7877 | 8.1948 | 0.95x | 500 | 500 |
| 1,000 | 10.0756 | 13.8945 | 0.73x | 1,000 | 1,000 |
| 2,500 | 28.4035 | 40.5338 | 0.70x | 2,500 | 2,500 |
| 5,000 | 55.3975 | 99.7792 | 0.56x | 5,000 | 5,000 |

Rust is ahead when both kernels do real eager fanout work.

### Lazy Mutation P95

Run #001 exposed the original Rust gap: lazy mutation still walked the subscriber
set and scaled with fanout. Run #002 fixes that by using source path versions and
stale-on-read checks.

| fanout | Rust #001 p95 ms | Rust #002 p95 ms | TypeScript p95 ms | Rust #002 / TS | Rust k | TS k |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.0086 | 0.0016 | 0.0043 | 0.38x | 1 | 1 |
| 100 | 0.0719 | 0.0017 | 0.0065 | 0.26x | 1 | 1 |
| 500 | 0.4526 | 0.0021 | 0.0056 | 0.38x | 1 | 1 |
| 1,000 | 1.0103 | 0.0021 | 0.0040 | 0.52x | 1 | 1 |
| 2,500 | 2.7658 | 0.0026 | 0.0045 | 0.58x | 1 | 1 |
| 5,000 | 5.9301 | 0.0025 | 0.0053 | 0.47x | 1 | 1 |

This is the important change in Run #002. Rust lazy mutation no longer scales
with fanout in this mirror workload. The recompute wave remains `k = 1`, and the
mutation path is now below the TypeScript p95 in every measured fanout.

### Lazy First Read P95

| fanout | Rust p95 ms | TypeScript p95 ms | rust/ts |
| ---: | ---: | ---: | ---: |
| 10 | 0.0082 | 0.0174 | 0.47x |
| 100 | 0.0091 | 0.0238 | 0.38x |
| 500 | 0.0128 | 0.0196 | 0.65x |
| 1,000 | 0.0108 | 0.0177 | 0.61x |
| 2,500 | 0.0148 | 0.0213 | 0.69x |
| 5,000 | 0.0169 | 0.0225 | 0.75x |

The cost moved where lazy semantics say it should move: toward `read_fresh()`.
Even there, Rust stayed below TypeScript p95 in this run.

## 4. Secret Scope

| case | scope | Rust p95 ms | TypeScript p95 ms | rust/ts | Rust k | TS k |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| write_read | public | 0.0021 | 0.0050 | 0.43x | 0 | 0 |
| write_read | secret | 0.0157 | 0.0501 | 0.31x | 0 | 0 |
| derivation_lazy | public | 0.0151 | 0.0250 | 0.60x | 1 | 1 |
| derivation_lazy | secret | 0.0286 | 0.5689 | 0.05x | 1 | 1 |

Rust is faster across all measured secret-scope rows in Run #002. Direct secret
write/read remains slower than public, as expected, but the Rust overhead stays
inside a small absolute envelope.

## Interpretation

Rust `.me` is now more than a faithful port. It preserves the TypeScript kernel
contracts while taking advantage of Rust's tight execution model in the hot
paths:

- O(k) isolation stays bounded.
- Sustained mutation p95 is lower.
- Eager fanout recompute is lower.
- Lazy mutation no longer walks fanout at write time.
- Direct secret write/read is lower.

The main architectural lesson from Run #002:

> lazy freshness belongs to the relation between a derivation and the versions of
> the paths it depends on, not to a global subscriber walk during mutation.

That is closer to the `.me` model: a write states a fact; a fresh read resolves
whether a relation needs to be recomputed.

## Status

Run #001 found the real Rust gap. Run #002 closes it for this mirror workload.
The benchmark suite is now useful both as evidence and as a regression guard:

- if lazy mutation starts scaling with fanout again, the mirror output will show
  it immediately;
- if Rust drifts away from TypeScript semantics, the kernel contracts catch it;
- if TypeScript changes behavior, the mirror suite gives both kernels a shared
  comparison language.
