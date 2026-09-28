/// <reference types="node" />
// Recompute wave correctness: every derivation is computed after all of its
// inputs (topological order), unchanged values stop the wave (early cutoff),
// and a derivation with no correct value has no value (undefined) with the
// reason visible in explain().
import assert from "node:assert/strict";
import ME from "../dist/index.js";

type Case = { name: string; run: (mode: "eager" | "lazy") => void | Promise<void> };

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

  // ─── cutoff cache: the last value a derivation wrote must never go stale ──
  // Pattern: the formula wrote `true` (cached). The stored value is changed by
  // some other route; then an input changes so the formula yields `true`
  // again. The wave must still write it: comparing against a stale cache would
  // cut it off and leave the other route's value in place.
  {
    name: "cache: write via learn() (memory-log layer)",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me("s.pos");
      me.learn({ path: "s.pos", operator: null, expression: false, value: false });
      assert.equal(me("s.pos"), false);
      me.s.a(2);
      assert.equal(me("s.pos"), true);
    },
  },
  {
    name: "cache: a write through a pointer does not reach the derived path",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me("s.pos");
      me.alias["->"]("s");
      me.alias.pos(false); // stored under alias.pos, not s.pos
      assert.equal(me("s.pos"), true);
      me.s.a(2);
      assert.equal(me("s.pos"), true);
    },
  },
  {
    name: "cache: formula in a secret branch across lockIdentity/unlock",
    async run(mode) {
      const me = fresh(mode);
      await me.createIdentityRoot("wave-cache-lock-password-01");
      me.vault["_"]("vault-door-01");
      me.vault.a(1);
      me.vault["="]("pos", "a > 0");
      assert.equal(me("vault.pos"), true);
      me.lockIdentity();
      me.vault.pos(false); // refused while locked: stored value must be untouched
      await me.unlockIdentity("wave-cache-lock-password-01");
      me.vault["_"]("vault-door-01");
      assert.equal(me("vault.pos"), true);
      me.vault.a(0);
      assert.equal(me("vault.pos"), false);
      me.vault.a(3);
      assert.equal(me("vault.pos"), true);
    },
  },
  {
    name: "cache: importSnapshot replaces formulas and cache together",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me("s.pos");
      const other = fresh(mode);
      other.s.a(1);
      other.s.pos(false);
      me.importSnapshot(other.exportSnapshot());
      assert.equal(me("s.pos"), false);
      // Formulas are not persisted in snapshots yet (bug #2): nothing is
      // derived after import, so no cache can outlive it.
      assert.equal(me.explain("s.pos").derivation, null);
      me.s["="]("pos", "a > 0");
      assert.equal(me("s.pos"), true);
    },
  },
  {
    name: "cache: replayMemories resets formulas and cache together",
    run(mode) {
      const me = fresh(mode);
      me.s.a(1);
      me.s["="]("pos", "a > 0");
      me("s.pos");
      me.replayMemories([
        { path: "s.a", operator: null, expression: 1, value: 1 },
        { path: "s.pos", operator: null, expression: false, value: false },
      ]);
      assert.equal(me("s.pos"), false);
      assert.equal(me.explain("s.pos").derivation, null);
    },
  },

  // ─── flat fan-out shortcut ───────────────────────────────────────────────
  {
    name: "almost flat: 100 direct dependents, one with its own dependent",
    run(mode) {
      const me = fresh(mode);
      me.f.src(1);
      for (let i = 1; i <= 100; i++) me.f.dep[i]["="]("out", "f.src * " + i);
      me.f["="]("top", "dep[50].out + 1"); // reads a dependent, not the source
      me.f.src(2);
      assert.equal(me("f.dep[50].out"), 100);
      assert.equal(me("f.top"), 101);
      if (mode === "eager") assert.equal(me.explain("f.top").meta.k, 101);
    },
  },
  {
    name: "almost flat, adversarial: the second-level node also reads the source",
    run(mode) {
      const me = fresh(mode);
      me.f.src(1);
      for (let i = 1; i <= 100; i++) me.f.dep[i]["="]("out", "f.src * " + i);
      me.f["="]("top", "src + dep[100].out"); // src is f.src here (scope f) // same level as deps by src, one below by dep
      me.f.src(3);
      assert.equal(me("f.top"), 3 + 300);
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

// ─── known failing: open bugs, kept red and visible ────────────────────────
// Only a failed `knownBug` check counts as the expected failure; setup,
// preconditions and any other error fail the suite.
const KNOWN_BUG = "KNOWN BUG: ";
function knownBug(condition: boolean, message: string): void {
  if (!condition) throw new assert.AssertionError({ message: KNOWN_BUG + message });
}
function isKnownBug(err: unknown): boolean {
  return err instanceof assert.AssertionError && err.message.startsWith(KNOWN_BUG);
}
// These run on every test pass and print as KNOWN FAIL without failing the
// suite. If one starts passing, the suite fails so it gets moved above.
const knownFailing: Array<Case & { bug: string }> = [
  {
    bug: "#4 pointers",
    name: "retargeting a pointer recomputes formulas that read through it",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users.luis.age(15);
      me.pick["->"]("users.ana");
      me.view["="]("adult", "pick.age >= 18");
      assert.equal(me("view.adult"), true);
      me.pick["->"]("users.luis");
      knownBug(me("view.adult") === false, "formula through a pointer kept its old value");
    },
  },
  {
    bug: "#4 pointers",
    name: "writing the pointed-to value recomputes formulas that read through it",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.pick["->"]("users.ana");
      me.view["="]("adult", "pick.age >= 18");
      me.users.ana.age(10);
      knownBug(me("view.adult") === false, "formula through a pointer kept its old value");
    },
  },
  {
    bug: "#5 formula grammar",
    name: "a numeric segment after a dot (dep.2.out) reads the path",
    run(mode) {
      const me = fresh(mode);
      me.f.dep[2].out(7);
      me.f["="]("top", "dep.2.out + 1"); // dep[2].out works; dep.2.out is split into dep, 2, out
      knownBug(me("f.top") === 8, "dep.2.out did not read the path");
    },
  },
];

let failed = 0;
let unexpectedPass = 0;
for (const mode of ["eager", "lazy"] as const) {
  for (const c of knownFailing) {
    try {
      await c.run(mode);
      unexpectedPass++;
      console.log(`PASS? [${mode}] ${c.bug}: ${c.name} — now passes, move it out of knownFailing`);
    } catch (err) {
      if (!isKnownBug(err)) throw err;
      console.log(`KNOWN FAIL [${mode}] ${c.bug}: ${c.name}`);
    }
  }
}
for (const mode of ["eager", "lazy"] as const) {
  for (const c of cases) {
    try {
      await c.run(mode);
      console.log(`ok   [${mode}] ${c.name}`);
    } catch (err: any) {
      failed++;
      console.log(`FAIL [${mode}] ${c.name}\n     ${String(err?.message ?? err).split("\n")[0]}`);
    }
  }
}
if (failed > 0 || unexpectedPass > 0) {
  console.log(`\n${failed} failing, ${unexpectedPass} known-failing now passing`);
  process.exit(1);
}
console.log("\nall wave cases passed");
