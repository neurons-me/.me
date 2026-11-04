// Re-records the 5 /LLMS/Meta/ demo examples in English with REAL muse-spark-1.3 replies (same system prompt, examples,
// adapter and parse loop as the library), writes LLMS/Meta/recorded-en.json and regenerates LLMS/Meta/demo-data.js.
// Key: META_API_KEY from .env (LLMS/typescript/.env, LLMS/.env or repo root .env; git-ignored). 5 billed calls (1-3 requests each).
//   cd LLMS/typescript && npm install && node record-demo.ts
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
import { parse } from "./src/parse.ts";
import { metaModel, META_DEFAULTS } from "./src/adapters/meta.ts";
const here = path.dirname(fileURLToPath(import.meta.url)), L = path.join(here, "..");
for (const f of [path.join(here, ".env"), path.join(L, ".env"), path.join(L, "..", ".env")]) if (!process.env.META_API_KEY && fs.existsSync(f)) process.loadEnvFile(f);
if (!process.env.META_API_KEY) { console.error("META_API_KEY not found in .env"); process.exit(2); }
const ITEMS = [
  { id: "e24", text: "change the bread price to 25 and make the menu total coffee plus bread", state: { menu: { coffee: { price: 45 }, bread: { price: 20 } } } },
  { id: "e05", text: "the first product is a Keyboard that costs 80", state: { products: {} } },
  { id: "e20", text: "Ana paid 450 for the taxi for her and Luis", state: { split: { members: ["Sui", "Ana", "Luis"] } }, speaker: "Sui" },
  { id: "e07", text: "each item's total is price plus price times the shop tax rate", state: { shop: { tax_rate: 0.16, items: { "1": { price: 100 }, "2": { price: 50 } } } } },
  { id: "e23", text: "rename the shop to Bean There and remove its tax rate", state: { shop: { name: "Coffee", tax_rate: 0.16 } } },
];
const model = metaModel(), rows = [];
for (const it of ITEMS) {
  const t0 = Date.now(), r = await parse({ text: it.text, state: it.state, speaker: it.speaker } as any, { model });
  rows.push({ ...it, lang: "en", ops: r.ops, ok: r.ok, errors: r.errors, ms: Date.now() - t0, attempts: r.attempts });
  console.log(it.id, r.ok ? "ok" : "FAILED", r.attempts, "attempt(s)");
}
fs.writeFileSync(path.join(L, "Meta/recorded-en.json"), JSON.stringify({ model: META_DEFAULTS.model, date: new Date().toISOString(), rows }, null, 2) + "\n");
execFileSync(process.execPath, [path.join(L, "Meta/build-data.mjs")], { stdio: "inherit" });
