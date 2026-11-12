---
image: https://neurons-me.github.io/.me/docs/assets/og-explain.jpg
layout: gui-doc
title: me.explain(path)
description: "me.explain(path) in this.me 4.2.1: the value at a path, its formula, every input with its current value, and the last wave that recomputed it (k, recomputed, changed, sourcePath). Return shape and behaviour from the kernel source."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://suign.github.io/Explain.html
crumb: explain
view_content_name: "Doc - me.explain(path)"
view_content_category: "Docs"
---

# me.explain(path)

> Why does this path have this value? `me.explain(path)` answers from the kernel: the formula, its inputs as they are now, and the write that last recomputed it.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Source: [`explain()` in derivation.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/derivation.ts#L140-L251), the method on the instance [me.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/me.ts#L482-L484), the return type [`MEExplainResult` in types.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/types.ts#L701-L747).
{: .doc-kernel-more}

## Signature

```ts
me.explain(path: string): MEExplainResult
```

`path` is a dotted path string, the same form `me(path)` reads ([me.whatever(what)](./me-whatever-what.html)). It is also reachable on the runtime plane as `me["!"].explain(path)` ([proxy.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/proxy.ts#L69-L75)). `explain` never writes.

## Example

```ts
import { ME } from "this.me";
const me = new ME() as any;

me.fleet.trucks[1].fuel(80);
me.fleet.trucks[2].fuel(40);
me.fleet["="]("total", "trucks[1].fuel + trucks[2].fuel");
me.fleet["="]("low", "total < 100");

me.fleet.trucks[1].fuel(30);          // one write
me.explain("fleet.total");
```

Returns (timestamps shortened):

```json
{
  "path": "fleet.total",
  "value": 70,
  "expr": "trucks[1].fuel + trucks[2].fuel",
  "derivation": {
    "expression": "trucks[1].fuel + trucks[2].fuel",
    "inputs": [
      { "label": "trucks[1].fuel", "path": "fleet.trucks.1.fuel", "value": 30, "origin": "public", "masked": false, "status": "resolved" },
      { "label": "trucks[2].fuel", "path": "fleet.trucks.2.fuel", "value": 40, "origin": "public", "masked": false, "status": "resolved" }
    ]
  },
  "meta": {
    "dependsOn": ["fleet.trucks.1.fuel", "fleet.trucks.2.fuel"],
    "lastComputedAt": 1791860000000,
    "k": 2,
    "recomputed": ["fleet.total", "fleet.low"],
    "changed": ["fleet.total", "fleet.low"],
    "sourcePath": "fleet.trucks.1.fuel",
    "recomputedAt": 1791860000000
  }
}
```

## Fields

| Field | Meaning |
|---|---|
| `path` | The path explained, in dotted form (`fleet.total`). |
| `value` | The current value at the path (the same as `me("fleet.total")`). |
| `expr` | The formula declared with `["="]`, or `null` for a fact. |
| `derivation` | `null` for a fact. For a derived value: `expression` and `inputs`. |
| `derivation.inputs[]` | One entry per value the formula reads: `label` (as written in the formula), `path` (resolved), `value` (now), `origin` (`public` / `stealth`), `masked`, `status` (`resolved`, `missing` or `masked`; aggregate inputs carry the aggregate's status and an `aggregate` block). |
| `meta.dependsOn` | The resolved input paths, without duplicates. |
| `meta.lastComputedAt` | When the derivation was last evaluated (ms). |
| `meta.k` | Size of the last wave that recomputed this path: how many derived values that write recomputed. |
| `meta.recomputed` | The paths that wave recomputed (its length is `k`). |
| `meta.changed` | The subset of `recomputed` whose value actually changed. |
| `meta.sourcePath` | The write that started that wave. |
| `meta.recomputedAt` | When that wave was committed (ms). |
| `meta.unresolved` | Present when the derivation has no value, with the reason (for example a cycle or a missing input). |

The wave fields (`k`, `recomputed`, `changed`, `sourcePath`, `recomputedAt`) come from the last wave that recomputed **this** path ([renderWave](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/derivation.ts#L130-L138)); they are absent on a fact and on a value no write has recomputed yet.

## Early cutoff, seen through explain

A recomputed value that comes out equal stops there. Continuing the example:

```ts
me.fleet.trucks[2].fuel(45);           // total 70 → 75, low stays true
const m = me.explain("fleet.total").meta;
m.k            // 2
m.recomputed   // ["fleet.total", "fleet.low"]
m.changed      // ["fleet.total"]
m.sourcePath   // "fleet.trucks.2.fuel"
```

## Facts and missing paths

```ts
me.explain("fleet.trucks.1.fuel");
// { path: "fleet.trucks.1.fuel", value: 30, expr: null, derivation: null, meta: { dependsOn: [] } }

me.explain("nope");
// { path: "nope", expr: null, derivation: null, meta: { dependsOn: [] } }   (value undefined)
```

## Notes from the source

- Inputs under a secret scope are reported with `value: "●●●●"`, `origin: "stealth"`, `masked: true`.
- An aggregate reference passed as the path is explained in the public view, with one aggregate input.
- A formula with aggregates that the caller cannot read is answered like a path that does not exist.
- In `lazy` recompute mode, `explain` refreshes the target before reading it.
- `recomputed` and `changed` are full lists; on a large wave (see [Extreme Fan-Out](./Extreme-Fan-Out.html)) they can hold tens of thousands of paths.

## See also

[me.whatever(what): reading and writing](./me-whatever-what.html) · [Primitives](./Primitives.html) · [Extreme Fan-Out](./Extreme-Fan-Out.html) (k at scale) · [AI decides, .me computes](https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/) (explain on every value of a real feed)
