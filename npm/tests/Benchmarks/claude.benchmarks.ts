/**
 * benchmark.me.test.ts
 *
 * Probes four claims from the .me post:
 *   1. O(k) — recompute cost scales with dependency count, not dataset size
 *   2. Secret scope cost — structural privacy penalty, bounded and sub-1ms
 *   3. explain() overhead — auditable derivations without killing latency
 *   4. Mutation latency — write cost stays flat as graph grows
 *
 * Run: node --loader ts-node/esm benchmark.me.test.ts
 *  or: npx ts-node benchmark.me.test.ts
 */

import Me from "this.me";

type CallableMe = InstanceType<typeof Me> & ((expr: string) => unknown);

// ─── Utilities ────────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function p95(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)];
}

function p99(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.99)];
}

function stats(samples: number[]) {
  const med = median(samples);
  const _p95 = p95(samples);
  const _p99 = p99(samples);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { mean, median: med, p95: _p95, p99: _p99 };
}

function hr(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

const RUNS = 200; // samples per measurement

// ─── Test 1: O(k) — fanout vs latency ────────────────────────────────────────
//
// Claim: latency depends on k (number of dependencies that must recompute),
// not on n (total nodes in the graph).
//
// Design: k is fixed at 2 (only trucks[1] and trucks[2] depend on fuel_price).
// n grows (10 → 10000 trucks total). If the claim holds, latency stays flat.
// If O(n), latency should grow ~1000x from n=10 to n=10000.

async function testOK() {
  hr("TEST 1 — O(k): fixed k=2, growing n");
  console.log("n\t\tmedian_ms\tp95_ms\t\tp99_ms\t\tΔ_vs_n10");

  const sizes = [10, 100, 500, 1000, 2500, 5000, 7500, 10000];
  let baseline: number | null = null;

  for (const n of sizes) {
    const samples: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const me = new Me() as CallableMe;

      // Build n trucks — only trucks[1] and [2] have a cost derivation
      for (let i = 1; i <= n; i++) me.fleet.trucks[i].fuel(100 + i);
      me.finance.fuel_price(24.5);
      me.fleet.trucks[1]["="]("cost", "fuel * finance.fuel_price");
      me.fleet.trucks[2]["="]("cost", "fuel * finance.fuel_price");

      me("fleet.trucks[1].cost"); // warmup — prime caches

      const t0 = performance.now();
      me.finance.fuel_price(25); // single mutation
      me("fleet.trucks[1].cost"); // force recompute of k=2 paths
      me("fleet.trucks[2].cost");
      const t1 = performance.now();

      samples.push(t1 - t0);
    }

    const s = stats(samples);
    if (baseline === null) baseline = s.median;
    const ratio = (s.median / baseline).toFixed(2);
    console.log(
      `n=${n.toString().padEnd(6)}\t${s.median.toFixed(4)}\t\t${s.p95.toFixed(4)}\t\t${s.p99.toFixed(4)}\t\t${ratio}x`
    );
  }

  console.log(
    "\nExpected: ratio column stays near 1.0x. O(n) would show ~1000x at n=10000."
  );
}

// ─── Test 2: k sensitivity — does latency actually scale with k? ──────────────
//
// The complement of Test 1. Here n is fixed, k grows (1 → 64 dependents).
// This validates that when you DO have more dependencies, cost scales linearly
// with k, not explosively. Also reveals the per-dependency cost in ns.

async function testKSensitivity() {
  hr("TEST 2 — k sensitivity: fixed n=1000, growing k");
  console.log("k\t\tmedian_ms\tp95_ms\t\tcost_per_dep_µs");

  const N = 1000;
  const kValues = [1, 2, 4, 8, 16, 32, 64];

  for (const k of kValues) {
    const samples: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const me = new Me() as CallableMe;

      for (let i = 1; i <= N; i++) me.fleet.trucks[i].fuel(100);
      me.finance.fuel_price(24.5);

      // Wire exactly k trucks to cost derivation
      for (let i = 1; i <= k; i++) {
        me.fleet.trucks[i]["="]("cost", "fuel * finance.fuel_price");
      }

      me("fleet.trucks[1].cost"); // warmup

      const t0 = performance.now();
      me.finance.fuel_price(25);
      // Read all k dependents to force full recompute
      for (let i = 1; i <= k; i++) me(`fleet.trucks[${i}].cost`);
      const t1 = performance.now();

      samples.push(t1 - t0);
    }

    const s = stats(samples);
    const costPerDep = ((s.median / k) * 1000).toFixed(2); // µs per dep
    console.log(
      `k=${k.toString().padEnd(4)}\t\t${s.median.toFixed(4)}\t\t${s.p95.toFixed(4)}\t\t${costPerDep}µs`
    );
  }

  console.log(
    "\nExpected: median grows roughly linearly with k. cost_per_dep_µs stays stable."
  );
}

