---
layout: gui-doc
title: ".me Syntax"
description: "The syntax of this.me 4.2.1: dot builds the path, [] selects members, () writes, reads or applies an operator. Names are labels in any language. Every example on this page was run against this.me 4.2.1."
image: https://neurons-me.github.io/.me/docs/assets/card-syntax-me.webp
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
crumb: Syntax
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=2
view_content_name: "Doc - .me Syntax"
view_content_category: "Docs"
---

# .me Syntax

> A path is an address, a call is an operation on it. Meaning comes from the structure, not from the words.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Every example below was run against the published 4.2.1 build; the output shown is what it returned.
{: .doc-kernel-more}

How a single path is written and read in detail: [me.whatever(what)](./me-whatever-what.html).

## Algebra first

```ts
me.path.to.node(value)   // write
me("path.to.node")       // read
```

The names are any symbols you choose:

```ts
me.alpha.beta.gamma(10);
me("alpha.beta.gamma");          // 10

me.ventas.clientes.total(10);
me("ventas.clientes.total");     // 10

me.売上.顧客.合計(10);
me("売上.顧客.合計");              // 10
```
{: .me-run}

Same algebra, different vocabulary.

## Path construction

| Symbol | Role |
|---|---|
| `.` | Descends one level: creates hierarchy. |
| `[]` | Addresses indexed or selected members. |
| `()` | Executes: a write with a value, a read on the root, or an operator. |

```ts
me.user.name("Ana");
me.user.age(22);
me("user.name");          // "Ana"
me("user.age");           // 22

me.products[1].name("Keyboard");
me.products[1].price(80);
me("products[1].name");   // "Keyboard"
me("products[1].price");  // 80
```
{: .me-run}

## Any language

The same derivation, written with English and Spanish names:

```ts
me.shop.items[1].price(100);
me.shop.tax_rate(0.16);
me.shop.items[1]["="]("total", "price + (price * shop.tax_rate)");
me("shop.items[1].total");          // 116

me.tienda.articulos[1].precio(100);
me.tienda.impuesto(0.16);
me.tienda.articulos[1]["="]("total", "precio + (precio * tienda.impuesto)");
me("tienda.articulos[1].total");    // 116
```
{: .me-run}

Paths written with non-Latin names (`me.売上.顧客.合計`) are written and read as above. In 4.2.1, formula text inside `["="]` that names such paths does not evaluate: `me.店舗.商品[1]["="]("合計", "価格 + (価格 * 店舗.税率)")` leaves `合計` `undefined`, and `explain()` reports `evaluation-failed`.

## Selectors `[]`

`[]` addresses members that already exist below. What kind of plural a space is (bounded, ordered, evicting) is a separate concern: see [Plurality Is Grammar](https://neurons-me.github.io/.me/Typescript/typedocs/Plurality-Is-Grammar.html).

```ts
me.fleet.trucks[1].fuel(100);
me.fleet.trucks[2].fuel(200);
me.fleet.trucks[3].fuel(400);
me.price_per_liter(2);
me.fleet["trucks[i]"]["="]("cost", "fuel * price_per_liter");   // broadcast [i]
```
{: .me-run}

| Form | Example | Returns |
|---|---|---|
| Fixed index | `me("fleet.trucks[2].fuel")` | `200` |
| Broadcast `[i]` | `me("fleet.trucks[2].cost")` | `400` |
| Logical filter | `me("fleet.trucks[fuel >= 200].fuel")` | `{ "2": 200, "3": 400 }` |
| Range | `me("fleet.trucks[1..2].fuel")` | `{ "1": 100, "2": 200 }` |
| Multi-select | `me("fleet.trucks[[1,3]].fuel")` | `{ "1": 100, "3": 400 }` |
| Transform | `me("fleet.trucks[x => x.fuel * 0.5]")` | `{ "1": 50, "2": 100, "3": 200 }` |

### Collection aggregates: `x[]` and `x[].f`

An empty `[]` reads an aggregate over the members of a collection: `x[]` is the count, `x[].f` the exact sum of field `f`. Both work in `me()`, `explain()` and formula text.

```ts
me("fleet.trucks[]");                                   // 3
me("fleet.trucks[].fuel");                              // 700
me.fleet["="]("fuelX2", "fleet.trucks[].fuel * 2");     // collection path from the root
me("fleet.fuelX2");                                     // 1400
```
{: .me-run}

- Computed over the public view (what `me.as(null)` sees), for every caller including the owner.
- A member without the field, or with a non-numeric value, makes the sum `undefined` (never a partial sum). An empty collection is `undefined`, not `0`.
- The collection is bound from the root, even inside a scoped formula: write `fleet.trucks[].fuel`, not `trucks[].fuel`. Per member, use `[i]`.
- The literal key `[]` is written with a quoted selector: `z["[]"].w`.

Examples, `explain()` output, booleans, limitations and cost: [Collection aggregates](./Aggregates.html).

## Operators

An operator is a bracketed key called on a path, such as `me.order["="]("total", "subtotal + tax")` or `me.wallet["_"]("key")`. The full set (`@`, `_`, `~`, `__` / `->`, `=`, `?`, `-`), one verified example each: [.me Operators](./Operators.html).

## Small scenarios

```ts
me.products[1].price(1000);
me.products[1].discount(100);
me.products[1]["="]("final", "price - discount");
me("products[1].final");            // 900

me.routes[1].distance_km(120);
me.routes[1].fuel_l(12);
me.routes[1]["="]("efficiency", "distance_km / fuel_l");
me("routes[1].efficiency");         // 10

me.students[1].math(90);
me.students[1].science(80);
me.students[1]["="]("avg", "(math + science) / 2");
me("students[1].avg");              // 85

me.sensors[1].temp(21);
me.sensors[2].temp(30);
me("sensors[temp >= 25].temp");     // { "2": 30 }
```
{: .me-run}

## See also

- [me.whatever(what)](./me-whatever-what.html): how a path is written and read, and why `me.a.b()` is not a read.
- [me.explain(path)](./Explain.html): why a path has its value.
- [What is O(k)?](./O-k.html): what one write recomputes.
- [.me Operators](./Operators.html): every operator with one example.
- [Pointer Composition](./Pointer-Composition.html): pointers composed, cycles failing closed.
- [me:// URI grammar](./me-uri.html): the `me://` address scheme (namespace, surface, path).
[Plurality Is Grammar](https://neurons-me.github.io/.me/Typescript/typedocs/Plurality-Is-Grammar.html) · [Algebra of Contexts](https://neurons-me.github.io/.me/Typescript/typedocs/Algebra-of-Contexts.html) · [Proxy Calls](https://neurons-me.github.io/.me/Typescript/typedocs/Proxy-Calls.html)
