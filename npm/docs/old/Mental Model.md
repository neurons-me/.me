# **Mental model of `.me` — version 3.6.42**

`.me` is:  
A **semantic tree writer/reader** using paths like `wallet.income`  
With **two storage planes:**

**1. Public plane:** `index` derived from `_memories`, excludes content under secret scopes. Reads via `me("path")` resolve here.

**2. Secret plane:** `encryptedBranches` = ciphertext blobs stored at scope roots. Fully hidden from `index`. Only accessible if you have the correct `effectiveSecret`.

**And a canonical append-only log:** `_memories: MeThought[]` — the single source of truth used to rebuild `index` in `rehydrate()`.

The Proxy “chaining API” just builds `path[]` and funnels everything through `handleCall(...) → postulate(...)`.

---

### **Key routing / parsing behavior**

**Root call ambiguity resolution**  
Inside `handleCall` when `path.length === 0`:

If you call `me("something")` and the string looks like:
- a dotted path `a.b`
- an operator-prefixed token `_`, `~`, `@`, `->`, `__`
- **OR** a single label `username`  
→ it is treated as a `GET` = `readPath`, not a write.

Otherwise `me(expression)` is a root `postulate/write`.

**3.6.42 adjustment:** The stealth gate now distinguishes `owner` vs `guest`. `owner` default bypasses the secret-scope block. `me.as(null)` = guest and is blocked. This fixes the `["_"] + ["~"] + leaf` case.

---

### **Operator registry — kernel**

`operators: Record<string, {kind:string}>` is the router.

**Defaults in `3.6.42`:**

```js
{
  "_":  { kind: "secret" },  // declares secret scope. Makes the scope root stealth
  "~":  { kind: "noise" },   // cuts cryptographic inheritance. Does NOT create scope. Requires _ ancestor for writes
  "__": { kind: "pointer" }, // functional alias. Resolves up to 8 hops in public reads
  "->": { kind: "pointer" }, // functional alias. Same as __
  "@":  { kind: "identity" },// sets @id. Only 1 per runtime
  "=":  { kind: "eval" },    // derivation. Stores expression, tracks deps, O(k) recompute
  "?":  { kind: "query" },   // explicit read. me.path["?"]() === me("path")
  "-":  { kind: "remove" },  // delete path and descendants
}
```

**Golden rule:**  
`["_"]` = who can enter the room + makes the door stealth  
`["~"]` = which photo on the wall the story starts from, but you need the room first
