import type {
  MEKernelLike,
  OperatorRegistry,
  SemanticPath,
} from "./types.js";

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
