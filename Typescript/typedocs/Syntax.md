# Syntax of .me ​

`.me` syntax is algebraic, not tied to any human language.

Core idea:

- A path is a symbolic address.
- A call is an operation over that address.
- Meaning comes from structure, not from English/Spanish/Japanese words.

## 1. Algebra First ​

Minimal form:

```ts
me.path.to.node(value)   // write
me("path.to.node")       // read
```

You can replace `path.to.node` with any valid symbols:

```ts
me.alpha.beta.gamma(10);
me("alpha.beta.gamma"); // 10
```

```ts
me.ventas.clientes.total(10);
me("ventas.clientes.total"); // 10
```

```ts
me.売上.顧客.合計(10);
me("売上.顧客.合計"); // 10
```

Same algebra, different vocabulary.

## 2. Path Construction Rules ​

- Dot `.` creates hierarchy.
- `[]` addresses indexed or selected members.
- `()` executes read/write/operator logic.

Examples:

```ts
me.user.name("Ana");
me.user.age(22);
me("user.name"); // "Ana"
me("user.age");  // 22
```

```ts
me.products[1].name("Keyboard");
me.products[1].price(80);
me("products[1].name");  // "Keyboard"
me("products[1].price"); // 80
```

## 3. Human-Language Agnostic Namespaces ​

## English ​

```ts
me.shop.items[1].price(100);
me.shop.tax_rate(0.16);
me.shop.items[1]["="]("total", "price + (price * shop.tax_rate)");
me("shop.items[1].total");
```

Expected output:

```txt
116
```

## Spanish ​

```ts
me.tienda.articulos[1].precio(100);
me.tienda.impuesto(0.16);
me.tienda.articulos[1]["="]("total", "precio + (precio * tienda.impuesto)");
me("tienda.articulos[1].total");
```

Expected output:

```txt
116
```

## Japanese ​

```ts
me.店舗.商品[1].価格(100);
me.店舗.税率(0.16);
me.店舗.商品[1]["="]("合計", "価格 + (価格 * 店舗.税率)");
me("店舗.商品[1].合計");
```

Expected output:

```txt
116
```

## 4. [] Selector Syntax ​

## Fixed index ​

```ts
me.fleet.trucks[2].km(1200);
me("fleet.trucks[2].km");
```

Expected output:

```txt
1200
```

## Broadcast [i] ​

```ts
me.fleet.trucks[1].fuel(100);
me.fleet.trucks[2].fuel(200);
me.fleet.trucks[3].fuel(400);
me.price_per_liter(2);
me.fleet["trucks[i]"]["="]("cost", "fuel * price_per_liter");
me("fleet.trucks[2].cost");
```

Expected output:

```txt
400
```

## Logical filter ​

```ts
me("fleet.trucks[fuel >= 200].fuel");
```

Expected output:

```txt
{ "2": 200, "3": 400 }
```

## Range ​

```ts
me("fleet.trucks[1..2].fuel");
```

Expected output:

```txt
{ "1": 100, "2": 200 }
```

## Multi-select ​

```ts
me("fleet.trucks[[1,3]].fuel");
```

Expected output:

```txt
{ "1": 100, "3": 400 }
```

## Transform ​

```ts
me("fleet.trucks[x => x.fuel * 0.5]");
```

Expected output:

```txt
{ "1": 50, "2": 100, "3": 200 }
```

## 5. Operator Syntax Examples ​

## @ identity ​

```ts
me["@"]("Abella");
me.inspect({ last: 1 }).memories[0].operator;
```

Expected output:

```txt
"@"
```

## _ secret scope ​

```ts
me.wallet["_"]("vault-key");
me.wallet.balance(500);
me("wallet");
me("wallet.balance");
```

Expected output:

```txt
undefined
500
```

## ~ noise reset ​

```ts
me.wallet["_"]("alpha");
me.wallet.secretA("A");
me.wallet["~"]("beta-seed");
me.wallet.secretB("B");
me("wallet.secretA");
me("wallet.secretB");
```

Expected output:

```txt
"A"
"B"
```

## __ / -> pointer ​

```ts
me.inventory.stock(900);
me.dashboard.card["->"]("inventory");
me("dashboard.card");
me("dashboard.card.stock");
```

Expected output:

```txt
{ "__ptr": "inventory" }
900
```

## = derivation ​

```ts
me.order.subtotal(100);
me.order.tax(16);
me.order["="]("total", "subtotal + tax");
me("order.total");
```

Expected output:

```txt
116
```

## ? collect ​

```ts
me.user.name("Ana");
me.user.age(22);
me.report["?"](["user.name", "user.age"], (name, age) => \`\${name}:\${age}\`);
me("report");
```

Expected output:

```txt
"Ana:22"
```

## - remove ​

```ts
me.temp.value("to-delete");
me("temp.value");    // before
me.temp["-"]("value");
me("temp.value");    // after
```

Expected output:

```txt
"to-delete"
undefined
```

## 6. Real-World Mini Scenarios ​

## E-commerce ​

```ts
me.products[1].name("Laptop");
me.products[1].price(1000);
me.products[1].discount(100);
me.products[1]["="]("final", "price - discount");
me("products[1].final");
```

Expected output:

```txt
900
```

## Logistics ​

```ts
me.routes[1].distance_km(120);
me.routes[1].fuel_l(12);
me.routes[1]["="]("efficiency", "distance_km / fuel_l");
me("routes[1].efficiency");
```

Expected output:

```txt
10
```

## Education ​

```ts
me.students[1].name("Lia");
me.students[1].math(90);
me.students[1].science(80);
me.students[1]["="]("avg", "(math + science) / 2");
me("students[1].avg");
```

Expected output:

```txt
85
```

## IoT ​

```ts
me.sensors[1].temp(21);
me.sensors[2].temp(30);
me("sensors[temp >= 25].temp");
```

Expected output:

```txt
{ "2": 30 }
```

## 7. Summary ​

- `.me` syntax is path algebra.
- Human words are labels only; structure and operators define behavior.
- The same logic works across English, Spanish, Japanese, or domain-specific symbols.