/// <reference types="node" />
// Stage S2 of .me 4.2: the path parser for the collection aggregate `[]` (contract v4.1, v3 §3 / §10.4 / §11).
//
// Parse only. Aggregates are recognised in path strings (me("..."), explain("..."), formula text) but NOT
// evaluated yet: an aggregate read is `undefined`, writes nothing, and explain marks it `unsupported`
// (S3 brings values). Covered here:
//   - the grammar (classifyPathExpression), the round-trip renderer and the quote-aware normalizer;
//   - every §12.2 lit.* case, at the level S2 can check (values that need evaluation are asserted as
//     "recognised as an aggregate, undefined, nothing written");
//   - incompatibilities I1–I8;
//   - robots[i].batteries[] in a [i] template.
// Every kernel case runs in eager and lazy mode.
//
// Run: node tests/aggregate-path.test.ts   (Node >= 22.18)
import assert from "node:assert/strict";
import ME from "../dist/index.js";
import {
  classifyPathExpression,
  renderAggregate,
  renderSegments,
} from "../src/path-expr.ts";
import { normalizeSelectorPath } from "../src/utils.ts";

type Mode = "eager" | "lazy";
let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { failures.push(name); console.log(`  FAIL ${name}\n       ${e?.message?.split("\n").join("\n       ")}`); }
}
function fresh(mode: Mode): any {
  const me: any = new (ME as any)();
  me.setRecomputeMode(mode);
  return me;
}
/** O5 base data (§12.2): z.[].w = 1, z.a.w = 5, z.w = 99, written by proxy. */
function base(mode: Mode, noLeaf = false): any {
  const me = fresh(mode);
  me.z["[]"].w(1);
  me.z.a.w(5);
  if (!noLeaf) me.z.w(99);
  return me;
}
/** Observable state a read must not change: memory count and the full public index. */
function state(me: any) {
  return JSON.stringify({ n: me.memories.length, index: me.inspect().index });
}
function readsNothingWritten(me: any, p: string): any {
  const before = state(me);
  const v = me(p);
  assert.equal(state(me), before, `me(${JSON.stringify(p)}) must not write`);
  return v;
}

// ─────────────────────────────────────────────── grammar (unit) ──
console.log("grammar: classifyPathExpression");
const agg = (s: string, collection: string[], field: string[] | null) => test(`aggregate ${s}`, () => {
  const c = classifyPathExpression(s);
  assert.equal(c.kind, "aggregate");
  if (c.kind !== "aggregate") return;
  assert.deepEqual(c.ref.collection, collection);
  assert.deepEqual(c.ref.field, field);
  assert.equal(c.ref.op, field ? "sum" : "count");
  assert.equal(c.ref.text, s.trim());
});
agg("x[]", ["x"], null);
agg("x[].f", ["x"], ["f"]);
agg("a[].b.c", ["a"], ["b", "c"]);
agg("robots[3].batteries[]", ["robots", "3", "batteries"], null);
agg("robots[3].batteries[].charge", ["robots", "3", "batteries"], ["charge"]);
agg("robots.3.batteries[].charge", ["robots", "3", "batteries"], ["charge"]);
agg("robots[i].batteries[].capacity", ["robots", "i", "batteries"], ["capacity"]);
agg('z["[]"][]', ["z", "[]"], null);
agg("z['[]'][].w", ["z", "[]"], ["w"]);
agg('["z[]"][]', ["z[]"], null);
agg("  x[].f  ", ["x"], ["f"]);

const lit = (s: string, segments: string[], exact = true) => test(`literal ${s}`, () => {
  const c = classifyPathExpression(s);
  assert.equal(c.kind, "literal");
  if (c.kind !== "literal") return;
  assert.deepEqual(c.segments, segments);
  assert.equal(c.exact, exact);
});
lit('z["[]"].w', ["z", "[]", "w"]);
lit("z['[]'].w", ["z", "[]", "w"]);
lit('z["[]"]', ["z", "[]"]);
lit('["z[]"].w', ["z[]", "w"]);
lit(`z['["[]"]'].w`, ["z", '["[]"]', "w"]);
lit('robots[2]["x.y"]', ["robots", "2", "x.y"]);   // split is quote-aware; the segment keeps its dot (issue #6)

