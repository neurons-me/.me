// Strict check of a model reply against LLMS/ops.schema.json plus the path rules. No other keys are accepted anywhere.
import type { Op } from "./types.ts";
import { pathError, nameError } from "./paths.ts";

const FIELDS: Record<string, string[]> = {
  set: ["path", "value"], define: ["path", "name", "expr"], pointer: ["path", "target"], remove: ["path", "key"],
  secret: ["path"], noise: ["path"], identity: ["handle"], query: ["paths"],
};
// set ops that look like the model wrote a secret value (password, key, seed, pin...) are rejected: the user types those.
const SECRETISH = /(pass(word)?|contrase(ñ|n)a|clave|secret|seed|semilla|pin|token|api[_-]?key|private[_-]?key|^key$)/i;
const EXPR = /^[\p{L}\p{N}_$.\[\]\s+\-*/%()<>=!&|?:,'"]+$/u;

export function extractJson(text: unknown): unknown {
  if (typeof text !== "string") throw new Error("model reply is not text");
  const t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  try { return JSON.parse(fence ? fence[1] : t); } catch { throw new Error("model reply is not a JSON object"); }
}

/** GUI.* paths drive the page's own chrome: only these paths, only these values (set / query). */
export const GUI_ALLOW: Record<string, string[]> = { "GUI.window.layout.qr.corner": ["top-left", "top-right", "bottom-left", "bottom-right"] };
function guiError(o: any): string | null {
  const ps = [o.path, o.target, ...(Array.isArray(o.paths) ? o.paths : [])].filter((p): p is string => typeof p === "string");
  for (const p of ps) {
    if (!/^GUI(\.|\[|$)/.test(p)) continue;
    const c = p.replace(/\[(\d+)\]/g, ".$1");
    if (!GUI_ALLOW[c]) return `"${p}" is not a writable GUI path (allowed: ${Object.keys(GUI_ALLOW).join(", ")})`;
    if (o.op === "set" && !GUI_ALLOW[c].includes(o.value)) return `${p} must be one of ${GUI_ALLOW[c].join(", ")}`;
    if (o.op !== "set" && o.op !== "query") return `${p} only accepts set / query`;
  }
  return null;
}

export function validateOps(obj: unknown): { ops: Op[]; errors: string[] } {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ops: [], errors: ["reply must be an object {\"ops\":[...]}"] };
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== "ops") return { ops: [], errors: ['reply must have exactly one key "ops"'] };
  const list = (obj as any).ops;
  if (!Array.isArray(list)) return { ops: [], errors: ["ops must be an array"] };
  if (list.length > 64) return { ops: [], errors: ["ops has more than 64 items"] };
  list.forEach((o: any, i: number) => {
    const w = `ops[${i}]`;
    if (!o || typeof o !== "object" || Array.isArray(o)) return errors.push(`${w} must be an object`);
    const f = FIELDS[o.op];
    if (!f) return errors.push(`${w}.op ${JSON.stringify(o.op)} is not one of ${Object.keys(FIELDS).join(", ")}`);
    for (const k of Object.keys(o)) if (k !== "op" && !f.includes(k)) errors.push(`${w} (${o.op}) has unknown key "${k}"${o.op === "secret" || o.op === "noise" ? " (the user types secret keys; never include them)" : ""}`);
    for (const k of f) if (!(k in o)) errors.push(`${w} (${o.op}) is missing "${k}"`);
    const pe = (p: unknown, name: string, broadcast = false) => { const e = pathError(p, { broadcast }); if (e) errors.push(`${w}.${name}: ${e}`); };
    switch (o.op) {
      case "set":
        pe(o.path, "path");
        if (o.value === undefined) errors.push(`${w}.value is missing`);
        if (typeof o.path === "string" && SECRETISH.test(o.path.split(".").pop() || "")) errors.push(`${w}: "${o.path}" looks like a secret value; never write secrets, use {"op":"secret","path":...} and let the user type it`);
        break;
      case "define":
        pe(o.path, "path", true);
        { const e = nameError(o.name); if (e) errors.push(`${w}.name: ${e}`); }
        if (typeof o.expr !== "string" || !o.expr.trim() || o.expr.length > 300 || !EXPR.test(o.expr)) errors.push(`${w}.expr must be an arithmetic/comparison expression over paths`);
        else if (/=>|function|\bnew\b|`/.test(o.expr)) errors.push(`${w}.expr must not contain code`);
        break;
      case "pointer": pe(o.path, "path"); pe(o.target, "target"); break;
      case "remove": pe(o.path, "path"); { const e = nameError(o.key); if (e && !/^\d+$/.test(String(o.key))) errors.push(`${w}.key: ${e}`); } break;
      case "secret": case "noise": pe(o.path, "path"); break;
      case "identity": if (typeof o.handle !== "string" || !/^[a-z0-9][a-z0-9._-]{0,62}$/i.test(o.handle.replace(/^@/, ""))) errors.push(`${w}.handle must be a username`); break;
      case "query":
        if (!Array.isArray(o.paths) || !o.paths.length) errors.push(`${w}.paths must be a non-empty array`);
        else o.paths.forEach((p: unknown, j: number) => pe(p, `paths[${j}]`));
        break;
    }
    { const ge = guiError(o); if (ge) errors.push(`${w}: ${ge}`); }
  });
  if (errors.length) return { ops: [], errors };
  return { ops: list.map((o: any) => (o.op === "identity" ? { ...o, handle: o.handle.replace(/^@/, "").toLowerCase() } : o)), errors };
}

// Every name a define's expr reads must exist: in the state, or written earlier in the same op list. Names resolve from the
// define's own path up to the root (cafe.order + "tip" -> cafe.order.tip, cafe.tip, tip). An unknown name is rejected here, at
// "validated", before any kernel sees the op: the model cannot invent an input (e.g. a "tip" nobody recorded).
const EXPR_WORDS = new Set(["true", "false", "null", "undefined", "and", "or", "not"]);
const canonP = (p: string) => p.split(".").reduce((a, s) => (/^\d+$/.test(s) && a ? `${a}[${s}]` : a ? `${a}.${s}` : s), "");
export function exprRefs(expr: string): string[] {
  const noStr = expr.replace(/"[^"]*"|'[^']*'/g, " ");
  return [...new Set((noStr.match(/[\p{L}_$][\p{L}\p{N}_$]*(?:\[(?:\d+|i)\])?(?:\.[\p{L}_$][\p{L}\p{N}_$]*(?:\[(?:\d+|i)\])?|\.\d+)*/gu) || [])
    .filter((w) => !EXPR_WORDS.has(w)))];
}
export function refErrors(ops: Op[], knownPaths: string[]): string[] {
  const has = new Set<string>(), errors: string[] = [];
  const addP = (p: string) => { const c = canonP(p); let q = ""; for (const s of c.split(".")) { q = q ? `${q}.${s}` : s; has.add(q); has.add(q.replace(/\[\d+\]/g, "[i]")); const m = q.match(/^(.*)\[\d+\]$/); if (m) has.add(m[1]); } };
  knownPaths.forEach(addP);
  ops.forEach((o: any, i) => {
    if (o.op === "set" || o.op === "pointer") addP(o.path);
    if (o.op !== "define" || typeof o.expr !== "string") return;
    const base = canonP(o.path).split(".");
    for (const r of exprRefs(o.expr)) {
      const rc = canonP(r), tried: string[] = [];
      let ok = false;
      for (let k = base.length; k >= 0 && !ok; k--) { const c = (k ? base.slice(0, k).join(".") + "." : "") + rc; tried.push(c); if (has.has(c) || has.has(c.replace(/\[\d+\]/g, "[i]"))) ok = true; }
      if (!ok) errors.push(`ops[${i}].expr: unknown path "${r}" — nothing in the state is called that (looked for ${tried.join(", ")}); nothing was written`);
    }
    addP(`${o.path}.${o.name}`);
  });
  return errors;
}
