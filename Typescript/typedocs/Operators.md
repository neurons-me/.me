# Operators & Logic in .me ​

`.me` operators are the small set of bracket tokens (`["op"]`) and path markers that give a
plain path expression its behavior: pointer, derivation, secrecy, broadcast, and filtering.
Each one is recognized by a dedicated, pure function in
[`src/operators.ts`](https://github.com/neurons-me/.me/blob/main/Typescript/src/operators.ts)
or [`src/utils.ts`](https://github.com/neurons-me/.me/blob/main/Typescript/src/utils.ts),
called from `me.ts` before a write or read falls through to plain value storage.

This page covers the five operators used in day-to-day path algebra. For the full operator
catalog (`@`, `~`, `?`, `-`, `+`) see [Syntax §5](./Syntax.md#5-operator-syntax-examples).

## 1. `->` pointer ​

Makes a path resolve *through* another path instead of storing its own value. Reading the
pointer path transparently follows the target and returns what lives there.

Handler: [`isPointerCall`](https://github.com/neurons-me/.me/blob/main/Typescript/src/operators.ts#L156)
(`src/operators.ts:156`). It requires a
non-empty string expression, strips a leading `.`, and returns `{ targetPath }` for the
write pipeline to store as a pointer marker (`{ __ptr: targetPath }`).

```ts
me.inventory.stock(900);
me.dashboard.card["->"]("inventory");
me("dashboard.card");        // { "__ptr": "inventory" }
me("dashboard.card.stock");  // 900
```

## 2. `=` derivation ​

Computes a value from other paths and stores the result. Takes either a `[name, expression]`
pair (assigns `name` under the current scope) or a thunk function evaluated eagerly.

Handler: [`isEvalCall`](https://github.com/neurons-me/.me/blob/main/Typescript/src/operators.ts#L196)
(`src/operators.ts:196`). It distinguishes
the two call shapes — `{ mode: "thunk", targetPath, thunk }` for a function argument, and
`{ mode: "assign", targetPath, name, expr }` for a `[name, expr]` array — and returns `null`
for anything else, which lets the call fall through to a plain write.

```ts
me.order.subtotal(100);
me.order.tax(16);
me.order["="]("total", "subtotal + tax");
me("order.total"); // 116
```

## 3. `_` secret scope ​

Marks a path as a secret branch, keyed by the string expression. Reading the scope root
itself always returns `undefined` — existence of a secret branch is never leaked — while
values written under it remain readable through their own paths.

Handler: [`isSecretScopeCall`](https://github.com/neurons-me/.me/blob/main/Typescript/src/operators.ts#L130)
(`src/operators.ts:130`). It
requires a non-root path with a string expression and resolves `opKind(leaf) === "secret"`
before returning `{ scopeKey }`, where `scopeKey` is the dotted path above the secret leaf.

```ts
me.wallet["_"]("vault-key");
me.wallet.balance(500);
me("wallet");         // undefined  (stealth)
me("wallet.balance");  // 500
```

## 4. `[i]` broadcast iterator ​

Applies one write across every existing member of an indexed collection in a single call,
instead of addressing one fixed index. `[i]` is a literal token inside a path segment (e.g.
`trucks[i]`), not a bracket-call operator — it is detected by scanning the path itself, then
substituted with each real index before the write runs.

Handler: [`pathContainsIterator`](https://github.com/neurons-me/.me/blob/main/Typescript/src/utils.ts#L70)
(`src/utils.ts:70`), paired with
[`substituteIteratorInPath`](https://github.com/neurons-me/.me/blob/main/Typescript/src/utils.ts#L74)
which replaces `[i]` with a concrete index per member. `pathContainsIterator` just checks
whether any path segment contains the `[i]` substring; the broadcast loop itself lives in
`me.ts`.

```ts
me.fleet.trucks[1].fuel(100);
me.fleet.trucks[2].fuel(200);
me.fleet.trucks[3].fuel(400);
me.price_per_liter(2);
me.fleet["trucks[i]"]["="]("cost", "fuel * price_per_liter");
me("fleet.trucks[2].cost"); // 400
```

## 5. `[filter]` logical filter ​

Selects members of a collection by a boolean predicate over their fields, evaluated during
path *read*, not write. Like `[i]`, this is a bracket predicate embedded in a path segment
(e.g. `trucks[fuel >= 200]`), not an `["op"]` call — the predicate text is parsed once its
segment is isolated from the rest of the path.

Handler: [`parseFilterExpression`](https://github.com/neurons-me/.me/blob/main/Typescript/src/utils.ts#L82)
(`src/utils.ts:82`), which parses a single `left op right` clause (`>`, `<`, `>=`, `<=`, `==`,
`!=`). Chained predicates (`a && b`, `a || b`) go through
[`parseLogicalFilterExpression`](https://github.com/neurons-me/.me/blob/main/Typescript/src/utils.ts#L95)
(`src/utils.ts:95`), which splits on `&&`/`||` and calls `parseFilterExpression` per clause.
Matching members are returned keyed by their original index.

```ts
me.fleet.trucks[1].fuel(100);
me.fleet.trucks[2].fuel(200);
me.fleet.trucks[3].fuel(400);
me("fleet.trucks[fuel >= 200].fuel");
// { "2": 200, "3": 400 }
```

Note: this is a genuinely different mechanism from the `?` collect operator (`isQueryCall`,
`src/operators.ts:225`) covered in [Syntax §5](./Syntax.md#5-operator-syntax-examples) — `?`
combines an explicit list of dotted paths on *write*, while `[filter]` selects collection
members by predicate on *read*. The two are easy to conflate by name but touch unrelated
code paths.

## Related Pages ​

- [Syntax of .me](./Syntax.md)
- [Plurality Is Grammar](./Plurality-Is-Grammar.md)
- [Algebra of Contexts](./Algebra-of-Contexts.md)
- [Proxy Calls](./Proxy-Calls.md)
