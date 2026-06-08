# .me FIRETEST — Raw Results

```
suign@Suis-MacBook-Air Typescript % node tests/fire.test.ts      

========================================================
.me FIRETEST
========================================================

Running phases, v3 suites, benchmarks 1-11, and contracts summary.


========================================================
FIRETEST :: phases
========================================================


========================================================
.me KERNEL FIRE TEST (PHASES 0-8)
========================================================


--- Phase 0 - Identity + Secret Scope ---
   • Root identity claim (@) is accepted
   • Secret scope root stays stealth (undefined)
   • Secret leaf data remains readable by path
✅ Phase 0 - Identity + Secret Scope

--- Phase 1 - Structural [] Selectors ---
   • Bracket selector writes create indexed nodes
   • Bracket selector reads resolve exact indexed leaves
✅ Phase 1 - Structural [] Selectors

--- Phase 2 - [i] Broadcast with '=' ---
   • One rule is broadcast to all collection members
   • Each member gets an evaluated contextual result
✅ Phase 2 - [i] Broadcast with '='

--- Phase 3 - Logical Filters ---
   • Single and compound filters return only matching nodes
   • Filter evaluation works on derived fields
✅ Phase 3 - Logical Filters

--- Phase 3.1 - Filtered Broadcast ---
   • Broadcast assignment runs only on nodes matching filter
   • Non-matching nodes remain unchanged
✅ Phase 3.1 - Filtered Broadcast

--- Phase 4 - Range + Multi-Select ---
   • Range selectors [a..b] slice contiguous subsets
   • Multi-select selectors [[a,b,c]] slice sparse subsets
✅ Phase 4 - Range + Multi-Select

--- Phase 5 - Transform Projection ---
   • Read-only projection computes transformed values
   • Projection output is numeric per selected member
✅ Phase 5 - Transform Projection

--- Phase 6 - Contract Integrity ---
   • Cross-scope formula (public + secret leaf) computes deterministically
   • Final invariant equals expected numeric result
✅ Phase 6 - Contract Integrity

--- Phase 7A - Temporal Rehydration (Replay) ---
   • Memory log can be exported from the current runtime
   • A new empty instance can replay that memory
   • Replay reconstructs equivalent semantic results
✅ Phase 7A - Temporal Rehydration (Replay)

--- Phase 7B - Atomic Snapshot Rehydration ---
   • Snapshot exports full kernel state (memory + secrets + noises + encrypted branches)
   • A fresh runtime can import snapshot atomically
   • Imported runtime preserves exact encrypted structures and semantic outputs
✅ Phase 7B - Atomic Snapshot Rehydration

--- Phase 8 - Incremental Recompute + Explain ---
   • Derivation dependencies are tracked from '=' expressions
   • Changing a referenced leaf triggers targeted recompute
   • explain(path) exposes expression inputs with public/stealth origin
   • Stealth inputs are masked in explain() while still auditable
   • Invalid code tokens are rejected and remain declarative strings
   ⏳ Phase 8 loading dataset and derivations...
   ⏱️ setup completed in 92ms
   ⏱️ global dependency recompute in 26ms
   ⏱️ local dependency recompute in 0ms
   ✅ Phase 8 total runtime: 118ms
✅ Phase 8 - Incremental Recompute + Explain

========================================================
FIRE TEST SUMMARY: 11/11 phases passed
STATUS: ALL PHASES PASSED
========================================================


✅ FIRETEST :: phases completed in 184.98ms

========================================================
FIRETEST :: reconstruction
========================================================


════════════════════════════════════════════
 SECTION 1 — Basic Determinism
 Same seed → same identity. Always.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 2 — Isolation
 Different seeds → different identities.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 3 — Reconstruction
 Wipe. Reconstruct. Prove identical.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 4 — Seed Privacy
 Seed never appears in memory, snapshot, or paths.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 5 — Symbol Access
 Kernel internals accessible only via Symbols.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 6 — Cross-Instance Mathematical Proof
 identity = f(seed). Nothing else matters.
════════════════════════════════════════════

════════════════════════════════════════════
 RECONSTRUCTION TEST SUMMARY
════════════════════════════════════════════

  ✅ simple string seed produces stable identity
  ✅ 12-word phrase seed produces stable identity
  ✅ hex string seed produces stable identity
  ✅ sentence as seed produces stable identity
  ✅ unicode seed produces stable identity
  ✅ single character seed produces stable identity
  ✅ very long seed produces stable identity
  ✅ 256-bit random seed produces stable identity
  ✅ 'luna' and 'luna2' produce different identities
  ✅ 'jose' and 'JOSE' produce different identities
  ✅ 'abc' and 'abc ' (trailing space) produce different identities
  ✅ ten different seeds all produce distinct identities
  ✅ anagram seeds produce different identities
  ✅ reconstruction from seed produces identical identity hash
  ✅ reconstruction produces same namespace key material
  ✅ reconstruction works after writing secret scope data
  ✅ three independent reconstructions all produce same hash
  ✅ seed does not appear in memory log
  ✅ seed does not appear in snapshot export
  ✅ seed not readable through proxy path
  ✅ seed not enumerable on proxy surface
  ✅ me[Symbol.for('me.seed')] returns the seed
  ✅ me[Symbol.for('me.identity')] returns hash and expression
  ✅ identity hash is a valid hex string
  ✅ identity hash has fixed 64-hex length
  ✅ me[Symbol.for('me.expression')] returns null before @ is called
  ✅ root @ sets active expression and escape plane mirrors it
  ✅ scoped @ keeps claim behavior without replacing the kernel active expression
  ✅ identity hash is independent of write history
  ✅ identity hash is independent of creation time
  ✅ identity hash is independent of process state
  ✅ web3 analogy — same mnemonic always derives same address

32/32 tests passed

✅ RECONSTRUCTION PROOF COMPLETE
   same seed → same identity
   always. deterministically. on any device.
   the seed is the self.

✅ FIRETEST :: reconstruction completed in 125.39ms

========================================================
FIRETEST :: secret-material-v3
========================================================


### Secret Material V3
✅ same input yields the same chain and the same 32-byte material
✅ branch and value diverge for the same secret path
✅ sibling leaves share branch material but diverge at value level
✅ changing the active noise boundary changes derived material
✅ changing a relevant nested secret changes derived material
✅ branch mode rejects the root secret scope
✅ legacy effective secret behavior remains unchanged
✅ Secret material v3 suite passed

✅ FIRETEST :: secret-material-v3 completed in 86.58ms

========================================================
FIRETEST :: secret-blob-v3.read
========================================================


### Secret Blob V3 Read
✅ v3 branch blob reads through normal secret path
✅ v3 value-level blob reads through normal path
✅ value-level cache does not leak mutable object references
✅ value-level cache invalidates when secret epoch changes
✅ branch write preloads v3 keys cache for immediate cold read
✅ branch cache priming is scoped to the written chunk
✅ branch cache priming invalidates when secret epoch changes
✅ tampered branch blob bypasses primed cache and fails closed
✅ v2 and legacy blobs remain readable
✅ tampered v3 branch blob fails closed
✅ wrong secret for v3 branch blob fails closed
✅ wrong path for v3 value-level blob fails closed
✅ wrong noise for v3 branch blob fails closed
✅ Secret blob v3 read suite passed

✅ FIRETEST :: secret-blob-v3.read completed in 92.76ms

========================================================
FIRETEST :: secret-blob-v3.write
========================================================


### Secret Blob V3 Write
✅ default write now emits v3 branch blobs
✅ default write now emits v3 value-level blobs
✅ forcing v2 still emits v2 branch blobs and remains readable
✅ forcing v2 still emits v2 value-level blobs and remains readable
✅ migrateEncryptedBranchesToV3 migrates v2 chunks and preserves history
✅ migrateEncryptedBranchesToV3 skips already-v3 chunks
✅ tampering after migration still fails closed
✅ Secret blob v3 write suite passed

✅ FIRETEST :: secret-blob-v3.write completed in 77.86ms

========================================================
FIRETEST :: benchmark.1
========================================================


========================================================
.me ALGORITHMIC SCALING BENCHMARK (Hardware Agnostic)
========================================================

Testing how the kernel behaves as the dataset grows...
Goal: O(k) efficiency (work stays flat regardless of N)

> N = 10     | Time: 0.1094  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 100    | Time: 0.0746  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 1000   | Time: 0.0841  ms | Wave k: 2  | Result: 100 | overThreshold: true
> N = 5000   | Time: 0.0542  ms | Wave k: 2  | Result: 100 | overThreshold: true

--- Comparison Table ---
┌─────────┬───────┬──────────┬───┬────────┬───────────────┐
│ (index) │ nodes │ duration │ k │ result │ overThreshold │
├─────────┼───────┼──────────┼───┼────────┼───────────────┤
│ 0       │ 10    │ '0.1094' │ 2 │ 100    │ true          │
│ 1       │ 100   │ '0.0746' │ 2 │ 100    │ true          │
│ 2       │ 1000  │ '0.0841' │ 2 │ 100    │ true          │
│ 3       │ 5000  │ '0.0542' │ 2 │ 100    │ true          │
└─────────┴───────┴──────────┴───┴────────┴───────────────┘

[ANALYSIS]
✅ SUPERIORITY PROVEN: Response time stayed under 20ms even with 5000 nodes.
✅ ALGORITHMIC CONSTANCY: The actual recompute wave stayed at k=2.
Traditional systems would rescan with N; this benchmark keeps the mutation on one local lineage.
========================================================


✅ FIRETEST :: benchmark.1 completed in 341.71ms

========================================================
FIRETEST :: benchmark.2
========================================================

n,time_ms,wave_k,result,over_threshold
10,0.1080,2,100,true
100,0.0534,2,100,true
500,0.0534,2,100,true
1000,0.1051,2,100,true
2500,0.0686,2,100,true
5000,0.0532,2,100,true
7500,0.0518,2,100,true
10000,0.0521,2,100,true

✅ FIRETEST :: benchmark.2 completed in 1193.38ms

========================================================
FIRETEST :: benchmark.3
========================================================

n,time_ms,wave_k,result,over_threshold,status
> Procesando N=10... Hecho.
10,0.1055,2,100,true,OK
> Procesando N=100... Hecho.
100,0.0533,2,100,true,OK
> Procesando N=1000... Hecho.
1000,0.0728,2,100,true,OK
> Procesando N=5000... Hecho.
5000,0.0559,2,100,true,OK
> Procesando N=10000... Hecho.
10000,0.0789,2,100,true,OK

--- Benchmark Finalizado ---

✅ FIRETEST :: benchmark.3 completed in 754.39ms

========================================================
FIRETEST :: benchmark.4
========================================================

========================================================
 .me KERNEL: MULTI-DATASET STRESS LAB
 Author: suiGn | jose abella eggleton
========================================================


[DEEP_NESTING (500 levels)]
> Latency: 13.2138ms
> Wave k: 2
> Mutation path: root.n0.n1.n2...n499.factor  (500-level chain, truncated for readability)
> Result before/after: 50 -> 100
> overThreshold before/after: false -> true
> Status: ✅ Reactive

[WIDE_BROADCAST (1,000 nodes)]
> Latency: 0.0864ms
> Wave k: 2
> Mutation path: sensors.999.factor
> Result before/after: 50 -> 100
> overThreshold before/after: false -> true
> recomputed: ["sensors.999.result","sensors.999.overThreshold"]
> Status: ✅ Reactive

[FINANCIAL_DATASET (5,000 tx)]
> Latency: 0.0789ms
> Wave k: 2
> Mutation path: tx.4999.taxRate
> Result before/after: 116 -> 200
> overThreshold before/after: false -> true
> recomputed: ["tx.4999.total","tx.4999.overThreshold"]
> Status: ✅ Reactive

========================================================

✅ FIRETEST :: benchmark.4 completed in 386.57ms

========================================================
FIRETEST :: benchmark.5
========================================================


========================================================
.me BENCHMARK #5: THROUGHPUT UNDER SUSTAINED MUTATION
========================================================

Summary:
┌─────────┬───────────────────────┬──────────────────────┬─────────────────────┬─────────────────────┐
│ (index) │ p50                   │ p95                  │ p99                 │ max                 │
├─────────┼───────────────────────┼──────────────────────┼─────────────────────┼─────────────────────┤
│ 0       │ 0.0070419999999842275 │ 0.010957999999988033 │ 0.01791600000001381 │ 0.33141699999998764 │
└─────────┴───────────────────────┴──────────────────────┴─────────────────────┴─────────────────────┘
Windowed p95 drift check:
┌─────────┬─────────────┬──────────┬──────────┬──────────┐
│ (index) │ window      │ p50_ms   │ p95_ms   │ p99_ms   │
├─────────┼─────────────┼──────────┼──────────┼──────────┤
│ 0       │ '1-200'     │ '0.0088' │ '0.0157' │ '0.0218' │
│ 1       │ '201-400'   │ '0.0074' │ '0.0112' │ '0.0150' │
│ 2       │ '401-600'   │ '0.0071' │ '0.0128' │ '0.0210' │
│ 3       │ '601-800'   │ '0.0070' │ '0.0097' │ '0.0140' │
│ 4       │ '801-1000'  │ '0.0068' │ '0.0099' │ '0.0307' │
│ 5       │ '1001-1200' │ '0.0068' │ '0.0089' │ '0.0142' │
│ 6       │ '1201-1400' │ '0.0068' │ '0.0083' │ '0.0115' │
│ 7       │ '1401-1600' │ '0.0071' │ '0.0101' │ '0.0164' │
│ 8       │ '1601-1800' │ '0.0067' │ '0.0079' │ '0.0115' │
│ 9       │ '1801-2000' │ '0.0070' │ '0.0110' │ '0.0148' │
└─────────┴─────────────┴──────────┴──────────┴──────────┘
p95 drift: -30.16%

✅ FIRETEST :: benchmark.5 completed in 191.92ms

========================================================
FIRETEST :: benchmark.6
========================================================


========================================================
.me BENCHMARK #6: FAN-OUT SENSITIVITY CURVES
========================================================

> Running fanout=10... done.
> Running fanout=100... done.
> Running fanout=500... done.
> Running fanout=1000... done.
> Running fanout=2500... done.
> Running fanout=5000... done.
┌─────────┬────────┬───┬──────────┬──────────┬──────────┬──────────┐
│ (index) │ fanout │ k │ p50_ms   │ p95_ms   │ p99_ms   │ max_ms   │
├─────────┼────────┼───┼──────────┼──────────┼──────────┼──────────┤
│ 0       │ 10     │ 2 │ '0.0124' │ '0.0189' │ '0.0253' │ '0.0934' │
│ 1       │ 100    │ 2 │ '0.0082' │ '0.0160' │ '0.0201' │ '0.0230' │
│ 2       │ 500    │ 2 │ '0.0074' │ '0.0105' │ '0.0161' │ '0.0184' │
│ 3       │ 1000   │ 2 │ '0.0062' │ '0.0078' │ '0.0102' │ '0.0193' │
│ 4       │ 2500   │ 2 │ '0.0061' │ '0.0083' │ '0.0120' │ '0.0134' │
│ 5       │ 5000   │ 2 │ '0.0057' │ '0.0067' │ '0.0089' │ '0.0105' │
└─────────┴────────┴───┴──────────┴──────────┴──────────┴──────────┘

✅ FIRETEST :: benchmark.6 completed in 277.66ms

========================================================
FIRETEST :: benchmark.7
========================================================


========================================================
.me BENCHMARK #7: COLD VS WARM RUNTIME PROFILES
========================================================

┌─────────┬───────┬──────────┬──────────┬───────────────┬───────────────┬───────────────┐
│ (index) │ nodes │ cold_ms  │ warm_ms  │ steady_avg_ms │ steady_min_ms │ steady_max_ms │
├─────────┼───────┼──────────┼──────────┼───────────────┼───────────────┼───────────────┤
│ 0       │ 100   │ '0.1735' │ '0.0865' │ '0.0142'      │ '0.0101'      │ '0.0898'      │
│ 1       │ 1000  │ '0.0097' │ '0.0113' │ '0.0081'      │ '0.0056'      │ '0.1277'      │
│ 2       │ 5000  │ '0.0149' │ '0.0113' │ '0.0067'      │ '0.0054'      │ '0.0177'      │
└─────────┴───────┴──────────┴──────────┴───────────────┴───────────────┴───────────────┘

✅ FIRETEST :: benchmark.7 completed in 239.26ms

========================================================
FIRETEST :: benchmark.8
========================================================


========================================================
.me BENCHMARK #8: EXPLAIN OVERHEAD BUDGET
========================================================

┌─────────┬────────────────┬──────────┬──────────┬──────────┐
│ (index) │ mode           │ p50_ms   │ p95_ms   │ p99_ms   │
├─────────┼────────────────┼──────────┼──────────┼──────────┤
│ 0       │ 'baseline'     │ '0.0077' │ '0.0122' │ '0.0199' │
│ 1       │ 'with_explain' │ '0.0129' │ '0.0189' │ '0.0250' │
└─────────┴────────────────┴──────────┴──────────┴──────────┘
p95 overhead: 55.15%

✅ FIRETEST :: benchmark.8 completed in 223.64ms

========================================================
FIRETEST :: benchmark.9
========================================================


========================================================
.me BENCHMARK #9: SECRET-SCOPE PERFORMANCE IMPACT
========================================================

mode=lazy | nodeCount=600 | iterations=120
> setup public... done.
> run public loop... done.
> setup secret... done.
> run secret loop... done.
┌─────────┬──────────┬──────────┬──────────┬──────────┐
│ (index) │ scope    │ p50_ms   │ p95_ms   │ p99_ms   │
├─────────┼──────────┼──────────┼──────────┼──────────┤
│ 0       │ 'public' │ '0.0109' │ '0.0206' │ '0.0594' │
│ 1       │ 'secret' │ '0.4951' │ '0.5592' │ '0.7615' │
└─────────┴──────────┴──────────┴──────────┴──────────┘
secret-scope p95 slowdown: 2616.51%

✅ FIRETEST :: benchmark.9 completed in 631.34ms

========================================================
FIRETEST :: benchmark.10
========================================================


========================================================
.me BENCHMARK #10: PUSH (WRITE) VS PULL (FIRST READ)
========================================================


Mode: EAGER
> dual analysis mode=eager fanout=10... done.
> dual analysis mode=eager fanout=100... done.
> dual analysis mode=eager fanout=500... done.
> dual analysis mode=eager fanout=1000... done.
> dual analysis mode=eager fanout=2500... done.
> dual analysis mode=eager fanout=5000... done.

Mode: LAZY
> dual analysis mode=lazy fanout=10... done.
> dual analysis mode=lazy fanout=100... done.
> dual analysis mode=lazy fanout=500... done.
> dual analysis mode=lazy fanout=1000... done.
> dual analysis mode=lazy fanout=2500... done.
> dual analysis mode=lazy fanout=5000... done.
┌─────────┬─────────┬────────┬───┬─────────────────┬─────────────────┬─────────────────┬─────────────┬─────────────┬─────────────┐
│ (index) │ mode    │ fanout │ k │ mutation_p50_ms │ mutation_p95_ms │ mutation_p99_ms │ read_p50_ms │ read_p95_ms │ read_p99_ms │
├─────────┼─────────┼────────┼───┼─────────────────┼─────────────────┼─────────────────┼─────────────┼─────────────┼─────────────┤
│ 0       │ 'eager' │ 10     │ 2 │ '0.0058'        │ '0.0132'        │ '0.0201'        │ '0.0065'    │ '0.0114'    │ '0.0702'    │
│ 1       │ 'eager' │ 100    │ 2 │ '0.0048'        │ '0.0087'        │ '0.0381'        │ '0.0035'    │ '0.0067'    │ '0.0118'    │
│ 2       │ 'eager' │ 500    │ 2 │ '0.0039'        │ '0.0060'        │ '0.0124'        │ '0.0041'    │ '0.0056'    │ '0.0075'    │
│ 3       │ 'eager' │ 1000   │ 2 │ '0.0036'        │ '0.0053'        │ '0.0083'        │ '0.0030'    │ '0.0042'    │ '0.0084'    │
│ 4       │ 'eager' │ 2500   │ 2 │ '0.0033'        │ '0.0053'        │ '0.0071'        │ '0.0029'    │ '0.0037'    │ '0.0045'    │
│ 5       │ 'eager' │ 5000   │ 2 │ '0.0028'        │ '0.0036'        │ '0.0049'        │ '0.0027'    │ '0.0030'    │ '0.0054'    │
│ 6       │ 'lazy'  │ 10     │ 2 │ '0.0023'        │ '0.0027'        │ '0.0038'        │ '0.0033'    │ '0.0047'    │ '0.0118'    │
│ 7       │ 'lazy'  │ 100    │ 2 │ '0.0034'        │ '0.0044'        │ '0.0159'        │ '0.0035'    │ '0.0038'    │ '0.0057'    │
│ 8       │ 'lazy'  │ 500    │ 2 │ '0.0029'        │ '0.0043'        │ '0.0063'        │ '0.0034'    │ '0.0042'    │ '0.0123'    │
│ 9       │ 'lazy'  │ 1000   │ 2 │ '0.0031'        │ '0.0047'        │ '0.0058'        │ '0.0037'    │ '0.0039'    │ '0.0049'    │
│ 10      │ 'lazy'  │ 2500   │ 2 │ '0.0029'        │ '0.0038'        │ '0.0059'        │ '0.0034'    │ '0.0043'    │ '0.0066'    │
│ 11      │ 'lazy'  │ 5000   │ 2 │ '0.0028'        │ '0.0037'        │ '0.0051'        │ '0.0035'    │ '0.0039'    │ '0.0056'    │
└─────────┴─────────┴────────┴───┴─────────────────┴─────────────────┴─────────────────┴─────────────┴─────────────┴─────────────┘

✅ FIRETEST :: benchmark.10 completed in 474.46ms

========================================================
FIRETEST :: benchmark.11
========================================================


========================================================
.me BENCHMARK #11: SECRET PUSH VS PULL
========================================================

mode=lazy | nodeCounts=100,300,600 | iterations=120
> run plane=public n=100... done.
> run plane=secret n=100... done.
> run plane=public n=300... done.
> run plane=secret n=300... done.
> run plane=public n=600... done.
> run plane=secret n=600... done.
┌─────────┬────────┬──────────┬───────┬─────────────────┬─────────────────┬─────────────────┬─────────────┬─────────────┬─────────────┐
│ (index) │ mode   │ plane    │ nodes │ mutation_p50_ms │ mutation_p95_ms │ mutation_p99_ms │ read_p50_ms │ read_p95_ms │ read_p99_ms │
├─────────┼────────┼──────────┼───────┼─────────────────┼─────────────────┼─────────────────┼─────────────┼─────────────┼─────────────┤
│ 0       │ 'lazy' │ 'public' │ 100   │ '0.0058'        │ '0.0136'        │ '0.0281'        │ '0.0070'    │ '0.0183'    │ '0.0765'    │
│ 1       │ 'lazy' │ 'secret' │ 100   │ '0.0293'        │ '0.0409'        │ '0.0743'        │ '0.2940'    │ '0.3675'    │ '0.4055'    │
│ 2       │ 'lazy' │ 'public' │ 300   │ '0.0043'        │ '0.0108'        │ '0.0226'        │ '0.0048'    │ '0.0123'    │ '0.0436'    │
│ 3       │ 'lazy' │ 'secret' │ 300   │ '0.0254'        │ '0.0313'        │ '0.0464'        │ '0.2545'    │ '0.2864'    │ '0.4182'    │
│ 4       │ 'lazy' │ 'public' │ 600   │ '0.0032'        │ '0.0045'        │ '0.0052'        │ '0.0036'    │ '0.0041'    │ '0.0057'    │
│ 5       │ 'lazy' │ 'secret' │ 600   │ '0.0267'        │ '0.0344'        │ '0.0425'        │ '0.4972'    │ '0.5805'    │ '0.6732'    │
└─────────┴────────┴──────────┴───────┴─────────────────┴─────────────────┴─────────────────┴─────────────┴─────────────┴─────────────┘

Secret/Public p95 slowdown ratios:
┌─────────┬───────┬─────────────────────────┬─────────────────────┐
│ (index) │ nodes │ mutation_p95_slowdown_x │ read_p95_slowdown_x │
├─────────┼───────┼─────────────────────────┼─────────────────────┤
│ 0       │ 100   │ '3.01'                  │ '20.08'             │
│ 1       │ 300   │ '2.90'                  │ '23.28'             │
│ 2       │ 600   │ '7.64'                  │ '141.59'            │
└─────────┴───────┴─────────────────────────┴─────────────────────┘

✅ FIRETEST :: benchmark.11 completed in 982.44ms

========================================================
FIRETEST :: contracts-summary
========================================================


> this.me@3.9.1 test:contracts
> node tests/contracts/run-contracts.mjs


### DSL Contract Tests (Phase 6)
✅ boot + basic set/get
✅ constructor bootstrap preserves callable proxy after hydrate
✅ execute dispatch keeps kernel and keyspace routes stable
✅ mutation helpers preserve learn + replay semantics
✅ public memory surfaces redact effectiveSecret and stay replayable
✅ snapshot import accepts both public and legacy memory payloads
✅ phase1 selector [] fixed id
✅ phase2 iterator broadcast [i] with '='
✅ phase3 filter read + phase3.1 logical filters
✅ phase3.1 filtered broadcast for '='
✅ phase4 multi-select and range
✅ phase5 transform projection
✅ runtime escape plane exposes reflective kernel helpers
✅ explicit guest scope does not collapse back to owner scope
✅ explain() masks stealth inputs while keeping public inputs visible
✅ explain() exposes expr plus recompute wave metadata for the selected target
✅ secret branch blobs are non-deterministic across identical writes
✅ tampered v2 secret blobs fail closed
✅ legacy xor secret snapshots still decrypt after v2 hardening
✅ secret caches stay bounded under broad secret traversal
✅ Phase 6 contract suite passed

### Secret Blob Hardening Contracts (4B.0)
✅ legacy secret snapshot still decrypts correctly
✅ v2 secret branch snapshot still decrypts correctly
✅ mixed public+secret snapshot rehydrates without leaking
✅ secret root stays stealth after rehydrate
✅ pointer into secret branch still resolves correctly
✅ tampered branch blob fails closed
✅ tampered value-level encrypted leaf fails closed
✅ wrong secret key fails closed
✅ wrong noise boundary fails closed
✅ blob copied to sibling scope path does not decrypt
✅ replay from public memories preserves secret semantics
✅ Secret blob hardening contract suite passed

✅ FIRETEST :: contracts-summary completed in 262.07ms

========================================================
.me FIRETEST SUMMARY
========================================================

✅ phases                 184.98ms
✅ reconstruction         125.39ms
✅ secret-material-v3     86.58ms
✅ secret-blob-v3.read    92.76ms
✅ secret-blob-v3.write   77.86ms
✅ benchmark.1            341.71ms
✅ benchmark.2            1193.38ms
✅ benchmark.3            754.39ms
✅ benchmark.4            386.57ms
✅ benchmark.5            191.92ms
✅ benchmark.6            277.66ms
✅ benchmark.7            239.26ms
✅ benchmark.8            223.64ms
✅ benchmark.9            631.34ms
✅ benchmark.10           474.46ms
✅ benchmark.11           982.44ms
✅ contracts-summary      262.07ms

STATUS: ALL FIRETEST TASKS PASSED
```
