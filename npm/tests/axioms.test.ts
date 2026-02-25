/// <reference types="node" />
import assert from "node:assert/strict";
import ME from "this.me";

type MEProxy = any;
type Thought = {
  path: string;
  operator: string | null;
  expression: any;
  value: any;
  effectiveSecret: string;
  hash: string;
  prevHash?: string;
  timestamp: number;
};

type AxiomCase = {
  id: string;
  title: string;
  challenge: string;
  resolution: string;
  checks: string[];
  run: (me: MEProxy) => void;
  proofs?: (me: MEProxy) => Array<{ label: string; expected: any; actual: any }>;
};

function getSTM(me: MEProxy): Thought[] {
  const v = (me as any).shortTermMemory ?? (me as any)._shortTermMemory;
  return Array.isArray(v) ? v : [];
}

function assertStealthRoot(me: MEProxy, scope: string) {
  assert.equal(me(scope), undefined, `expected stealth root for scope '${scope}'`);
}

function assertIndexDoesNotExposePrefix(me: MEProxy, prefix: string) {
  const keys = Object.keys(((me as any).index) || {});
  for (const k of keys) {
    assert.ok(!k.startsWith(prefix), `index should not expose '${prefix}', but saw key '${k}'`);
  }
}

function shouldBeValidUsername(id: string) {
  const s = id.trim().toLowerCase();
  if (s.length < 3 || s.length > 63) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) return false;
  if (s.includes("--")) return false;
  return true;
}

function assertCallable(me: any) {
  assert.equal(typeof me, "function", "expected ME instance to be callable (Proxy function)");
}

function findLastThought(me: MEProxy, pred: (t: Thought) => boolean): Thought | undefined {
  const stm = getSTM(me);
  for (let i = stm.length - 1; i >= 0; i--) {
    if (pred(stm[i])) return stm[i];
  }
  return undefined;
}

function assertHasRootClaim(me: MEProxy, expected: string) {
  const claim = findLastThought(me, (t) => t.path === "" && t.operator === "@");
  assert.ok(claim, "expected an @ claim thought at root");
  const v =
    (claim!.value && claim!.value.__id) ||
    (claim!.expression && claim!.expression.__id) ||
    claim!.value;
  assert.equal(v, expected, "expected @ claim to store normalized username");
}

function dumpIfVerbose(me: MEProxy, title: string) {
  if (process.env.AXIOMS_VERBOSE !== "1") return;
  console.log("\n--- " + title + " ---");
  console.log("last thoughts:", getSTM(me).slice(-8));
  console.log("index keys:", Object.keys(((me as any).index) || {}));
  console.log("encryptedBranches keys:", Object.keys(((me as any).encryptedBranches) || {}));
}

