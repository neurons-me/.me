// Path rules from LLMS/grammar.md. A path is dot-separated segments; a segment is a name with an optional [n] or [i], or a bare index.
const NAME = /^[\p{L}_$][\p{L}\p{N}_$-]*$/u;
const SEG = /^([\p{L}_$][\p{L}\p{N}_$-]*)(\[(\d+|i)\])?$/u;
const OPERATOR_SEGMENTS = new Set(["_", "~", "@", "__", "->", "=", "?", "-", "+"]);

export function pathError(path: unknown, { broadcast = false } = {}): string | null {
  if (typeof path !== "string" || !path.length) return "path must be a non-empty string";
  if (path.length > 200) return "path is longer than 200 chars";
  const segs = path.split(".");
  if (segs.length > 16) return "path is deeper than 16 segments";
  for (const s of segs) {
    if (OPERATOR_SEGMENTS.has(s)) return `segment "${s}" is an operator, not a name`;
    if (/^\d+$/.test(s)) continue;
    const m = s.match(SEG);
    if (!m) return `segment "${s}" is not a valid name`;
    if (m[3] === "i" && !broadcast) return `[i] is only allowed in a define path`;
  }
  return null;
}
export const nameError = (n: unknown): string | null =>
  typeof n === "string" && NAME.test(n) && !OPERATOR_SEGMENTS.has(n) ? null : `"${String(n)}" is not a valid name`;

/** Canonical form: trucks.1 -> trucks[1] (the kernel treats them as the same segment). */
export function canonicalPath(path: string): string {
  return path.split(".").reduce((acc, s) => (/^\d+$/.test(s) && acc ? `${acc}[${s}]` : acc ? `${acc}.${s}` : s), "");
}
/** Property keys to walk on the me proxy: items[1] -> "items","1"; trucks[i] stays one key (broadcast). */
export function proxyKeys(path: string): string[] {
  const out: string[] = [];
  for (const s of path.split(".")) {
    const m = s.match(/^(.*)\[(\d+)\]$/);
    if (m) out.push(m[1], m[2]); else out.push(s);
  }
  return out;
}
