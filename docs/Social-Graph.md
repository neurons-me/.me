---
layout: gui-doc
title: "Social Graph"
description: "Identity, trust and relationships as paths in one graph: a 5-step walkthrough of Social_Graph.ts, runnable on this page on this.me 4.2.1, with a live graph figure (owner and guest views)."
mepath:
  - text: Docs
    url: https://neurons-me.github.io/.me/docs/
canonical: https://neurons-me.github.io/.me/docs/Social-Graph.html
permalink: /docs/Social-Graph.html
crumb: Social Graph
image: https://neurons-me.github.io/.me/docs/assets/og-social-graph.jpg
scripts:
  - /assets/me-kernel/me-kernel.js?v=1
  - /assets/me-run/me-run.js?v=3
  - /assets/social-graph-live/social-graph-live.js?v=3
related:
  - me-whatever-what.html
  - Pointer-Composition.html
  - Audiences.html
  - https://neurons-me.github.io/social-graphs/
view_content_name: "Doc - Social Graph"
view_content_category: "Docs"
---

# 𓀠 Social Graph

> Relationships, policies, and privacy are not separate systems. They are paths in the same graph.

Kernel: **this.me 4.2.1** ([npm](https://www.npmjs.com/package/this.me)) ⓘ
{: .doc-kernel}

Every ▶ Run below executes the code shown, on **one shared `new ME()`** on this page (this.me 4.2.1 from jsDelivr, sha256-checked). Running a step first runs any earlier step that has not run yet. Source: [Social_Graph.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Social_Graph.ts).
{: .doc-kernel-more}

<div class="doc-sidebar" markdown="0"><div class="social-graph-live"></div></div>

## The Tiny Mental Model

| Layer | Example | What it means |
|---|---|---|
| Identity | `me["@"]("jabellae")` | Who owns this graph |
| Profile | `profile.name`, `profile.age` | Public facts about the owner |
| Users | `users.ana`, `users.pablo` | Other people, with their own facts |
| Policies | `users["[i]"]["="]("isAdult", ...)` | Rules that apply across all users |
| Friends | `friends.ana["->"]("users.ana")` | Relationships as live pointers |
| Contacts | `contacts.ana["_"](key)` | Private data, structurally invisible |

No schema, no ORM, no join tables: paths are the model.

## Step 1: Seed

```ts
me["@"]("jabellae")
me.profile.name("J. Abella")
me.profile.age(28)
me.profile.city("Veracruz")
me.users.ana.name("Ana")
me.users.ana.age(22)
me.users.pablo.name("Pablo")
me.users.pablo.age(17)
me.users.luisa.name("Luisa")
me.users.luisa.age(31)
me("users.pablo.age")   // 17
```
{: .me-run}

## Step 2: Policies with [i]

```ts
me.users["[i]"]["="]("isAdult", "age >= 18")
me.users["[i]"]["="]("ageGapVsOwner", "age - profile.age")
me.users["[i]"]["="]("canInvite", "isAdult && age < 30")
me("users.ana.canInvite")      // true
me("users.pablo.isAdult")      // false
me("users.luisa.ageGapVsOwner") // 3
```
{: .me-run}

`[i]` derives the value for every node under `users`. `profile.age` is the owner's own age, so the gap is relative to whoever owns the graph.

## Step 3: Friends are pointers

```ts
me.friends.ana["->"]("users.ana")
me.friends.pablo["->"]("users.pablo")
me.friends.luisa["->"]("users.luisa")
me("friends.ana.name")                // "Ana"
me("friends.ana.ageGapVsOwner")       // -6
me("friends[isAdult == true].name")   // { ana: "Ana", luisa: "Luisa" }
me("friends[canInvite == true].name") // { ana: "Ana" }
```
{: .me-run}

The filter runs over live derived values, read through the pointers ([Pointer Composition](Pointer-Composition.html)).

## Step 4: React: pablo.age(18)

```ts
me.users.pablo.age(18)
me("friends[isAdult == true].name")   // { ana: "Ana", pablo: "Pablo", luisa: "Luisa" }
me("friends[canInvite == true].name") // { ana: "Ana", pablo: "Pablo" }
```
{: .me-run}

One write; the kernel already knew what depended on `age`.

## Step 5: Private contacts

```ts
me.contacts.ana["_"]("thread-ana-key")
me.contacts.ana.lastSeenDays(3)
me.contacts.ana.priority(0.9)
me.contacts.ana["="]("needsReply", "lastSeenDays > 2")
me("contacts.ana.needsReply")          // true
me.as(null)("contacts.ana")            // undefined
me.as(null)("contacts.ana.needsReply") // undefined
```
{: .me-run}

For a guest the scope is not "access denied": it is absent. Switch the live graph to **guest** to see it.

## Step 6: Explain

```ts
me.explain("users.pablo.isAdult")
me.explain("contacts.ana.needsReply")
```
{: .me-run}

Real output on 4.2.1 (trimmed): `{ path: "users.pablo.isAdult", value: true, expr: "age >= 18", derivation: { expression: "age >= 18", inputs: [{ label: "age", path: "users.pablo.age", value: 18, origin: "public", masked: false, status: "resolved" }] }, meta: { dependsOn: ["users.pablo.age"], k: 3, recomputed: [...], ... } }`. For the private `needsReply`, the stealth input comes back as `value: "●●●●", origin: "stealth", masked: true, status: "masked"`: the dependency is acknowledged without leaking the value. See [me.explain()](Explain.html).

## Run it in Node

```bash
cd Typescript && npm install
node tests/Demos/Social_Graph.ts
npm run test:demos:run-all
```

`identity + relationships + policies + privacy = one graph`
