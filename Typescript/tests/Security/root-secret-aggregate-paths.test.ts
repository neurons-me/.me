/// <reference types="node" />
/**
 * INTERACTION — root-scope me["_"] (fix d3327ef) × the 4.2 S2 path parser ([] aggregates, quoted literals).
 *
 * Under a root secret every path is protected. A guest (as(null)) or a wrong key must observe nothing through
 * the new surfaces: quoted-literal reads, aggregate reads, invalid []-forms, explain(), formulas, and after a
 * snapshot/hydrate. Twin check: a guest must observe the same as on an EMPTY kernel (no secret, no data).
 * Every case runs in eager and lazy mode.
 */
import { MEConstructor as ME, assert, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("Interaction: root-scope secret × [] paths");
const MODES = ["eager", "lazy"] as const;

function kernel(mode: string, withData = true): any {
  const me: any = new ME();
  me.setRecomputeMode(mode);
  if (!withData) return me;
  me["_"]("rk");
  me.z["[]"].w(1);
  me.z.a.w(5);
  me.z.w(99);
  me.robots[1].batteries[1].charge(40);
  me.robots[1].batteries[2].charge(30);
  me.t["="]("o", 'z["[]"].w + 1');
  return me;
}
const READS = ['z["[]"].w', "z['[]'].w", "z[]", "z[].w", "robots[1].batteries[]", "robots.1.batteries[].charge",
  "z.[].w", "z[ ].w", "a[]b", "x[][]", "z.w", "z.a.w", "t.o", "z"];
// explain() of a DERIVATION under a secret exposes expr / input paths / dependsOn to guests in 4.1 already
// (pre-existing, see the KNOWN case below), so the twin compares value and status for every path, and the full
// shape only for paths that are not derivation targets.
const stable = (e: any, full: boolean) => JSON.stringify(full
  ? { path: e.path, value: e.value, expr: e.expr, derivation: e.derivation, dependsOn: e.meta?.dependsOn, unresolved: e.meta?.unresolved }
  : { path: e.path, value: e.value });
const DERIVED = new Set(["t.o"]);

async function main() {
  console.log("\n### Interaction — root-scope _ × [] paths");
  for (const mode of MODES) {
    await test(`[${mode}] owner and key holder read the literal [] child and the formula; guest and wrong key do not`, () => {
      const me = kernel(mode);
      assert.equal(me('z["[]"].w'), 1, "owner literal");
      assert.equal(me("t.o"), 2, "owner formula over the literal");
      assert.equal(me.as("rk")('z["[]"].w'), 1, "holder literal");
      for (const g of [me.as(null), me.as("wrong")]) {
        assert.equal(g('z["[]"].w'), undefined, "guest literal");
        assert.equal(g("z['[]'].w"), undefined);
        assert.equal(g("t.o"), undefined, "guest formula");
        assert.equal(g("z.w"), undefined);
      }
    });
    await test(`[${mode}] aggregate and invalid []-form reads under a root secret: undefined, nothing written, any caller`, () => {
      const me = kernel(mode);
      const before = JSON.stringify({ n: me.memories.length, idx: me.inspect().index });
      for (const caller of [me, me.as(null), me.as("wrong"), me.as("rk")]) {
        for (const p of ["z[]", "z[].w", "robots[1].batteries[]", "robots.1.batteries[].charge", "z.[].w", "z[ ].w", "a[]b", "x[][]", "[]"]) {
          assert.equal(caller(p), undefined, p);
        }
      }
      assert.equal(JSON.stringify({ n: me.memories.length, idx: me.inspect().index }), before, "no write");
    });
    await test(`[${mode}] twin: a guest sees the same as on an empty kernel (reads and explain)`, () => {
      const B = kernel(mode, true).as(null);
      const A = kernel(mode, false).as(null);
      for (const p of READS) {
        assert.deepEqual(B(p), A(p), `read ${p}`);
        assert.equal(stable(B.explain(p), !DERIVED.has(p)), stable(A.explain(p), !DERIVED.has(p)), `explain ${p}`);
      }
    });
    await test(`[${mode}] KNOWN pre-existing (4.1): guest explain of a derivation under a secret shows expr and input paths — same shape for a literal-path formula as for a plain one (no new class)`, () => {
      const shape = (expr: string, ref: string) => {
        const me: any = new ME();
        me.setRecomputeMode(mode);
        me["_"]("rk");
        me.z["[]"].w(1); me.a(1);
        me.t["="]("o", expr);
        const e = me.as(null).explain("t.o");
        assert.equal(e.value, undefined, "no value");
        assert.equal(e.derivation.inputs[0].value, undefined, "no input value");
        return JSON.stringify({ hasExpr: e.expr === expr, inputs: e.derivation.inputs.map((i: any) => ({ ...i, label: i.label === ref, path: i.path === ref })) });
      };
      assert.equal(shape('z["[]"].w + 1', 'z["[]"].w'), shape("a + 1", "a"));
    });
    await test(`[${mode}] explain of a quoted literal path goes through the stealth check (guest value undefined)`, () => {
      const me = kernel(mode);
      assert.equal(me.explain('z["[]"].w').value, 1, "owner");
      assert.equal(me.as(null).explain('z["[]"].w').value, undefined, "guest");
      assert.equal(me.as("wrong").explain('z["[]"].w').value, undefined, "wrong key");
    });
    await test(`[${mode}] root _ plus the historical z["[]"]["_"] scope: scopes "" and "z"; guest reads nothing`, () => {
      const me: any = new ME();
      me.setRecomputeMode(mode);
      me["_"]("rk");
      me.z["[]"]["_"]("k");
      me.z.a(1);
      me.z["[]"].w(3);
      assert.deepEqual(Object.keys(me.localSecrets).sort(), ["", "z"]);
      assert.equal(me("z.a"), 1);
      assert.equal(me('z["[]"].w'), 3);
      for (const g of [me.as(null), me.as("wrong"), me.as("k"), me.as("rk")]) {
        assert.equal(g("z.a"), undefined, "nested scopes: no single key opens both (4.1 semantics)");
        assert.equal(g('z["[]"].w'), undefined);
      }
    });
    await test(`[${mode}] snapshot → hydrate: guest still blocked; owner after resupply reads the literal`, () => {
      const me = kernel(mode);
      const k: any = new ME();
      k.setRecomputeMode(mode);
      k.hydrate(JSON.parse(JSON.stringify(me.exportSnapshot())));
      for (const p of READS) assert.equal(k.as(null)(p), undefined, `guest ${p} after hydrate`);
      k["_"]("rk");
      assert.equal(k('z["[]"].w'), 1, "owner after resupply");
      for (const p of READS) assert.equal(k.as(null)(p), undefined, `guest ${p} after resupply`);
    });
  }
  summarize();
}
main();
