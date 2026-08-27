import { readFileSync } from "node:fs";

import ME from "../../dist/index.js";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);
type KernelMode = "eager" | "lazy";

const ISOLATION_SIZES = [10, 100, 1_000, 5_000, 10_000];
const ISOLATION_WARMUP = 20;
const ISOLATION_RUNS = 200;
const SUSTAINED_NODES = 4_000;
const SUSTAINED_UPDATES = 2_000;
const SUSTAINED_WINDOW = 200;
const PUSH_PULL_CASES = [
  { fanout: 10, iterations: 150 },
  { fanout: 100, iterations: 150 },
  { fanout: 500, iterations: 80 },
  { fanout: 1_000, iterations: 50 },
  { fanout: 2_500, iterations: 20 },
  { fanout: 5_000, iterations: 10 },
];
const SECRET_NODES = 600;
const SECRET_WRITE_READ_RUNS = 1_500;
const SECRET_DERIVATION_RUNS = 240;

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { version?: string };

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function durationSummary(samples: number[]) {
  return {
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    p99_ms: percentile(samples, 99),
    max_ms: Math.max(...samples),
  };
}

function durationWindows(samples: number[], windowSize: number) {
  const windows = [];
  for (let index = 0; index < samples.length; index += windowSize) {
    const chunk = samples.slice(index, index + windowSize);
    windows.push({
      start: index + 1,
      end: index + chunk.length,
      p50_ms: percentile(chunk, 50),
      p95_ms: percentile(chunk, 95),
      p99_ms: percentile(chunk, 99),
    });
  }
  return windows;
}

function p95DriftPct(samples: number[], windowSize: number): number {
  const windows = durationWindows(samples, windowSize);
  const first = windows[0]?.p95_ms ?? 0;
  const last = windows[windows.length - 1]?.p95_ms ?? 0;
  return first > 0 ? ((last - first) / first) * 100 : 0;
}

function readNumber(me: CallableMe, path: string): number {
  const value = me(path);
  if (typeof value !== "number") {
    throw new Error(`expected numeric value at ${path}, got ${String(value)}`);
  }
  return value;
}

function recomputeK(trace: any): number {
  return Number(trace?.meta?.k ?? trace?.meta?.recomputed?.length ?? trace?.meta?.dependsOn?.length ?? 0);
}

function runOkIsolation() {
  return ISOLATION_SIZES.map((nodes) => {
    const me = new ME() as CallableMe;

    for (let index = 0; index < nodes; index++) {
      me.bench.irrelevant[index].value(index);
    }

    me.order.price(10);
    me.order.quantity(3);
    me.order["="]("total", "price * quantity");

    for (let run = 0; run < ISOLATION_WARMUP; run++) {
      const price = 11 + (run % 7);
      me.order.price(price);
      const total = readNumber(me, "order.total");
      if (total !== price * 3) throw new Error(`unexpected warmup total ${total}`);
    }

    const samples = [];
    let result = 0;
    for (let run = 0; run < ISOLATION_RUNS; run++) {
      const price = 20 + (run % 7);
      const started = performance.now();
      me.order.price(price);
      result = readNumber(me, "order.total");
      samples.push(performance.now() - started);
      if (result !== price * 3) throw new Error(`unexpected measured total ${result}`);
    }

    const trace = me.explain("order.total");
    return {
      nodes,
      runs: ISOLATION_RUNS,
      ...durationSummary(samples),
      k: recomputeK(trace),
      result,
      memories: me.inspect().memories.length,
    };
  });
}

function runSustainedMutation() {
  const me = new ME() as CallableMe;

  for (let index = 1; index <= SUSTAINED_NODES; index++) {
    me.items[index].value(sustainedBaseValue(index));
    me.items[index].factor(1);
  }
  me.items[1]["="]("score", "value * 2");
  me.items[SUSTAINED_NODES]["="]("score", "value * factor");

  const samples = [];
  for (let update = 1; update <= SUSTAINED_UPDATES; update++) {
    const factor = (update % 17) + 1;
    const started = performance.now();
    me.items[SUSTAINED_NODES].factor(factor);
    const score = readNumber(me, `items[${SUSTAINED_NODES}].score`);
    samples.push(performance.now() - started);
    const expected = sustainedBaseValue(SUSTAINED_NODES) * factor;
    if (score !== expected) throw new Error(`unexpected sustained score ${score}`);
  }

  return {
    nodes: SUSTAINED_NODES,
    updates: SUSTAINED_UPDATES,
    window: SUSTAINED_WINDOW,
    overall: durationSummary(samples),
    windows: durationWindows(samples, SUSTAINED_WINDOW),
    p95_drift_pct: p95DriftPct(samples, SUSTAINED_WINDOW),
  };
}

function runPushPull() {
  const rows = [];
  for (const mode of ["eager", "lazy"] as KernelMode[]) {
    for (const testCase of PUSH_PULL_CASES) {
      rows.push(runPushPullCase(testCase.fanout, testCase.iterations, mode));
    }
  }
  return rows;
}

