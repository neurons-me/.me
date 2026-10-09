/// <reference types="node" />
// Stage S3 of .me 4.2: the reference evaluator for the collection aggregate `[]` (contract v4.1 §1–§3, v3 §8, §12).
//
//   - §1.3 values and statuses (count, sum, absent, incomplete, deferred, non-finite, cycle, unsupported);
//   - §1.4 exact sum rounded once, checked with Object.is against TWO independent references computed from the
//     test's own shadow model (never from the kernel): the BigInt reference (tests/aggregate/exact-sum-ref.mjs)
//     and a Shewchuk/fsum port written here; Math.sumPrecise when the runtime has it;
//   - §1.5 the three readings agree (formula, me(), explain().value) and reading writes nothing;
//   - §3.1 invalidation: term writes, member add/delete, `_` over a public member, chained formulas, lazy pulls,
//     reconstructions (hydrate / importSnapshot / replayMemories / rebuildIndex);
//   - §2.6 AC1–AC13 twin A/B tests, as applicable to S3 (public view only; the authorized context is unsupported).
// Every kernel case runs in eager and lazy mode. Clock fixed (Date.now) so A and B are comparable (§2.6).
//
// Run: node tests/aggregate-eval.test.ts   (Node >= 22.18)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ME from "../dist/index.js";
// @ts-ignore — plain JS reference
import { exactSum as bigintRef } from "./aggregate/exact-sum-ref.mjs";

const FIXED = 1_790_000_000_000;
Date.now = () => FIXED;

type Mode = "eager" | "lazy";
let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { failures.push(name); console.log(`  FAIL ${name}\n       ${String(e?.message ?? e).split("\n").slice(0, 14).join("\n       ")}`); }
}
function fresh(mode: Mode): any {
  const me: any = new (ME as any)();
  me.setRecomputeMode(mode);
  return me;
}
const state = (me: any) => JSON.stringify([me.memories.length, me.inspect().index]);
function readsNothing(me: any, p: string, reader: any = me): any {
  const before = state(me);
  const v = reader(p);
  assert.equal(state(me), before, `reading ${p} must not write`);
  return v;
}

// ─── independent references ─────────────────────────────────────────────────────
/** Shewchuk / Python math.fsum: exact partials, correctly rounded result. null on intermediate overflow. */
function fsum(xs: number[]): number | null {
  const p: number[] = [];
  for (let x of xs) {
    let i = 0;
    for (let y of p) {
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) p[i++] = lo;
      x = hi;
    }
    p.length = i;
    p.push(x);
    if (!Number.isFinite(x)) return null;
  }
  let n = p.length;
  if (n === 0) return 0;
  let hi = p[--n], lo = 0;
  while (n > 0) {
    const x = hi, y = p[--n];
    hi = x + y;
    const yr = hi - x;
    lo = y - yr;
    if (lo !== 0) break;
  }
  if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) {
    const y = lo * 2, x = hi + y, yr = x - hi;
    if (y === yr) hi = x;
  }
  return hi === 0 ? 0 : hi;
}
const sumPrecise: ((xs: number[]) => number) | undefined = (Math as any).sumPrecise;
function oracle(terms: number[]): number | undefined {
  if (terms.length === 0) return undefined;
  const r = bigintRef(terms);
  const exact = Number.isFinite(r) ? (r === 0 ? 0 : r) : undefined;   // overflow → undefined (non-finite)
  const f = fsum(terms);
  if (f !== null && exact !== undefined) assert.ok(Object.is(f, exact), `references disagree: fsum ${f} vs BigInt ${exact} on ${terms}`);
  if (sumPrecise && exact !== undefined) { const s = sumPrecise(terms); assert.ok(Object.is(s === 0 ? 0 : s, exact)); }
  return exact;
}

// deterministic PRNG
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function randomDouble(r: () => number, kind: number): number {
  const sign = r() < 0.5 ? -1 : 1;
  switch (kind % 6) {
    case 0: return sign * Math.floor(r() * 1000);                                  // integers
    case 1: return sign * r();                                                      // same exponent range
    case 2: return sign * r() * 2 ** Math.floor(r() * 2097 - 1074);               // full exponent spread
    case 3: return sign * Number.MIN_VALUE * Math.floor(r() * 1e6);               // subnormals
    case 4: return [0.1, 0.2, 0.3, -0.1, -0.2, -0.3, 1e16, -1e16, 1][Math.floor(r() * 9)]; // cancellation
    default: return sign * 2 ** Math.floor(r() * 120 - 60) * (1 + r());
  }
}

