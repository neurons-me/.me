---
layout: readme
title: Extreme Fan-Out
---

[← Back to .me Docs](https://neurons-me.github.io/.me/docs/)

---

# Extreme Fan-Out

This demo teaches one simple idea:
> One write. 100,000 dependents. All of them update — because they all actually depend on what changed.

The opposite of Hemisphere Scale. There, k was tiny and the graph was huge. Here, k is intentionally enormous: every single node in the graph depends on one root value. Change the root — measure how long it takes to recompute all 100,000 leaves.

[`.me Docs`](https://neurons-me.github.io/.me) · [Extreme Fan-Out Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Root_Fanout_100k.ts)

---

## The Tiny Mental Model

```ts
me.master.factor(1)

// 100,000 nodes, each derived from the same root
me.dep[i]["="]("out", "value * master.factor")

// one write
me.master.factor(2)
// → all 100,000 `out` values recompute
```

O(k) is honest — if k is 100,000, the cost is 100,000. The point is: the graph never recomputes more than k.

---

## What The Demo Builds

| Part | Path | What it means |
|---|---|---|
| Root | `master.factor` | The one value everything depends on |
| Leaves | `dep[i].value` | Each node's own base value |
| Derived | `dep[i].out` | `value * master.factor` — live for all 100k |

---

## Step 1: Wire 100,000 Dependents

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

## Step 2: Mutate the Root

```ts
me.master.factor(2)
```

All 100,000 leaves recompute:

```ts
me("dep[1].out")       // 2
me("dep[100000].out")  // 200000
```

---

## Explainability

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

---

## Build It Yourself

```bash
cd npm
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

## The Big Idea

Fan-out is not a pathological case. It is the natural shape of broadcast: one configuration value, one price, one policy — many things that depend on it.

`.me` handles it without special-casing. The same O(k) guarantee that makes Hemisphere Scale cheap also makes Extreme Fan-Out correct: the graph recomputes everything that needs to change, and nothing that does not.

```text
1 root mutation → k=100,000 → mutation time measured in milliseconds
```

---

[← Back to .me Docs](https://neurons-me.github.io/.me/docs/)
