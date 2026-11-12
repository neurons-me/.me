---
image: https://neurons-me.github.io/.me/docs/assets/card-aggregates.webp
layout: gui-doc
title: "Collection aggregates: x[] and x[].f"
description: "Collection aggregates in this.me 4.2.1: robots[] is the count of a collection, robots[].battery the exact sum of a field. They work in me(), explain() and formula text, stay live on every write, and count booleans as 1 / 0. Every output on this page was run against this.me 4.2.1."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/Aggregates.html
crumb: Aggregates
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=2
view_content_name: "Doc - Collection aggregates: x[] and x[].f"
view_content_category: "Docs"
---

# Collection aggregates: `x[]` and `x[].f`

> An empty `[]` after a collection reads an aggregate over its members: `robots[]` is how many there are, `robots[].battery` is the sum of their `battery`. Put either in a formula and it stays live.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Source: the parser [`AggregateOp` / `AggregateRef` in path-expr.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/path-expr.ts#L41-L67), the evaluator [`evaluateAggregate` in aggregate.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/aggregate.ts#L110-L197), change tracking [aggregate-index.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/aggregate-index.ts). TypeScript reference: [Aggregates (TypeScript)](https://neurons-me.github.io/.me/Typescript/typedocs/Aggregates.html).
{: .doc-kernel-more}

Each block below has a **Run** button. Run executes the blocks of this page in order on one `new ME()` from this.me 4.2.1, so later blocks build on earlier ones. The comment after each read is what 4.2.1 returned.

## The two forms

| Form | Name | Value |
|---|---|---|
| `C[]` | count | how many members collection `C` has |
| `C[].f` | sum | the sum of field `f` over every member of `C` (`f` can be a path: `C[].stats.hp`) |

There are no other aggregates: no `avg`, `min` or `max`. An average is the sum divided by the count.

## Read one directly

```ts
import { ME } from "this.me";
const me = new ME();

me.robots[1].battery(80); me.robots[1].ok(true);
me.robots[2].battery(50); me.robots[2].ok(true);
me.robots[3].battery(20); me.robots[3].ok(false);
me.robots[4].battery(90); me.robots[4].ok(true);

me("robots[]");            // 4
me("robots[].battery");    // 240
me("robots[].ok");         // 3
```
{: .me-run}

`true` counts as `1` and `false` as `0`, so the sum of a boolean field is how many members have it set.

## In a formula

```ts
me.fleet["="]("n", "robots[]");
me.fleet["="]("total", "robots[].battery");
me.fleet["="]("avg", "robots[].battery / robots[]");
me.fleet["="]("oks", "robots[].ok");

me("fleet.n");       // 4
me("fleet.total");   // 240
me("fleet.avg");     // 60
me("fleet.oks");     // 3
```
{: .me-run}

The collection path is written **from the root**, even when the formula is declared under `fleet`. See [Limitations](#limitations).

## What `explain()` shows

An aggregate is one input of the formula, with `kind: "aggregate"` and an `aggregate` block:

```ts
me.explain("fleet.oks").derivation.inputs[0].aggregate;
me.explain("fleet.oks").meta.dependsOn;    // ["robots[].ok"]
```
{: .me-run}

Full result of `me.explain("fleet.oks")` at this point (timestamp shortened):

```json
{
  "path": "fleet.oks",
  "value": 3,
  "expr": "robots[].ok",
  "derivation": {
    "expression": "robots[].ok",
    "inputs": [
      {
        "label": "robots[].ok",
        "path": "robots[].ok",
        "kind": "aggregate",
        "value": 3,
        "origin": "public",
        "masked": false,
        "status": "resolved",
        "aggregate": {
          "collection": "robots",
          "field": "ok",
          "op": "sum",
          "context": "public-view",
          "coverage": "public-view",
          "status": "resolved",
          "members": 4,
          "terms": 4,
          "domain": "boolean"
        }
      }
    ]
  },
  "meta": {
    "dependsOn": ["robots[].ok"],
    "lastComputedAt": 1792117617602
  }
}
```

| `aggregate` field | Meaning |
|---|---|
| `collection`, `field`, `op` | The reference as parsed: `op` is `"count"` or `"sum"`; `field` is `null` for a count. |
| `context`, `coverage` | `"public-view"`: the aggregate reads what `me.as(null)` would see. |
| `status` | `resolved`, `absent` (empty collection), `incomplete` (a member is missing the field or it is not a number / boolean), `deferred`, `cycle`, `unsupported`, `non-finite`. |
| `members` | How many members the collection has. |
| `terms` | How many of them contributed a value. |
| `domain` | `"boolean"` when every term was a boolean, `"number"` otherwise, `null` with no terms. |
| `problems` | Present when not resolved: a count and a sample of the member paths at fault. |

## It stays live

Writing one member recomputes the formulas that read the collection:

```ts
me.robots[3].ok(true);

me("fleet.oks");                            // 4
me.explain("fleet.oks").meta.k;             // 4
me.explain("fleet.oks").meta.recomputed;    // ["fleet.n","fleet.total","fleet.avg","fleet.oks"]
me.explain("fleet.oks").meta.changed;       // ["fleet.oks"]
me.explain("fleet.oks").meta.sourcePath;    // "robots.3.ok"
```
{: .me-run}

Every aggregate on `robots` was recomputed (`k` is 4), and only `fleet.oks` changed. See [Performance](#performance).

## Booleans in arithmetic

An aggregate's value is a number, so it composes with any operator:

```ts
me.fleet["="]("okPlusOne", "robots[].ok + 1");
me.fleet["="]("allOk", "robots[].ok == robots[]");

me("fleet.okPlusOne");    // 5
me("fleet.allOk");        // true
me.explain("fleet.oks").derivation.inputs[0].aggregate.domain;     // "boolean"
me.explain("fleet.total").derivation.inputs[0].aggregate.domain;   // "number"
```
{: .me-run}

## Summing a derived field

A per-member formula declared with `[i]` produces a field on each member. The aggregate sums it:

```ts
me.fleet.threshold(60);
me.robots["[i]"]["="]("canTake", "battery > fleet.threshold && ok");
me.fleet["="]("available", "robots[].canTake");
me("fleet.available");    // 2

me.robots[2].battery(75);
me("fleet.available");    // 3
me.explain("fleet.available").meta.recomputed;
```
{: .me-run}

The last read returns `["robots.2.canTake","fleet.n","fleet.total","fleet.avg","fleet.oks","fleet.okPlusOne","fleet.allOk","fleet.available"]`: the member's own `canTake`, then every formula reading `robots[]`.

## A member without the field

A sum is all or nothing. A new member without `ok` makes `robots[].ok` `undefined` (never a partial sum), and `explain` names the member:

```ts
me.robots[5].battery(70);

me("fleet.n");        // 5
me("fleet.total");    // 335
me("fleet.avg");      // 67
me("fleet.oks");      // undefined
me.explain("fleet.oks").meta.unresolved;    // {"reason":"incomplete","inputs":["robots[].ok"],"causes":[{"path":"robots[].ok","status":"incomplete"}]}
me.explain("fleet.oks").derivation.inputs[0].aggregate.problems;    // {"count":1,"sample":[{"path":"robots.5.ok","kind":"missing"}]}

me.robots[5].ok(true);
me("fleet.oks");      // 5
```
{: .me-run}

## Empty collections and unknown fields

```ts
me.fleet["="]("drones", "drones[]");
me.fleet["="]("nope", "robots[].nope");

me("fleet.drones");    // undefined
me.explain("fleet.drones").meta.unresolved;    // {"reason":"missing-input","inputs":["drones[]"],"causes":[{"path":"drones[]","status":"absent"}]}
me("fleet.nope");      // undefined
```
{: .me-run}

An empty or missing collection is `undefined`, not `0`.

## Limitations

**Paths are from the root.** Inside `fleet`, `squad[].hp` does not read `fleet.squad`; write `fleet.squad[].hp`:

```ts
me.fleet.squad[1].hp(5);
me.fleet.squad[2].hp(7);
me.fleet["="]("hpRel", "squad[].hp");
me.fleet["="]("hpRoot", "fleet.squad[].hp");

me("fleet.hpRel");     // undefined
me("fleet.hpRoot");    // 12
```
{: .me-run}

**Only `[]`.** Function calls, `[*]`, ternaries, `(bool) * 1`, a selector before `[]` and a second `[]` all give `undefined`:

```ts
me.bad["="]("a", "sum(robots[].battery)");
me.bad["="]("b", "count(robots)");
me.bad["="]("c", "robots[*].battery");
me.bad["="]("d", "fleet.n > 2 ? 1 : 0");
me.bad["="]("e", "(robots[1].ok) * 1");
me.bad["="]("f", "robots[battery > 40][]");
me.bad["="]("g", "robots[].cells[]");

me("bad.a");    // undefined
me("bad.b");    // undefined
me("bad.c");    // undefined
me("bad.d");    // undefined
me("bad.e");    // undefined
me("bad.f");    // undefined
me("bad.g");    // undefined
me.explain("bad.f").meta.unresolved;    // {"reason":"evaluation-failed","detail":"rejected-path-form"}
```
{: .me-run}

To count members that pass a test, declare the test per member with `[i]` and sum it (see [Summing a derived field](#summing-a-derived-field)).

Other rules from the source:

- Aggregates read the **public view**: values under a secret scope are not counted, for every caller including the owner.
- `z.[].w` and `z[ ].w` are rejected. A key literally named `[]` is written with a quoted selector: `z["[]"].w`.
- A fixed index before the collection is fine: `robots[1].cells[].v` sums the cells of robot 1.
- The sum is exact: every term is added as an exact integer in units of 2^-1074 (BigInt) and the total is rounded once, ties to even ([`exactSum`](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/aggregate.ts#L57-L63)).

## Performance

A write under a collection recomputes **every** formula that holds an aggregate of that collection, and each recompute walks every member. The cost of one write grows with the number of members. Measured on Node 20 with this.me 4.2.1, 1000 members, one per-member `[i]` formula and one `r[].hi` aggregate:

```ts
const m = new ME();
for (let i = 1; i <= 1000; i++) m.r[i].b(50);
m.r["[i]"]["="]("hi", "b > 30");
m.f["="]("c", "r[].hi");
// 200 writes m.r[1 + k].b(k % 2 ? 10 : 60): 783.4 ms, 3.92 ms per write; m("f.c") → 900
```

Few aggregates on collections of hundreds are fine. For thousands of members written often, keep the aggregate on a smaller collection.

## Tests

- [tests/aggregate-path.test.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/tests/aggregate-path.test.ts): parsing, rejected forms, rendering (165 passed on 4.2.1)
- [tests/aggregate-eval.test.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/tests/aggregate-eval.test.ts): evaluation, exact sum, reactivity, explain (77 passed)
- [tests/Security/root-secret-aggregate-paths.test.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/tests/Security/root-secret-aggregate-paths.test.ts): secret scopes × `[]` paths (14 passed)
- [tests/aggregate/exact-sum-ref.mjs](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/tests/aggregate/exact-sum-ref.mjs): the reference exact sum

Run them with `npm run test:aggregates` in `Typescript/`.

## See also

[.me Syntax](./Syntax.html#collection-aggregates-x-and-xf) · [.me Operators](./Operators.html) · [me.explain(path)](./Explain.html) · [What is O(k)?](./O-k.html) · [Warehouse Fleet](https://neurons-me.github.io/.me/Demos/Robots/Warehouse/) (aggregates in a live demo)
