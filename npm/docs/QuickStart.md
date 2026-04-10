# Quick Start

`.me` is a callable semantic kernel.
You build meaning with paths, add privacy structurally, and compute derived state without leaving the same object.

## Install

```bash
npm install this.me
```

## First Kernel

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");

me.profile.name("Jose Abella");
me.profile.bio("Building the semantic web.");

me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);

me.users.ana.name("Ana");
me.users.ana.age(24);
me.users.pablo.name("Pablo");
me.users.pablo.age(19);

me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
me.friends["[i]"]["="]("isAdult", "age >= 18");

console.log(me("profile.name"));              // "Jose Abella"
console.log(me("friends.ana.isAdult"));       // true
console.log(me("friends[age >= 18].name"));   // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet"));                    // undefined
console.log(me("wallet.balance"));            // 12480
console.log(me.explain("friends.ana.isAdult"));
```

## What Happened

- `me.profile.name("...")` writes semantic state.
- `me.wallet["_"]("...")` creates a secret scope with a stealth root.
- `["->"]` creates structural links instead of copying data.
- `["="]` registers reactive logic that recomputes from dependencies.
- `me("path")` reads naturally through the same runtime surface.

## Next

- [Runtime Surface](./Runtime-Surface)
- [Operators](./Operators)
- [Memory](./Memory)
- [Social Graph Walkthrough](./examples/Social_Graph)

**MIT License** © 2025 [neurons.me](https://neurons.me)
