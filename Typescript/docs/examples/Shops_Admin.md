# ☕ Shops Admin Walkthrough
This example shows how to model a multi-shop admin panel in `.me` using:
- indexed collections (`shops[1]`, `shops[2]`)
- broadcast formulas (`[i]`)
- range selectors (`[1..2]`)
- logical filters (`[menu.breakfast_deal > 6]`)

---

## Full Script (`tests/ShopsExample.ts`)

```ts
import ME from "this.me";
const me = new ME() as any;

console.log("\n.me example2: shops + [] selectors");

// 1) Build two shops as an indexed collection
me.shops[1].name("Downtown");
me.shops[1].menu.latte.price(4.5);
me.shops[1].menu.espresso.price(3.0);

me.shops[2].name("Riverside");
me.shops[2].menu.latte.price(5.0);
me.shops[2].menu.espresso.price(3.5);

// 2) Broadcast combo logic to every shop (iterator [i])
me.shops["[i]"].menu["="]("breakfast_deal", "latte.price + espresso.price - 1.5");

// 3) Read by range selector
const rangeDeals = me("shops[1..2].menu.breakfast_deal");
console.log("shops[1..2].menu.breakfast_deal ->", rangeDeals);

// 4) Filter shops by computed value
const filteredNames = me("shops[menu.breakfast_deal > 6].name");
console.log("shops[menu.breakfast_deal > 6].name ->", filteredNames);

// 5) Direct leaf checks
console.log("shops[1].menu.breakfast_deal ->", me("shops[1].menu.breakfast_deal")); // 6
console.log("shops[2].menu.breakfast_deal ->", me("shops[2].menu.breakfast_deal")); // 7
```

---

## 𓂀 Step-by-Step Semantics

### 1) Build the collection
```ts
me.shops[1].menu.latte.price(4.5);
me.shops[2].menu.latte.price(5.0);
```

You are creating a semantic indexed tree:

```txt
shops
 ├─ 1
 │   └─ menu
 │      ├─ latte.price = 4.5
 │      └─ espresso.price = 3.0
 └─ 2
     └─ menu
        ├─ latte.price = 5.0
        └─ espresso.price = 3.5
```

### 2) Broadcast formula over all members (`[i]`)
```ts
me.shops["[i]"].menu["="]("breakfast_deal", "latte.price + espresso.price - 1.5");
```

The kernel compiles one derivation rule and applies it to each existing child under `shops`.

Result:
- `shops[1].menu.breakfast_deal = 6`
- `shops[2].menu.breakfast_deal = 7`

### 3) Read range slice (`[1..2]`)
```ts
me("shops[1..2].menu.breakfast_deal");
```

Range selector returns a keyed projection:

```json
{ "1": 6, "2": 7 }
```

### 4) Filter with logic
```ts
me("shops[menu.breakfast_deal > 6].name");
```

Only matching children survive the predicate:

```json
{ "2": "Riverside" }
```

---

## 𓆣 Optional Audit (Explain)

You can inspect why one computed value exists:

```ts
console.log(me.explain("shops.2.menu.breakfast_deal"));
```

This returns:
- expression used
- input dependencies
- last compute metadata
- masked origin if a dependency is stealth

---

## Runtime Output (real)

```txt
suign@Suis-MacBook-Air npm % node tests/ShopsExample.ts

.me example2: shops + [] selectors
shops[1..2].menu.breakfast_deal -> { '1': 6, '2': 7 }
shops[menu.breakfast_deal > 6].name -> { '2': 'Riverside' }
shops[1].menu.breakfast_deal -> 6
shops[2].menu.breakfast_deal -> 7
```

---

## Run

```bash
node tests/ShopsExample.ts
```

If the output matches, your collection selectors, broadcast derivation, and logic filter are all working correctly.
