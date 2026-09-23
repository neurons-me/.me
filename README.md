
<div class="readme-intro">

# .me

**Own your knowledge.**

</div>

<div class="static-hero">
<table border="0" cellspacing="0" cellpadding="0" style="border:none; margin:0;">
  <tr>
    <td width="260" align="center" valign="middle">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760915741/this.me-removebg-preview_1_nrj6pe.png" />
        <img src="./docs/assets/this.me.png" alt=".me as a coordinate" width="200" title="ID Hash" />
      </picture>
      <div title="ID Hash: keccak256(&quot;this.me/identity:v1::.me&quot;)" style="margin-top:6px; font-family:monospace; font-size:0.65rem; color:#6b7280; opacity:0.75; letter-spacing:0.02em;">0dec8214…a292d7</div>
      <a href="https://neurons-me.github.io/.me/docs/Seed.html" target="blank" title="identityHash = keccak256(&quot;this.me/identity:v1::&quot; + seed) — read the SEED doc" style="display:block; margin-top:2px; font-family:monospace; font-size:0.6rem; color:#58a6ff; letter-spacing:0.03em; text-decoration:underline;">keccak-256</a>
    </td>
    <td valign="middle">
      <h2>Hello, I am .me</h2>
      <p>
        <h6>
          A Cryptographic Identity.
      </h6>
      </p>
      <h3><a href="https://neurons-me.github.io/.me/docs" target="blank">⌬ Docs</a>   </h3>
      <p style="font-family:monospace; font-size:0.7rem; color:#8b949e;">→ Watch the hash: <a href="https://neurons-me.github.io/.me/">neurons-me.github.io/.me</a></p>
    </td>
  </tr>
</table>
</div>


## What is .me

`.me` is a declarative language for building an infinite semantic tree — a universe of meaning — and querying it by path.

### Declare meaning

Any path is valid — `me.any.depth.path(...)` — because you invent the graph as you write it.

```ts
me.profile.name("Abella.e")
```

### Resolve meaning

