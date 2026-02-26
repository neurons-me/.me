<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me  

```bash
npm install this.me
```
## **Start .me in 20 seconds**
###### Import
```ts
import ME from "this.me";
const me = new ME();
```

###### **Declare** Your Identity.
```ts
me["@"]("jabellae");
```

###### **Declare** Your Data.
```ts
me.profile.name("Abella.e");
me.profile.bio("Building the semantic web.");
me.profile.pic("https://neurons.me/media/neurons-grey.png");

```

##### **Use in expressions**
```ts
me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");

// Broadcast logic over friend pointers
me["friends[i]"]["="]("is_adult", "age >= 18");

```
##### Read Your Data
```ts
me("profile.bio");       // → "Designing semantic interfaces."
me("friends.ana.is_adult");  // → true
me("friends.pablo.is_adult");// → false
me("friends[age > 18].name");// → { ana: "Ana" }
```

---

## ⟁ Infinite Semantic Trees
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

## 𓂀 Secrets: Encrypted Universes
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

## ⟐ Why ME Works

- Proxies → infinite language surface  
- Path strings → universal query interface  
- Values → semantic meaning, not strict types  
- Secrets → fractal encrypted universes  
- Export → deterministic declarative identity  
- ▢ Deterministic export
- Zero dependencies  
- Browser & Node compatible  

---

## 𓆣 Export Identity

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

## ⟡ Full Example

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
<img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760901388/bc75d34cf31ad2217a3cc607f41b884c022e8a7e0dc022e2678bbba5bac1cd59-removebg-preview-removebg-preview_w6c3il.png" style="zoom:16%;" /></a>


##### License
MIT © 2025 by https://neurons.me
See the [LICENSE](./LICENSE) file for details.
∴ Witness our seal 
suiGn
