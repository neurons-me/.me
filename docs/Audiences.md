---
layout: gui-doc
title: "Audiences"
description: "Who can open a value, as a small algebra: OR (any member), AND (the whole coalition, XOR shares), minus (drop a member at seal time). Status per implementation of this.me, with a verified example on npm this.me 4.2.1."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/Audiences.html
permalink: /docs/Audiences.html
crumb: audiences
image: https://neurons-me.github.io/.me/docs/assets/me-og.jpg
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=2
  - /assets/audience-venn/audience-venn.js?v=1
related:
  - Algebra-of-Contexts.html
  - Seed.html
  - Axioms.html
  - https://neurons-me.github.io/encrypted-audiences/
  - https://suign.github.io/SetChemistry.html
view_content_name: "Doc - Audiences"
view_content_category: "Docs"
---

# ∪ Audiences

Who can open a value.

> An **audience** is the set of identities that can read a value. It is not a list checked at the door: it is the set of keys that can decrypt it.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Theory: [Encrypted Audiences](https://neurons-me.github.io/encrypted-audiences/) and [Cryptographic Set-Chemistry](https://suign.github.io/SetChemistry.html). This page is language-neutral; each implementation is linked at the end.
{: .doc-kernel-more}

## Three operations

| Operation | Opens for | How |
|---|---|---|
| **OR** `a ∪ b` | any one member | one content key, wrapped once per member |
| **AND** `a ∩ b` | only the whole coalition | the content key split into XOR shares, one per member |
| **minus** `A \ x` | everyone in `A` except `x` | resolved at seal time; revoking later means resealing with a new key |

```txt
K = s₁ ⊕ s₂ ⊕ … ⊕ sₙ        AND: every share needed
W_i = wrap(pub_i, K)          OR: any one wrap opens K
```

There is no NOT and no threshold-k (Shamir). A key, once read, cannot be un-read: removal works forward, by resealing.

## The smallest audience: `{self}`

A secret scope is an audience of one. The owner reads; a guest gets nothing.

```ts
import { ME } from "this.me";
const me = new ME() as any;

me.wallet["_"]("vault-key");
me.wallet.note("private");
me("wallet.note")              // "private"
me.as(null)("wallet.note")     // undefined (guest)
```
{: .me-run}

## OR from npm 4.2.1

The npm package exports the wrapping primitive, so an OR audience can be built by hand: wrap one content key for each member.

```ts
const a = await ME.generateP256KeyPair();
const b = await ME.generateP256KeyPair();
const out = await ME.generateP256KeyPair();
const S = "content-key-123";

const Wa = await ME.wrapSecretV1({ secret: S, recipientPublicKey: a.publicKey, kid: "a", class: "identity-key" });
const Wb = await ME.wrapSecretV1({ secret: S, recipientPublicKey: b.publicKey, kid: "b", class: "identity-key" });

await ME.unwrapSecretV1(Wa, a.privateKey, "utf8");    // "content-key-123"
await ME.unwrapSecretV1(Wb, b.privateKey, "utf8");    // "content-key-123"
await ME.unwrapSecretV1(Wa, out.privateKey, "utf8");  // throws OperationError
```

Run on Node with npm this.me 4.2.1; the outputs above are the real ones. Each wrap is `{ version, class, kid, publicKey, encryption, policy }`. P-256 key pairs are generated randomly, not derived from the seed. Getting each member's public key to the sender is not solved by the kernel.

### Live: choose the audience

Click a circle to add or remove that identity. Each change wraps a fresh content key `K` for every member with `ME.wrapSecretV1`, then every party tries `ME.unwrapSecretV1`, here, on this.me 4.2.1 from npm. Members get `K`; the others get the kernel's real error.

<div class="audience-venn"></div>

## AND and minus

Not exported by npm 4.2.1, so not run here. They live in the 4.2.1 source, [audience.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/audience.ts), tested by [audience-algebra.test.ts](https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/tests/Security/audience-algebra.test.ts) (16/16).

<div class="doc-svg" data-max="560px" markdown="0"><svg viewBox="0 0 560 150" role="img" aria-label="AND: the key is split into XOR shares, one per member, all needed. Minus: the member is dropped at seal time." xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="13" fill="currentColor"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="70" cy="70" r="42"/><circle cx="125" cy="70" r="42"/><circle cx="380" cy="60" r="34"/><circle cx="425" cy="60" r="34"/><circle cx="402" cy="98" r="34" stroke-dasharray="5 5" opacity=".55"/></g><path d="M97.5 38 a42 42 0 0 1 0 64 a42 42 0 0 1 0 -64z" fill="currentColor" opacity=".22"/><text x="52" y="74" text-anchor="middle">ana</text><text x="143" y="74" text-anchor="middle">bob</text><text x="98" y="132" text-anchor="middle">K = s_ana ⊕ s_bob</text><text x="98" y="147" text-anchor="middle" opacity=".7">all shares needed</text><text x="362" y="56" text-anchor="middle">ana</text><text x="443" y="56" text-anchor="middle">bob</text><text x="402" y="114" text-anchor="middle" opacity=".55">eve</text><line x1="384" y1="110" x2="420" y2="110" stroke="currentColor" stroke-width="2"/><text x="402" y="147" text-anchor="middle">{ana, bob, eve} \ eve</text></svg><figcaption>AND: each member wraps only a share; all of them together rebuild <code>K</code> (<a href="https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/audience.ts#L297">splitXor</a>). Minus: drops every coalition containing the member, once, when sealing (<a href="https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/audience.ts#L101-L107">minus L101–107</a>); seal and open: <a href="https://github.com/neurons-me/.me/blob/v4.2.1/Typescript/src/audience.ts#L207-L247">L207–247</a>.</figcaption></div>

## Status by implementation

| | OR / AND / minus | Wrapped secret (one recipient) |
|---|---|---|
| **TypeScript** this.me 4.2.1 | implemented and tested in the source; **not exported** by the npm package | exported (`ME.wrapSecretV1`, `ME.unwrapSecretV1`) |
| **Rust** rust-v0.3.3 | none | implemented and tested |
| **Python** | no implementation yet | no implementation yet |

The sealed format is an envelope tree, `{ version, audience, epoch, ciphertext, tree }`, whose nodes are `leaf` (one wrap), `or` and `and`.

## Implementations

<div class="doc-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/.me/Typescript/typedocs/guides/Secrets.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-seed.webp" alt="Secrets guide"><span class="card-kind">TypeScript</span><span class="card-title">Secrets</span><span class="card-desc">Secret scopes in this.me 4.2.1: what <code>["_"]</code> seals and who can read it.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/Typescript/typedocs/Identity-Bound-Secrets.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-tests.webp" alt="Identity-bound secrets"><span class="card-kind">TypeScript</span><span class="card-title">Identity-Bound Secrets</span><span class="card-desc">Seed, identity hash and keys bound to an identity.</span></a>
<a class="card" href="https://github.com/neurons-me/.me/blob/rust-v0.3.3/Rust/docs/API.md"><img src="https://neurons-me.github.io/.me/docs/assets/card-rust-api.webp" alt="Rust API"><span class="card-kind">Rust</span><span class="card-title">Rust API (rust-v0.3.3)</span><span class="card-desc">Wrapped secrets; no audience algebra.</span></a>
</div>

Python: no implementation yet.
