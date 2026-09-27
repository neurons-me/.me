# Contributing to.me

`ME` recomputes only what depends on a write: cost is linear in `k`, the number of dependents recomputed (~12–14 µs each on an Apple M2, see `docs/Benchmarks/benchmarks.md`). PRs must keep it that way or make each step cheaper.

## Requirements
1. Fork → branch `feat/your-change` or `xai/nrp-integration`
2. Run `node tests/Benchmarks/benchmark.regression-gate.test.ts` before/after; it must pass. Paste its output in the PR description.
3. Regressions in per-dependent cost need a written explanation. (`npm run bench:phase3:cascade` measures the standalone `kernel/cascade.ts` engine, not `ME`; its `0.003ms` p50 target applies only to that engine.)
4. Sign commits with DCO: `git commit -s`
5. Keep core generic. NRP/xAI-specific code goes to `packages/xai/` or separate plugin.

## What goes upstream to core
- Flush/enqueue perf improvements
- Bundle size reductions  
- Bug fixes with bench proof

## What stays in plugins/packages
- Explain trace formats
- NRP-specific sharding logic
- Stealth lanes / proprietary patterns

## Review process
1. Bench must pass
2. Tests must pass
3. One maintainer approval

Let's ship `0.001ms`.
neurons.me