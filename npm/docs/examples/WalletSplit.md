# 💸 Wallet Split
Real-life example: two friends share a trip wallet, one person contributes funds, and split logic is derived automatically.

---

## Scenario
- You (`@jabellae`) and Ana share a wallet.
- You deposit `$5` into the shared wallet.
- The system computes each person’s split with formulas.

---

## Full Example

```ts
import Me from "this.me";
const me = new Me() as any;

// 1) Identity
me["@"]("jabellae");

// 2) Participants
me.users.jabellae.name("Jabellae");
me.users.ana.name("Ana");

// 3) Shared wallet
me.wallets.trip_vancouver.total(0);
me.wallets.trip_vancouver.members.count(2);

// 4) Contribution: +$5 from your wallet into shared wallet
me.wallets.trip_vancouver.total(5);

// 5) Derived split (total / members)
me.wallets.trip_vancouver["="]("per_person", "total / members.count");

// 6) Optional balances
me.wallets.trip_vancouver["="]("jabellae_due", "per_person");
me.wallets.trip_vancouver["="]("ana_due", "per_person");

console.log("total ->", me("wallets.trip_vancouver.total")); // 5
console.log("per_person ->", me("wallets.trip_vancouver.per_person")); // 2.5
console.log("jabellae_due ->", me("wallets.trip_vancouver.jabellae_due")); // 2.5
console.log("ana_due ->", me("wallets.trip_vancouver.ana_due")); // 2.5
```

---

## Why this is useful
- Uses semantic paths as accounting structure.
- Uses `=` for deterministic derived math.
- Keeps the model auditable with memory events (`me.inspect()`).

---

## Optional Audit

```ts
console.log(me.explain("wallets.trip_vancouver.per_person"));
```

You get:
- expression used (`total / members.count`)
- dependencies involved
- compute metadata

---

## Expected Output

```txt
total -> 5
per_person -> 2.5
jabellae_due -> 2.5
ana_due -> 2.5
```
