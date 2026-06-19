---
layout: readme
title: Splitting your Bill
---

# Splitting your Bill

This demo teaches one simple idea:
> Shared expenses settle themselves — every balance updates the moment a payment lands.

Three friends share a trip wallet. One pays the hotel. Another pays dinner. The graph tracks who's owed what in real time — no spreadsheet, no app, no reconciliation step.

[`.me Docs`](https://neurons-me.github.io/.me) · [WalletSplit Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/WalletSplit.ts)

---

## The Tiny Mental Model

```ts
me.wallets.vancouver.total(300)
me.wallets.vancouver["="]("per_person", "total / members.count")
me.wallets.vancouver["="]("balance_jabellae", "paid.jabellae - per_person")
```

No event listeners. No recalculation calls. When `total` changes, `per_person` changes, and every balance updates — because the dependency was already declared.

---

## What The Demo Builds

| Layer | Path | What it means |
|---|---|---|
| Wallet | `wallets.vancouver.total` | Running total of all expenses |
| Members | `wallets.vancouver.members.count` | Number of participants |
| Derived | `wallets.vancouver.per_person` | Fair share — `total / members.count` |
| Payment | `wallets.vancouver.paid.jabellae` | What each person has contributed |
| Balance | `wallets.vancouver.balance_jabellae` | `paid - per_person` — positive means owed back |

---

## Step 1: Create the Wallet

```ts
me.wallets.vancouver.description("Vancouver trip — 3 people")
me.wallets.vancouver.members.count(3)
me.wallets.vancouver.total(0)

me.wallets.vancouver["="]("per_person", "total / members.count")
```

---

## Step 2: Track What Each Person Paid

```ts
me.wallets.vancouver.paid.jabellae(0)
me.wallets.vancouver.paid.ana(0)
me.wallets.vancouver.paid.pedro(0)

me.wallets.vancouver["="]("balance_jabellae", "paid.jabellae - per_person")
me.wallets.vancouver["="]("balance_ana",      "paid.ana      - per_person")
me.wallets.vancouver["="]("balance_pedro",    "paid.pedro    - per_person")
```

Positive balance = owed money back. Negative = owes the group.

---

## Step 3: Jabellae Pays the Hotel ($300)

```ts
me.wallets.vancouver.paid.jabellae(300)
me.wallets.vancouver.total(300)
```

Every balance recalculates immediately:

```ts
me("wallets.vancouver.per_person")        // 100
me("wallets.vancouver.balance_jabellae")  // +200  ← owed back
me("wallets.vancouver.balance_ana")       // -100  ← owes
me("wallets.vancouver.balance_pedro")     // -100  ← owes
```

---

## Step 4: Ana Pays Dinner ($90)

```ts
me.wallets.vancouver.paid.ana(90)
me.wallets.vancouver.total(390)
```

The fair share shifts. All balances update:

```ts
me("wallets.vancouver.per_person")        // 130
me("wallets.vancouver.balance_jabellae")  // +170
me("wallets.vancouver.balance_ana")       //  -40
me("wallets.vancouver.balance_pedro")     // -130
```

Pedro owes the most — he hasn't paid anything yet.

---

## Explainability

Any balance can explain its own derivation:

```ts
me.explain("wallets.vancouver.balance_jabellae")
// → {
//     value: 170,
//     expression: "paid.jabellae - per_person",
//     dependsOn: ["wallets.vancouver.paid.jabellae", "wallets.vancouver.per_person"]
//   }
```

The chain continues: `per_person` depends on `total` and `members.count`. The full audit trail is always one call away.

---

## Build It Yourself

```bash
cd npm
npm install
node tests/Demos/WalletSplit.ts
```

To run every demo:

```bash
npm run test:demos:run-all
```

---

## The Big Idea

Group finances have one hard problem: every new payment changes everyone's balance. Normally that means a central app maintaining state, broadcasting updates, and resolving conflicts.

In `.me`, the graph IS the ledger:

```text
payment recorded → total updates → per_person updates → all balances update
```

No settlement engine. No reconciliation job. The reactive graph settles automatically — because that's what derived values do.

---

[← Back to .me Docs](https://neurons-me.github.io/.me/docs/)
