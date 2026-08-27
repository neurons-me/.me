# Rust .me Changelog

## 0.3.2 - 2026-08-26

Documentation release for the Rust crate.

- Expanded the docs.rs front page with API-oriented examples.
- Added explicit guidance for `Kernel`, `KernelRuntime`, storage, operators,
  lazy derivations, secret scopes, wrapped audiences, identity proofs, and host
  JSON integration.
- Added this changelog and linked it from the Rust manual docs.

No kernel semantics changed in this release.

## 0.3.1 - 2026-08-26

Lazy derivation invalidation optimization.

- Replaced lazy-mode subscriber walks at mutation time with source path versions
  and stale-on-read checks.
- Preserved the existing lazy contract: writes emit the source event, and
  recomputes happen when `read_fresh()` runs.
- Added Run #002 of the Rust-vs-TypeScript mirror benchmark.

Mirror benchmark highlight:

```txt
fanout 5000 lazy mutation p95
Rust 0.3.0 / Run #001: 5.9301 ms
TypeScript 4.0.1:       0.0053 ms
Rust 0.3.1 / Run #002: 0.0025 ms
```

## 0.3.0 - 2026-08-26

First modern Rust kernel release on crates.io.

- Hash-chained semantic memory.
- Path parser with `.me` selectors.
- Core operators: `@`, `_`, `~`, `__`, `=`, `?`, `-`.
- Operator registry and semantic replay.
- Eager/lazy derivation modes.
- `inspect()` and `explain()`.
- Secret/noise scopes and v3 blob material.
- WrappedSecretV1 key wrapping.
- Ed25519 proof helpers.
- `me://` execute dispatch.
- JSON snapshot storage.
- `KernelRuntime` host wrapper.
- Runtime events and receipts.
- CLI and executable examples.
- Contract tests against TypeScript fixtures.
