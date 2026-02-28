# 𓂀 Social Graph Walkthrough
This example builds a small social graph in `.me` and shows how state evolves at each step using `inspect()`.

It demonstrates:
- identity declaration (`@`)
- tree creation with semantic paths
- pointer bridges (`->`)
- pointer traversal
- logical filtering with selectors (`[age > 18]`)
- memory log inspection

---

## Full Script

```ts
import ME from "this.me";
const me = new ME() as any;

function show(step: string, focus: string[] = []) {
  const state = me.inspect({ last: 5 });
  console.log(`\n=== ${step} ===`);
  console.log("index keys:", Object.keys(state.index).sort());
  for (const p of focus) console.log(`${p} ->`, me(p));
  console.log(
    "last memory events:",
    state.memory.map((t: any) => ({ path: t.path, op: t.operator, value: t.value }))
  );
}

console.log("\n.me example: tree creation walkthrough");

me["@"]("jabellae");
show("Identity declared", [""]);

me.profile.name("Abella.e");
me.profile.bio("Building the semantic web.");
me.profile.pic("https://neurons.me/media/neurons-grey.png");
show("Own profile created", ["profile.name", "profile.bio", "profile.pic"]);

me.users.ana.name("Ana");
me.users.ana.bio("Designing semantic interfaces.");
me.users.ana.age(22);
show("users.ana created", ["users.ana.name", "users.ana.bio", "users.ana.age"]);

me.users.pablo.name("Pablo");
me.users.pablo.bio("Building distributed systems.");
me.users.pablo.age(17);
show("users.pablo created", ["users.pablo.name", "users.pablo.bio", "users.pablo.age"]);

me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
show("Pointers created (friends -> users)", ["friends.ana", "friends.pablo"]);

console.log("\nPointer traversal:");
console.log("friends.ana.bio ->", me("friends.ana.bio"));
console.log("friends.pablo.name ->", me("friends.pablo.name"));

console.log("\nLogical filter result:");
console.log("friends[age > 18].name ->", me("friends[age > 18].name"));

show("Final state", [
  "profile.name",
  "friends.ana.bio",
  "friends.pablo.name",
  "friends[age > 18].name",
]);
```

---

## Step-by-Step Meaning

### 1) Identity root
```ts
me["@"]("jabellae");
```
- Declares canonical identity at root.
- Writes an `@` memory event.

### 2) Local profile
```ts
me.profile.name("Abella.e");
me.profile.bio("Building the semantic web.");
me.profile.pic("https://neurons.me/media/neurons-grey.png");
```
- Creates direct public leaves under `profile.*`.
- These are normal path-value commits.

### 3) User nodes
```ts
me.users.ana.age(22);
me.users.pablo.age(17);
```
- Builds two separate user subtrees.
- Enables later filtering logic by age.

### 4) Graph edges via pointers
```ts
me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
```
- `friends.*` nodes become structural pointers (`{ __ptr: "users.*" }`).
- Reading deeper paths traverses the pointer target.

### 5) Pointer traversal
```ts
me("friends.ana.bio");    // resolves to users.ana.bio
me("friends.pablo.name"); // resolves to users.pablo.name
```
- Confirms relational read works without duplicating data.

### 6) Logical selector filter
```ts
me("friends[age > 18].name");
```
- Evaluates condition per child in `friends`.
- Expected result: only `ana` passes (`22 > 18`), `pablo` is excluded (`17`).

---

## Why `show(...)` matters
`show()` prints three planes after each mutation:

- `index keys`: current public resolved surface
- focused reads: direct proof of expected values
- `last memory events`: latest commits from `state.memory`

This gives you a real-time audit trail of how `.me` builds and resolves the graph.

---

## Run

```bash
node tests/Social_Graph.ts
```

If output is correct, your graph, pointers, and filter logic are all working together.

---

## Runtime Output (real)

