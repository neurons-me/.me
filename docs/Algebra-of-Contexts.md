---
layout: gui-doc
title: "Algebra of Contexts"
description: "Spaces inside spaces: in this.me 4.2.1 a path is a space, a selector picks a subspace, [] counts its members, and a secret scope narrows who can read it. Topology (T), audience (A), capability (C) and path (P) as one space. Every example runs on npm this.me 4.2.1."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/Algebra-of-Contexts.html
permalink: /docs/Algebra-of-Contexts.html
crumb: algebra of contexts
image: https://neurons-me.github.io/.me/docs/assets/me-og.jpg
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=2
related:
  - Syntax.html
  - me-whatever-what.html
  - Explain.html
  - Axioms.html
  - https://neurons-me.github.io/digital-space-algebra/
view_content_name: "Doc - Algebra of Contexts"
view_content_category: "Docs"
---

# ⊇ Algebra of Contexts

Spaces inside spaces.

> A **space** is a region of meaning that can contain other spaces. Where it lives, who can read it and what may be done to it are properties of that same space, not three separate systems.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Theory: [Digital Space Algebra](https://neurons-me.github.io/digital-space-algebra/). Source map and tests: [TypeScript implementation](https://neurons-me.github.io/.me/Typescript/typedocs/Algebra-of-Contexts.html).
{: .doc-kernel-more}

## One space, four sets

| Set | Says | In the kernel |
|---|---|---|
| **P** path | which subspace | the path itself: `home.kitchen.light` |
| **A** audience | who can read it | a secret scope `["_"]`, enforced by encryption |
| **T** topology | where it lives | copies of the space (snapshots, devices); outside the kernel |
| **C** capability | what is allowed | granted outside the kernel (gateways); never inferred from A |

Not four ontologies: four views of one space.

## Space ⊇ subspace

A deeper path is a smaller region. Leaves hold values; a read names a leaf.

```ts
import { ME } from "this.me";
const me = new ME() as any;

me.home.kitchen.light("on");
me.home.kitchen.temp(21);
me("home.kitchen.light")   // "on"
me("home.kitchen")         // undefined (a region, not a leaf)
```
{: .me-run}

```txt
home.kitchen.light ⊆ home.kitchen ⊆ home
```

## Predicates select subspaces

Public, adult, cheap: adjectives are predicates, and a predicate selects a subspace. Name the field you want after the selector.

```ts
me.friends[1].age(17);
me.friends[2].age(34);
me.friends[3].age(21);
me("friends[age > 18].age")   // { "2": 34, "3": 21 }
me("friends[1..2].age")       // { "1": 17, "2": 34 }
```
{: .me-run}

## Plurality: `x[]` and `x[].f`

`[]` is grammar, not a data type: it says a space has members. `x[]` is how many; `x[].f` sums a field over them.

```ts
me("friends[]")       // 3
me("friends[].age")   // 72
```
{: .me-run}

```txt
friends[1] ⊆ friends[] ⊆ friends
```

## Anchored and derived shared spaces

A shared space (more than one reader) keeps its identity in one of two ways.

- **Anchored:** P is chosen once; A moves inside it. Members join and leave, the space stays where it is.
- **Derived:** P is computed from A itself, P = f(A). Change the members and the address changes; remove one and nothing resolves to the old space.

Anchored is what the kernel does today:

```ts
me.groups.family.members[1].name("ana");
me.groups.family.members[2].name("luis");
me("groups.family.members[]")   // 2
me.groups.family.members[3].name("sol");
me("groups.family.members[]")   // 3
```
{: .me-run}

Derived spaces have no kernel primitive. Their address form, `surface[a+b]` next to the anchored `group:name`, is set out in [NRP Chemistry](https://neurons-me.github.io/monad/Typescript/typedocs/architecture/nrp-chemistry.html).

## Encryption as membership

A secret scope does not move data to another universe. It narrows the readable audience of a space, here to `{self}`: the scope's root does not resolve, its leaves do for the owner, and a guest gets nothing.

```ts
me.wallet["_"]("vault-key");
me.wallet.hidden.note("private");
me.wallet.balance(500);
me("wallet")                  // undefined
me("wallet.hidden.note")      // "private"
me.as(null)("wallet.hidden.note");   // undefined (guest)
```
{: .me-run}

A value computed from the secret can be public; its secret input stays masked:

```ts
me["="]("budget", "wallet.balance * 0.1");
me("budget")                                  // 50
me.explain("budget").derivation.inputs[0]
// { path: "wallet.balance", value: "●●●●", origin: "stealth", masked: true, … }
```
{: .me-run}

Shared audiences are union and intersection over real identities: an OR audience opens for any member, an AND audience only for the whole coalition.

```txt
A = {me, ana}            readable by me ∪ ana
I_AB = I_A ∩ I_B         the identities in both
```

The OR/AND audience algebra is in the 4.2.1 source with its own tests, but it is not exported by the npm 4.2.1 package ([TypeScript implementation](https://neurons-me.github.io/.me/Typescript/typedocs/Algebra-of-Contexts.html)).

## T ⊥ A: copying is not reading

Topology and audience are orthogonal. Copy a space anywhere; the copy is no more readable than the original.

```ts
const copy = new ME();
copy.importSnapshot(me.exportSnapshot());
copy("home.kitchen.light")   // "on"
copy("wallet.hidden.note")   // undefined
copy("wallet")               // undefined
```

The snapshot carries the sealed branch, not its key: the exported JSON contains neither `"private"` nor `"vault-key"`.

## Namespaces: `me://`

A namespace names a space; a selector says which surface; the path names the subspace.

```ts
import { parseMeUri } from "this.me";

parseMeUri("me://suign.neurons.me[macbook]/profile.name");
// { href: "me://suign.neurons.me[surface:macbook]/profile.name",
//   namespace: "suign.neurons.me", selector: { kind: "surface", value: "surface:macbook" },
//   path: "profile.name" }

parseMeUri("me://suign.neurons.me[]/chat.general");
// { href: "me://suign.neurons.me[]/chat.general", selector: { kind: "fanout" }, path: "chat.general" }
```

Grammar: [me:// URI](./me-uri.html).

## TypeScript implementation

[Algebra of Contexts: source and tests](https://neurons-me.github.io/.me/Typescript/typedocs/Algebra-of-Contexts.html): where each part lives in the v4.2.1 source, the tests that prove it, and their results on npm 4.2.1.
{: .doc-axiom-test}
