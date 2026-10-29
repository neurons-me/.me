// Runs LLMS/eval/multilang-e24.json (e24 in several languages) against the Meta adapter, with e24's starting state.
// parse() validates and dry-runs; a language passes when the final state equals e24's expected state and every
// path its marked words name is a path the model's ops wrote or read. Writes eval/results/multilang-e24-<date>.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, sameOps, sameFinalState } from "../src/index.ts";
import { metaModel, META_DEFAULTS } from "../src/adapters/meta.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(here, "../../eval/multilang-e24.json"), "utf8"));
const K: Record<string, string> = { m: "menu", c: "menu.cafe", p: "menu.pan", pr: "menu.pan.precio", v: "menu.pan.precio", t: "menu.total" };
const model = metaModel();
const rows: any[] = [];
for (const L of spec.langs) {
  const plain = L.text.replace(/\[([^|\]]+)\|[^\]]+\]/g, "$1");
  const t0 = Date.now(); let r: any, err: string | undefined;
  try { r = await parse({ text: plain, state: spec.state }, { model }); } catch (e: any) { err = e.message; }
  const ops = r?.ok ? r.ops : [];
  // paths the ops touch: written paths, define path + name, and the expr's names under the define path
  const touched = new Set<string>();
  for (const o of ops) { if (o.path) touched.add(o.path); if (o.op === "define") { touched.add(o.path + "." + o.name); for (const id of String(o.expr).match(/[A-Za-z_][\w.]*/g) ?? []) { touched.add(o.path + "." + id); touched.add(id); } } }
  const prefixes = new Set<string>(); for (const p of touched) { const s = p.split("."); for (let i = 1; i <= s.length; i++) prefixes.add(s.slice(0, i).join(".")); }
  const words = [...L.text.matchAll(/\[([^|\]]+)\|([^\]]+)\]/g)].map((m) => ({ word: m[1], path: K[m[2]] }));
  const missing = words.filter((w) => !prefixes.has(w.path)).map((w) => w.word + "→" + w.path);
  const state = !!r?.ok && sameFinalState(spec.state, spec.expected_ops, ops);
  const row = { lang: L.lang, name: L.name, text: plain, ms: Date.now() - t0, valid: !!r?.ok, attempts: r?.attempts ?? 0,
    error: err ?? (r?.ok ? undefined : r?.errors?.join("; ")), exact: !!r?.ok && sameOps(spec.expected_ops, ops), state,
    wordPathsMissing: missing, pass: state && missing.length === 0, predicted: ops };
  rows.push(row);
  console.log(`${L.lang} valid=${row.valid} exact=${row.exact} state=${state} missing=${missing.length} pass=${row.pass} ${row.ms}ms${row.error ? " err=" + row.error.slice(0, 120) : ""}`);
}
const date = new Date().toISOString();
const summary = { item: "e24", adapter: "meta", model: process.env.META_MODEL ?? META_DEFAULTS.model, date, languages: rows.length,
  passed: rows.filter((r) => r.pass).map((r) => r.lang), failed: rows.filter((r) => !r.pass).map((r) => r.lang) };
console.log(JSON.stringify(summary));
const out = path.join(here, "../../eval/results"); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `multilang-e24-${date.slice(0, 10)}.json`), JSON.stringify({ summary, expected_ops: spec.expected_ops, rows }, null, 2));
