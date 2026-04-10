# Space Algebra

`.me` is built on spaces, subspaces, and set laws.

- [Space Algebra](/Space-Algebra)

## **Start .me in 60 seconds**
###### Import
```ts
import Me from "this.me";
const me = new Me();
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
me.users.ana.name("Ana");
me.users.ana.bio("Designing semantic interfaces.");
me.users.ana.age(22);
me.users.pablo.name("Pablo");
me.users.pablo.bio("Building distributed systems.");
me.users.pablo.age(17);
```

###### **Use in expressions**
```ts
me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
// Broadcast logic over friend pointers
me.friends["[i]"]["="]("is_adult", "age >= 18");
```
###### Read Your Data
```ts
me("profile.bio"); // → "Building the semantic web."
me("friends.ana.bio");// → "Designing semantic interfaces."
me("friends.pablo.name");// → "Pablo"
me("friends.ana.is_adult");// → true
me("friends.pablo.is_adult");// → false
me("friends[age > 18].name");// → { ana: "Ana" }
```

---

# ⟁ Infinite Semantic Trees
**.me** supports **infinite** nesting:

```ts
// 1. Build your nested house
me.home.kitchen.lights.main.brightness(80); //sets the value to 80
me.home.kitchen.lights.leds.brightness(40); //sets the value to 40
// 2. Add "Master Control" Logic
me.home.kitchen.lights["="]("avg", "(main.brightness + leds.brightness) / 2"); // 80 + 40 / 2
me("home.kitchen.lights.avg"); // → 60
```

```txt
Runtime output (real):
  avg -> 60

  inspect().index ->
  {
    "home.kitchen.lights.main.brightness": 80,
    "home.kitchen.lights.leds.brightness": 40,
    "home.kitchen.lights.avg": 60
  }

  last memory events ->
  [
    { path: "home.kitchen.lights.main.brightness", op: null, value: 80 },
    { path: "home.kitchen.lights.leds.brightness", op: null, value: 40 },
    { path: "home.kitchen.lights.avg", op: "=", value: 60 }
  ]
```

You can **bridge** distant rooms with **Pointers**:
```ts
// Create a "Master Switch" at your root
me.main_switch["->"]("home.kitchen.lights.main");
me.main_switch.brightness(0); // Turn off the kitchen from the root
me("home.kitchen.lights.avg"); // → 20 (Reactive Auto-Update)
```
You can construct any conceptual universe.
### Run your coffee shops ☕:
```ts
// 1. Build two shops as an indexed collection
me.shops[1].name("Downtown");
me.shops[1].menu.latte.price(4.5);
me.shops[1].menu.espresso.price(3.0);
me.shops[2].name("Riverside");
me.shops[2].menu.latte.price(5.0);
me.shops[2].menu.espresso.price(3.5);
// 2. Broadcast combo logic to every shop (iterator [i])
me.shops["[i]"].menu["="]("breakfast_deal", "latte.price + espresso.price - 1.5");
// 3. Read by range selector
me("shops[1..2].menu.breakfast_deal"); // → { "1": 6.0, "2": 7.0 }
// 4. Filter shops by computed value
me("shops[menu.breakfast_deal > 6].name"); // → { "2": "Riverside" }
```

Or even patch ◎──▶ your **master bus** ──▶ to your **moog synth** filter ──▶◉
```ts
me.studio.master_bus.input["->"]("studio.synth.moog.filter");
me.studio.master_bus.input.cutoff(1200);
me("studio.synth.moog.filter.cutoff"); // → 1200
```

---

## 𓂀 Secrets: Encrypted Universes
Secrets don't just hide data; they create **Private Sub-Dimensions** in your identity tree.
```ts
// 1. Declare a secret scope at any branch
me.wallet["_"]("vault-key-2026"); 
me.wallet.balance(500);
me.wallet.note("Private savings");
```

```txt
After these writes:

Public index plane (inspect().index):
  "" -> { __id: "jabellae" }

Secret scope roots:
  ["wallet"]

Encrypted branch plane (exportSnapshot().encryptedBranches):
  wallet -> 0x4b46...6f1c4e
```

Everything under a `["_"]` scope is **stored as an Encrypted Blob**. By design, secret roots are Stealth:
```ts
me("wallet"); // → undefined (The root is a ghost)
me("wallet.balance"); // → 500 (Direct path resolution works)
```
###### 𓉔 Recursive Stealth:

**Secrets nest infinitely**. Each `["_"]` creates a deeper, independent cryptographic layer:

```ts
me.wallet["_"]("KEY-A");
me.wallet.hidden["_"]("KEY-B");// Nested secret scope
me.wallet.hidden.note("Deep dark secret");
me("wallet.hidden"); // → undefined
me("wallet.hidden.note");// → "Deep dark secret"
```

