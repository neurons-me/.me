----

### Mental model of ME

ME is basically:
	•	A semantic tree writer/reader (paths like wallet.income)
	•	With two storage planes:
	1.	Public plane: index (derived from _shortTermMemory, excludes secret-scope content)
	2.	Secret plane: encryptedBranches (ciphertext blobs stored at scope roots, totally hidden from index)
	•	And a canonical append-only-ish log: _shortTermMemory: MeThought[] (the only “truth” used to rebuild index).

The Proxy “chaining API” is just a way to build path[] and then funnel everything through handleCall(...) -> postulate(...).

---
### Key routing / parsing behavior

Root call ambiguity resolution

Inside handleCall when path.length === 0:
	•	If called as me("something") and string looks like:
	•	a dotted path (a.b)
	•	operator-prefixed token (_, ~, @)
	•	OR a single label (username)
→ it is treated as a GET (readPath), not a write.
	•	Otherwise me(expression) is a root postulate/write.

This is important later because it affects how operators can be invoked at root.

----

### **Operator registry (“kernel”)**

**operators:** Record`<string, {kind:string}>` is the router map.

Defaults:

```js
{
  "_":  { kind: "secret" },
  "~":  { kind: "noise" },
  "__": { kind: "pointer" },
  "->": { kind: "pointer" },
  "@":  { kind: "identity" },
  "=":  { kind: "eval" },
  "?":  { kind: "query" },
  "-":  { kind: "remove" },
}
```

