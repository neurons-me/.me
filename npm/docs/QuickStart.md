# Quick Start

`.me` is a callable semantic kernel.
You **build meaning** with paths, add privacy structurally, and compute derived state without leaving the same object.

## Install

```bash
npm install this.me
```

## First Kernel

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae"); // Your digital identity

// Public profile
me.profile.name("José Abella");
me.profile.bio("Building the semantic web.");

// Private wallet - stealth root, accessible leaves
me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);

// People
me.users.ana.name("Ana");
me.users.ana.age(24);
me.users.pablo.name("Pablo");
me.users.pablo.age(19);

// Relationships - structural links, not copies
me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");

// Derived logic - runs for every i
me.friends["[i]"]["="]("isAdult", "age >= 18");

console.log(me("profile.name")); // "José Abella"
console.log(me("friends.ana.isAdult")); // true
console.log(me("friends[age >= 18].name")); // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet")); // undefined
console.log(me("wallet.balance")); // 12480
console.log(me.explain("friends.ana.isAdult")); // { label, path, inputs, expression }
```

## What Happened

- `me.profile.name("...")` writes semantic state. Paths are created on write.
- `me.wallet["_"]("...")` creates a secret scope. Root `wallet` is stealth, descendants resolve.
- `["->"]` creates structural links instead of copying data. Single source of truth.
- `["[i]"]["="]` registers reactive logic that recomputes in O(k) from dependencies.
- `me("path")` reads naturally through the same runtime surface. No getters/setters.
- `me.explain(path)` returns provenance: inputs, expression, origin. Secrets masked as `●●●●`.

## Next

- [Runtime Surface](./Runtime-Surface)
- [Operators](./Operators)
- [Memory](./Memory)
- [Social Graph Walkthrough](./examples/Social_Graph)

**MIT License** © 2025 [neurons.me](https://neurons.me)