You resolve inside a [namespace](https://neurons-me.github.io/Namespace.html) — the name of the place, the place of the name.

```ts
me("profile.name") // "Abella.e"
```

`me.whatever(what)` — every call is Subject-Verb-Object, plus an operator table: <code style="color:#f472b6;font-weight:600;">@</code> identity, <code style="color:#f472b6;font-weight:600;">_</code> secret, <code style="color:#f472b6;font-weight:600;">-&gt;</code> link (not a copy), <code style="color:#f472b6;font-weight:600;">=</code> derived rule. One kernel, real lines:

```ts
me["@"]("jabellae");
me.wallet["_"]("wallet-key");
me.friends.ana["->"]("users.ana");
me.friends["[i]"]["="]("isAdult", "age >= 18");
```

Full grammar, the operator table, and a how-to: **[me.whatever(what)](https://neurons-me.github.io/me.whatever.what.html)**.

## ⚡ Get .me started!

Clone the repo, pick a runtime (🔷 TypeScript, 🦀 Rust, 🐍 Python), build your first kernel. **[Full walkthrough →](https://neurons-me.github.io/Get.me.started.html)**

```ts
me["@"]("abella") // you are Abella
```

**[𓀠 ⟐👤 ⇄ 👥 ⌬ ∴ 𓀠 Social Graph](https://neurons-me.github.io/.me/docs/Social-Graph.html)** — Identity, trust, and relationships.

Ana, Pablo, and Luisa live at `users.*`. `friends.ana` doesn't copy Ana's record — it points at it, so anything Ana updates is instantly true for everyone who calls her a friend. "Adult" isn't a field anyone sets either; it's a rule declared once and evaluated per user.

```ts
me.friends.ana["->"]("users.ana")
me.users["[i]"]["="]("isAdult", "age >= 18")
me("friends[isAdult == true].name")
// -> { ana: "Ana", luisa: "Luisa" }
```

Pablo turns 18 mid-conversation. Nobody re-runs the query — `.me` just re-derives from the new age, and the next read already reflects it.

```ts
me.users.pablo.age(18)
me("friends[isAdult == true].name")
// -> { ana: "Ana", pablo: "Pablo", luisa: "Luisa" }
```

**[Learn more about social graphs with .me.](https://neurons-me.github.io/.me/docs/Social-Graph.html)**

**[⟐🤖 ⇆ 🤖⟐ Robots That Understand Context](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)** — Same object, different meaning.

Four robots — a warehouse loader, a hospital nurse, a street courier, an operating-room surgeon — all point at the exact same physical object, `objects.canister7`. Nothing about the canister changes between them; what changes is the context each robot reads it through.

```ts
me.robots.surgeon.target["->"]("objects.canister7")
me.robots.surgeon.context["->"]("contexts.operatingRoom")
me.robots["[i]"]["="]("canProceed", "canLift && softGripReady && !needsHumanReview && contextAllowsMotion")
```

SurgeonBot's policy is stricter than the others': it also requires a sterile target. Sterilize the canister and, without touching a single robot's code, the same shared object clears the same shared rule.

```ts
me("robots.surgeon.canProceed")   // -> false — canister isn't sterile yet
me.objects.canister7.sterile(true)
me("robots.surgeon.canProceed")   // -> true
```

**[Learn more about context-aware robots with .me.](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)**

**[∴ 🏙️ ◉ 📡 ⌬ Smart City](https://neurons-me.github.io/.me/docs/Smart-Cities.html)** — A city reacting as one connected graph.

Four districts, each declaring a `capacity` and a live `currentLoad`. `overCapacity` isn't a field anyone writes — it's derived, so it can never quietly go stale the way a cached flag would.

```ts
me.districts["[i]"]["="]("overCapacity", "currentLoad > capacity")
me("districts[overCapacity == true].name")
// -> { 3: "Veracruz Puerto" } — 8,500 riders in an 8,000 capacity district
```

A parallel security branch tracks the same city's real incident counts, but it's declared under `_` — structurally invisible. The public graph and the private ops layer share one kernel, not two systems bolted together.

```ts
me.security["_"]("city-security-ops-2026")
me.security["="]("alertLevel", "incidentsToday > 2")
me.as(null)("security.alertLevel")   // -> undefined — honest absence, to a guest
me("security.alertLevel")            // -> true — to the owner
```

**[Learn more about reactive cities with .me.](https://neurons-me.github.io/.me/docs/Smart-Cities.html)**

**[🏪 ⇄ 📦 ⇄ 📈 CoffeeShops](https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html)** — Inventory and operations as a graph.

Three shops, each with its own `latte`/`espresso` price. `breakfastDeal` is declared once as a formula, not computed per shop — every shop inherits the same rule and evaluates it against its own menu.

```ts
me.shops["[i]"].menu["="]("breakfastDeal", "latte + espresso - 1.5")
me.shops["[i]"].menu["="]("isPremium", "breakfastDeal > 6.5")
me("shops[menu.isPremium == true].name")
// -> { 2: "Riverside", 3: "Station" }
```

Raise Downtown's latte price and it crosses the same premium threshold on its own — no shop-by-shop re-check, because `isPremium` was never a snapshot to begin with.

```ts
me.shops[1].menu.latte(5.1)
me("shops[menu.isPremium == true].name")
// -> { 1: "Downtown", 2: "Riverside", 3: "Station" }
```

**[Learn more about running shops with .me.](https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html)**

**[💳 ⇄ 👥 ⌬ ⚖️ ∴ Splitting your Bill](https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html)** — Shared expenses with automatic settlement.

Three friends share one wallet. `per_person` and each person's `balance` are formulas over `total` and what they've individually paid — nobody manually recomputes who owes what after an expense.

```ts
me.wallets.vancouver["="]("per_person", "total / members.count")
me.wallets.vancouver["="]("balance_ana", "paid.ana - per_person")
me("wallets.vancouver.balance_ana")
// -> -100 — after the $300 hotel, split three ways
```

Ana pays for dinner next. One write to `paid.ana`, and `total`, `per_person`, and every balance in the wallet shift together — same declared formulas, new numbers.

```ts
me.wallets.vancouver.paid.ana(90)
me.wallets.vancouver.total(390)
me("wallets.vancouver.balance_ana")
// -> -40 — the split rebalances itself
```

**[Learn more about splitting bills with .me.](https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html)**

**[🌐 ⇄ ⌬ 𓇳 ⌬ ⇄ 🌐 Hemisphere Scale](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html)** — 1 million sensors. One flips. Only 6 recompute. The other 999,994 untouched. That's **[O(k)](https://neurons-me.github.io/.me/docs/Architecture.html).**

A million districts, each just `powerUp(true)`. Buried in that hemisphere is one hot lineage — a single sensor wired through a real chain: blackout → gridlock → zone status → citywide reroute → generator mode.

```ts
me.geo[777777]["="]("blackout", "!powerUp")
me.grid[78]["="]("zoneDown", "geo[777777].gridlock || geo[777777].hospitalAlert")
me.services["="]("generatorMode", "traffic.emergencyReroute")
```

Flip that one sensor and only its real dependents recompute — not the other 999,994 districts that were never wired into this chain. `explain()` reports exactly which six nodes moved.

```ts
me.geo[777777].powerUp(false) // 1 of 1,000,000 districts
me.explain("services.generatorMode").meta.k
// -> 6 — only 6 nodes recomputed, 999,994 untouched
```

**[Learn more about hemisphere-scale graphs with .me.](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html)**

**[⚡⚡⚡ ⟶ ⌬⌬⌬⌬ Extreme Fan-Out](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html)** — One write updates 100k dependents.

The opposite shape from Hemisphere: 100,000 nodes that all genuinely depend on the same source. Every `dep[i].out` is declared once as `value * master.factor` — one shared multiplier behind 100,000 independent leaves.

```ts
me.master.factor(1)
me.dep[i]["="]("out", "value * master.factor") // 100,000 of these
me("dep[1].out")   // -> 1
```

Change the shared factor once and, this time, all 100,000 genuinely have to recompute. O(k) was never a promise that k stays small — it's a promise that only the real dependents ever run, whether k is 6 or 100,000.

```ts
me.master.factor(2) // one write
me.explain("dep[100000].out").meta.k
// -> 100000 — every dependent genuinely depends, so all recompute
```

**[Learn more about extreme fan-out with .me.](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html)**

**[⌬ ⊚ View all demos →](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Demos)**

## 𓂀 Syntax

**Subject. Verb. Object**. It reads as a sentence because it is one.

`me` is the subject, `.whatever` is the verb (capability), `(what)` is the object.

Any path you write becomes a node. **No schema. No migrations.** If it changes, everything that depends on it updates automatically.

| Op         | What it does                    | Example                                      |
| :--------- | :------------------------------ | :------------------------------------------- |
| `->`       | Points to another path          | `me.card["->"]("inventory")`                 |
| `=`        | Derived value                   | `me["="]("total", "price * 1.16")`           |
| `_`        | Secret — structurally invisible | `me.wallet["_"]("vault")`                    |
| `[i]`      | Broadcast to a family           | `me.robots["[i]"]["="]("canProceed", "...")` |
| `[filter]` | Query                           | `me("trucks[fuel > 200].fuel")`              |

Developers may *recognize the idea* more quickly written like this:

```ts
me.city.population = 700_000
me.city.area = 200
me.city.density = () => me.city.population / me.city.area
```

### Language-agnostic

> `me.shop.items[1].price(100)` = `me.tienda.articulos[1].precio(100)` = `me.店舗.商品[1].価格(100)` — **meaning is structure.**

**Full spec**: `me --describe syntax` and [Syntax reference](https://neurons-me.github.io/.me/docs/Syntax.html)

## **▵** Why.me?

1. **Structural Privacy** — Private data is structurally invisible (not just hidden by rules).

2. **Subjective Reality** — Same graph, different views per agent.

3. **Full Explainability** — Every derived value can explain exactly how it was computed.

   ## me.explain(Why Did You Say That?)

   ***Ai*** can describe its reasoning, but that description is still generated by the same system being questioned.

   `.me` returns the computation itself.

   ```ts
   me.explain("robots.surgeon.canProceed")
   {
     value: true,
     expr: "canLift && softGripReady && !needsHumanReview",
     dependsOn: [...]
   }
   ```

   `explain()` returns the expression actually evaluated and the inputs that produced it.

   If no derivation exists, it returns none. If an input is secret, the value stays masked.

   **Self-report describes the computation.** **`me.explain()`** **exposes its record.**

   And `me["!"].prove()` can cryptographically sign that state.

   **Explainability without asking the system to explain itself.**

> **Local compute makes memory an OS primitive.**  
> Cloud makes it a service.

In the [Extreme Fan-Out](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html) benchmark, one write propagates to 100,000 dependents in 21,283ms — about 213μs per dependent. Real numbers, worst case: every one of the 100,000 nodes genuinely depends on the changed value, so all 100,000 recompute — see [What is O(k)?](https://suign.github.io/WhatIsOK.html) for the full, verified benchmark table.

### Real Performance

**.me** uses **true O(K) reactivity** — when a value changes, only its actual dependents update. *Not the whole graph.*

More importantly, propagation cost follows K, not total graph size. In the [Hemisphere](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html) benchmark, a graph with 1,000,000 nodes changes one sensor and recomputes exactly 6 dependents in 4.346ms.

- 1 million nodes in memory (~533MB heap)
- 1 sensor changed → exactly **6 dependent nodes** recomputed
- Time to propagate: **4.346ms**
- K=6 out of 1,000,000 — the rest of the graph is untouched

Scale the graph to 10 million nodes — if your change has 6 dependents, it still takes the same time.
**Data that thinks. Logic that explains itself.**

---

**𓅓 Own your intelligence.**

**suiGn**
MIT License © 2025 · [neurons.me](https://neurons.me)

<p align="center">
  <a href="https://neurons.me/">
    <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png" alt="neurons.me" width="89" />
  </a>
</p>
