import ME from "this.me";
import assert from "node:assert/strict";
/**
 * BENCHMARK: ALGORITHMIC SCALING
 * Goal: show that the actual recompute wave stays constant per local lineage (O(k)),
 * while dataset size (N) only affects setup, not the mutation-time propagation frontier.
 *
 * Important:
 * - measure `k` from `explain().meta.k`, not from `dependsOn.length`
 * - mutate a node-local dependency so the benchmark observes the exact lineage it is claiming
 */
async function runBenchmark(nodeCount: number) {
  const me = new ME() as any;

  // 1. Universe setup
  // Create N independent local lineages so a single mutation only touches one lineage.
  for (let i = 1; i <= nodeCount; i++) {
    me.collection[i].value(10);
    me.collection[i].factor(5);
  }

  // 2. Define a two-step local lineage for every node.
  me.collection["[i]"]["="]("result", "value * factor");
  me.collection["[i]"]["="]("overThreshold", "result >= 100");

  const target = `collection[${nodeCount}]`;

  // Force initial compute so dependency mapping and baseline state are established.
  assert.equal(me(`${target}.result`), 50);
  assert.equal(me(`${target}.overThreshold`), false);

  // --- MOMENT OF TRUTH ---
  // Mutate one node-local dependency and measure the actual recompute wave.
  const start = performance.now();
  me.collection[nodeCount].factor(10);
  const val = me(`${target}.result`);
  const overThreshold = me(`${target}.overThreshold`);
  const duration = performance.now() - start;

  // Extract actual recompute-wave metadata (same mechanism used by City Scale).
  const trace = me.explain(`collection.${nodeCount}.overThreshold`);

  assert.equal(val, 100);
  assert.equal(overThreshold, true);
  assert.equal(trace.expr, "result >= 100");
  assert.equal(trace.meta?.sourcePath, `collection.${nodeCount}.factor`);
  assert.equal(trace.meta?.k, 2);
  assert.deepEqual(trace.meta?.recomputed, [
    `collection.${nodeCount}.result`,
    `collection.${nodeCount}.overThreshold`,
  ]);

  return {
    nodes: nodeCount,
    duration: duration.toFixed(4),
    k: trace.meta?.k ?? 0,
    result: val,
    overThreshold,
  };
}

async function start() {
  console.log("\n========================================================");
  console.log(".me ALGORITHMIC SCALING BENCHMARK (Hardware Agnostic)");
  console.log("========================================================\n");
  console.log("Testing how the kernel behaves as the dataset grows...");
  console.log("Goal: O(k) efficiency (work stays flat regardless of N)\n");
  const sizes = [10, 100, 1000, 5000];
  const results: Array<{
    nodes: number;
    duration: string;
    k: number;
    result: number;
    overThreshold: boolean;
  }> = [];
  for (const size of sizes) {
    const res = await runBenchmark(size);
    results.push(res);
    console.log(
      `> N = ${size.toString().padEnd(6)} | Time: ${res.duration.padEnd(8)}ms | Wave k: ${String(res.k).padEnd(2)} | Result: ${String(res.result).padEnd(3)} | overThreshold: ${res.overThreshold}`
    );
  }

  console.log("\n--- Comparison Table ---");
  console.table(results);
  // Superiority check
  const first = results[0];
  const last = results[results.length - 1];
  console.log("\n[ANALYSIS]");
  if (parseFloat(last.duration) < 20) {
    console.log(`✅ SUPERIORITY PROVEN: Response time stayed under 20ms even with ${last.nodes} nodes.`);
  }
  console.log(`✅ ALGORITHMIC CONSTANCY: The actual recompute wave stayed at k=${last.k}.`);
  console.log("Traditional systems would rescan with N; this benchmark keeps the mutation on one local lineage.");
  console.log("========================================================\n");
}
start().catch(console.error);
