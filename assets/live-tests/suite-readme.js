/*! live-tests suite: README examples · verbatim port of Typescript/tests/readme.examples.test.mjs · MIT · neurons.me
 * Each case returns what it observed (page addition, for the result panel); the assertions are the test's own. */
(function (root) {
  // the 8 examples, verbatim from readme.examples.test.mjs (each returns what it observed, for the panel) ------
  var CASES = [
    ["identity derives the documented compound seed", function (ThisMe, keccak256, assert) {
  const me = ThisMe("ana", "secret");

  const seed = keccak256("me.seed/compound:v1::ana::secret");
  const identityHash = keccak256("this.me/identity:v1::" + seed);

  assert.deepEqual(me["!"].identity(), {
    hash: identityHash,
    expression: "ana",
  });
  return { identity: me["!"].identity() };
    }],
    ["kernel callable reseed uses the same compound seed", function (ThisMe, keccak256, assert) {
  const me = ThisMe();
  me("ana", "secret");

  const same = ThisMe("ana", "secret");
  const constructed = new ThisMe.ME("ana", "secret");

  assert.deepEqual(me["!"].identity(), same["!"].identity());
  assert.deepEqual(constructed["!"].identity(), same["!"].identity());
  return { reseeded: me["!"].identity(), constructed: constructed["!"].identity() };
    }],
    ["semantic tree reads, private branch reads, and links work", function (ThisMe, keccak256, assert) {
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
  return { name: me("name"), wallet: me("wallet"), "wallet.balance": me("wallet.balance"), "people.ana.isAdult": me("people.ana.isAdult"), "people.pablo.isAdult": me("people.pablo.isAdult"), "friends.ana.name": me("friends.ana.name") };
    }],
    ["privacy example keeps encrypted root hidden", function (ThisMe, keccak256, assert) {
  const me = ThisMe();

  me.secrets["_"]("private-key-2026");
  me.secrets.notes("Only I can see this.");
  me.name("Public Name");

  assert.equal(me("secrets"), undefined);
  assert.equal(me("secrets.notes"), "Only I can see this.");
  assert.equal(me("name"), "Public Name");
  return { secrets: me("secrets"), "secrets.notes": me("secrets.notes"), name: me("name") };
    }],
    ["reactivity and explainability example recomputes total", function (ThisMe, keccak256, assert) {
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
  return { "order.total": me("order.total"), trace: { value: trace.value, expr: trace.expr, dependsOn: trace.meta.dependsOn } };
    }],
    ["search examples return the nearest encrypted vector", function (ThisMe, keccak256, assert) {
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
  return { exact: exact.hits[0], totalVectors: build.totalVectors, approx: approx.hits[0] };
    }],
    ["snapshot and replay example restores state", function (ThisMe, keccak256, assert) {
  const me = ThisMe();
  me.name("Sui Gn");

  const snapshot = me.exportSnapshot();
  const restored = ThisMe();
  restored.hydrate(snapshot);

  assert.equal(restored("name"), "Sui Gn");
  return { "restored.name": restored("name") };
    }],
    ["audience seed example is order independent", function (ThisMe, keccak256, assert) {
  function audienceSeed(seeds) {
    return keccak256("me.seed/audience:v1::" + [...seeds].sort().join("::"));
  }

  assert.equal(
    audienceSeed(["frank-seed", "ana-seed"]),
    audienceSeed(["ana-seed", "frank-seed"]),
  );
  return { seed: audienceSeed(["frank-seed", "ana-seed"]) };
    }],
  ];
  var cases = CASES.map(function (e) {
    var src = e[1].toString(), body = src.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    var lines = body.split("\n").filter(function (l) { return !/^\s*return \{/.test(l); });
    return { name: e[0], fn: e[1], code: lines.join("\n").replace(/^\s*\n|\s+$/g, "") };
  });
  root.LiveSuites = Object.assign(root.LiveSuites || {}, { readme: { source: "readme.examples.test.mjs", cases: cases } });
})(window);
