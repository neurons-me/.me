<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me
**0.001ms p50** write enqueue
**0.003ms p50** cascadeLazy 10-dep flush
**0.137ms p99** cascadeLazy 10-dep flush
**~700 vps** sustained write with 1536-dim vectors

Your personal semantic kernel - **own your knowledge** graph, your way: agents, notes, relationships, wallet, groups, secrets — all in one reactive tree.

Define who you are, **what you own**, and how everything connects — once.  Then use it everywhere: apps, websites, dashboards, tickets, and more.

# Install .me

```bash
npm install this.me
```

**.me** runs 100% local with **end-to-end encryption.**

## In 30 seconds

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");// Your digital identity

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

console.log(me("profile.name")); // "José Abella"
console.log(me("friends.ana.isAdult")); // true
console.log(me("friends[age >= 18].name")); // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet")); // undefined
console.log(me("wallet.balance")); // 12480
console.log(me("groups.vancouver")); // undefined
console.log(me("groups.vancouver.messages[0].text"));
console.log(me.explain("friends.ana.isAdult"));
```

`["[i]"]["="]` = “for every i, derive”. No loops, no re-runs, **O(k)** updates.

## What is .me?
- **Own all structures** (profile, contacts, money, chats) as code
- No cloud or vendor lock
- Privacy by default & **explainability built-in**
- Audit any answer **explain(why_did_you_say_that)** — *log how **“AI”** arrived at a value*
- Compose logic, not tables — everything is reactivity and references

## Why .me?
- **No schemas** — if you can imagine a path, it exists.
- **Define once, use everywhere** — your profile, wallet, chats, and logic as one reactive tree.
- **No cloud, no vendor lock** — 100% local, end-to-end encrypted.
- **Audit everything** — `me.explain("path")` shows how any value was computed.

## The primitives
**.me** ships 3 things **cloud architecture can't:**

1. **Structural privacy** — Secrets are holes in the graph, not flags on rows. Access control is topology, not policy.
2. **Native provenance** — Every derived value carries inputs, expression, and origin. Stealth stays masked but auditable.
3. **Subjective state** — Same graph resolves different shapes per viewer. O(k) recompute means privacy doesn’t cost latency.

> **Local compute makes memory an OS primitive. Cloud makes it a service.**

## Structural Privacy
Secret scopes are structural in `.me`. When you mark a branch with `["_"]`, the root stays stealth, descendants remain usable, and guest callers do not inherit the owner scope by accident.

```ts
import ME from "this.me";

const me = new ME();

me.finance["_"]("k-2026");
me.finance.fuel_price(24.5);
me.finance.currency("USD");

console.log(me("finance.fuel_price")); // 24.5   owner/default scope
console.log(me.as(null)("finance")); // undefined
console.log(me.as(null)("finance.fuel_price")); // undefined
```

`me.explain(path)` is also safe for audit trails. If a **derivation depends on a secret** input, the trace still shows that the dependency exists, but it redacts the value:

```ts
me.fleet.trucks[2].fuel(350);
me.fleet.trucks[2]["="]("cost", "fuel * finance.fuel_price");

console.log(me.explain("fleet.trucks.2.cost"));
```

**Expected trace shape:**

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

- **Stop repeating the same infrastructure** across multiple apps
- Own and control their digital identity
- Have real structural privacy
- Build clean, scalable systems without the usual mess

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

console.log(me("friends.ana.isAdult"));  // true
console.log(me("friends[age >= 18].name")); // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet")); // undefined
console.log(me("wallet.balance")); // 12480
console.log(me("groups.vancouver")); // undefined
console.log(me("groups.vancouver.messages[0].text"));
console.log(me.explain("friends.ana.isAdult"));
```

```ts
const snapshot = me.exportSnapshot();
const restored = new ME();
restored.hydrate(snapshot);
```

[Read the Docs →](https://neurons-me.github.io/.me/npm/docs/)

# Performance

| Profile   | Corpus            | Exact p95 | IVF p95 | Speedup   | Recall | Chunks |
| --------- | ----------------- | --------- | ------- | --------- | ------ | ------ |
| realistic | chunk_coherent    | 77.1s     | 3.32s   | **23.2x** | 1.000  | 18.40  |
| hostile   | legacy_fragmented | 166.6s    | 19.35s  | **8.6x**  | 1.000  | 97.60  |

`Chunks decrypted per query out of 100k total`.

_“‘Realistic’ = default UX (coherent), ‘hostile’ = worst-case/adversarial stress test. Chunks decrypted/query.”_

**Storage milestones:**

- **Phase 1 closed ✅ ** with stable batch writes and lightweight journals; the limit was V8 heap residency, not write-path collapse.
- **Phase 2 closed ✅ ** with chunked columnar secret vector storage, typed `Float32Array` payloads, and a 100k encrypted leaf-write microbenchmark at `1886 vps` with `~122MB` post-GC heap.
- **Phase 3 closed ✅ ** for realistic chunk-coherent corpora with `23.2x` speedup over exact scan at `100k`.

.me is a reactive semantic tree.

- No tables. You store events, derive meaning with `=`.
- No RLS. You mark scopes with `["_"]`. Guests can't see in.
- No triggers. Mutations recompute `O(k)` automatically.
- No hidden state. `explain(path)` shows the full dependency graph.

4 demos, <200 lines total, replace Postgres + RLS + triggers + views.

## The Ecosystem
- **.me** — semantic kernel (this package)
- **cleaker** — **Who are you, relative to where you are?**
- **monad.ai** — local daemon.
- **NetGet** — Build, Expose, Route — Effortlessly.

## Tests and Benchmarks

* npm run test:phase2
* npm run bench:phase2
* npm run phase2
* npm run test:phase3
* npm run bench:phase3
* npm run phase3

**Plus:**

* npm run test → runs all tests
* npm run bench → runs all benchmarks
* npm run phases → runs phase2 y runs phase3

---

**∴ Witness our seal**  

**suiGn**

**MIT License** © 2025 https://neurons.me



<p align="center">
  <a href="https://neuron.me/">
    <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png" alt="neurons.me" width="89" />
  </a>
</p>
