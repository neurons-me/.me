# .me v3.7.1 — 7-Tweet Thread

1. `.me`'s core systems claim is simple: one mutation should recompute the affected dependency frontier `k`, not rescan total graph size `N`. In this repo that is implemented with explicit derivation refs, subscriber indexes, targeted invalidation, and `explain()` recompute waves.

2. `City_Scale` is the clean proof. `N=10000`. One `districts[5001].currentLoad` mutation took `0.903ms`. `explain().k = 3`. The equivalent filter scan over the same graph took `107.74ms` for `2001` matches. Work ratio: `3/10000 = 0.03%`. Time ratio: `0.903/107.74 = 0.838%`.

3. `Hemisphere_1M` shows the same locality at much larger `N`. `N=1000000`. One sensor flip propagated through `6` nodes across `geo -> grid -> traffic -> services` in `4.346ms`. `k/N = 6/1000000 = 0.0006%`. Setup still cost `21.899s` and about `533MB`; the mutation stayed local.

4. That is why O(k) is an energy claim, not just a speed claim. CPU work and memory traffic scale with nodes touched. If the semantic alternative has to touch `N` candidates and `.me` touches `k`, then the first-order energy ratio is `k/N`. The savings come from work not done.

5. Honest edges: `explain()` is not free. Full firetest `benchmark.8` put it at `+29.34% p95` overhead. Secret paths are not free either: full firetest `benchmark.9` put secret `p95` at `15.3493ms` vs public `0.0395ms` (`+38758.86%`). And when `k=100000`, `Root_Fanout_100k` took `21.283s` for one mutation. Large `k` is still large work.

6. The `Robots_Contexts` demo shows the semantic side of the thesis. One shared object, three robots, three different truths, no object copy. Meaning is path-local. Warehouse, hospital, and street contexts derive different actions from the same signal, and `explain()` shows why each robot acted.

7. Benchmarks `1` through `4` now all read `trace.meta.k` and fail if a selected value goes stale. The honest counterexample is still `Root_Fanout_100k`: `k=100000`, one mutation took `21.283s`. That is the whole thesis in one line: `.me` wins when `k << N`, because comprehension stays as cheap as the signal.
