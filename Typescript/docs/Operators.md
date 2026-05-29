# Operators & Logic in `.me`

This document explains how `.me` interprets:

- `()` calls for writes, reads, and operator invocations
- `[]` selectors for indexing, broadcast, filters, ranges, multi-select, and transforms
- kernel operators: `@`, `_`, `~`, `__`, `->`, `=`, `?`, `-`, `+`

## Mental Model

`new ME()` returns a callable proxy:

- Property access builds a semantic path: `me.wallet.balance`
- Calling `()` executes a semantic action at that path

Examples:

```ts
me.profile.name("Abella");      // write
me("profile.name");             // read by string path
me.wallet["_"]("secret-key");   // operator call on a path
```

## `()` Semantics

### 1. Write

```ts
me.a.b.c(123);
```

Writes `123` at path `a.b.c`.

### 2. Read

At root, `.me` applies a GET bias for string input:

```ts
me("a.b.c");      // dotted path
me("username");   // simple label
me("@jabellae");  // operator-prefixed string
```

### 3. Operator Call

```ts
me.path["="]("total", "price * qty");
me.path["?"](["a.b", "c.d"]);
me.path["-"]();
```

Behavior depends on the final operator token.

## `[]` Selector Semantics

### 1. Fixed key / index

```ts
me.items[1].price(10);
me("items[1].price"); // 10
```

### 2. Broadcast iterator `[i]`

```ts
me.items["[i]"]["="]("total", "price * qty");
```

Applies one rule across each existing member under `items`.

### 3. Logical filter

```ts
me("items[price > 100 && qty >= 2].price");
```

Returns only matching children.

### 4. Range

```ts
me("items[10..20].price");
```

Selects a contiguous numeric slice.

### 5. Multi-select

```ts
me("items[[1,3,8]].price");
```

Selects sparse keys explicitly.

### 6. Transform selector

```ts
me("items[x => x.price * 0.9]");
```

Computes a read-only projection per selected child.

## Operator Reference

### `@` Identity claim

```ts
me["@"]("jabellae");
me.profile["@"]("fleet.owner");
```

- Validates and normalizes the identity string
- Stores an identity marker at root or scoped path

### `_` Secret scope

```ts
me.wallet["_"]("my-secret");
me.wallet.balance(500);
```

- Declares a secret scope at `wallet`
- The scope root becomes stealth

```ts
me("wallet");         // undefined
me("wallet.balance"); // 500
```

### `~` Noise scope

```ts
me.wallet["~"]("new-seed");
```

Resets the inherited effective-secret chain below that scope.

### `__` / `->` Pointer

```ts
me.profile.card["->"]("wallet");
me("profile.card");         // { __ptr: "wallet" }
me("profile.card.balance"); // resolves through pointer
```

### `=` Derivation / assignment

String expression form:

```ts
me.order["="]("total", "subtotal + tax");
```

- Registers derivation dependencies
- Evaluates immediately when resolvable
- Falls back to storing declarative text when the expression is unresolved or rejected by the safe evaluator

Supported expression tokens include:

- numbers
- path identifiers such as `a.b`, `price`, `wallet.balance`
- arithmetic: `+ - * / %`
- comparison: `< <= > >= == !=`
- boolean: `&& || !`
- parentheses: `( ... )`

Thunk form:

```ts
me["="](() => 1 + 2);      // returns 3 at root
me.total["="](() => 1 + 2); // assigns 3 at scoped path
```

- At root, returns the computed value directly
- At scoped paths, assigns the immediate result
- Unlike string expressions, thunk calls are not tracked as declarative derivations

Use string expressions when you want dependency tracking and `explain()` support.

### `?` Query / collect

```ts
me.report["?"](["order.total", "order.tax"], (total, tax) => ({ total, tax }));
```

- Collects values from the listed paths
- Optionally transforms them with a function
- Returns directly at root or assigns to the scoped path

### `-` Remove

```ts
me.wallet.hidden["-"]("notes");
me.wallet.hidden.notes["-"]();
```

Removes the target subtree and records an auditable tombstone memory.

### `+` Define operator

```ts
me["+"]("!", "custom");
```

- Registers a new operator kind in the runtime registry
- Works only at root
- Intended for advanced / kernel-level usage

## Logic Resolution Notes

- Read resolution checks transform selectors first, then fixed/range/multi-select selectors, then filters
- Public paths resolve from the derived index
- Secret paths resolve from encrypted storage with stealth-root behavior
- Pointers redirect resolution transparently
- In lazy mode, derived targets may recompute on read if dependency versions changed

## Practical Mini-Flow

```ts
import ME from "this.me";

const me = new ME();

me["@"]("abella");
me.wallet["_"]("vault");
me.wallet.income(1000);
me.wallet.expenses.rent(400);
me.wallet["="]("net", "income - expenses.rent");

console.log(me("wallet"));      // undefined
console.log(me("wallet.net"));  // 600
console.log(me.explain("wallet.net"));
```
