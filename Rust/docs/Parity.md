---
layout: readme
title: Rust .me Parity With TypeScript
image: https://neurons-me.github.io/docs/assets/img/me.png
---

# Parity With TypeScript

Rust `.me` is a port of the TypeScript kernel, not a new semantic system.

The Rust implementation is allowed to improve internal mechanics: stricter
types, memory safety, smaller runtime shape, cheaper embedding, and cleaner host
contracts.

It is not allowed to change `.me` meaning.

## Current Parity Surface

The Rust port currently covers:

- hash-chained memory,
- path grammar and selectors,
- public and owner projections,
- identity, secret, noise, pointer, derivation, query, remove,
- operator registry,
- semantic replay,
- eager/lazy recompute modes,
- `inspect()` and `explain()`,
- secret material v3 fixture parity,
- WrappedSecretV1,
- Ed25519 proofs,
- `me://` execution,
- JSON snapshots,
- runtime events,
- runtime receipts.

## Contract Files

- `tests/axioms_contract.rs`
- `tests/kernel_contract.rs`
- `tests/path_contract.rs`
- `tests/execute_contract.rs`
- `tests/event_contract.rs`
- `tests/runtime_contract.rs`
- `tests/storage_contract.rs`
- `tests/proof_contract.rs`
- `tests/keyspace_contract.rs`
- `tests/wrapped_secret_contract.rs`
- `tests/typescript_fixture_contract.rs`

## Known Boundary

Rust is not yet a drop-in replacement for the TypeScript kernel inside
`monad.ai`.

That requires an integration layer and host decision, not more kernel semantics.
