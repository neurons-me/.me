import { performance } from "node:perf_hooks";
import { createMe, define, subscribe, write } from "../../src/kernel/cascade.ts";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[index];
}

async function bench() {
  const db = createMe();

  for (let i = 0; i < 10; i++) {
    define(db, `a${i}`, i < 9 ? [`a${i + 1}`] : []);
  }

  let flushRuns = 0;
  let resolveFlush: (() => void) | null = null;

  subscribe(db, "a0", () => {
    flushRuns++;
    const done = resolveFlush;
    resolveFlush = null;
    done?.();
  });

  for (let i = 0; i < 100; i++) {
    await new Promise<void>((resolve) => {
      resolveFlush = resolve;
      write(db, "a9", i);
    });
  }

  const N = 1000;
  const enqueueTimes: number[] = [];
  const flushTimes: number[] = [];

  for (let i = 0; i < N; i++) {
    const value = 100 + i;
    const flushPromise = new Promise<void>((resolve) => {
      resolveFlush = resolve;
    });

    const t0 = performance.now();
    write(db, "a9", value);
    const t1 = performance.now();
    enqueueTimes.push(t1 - t0);

    await flushPromise;
    const t2 = performance.now();
    flushTimes.push(t2 - t0);
  }

  console.log("============================================================");
  console.log(".me CASCADE LAZY BENCHMARK");
  console.log("============================================================");
  console.log(`cascadeLazy 10-dep FLUSH p50: ${percentile(flushTimes, 0.5).toFixed(3)}ms`);
  console.log(`cascadeLazy 10-dep FLUSH p99: ${percentile(flushTimes, 0.99).toFixed(3)}ms`);
  console.log(`cascadeLazy 10-dep enqueue p50: ${percentile(enqueueTimes, 0.5).toFixed(3)}ms`);
  console.log(`cascadeLazy 10-dep enqueue p99: ${percentile(enqueueTimes, 0.99).toFixed(3)}ms`);
  console.log(`flush runs: ${flushRuns}`);
}

bench().catch((error) => {
  console.error("\nFAIL: benchmark.cascade-10dep.ts");
  console.error(error);
  process.exitCode = 1;
});
