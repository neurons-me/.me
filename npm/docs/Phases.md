# .me Kernel Phases (0-8)
This document defines the behavioral contract validated by `tests/phases.test.js`.

## Phase 0 | Identity + Secret Scope
Purpose: validate identity claim and stealth secret roots.

```js
me["@"]("jabellae");
me.finance["_"]("my-secret-key-2026");
me.finance.fuel_price(24.5);
```

Expected:
- `me("finance")` -> `undefined`
- `me("finance.fuel_price")` -> `24.5`

## Phase 1 | Structural [] Selectors
Purpose: validate indexed write/read semantics.

```js
me.fleet.trucks[1].km(1000);
me.fleet.trucks[2].fuel(350);
```

Expected:
- `me("fleet.trucks[1].km")` -> `1000`
- `me("fleet.trucks[2].fuel")` -> `350`

## Phase 2 | `[i]` Broadcast with `=`
Purpose: one formula applied to all indexed members.

```js
me.fleet["trucks[i]"]["="]("efficiency", "km / fuel");
```

Expected:
- `me("fleet.trucks[1].efficiency")` -> `5`
- `me("fleet.trucks[2].efficiency")` -> `1200 / 350`

## Phase 3 | Logical Filters
Purpose: declarative filtered selection.

```js
me("fleet.trucks[efficiency < 4.5]");
me("fleet.trucks[efficiency < 4.5 || km > 1100]");
```

Expected keys:
- `["2"]`

## Phase 3.1 | Filtered Broadcast
Purpose: mutate only nodes matching filter predicate.

```js
me.fleet["trucks[efficiency < 4.5]"]["="]("alert", "true");
```

Expected:
- `me("fleet.trucks[2].alert")` -> `true`
- non-matching nodes remain `undefined`

## Phase 4 | Range + Multi-Select
Purpose: deterministic slicing of indexed collections.

```js
me("fleet.trucks[1..2].efficiency");
me("fleet.trucks[[1,3]].efficiency");
```

Expected keys:
- range -> `["1", "2"]`
- sparse -> `["1", "3"]`

## Phase 5 | Transform Projection (Read-Only)
Purpose: computed projection without mutation.

```js
me("fleet.trucks[x => x.efficiency * 1.2]");
```

Example output shape:

```json
{
  "1": 6,
  "2": "<number>",
  "3": "<number>"
}
```

## Phase 6 | Contract Integrity
Purpose: deterministic arithmetic across public + secret scopes.

```js
me.fleet["trucks[i]"]["="]("total_cost", "fuel * finance.fuel_price");
```

Expected:
- `me("fleet.trucks[2].total_cost")` -> `350 * 24.5`

## Phase 7A | Temporal Rehydration (Replay Equivalence)
Purpose: behavioral persistence via thought replay.

```js
const thoughts = me.inspect().thoughts;
const me2 = new ME();
me2.replayThoughts(thoughts);
```

Expected:
- `me2("fleet.trucks[2].total_cost") === me("fleet.trucks[2].total_cost")`
- secret root stealth remains preserved

## Phase 7B | Atomic Snapshot Rehydration
Purpose: full-state portability (semantic + cryptographic planes).

```js
const snapshot = me.exportSnapshot();
const me3 = new ME();
me3.rehydrate(snapshot);
```

Expected:
- thoughts/state outputs preserved
- `encryptedBranches`, `localSecrets`, `localNoises` preserved exactly

# Phase 8 | Incremental Recompute + Explain
Phase 8 validates two production-oriented capabilities:
- Observability via `me.explain(path)`.
- Incremental recompute via dependency mapping (`ref -> targets`).

## Contract
1. Derivations created with `=` must register dependencies.
2. On leaf mutation, only subscribed targets are re-evaluated.
3. `explain(path)` must disclose expression inputs with origin flags:
   - `public`
   - `stealth` (masked)

## Example
```js
me.fleet["trucks[i]"]["="]("total_cost", "fuel * finance.fuel_price");
me.finance.fuel_price(30); // should update total_cost subscribers

const trace = me.explain("fleet.trucks[2].total_cost");
```

Expected trace shape:

```json
{
  "path": "fleet.trucks.2.total_cost",
  "value": 29970,
  "derivation": {
    "expression": "fuel * finance.fuel_price",
    "inputs": [
      { "label": "fuel", "path": "fleet.trucks.2.fuel", "value": 999, "origin": "public", "masked": false },
      { "label": "finance.fuel_price", "path": "finance.fuel_price", "value": "●●●●", "origin": "stealth", "masked": true }
    ]
  },
  "meta": {
    "dependsOn": ["fleet.trucks.2.fuel", "finance.fuel_price"]
  }
}
```
