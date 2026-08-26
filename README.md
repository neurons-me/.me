
# .me

**Own your knowledge.**

<div class="static-hero">
<table border="0" cellspacing="0" cellpadding="0" style="border:none;">
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


## Getting Started
Install .me. Open your terminal and run:

```bash
git clone https://github.com/neurons-me/.me.git
cd .me
```

##### Choose

**🔷 [Typescript](https://neurons-me.github.io/.me/Typescript/)**

```bash
cd Typescript
npm install
npm run build
```

🦀 [Rust](https://neurons-me.github.io/.me/Rust/) — [crates.io](https://crates.io/crates/this-me) · [docs.rs](https://docs.rs/this-me)  
🐍 [Python](https://neurons-me.github.io/.me/Python/) — Not Available Yet.

## Demos

#### **[⟐🤖 ⇆ 🤖⟐ Robots That Understand Context](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)** — Same object, different meaning.

```bash
node tests/Demos/Robots_Contexts.ts
```

#### **[∴ 🏙️ ◉ 📡 ⌬ Smart City](https://neurons-me.github.io/.me/docs/Smart-Cities.html)** — A city reacting as one connected graph.

```bash
node tests/Demos/Smart_City.ts
```

#### **[𓀠 ⟐👤 ⇄ 👥 ⌬ ∴ 𓀠 Social Graph](https://neurons-me.github.io/.me/docs/Social-Graph.html)** — Identity, trust, and relationships.

```bash
node tests/Demos/Social_Graph.ts
```

#### **[🏪 ⇄ 📦 ⇄ 📈 CoffeeShops](https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html)** — Inventory and operations as a graph.

```bash
node tests/Demos/ShopsExample.ts
```

#### **[💳 ⇄ 👥 ⌬ ⚖️ ∴ Splitting your Bill](https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html)** — Shared expenses with automatic settlement.

```bash
node tests/Demos/WalletSplit.ts
```

#### **[🌐 ⇄ ⌬ 𓇳 ⌬ ⇄ 🌐 Hemisphere Scale](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html)** — 1 million sensors. One flips. Only 6 recompute. The other 999,994 untouched. That's **[O(k)](https://neurons-me.github.io/.me/docs/Architecture.html).**

```bash
node tests/Demos/Hemisphere_1M.ts
```

#### **[⚡⚡⚡ ⟶ ⌬⌬⌬⌬ Extreme Fan-Out](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html)** — One write updates 100k dependents.

```bash
node tests/Demos/Root_Fanout_100k.ts
```

##### **[ ⌬ ⊚ View all demos → ](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Demos)**

---

# 𓂀 Syntax - me.whatever(what)

**Subject. Verb. Object**. It reads as a sentence because it is one.

```ts
import Me from "this.me"
const me = new Me()

me["@"]("abella") // you are Abella

me.users.ana.name("Ana")
me.users.ana.age(22)

me.friends.ana["->"]("users.ana") // pointer

// one graph declaration can replace:
// migration, derivation, query, trigger, validation plumbing
me.friends["[i]"]["="]("is_adult", "age >= 18")

me("friends.ana.is_adult")  // -> true
me("friends[age > 18].name") // ->  { ana: "Ana" }
```

`me` is the subject, `.whatever` is the verb (capability), `(what)` is the object.

Any path you write becomes a node. **No schema. No migrations.** If it changes, everything that depends on it updates automatically.

```ts
me.users.ana.age(22)
me.friends.ana["->"]("users.ana")
me.friends["[i]"]["="]("is_adult", "age >= 18")
me("friends.ana.is_adult")
me("friends[age > 18].name")
```

You can actually see the graph language emerging.

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

Same grammar, 4 robots or 100k nodes. `me.robots["[i]"]` in [Robots](https://neurons-me.github.io/Robots-Versi%C3%B3n-Humana.html) and `me.dep[100000]` in Fan-Out operate on the same [graph model.](https://neurons-me.github.io/Inverted-Dependency-Indexing-Beautiful-Viz.html)

##### Language-agnostic: 

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

In the [Extreme Fan-Out](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html) benchmark, one write propagates to 100,000 dependents in 6252ms — about 62μs per dependent.

### Real Performance

**.me** uses **true O(K) reactivity** — when a value changes, only its actual dependents update. *Not the whole graph.*

More importantly, propagation cost follows K, not total graph size. In the [Hemisphere](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html) benchmark, a graph with 1,000,000 nodes changes one sensor and recomputes exactly 6 dependents in 0.256ms.

- 1 million nodes in memory
- 1 sensor changed → exactly **6 dependent nodes** recomputed
- Time to propagate: **0.256ms**
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