function fmt(value: any): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "function") return "[Function]";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hashFn(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

const axioms: AxiomCase[] = [
  {
    id: "A-struct-0",
    title: "ME is callable and supports navigable chaining",
    challenge: "Can one runtime value be both executable and infinitely navigable without collapsing either behavior?",
    resolution: "Proxy traps preserve function-call semantics while extending unknown properties as semantic path continuations.",
    checks: [
      "ME instance is callable (Proxy function)",
      "Property chaining returns callable proxies",
      "Leaf invocation remains chainable",
      "Path read does not throw",
    ],
    run(me) {
      assertCallable(me);
      const p1 = me.profile;
      const p2 = me.profile.name;
      assert.equal(typeof p1, "function");
      assert.equal(typeof p2, "function");
      const out = me.profile.name("Abella");
      assert.ok(out, "expected a return value for chaining");
      assert.doesNotThrow(() => me("profile.name"));
    },
    proofs(me) {
      return [
        { label: "typeof me", expected: "function", actual: typeof me },
        { label: "typeof me.profile", expected: "function", actual: typeof me.profile },
        { label: "me('profile.name')", expected: "Abella", actual: me("profile.name") },
      ];
    },
  },
  {
    id: "A0",
    title: "Root stays public; secret scope root stays stealth",
    challenge: "Can a subtree be readable internally while its existence is hidden at the scope boundary?",
    resolution: "Writes under secret scopes are stored in encrypted branch blobs; scope roots resolve to undefined by design.",
    checks: [
      "Public ledger values are readable",
      "Secret root returns undefined",
      "Secret leaf remains readable",
      "Public index does not leak secret prefixes",
      "Encrypted branch exists for secret scope",
    ],
    run(me) {
      me["@"]("jabellae");
      me.ledger.host("localhost:8161");
      me.ledger.protocol("http");
      me.wallet["_"]("secret");
      me.wallet.income(100);
      dumpIfVerbose(me, "A0");

      assert.equal(me("ledger.host"), "localhost:8161");
      assert.equal(me("ledger.protocol"), "http");
      assertStealthRoot(me, "wallet");
      assert.equal(me("wallet.income"), 100);
      assertIndexDoesNotExposePrefix(me, "wallet");
      assertIndexDoesNotExposePrefix(me, "wallet.");
      assert.ok((((me as any).encryptedBranches) || {})["wallet"], "expected encryptedBranches['wallet']");
    },
    proofs(me) {
      return [
        { label: "me('ledger.host')", expected: "localhost:8161", actual: me("ledger.host") },
        { label: "me('wallet')", expected: undefined, actual: me("wallet") },
        { label: "me('wallet.income')", expected: 100, actual: me("wallet.income") },
      ];
    },
  },
  {
    id: "A1",
    title: "'@' validates username semantics and records root claim",
    challenge: "Can identity claims be normalized and bounded so invalid labels never enter state?",
    resolution: "Username grammar is validated and normalized before commit; valid claims append an explicit root '@' thought.",
    checks: [
      "Valid username accepted",
      "Mixed-case username is normalized",
      "Invalid usernames throw",
      "Root claim thought is recorded",
    ],
    run(me) {
      const ok = "jabellae";
      assert.ok(shouldBeValidUsername(ok), "expected helper to accept a valid username");
      me["@"](ok);
      assertHasRootClaim(me, ok);

      me["@"]("Abella");
      assertHasRootClaim(me, "abella");

      const bad = ["a_b", "-aaa", "aaa-", "a..b", "a b", "á", "A", "", "aa", "a--b", "a", "ab"];
      for (const b of bad) {
        assert.ok(!shouldBeValidUsername(b), `test expects '${b}' to be invalid`);
        assert.throws(() => me["@"](b), `expected me['@'] to throw for invalid username '${b}'`);
      }
    },
    proofs(me) {
      const claim = findLastThought(me, (t) => t.path === "" && t.operator === "@");
      const claimId =
        (claim?.value && claim.value.__id) ||
        (claim?.expression && claim.expression.__id) ||
        claim?.value;
      return [
        { label: "normalized claim __id", expected: "abella", actual: claimId },
        { label: "last root claim operator", expected: "@", actual: findLastThought(me, (t) => t.path === "")?.operator },
      ];
    },
  },
  {
    id: "A2",
    title: "'_' creates a secret scope with stealth root semantics",
    challenge: "Can secret declaration alter storage semantics structurally, not by global toggle?",
    resolution: "The '_' operator binds secrecy to a concrete path; descendants are encrypted while public index excludes that prefix.",
    checks: [
      "Secret scope root is hidden",
      "Leaves under secret scope remain readable",
      "Public index does not expose secret subtree",
    ],
    run(me) {
      me["@"]("jabellae");
      me.profile.kind("public-profile");
      me.profile["_"]("alpha");
      me.profile.name("Abella");
      me.profile.city("Veracruz");
      dumpIfVerbose(me, "A2");

      assertStealthRoot(me, "profile");
      assert.equal(me("profile.name"), "Abella");
      assert.equal(me("profile.city"), "Veracruz");
      assertIndexDoesNotExposePrefix(me, "profile");
    },
    proofs(me) {
      return [
        { label: "me('profile')", expected: undefined, actual: me("profile") },
        { label: "me('profile.name')", expected: "Abella", actual: me("profile.name") },
        { label: "me('profile.city')", expected: "Veracruz", actual: me("profile.city") },
      ];
    },
  },
  {
    id: "A3",
    title: "'~' resets inheritance and allows new secret chain",
    challenge: "Can key derivation be discontinuous at a chosen boundary to prevent upstream inheritance?",
    resolution: "Noise seeds a new derivation root; post-noise secret chaining produces a distinct effective secret lineage.",
    checks: [
      "Pre-noise and post-noise writes use different effective secrets",
      "Scope root remains stealth",
      "Post-noise leaf read succeeds",
    ],
    run(me) {
      me["@"]("jabellae");
      me.wallet["_"]("alpha");
      me.wallet.hidden.notes("alpha-note");
      const alphaThought = findLastThought(me, (t) => t.path === "wallet.hidden.notes");
      assert.ok(alphaThought, "expected alpha thought");

      me.wallet["~"]("noise");
      me.wallet["_"]("beta");
      me.wallet.hidden.seed("beta-seed");
      const betaThought = findLastThought(me, (t) => t.path === "wallet.hidden.seed");
      assert.ok(betaThought, "expected beta thought");
      dumpIfVerbose(me, "A3");

      assert.notEqual(alphaThought!.effectiveSecret, betaThought!.effectiveSecret);
      assertStealthRoot(me, "wallet");
      assert.equal(me("wallet.hidden.seed"), "beta-seed");
    },
    proofs(me) {
      const alphaThought = findLastThought(me, (t) => t.path === "wallet.hidden.notes");
      const betaThought = findLastThought(me, (t) => t.path === "wallet.hidden.seed");
      return [
        {
          label: "effectiveSecret(alpha) !== effectiveSecret(beta)",
          expected: true,
          actual: alphaThought?.effectiveSecret !== betaThought?.effectiveSecret,
        },
        { label: "me('wallet')", expected: undefined, actual: me("wallet") },
        { label: "me('wallet.hidden.seed')", expected: "beta-seed", actual: me("wallet.hidden.seed") },
      ];
    },
  },
  {
    id: "A4",
    title: "'__' pointer is structural and traversable",
    challenge: "Can references remain first-class data while still enabling deep dereference reads?",
    resolution: "Direct pointer reads return {__ptr}; nested reads resolve pointer prefixes to target paths before value lookup.",
    checks: [
      "Direct pointer read returns pointer object",
      "Pointer traversal resolves target leaves",
      "Target secret scope root remains stealth",
    ],
    run(me) {
      me["@"]("jabellae");
      me.wallet["_"]("secret");
      me.wallet.income(1000);
      me.wallet.expenses.rent(500);
      me.profile.cards.primary["__"]("wallet");
      dumpIfVerbose(me, "A4");

      assert.deepEqual(me("profile.cards.primary"), { __ptr: "wallet" });
      assert.equal(me("profile.cards.primary.income"), 1000);
      assert.equal(me("profile.cards.primary.expenses.rent"), 500);
      assertStealthRoot(me, "wallet");
      assertIndexDoesNotExposePrefix(me, "wallet");
    },
    proofs(me) {
      return [
        { label: "me('profile.cards.primary')", expected: { __ptr: "wallet" }, actual: me("profile.cards.primary") },
        { label: "me('profile.cards.primary.income')", expected: 1000, actual: me("profile.cards.primary.income") },
        { label: "me('profile.cards.primary.expenses.rent')", expected: 500, actual: me("profile.cards.primary.expenses.rent") },
      ];
    },
  },
  {
    id: "A5",
    title: "'?' collect records collect thought and keeps scope stealth",
    challenge: "Can query/collect be observable as a state event without leaking secret scope boundaries?",
    resolution: "Collect emits a '?' thought at scope path while secret-root read semantics remain unchanged (undefined at root).",
    checks: [
      "Collect call returns a function",
      "Collect thought is recorded at path with '?' operator",
      "Secret root remains stealth",
    ],
    run(me) {
      me["@"]("jabellae");
      me.profile["_"]("alpha");
      me.profile.name("Abella");
      me.profile.city("Veracruz");
      const pickedProfile = me.profile["?"]("name", "city");
      dumpIfVerbose(me, "A5");

      assert.equal(typeof pickedProfile, "function");
      const collect = findLastThought(me, (t) => t.path === "profile" && t.operator === "?");
      assert.ok(collect, "expected a '?' collect thought at path 'profile'");
      assertStealthRoot(me, "profile");
      assert.equal(me("profile.name"), "Abella");
    },
    proofs(me) {
      const collect = findLastThought(me, (t) => t.path === "profile" && t.operator === "?");
      return [
        { label: "last collect operator", expected: "?", actual: collect?.operator },
        { label: "me('profile')", expected: undefined, actual: me("profile") },
        { label: "me('profile.name')", expected: "Abella", actual: me("profile.name") },
      ];
    },
  },
  {
    id: "A6",
    title: "'-' remove tombstones a path",
    challenge: "Can deletion be logically irreversible at read-time while preserving auditability?",
    resolution: "Remove writes a '-' operation thought and prunes branch visibility so prior cleartext no longer resolves.",
    checks: [
      "Original value exists before remove",
      "After remove, read is no longer original cleartext",
    ],
    run(me) {
      me["@"]("jabellae");
      me.wallet["_"]("secret");
      me.wallet.hidden.notes("private note");
      assert.equal(me("wallet.hidden.notes"), "private note");
      me.wallet.hidden["-"]("notes");
      dumpIfVerbose(me, "A6");

      const v = me("wallet.hidden.notes");
      assert.ok(
        v === null ||
          v === undefined ||
          v === "-" ||
          (typeof v === "object" && v !== null && (v as any).__tombstone === true),
        "expected removed value to no longer be the original"
      );
    },
    proofs(me) {
      return [
        { label: "me('wallet.hidden.notes') !== 'private note'", expected: true, actual: me("wallet.hidden.notes") !== "private note" },
      ];
    },
  },
  {
    id: "A7",
    title: "Returning to public after secret/noise keeps public ledger readable",
    challenge: "Can public and secret universes coexist so private transitions never corrupt public determinism?",
    resolution: "Public index is rebuilt from non-secret visibility rules; encrypted branches persist independently from public ledger paths.",
    checks: [
      "Public ledger values remain readable",
      "Secret scope root stays stealth",
      "Encrypted branch persists for secret scope",
    ],
    run(me) {
      me["@"]("jabellae");
      me.ledger.host("localhost:8161");
      me.ledger.protocol("http");
      me.profile["_"]("alpha");
      me.profile.name("Abella");
      me.profile["~"]("noise");
      me.profile["_"]("beta");
      me.profile.hidden.seed("beta-seed");
      me.ledger.status("ok");
      dumpIfVerbose(me, "A7");

      assert.equal(me("ledger.host"), "localhost:8161");
      assert.equal(me("ledger.protocol"), "http");
      assert.equal(me("ledger.status"), "ok");
      assertStealthRoot(me, "profile");
      assert.ok((((me as any).encryptedBranches) || {})["profile"], "expected encryptedBranches['profile']");
    },
    proofs(me) {
      return [
        { label: "me('ledger.host')", expected: "localhost:8161", actual: me("ledger.host") },
        { label: "me('ledger.protocol')", expected: "http", actual: me("ledger.protocol") },
        { label: "me('ledger.status')", expected: "ok", actual: me("ledger.status") },
        { label: "me('profile')", expected: undefined, actual: me("profile") },
      ];
    },
  },
  {
    id: "A8",
    title: "Hash-chain tamper evidence",
    challenge: "Can history be tamper-evident without a central authority?",
    resolution: "Each thought carries prevHash and hashes (path, operator, expression, value, effectiveSecret, prevHash).",
    checks: [
      "Genesis thought has prevHash=''",
      "Every thought links prevHash to previous hash",
      "Recomputed hash for every thought matches stored hash",
    ],
    run(me) {
      me["@"]("jabellae");
      me.ledger.host("localhost:8161");
      me.ledger.protocol("http");
      me.wallet["_"]("secret");
      me.wallet.balance(1000);
      dumpIfVerbose(me, "A8");

      const stm = getSTM(me);
      assert.ok(stm.length >= 5, "expected enough thoughts for hash-chain validation");

      for (let i = 0; i < stm.length; i++) {
        const t = stm[i];
        const expectedPrev = i === 0 ? "" : stm[i - 1].hash;
        assert.equal(t.prevHash ?? "", expectedPrev, `prevHash mismatch at thought #${i}`);
        const expectedHash = hashFn(
          JSON.stringify({
            path: t.path,
            operator: t.operator,
            expression: t.expression,
            value: t.value,
            effectiveSecret: t.effectiveSecret,
            prevHash: t.prevHash ?? "",
          })
        );
        assert.equal(t.hash, expectedHash, `hash mismatch at thought #${i}`);
      }
    },
    proofs(me) {
      const stm = getSTM(me);
      const firstPrevOk = (stm[0]?.prevHash ?? "") === "";
      const linksOk = stm.every((t, i) => (t.prevHash ?? "") === (i === 0 ? "" : stm[i - 1].hash));
      const hashOk = stm.every((t) => {
        const expectedHash = hashFn(
          JSON.stringify({
            path: t.path,
            operator: t.operator,
            expression: t.expression,
            value: t.value,
            effectiveSecret: t.effectiveSecret,
            prevHash: t.prevHash ?? "",
          })
        );
        return t.hash === expectedHash;
      });
      return [
        { label: "genesis prevHash is empty", expected: true, actual: firstPrevOk },
        { label: "prevHash chain continuity", expected: true, actual: linksOk },
        { label: "hash recomputation integrity", expected: true, actual: hashOk },
      ];
    },
  },
  {
    id: "A9",
    title: "Deterministic LWW (timestamp, then hash)",
    challenge: "If two writers collide on the same path, can every node converge to one deterministic truth?",
    resolution: "Index rebuild is ordered by (timestamp asc, hash asc); winner is last write in that deterministic order.",
    checks: [
      "Higher timestamp wins for same path",
      "When timestamps tie, higher hash wins",
      "Read-path and index converge to same winner",
    ],
    run(me) {
      const originalNow = Date.now;
      try {
        // Case 1: higher timestamp wins.
        (Date as any).now = () => 1000;
        me.wallet.balance(10);
        (Date as any).now = () => 2000;
        me.wallet.balance(20);

        // Case 2: tie timestamp, hash tiebreak.
        (Date as any).now = () => 3000;
        me.wallet.balance(111);
        me.wallet.balance(222);
      } finally {
        (Date as any).now = originalNow;
      }

      (me as any).rebuildIndex();
      dumpIfVerbose(me, "A9");

      const stm = getSTM(me).filter((t) => t.path === "wallet.balance" && t.operator === null);
      assert.ok(stm.length >= 4, "expected at least four wallet.balance thoughts");
      const lastTwoTie = stm.slice(-2);
      assert.equal(lastTwoTie[0].timestamp, lastTwoTie[1].timestamp, "expected tie timestamp case");

      const expectedTieWinner = lastTwoTie[0].hash > lastTwoTie[1].hash ? lastTwoTie[0] : lastTwoTie[1];
      assert.deepEqual(me("wallet.balance"), expectedTieWinner.value);
      assert.deepEqual(((me as any).index || {})["wallet.balance"], expectedTieWinner.value);
    },
    proofs(me) {
      const stm = getSTM(me).filter((t) => t.path === "wallet.balance" && t.operator === null);
      const firstTwo = stm.slice(0, 2);
      const tieTwo = stm.slice(-2);
      const tsWinnerValue = firstTwo[0].timestamp > firstTwo[1].timestamp ? firstTwo[0].value : firstTwo[1].value;
      const tieWinner = tieTwo[0].hash > tieTwo[1].hash ? tieTwo[0] : tieTwo[1];
      return [
        { label: "timestamp winner value", expected: 20, actual: tsWinnerValue },
        { label: "tie winner by hash equals read", expected: tieWinner.value, actual: me("wallet.balance") },
        { label: "index equals read winner", expected: tieWinner.value, actual: ((me as any).index || {})["wallet.balance"] },
      ];
    },
  },
];

const results: Array<{ id: string; title: string; ok: boolean; error?: unknown }> = [];

console.log("\n========================================================");
console.log(".me AXIOMS FIRE TEST");
console.log("========================================================");

for (const axiom of axioms) {
  console.log(`\n--- ${axiom.id}: ${axiom.title} ---`);
  console.log(`   Logical challenge: ${axiom.challenge}`);
  console.log(`   Resolution rule: ${axiom.resolution}`);
  for (const check of axiom.checks) {
    console.log(`   • ${check}`);
  }
  try {
    const me = new (ME as any)() as MEProxy;
    axiom.run(me);
    if (axiom.proofs) {
      console.log("   Proof:");
      for (const p of axiom.proofs(me)) {
        assert.deepEqual(p.actual, p.expected);
        console.log(`   - ${p.label}: expected=${fmt(p.expected)} returned=${fmt(p.actual)} -> OK`);
      }
    }
    console.log(`✅ ${axiom.id} PASS`);
    results.push({ id: axiom.id, title: axiom.title, ok: true });
  } catch (error) {
    console.error(`❌ ${axiom.id} FAIL`);
    console.error(error instanceof Error ? error.message : error);
    results.push({ id: axiom.id, title: axiom.title, ok: false, error });
  }
}

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

console.log("\n========================================================");
console.log(`AXIOMS SUMMARY: ${passed}/${results.length} passed`);
if (failed > 0) {
  console.log(`FAILED: ${failed}`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(` - ${r.id}: ${r.title}`);
  }
  process.exitCode = 1;
} else {
  console.log("STATUS: ALL AXIOMS PASSED");
}
console.log("========================================================\n");

export {};
