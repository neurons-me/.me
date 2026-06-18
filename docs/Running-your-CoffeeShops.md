---
layout: readme
title: Running your CoffeeShops
---

# Running your CoffeeShops

This demo teaches one simple idea:
> Public menus, reactive pricing, and private operations — all in one graph. No database, no API layer, no permission table.

Three coffee shops. Each has a public menu with derived deals. Each has a private ops layer that guests cannot see. Change a price — every derived value updates instantly.

[`.me Docs`](https://neurons-me.github.io/.me) · [CoffeeShops Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/ShopsExample.ts)

---

## The Tiny Mental Model

A shop in `.me` is just a path:

```ts
me.shops[1].name("Downtown")
me.shops[1].menu.latte(4.5)
me.shops[1].menu.espresso(3.0)
```

No class. No schema. No migration. Add facts to paths, derive values from them, filter across all shops at once.

---

## What The Demo Builds

| Layer | Example | What it means |
|---|---|---|
| Identity | `shops[1].name` | The shop's public name |
| Menu | `shops[1].menu.latte` | Base prices, public |
| Derived deals | `menu.breakfastDeal` | Computed from prices, live |
| Policy | `menu.isPremium` | Rule applied to every shop |
| Ops | `shops[1].ops.beansKg` | Private inventory, stealth-scoped |

---

## Step 1: Seed the Shops

```ts
me.shops[1].name("Downtown")
me.shops[1].menu.latte(4.5)
me.shops[1].menu.espresso(3.0)

me.shops[2].name("Riverside")
me.shops[2].menu.latte(5.0)
me.shops[2].menu.espresso(3.5)

me.shops[3].name("Station")
me.shops[3].menu.latte(4.8)
me.shops[3].menu.espresso(3.5)
```

Three shops, two prices each. Nothing smart yet — just facts.

---

## Step 2: Derive Deals and Policies Across All Shops

Apply rules to every shop's menu at once with `[i]`:

```ts
me.shops["[i]"].menu["="]("breakfastDeal", "latte + espresso - 1.5")
me.shops["[i]"].menu["="]("isPremium", "breakfastDeal > 6.5")
```

Now query across all of them:

```ts
me("shops[1..3].menu.breakfastDeal")
// → { 1: 6, 2: 7, 3: 6.8 }

me("shops[menu.isPremium == true].name")
// → { 2: "Riverside", 3: "Station" }
```

The filter runs over live derived values. No SQL, no query builder.

---

## Step 3: Watch It React

Change one price. Every derivation that depends on it updates:

```ts
me.shops[1].menu.latte(5.1)

me("shops[menu.isPremium == true].name")
// → { 1: "Downtown", 2: "Riverside", 3: "Station" }
```

Downtown crossed the premium threshold. No manual update, no event listener — the dependency was already declared.

---

## Step 4: Private Operations Layer

The public menu is readable by anyone. The back-of-house ops are not:

```ts
me.shops[1].ops["_"]("downtown-ops-key")  // stealth scope
me.shops[1].ops.beansKg(3)
me.shops[1].ops["="]("needsRestock", "beansKg < 4")
```

Owner reads:

```ts
me("shops[1].ops.needsRestock")  // true
```

Guest reads:

```ts
me.as(null)("shops[1].ops")            // undefined — stealth
me.as(null)("shops[1].ops.needsRestock") // undefined — stealth
```

The structure is invisible, not just locked. Guests cannot tell whether ops exists.

---

## Explainability

Any derived value traces itself:

```ts
me.explain("shops[1].menu.isPremium")
// → {
//     value: true,
//     expression: "breakfastDeal > 6.5",
//     dependsOn: ["shops.1.menu.breakfastDeal"]
//   }
```

For private derivations, masked inputs appear as `"●●●●"` — the system acknowledges the dependency without leaking the value.

---

## Build It Yourself

```bash
cd npm
npm install
node tests/Demos/ShopsExample.ts
```

To run every demo:

```bash
npm run test:demos:run-all
```

---

## The Big Idea

A business has public surfaces and private internals. Prices are public. Inventory is private. Deals are derived from prices. Restock alerts are derived from inventory.

In `.me`, all of that lives in one graph:

```text
public facts + private facts + derived policies = one reactive structure
```

No separate systems for menus, pricing engines, and ops dashboards. One graph, different scopes, everything live.
