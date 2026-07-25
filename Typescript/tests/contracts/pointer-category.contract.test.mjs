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

test("fixed: a 3-node cycle fails closed instead of overflowing the call stack", () => {
  const me = new ME();
  me.cyc3.a["->"]("cyc3.b");
  me.cyc3.b["->"]("cyc3.c");
  me.cyc3.c["->"]("cyc3.a");

  // resolveIndexPointerPath (core-index.ts) now tracks a per-call `visited`
  // set of the pointer edges it has already followed, keyed by the path
  // that OWNS the pointer (not by curPath). Redirecting through the same
  // edge a second time — which is exactly what a cycle does — is detected
  // and stopped inside a single bounded loop, regardless of cycle length or
  // maxHops parity. The old behavior only failed closed for even-length
  // cycles by accident, because curPath happened to land back on the exact
  // starting path within the 8-hop budget; odd-length cycles (e.g. 3) never
  // landed back on the original path, so the outer recursion in core.ts's
  // readPath kept re-arming a fresh budget with no shared cycle memory,
  // and the JS call stack overflowed instead of the read failing closed.
  assert.doesNotThrow(() => me("cyc3.a.value"));
  assert.equal(me("cyc3.a.value"), undefined);
});

test("a 5-node and a 7-node cycle both fail closed (odd lengths were the failure case pre-fix)", () => {
  const me5 = new ME();
  me5.a["->"]("b");
  me5.b["->"]("c");
  me5.c["->"]("d");
  me5.d["->"]("e");
  me5.e["->"]("a");
  assert.doesNotThrow(() => me5("a.value"));
  assert.equal(me5("a.value"), undefined);

  const me7 = new ME();
  const nodes = ["a", "b", "c", "d", "e", "f", "g"];
  for (let i = 0; i < nodes.length; i++) {
    me7[nodes[i]]["->"](nodes[(i + 1) % nodes.length]);
  }
  assert.doesNotThrow(() => me7("a.value"));
  assert.equal(me7("a.value"), undefined);
});

test("a tail leading into a cycle (x -> a -> b -> c -> a) fails closed without throwing", () => {
  const me = new ME();
  me.x["->"]("a");
  me.a["->"]("b");
  me.b["->"]("c");
  me.c["->"]("a");

  assert.doesNotThrow(() => me("x.value"));
  assert.equal(me("x.value"), undefined);
});
