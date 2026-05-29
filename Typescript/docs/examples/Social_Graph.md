# Social Graph Walkthrough

This is the canonical `.me` example for public identity, structural privacy, semantic links, reactive derivations, and explainability in one flow.

It demonstrates:
- identity declaration with `@`
- public profile data
- private wallet data with stealth root behavior
- pointer-based friend relations
- automatic derivations with `=`
- private group/chat state
- `explain()` for traceability

## Full Script

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");

// Public profile
me.profile.name("Jose Abella");
me.profile.bio("Building the semantic web.");

// Private wallet
me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);
me.wallet.savings(4500);

// Social graph
me.users.ana.name("Ana");
me.users.ana.age(24);
me.users.pablo.name("Pablo");
me.users.pablo.age(19);

me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
me.friends["[i]"]["="]("isAdult", "age >= 18");

// Private group chat
me.groups.vancouver["_"]("group-key-2026");
me.groups.vancouver.topic("Trip to Vancouver");
me.groups.vancouver.members.count(4);
me.groups.vancouver.messages[0].from("jabellae");
me.groups.vancouver.messages[0].text("Who is bringing the car?");
me.groups.vancouver.messages[0].time("2026-04-10");

console.log(me("profile.name"));                    // "Jose Abella"
console.log(me("friends.ana.isAdult"));             // true
console.log(me("friends[age >= 18].name"));         // { ana: "Ana", pablo: "Pablo" }
console.log(me("wallet"));                          // undefined
console.log(me("wallet.balance"));                  // 12480
console.log(me("groups.vancouver"));                // undefined
console.log(me("groups.vancouver.messages[0].text"));
console.log(me.explain("friends.ana.isAdult"));
```

## Why It Matters

### Identity and public state

```ts
me["@"]("jabellae");
me.profile.name("Jose Abella");
```

- `@` establishes the root identity.
- Public paths like `profile.name` behave like normal semantic state.

### Structural privacy

```ts
me.wallet["_"]("wallet-key-2026");
me.wallet.balance(12480);
```

- `wallet` becomes a secret scope.
- `me("wallet")` returns `undefined`.
- Deep leaves like `me("wallet.balance")` still resolve.

### Graph edges without duplication

```ts
me.friends.ana["->"]("users.ana");
```

- `friends.ana` stores a pointer, not a copy.
- Reads like `me("friends.ana.age")` traverse to the target path.

### Reactive semantics

```ts
me.friends["[i]"]["="]("isAdult", "age >= 18");
```

- One declarative rule applies to every existing friend node.
- Changing `users.ana.age` updates `friends.ana.isAdult`.

### Explainability

```ts
me.explain("friends.ana.isAdult");
```

- Shows the derivation expression.
- Shows the effective inputs used to compute the value.
- Masks secret-origin inputs when required by scope rules.

## Expected Reads

- `me("profile.name")` -> `"Jose Abella"`
- `me("friends.ana.isAdult")` -> `true`
- `me("wallet")` -> `undefined`
- `me("wallet.balance")` -> `12480`
- `me("groups.vancouver")` -> `undefined`
- `me("groups.vancouver.messages[0].text")` -> `"Who is bringing the car?"`

## Where To Go Next

- [Quick Start](../QuickStart)
- [Operators](../Operators)
- [Memory](../Memory)
- [Runtime Surface](../Runtime-Surface)
