---
layout: gui-doc
title: "The Axioms of .me"
description: "The invariants the .me kernel must always respect (A-struct-0, A0–A9): each stated, then demonstrated live in the page on this.me 4.2.1."
image: https://neurons-me.github.io/.me/docs/assets/card-axioms.webp
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
crumb: Axioms
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/axioms-live/axioms-live.js?v=4
related:
  - Primitives.html
  - Operators.html
  - Syntax.html
  - Pointer-Composition.html
view_content_name: "Doc - The Axioms of .me"
view_content_category: "Docs"
---


# 𓋹 The Axioms of .me

Built on the [Primitives](./Primitives.html). Each axiom is stated, then demonstrated; every line marked `//=` is checked against what the kernel returns.

<div class="axiom-kernel" markdown="0"></div>

## A-struct-0 | Unified Callable Surface
{: .doc-axiom}

**Statement.** The kernel is one value that is at once a function and an object: every path reached from it is again callable, and a call on a path writes it.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A-struct-0" markdown="0"><pre><code>typeof me                       //= "function"
typeof me.profile.name          //= "function"
me.profile.name("Abella");
me("profile.name")              //= "Abella"</code></pre></div>

Also checked by [A-struct-0](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L102) in `axioms.test.ts`.
{: .doc-axiom-test}

## A0 | Secret Root Stealth
{: .doc-axiom}

**Statement.** The root of a secret scope does not resolve. Its leaves resolve by their full path, and public paths are unaffected.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A0" markdown="0"><pre><code>me.ledger.host("localhost:8161");
me.wallet["_"]("secret");
me.wallet.income(100);
me("ledger.host")               //= "localhost:8161"
me("wallet")                    //= undefined
me("wallet.income")             //= 100</code></pre></div>

Also checked by [A0](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L131) in `axioms.test.ts`.
{: .doc-axiom-test}

## A1 | Identity Normalization (@)
{: .doc-axiom}

**Statement.** An identity claim is normalized before it is recorded at the root, and a claim that is not a valid name is refused.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A1" markdown="0"><pre><code>me["@"]("Abella");
lastMemory().operator           //= "@"
lastMemory().value.__id         //= "abella"
throws(() =&gt; me["@"]("a b"))    //= true</code></pre></div>

Also checked by [A1](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L167) in `axioms.test.ts`.
{: .doc-axiom-test}

## A2 | Path-Bound Secret Scopes (_)
{: .doc-axiom}

**Statement.** Secrecy belongs to a path, not to the instance: declaring `_` on a path hides that path's root and leaves the rest of the tree as it was.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A2" markdown="0"><pre><code>me.profile.kind("public-profile");
me.profile["_"]("alpha");
me.profile.name("Abella");
me("profile")                   //= undefined
me("profile.name")              //= "Abella"</code></pre></div>

Also checked by [A2](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L205) in `axioms.test.ts`.
{: .doc-axiom-test}

## A3 | Noise Reset (~)
{: .doc-axiom}

**Statement.** `~` cuts secret inheritance at a path: a secret declared after it derives a different effective secret than the one before it.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A3" markdown="0"><pre><code>me.wallet["_"]("alpha");
me.wallet.hidden.notes("alpha-note");
me.wallet["~"]("noise");
me.wallet["_"]("beta");
me.wallet.hidden.seed("beta-seed");
me("wallet")                    //= undefined
me("wallet.hidden.seed")        //= "beta-seed"
secretOf("wallet.hidden.notes") !== secretOf("wallet.hidden.seed")   //= true</code></pre></div>

Also checked by [A3](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L236) · [A3b](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L278) · [A3c](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L310) in `axioms.test.ts`.
{: .doc-axiom-test}

## A4 | Structural Pointers (__ / ->)
{: .doc-axiom}

**Statement.** A pointer is stored as data (`{ __ptr }`) and is followed when a path is read through it.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A4" markdown="0"><pre><code>me.wallet["_"]("secret");
me.wallet.income(1000);
me.profile.cards.primary["__"]("wallet");
me("profile.cards.primary")         //= { __ptr: "wallet" }
me("profile.cards.primary.income")  //= 1000</code></pre></div>

Also checked by [A4](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L340) in `axioms.test.ts`.
{: .doc-axiom-test}

## A5 | Query as Memory Event (?)
{: .doc-axiom}

**Statement.** A query is recorded in memory as a `?` event, and it does not reveal the root of the secret scope it reads.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A5" markdown="0"><pre><code>me.profile["_"]("alpha");
me.profile.name("Abella");
me.profile.city("Veracruz");
me.profile["?"]("name", "city");
lastMemory().operator           //= "?"
me("profile")                   //= undefined
me("profile.name")              //= "Abella"</code></pre></div>

Also checked by [A5](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L372) in `axioms.test.ts`.
{: .doc-axiom-test}

## A6 | Tombstone Remove (-)
{: .doc-axiom}

