import ME from "this.me";
import assert from "node:assert/strict";

type Scenario = {
  setup: (me: any) => {
    mutationPath: string;
    resultPath: string;
    overThresholdPath: string;
    explainPath: string;
    expectedWarm: number;
    expectedResult: number;
    expectedExpr: string;
    expectedRecomputed: string[];
    mutate: () => void;
  };
};

async function runTest(name: string, setupScenario: Scenario["setup"]) {
  const me = new ME() as any;
  const scenario = setupScenario(me);

  const warm = me(scenario.resultPath);
  const warmThreshold = me(scenario.overThresholdPath);

  assert.equal(warm, scenario.expectedWarm);
  assert.equal(warmThreshold, false);

  const start = performance.now();
  scenario.mutate();
  const result = me(scenario.resultPath);
  const overThreshold = me(scenario.overThresholdPath);
  const end = performance.now();

  const trace = me.explain(scenario.explainPath);

  assert.equal(result, scenario.expectedResult);
  assert.equal(overThreshold, true);
  assert.equal(trace.expr, scenario.expectedExpr);
  assert.equal(trace.meta?.sourcePath, scenario.mutationPath);
  assert.equal(trace.meta?.k, scenario.expectedRecomputed.length);
  assert.deepEqual(trace.meta?.recomputed, scenario.expectedRecomputed);
  assert.notEqual(result, warm);

  console.log(`\n[${name}]`);
  console.log(`> Latency: ${(end - start).toFixed(4)}ms`);
  console.log(`> Wave k: ${trace.meta?.k}`);
  console.log(`> Mutation path: ${scenario.mutationPath}`);
  console.log(`> Result before/after: ${warm} -> ${result}`);
  console.log(`> overThreshold before/after: ${warmThreshold} -> ${overThreshold}`);
  console.log(`> recomputed: ${JSON.stringify(trace.meta?.recomputed)}`);
  console.log("> Status: ✅ Reactive");
}

function deepResultPath(levels: number): string {
  return "root." + Array.from({ length: levels }, (_, i) => `n${i}`).join(".");
}

async function startLab() {
  console.log("========================================================");
  console.log(" .me KERNEL: MULTI-DATASET STRESS LAB");
  console.log(" Author: suiGn | jose abella eggleton");
  console.log("========================================================\n");

  await runTest("DEEP_NESTING (500 levels)", (me) => {
    let curr = me.root;
    for (let i = 0; i < 500; i++) {
      curr = curr[`n${i}`];
    }

    curr.value(10);
    curr.factor(5);
    curr["="]("result", "value * factor");
    curr["="]("overThreshold", "result >= 100");

    const basePath = deepResultPath(500);
    return {
      mutationPath: `${basePath}.factor`,
      resultPath: `${basePath}.result`,
      overThresholdPath: `${basePath}.overThreshold`,
      explainPath: `${basePath}.overThreshold`,
      expectedWarm: 50,
      expectedResult: 100,
      expectedExpr: "result >= 100",
      expectedRecomputed: [
        `${basePath}.result`,
        `${basePath}.overThreshold`,
      ],
      mutate: () => curr.factor(10),
    };
  });

  await runTest("WIDE_BROADCAST (1,000 nodes)", (me) => {
    const target = 999;
    for (let i = 0; i < 1000; i++) {
      me.sensors[i].value(10);
      me.sensors[i].factor(5);
      me.sensors[i]["="]("result", "value * factor");
      me.sensors[i]["="]("overThreshold", "result >= 100");
    }

    const basePath = `sensors.${target}`;
    return {
      mutationPath: `${basePath}.factor`,
      resultPath: `${basePath}.result`,
      overThresholdPath: `${basePath}.overThreshold`,
      explainPath: `${basePath}.overThreshold`,
      expectedWarm: 50,
      expectedResult: 100,
      expectedExpr: "result >= 100",
      expectedRecomputed: [
        `${basePath}.result`,
        `${basePath}.overThreshold`,
      ],
      mutate: () => me.sensors[target].factor(10),
    };
  });

  await runTest("FINANCIAL_DATASET (5,000 tx)", (me) => {
    const target = 4999;
    for (let i = 0; i < 5000; i++) {
      me.tx[i].amount(100);
      me.tx[i].taxRate(0.16);
      me.tx[i]["="]("total", "amount + (amount * taxRate)");
      me.tx[i]["="]("overThreshold", "total >= 200");
    }

    const basePath = `tx.${target}`;
    return {
      mutationPath: `${basePath}.taxRate`,
      resultPath: `${basePath}.total`,
      overThresholdPath: `${basePath}.overThreshold`,
      explainPath: `${basePath}.overThreshold`,
      expectedWarm: 116,
      expectedResult: 200,
      expectedExpr: "total >= 200",
      expectedRecomputed: [
        `${basePath}.total`,
        `${basePath}.overThreshold`,
      ],
      mutate: () => me.tx[target].taxRate(1),
    };
  });

  console.log("\n========================================================");
}

startLab().catch(console.error);
