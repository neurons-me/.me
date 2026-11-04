// Records the /LLMS/Meta demo as ONE English conversation with REAL muse-spark-1.3 replies: each message is sent with the state
// built by the previous confirmed replies and the chat history so far (same system prompt, examples, adapter and parse loop as
// the library). Writes LLMS/Meta/recorded-en.json ({ thread: [...] }) and regenerates LLMS/Meta/demo-data.js.
// Three moments: happy path (c1-c3), drift (d1: the model answers in plain text from a STALE context: only messages c1-c2, no
// State block; whatever it says is recorded as-is and the demo checks its numbers against the live state), rejection (r1: one
// attempt, no repairs; the reply is recorded as-is and the demo validates it against the state; nothing is applied). Then c4-c5.
// Key: META_API_KEY from .env (LLMS/typescript/.env, LLMS/.env or repo root .env; git-ignored).
// Billed requests: c1-c5 1-3 each (repairs), d1 1, r1 1 -> 7 minimum, 17 maximum.
//   cd LLMS/typescript && npm install && node record-demo.ts
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
import { parse } from "./src/parse.ts";
import { extractJson } from "./src/validate.ts";
import { SYSTEM_PROMPT } from "./src/spec.ts";
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
  { id: "d1", kind: "drift", text: "Quick, from memory: what's the order total? Just the number in one short sentence." },
  { id: "r1", kind: "reject", text: "Make the total include the tip." },
  { id: "c4", text: "Add 16% tax to the total." },
  { id: "c5", text: "Ana paid the order for her and Luis, split it." },
];
const model = metaModel(), rows: any[] = [], history: ChatMessage[] = [], me = newME({}), known = new Set<string>();
// the state the next message sees: every recorded path (derived ones too) with its current value, as the demo's live mode sends it
const snapshot = (): Record<string, Json> => Object.fromEntries(Array.from(known).map((p) => [p, readPath(me, p) as Json]).filter(([, v]) => v !== undefined));
const STALE_AT = 4; // d1 sees the history of c1-c2 only (2 user + 2 assistant messages): a stale context, as a cached chat would be
const CHAT_TEXT = "\n\nCHAT MODE: you are also a normal assistant in a chat. If the user's message asks a question that records nothing, reply in plain conversational text, no JSON.";
for (const it of THREAD as any[]) {
  const state = snapshot(), t0 = Date.now();
  if (it.kind === "drift") {
    const msgs: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT + CHAT_TEXT }, ...history.slice(0, STALE_AT), { role: "user", content: it.text }];
    const reply = await model(msgs);
    rows.push({ id: it.id, text: it.text, lang: "en", state, context: "stale", reply, ms: Date.now() - t0, attempts: 1 });
    console.log(it.id, "text reply recorded (stale context)"); continue; // nothing to apply; not added to history
  }
  if (it.kind === "reject") {
    const r = await parse({ text: it.text, state } as any, { model, history, maxRepairs: 0 });
    let ops: any = null; try { ops = (extractJson(r.raw[0]) as any).ops; } catch {}
    rows.push({ id: it.id, text: it.text, lang: "en", state, ...(Array.isArray(ops) ? { ops } : { reply: r.raw[0] }), ok: r.ok, errors: r.errors, ms: Date.now() - t0, attempts: 1 });
    console.log(it.id, r.ok ? "ok (model avoided the unknown path)" : "rejected: " + r.errors.join("; ")); continue; // never applied
  }
  const r = await parse({ text: it.text, state } as any, { model, history });
  rows.push({ id: it.id, text: it.text, lang: "en", state, ops: r.ops, ok: r.ok, errors: r.errors, ms: Date.now() - t0, attempts: r.attempts });
  console.log(it.id, r.ok ? "ok" : "FAILED", r.attempts, "attempt(s)");
  if (!r.ok) { console.error("stopping: the next messages build on this one", r.errors); process.exit(1); }
  applyOps(me, r.ops, { confirm: true }); // the user confirms each proposal, so the next message builds on it
  touchedPaths(r.ops, Array.from(known)).forEach((p) => known.add(p));
  history.push({ role: "user", content: it.text }, { role: "assistant", content: JSON.stringify({ ops: r.ops }) });
}
fs.writeFileSync(path.join(L, "Meta/recorded-en.json"), JSON.stringify({ model: META_DEFAULTS.model, date: new Date().toISOString(), thread: rows }, null, 2) + "\n");
execFileSync(process.execPath, [path.join(L, "Meta/build-data.mjs")], { stdio: "inherit" });
