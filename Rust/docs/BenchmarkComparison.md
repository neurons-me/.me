---
layout: readme
title: Rust vs TypeScript Benchmarks
image: https://neurons-me.github.io/docs/assets/img/me.png
---

# Rust vs TypeScript Benchmarks

The full mirror-run writeup lives in
[`../BENCHMARK_COMPARISON.md`](../BENCHMARK_COMPARISON.html).

Run #001 compares:

- Rust `this-me` `0.3.0`
- TypeScript `this.me` `4.0.1`

Same machine, same operation shapes, same JSON output format.

The short version:

- Rust wins O(k) isolation, sustained mutation, eager fanout, and direct secret
  write/read.
- TypeScript wins lazy mutation invalidation at high fanout.
- The next Rust optimization target is lazy invalidation mechanics, not the
  algebra itself.

Raw JSON:

- [`../bench-results/rust-mirror-run-001.json`](../bench-results/rust-mirror-run-001.json)
- [`../bench-results/typescript-mirror-run-001.json`](../bench-results/typescript-mirror-run-001.json)
