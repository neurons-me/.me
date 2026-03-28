# Proxy Calls

The core `.me` runtime is a callable proxy.

That means `me` is not only an object with methods. It is also a semantic execution surface.

## Mental Model

```ts
const me = new ME();
```

After construction:

- `me.foo.bar` builds a path
- `me.foo.bar(value)` writes
- `me("foo.bar")` reads
- `me.foo["="](...)` invokes an operator
- `me["!"]...` enters the reflective runtime plane

## Path Building

Property access extends the current semantic path:

```ts
me.profile.name
me.wallet.balance
me.users.ana.bio
```

Nothing is executed yet. The path is just being formed.

## Writes

Calling a path with a value writes semantic data:

```ts
me.profile.name("Ana");
me.profile.age(22);
me.wallet.balance(500);
```

## Reads

Calling the root proxy with a string path reads:

```ts
me("profile.name");
me("wallet.balance");
```

This is different from class methods like `inspect()` or `exportSnapshot()`.

## Operators

Operators are accessed through brackets:

```ts
me["@"]("jabellae");
me.wallet["_"]("vault-key");
me.wallet["~"]("new-noise");
me.report["?"](["a.b", "c.d"]);
me.total["="]("value", "subtotal + tax");
me.node["-"]();
```

This is part of the DSL surface, not the ordinary class API list.

## Runtime Escape

The special branch `me["!"]` is not semantic content.
It is the reflective runtime plane.

Examples:

```ts
me["!"].inspect()
me["!"].explain("profile.name")
me["!"].snapshot.export()
me["!"].memories.list()
me["!"].runtime.getRecomputeMode()
```

Think of it as:

- `me` -> semantic universe
- `me["!"]` -> kernel alter ego

## Selectors

Selectors also live in bracket syntax:

```ts
me.items[1].price(10);
me.items["[i]"]["="]("with_tax", "price * 1.16");
me("items[price > 100].price");
me("items[1..3].price");
```

## Why it matters

If you only look at the generated class API, `.me` looks like:

- snapshots
- replay
- inspect/explain

But the real language lives here:

- path building
- callable writes
- string-path reads
- operators
- selectors

So the runtime is really:

- **object API** for tooling and hydration
- **proxy API** for semantic programming
- **escape plane** for reflective runtime control

## Related Pages

- [Runtime Surface](/Runtime-Surface)
- [Operators](/Operators)
- [Syntax](/Syntax)
