# TypeScript .me Changelog

## 4.3.0

Declared roots in `me://` addressing. **The kernel is unchanged**: values, `explain()`, memories, hashes and
snapshots behave exactly as in 4.2.1. The change is in name parsing and formatting (`src/me-uri.ts`) and in
`createThisMe` accepting a one-label configured root (`src/factory.ts`). Minor version, not a patch: it adds
public functions.

Name resolution under a root the runtime declares for itself. Nothing changes for callers that pass no declared
spaces: context-free parsing and formatting keep their two-label minimum.

- **Added:** a root the runtime declares (`localhost`, `here`, `neurons.me`) may have one or more labels, and
  names inside it (`jabellae.localhost`) resolve against it. The longest declared space that fits wins; a name
  is never split without that context.
  - `validateKnownSpaces(spaces)`: checks a declaration where it is configured and names the bad entry.
  - `parseMeUri(uri, { knownSpaces })`, `formatCanonicalMeUri({ ..., knownSpaces })` and
    `canonicalizeHumanIdentity(..., { knownSpaces })` accept a one-label space only when it is declared.
  - `parseMeSpaceUri` / `tryParseMeSpaceUri` / `formatMeSpaceUri`: `me://<space>` addresses a declared space
    itself, with optional `[selector]` and `/path`. `me://ana.here` is refused as a space (it is a namespace).
  - `createThisMe({ name, space })`: an explicitly configured root may be one label.
  - `projectDnsHostToNamespace` returns `INVALID_KNOWN_SPACES` for a bad declaration instead of throwing.
- **Changed:** `projectDnsHostToNamespace` checks the declared spaces before the `localhost` / `*.local`
  transport-only rule, which remains the answer for undeclared hosts. A declared `localhost` or `<host>.local`
  now resolves as the space it was declared to be.
- **Compatibility:** a consumer that calls `validateKnownSpaces` or `parseMeSpaceUri` needs this version or later.
  monad.ai checks for these functions at startup and refuses to start against an older one; its dependency
  floor should be `this.me ^4.3.0` (4.2.0 and 4.2.1 do not have them).
- **Package metadata:** `description`, `keywords`, `homepage` and `author` brought in line with the other
  neurons.me packages. (Prepared earlier as 4.2.2, which was never published.)

## 4.2.1

Performance release. **No behavior change**: every value, `explain()` result, memory, hash and snapshot is the
same as 4.2.0 (differential run of 40+ probes, byte-identical output; all axioms, phases and suites green).
Audit against every axiom and phase: [tests/audits/4.2.1/README.md](tests/audits/4.2.1/README.md).

### Changed: each formula text is compiled once, per kernel

Before, every recompute re-tokenized the formula text (and since 4.2.0 also tried the `[]` aggregate grammar on
every name) and rebuilt its postfix form, so every recomputed dependent paid it. Now:

- The tokenizer tables are built once, and the compiled postfix form of a formula is memoized by its exact text
  (after the same trim and grammar check as before, and after the `unsafeEval` check). The memo holds only what
  comes from the text: no values, no scope, no reader. Every input is still read at evaluation time.
- The memo is **per kernel** (one `ME` instance), its entries are frozen, and it is cleared whenever the secret
  epoch changes (a scope declared or removed, an identity transition, `hydrate`, lock). So one kernel cannot see,
  even by timing, which formulas another kernel or a previous identity compiled. Bounded at 4,096 texts per kernel
  (cleared when full; eviction only costs a recompile).

### Changed: no-scope fast path in `resolveBranchScope`

With no secret scope declared, the scope lookup no longer goes through the 256-entry scope LRU (which thrashed when a
wave touched thousands of public paths). It does the same prefix lookups as before, so the answer is the same for
every path; with any scope declared, the old cached walk runs unchanged.

### Measured

Kernel timeline (`docs/Benchmarks/data/kernel-timeline.json`, 2026-10-10, 6 interleaved rounds, Xeon 8 vCPU,
Node 22.23.3; medians, 4.2.0 → 4.2.1, same `dist/` as published):