// ─── Test 3: Secret scope cost ────────────────────────────────────────────────
//
// Claim: structural privacy (stealth scope via _ marker) costs <1ms p95.
// The post reports 0.75–0.88ms secret vs 0.016ms public.
//
// Design: same derivation, one public one secret. Measure read latency for both.
// Also tests that a guest caller sees the path as opaque.

async function testSecretScope() {
  hr("TEST 3 — Structural privacy: public vs secret path latency");

  const publicSamples: number[] = [];
  const secretSamples: number[] = [];

  for (let run = 0; run < RUNS; run++) {
    // PUBLIC path
    const meP = new Me() as CallableMe;
    meP.finance.fuel_price(24.5);
    meP.fleet.trucks[1].fuel(200);
    meP.fleet.trucks[1]["="]("cost", "fuel * finance.fuel_price");
    meP("fleet.trucks[1].cost"); // warmup

    const t0 = performance.now();
    meP.finance.fuel_price(25);
    meP("fleet.trucks[1].cost");
    const t1 = performance.now();
    publicSamples.push(t1 - t0);

    // SECRET path
    const meS = new Me() as CallableMe;
    meS.finance["_"]("k-2026"); // stealth scope
    meS.finance.fuel_price(24.5);
    meS.fleet.trucks[1].fuel(200);
    meS.fleet.trucks[1]["="]("cost", "fuel * finance.fuel_price");
    meS("fleet.trucks[1].cost"); // warmup

    const t2 = performance.now();
    meS.finance.fuel_price(25);
    meS("fleet.trucks[1].cost");
    const t3 = performance.now();
    secretSamples.push(t3 - t2);
  }

  const pub = stats(publicSamples);
  const sec = stats(secretSamples);
  const ratio = (sec.median / pub.median).toFixed(1);

  console.log("\t\tmedian_ms\tp95_ms\t\tp99_ms");
  console.log(
    `public\t\t${pub.median.toFixed(4)}\t\t${pub.p95.toFixed(4)}\t\t${pub.p99.toFixed(4)}`
  );
  console.log(
    `secret\t\t${sec.median.toFixed(4)}\t\t${sec.p95.toFixed(4)}\t\t${sec.p99.toFixed(4)}`
  );
  console.log(`\nSecret/public ratio: ${ratio}x`);
  console.log(
    `Secret p95 sub-1ms: ${sec.p95 < 1 ? "✅ PASS" : "❌ FAIL"} (${sec.p95.toFixed(4)}ms)`
  );

  // Verify correctness: guest callers should not inherit the owner stealth scope
  const meCheck = new Me() as CallableMe;
  meCheck.finance["_"]("k-2026");
  meCheck.finance.fuel_price(99);
  const leaked = (meCheck.as(null) as CallableMe)("finance.fuel_price");
  console.log(
    `\nGuest secrecy correctness (should be undefined): ${leaked === undefined ? "✅ PASS" : `❌ FAIL — got ${leaked}`}`
  );
}

// ─── Test 4: explain() overhead ───────────────────────────────────────────────
//
// Claim: explain() adds ~25% p95 overhead. Absolute cost stays ~0.017ms.
// This matters for production tracing / audit use cases.

async function testExplainOverhead() {
  hr("TEST 4 — explain() overhead: raw read vs traced read");

  const rawSamples: number[] = [];
  const explainSamples: number[] = [];

  for (let run = 0; run < RUNS; run++) {
    const me = new Me() as CallableMe;
    me.finance.fuel_price(24.5);
    me.fleet.trucks[2].fuel(350);
    me.fleet.trucks[2]["="]("cost", "fuel * finance.fuel_price");
    me("fleet.trucks[2].cost"); // warmup

    // Raw read
    const t0 = performance.now();
    me.finance.fuel_price(25);
    me("fleet.trucks[2].cost");
    const t1 = performance.now();
    rawSamples.push(t1 - t0);

    // explain() read
    const t2 = performance.now();
    me.finance.fuel_price(26);
    (me as any).explain("fleet.trucks.2.cost");
    const t3 = performance.now();
    explainSamples.push(t3 - t2);
  }

  const raw = stats(rawSamples);
  const exp = stats(explainSamples);
  const overhead = (((exp.median - raw.median) / raw.median) * 100).toFixed(1);

  console.log("\t\tmedian_ms\tp95_ms\t\tp99_ms");
  console.log(
    `raw read\t${raw.median.toFixed(4)}\t\t${raw.p95.toFixed(4)}\t\t${raw.p99.toFixed(4)}`
  );
  console.log(
    `explain()\t${exp.median.toFixed(4)}\t\t${exp.p95.toFixed(4)}\t\t${exp.p99.toFixed(4)}`
  );
  console.log(`\nOverhead: ${overhead}% (post claims ~25%)`);
  console.log(`explain() p95 sub-0.05ms: ${exp.p95 < 0.05 ? "✅ PASS" : "⚠️  CHECK"} (${exp.p95.toFixed(4)}ms)`);

  // Spot-check explain() output structure with a stealth dependency
  const meCheck = new Me() as CallableMe;
  meCheck.finance["_"]("k-2026");
  meCheck.finance.fuel_price(24.5);
  meCheck.fleet.trucks[2].fuel(350);
  meCheck.fleet.trucks[2]["="]("cost", "fuel * finance.fuel_price");
  meCheck("fleet.trucks[2].cost");
  const explanation = (meCheck as any).explain("fleet.trucks.2.cost");
  const secretInput = explanation?.derivation?.inputs?.find(
    (input: { path: string }) => input.path === "finance.fuel_price"
  );
  console.log("\nexplain() output sample:");
  console.log(JSON.stringify(explanation, null, 2));
  console.log(
    `explain() stealth masking: ${
      secretInput?.origin === "stealth" &&
      secretInput?.masked === true &&
      secretInput?.value === "●●●●"
        ? "✅ PASS"
        : `❌ FAIL (${JSON.stringify(secretInput)})`
    }`
  );
}

