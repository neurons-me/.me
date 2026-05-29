# Examples & Contracts

This section covers practical usage scripts and formal DSL contracts.

## DSL Contracts (`tests/contracts/dsl.contract.test.mjs`)

Contract tests ensure DSL behavior remains stable:

- path write/read boot behavior
- fixed selectors (`[1]`)
- broadcast (`[i]`) with derivations
- logical filters
- range and multi-select
- transform projections

Run:

```bash
npm run test:contracts
```

## Demo Scripts

| File | Purpose |
|---|---|
| `tests/Demos/Affinity_Model.ts` | Affinity scoring, selectors, explainability, and private policy lane |
| `tests/Demos/Social_Graph.ts` | Pointer-based social graph walkthrough |
| `tests/Demos/ShopsExample.ts` | Collection + selectors + derivation example |
| `tests/sand.ts` | Sandbox/experimental script space |

Run all demos:

```bash
npm run test:demos
```

Run directly:

```bash
node tests/Demos/Affinity_Model.ts
node tests/Demos/Social_Graph.ts
node tests/Demos/ShopsExample.ts
node tests/sand.ts
```

## When to Use Demos vs Contracts

- Use demos to communicate capability and onboarding.
- Use contracts to lock behavior and catch regressions.
