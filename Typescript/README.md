<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me

**Own your knowledge.**

## Install

```bash
npm install this.me
```

##### **Import**

```ts
import Me from "this.me";
let me = Me("ana", "secret"); //SEED derivation (keccak256)
```

**Free-form declaration:** `me.whatever.you.want("x")`.

- **Containment order:** `q ≤ p ⟺ q is descendant of p` — meaning is by *position in your graph* (SpaceStructure).

```
me 
├─ family.photos 
├─ family.messages 
├─ work.neurons_me 
├─ work.github 
├─ music.playlists 
└─ ai.claude
```

## me.whatever(x) — The syntax

#### **Pattern:** Subject-Verb-Object:

`me` **(subject/agent)** -  `.whatever` **(verb/capability)** - `(what)` **(object/input).** 

Dots build hierarchy, brackets select operator, parens execute.

```js
me.path.to.node(value) // writeme("path.to.node") // read
me.profile.name("Abella")
me.users.ana.age(22)
me.friends.ana["->"] // pointer
me.friends["[i]"]["="]("is_adult","age > 18") // broadcast derivation across all friends
me("friends[age > 18].name") // filtered read — same syntax
```

**One line replaces five:** That `is_adult = age > 18` is migration + derivation + query + trigger + validation — in SQL stack you'd write 5 places and desync.

**Language-agnostic:** `me.shop.items[1].price(100)` = `me.tienda.articulos[1].precio(100)` = `me.店舗.商品[1].価格(100)` — meaning from structure, not English words.

Operators:

- `@` identity, `_` secret scope (audience), `~` noise reset, `->` pointer, `=` derivation, `?` collect, `-` remove

**Selectors:** `[2]`, `[i]` broadcast, `[fuel >=200]`, `[1..2]`, `[[1][3]]`, `[x=>x.fuel*0.5]` — formalized as `R*(p[φ],o)` in SpaceStructure. Same operator works for 4 robots or 100k dependents (`k=100000` in benchmarks).

### [me.explain()](https://suign.github.io/Explain.html) — Why Did You Say That?

**Problem:** Ask AI **"why did you say that?"** — it generates plausible narrative, not causal trace. No privileged access to its own computation. Same shape as invisible message + AI assuring "just anchor".

What `explain()` actually is: Not generation. Lookup.

```js
explain("robots.surgeon.canProceed")→{  
  path: "robots.surgeon.canProceed",  
  value: true,  
  expr: "canLift && softGripReady &&!needsHumanReview...", 
    derivation: {    
      inputs: [ {
        label:"canLift", 
        path:"robots.surgeon.canLift", 
        value:true, 
        origin:"public"},... ] },  
         meta: { 
               dependsOn:[...], 
        				lastComputedAt, 
        				recomputed:[...], 
                sourcePath }}
```

Built on **Inverted Dependency Indexing** — reverse index source**→**dependents, so no scan.

If not derived → `expr:null, derivation:null` — honestly reports absence, doesn't invent.

If secret-scoped `_` → masked `"●●●●", origin:"stealth"` — same as in Smart Cities demo: `explain("security.alertLevel")` shows derivation without leaking `incidentsToday`.

Structural difference:

- **Self-report:** text after fact, sampled from distribution, unverifiable.
- **`explain()`:** returns literal expression evaluated + literal inputs read. Recompute `expr(inputs)` → matches or not. Checkable.

**Proof not docs:** `tests/Demos/Robots_Contexts.ts` asserts `dependsOn` contains real paths, checked in CI. Overhead measured: `benchmark.8.explain-overhead` — p95 0.0122ms → 0.0189ms with explain, +0.007ms.

**And `prove()` next to it:** Ed25519 signed proof of expression vs root namespace — verifiable without trusting kernel.

---

You can ***say/postulate/testify*** basically anything:

