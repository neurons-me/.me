import type {
  MEKernelLike,
  OperatorRegistry,
  SemanticPath,
} from "./types.ts";

export function hashFn(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export function cloneValue<T>(value: T): T {
  const sc = (globalThis as any).structuredClone;
  if (typeof sc === "function") return sc(value);
  return JSON.parse(JSON.stringify(value));
}

export function findTopLevelIndex(input: string, needle: string): number {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "[") depth++;
    else if (char === "]") depth = Math.max(0, depth - 1);
    else if (char === needle && depth === 0) return i;
  }
  return -1;
}

// Turn path segments into storage segments: `x[2]` → x, 2; `x["k"]` / `x['k']` → x, k (quote-aware: the quoted
// text may contain `[` or `]`, so `z["[]"]` → z, "[]"). A segment with an empty or blank selector (`[]`, `x[]`,
// `z[ ]`) is kept whole as a literal segment; 4.1 dropped the selector, which moved `["="]` declarations under a
// literal `[]` to the parent (contract v3 I6) and made literal `[]` segments unreadable. Bare `[]` in a path
// *string* is the aggregate operator and is recognised before this (path-expr.ts); here segments are literal.
export function normalizeSelectorPath(path: SemanticPath): SemanticPath {
  const out: SemanticPath = [];
  for (const segment of path) {
    const s = String(segment).trim();
    if (!s) continue;
    const firstBracket = s.indexOf("[");
    if (firstBracket === -1) {
      out.push(s);
      continue;
    }

    const base = s.slice(0, firstBracket).trim();
    const tail = s.slice(firstBracket);

    const selectors: Array<{ text: string; quoted: boolean }> = [];
    let ok = true;
    let i = 0;
    while (i < tail.length) {
      if (tail[i] !== "[") { ok = false; break; }
      const q = tail[i + 1];
      if (q === '"' || q === "'") {
        const close = tail.indexOf(q, i + 2);
        if (close !== -1 && tail[close + 1] === "]") {
          selectors.push({ text: tail.slice(i + 2, close), quoted: true });
          i = close + 2;
          continue;
        }
      }
      const close = tail.indexOf("]", i + 1);
      if (close === -1) { ok = false; break; }
      const inner = tail.slice(i + 1, close);
      let text = inner.trim();
      let quoted = false;
      if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
        text = text.slice(1, -1);
        quoted = true;
      }
      selectors.push({ text, quoted });
      i = close + 1;
    }

    if (!ok) {
      if (base) out.push(base);
      out.push(tail);
      continue;
    }
    if (selectors.some((sel) => !sel.quoted && sel.text === "")) {
      out.push(s);
      continue;
    }

    if (base) out.push(base);
    for (const sel of selectors) {
      if (!sel.text) continue;
      out.push(sel.text);
    }
  }
  return out;
}

/**
 * The 4.1.0 normalizer, kept verbatim for ONE purpose: the scope path of a secret declaration `["_"](key)`.
 *
 * Historical protection (contract v3 §3 "Secret scopes through literal bracket segments"): in 4.1.0,
 * `me.z["[]"]["_"]("k")` declares the secret scope on `z` (the empty selector is dropped), so the whole branch `z`
 * is stealth. 4.2 keeps literal `[]` segments everywhere else (I6), but a secret declaration keeps the 4.1 scope,
 * because narrowing it to `z.[]` would silently make the rest of `z` public. Not quote-aware, drops empty and
 * blank selectors, exactly as 4.1.0 (utils.ts:33–68 at adf38cd). Do not use it anywhere else.
 */
export function normalizeSecretScopePath41(path: SemanticPath): SemanticPath {
  const out: SemanticPath = [];
  for (const segment of path) {
    const s = String(segment).trim();
    if (!s) continue;
    const firstBracket = s.indexOf("[");
    if (firstBracket === -1) {
      out.push(s);
      continue;
    }
    const base = s.slice(0, firstBracket).trim();
    const tail = s.slice(firstBracket);
    if (base) out.push(base);
    const matches = Array.from(tail.matchAll(/\[([^\]]*)\]/g));
    const reconstructed = matches.map((m) => m[0]).join("");
    if (reconstructed !== tail) {
      out.push(tail);
      continue;
    }
    for (const m of matches) {
      let selector = (m[1] ?? "").trim();
      if (
        (selector.startsWith('"') && selector.endsWith('"')) ||
        (selector.startsWith("'") && selector.endsWith("'"))
      ) {
        selector = selector.slice(1, -1);
      }
      if (!selector) continue;
      out.push(selector);
    }
  }
  return out;
}

