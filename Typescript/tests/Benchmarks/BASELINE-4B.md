# 4B Baseline

Captured before touching secret blob crypto for 4B hardening.

Date:

- 2026-04-07

Environment:

- default benchmark parameters
- local machine run
- mode: `lazy`

Commands:

```bash
node tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts
node tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts
```

## Benchmark 9 — Secret Scope Impact

Parameters:

- `nodeCount=600`
- `iterations=120`

Results:

| scope  | p50_ms | p95_ms | p99_ms |
|--------|--------|--------|--------|
| public | 0.0097 | 0.0226 | 0.1390 |
| secret | 2.4279 | 4.6248 | 5.5258 |

Derived metric:

- secret-scope p95 slowdown: `20341.25%`

## Benchmark 11 — Secret Push vs Pull

Parameters:

- `nodeCounts=100,300,600`
- `iterations=120`

Results:

| plane  | nodes | mutation_p50_ms | mutation_p95_ms | mutation_p99_ms | read_p50_ms | read_p95_ms | read_p99_ms |
|--------|-------|------------------|------------------|------------------|-------------|-------------|-------------|
| public | 100   | 0.0057           | 0.0097           | 0.0352           | 0.0058      | 0.0136      | 0.0919      |
| secret | 100   | 0.0842           | 0.1256           | 0.1975           | 1.4385      | 2.0321      | 2.2477      |
| public | 300   | 0.0037           | 0.0050           | 0.0064           | 0.0040      | 0.0048      | 0.0089      |
| secret | 300   | 0.1029           | 0.1976           | 0.2822           | 1.0146      | 1.6154      | 1.8839      |
| public | 600   | 0.0038           | 0.0065           | 0.0097           | 0.0037      | 0.0050      | 0.0240      |
| secret | 600   | 0.0903           | 0.2147           | 0.4981           | 1.4665      | 2.6477      | 3.7042      |

Slowdown ratios:

| nodes | mutation_p95_slowdown_x | read_p95_slowdown_x |
|-------|---------------------------|---------------------|
| 100   | 12.95                     | 149.42              |
| 300   | 39.52                     | 336.54              |
| 600   | 33.03                     | 529.54              |

## Notes

- This baseline is intentionally conservative and hardware-local.
- The goal for 4B is not to beat public reads.
- The goal is: no visible regression in sync secret reads while improving material quality and compatibility guarantees.
