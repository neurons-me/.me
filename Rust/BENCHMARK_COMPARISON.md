# Rust vs TypeScript Mirror Benchmarks

Run #001 · Aug 26, 2026 · Suis-MacBook-Air.local

This file compares the Rust `.me` kernel against the TypeScript `.me` kernel
with a mirror suite: same machine, same operation shapes, same measured
percentiles, and JSON output from both implementations.

Raw results:

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
cargo run --release --bin bench-mirror > bench-results/rust-mirror-run-001.json

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
| 10 | 0.0225 | 0.0334 | 0.68x | 1 | 1 |
| 100 | 0.0172 | 0.0217 | 0.79x | 1 | 1 |
| 1,000 | 0.0150 | 0.0183 | 0.82x | 1 | 1 |
| 5,000 | 0.0096 | 0.0201 | 0.48x | 1 | 1 |
| 10,000 | 0.0080 | 0.0248 | 0.32x | 1 | 1 |

Both kernels preserve the `.me` shape: irrelevant memory does not inflate the
recompute wave. Rust is faster across every measured size in this run.

## 2. Sustained Mutation

| metric | Rust | TypeScript | rust/ts |
| --- | ---: | ---: | ---: |
| p95 ms | 0.0101 | 0.0286 | 0.35x |
| p95 drift | 10.97% | -73.51% | n/a |

Both stay in a very small absolute envelope. Rust had the lower p95. TypeScript
had negative drift in this run, meaning its late window was faster than its first
window.

## 3. Push vs Pull

Eager mode pays when the source changes. Lazy mode should make mutation cheap
and move recompute toward first read.

### Eager Mutation P95

| fanout | Rust p95 ms | TypeScript p95 ms | rust/ts | Rust k | TS k |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.0622 | 0.1187 | 0.52x | 10 | 10 |
| 100 | 0.6623 | 1.2004 | 0.55x | 100 | 100 |
| 500 | 3.5158 | 8.1948 | 0.43x | 500 | 500 |
| 1,000 | 7.4740 | 13.8945 | 0.54x | 1,000 | 1,000 |
| 2,500 | 19.4381 | 40.5338 | 0.48x | 2,500 | 2,500 |
| 5,000 | 42.3283 | 99.7792 | 0.42x | 5,000 | 5,000 |

Rust is clearly ahead when both kernels do real eager fanout work.

### Lazy Mutation P95

| fanout | Rust p95 ms | TypeScript p95 ms | rust/ts | Rust k | TS k |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.0086 | 0.0043 | 2.00x | 1 | 1 |
| 100 | 0.0719 | 0.0065 | 10.99x | 1 | 1 |
| 500 | 0.4526 | 0.0056 | 81.05x | 1 | 1 |
| 1,000 | 1.0103 | 0.0040 | 249.96x | 1 | 1 |
| 2,500 | 2.7658 | 0.0045 | 609.06x | 1 | 1 |
| 5,000 | 5.9301 | 0.0053 | 1111.76x | 1 | 1 |

This is the most important finding in the run. TypeScript's lazy invalidation is
effectively constant-time here. Rust's lazy mutation still scales with fanout,
even though the eventual recompute wave reports `k = 1`.

That does not mean the Rust semantics are wrong. It means Rust's lazy
invalidation mechanics are not yet as good as TypeScript's.

Next optimization target:

> Rust lazy writes should avoid walking the subscriber set on mutation. Prefer
> source versioning / stale-on-read checks so mutation cost remains close to
> constant and recompute work moves to `read_fresh()`.

### Lazy First Read P95

| fanout | Rust p95 ms | TypeScript p95 ms | rust/ts |
| ---: | ---: | ---: | ---: |
| 10 | 0.0083 | 0.0174 | 0.48x |
| 100 | 0.0084 | 0.0238 | 0.35x |
| 500 | 0.0116 | 0.0196 | 0.59x |
| 1,000 | 0.0132 | 0.0177 | 0.75x |
| 2,500 | 0.0173 | 0.0213 | 0.81x |
| 5,000 | 0.0377 | 0.0225 | 1.68x |

Rust is competitive on first read and faster at smaller fanouts, but TypeScript
wins at the largest fanout in this run.

## 4. Secret Scope

| case | scope | Rust p95 ms | TypeScript p95 ms | rust/ts | Rust k | TS k |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| write_read | public | 0.0027 | 0.0050 | 0.55x | 0 | 0 |
| write_read | secret | 0.0169 | 0.0501 | 0.34x | 0 | 0 |
| derivation_lazy | public | 0.5640 | 0.0250 | 22.60x | 1 | 1 |
| derivation_lazy | secret | 0.7094 | 0.5689 | 1.25x | 1 | 1 |

Rust is much faster on direct public and secret write/read. TypeScript is much
faster on public lazy derivation in this exact workload, again pointing to lazy
invalidation/read mechanics rather than crypto itself.

Secret lazy derivation is close enough to call competitive, with TypeScript
slightly ahead in this run.

## Interpretation

Rust `.me` is already better than "a port that compiles." It wins important
kernel-hot-path cases:

- O(k) isolation,
- sustained mutation p95,
- eager fanout recompute,
- direct secret write/read.

TypeScript still has one very real advantage:

- lazy mutation invalidation is dramatically cheaper at high fanout.

That gives the Rust roadmap a concrete next step. The target is not vague
"make Rust faster." The target is:

> bring Rust lazy invalidation mechanics to TypeScript parity while preserving
> the Rust kernel's memory-safe, embeddable shape.

## Status

This is a first mirror run, not a final benchmark verdict. It is good enough to
identify the next optimization frontier and to say, honestly:

- Rust is already strong on direct kernel mechanics.
- TypeScript remains the reference for lazy invalidation behavior.
- The two kernels are now close enough that comparing them is useful engineering,
  not theater.
