/**
 * Path-expression parser for the collection aggregate `[]` (contract v4.1 §1.1 / v3 §3, §10.4).
 *
 * Parse only (stage S2). Nothing here evaluates an aggregate.
 *
 * A string is "aggregate-like" when it holds, outside quotes, a bare `[]` or a whitespace-only selector `[ ]`.
 * Only aggregate-like strings are classified as `aggregate` or `rejected`. Every other string is `plain` (no
 * quoted selector) or `literal` (has one) and keeps the 4.1 route; see §3 "Scope of the parser" in the contract.
 *
 * Grammar of an aggregate reference (after `[i]` substitution):
 *
 *   aggregate-ref := path-expr "[]" [ "." field ]
 *   path-expr     := head { "." seg }
 *   head          := seg | quoted
 *   seg           := name { selector }
 *   selector      := "[" fixed-key "]" | quoted
 *   quoted        := "[" '"' lit '"' "]" | "[" "'" lit "'" "]"     (the literal segment lit)
 *   field         := name { "." name }                            (plain names only)
 *   name          := 1+ characters, none of  .  [  ]  "  '  whitespace  + * / % ( ) < > = ! & | ,
 *   fixed-key     := non-blank selector text that the 4.1 selector parsers do NOT interpret:
 *                    not a transform (parseTransformSelector), not a range or list (parseSelectorKeys),
 *                    not a filter (parseLogicalFilterExpression). This is exactly the set 4.1 reads as a fixed
 *                    child segment through normalizeSelectorPath.
 *
 * Classes:
 *   - "plain":     not aggregate-like, and no quoted selector (or one whose text contains ".", kept as 4.1).
 *   - "literal":   not aggregate-like, has quoted selectors. `segments` are the storage segments.
 *   - "aggregate": aggregate-like and matches the grammar above.
 *   - "rejected":  aggregate-like and does not match it.
 *
 * Proxy properties are never parsed here: they are always literal segments (O5).
 */
import type { SemanticPath } from "./types.ts";
import {
  normalizeSelectorPath,
  parseLogicalFilterExpression,
  parseSelectorKeys,
  parseTransformSelector,
} from "./utils.ts";

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
  | "empty-collection-path"     // "[]" with nothing before it
  | "invalid-collection-path";  // a name with whitespace, a quoted selector after a dot, "a..b[]"

export type PathExprClass =
  | { kind: "plain" }
  | { kind: "literal"; segments: SemanticPath }
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

// No ".", brackets, quotes, whitespace, or formula operator characters (they delimit formula tokens).
const NAME = String.raw`[^.\[\]"'\s+*/%()<>=!&|,]+`;
const FIELD = new RegExp(String.raw`^(?:\.${NAME})+$`);

/** A selector the 4.1 kernel reads as a fixed child (see the grammar). Quoted selectors are always fixed. */
export function isFixedKeySelector(content: string, quoted = false): boolean {
  if (quoted) return true;
  const c = String(content ?? "").trim();
  if (!c) return false;
  if (parseTransformSelector(c)) return false;
  if (parseSelectorKeys(c) !== null) return false;
  if (parseLogicalFilterExpression(c)) return false;
  return true;
}

function isFixedOrQuoted(g: Group): boolean {
  return isFixedKeySelector(g.content, g.quoted);
}

/** The collection prefix `head { "." seg }`, with selectors removed, must consist of names (grammar above). */
function prefixHasValidNames(prefix: string, groups: Group[]): boolean {
  let stripped = "";
  let i = 0;
  for (const g of groups) {
    stripped += prefix.slice(i, g.start) + "\u0000";
    i = g.end;
  }
  stripped += prefix.slice(i);
  const parts = stripped.split(".");
  return parts.every((part, idx) => {
    if (part === "") return false;
    const name = part.replace(/\u0000/g, "");
    if (name === "") return idx === 0 && part.startsWith("\u0000");   // only the head may be a bare quoted selector
    if (!new RegExp(`^${NAME}$`).test(name)) return false;
    return !/\u0000[^\u0000]/.test(part);                              // selectors only after the name
  });
}

const PLAIN: PathExprClass = Object.freeze({ kind: "plain" }) as PathExprClass;

/** Classify a path-expression string (see the module comment). */
export function classifyPathExpression(input: string): PathExprClass {
  const s = String(input ?? "").trim();
  if (!s.includes("[")) return PLAIN;              // fast path: no selector at all
  const groups = scanGroups(s);
  if (!groups) return PLAIN;                       // unbalanced brackets: not aggregate-like, 4.1 route

  const ops = groups.filter((g) => !g.quoted && g.content === "");
  const blank = groups.filter((g) => !g.quoted && g.content !== "" && g.content.trim() === "");
  const quoted = groups.filter((g) => g.quoted);

  // Contract v3 §3: a quoted selector whose content contains "." is not specified; 4.1 behaviour is kept.
  const quotedDot = quoted.some((g) => (g.literal ?? "").includes("."));
  if (ops.length === 0 && blank.length === 0) {
    if (quoted.length === 0 || quotedDot) return PLAIN;
    return { kind: "literal", segments: normalizeSelectorPath(splitPathExpression(s)) };
  }

  // aggregate-like from here on
  if (blank.length > 0) return { kind: "rejected", reason: "whitespace-selector" };
  if (quotedDot) return { kind: "rejected", reason: "invalid-collection-path" };   // lit := no "." (grammar)
  if (ops.length > 1) return { kind: "rejected", reason: "nested-aggregate" };

  const op = ops[0];
  const prefix = s.slice(0, op.start);
  const suffix = s.slice(op.end);
  if (!prefix) return { kind: "rejected", reason: "empty-collection-path" };
  if (prefix.endsWith(".")) return { kind: "rejected", reason: "operator-as-segment" };
  if (suffix !== "" && !FIELD.test(suffix)) return { kind: "rejected", reason: "invalid-field" };
  const prefixGroups = groups.filter((g) => g.end <= op.start);
  if (prefix.startsWith("[") && !(prefixGroups[0] && prefixGroups[0].start === 0 && prefixGroups[0].quoted)) {
    return { kind: "rejected", reason: "invalid-collection-path" };   // head := seg | quoted
  }
  if (!prefixHasValidNames(prefix, prefixGroups)) return { kind: "rejected", reason: "invalid-collection-path" };
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
