// The shipped few-shot examples and eval expectations must themselves pass validation and the kernel dry-run.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateOps, dryRun, EXAMPLES } from "../src/index.ts";
const evalSet = fs.readFileSync(new URL("../../eval/eval.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
test("few-shot examples are valid", () => { for (const e of EXAMPLES) { const v = validateOps({ ops: e.ops }); assert.deepEqual(v.errors, [], e.text); assert.deepEqual(dryRun(e.state, v.ops).errors, [], e.text); } });
test("eval expectations are valid", () => { for (const e of evalSet) { const v = validateOps({ ops: e.expected_ops }); assert.deepEqual(v.errors, [], e.id); assert.deepEqual(dryRun(e.state, v.ops).errors, [], e.id); } });
test("eval and few-shot texts do not overlap", () => { const fs = new Set(EXAMPLES.map((e) => e.text)); for (const e of evalSet) assert.ok(!fs.has(e.text), e.id); });
