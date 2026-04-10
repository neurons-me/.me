# Kernel Intelligence
###### Reactive Inference in `.me`

While the **Axioms** define identity, secrecy, and integrity, **Kernel Intelligence** explains how `.me` recomputes, evaluates, and exposes meaning predictably.

Today that intelligence is implemented across runtime modules such as:

- `src/derivation.ts`
- `src/evaluator.ts`
- `src/core-read.ts`
- `src/core-write.ts`
- `src/core-snapshot.ts`

## What "Intelligence" Means Here
In `.me`, intelligence is not AI magic. It is:

- **Dependency-aware recompute**
- **Hermetic formula evaluation**
- **Inspectable derivations**

You write:

```ts
me.fleet["trucks[i]"]["="]("cost", "fuel * finance.fuel_price");
```

The kernel extracts references, stores the derivation graph, and recomputes only the affected targets when source paths change.

## Incremental Recompute
Instead of rescanning the whole tree on every change, `.me` keeps explicit derivation and subscriber maps.

### Kernel evidence

Representative runtime state in `src/types.ts`:

```ts
derivations: Record<string, MEDerivationRecord>;
refSubscribers: Record<string, string[]>;
refVersions: Record<string, number>;
derivationRefVersions: Record<string, Record<string, number>>;
staleDerivations: Set<string>;
```

Representative runtime flow in `src/derivation.ts`:

```ts
registerDerivation(...)
invalidateFromPath(...)
ensureTargetFresh(...)
recomputeTarget(...)
```

### Runtime shape

```txt
mutation -> invalidateFromPath(source)
         -> refSubscribers[source]
         -> recomputeTarget(target)
         -> queue next affected targets
```

In lazy mode, `.me` postpones the recompute until the target is read, then uses `ensureTargetFresh(...)` before resolving the path.

### Minimal proof

```ts
import ME from "this.me";

const me = new ME();

me.finance.fuel_price(24.5);
me.fleet.trucks[1].fuel(200);
me.fleet.trucks[2].fuel(350);
me.fleet["trucks[i]"]["="]("cost", "fuel * finance.fuel_price");

me.finance.fuel_price(25);

console.log(me("fleet.trucks[1].cost")); // 5000
console.log(me("fleet.trucks[2].cost")); // 8750
```

## Hermetic Evaluator
The formula engine is intentionally constrained. It tokenizes and evaluates expressions with a controlled grammar. There is no `eval` and no `new Function`.

### Kernel evidence

Representative runtime controls in `src/evaluator.ts` and `src/types.ts`:

```ts
unsafeEval: boolean;
tokenizeEvalExpression(...)
tryEvaluateAssignExpression(...)
```

```ts
if (!/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(raw)) return { ok: false };
if (self.unsafeEval) return { ok: false };
```

### Supported operators

```txt
+  -  *  /  %
>  >=  <  <=  ==  !=
&&  ||  !
```

### Security behavior

```ts
import ME from "this.me";

const me = new ME();

me.profile.age(30);
me.profile["="]("adult", "age > 18");
console.log(me("profile.adult")); // true

me.profile["="]("bad", "1 + console.log(1)");
console.log(me("profile.bad")); // expression fallback, not arbitrary JS execution
```

## Explainable Derivations
Every derived value can expose its provenance through `me.explain(path)`.

### Kernel evidence

`src/derivation.ts` builds explain traces from the registered derivation and masks secret-origin inputs:

```ts
explain(self, path)
```

For secret-origin inputs, explain keeps the dependency and origin but masks the value as `●●●●`.

### Example

```ts
import ME from "this.me";

const me = new ME();

me.finance["_"]("k-2026");
me.finance.fuel_price(24.5);
me.fleet.trucks[2].fuel(350);
me.fleet.trucks[2]["="]("cost", "fuel * finance.fuel_price");

console.log(me.explain("fleet.trucks.2.cost"));
```

Expected trace shape:

```json
{
  "path": "fleet.trucks.2.cost",
  "value": 8575,
  "derivation": {
    "expression": "fuel * finance.fuel_price",
    "inputs": [
      { "label": "fuel", "origin": "public", "masked": false },
      { "label": "finance.fuel_price", "origin": "stealth", "masked": true }
    ]
  },
  "meta": {
    "dependsOn": [
      "fleet.trucks.2.fuel",
      "finance.fuel_price"
    ]
  }
}
```

## Replay + Portability
`.me` snapshots and memory replay preserve visible runtime state, but there is an important nuance:

- `exportSnapshot()` exports public/redacted memories plus secret/noise/encrypted branch planes.
- `importSnapshot()` rebuilds the runtime state from those planes.
- `replayMemories()` restores committed results. For `=` and `?`, it currently replays the materialized value, not the original live derivation graph.

That means snapshots are portable and deterministic for state, but they are **not currently a full derivation-graph serializer**.

```ts
const snapshot = me.exportSnapshot();

const me2 = new ME();
me2.importSnapshot(snapshot);

console.log(me2("fleet.trucks.2.cost")); // same materialized state
```

## Current Guarantees
- **Deterministic recompute** through explicit dependency mapping.
- **Safe expression runtime** with restricted grammar.
- **Traceable outputs** via `me.explain(path)`.
- **Stealth-aware observability** where secret inputs are masked instead of leaked.

## Current Limits
- No full AST optimizer yet; the evaluator is still token/RPN based.
- No built-in public API for cycle rejection yet; avoid circular derivation graphs.
- Snapshot/replay preserves materialized state, not the live derivation graph itself.
- Large collection setup still costs upfront time; local mutations are where `O(k)` wins.

## Run Validation

```bash
node tests/phases.test.js
node tests/axioms.test.ts
```

If both pass, the intelligence layer is consistent with the kernel invariants.