| | 4.2.0 | 4.2.1 | |
|---|---|---|---|
| Eager fan-out, 2,000 deps (one write) | 57.1 ms | 40.3 ms | −29% |
| #6 fan-out 1,000 / 5,000 | 27.5 / 155.2 ms | 19.1 / 110.8 ms | −30% / −29% |
| #7 steady, 1,000 nodes | 33.3 ms | 23.8 ms | −29% |
| #10 eager write, 1,000 | 28.0 ms | 19.7 ms | −30% |
| Steady single write, 2,000 nodes | 0.073 ms | 0.049 ms | −32% |
| #9 public read, 600 | 0.034 ms | 0.026 ms | −23% |
| #9 / #11 secret read, 600 | 0.97 / 0.94 ms | 0.93 / 0.88 ms | −5% / −6% |
| First write after a build (1–4 style) | 0.68 ms | 0.65 ms | warm-up, unchanged |

Eager fan-out is back below the 4.1.0 level. With a secret scope present the 2,000-dependent write still drops by
about 25%; in the worst case (a new `_` scope before every write, so the memo is cleared each time) it is never
slower than 4.2.0.

### Known, unchanged

- Object.prototype names used as the first path segment (`toString`, `valueOf`, `constructor`, …) count as a
  secret scope in the scope walk, because the scope map is a plain object (e.g. a replayed write at `toString.x`
  is owner-only). This is 4.2.0 behavior, kept exactly as it is in 4.2.1; it will be fixed separately because the
  fix changes behavior.