## 𓉐 The Rules of the Vault:
**Zero-Knowledge Roots:** You can't "list" a secret directory. If you don't know the path, the data doesn't exist for you.

**Path-Based Resolution:** There is no global unlock() call. Security is woven into the Semantic Path.
**Atomic Encryption:** Every secret branch is a self-contained encrypted universe.


- **A secret belongs to a specific position in the identity tree.**
- Everything under that position becomes encrypted.
- If you declare another secret inside, it becomes a deeper encrypted scope.
- Reads are path-based; there is no global `me.secret(...)` unlock call.

###### Structural view (public vs secret planes)
```txt
Public index plane (inspect().index):
  "" -> { __id: "jabellae" }

Secret scope roots:
  ["wallet"]

Encrypted branch plane (exportSnapshot().encryptedBranches):
  wallet -> 0x4b46...6f1c4e

Read behavior:
  me("wallet") -> undefined
  me("wallet.balance") -> 500
```

---

## ⟐ Why .me?
- **Infinite Surface:** No schemas. If you think of a path `(me.a.b.c)`, it exists. You **define your universe as you speak.**
- **Universal Query:** Any string is a query. No SQL, no complex APIs. Just paths and brackets `[]`.
- **Fractal Privacy:** Security isn't a "plugin." It's woven into the tree. You can drop a `Secret ["_"]` anywhere, and that branch becomes a private universe.
- **Deterministic Replay:** Every state change is a "Memory." You can export your entire identity and rebuild it exactly as it was, anywhere in the world.
- **Zero Baggage:** No dependencies. No bloat. Pure logic that runs in 15ms on a browser or a server.

---

## 𓆣 Explain Derivations

Use `me.explain(path)` to audit how a computed value was produced.

```ts
const trace = me.explain("shops.2.menu.breakfast_deal");
console.log(trace);
```

**Example trace:**

```json
{
  "path": "shops.2.menu.breakfast_deal",
  "value": 7,
  "derivation": {
    "expression": "latte.price + espresso.price - 1.5",
    "inputs": [
      {
        "label": "latte.price",
        "path": "shops.2.menu.latte.price",
        "value": 5,
        "origin": "public",
        "masked": false
      },
      {
        "label": "espresso.price",
        "path": "shops.2.menu.espresso.price",
        "value": 3.5,
        "origin": "public",
        "masked": false
      }
    ]
  },
  "meta": {
    "dependsOn": [
      "shops.2.menu.latte.price",
      "shops.2.menu.espresso.price"
    ]
  }
}
```

For runtime snapshots/debug:

```ts
me.inspect(); // memory + index + scopes
me.exportSnapshot();  // full portable state (Phase 7B)
```

# 𓃭 The Engine: Why it’s so fast?𓃭
While traditional databases get bogged down in heavy scans and slow joins, the **.me Kernel** doesn't "search" for data—it navigates a **Semantic Algebra.**

#### 𓎛 Incremental Intelligence (Phase 8) 
Unlike standard reactive frameworks that re-render everything, **.me** uses an **Inverted Dependency Index.**
When you define a formula (=), the Kernel maps the relationship.
On mutation, only the affected nodes wake up.
**The Result**: Local updates resolve in 15ms, achieving 
 complexity (where 
 is the specific dependency chain, not the size of the tree).

#### 𓁟 Hermetic Sandbox (Phase C)
Security isn't a "check"; it's a grammar.
We replaced `eval()` with a custom **Shunting-yard + RPN evaluator.**
The Kernel is physically incapable of executing arbitrary code. **It only resolves math and logic** over its own validated paths.

#### Fractal Stealth (Phase 0 & 6)
###### Privacy is woven into the tree's geometry.
**Stealth Roots:** Secret scopes `("_")` are invisible to standard lookups.
**Deterministic Integrity:** Calculations can cross from public to secret scopes **(Phase 6)** without ever exposing the sensitive keys in the audit trail (me.explain).
**Zero-Latency Portability** **(Phase 7A/B)**

###### 𓂀𓈖𓂀 ⟐ Your identity is Deterministic ⟐ 𓂀𓈖𓂀

By exporting **"Memory"** or **"Snapshots"**, you can teleport your entire state between a **MacBook Air** in **Veracruz** and a high-end server in **London.**
The behavior is identical, bit-by-bit, because the logic is part of the state.

---
<a href="https://www.neurons.me" target="_blank">
<img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760901388/bc75d34cf31ad2217a3cc607f41b884c022e8a7e0dc022e2678bbba5bac1cd59-removebg-preview-removebg-preview_w6c3il.png" style="zoom:21%;" /></a>


##### License
**MIT © 2025 by https://neurons.me**

See the `LICENSE` file in the package root for details.

**∴ Witness our seal** 

**suiGn**