// ─── Test 5: Mutation latency as graph grows ──────────────────────────────────
//
// Separate write cost from read cost. How expensive is mutation alone
// (invalidation + stale-marking) as n grows? Should stay flat if mutation
// only touches the dependency frontier, not the full graph.

async function testMutationLatency() {
  hr("TEST 5 — Mutation latency: write cost vs graph size");
  console.log("n\t\twrite_median_ms\twrite_p95_ms");

  const sizes = [10, 100, 500, 1000, 5000, 10000];

  for (const n of sizes) {
    const samples: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const me = new Me() as CallableMe;

      for (let i = 1; i <= n; i++) me.fleet.trucks[i].fuel(100 + i);
      me.finance.fuel_price(24.5);
      me.fleet.trucks[1]["="]("cost", "fuel * finance.fuel_price");
      me("fleet.trucks[1].cost"); // prime

      // Measure ONLY the mutation, no read
      const t0 = performance.now();
      me.finance.fuel_price(25 + Math.random()); // vary to defeat memoization
      const t1 = performance.now();

      samples.push(t1 - t0);
    }

    const s = stats(samples);
    console.log(
      `n=${n.toString().padEnd(6)}\t${s.median.toFixed(4)}\t\t${s.p95.toFixed(4)}`
    );
  }

  console.log(
    "\nExpected: write cost stays flat. Growth here = graph traversal on mutation."
  );
}

// ─── Test 6: Diamond dependency correctness + latency ─────────────────────────
//
// A known hard case for reactive systems: diamond dependencies cause
// "glitches" (intermediate inconsistent states) in naive implementations.
//
//   price ──→ cost_a ──→ total
//         ──→ cost_b ──┘
//
// total depends on cost_a and cost_b, both depend on price.
// A correct system recomputes total exactly once after price changes.
// An incorrect system may compute total with cost_a updated and cost_b stale.

async function testDiamondDependency() {
  hr("TEST 6 — Diamond dependency: correctness + glitch detection");

  let glitchCount = 0;
  const samples: number[] = [];

  for (let run = 0; run < 100; run++) {
    const me = new Me() as CallableMe;

    me.price(10);
    me["="]("cost_a", "price * 2");   // cost_a = price × 2
    me["="]("cost_b", "price * 3");   // cost_b = price × 3
    me["="]("total", "cost_a + cost_b"); // total = cost_a + cost_b = 5 × price

    me("total"); // warmup

    const t0 = performance.now();
    me.price(20);
    const result = me("total"); // should be 20 * 5 = 100, not an intermediate value
    const t1 = performance.now();

    samples.push(t1 - t0);

    // Correctness check: total must equal 5 * price exactly
    if (result !== 100) glitchCount++;
  }

  const s = stats(samples);
  console.log(`Glitches detected: ${glitchCount}/100 ${glitchCount === 0 ? "✅" : "❌"}`);
  console.log(`Correct result (100): ${glitchCount === 0 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`\nDiamond read median: ${s.median.toFixed(4)}ms  p95: ${s.p95.toFixed(4)}ms`);
  console.log(
    "\nNote: if glitches > 0, the system does NOT guarantee consistency under fan-in."
  );
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  .me benchmark suite");
  console.log(`  ${RUNS} samples per test, using performance.now()`);
  console.log(`  ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  await testOK();
  await testKSensitivity();
  await testSecretScope();
  await testExplainOverhead();
  await testMutationLatency();
  await testDiamondDependency();

  console.log("\n" + "=".repeat(60));
  console.log("  Done.");
  console.log("=".repeat(60));
}

main().catch(console.error);
