/*! live-tests suite: axioms · verbatim port of Typescript/tests/axioms.test.ts · MIT · neurons.me
 * The helpers and the axioms array are the test file's own (TypeScript types removed; AXIOMS_VERBOSE dump is a no-op
 * in the browser). Each case does what the Node runner does: new ME(), axiom.run(me), then every proof is
 * assert.deepEqual(actual, expected). Rust twin: Rust/tests/axioms_contract.rs.
 */
(function (root) {
  var assert; // node:assert/strict equivalent (live-tests.js), bound when a case runs

function getSTM(me) {
  const v = me._memories ?? me.memories;
  return Array.isArray(v) ? v : [];
}

function assertStealthRoot(me, scope) {
  assert.equal(me(scope), undefined, `expected stealth root for scope '${scope}'`);
}

function assertIndexDoesNotExposePrefix(me, prefix) {
  const keys = Object.keys((me.index) || {});
  for (const k of keys) {
    assert.ok(!k.startsWith(prefix), `index should not expose '${prefix}', but saw key '${k}'`);
  }
}

function shouldBeValidUsername(id) {
  const s = id.trim().toLowerCase();
  if (s.length < 3 || s.length > 63) return false;
  if (s.includes(".")) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s);
}

function assertCallable(me) {
  assert.equal(typeof me, "function", "expected ME instance to be callable (Proxy function)");
}

function findLastMemory(me, pred) {
  const stm = getSTM(me);
  for (let i = stm.length - 1; i >= 0; i--) {
    if (pred(stm[i])) return stm[i];
  }
  return undefined;
}

function assertHasRootClaim(me, expected) {
  const claim = findLastMemory(me, (t) => t.path === "" && t.operator === "@");
  assert.ok(claim, "expected an @ claim memory at root");
  const v =
    (claim.value && claim.value.__id) ||
    (claim.expression && claim.expression.__id) ||
    claim.value;
  assert.equal(v, expected, "expected @ claim to store normalized username");
}

function dumpIfVerbose(me, title) {
  return; // AXIOMS_VERBOSE console dump: Node only, a no-op here
  console.log("\n--- " + title + " ---");
  console.log("last memories:", getSTM(me).slice(-8));
  console.log("index keys:", Object.keys((me.index) || {}));
  console.log("encryptedBranches keys:", Object.keys((me.encryptedBranches) || {}));
}

function fmt(value) {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "function") return "[Function]";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hashFn(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

var axioms = [
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
      assert.ok(((me.encryptedBranches) || {})["wallet"], "expected encryptedBranches['wallet']");
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
    resolution: "Username grammar is validated and normalized before commit; valid claims append an explicit root '@' memory.",
    checks: [
      "Valid username accepted",
      "Mixed-case username is normalized",
      "Invalid usernames throw",
      "Root claim memory is recorded",
    ],
    run(me) {
      const ok = "jabellae";
      assert.ok(shouldBeValidUsername(ok), "expected helper to accept a valid username");
      me["@"](ok);
      assertHasRootClaim(me, ok);

      me["@"]("Abella");
      assertHasRootClaim(me, "abella");

      const bad = ["a_b", "-aaa", "aaa-", "a..b", "a.b", "a b", "á", "A", "", "aa", "a", "ab"];
      for (const b of bad) {
        assert.ok(!shouldBeValidUsername(b), `test expects '${b}' to be invalid`);
        assert.throws(() => me["@"](b), `expected me['@'] to throw for invalid username '${b}'`);
      }
    },
    proofs(me) {
      const claim = findLastMemory(me, (t) => t.path === "" && t.operator === "@");
      const claimId =
        (claim?.value && claim.value.__id) ||
        (claim?.expression && claim.expression.__id) ||
        claim?.value;
      return [
        { label: "normalized claim __id", expected: "abella", actual: claimId },
        { label: "last root claim operator", expected: "@", actual: findLastMemory(me, (t) => t.path === "")?.operator },
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
      const alphaMemory = findLastMemory(me, (t) => t.path === "wallet.hidden.notes");
      assert.ok(alphaMemory, "expected alpha memory");

      me.wallet["~"]("noise");
      me.wallet["_"]("beta");
      me.wallet.hidden.seed("beta-seed");
      const betaMemory = findLastMemory(me, (t) => t.path === "wallet.hidden.seed");
      assert.ok(betaMemory, "expected beta memory");
      dumpIfVerbose(me, "A3");

      assert.notEqual(alphaMemory.effectiveSecret, betaMemory.effectiveSecret);
      assertStealthRoot(me, "wallet");
      assert.equal(me("wallet.hidden.seed"), "beta-seed");
    },
    proofs(me) {
      const alphaMemory = findLastMemory(me, (t) => t.path === "wallet.hidden.notes");
      const betaMemory = findLastMemory(me, (t) => t.path === "wallet.hidden.seed");
      return [
        {
          label: "effectiveSecret(alpha) !== effectiveSecret(beta)",
          expected: true,
          actual: alphaMemory?.effectiveSecret !== betaMemory?.effectiveSecret,
        },
        { label: "me('wallet')", expected: undefined, actual: me("wallet") },
        { label: "me('wallet.hidden.seed')", expected: "beta-seed", actual: me("wallet.hidden.seed") },
      ];
    },
  },
  {
    id: "A3b",
    title: "Nested secret owner reads remain accessible",
    challenge: "Can the default owner still read through nested secret scopes without being blocked by ancestor stealth gates?",
    resolution: "Owner/default reads bypass guest stealth gating, so deeper secret scopes remain readable when the runtime owns the full tree.",
    checks: [
      "Ancestor secret root remains stealth",
      "Nested secret root remains stealth",
      "Leaf under nested secret stays readable for default owner",
      "Guest caller remains blocked",
    ],
    run(me) {
      me["@"]("jabellae");
      me.root["_"]("alpha");
      me.root.child["_"]("beta");
      me.root.child.leaf("x");
      dumpIfVerbose(me, "A3b");

      assertStealthRoot(me, "root");
      assertStealthRoot(me, "root.child");
      assert.equal(me("root.child.leaf"), "x");
      assert.equal(me.as(null)("root.child.leaf"), undefined);
    },
    proofs(me) {
      return [
        { label: "me('root')", expected: undefined, actual: me("root") },
        { label: "me('root.child')", expected: undefined, actual: me("root.child") },
        { label: "me('root.child.leaf')", expected: "x", actual: me("root.child.leaf") },
        { label: "me.as(null)('root.child.leaf')", expected: undefined, actual: me.as(null)("root.child.leaf") },
      ];
    },
  },
  {
    id: "A3c",
    title: "Nested secret plus same-node noise stays readable for owner",
    challenge: "Can a nested secret scope survive a same-node noise reset without the owner losing access to fresh writes?",
    resolution: "Noise changes effective lineage, but it must not trip owner stealth gating for descendants of the nested secret scope.",
    checks: [
      "Nested secret root remains stealth",
      "Leaf written after same-node noise reset is readable",
      "Guest caller remains blocked",
    ],
    run(me) {
      me["@"]("jabellae");
      me.root["_"]("alpha");
      me.root.child["_"]("beta");
      me.root.child["~"]("noise");
      me.root.child.leaf("x");
      dumpIfVerbose(me, "A3c");

      assertStealthRoot(me, "root.child");
      assert.equal(me("root.child.leaf"), "x");
      assert.equal(me.as(null)("root.child.leaf"), undefined);
    },
    proofs(me) {
      return [
        { label: "me('root.child')", expected: undefined, actual: me("root.child") },
        { label: "me('root.child.leaf')", expected: "x", actual: me("root.child.leaf") },
        { label: "me.as(null)('root.child.leaf')", expected: undefined, actual: me.as(null)("root.child.leaf") },
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
    title: "'?' collect records collect memory and keeps scope stealth",
    challenge: "Can query/collect be observable as a state event without leaking secret scope boundaries?",
    resolution: "Collect emits a '?' memory at scope path while secret-root read semantics remain unchanged (undefined at root).",
    checks: [
      "Collect call returns a function",
      "Collect memory is recorded at path with '?' operator",
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
      const collect = findLastMemory(me, (t) => t.path === "profile" && t.operator === "?");
      assert.ok(collect, "expected a '?' collect memory at path 'profile'");
      assertStealthRoot(me, "profile");
      assert.equal(me("profile.name"), "Abella");
    },
    proofs(me) {
      const collect = findLastMemory(me, (t) => t.path === "profile" && t.operator === "?");
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
    resolution: "Remove writes a '-' operation memory and prunes branch visibility so prior cleartext no longer resolves.",
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
          (typeof v === "object" && v !== null && (v).__tombstone === true),
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
      assert.ok(((me.encryptedBranches) || {})["profile"], "expected encryptedBranches['profile']");
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
    resolution: "Each memory carries prevHash and hashes (path, operator, expression, value, effectiveSecret, prevHash).",
    checks: [
      "Genesis memory has prevHash=''",
      "Every memory links prevHash to previous hash",
      "Recomputed hash for every memory matches stored hash",
    ],
    run(me) {
      me["@"]("jabellae");
      me.ledger.host("localhost:8161");
      me.ledger.protocol("http");
      me.wallet["_"]("secret");
      me.wallet.balance(1000);
      dumpIfVerbose(me, "A8");

      const stm = getSTM(me);
      assert.ok(stm.length >= 5, "expected enough memories for hash-chain validation");

      for (let i = 0; i < stm.length; i++) {
        const t = stm[i];
        const expectedPrev = i === 0 ? "" : stm[i - 1].hash;
        assert.equal(t.prevHash ?? "", expectedPrev, `prevHash mismatch at memory #${i}`);
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
        assert.equal(t.hash, expectedHash, `hash mismatch at memory #${i}`);
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
    title: "Deterministic LWW (logical seq, then hash; physical timestamp is for display only)",
    challenge: "If two writers collide on the same path, can every node converge to one deterministic truth — without a sequential write on ONE node ever losing to an earlier one just because they landed in the same millisecond?",
    resolution:
      "Every memory carries a monotonic per-instance logical clock (`seq`, a Lamport-style scalar counter) in addition to its physical `timestamp`. Index rebuild — and every live write, via the same shared comparator — is ordered by (seq asc, hash asc) whenever both sides being compared have a real seq; `timestamp` is kept on the record for display but is never consulted for ordering in that case. A write's seq is assigned once, at write time, and never revised — so two writes issued moments apart on the SAME process always resolve in that real order, immune to the physical clock (including it moving backward), and the hash tiebreak is reserved for what A9 actually describes: genuinely concurrent writers, not a single process's own sequential history. Entries persisted before `seq` existed (neither side has one) still resolve via the ORIGINAL (timestamp asc, hash asc) rule, unchanged, for full backward compatibility.",
    checks: [
      "A later write on a distinct timestamp wins",
      "Two SEQUENTIAL writes sharing the same physical timestamp still resolve in real (seq) order — the second one wins, not whichever has the higher hash",
      "Read-path and index converge to the same winner",
    ],
    run(me) {
      const originalNow = Date.now;
      try {
        // Case 1: distinct timestamps, later one wins.
        Date.now = () => 1000;
        me.wallet.balance(10);
        Date.now = () => 2000;
        me.wallet.balance(20);

        // Case 2: SAME frozen timestamp, genuinely sequential writes — the
        // second call must win via its higher `seq`. This is a REVISION of
        // A9's ordering mechanism, not a bugfix to a wrong rule: the
        // original `(timestamp, hash)` order still holds for records that
        // predate `seq` (see compareLWW's legacy branch, core-index.ts),
        // and the axiom's INTENT — the same set of operations converges to
        // the same result regardless of arrival order — is unchanged. What
        // changed is the mechanism: `(timestamp, hash)` had a real
        // limitation against sequential same-process writes (it couldn't
        // tell "happened after" from "happened to hash higher"), which a
        // monotonic logical clock resolves without giving up convergence —
        // see typedocs/Identity-Bound-Secrets.md §12 and
        // tests/Security/lww-index-consistency.test.ts for the full
        // incident this revision responds to.
        Date.now = () => 3000;
        me.wallet.balance(111);
        me.wallet.balance(222);
      } finally {
        Date.now = originalNow;
      }

      me.rebuildIndex();
      dumpIfVerbose(me, "A9");

      const stm = getSTM(me).filter((t) => t.path === "wallet.balance" && t.operator === null);
      assert.ok(stm.length >= 4, "expected at least four wallet.balance memories");
      const lastTwoSequential = stm.slice(-2);
      assert.equal(lastTwoSequential[0].timestamp, lastTwoSequential[1].timestamp, "expected same-timestamp sequential case");
      assert.ok((lastTwoSequential[1].seq ?? -1) > (lastTwoSequential[0].seq ?? -1), "expected the second call to carry the higher logical seq");

      // The winner must be the SECOND write (222), by construction of the
      // logical clock — not "whichever has the higher hash" (the previous
      // mechanism for this same-timestamp case, revised here — see the
      // comment above).
      assert.deepEqual(me("wallet.balance"), lastTwoSequential[1].value);
      assert.deepEqual((me.index || {})["wallet.balance"], lastTwoSequential[1].value);
    },
    proofs(me) {
      const stm = getSTM(me).filter((t) => t.path === "wallet.balance" && t.operator === null);
      const firstTwo = stm.slice(0, 2);
      const sequentialTwo = stm.slice(-2);
      const tsWinnerValue = firstTwo[0].timestamp > firstTwo[1].timestamp ? firstTwo[0].value : firstTwo[1].value;
      const sequentialWinner = sequentialTwo[1]; // the causally-second write, by seq — see run()
      return [
        { label: "timestamp winner value", expected: 20, actual: tsWinnerValue },
        { label: "sequential (same-timestamp) winner is the SECOND write, by seq — equals read", expected: sequentialWinner.value, actual: me("wallet.balance") },
        { label: "index equals read winner", expected: sequentialWinner.value, actual: (me.index || {})["wallet.balance"] },
      ];
    },
  },
];

  var TWIN = {
 "A-struct-0": "none: axiom_parity_gaps_are_explicit (\"Proxy ergonomics, not Rust kernel semantics\")",
 "A0": "axiom_a0_root_stays_public_secret_scope_root_stays_stealth",
 "A1": "axiom_a1_identity_validates_username_semantics_and_records_root_claim",
 "A2": "axiom_a2_secret_operator_creates_stealth_scope",
 "A3": "axiom_a3_noise_resets_secret_lineage_without_breaking_owner_reads",
 "A3b": "axiom_a3b_nested_secret_owner_reads_remain_accessible",
 "A3c": "axiom_a3c_nested_secret_plus_same_node_noise_stays_owner_readable",
 "A4": "axiom_a4_pointer_is_structural_and_traversable (parity gap: Rust redirects exact pointer reads)",
 "A5": "axiom_a5_query_records_memory_and_keeps_public_view_closed (parity gap: owner-read delta after '?')",
 "A6": "axiom_a6_remove_tombstones_path_without_destroying_history",
 "A7": "axiom_a7_public_ledger_survives_secret_and_noise_transitions",
 "A8": "axiom_a8_hash_chain_is_tamper_evident",
 "A9": "axiom_a9_latest_projection_is_deterministic_by_append_order_in_rust (parity gap: no timestamp in Rust)"
};
  var strip = function (fn) { var s = fn.toString(); return s.slice(s.indexOf("{") + 1, s.lastIndexOf("}")).replace(/^\n+|\s+$/g, "").replace(/^ {6}/gm, ""); };
  var cases = axioms.map(function (ax) {
    return {
      id: ax.id, name: ax.title, checks: ax.checks, twin: "Rust/tests/axioms_contract.rs · " + TWIN[ax.id],
      code: "const me = new ME();\n// run(me)\n" + strip(ax.run) + (ax.proofs ? "\n\n// proofs(me): each one is assert.deepEqual(actual, expected)\n" + strip(ax.proofs) : ""),
      fn: function (ME, keccak256, a) {
        assert = a;
        var me = new ME();
        ax.run(me);
        var proofs = ax.proofs ? ax.proofs(me) : [];
        proofs.forEach(function (p) { assert.deepEqual(p.actual, p.expected, p.label); });
        var o = {}; proofs.forEach(function (p) { o[p.label] = p.actual; });
        return o;
      },
    };
  });
  root.LiveSuites = Object.assign(root.LiveSuites || {}, { axioms: { source: "axioms.test.ts", cases: cases } });
})(window);