```typescript
me.name("Ana") 
me.saw.event42("I was there")
me.price(100)
me.users.bob.trust(0.7) 
me.secret["_"]("key") 
me.secret.note("Only this audience can read it")
```

That is unlimited in form because **.me** is semantic algebra. It does not begin by asking permission. It lets an identity produce structured claims, private branches, derivations, links, proofs, memories.

But **.me** alone **is local.** It says:

> “This identity, from this seed, computes this universe.”

The namespace (ledger) is different. That layer says:

> “This **identity** testified this claim, and now there is **a public or shared witness record**.”

So the ledger does **not** make the claim true.

 It makes the claim **attested**.

```ts
import Me from "this.me";

const me = Me("ana", "secret");

me.name("Sui Gn");              // write
me("name");                     // read
me.wallet["_"]("wallet-key");   // encrypted branch
me.wallet.balance(12480);       // encrypted leaf inside wallet
me.order.price(100);
me.order.quantity(5);
me.order["="]("total", "price * quantity"); // derived leaf
```

## Identity

```ts
import Me from "this.me";
const me = Me("suign", "secret");
console.log(me["!"].identity());
```

`Me(who, secret)` creates a kernel from:

```txt
seed = keccak256("me.seed/compound:v1::" + who + "::" + secret)
identityHash = keccak256("this.me/identity:v1::" + seed)
```

Same `(who, secret)` means same identity hash everywhere. The seed is derived
locally and is never transmitted by the kernel.

You can also create a kernel from an explicit seed:

```ts
const me = Me("already-derived-seed");
```

The callable kernel can still be reseeded later with the same math:

```ts
const me = Me();
me("suign", "secret");
```

## Semantic Tree

```ts
import Me from "this.me";

const me = Me("suign", "secret");

// Public identity (just paths — no namespace is required)
me.name("Sui Gn");
me.bio("Building the semantic web.");

// Private data: encrypted branch
me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);

// Concrete collection with derived logic
me.people.ana.name("Ana");
me.people.ana.age(24);
me.people.pablo.name("Pablo");
me.people.pablo.age(17);
me.people["[i]"]["="]("isAdult", "age >= 18");

// Reference linking
me.users.ana.name("Ana");
me.friends.ana["->"]("users.ana");

console.log(me("name"));                // "Sui Gn"
console.log(me("wallet"));              // undefined
console.log(me("wallet.balance"));      // 12480
console.log(me("people.ana.isAdult"));  // true
console.log(me("friends.ana.name"));    // "Ana"
```

Broadcast derivations materialize on the concrete collection they are attached
to. Links are for structural reads and single-source-of-truth relationships.

## Privacy Model

```ts
import Me from "this.me";

const me = Me();

me.secrets["_"]("private-key-2026");
me.secrets.notes("Only I can see this.");

me.name("Public Name");

console.log(me("secrets"));        // undefined
console.log(me("secrets.notes"));  // "Only I can see this."
console.log(me("name"));           // "Public Name"
```

Encrypted branches keep descendants out of the public semantic index. Observers
can see that a secret scope exists, but leaf names and values under that scope
are stored as encrypted branch chunks.

## Reactivity

```ts
import Me from "this.me";

const me = Me();

me.order.price(100);
me.order.quantity(5);
me.order["="]("total", "price * quantity");

me.order.price(200);

console.log(me("order.total")); // 1000
```

**Reactivity is dependency-indexed:** when a value changes, only derivations that
actually depend on that value are marked and recomputed. The runtime supports
eager and lazy recomputation through `me.setRecomputeMode("eager" | "lazy")`.

## Search

Vector search runs over a collection-scoped encrypted branch. The current public
API names are `searchExact`, `buildVectorIndex`, and `searchVector`.

