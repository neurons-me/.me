# .me v3.7.1 — What We Proved

## 1. The Thesis

`.me` is a callable semantic kernel that combines a proxy DSL, a memory log, path-bound secret scopes, and an incremental derivation engine in one runtime value. The architecture matters because the performance claim is not "JavaScript was fast on one laptop"; it is that mutation-time work can stay local to the dependency frontier.

In the current checkout, that locality is implemented by registering derivation references in `refSubscribers`, invalidating from the changed path, and recording recompute waves that `explain()` can surface. Secret branches are stored off the public index, their roots stay stealth, and derivation traces can expose masked origins without leaking secret values.

The repo passed the full `fire.test.ts` suite, passed all demos, and cleanly demonstrates small-`k` reactive behavior in `City_Scale` and `Hemisphere_1M`. It also exposes real costs and real gaps: secret paths are much slower than public ones, `explain()` is not free, `k=100000` is expensive, and `benchmark.1` is not a valid proof point in the current checkout.

## 2. The Axioms

- `A-struct-0` Unified callable surface: one runtime value is both callable and infinitely chainable; see `docs/Axioms.md`, `src/proxy.ts`, and `tests/axioms.test.ts`.
- `A0` Secret root stealth: a secret subtree root reads as `undefined` while full leaf paths remain readable; see `docs/Axioms.md` and `tests/phases.test.js` Phase 0.
- `A2` Path-bound secret scope: secrecy is structural and attached to a path, not a global mode bit; see `docs/Axioms.md` and `tests/phases.test.js` Phases 0 and 6.
- `A4` Structural pointers: pointers stay lightweight data and dereference on traversal; see `docs/Axioms.md`, `src/core-read.ts`, and the demos.
- `A5` Query as memory event: `?` is recorded in memory history as an operator, not treated as invisible control flow; see `docs/Axioms.md` and `tests/axioms.test.ts`.
- `A8` Hash-chain integrity: each memory links to the previous hash, preserving a tamper-evident journal; see `docs/Axioms.md` and `tests/axioms.test.ts`.

## 3. The Honest Performance Table

All numbers below came from the April 21, 2026 local runs of `node tests/fire.test.ts` and `node tests/Demos/run-all.ts`.

| Item | Actual run | What it showed | Caveat |
|---|---:|---|---|
| `phases` | `11/11` passed; Phase 8 setup `189ms`, global recompute `46ms`, local recompute `0ms` | Phases 0-8 are operational | Phase 8 numbers are a smoke signal, not a benchmark harness |
| `benchmark.1` | `N=5000`, `0.0187ms`, reported `steps=2`, `result=50` | File reports constant dependency inputs per node | Not a valid small-`k` proof in this checkout; post-mutation result stayed at the pre-mutation value |
| `benchmark.2` | `N=10..10000`, `0.0168ms-0.1346ms`, reported `effort=2` | More of the same shape as `benchmark.1` | Also reports a fixed "effort" field, not recompute-wave `k` |
| `benchmark.3` | `N=10..10000`, `0.0150ms-0.1496ms`, reported `effort=2` | Progress-logged version of the same profile | Same caveat as `benchmark.2` |
| `benchmark.4` | Deep `10.4812ms`, wide `20.9804ms`, financial `125.5046ms` | Deep nesting, wide broadcast, and financial formula scenarios all reacted | Labels `dependsOn.length` as `k`; that is not recompute-wave size |
| `benchmark.5` | `p50=0.00746ms`, `p95=0.01396ms`, `p99=0.04304ms`, `max=0.62629ms`, drift `-44.47%` | Sustained mutation throughput stayed stable | Good throughput benchmark, not an energy proof by itself |
| `benchmark.6` | Fanout `10..5000`, reported `k=2`, `p95=0.0076ms-0.0202ms` | Fanout curve stays low-latency in this harness | The file hard-codes the small-`k` story rather than reading recompute-wave metadata |
| `benchmark.7` | `100/1000/5000` nodes, steady avg `0.0211/0.0071/0.0117ms` | Cold vs warm vs steady-state separated | Useful profiling split, not a semantic comparison baseline |
| `benchmark.8` | Firetest `p95` overhead `+29.34%` | `explain()` overhead is measurable and non-zero | Isolated rerun widened to `+41.88%`; do not call it "free" |
| `benchmark.9` | Firetest public `p95=0.0395ms`, secret `p95=15.3493ms`, slowdown `+38758.86%` | Secret-path cost is real | Isolated rerun was lower (`+4606.51%`); treat as an envelope, not a constant |
| `benchmark.10` | At fanout `5000`: eager mutation/read `0.0052/0.0047ms p95`, lazy `0.0041/0.0042ms p95` | Push vs pull costs stay low in the public path | Low-latency public-path benchmark only |
| `benchmark.11` | Secret/public read `p95` slowdown `11.03x @100`, `75.21x @300`, `463.10x @600` | Secret pull cost is the noisiest path | Mutation and first-read behavior diverge sharply on secret paths |
| `City_Scale` | Setup `1976.54ms`; one mutation `0.903ms`; filter scan `107.74ms`; `k=3` | Cleanest small-`k` proof in the repo | Setup is O(N); mutation is O(k) |
| `Concurrent_Storm` | `1000` mutations in `77.89ms`; `12838` events/s; `k=3` | Small-`k` holds under a storm of local updates | Single-core local run, not distributed throughput |
| `Hemisphere_1M` | Setup `21899ms`; one mutation `4.346ms`; `k=6`; heap `533MB` | Large `N`, tiny hot lineage | No direct O(N) scan is measured in the demo |
| `Root_Fanout_100k` | Setup `137451.08ms`; one mutation `21283.534ms`; `k=100000` | Large `k` is expensive too | This is the counterexample that keeps the argument honest |

