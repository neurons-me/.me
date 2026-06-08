# .me Kernel — Benchmark Results

Run with: `node tests/fire.test.ts` (benchmarks section)

All benchmarks measure the kernel's reactive recompute engine under realistic conditions.
Hardware-agnostic: times will vary per machine — what matters is the **shape** (flatness, ratios).

---

## Benchmark 1 — Algorithmic Scaling

Goal: prove O(k) efficiency. Work stays flat as N grows.

```
> N = 10     | Time: 0.1094  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 100    | Time: 0.0746  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 1000   | Time: 0.0841  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 5000   | Time: 0.0542  ms | Wave k: 2  | Result: 100 | overThreshold: true

┌─────────┬───────┬──────────┬───┬────────┬───────────────┐
│ (index) │ nodes │ duration │ k │ result │ overThreshold │
├─────────┼───────┼──────────┼───┼────────┼───────────────┤
│ 0       │ 10    │ '0.1094' │ 2 │ 100    │ true          │
│ 1       │ 100   │ '0.0746' │ 2 │ 100    │ true          │
│ 2       │ 1000  │ '0.0841' │ 2 │ 100    │ true          │
│ 3       │ 5000  │ '0.0542' │ 2 │ 100    │ true          │
└─────────┴───────┴──────────┴───┴────────┴───────────────┘

✅ SUPERIORITY PROVEN: Response time stayed under 20ms even with 5000 nodes.
✅ ALGORITHMIC CONSTANCY: The actual recompute wave stayed at k=2.
```

**Key insight:** wave k = 2 regardless of N. The engine touches only the actual dependents of the mutated node, not the entire dataset.

✅ completed in 341.71ms

---

## Benchmark 2 — Extended Scaling (CSV)

```
n,time_ms,wave_k,result,over_threshold
10,0.1080,2,100,true
100,0.0534,2,100,true
500,0.0534,2,100,true
1000,0.1051,2,100,true
2500,0.0686,2,100,true
5000,0.0532,2,100,true
7500,0.0518,2,100,true
10000,0.0521,2,100,true
```

k stays 2 at 10,000 nodes. Recompute time does not grow with corpus size.

✅ completed in 1193.38ms

---

## Benchmark 3 — Incremental Processing

```
n,time_ms,wave_k,result,over_threshold,status
10,0.1055,2,100,true,OK
100,0.0533,2,100,true,OK
1000,0.0728,2,100,true,OK
5000,0.0559,2,100,true,OK
10000,0.0789,2,100,true,OK
```

✅ completed in 754.39ms

---

## Benchmark 4 — Multi-Dataset Stress Lab

Three structural shapes: deep nesting, wide broadcast, financial dataset.

**Deep Nesting (500 levels)**
```
> Latency: 13.2138ms
> Wave k: 2
> Mutation path: root.n0.n1...n499.factor  (500-level chain)
> Result before/after: 50 -> 100
> Status: ✅ Reactive
```

A 500-level deep chain still triggers only k=2 recomputations. The path length does not expand the wave.

**Wide Broadcast (1,000 nodes)**
```
> Latency: 0.0864ms
> Wave k: 2
> Mutation path: sensors.999.factor
> Result before/after: 50 -> 100
> Status: ✅ Reactive
```

**Financial Dataset (5,000 tx)**
```
> Latency: 0.0789ms
> Wave k: 2
> Mutation path: tx.4999.taxRate
> Result before/after: 116 -> 200
> Status: ✅ Reactive
```

✅ completed in 386.57ms

---

## Benchmark 5 — Throughput Under Sustained Mutation

2,000 consecutive mutations, percentile latency tracking.

