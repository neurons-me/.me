/**
 * Runs the full Identity-Bound Secrets adversarial security battery
 * (tests/Security/*.test.ts) in sequence, one requirement section at a
 * time, each as its OWN process (matching how each file is documented to
 * be runnable individually, and avoiding any shared-module-state race
 * between sections — each file's own `main().catch(...)` is fire-and-forget
 * at the module level, so importing them in-process without a subprocess
 * boundary cannot be relied on to have finished before the next import
 * starts).
 *
 * See tests/Security/README.md for the attack model, the
 * requirement -> file matrix, and known findings/limitations.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sections = [
  "isolation.test.ts",
  "scopes-and-noise.test.ts",
  "root-scope-lock.test.ts",
  "lww-index-consistency.test.ts",
  "leakage.test.ts",
  "crypto-tamper.test.ts",
  "root-lifecycle.test.ts",
  "replay-restart.test.ts",
  "migration.test.ts",
  "generative.test.ts",
];

let anyFailed = false;
for (const section of sections) {
  const file = path.join(__dirname, section);
  console.log(`\n=== Security battery: ${section} ===`);
  const result = spawnSync(process.execPath, [file], { stdio: "inherit" });
  if (result.status !== 0) {
    anyFailed = true;
    console.error(`\n=== ${section} FAILED (exit code ${result.status}) ===`);
  }
}

if (anyFailed) {
  console.error("\n### Security battery: one or more sections FAILED — see output above.");
  process.exitCode = 1;
} else {
  console.log("\n### Security battery: all sections passed.");
  process.exitCode = 0;
}
