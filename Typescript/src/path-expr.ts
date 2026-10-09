/**
 * Path-expression parser for the collection aggregate `[]` (contract v4.1 §1.1 / v3 §3, §10.4).
 *
 * Parse only (stage S2). Nothing here evaluates an aggregate.
 *
 * Grammar (after `[i]` substitution):
 *
 *   path-expr     := head { "." seg }
 *   head          := seg | quoted
 *   seg           := name { selector }
 *   selector      := "[" fixed-key "]" | quoted
 *   quoted        := "[" '"' lit '"' "]" | "[" "'" lit "'" "]"     (the literal segment lit)
 *   aggregate-ref := path-expr "[]" [ "." field ]
 *   field         := name { "." name }                          (plain names only)
 *
 * Classification of a path-expression string:
 *   - "plain":     no bare `[]`, no whitespace-only selector, no quoted selector. Callers keep the 4.1 route.
 *   - "literal":   contains quoted selectors (and no operator). `segments` are the storage segments; `exact` is
 *                  true when every selector is a fixed key or a quoted literal, so the segments can be read as-is.
 *   - "aggregate": exactly one bare `[]` in an accepted position.
 *   - "rejected":  a form the contract rejects (it evaluates to `undefined`, `evaluation-failed`, writes nothing).
 *
 * Proxy properties are never parsed here: they are always literal segments (O5).
 */
import type { SemanticPath } from "./types.ts";
import { normalizeSelectorPath } from "./utils.ts";

export type AggregateOp = "count" | "sum";

export interface AggregateRef {
  /** The reference as written (after `[i]` substitution), e.g. `robots[3].batteries[].charge`. */
  text: string;
  /** Storage segments of the collection, e.g. ["robots", "3", "batteries"]. */
  collection: SemanticPath;
  /** Field path inside each member, or null for a count. */
  field: SemanticPath | null;
  op: AggregateOp;
}

export type RejectReason =
  | "nested-aggregate"          // x[].y[]  (more than one `[]`)
  | "operator-as-segment"       // z.[].w, [] , .[]
  | "whitespace-selector"       // z[ ].w
  | "selector-on-collection"    // x[a>1][], x[1..2][], x[[1,3]][], x[c => c.f][]
  | "invalid-field"             // x[].f[2], x[]x, x[].
  | "empty-collection-path";    // "[]" with nothing before it

export type PathExprClass =
  | { kind: "plain" }
  | { kind: "literal"; segments: SemanticPath; exact: boolean }
  | { kind: "aggregate"; ref: AggregateRef }
  | { kind: "rejected"; reason: RejectReason };

type Group = { start: number; end: number; content: string; quoted: boolean; literal?: string };

/** Quote-aware scan of the bracket groups of a path expression. Returns null on unbalanced input. */
function scanGroups(input: string): Group[] | null {
  const groups: Group[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "]") return null;
    if (ch !== "[") { i++; continue; }
    const start = i;
    const q = input[i + 1];
    if (q === '"' || q === "'") {
      const close = input.indexOf(q, i + 2);
      if (close !== -1 && input[close + 1] === "]") {
        const literal = input.slice(i + 2, close);
        groups.push({ start, end: close + 2, content: input.slice(i + 1, close + 1), quoted: true, literal });
        i = close + 2;
        continue;
      }
    }
    // Unquoted (or not a well-formed quoted selector): read to the matching "]", honouring nesting and quotes.
    let depth = 0;
    let quote: string | null = null;
    let j = i;
    for (; j < input.length; j++) {
      const c = input[j];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === "[") depth++;
      else if (c === "]") { depth--; if (depth === 0) break; }
    }
    if (j >= input.length) return null;
    groups.push({ start, end: j + 1, content: input.slice(i + 1, j), quoted: false });
    i = j + 1;
  }
  return groups;
}

