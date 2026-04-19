# Test Suite Overview

This page maps the full `tests/` directory: what exists, what each test validates, and how to run everything.

## Test Categories

| Category | Location | Purpose |
|---|---|---|
| Pre-build gate | `tests/pre-build.test.mjs` | Orchestrates release-critical checks before publish. |
| Axioms | `tests/axioms.test.ts` | Verifies invariants (stealth roots, hash-chain, LWW, pointers, operators). |
| Phases | `tests/phases.test.js` | End-to-end fire tests for feature phases 0-8. |
| Build compatibility | `tests/Builds/*` | Ensures CJS/ESM/UMD outputs behave correctly. |
| DSL contracts | `tests/contracts/dsl.contract.test.mjs` | Contract suite for selector/filter/broadcast/query behavior. |
| Benchmarks | `tests/Benchmarks/*` | Performance and complexity characterization. |
| Demos | `tests/Demos/*`, `tests/sand.ts` | Practical usage walkthroughs and exploratory scripts. |

## Run Commands

| Command | What It Runs |
|---|---|
| `npm run test:prebuild` | Build + Axioms + Phases + CJS/ESM/TS/UMD checks |
| `npm run test:contracts` | DSL contract suite |
| `npm run test:ts` | Type-check (`tsc --noEmit`) |
| `npm run test:umd` | UMD runtime compatibility test |
| `npm run test:phase3:exact` | Exact vector-search correctness baseline |
| `npm run test:phase3:ivf` | IVF sidecar smoke test |
| `npm run bench:vector:corpus` | Columnar secret vector corpus write/read validation |
| `npm run bench:phase3:exact-scale` | Exact vector-search scaling benchmark |
| `npm run bench:phase3:ivf-vs-exact` | Exact vs IVF comparison on the same corpus |
| `npm run bench:phase3:ivf-tuning` | IVF tuning sweep (`nlist`, `nprobe`, candidate caps, dataset mode) |

You can also run files directly:

```bash
node tests/axioms.test.ts
node tests/phases.test.js
node tests/contracts/dsl.contract.test.mjs
node tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts
```

## Suggested CI Order

1. `npm run test:prebuild`
2. `npm run test:contracts`
3. Optional nightly: selected benchmarks + regression gate
4. Performance work: `test:phase3:*` and `bench:phase3:*` when changing vector search or secret chunk storage

## Current Performance Story

- Phase 1 proved batch-write viability and removed heavy journal retention from `_memories`.
- Phase 2 closed bounded residency for the secret vector corpus by switching to chunked columnar envelopes with typed payloads.
- Phase 3 closed realistic ANN search at `100k` on a chunk-coherent corpus with `IVF p95 = 3318.42ms`, `recall@10 = 1.000`, and `18.40` chunks/query.
- The hostile `legacy_fragmented` corpus remains in the suite as a documented worst-case profile rather than a hidden failure mode.

## Navigation

- [Axioms & Phases](/tests/Axioms-and-Phases)
- [Build Compatibility Tests](/tests/Build-Compatibility)
- [Examples & Contracts](/tests/Examples-and-Contracts)
- [Performance & Benchmarks](/tests/Performance)
