# Runtime Surface — How the proxy magic works

### Callable Proxy / DSL (The Main Experience)

This is the **real day-to-day interface** of .me.

When you do `const me = new ME()`, you do not just get a normal class instance. You get a callable proxy that lets you interact with semantic paths directly:

```ts
import ME from "this.me";

const me = new ME();

me.profile.name("Ana");                    // write
me("profile.name");                        // read
me.wallet["_"]("secret");                  // secret operator
me.items[1].price(10);                     // indexed access
me.items["[i]"]["="]("taxed", "price * 1.16");   // derived logic
```

**How it works:**

- Property access (me.profile.name) → builds a semantic path
- Function call (me(...)) → executes at that path
- Bracket notation (me[...]) → used for operators and selectors

### 3. Reflective Runtime Plane (me["!"])

This is the **meta surface** — an escape hatch that gives you direct access to the underlying kernel:

```ts
me["!"].inspect()
me["!"].explain("wallet.balance")
me["!"].snapshot.export()
me["!"].runtime.setRecomputeMode("lazy")
```

> It allows advanced introspection and control over the runtime itself.


### Practical Mental Model
Think of .me as having three layers:

| Surface                        | Purpose                             | How you use it                |
| ------------------------------ | ----------------------------------- | ----------------------------- |
| **Class API**                  | Inspection, snapshots, debugging    | me.inspect(), me.explain()    |
| **Callable Proxy**             | Main semantic language              | me.profile.name(), me("path") |
| **Reflective Plane** (me["!"]) | Meta-control and deep introspection | me["!"].xxx                   |


### 1. Class API
These are the explicit methods and properties documented in the generated API:

- `constructor()`
- `memories`
- `execute()`
- `inspect()`
- `explain()`
- `exportSnapshot()`
- `importSnapshot()`
- `rehydrate()`
- `learn()`
- `replayMemories()`
- `setRecomputeMode()`
- `getRecomputeMode()`

You can explore them in:
- [API Overview](/api/)
- [ME Class](/api/classes/ME)

### Important Note

The generated API docs only cover the explicit class surface.
The proxy DSL and `me["!"]` runtime plane are guide-level behaviors built on top of that class API, so they are documented here instead of inside TypeDoc.