const FIXED_KEY = /^[A-Za-z0-9_-]+$/;
const FIELD = /^(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/;

function isFixedOrQuoted(g: Group): boolean {
  return g.quoted || FIXED_KEY.test(g.content.trim());
}

const PLAIN: PathExprClass = Object.freeze({ kind: "plain" }) as PathExprClass;

/** Classify a path-expression string (see the module comment). */
export function classifyPathExpression(input: string): PathExprClass {
  const s = String(input ?? "").trim();
  if (!s.includes("[")) return PLAIN;              // fast path: no selector at all
  const groups = scanGroups(s);
  if (!groups) return { kind: "plain" };            // unbalanced: leave it to the 4.1 route

  const ops = groups.filter((g) => !g.quoted && g.content === "");
  const blank = groups.filter((g) => !g.quoted && g.content !== "" && g.content.trim() === "");
  const quoted = groups.filter((g) => g.quoted);

  if (ops.length === 0 && blank.length === 0 && quoted.length === 0) return { kind: "plain" };
  if (blank.length > 0) return { kind: "rejected", reason: "whitespace-selector" };
  if (ops.length > 1) return { kind: "rejected", reason: "nested-aggregate" };

  if (ops.length === 0) {
    const exact = groups.every(isFixedOrQuoted);
    return { kind: "literal", segments: normalizeSelectorPath(splitPathExpression(s)), exact };
  }

  const op = ops[0];
  const prefix = s.slice(0, op.start);
  const suffix = s.slice(op.end);
  if (!prefix) return { kind: "rejected", reason: "empty-collection-path" };
  if (prefix.endsWith(".")) return { kind: "rejected", reason: "operator-as-segment" };
  if (suffix !== "" && !FIELD.test(suffix)) return { kind: "rejected", reason: "invalid-field" };
  const prefixGroups = groups.filter((g) => g.end <= op.start);
  if (!prefixGroups.every(isFixedOrQuoted)) return { kind: "rejected", reason: "selector-on-collection" };

  const collection = normalizeSelectorPath(splitPathExpression(prefix));
  if (collection.length === 0) return { kind: "rejected", reason: "empty-collection-path" };
  const field = suffix ? suffix.slice(1).split(".") : null;
  return { kind: "aggregate", ref: { text: s, collection, field, op: field ? "sum" : "count" } };
}

/** Split a path expression on top-level dots (quote- and bracket-aware), like handleCall's splitPathExpr. */
export function splitPathExpression(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let quote: string | null = null;
  for (const ch of String(input ?? "")) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "." && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A segment is plain when it contains none of `[`, `]`, `"`, `'`. */
export function isPlainSegment(segment: string): boolean {
  return !/[\[\]"']/.test(segment);
}

/**
 * Render storage segments as a round-trippable path expression (contract §10.4):
 * plain segments bare and joined with "."; a non-plain segment `s` as `["s"]` (or `['s']` if `s` contains `"`),
 * attached without a dot. For all-plain paths this is exactly `segments.join(".")`.
 */
export function renderSegments(segments: SemanticPath): string {
  let out = "";
  for (const seg of segments) {
    if (isPlainSegment(seg)) {
      out += (out ? "." : "") + seg;
    } else {
      out += seg.includes('"') ? `['${seg}']` : `["${seg}"]`;
    }
  }
  return out;
}

/** Render a storage key (segments joined by ".", known issue #6: a segment never contains "."). */
export function renderKey(key: string): string {
  if (isPlainSegment(key)) return key;
  return renderSegments(String(key).split(".").filter(Boolean));
}

/** Render an aggregate reference: `<collection>[]` or `<collection>[].<field>`. */
export function renderAggregate(ref: AggregateRef): string {
  return renderSegments(ref.collection) + "[]" + (ref.field ? "." + ref.field.join(".") : "");
}

/**
 * Regex source for an aggregate token inside formula text: a dotted path of names with optional selectors,
 * then `[]`, then optional `.field`. Each match is classified with classifyPathExpression.
 */
export const AGGREGATE_TOKEN_SOURCE = (seg: string) =>
  String.raw`${seg}(?:\.${seg})*\[\](?:\.[A-Za-z_][A-Za-z0-9_]*)*`;

/** True when an identifier token holds a whitespace-only selector (`z[ ].w`), which the contract rejects. */
export function hasWhitespaceSelector(token: string): boolean {
  const groups = scanGroups(token);
  return !!groups && groups.some((g) => !g.quoted && g.content !== "" && g.content.trim() === "");
}
