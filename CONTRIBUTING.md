# Contributing to.me

We ship `0.003ms` p50. PRs must keep it fast or make it faster.

## Requirements
1. Fork → branch `feat/your-change` or `xai/nrp-integration`
2. Run `npm run bench:phase3:cascade` before/after. Paste trace in PR description.
3. Performance target: p50 ≤ `0.005ms`. Regressions need written explanation.
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