// Records the /LLMS/Meta demo as ONE English conversation with REAL muse-spark-1.3 replies: each message is sent with the state
// built by the previous confirmed replies and the chat history so far (same system prompt, examples, adapter and parse loop as
// the library). Writes LLMS/Meta/recorded-en.json ({ thread: [...] }) and regenerates LLMS/Meta/demo-data.js.
// Key: META_API_KEY from .env (LLMS/typescript/.env, LLMS/.env or repo root .env; git-ignored). 5 billed calls (1-3 requests each).
//   cd LLMS/typescript && npm install && node record-demo.ts
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
import { parse } from "./src/parse.ts";
import { metaModel, META_DEFAULTS } from "./src/adapters/meta.ts";
import { newME, applyOps, touchedPaths, readPath } from "./src/kernel.ts";
import type { ChatMessage, Json } from "./src/types.ts";
const here = path.dirname(fileURLToPath(import.meta.url)), L = path.join(here, "..");
for (const f of [path.join(here, ".env"), path.join(L, ".env"), path.join(L, "..", ".env")]) if (!process.env.META_API_KEY && fs.existsSync(f)) process.loadEnvFile(f);
if (!process.env.META_API_KEY) { console.error("META_API_KEY not found in .env"); process.exit(2); }
export const THREAD = [
  { id: "c1", text: "I run a small café. Coffee is 45 and bread is 20." },
  { id: "c2", text: "Make the order total coffee plus bread." },
  { id: "c3", text: "Bread goes up to 25." },
  { id: "c4", text: "Add 16% tax to the total." },
  { id: "c5", text: "Ana paid the order for her and Luis, split it." },
];
const model = metaModel(), rows: any[] = [], history: ChatMessage[] = [], me = newME({}), known = new Set<string>();
// the state the next message sees: every recorded path (derived ones too) with its current value, as the demo's live mode sends it
const snapshot = (): Record<string, Json> => Object.fromEntries(Array.from(known).map((p) => [p, readPath(me, p) as Json]).filter(([, v]) => v !== undefined));
for (const it of THREAD) {
  const state = snapshot(), t0 = Date.now();
  const r = await parse({ text: it.text, state } as any, { model, history });
  rows.push({ ...it, lang: "en", state, ops: r.ops, ok: r.ok, errors: r.errors, ms: Date.now() - t0, attempts: r.attempts });
  console.log(it.id, r.ok ? "ok" : "FAILED", r.attempts, "attempt(s)");
  if (!r.ok) { console.error("stopping: the next messages build on this one", r.errors); process.exit(1); }
  applyOps(me, r.ops, { confirm: true }); // the user confirms each proposal, so the next message builds on it
  touchedPaths(r.ops, Array.from(known)).forEach((p) => known.add(p));
  history.push({ role: "user", content: it.text }, { role: "assistant", content: JSON.stringify({ ops: r.ops }) });
}
fs.writeFileSync(path.join(L, "Meta/recorded-en.json"), JSON.stringify({ model: META_DEFAULTS.model, date: new Date().toISOString(), thread: rows }, null, 2) + "\n");
execFileSync(process.execPath, [path.join(L, "Meta/build-data.mjs")], { stdio: "inherit" });
