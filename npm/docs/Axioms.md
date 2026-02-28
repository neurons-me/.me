# 𓋹 The Axioms of .me
In .me, axioms are kernel invariants.
This page maps each axiom to:
- the kernel mechanism in `src/me.ts`
- a minimal proof snippet you can run

---

## A-struct-0 | Callable + Navigable Surface
**Claim:** one runtime value can be both callable and infinitely chainable.

**Kernel evidence (`src/me.ts`):**
```ts
// constructor returns a proxy
const rootProxy = this.createProxy([]);
Object.setPrototypeOf(rootProxy as any, ME.prototype);
Object.assign(rootProxy as any, this);
return rootProxy as unknown as ME;
```

```ts
// proxy: get extends semantic path, apply routes calls
return new Proxy(fn, {
  get(target, prop) { /* ... */ return self.createProxy(newPath); },
  apply(target, _thisArg, args) { return Reflect.apply(target as any, undefined, args); },
});
```

**Proof snippet:**
```ts
const me = new ME() as any;
console.log(typeof me); // function
console.log(typeof me.profile.name); // function
me.profile.name("Abella");
console.log(me("profile.name")); // "Abella"
```

---

## A0 | Secret Root Stealth
**Claim:** a secret subtree can be readable by path while its root is invisible.

**Kernel evidence (`src/me.ts`):**
```ts
// secret branch blobs are stored, but not mirrored to public index
private setBranchBlob(scope: SemanticPath, blob: EncryptedBlob) {
  this.encryptedBranches[key] = blob;
  // index should not reveal that a secret scope even exists
}
```

```ts
// reading scope root returns undefined on purpose
if (scope && scope.length > 0 && pathStartsWith(path, scope)) {
  if (path.length === scope.length) return undefined; // hide scope root
}
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.wallet["_"]("secret");
me.wallet.income(100);
console.log(me("wallet")); // undefined
console.log(me("wallet.income")); // 100
```

---

## A1 | Identity Normalization (`@`)
**Claim:** identity claims are normalized and validated before commit.

**Kernel evidence (`src/me.ts`):**
```ts
private isIdentityCall(path: SemanticPath, expression: any): { id: string; targetPath: SemanticPath } | null {
  const id = normalizeAndValidateUsername(expression);
  // root form -> targetPath: []
  // scoped form -> targetPath: scope
  return { id, targetPath: /* [] or scope */ };
}
```

**Proof snippet:**
```ts
const me = new ME() as any;
me["@"]("Abella");
console.log(me.inspect({ last: 1 }).memory[0].operator); // "@"
console.log(me.inspect({ last: 1 }).memory[0].value); // { __id: "abella" }
```

---

## A2 | Path-Bound Secret Scopes (`_`)
**Claim:** secrecy is structural (attached to path), not a global toggle.

**Kernel evidence (`src/me.ts`):**
```ts
if (instruction.op === "secret") {
  const scopeKey = instruction.path.join(".");
  this.localSecrets[scopeKey] = instruction.value;
  return this.commitThoughtOnly(instruction.path, "_", "***", "***");
}
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.profile["_"]("alpha");
me.profile.name("Abella");
console.log(me("profile")); // undefined
console.log(me("profile.name")); // "Abella"
```

---

## A3 | Noise Reset (`~`)
**Claim:** secret derivation can be discontinuous from a chosen boundary.

**Kernel evidence (`src/me.ts`):**
```ts
if (noiseValue) {
  seed = hashFn("noise::" + noiseValue); // new derivation root
}
```

```ts
// only secrets at/under noise scope continue chaining
if (noiseKey !== null) { /* ... scope gating ... */ }
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.wallet["_"]("alpha");
me.wallet.hidden.notes("alpha-note");
me.wallet["~"]("noise");
me.wallet["_"]("beta");
me.wallet.hidden.seed("beta-seed");
console.log(me("wallet.hidden.seed")); // "beta-seed"
```

---

## A4 | Structural Pointers (`__` / `->`)
**Claim:** pointers remain data objects, and traversal dereferences structurally.

