# Runtime Surface

`.me` has two public surfaces at the same time:

1. A class API
2. A callable proxy/DSL
3. A reflective runtime escape plane

That is why the generated API reference only shows part of the real runtime.

## 1. Class API

These are the explicit class members currently documented in the generated API:

- constructor
- `memories`
- `inspect()`
- `explain()`
- `exportSnapshot()`
- `importSnapshot()`
- `rehydrate()`
- `learn()`
- `replayMemories()`
- `setRecomputeMode()`
- `getRecomputeMode()`

You can browse them in:

- [API Overview](/api/)
- [ME Class](/api/classes/ME)

## 2. Callable Proxy API

The real day-to-day `.me` experience is not only class methods.

`new ME()` returns a proxy-backed runtime that supports:

```ts
const me = new ME();

me.profile.name("Ana");     // write through callable path
me("profile.name");         // read by semantic path
me.wallet["_"]("secret");   // operator call
me.items[1].price(10);      // indexed path
me.items["[i]"]["="]("taxed", "price * 1.16");
```

This proxy behavior is created in the constructor and backed by the internal proxy engine in `createProxy()`.

Meaning:

- property access builds semantic path
- bracket access selects operators or selectors
- calling `()` executes semantic behavior at that path

## 3. Reflective Runtime Escape

The runtime also exposes an explicit reflective plane through:

```ts
me["!"]
```

This is the alter ego of the kernel: not the semantic tree itself, but the runtime surface that describes and controls it.

Examples:

```ts
me["!"].inspect()
me["!"].explain("wallet.net")
me["!"].snapshot.export()
me["!"].snapshot.import(snapshot)
me["!"].memories.replay(memories)
me["!"].runtime.setRecomputeMode("lazy")
```

It also supports self-description:

```ts
me["!"].methods.inspect.docs
me["!"].methods.inspect.signature
```

## 4. Why the generated API feels incomplete

TypeDoc documents explicit exported class members well.

But the proxy/DSL surface is not a normal TypeScript class method list, so it does not show up naturally as:

- `me.profile.name(...)`
- `me("profile.name")`
- `me.wallet["_"](...)`

Those are runtime behaviors, not named class methods.

## 5. The practical model

Think of `.me` like this:

- class methods = debug, inspection, hydration, snapshots
- proxy calls = actual semantic language
- `me["!"]` = reflective runtime plane

If you want the language surface, read:

- [Proxy Calls](/Proxy-Calls)
- [Operators](/Operators)
- [Syntax](/Syntax)
