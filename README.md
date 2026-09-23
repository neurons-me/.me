
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

Clone the repo, pick a runtime:<br>
🔷 TypeScript, 🦀 Rust, 🐍 Python<br>
**[Full walkthrough →](https://neurons-me.github.io/Get.me.started.html)**

```ts
me["@"]("abella") // you are Abella
```

**[𓀠 ⟐👤 ⇄ 👥 ⌬ ∴ 𓀠 Social Graph](https://neurons-me.github.io/.me/docs/Social-Graph.html)** — Identity, trust, and relationships.

```ts
me.friends.ana["->"]("users.ana")
me.users["[i]"]["="]("isAdult", "age >= 18")
me("friends[isAdult == true].name")
// -> { ana: "Ana", luisa: "Luisa" }
```

*Pablo turns 18. Who's on the list now?*

```ts
me.users.pablo.age(18)
me("friends[isAdult == true].name")
// -> { ana: "Ana", pablo: "Pablo", luisa: "Luisa" }
```

Trust isn't stored, it's computed fresh from whatever's true right now — which is exactly what lets the same graph decide who's on tonight's guest list and, a page later, who owes rent. **[See the full Social Graph demo.](https://neurons-me.github.io/.me/docs/Social-Graph.html)**

**[💳 ⇄ 👥 ⌬ ⚖️ ∴ Splitting your Bill](https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html)** — Shared expenses with automatic settlement.

```ts
me.wallets.vancouver["="]("per_person", "total / members.count")
me.wallets.vancouver["="]("balance_ana", "paid.ana - per_person")
me("wallets.vancouver.balance_ana")
// -> -100
```

*Ana pays $90 for dinner. New balance?*

```ts
me.wallets.vancouver.paid.ana(90)
me.wallets.vancouver.total(390)
me("wallets.vancouver.balance_ana")
// -> -40
```

A balance sheet for three friends and a settlement engine for a hundred-person retreat are built from identical arithmetic — only the numbers get bigger. **[Walk through Splitting the Bill.](https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html)**

**[🏪 ⇄ 📦 ⇄ 📈 CoffeeShops](https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html)** — Inventory and operations as a graph.

```ts
me.shops["[i]"].menu["="]("breakfastDeal", "latte + espresso - 1.5")
me.shops["[i]"].menu["="]("isPremium", "breakfastDeal > 6.5")
me("shops[menu.isPremium == true].name")
// -> { 2: "Riverside", 3: "Station" }
```

*Downtown's latte goes to $5.10. Premium now?*

```ts
me.shops[1].menu.latte(5.1)
me("shops[menu.isPremium == true].name")
// -> { 1: "Downtown", 2: "Riverside", 3: "Station" }
```

Swap "latte" for any SKU and a franchise-wide pricing rule falls out of the exact same three lines — and the next section prices something that isn't a drink at all. **[Explore CoffeeShops end to end.](https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html)**

**[⟐🤖 ⇆ 🤖⟐ Robots That Understand Context](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)** — Same object, different meaning.

```ts
me.robots.surgeon.target["->"]("objects.canister7")
me.robots["[i]"]["="]("canProceed", "canLift && softGripReady && !needsHumanReview && contextAllowsMotion")
me("robots.surgeon.canProceed")   // -> false
```

*Sterilize the canister. Does the surgeon clear now?*

```ts
me.objects.canister7.sterile(true)
me("robots.surgeon.canProceed")   // -> true
```

A surgical robot checking whether a canister was sterilized is really just a permission check — the same kind that could clear a forklift, a drone, or a locked door, scaled from one canister to an entire city. **[Read Robots That Understand Context.](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)**

**[∴ 🏙️ ◉ 📡 ⌬ Smart City](https://neurons-me.github.io/.me/docs/Smart-Cities.html)** — A city reacting as one connected graph.

```ts
me.districts["[i]"]["="]("overCapacity", "currentLoad > capacity")
me("districts[overCapacity == true].name")
// -> { 3: "Veracruz Puerto" }
```

*Security is declared under `_`. What does a guest see?*

```ts
me.security["_"]("city-security-ops-2026")
me.security["="]("alertLevel", "incidentsToday > 2")
me.as(null)("security.alertLevel") // -> undefined
me("security.alertLevel")          // -> true
```

A city's incident board and a hospital's are the same shape, different stakes, same rule for who's cleared to see it — and the same shape scales from a handful of districts to a million sensors. **[Dig into Smart Cities.](https://neurons-me.github.io/.me/docs/Smart-Cities.html)**

**[🌐 ⇄ ⌬ 𓇳 ⌬ ⇄ 🌐 Hemisphere Scale](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html)** — 1 million sensors. One flips. Only 6 recompute. The other 999,994 untouched. That's **[O(k)](https://neurons-me.github.io/.me/docs/Architecture.html).**

```ts
me.geo[777777]["="]("blackout", "!powerUp")
me.services["="]("generatorMode", "traffic.emergencyReroute")
```

*One sensor flips, out of 1,000,000. How many recompute?*

```ts
me.geo[777777].powerUp(false)
me.explain("services.generatorMode").meta.k
// -> 6
```

Six recomputes, not a million — that gap is the whole argument for running a sensor network this size live at all. Extreme Fan-Out flips the question: what if *k* itself is the huge number? **[Follow the full Hemisphere Scale walkthrough.](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html)**

**[⚡⚡⚡ ⟶ ⌬⌬⌬⌬ Extreme Fan-Out](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html)** — One write updates 100k dependents.

```ts
me.master.factor(1)
me.dep[i]["="]("out", "value * master.factor") // 100,000 of these
me("dep[1].out") // -> 1
```

*Same trick, 100,000 dependents this time. How many recompute now?*

```ts
me.master.factor(2)
me.explain("dep[100000].out").meta.k
// -> 100000
```

That's O(k) end to end, small or large — one edit, and whole catalogs reprice or whole dashboards refresh, without anyone re-running anything by hand. **[Trace Extreme Fan-Out.](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html)**

**[⌬ ⊚ View all demos →](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Demos)**

<p align="center">
  <img src="./docs/assets/syntax-venn.svg" alt="" width="320" />
</p>

## 𓂀 Syntax: Algebra of Digital Spaces

**Subject.me Verb.whatever Object.what** — `me.whatever(what)`

Underneath the dot-path sits a [namespace](https://neurons-me.github.io/Namespace.html) — which tree of meaning you're addressing, resolved over [NRP](https://neurons-me.github.io/NRP/) from identity, never from the door (URL) you walked in through. Who's allowed to read what inside that tree isn't a permissions table, it's an [encrypted-audience intersection](https://neurons-me.github.io/algebra_of_encrypted_audiences.html): two islands share only the exact space where they overlap, cryptographically, per the [set-chemistry](https://suign.github.io/SetChemistry.html) underneath the whole [digital-space algebra](https://suign.github.io/DigitalSpaceAlgebra.html) this syntax sits on.

```ts
me.card["->"]("inventory")                  // -> points to another path
me["="]("total", "price * 1.16")             // = derived value
me.wallet["_"]("vault")                      // _ secret, structurally invisible
me.robots["[i]"]["="]("canProceed", "...")   // [i] broadcasts to a family
me("trucks[fuel > 200].fuel")                // [filter] queries
```

Full breakdown, with the exact handler behind each one: **[Operators & Logic](https://neurons-me.github.io/.me/Typescript/typedocs/Operators.html)**.

Developers may *recognize the idea* more quickly written like this:

```ts
me.city.population = 700_000
me.city.area = 200
me.city.density = () => me.city.population / me.city.area
```

### Language-agnostic

`.me` isn't English underneath — it's structure. Swap the vocabulary and the algebra doesn't change:

```ts
me.shop.items[1].price(100)
me.tienda.articulos[1].precio(100)
me.店舗.商品[1].価格(100)
```

Three languages, three developers, one identical node. **Meaning is structure, not vocabulary** — the same reason a human writing Spanish and an agent writing English can resolve the same graph without translating anything.

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
