
# .me

**Own your knowledge.**

<table border="0" cellspacing="0" cellpadding="0" style="border:none;">
  <tr>
    <td width="260" align="center" valign="middle">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760915741/this.me-removebg-preview_1_nrj6pe.png" />
        <img id="me-identity-img" src="./docs/assets/this.me.png" alt=".me as a coordinate" width="200" title="ID Hash" />
      </picture>
      <div id="me-identity-hash" title="ID Hash" style="margin-top:6px; font-family:monospace; font-size:0.65rem; color:#6b7280; opacity:0.75; letter-spacing:0.02em; cursor:default;">…</div>
      <a href="https://neurons-me.github.io/.me/docs/Seed.html" target="blank" title="identityHash = keccak256(&quot;this.me/identity:v1::&quot; + seed) — read the SEED doc" style="display:block; margin-top:2px; font-family:monospace; font-size:0.6rem; color:#58a6ff; letter-spacing:0.03em; text-decoration:underline;">keccak-256</a>
    </td>
    <td valign="middle">
      <h2>Hello, I am <input
        id="me-seed-input"
        type="text"
        placeholder=".me"
        aria-label="Type your own name"
        spellcheck="false"
        autocomplete="off"
        oninput="this.style.width = ((this.value.length || this.placeholder.length) + 1) + 'ch'; updateMeIdentityHash();"
        onfocus="this.dataset.ph = this.dataset.ph || this.placeholder; this.placeholder = ''; updateMeIdentityHash();"
        onblur="if (!this.value) this.placeholder = this.dataset.ph; updateMeIdentityHash();"
        style="font: inherit; font-weight: 700; font-family: monospace; color: inherit; background: transparent; border: none; border-bottom: 2px solid currentColor; outline: none; width: 4ch; padding: 0 2px;"
      ></h2>
      Your <b>identity</b> unified in <b>one reactive graph.</b><br>
      <h5><a href="https://neurons-me.github.io/.me/docs" target="blank">⌬ Docs</a>   <a href="https://neurons-me.github.io/.me/docs" target="blank">⬡ Getting Started</a></h5>
    </td>
  </tr>
</table>

<script src="https://cdn.jsdelivr.net/npm/js-sha3@0.9.3/build/sha3.min.js"></script>
<script>
  // Mirrors me.ts: identityHash = keccak256("this.me/identity:v1::" + seed)
  // seed here is the literal text typed (or ".me" by default) — public,
  // deterministic, no secret involved. See me/Typescript/src/me.ts.
  function updateMeIdentityHash() {
    var input = document.getElementById('me-seed-input');
    var img = document.getElementById('me-identity-img');
    var label = document.getElementById('me-identity-hash');
    if (!input || !img || !label || typeof keccak256 !== 'function') return;
    var seed = input.value || input.placeholder || '.me';
    var hash = keccak256('this.me/identity:v1::' + seed);
    var tooltip = 'ID Hash: ' + hash;
    img.title = tooltip;
    label.title = tooltip;
    label.textContent = hash.slice(0, 8) + '…' + hash.slice(-6);
  }
  updateMeIdentityHash();
</script>

### Demos

---

**[⟐🤖 ⇄ ⇆ 🤖⟐ Robots That Understand Context](https://neurons-me.github.io/.me/docs/Robots-That-Understand-Context.html)** — Same object, different meaning.

**[∴ 🏙️ ◉ 📡 ⌬ Smart City](https://neurons-me.github.io/.me/docs/Smart-Cities.html)** — A city reacting as one connected graph.

**[𓀠𓀠 ⟐👤 ⇄ 👥 ⌬ ∴ 𓀠 Social Graph](https://neurons-me.github.io/.me/docs/Social-Graph.html)** — Identity, trust, and relationships.

**[🏪 ⇄ 📦 ⇄ 📈 CoffeeShops](https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html)** — Inventory and operations as a graph.

**[💳 ⇄ 👥 ⌬ ⚖️ ∴ Splitting your Bill](https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html)** — Shared expenses with automatic settlement.

**[🌐 ⇄ ⌬ 𓇳 ⌬ ⇄ 🌐 Hemisphere Scale](https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html)** — 1 million sensors. One flips. Only 6 recompute. The other 999,994 untouched. That's [O(k)](https://neurons-me.github.io/.me/docs/Architecture.html).

**[⚡⚡⚡ ⟶ ⌬⌬⌬⌬ Extreme Fan-Out](https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html)** — One write updates 100k dependents.

**[ ⌬ ⊚ View all demos → ](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Demos)**

---

### 𓂀 Syntax

`.me` uses an infinite proxy — any path you write becomes **a node in the graph.**
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
