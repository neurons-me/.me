# BASELINE-5-FINAL

Date: 2026-04-08

Commands:
- `node tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts`
- `node tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts`

Status:
- Fase 5 cerrada
- value-level v3 cacheado
- branch first-read-after-mutation amortizado con preload post-write
- runtime sin instrumentacion temporal de profiling

## Benchmark 9

Mode: `lazy`
Node count: `600`
Iterations: `120`

| Scope  | p50_ms | p95_ms | p99_ms |
|--------|--------|--------|--------|
| public | 0.0118 | 0.1668 | 0.2948 |
| secret | 1.8437 | 4.6503 | 9.7587 |

Secret-scope p95 slowdown: `2687.37%`

## Benchmark 11

Mode: `lazy`
Iterations: `120`

| Nodes | Plane  | mutation_p95_ms | read_p95_ms |
|-------|--------|-----------------|-------------|
| 100   | public | 0.0418          | 0.1162      |
| 100   | secret | 0.4299          | 2.9281      |
| 300   | public | 0.0125          | 0.0131      |
| 300   | secret | 0.2808          | 1.2443      |
| 600   | public | 0.0287          | 0.0241      |
| 600   | secret | 0.2040          | 1.8485      |

Slowdown ratios:

| Nodes | mutation_p95_slowdown_x | read_p95_slowdown_x |
|-------|-------------------------|---------------------|
| 100   | 10.28                   | 25.20               |
| 300   | 22.46                   | 94.98               |
| 600   | 7.11                    | 76.70               |

## Notes

- `benchmark.12.secret-read-hotspots.test.ts` fue retirado al cerrar la fase; era una herramienta de diagnostico temporal.
- `primeDecryptedBranchCache()` queda como parte estable del diseno de branch writes.
- Compatibilidad de lectura `legacy / v2 / v3` sigue intacta.
