# TypeScript .me Changelog

## 4.1.0 - unreleased

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

- **#4 pointers.** A formula that reads through a pointer
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
