---
layout: readme
title: The Primitives of .me
---


# 𓂀 The Primitives of .me

**.me** is a declarative language. Everything you can write in it is built from a small, irreducible set of symbols — its primitives. Where [Axioms](./Axioms.html) describe the invariants the kernel guarantees, Primitives describe the vocabulary the kernel is built from: the symbols you actually write, what they do, and what they execute — the same inherent logic as `true`/`false`, `and`/`or`. Operators whose meaning is computable simply because of what they natively are.

## The Root Primitive

```text
me
```

One callable, infinitely chainable value. Every other primitive is a way of acting on `me` or on a path beneath it.

## The Two Verbs

```text
Declare meaning
Resolve meaning
```

Declaring is calling a path with a value. Resolving is calling a path without one, or querying it.

```ts
me.profile.name("Abella");   // declare
me("profile.name");          // resolve
```

## The Operator Primitives

| Symbol | Name | Declares |
|---|---|---|
| `@` | Identity | Binds a normalized identity claim to a path. `me["@"]("jabellae")` |
| `_` | Secret scope | Marks a path as structurally stealth — its root becomes invisible, its leaves remain traversable. `me.wallet["_"]("key")` |
| `~` | Noise reset | Cuts secret derivation at a chosen boundary, making prior secrets discontinuous. `me.wallet["~"]("noise")` |
| `__` / `->` | Structural pointer | A lightweight reference that dereferences automatically when traversed. `me.profile.card["__"]("wallet")` |
| `?` | Query | Runs a query or calculation and records it as a first-class memory event. `me.profile["?"]("name")` |
| `-` | Tombstone remove | Deletes a value in a way that is auditable and irreversible at read time. `me.wallet.hidden["-"]("notes")` |

## Why Primitives, Not Just Rules

A primitive is a piece of grammar — it can be described without proving anything about it. An [Axiom](./Axioms.html) is a guarantee the kernel runtime upholds *about* a primitive, backed by kernel evidence and an executable proof.

`_` is a primitive. "A secret scope's root is always invisible while its leaves remain readable" is the axiom built on top of it (A0/A2).

## Self-Description

Because the runtime of `.me` is written in the same semantic model it interprets, these primitives are not just user-facing syntax — they are also how the kernel describes its own behavior internally. This is what makes `.me` *self-semantic*: the language can describe itself using its own primitives.

---
