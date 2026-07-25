---
layout: readme
title: Pointer Composition
---

# 🔗 Pointer Composition

This doc teaches one idea:
> Following a pointer through another pointer is not a special case. It is the same substitution, applied again.

[`.me Docs`](https://neurons-me.github.io/.me) · [Pointer Category Contract Test Source](https://github.com/neurons-me/.me/blob/main/Typescript/tests/contracts/pointer-category.contract.test.mjs)

---

## The Tiny Mental Model

```ts
me.chain.a["->"]("chain.b");
me.chain.b["->"]("chain.c");
me.chain.c.value(42);

me("chain.a.value")   // 42 — resolved transitively
me("chain.a")          // { __ptr: "chain.b" } — direct read stops at the first hop
```

A pointer chain composes without you writing the composition yourself. `a -> b -> c` behaves as `a -> c` for any suffix you read through it — but a *direct* read of `a` stays a pointer marker, never the transitive value. That asymmetry is [Axiom A4](./Axioms.html) for a single hop; this page verifies it holds identically for chains, self-references, and cycles.

---

## What This Doc Covers

| Contract | What it means |
|---|---|
| Chain composition | `a -> b -> c`, reading `a.value` resolves through `c` |
| Direct vs. traverse | Reading `a` alone returns `{__ptr}`; reading `a.anything` follows it |
| Self-pointer | `a -> a` is not identity — it fails closed |
| 2-node cycle | `a -> b`, `b -> a` fails closed without throwing |
| Fuel is local | Chains well over 8 hops still resolve |
| Cycle detection | Cycles of any length fail closed — no stack overflow |

---

## Step 1: Composition

```ts
me.chain.a["->"]("chain.b");
me.chain.b["->"]("chain.c");
me.chain.c.value(42);

me("chain.a.value")  // 42
me("chain.b.value")  // 42
```

Nobody declared `chain.a -> chain.c` directly. The kernel doesn't need that edge to exist — it follows `a -> b`, then `b -> c`, and the suffix `.value` rides along at every hop.

## Step 2: A direct read stays a pointer marker

```ts
me("chain.a")   // { __ptr: "chain.b" }
```

Stopping resolution exactly at the pointer's own path never transitively resolves it, no matter how many hops the chain beneath it has.

## Step 3: A self-pointer is not identity

```ts
me.loop.a["->"]("loop.a");

me("loop.a")         // { __ptr: "loop.a" }
me("loop.a.value")   // undefined
```

A pointer that targets itself does not behave like "no pointer at all." It fails closed — `undefined` — without hanging.

## Step 4: A 2-node cycle fails closed too

```ts
me.cyc2.a["->"]("cyc2.b");
me.cyc2.b["->"]("cyc2.a");

me("cyc2.a.value")   // undefined
me("cyc2.b.value")   // undefined
```

Both directions fail closed, cleanly, with no exception thrown.

## Step 5: Fuel is a local budget, not a global chain-length limit

```ts
// 12 pointers deep — n0 -> n1 -> ... -> n12
me("n0.value")   // still resolves correctly
```

The resolver's internal hop budget (`maxHops` in `resolveIndexPointerPath`) is consumed and re-armed as resolution recurses. A straight, acyclic chain well past that budget still resolves — the budget is a per-call safety valve, not a ceiling on how deep a chain of references can go.

---

## Step 6: Cycles of any length fail closed

```ts
me.cyc3.a["->"]("cyc3.b");
me.cyc3.b["->"]("cyc3.c");
me.cyc3.c["->"]("cyc3.a");

me("cyc3.a.value")   // undefined
```

Earlier, only even-length cycles reliably failed closed: with an 8-hop internal budget, the resolver happened to land back on the exact original path for a 2-node cycle — an accident of parity, not a designed guarantee. A 3-node cycle never landed back on the original path within one internal pass (8 mod 3 ≠ 0), so the resolver recursed externally instead, re-arming a fresh 8-hop budget on every recursive call with no memory of edges already followed — and the recursion didn't terminate on its own; the JavaScript call stack did.

The resolver now tracks, within a single bounded pass, which pointer edges it has already followed. Redirecting through the same edge twice — which is exactly what any cycle does, regardless of its length — is detected and stopped immediately:

```ts
// 5-node and 7-node cycles fail closed the same way
me("a.value")   // undefined, no throw, any cycle length
```

This holds for cycles reached directly and for a tail that leads into one (`x -> a -> b -> c -> a` reading `x.value`).

---

## Executable Proof

Every contract on this page is a real test against the real kernel — no mock:

```bash
node tests/contracts/pointer-category.contract.test.mjs
```

Or as part of the full contract suite:

```bash
npm run test:contracts
```

Source: [`tests/contracts/pointer-category.contract.test.mjs`](https://github.com/neurons-me/.me/blob/main/Typescript/tests/contracts/pointer-category.contract.test.mjs)

---

## The Big Idea

A pointer chain isn't a special code path bolted onto single-hop pointers — the same suffix-preserving substitution just gets applied again for each edge. That's why composition, self-pointers, and cycles of any length all fall out of one mechanism instead of needing separate handling: the resolver only needs to remember which edges it has already followed in the current pass, and a cycle is nothing more than an edge asked to redirect twice.

---
