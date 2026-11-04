// Kernel-only logic test: the "Test: full bill logic" conversation from LLMS/Meta/meta-demo.js (no model call),
// replayed through validate -> dry-run -> confirm on a real this.me, asserting every value of the chained formulas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validateOps, newME, applyOps, dryRun } from "../src/index.ts";

const ctx: any = { window: { React: {} } };
// the demo bails out without React; a stub is enough to read its test data
vm.runInNewContext(readFileSync(new URL("../../Meta/meta-demo.js", import.meta.url), "utf8"), ctx);
const turns: { text: string; ops: any[] }[] = ctx.window.MetaDemoTests.logic.turns;
const near = (a: unknown, b: number) => assert.ok(typeof a === "number" && Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
const P = (k: string) => "cafe.order." + k;

test("full bill logic: chained + − × ÷ with constants, multi-level, recomputes on a price change", () => {
  const me: any = newME({});
  const seen: Record<string, number>[] = [];
  for (const t of turns) {
    const v = validateOps(JSON.parse(JSON.stringify({ ops: t.ops })));
    assert.deepEqual(v.errors, [], t.text);
    applyOps(me, v.ops, { confirm: true });
    seen.push(Object.fromEntries(["subtotal", "discount", "taxed", "tip", "total", "per_person"].map((k) => [k, me(P(k))])));
  }
  // after turn 5: 45*2 + 25*2 = 140; −10% = 126; ×1.16 = 146.16; tip 15% = 21.924; total 168.084; ÷2 = 84.042
  const a = seen[4]; near(a.subtotal, 140); near(a.discount, 14); near(a.taxed, 146.16); near(a.tip, 21.924); near(a.total, 168.084); near(a.per_person, 84.042);
  // bread 25 -> 30: the whole chain recomputes
  const b = seen[5]; near(b.subtotal, 150); near(b.discount, 15); near(b.taxed, 156.6); near(b.tip, 23.49); near(b.total, 180.09); near(b.per_person, 90.045);
  const x = me.explain(P("per_person"));
  assert.equal(x.expr, "total / diners");
  assert.deepEqual(x.meta.dependsOn, [P("total"), P("diners")]);
});

test("full bill logic: dry-run of the price change shows before/after without writing", () => {
  const state: any = { cafe: { order: { coffee: { price: 45, qty: 2 }, bread: { price: 25, qty: 2 }, diners: 2 } } };
  const me: any = newME(state); for (const t of turns.slice(1, 5)) applyOps(me, t.ops, { confirm: true });
  const r = dryRun(state, turns.slice(1, 6).flatMap((t) => t.ops));
  assert.deepEqual(r.errors, []);
  near(r.diff.find((d: any) => d.path === P("per_person"))!.after, 90.045);
  near(me(P("per_person")), 84.042); // the real ME is untouched by the dry run
});
