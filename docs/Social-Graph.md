---
layout: readme
title: Social Graph
---


# Social Graph

This demo teaches one simple idea:
> Relationships, policies, and privacy are not separate systems. They are paths in the same graph.

A person has a profile. A person has friends. Some friends can be invited to things. Some contacts are private. The same graph handles all of it — and every derived value stays live.

[`.me Docs`](https://neurons-me.github.io/.me) · [Social Graph Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Social_Graph.ts)

---

## The Tiny Mental Model

A social graph in `.me` has three layers living in the same structure:

```ts
me["@"]("jabellae")          // identity anchor — who owns this graph
me.profile.name("J. Abella") // public facts about the owner
me.users.ana.name("Ana")     // other people in the graph
me.friends.ana["->"]("users.ana") // relationships as pointers
```

No schema. No ORM. No join tables. Paths are the model.

---

## What The Demo Builds

| Layer | Example | What it means |
|---|---|---|
| Identity | `me["@"]("jabellae")` | Who owns this graph |
| Profile | `profile.name`, `profile.age` | Public facts about the owner |
| Users | `users.ana`, `users.pablo` | Other people, with their own facts |
| Policies | `users["[i]"]["="]("isAdult", ...)` | Rules that apply across all users |
| Friends | `friends.ana["->"]("users.ana")` | Relationships as live pointers |
| Contacts | `contacts.ana["_"](key)` | Private data, structurally invisible |

---

## Step 1: Seed the Graph

Start with the owner and the people around them:

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
```

Just facts. Nothing smart yet.

---

## Step 2: Add Policies Across All Users

Apply rules to every user at once with `[i]`:

```ts
me.users["[i]"]["="]("isAdult", "age >= 18")
me.users["[i]"]["="]("ageGapVsOwner", "age - profile.age")
me.users["[i]"]["="]("canInvite", "isAdult && age < 30")
```

`[i]` means: for every node under `users`, derive this value. The derivation reads `profile.age` — the owner's own data. Every user's `ageGapVsOwner` is computed relative to whoever owns the graph.

---

## Step 3: Define Relationships

Relationships are pointers, not copies:

```ts
me.friends.ana["->"]("users.ana")
me.friends.pablo["->"]("users.pablo")
me.friends.luisa["->"]("users.luisa")
```

Now you can traverse the graph through the relationship:

```ts
me("friends.ana.name")              // "Ana"
me("friends.ana.ageGapVsOwner")     // -6
me("friends[isAdult == true].name") // { ana: "Ana", luisa: "Luisa" }
me("friends[canInvite == true].name") // { ana: "Ana" }
```

The filter runs over the live derived values. No query language. No extra step.

---

## Step 4: Watch It React

Change a fact. The graph updates:

```ts
me.users.pablo.age(18)

me("friends[isAdult == true].name")
// → { ana: "Ana", pablo: "Pablo", luisa: "Luisa" }
```

Pablo crossed the threshold. No imperative update. No event listener. The derivation already knew what depended on `age`.

---

## Step 5: Private Contacts

Not everything is public. Some data should be invisible to outsiders:

```ts
me.contacts.ana["_"]("thread-ana-key")  // marks this scope as stealth
me.contacts.ana.lastSeenDays(3)
me.contacts.ana.priority(0.9)
me.contacts.ana["="]("needsReply", "lastSeenDays > 2")
```

From the owner's perspective:

```ts
me("contacts.ana.needsReply")   // true
```

From a guest (no key):

```ts
me.as(null)("contacts.ana")            // undefined — stealth
me.as(null)("contacts.ana.needsReply") // undefined — stealth
```

The structure itself is invisible. Not "access denied" — structurally absent.

---

## Explainability

Any derived value can be traced:

```ts
me.explain("users.pablo.isAdult")
// → {
//     path: "users.pablo.isAdult",
//     value: true,
//     expression: "age >= 18",
//     dependsOn: ["users.pablo.age"]
//   }
```

For private derivations, masked inputs show as `"●●●●"` — the system acknowledges the dependency without leaking the value.

---

## Why This Is Different

A typical social graph stores relationships in a database, runs queries to fetch filtered sets, and rebuilds derived views on every read.

In `.me`:

- Policies are written once and live in the graph
- Relationships are pointers, not foreign keys
- Privacy is structural, not a permission check
- Every derived value knows its own dependencies
- The graph explains any decision on demand

---

## Build It Yourself

```bash
cd npm
npm install
node tests/Demos/Social_Graph.ts
```

To run every demo:

```bash
npm run test:demos:run-all
```

---

## The Big Idea

A social graph is not a table of people. It is a living system of meaning — who knows whom, what that relationship implies, what is shared, what is private, and how everything updates when anything changes.

`.me` models that directly:

```text
identity + relationships + policies + privacy = one graph
```

---
