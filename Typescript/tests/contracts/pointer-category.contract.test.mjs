import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";

// Pointer composition, identity, and fuel-boundary contracts.
//
// These behaviors were never asserted anywhere in the existing suite before
// this file: every prior use of `__`/`->` (axioms.test.ts A4, the demos) is a
// single hop. This file exercises multi-hop chains, self-pointers, and
// cycles directly against the real kernel (no mock) to pin down what the
// resolver actually does — not what a formal model of it would predict.

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    throw err;
  }
}

console.log("\n### Pointer Category Contract Tests");

test("a 3-hop chain resolves transitively; a direct read stops at the first pointer marker", () => {
  const me = new ME();
  me.chain.a["->"]("chain.b");
  me.chain.b["->"]("chain.c");
  me.chain.c.value(42);

  assert.deepEqual(me("chain.a"), { __ptr: "chain.b" });
  assert.equal(me("chain.a.value"), 42);
  assert.equal(me("chain.b.value"), 42);
});

test("a self-pointer is not an identity: suffix reads fail closed instead of resolving", () => {
  const me = new ME();
  me.loop.a["->"]("loop.a");

  assert.deepEqual(me("loop.a"), { __ptr: "loop.a" });
  assert.equal(me("loop.a.value"), undefined);
});

test("a 2-node cycle fails closed on suffix reads without throwing", () => {
  const me = new ME();
  me.cyc2.a["->"]("cyc2.b");
  me.cyc2.b["->"]("cyc2.a");

  assert.equal(me("cyc2.a.value"), undefined);
  assert.equal(me("cyc2.b.value"), undefined);
});

test("a chain longer than the internal 8-hop budget still resolves — fuel is a local per-call budget, not a global chain-length ceiling", () => {
  const me = new ME();
  const HOPS = 12; // intentionally > maxHops in core-index.ts's resolveIndexPointerPath

  for (let i = 0; i < HOPS; i++) {
    me["long" + i]["->"]("long" + (i + 1));
  }
  me["long" + HOPS].value(999);

  assert.equal(me("long0.value"), 999);
});

test("known defect: 3-node pointer cycle overflows the call stack", () => {
  const me = new ME();
  me.cyc3.a["->"]("cyc3.b");
  me.cyc3.b["->"]("cyc3.c");
  me.cyc3.c["->"]("cyc3.a");

  // This is NOT desired behavior. It documents the current resolver gap
  // until cycle detection is fixed — it is not a specification of how
  // .me should behave.
  //
  // Why it happens: with maxHops=8 (even) and a 2-cycle, curPath lands
  // back on the exact original path inside a single resolveIndexPointerPath
  // call, so core.ts's readPath sees samePath===true and returns undefined
  // without recursing (see "a 2-node cycle fails closed" above — that is a
  // benign accident of parity, not a designed guarantee). With a 3-cycle,
  // 8 hops never land back on the original path (8 mod 3 !== 0), so
  // `if (!samePath) return self.readPath(resolved.path)` fires — and each
  // recursive call rearms its own fresh 8-hop budget, with no cycle
  // detection carried across recursive calls. The recursion does not
  // terminate; the JS call stack does.
  //
  // TODO(pointer-resolver): once the resolver carries cycle detection
  // across recursive self.readPath calls, replace this assertion with:
  //   assert.doesNotThrow(() => me("cyc3.a.value"));
  //   assert.equal(me("cyc3.a.value"), undefined);
  assert.throws(() => me("cyc3.a.value"), RangeError);
});
