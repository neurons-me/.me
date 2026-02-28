# 𓎛 Kernel Intelligence
###### Reactive Inference in `.me`

While the **Axioms** define identity, secrecy, and integrity, **Kernel Intelligence** defines how `.me` computes fast and predictably.

---

## ⟐ What "Intelligence" Means Here
In `.me`, intelligence is not AI magic. It is:
- **Dependency-aware recompute**
- **Hermetic formula evaluation**
- **Inspectable derivations**

You write:

```ts
me.fleet["trucks[i]"]["="]("cost", "fuel * finance.fuel_price");
```

The kernel builds relationships between paths, then re-computes only affected targets when inputs mutate.

---

## 𓃭 Incremental Recompute (Phase 8)
Instead of rescanning the entire tree on every change, `.me` tracks references from formulas.

### Kernel evidence (`src/me.ts`)

```ts
private derivations: Record<string, { expression: string; evalScope: SemanticPath; refs: Array<{ label: string; path: string }>; lastComputedAt: number; }> = {};
private refSubscribers: Record<string, string[]> = {};
```

```ts
private registerDerivation(targetPath: SemanticPath, evalScope: SemanticPath, expr: string): void {
  // extracts refs, resolves relative/absolute paths, and registers subscribers
}
```

```ts
private invalidateFromPath(path: SemanticPath): void {
  // BFS queue: changed source -> subscribers -> recomputed targets
}
```

### Runtime shape

```txt
mutation -> invalidateFromPath(source)
         -> refSubscribers[source]
         -> recomputeTarget(target)
         -> queue next affected targets
```

### Minimal proof

```ts
const me = new Me() as any;
me.finance.fuel_price(24.5);
me.fleet.trucks[1].fuel(200);
me.fleet.trucks[2].fuel(350);
me.fleet["trucks[i]"]["="]("cost", "fuel * finance.fuel_price");

me.finance.fuel_price(25);
console.log(me("fleet.trucks[1].cost")); // 5000
console.log(me("fleet.trucks[2].cost")); // 8750
```

---

## 𓁟 Hermetic Evaluator (No `eval`, no `new Function`)
The formula engine is intentionally constrained. It tokenizes and evaluates expressions with a controlled grammar.

### Kernel evidence (`src/me.ts`)

```ts
private readonly unsafeEval = false;
```

```ts
if (!/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(raw)) return { ok: false };
if (this.unsafeEval) return { ok: false };
```

```ts
// tokenize -> shunting-yard -> RPN execution
private tokenizeEvalExpression(...)
private tryEvaluateAssignExpression(...)
```

### Supported operators

```txt
+  -  *  /  %
>  >=  <  <=  ==  !=
&&  ||  !
```

### Security behavior

```ts
const me = new Me() as any;
me.profile.age(30);
me.profile["="]("adult", "age > 18");
console.log(me("profile.adult")); // true

me.profile["="]("bad", "1 + console.log(1)");
console.log(me("profile.bad")); // expression fallback (not executable JS)
```

---

## 𓆣 Explainable Derivations (`me.explain`)
Every derived value can expose its provenance.

### Kernel evidence (`src/me.ts`)

```ts
explain(path: string): {
  path: string;
  value: any;
  derivation: null | { expression: string; inputs: Array<{ label: string; path: string; value: any; origin: "public" | "stealth"; masked: boolean }> };
  meta: { dependsOn: string[]; lastComputedAt?: number };
}
```

For secret-origin inputs, explain masks the value (`●●●●`) but still shows dependency and origin.

### Example

```ts
const me = new Me() as any;
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

---

## 𓈖 Replay + Portability
Kernel intelligence is portable because derivations are rebuilt from memory/snapshot planes.

```ts
const snapshot = me.exportSnapshot();
const me2 = new Me() as any;
me2.importSnapshot(snapshot);
console.log(me2("fleet.trucks.2.cost")); // same deterministic result
```

---

## ☯ Current Guarantees
- **Deterministic recompute** through explicit dependency mapping.
- **Safe expression runtime** with restricted grammar.
- **Traceable outputs** via `me.explain(path)`.
- **Stealth-aware observability** (secret inputs masked, not leaked).

## ⟁ Current Limits (honest status)
- No full AST optimizer yet (current evaluator is token/RPN based).
- No built-in topological cycle rejection API yet; avoid circular formula graphs at user level.
- Large collection setup still costs upfront time; local mutations are where O(k) wins.

---

## Run Validation

```bash
node tests/phases.test.js
node tests/axioms.test.ts
```

If both pass, the intelligence layer is consistent with the kernel invariants.

- suiGn