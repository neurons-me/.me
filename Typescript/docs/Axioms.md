# 𓋹 The Axioms of .me

In **.me**, axioms are the fundamental invariants of the kernel — the unbreakable rules that the runtime must always respect.

At its heart, **.me** is a **personal semantic kernel**: a single runtime value called `me` that acts simultaneously as a deeply navigable object and a callable function. This unified surface lets you store, organize, protect, query, link, and audit your digital identity and memory in a structured, consistent, and tamper-evident way.

The **axioms together create something unique**: they turn a simple JavaScript object into a secure, auditable, self-consistent personal memory engine. You can safely mix public data, hidden subtrees, structural pointers, queries, and identity — while the entire system remains predictable and tamper-evident.

### A-struct-0 | Unified Callable Surface

**One runtime value can be both callable and infinitely chainable.**

This is the foundation that makes the entire `.me` experience feel natural and powerful.

**Kernel evidence** (runtime proxy + kernel surface):

```ts
// Constructor returns a proxy that unifies both behaviors
const rootProxy = this.createProxy([]);
Object.setPrototypeOf(rootProxy as any, ME.prototype);
Object.assign(rootProxy as any, this);
return rootProxy as unknown as ME;
```

```ts
// Proxy: property access extends the semantic path, function call executes the operation
return new Proxy(fn, {
  get(target, prop) { /* ... */ return self.createProxy(newPath); },
  apply(target, _thisArg, args) { 
    return Reflect.apply(target as any, undefined, args); 
  },
});
```

**Proof:**

```ts
const me = new ME() as any;

console.log(typeof me);                    // "function"
console.log(typeof me.profile.name);       // "function"

me.profile.name("Abella");
console.log(me("profile.name"));           // "Abella"
```

### A0 | Secret Root Stealth

A secret subtree can be fully readable by its complete path, while its root remains completely invisible.

**Kernel evidence** (secret runtime behavior):

```ts
// Secret branches are stored internally but never mirrored to the public index
private setBranchBlob(scope: SemanticPath, blob: EncryptedBlob) {
  this.encryptedBranches[key] = blob;
}
```

```ts
// Deliberately hide the root of any secret scope
if (scope && scope.length > 0 && pathStartsWith(path, scope)) {
  if (path.length === scope.length) return undefined;
}
```

**Proof:**

```ts
const me = new ME() as any;

me.wallet["_"]("secret");
me.wallet.income(100);

console.log(me("wallet"));        // undefined
console.log(me("wallet.income")); // 100
```

### A1 | Identity Normalization (`@`)

Identity claims are automatically normalized and validated before being committed.

**Kernel evidence** (identity normalization path):

```ts
private isIdentityCall(path: SemanticPath, expression: any): { id: string; targetPath: SemanticPath } | null {
  const id = normalizeAndValidateUsername(expression);
  return { id, targetPath: /* [] or scope */ };
}
```

**Proof:**

```ts
const me = new ME() as any;
me["@"]("Abella");

console.log(me.inspect({ last: 1 }).memories[0].operator); // "@"
console.log(me.inspect({ last: 1 }).memories[0].value);    // { __id: "abella" }
```

### A2 | Path-Bound Secret Scopes (`_`)

Secrecy is structural — bound to a specific path rather than a global toggle.

**Proof:**

```ts
const me = new ME() as any;

me.profile["_"]("alpha");
me.profile.name("Abella");

console.log(me("profile"));       // undefined
console.log(me("profile.name"));  // "Abella"
```

### A3 | Noise Reset (`~`)

Secret derivation can be reset at any chosen boundary, making previous secrets discontinuous.

**Proof:**

```ts
const me = new ME() as any;

me.wallet["_"]("alpha");
me.wallet.hidden.notes("alpha-note");

me.wallet["~"]("noise");

me.wallet["_"]("beta");
me.wallet.hidden.seed("beta-seed");

console.log(me("wallet.hidden.seed")); // "beta-seed"
```

### A4 | Structural Pointers (`__` / `->`)

Pointers remain lightweight data objects. When traversed, they are automatically dereferenced structurally.

**Proof:**

```ts
const me = new ME() as any;

me.wallet["_"]("secret");
me.wallet.income(1000);

me.profile.card["__"]("wallet");

console.log(me("profile.card"));           // { __ptr: "wallet" }
console.log(me("profile.card.income"));    // 1000
```

### A5 | Query as Memory Event (`?`)

Queries and calculations are recorded as first-class memory events.

**Proof:**

```ts
const me = new ME() as any;

me.profile.name("Abella");
me.profile["?"]("name", "city");

console.log(me.inspect({ last: 1 }).memories[0].operator); // "?"
```

### A6 | Tombstone Remove (`-`)

Deletion is auditable and irreversible at read time through tombstones.

**Proof:**

```ts
const me = new ME() as any;

me.wallet.hidden.notes("private");
me.wallet.hidden["-"]("notes");

console.log(me("wallet.hidden.notes")); // undefined or "-"
```

### A7 | Public + Secret Coexistence

Private operations never leak into or corrupt the public deterministic view.

**Proof:**

```ts
const me = new ME() as any;

me.ledger.host("localhost:8161");
me.profile["_"]("alpha");
me.profile.name("Abella");

console.log(me("ledger.host"));   // "localhost:8161"
console.log(me("profile"));       // undefined
```

### A8 | Hash Chain Integrity

The full memory history is tamper-evident via an internal hash chain. The public surface is redacted when needed, while the internal forensic log (`_memories`) preserves complete integrity.

**Proof:**

```ts
const me = new ME() as any;
me["@"]("jabellae");
me.ledger.host("localhost:8161");

const m = me._memories;

console.log(m[0].prevHash === ""); 
console.log(m[1].prevHash === m[0].hash);
```

### A9 | Deterministic Conflict Resolution (LWW)

When writes collide, the system always resolves to a single deterministic truth using `(timestamp asc, hash asc)`.

**Proof:**

```ts
const me = new ME() as any;
const originalNow = Date.now;

try {
  (Date as any).now = () => 3000;
  me.wallet.balance(111);
  me.wallet.balance(222);
} finally {
  (Date as any).now = originalNow;
}

console.log(me("wallet.balance")); // always the same deterministic winner
```

---

### Why This Combination Is Powerful

Together, these axioms enable real-world use cases that traditional data structures cannot easily achieve:

- **Personal Digital Identity**: You can have a single source of truth for your online self (`me["@"]("jabella.e")`) with public profiles and deeply hidden private sections that remain structurally coherent.
- **Secure Personal Vault**: Store sensitive data (wallets, keys, notes) that can be partially hidden while still being traversable and pointer-referenced from public areas.
- **Auditable Memory**: Every change, query, or deletion is logged with cryptographic integrity, making `.me` suitable for self-sovereign identity or personal knowledge bases where trust and history matter.
- **Composability**: Pointers + secrecy + queries allow complex data relationships without duplication or security leaks.
- **Deterministic & Tamper-evident**: Ideal for decentralized systems, personal agents, or any application where data integrity and reproducibility are critical.

In short, `.me` gives you a living, programmable personal memory that feels like a natural extension of yourself — flexible, private when needed, and provably consistent.

### Practical Validation

Run the official fire test:

```bash
node tests/axioms.test.ts
```

**Expected:** All axioms pass with `expected === returned` proofs.

---

**∴ Witness our seal**  
