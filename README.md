<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me
**Own your knowledge graph.**

Agents, notes, relationships, wallets, groups, and secrets — unified in one reactive tree.

---

## What is neurons.me?

**[neurons.me](https://neurons.me)** is a sovereign semantic compute stack. It lets any person or machine own a cryptographic identity, bind it to a namespace, run it as an HTTP daemon, and render it as a user interface — without depending on any central service.

The full stack, from bottom to top:

| Layer | Package | Role |
|---|---|---|
| **Kernel** | [`this.me`](https://neurons-me.github.io/.me/) | Schema-free reactive memory. Derives identity from a seed. No server, no cloud. |
| **Identity** | [`cleaker`](https://neurons-me.github.io/Cleaker/) | Namespace resolver. Projects `.me` into a surface. *Who am I, here.* |
| **Runtime** | [`monad`](https://neurons-me.github.io/monad/) | HTTP daemon. Exposes a namespace over HTTP. Runs the mesh. |
| **Gateway** | [`netget`](https://neurons-me.github.io/netget/) | Routes incoming requests to the correct monad via OpenResty. |
| **Interface** | [`this.gui`](https://neurons-me.github.io/GUI/) | React component library. Renders the semantic surface. |

## This package: `this.me`

`this.me` is the **root kernel** of the neurons.me stack. Every other package depends on it.

It is a schema-free, reactive, cryptographic memory tree. You create one with a seed — two strings that derive a deterministic identity — and then write anything to it using infinite proxy syntax. It runs fully offline. There is no database, no schema, no server required.

```ts
import ME from 'this.me'

const me = ME('username', 'password')  // deterministic — same inputs = same identity

me.profile.name = 'Sui'         // write anything
me.city.population = 700_000
me.city.density = () => me.city.population / me.city.area  // derived, auto-updates

// structural privacy — this branch is cryptographically invisible from outside
me.wallet['_'].balance = 1000
```

**Consumed by:** `cleaker` (mounts this kernel into a namespace), `monad` (exposes it over HTTP), `this.gui` (reads and renders it).

---

### Getting Started
**Clone the Github Repository:** run the following command in your terminal.

```bash
git clone https://github.com/neurons-me/.me.git
```

Once cloned, select your preferred language and run the corresponding setup command:

|     |  Command                     | Status            | Documentation                                                |
| ----------- | --------------------------- | ----------------- | ------------------------------------------------------------ |
| **Typescript** | `cd .me/Typescript && npm install` | [![npm](https://img.shields.io/npm/v/this.me/latest?label=latest)](https://www.npmjs.com/package/this.me) | [node.js Docs ⟡ ](https://neurons-me.github.io/.me/Typescript/typedocs/) |
| **Python**  | `cd .me/Python/`               | Not Available     | [Pip Docs 𓆚](https://neurons-me.github.io/.me/Python/)          |
| **Rust**    | `cd .me/Rust/`             | Not Available     | [Rust Docs](https://neurons-me.github.io/.me/Rust/)         |

### Demos 𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃𓂃
**[⟶ ⇄ ⇆ ↔⟶ ⇄ 🤖🤖🤖 Robots that Understand Context 🤖⟐🤖 ⟶ ⇄ ⇆ ↔⟶ ⇄ ⇆ ↔ Same object, different meaning. → ](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)** **[⌬◉⌬◉⌬ 🏙️🏙️🏙️ Smart City 🏙️🏙️🏙️📡⌬◉⌬⟶ ∴ — A full city reacting in real time as interconnected nodes. →](https://neurons-me.github.io/.me/docs/Smart-Cities.html)** **[🌐🌐🌐 Hemisphere Scale 🌐🌐🌐 — 1 million nodes with cross-domain reactive updates. 𓂀 𓁹 𓇌 𓆚 𓋹 𓏺𓂀 𓁹 𓇌 𓆚 𓋹 𓏺𓂀 𓁹 𓇌 𓆚 𓋹 𓏺 →](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Hemisphere_1M.ts)** **[⚡⚡⚡Extreme Fan-Out ⚡⚡⚡ — One write instantly updates 100k dependents. ⌬◉⌬ ⟡⟐⟡⌬◉⌬ ⟡⟐⟡⌬◉⌬ ⟡⟐⟡](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Root_Fanout_100k.ts) **

**[⌬ ⊚ View all demos → ](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Demos)** 

---

### Syntax
`.me` uses an infinite proxy — any path you write becomes a node in the graph.
No schema. No migrations. No declarations upfront.

```ts
me.city.population = 700_000
me.city.name = "Veracruz"

// derived — recomputes automatically
me.city.density = () => me.city.population / me.city.area

// context-aware
me.robot.canProceed = () => me.robot.canLift && !me.robot.needsHumanReview

// stealth — structurally invisible to outside observers  
me.wallet["_"].balance = 1000

// explain any value
me.explain("city.density")
// → { value: 3500, expression: "population / area", dependsOn: [...] }

// query across the graph
me.robots[r => r.canProceed === true].name
```

Write anything. Chain anything. The kernel figures out the dependencies.
**If it changes, everything that depends on it updates — automatically.**

## **▵** Why .me?

1. **Structural Privacy** — Private data is structurally invisible (not just hidden by rules).
2. **Full Explainability** — Every derived value can explain exactly how it was computed.
3. **Subjective Reality** — Same graph, different views per agent.

> **Local compute makes memory an OS primitive.**  
> Cloud makes it a service.

Even with 100,000 nodes needing a simultaneous recompute, you're looking at about **62 microseconds per node** (6252ms / 100k) for the full propagation. That’s incredibly consistent.

The same object can mean completely different things depending on context — and everything updates automatically when something changes. 

### Real Performance
**.me** uses **true O(K) reactivity** — when a value changes, only its actual dependents update. *Not the whole graph.*
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
