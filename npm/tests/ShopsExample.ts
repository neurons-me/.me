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
