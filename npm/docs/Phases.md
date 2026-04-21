# .me Kernel Phases (0–8)

This document defines the **behavioral contract** of the `.me` kernel, validated by `tests/phases.test.js`.

> Note:
> This page documents the semantic/runtime phases `0–8`.
> The separate performance delivery phases (storage, bounded residency, exact search, IVF) are summarized in [Kernel Benchmarks](/kernel/Benchmarks).

Each phase represents a foundational capability that builds upon the previous ones, culminating in a fully expressive, secure, and observable personal semantic engine.

## Phase 0 | Identity + Secret Scope

**Core Idea:** Establish identity and introduce structural privacy through stealth roots.

```js
me["@"]("jabellae");
me.finance["_"]("my-secret-key-2026");
me.finance.fuel_price(24.5);
```

Expected:

- `me("finance")` -> `undefined`
- `me("finance.fuel_price")` -> `24.5`

This phase proves that secrecy is **structural**, not global.

## Phase 1 | Structural Selectors ([])

**Core Idea:** The kernel treats numeric and string keys as first-class structural elements.

```ts
me.fleet.trucks[1].km(1000);
me.fleet.trucks[1].fuel(200);
me.fleet.trucks[2].fuel(350);
me.fleet.trucks[2].km(1200);
me.fleet.trucks[3].km(800);
me.fleet.trucks[3].fuel(150);
```

**Expected:**

- me("fleet.trucks[1].km") → 1000
- me("fleet.trucks[2].fuel") → 350

This establishes that .me is a true **semantic tree**, not just a plain object.

## Phase 2 | Broadcast Iterator [i] + Derivation =

**Core Idea:** One rule can be applied across an entire collection declaratively.

```ts
me.fleet["trucks[i]"]["="]("efficiency", "km / fuel");
```

**Expected:**

- me("fleet.trucks[1].efficiency") → 5
- me("fleet.trucks[2].efficiency") → `1200 / 350`
- me("fleet.trucks[3].efficiency") → `800 / 150`

This is the birth of **mass reactive logic** without loops or manual subscriptions.

## Phase 3 | Logical Filters & Filtered Broadcast

**Core Idea:** You can query and mutate subsets of the tree using declarative predicates.

```ts
me("fleet.trucks[efficiency < 4.5]");
me("fleet.trucks[efficiency < 4.5 || km > 1100]");
me.fleet["trucks[efficiency < 4.5]"]["="]("alert", "true");
```

**Expected:**

- `me("fleet.trucks[efficiency < 4.5]")` returns only truck `2`
- `me("fleet.trucks[efficiency < 4.5 || km > 1100]")` still returns only truck `2`
- `me("fleet.trucks[2].alert")` → `true`
- non-matching trucks keep `alert` as `undefined`

This phase introduces **declarative selection and conditional mutation**.

## Phase 4 | Range & Multi-Select

**Core Idea:** Precise, deterministic slicing of indexed data.

```ts
me("fleet.trucks[1..3].efficiency");
me("fleet.trucks[[1,3]].efficiency");
```

Supports both contiguous ranges and sparse selections.

## Phase 5 | Transform Projections (Read-only)

**Core Idea:** Compute derived views without mutating the underlying tree.

```ts
me("fleet.trucks[x => x.efficiency * 1.2]");
```

Returns a projected shape while leaving original data untouched.

## Phase 6 | Cross-Scope Contract Integrity

**Core Idea:** Public and secret data can participate in the same derivations securely.

```ts
me.fleet["trucks[i]"]["="]("total_cost", "fuel * finance.fuel_price");
```

**Expected:**

- `me("fleet.trucks[2].total_cost")` → `350 * 24.5`

The kernel correctly resolves mixed public/secret dependencies while preserving stealth.

## Phase 7A | Temporal Rehydration (Memory Replay)

**Core Idea:** The entire history is portable and deterministic.

```ts
import ME from "this.me";

const memories = me.inspect().memories;
const me2 = new ME();
me2.replayMemories(memories);
```

me2 must behave **identically** to the original, including secret stealth.

## Phase 7B | Atomic Snapshot Rehydration

**Core Idea:** Full state portability including cryptographic planes.

```ts
import ME from "this.me";

const snapshot = me.exportSnapshot();
const me3 = new ME();
me3.hydrate(snapshot);
```

Preserves public state, encrypted branches, secrets, and noises exactly.

## Phase 8 | Incremental Intelligence + Observability

**Core Idea:** The kernel must be efficient and fully explainable.

- Derivations register precise dependencies (ref → targets).
- Only affected nodes recompute on change (inverted dependency index).
- `me.explain(path)` provides complete traceability, including masked secret origins.
- Invalid executable tokens remain declarative strings instead of arbitrary code execution.

**Example:**

```ts
me.fleet["trucks[i]"]["="]("total_cost", "fuel * finance.fuel_price");
me.finance.fuel_price(30);

const trace = me.explain("fleet.trucks[2].total_cost");
```

The trace must show inputs, origins (`public` / `stealth`), masking, and dependency graph.

**This progression is the real contract of .me:**

From simple identity and privacy → to structural collections → to declarative logic at scale → to secure cross-scope computation → to full temporal and cryptographic portability → finally reaching **observable, incremental intelligence**.
