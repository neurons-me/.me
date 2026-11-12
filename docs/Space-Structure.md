---
layout: gui-doc
title: "What Is the Mathematical Structure of a Space in .me?"
description: "Setting up the question properly: a prefix-closed tree of positions, resolution as a contextual relation R : P × Γ ⇀ M, addressability vs discoverability, the pointer root/suffix asymmetry, families and locality, and the two structures S = (P, ≤, Γ, M, R) and K = (S, π, Σ, H, D)."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/Space-Structure.html
permalink: /docs/Space-Structure.html
crumb: space structure
image: https://neurons-me.github.io/.me/docs/assets/me-og.jpg
related:
  - Is-Me-A-Category.html
  - Algebra-of-Contexts.html
  - Pointer-Composition.html
  - https://suign.github.io/Equations.html
view_content_name: "Doc - What Is the Mathematical Structure of a Space in .me?"
view_content_category: "Docs"
---

# ≤ What Is the Mathematical Structure of a Space in .me?

Setting up the question properly.

By Sui Gn. Originally published on Medium, Jul 25, 2026: [What Is the Mathematical Structure of a Space in .me?](https://medium.suign.com/what-is-the-mathematical-structure-of-a-space-in-me-6fc61a2b89d2) ⓘ
{: .doc-kernel}

Next in the series: [Is .me a Category?](./Is-Me-A-Category.html). Every formula on this page, in one glossary: [The Equations: Space Structure](https://suign.github.io/Equations.html#space-structure).
{: .doc-kernel-more}

A "space" in `.me` is not a set of key-value pairs — that description already fits a plain JavaScript object and explains none of the behavior worth formalizing: stealth roots that hide without deleting, pointers that dereference without duplicating, derivations that recompute only their dependents, reads that resolve differently depending on who is asking, and reads that resolve differently again depending on *how* they are asking. The central move of this essay is to stop treating "value" as a property a path holds, and start treating it as something a path *produces*, jointly, from where it sits, who is asking, and what kind of question is being asked.

```text
manifest(p | o, m, a) = x
```

not

```text
value(p) = v
```

That shift — from a fixed property to a contextual manifestation — is what lets one idea explain several behaviors that otherwise look like a list of unrelated features: a root that doesn't appear under enumeration, an exact leaf that is still directly reachable, a pointer that manifests as data when resolution stops at it and as a transition when resolution continues through it, a bracket selector that turns one position into an indexed family, and a forensic log that manifests events rather than current state. None of this yet proves that all of it reduces to one primitive. What it does show is a common axis — every mechanism below controls one dimension of how a semantic position manifests.

## The base structure: a prefix-closed tree of positions

`docs/me/Algebra-of-Contexts.md` states containment directly: `profile.contact.email ⊆ profile.contact ⊆ profile`. Written as an order:

```text
q ≤ p  ⟺  q is a descendant of p
```

so `profile.contact.email ≤ profile.contact ≤ profile` — deeper path, smaller region, matching the doc's own phrase "deeper path → smaller semantic region."

One correction is needed before calling this a tree: if only `profile.contact.email` was ever written, `profile` and `profile.contact` have no memory of their own — they were never the target of a write, only implied by one. So `P` needs to be defined as a closure, not as the literal set of paths that appear in the memory log:

```text
Let P_declared be the set of paths that were actually written.
Let P = PrefixClosure(P_declared).
```

Under descendant containment, `P` is a rooted, tree-shaped poset. This is not just a technical nicety — it matches how the kernel actually behaves: a path can be a meaningful position in the space (something you can descend into, something an ancestor-walk like `hasStealthBarrier` checks against) purely by virtue of being a prefix of something written, with no value of its own. The space exists structurally even where no leaf has been stored. `P_declared` is what the memory log records; `P` is what the space actually contains.

## Resolution as a contextual relation, not just observer-indexed

The earlier framing indexed resolution by observer and mode as if they were two entries in the same flat set. They aren't the same kind of thing. Observing directly, enumerating children, and reading the forensic log are all things an *observer chooses to do* — but a dereference is not chosen the same way; it's triggered by the shape of the path itself once resolution continues past a pointer. And the forensic log (`inspect()`, reading `_memories`) doesn't answer to the same authority as an ordinary read — it exposes hash-chained history a normal caller scope was never checked against.

So resolution context is better written as a triple:

```text
Γ = (o, m, a)
```

where `o` is the observer, `m` is the mode of observation, and `a` is the authority or capability under which the request is made. Resolution is then:

```text
R : P × Γ ⇀ M
```

where `M`, the space of manifestations, is a tagged union of genuinely different result shapes, not one uniform value type:

```text
M = Value + Pointer + Family + Children + History + {⊥}
```

Concretely, the modes that show up as distinct code paths — not as flags on one function, but as separate mechanisms — are:

- Direct read (`src/core.ts: readPath`), producing a `Value`, a `Pointer`, or `⊥`.
- Enumeration (`src/core-read.ts: collectChildrenForPrefix`, `me.ts: inspect()`), producing `Children` — a set that silently excludes anything inside a secret scope, since those writes were never registered in the public index.
- Traversal through a pointer (`src/core-index.ts: resolveIndexPointerPath`, recursing through `readPath`), producing the target's `Value`.
- Selection (`src/core-read.ts: evaluateSelectionPath` / `evaluateFilterPath`), producing a `Family` — an indexed collection, not a plain list.
- Forensic inspection (`me.ts: inspect()` reading `_memories`), producing `History` — under a different authority than an ordinary read, since it exposes the hash-chained log directly.

For an essay-level treatment, keeping these under one relation `R` is defensible as long as `M` is explicitly declared a tagged union rather than a single type — collapsing `inspect()` and an ordinary public read into "two equivalent modes" would understate that they answer to different authority, which is exactly the distinction `Γ`'s third component is there to preserve.

## Addressability and discoverability: real, but not unique to .me

Axiom **A0** in `tests/axioms.test.ts` states the behavior directly:

```ts
me.wallet["_"]("secret");
me.wallet.income(100);
```

```ts
console.log(me("wallet"));        // undefined
console.log(me("wallet.income")); // 100
```

The mechanism behind it is two separate code paths. `src/core-index.ts: applyMemoryToIndex` checks whether a write falls inside a secret scope and, if so, never adds it to the public `index` — that's what removes `wallet` from enumeration. `src/core.ts: readPath`'s branch-resolution block does not consult the public `index` at all for a secret-scoped path; it derives the effective scope secret and decrypts the branch chunk directly — reachable only if the exact path is already known. So: `E_o(wallet) = ∅`, while `R_o(wallet.income, direct) = 100`. You can resolve something you cannot discover by browsing from its root.

It's worth being precise about how novel this actually is, rather than overselling it. Other systems can reproduce the same *behavior* — row-level security, database views, unguessable identifiers, capability URLs, endpoints with no list operation. So the honest claim is not that SQL or REST cannot express this distinction; they can, through policies layered outside the data model. The honest claim is narrower: in `.me`, addressability and discoverability are distinct consequences of the *same* mechanism — the semantic path structure plus the secret-scope operator — rather than the product of separately-designed access-control machinery bolted on beside the data. Where an editorial flourish is useful, "a geometry of knowledge" captures the feel of it; where precision is the goal, the accurate description is an epistemic distinction between discoverability and addressability, produced natively by the path structure itself.

## Pointers: the root/suffix asymmetry, stated correctly

A pointer at `p` targeting `q` behaves asymmetrically, and the earlier law didn't separate the two cases cleanly enough. At the empty suffix, resolution stops at the pointer and returns it as data:

```text
R(p, o, direct) = Pointer(q)
```

For any non-empty suffix, resolution continues through the pointer, and this is a different mode — call it traversal — not the same "direct" mode applied further along:

```text
R(p.s, o, traverse) = R(q.s, o, direct),   for s ≠ ε
```

with the underlying substitution written explicitly as a function on paths:

```text
π[p,q](p.s) = q.s
```

This captures the asymmetry precisely: opaque at its own root, transparent along its extension — without implying that "direct" silently changes meaning depending on how long the path you wrote happens to be.

What continues to hold from checking the actual recursion: when `src/core.ts`'s `readPath` substitutes to a target path and that target still needs resolving, it recurses through `self.readPath` — `me.ts`'s wrapper, which re-runs the stealth check against the *new* path's ancestors under the *same* caller scope. So the observer is conserved by construction across the traversal, not by an assumed side-condition. What remains unverified: the pointer-chaining loop inside `resolveIndexPointerPath` is bounded (`maxHops = 8`) only for chains that resolve entirely within the flat public index; a chain that crosses into a secret branch instead proceeds through the outer, unbounded `self.readPath` recursion, with no cycle detection visible at that layer. That is an open question, not a settled bound.

## Multiplicity and locality, restated precisely

`[·]` still produces an indexed family, not a bare list — the index survives resolution:

```ts
me("shops[menu.isPremium == true].name")
// { 2: "Riverside", 3: "Station" }
```

```text
R*(p[φ], o) = ( i ↦ R(p.i, o, direct) )   for i ∈ I_φ
where I_φ = { i ∈ children(p) | φ(p.i, o) holds }
```

And derivation cost is a locality claim, not a constancy claim. `tests/Demos/Root_Fanout_100k.ts` documents `k = 100000` for a single mutation with that many real dependents — not constant, exactly as large as what actually depends on the change:

```text
T(Δp) = O(|Reach_D(p)| + C_eval)
```

`Reach_D(p)` is the support of the mutation — the set of derived paths transitively subscribed through `src/derivation.ts`'s `refSubscribers`. The invariant is that this cost is independent of `|P|`, the total size of the space, not that it is small in absolute terms.

## Two structures, not one

Rather than folding everything into a single tuple, it's cleaner to separate what a space *is* from what the `.me` kernel *adds* on top of it.

A semantic space:

```text
S = (P, ≤, Γ, M, R)
```

— positions, containment order, resolution contexts, manifestations, and the partial relation between them. This answers: what is a space? An ordered structure that manifests positions under resolution contexts.

The `.me` kernel enriches that space:

```text
K = (S, π, Σ, H, D)
```

— path substitutions (`π`, pointers), expansion to indexed families (`Σ`, selection), event-sourced history (`H`, the hash-chained memory log), and locally-scoped derivation causality (`D`, the dependency graph). This answers a different question: what is the `.me` kernel? That space, enriched with reference, multiplicity, history, and local derivation.

Keeping these separate matters, because it avoids defining "space" by enumerating every capability the implementation happens to have. A space is the order and the contextual resolution; everything else is structure carried on top of it.

## Where this leaves the closing claim

Not yet a modal semantics — that word carries a specific technical commitment: a formula language, modal operators, an accessibility relation between contexts, a satisfaction relation, and frame conditions that could in principle be characterized. None of that has been exhibited here. What has been shown is narrower and fully earned by the evidence above:

`.me` is a mode- and observer-indexed semantics of manifestation over an ordered set of semantic spaces. Its separation of addressability, discoverability, authority, and observation suggests a possible future modal or epistemic formalization, but that structure remains to be exhibited, not assumed.

What is settled, and what I'd keep as the real contribution of this piece: meaning at a position in `.me` is not a stored substance waiting to be read. It is a manifestation produced jointly by position, identity, authority, and mode of observation. `.me` is not a language that describes a space. It is the structure in which meaning takes shape at the moment it is resolved.

Source code: [neurons-me/.me](https://github.com/neurons-me/.me). Documentation: [neurons-me.github.io/.me](https://neurons-me.github.io/.me/).

## Read next

- [Is .me a Category? From Pointer Semantics to Categorical Structure](./Is-Me-A-Category.html): the sequel, which types pointer traversal as morphisms of a free category.
- [The Equations: Space Structure](https://suign.github.io/Equations.html#space-structure): every formula above, one line each.
- [Algebra of Contexts](./Algebra-of-Contexts.html): containment, `profile.contact.email ⊆ profile.contact ⊆ profile`, as running examples.
- Original on Medium: [What Is the Mathematical Structure of a Space in .me?](https://medium.suign.com/what-is-the-mathematical-structure-of-a-space-in-me-6fc61a2b89d2)
