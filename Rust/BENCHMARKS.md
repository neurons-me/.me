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

## Current State

The Rust benchmarks are now broad enough to compare the kernel shape against
the TypeScript benchmark suite at the level that matters for the port:
semantic behavior first, performance behavior second.

The Rust implementation is allowed to improve internal mechanics, but it should
not change `.me` meaning to chase a number.
