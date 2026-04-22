# .me — The O(k) Energy Argument

## 1. The Work Model

The meaningful claim in `.me` is not "a mutation was fast once." It is that the runtime tries to spend work on the dependency frontier `k`, not on total graph size `N`.

In the current codebase that means:

- derivations are registered with explicit reference paths in `src/derivation.ts`
- invalidation starts from the changed path and walks subscriber targets, not the whole index
- `explain()` can expose the last recompute wave when one exists
- setup, allocation, and broad filter reads are separate operations and must not be blended into mutation-time claims

For an equivalent semantic workload, if a reactive kernel touches `k` affected nodes and a scan-based baseline touches `N` candidates, then the first-order work ratio is:

`work_ratio = k / N`

That is already an energy claim, because operations and memory traffic are what energy is spent on.

## 2. The Proportionality Argument

The repo does not measure joules directly. What it does measure is enough for a careful proportionality argument:

- CPU energy scales with instructions retired and branches executed.
- Memory energy scales with cache lines, object loads, and ciphertext/plaintext movement.
- A local recompute wave touches the mutated source plus its subscribers.
- A full scan touches every candidate in the collection even when only one lineage changed.

So, for comparable per-node work:

`E(.me) / E(scan) ~= ops(.me) / ops(scan) ~= bytes_touched(.me) / bytes_touched(scan) ~= k / N`

This approximation breaks when:

- setup/allocation dominates the total run
- secret branches add cryptographic work
- the dependency graph is architected so broadly that `k` approaches `N`

Those are real caveats, not exceptions to hide.

## 3. The Three Proof Points

### `benchmark.1`

This is not a valid proof point in the current checkout.

What the file actually does:

- reports `trace.meta.dependsOn.length` as `steps`
- mutates `master_switch`
- reads `collection[n].result`

What the current run showed:

- at `N=5000`, reported time `0.0187ms`
- reported `steps=2`
- returned `result=50`

Why that disqualifies it:

- the pre-mutation value was already `50`
- after changing `master_switch` from `5` to `10`, the selected result should have been `100`
- `explain()` on the selected node did not expose a recompute wave `k`

Conclusion: `benchmark.1` does not currently prove the small-`k` energy thesis.

### `City_Scale`

This is the cleanest proof point in the repo because it measures both sides:

- `N = 10000`
- one mutation on `districts[5001].currentLoad`
- `explain().k = 3`
- mutation time `0.903ms`
- O(N) filter scan `107.74ms` for `2001` matches

Derived ratios:

- `k/N = 3 / 10000 = 0.03%`
- `time_ratio = 0.903 / 107.74 = 0.8381%`
- speedup over measured scan baseline: `119.31x`

This is the strongest measured support for the claim that small-`k` reactive propagation spends far less work than a scan over the full graph.

### `Hemisphere_1M`

This demo proves locality at very large `N`:

- `N = 1000000`
- one sensor mutation on `geo[777777].powerUp`
- recompute wave `k = 6`
- mutation time `4.346ms`
- setup time `21899ms`
- heap usage about `533MB`

The hot lineage was:

`geo.777777 -> grid.78 -> traffic -> services`

Derived ratio:

- `k/N = 6 / 1000000 = 0.0006%`

The demo does not directly measure an O(N) scan. Using the `City_Scale` filter scan as calibration:

- `scan_cost_per_node ~= 107.74ms / 10000`
- estimated `1M` scan cost `~= 10774ms`
- estimated speedup `~= 10774 / 4.346 = 2479.06x`

Conclusion: the mutation-time locality claim holds at one million nodes, but the comparison baseline is calibrated, not directly measured in the demo.

## 4. The Comparison Table

| Scenario | N | k | k/N ratio | Mutation time | O(N) scan cost | Speedup | Evidence status |
|---|---:|---:|---:|---:|---:|---:|---|
| `benchmark.1` | `5000` | reported `2` inputs | `0.04%` | `0.0187ms` | `53.87ms` estimated | not claimable | Invalid proof point in current checkout |
| `City_Scale` | `10000` | `3` | `0.03%` | `0.903ms` | `107.74ms` measured | `119.31x` | Clean direct evidence |
| `Hemisphere_1M` | `1000000` | `6` | `0.0006%` | `4.346ms` | `10774ms` estimated | `2479.06x` estimated | Clean locality evidence, calibrated scan baseline |

## 5. The Honest Caveats

### Secret scope costs more

Full firetest `benchmark.9`:

- public `p95 = 0.0395ms`
- secret `p95 = 15.3493ms`
- slowdown `+38758.86%`

Isolated rerun:

- public `p95 = 0.0201ms`
- secret `p95 = 0.9452ms`
- slowdown `+4606.51%`

Interpretation: the cryptographic boundary is real work, and the benchmark is also load-sensitive.

### Allocation is O(N)

The mutation claim is only honest if setup stays separate:

- `City_Scale` setup: `1976.54ms`
- `Hemisphere_1M` setup: `21899ms`
- `Root_Fanout_100k` setup: `137451.08ms`

### `k = 100000` is expensive too

`Root_Fanout_100k` is the proof that the kernel is not magic:

- `N = 100000`
- `k = 100000`
- one mutation took `21283.534ms`

When the dependency frontier is huge, the energy dividend vanishes.

### `explain()` is not free

Full firetest `benchmark.8` put `explain()` at `+29.34% p95`.

An isolated rerun widened that to `+41.88% p95`.

The observability surface is useful, but it has a measurable budget.

### The claim only holds when the dependency graph is well-architected

`.me` wins when:

- derivations are local
- fan-out is bounded
- the semantic question is narrow

`.me` does not win by definition. It wins when `k << N`.

## 6. What This Means at Scale

At `N=10000`, `k=3` means `.me` touched `0.03%` of the candidate space.

At `N=1000000`, `k=6` means `.me` touched `0.0006%` of the candidate space.

That ratio is the energy dividend of a reactive architecture. The system did not save energy by computing the same full graph faster. It saved energy by not touching most of the graph at all.

That is the strongest defensible version of the claim in the current repo:

- supported directly by `City_Scale`
- supported on locality grounds by `Hemisphere_1M`
- bounded honestly by `Root_Fanout_100k`
- weakened, not strengthened, by the current state of `benchmark.1`