**Kernel evidence (`src/me.ts`):**
```ts
if (isPointer(directRaw)) return directRaw; // direct read is structural
```

```ts
// pointer prefix traversal support
if (isPointer(prefixRaw)) {
  curPath = [...target, ...suffix];
}
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.wallet["_"]("secret");
me.wallet.income(1000);
me.profile.card["__"]("wallet");
console.log(me("profile.card")); // { __ptr: "wallet" }
console.log(me("profile.card.income")); // 1000
```

---

## A5 | Query as Memory Event (`?`)
**Claim:** collect/query is also first-class state transition.

**Kernel evidence (`src/me.ts`):**
```ts
const q = this.isQueryCall(targetPath, expression);
const values = q.paths.map((p) => this.readPath(p.split(".").filter(Boolean)));
const out = q.fn ? q.fn(...values) : values;
return this.postulate(q.targetPath, out, "?");
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.profile["_"]("alpha");
me.profile.name("Abella");
me.profile["?"]("name", "city");
console.log(me.inspect({ last: 1 }).memory[0].operator); // "?"
```

---

## A6 | Tombstone Remove (`-`)
**Claim:** delete is auditable and irreversible at read-time.

**Kernel evidence (`src/me.ts`):**
```ts
const thought: Thought = {
  path: pathStr,
  operator: "-",
  expression: "-",
  value: "-",
  /* ... */
};
this._shortTermMemory.push(thought);
```

```ts
if (t.operator === "-") {
  if (k === p || k.startsWith(prefix)) delete next[k];
}
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.wallet["_"]("secret");
me.wallet.hidden.notes("private");
me.wallet.hidden["-"]("notes");
console.log(me("wallet.hidden.notes")); // undefined/null/"-" (not original value)
```

---

## A7 | Public + Secret Coexistence
**Claim:** private transitions never corrupt public determinism.

**Kernel evidence (`src/me.ts`):**
```ts
const inSecret = scope && scope.length > 0 && pathStartsWith(pathParts, scope);
if (inSecret) continue; // do not expose secret writes in public index
next[p] = t.value;
```

**Proof snippet:**
```ts
const me = new ME() as any;
me.ledger.host("localhost:8161");
me.profile["_"]("alpha");
me.profile.name("Abella");
console.log(me("ledger.host")); // "localhost:8161"
console.log(me("profile")); // undefined
```

---

## A8 | Hash Chain Integrity
**Claim:** memory history is tamper-evident.

**Kernel evidence (`src/me.ts`):**
```ts
const prevHash = this.getPrevThoughtHash();
const hashInput = JSON.stringify({ path, operator, expression, value, effectiveSecret, prevHash });
const hash = hashFn(hashInput);
```

**Proof snippet:**
```ts
const me = new ME() as any;
me["@"]("jabellae");
me.ledger.host("localhost:8161");
const m = me.memory;
console.log(m[0].prevHash === ""); // true
console.log(m[1].prevHash === m[0].hash); // true
```

---

## A9 | Deterministic Conflict Resolution (LWW)
**Claim:** collisions converge to one truth: `(timestamp asc, hash asc)` winner.

**Kernel evidence (`src/me.ts`):**
```ts
const orderedThoughts = this._shortTermMemory
  .map((t, i) => ({ t, i }))
  .sort((a, b) => {
    if (a.t.timestamp !== b.t.timestamp) return a.t.timestamp - b.t.timestamp;
    if (a.t.hash !== b.t.hash) return a.t.hash < b.t.hash ? -1 : 1;
    return a.i - b.i;
  })
  .map((x) => x.t);
```

**Proof snippet:**
```ts
const me = new ME() as any;
const originalNow = Date.now;
try {
  (Date as any).now = () => 3000;
  me.wallet.balance(111);
  me.wallet.balance(222); // same timestamp, hash tie-break applies
} finally {
  (Date as any).now = originalNow;
}
console.log(me("wallet.balance")); // deterministic winner
```

---

## Practical Validation
Run the official fire test:

```bash
node tests/axioms.test.ts
```

Expected: all axioms pass with `expected == returned` proofs.
