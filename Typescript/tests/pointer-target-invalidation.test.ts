/// <reference types="node" />
// Formulas that read THROUGH a pointer (formerly known issue #4, CHANGELOG 4.1.0).
//
// A derivation is subscribed to the literal paths of its refs and, when a ref
// resolves through pointers, to each pointer location followed and each path it
// leads to (`refs[i].via`). Every case runs in eager and lazy mode.
//
// Recompute detection: every evaluation of a derivation commits a new wave
// object in `lastRecomputeWaveByTarget[target]` (internal, read here on
// purpose). "Not recomputed" = the same object before and after; each case that
// asserts it also asserts the positive (a new object after a relevant write),
// so the detector is shown to fire. Subscriptions are read from the internal
// `refSubscribers` to check that a redirect leaves nothing behind.
//
// Cycle cases run in a child process with a timeout, so a hang fails the test
// instead of hanging the suite.
//
// Run: node tests/pointer-target-invalidation.test.ts   (Node >= 22.18)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ME from "../dist/index.js";

type Mode = "eager" | "lazy";
type Case = { name: string; run: (mode: Mode) => void };

function fresh(mode: Mode): any {
  const me: any = new (ME as any)();
  me.setRecomputeMode(mode);
  return me;
}
const wave = (me: any, key: string) => me.lastRecomputeWaveByTarget[key];
const subscribed = (me: any, path: string, key: string) => !!me.refSubscribers[path]?.has(key);
const subscriptionsOf = (me: any, key: string) =>
  Object.keys(me.refSubscribers).filter((p) => me.refSubscribers[p].has(key)).sort();

// ─── cycle scenarios (run in a child process) ──────────────────────────────
function cycleScenario(mode: Mode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // Pointer cycle a -> b -> a: reading a.v never resolves.
  let me = fresh(mode);
  me.a["->"]("b");
  me.b["->"]("a");
  me.s["="]("n", "a.v + 1");
  out.ptrCycleValue = me("s.n") ?? null;
  out.ptrCycleReason = me.explain("s.n").meta.unresolved?.reason ?? null;
  me.s.unrelated(1); // more writes while the cycle exists
  me.b.v(9); // shadowed by the cycle (b is a pointer)
  out.ptrCycleAfterWrites = me("s.n") ?? null;
  me.b["->"]("data"); // break the cycle: a.v -> b.v -> data.v
  me.data.v(5);
  out.ptrCycleBroken = me("s.n");
  // A formula that reaches itself through a pointer is a cycle; a sibling
  // reading a plain value through the same pointer is fine.
  me = fresh(mode);
  me.s.x(1);
  me.s.self["->"]("s");
  me.s["="]("ok", "self.x + 1");
  me.s["="]("loop", "self.loop + 1");
  out.selfOk = me("s.ok");
  out.selfLoop = me("s.loop") ?? null;
  out.selfLoopReason = me.explain("s.loop").meta.unresolved?.reason ?? null;
  me.s.x(5);
  out.selfOkAfter = me("s.ok");
  out.selfLoopAfter = me("s.loop") ?? null;
  return out;
}
if (process.argv[2] === "--cycle-child") {
  console.log(JSON.stringify(cycleScenario(process.argv[3] as Mode)));
  process.exit(0);
}

