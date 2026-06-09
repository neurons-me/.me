import assert from "node:assert/strict";
import sha3 from "js-sha3";
import ThisMe from "../dist/index.js";

const { keccak256 } = sha3;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("identity derives the documented compound seed", () => {
  const me = ThisMe("ana", "secret");

  const seed = keccak256("me.seed/compound:v1::ana::secret");
  const identityHash = keccak256("this.me/identity:v1::" + seed);

  assert.deepEqual(me["!"].identity(), {
    hash: identityHash,
    expression: "ana",
  });
});

test("kernel callable reseed uses the same compound seed", () => {
  const me = ThisMe();
  me("ana", "secret");

  const same = ThisMe("ana", "secret");
  const constructed = new ThisMe.ME("ana", "secret");

  assert.deepEqual(me["!"].identity(), same["!"].identity());
  assert.deepEqual(constructed["!"].identity(), same["!"].identity());
});

test("semantic tree reads, private branch reads, and links work", () => {
  const me = ThisMe("suign", "secret");
  me.name("Sui Gn");
  me.bio("Building the semantic web.");
  me.wallet["_"]("wallet-key-2026");
  me.wallet.balance(12480);

  me.people.ana.name("Ana");
  me.people.ana.age(24);
  me.people.pablo.name("Pablo");
  me.people.pablo.age(17);
  me.people["[i]"]["="]("isAdult", "age >= 18");

  me.users.ana.name("Ana");
  me.friends.ana["->"]("users.ana");

  assert.equal(me("name"), "Sui Gn");
  assert.equal(me("wallet"), undefined);
  assert.equal(me("wallet.balance"), 12480);
  assert.equal(me("people.ana.isAdult"), true);
  assert.equal(me("people.pablo.isAdult"), false);
  assert.equal(me("friends.ana.name"), "Ana");
});

test("privacy example keeps encrypted root hidden", () => {
  const me = ThisMe();

  me.secrets["_"]("private-key-2026");
  me.secrets.notes("Only I can see this.");
  me.name("Public Name");

  assert.equal(me("secrets"), undefined);
  assert.equal(me("secrets.notes"), "Only I can see this.");
  assert.equal(me("name"), "Public Name");
});

test("reactivity and explainability example recomputes total", () => {
  const me = ThisMe();

  me.order.price(100);
  me.order.quantity(5);
  me.order["="]("total", "price * quantity");
  me.order.price(200);

  const trace = me.explain("order.total");

  assert.equal(me("order.total"), 1000);
  assert.equal(trace.value, 1000);
  assert.equal(trace.expr, "price * quantity");
  assert.deepEqual(trace.meta.dependsOn, ["order.price", "order.quantity"]);
});

test("search examples return the nearest encrypted vector", () => {
  const me = ThisMe();

  me.memory.episodic["_"]("search-key");
  me.memory.episodic[0]({
    id: 0,
    embedding: [1, 0],
    text: "semantic web",
  });
  me.memory.episodic[1]({
    id: 1,
    embedding: [0, 1],
    text: "robotics",
  });

  const exact = me.searchExact("memory.episodic", [1, 0], { k: 1 });
  assert.equal(exact.hits[0].path, "memory.episodic.0");

  const build = me.buildVectorIndex("memory.episodic", { k: 2, nprobe: 1 });
  assert.equal(build.totalVectors, 2);

  const approx = me.searchVector("memory.episodic", [1, 0], { k: 1, nprobe: 1 });
  assert.equal(approx.hits[0].path, "memory.episodic.0");
});

test("snapshot and replay example restores state", () => {
  const me = ThisMe();
  me.name("Sui Gn");

  const snapshot = me.exportSnapshot();
  const restored = ThisMe();
  restored.hydrate(snapshot);

  assert.equal(restored("name"), "Sui Gn");
});

test("audience seed example is order independent", () => {
  function audienceSeed(seeds) {
    return keccak256("me.seed/audience:v1::" + [...seeds].sort().join("::"));
  }

  assert.equal(
    audienceSeed(["frank-seed", "ana-seed"]),
    audienceSeed(["ana-seed", "frank-seed"]),
  );
});
