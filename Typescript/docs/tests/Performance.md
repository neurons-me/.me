# Performance & Benchmarks

Benchmarks live in `tests/Benchmarks/` and track:

- throughput stability,
- fan-out behavior,
- cold vs warm profiles,
- explain overhead,
- secret-path performance,
- push vs pull isolation,
- CI regression gates.

## Benchmark Files

| File | Focus |
|---|---|
| `benchmark.5.sustained-mutation.test.ts` | sustained mutation throughput |
| `benchmark.6.fanout-sensitivity.test.ts` | fan-out sensitivity |
| `benchmark.7.cold-warm-profiles.test.ts` | cold/warm/steady profile split |
| `benchmark.8.explain-overhead.test.ts` | explain overhead budget |
| `benchmark.9.secret-scope-impact.test.ts` | secret/public latency envelope |
| `benchmark.10.push-vs-pull.test.ts` | eager vs lazy write/read isolation |
| `benchmark.11.secret-push-vs-pull.test.ts` | secret/public push-read isolation |
| `benchmark.regression-gate.test.ts` | CI pass/fail thresholds |

Run examples:

```bash
node tests/Benchmarks/benchmark.5.sustained-mutation.test.ts
node tests/Benchmarks/benchmark.10.push-vs-pull.test.ts
node tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts
node tests/Benchmarks/benchmark.regression-gate.test.ts
```

For detailed benchmark analysis and latest result tables, see:

- [Kernel Benchmarks](/kernel/Benchmarks)
