/// <reference types="node" />
// Derivation reference resolution: a derivation must be recomputed whenever
// any path its evaluator could read changes. The evaluator resolves every
// identifier relative-first, root-fallback; subscriptions must match that.
import assert from "node:assert/strict";
import ME from "../dist/index.js";

type Case = { name: string; run: (mode: "eager" | "lazy") => void };

function fresh(mode: "eager" | "lazy"): any {
  const me: any = new (ME as any)();
  me.setRecomputeMode(mode);
  return me;
}

const cases: Case[] = [
  {
    name: "relative dotted ref (paid.ana) recomputes on its own write",
    run(mode) {
      const me = fresh(mode);
      me.wallets.vancouver.total(300);
      me.wallets.vancouver.members.count(3);
      me.wallets.vancouver.paid.ana(0);
      me.wallets.vancouver["="]("per_person", "total / members.count");
      me.wallets.vancouver["="]("balance_ana", "paid.ana - per_person");
      assert.equal(me("wallets.vancouver.balance_ana"), -100);
      me.wallets.vancouver.paid.ana(90);
      assert.equal(me("wallets.vancouver.balance_ana"), -10);
    },
  },
  {
    name: "root undotted ref (master) recomputes on its own write",
    run(mode) {
      const me = fresh(mode);
      me.master(1);
      me.dep.value(10);
      me.dep["="]("out", "value * master");
      assert.equal(me("dep.out"), 10);
      me.master(2);
      assert.equal(me("dep.out"), 20);
    },
  },
  {
    name: "root dotted ref (master.factor) still recomputes",
    run(mode) {
      const me = fresh(mode);
      me.master.factor(1);
      me.dep.value(10);
      me.dep["="]("out", "value * master.factor");
      me.master.factor(3);
      assert.equal(me("dep.out"), 30);
    },
  },
  {
    name: "relative path created after the formula takes over from root",
    run(mode) {
      const me = fresh(mode);
      me.rate(2);
      me.shop.price(10);
      me.shop["="]("total", "price * rate");
      assert.equal(me("shop.total"), 20);
      me.shop.rate(5); // now shadows the root rate, as the evaluator reads it
      assert.equal(me("shop.total"), 50);
      me.rate(7); // root no longer read; value must stay correct
      assert.equal(me("shop.total"), 50);
      me.shop.rate(3);
      assert.equal(me("shop.total"), 30);
    },
  },
  {
    name: "explain() lists one effective path per ref",
    run(mode) {
      const me = fresh(mode);
      me.master(1);
      me.dep.value(10);
      me.dep["="]("out", "value * master");
      const trace = me.explain("dep.out");
      assert.deepEqual([...trace.meta.dependsOn].sort(), ["dep.value", "master"]);
      me.master(2);
      const after = me.explain("dep.out");
      if (mode === "eager") {
        assert.equal(after.meta.k, 1);
        assert.deepEqual(after.meta.recomputed, ["dep.out"]);
      }
      assert.equal(after.value, 20);
    },
  },
  {
    name: "formula reading root recomputes when the relative path first appears",
    run(mode) {
      const me = fresh(mode);
      me.value(3);
      me.dep.k(2);
      me.dep["="]("out", "value * k"); // `value` resolves to root for now
      assert.equal(me("dep.out"), 6);
      me.dep.value(10); // first write of the relative path: now shadows root
      assert.equal(me("dep.out"), 20);
    },
  },
  {
    name: "emptying the relative path lets the root show through again",
    run(mode) {
      const me = fresh(mode);
      me.rate(2);
      me.shop.price(10);
      me.shop.rate(5);
      me.shop["="]("total", "price * rate");
      assert.equal(me("shop.total"), 50);
      me.shop.rate(null);
      assert.equal(me("shop.total"), 20);
    },
  },
  {
    name: "write to a shadowed root path adds only its own memory, recomputes nothing",
    run(mode) {
      const me = fresh(mode);
      for (let i = 0; i < 50; i++) me.dep[i].value(i);
      me.dep["[i]"]["="]("out", "value * 2");
      const before = me.inspect().memories.length;
      me.value(999); // every dep[i] has its own `value`
      assert.equal(me.inspect().memories.length - before, 1);
      assert.equal(me("dep[7].out"), 14);
      assert.equal(me.inspect().memories.length - before, 1); // lazy read too
      assert.notEqual(me.explain("dep[7].out").meta.sourcePath, "value");
    },
  },
  {
    name: "redeclaring or removing a formula leaves no dangling subscriptions",
    run(mode) {
      const me = fresh(mode);
      me.x(5);
      me.a.x(1);
      me.a["="]("y", "x + 1");
      assert.deepEqual(Object.keys(me.refSubscribers).sort(), ["a.x", "x"]);
      me.a["="]("y", "2");
      assert.deepEqual(Object.keys(me.refSubscribers), []);
      me.a["="]("z", "x + 1");
      me.a.z["-"]();
      assert.deepEqual(Object.keys(me.refSubscribers), []);
    },
  },
  // ─── [i] rules apply to children added after the declaration ─────────────
  {
    name: "[i] rule reaches a child added later",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users.pablo.age(15);
      me.users["[i]"]["="]("isAdult", "age >= 18");
      assert.equal(me("users.ana.isAdult"), true);
      assert.equal(me("users.pablo.isAdult"), false);
      me.users.luisa.age(40);
      assert.equal(me("users.luisa.isAdult"), true);
      me.users.luisa.age(12);
      assert.equal(me("users.luisa.isAdult"), false);
    },
  },
  {
    name: "[i] rule reaches a child whose inputs arrive in a later write",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users["[i]"]["="]("isAdult", "age >= 18");
      me.users.luisa.name("Luisa"); // child exists, age not yet
      me.users.luisa.age(40);
      assert.equal(me("users.luisa.isAdult"), true);
    },
  },
  {
    name: "[i] nested target (shops[i].menu) reaches a shop added later",
    run(mode) {
      const me = fresh(mode);
      me.shops.north.menu.latte(4);
      me.shops.north.menu.espresso(3);
      me.shops["[i]"].menu["="]("deal", "latte + espresso - 1.5");
      assert.equal(me("shops.north.menu.deal"), 5.5);
      me.shops.south.menu.latte(5);
      me.shops.south.menu.espresso(4);
      assert.equal(me("shops.south.menu.deal"), 7.5);
    },
  },
  {
    name: "[i] numeric index child added later (dep[i] as in the fan-out demo)",
    run(mode) {
      const me = fresh(mode);
      me.master.factor(2);
      me.dep[0].value(1);
      me.dep["[i]"]["="]("out", "value * master.factor");
      me.dep[7].value(5);
      assert.equal(me("dep[7].out"), 10);
      me.master.factor(3);
      assert.equal(me("dep[7].out"), 15);
      assert.equal(me("dep[0].out"), 3);
    },
  },
  {
    name: "[i] redeclared formula replaces the old one for later children too",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users["[i]"]["="]("isAdult", "age >= 18");
      me.users["[i]"]["="]("isAdult", "age >= 21");
      assert.equal(me("users.ana.isAdult"), false);
      me.users.luisa.age(19);
      assert.equal(me("users.luisa.isAdult"), false);
    },
  },
  {
    name: "[i] rule is dropped when its collection is removed",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users["[i]"]["="]("isAdult", "age >= 18");
      me.users["-"]();
      me.users.luisa.age(40);
      assert.equal(me("users.luisa.isAdult"), undefined);
    },
  },
  {
    name: "[i] rule survives removing one child and re-adding it",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users["[i]"]["="]("isAdult", "age >= 18");
      me.users.ana["-"]();
      me.users.ana.age(10);
      assert.equal(me("users.ana.isAdult"), false);
    },
  },
];

let failed = 0;
for (const mode of ["eager", "lazy"] as const) {
  for (const c of cases) {
    try {
      c.run(mode);
      console.log(`ok   [${mode}] ${c.name}`);
    } catch (err: any) {
      failed++;
      console.log(`FAIL [${mode}] ${c.name}\n     ${err?.message?.split("\n")[0]}`);
    }
  }
}
if (failed > 0) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log("\nall derivation cases passed");
