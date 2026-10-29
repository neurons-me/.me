// parse(): text (+ optional state/schema) -> validated .me ops. Model-agnostic: pass any ChatModel (see adapters/).
// Flow: prompt -> model -> JSON -> schema + path rules -> dry-run on a throwaway ME -> diff. On failure the exact errors go back
// to the model for up to `maxRepairs` more tries. Nothing is ever applied to a real ME here.
import type { ChatModel, ParseInput, ParseResult, ChatMessage, Op } from "./types.ts";
import { CONFIRM_OPS } from "./types.ts";
import { buildMessages } from "./prompt.ts";
import { extractJson, validateOps } from "./validate.ts";
import { dryRun } from "./kernel.ts";

export type ParseOptions = { model: ChatModel; maxRepairs?: number; secretPaths?: string[]; examples?: any[] };

export async function parse(input: ParseInput, opts: ParseOptions): Promise<ParseResult> {
  if (!input || typeof input.text !== "string" || !input.text.trim()) throw new Error("parse: text is required");
  const text = input.text.slice(0, 4000);
  const maxRepairs = Math.max(0, Math.min(2, opts.maxRepairs ?? 2));
  const messages: ChatMessage[] = buildMessages({ ...input, text }, { secretPaths: opts.secretPaths, examples: opts.examples });
  const raw: string[] = [];
  let errors: string[] = [];
  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const reply = await opts.model(messages);
    raw.push(reply);
    let ops: Op[] = [];
    try {
      const v = validateOps(extractJson(reply));
      ops = v.ops; errors = v.errors;
    } catch (e: any) { errors = [e.message]; }
    if (!errors.length) {
      const d = dryRun(input.state as any, ops);
      errors = d.errors;
      if (!errors.length) {
        return { ok: true, ops, needsConfirm: ops.filter((o) => (CONFIRM_OPS as readonly string[]).includes(o.op)), diff: d.diff, reads: d.reads, errors: [], attempts: attempt, raw };
      }
    }
    messages.push({ role: "assistant", content: reply });
    messages.push({ role: "user", content: `Your reply was rejected:\n- ${errors.join("\n- ")}\nReply again with ONLY the corrected JSON object {"ops":[...]}.` });
  }
  return { ok: false, ops: [], needsConfirm: [], diff: [], reads: {}, errors, attempts: maxRepairs + 1, raw };
}
