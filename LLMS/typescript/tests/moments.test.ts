// The demo's three moments (LLMS/Meta/meta-demo.js "Test: happy path / drift check / rejected op"), kernel only, no model:
// happy path writes and recomputes; a stale numeric claim is caught against live state; a define over a path that does not
// exist ("tip") is rejected at validated, by both the library (refErrors / parse) and the browser port, and nothing is written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validateOps, refErrors, newME, applyOps, flattenState, parse } from "../src/index.ts";

const ctx: any = { window: { React: {} } };
vm.runInNewContext(readFileSync(new URL("../../Meta/meta-demo.js", import.meta.url), "utf8"), ctx);
const T = ctx.window.MetaDemoTests, B = ctx.window.MetaDemoCheck;
const J = (x: unknown) => JSON.parse(JSON.stringify(x));
function run(turns: any[]) { const me: any = newME({}), known: string[] = [];
  for (const t of turns) { if (!t.ops) continue; const v = validateOps(J({ ops: t.ops })); assert.deepEqual(v.errors, []); assert.deepEqual(refErrors(v.ops, known), []);
    applyOps(me, v.ops, { confirm: true }); for (const o of v.ops as any[]) known.push(o.op === "define" ? `${o.path}.${o.name}` : o.path); }
  return { me, known }; }

test("moment 1 · happy path: bread 25, total = coffee + bread = 70", () => {
  const { me } = run(T.happy.turns); assert.equal(me("cafe.total"), 70);
});

test("moment 2 · drift: the scripted stale reply (total 65, bread 20) is caught against live state (70, 25)", () => {
  const turns = T.drift.turns, { me, known } = run(turns.slice(0, -1)), last = turns.at(-1);
  assert.equal(last.ops, undefined); assert.equal(last.src, "test · scripted, no model");
  const ent = known.map((p) => ({ path: p, value: me(p) }));
  const cs = J(B.claimCheck(last.reply, ent));
  const by = Object.fromEntries(cs.map((c: any) => [c.path, c]));
  assert.deepEqual(by["cafe.total"], { path: "cafe.total", claim: 65, state: 70, ok: false });
  assert.deepEqual(by["cafe.bread.price"], { path: "cafe.bread.price", claim: 20, state: 25, ok: false });
  assert.equal(by["cafe.coffee.price"].ok, true);
  // a correct reply passes
  assert.ok(J(B.claimCheck("The total is 70: coffee 45 + bread 25.", ent)).every((c: any) => c.ok));
  assert.equal(me.explain("cafe.total").expr, "coffee.price + bread.price");
});

test("moment 3 · rejection: total = coffee + bread + tip, with no tip, is rejected at validated; nothing written", async () => {
  const turns = T.reject.turns, { me, known } = run(turns.slice(0, -1)), bad = turns.at(-1).ops;
  assert.equal(validateOps(J({ ops: bad })).errors.length, 0); // well-formed…
  const e = refErrors(bad, known); assert.equal(e.length, 1); assert.match(e[0], /unknown path "tip"/); // …but names a path that does not exist
  const eb = J(B.refErrors(bad, known)); assert.deepEqual(eb, e); // browser port says the same
  assert.equal(me("cafe.total"), 70);
  // parse(): the model's reply is rejected, never applied; with no repairs left it stays rejected
  const state = Object.fromEntries(known.map((p) => [p, me(p)]));
  const r = await parse({ text: "Make the total include the tip.", state } as any, { model: async () => JSON.stringify({ ops: bad }), maxRepairs: 0 });
  assert.equal(r.ok, false); assert.deepEqual(r.ops, []); assert.match(r.errors[0], /unknown path "tip"/);
  assert.equal(me("cafe.total"), 70);
  // once a tip exists the same formula is fine
  assert.deepEqual(refErrors(bad, [...known, "cafe.tip"]), []);
  assert.deepEqual(refErrors([{ op: "set", path: "cafe.tip", value: 10 }, ...bad] as any, known), []);
});