```txt
suign@Suis-MacBook-Air npm % node tests/example.ts 

.me example: tree creation walkthrough

=== Identity declared ===
index keys: [ '' ]
 -> {
  path: '',
  operator: null,
  expression: '',
  value: '',
  effectiveSecret: '',
  hash: '4cce34b7',
  prevHash: '3f1c0ad3',
  timestamp: 1772255707955
}
last memory events: [ { path: '', op: '@', value: { __id: 'jabellae' } } ]

=== Own profile created ===
index keys: [ '', 'profile.bio', 'profile.name', 'profile.pic' ]
profile.name -> Abella.e
profile.bio -> Building the semantic web.
profile.pic -> https://neurons.me/media/neurons-grey.png
last memory events: [
  { path: '', op: '@', value: { __id: 'jabellae' } },
  { path: '', op: null, value: '' },
  { path: 'profile.name', op: null, value: 'Abella.e' },
  {
    path: 'profile.bio',
    op: null,
    value: 'Building the semantic web.'
  },
  {
    path: 'profile.pic',
    op: null,
    value: 'https://neurons.me/media/neurons-grey.png'
  }
]

=== users.ana created ===
index keys: [
  '',
  'profile.bio',
  'profile.name',
  'profile.pic',
  'users.ana.age',
  'users.ana.bio',
  'users.ana.name'
]
users.ana.name -> Ana
users.ana.bio -> Designing semantic interfaces.
users.ana.age -> 22
last memory events: [
  {
    path: 'profile.bio',
    op: null,
    value: 'Building the semantic web.'
  },
  {
    path: 'profile.pic',
    op: null,
    value: 'https://neurons.me/media/neurons-grey.png'
  },
  { path: 'users.ana.name', op: null, value: 'Ana' },
  {
    path: 'users.ana.bio',
    op: null,
    value: 'Designing semantic interfaces.'
  },
  { path: 'users.ana.age', op: null, value: 22 }
]

=== users.pablo created ===
index keys: [
  '',
  'profile.bio',
  'profile.name',
  'profile.pic',
  'users.ana.age',
  'users.ana.bio',
  'users.ana.name',
  'users.pablo.age',
  'users.pablo.bio',
  'users.pablo.name'
]
users.pablo.name -> Pablo
users.pablo.bio -> Building distributed systems.
users.pablo.age -> 17
last memory events: [
  {
    path: 'users.ana.bio',
    op: null,
    value: 'Designing semantic interfaces.'
  },
  { path: 'users.ana.age', op: null, value: 22 },
  { path: 'users.pablo.name', op: null, value: 'Pablo' },
  {
    path: 'users.pablo.bio',
    op: null,
    value: 'Building distributed systems.'
  },
  { path: 'users.pablo.age', op: null, value: 17 }
]

=== Pointers created (friends -> users) ===
index keys: [
  '',
  'friends.ana',
  'friends.pablo',
  'profile.bio',
  'profile.name',
  'profile.pic',
  'users.ana.age',
  'users.ana.bio',
  'users.ana.name',
  'users.pablo.age',
  'users.pablo.bio',
  'users.pablo.name'
]
friends.ana -> { __ptr: 'users.ana' }
friends.pablo -> { __ptr: 'users.pablo' }
last memory events: [
  { path: 'users.pablo.name', op: null, value: 'Pablo' },
  {
    path: 'users.pablo.bio',
    op: null,
    value: 'Building distributed systems.'
  },
  { path: 'users.pablo.age', op: null, value: 17 },
  { path: 'friends.ana', op: '__', value: { __ptr: 'users.ana' } },
  { path: 'friends.pablo', op: '__', value: { __ptr: 'users.pablo' } }
]

Pointer traversal:
friends.ana.bio -> Designing semantic interfaces.
friends.pablo.name -> Pablo

Logical filter result:
friends[age > 18].name -> { ana: 'Ana' }

=== Final state ===
index keys: [
  '',
  'friends.ana',
  'friends.pablo',
  'profile.bio',
  'profile.name',
  'profile.pic',
  'users.ana.age',
  'users.ana.bio',
  'users.ana.name',
  'users.pablo.age',
  'users.pablo.bio',
  'users.pablo.name'
]
profile.name -> Abella.e
friends.ana.bio -> Designing semantic interfaces.
friends.pablo.name -> Pablo
friends[age > 18].name -> { ana: 'Ana' }
last memory events: [
  { path: 'users.pablo.name', op: null, value: 'Pablo' },
  {
    path: 'users.pablo.bio',
    op: null,
    value: 'Building distributed systems.'
  },
  { path: 'users.pablo.age', op: null, value: 17 },
  { path: 'friends.ana', op: '__', value: { __ptr: 'users.ana' } },
  { path: 'friends.pablo', op: '__', value: { __ptr: 'users.pablo' } }
]
suign@Suis-MacBook-Air npm % 
```
