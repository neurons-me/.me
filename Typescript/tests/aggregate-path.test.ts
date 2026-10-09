/// <reference types="node" />
// Stage S2 of .me 4.2: the path parser for the collection aggregate `[]` (contract v4.1, v3 §3 / §10.4 / §11).
//
// The parser and routing. Since S3 aggregates are evaluated (values asserted here where routing depends on them;
// the evaluator's own contract suite is tests/aggregate-eval.test.ts). Covered here:
//   - the grammar (classifyPathExpression), the round-trip renderer and the quote-aware normalizer;
//   - every §12.2 lit.* case, at the level S2 can check (values that need evaluation are asserted as
//     "recognised as an aggregate, undefined, nothing written");
//   - incompatibilities I1–I10 and the S2-close decisions (z.["[]"].w rejected; error precedence);
//   - robots[i].batteries[] in a [i] template.
// Every kernel case runs in eager and lazy mode.
//
// Run: node tests/aggregate-path.test.ts   (Node >= 22.18)
import assert from "node:assert/strict";
import ME from "../dist/index.js";
import {
  classifyPathExpression,
  isFixedKeySelector,
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
agg("x[a b][]", ["x", "a b"], null);              // fixed key with a space: 4.1 reads x["a b"] as child "a b"
agg("stops[STOP:12].times[].min", ["stops", "STOP:12", "times"], ["min"]);
agg("x[a=b][].f", ["x", "a=b"], ["f"]);           // "=" alone is not a 4.1 filter operator
agg("@ana.items[]", ["@ana", "items"], null);
agg("my-list[]", ["my-list"], null);
agg("x[].2", ["x"], ["2"]);                       // a numeric field is a name in me() strings (formula text: #5)

const lit = (s: string, segments: string[]) => test(`literal ${s}`, () => {
  const c = classifyPathExpression(s);
  assert.equal(c.kind, "literal");
  if (c.kind !== "literal") return;
  assert.deepEqual(c.segments, segments);
});
lit('z["[]"].w', ["z", "[]", "w"]);
lit("z['[]'].w", ["z", "[]", "w"]);
lit('z["[]"]', ["z", "[]"]);
lit('["z[]"].w', ["z[]", "w"]);
lit(`z['["[]"]'].w`, ["z", '["[]"]', "w"]);
lit('x[""].f', ["x", "f"]);                        // empty quoted selector dropped, as in 4.1

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
rej("x[].f.", "invalid-field");
rej("x[].a b", "invalid-field");
rej("x.my list[].f", "invalid-collection-path");   // name with whitespace
rej("my list[]", "invalid-collection-path");
rej("[2][]", "invalid-collection-path");           // head must be a seg or a QUOTED selector
rej('z.["[]"][]', "dotted-literal-selector");      // S2 close: dotted literal selector rejected
rej('z.["[]"].w', "dotted-literal-selector");
rej("z.['[]'].w", "dotted-literal-selector");
rej('z.["[]"]', "dotted-literal-selector");
rej("a..b[]", "invalid-collection-path");
rej("a+b[]", "invalid-collection-path");
rej("|Whatever[]|", "invalid-field");
rej("|Whatever[]", "invalid-collection-path");
rej("x[].f+1", "invalid-field");
rej('x["a.b"][]', "invalid-collection-path");     // lit := no "."
rej("x[a>1 && b<2][]", "selector-on-collection");
rej("x[] + 1", "invalid-field");
rej("a[]b", "invalid-field");

const plain = (s: string) => test(`plain (4.1 route) ${s}`, () => assert.equal(classifyPathExpression(s).kind, "plain"));
for (const s of ["x", "x.f", "x[2].f", "robots[i].battery", "users[age > 18]", "x[1..3]", "x[[1,3]]", "x[c => c.f]", "_secret", "@ana", "", "a[b", "a]b", "[1,2,3]", "hello [world]", "x[ 2 ].f", 'robots[2]["x.y"]', 'me.domains["cleaker.me"]']) plain(s);   // quoted text with "." keeps 4.1

console.log("fixed-key = selector text the 4.1 parsers do not interpret");
test("fixed keys", () => {
  for (const k of ["2", "i", "a b", "STOP:12", "a=b", "2.5", "-1", "é", "ana@x"]) assert.equal(isFixedKeySelector(k), true, k);
  assert.equal(isFixedKeySelector("[]\"", true), true, "quoted is always fixed");
});
test("not fixed: transform, range, list, filter, blank", () => {
  for (const k of ["c => c.f", "1..3", "3..1", "[1,3]", '["a","b"]', "a > 1", "a>1 && b<2", "a == 1 || b != 2", " ", ""]) {
    assert.equal(isFixedKeySelector(k), false, k);
  }
});

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
  t("lit.bare-is-operator: z[] counts z's members, z[].w sums their w (never z.w = 99), nothing written", () => {
    for (const noLeaf of [false, true]) {
      const me = base(mode, noLeaf);
      // members of z: "[]" (literal key), "a", and "w" when z.w exists (its own entry makes it a member)
      assert.equal(readsNothingWritten(me, "z[]"), noLeaf ? 2 : 3);
      assert.equal(readsNothingWritten(me, "z[].w"), noLeaf ? 6 : undefined, "z.w.w is missing → incomplete");
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
  t("lit.root-routing: me('z[]') reads; me('z[\"[]\"]') (no dot, not a []-form) keeps the 4.1 root write", () => {
    const me = base(mode);
    readsNothingWritten(me, "z[]");
    const n = me.memories.length;
    me('z["[]"]');
    assert.equal(me.memories.length, n + 1);
    assert.equal(me.inspect().index[""], 'z["[]"]');
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
  t("I1: me('x[]') reads the count, root and memories unchanged", () => {
    const me = fresh(mode);
    me.x[1].f(2); me.x[2].f(3);
    assert.equal(readsNothingWritten(me, "x[]"), 2);
    assert.equal(readsNothingWritten(me, "x[].f"), 5);
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
    // x has one member, "f" (the key x.f); its term x.f.f is missing → incomplete, never x.f = 99
    assert.deepEqual([a.aggregate.context, a.aggregate.coverage, a.aggregate.status], ["public-view", "public-view", "incomplete"]);
    assert.deepEqual(a.aggregate.problems, { count: 1, sample: [{ path: "x.f.f", kind: "missing" }] });
    assert.equal(e.derivation.inputs.length, 1);
  });
  t("I4: formula with [] has no scalar refs x / f; x[].f over {1: f=2, f: 99} is incomplete (x.f.f missing)", () => {
    const me = fresh(mode);
    me.x[1].f(2); me.x.f(99); me.y(1);
    me.s["="]("v", "x[].f + y");
    assert.equal(me("s.v"), undefined);
    const d = me.derivations["s.v"];
    assert.deepEqual(d.refs.map((r: any) => r.label), ["y"]);
    assert.deepEqual(d.aggregates.map((a: any) => [a.collection, a.field, a.op]), [[["x"], ["f"], "sum"]]);
    const e = me.explain("s.v");
    assert.deepEqual(e.meta.unresolved, { reason: "incomplete", inputs: ["x[].f"], causes: [{ path: "x[].f", status: "incomplete" }] });
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
    assert.deepEqual(Object.keys(scalar).sort(), ["label", "masked", "origin", "path", "status", "value"]);
    assert.equal(scalar.status, "resolved");
    assert.equal(aggregate.status, aggregate.aggregate.status);
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

  // root routing: only aggregates change route; rejected forms change only where 4.1 already read
  t("root routing: valid aggregates read; ANY invalid []-form fails as a read (undefined, no write, no memory)", () => {
    const reads: Array<[string, any]> = [
      ["x[]", 3], ["x[].f", undefined], ["z[]", 3], ['z["[]"][]', 1], ['["z[]"][]', undefined], ["z[].w", undefined],
      ['z["[]"].w', 1], ["z['[]'].w", 1], ["x[2].f", 3], ["x[ 2 ].f", 3], ['x[""].f', 11], ["z.w", 99],
    ];
    for (const [s, v] of reads) {
      const me = base(mode); me.x[2].f(3); me.x.f(11); me.x.y(4);
      assert.equal(readsNothingWritten(me, s), v, s);
    }
    // invalid []-forms, dotted or not: never a root write (4.1 wrote the non-dotted ones as the root value)
    const failing = ["z.[].w", "z[ ].w", "x[].y[]", "x[a>1][].f", "a[]b", "[]", "[ ]", "x[][]", "x[] + 1",
      "my list[]", "[2][]", "x[a>1][]", "list [] here", "x[].f[2]", 'x["a.b"][]', "|Whatever[]|"];
    for (const s of failing) {
      const me = base(mode);
      assert.equal(readsNothingWritten(me, s), undefined, s);
      const e = me.explain(s);
      assert.equal(e.meta.unresolved.reason, "evaluation-failed", s);
      assert.equal(typeof e.meta.unresolved.detail, "string", `${s}: detail names the parse error`);
    }
  });
  t("strings without a []-form keep the 4.1 route exactly (root write when 4.1 wrote)", () => {
    const writes = ['z["[]"]', '["z[]"]', '["hello"]', "x[2]", "x[i]", "users[age > 18]", "[1,2,3]", "hello [world]",
      "a[b", "a]b", "hello world"];
    for (const s of writes) {
      const me = base(mode);
      const n = me.memories.length;
      me(s);
      assert.equal(me.memories.length, n + 1, `${s}: 4.1 root write kept`);
      assert.equal(me.inspect().index[""], s, s);
    }
  });
  t("string VALUES are never parsed: me.note('a[]b'), me.postulate([], 'a[]b') store the text", () => {
    const me = fresh(mode);
    me.note("a[]b");
    assert.equal(me("note"), "a[]b");
    me.postulate([], "x[] + 1");
    assert.equal(me.inspect().index[""], "x[] + 1");
    me.list.label('z["[]"].w');
    assert.equal(me("list.label"), 'z["[]"].w');
  });
  t("explain of plain strings keeps the 4.1 path (no rendering of junk segments)", () => {
    const me = base(mode);
    assert.equal(me.explain("x[1..3]").path, "x.[1.3]");
    assert.equal(me.explain("a]b").path, "a]b");
    assert.equal(me.explain("z.w").path, "z.w");
    assert.equal(me.explain("z.w").value, 99);
  });
  t("explain of a rejected form: undefined, evaluation-failed, no derivation, nothing written", () => {
    for (const s of ["z.[].w", "z[ ].w", "x[].y[]", "a[]b", "[]", "x[] + 1", "x[a>1][]"]) {
      const me = base(mode);
      const before = state(me);
      const e = me.explain(s);
      assert.deepEqual(
        { path: e.path, value: e.value, expr: e.expr, derivation: e.derivation, meta: e.meta },
        { path: s, value: undefined, expr: null, derivation: null, meta: { dependsOn: [], unresolved: { reason: "evaluation-failed", detail: (classifyPathExpression(s) as any).reason } } },
        s,
      );
      assert.equal(state(me), before, s);
    }
  });
  t("formula with a whitespace-only selector (z[ ].w) is rejected: evaluation-failed (4.1 read z.w = 99)", () => {
    const me = base(mode);
    me.t["="]("o", "z[ ].w");
    assert.equal(me("t.o"), undefined);
    assert.deepEqual(me.explain("t.o").meta.unresolved, { reason: "evaluation-failed", detail: "rejected-path-form" });
  });

  // secret scope through a literal [] proxy segment: historical 4.1 scope over z (contract §3)
  t("_ through literal []: me.z['[]']['_']('k') makes ALL of z secret, as in 4.1", () => {
    const me = fresh(mode);
    me.z["[]"]["_"]("k");
    me.z.a(1);
    me.z["[]"].w(3);
    me.z.b(2);
    assert.ok(Object.prototype.hasOwnProperty.call(me.localSecrets, "z"), "scope key is z");
    assert.ok(!Object.prototype.hasOwnProperty.call(me.localSecrets, "z.[]"), "not z.[]");
    assert.equal(me.memories.find((m: any) => m.operator === "_").path, "z");
    for (const g of [me.as(null), me.as("wrong")]) {
      assert.equal(g("z.a"), undefined, "guest cannot read z.a");
      assert.equal(g("z.b"), undefined, "guest cannot read z.b");
      assert.equal(g('z["[]"].w'), undefined, "guest cannot read the literal child");
      assert.equal(g("z"), undefined);
      assert.equal(g("z[]"), undefined, "aggregate read under the scope: undefined");
    }
    assert.equal(me("z.a"), 1, "owner reads z.a");
    assert.equal(me("z.b"), 2);
    assert.equal(me('z["[]"].w'), 3, "owner reads the literal child");
    assert.equal(me.as("k")("z.a"), 1, "key holder reads z.a");
    assert.equal(me.as("k")('z["[]"].w'), 3, "key holder reads the literal child");
  });
  t("_ through literal [] after a public write: same as z['_'] in 4.1 (the earlier value is hidden from all)", () => {
    for (const declare of [(me: any) => me.z["_"]("k"), (me: any) => me.z["[]"]["_"]("k")]) {
      const me = fresh(mode);
      me.z.a(1);
      declare(me);
      me.z.b(2);
      assert.deepEqual(
        [me("z.a"), me("z.b"), me.as("k")("z.a"), me.as(null)("z.a"), me.as(null)("z.b")],
        [undefined, 2, undefined, undefined, undefined],
      );
    }
  });
  t("formula text: x[].2 does not tokenize (issue #5) → evaluation-failed", () => {
    const me = fresh(mode);
    me.s["="]("v", "x[].2");
    assert.equal(me("s.v"), undefined);
    assert.equal(me.explain("s.v").meta.unresolved.reason, "evaluation-failed");
  });
  t("_ through literal []: declared before any write, and after hydrate (snapshot), scope stays z", () => {
    const me = fresh(mode);
    me.z["[]"]["_"]("k");
    me.z.a(1);
    assert.equal(me.as(null)("z.a"), undefined);
    const k = fresh(mode);
    k.hydrate(JSON.parse(JSON.stringify(me.exportSnapshot())));
    assert.ok(Object.prototype.hasOwnProperty.call(k.localSecrets, "z"));
    assert.equal(k.as(null)("z.a"), undefined, "guest blocked after hydrate");
  });
  t("_ scope paths of other bracket proxy forms are exactly 4.1's", () => {
    const cases: Array<[(me: any) => void, string]> = [
      [(me) => me.z["x[]"]["_"]("k"), "z.x"],
      [(me) => me.z["[ ]"]["_"]("k"), "z"],
      [(me) => me.z['["[]"]']["_"]("k"), 'z.["[]"]'],
      [(me) => me.z["[2]"]["_"]("k"), "z.2"],
      [(me) => me.z["_"]("k"), "z"],
    ];
    for (const [declare, key] of cases) {
      const me = fresh(mode);
      declare(me);
      assert.deepEqual(Object.keys(me.localSecrets), [key]);
    }
  });
  t("~ (noise) through literal [] is unchanged: raw scope z.[] as in 4.1", () => {
    const me = fresh(mode);
    me.z["[]"]["~"]("n");
    assert.deepEqual(Object.keys(me.localNoises), ["z.[]"]);
  });

  // S2 close, decision 1: z.["[]"].w is rejected (the canonical literal is z["[]"].w)
  t("decision 1: z.[\"[]\"].w (and z.['[]'].w, z.[\"[]\"]) is rejected: undefined, no root value, no memory, no index change", () => {
    for (const s of ['z.["[]"].w', "z.['[]'].w", 'z.["[]"]', 'z.["[]"][]']) {
      const me = base(mode);
      me.z['["[]"]'].w(7);                       // a raw-segment key exists too: still not read
      assert.equal(readsNothingWritten(me, s), undefined, s);
      assert.equal(me.as(null)(s), undefined, s);
      const e = me.explain(s);
      assert.deepEqual([e.value, e.derivation, e.meta.unresolved], [undefined, null, { reason: "evaluation-failed", detail: "dotted-literal-selector" }], s);
    }
    const me = base(mode);
    assert.equal(me('z["[]"].w'), 1, "the canonical literal still reads");
    me.t["="]("o", 'z.["[]"].w + 1');
    assert.equal(me("t.o"), undefined);
    assert.deepEqual(me.explain("t.o").meta.unresolved, { reason: "evaluation-failed", detail: "rejected-path-form" });
    const keep = fresh(mode);
    keep.z.x.w(5);
    assert.equal(keep('z.["x"].w'), 5, "a quoted selector after a dot without brackets keeps the 4.1 read");
  });
  // S2 close, decision 2: per-input causes, fixed precedence, both input orders
  t("decision 2: per-input causes and fixed precedence, identical in both input orders", () => {
    const run = (expr: string, setup: (me: any) => void, target = ["s", "v"]) => {
      const me = fresh(mode);
      me.x[1].f(1); me.x[2].g(1);                 // x[].f is incomplete (x.2.f missing)
      setup(me);
      me[target[0]]["="](target[1], expr);
      const e = me.explain(target.join("."));
      return { v: me(target.join(".")), u: e.meta.unresolved, st: e.derivation.inputs.map((i: any) => [i.path, i.status]).sort() };
    };
    const both = (a: string, b: string, setup: (me: any) => void = () => {}, target?: string[]) => {
      const r1 = run(a, setup, target), r2 = run(b, setup, target);
      assert.deepEqual(r1, r2, `${a} vs ${b}`);
      return r1;
    };
    // missing scalar + incomplete aggregate → missing-input; both causes kept
    let r = both("nothere + x[].f", "x[].f + nothere");
    assert.deepEqual(r.u, { reason: "missing-input", inputs: ["s.nothere"], causes: [{ path: "s.nothere", status: "missing" }, { path: "x[].f", status: "incomplete" }] });
    assert.deepEqual(r.st, [["nothere", "missing"], ["x[].f", "incomplete"]]);
    // absent aggregate (empty collection) + incomplete aggregate → missing-input
    r = both("y[].f + x[].f", "x[].f + y[].f");
    assert.deepEqual(r.u, { reason: "missing-input", inputs: ["y[].f"], causes: [{ path: "x[].f", status: "incomplete" }, { path: "y[].f", status: "absent" }] });
    // incomplete only → incomplete
    r = both("x[].f + 1", "1 + x[].f");
    assert.deepEqual(r.u, { reason: "incomplete", inputs: ["x[].f"], causes: [{ path: "x[].f", status: "incomplete" }] });
    // authorized context (target inside a scope): the aggregate stays unsupported, never incomplete
    r = both("nothere + x[].f", "x[].f + nothere", (me) => me.w["_"]("k"), ["w", "t"]);
    assert.deepEqual(r.u, { reason: "missing-input", inputs: ["w.nothere"], causes: [{ path: "w.nothere", status: "missing" }, { path: "x[].f", status: "unsupported" }] });
    r = both("x[].f + 1", "1 + x[].f", (me) => me.w["_"]("k"), ["w", "t"]);
    assert.deepEqual(r.u, { reason: "evaluation-failed", inputs: ["x[].f"], causes: [{ path: "x[].f", status: "unsupported" }] });
    assert.equal(r.v, undefined);
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
    }
    assert.equal(me("robots.1.battery"), 40);
    assert.equal(me("robots.2.battery"), undefined, "robot 2 has no capacity → capacity sum incomplete");
    assert.equal(me.explain("robots.2.battery").meta.unresolved.reason, "incomplete");
    assert.equal(readsNothingWritten(me, "robots[1].batteries[]"), 1);
    assert.equal(readsNothingWritten(me, "robots.1.batteries[].charge"), 40);
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
