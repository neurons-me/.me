/// <reference types="node" />
// Recompute wave correctness: every derivation is computed after all of its
// inputs (topological order), unchanged values stop the wave (early cutoff),
// and a derivation with no correct value has no value (undefined) with the
// reason visible in explain().
import assert from "node:assert/strict";
import ME from "../dist/index.js";

type Case = { name: string; run: (mode: "eager" | "lazy") => void };

function fresh(mode: "eager" | "lazy"): any {
  const me: any = new (ME as any)();
  me.setRecomputeMode(mode);
  return me;
}

function memCount(me: any): number {
  return me.inspect().memories.length;
}

const cases: Case[] = [
  // ─── topological order ───────────────────────────────────────────────────
  {
    name: "order with discount and tax: total sees the updated tax",
    run(mode) {
      const me = fresh(mode);
      me.order.price(100);
      me.order["="]("discount", "price * 0.1");
      me.order["="]("net", "price - discount");
      me.order["="]("tax", "net * 0.16");
      me.order["="]("total", "price + tax");
      assert.equal(me("order.total"), 114.4);
      me.order.price(200);
      assert.equal(me("order.tax"), 28.8);
      assert.equal(me("order.total"), 228.8);
    },
  },
  {
    name: "uneven diamond: d reads a directly and via a -> b -> c",
    run(mode) {
      const me = fresh(mode);
      me.g.a(1);
      me.g["="]("b", "a + 1");
      me.g["="]("c", "b * 10");
      me.g["="]("d", "a + c");
      me.g.a(2);
      assert.equal(me("g.d"), 32);
      if (mode === "eager") {
        const meta = me.explain("g.d").meta;
        assert.equal(meta.k, 3);
        assert.deepEqual(meta.recomputed, ["g.b", "g.c", "g.d"]);
      }
    },
  },
  {
    name: "each derivation is evaluated once per wave",
    run(mode) {
      const me = fresh(mode);
      me.g.a(1);
      me.g["="]("b", "a + 1");
      me.g["="]("c", "a * 2");
      me.g["="]("d", "b + c");
      me.g["="]("e", "d + a + b + c");
      const before = memCount(me);
      me.g.a(5);
      me("g.e");
      assert.equal(me("g.e"), 5 + 6 + 10 + 16);
      assert.equal(memCount(me) - before, 5); // the write + b, c, d, e once each
    },
  },

  // ─── early cutoff ────────────────────────────────────────────────────────
  {
    name: "unchanged value stops the wave: no memory, not in changed",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me.s["="]("label", "pos == true");
      me("s.label");
      const before = memCount(me);
      me.s.a(2);
      assert.equal(me("s.label"), true);
      assert.equal(memCount(me) - before, 1); // only the write itself
      if (mode === "eager") {
        const meta = me.explain("s.pos").meta;
        assert.equal(meta.k, 1); // pos was evaluated...
        assert.deepEqual(meta.changed, []); // ...but did not change
      }
    },
  },
  {
    name: "cutoff is per input: a sibling that did change still propagates",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me.s["="]("double", "a * 2");
      me.s["="]("out", "pos && double > 3");
      assert.equal(me("s.out"), false);
      me.s.a(2); // pos stays true (cut off), double 2 -> 4 (changed)
      assert.equal(me("s.out"), true);
      if (mode === "eager") {
        assert.deepEqual([...me.explain("s.out").meta.changed].sort(), ["s.double", "s.out"]);
      }
    },
  },
  {
    name: "NaN to NaN counts as unchanged (Object.is)",
    run(mode) {
      const me = fresh(mode);
      me.n.a(0);
      me.n.b(0);
      me.n["="]("q", "a / b"); // NaN
      me.n["="]("seen", "q + 1");
      me("n.seen");
      const before = memCount(me);
      me.n.a(0); // same inputs again -> q is NaN again
      me("n.seen");
      assert.equal(memCount(me) - before, 1);
    },
  },

  {
    name: "cutoff compares against the stored value after a direct write to a derived path",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me.s.pos(false); // overwritten from outside the formula
      me.s.a(2); // formula yields true again: must not be cut off against its own last `true`
      assert.equal(me("s.pos"), true);
    },
  },

  // ─── missing inputs: undefined + reason ──────────────────────────────────
  {
    name: "removing an input makes the derived value undefined, with reason",
    run(mode) {
      const me = fresh(mode);
      me.r.a(5);
      me.r.b(1);
      me.r["="]("sum", "a + b");
      assert.equal(me("r.sum"), 6);
      me.r.a["-"]();
      assert.equal(me("r.sum"), undefined);
      const u = me.explain("r.sum").meta.unresolved;
      assert.equal(u?.reason, "missing-input");
      assert.deepEqual(u?.inputs, ["r.a"]);
      me.r.a(10);
      assert.equal(me("r.sum"), 11);
      assert.equal(me.explain("r.sum").meta.unresolved, undefined);
    },
  },
  {
    name: "declaring with a missing input gives undefined (not the formula text)",
    run(mode) {
      const me = fresh(mode);
      me.p.x(1);
      me.p["="]("y", "x + later");
      assert.equal(me("p.y"), undefined);
      assert.deepEqual(me.explain("p.y").meta.unresolved?.inputs, ["p.later"]); // reported at the formula's scope
      me.p.later(4);
      assert.equal(me("p.y"), 5);
    },
  },
  {
    name: "a dependent of an unresolved value is unresolved too",
    run(mode) {
      const me = fresh(mode);
      me.r.a(5);
      me.r["="]("b", "a * 2");
      me.r["="]("c", "b + 1");
      me.r.a["-"]();
      assert.equal(me("r.b"), undefined);
      assert.equal(me("r.c"), undefined);
      assert.deepEqual(me.explain("r.c").meta.unresolved?.inputs, ["r.b"]);
    },
  },

  // ─── cycles fail closed ──────────────────────────────────────────────────
  {
    name: "a cycle leaves its members undefined with reason 'cycle'",
    run(mode) {
      const me = fresh(mode);
      me.c.x(1);
      me.c["="]("a", "x + b");
      me.c["="]("b", "a + 1");
      assert.equal(me("c.a"), undefined);
      assert.equal(me("c.b"), undefined);
      const u = me.explain("c.a").meta.unresolved;
      assert.equal(u?.reason, "cycle");
      assert.deepEqual([...(u?.cycle ?? [])].sort(), ["c.a", "c.b"]);
    },
  },
  {
    name: "cycle: its dependents are undefined, the rest of the wave updates",
    run(mode) {
      const me = fresh(mode);
      me.c.x(1);
      me.c["="]("a", "x + b");
      me.c["="]("b", "a + 1");
      me.c["="]("downstream", "a * 2"); // depends on the cycle
      me.c["="]("outside", "x * 100"); // same source, not in the cycle
      me.c.x(3);
      assert.equal(me("c.outside"), 300);
      assert.equal(me("c.downstream"), undefined);
      assert.equal(me.explain("c.downstream").meta.unresolved?.reason, "missing-input");
      assert.equal(me("c.a"), undefined);
    },
  },
  {
    name: "a formula reading itself is a cycle, not a stale read",
    run(mode) {
      const me = fresh(mode);
      me.c.x(1);
      me.c["="]("a", "x + a");
      assert.equal(me("c.a"), undefined);
      me.c.x(2);
      assert.equal(me("c.a"), undefined);
      const u = me.explain("c.a").meta.unresolved;
      assert.equal(u?.reason, "cycle");
      assert.deepEqual(u?.cycle, ["c.a"]);
    },
  },
  {
    name: "breaking the cycle by redeclaring restores values",
    run(mode) {
      const me = fresh(mode);
      me.c.x(1);
      me.c["="]("a", "x + b");
      me.c["="]("b", "a + 1");
      me.c["="]("b", "x * 10"); // no longer reads a
      assert.equal(me("c.b"), 10);
      assert.equal(me("c.a"), 11);
      assert.equal(me.explain("c.a").meta.unresolved, undefined);
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
      console.log(`FAIL [${mode}] ${c.name}\n     ${String(err?.message ?? err).split("\n")[0]}`);
    }
  }
}
if (failed > 0) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log("\nall wave cases passed");
