---
layout: gui-doc
title: "The Primitives of .me"
description: "The vocabulary .me is built from: distinction, the root primitive me, and the two verbs, declare and resolve."
image: https://neurons-me.github.io/.me/docs/assets/card-primitives.webp
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
crumb: Primitives
view_content_name: "Doc - The Primitives of .me"
view_content_category: "Docs"
---


# 𓂀 The Primitives of .me

{% include primitives-figure.html %}

Primitives are the vocabulary `.me` is built from: the symbols you write. [Axioms](./Axioms.html) are the guarantees the kernel keeps about them. `_` is a primitive; "a secret scope's root is invisible while its leaves stay readable" is the axiom built on it (A0/A2).

## Distinction: the primitive beneath .me

> If you cannot differentiate A from not-A, there is nothing.

[The Axiom of Distinction](https://suign.github.io/AxiomOfDistinction.html) takes distinction as the minimal condition for information. A distinction implies two exclusive states, and the transition between them is movement. In `.me` this is literal: a path is either declared or resolved, and a secret scope is a distinction in what the public view contains:

```ts
me.profile.name("Ana");
me.wallet["_"]("vault-key");
me.wallet.balance(500);
me("wallet");          // undefined
me.inspect().index;
// { "profile.name": "Ana" }
me("wallet.balance");  // 500
```

The index has no `wallet` entry: the branch is not listed in the public index at all, rather than listed and locked. A leaf is still read by its exact path. Run on this.me 4.2.1. See also [Encrypted Audiences](https://suign.github.io/EncryptedAudiences.html) and [Ontology of Identity](https://suign.github.io/OntologyOfIdentity.html).

## The Root Primitive

```text
me
```

One callable, infinitely chainable value. Everything else acts on `me` or on a path beneath it.

## The Two Verbs

```text
Declare meaning
Resolve meaning
```

Declaring is calling a path with a value. Resolving is reading a path.

```ts
me.profile.name("Abella");   // declare
me("profile.name");          // resolve
```

## See also

- [.me Operators](./Operators.html): `@`, `_`, `~`, `__` / `->`, `=`, `?`, `-`, one example each.
- [.me Syntax](./Syntax.html): `.`, `[]` and `()`, selectors, any-language names.
- [me.whatever(what)](./me-whatever-what.html): how a path is written and read, and why `me.a.b()` is not a read.
- [What is .me?](./me.html): the identity primitive and the self-semantic runtime.
- [Axioms](./Axioms.html)

---
