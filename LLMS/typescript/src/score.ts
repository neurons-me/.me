// Scoring used by the eval: compares predicted ops with expected ops on a fresh ME loaded with the same state.
import type { Json, Op } from "./types.ts";
import { canonicalPath } from "./paths.ts";
import { dryRun, flattenState, touchedPaths, readPath } from "./kernel.ts";

const canon = (o: Op): string => {
  const c: any = { ...o };
  for (const k of ["path", "target"]) if (typeof c[k] === "string") c[k] = canonicalPath(c[k]);
  if (c.op === "define") c.expr = c.expr.replace(/\s+/g, "");
  if (c.op === "query") c.paths = c.paths.map(canonicalPath).sort();
  return JSON.stringify(c, Object.keys(c).sort());
};
const CONTROL = new Set(["secret", "noise", "identity", "query"]);
export const sameOps = (a: Op[], b: Op[]) => JSON.stringify(a.map(canon).sort()) === JSON.stringify(b.map(canon).sort());

/** Same final state on every path either list touches, and the same control ops (secret/noise/identity/query). */
export function sameFinalState(state: Json | undefined, expected: Op[], predicted: Op[]): boolean {
  const known = flattenState(state).map(([p]) => p);
  const e = dryRun(state, expected), p = dryRun(state, predicted);
  if (e.errors.length || p.errors.length) return false;
  const paths = new Set([...touchedPaths(expected, known), ...touchedPaths(predicted, known)]);
  for (const x of paths) if (JSON.stringify(readPath(e.me, x)) !== JSON.stringify(readPath(p.me, x))) return false;
  return sameOps(expected.filter((o) => CONTROL.has(o.op)), predicted.filter((o) => CONTROL.has(o.op)));
}