```ts
import Me from "this.me";

const me = Me();

me.memory.episodic["_"]("search-key");
me.memory.episodic[0]({
  id: 0,
  embedding: [1, 0],
  text: "semantic web",
});
me.memory.episodic[1]({
  id: 1,
  embedding: [0, 1],
  text: "robotics",
});

const exact = me.searchExact("memory.episodic", [1, 0], { k: 1 });
console.log(exact.hits[0].path); // "memory.episodic.0"

me.buildVectorIndex("memory.episodic", { k: 2, nprobe: 1 });
const approx = me.searchVector("memory.episodic", [1, 0], { k: 1, nprobe: 1 });
console.log(approx.hits[0].path); // "memory.episodic.0"
```

For large corpora, the benchmark suite writes chunked columnar encrypted vector
data and compares exact scan against IVF sidecar search.

## Explainability

```ts
import Me from "this.me";

const me = Me();

me.order.price(200);
me.order.quantity(5);
me.order["="]("total", "price * quantity");

const trace = me.explain("order.total");

console.log(trace.value);              // 1000
console.log(trace.expr);               // "price * quantity"
console.log(trace.meta.dependsOn);     // ["order.price", "order.quantity"]
```

`explain(path)` returns a structured trace: the expression, resolved inputs, origin metadata, recompute wave data, and masked values for secret inputs.

## Snapshots And Replay

```ts
import Me from "this.me";

const me = Me();
me.name("Sui Gn");

const snapshot = me.exportSnapshot();

const restored = Me();
restored.hydrate(snapshot);

console.log(restored("name")); // "Sui Gn"
```

Network tools can feed memories back into the kernel through `me.learn(memory)`
or replay a whole log with `me.replayMemories(memories)`. The kernel can learn
from the network, but identity and local computation do not depend on it.

## Role In The NRP Stack

`.me` is the root of the stack. It operates offline: no network, no server, no
external service is needed to derive identity or store local knowledge.

```txt
this.me    -> sovereign kernel. (who, secret) -> compound seed -> identity + tree.
cleaker    -> resolver. Projects .me into a namespace surface.
monad.ai   -> daemon. Exposes the namespace over HTTP and mesh surfaces.
```

When `cleaker` opens a namespace, it returns memories to the caller. Those
memories can be replayed into `.me` via `me.learn(memory)`.

## Cryptographic Set-Chemistry

Multiple parties can derive a shared namespace without a server:

```ts
import sha3 from "js-sha3";

const { keccak256 } = sha3;

function audienceSeed(seeds: string[]): string {
  return keccak256("me.seed/audience:v1::" + [...seeds].sort().join("::"));
}

console.log(audienceSeed(["frank-seed", "ana-seed"]));
```

Properties:

- `frank + ana` = `ana + frank` because seeds are sorted before hashing.
- `frank + ana + luna` derives a different compound than `frank + ana`.
- Remove any party and the namespace is no longer derivable.
- No server. No registry. The namespace exists only where the exact seed set is present.

## Verified Locally

README examples are covered by:

```bash
npm run build
npm run test:readme
npm run test:contracts 
npm run test:phase3 
```

From [.me/Typescript/](https://github.com/neurons-me/.me/tree/main/Typescript)

```bash
 node tests/fire.test.ts 
 node tests/pre-build.test.mjs
```

## Performance

|               |                                                   |
| ------------- | ------------------------------------------------- |
| `0.001ms p50` | write enqueue                                     |
| `0.003ms p50` | cascadeLazy 10-dep flush                          |
| `0.137ms p99` | cascadeLazy 10-dep flush                          |
| `~700 vps`    | sustained write with 1536-dim vectors             |
| `1M nodes`    | in-memory with sub-ms propagation                 |
| `23.2x`       | IVF search speedup over exact scan on 100k corpus |

Run benchmark details with:

```bash
npm run bench
```

## License

**MIT** — [github.com/neurons-me/.me](https://github.com/neurons-me/.me)

https://suign.github.io/
https://suign.github.io/MeWhateverWhat.html
https://suign.github.io/Explain.html
https://suign.github.io/DigitalSpaceAlgebra.html


