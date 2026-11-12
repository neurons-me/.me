---
layout: gui-doc
title: "me.whatever(what)"
description: "How a path is written and read in this.me 4.2.1: me.a.b(value) declares, me(\"a.b\") reads, chaining, bracket indexes, which names are kernel methods, and why me.a.b() with no argument is not a read. From the kernel source."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/me-whatever-what.html
permalink: /docs/me-whatever-what.html
crumb: me.whatever(what)
image: https://neurons-me.github.io/.me/docs/assets/paths-og.jpg
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=2
  - /assets/paths-live/paths-live.js?v=6
view_content_name: "Doc - me.whatever(what)"
view_content_category: "Docs"
---

# 𓂀 me.whatever(what)

Writing with `me.a.b(value)`, reading with `me("a.b")`.

> Every property access on `me` extends a path. Calling it with a value declares; calling the root with the path string reads.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Source: [`createProxy` in proxy.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/proxy.ts#L256-L303), [`handleCall` in handleCall.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/handleCall.ts#L87-L156), [`postulate` in core-write.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/core-write.ts#L983).
{: .doc-kernel-more}

## Write and read

```ts
import { ME } from "this.me";
const me = new ME() as any;

me.colony.ants.workers[1].carry(3);   // write: colony.ants.workers.1.carry = 3
me("colony.ants.workers.1.carry");    // read → 3
me("colony.ants.workers[1].carry");   // read → 3 (same path)
```
{: .me-run}

- `me.a.b` builds the path `["a", "b"]`; nothing is read or written until it is called ([createProxy](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/proxy.ts#L256-L303)).
- `me.a.b(value)` declares `value` at `a.b` (`postulate(path, value)`), recomputes what depends on it, and returns a proxy on the same path, so calls chain.
- `me("a.b")` reads. At the root, a single string that is a dotted path, a single label, or starts with `_`, `~` or `@` is routed to the read ([handleCall](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/handleCall.ts#L88-L111)). `workers[1]` and `workers.1` name the same segment.

A call with no argument is not a read: `me.a.b()` writes `undefined` at `a.b` ([handleCall.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/handleCall.ts#L141-L155)). To read, always use `me("a.b")`.

## Chaining

```ts
me.colony.chambers.nursery("warm").depth(4);   // nursery = "warm", then nursery.depth = 4
me("colony.chambers.nursery");                 // → "warm"
me("colony.chambers.nursery.depth");           // → 4
```
{: .me-run}

A write returns a proxy on the path it wrote (an operator leaf returns its scope instead), so the next segment continues from there.

A path can also point to another path. Reads go through the pointer ([more on pointers](./Pointer-Composition.html)):

```ts
me.colony.ants.workers[1].home["->"]("colony.chambers.nursery");
me("colony.ants.workers.1.home");              // → { "__ptr": "colony.chambers.nursery" }
me("colony.ants.workers.1.home.depth");        // → 4, read through the pointer
```
{: .me-run}

## Derived values

```ts
me.colony.pantry.seeds(40);
me.colony.pantry.honey(12);
me.colony["="]("food", "pantry.seeds + pantry.honey");
me("colony.food");                             // → 52
me.colony.pantry.seeds(45);                    // more seeds arrive
me("colony.food");                             // → 57, recomputed
```
{: .me-run}

`["="]` declares a formula on a path; reading it is the same `me(path)`, and it follows its inputs.

{% include paths-figure.html %}

## Why a path has its value

```ts
me.explain("colony.food");                     // value, formula, inputs and the last wave
```
{: .me-run}

`me.explain(path)` is a kernel member, not a path: it returns the value with the formula, the inputs it read and the wave that last recomputed it (see [`me.explain()`](./Explain.html)).

## Names that are not paths

The proxy first checks whether the property exists on the kernel instance ([Proxy calls](https://neurons-me.github.io/.me/Typescript/typedocs/Proxy-Calls.html "TypeScript docs · source: proxy.ts L285–295"), source: [proxy.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/proxy.ts#L285-L295)): if it does, you get that member, not a path. Public examples: `me.explain`, `me.inspect`, `me.execute`, `me.exportSnapshot`, `me.hydrate`, `me.setRecomputeMode`, `me.getRecomputeMode`, `me.prove`, `me.learn`. Inherited object names (`toString`, `constructor`) are also members. `me["!"]` enters the runtime plane.

Any other name is a path.

Rust has no proxy: members are methods on `Kernel` and a path is always an argument, so a path can never be mistaken for a member. Write with `kernel.postulate("a.b", v)`, read with `kernel.read("a.b")`, explain with `kernel.explain("a.b")`; strings become paths through `IntoPath` ([Rust API](https://neurons-me.github.io/.me/Rust/docs/API.html#paths-and-plural-selectors "Rust docs · source: path.rs L118–145, mod.rs L633–858 at rust-v0.3.3"), source: [path.rs](https://github.com/neurons-me/.me/blob/rust-v0.3.3/Rust/src/kernel/path.rs#L118-L145)).

## Root calls

| Call | What it does |
|---|---|
| `me("a.b")` | Reads the path. |
| `me()` | Returns the root proxy. |
| `me("ana", "luna")` | Two strings, the first a bare label: seeds the identity (who + secret). |
| `me(expression)` | Anything else: a root postulate. |

## See also

[Robots That Understand Context](https://neurons-me.github.io/robots/) · [Ant City](https://neurons-me.github.io/.me/Demos/SmartCities/AntCity/) (the colony as a live demo) · [Primitives](./Primitives.html) (the two verbs: declare and resolve) · [me:// URI grammar](./me-uri.html) · [Syntax](./Syntax.html) · [Axioms](./Axioms.html) (A-struct-0: one callable, chainable value)
