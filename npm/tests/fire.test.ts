/// <reference types="node" />
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Task =
  | { label: string; kind: "node"; target: string }
  | { label: string; kind: "npm"; args: string[] };

type TaskResult = {
  label: string;
  ok: boolean;
  durationMs: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const tasks: Task[] = [
  { label: "phases", kind: "node", target: path.join(ROOT_DIR, "tests/phases.test.js") },
  { label: "reconstruction", kind: "node", target: path.join(ROOT_DIR, "tests/reconstruction.test.ts") },
  { label: "secret-material-v3", kind: "node", target: path.join(ROOT_DIR, "tests/secret-material-v3.test.ts") },
  { label: "secret-blob-v3.read", kind: "node", target: path.join(ROOT_DIR, "tests/secret-blob-v3.read.test.ts") },
  { label: "secret-blob-v3.write", kind: "node", target: path.join(ROOT_DIR, "tests/secret-blob-v3.write.test.ts") },
  { label: "benchmark.1", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.test.ts") },
  { label: "benchmark.2", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.2.test.ts") },
  { label: "benchmark.3", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.3.test.ts") },
  { label: "benchmark.4", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.4.test.ts") },
  { label: "benchmark.5", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.5.sustained-mutation.test.ts") },
  { label: "benchmark.6", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.6.fanout-sensitivity.test.ts") },
  { label: "benchmark.7", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.7.cold-warm-profiles.test.ts") },
  { label: "benchmark.8", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.8.explain-overhead.test.ts") },
  { label: "benchmark.9", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.9.secret-scope-impact.test.ts") },
  { label: "benchmark.10", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.10.push-vs-pull.test.ts") },
  { label: "benchmark.11", kind: "node", target: path.join(ROOT_DIR, "tests/Benchmarks/benchmark.11.secret-push-vs-pull.test.ts") },
  { label: "contracts-summary", kind: "npm", args: ["run", "test:contracts"] },
];

function runTask(task: Task): TaskResult {
  const start = performance.now();
  console.log("\n========================================================");
  console.log(`FIRETEST :: ${task.label}`);
  console.log("========================================================\n");

  const result =
    task.kind === "node"
      ? spawnSync(process.execPath, [task.target], {
          cwd: ROOT_DIR,
          stdio: "inherit",
        })
      : spawnSync(npmBin, task.args, {
          cwd: ROOT_DIR,
          stdio: "inherit",
        });

  const durationMs = performance.now() - start;
  const ok = (result.status ?? 1) === 0;

  console.log(
    `\n${ok ? "✅" : "❌"} FIRETEST :: ${task.label} completed in ${durationMs.toFixed(2)}ms`,
  );

  return { label: task.label, ok, durationMs };
}

function printSummary(results: TaskResult[]): void {
  console.log("\n========================================================");
  console.log(".me FIRETEST SUMMARY");
  console.log("========================================================\n");

  for (const result of results) {
    console.log(
      `${result.ok ? "✅" : "❌"} ${result.label.padEnd(22)} ${result.durationMs.toFixed(2)}ms`,
    );
  }

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\nSTATUS: ${failed.length === 0 ? "ALL FIRETEST TASKS PASSED" : `${failed.length} TASK(S) FAILED`}`,
  );

  if (failed.length > 0) {
    console.log("FAILED TASKS:");
    for (const result of failed) {
      console.log(`- ${result.label}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("\n========================================================");
  console.log(".me FIRETEST");
  console.log("========================================================\n");
  console.log("Running phases, v3 suites, benchmarks 1-11, and contracts summary.\n");

  const results: TaskResult[] = [];
  for (const task of tasks) {
    results.push(runTask(task));
  }

  printSummary(results);

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

await main();
