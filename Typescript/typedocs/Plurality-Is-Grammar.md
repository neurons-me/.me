# Plurality Is Grammar

`[]` is not a data type in `.me`. It is grammar — the plural form, the same category of thing as
`.` (hierarchy) and `()` (execution). `Whatever[]` does not declare an array, a set, a list, or a
buffer. It declares that `Whatever` has members. What kind of plural it is — bounded or unbounded,
ordered or not, evicting or accumulating — is a separate question, answered by constraints on top
of the plural, not by naming a category.

This distinction matters because `.me` is forms, not language (see
[Syntax](./Syntax.md)). A path like `Whatever[]` should mean the same thing whether the members
are shop items, sidebar themes, sensor readings, or HTTP requests — `.me` never needs to know which.
The moment a plural's meaning becomes `kind: "rolling-buffer"` or `kind: "grid"`, `.me` has stopped
describing a shape and started describing a product category. That's a framework decision, and it
belongs one layer up, in whatever interprets the plural — not in the kernel.

---

## 1. `[]` already means "has members"

This isn't new syntax — `.me` already reads `[]` as addressing or selecting members of a plural
(see [Syntax §4](./Syntax.md#4-selector-syntax)):

```ts
me.Whatever[1].name("first");
me.Whatever[2].name("second");
me("Whatever[1..2].name");        // { "1": "first", "2": "second" }
me("Whatever[i]");                 // broadcast across members
me("Whatever[some_field >= 10]");  // filter
```

What's missing today is a way to say *what kind of plural this is* — without inventing a named
category to say it. `Whatever[]` on its own is already the right grammar for "this has members."
The gap is describing the plural's own shape, not its members' shape.

## 2. Constraints, not categories

The wrong shape for a description is a named product category:

```ts
Whatever[].kind = "rolling-buffer"   // ✗ — names an implementation, not a form
```

That reads as an API choice — a word from some framework's vocabulary, not a property `Whatever[]`
actually has. The right shape is an algebraic constraint over the plural itself:

```ts
|Whatever[]| <= 128                       // cardinality — bounded, not "a buffer"
Whatever[n].slot = n mod 128              // member placement, as a function of index
Whatever[a] before Whatever[b] = t(a) < t(b)   // ordering, as a relation
```

None of these name a data structure. They state true-or-false, computable facts about the plural:
how many members can exist at once, where a given member lives, how two members compare. A runtime
that reads these constraints can derive "oh, this behaves like a ring buffer" — but `.me` itself
never says the word.

## 3. Description is `.me`'s job today. Enforcement isn't — yet.

`.me` can hold a constraint. It does not evaluate whether every write obeys it. Writing a 129th
member into a plural constrained to `<= 128` does not fail at the kernel — `.me` has no concept of
"this plural" as an enforced unit, only of paths and the memories written to them. The constraint
is legible (something can read it and reason about it), not enforced (nothing makes it true by
itself). This section describes that current state. See [§5](#_5-next-step-kernel-governed-plurality-not-implemented-yet)
for why that split isn't necessarily permanent.

That split is deliberate, and mirrors [Operators](./Operators.md): `.me` gives structure real
DSL-level status (`_`, `~`, `=`, `?`, `-`, selectors), but what a given operator *does* with a
plural's constraints is up to the code holding the kernel, not the kernel itself. Two distinct
jobs:

- **Description** — `.me`-native, portable, human/framework-agnostic. Lives in the semantic tree
  itself, next to the plural it describes.
- **Interpretation** — owned by whatever consumes the description. A GUI reads a plural's
  constraints and decides how to render it (grid, list, timeline). A daemon reads the same
  constraints and decides how to operate it (evict the oldest member past capacity, reject a write
  that would violate an ordering constraint). `.me` supplies neither renderer nor operator — only
  the shape both can agree on.

## 4. Worked example

This is the case that surfaced the question: modeling per-port HTTP request handling in netget as
`.me` paths, without turning every request into permanent hash-chained memory (`.me`'s memory log
is append-only — see [Memory](./Memory.md) — so an *unconstrained* plural growing on every request
would grow forever, which is a real cost, not a style objection).

```ts
me.netget.port[80].Whatever[]                    // this path has members
me.netget.port[80]["|Whatever[]|<="](128);        // bounded — at most 128 live members
me.netget.port[80].Whatever["="]("slot", "n % 128");        // placement
me.netget.port[80].Whatever["="]("order", "timestamp");      // ordering
```

netget is the first interpreter of this shape, not its owner. Its daemon reads the cardinality and
slot constraints and does the actual work — writing new requests into the computed slot, evicting
whatever occupied that slot before. The Inspector reads the same constraints and can show "this is
a bounded plural, currently N/128" without knowing anything about HTTP or ports. Nothing about the
shape (`Whatever[]`, `|...| <= 128`, `slot = n % 128`) mentions netget, requests, or ports — those
only appear in the path prefix (`netget.port[80]`), which is just namespacing, the same as `shop.`
or `wallet.` anywhere else in `.me`.

This convention is real pressure toward a native kernel primitive, not just a hypothetical one —
see §5.

## 5. Next Step: Kernel-Governed Plurality (not implemented yet)

Everything above describes the current state honestly: `.me` can express a plural's shape, but
nothing in the kernel enforces it. That split is real today. It isn't necessarily where this
settles.

`.me` already treats several symbols as *active* — not just path segments, but operators the kernel
itself interprets and acts on: `_` scopes a secret, `=` derives a value, `-` tombstones a member,
`?` collects across paths, `@` establishes identity (see [Operators](./Operators.md)). None of those
are "just metadata something else has to obey" — the kernel does the work when it sees them. `[]`
selecting existing members already lives in that same active-operator family, on the read side. The
natural next step is for `[]` to be active on the write side too: not just "select members" but
"insert a member, governed by the plural's own declared shape."

Concretely, the shift is from this:

```ts
// external runtime computes the rule itself — it IS the collection
const slot = seq % capacity;
me.netget.port[80].request.items[slot](summary);
me.netget.port[80].request.seq(seq);
```

to this:

```ts
// the plural's shape is declared once, on the space itself
me.netget.port[80].request[]
me.netget.port[80].request["|[]|<="](128);
me.netget.port[80].request["="]("slot", "n mod 128");
me.netget.port[80].request["="]("order", "timestamp");

// the runtime only delivers facts — it does not implement the collection
me.netget.port[80].request[](event);
me.netget.port[80].request[](event);
```

In the second form, netget never computes a slot, never decides what gets evicted, never maintains
a buffer. It hands `.me` one fact at a time. The kernel — which already holds the plural's declared
cardinality, slotting, and ordering — decides where that fact lands, what it displaces, and whether
a given member is still live. Netget becomes a sensor, not an implementer:

```txt
nginx/openresty -> netget daemon (reads the request, forms a summary)
                -> me.netget.port[80].request[](summary)
                -> .me applies the plural's own declared shape
                -> GUI/Inspector reads the live view
```

This is a genuine kernel change, not a documentation exercise — it reaches the same write path
(`postulate()`, see [Proxy Calls](./Proxy-Calls.md)) every `.me` write already goes through, for
every consumer, not just netget. It deserves its own design pass and its own tests before touching
that code, deliberately kept separate from this doc and from netget's own proof of concept.
**Not implemented as of this writing.** netget's per-port request plural is the first real pressure
that surfaced the need — the reason to design this well, not the reason to design it narrowly for
netget's sake.

## Summary

- `[]` is `.me`'s plural grammar — it means "has members," nothing more specific.
- A plural's shape is described with algebraic constraints (cardinality, placement, order), not
  named categories (`kind: "..."`).
- Today, `.me` holds and exposes these constraints but does not enforce them — that's the job of
  whatever runtime interprets a given plural (GUI, a daemon, or otherwise).
- The same shape must work unmodified across unrelated domains — if a description only makes sense
  for one product, it isn't a `.me` shape yet, it's still that product's API.
- The target design (§5, not implemented yet) makes `[]` an active kernel operator on the write
  side too, the same family as `_`/`=`/`-`/`?`/`@` — a runtime delivers facts, `.me` governs
  membership, slotting, eviction, and liveness itself.

## Related Pages

- [Syntax](./Syntax.md) — where `[]` selectors, ranges, and filters are already defined.
- [Algebra of Contexts](./Algebra-of-Contexts.md) — the set-law foundation this extends.
- [Proxy Calls](./Proxy-Calls.md) — how `[]` and operators reach the runtime through the proxy surface.
- [Operators](./Operators.md) — the existing operator DSL this follows the same shape-not-category discipline as.
- [La Forma Escrita En Memoria](./es/La%20Forma%20Escrita%20En%20Memoria.md) (Spanish) — what §5's split means for persistence: today a plural's shape is *descriptive* memory (rehydrated, not obeyed); kernel-governed plurality would make it *active* memory, the same way a `=` derivation is already active today.