const rej = (s: string, reason: string) => test(`rejected ${s} (${reason})`, () => {
  const c = classifyPathExpression(s);
  assert.equal(c.kind, "rejected");
  if (c.kind === "rejected") assert.equal(c.reason, reason);
});
rej("x[].y[]", "nested-aggregate");
rej("x[][]", "nested-aggregate");
rej("z.[].w", "operator-as-segment");
rej("z.[]", "operator-as-segment");
rej("[]", "empty-collection-path");
rej("[].w", "empty-collection-path");
rej("z[ ].w", "whitespace-selector");
rej("z[  ]", "whitespace-selector");
rej("x[a > 1][]", "selector-on-collection");
rej("x[1..2][]", "selector-on-collection");
rej("x[[1,3]][]", "selector-on-collection");
rej("x[c => c.f][]", "selector-on-collection");
rej("x[].f[2]", "invalid-field");
rej('x[].f["k"]', "invalid-field");
rej("x[]x", "invalid-field");
rej("x[].", "invalid-field");
rej("x[].2", "invalid-field");

const plain = (s: string) => test(`plain (4.1 route) ${s}`, () => assert.equal(classifyPathExpression(s).kind, "plain"));
for (const s of ["x", "x.f", "x[2].f", "robots[i].battery", "users[age > 18]", "x[1..3]", "x[[1,3]]", "x[c => c.f]", "_secret", "@ana", "", "a[b"]) plain(s);

console.log("rendering (§10.4)");
test("plain segments render as join('.')", () => {
  for (const p of [["x"], ["x", "f"], ["robots", "2", "batteries", "1", "charge"]]) assert.equal(renderSegments(p), p.join("."));
});
test('segments z, [], w render as z["[]"].w', () => assert.equal(renderSegments(["z", "[]", "w"]), 'z["[]"].w'));
test('segment z[] then w renders as ["z[]"].w', () => assert.equal(renderSegments(["z[]", "w"]), '["z[]"].w'));
test('a segment containing " renders with single quotes', () => assert.equal(renderSegments(["z", '["[]"]', "w"]), `z['["[]"]'].w`));
test('aggregate over the literal child z.[] renders as z["[]"][]', () =>
  assert.equal(renderAggregate({ text: "", collection: ["z", "[]"], field: null, op: "count" }), 'z["[]"][]'));
test("round trip: parse(render(segments)) gives the segments back", () => {
  const corpus = [["z", "[]", "w"], ["z[]", "w"], ["z", '["[]"]', "w"], ["a", "b[c]", "d"], ["[]"], ["x", "[i]"], ["k", "a]b"]];
  for (const segs of corpus) {
    const c = classifyPathExpression(renderSegments(segs));
    assert.equal(c.kind, "literal", renderSegments(segs));
    if (c.kind === "literal") assert.deepEqual(c.segments, segs, renderSegments(segs));
  }
});

console.log("normalizeSelectorPath (quote-aware; empty selectors kept as literal segments)");
test("4.1 outputs unchanged for non-empty, unquoted-bracket selectors", () => {
  const same: Array<[string, string[]]> = [
    ["a", ["a"]], ["x[2]", ["x", "2"]], ["x[i]", ["x", "i"]], ["users[age > 18]", ["users", "age > 18"]],
    ["x[[1,3]]", ["x", "[[1,3]]"]], ["x[1..3]", ["x", "1..3"]], ['x["k"]', ["x", "k"]], ["x['k']", ["x", "k"]],
    ['x[ "a" ]', ["x", "a"]], ['x[""]', ["x"]], ["x[2][3]", ["x", "2", "3"]], ["[2]", ["2"]], ["a[b", ["a", "[b"]],
  ];
  for (const [inp, out] of same) assert.deepEqual(normalizeSelectorPath([inp]), out, inp);
});
test("empty / blank selector: segment kept whole (4.1 dropped it)", () => {
  assert.deepEqual(normalizeSelectorPath(["z", "[]", "w"]), ["z", "[]", "w"]);
  assert.deepEqual(normalizeSelectorPath(["x[]"]), ["x[]"]);
  assert.deepEqual(normalizeSelectorPath(["z[ ]"]), ["z[ ]"]);
});
test("quoted selector may contain brackets", () => {
  assert.deepEqual(normalizeSelectorPath(['z["[]"]', "w"]), ["z", "[]", "w"]);
  assert.deepEqual(normalizeSelectorPath(['["z[]"]', "w"]), ["z[]", "w"]);
  assert.deepEqual(normalizeSelectorPath(['x["a]b"]']), ["x", "a]b"]);
});
test("idempotent on its own output for literal [] segments", () => {
  const once = normalizeSelectorPath(['z["[]"]', "w"]);
  assert.deepEqual(normalizeSelectorPath(once), once);
});

