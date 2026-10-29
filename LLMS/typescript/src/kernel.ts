// Dry-run on a throwaway this.me ME: load the state, apply the ops, read back the touched paths, and return a diff.
import { ME } from "this.me";
import type { Json, Op, DiffEntry } from "./types.ts";
import { proxyKeys, canonicalPath } from "./paths.ts";
import { CONFIRM_OPS } from "./types.ts";

const isPlain = (v: unknown): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);
/** Nested state -> [canonical leaf path, value]. Arrays are leaf values (as in the kernel). */
export function flattenState(state: Json | undefined, prefix = ""): [string, Json][] {
  if (!isPlain(state)) return prefix ? [[canonicalPath(prefix), state as Json]] : [];
  const out: [string, Json][] = [];
  for (const [k, v] of Object.entries(state)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (isPlain(v) && Object.keys(v).length) out.push(...flattenState(v, p));
    else if (!isPlain(v)) out.push([canonicalPath(p), v]);
  }
  return out;
}

function node(me: any, path: string): any { let n = me; for (const k of proxyKeys(path)) n = n[k]; return n; }
const read = (me: any, path: string): Json | undefined => { try { return me(canonicalPath(path)); } catch { return undefined; } };

export function newME(state?: Json): any {
  const me: any = new (ME as any)();
  for (const [p, v] of flattenState(state)) node(me, p)(v);
  return me;
}

export type ApplyOptions = { secretKeys?: Record<string, string>; confirm?: boolean | Op[]; dryRun?: boolean };
/** Apply validated ops to a ME. Outside a dry run, confirm-ops need confirmation and secret/noise need a key typed by the user. */
export function applyOps(me: any, ops: Op[], opts: ApplyOptions = {}): Record<string, Json | undefined> {
  const reads: Record<string, Json | undefined> = {};
  for (const o of ops) {
    if (!opts.dryRun && (CONFIRM_OPS as readonly string[]).includes(o.op)) {
      const c = opts.confirm;
      if (!(c === true || (Array.isArray(c) && c.includes(o)))) throw new Error(`op ${o.op} needs user confirmation`);
    }
    switch (o.op) {
      case "set": node(me, o.path)(o.value); break;
      case "define": node(me, o.path)["="](o.name, o.expr); break;
      case "pointer": node(me, o.path)["->"](canonicalPath(o.target)); break;
      case "remove": node(me, o.path)["-"](o.key); break;
      case "secret": case "noise": {
        const key = opts.dryRun ? "llms-me-dry-run-placeholder" : opts.secretKeys?.[o.path];
        if (!key) throw new Error(`op ${o.op} on ${o.path}: the user must type the key`);
        node(me, o.path)[o.op === "secret" ? "_" : "~"](key); break;
      }
      case "identity": me["@"](o.handle); break;
      case "query": for (const p of o.paths) reads[canonicalPath(p)] = read(me, p); break;
    }
  }
  return reads;
}

/** Leaf paths an op list touches; [i] expands over the indexes that exist in `known`. */
export function touchedPaths(ops: Op[], known: string[]): string[] {
  const out = new Set<string>();
  for (const o of ops) {
    if (o.op === "set" || o.op === "pointer") out.add(canonicalPath(o.path));
    else if (o.op === "remove") out.add(canonicalPath(`${o.path}.${o.key}`));
    else if (o.op === "define") {
      const p = canonicalPath(o.path);
      if (p.includes("[i]")) {
        const [pre] = p.split("[i]");
        const idx = new Set(known.map((k) => k.startsWith(pre + "[") ? k.slice(pre.length).match(/^\[(\d+)\]/)?.[1] : undefined).filter(Boolean));
        for (const i of idx) out.add(p.replace("[i]", `[${i}]`) + "." + o.name);
      } else out.add(`${p}.${o.name}`);
    }
  }
  return [...out];
}

export function dryRun(state: Json | undefined, ops: Op[]) {
  const known = flattenState(state).map(([p]) => p);
  const before = newME(state), after = newME(state);
  const errors: string[] = [];
  let reads: Record<string, Json | undefined> = {};
  try { reads = applyOps(after, ops, { dryRun: true }); } catch (e: any) { errors.push(`kernel rejected the ops: ${e.message}`); }
  const paths = touchedPaths(ops, known);
  const diff: DiffEntry[] = paths.map((p) => ({ path: p, before: read(before, p), after: read(after, p) }));
  // a derivation that reads back undefined names something that does not exist (or is not expressible)
  ops.forEach((o, i) => {
    if (o.op !== "define") return;
    const ps = touchedPaths([o], known);
    if (!ps.length) errors.push(`ops[${i}]: define on ${o.path} matches no existing members`);
    for (const p of ps) if (read(after, p) === undefined) errors.push(`ops[${i}]: ${p} = "${o.expr}" evaluates to undefined (unknown name in expr?)`);
  });
  return { diff, reads, errors, me: after };
}
export { read as readPath };
