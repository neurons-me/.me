---
layout: gui-doc
title: .me
crumb: .me
description: A Cryptographic Identity.
image: https://suign.github.io/assets/imgs/me.png
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=3
  - /assets/audience-venn/audience-venn.js?v=2
---

<div class="me-landing-hero" markdown="0">
{% include interactive-hero.html %}
</div>

<div class="me-demo-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/Get.me.started.html"><span class="card-title">⚡ Get .me started</span><span class="card-desc">Clone the repo, pick a runtime: 🔷 TypeScript, 🦀 Rust, 🐍 Python.</span><code class="card-code">me[&quot;@&quot;](&quot;abella&quot;) // you are Abella</code></a>
<a class="card" href="https://neurons-me.github.io/social-graphs/"><span class="card-title">𓀠 Social Graphs</span><span class="card-desc">Identity, trust and relationships.</span><code class="card-code">me(&quot;friends[isAdult == true].name&quot;)</code></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Splitting-your-Bill.html"><span class="card-title">💳 Splitting your Bill</span><span class="card-desc">Shared expenses, split automatically, settled.</span><code class="card-code">me.wallets.vancouver[&quot;=&quot;](&quot;balance_ana&quot;, &quot;paid.ana - per_person&quot;)</code></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Running-your-CoffeeShops.html"><span class="card-title">☕ CoffeeShops</span><span class="card-desc">Inventory and operations as a graph.</span><code class="card-code">me.shops[&quot;[i]&quot;].menu[&quot;=&quot;](&quot;isPremium&quot;, &quot;breakfastDeal &gt; 6.5&quot;)</code></a>
<a class="card" href="https://neurons-me.github.io/robots/"><span class="card-title">🤖 Robots That Understand Context</span><span class="card-desc">Same object, different meaning.</span><code class="card-code">me.robots.surgeon.target[&quot;-&gt;&quot;](&quot;objects.canister7&quot;)</code></a>
<a class="card" href="https://neurons-me.github.io/smart-cities/"><span class="card-title">🏙️ Smart City</span><span class="card-desc">A city reacting as one connected graph.</span><code class="card-code">me.as(null)(&quot;security.alertLevel&quot;)</code></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Hemisphere-Scale.html"><span class="card-title">🌐 Hemisphere Scale</span><span class="card-desc">1 million sensors. One flips. Only 6 recompute.</span><code class="card-code">me.explain(&quot;services.generatorMode&quot;).meta.k // 6</code></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html"><span class="card-title">⚡ Extreme Fan-Out</span><span class="card-desc">One write updates 100k dependents.</span><code class="card-code">me.explain(&quot;dep[100000].out&quot;).meta.k // 100000</code></a>
<a class="card card-all" href="https://neurons-me.github.io/.me/Demos/"><img src="https://neurons-me.github.io/.me/docs/assets/demos-cover.webp" alt="Demos"><span class="card-title">View all demos →</span></a>
</div>
<p class="me-split-live" style="font-size:.9rem;margin:.6rem 0 0">💳 Splitting your Bill — Try it live: <a href="https://neurons-me.github.io/.wallet/paypal/split/" target="_blank" rel="noopener noreferrer">.wallet Split →</a> (settles through PayPal.me links)</p>

<style>.readme-demos{display:none} .me-demo-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin:0 0 12px} .me-demo-cards a.card{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid rgba(127,127,127,.35);border-radius:12px;text-decoration:none;color:inherit} .me-demo-cards .card-title{font-weight:700} .me-demo-cards .card-desc{font-size:.88rem;opacity:.8} .me-demo-cards a.card-all{padding:0;overflow:hidden;gap:0} .me-demo-cards a.card-all img{flex:1;width:100%;min-height:130px;object-fit:cover;display:block} .me-demo-cards a.card-all .card-title{padding:12px 14px;text-align:center} .me-demo-cards .card-code{font-size:.78rem;overflow-x:auto;white-space:nowrap}</style>

<div class="me-intro-head" markdown="1">

## READ.me

A declarative language for building an infinite semantic tree, a universe of meaning, and querying it by path. Every snippet below runs live on this.me 4.2.1 (npm, sha256 checked) in your browser: press ▶ Run.

</div>

<div class="me-intro-grid" markdown="1">

<section class="me-intro" markdown="1">

### Declare & resolve meaning

Any path is valid: you invent the graph as you write it, then resolve it inside a namespace.

```ts
me.profile.name("Abella.e")
me("profile.name")
```
{: .me-run .me-solo}