// ─── unit: the kernel's exact sum against the references (no kernel state) ───────
console.log("exact sum: kernel vs independent references");
const { exactSum: kernelSum } = await import("../src/aggregate.ts");
test("known cases (ties to even, cancellation, subnormals, -0 → +0, overflow)", () => {
  const cases: number[][] = [
    [0.1, 0.2, 0.3], [0.1, 0.2, -0.3], [1e16, 1, -1e16], [2 ** 53, 1], [2 ** 53, 1, 1], [1, 2 ** -53], [1, 2 ** -53, 2 ** -105],
    [-0], [-0, -0], [0, -0], [Number.MIN_VALUE, Number.MIN_VALUE], [Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE],
    [Number.MAX_VALUE, Number.MAX_VALUE], [-Number.MAX_VALUE, -Number.MAX_VALUE], [1e308, 1e308, -1e308, -1e308, 5],
  ];
  for (const c of cases) {
    const want = oracle(c);
    const got = kernelSum(c);
    if (want === undefined) assert.ok(!Number.isFinite(got), `${c}`);
    else assert.ok(Object.is(got, want), `${c}: ${got} vs ${want}`);
  }
});
test("2000 random sets (6 distributions), order permuted: Object.is equal to the references", () => {
  const r = rng(42);
  for (let n = 0; n < 2000; n++) {
    const len = 1 + Math.floor(r() * 40);
    const xs = Array.from({ length: len }, () => randomDouble(r, n));
    const want = oracle(xs);
    const shuffled = [...xs].sort(() => r() - 0.5);
    for (const t of [xs, shuffled]) {
      const got = kernelSum(t);
      if (want === undefined) assert.ok(!Number.isFinite(got));
      else assert.ok(Object.is(got, want), `set ${n}: ${got} vs ${want}`);
    }
  }
});

