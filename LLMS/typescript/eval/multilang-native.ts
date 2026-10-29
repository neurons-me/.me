// e24 in 12 languages, each with a starting state in its own keys (LLMS/eval/multilang-native-e24.json), against the
// Meta adapter. Pass = structural equivalence, checked by dry-run: exactly one set (the pan price → 25) and one define
// on the menu whose value reads 70, no kernel errors; key names may differ. Writes eval/results/multilang-native-e24-<date>.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, dryRun, readPath, canonicalPath } from "../src/index.ts";
import { metaModel, META_DEFAULTS } from "../src/adapters/meta.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(here, "../../eval/multilang-native-e24.json"), "utf8"));
const model = metaModel();
// --rescore <results.json>: re-check the saved model outputs (no model calls), keeping their latency
const ri = process.argv.indexOf("--rescore"), prev = ri > 0 ? JSON.parse(fs.readFileSync(process.argv[ri + 1], "utf8")) : null;
const rows: any[] = [];
for (const L of spec.langs) {
  const plain = L.text.replace(/\[([^|\]]+)\|[^\]]+\]/g, "$1"), k = L.keys;
  const t0 = Date.now(); let r: any, err: string | undefined;
  // --retry: languages that failed in the saved run get one new model call; the first run's row is kept as run1
  const old = prev?.rows.find((x: any) => x.lang === L.lang), retry = process.argv.includes("--retry") && old && !old.pass;
  const saved = retry ? undefined : old;
  if (saved) r = saved.valid ? { ok: true, ops: saved.predicted, attempts: saved.attempts } : { ok: false, errors: saved.why, attempts: saved.attempts };
  else try { r = await parse({ text: plain, state: L.state }, { model }); } catch (e: any) { err = e.message; }
  const ops: any[] = r?.ok ? r.ops : [];
  const why: string[] = [];
  const sets = ops.filter((o) => o.op === "set"), defs = ops.filter((o) => o.op === "define");
  const panPrice = `${k.menu}.${k.pan}.${k.precio}`;
  if (ops.length !== 2 || sets.length !== 1 || defs.length !== 1) why.push(`shape: ${ops.map((o) => o.op).join(",") || "no ops"}`);
  if (sets[0] && !(canonicalPath(sets[0].path) === panPrice && sets[0].value === 25)) why.push(`set ${sets[0].path}=${JSON.stringify(sets[0].value)}, wanted ${panPrice}=25`);
  let total: any;
  if (defs[0]) {
    if (canonicalPath(defs[0].path) !== k.menu) why.push(`define on ${defs[0].path}, wanted ${k.menu}`);
    const d = dryRun(L.state, ops); if (d.errors.length) why.push(...d.errors);
    // the total must be derived from the two prices (names in the expr), not typed in as numbers
    const ids = (String(defs[0].expr).match(/[\p{L}_$][\p{L}\p{N}_$.-]*/gu) ?? []).map((x) => x.startsWith(k.menu + ".") ? x : `${k.menu}.${x}`);
    for (const want of [`${k.menu}.${k.cafe}.${k.precio}`, panPrice]) if (!ids.includes(want)) why.push(`expr "${defs[0].expr}" does not read ${want}`);
    total = readPath(d.me, `${defs[0].path}.${defs[0].name}`); if (total !== 70) why.push(`${defs[0].path}.${defs[0].name} = ${total}, wanted 70`);
  }
  if (!r?.ok) why.push(err ?? r?.errors?.join("; ") ?? "invalid");
  const row = { lang: L.lang, name: L.name, text: plain, state: L.state, ms: saved ? saved.ms : Date.now() - t0, ...(saved ? { rescored: true } : {}), ...(retry ? { run1: { pass: old.pass, why: old.why, predicted: old.predicted, ms: old.ms } } : {}), valid: !!r?.ok, attempts: r?.attempts ?? 0,
    pass: why.length === 0, total, derivedName: defs[0]?.name, why, predicted: ops };
  rows.push(row);
  console.log(`${L.lang} pass=${row.pass} total=${total} name=${row.derivedName} ${row.ms}ms ${why.join(" | ")}`);
}
const date = prev ? prev.summary.date : new Date().toISOString();
const summary = { item: "e24", mode: "native keys, structural equivalence", adapter: "meta", model: process.env.META_MODEL ?? META_DEFAULTS.model, date,
  languages: rows.length, passed: rows.filter((r) => r.pass).map((r) => r.lang), failed: rows.filter((r) => !r.pass).map((r) => r.lang) };
console.log(JSON.stringify(summary));
const out = path.join(here, "../../eval/results"); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `multilang-native-e24-${date.slice(0, 10)}.json`), JSON.stringify({ summary, rows }, null, 2));
