---
layout: gui-doc
title: "What is O(k)?"
description: "O(k) in this.me 4.2.1: n is every value in the graph, k is the number of derived values one write recomputes. The propagation work of a write follows k, not n. Example verified on 4.2.1, read with explain(path).meta, and benchmark figures with their kernel versions."
image: https://neurons-me.github.io/.me/docs/assets/card-ok.webp
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://suign.github.io/WhatIsOK.html
crumb: O(k)
view_content_name: "Doc - What is O(k)?"
view_content_category: "Docs"
---

# What is O(k)?

> One write recomputes the derived values that depend on it. How many that is, k, sets the work, not how big the graph is, n.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)).

## n and k

| Symbol | Meaning |
|---|---|
| **n** | Every value in the graph: facts and derived values. |
| **k** | The derived values that one write recomputed. Read it with [`me.explain(path).meta.k`](./Explain.html). |

A derived value is declared once with `["="]` and recomputes when one of its inputs changes. When you write a fact, the kernel follows the dependents of that path, and their dependents, and recomputes only those. That set is the write's wave; its size is k. Values that do not read the written path, directly or through another derived value, are not touched.

So the propagation work of a write grows with k. Adding more unrelated values makes n bigger and leaves k where it was.

## Example

```ts
import { ME } from "this.me";
const me = new ME() as any;

me.a(1);
me.b(2);
me["="]("c", "a + b");
me["="]("d", "c * 2");

for (let i = 0; i < 1000; i++) {   // 1,000 unrelated derived values
  me.other[i].x(i);
  me.other[i]["="]("y", "x + 1");
}

me.a(5);                            // one write
me("d");                            // 14
me.explain("d").meta;
```

Returns (timestamps shortened), run on this.me 4.2.1:

```json
{
  "dependsOn": ["c"],
  "lastComputedAt": 1791911874286,
  "k": 2,
  "recomputed": ["c", "d"],
  "changed": ["c", "d"],
  "sourcePath": "a",
  "recomputedAt": 1791911874286
}
```

The graph has 1,002 derived values. The write to `a` recomputed two of them, `c` and `d`; none of the 1,000 `other[i].y` values was evaluated.

## Reading a wave

| Field | Meaning |
|---|---|
| `meta.k` | How many derived values the last wave that reached this path recomputed. |
| `meta.recomputed` | Those paths, in order (its length is `k`). |
| `meta.changed` | The subset of `recomputed` whose value actually changed. A value that recomputes to the same result is not in it. |
| `meta.sourcePath` | The write that started the wave. |

Full return shape: [me.explain(path)](./Explain.html). How paths are written and read: [me.whatever(what)](./me-whatever-what.html).

## What it does not say

- **O(k) is not "always fast".** If k is large, the write is large. In [Extreme Fan-Out](./Extreme-Fan-Out.html) every one of 100,000 values reads the same root, so one write recomputes all 100,000.
- **It is about propagation.** Other costs of a write are separate. In GTFS-Madrid, DELETE is still a store scan, so its time grows with the data even when k is small ([GTFS-Madrid benchmark](./Benchmarks/GTFS/Madrid/)).
- **k counts recomputations, not changes.** Use `meta.changed` to see which values moved.

## Measured

**GTFS-Madrid** ([benchmark](./Benchmarks/GTFS/Madrid/)). Real GTFS Madrid data shaped as `.me` paths and formulas, with CREATE / UPDATE / DELETE writes. Across scales, k per write stayed at p50 1 / p95 18 / max 27 while stop times grew 100× (2,364 → 236,400).

| scale | stop_times | k p50 / p95 / max | kernel |
|---|---:|---|---|
| 1 | 2,364 | 1 / 18.5 / 27 | [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) |
| 10 | 23,640 | 1 / 18 / 27 | [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) |
| 100 | 236,400 | 1 / 18 / 27 | [this.me 4.1.0](https://www.npmjs.com/package/this.me/v/4.1.0) (not re-run on 4.2.x) |

**Madrid AI-Decides** ([demo](https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/)). On the generated GTFS-Madrid-Bench network at scale 1, one write to the headway policy factor recomputed k = 2,722 of the 5,216 derived values, on [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1). None of the 2,364 stop_times reads the headway, so none of them was in the wave.

## See also

- [me.explain(path)](./Explain.html): `meta.k`, `recomputed`, `changed`, `sourcePath`.
- [me.whatever(what)](./me-whatever-what.html): writing and reading paths.
- [Benchmarks](./Benchmarks/): O(k) scaling, fan-out, explain overhead.
- [Extreme Fan-Out](./Extreme-Fan-Out.html): one write, 100,000 dependents.
- [GTFS Madrid universe](https://neurons-me.github.io/.me/Tests/gtfs-madrid-universe.html): click a node for `me.explain(path)`, mutate to watch the wave.
