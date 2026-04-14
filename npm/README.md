<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me
###### **Your personal semantic kernel.**
Define who you are, **what you own**, and how everything connects — once.  
Then use it everywhere: apps, websites, dashboards, tickets, and more.

```bash
npm install this.me
```

## In 30 seconds

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");                    // Your digital identity

// Public profile
me.profile.name("José Abella");
me.profile.bio("Building the semantic web.");

// Private wallet
me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);

// People
me.users.ana.name("Ana");
me.users.ana.age(24);
me.users.pablo.name("Pablo");
me.users.pablo.age(19);

// Relationships
me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");

// Automatic derived logic
me.friends["[i]"]["="]("isAdult", "age >= 18");

// Private group chat
me.groups.vancouver["_"]("group-key-2026");
me.groups.vancouver.messages[0].from("jabellae");
me.groups.vancouver.messages[0].text("Who is bringing the car?");

console.log(me("profile.name"));                  // "José Abella"
console.log(me("friends.ana.isAdult"));           // true
console.log(me("friends[age >= 18].name"));       // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet"));                        // undefined
console.log(me("wallet.balance"));                // 12480
console.log(me("groups.vancouver"));              // undefined
console.log(me("groups.vancouver.messages[0].text"));
console.log(me.explain("friends.ana.isAdult"));
```

## What is .me?
- An **infinite semantic tree** where you define the rules.
- Create data, relationships, formulas, and private universes.
- Everything is **reactive** — change one value and everything that depends on it updates automatically.
- Secrets are **structural**: entire branches can be hidden and encrypted by design.
- Export your entire state and restore it anywhere — it works exactly the same.

## Why people like it
- No schemas needed — if you can imagine a path, it exists.
- Real privacy — not promises, but built into the structure.
- Define once, use everywhere — stop repeating code across projects.
- Full transparency — `me.explain("path")` shows exactly how any value was computed.

## A3: Structural Privacy

Secret scopes are structural in `.me`. When you mark a branch with `["_"]`, the root stays stealth, descendants remain usable, and guest callers do not inherit the owner scope by accident.

```ts
import ME from "this.me";

const me = new ME();

me.finance["_"]("k-2026");
me.finance.fuel_price(24.5);
me.finance.currency("USD");

console.log(me("finance.fuel_price"));          // 24.5   owner/default scope
console.log(me.as(null)("finance"));            // undefined
console.log(me.as(null)("finance.fuel_price")); // undefined
```

`me.explain(path)` is also safe for audit trails. If a derivation depends on a secret input, the trace still shows that the dependency exists, but it redacts the value:

```ts
me.fleet.trucks[2].fuel(350);
me.fleet.trucks[2]["="]("cost", "fuel * finance.fuel_price");

console.log(me.explain("fleet.trucks.2.cost"));
```

Expected trace shape:

```json
{
  "label": "finance.fuel_price",
  "path": "finance.fuel_price",
  "value": "●●●●",
  "origin": "stealth",
  "masked": true
}
```

This gives you auditable dependency traces without leaking secret values into logs, dashboards, or shared debugging output.

## Quick Secret Test

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");

// === Public Profile ===
me.profile.name("José Abella");
me.profile.bio("Building the semantic web.");

// === Secret Wallet (Hidden Universe) ===
me.wallet["_"]("my-secret-key");           // Create a hidden universe

me.wallet.balance(12480);
me.wallet.transactions[0].amount(5000);
me.wallet.transactions[0].to("rent");
me.wallet.transactions[0].date("2026-04-01");
me.wallet.transactions[1].amount(-320);
me.wallet.transactions[1].to("groceries");
me.wallet.transactions[1].date("2026-04-05");
me.wallet.note("Remember to renew passport");

// === Secret Chat with Ana (completely hidden) ===
me.chats.ana["_"]("our-secret-key");
me.chats.ana.messages[0].from("me");
me.chats.ana.messages[0].text("Hey, did you get the documents?");
me.chats.ana.messages[1].from("ana");
me.chats.ana.messages[1].text("Yes, sending them now.");

// === What the outside world sees ===
console.log(me("profile"));                    
// → { name: "José Abella", bio: "Building the semantic web." }

console.log(me("wallet"));                     
// → undefined   (the entire wallet is hidden)

console.log(me("wallet.balance"));             
// → 12480       (you can still access specific leaves if you know the path)

console.log(me("chats.ana"));                  
// → undefined   (the whole chat is hidden)

// Explain what's happening under the hood
console.log(me.explain("wallet.balance"));
// → Shows the derivation path and that it's inside a secret scope
```

## Who is .me for?
Developers and creators who want to:

- Stop repeating the same infrastructure across multiple apps
- Own and control their digital identity
- Have real structural privacy
- Build clean, scalable systems without the usual mess

## Installation

```bash
npm install this.me
```

## Canonical Example

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");

// Public profile
me.profile.name("José Abella");
me.profile.bio("Building the semantic web.");

// Private wallet
me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);
me.wallet.savings(4500);

// Social graph
me.users.ana.name("Ana");
me.users.ana.age(24);
me.users.pablo.name("Pablo");
me.users.pablo.age(19);

me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
me.friends["[i]"]["="]("isAdult", "age >= 18");

// Private group chat
me.groups.vancouver["_"]("group-key-2026");
me.groups.vancouver.topic("Trip to Vancouver");
me.groups.vancouver.members.count(4);
me.groups.vancouver.messages[0].from("jabellae");
me.groups.vancouver.messages[0].text("Who is bringing the car?");

console.log(me("friends.ana.isAdult"));             // true
console.log(me("friends[age >= 18].name"));         // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet"));                          // undefined
console.log(me("wallet.balance"));                  // 12480
console.log(me("groups.vancouver"));                // undefined
console.log(me("groups.vancouver.messages[0].text"));
console.log(me.explain("friends.ana.isAdult"));
```

[Read the Docs →](https://neurons-me.github.io/.me/npm/docs/)

---

**MIT License** © 2025 [neurons.me](https://neurons.me)

**∴ Witness our seal**  

**suiGn**