**Statement.** After `-`, a removed path no longer resolves to the value it had.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A6" markdown="0"><pre><code>me.wallet["_"]("secret");
me.wallet.hidden.notes("private note");
me("wallet.hidden.notes")       //= "private note"
me.wallet.hidden["-"]("notes");
me("wallet.hidden.notes") !== "private note"   //= true</code></pre></div>

Also checked by [A6](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L405) in `axioms.test.ts`.
{: .doc-axiom-test}

## A7 | Public + Secret Coexistence
{: .doc-axiom}

**Statement.** Secret declarations and noise resets do not change what the public paths resolve to.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A7" markdown="0"><pre><code>me.ledger.host("localhost:8161");
me.profile["_"]("alpha");
me.profile.name("Abella");
me.profile["~"]("noise");
me.profile["_"]("beta");
me.profile.hidden.seed("beta-seed");
me.ledger.status("ok");
me("ledger.host")               //= "localhost:8161"
me("ledger.status")             //= "ok"
me("profile")                   //= undefined</code></pre></div>

Also checked by [A7](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L437) in `axioms.test.ts`.
{: .doc-axiom-test}

## A8 | Hash Chain Integrity
{: .doc-axiom}

**Statement.** Every memory links to the hash of the one before it, starting from an empty hash, and its own hash can be recomputed from its fields.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A8" markdown="0"><pre><code>me.ledger.host("localhost:8161");
me.wallet["_"]("secret");
me.wallet.balance(1000);
memories()[0].prevHash ?? ""    //= ""
memories().every((m, i) =&gt; (m.prevHash ?? "") === (i ? memories()[i - 1].hash : ""))   //= true
memories().every((m) =&gt; m.hash === rehash(m))   //= true</code></pre></div>

Also checked by [A8](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L474) in `axioms.test.ts`.
{: .doc-axiom-test}

## A9 | Deterministic Conflict Resolution (LWW)
{: .doc-axiom}

**Statement.** When writes to one path collide, the last write wins by logical order (seq, then hash), not by the physical clock; the index and the read agree on the winner.
{: .doc-axiom-statement}

<div class="axiom-proof" data-axiom="A9" markdown="0"><pre><code>Date.now = () =&gt; 1000; me.wallet.balance(10);
Date.now = () =&gt; 2000; me.wallet.balance(20);
me("wallet.balance")            //= 20
Date.now = () =&gt; 3000; me.wallet.balance(111);
me.wallet.balance(222);
me("wallet.balance")            //= 222
me.index["wallet.balance"]      //= 222</code></pre></div>

Also checked by [A9](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts#L536) in `axioms.test.ts`.
{: .doc-axiom-test}

---

### Why This Combination Is Powerful

Together, these axioms enable real-world use cases that traditional data structures cannot easily achieve:

- **Personal Digital Identity**: You can have a single source of truth for your online self (`me["@"]("jabella.e")`) with public profiles and deeply hidden private sections that remain structurally coherent.
- **Secure Personal Vault**: Store sensitive data (wallets, keys, notes) that can be partially hidden while still being traversable and pointer-referenced from public areas.
- **Auditable Memory**: Every change, query, or deletion is logged with cryptographic integrity, making `.me` suitable for self-sovereign identity or personal knowledge bases where trust and history matter.
- **Composability**: Pointers + secrecy + queries allow complex data relationships without duplication or security leaks.
- **Deterministic & Tamper-evident**: Ideal for decentralized systems, personal agents, or any application where data integrity and reproducibility are critical.

In short, `.me` gives you a living, programmable personal memory that feels like a natural extension of yourself — flexible, private when needed, and provably consistent.

### How the demonstrations run

Each snippet runs on a fresh `new ME()` from the unmodified [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) (jsDelivr, unpkg fallback), whose sha256 is checked in the browser before it is imported. Statements run in order; a line `expression //= expected` is evaluated at that point and compared with `expected`. The helpers (`memories`, `lastMemory`, `secretOf`, `throws`, `rehash`) are listed in the kernel panel at the top. The runner is [axioms-live.js](https://github.com/neurons-me/.me/blob/main/assets/axioms-live/axioms-live.js).

### The test suite

The same axioms are checked in Node by [`Typescript/tests/axioms.test.ts`](https://github.com/neurons-me/.me/blob/main/Typescript/tests/axioms.test.ts): one case per axiom (A3 has two more, A3b and A3c, for nested secrets), each asserting its proofs as `expected` / `returned` pairs. From `Typescript/`, after `npm run build` (the test imports `../dist/index.js`), on Node ≥ 22.6:

```bash
node tests/axioms.test.ts
```

**Expected:** `AXIOMS SUMMARY: 13/13 passed`. Run against this.me 4.2.1 from npm: 13/13 passed, exit code 0. Case-by-case: [TypeScript validation](https://neurons-me.github.io/.me/Typescript/typedocs/Axioms.html).

---

**∴ Witness our seal**