export function pathContainsIterator(path: SemanticPath): boolean {
  return path.some((segment) => segment.includes("[i]"));
}

export function substituteIteratorInPath(path: SemanticPath, indexValue: string): SemanticPath {
  return path.map((segment) => segment.split("[i]").join(`[${indexValue}]`));
}

export function substituteIteratorInExpression(expr: string, indexValue: string): string {
  return String(expr ?? "").split("[i]").join(`[${indexValue}]`);
}

export function parseFilterExpression(
  expr: string,
): { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string } | null {
  const s = String(expr ?? "").trim();
  const m = s.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!m) return null;
  const left = m[1].trim();
  const op = m[2] as ">" | "<" | ">=" | "<=" | "==" | "!=";
  const right = m[3].trim();
  if (!left || !right) return null;
  return { left, op, right };
}

export function parseLogicalFilterExpression(
  expr: string,
): {
  clauses: Array<{ left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }>;
  ops: Array<"&&" | "||">;
} | null {
  const raw = String(expr ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(/\s*(&&|\|\|)\s*/).filter((p) => p.length > 0);
  if (parts.length === 0) return null;

  const clauses: Array<{ left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string }> = [];
  const ops: Array<"&&" | "||"> = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const clause = parseFilterExpression(parts[i]);
      if (!clause) return null;
      clauses.push(clause);
    } else {
      const op = parts[i] as "&&" | "||";
      if (op !== "&&" && op !== "||") return null;
      ops.push(op);
    }
  }

  if (clauses.length === 0) return null;
  if (ops.length !== Math.max(0, clauses.length - 1)) return null;
  return { clauses, ops };
}

export function compareValues(
  left: any,
  op: ">" | "<" | ">=" | "<=" | "==" | "!=",
  right: any,
): boolean {
  switch (op) {
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "==":
      return left == right;
    case "!=":
      return left != right;
    default:
      return false;
  }
}

export function parseLiteralOrPath(
  raw: string,
): { kind: "literal"; value: any } | { kind: "path"; parts: SemanticPath } {
  const s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return { kind: "literal", value: s.slice(1, -1) };
  }
  if (s === "true") return { kind: "literal", value: true };
  if (s === "false") return { kind: "literal", value: false };
  if (s === "null") return { kind: "literal", value: null };
  const n = Number(s);
  if (Number.isFinite(n)) return { kind: "literal", value: n };
  return { kind: "path", parts: normalizeSelectorPath(s.split(".").filter(Boolean)) };
}

export function parseSelectorSegment(segment: string): { base: string; selector: string } | null {
  const s = String(segment ?? "").trim();
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first <= 0 || last <= first) return null;
  if (last !== s.length - 1) return null;
  const base = s.slice(0, first).trim();
  const selector = s.slice(first + 1, last).trim();
  if (!base || !selector) return null;
  return { base, selector };
}

export function parseSelectorKeys(selector: string): string[] | null {
  const s = selector.trim();

  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
    return parts.map((p) => {
      if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
        return p.slice(1, -1);
      }
      return p;
    });
  }

  const range = s.match(/^(-?\d+)\s*\.\.\s*(-?\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const step = start <= end ? 1 : -1;
    const out: string[] = [];
    const maxSpan = 10000;
    if (Math.abs(end - start) > maxSpan) return null;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) out.push(String(n));
    return out;
  }

  return null;
}

export function parseTransformSelector(selector: string): { varName: string; expr: string } | null {
  const s = selector.trim();
  const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(.+)$/);
  if (!m) return null;
  const varName = m[1].trim();
  const expr = m[2].trim();
  if (!varName || !expr) return null;
  return { varName, expr };
}

export function createDefaultOperators(): Record<string, { kind: string }> {
  return {
    "_": { kind: "secret" },
    "~": { kind: "noise" },
    "__": { kind: "pointer" },
    "->": { kind: "pointer" },
    "@": { kind: "identity" },
    "=": { kind: "eval" },
    "?": { kind: "query" },
    "-": { kind: "remove" },
  };
}

export function getPrevMemoryHash(self: MEKernelLike): string {
  const prev = self._memories[self._memories.length - 1];
  return prev?.hash ?? "";
}

export function now(): number {
  return Date.now();
}