## 4. The Energy Efficiency Section

For reactive semantic workloads, the energy argument is only valid when the semantic alternative really does touch all `N` candidates. In this repo today, `City_Scale` is the clean direct measurement because it includes both the local mutation and a measured O(N) filter scan. `Hemisphere_1M` supports the local-lineage side of the thesis, but its O(N) scan cost must be calibrated from `City_Scale`.

Calibration used here:

`scan_cost_per_node ~= 107.74ms / 10000 = 0.010774ms`

| Scenario | N | k | k/N ratio | Mutation time | O(N) equivalent | Speedup | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| `benchmark.1` | `5000` | reported `2` inputs | `0.04%` | `0.0187ms` | `53.87ms` estimated | not claimable | Disqualified: benchmark reports `dependsOn.length`, and the post-mutation result stayed `50` |
| `City_Scale` | `10000` | `3` | `0.03%` | `0.903ms` | `107.74ms` measured scan | `119.31x` | Valid proof point |
| `Hemisphere_1M` | `1000000` | `6` | `0.0006%` | `4.346ms` | `10774ms` estimated scan | `2479.06x` estimated | Valid local-lineage proof; scan baseline is calibrated |

What this supports:

- `City_Scale` directly supports the claim that small-`k` reactive propagation can do far less work than an O(N) scan for the same semantic question.
- `Hemisphere_1M` supports the claim that mutation-time work can stay local even when `N` is one million.
- `Root_Fanout_100k` proves the boundary condition: if `k` grows to `N`, the dividend disappears.

## 5. The Demos Matrix

| Demo | What it proved |
|---|---|
| `Affinity_Model` | Reactive scoring, selection by derived state, masked explainability for stealth policy inputs |
| `City_Scale` | `N=10000`, one mutation, `k=3`, and a measured O(N) filter scan baseline |
| `Concurrent_Storm` | `1000` local mutations over `100k` nodes without `k` inflation on the last event |
| `Hemisphere_1M` | `N=1000000`, one sensor mutation, `k=6`, cross-domain cascade staying local |
| `Robots_Contexts` | One shared object can yield different truths by path-local context without copying the object |
| `Root_Fanout_100k` | When `k=100000`, one mutation becomes a `21.283s` operation |
| `ShopsExample` | Public menu math plus a stealth private ops lane with masked provenance |
| `Smart_City` | Interconnected districts, traffic, services, stealth security nodes, and live pointers |
| `Social_Graph` | Public social derivations plus stealth follow-up logic on the same runtime |

## 6. The Honest Gaps

- `benchmark.1` is not a valid proof of the small-`k` thesis in the current checkout. It reports `dependsOn.length`, not recompute-wave `k`, and its post-mutation read stayed at the pre-mutation value.
- `benchmark.2`, `benchmark.3`, and `benchmark.4` inherit the same reporting problem: they use fixed dependency-input counts where the energy argument needs actual recompute-wave size.
- `City_Scale` is the only demo that directly measures an O(N) scan cost. `Hemisphere_1M` needs a calibrated scan estimate, not a directly measured one.
- Setup/allocation is O(N) and must stay separate from mutation-time claims: `City_Scale` setup was `1976.54ms`, `Hemisphere_1M` setup was `21899ms`, and `Root_Fanout_100k` setup was `137451.08ms`.
- Secret-path and explainability benchmarks are noisy. The full firetest run and isolated reruns produced materially different numbers.
- No power meter, RAPL counter, or wall-joule measurement exists in the repo. The energy claim here is a proportionality argument grounded in operations and memory traffic, not direct joule telemetry.

## 7. Reproduction Command

```bash
git clone https://github.com/neurons-me/.me.git
cd .me/npm
npm install
node tests/fire.test.ts
node tests/Demos/run-all.ts
```