- The four KNOWN FAIL cases (#5 numeric segment after a dot ×2, #6 path identity ×2) are unchanged.

### Tests

- `tests/eval-compile-cache.test.ts` (unit, 11) and `tests/perf-fix-kernel.test.ts` (kernel, 10; with
  `PERF_FIX_BASELINE=1` its 9 behavior tests also pass on 4.2.0), run by `npm run test:perf-fix` and `npm test`.

## 4.2.0

Adds the collection aggregate `[]` (`me("x[]")` = count, `me("x[].f")` = exact
sum), fixes known issue #4 (pointers), closes a root-scope `_` stealth hole,
and deprecates `withScope`. **It changes how some existing strings behave:**
read **Incompatibilities** first.

### Incompatibilities (read before upgrading)

These are all the behavior changes from 4.1.0 (contract §11, I1–I10, plus
the public-view rule for `[]` reads). A green 4.1.0 test suite says nothing
about them: no 4.1.0 test exercised I1–I4. Code that writes root values
containing `[]`, reads paths through `x[].f` / `x.[].f` / `z.["[]"]`, or
switches exhaustively over `meta.unresolved.reason` is affected.

| | Input | 4.1.0 | 4.2.0 |
|---|---|---|---|
| I1 | `me("x[]")`, and any root string that is a valid aggregate reference | **writes**: the root value becomes the string `"x[]"` and a memory is appended | **reads** the count of `x`'s members |
| I2 | `me("x[].f")`, `me("a[].b.c")`, `me("x.[].f")`, `me("x[ ].f")`; any invalid `[]`-form (`a[]b`, `[]`, `x[][]`, `x[] + 1`, `x[a>1][]`); formula text with `z[ ].w` | dotted: reads the collapsed path (`x.f`). Not dotted: **writes** the string as the root value | valid forms: the aggregate. Invalid forms: `undefined`, `evaluation-failed` with `detail`, and **never a write** (no root value, no memory) |
| I3 | `explain("x[].f")`; `explain` of an invalid `[]`-form | explains `x.f` (the collapsed path) | explains the aggregate; an invalid form gives `evaluation-failed` with `detail` |
| I4 | a declared formula whose text contains `[]` | `undefined`, `missing-input` | a number once re-evaluated |
| I5 | `meta.unresolved.reason`; `explain` input entries | three reasons; entries `{label, path, value, origin, masked}` | adds the reason `incomplete` (exhaustive switches need a branch). Every input entry gains `status`; aggregate entries gain `kind` and `aggregate`. With aggregates, `meta.unresolved` gains `causes` and `reason` is the primary reason by fixed precedence `cycle` > `missing-input` > `incomplete` > `evaluation-failed`. Formulas without aggregates keep the 4.1.0 shape |
| I6 | `["="]` declared through a literal `[]` proxy segment (`me.z["[]"]["="]("t", e)`) | target and eval scope silently move to the parent (`z.t`) | the segment is kept (`z.[].t`, scope `z.[]`). Plain proxy writes of literal `[]` keys are unchanged |
| I7 | quoted selectors containing `]` (`z["[]"].w`, `["z[]"].w`) in `me()`, `explain()` and formula text | addresses a raw segment such as `["[]"]` | addresses the literal segment. Routing is unchanged: `me('z["[]"]')` (no dot) still writes the root value |
| I8 | `explain` path strings for paths with non-plain segments | storage-like strings (`z.["[]"].w`, `z.[].t`) | rendered form (`z["[]"].w`, `z["[]"].t`) for quoted-literal requests and every stored path in `inputs`, `dependsOn`, `unresolved.inputs`, `recomputed`, `changed`, `sourcePath`. No change for plain paths |
| I9 | `meta.unresolved` for `evaluation-failed` | `{ reason }` | additive optional `inputs` and `detail` (the parse error of an invalid `[]`-form) |
| I10 | `z.["[]"].w`, `z.['[]'].w`, `z.["[]"]` in `me()`, `explain()` and formula text | addresses the raw segment `["[]"]` | rejected (`dotted-literal-selector`): `undefined`, nothing written. The literal is written `z["[]"].w`; a key literally named `["[]"]` is read with `z['["[]"]'].w` |
| — | **Who an aggregate is computed for** | (no aggregates) | every `[]` read and every formula declared outside a secret scope is evaluated over the **public view** (what `me.as(null)` sees), **for every caller, including the owner and `me.as(key)`**. Protected members never count. Scalar path reads are unchanged: the owner still reads `robots.1.batteries.3.charge` |

Example of the public-view rule (battery 3 is in a secret scope):

```ts
me.robots[1].batteries[1].charge(40);
me.robots[1].batteries[2].charge(30);
me.robots[1].batteries[3]["_"]("k");
me.robots[1].batteries[3].charge(20);

me("robots.1.batteries[].charge");           // 70 — public view, also for the owner
me.as(null)("robots.1.batteries[].charge");  // 70
me("robots.1.batteries.3.charge");           // 20 — scalar read, unchanged from 4.1.0
```

UI and docs should call this value "total of the public view", not "total".

### Added: collection aggregates `[]`

```ts
me.fleet.trucks[1].fuel(100);
me.fleet.trucks[2].fuel(200);
me.fleet.trucks[3].fuel(400);

me("fleet.trucks[]");        // 3    — count of members
me("fleet.trucks[].fuel");   // 700  — sum of field fuel over the members
me["="]("total", "fleet.trucks[].fuel * 2");
me("total");                 // 1400 — the same forms work in formulas
```

- **Bound from the root.** The collection path is read from the root, also
  inside scoped formulas (no relative-first fallback as for scalar refs):
  `me.fleet["="]("t", "fleet.trucks[].fuel")`. Per parent, use `[i]`:
  `robots["[i]"]["="]("battery", "robots[i].batteries[].charge")`.
- **Members** are the children of the collection with at least one public
  entry; **terms** are the field values read publicly.
- **Exact sum, rounded once**: the result is the correctly rounded exact sum
  of the terms (checked against two independent references), not a running
  double sum.
- **Terms** are finite numbers, or booleans (1/0) only when every term is
  boolean. Strings (even numeric), objects, `null` and missing values are not
  terms. An empty collection gives `undefined`, not `0`.
- **Statuses** in `explain()` (`derivation.inputs[i].aggregate`): `resolved`;
  `incomplete` (some member lacks an admissible term: the count still
  resolves, the sum is `undefined` — never a partial sum; `problems.sample`
  lists public paths only); `absent` (no public members, same as never
  written); `deferred` (a member, the field or an ancestor is a pointer);
  `non-finite` (the rounded sum overflows); `cycle`; `unsupported` (see Known
  limits). Each entry reports `collection`, `field`, `op`,
  `context`/`coverage` (`"public-view"`), `members`, `terms`, `problems`.
- The three readings agree (`me()`, a formula, `explain().value`), and
  reading writes nothing.
- Recomputes on term writes, member add/remove, `_` over a public member,
  chained formulas, lazy pulls and reconstructions (`hydrate`,
  `importSnapshot`, `replayMemories`, `rebuildIndex`).
- `|x[]|`, `x[] <= 128` and other invalid forms are rejected and write
  nothing (I2).
- Tests: `npm run test:aggregates` (`aggregate-path`, `aggregate-eval`,
  including A/B twin tests showing a public reader cannot tell a store with
  protected members from one without them).

### Fixed: #4 pointers — formulas reading through a pointer now recompute

A formula that reads through a pointer
(`me.pick["->"]("users.ana")`, `"pick.age >= 18"`) is now recomputed when the
pointed-to value is written and when the pointer is retargeted, in eager and
lazy modes. Covered by `tests/pointer-target-invalidation.test.ts` and
`tests/derivation-wave.test.ts` (#4 is no longer a `KNOWN FAIL`).

### Security: root-scope `_` is stealth for guests

A secret scope declared at the root (`me["_"]("key")`) did not hide its
paths from readers without the key: `me.as(null)("notes.pin")` returned the
value. Both stealth walks skipped the root scope key `""`. Root-scope paths
are now `undefined` for `me.as(null)` and `me.as("wrong")` (including after
hydrate/export and for derived values), while the owner and `me.as(key)`
read them as before. Named branch scopes (`me.wallet["_"]`) were not
affected. Covered by `tests/Security/root-secret-stealth.test.ts` and
`tests/Security/root-secret-aggregate-paths.test.ts`.

### Deprecated: `withScope` — use `as()`

`ME#withScope` is deprecated. It does **not** restrict reads on existing handles
(the owner proxy keeps its captured owner scope), so it must not be used as an
authorization boundary. Prefer `me.as(key | null)` and read through the returned
handle. The method remains exported for compatibility; behavior is unchanged
aside from a one-time `console.warn` per process.

Migration:

```ts
// before — ineffective demotion (do not rely on this)
me.withScope(null, () => me("ops.beansKg"));

// after — restricted handle (guest can still read public paths)
const guest = me.as(null);
guest("shop.label");  // public value — still readable
guest("ops.beansKg"); // undefined — protected path, or one that does not exist
                      // (those two cases are indistinguishable to a guest)
```

Key holders:

```ts
const ops = me.as("downtown-ops-key");
ops("ops.beansKg"); // readable when the key matches
```

### Known limits (stated plainly)

- **Aggregate cost grows with store size.** Evaluation scans the whole
  public index, not just the collection, so cost grows with the total number
  of keys: about **21 ms per term write with 10^5 unrelated keys** in the
  store. The usual `O(k)` claim does not hold for aggregates (an aggregate
  counts as 1 in `k` while reading every member). An index-backed strategy
  is planned.
- **Authorized aggregates are unsupported.** There is no way yet to get the
  total including protected members. A formula with `[]` declared *inside* a
  secret scope evaluates to `undefined` with status `unsupported`
  (`reason: "authorized-context-unsupported"`), never to the public total.
  The owner can still read each protected member by path.
- **No global-invisibility claim.** The memories API exposes, to any reader
  including `me.as(null)`, the number, paths, order and timestamps of secret
  writes, and lets a guessed scope key be confirmed offline. This is
  pre-existing (4.1.0 and earlier) and documented. 4.2 verifies only that
  `[]` aggregates add **no new** leak compared to 4.1; it does not claim the
  kernel hides protected data globally.
- **Aggregates over pointers are deferred.** A member that is a pointer, or
  a field path that crosses a pointer, gives `undefined` with status
  `deferred`, even with the #4 fix, until aggregate-specific pointer tests
  exist.
- **The Rust port does not implement 4.2** (no `[]` aggregates, none of
  I1–I10).
- Still open from 4.1.0: #2 (formulas not in snapshots), #5 (numeric segment
  after a dot in formula text), #6 (path identity), log growth.

## 4.1.0

Correctness release for derived values (`=`). Several cases returned a stale
or placeholder value without any error; they are fixed, and two behaviors
change as a result (see **Changed**). Minor version rather than a patch
because of those behavior changes.

Summary:

- **Fixed:** refs subscribed to the wrong path (stale values); eager waves
  computing with stale intermediates; removals not recomputing; cycles
  overflowing the stack in lazy mode.
- **Changed:** a derivation with no correct value is `undefined` (was its own
  formula text); `[i]` rules also apply to children added later;
  `explain().meta.dependsOn` reports the path actually read.
- **Added:** `explain().meta.changed`, `explain().meta.unresolved`, early
  cutoff, `npm run test:derivations`.
- **Known issues:** see the end of this section.


### Fixed: eager recompute order, early cutoff, removals, cycles

Eager mode (the default) walked a write's dependents breadth-first and
evaluated each once, so a derivation that read the written path directly
*and* through a longer chain was computed with a stale intermediate value:

```ts
me.order.price(100)
me.order["="]("discount", "price * 0.1")
me.order["="]("net", "price - discount")
me.order["="]("tax", "net * 0.16")
me.order["="]("total", "price + tax")
me.order.price(200) // total was 214.4 (stale tax); now 228.8
```

A wave now collects the affected derivations and evaluates them in
topological order, each once, and only if one of its inputs changed in that
wave. A flat fan-out (no affected derivation reads another) skips the
ordering step.

- **Early cutoff.** A recomputed primitive value that is `Object.is`-equal to
  the previous one is not written and does not propagate. Objects and arrays
  are always treated as changed. `explain().meta.k` still counts derivations
  *evaluated*; the new `meta.changed` lists those whose value changed and was
  written.
- **Removals recompute.** Removing a path (`me.r.a["-"]()`) now updates every
  derivation that read it or anything below it.
- **Cycles fail closed.** Derivations that read each other (or themselves) no
  longer overflow the stack in lazy mode; in both modes the cycle members are
  `undefined`, derivations reading them are `undefined` (missing input), and
  the rest of the wave updates normally.

### Changed: a derivation with no correct value is `undefined`

When a formula could not be evaluated, its value used to be the formula text
(`me("p.y") === "x + later"`). It is now `undefined`, both at declaration and
after an input is removed, and `explain(path).meta.unresolved` says why:
`{ reason: "missing-input", inputs: [...] }`, `{ reason: "cycle", cycle: [...] }`
or `{ reason: "evaluation-failed" }` (an expression the mini evaluator
rejects, e.g. `"true + 1"`). A payload like `"1 + console.log(1)"` is still
never executed; it now reads `undefined` (missing input `console.log`) instead
of its own text. The value is computed normally once a missing input arrives.

Performance versus 4.0.2 (A/B, alternating runs, Apple M2): flat fan-out
~+4% per recomputed dependent (the cutoff comparison; a per-derivation cache
of the last value it wrote keeps it there, and is invalidated by any other
write to that path). Non-flat graphs: a 5,000-node chain ~+11%, 50-wide
layered diamonds ~+15% (noisy, +10–30% across runs), a 5,000-wide two-layer
graph on par; all scale linearly (t(5000)/t(500) ≈ 10–12).

Covered by `tests/derivation-wave.test.ts` (including cache-invalidation
cases for direct writes, `learn()`, pointer writes, `lockIdentity()`,
`importSnapshot()` and `replayMemories()`).

### Changed: `[i]` derivations apply to children added later

`me.users["[i]"]["="]("isAdult", "age >= 18")` used to expand once over the
children that existed at declaration time; a child written afterwards
(`me.users.luisa.age(40)`) got no formula. The declaration is now kept as a
rule: the first write under a new child of the collection instantiates the
formula for that child.

- Redeclaring the same `[i]` target and name replaces the formula for existing
  and future children.
- Removing one child (`me.users.ana["-"]()`) keeps the rule; writing that child
  again re-instantiates it. Removing the collection itself (or an ancestor)
  drops the rule.
- Per-write cost is O(path depth), independent of how many rules exist; a
  write at or above a rule's collection rescans that collection.
- Known limits: rules are not persisted in snapshots (neither are formulas
  yet), and writing a whole object onto the collection
  (`me.users({ luisa: { ... } })`) stores it as a leaf value that hides the
  children, while the rule stays active.

### Fixed: derived values now recompute when any input they read changes

A derivation subscribed to a different path than the evaluator read, so some
writes left derived values stale with no error:

- A dotted relative ref (`"paid.ana - per_person"` declared at
  `wallets.vancouver`) was subscribed as the root path `paid.ana`. Writing
  `wallets.vancouver.paid.ana` did not recompute `balance_ana`.
- An undotted name that only exists at the root (`"value * master"` declared at
  `dep`) was subscribed as `dep.master`. Writing root `master` did not
  recompute `dep.out`.

Both eager and lazy modes were affected. The evaluator reads every identifier
relative-first, root-fallback; a derivation now subscribes to both candidate
paths, and a notification is only acted on when it can change what the
evaluator reads (a write to a root path shadowed by a relative value is
skipped, so it does not recompute, append memories, or count toward `k`).
Creating or emptying the relative path switches the read and recomputes.

Visible changes:

- `explain(path).meta.dependsOn` now lists the path the evaluator actually
  reads. For `wallet["="]("net", "income - expenses.rent")` it reports
  `wallet.expenses.rent` instead of the non-existent root `expenses.rent`
  (`tests/storage.instance-store.test.ts` updated accordingly).
- `MEDerivationRecord.refs` entries are `{ label, candidates }` instead of
  `{ label, path }`.
- Benchmarks 5–11 and the regression gate used these ref shapes and were
  measuring writes that recomputed nothing. They are re-measured in
  `docs/Benchmarks/benchmarks.md` and `typedocs/kernel/Benchmarks.md`
  (eager recompute is linear in `k`, ~12–14 µs per dependent on an M2).
  The gate's absolute `latency_p95 <= 20ms` and `complexity_k` (which read
  the formula's input count) are replaced by exact `meta.k` checks and a
  machine-independent scaling ratio. Benchmarks 6 and 10 now report `k` as
  `meta.k` and the input count as a separate `inputs` column.

Covered by `tests/derivation-refs.test.ts`.

### Known issues

#4 and #5 run as visible red tests (`KNOWN FAIL`) in `tests/derivation-wave.test.ts`, #6 in `tests/path-identity.test.ts`.

- **#4 pointers** (fixed in 4.2.0). A formula that reads through a pointer
  (`me.pick["->"]("users.ana")`, `"pick.age >= 18"`) is not recomputed when
  the pointer is retargeted or when the pointed-to value is written: it
  subscribes to `pick.age`, not to `users.ana.age`.
- **#5 formula grammar.** A numeric segment after a dot (`"dep.2.out"`) is
  split into `dep`, `2`, `out`; use `"dep[2].out"`.
- **#6 path identity.** Segments are joined with `.` in the index, the memory
  log, secret scopes and key derivation (`crypto.ts` `normalizePathContext`),
  so a segment containing `.` collides with nesting: `me["a.b"].c(1)` then
  `me.a["b.c"](2)` land on one key `a.b.c` and the second silently overwrites
  the first; a secret scope declared on segment `"x.y"` also seals the nested
  path `x.y.t`. The fix depends on the path encoding (NRP v0.4 D5); stored
  `a.b.c` records cannot be migrated automatically because their segment
  boundaries are already lost. Red tests: `tests/path-identity.test.ts`.
- **#2 persistence.** Formulas and `[i]` rules are not saved in snapshots;
  after `importSnapshot()`/`replayMemories()` derived values are plain values.
- **Log growth.** Every changed recompute appends a memory; per-write cost
  drifts up as the history grows (benchmark 5).