function runPushPullCase(fanout: number, iterations: number, mode: KernelMode) {
  const readPath = `dep[${fanout}].result`;
  const me = setupPushPullGraph(fanout, mode);
  const mutationSamples = [];
  const readSamples = [];

  for (let iteration = 0; iteration < iterations; iteration++) {
    const nextMaster = (iteration % 97) + 2;

    let started = performance.now();
    me.master.value(nextMaster);
    mutationSamples.push(performance.now() - started);

    started = performance.now();
    const result = readNumber(me, readPath);
    readSamples.push(performance.now() - started);

    if (result !== fanout * nextMaster) throw new Error(`unexpected push/pull result ${result}`);
  }

  const trace = me.explain(readPath);
  return {
    mode,
    fanout,
    iterations,
    k: recomputeK(trace),
    mutation_p50_ms: percentile(mutationSamples, 50),
    mutation_p95_ms: percentile(mutationSamples, 95),
    mutation_p99_ms: percentile(mutationSamples, 99),
    read_p50_ms: percentile(readSamples, 50),
    read_p95_ms: percentile(readSamples, 95),
    read_p99_ms: percentile(readSamples, 99),
  };
}

function setupPushPullGraph(fanout: number, mode: KernelMode): CallableMe {
  const me = new ME() as CallableMe;
  me.setRecomputeMode(mode);
  me.master.value(1);

  for (let index = 1; index <= fanout; index++) {
    me.dep[index].value(index);
    me.dep[index]["="]("result", "value * master.value");
  }

  const result = readNumber(me, `dep[${fanout}].result`);
  if (result !== fanout) throw new Error(`unexpected warm push/pull result ${result}`);
  return me;
}

function runSecretScope() {
  return [
    measurePublicWriteRead(),
    measureSecretWriteRead(),
    measurePublicDerivation(),
    measureSecretDerivation(),
  ];
}

function measurePublicWriteRead() {
  const me = new ME() as CallableMe;
  me.public.value(0);
  return runWriteReadLoop(me, "write_read", "public", "public.value", SECRET_WRITE_READ_RUNS, (value) => {
    me.public.value(value);
  });
}

function measureSecretWriteRead() {
  const me = new ME() as CallableMe;
  me.secure["_"]("bench-secret-2026");
  me.secure.value(0);
  return runWriteReadLoop(me, "write_read", "secret", "secure.value", SECRET_WRITE_READ_RUNS, (value) => {
    me.secure.value(value);
  });
}

function measurePublicDerivation() {
  const me = new ME() as CallableMe;
  me.setRecomputeMode("lazy");
  me.factor.value(2);
  for (let index = 1; index <= SECRET_NODES; index++) {
    me.pub[index].value(secretBaseValue(index));
    me.pub[index]["="]("out", "value * factor.value");
  }

  const warm = readNumber(me, `pub[${SECRET_NODES}].out`);
  if (warm !== secretBaseValue(SECRET_NODES) * 2) throw new Error(`unexpected public warm value ${warm}`);

  return runDerivationLoop(
    me,
    "derivation_lazy",
    "public",
    "factor.value",
    `pub[${SECRET_NODES}].out`,
    SECRET_DERIVATION_RUNS,
    (factor) => me.factor.value(factor)
  );
}

function measureSecretDerivation() {
  const me = new ME() as CallableMe;
  me.setRecomputeMode("lazy");
  me.secure["_"]("bench-secret-2026");
  me.secure.factor(2);
  for (let index = 1; index <= SECRET_NODES; index++) {
    me.secure.data[index].value(secretBaseValue(index));
    me.secure.data[index]["="]("out", "value * secure.factor");
  }

  const warm = readNumber(me, `secure.data[${SECRET_NODES}].out`);
  if (warm !== secretBaseValue(SECRET_NODES) * 2) throw new Error(`unexpected secret warm value ${warm}`);

  return runDerivationLoop(
    me,
    "derivation_lazy",
    "secret",
    "secure.factor",
    `secure.data[${SECRET_NODES}].out`,
    SECRET_DERIVATION_RUNS,
    (factor) => me.secure.factor(factor)
  );
}

function runWriteReadLoop(
  me: CallableMe,
  caseName: string,
  scope: string,
  path: string,
  iterations: number,
  write: (value: number) => void
) {
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const value = (iteration % 17) + 1;
    const started = performance.now();
    write(value);
    const result = readNumber(me, path);
    samples.push(performance.now() - started);
    if (result !== value) throw new Error(`unexpected ${scope} write/read result ${result}`);
  }

  return {
    case: caseName,
    scope,
    iterations,
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    p99_ms: percentile(samples, 99),
    k: 0,
  };
}

function runDerivationLoop(
  me: CallableMe,
  caseName: string,
  scope: string,
  mutationPath: string,
  readPath: string,
  iterations: number,
  write: (factor: number) => void
) {
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const factor = (iteration % 7) + 1;
    const expected = secretBaseValue(SECRET_NODES) * factor;
    const started = performance.now();
    write(factor);
    const result = readNumber(me, readPath);
    samples.push(performance.now() - started);
    if (result !== expected) throw new Error(`unexpected ${scope} derivation result ${result}`);
  }

  const trace = me.explain(readPath);
  return {
    case: caseName,
    scope,
    nodes: SECRET_NODES,
    iterations,
    mutation_path: mutationPath,
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    p99_ms: percentile(samples, 99),
    k: recomputeK(trace),
  };
}

function sustainedBaseValue(index: number): number {
  return 10 + (index % 7);
}

function secretBaseValue(index: number): number {
  return 100 + (index % 11);
}

const output = {
  suite: "this.me mirror benchmark",
  implementation: "typescript",
  version: packageJson.version ?? "unknown",
  cases: {
    ok_isolation: runOkIsolation(),
    sustained_mutation: runSustainedMutation(),
    push_pull: runPushPull(),
    secret_scope: runSecretScope(),
  },
};

console.log(JSON.stringify(output, null, 2));
