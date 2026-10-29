// Runs LLMS/eval/eval.jsonl against a real model and writes LLMS/eval/results/<adapter>-<model>-<date>.json.
//   node eval/run.ts --adapter meta|openai [--limit N]
// Metrics: valid (parse ok after up to 2 repairs), exact (same ops, order-insensitive), state (same final state on a fresh ME
// + same secret/noise/identity/query ops), confirm (same needsConfirm op types), repairs used, latency.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, sameOps, sameFinalState } from "../src/index.ts";
import { metaModel, META_DEFAULTS } from "../src/adapters/meta.ts";
import { openaiModel } from "../src/adapters/openai.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k: string, d?: string) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const adapter = arg("adapter", "meta")!;
const limit = Number(arg("limit", "0"));
const model = adapter === "openai" ? openaiModel() : metaModel();
const modelName = adapter === "openai" ? (process.env.OPENAI_MODEL ?? "gpt-4o-mini") : (process.env.META_MODEL ?? META_DEFAULTS.model);
let items = fs.readFileSync(path.join(here, "../../eval/eval.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
if (limit) items = items.slice(0, limit);

const rows: any[] = [];
for (const it of items) {
  const t0 = Date.now();
  let r: any, err: string | undefined;
  try { r = await parse({ text: it.text, state: it.state, speaker: it.speaker }, { model }); } catch (e: any) { err = e.message; }
  const ms = Date.now() - t0;
  const ops = r?.ok ? r.ops : [];
  const row = {
    id: it.id, lang: it.lang, text: it.text, ms, error: err ?? (r?.ok ? undefined : r?.errors?.join("; ")),
    valid: !!r?.ok, attempts: r?.attempts ?? 0,
    exact: !!r?.ok && sameOps(it.expected_ops, ops),
    state: !!r?.ok && sameFinalState(it.state, it.expected_ops, ops),
    confirm: !!r?.ok && JSON.stringify(r.needsConfirm.map((o: any) => o.op).sort()) === JSON.stringify(it.expected_ops.filter((o: any) => ["secret", "noise", "identity", "remove"].includes(o.op)).map((o: any) => o.op).sort()),
    predicted: ops, expected: it.expected_ops,
  };
  rows.push(row);
  console.log(`${row.id} ${row.valid ? "valid" : "INVALID"} exact=${row.exact} state=${row.state} attempts=${row.attempts} ${ms}ms${row.error ? " err=" + row.error.slice(0, 120) : ""}`);
}
const n = rows.length, cnt = (k: string) => rows.filter((r) => r[k]).length;
const pct = (x: number) => `${x}/${n} (${((100 * x) / n).toFixed(1)}%)`;
const byLang = Object.fromEntries(["es", "en"].map((l) => { const rs = rows.filter((r) => r.lang === l); return [l, `${rs.filter((r) => r.state).length}/${rs.length}`]; }));
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  adapter, model: modelName, date: new Date().toISOString(), items: n,
  valid: pct(cnt("valid")), exact: pct(cnt("exact")), state: pct(cnt("state")), confirm: pct(cnt("confirm")),
  stateByLang: byLang, usedRepair: rows.filter((r) => r.attempts > 1).length,
  latencyMs: { median: ms[Math.floor(n / 2)], max: ms[n - 1] },
};
console.log(JSON.stringify(summary, null, 2));
const out = path.join(here, "../../eval/results");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `${adapter}-${modelName}-${summary.date.slice(0, 10)}.json`), JSON.stringify({ summary, rows }, null, 2));