// ─────────────────────────────────────────────── kernel cases ──
for (const mode of ["eager", "lazy"] as Mode[]) {
  console.log(`\nkernel (${mode})`);
  const t = (name: string, fn: () => void) => test(`[${mode}] ${name}`, fn);

  // §12.2 lit.*
  t("lit.proxy-write-unchanged: me.z['[]'].w(1) stores z.[].w, memory path z.[].w", () => {
    const me = fresh(mode);
    me.z["[]"].w(1);
    assert.ok(Object.prototype.hasOwnProperty.call(me.inspect().index, "z.[].w"));
    assert.equal(me.memories.at(-1).path, "z.[].w");
  });
  t("lit.quoted-read: z[\"[]\"].w and z['[]'].w read 1", () => {
    const me = base(mode);
    assert.equal(readsNothingWritten(me, 'z["[]"].w'), 1);
    assert.equal(readsNothingWritten(me, "z['[]'].w"), 1);
  });
  t("lit.bare-is-operator (S2): z[] and z[].w are aggregates, undefined, nothing written (not z.w = 99)", () => {
    for (const noLeaf of [false, true]) {
      const me = base(mode, noLeaf);
      assert.equal(readsNothingWritten(me, "z[]"), undefined);
      assert.equal(readsNothingWritten(me, "z[].w"), undefined);
      const e = me.explain("z[].w");
      assert.equal(e.derivation.inputs[0].kind, "aggregate");
      assert.equal(e.derivation.inputs[0].aggregate.collection, "z");
    }
  });
  t("lit.malformed-empty-selector: z.[].w, z[ ].w undefined, nothing written; formula z.[].w evaluation-failed", () => {
    const me = base(mode);
    assert.equal(readsNothingWritten(me, "z.[].w"), undefined);
    assert.equal(readsNothingWritten(me, "z[ ].w"), undefined);
    assert.equal(me.explain("z.[].w").meta.unresolved.reason, "evaluation-failed");
    me.t["="]("o", "z.[].w");
    assert.equal(me("t.o"), undefined);
    assert.equal(me.explain("t.o").meta.unresolved.reason, "evaluation-failed");
    me.t["="]("p", "z[ ].w");
    assert.equal(me("t.p"), undefined);
    assert.equal(me.explain("t.p").meta.unresolved.reason, "evaluation-failed");
  });
  t("lit.formula-literal: t.o = z[\"[]\"].w gives 1, dependsOn rendered; delete → undefined, missing-input", () => {
    const me = base(mode);
    me.t["="]("o", 'z["[]"].w');
    assert.equal(me("t.o"), 1);
    assert.deepEqual(me.explain("t.o").meta.dependsOn, ['z["[]"].w']);
    me.z["[]"].w["-"]();
    assert.equal(me("t.o"), undefined);
    const u = me.explain("t.o").meta.unresolved;
    assert.equal(u.reason, "missing-input");
    assert.ok(u.inputs.every((p: string) => !p.includes(".[")), `rendered inputs: ${JSON.stringify(u.inputs)}`);
  });
  t("lit.explain-rendering: path z[\"[]\"].w; aggregate input path z[].w, collection z", () => {
    const me = base(mode);
    assert.equal(me.explain('z["[]"].w').path, 'z["[]"].w');
    assert.equal(me.explain('z["[]"].w').value, 1);
    const e = me.explain("z[].w");
    assert.equal(e.path, "z[].w");
    assert.equal(e.derivation.inputs[0].path, "z[].w");
    assert.equal(e.derivation.inputs[0].aggregate.collection, "z");
  });
  t("lit.render-roundtrip: every path string in explain outputs reads the storage value", () => {
    const me = base(mode);
    me.z["[]"].a(2);
    me.z["[]"]["="]("t", "a * 3");
    me.t["="]("o", 'z["[]"].w + z.a.w');
    const strings = new Set<string>();
    for (const p of ['z["[]"].w', 'z["[]"].t', "t.o"]) {
      const e = me.explain(p);
      strings.add(e.path);
      for (const d of e.meta.dependsOn) strings.add(d);
      for (const i of e.derivation?.inputs ?? []) strings.add(i.path);
    }
    const storage: Record<string, string> = { 'z["[]"].w': "z.[].w", 'z["[]"].t': "z.[].t", 'z["[]"].a': "z.[].a", "t.o": "t.o", "z.a.w": "z.a.w" };
    for (const s of strings) {
      assert.ok(s in storage, `unexpected explain path string ${s}`);
      assert.equal(me(s), me.inspect().index[storage[s]] ?? me(storage[s]), s);
    }
  });
  t("lit.bracketed-name-segment: me['z[]'].w(1) → key z[].w; ['z[]'].w reads 1; z[].w is an aggregate", () => {
    const me = fresh(mode);
    me["z[]"].w(1);
    assert.ok(Object.prototype.hasOwnProperty.call(me.inspect().index, "z[].w"));
    assert.equal(readsNothingWritten(me, '["z[]"].w'), 1);
    assert.equal(readsNothingWritten(me, "z[].w"), undefined);
    assert.equal(me.explain("z[].w").derivation.inputs[0].kind, "aggregate");
  });
  t("lit.equals-under-literal (I6): target z.[].t = 6, z.t undefined", () => {
    const me = fresh(mode);
    me.z["[]"].a(2);
    me.z["[]"]["="]("t", "a * 3");
    assert.ok(Object.prototype.hasOwnProperty.call(me.inspect().index, "z.[].t") || me.derivations["z.[].t"]);
    assert.equal(me('z["[]"].t'), 6);
    assert.equal(me("z.t"), undefined);
    assert.equal(me.explain('z["[]"].t').path, 'z["[]"].t');
  });
  t("lit.snapshot-roundtrip: export → hydrate keeps z.[].w; quoted read and operator recognition unchanged", () => {
    const me = base(mode);
    const snap = JSON.parse(JSON.stringify(me.exportSnapshot()));
    const k = fresh(mode);
    k.hydrate(snap);
    assert.ok(Object.prototype.hasOwnProperty.call(k.inspect().index, "z.[].w"));
    assert.equal(readsNothingWritten(k, 'z["[]"].w'), 1);
    assert.equal(readsNothingWritten(k, "z[].w"), undefined);
  });
  t("lit.root-routing (I1, I7): me('z[]'), me('z[\"[]\"]') read; no root write, no memory", () => {
    const me = base(mode);
    readsNothingWritten(me, "z[]");
    readsNothingWritten(me, 'z["[]"]');
    assert.ok(!Object.prototype.hasOwnProperty.call(me.inspect().index, ""));
  });
  t("lit.raw-quoted-segment: me.z['[\"[]\"]'].w(7) then z['[\"[]\"]'].w reads 7", () => {
    const me = fresh(mode);
    me.z['["[]"]'].w(7);
    assert.equal(readsNothingWritten(me, `z['["[]"]'].w`), 7);
    assert.equal(me('z["[]"].w'), undefined, "the raw segment is no longer reached by z[\"[]\"]");
  });
  t("lit.template-untouched: [i] substitution leaves \"[]\" and the operator alone", () => {
    const me = fresh(mode);
    me.x["[]"].w(1);
    me.services[1].trips[1].km(3);
    me.services["[i]"]["="]("n", 'x["[]"].w + services[i].trips[]');
    const e = me.explain("services.1.n");
    assert.equal(e.expr, 'x["[]"].w + services[1].trips[]');
    const a = e.derivation.inputs.find((i: any) => i.kind === "aggregate");
    assert.equal(a.aggregate.collection, "services.1.trips");
    assert.equal(a.aggregate.op, "count");
    const s = e.derivation.inputs.find((i: any) => !i.kind);
    assert.equal(s.path, 'x["[]"].w');
    assert.equal(s.value, 1);
  });

  // §11 incompatibilities
  t("I1: me('x[]') reads (S2: undefined), root and memories unchanged", () => {
    const me = fresh(mode);
    me.x[1].f(2); me.x[2].f(3);
    assert.equal(readsNothingWritten(me, "x[]"), undefined);
  });
  t("I2: me('x[].f') / me('a[].b.c') no longer read x.f / a.b.c; .[] and [ ] forms rejected, no write", () => {
    const me = fresh(mode);
    me.x.f(99); me.a.b.c(7);
    assert.equal(readsNothingWritten(me, "x[].f"), undefined);
    assert.equal(readsNothingWritten(me, "a[].b.c"), undefined);
    assert.equal(readsNothingWritten(me, "x.[].f"), undefined);
    assert.equal(readsNothingWritten(me, "x[ ].f"), undefined);
    assert.equal(me("x.f"), 99);
  });
  t("I3: explain('x[].f') explains the aggregate, not x.f", () => {
    const me = fresh(mode);
    me.x.f(99);
    const e = me.explain("x[].f");
    assert.equal(e.path, "x[].f");
    assert.equal(e.expr, "x[].f");
    assert.equal(e.value, undefined);
    assert.deepEqual(e.meta.dependsOn, ["x[].f"]);
    const a = e.derivation.inputs[0];
    assert.equal(a.kind, "aggregate");
    assert.deepEqual([a.aggregate.collection, a.aggregate.field, a.aggregate.op], ["x", "f", "sum"]);
    assert.deepEqual([a.aggregate.context, a.aggregate.coverage, a.aggregate.status], ["public-view", "public-view", "unsupported"]);
    assert.equal(e.derivation.inputs.length, 1);
  });
  t("I4: formula with [] is parsed: no scalar refs x / f, evaluation-failed naming the aggregate (S2)", () => {
    const me = fresh(mode);
    me.x[1].f(2); me.x.f(99); me.y(1);
    me.s["="]("v", "x[].f + y");
    assert.equal(me("s.v"), undefined);
    const d = me.derivations["s.v"];
    assert.deepEqual(d.refs.map((r: any) => r.label), ["y"]);
    assert.deepEqual(d.aggregates.map((a: any) => [a.collection, a.field, a.op]), [[["x"], ["f"], "sum"]]);
    const e = me.explain("s.v");
    assert.deepEqual(e.meta.unresolved, { reason: "evaluation-failed", inputs: ["x[].f"] });
    assert.deepEqual(e.meta.dependsOn, ["y", "x[].f"]);
  });
  t("I4b: rejected forms in formulas evaluate to undefined, evaluation-failed", () => {
    const me = fresh(mode);
    me.x[1].f(2);
    for (const [k, expr] of [["a", "x[].f[2]"], ["b", "x[a > 1][]"], ["c", "x[].y[]"], ["d", "x[][2]"]]) {
      me.s["="](k, expr);
      assert.equal(me(`s.${k}`), undefined, expr);
      assert.equal(me.explain(`s.${k}`).meta.unresolved.reason, "evaluation-failed", expr);
    }
  });
  t("I5: aggregate inputs carry kind + aggregate; scalar inputs keep the 4.1 shape", () => {
    const me = fresh(mode);
    me.y(1);
    me.s["="]("v", "x[] + y");
    const [scalar, aggregate] = me.explain("s.v").derivation.inputs;
    assert.deepEqual(Object.keys(scalar).sort(), ["label", "masked", "origin", "path", "value"]);
    assert.equal(aggregate.kind, "aggregate");
    assert.equal(aggregate.aggregate.op, "count");
    assert.equal(aggregate.aggregate.field, null);
  });
  t("I7: quoted selectors in me(), explain() and formula text address the literal segment", () => {
    const me = base(mode);
    assert.equal(me('z["[]"].w'), 1);
    assert.equal(me.explain('z["[]"].w').value, 1);
    me.t["="]("o", "z['[]'].w + 1");
    assert.equal(me("t.o"), 2);
  });
  t("I8: explain renders non-plain paths; plain paths unchanged", () => {
    const me = base(mode);
    me.z["[]"].a(2);
    me.z["[]"]["="]("t", "a * 3");
    const e = me.explain('z["[]"].t');
    assert.equal(e.path, 'z["[]"].t');
    assert.deepEqual(e.meta.dependsOn, ['z["[]"].a']);
    assert.equal(e.derivation.inputs[0].path, 'z["[]"].a');
    me.z["[]"].a(4);
    const e2 = me.explain('z["[]"].t');
    // eager: the wave's source is the written input; lazy: the target itself (4.1 behaviour). Either way rendered.
    if (e2.meta.sourcePath !== undefined) assert.ok([`z["[]"].a`, `z["[]"].t`].includes(e2.meta.sourcePath), e2.meta.sourcePath);
    for (const p of e2.meta.recomputed ?? []) assert.ok(!p.includes(".["), p);
    me.p.q(1); me.p["="]("r", "q + 1");
    assert.equal(me.explain("p.r").path, "p.r");
    assert.deepEqual(me.explain("p.r").meta.dependsOn, ["p.q"]);
  });

  // the demo's case
  t("robots[i].batteries[] in an [i] template: each robot's rule names its own collection, incl. later robots", () => {
    const me = fresh(mode);
    me.robots[1].batteries[1].charge(40); me.robots[1].batteries[1].capacity(100);
    me.robots["[i]"]["="]("battery", "robots[i].batteries[].charge / robots[i].batteries[].capacity * 100");
    me.robots[2].batteries[1].charge(10);
    for (const r of ["1", "2"]) {
      const e = me.explain(`robots.${r}.battery`);
      assert.equal(e.expr, `robots[${r}].batteries[].charge / robots[${r}].batteries[].capacity * 100`);
      assert.deepEqual(
        e.derivation.inputs.map((i: any) => [i.path, i.aggregate.collection, i.aggregate.field, i.aggregate.op]),
        [[`robots.${r}.batteries[].charge`, `robots.${r}.batteries`, "charge", "sum"],
         [`robots.${r}.batteries[].capacity`, `robots.${r}.batteries`, "capacity", "sum"]],
      );
      assert.equal(me(`robots.${r}.battery`), undefined);
    }
    assert.equal(readsNothingWritten(me, "robots[1].batteries[]"), undefined);
    assert.equal(readsNothingWritten(me, "robots.1.batteries[].charge"), undefined);
  });

  // guards
  t("4.1 routing kept: me('x[2]') still writes the root value; dotted plain reads unchanged", () => {
    const me = fresh(mode);
    me.x[2].f(5);
    assert.equal(me("x[2].f"), 5);
    const n = me.memories.length;
    me("x[2]");
    assert.equal(me.memories.length, n + 1);
  });
  t("guest reads of aggregates / literals: undefined or public value, no throw, no write", () => {
    const me = base(mode);
    const g = me.as(null);
    const before = state(me);
    assert.equal(g("z[].w"), undefined);
    assert.equal(g('z["[]"].w'), 1);
    assert.equal(g("z.[].w"), undefined);
    assert.equal(state(me), before);
  });
  t("literal read under a secret scope stays stealth for guests", () => {
    const me = fresh(mode);
    me.v["_"]("k");
    me.v["[]"].w(3);
    assert.equal(me('v["[]"].w'), 3);
    assert.equal(me.as(null)('v["[]"].w'), undefined);
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log("failed:\n  " + failures.join("\n  ")); process.exit(1); }
