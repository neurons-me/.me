# TypeScript .me Changelog

## Unreleased

### Fix: derived values now recompute when any input they read changes

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
- Benchmarks whose formulas use these ref shapes report different numbers
  with this fix.

Covered by `tests/derivation-refs.test.ts`.
