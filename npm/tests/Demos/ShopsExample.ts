import assert from "node:assert/strict";
import ME from "this.me";

const me = new ME() as any;

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function format(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  return JSON.stringify(value, null, 2);
}

function show(label: string, value: unknown) {
  console.log(`${label} -> ${format(value)}`);
}

function showExplain(path: string) {
  const trace = me.explain(path);
  console.log(
    `explain(${path}) -> ${format({
      path: trace.path,
      value: trace.value,
      expression: trace.derivation?.expression ?? null,
      inputs: trace.derivation?.inputs ?? [],
      dependsOn: trace.meta?.dependsOn ?? [],
    })}`,
  );
  return trace;
}

function showInspect(last = 8) {
  const state = me.inspect({ last });
  const indexKeys = Object.keys(state.index).filter(Boolean).sort();
  console.log(`index keys (${indexKeys.length}) -> ${format(indexKeys)}`);
  console.log(`secret scopes -> ${format(state.secretScopes)}`);
  console.log(
    `recent memories -> ${format(
      state.memories.map((entry: any) => ({
        path: entry.path,
        operator: entry.operator ?? "set",
        value: entry.value,
      })),
    )}`,
  );
}

function approx(actual: number, expected: number, epsilon = 1e-10) {
  return Math.abs(actual - expected) <= epsilon;
}

console.log("\n.me demo: Coffee Shops");

me.shops[1].name("Downtown");
me.shops[1].menu.latte(4.5);
me.shops[1].menu.espresso(3.0);

me.shops[2].name("Riverside");
me.shops[2].menu.latte(5.0);
me.shops[2].menu.espresso(3.5);

me.shops[3].name("Station");
me.shops[3].menu.latte(4.8);
me.shops[3].menu.espresso(3.5);

me.shops["[i]"].menu["="]("breakfastDeal", "latte + espresso - 1.5");
me.shops["[i]"].menu["="]("isPremium", "breakfastDeal > 6.5");

section("Public Menu Math");
show("shops[1..3].menu.breakfastDeal", me("shops[1..3].menu.breakfastDeal"));
show("shops[menu.isPremium == true].name", me("shops[menu.isPremium == true].name"));
show("shops[1].menu.breakfastDeal", me("shops[1].menu.breakfastDeal"));
show("shops[2].menu.breakfastDeal", me("shops[2].menu.breakfastDeal"));
show("shops[3].menu.breakfastDeal", me("shops[3].menu.breakfastDeal"));

assert.equal(me("shops[1].menu.breakfastDeal"), 6);
assert.equal(me("shops[2].menu.breakfastDeal"), 7);
assert.ok(approx(me("shops[3].menu.breakfastDeal"), 6.8));
assert.deepEqual(me("shops[menu.isPremium == true].name"), {
  2: "Riverside",
  3: "Station",
});

section("Reactive Price Update");
show("premium shops before", me("shops[menu.isPremium == true].name"));
me.shops[1].menu.latte(5.1);
show("premium shops after downtown price change", me("shops[menu.isPremium == true].name"));

assert.equal(me("shops[1].menu.breakfastDeal"), 6.6);
assert.deepEqual(me("shops[menu.isPremium == true].name"), {
  1: "Downtown",
  2: "Riverside",
  3: "Station",
});

section("Explain Public Derivation");
const publicTrace = showExplain("shops[1].menu.isPremium");
assert.equal(publicTrace.value, true);
assert.deepEqual(publicTrace.meta.dependsOn, ["shops.1.menu.breakfastDeal"]);

me.shops[1].ops["_"]("downtown-ops-key");
me.shops[1].ops.beansKg(3);
me.shops[1].ops["="]("needsRestock", "beansKg < 4");

section("Private Ops Layer");
show("shops[1].ops", me("shops[1].ops"));
show("shops[1].ops.needsRestock", me("shops[1].ops.needsRestock"));
show("guest shops[1].ops", me.as(null)("shops[1].ops"));
show("guest shops[1].ops.needsRestock", me.as(null)("shops[1].ops.needsRestock"));

assert.equal(me("shops[1].ops"), undefined);
assert.equal(me("shops[1].ops.needsRestock"), true);
assert.equal(me.as(null)("shops[1].ops"), undefined);
assert.equal(me.as(null)("shops[1].ops.needsRestock"), undefined);

const privateTrace = showExplain("shops[1].ops.needsRestock");
assert.equal(privateTrace.value, true);
assert.equal(privateTrace.derivation?.inputs?.[0]?.origin, "stealth");
assert.equal(privateTrace.derivation?.inputs?.[0]?.masked, true);
assert.equal(privateTrace.derivation?.inputs?.[0]?.value, "●●●●");

section("Inspect Tail");
showInspect();

console.log("\nPASS: Coffee Shops demo\n");
