---
layout: gui-doc
title: ".me Operators"
description: "The operators of this.me 4.2.1 in one table: @ identity, _ secret scope, ~ noise reset, __ / -> pointer, = derivation, ? query, - remove. One example each, run on 4.2.1, with a link to the page that covers it."
image: https://neurons-me.github.io/.me/docs/assets/card-operators.webp
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
crumb: Operators
view_content_name: "Doc - .me Operators"
view_content_category: "Docs"
---

# .me Operators

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Each example ran on 4.2.1 in a fresh `new ME()`; the result is what it returned.
{: .doc-kernel-more}

An operator is called as a bracketed key on a path: `me.path["op"](arg)`. Selectors (`[i]`, filters, ranges, `x[]`) are path syntax, not operators: see [.me Syntax](./Syntax.html#selectors-). Collection aggregates `x[]` (count) and `x[].f` (sum) are path syntax too: see [Aggregates](./Aggregates.html).

| Operator | Name | Example | Result on 4.2.1 | Details |
|---|---|---|---|---|
| `@` | Identity | `me["@"]("Abella"); me.inspect({ last: 1 }).memories[0].operator` | `"@"` | [Axioms A1](./Axioms.html#a1--identity-normalization-) |
| `_` | Secret scope | `me.wallet["_"]("vault-key"); me.wallet.balance(500); me("wallet"); me("wallet.balance")` | `undefined`, `500` | [Axioms A0, A2](./Axioms.html#a2--path-bound-secret-scopes-_) · [Identity-Bound Secrets](https://neurons-me.github.io/.me/Typescript/typedocs/Identity-Bound-Secrets.html) |
| `~` | Noise reset | `me.wallet["_"]("alpha"); me.wallet.secretA("A"); me.wallet["~"]("beta-seed"); me.wallet.secretB("B"); me("wallet.secretA"); me("wallet.secretB")` | `undefined`, `"B"` | [Axioms A3](./Axioms.html#a3--noise-reset-) |
| `__` / `->` | Pointer | `me.inventory.stock(900); me.dashboard.card["->"]("inventory"); me("dashboard.card"); me("dashboard.card.stock")` | `{ "__ptr": "inventory" }`, `900` | [Pointer Composition](./Pointer-Composition.html) · [Axioms A4](./Axioms.html#a4--structural-pointers-__---) |
| `=` | Derivation | `me.order.subtotal(100); me.order.tax(16); me.order["="]("total", "subtotal + tax"); me("order.total")` | `116` | [me.explain(path)](./Explain.html) · [What is O(k)?](./O-k.html) |
| `?` | Query | `me.user.name("Ana"); me.user.age(22); me.report["?"](["user.name", "user.age"], (n, a) => n + ":" + a); me("report")` | `"Ana:22"` (recorded as a `"?"` memory event) | [Axioms A5](./Axioms.html#a5--query-as-memory-event-) |
| `-` | Tombstone remove | `me.temp.value("to-delete"); me.temp["-"]("value"); me("temp.value")` | `undefined` (recorded as a `"-"` memory event) | [Axioms A6](./Axioms.html#a6--tombstone-remove--) |

`__` and `->` are the same operator; both return the same results above.

## See also

- [.me Syntax](./Syntax.html): paths, selectors and the call forms these operators use.
- [Primitives](./Primitives.html): `me` and the two verbs.
- [Axioms](./Axioms.html): the guarantees the kernel keeps for each operator.
- [Operators & Logic (TypeScript docs)](https://neurons-me.github.io/.me/Typescript/typedocs/Operators.html)
