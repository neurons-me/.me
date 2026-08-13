<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me
##### Minimal and Expressive.

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

- **Containment order:** `q ≤ p ⟺ q is descendant of p` — meaning is by *position in your graph* ([SpaceStructure](https://suign.github.io/SpaceStructure.html#base-structure), [formula](https://suign.github.io/Equations.html#space-structure)).

```
me 
├─ family.photos 
├─ family.messages 
├─ work.neurons_me 
├─ work.github 
├─ music.playlists 
└─ ai.claude
```

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

That is unlimited in form because **.me** is [semantic algebra](https://suign.github.io/DigitalSpaceAlgebra.html). It does not begin by asking permission. It lets an identity produce structured claims, private branches, derivations, links, proofs, memories.

But **.me** alone **is local.** It says:

> “This identity, from this seed, computes this universe.”

The [namespace (ledger)](https://neurons-me.github.io/NRP/) is different. That layer says:

> “This **identity** testified this claim, and now there is **a public or shared witness record**.”

So the ledger does **not** make the claim true.

 It makes the claim **[attested](https://suign.github.io/trust.me.html)**.

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

→ [Seed, formalized](https://neurons-me.github.io/.me/docs/Seed.html) · [SEED → Monad](https://neurons-me.github.io/SEED-Monad-Minimal.html) · [The Ontology of Identity](https://suign.github.io/OntologyOfIdentity.html) — self-validation, cryptography as gravity · [whois.me](https://suign.github.io/sui-Gn.html)

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

→ [The Semantic Graph Engine](https://suign.github.io/SemanticGraphEngine.html) — schema as a node, not a table · [me.whatever(what)](https://suign.github.io/MeWhateverWhat.html) — the syntax, formalized

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

→ [The Algebra of Encrypted Audiences](https://suign.github.io/EncryptedAudiences.html) — the `_` operator, formalized · [The Encrypted Island](https://suign.github.io/EncryptedIsland.html) · [T ⊥ A — infographic](https://suign.github.io/Perp-Infographic.html) · [Robots × Encrypted Audiences — infographic](https://neurons-me.github.io/Robots-%C3%97-Encrypted-Audiences-Infographic.html)

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

→ [Inverted Dependency Indexing](https://suign.github.io/InvertedIndex.html) · [What is O(k)?](https://suign.github.io/WhatIsOK.html) — real benchmark numbers · [cost(mutation) = O(k) — infographic](https://suign.github.io/Inverted-Dependency-Indexing-Infographic.html) · [neurons-me's own viz](https://neurons-me.github.io/Inverted-Dependency-Indexing-Beautiful-Viz.html)

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

→ [me.explain() — Why Did You Say That?](https://suign.github.io/Explain.html) · [visual landing](https://suign.github.io/me-Explain-Minimal-Landing.html) · [neurons-me's own copy](https://neurons-me.github.io/me.explain.why.did.you.say.that.html)

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

→ [NRP — Namespace Resolution Protocol](https://neurons-me.github.io/NRP/) · [status](https://neurons-me.github.io/NRP/status.html) · [Decentralized Identity](https://suign.github.io/DecentralizedIdentity.html) — issuer vs. reader as two different questions · [Centralize the Self, Distribute the Data](https://suign.github.io/CentralizeTheSelf.html)

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

→ [Cryptographic Set-Chemistry on Audiences](https://suign.github.io/SetChemistry.html) — the formal version of this exact construction · [The Algebra of Encrypted Audiences](https://suign.github.io/EncryptedAudiences.html)

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

→ [What is O(k)?](https://suign.github.io/WhatIsOK.html) — the same kind of numbers, sourced and verified · [cost(mutation) = O(k) — infographic](https://suign.github.io/Inverted-Dependency-Indexing-Infographic.html)

## License

**MIT** — [github.com/neurons-me/.me](https://github.com/neurons-me/.me)

---

### Knowledge Graph

**Concepts** — [suign.github.io](https://suign.github.io/)

[whois.me](https://suign.github.io/sui-Gn.html) · [The Equations](https://suign.github.io/Equations.html) — every formula on this site, glossaried · [Digital Space Algebra](https://suign.github.io/DigitalSpaceAlgebra.html) — index · [SpaceStructure](https://suign.github.io/SpaceStructure.html) · [Encrypted Audiences](https://suign.github.io/EncryptedAudiences.html) · [Cryptographic Set-Chemistry](https://suign.github.io/SetChemistry.html) · [Encrypted Island](https://suign.github.io/EncryptedIsland.html) · [Inverted Dependency Indexing](https://suign.github.io/InvertedIndex.html) · [What is O(k)?](https://suign.github.io/WhatIsOK.html) · [The Semantic Graph Engine](https://suign.github.io/SemanticGraphEngine.html) · [The Ontology of Identity](https://suign.github.io/OntologyOfIdentity.html) · [Decentralized Identity](https://suign.github.io/DecentralizedIdentity.html) · [Centralize the Self, Distribute the Data](https://suign.github.io/CentralizeTheSelf.html) · [me.whatever(what)](https://suign.github.io/MeWhateverWhat.html)

**Infographics**

[The Equations — visual edition](https://suign.github.io/Equations-Visual-Infographics-Edition.html) · [T ⊥ A](https://suign.github.io/Perp-Infographic.html) · [cost(mutation) = O(k)](https://suign.github.io/Inverted-Dependency-Indexing-Infographic.html) · [n=1 ⟹ f≤0](https://suign.github.io/Zero-Byzantine-Faults-Infographic.html) · [me.explain() — minimal landing](https://suign.github.io/me-Explain-Minimal-Landing.html) · [Inverted Dependency Indexing, neurons-me's own viz](https://neurons-me.github.io/Inverted-Dependency-Indexing-Beautiful-Viz.html) · [Robots × Encrypted Audiences](https://neurons-me.github.io/Robots-%C3%97-Encrypted-Audiences-Infographic.html)

**Docs & protocol** — [neurons-me.github.io](https://neurons-me.github.io/)

[NRP — Namespace Resolution Protocol](https://neurons-me.github.io/NRP/) · [Glossary](https://neurons-me.github.io/Glossary.html) · [SEED → Monad](https://neurons-me.github.io/SEED-Monad-Minimal.html) · [Seed](https://neurons-me.github.io/.me/docs/Seed.html) · [Syntax](https://neurons-me.github.io/.me/docs/Syntax.html) · [Architecture](https://neurons-me.github.io/.me/docs/Architecture.html) · [One Line That Replaces Five](https://neurons-me.github.io/.me/docs/One-Line-That-Replaces-Five.html) · [Full TypeDocs](https://neurons-me.github.io/.me/Typescript/typedocs/)

**Notes**

[me.explain() — Why Did You Say That?](https://suign.github.io/Explain.html) · [trust.me](https://suign.github.io/trust.me.html) · [byzantine-prompt](https://suign.github.io/byzantine-prompt.html)

