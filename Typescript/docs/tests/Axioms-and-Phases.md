# Axioms & Phases

These are the semantic correctness tests of `.me`.

## Axioms (`tests/axioms.test.ts`)

Axioms validate non-negotiable behavior:

- Callable + navigable proxy surface
- Secret stealth roots (`_`) and noise reset (`~`)
- Identity normalization (`@`)
- Pointer semantics (`__` / `->`)
- Query/memory events (`?`)
- Remove tombstones (`-`)
- Hash-chain tamper evidence
- Deterministic LWW conflict resolution

Run:

```bash
node tests/axioms.test.ts
```

Failure impact:

- If this fails, semantic integrity is considered broken.

## Phases Fire Test (`tests/phases.test.js`)

Phases validate feature progress from phase 0 to phase 8 in one runtime flow:

- selectors, broadcast, filters, ranges, transforms
- replay + snapshot rehydration
- incremental recompute + explain masking

Run:

```bash
node tests/phases.test.js
```

## Why Both?

- Axioms = invariants and safety properties.
- Phases = integration progression and user-visible capability continuity.
