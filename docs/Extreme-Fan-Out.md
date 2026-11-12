---
layout: gui-doc
title: Extreme Fan-Out
description: "One write, 100,000 dependents. Fan-out in .me: every value that reads what changed recomputes (k), nothing else does, each wave is traceable with explain(), and the known limits."
image: https://suign.github.io/assets/imgs/EXTREME-FAN-OUT.jpg
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
crumb: Fan-Out
scripts:
  - /assets/fanout-viz/fanout-viz.js?v=3.1.3
view_content_name: "Doc - Extreme Fan-Out"
view_content_category: "Docs"
---

# Extreme Fan-Out

> One write. Every real dependent recomputes — and only what actually changed goes further.

<div class="fanout-viz" markdown="1">
**Live fan-out.** A real this.me kernel in your browser: one line per dependent of `master.factor`, the recompute order replayed at the measured duration (needs JavaScript).
</div>

`.me` is a reactive kernel. Facts live at paths (`master.factor`); a derived value, declared once with `["="]`, recomputes when one of its inputs changes. The work a write causes is its wave, and **k** is the size of that wave: how many derived values it recomputed. `me.explain(path)` returns the formula, its inputs and the last wave (`k`, `recomputed`, `changed`, `sourcePath`).

Fan-out is the case where k is large on purpose: many values read the same input, so one write has to reach all of them.

## The 100,000-dependent demo

The opposite of Hemisphere Scale. There, k was tiny and the graph was huge. Here, k is intentionally enormous: every single node in the graph depends on one root value. Change the root — measure how long it takes to recompute all 100,000 leaves.

[`.me Docs`](https://neurons-me.github.io/.me/docs/) · [Extreme Fan-Out Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Root_Fanout_100k.ts)

### The Tiny Mental Model

```ts
me.master.factor(1)

// 100,000 nodes, each derived from the same root
me.dep[i]["="]("out", "value * master.factor")

// one write
me.master.factor(2)
// → all 100,000 `out` values recompute
```

O(k) is honest — if k is 100,000, the cost is 100,000. The point is: the graph never recomputes more than k.

On real data the same rule holds: in a transit feed most writes have k = 1 and the widest parent sets the tail ([measured on real data in GTFS-Madrid →](Benchmarks/GTFS/Madrid/#skew)), and k does not grow when the data does ([k vs n →](Benchmarks/GTFS/Madrid/#k-vs-n)).

---

### What The Demo Builds

| Part | Path | What it means |
|---|---|---|
| Root | `master.factor` | The one value everything depends on |
| Leaves | `dep[i].value` | Each node's own base value |
| Derived | `dep[i].out` | `value * master.factor` — live for all 100k |

---

### Step 1: Wire 100,000 Dependents

```ts
me.master.factor(1)

for (let i = 1; i <= 100_000; i++) {
  me.dep[i].value(i)
  me.dep[i]["="]("out", "value * master.factor")
}
```

Every node declares its derivation at setup time. The dependency graph is built once.

Initial state:

```ts
me("dep[1].out")       // 1
me("dep[100000].out")  // 100000
```

---

### Step 2: Mutate the Root

```ts
me.master.factor(2)
```

All 100,000 leaves recompute:

```ts
me("dep[1].out")       // 2
me("dep[100000].out")  // 200000
```

---

### Explainability

The cascade is fully traceable:

```ts
me.explain("dep[100000].out")
// → {
//     expr: "value * master.factor",
//     dependsOn: ["dep.100000.value", "master.factor"],
//     k: 100000,
//     sourcePath: "master.factor",
//     recomputed: ["dep.1.out", "dep.2.out", ..., "dep.100000.out"]
//   }
```

`k: 100000` — the graph recomputed exactly as many nodes as depended on `master.factor`. No more, no less.

The trace is complete, so it is as large as the wave: see [Known limits](#known-limits).

---

### Build It Yourself

```bash
cd Typescript
npm install
node tests/Demos/Root_Fanout_100k.ts
```

Override N:

```bash
FANOUT_N=50000 node tests/Demos/Root_Fanout_100k.ts
```

To run every demo:

```bash
npm run test:demos:run-all
```

---

### The Big Idea

Fan-out is not a pathological case. It is the natural shape of broadcast: one configuration value, one price, one policy — many things that depend on it.

`.me` handles it without special-casing. The same O(k) guarantee that makes Hemisphere Scale cheap also makes Extreme Fan-Out correct: the graph recomputes everything that needs to change, and nothing that does not.

```text
1 root mutation → k=100,000 → mutation time measured in milliseconds
```

---

## Known limits {#known-limits}

- **`explain()` grows with k.** It lists every recomputed path, about 1.9 KB plus 56 bytes per recomputed value. On a trip with 14,378 `stop_times` it returns about 1.6 MB ([GTFS-Madrid →](Benchmarks/GTFS/Madrid/#known-limits)). There is no pagination or summary mode yet; that is an open item.
- **Deletes do not follow k yet.** An update costs about k; a removal (`me["-"]`) also scans the store, so it grows with the size of the data ([DELETE on GTFS-Madrid →](Benchmarks/GTFS/Madrid/#delete)). Open.

<div class="doc-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/.me/docs/Benchmarks/GTFS/Madrid/"><img src="https://suign.github.io/assets/imgs/MADRID-GRAPH-ME.jpg" alt="GTFS-Madrid benchmark page"><span class="card-kind">Benchmark</span><span class="card-title">GTFS-Madrid</span><span class="card-desc">The same kernel on a real transit feed: k as the data grows, skewed fan-out, deletes.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Benchmarks/benchmarks.html"><img src="https://neurons-me.github.io/.me/docs/assets/kernel-timeline-og.jpg" alt="Kernel benchmarks"><span class="card-kind">Benchmark</span><span class="card-title">Kernel benchmarks</span><span class="card-desc">Fan-out, sustained writes and reads, measured across versions.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/"><img src="https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/assets/ai-decides-og.png" alt="AI decides, .me computes"><span class="card-kind">Demo</span><span class="card-title">AI decides, .me computes</span><span class="card-desc">The same waves on GTFS-Madrid-Bench: a policy decides a headway change, one write, explain() back to the decision.</span></a>
<a class="card" href="https://neurons-me.github.io/smart-cities/"><img src="https://neurons-me.github.io/smart-cities/assets/SMART-CITIES-ME.jpg" alt="Smart Cities demos"><span class="card-kind">Demos</span><span class="card-title">Smart Cities</span><span class="card-desc">City demos on .me: Madrid transit, the Port of Veracruz, a hospital.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-hemisphere.webp" alt="Hemisphere Scale"><span class="card-kind">Docs</span><span class="card-title">Hemisphere Scale</span><span class="card-desc">The opposite case: 1 million nodes, one write, k = 6.</span></a>
</div>
