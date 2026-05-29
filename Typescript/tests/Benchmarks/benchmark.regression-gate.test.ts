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

function sampleLatency(me: CallableMe, nodeCount: number, iterations: number): number[] {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    me.master((i % 7) + 1);
    me(`units[${nodeCount}].out`);
    latencies.push(performance.now() - t0);
  }
  return latencies;
}

function gateLatencyP95(maxP95Ms: number): GateResult {
  const me = buildRuntime(1500);
  const p95 = percentile(sampleLatency(me, 1500, 120), 95);
  return {
    ok: p95 <= maxP95Ms,
    name: "latency_p95",
    details: `p95=${p95.toFixed(4)}ms (threshold=${maxP95Ms.toFixed(2)}ms)`,
  };
}

function gateComplexityK(maxK: number): GateResult {
  const me = buildRuntime(4000);
  const trace = me.explain("units[4000].out");
  const k = trace.meta.dependsOn.length;
  return {
    ok: k <= maxK,
    name: "complexity_k",
    details: `k=${k} (threshold<=${maxK})`,
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
    gateLatencyP95(20),
    gateComplexityK(4),
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