for (const mode of ["eager", "lazy"] as Mode[]) {
  console.log(`\nkernel (${mode})`);
  const t = (name: string, fn: () => void) => test(`[${mode}] ${name}`, fn);

  // ─── §1.3 values ──────────────────────────────────────────────────────────────
  t("count and sum; reading writes nothing", () => {
    const me = fresh(mode);
    me.x[1].f(2); me.x[2].f(3); me.x[3].f(4.5);
    assert.equal(readsNothing(me, "x[]"), 3);
    assert.equal(readsNothing(me, "x[].f"), 9.5);
    const e = me.explain("x[].f");
    assert.deepEqual(e.derivation.inputs[0].aggregate, {
      collection: "x", field: "f", op: "sum", context: "public-view", coverage: "public-view",
      status: "resolved", members: 3, terms: 3, domain: "number",
    });
    assert.equal(e.meta.unresolved, undefined);
  });
  t("empty → undefined, absent (never written, all deleted, C deleted); not 0", () => {
    const me = fresh(mode);
    assert.equal(me("x[]"), undefined);
    assert.equal(me.explain("x[].f").derivation.inputs[0].status, "absent");
    assert.deepEqual(me.explain("x[].f").meta.unresolved, { reason: "missing-input", inputs: ["x[].f"], causes: [{ path: "x[].f", status: "absent" }] });
    me.x[1].f(1); me.x[1]["-"]();
    assert.equal(me("x[]"), undefined);
    me.x[1].f(1); me.x["-"]();
    assert.equal(me("x[].f"), undefined);
  });
  t("member test does not depend on the value: a null member counts; its term is not admissible", () => {
    const me = fresh(mode);
    me.x[1](null); me.x[2].f(1);
    assert.equal(me("x[]"), 2);
    assert.equal(me("x[].f"), undefined);
    assert.deepEqual(me.explain("x[].f").derivation.inputs[0].aggregate.problems, { count: 1, sample: [{ path: "x.1.f", kind: "missing" }] });
  });
  t("incomplete: missing, null, string (even numeric), object, non-finite; count unaffected", () => {
    const me = fresh(mode);
    me.x[1].f(1); me.x[2].f(null); me.x[3].f("5"); me.x[4].f.deep(1); me.x[5].g(1); me.x[6].f(Infinity);
    assert.equal(me("x[]"), 6);
    assert.equal(me("x[].f"), undefined);
    const a = me.explain("x[].f").derivation.inputs[0].aggregate;
    assert.equal(a.status, "incomplete");
    assert.deepEqual(a.problems.sample, [
      { path: "x.2.f", kind: "null" }, { path: "x.3.f", kind: "non-numeric" }, { path: "x.4.f", kind: "non-numeric" },
      { path: "x.5.f", kind: "missing" }, { path: "x.6.f", kind: "non-finite" },
    ]);
    assert.equal(a.terms, 1);
  });
  t("booleans: summed as 1/0 only when every term is boolean; mixed → incomplete (mixed-domain)", () => {
    const me = fresh(mode);
    me.x[1].ok(true); me.x[2].ok(false); me.x[3].ok(true);
    assert.equal(me("x[].ok"), 2);
    assert.equal(me.explain("x[].ok").derivation.inputs[0].aggregate.domain, "boolean");
    me.x[4].ok(5);
    assert.equal(me("x[].ok"), undefined);
    const a = me.explain("x[].ok").derivation.inputs[0].aggregate;
    assert.deepEqual([a.status, a.domain, a.problems.count], ["incomplete", "number", 3]);
    assert.ok(a.problems.sample.every((p: any) => p.kind === "mixed-domain"));
  });
  t("problems sample bounded at 20; explain size does not depend on |M|", () => {
    const sizes: number[] = [];
    for (const m of [50, 500]) {
      const me = fresh(mode);
      for (let i = 1; i <= m; i++) me.x[i].g(1);
      const a = me.explain("x[].f").derivation.inputs[0].aggregate;
      assert.equal(a.problems.count, m);
      assert.equal(a.problems.sample.length, 20);
      sizes.push(JSON.stringify(a.problems.sample).length);
    }
    assert.ok(Math.abs(sizes[0] - sizes[1]) < 100, `${sizes}`);
  });
  t("nested field x[].a.b", () => {
    const me = fresh(mode);
    me.x[1].a.b(1); me.x[2].a.b(2);
    assert.equal(me("x[].a.b"), 3);
  });
  t("overflow → undefined, non-finite (evaluation-failed)", () => {
    const me = fresh(mode);
    me.x[1].f(Number.MAX_VALUE); me.x[2].f(Number.MAX_VALUE);
    assert.equal(me("x[].f"), undefined);
    const e = me.explain("x[].f");
    assert.equal(e.derivation.inputs[0].status, "non-finite");
    assert.equal(e.meta.unresolved.reason, "evaluation-failed");
    me.x[3].f(-Number.MAX_VALUE);
    assert.equal(me("x[].f"), Number.MAX_VALUE, "exact: no intermediate overflow");
  });
  t("zero is +0 (Object.is), also from -0 terms", () => {
    const me = fresh(mode);
    me.x[1].f(-0); me.x[2].f(-0);
    assert.ok(Object.is(me("x[].f"), 0));
  });
  t("pointers: a member that is a pointer, or a field through one → deferred", () => {
    const me = fresh(mode);
    me.src.f(5);
    me.x[1].f(1);
    me.x[2]["__"]("src");
    assert.equal(me("x[]"), undefined);
    assert.equal(me.explain("x[]").derivation.inputs[0].status, "deferred");
    const k = fresh(mode);
    k.src.v(5); k.x[1].f(1); k.x[2].f["__"]("src.v");
    assert.equal(k("x[].f"), undefined);
    assert.equal(k.explain("x[].f").derivation.inputs[0].status, "deferred");
    assert.equal(k("x[]"), 2, "count does not traverse the field");
  });
  t("cycle: a target inside its own collection", () => {
    const me = fresh(mode);
    me.x[1].f(1);
    me.x["="]("n", "x[]");
    assert.equal(me("x.n"), undefined);
    assert.equal(me.explain("x.n").meta.unresolved.reason, "cycle");
    assert.equal(me.explain("x.n").derivation.inputs[0].status, "cycle");
  });
  t("literal collection paths: z[\"[]\"][] and [\"z[]\"][].w address the literal segments", () => {
    const me = fresh(mode);
    me.z["[]"][1].w(1); me.z["[]"][2].w(2);
    me["z[]"][1].w(10);
    assert.equal(me('z["[]"][]'), 2);
    assert.equal(me('z["[]"][].w'), 3);
    assert.equal(me('["z[]"][].w'), 10);
    assert.equal(me.explain('z["[]"][].w').path, 'z["[]"][].w');
  });

  // ─── §1.5 three readings agree; formulas ───────────────────────────────────────
  t("formula, me() and explain().value are Object.is equal, with the same status", () => {
    const me = fresh(mode);
    me.x[1].f(0.1); me.x[2].f(0.2);
    me.s["="]("t", "x[].f");
    me.s["="]("n", "x[] * 10");
    const want = oracle([0.1, 0.2]);
    for (const v of [me("s.t"), me("x[].f"), me.explain("x[].f").value, me.explain("s.t").value]) assert.ok(Object.is(v, want));
    assert.equal(me("s.n"), 20);
    assert.equal(me.explain("s.t").derivation.inputs[0].status, me.explain("x[].f").derivation.inputs[0].status);
  });
  t("the demo's rule: battery % from two sums, a third battery without changing the rule", () => {
    const me = fresh(mode);
    me.robots[1].batteries[1].charge(40); me.robots[1].batteries[1].capacity(50);
    me.robots[1].batteries[2].charge(30); me.robots[1].batteries[2].capacity(50);
    me.robots["[i]"]["="]("battery", "robots[i].batteries[].charge / robots[i].batteries[].capacity * 100");
    assert.equal(me("robots.1.battery"), 70);
    me.robots[1].batteries[3].charge(20); me.robots[1].batteries[3].capacity(50);
    assert.equal(me("robots.1.battery"), 60);
    me.robots[2].batteries[1].charge(5); me.robots[2].batteries[1].capacity(10);
    assert.equal(me("robots.2.battery"), 50, "a robot added later gets the rule");
  });

  // ─── §3.1 invalidation ────────────────────────────────────────────────────────
  t("term write, member add, member delete, field delete, non-term write: T follows the oracle", () => {
    const me = fresh(mode);
    const shadow = new Map<string, number>();
    const set = (i: number, v: number) => { me.x[i].f(v); shadow.set(String(i), v); };
    me.s["="]("t", "x[].f");
    me.s["="]("c", "x[]");
    set(1, 1); set(2, 2.5); set(3, -0.5);
    const check = (msg: string) => {
      assert.ok(Object.is(me("s.t"), oracle([...shadow.values()])), `${msg}: ${me("s.t")}`);
      assert.equal(me("s.c"), shadow.size || undefined, msg);
    };
    check("initial");
    set(2, 10); check("term write");
    set(4, 7); check("member add");
    me.x[1]["-"](); shadow.delete("1"); check("member delete");
    me.x[3].g(9); check("non-term write");
    me.x[3].f["-"](); shadow.delete("3");
    assert.equal(me("s.t"), undefined, "x.3 is still a member (x.3.g), its term is missing");
    me.x[3]["-"](); check("member removed");
    me.x["-"](); shadow.clear(); check("collection deleted");
  });
  t("randomised batches of mutations (incl. empty batches), checked after each batch", () => {
    const r = rng(7);
    const me = fresh(mode);
    me.s["="]("t", "x[].v");
    const shadow = new Map<string, number>();
    for (let batch = 0; batch < 60; batch++) {
      const n = Math.floor(r() * 6);         // 0 = empty batch
      for (let k = 0; k < n; k++) {
        const i = 1 + Math.floor(r() * 12);
        if (r() < 0.25) { me.x[i]["-"](); shadow.delete(String(i)); }
        else { const v = randomDouble(r, batch + k); me.x[i].v(v); shadow.set(String(i), v); }
      }
      const want = oracle([...shadow.values()]);
      assert.ok(Object.is(me("s.t"), want), `batch ${batch}: ${me("s.t")} vs ${want}`);
      assert.ok(Object.is(me("x[].v"), want));
    }
  });
  t("chained: fleet total over robots[].battery, where battery is itself an aggregate formula", () => {
    const me = fresh(mode);
    me.robots[1].batteries[1].charge(40);
    me.robots[2].batteries[1].charge(10);
    me.robots["[i]"]["="]("battery", "robots[i].batteries[].charge");
    me.fleet["="]("total", "robots[].battery");
    assert.equal(me("fleet.total"), 50);
    me.robots[2].batteries[2].charge(5);
    assert.equal(me("fleet.total"), 55);
    me.robots[3].batteries[1].charge(1);
    assert.equal(me("fleet.total"), 56);
  });
  t("reconstruction: hydrate / importSnapshot / replayMemories / rebuildIndex give the same ad hoc values", () => {
    const me = fresh(mode);
    me.x[1].f(0.1); me.x[2].f(0.2); me.x[3].f(-0.3); me.x[4].g(1); me.x[4]["-"]();
    const want = [me("x[]"), me("x[].f")];
    const snap = JSON.parse(JSON.stringify(me.exportSnapshot()));
    const a = fresh(mode); a.hydrate(snap);
    const b = fresh(mode); b.importSnapshot(snap);
    const c = fresh(mode); c.replayMemories(me.memories);
    me.rebuildIndex?.();
    for (const k of [a, b, c, me]) assert.deepEqual([k("x[]"), k("x[].f")], want);
  });

  // ─── §2 access: public view, twins ─────────────────────────────────────────────
  // A: public only. B: A + protected entries. Same fixed clock and the same public write order.
  const batteriesA = (me: any) => { me.batteries[1].charge(40); me.batteries[2].charge(30); };
  const protectThird = (me: any) => { me.batteries[3]["_"]("k"); me.batteries[3].charge(20); };
  const readers = (me: any) => ({ owner: me, guest: me.as(null), wrong: me.as("nope"), key: me.as("k") });
  const AD_HOC = ["batteries[]", "batteries[].charge", "batteries[].missing", "nothing[]"];
  function observe(me: any, targets: string[] = []) {
    const out: any = {};
    for (const [who, r] of Object.entries(readers(me))) {
      out[who] = {
        reads: [...AD_HOC, ...targets].map((p) => (who === "owner" || !targets.includes(p) ? readsNothing(me, p, r as any) : (r as any)(p))),
        explain: AD_HOC.map((p) => (r as any).explain(p)),
      };
    }
    return out;
  }
  const visibleMemories = (me: any, paths: string[]) =>
    me.as(null).memories.filter((m: any) => paths.includes(m.path)).map((m: any) => ({ path: m.path, operator: m.operator, expression: m.expression, value: m.value }));
  /** What the public reader observes about a public target T (value, explain incl. meta, memories at T). */
  function observeT(me: any, T: string) {
    const g = me.as(null);
    return { v: g(T), e: g.explain(T), owner: me.explain(T), mem: visibleMemories(me, [T]) };
  }

  t("AC1: public collection: owner, as(null), as(key) all see 70, public-view, the same explain", () => {
    const me = fresh(mode); batteriesA(me);
    const o = observe(me);
    for (const who of ["guest", "wrong", "key"]) assert.deepEqual(o[who], o.owner, who);
    assert.equal(o.owner.reads[1], 70);
    assert.equal(o.owner.explain[1].derivation.inputs[0].aggregate.coverage, "public-view");
  });
  t("AC2: twins A/B, ad hoc reads and explain: identical for every reader (70, never 90)", () => {
    const A = fresh(mode); batteriesA(A);
    const B = fresh(mode); batteriesA(B); protectThird(B);
    assert.deepEqual(observe(B), observe(A));
    assert.equal(B.as("k")("batteries.3.charge"), 20, "the scalar read by path is unchanged (4.1)");
    assert.equal(B.as("k")("batteries[].charge"), 70, "as(key) does not change the aggregate context");
  });
  t("AC3: T public, declared BEFORE B's protected entries: identical; not recomputed by protected writes", () => {
    const A = fresh(mode); batteriesA(A); A.stats["="]("total", "batteries[].charge");
    const B = fresh(mode); batteriesA(B); B.stats["="]("total", "batteries[].charge"); protectThird(B);
    B.batteries[3].charge(25);
    assert.deepEqual(observeT(B, "stats.total"), observeT(A, "stats.total"));
    assert.equal(A("stats.total"), 70);
  });
  t("AC4: T public, declared AFTER, by the owner holding the key: identical (declaring with the key publishes nothing)", () => {
    const A = fresh(mode); batteriesA(A); A.stats["="]("total", "batteries[].charge");
    const B = fresh(mode); batteriesA(B); protectThird(B); B.as("k").stats["="]("total", "batteries[].charge");
    assert.deepEqual(observeT(B, "stats.total"), observeT(A, "stats.total"));
  });
  t("AC5: B turns public x.3 into protected; A deletes x.3: values, statuses, coverage, explain identical", () => {
    const A = fresh(mode), B = fresh(mode);
    for (const k of [A, B]) { batteriesA(k); k.batteries[3].charge(20); k.stats["="]("total", "batteries[].charge"); }
    A.batteries[3]["-"]();
    B.batteries[3]["_"]("k");
    const strip = (o: any) => ({ v: o.v, e: o.e, owner: o.owner });   // memories of `_` vs `-` differ by nature
    assert.deepEqual(strip(observeT(B, "stats.total")), strip(observeT(A, "stats.total")));
    assert.deepEqual(observe(B, ["stats.total"]), observe(A, ["stats.total"]));
    assert.equal(A("stats.total"), 70);
  });
  t("AC6: B writes and deletes only protected entries, during and after declaring T: explain(T) and memories at T identical", () => {
    const A = fresh(mode); batteriesA(A);
    const B = fresh(mode); batteriesA(B); B.batteries[3]["_"]("k"); B.batteries[3].charge(1);
    for (const k of [A, B]) k.stats["="]("total", "batteries[].charge");
    B.batteries[3].charge(2); B.batteries[3].extra(3); B.batteries[3].extra["-"](); B.batteries[3].charge["-"]();
    B.batteries[3].charge(4);
    for (const k of [A, B]) k("stats.total");
    assert.deepEqual(observeT(B, "stats.total"), observeT(A, "stats.total"));
  });
  t("AC7: same writes by owner, as(null), as(key); first lazy reader guest/owner/key: T and explain(T) identical", () => {
    const obs: any[] = [];
    for (const writer of ["owner", "guest", "key"]) {
      for (const first of ["guest", "owner", "key"]) {
        const me = fresh(mode);
        const w = writer === "owner" ? me : writer === "guest" ? me.as(null) : me.as("k");
        w.batteries[1].charge(40); w.batteries[2].charge(30);
        me.stats["="]("total", "batteries[].charge");
        w.batteries[2].charge(35);
        const r = first === "owner" ? me : first === "guest" ? me.as(null) : me.as("k");
        r("stats.total");
        obs.push(observeT(me, "stats.total"));
      }
    }
    for (const o of obs) assert.deepEqual(o, obs[0]);
    assert.equal(obs[0].v, 75);
  });
  t("AC8: public member whose f is inside a scope (B) vs the member without f (A): identical, incomplete, kind missing", () => {
    const A = fresh(mode); A.x[1].f(1); A.x[2].g(1);
    const B = fresh(mode); B.x[1].f(1); B.x[2].g(1); B.x[2].f["_"]("k"); B.x[2].f(5);
    for (const r of ["guest", "owner", "key"]) {
      const ra = r === "owner" ? A : A.as(r === "guest" ? null : "k");
      const rb = r === "owner" ? B : B.as(r === "guest" ? null : "k");
      assert.deepEqual(rb.explain("x[].f"), ra.explain("x[].f"));
    }
    assert.deepEqual(A.explain("x[].f").derivation.inputs[0].aggregate.problems.sample, [{ path: "x.2.f", kind: "missing" }]);
  });
  t("AC9: C inside a scope: ad hoc read by owner, guest, as(key) → absent, identical to never written", () => {
    const B = fresh(mode); B.wallet["_"]("k"); B.wallet.items[1].v(10); B.wallet.items[2].v(20);
    const E = fresh(mode);
    for (const r of [B, B.as(null), B.as("k")]) {
      assert.deepEqual(r.explain("wallet.items[].v"), E.explain("wallet.items[].v"));
      assert.equal(r("wallet.items[]"), undefined);
    }
    assert.equal(B.as("k")("wallet.items.1.v"), 10, "scalar read by path unchanged");
  });
  t("AC9b: root-scope secret: every [] read is absent for every caller (public view = what as(null) sees)", () => {
    const B = fresh(mode); B["_"]("rk"); B.x[1].f(1); B.x[2].f(2);
    const E = fresh(mode);
    for (const r of [B, B.as(null), B.as("rk"), B.as("nope")]) {
      for (const p of ["x[]", "x[].f"]) {
        assert.equal(r(p), undefined, p);
        assert.deepEqual(r.explain(p), E.explain(p), p);
      }
    }
  });
  t("AC9c: public data written BEFORE a root-scope secret: still in the index in clear, but not in the public view", () => {
    const B = fresh(mode); B.x[1].f(1); B.x[2].f(2); B["_"]("rk");
    assert.equal(B.as(null)("x.1.f"), undefined, "guest blocked by the root stealth barrier (d3327ef)");
    const E = fresh(mode);
    for (const r of [B, B.as(null), B.as("rk"), B.as("nope")]) {
      for (const p of ["x[]", "x[].f"]) {
        assert.equal(r(p), undefined, p);
        assert.deepEqual(r.explain(p), E.explain(p), p);
      }
    }
  });
  t("AC10: T inside a scope over A (fully public) and over B: unsupported, coverage authorized in both (R4)", () => {
    const A = fresh(mode); batteriesA(A);
    const B = fresh(mode); batteriesA(B); protectThird(B);
    const res = [A, B].map((k) => {
      k.vault["_"]("v"); k.vault["="]("total", "batteries[].charge");
      const e = k.explain("vault.total");
      return [k("vault.total"), e.derivation.inputs[0].aggregate, e.meta.unresolved];
    });
    assert.deepEqual(res[1], res[0]);
    assert.equal(res[0][0], undefined);
    assert.deepEqual([res[0][1].status, res[0][1].reason, res[0][1].context, res[0][1].coverage],
      ["unsupported", "authorized-context-unsupported", "authorized", "authorized"]);
  });
  t("AC11: property twins: random public A, B = A + random protected entries (members, fields, whole C, late _); identical", () => {
    const r = rng(2026);
    for (let run = 0; run < 40; run++) {
      const A = fresh(mode), B = fresh(mode);
      const steps: Array<(k: any) => void> = [];
      const m = 1 + Math.floor(r() * 6);
      for (let i = 1; i <= m; i++) {
        const v = randomDouble(r, run + i);
        if (r() < 0.85) steps.push((k) => k.c[i].f(v));
        else steps.push((k) => k.c[i].g(1));
      }
      const declareFirst = r() < 0.5;
      for (const k of [A, B]) { if (declareFirst) k.s["="]("t", "c[].f"); for (const s of steps) s(k); if (!declareFirst) k.s["="]("t", "c[].f"); }
      // protected-only additions to B, in a batch without intermediate reads
      const extra = 1 + Math.floor(r() * 4);
      for (let j = 0; j < extra; j++) {
        const kind = Math.floor(r() * 3);
        const idx = 100 + j;
        if (kind === 0) { B.c[idx]["_"]("k"); B.c[idx].f(randomDouble(r, j)); }        // protected member
        else if (kind === 1) { B.p["_"]("k"); B.p[idx].f(1); }                           // protected elsewhere
        else { B.c[idx]["_"]("k"); B.c[idx].g(2); B.c[idx]["~"]("n"); }               // late _ and ~
      }
      const o = (k: any) => ({ t: observeT(k, "s.t"), ad: [k.as(null)("c[]"), k.as(null)("c[].f"), k("c[].f")], ex: k.as(null).explain("c[].f") });
      assert.deepEqual(o(B), o(A), `run ${run}`);
    }
  });
  t("AC12: me('wallet') stays undefined with aggregates declared over wallet.*", () => {
    const me = fresh(mode);
    me.wallet["_"]("k"); me.wallet.items[1].v(10);
    me.report["="]("n", "wallet.items[]");
    me("wallet.items[].v");
    assert.equal(me("wallet"), undefined);
    assert.equal(me.as("k")("wallet.items.1.v"), 10);
  });
}

// ─── AC13: no test depends on detecting secrets; the public-view code consults no secret metadata ───────────────
console.log("\nAC13 (review checks)");
test("AC13: aggregate.ts / aggregate-index.ts do not reference protectedScopeKeys, listScopes, encryptedBranches, branchStore", () => {
  for (const f of ["aggregate.ts", "aggregate-index.ts"]) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const banned of ["protectedScopeKeys", "listScopes", "encryptedBranches", "branchStore", "decrypt", "keySpaces"]) {
      assert.ok(!src.includes(banned), `${f} references ${banned}`);
    }
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log("failed:\n  " + failures.join("\n  ")); process.exit(1); }
