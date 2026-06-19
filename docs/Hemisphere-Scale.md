---
layout: readme
title: Hemisphere Scale
---

[← Back to .me Docs](https://neurons-me.github.io/.me/docs/)

---

# Hemisphere Scale

This demo teaches one simple idea:
> One sensor flips. Six derivations cascade across four domains. One million other nodes never move.

A hemisphere of one million districts. One district loses power. In under a millisecond, the graph propagates through geo → grid → traffic → services — touching exactly the nodes that depend on that one change, and nothing else.

[`.me Docs`](https://neurons-me.github.io/.me) · [Hemisphere Scale Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Hemisphere_1M.ts)

---

## The Tiny Mental Model

`.me` uses O(k) cascade — where k is the number of derived nodes that actually depend on what changed. One million cold nodes cost nothing. Only the live lineage recomputes.

```ts
me.geo[777777].powerUp(false)
// → blackout → gridlock → hospitalAlert → zoneDown → emergencyReroute → generatorMode
// 6 nodes. Not 1,000,000.
```

---

## What The Demo Builds

| Domain | Path | What it means |
|---|---|---|
| Geo | `geo[777777].powerUp` | Sensor — did this district lose power? |
| Derived | `geo[777777].blackout` | `!powerUp` |
| Derived | `geo[777777].gridlock` | `blackout && trafficLoad > 80` |
| Derived | `geo[777777].hospitalAlert` | `hospital && blackout` |
| Grid | `grid[78].zoneDown` | Zone response to district state |
| Traffic | `traffic.emergencyReroute` | City-level rerouting flag |
| Services | `services.generatorMode` | Final downstream system |

---

## Step 1: Allocate the Hemisphere

```ts
const N = 1_000_000

for (let i = 1; i <= N; i++) {
  me.geo[i].powerUp(true)
}
```

One million districts, all powered. No derivations yet — just cold facts.

---

## Step 2: Seed One Hot District

```ts
me.geo[777777].trafficLoad(95)
me.geo[777777].hospital(true)
```

Only one district carries the hot state. The other 999,999 are untouched.

---

## Step 3: Wire the Cross-Domain Derivation Chain

```ts
me.geo[777777]["="]("blackout",       "!powerUp")
me.geo[777777]["="]("gridlock",       "blackout && trafficLoad > 80")
me.geo[777777]["="]("hospitalAlert",  "hospital && blackout")
me.grid[78]["="]("zoneDown",          "geo[777777].gridlock || geo[777777].hospitalAlert")
me.traffic["="]("emergencyReroute",   "grid[78].zoneDown")
me.services["="]("generatorMode",     "traffic.emergencyReroute")
```

Six derivations across four domains — each one reading from the previous.

---

## Step 4: Flip One Sensor

```ts
me.geo[777777].powerUp(false)
```

The cascade runs immediately:

```ts
me("geo[777777].blackout")       // true
me("geo[777777].gridlock")       // true
me("geo[777777].hospitalAlert")  // true
me("grid[78].zoneDown")          // true
me("traffic.emergencyReroute")   // true
me("services.generatorMode")     // true
```

One write. Six updates. The other 999,999 districts: untouched.

---

## Explainability

The graph explains the full cascade:

```ts
me.explain("services.generatorMode")
// → {
//     value: true,
//     expr: "traffic.emergencyReroute",
//     k: 6,
//     recomputed: [
//       "geo.777777.blackout",
//       "geo.777777.gridlock",
//       "geo.777777.hospitalAlert",
//       "grid.78.zoneDown",
//       "traffic.emergencyReroute",
//       "services.generatorMode"
//     ]
//   }
```

`k: 6` — that is the entire cost of the mutation. Not a million. Six.

---

## Build It Yourself

```bash
cd npm
npm install
node tests/Demos/Hemisphere_1M.ts
```

To run every demo:

```bash
npm run test:demos:run-all
```

---

## The Big Idea

Scale is not the enemy. Unnecessary recomputation is.

`.me` tracks exactly which values depend on which paths. A write touches only its live lineage — regardless of how large the surrounding graph is.

```text
1 sensor mutation → k=6 recomputations → 0 wasted work
```

That is what O(k) means in practice.

---

[← Back to .me Docs](https://neurons-me.github.io/.me/docs/)