```
┌─────────┬──────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│         │ p50                  │ p95                 │ p99                 │ max                 │
├─────────┼──────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ 0       │ 0.007ms              │ 0.011ms             │ 0.018ms             │ 0.331ms             │
└─────────┴──────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

Windowed p95 drift (no degradation over time):

```
┌──────────────┬──────────┬──────────┬──────────┐
│ window       │ p50_ms   │ p95_ms   │ p99_ms   │
├──────────────┼──────────┼──────────┼──────────┤
│ 1-200        │ '0.0088' │ '0.0157' │ '0.0218' │
│ 201-400      │ '0.0074' │ '0.0112' │ '0.0150' │
│ 401-600      │ '0.0071' │ '0.0128' │ '0.0210' │
│ 601-800      │ '0.0070' │ '0.0097' │ '0.0140' │
│ 801-1000     │ '0.0068' │ '0.0099' │ '0.0307' │
│ 1001-1200    │ '0.0068' │ '0.0089' │ '0.0142' │
│ 1201-1400    │ '0.0068' │ '0.0083' │ '0.0115' │
│ 1401-1600    │ '0.0071' │ '0.0101' │ '0.0164' │
│ 1601-1800    │ '0.0067' │ '0.0079' │ '0.0115' │
│ 1801-2000    │ '0.0070' │ '0.0110' │ '0.0148' │
└──────────────┴──────────┴──────────┴──────────┘
p95 drift: -30.16%  (gets faster, not slower)
```

✅ completed in 191.92ms

---

## Benchmark 6 — Fan-Out Sensitivity Curves

Measures how latency changes as the number of nodes sharing a derivation rule grows.

```
┌────────┬───┬──────────┬──────────┬──────────┬──────────┐
│ fanout │ k │ p50_ms   │ p95_ms   │ p99_ms   │ max_ms   │
├────────┼───┼──────────┼──────────┼──────────┼──────────┤
│ 10     │ 2 │ '0.0124' │ '0.0189' │ '0.0253' │ '0.0934' │
│ 100    │ 2 │ '0.0082' │ '0.0160' │ '0.0201' │ '0.0230' │
│ 500    │ 2 │ '0.0074' │ '0.0105' │ '0.0161' │ '0.0184' │
│ 1000   │ 2 │ '0.0062' │ '0.0078' │ '0.0102' │ '0.0193' │
│ 2500   │ 2 │ '0.0061' │ '0.0083' │ '0.0120' │ '0.0134' │
│ 5000   │ 2 │ '0.0057' │ '0.0067' │ '0.0089' │ '0.0105' │
└────────┴───┴──────────┴──────────┴──────────┴──────────┘
```

Latency decreases as fanout increases — larger datasets benefit from amortized index lookup. k remains 2.

✅ completed in 277.66ms

---

## Benchmark 7 — Cold vs Warm Runtime Profiles

First mutation on a fresh kernel (cold) vs subsequent mutations (warm/steady).

```
┌───────┬──────────┬──────────┬───────────────┬───────────────┬───────────────┐
│ nodes │ cold_ms  │ warm_ms  │ steady_avg_ms │ steady_min_ms │ steady_max_ms │
├───────┼──────────┼──────────┼───────────────┼───────────────┼───────────────┤
│ 100   │ '0.1735' │ '0.0865' │ '0.0142'      │ '0.0101'      │ '0.0898'      │
│ 1000  │ '0.0097' │ '0.0113' │ '0.0081'      │ '0.0056'      │ '0.1277'      │
│ 5000  │ '0.0149' │ '0.0113' │ '0.0067'      │ '0.0054'      │ '0.0177'      │
└───────┴──────────┴──────────┴───────────────┴───────────────┴───────────────┘
```

Cold start overhead is sub-millisecond and absorbed after the first mutation.

✅ completed in 239.26ms

---

## Benchmark 8 — Explain Overhead Budget

Cost of calling `explain(path)` on top of a normal mutation cycle.

```
┌────────────────┬──────────┬──────────┬──────────┐
│ mode           │ p50_ms   │ p95_ms   │ p99_ms   │
├────────────────┼──────────┼──────────┼──────────┤
│ 'baseline'     │ '0.0077' │ '0.0122' │ '0.0199' │
│ 'with_explain' │ '0.0129' │ '0.0189' │ '0.0250' │
└────────────────┴──────────┴──────────┴──────────┘
p95 overhead: 55.15%
```

`explain()` adds ~0.007ms at p95. Auditable derivation traces at negligible cost.

✅ completed in 223.64ms

---

## Benchmark 9 — Secret-Scope Performance Impact

Public vs encrypted branch: mutation and read latency.

```
┌──────────┬──────────┬──────────┬──────────┐
│ scope    │ p50_ms   │ p95_ms   │ p99_ms   │
├──────────┼──────────┼──────────┼──────────┤
│ 'public' │ '0.0109' │ '0.0206' │ '0.0594' │
│ 'secret' │ '0.4951' │ '0.5592' │ '0.7615' │
└──────────┴──────────┴──────────┴──────────┘
secret-scope p95 slowdown: 2616.51%
```

Secret branches pay a ~27× overhead at p95 — expected cost of AES-GCM encryption/decryption per node. Design accordingly: keep hot-path reads on public branches; use secret scopes for data at rest.

✅ completed in 631.34ms

---

## Benchmark 10 — Push (Write) vs Pull (First Read)

Eager vs lazy recompute mode across fanout sizes.

```
┌─────────┬────────┬───┬─────────────────┬─────────────────┬─────────────────┬─────────────┬─────────────┬─────────────┐
│ mode    │ fanout │ k │ mutation_p50_ms │ mutation_p95_ms │ mutation_p99_ms │ read_p50_ms │ read_p95_ms │ read_p99_ms │
├─────────┼────────┼───┼─────────────────┼─────────────────┼─────────────────┼─────────────┼─────────────┼─────────────┤
│ 'eager' │ 10     │ 2 │ '0.0058'        │ '0.0132'        │ '0.0201'        │ '0.0065'    │ '0.0114'    │ '0.0702'    │
│ 'eager' │ 5000   │ 2 │ '0.0028'        │ '0.0036'        │ '0.0049'        │ '0.0027'    │ '0.0030'    │ '0.0054'    │
│ 'lazy'  │ 10     │ 2 │ '0.0023'        │ '0.0027'        │ '0.0038'        │ '0.0033'    │ '0.0047'    │ '0.0118'    │
│ 'lazy'  │ 5000   │ 2 │ '0.0028'        │ '0.0037'        │ '0.0051'        │ '0.0035'    │ '0.0039'    │ '0.0056'    │
└─────────┴────────┴───┴─────────────────┴─────────────────┴─────────────────┴─────────────┴─────────────┴─────────────┘
```

Full table: see fire.test.ts output. Both modes converge at scale; lazy has lower mutation cost, eager has lower first-read cost.

✅ completed in 474.46ms

---

## Benchmark 11 — Secret Push vs Pull

Isolates mutation cost (push) vs first read cost (pull) inside encrypted branches.

```
┌────────┬──────────┬───────┬─────────────────┬─────────────────┬─────────────┬─────────────┐
│ mode   │ plane    │ nodes │ mutation_p50_ms │ mutation_p95_ms │ read_p50_ms │ read_p95_ms │
├────────┼──────────┼───────┼─────────────────┼─────────────────┼─────────────┼─────────────┤
│ 'lazy' │ 'public' │ 100   │ '0.0058'        │ '0.0136'        │ '0.0070'    │ '0.0183'    │
│ 'lazy' │ 'secret' │ 100   │ '0.0293'        │ '0.0409'        │ '0.2940'    │ '0.3675'    │
│ 'lazy' │ 'public' │ 300   │ '0.0043'        │ '0.0108'        │ '0.0048'    │ '0.0123'    │
│ 'lazy' │ 'secret' │ 300   │ '0.0254'        │ '0.0313'        │ '0.2545'    │ '0.2864'    │
│ 'lazy' │ 'public' │ 600   │ '0.0032'        │ '0.0045'        │ '0.0036'    │ '0.0041'    │
│ 'lazy' │ 'secret' │ 600   │ '0.0267'        │ '0.0344'        │ '0.4972'    │ '0.5805'    │
└────────┴──────────┴───────┴─────────────────┴─────────────────┴─────────────┴─────────────┘
```

**Secret/Public slowdown ratios:**

| nodes | mutation p95 | read p95    |
|-------|-------------|-------------|
| 100   | 3.01×       | 20.08×      |
| 300   | 2.90×       | 23.28×      |
| 600   | 7.64×       | 141.59×     |

Secret read cost grows with node count because each read decrypts independently. Writes are cheaper than reads in the encrypted plane — the key derivation happens once at write, but each cold read re-derives.

✅ completed in 982.44ms

---

## Summary Table

| Benchmark | What it proves                                | Time       |
|-----------|-----------------------------------------------|------------|
| 1         | O(k) flat recompute (10 → 5,000 nodes)        | 341.71ms   |
| 2         | Flat scaling to 10,000 nodes                  | 1193.38ms  |
| 3         | Incremental processing stability              | 754.39ms   |
| 4         | Multi-shape stress (deep / wide / financial)  | 386.57ms   |
| 5         | Sustained throughput, no p95 drift            | 191.92ms   |
| 6         | Fan-out sensitivity (latency improves at scale)| 277.66ms  |
| 7         | Cold vs warm startup cost                     | 239.26ms   |
| 8         | explain() overhead (~0.007ms at p95)          | 223.64ms   |
| 9         | Secret scope cost (~27× vs public at p95)     | 631.34ms   |
| 10        | Eager vs lazy push/pull tradeoff              | 474.46ms   |
| 11        | Secret push vs pull at scale                  | 982.44ms   |
