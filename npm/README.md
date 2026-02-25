<img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />

# .me  
##### **1. NPM:**
```bash
npm install this.me
```
---

## **Start .me in 20 seconds**
###### Import
**1) Node.js**:
```ts
import ME from "this.me";
const me = new ME();
```
**Other modules formats and runtime targets:** CommonJS (`require`), UMD (global/script), TypeScript types.

###### **Declare** Your Data.
```ts
me.profile.name("Abella");
me.profile.age(30);
```

###### **Read **Your Data
```ts
me("profile.name"); // → "Abella"
me("profile.age");  // → 30
```

##### **Use in expressions**
```ts
if (me("profile.age") > 18) {
  console.log("Adult");
}
```

---

## 🌳 Infinite Semantic Trees
**.me** supports infinite nesting:

```ts
me.system.audio.filters.lowpass.cutoff(1200);
me.system.audio.filters.lowpass.resonance(0.7);
me("system.audio.filters.lowpass");
// → { cutoff: 1200, resonance: 0.7 }
```

You can construct any conceptual universe:

```ts
me.synth.moog.grandmother.osc1.wave("triangle");
me.synth.moog.grandmother.osc2.wave("square");
me("synth.moog.grandmother.osc1.wave");
// → "triangle"
```

---

## 🔐 Secrets: Encrypted Universes
Secrets create private branches:

```ts
me.wallet["_"]("ABC"); // declare secret scope at "wallet"
me.wallet.balance(500);
me.wallet.transactions.list([1, 2, 3]);
```

Everything under that scope is stored in an encrypted branch blob.
Secret scope roots are stealth by design:

```ts
me("wallet"); // → undefined (stealth root)
me("wallet.balance"); // → 500
me("wallet.transactions.list"); // → [1, 2, 3]
```

Secrets can nest infinitely:

```ts
me.wallet["_"]("ABC");
me.wallet.hidden["_"]("DEEP");
me.wallet.hidden.note("private");

me("wallet.hidden"); // → undefined (stealth root)
me("wallet.hidden.note"); // → "private"
```

- **A secret belongs to a specific position in the identity tree.**
- Everything under that position becomes encrypted.
- If you declare another secret inside, it becomes a deeper encrypted scope.
- Reads are path-based; there is no global `me.secret(...)` unlock call.

---

### 🧬 Why ME Works

- Proxies → infinite language surface  
- Path strings → universal query interface  
- Values → semantic meaning, not strict types  
- Secrets → fractal encrypted universes  
- Export → deterministic declarative identity  
- Zero dependencies  
- Browser & Node compatible  

---

### 📦 Export Identity

```ts
console.log(me.export());
```

Produces a deterministic structure:

```json
{
  "identityRoot": "0xabc...",
  "publicKey": "...",
  "identityHash": "...",
  "declarations": [
    { "key": "profile.name", "value": "Abella", ... },
    { "key": "profile.age", "value": 30, ... }
  ]
}
```

---

### 🧠 Full Example

```ts
import { ME } from "this.me";

const me = new ME("my-secret");

// Declare identity
me.name.first("Abella");
me.name.last("Eggleton");
me.profile.role("Musician");
me.profile.age(30);

// Semantic universes
me.system.audio.filters.lowpass.cutoff(1200);
me.system.audio.filters.lowpass.resonance(0.7);

// Encrypted branch
me.wallet["_"]("XYZ");
me.wallet.balance(500);
me.wallet.transactions.list([1, 2, 3]);

// Read values
console.log(me("name.first")); // "Abella"
console.log(me("profile.age")); // 30

// Logic
if (me("profile.age") > 21) {
  console.log("Access granted");
}

// Export
console.log(JSON.stringify(me.export(), null, 2));
```

---


<a href="https://www.neurons.me" target="_blank">
<img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760893633/npm-neurons-me_9b3e3a.jpg" style="zoom:16%;" /></a>

##### License
MIT © 2025 by https://neurons.me
See the [LICENSE](./LICENSE) file for details.