const cases: Case[] = [
  {
    name: "control: no pointer, a target write recomputes; refs carry no via and no extra subscription",
    run(mode) {
      const me = fresh(mode);
      me.gtfs.trips.T2.live(1);
      me.gtfs.services.S1["="]("n", "gtfs.trips.T2.live * 10");
      assert.equal(me("gtfs.services.S1.n"), 10);
      me.gtfs.trips.T2.live(2);
      assert.equal(me("gtfs.services.S1.n"), 20);
      assert.equal(me.derivations["gtfs.services.S1.n"].refs[0].via, undefined);
      assert.deepEqual(subscriptionsOf(me, "gtfs.services.S1.n"), [
        "gtfs.services.S1.gtfs.trips.T2.live",
        "gtfs.trips.T2.live",
      ]);
    },
  },
  {
    name: "target value change: a write at the pointer's target recomputes (GTFS repro)",
    run(mode) {
      const me = fresh(mode);
      me.gtfs.trips.T2.live(1);
      me.gtfs.services.S1.trips.T2["->"]("gtfs.trips.T2"); // pointer on a prefix
      me.gtfs.services.S1["="]("n", "trips.T2.live * 10"); // relative ref, read via the pointer
      assert.equal(me("gtfs.services.S1.n"), 10);
      me.gtfs.trips.T2.live(2);
      assert.equal(me("gtfs.services.S1.trips.T2.live"), 2);
      assert.equal(me("gtfs.services.S1.n"), 20);
      // explain() still reports only the literal ref path (no resolved target added).
      const e = me.explain("gtfs.services.S1.n");
      assert.deepEqual(e.meta.dependsOn, ["gtfs.services.S1.trips.T2.live"]);
      assert.deepEqual(
        e.derivation.inputs.map((i: any) => i.path),
        ["gtfs.services.S1.trips.T2.live"],
      );
    },
  },
  {
    name: "pointer redirect: new target reflected; the old target no longer recomputes or stays subscribed",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users.luis.age(15);
      me.pick["->"]("users.ana");
      me.view["="]("n", "pick.age + 0");
      assert.equal(me("view.n"), 20);
      assert.ok(subscribed(me, "users.ana.age", "view.n"), "precondition: subscribed to the target");

      me.pick["->"]("users.luis");
      assert.equal(me("view.n"), 15);
      assert.ok(subscribed(me, "users.luis.age", "view.n"));
      assert.ok(!subscribed(me, "users.ana.age", "view.n"), "old target still subscribed after redirect");

      const w = wave(me, "view.n");
      me.users.ana.age(99); // old target
      assert.equal(me("view.n"), 15);
      assert.equal(wave(me, "view.n"), w, "writing the old target recomputed the formula");

      me.users.luis.age(30); // new target: the detector must fire
      assert.equal(me("view.n"), 30);
      assert.notEqual(wave(me, "view.n"), w);

      me.view["-"](); // removing the formula leaves no subscription behind
      assert.deepEqual(subscriptionsOf(me, "view.n"), []);
    },
  },
  {
    name: "target deletion: formula has no value (missing-input), and comes back when the target is re-created",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.pick["->"]("users.ana");
      me.view["="]("n", "pick.age + 0");
      assert.equal(me("view.n"), 20);
      me.users.ana["-"]();
      assert.equal(me("view.n"), undefined);
      assert.equal(me.explain("view.n").meta.unresolved?.reason, "missing-input");
      me.users.ana.age(33);
      assert.equal(me("view.n"), 33);
    },
  },
  {
    name: "pointer deletion: formula falls back to the literal path and drops the old target",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.pick["->"]("users.ana");
      me.view["="]("n", "pick.age + 0");
      assert.equal(me("view.n"), 20);
      me.pick["-"]();
      assert.equal(me("view.n"), undefined);
      assert.ok(!subscribed(me, "users.ana.age", "view.n"), "old target still subscribed after pointer deletion");
      assert.equal(me.derivations["view.n"].refs[0].via, undefined);
      const w = wave(me, "view.n");
      me.users.ana.age(21);
      assert.equal(me("view.n"), undefined);
      assert.equal(wave(me, "view.n"), w, "writing the old target recomputed the formula");
      me.pick.age(7); // the literal path now holds a plain value
      assert.equal(me("view.n"), 7);
      assert.notEqual(wave(me, "view.n"), w);
    },
  },
  {
    name: "pointer overwritten by a plain value: formula stops reading through it",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.pick["->"]("users.ana");
      me.view["="]("m", "pick.age + 0");
      assert.equal(me("view.m"), 20);
      me.pick("plain");
      assert.equal(me("pick.age"), undefined);
      assert.equal(me("view.m"), undefined);
      assert.ok(!subscribed(me, "users.ana.age", "view.m"));
    },
  },
  {
    name: "pointer created after the formula: formula starts reading through it",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.view["="]("n", "pick.age + 0"); // pick does not exist yet
      assert.equal(me("view.n"), undefined);
      me.pick["->"]("users.ana");
      assert.equal(me("view.n"), 20);
      me.users.ana.age(21);
      assert.equal(me("view.n"), 21);
    },
  },
  {
    name: "chain of 3 pointers: change at the end, then redirect in the middle",
    run(mode) {
      const me = fresh(mode);
      me.data.c.v(1);
      me.data.d.v(100);
      me.hop2["->"]("data.c");
      me.hop1["->"]("hop2");
      me.hop0["->"]("hop1");
      me.view["="]("n", "hop0.v + 0"); // hop0.v -> hop1.v -> hop2.v -> data.c.v
      assert.equal(me("view.n"), 1);
      me.data.c.v(2); // end of the chain
      assert.equal(me("view.n"), 2);
      me.hop2["->"]("data.d"); // middle of the chain
      assert.equal(me("view.n"), 100);
      assert.ok(!subscribed(me, "data.c.v", "view.n"), "old end of the chain still subscribed");
      assert.ok(subscribed(me, "data.d.v", "view.n"));
      const w = wave(me, "view.n");
      me.data.c.v(3); // old end
      assert.equal(me("view.n"), 100);
      assert.equal(wave(me, "view.n"), w, "writing the old end of the chain recomputed the formula");
      me.data.d.v(101);
      assert.equal(me("view.n"), 101);
      assert.notEqual(wave(me, "view.n"), w);
      me.hop1["->"]("data.c"); // redirect closer to the start, skipping hop2
      assert.equal(me("view.n"), 3);
      assert.ok(!subscribed(me, "hop2", "view.n") && !subscribed(me, "data.d.v", "view.n"));
    },
  },
  {
    name: "pointer target is itself a formula: a change upstream of the target reaches the reader",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.born(2000);
      me.users.ana["="]("age", "2026 - born");
      me.pick["->"]("users.ana");
      me.view["="]("adult", "pick.age >= 18");
      assert.equal(me("view.adult"), true);
      me.users.ana.born(2015);
      assert.equal(me("view.adult"), false);
    },
  },
  {
    name: "batched mutations before one read: redirect + old/new target writes collapse to the current value",
    run(mode) {
      const me = fresh(mode);
      me.users.ana.age(20);
      me.users.luis.age(15);
      me.pick["->"]("users.ana");
      me.view["="]("n", "pick.age + 0");
      assert.equal(me("view.n"), 20);
      const w0 = wave(me, "view.n");
      me.pick["->"]("users.luis");
      me.users.luis.age(40);
      me.users.ana.age(1);
      me.pick["->"]("users.ana");
      me.pick["->"]("users.luis");
      if (mode === "lazy") assert.equal(wave(me, "view.n"), w0, "lazy recomputed before the read");
      assert.equal(me("view.n"), 40);
      const w1 = wave(me, "view.n");
      assert.notEqual(w1, w0);
      if (mode === "lazy") assert.deepEqual([...w1.recomputed], ["view.n"]); // one evaluation for the batch
      me.users.ana.age(2);
      assert.equal(me("view.n"), 40);
      assert.equal(wave(me, "view.n"), w1, "old target recomputed after the batch");
      // chain variant: redirect in the middle and write the new end before reading
      me.data.c.v(1);
      me.data.d.v(5);
      me.hop2["->"]("data.c");
      me.hop1["->"]("hop2");
      me.view["="]("m", "hop1.v * 2");
      assert.equal(me("view.m"), 2);
      me.hop2["->"]("data.d");
      me.data.d.v(6);
      me.data.c.v(7);
      assert.equal(me("view.m"), 12);
    },
  },
  {
    name: "pointer into a secret scope: target write recomputes; explain still names only the literal path",
    run(mode) {
      const me = fresh(mode);
      me.vault["_"]("vault-door-01");
      me.vault.x(3);
      me.pick["->"]("vault");
      me.view["="]("n", "pick.x * 2");
      assert.equal(me("view.n"), 6);
      me.vault.x(4);
      assert.equal(me("view.n"), 8);
      assert.deepEqual(me.explain("view.n").meta.dependsOn, ["pick.x"]);
    },
  },
  {
    name: "cycles do not hang: pointer cycle reads nothing until broken; a formula reaching itself fails closed",
    run(mode) {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--cycle-child", mode], {
        timeout: 20000,
        encoding: "utf8",
      });
      assert.equal(child.error, undefined, `cycle child did not finish: ${child.error}`);
      assert.equal(child.status, 0, `cycle child failed:\n${child.stderr}`);
      const r = JSON.parse(child.stdout.trim().split("\n").pop()!);
      assert.equal(r.ptrCycleValue, null);
      assert.equal(r.ptrCycleReason, "missing-input");
      assert.equal(r.ptrCycleAfterWrites, null);
      assert.equal(r.ptrCycleBroken, 6);
      assert.equal(r.selfOk, 2);
      assert.equal(r.selfLoop, null);
      assert.equal(r.selfLoopReason, "cycle");
      assert.equal(r.selfOkAfter, 6);
      assert.equal(r.selfLoopAfter, null);
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
console.log("\nall pointer cases passed");
