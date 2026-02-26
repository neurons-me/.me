import { spawnSync } from "node:child_process";

const steps = [
  { name: "Build dist", cmd: "npm", args: ["run", "build"] },
  { name: "Axioms fire test", cmd: "node", args: ["tests/axioms.test.ts"] },
  { name: "Phases 0-8 fire test", cmd: "node", args: ["tests/phases.test.js"] },
  { name: "CJS build test", cmd: "node", args: ["tests/cjs.test.cjs"] },
  { name: "ESM build test", cmd: "node", args: ["tests/esm.test.mjs"] },
  { name: "TypeScript type test", cmd: "npm", args: ["run", "test:ts"] },
  { name: "UMD build test", cmd: "node", args: ["tests/umd.test.cjs"] },
];

console.log("\n========================================================");
console.log(".me PRE-BUILD TEST GATE");
console.log("========================================================");

for (const step of steps) {
  console.log(`\n--- ${step.name} ---`);
  const res = spawnSync(step.cmd, step.args, { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`\n❌ PRE-BUILD GATE FAILED at: ${step.name}`);
    process.exit(res.status ?? 1);
  }
  console.log(`✅ ${step.name} PASSED`);
}

console.log("\n========================================================");
console.log("PRE-BUILD GATE: ALL CHECKS PASSED");
console.log("========================================================\n");
