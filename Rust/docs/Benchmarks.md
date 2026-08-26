---
layout: readme
title: Rust .me Benchmarks
image: https://neurons-me.github.io/docs/assets/img/me.png
---

# Benchmarks

The Rust benchmarks live as executable binaries under `src/bin/`.

The benchmark map is maintained in [`../BENCHMARKS.md`](../BENCHMARKS.html).

Run benchmarks in release mode:

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

Coverage:

- O(k) recompute isolation,
- sustained mutation,
- fan-out sensitivity,
- cold vs warm hydration,
- `explain()` overhead,
- secret scope cost,
- eager vs lazy recompute,
- secret push vs pull.

Benchmarks are not hard regression thresholds yet. They are measurement tools
for keeping the Rust port honest while it catches up to the TypeScript kernel.

The rule: improve mechanics, but do not change `.me` meaning to chase a number.