<p class="me-intro-more"><a href="https://neurons-me.github.io/Namespace.html">Read more: Namespace →</a></p>

</section>

<section class="me-intro" markdown="1">

### me.whatever(what) operators

Subject-Verb-Object plus an operator table: `@` identity, `_` secret, `->` link (not a copy), `=` derived rule.

```ts
me["@"]("jabellae")
me.wallet["_"]("wallet-key")
me.wallet.balance(120)
me.users.ana.age(22)
me.friends.ana["->"]("users.ana")
me.users["[i]"]["="]("isAdult", "age >= 18")
me("friends.ana.isAdult")
me.as(null)("wallet.balance")
```
{: .me-run .me-solo}

<p class="me-intro-more"><a href="https://neurons-me.github.io/.me/docs/Operators.html">Operators</a> · <a href="https://neurons-me.github.io/me.whatever.what.html">Read more: me.whatever(what) →</a></p>

</section>

<section class="me-intro wide" markdown="1">

### 𓂀 Syntax: Algebra of Digital Spaces

Two [islands](https://suign.github.io/EncryptedIsland.html) share only the exact space where they overlap, cryptographically. `_` is audience, not policy: a key derives the value or it doesn't. `T ⊥ A`: topology and audience are orthogonal, so a pointer never widens who can read.

```ts
me.islandA["_"]("keyA")
me.islandA.note("only A can read this")
me.shared["->"]("islandA")
me("shared.note")
me.as("keyB")("shared.note")
```
{: .me-run .me-solo}

Live audience: click a circle; each change wraps a fresh key per member with `ME.wrapSecretV1` and every party tries to open it, on 4.2.1.

<div class="audience-venn compact"></div>

<p class="me-intro-more"><a href="https://neurons-me.github.io/.me/docs/Audiences.html">Audiences</a> · <a href="https://neurons-me.github.io/encrypted-audiences/">Encrypted Audiences</a> · <a href="https://neurons-me.github.io/.me/docs/Syntax.html">Read more: Syntax →</a></p>

</section>

<section class="me-intro" markdown="1">

### Collections `[]` (4.2)

`x[]` counts members, `x[].f` sums a field, over the public view; the same forms work inside formulas.

```ts
me.fleet.trucks[1].fuel(100)
me.fleet.trucks[2].fuel(200)
me.fleet.trucks[3].fuel(400)
me["="]("total", "fleet.trucks[].fuel * 2")
me("fleet.trucks[]")
me("fleet.trucks[].fuel")
me("total")
```
{: .me-run .me-solo}

<p class="me-intro-more"><a href="https://neurons-me.github.io/.me/docs/Syntax.html#collection-aggregates-x-and-xf">Read more: Collections →</a></p>

</section>

<section class="me-intro" markdown="1">

### Language-agnostic

`.me` is structure, not English: swap the vocabulary and the algebra doesn't change.

```ts
me.shop.items[1].price(100)
me.tienda.articulos[1].precio(100)
me.店舗.商品[1].価格(100)
me("shop.items[1].price")
me("tienda.articulos[1].precio")
me("店舗.商品[1].価格")
```
{: .me-run .me-solo}

<p class="me-intro-more"><a href="https://neurons-me.github.io/.me/docs/Syntax.html#any-language">Read more: Syntax →</a></p>

</section>

<section class="me-intro wide" markdown="1">

### ▵ me.explain: why did you say that?

Every derived value returns the computation itself: the expression actually evaluated and the inputs that produced it. Secret inputs stay masked.

```ts
me.robots.surgeon.canLift(true)
me.robots.surgeon.softGripReady(true)
me.robots.surgeon.needsHumanReview(false)
me.robots.surgeon["="]("canProceed", "canLift && softGripReady && !needsHumanReview")
me("robots.surgeon.canProceed")
me.explain("robots.surgeon.canProceed").expr
me.explain("robots.surgeon.canProceed").meta.dependsOn
```
{: .me-run .me-solo}

<p class="me-intro-more"><a href="https://neurons-me.github.io/.me/docs/Explain.html">Read more: me.explain →</a></p>

</section>

</div>

<style>.me-intro-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px} .me-intro{border:1px solid rgba(127,127,127,.35);border-radius:12px;padding:14px;min-width:0} .me-intro.wide{grid-column:1/-1} .me-intro-more{text-align:right;font-weight:700}</style>

---

**𓅓 Own your intelligence.** · **suiGn** · MIT License © 2025 · <a href="https://neurons.me">neurons.me</a> · <a href="https://github.com/neurons-me/.me">GitHub</a>
