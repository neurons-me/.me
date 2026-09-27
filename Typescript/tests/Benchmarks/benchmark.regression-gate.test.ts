import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

type GateResult = { ok: boolean; name: string; details: string };

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function buildRuntime(nodeCount: number): CallableMe {
  const me = new ME() as CallableMe;
  for (let i = 1; i <= nodeCount; i++) {
    me.units[i].value(100 + (i % 5));
  }
  me.master(2);
  me.units["[i]"]["="]("out", "value * master");
  me("units[1].out");
  return me;
}

function p50(values: number[]): number {
  return percentile(values, 50);
}

function perWriteLatency(nodeCount: number, iterations: number): number {
  const me = buildRuntime(nodeCount);
  for (let i = 0; i < 3; i++) me.master(i + 3); // warmup
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    me.master((i % 7) + 1);
    latencies.push(performance.now() - t0);
  }
  return p50(latencies);
}

// Exact, deterministic: one write to `master` must recompute exactly the
// dependents that read it — k equals the fan-out, not the formula's input count.
function gateComplexityExact(nodeCount: number): GateResult {
  const me = buildRuntime(nodeCount);
  me.master(9);
  const meta = me.explain(`units[${nodeCount}].out`).meta;
  const ok = meta.k === nodeCount && meta.sourcePath === "master" && me(`units[${nodeCount}].out`) === 9 * (100 + (nodeCount % 5));
  return {
    ok,
    name: "complexity_k_exact",
    details: `k=${meta.k} (expected=${nodeCount}), inputs=${meta.dependsOn.length}, source=${meta.sourcePath}`,
  };
}

// Exact, deterministic: a write to a root path every dependent shadows with its
// own relative value recomputes nothing — only the write's own memory is added.
function gateComplexityShadowed(nodeCount: number): GateResult {
  const me = new ME() as CallableMe;
  for (let i = 1; i <= nodeCount; i++) me.dep[i].value(i);
  me.dep["[i]"]["="]("out", "value * 2");
  const before = (me as any).inspect().memories.length;
  me.value(999);
  const added = (me as any).inspect().memories.length - before;
  const ok = added === 1 && me(`dep[${nodeCount}].out`) === nodeCount * 2;
  return {
    ok,
    name: "complexity_k_shadowed",
    details: `memories added=${added} (expected=1, i.e. k=0)`,
  };
}

// Machine-independent: per-write time must grow proportionally to k. Linear
// gives t(5000)/t(500) = 10 (measured ~11 on an M2); quadratic would give ~100.
// The floor (minRatio) catches the opposite failure: time that does not grow
// with k means the write is not doing the recompute work. Until 2026-09 this
// whole suite measured exactly that (a ref-resolution bug made every write a
// no-op and the old latency gate passed at 0.016ms). If an optimization makes
// this fail for being "too fast", check meta.k first — a real speedup lowers
// the per-dependent cost, it does not flatten the curve; only a design that
// genuinely stops recomputing per dependent justifies changing the floor.
// The µs-per-dependent ceiling is deliberately loose: it only catches disasters.
function gateScaling(minRatio: number, maxRatio: number, maxUsPerK: number): GateResult {
  const t500 = perWriteLatency(500, 40);
  const t1500 = perWriteLatency(1500, 25);
  const t5000 = perWriteLatency(5000, 15);
  const ratio = t5000 / t500;
  const usPerK = (t5000 / 5000) * 1000;
  return {
    ok: ratio >= minRatio && ratio <= maxRatio && usPerK <= maxUsPerK,
    name: "scaling_linear",
    details:
      `p50 t(500)=${t500.toFixed(2)}ms t(1500)=${t1500.toFixed(2)}ms t(5000)=${t5000.toFixed(2)}ms; ` +
      `t(5000)/t(500)=${ratio.toFixed(2)} (expected ${minRatio}..${maxRatio}), ${usPerK.toFixed(1)}µs/k (ceiling<=${maxUsPerK})`,
  };
}

function gateStealthMasking(): GateResult {
  const me = new ME() as CallableMe;
  me.secure["_"]("gate-secret");
  me.secure.rate(3);
  me.pub.base(10);
  me.pub["="]("score", "base * secure.rate");
  me("pub.score");

  const trace = me.explain("pub.score");
  const secretInput = trace.derivation?.inputs.find((x) => x.path === "secure.rate");
  const ok = !!secretInput && secretInput.origin === "stealth" && secretInput.masked === true && secretInput.value === "●●●●";

  return {
    ok,
    name: "stealth_masking",
    details: secretInput
      ? `origin=${secretInput.origin}, masked=${String(secretInput.masked)}, value=${String(secretInput.value)}`
      : "secret input not found in trace",
  };
}

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK REGRESSION GATE");
  console.log("========================================================\n");

  const checks: GateResult[] = [
    gateComplexityExact(1500),
    gateComplexityExact(4000),
    gateComplexityShadowed(500),
    gateScaling(5, 15, 200),
    gateStealthMasking(),
  ];

  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "❌"} ${c.name} -> ${c.details}`);
  }

  if (checks.some((c) => !c.ok)) {
    console.error("\n❌ Benchmark regression gate failed.");
    process.exitCode = 1;
    return;
  }

  console.log("\n✅ Benchmark regression gate passed.");
}

start().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
