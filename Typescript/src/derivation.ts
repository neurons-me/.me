import { isPointer, pathStartsWith } from "./operators.ts";
import { hasPointerOnPath, pointerReadTrajectory } from "./core-index.ts";
import { resolveBranchScope } from "./secret.ts";
import type {
  MEDerivationRecord,
  MEDerivationUnresolved,
  MEIteratorRule,
  MEExplainResult,
  MEKernelLike,
  SemanticPath,
} from "./types.ts";
import { tryEvaluateAssignExpression } from "./evaluator.ts";
import { normalizeSelectorPath } from "./utils.ts";
import {
  AGGREGATE_TOKEN_SOURCE,
  classifyPathExpression,
  renderAggregate,
  renderKey,
  renderSegments,
  type AggregateRef,
} from "./path-expr.ts";

// ─── aggregates: result, explain entry, primary reason ─────────────────────────

/** Evaluation context of an aggregate (contract v4.1 §2.3). Fixed by the request, never by the data. */
export type AggregateContext = "public-view" | "authorized";

export interface AggregateResult {
  value: number | undefined;
  /** "resolved" | "absent" | "incomplete" | "deferred" | "non-finite" | "cycle" | "unsupported" */
  status: string;
  reason?: string;
  members: number | null;
  terms: number | null;
  domain: "number" | "boolean" | null;
  problems?: { count: number; sample: Array<{ path: string; kind: string }> };
}

/**
 * The value of one aggregate reference in a context. STAGE S2: parsed, not evaluated, so every aggregate is
 * `unsupported` (reason "not-implemented"); S3 replaces this body with the reference evaluator.
 */
export function aggregateResult(
  _self: MEKernelLike,
  _ref: AggregateRef,
  _context: AggregateContext,
  _targetKey?: string,
): AggregateResult {
  return { value: undefined, status: "unsupported", reason: "not-implemented", members: null, terms: null, domain: null };
}

// Explain entry for one aggregate reference. Context and coverage come only from the evaluation context, never
// from the data.
function aggregateInput(
  ref: AggregateRef,
  context: AggregateContext,
  r: AggregateResult,
): NonNullable<MEExplainResult["derivation"]>["inputs"][number] {
  return {
    label: ref.text,
    path: renderAggregate(ref),
    kind: "aggregate",
    value: r.value,
    origin: "public",
    masked: false,
    status: r.status,
    aggregate: {
      collection: renderSegments(ref.collection),
      field: ref.field ? ref.field.join(".") : null,
      op: ref.op,
      context,
      coverage: context,
      status: r.status,
      ...(r.reason ? { reason: r.reason } : {}),
      members: r.members,
      terms: r.terms,
      domain: r.domain,
      ...(r.problems ? { problems: r.problems } : {}),
    },
  };
}

const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * Primary reason of a formula (or ad hoc aggregate) that has aggregate inputs, by a FIXED precedence that does not
 * depend on evaluation or input order (contract v3 §11 I5):
 *   cycle > missing-input > incomplete > evaluation-failed
 * - missing-input: a scalar input has no value, or an aggregate is `absent` (empty collection);
 * - incomplete: an aggregate has members whose term is missing or not admissible;
 * - evaluation-failed: an aggregate is `unsupported`, `deferred` or `non-finite`.
 * `inputs` (sorted) are the inputs behind the primary reason; `causes` (sorted) every unresolved input with its own
 * status, so a missing input and an incomplete aggregate are both visible. An unsupported aggregate always stays
 * `unsupported` in `causes`, whatever the primary reason.
 */
export function primaryUnresolved(
  targetKey: string | undefined,
  missingScalars: string[],
  aggs: Array<{ path: string; status: string }>,
): MEDerivationUnresolved {
  const causes = [
    ...missingScalars.map((path) => ({ path, status: "missing" })),
    ...aggs.filter((a) => a.status !== "resolved").map((a) => ({ path: a.path, status: a.status })),
  ].sort(byPath);
  const sorted = (xs: string[]) => [...new Set(xs)].sort();
  if (aggs.some((a) => a.status === "cycle")) return { reason: "cycle", cycle: [targetKey ?? ""] };
  const absent = aggs.filter((a) => a.status === "absent").map((a) => a.path);
  if (missingScalars.length > 0 || absent.length > 0) {
    return { reason: "missing-input", inputs: sorted([...missingScalars, ...absent]), causes };
  }
  const incomplete = aggs.filter((a) => a.status === "incomplete").map((a) => a.path);
  if (incomplete.length > 0) return { reason: "incomplete", inputs: sorted(incomplete), causes };
  const failed = aggs.filter((a) => a.status !== "resolved").map((a) => a.path);
  return { reason: "evaluation-failed", inputs: sorted(failed), causes };
}

function renderWave(wave: any) {
  return {
    k: wave.recomputed.size,
    recomputed: [...wave.recomputed].map((p: string) => renderKey(p)),
    changed: [...wave.changed].map((p: string) => renderKey(p)),
    sourcePath: renderKey(wave.sourcePath),
    recomputedAt: wave.at,
  };
}

export function explain(self: MEKernelLike, path: string): MEExplainResult {
  const raw = String(path ?? "").trim();
  const parsed = classifyPathExpression(raw);
  if (parsed.kind === "aggregate") {
    // Ad hoc: always the public-view context, for every caller (contract v4.1 §2.3).
    const r = aggregateResult(self, parsed.ref, "public-view");
    const entry = aggregateInput(parsed.ref, "public-view", r);
    const unresolved = r.status === "resolved" ? undefined : primaryUnresolved(undefined, [], [{ path: entry.path, status: r.status }]);
    return {
      path: entry.path,
      value: r.value,
      expr: parsed.ref.text,
      derivation: { expression: parsed.ref.text, inputs: [entry] },
      meta: {
        dependsOn: [entry.path],
        ...(unresolved ? { unresolved } : {}),
      },
    };
  }
  if (parsed.kind === "rejected") {
    return {
      path: raw,
      value: undefined,
      expr: null,
      derivation: null,
      meta: { dependsOn: [], unresolved: { reason: "evaluation-failed", detail: parsed.reason } },
    };
  }

  // Same split as 4.1 (on "."), then the (quote-aware) normalizer. A quoted-literal path is read from the raw
  // parts, normalised once, through the kernel's stealth check (like me("...")); a plain path keeps the 4.1 read.
  const rawParts = String(path ?? "").split(".").filter(Boolean);
  const target = normalizeSelectorPath(rawParts);
  const key = target.join(".");
  if (self.recomputeMode === "lazy") ensureTargetFresh(self, key);
  const value = parsed.kind === "literal" ? self.readPath(rawParts) : self.readPath(target);
  // Top-level path: a quoted-literal request is echoed in rendered form (I8). A plain request keeps the 4.1 key,
  // even when its 4.1 parse yields non-plain segments (explain("x[1..3]") → "x.[1.3]", unchanged).
  const topPath = parsed.kind === "literal" ? renderSegments(target) : key;
  const d = self.derivations[key];
  const wave = self.lastRecomputeWaveByTarget[key];
  if (!d) {
    return {
      path: topPath,
      value,
      expr: null,
      derivation: null,
      meta: {
        dependsOn: [],
        ...(wave ? renderWave(wave) : {}),
      },
    };
  }

  const effectiveRefs = d.refs.map((r) => ({
    label: r.label,
    path: resolveRefPath(self, r.label, d.evalScope) ?? r.candidates[0],
  }));
  const inputs: NonNullable<MEExplainResult["derivation"]>["inputs"] = effectiveRefs.map((r) => {
    const refParts = normalizeSelectorPath(r.path.split(".").filter(Boolean));
    const refScope = resolveBranchScope(self, refParts);
    const isStealth = !!(refScope && refScope.length > 0 && pathStartsWith(refParts, refScope));
    const raw = self.readPath(refParts);
    return {
      label: r.label,
      path: renderKey(r.path),
      value: isStealth ? "●●●●" : raw,
      origin: (isStealth ? "stealth" : "public") as "public" | "stealth",
      masked: isStealth,
      status: isStealth ? "masked" : raw === undefined || raw === null ? "missing" : "resolved",
    };
  });
  const context = derivationContext(self, key);
  const aggregateInputs = (d.aggregates ?? []).map((ref) => aggregateInput(ref, context, aggregateResult(self, ref, context, key)));
  inputs.push(...aggregateInputs);

  // Stored paths are storage keys (rendered here, I8); aggregate paths are stored already rendered.
  const aggPaths = new Set(aggregateInputs.map((a) => a.path));
  const rk = (p: string) => (aggPaths.has(p) ? p : renderKey(p));
  const u = d.unresolved;
  const unresolved = u
    ? u.reason === "cycle"
      ? { ...u, cycle: u.cycle.map(rk) }
      : {
          ...u,
          ...("inputs" in u && u.inputs ? { inputs: u.inputs.map(rk) } : {}),
          ...("causes" in u && u.causes ? { causes: u.causes.map((c) => ({ ...c, path: rk(c.path) })) } : {}),
        }
    : undefined;

  return {
    path: topPath,
    value,
    expr: d.expression,
    derivation: {
      expression: d.expression,
      inputs,
    },
    meta: {
      dependsOn: [...new Set([...effectiveRefs.map((r) => renderKey(r.path)), ...aggregateInputs.map((a) => a.path)])],
      lastComputedAt: d.lastComputedAt,
      ...(unresolved ? { unresolved } : {}),
      ...(wave ? renderWave(wave) : {}),
    },
  };
}

function beginRecomputeWave(self: MEKernelLike, sourcePath: string): boolean {
  if (self.activeRecomputeWave) return false;
  self.activeRecomputeWave = {
    sourcePath,
    recomputed: new Set<string>(),
    changed: new Set<string>(),
    at: Date.now(),
  };
  return true;
}

// k counts what was evaluated; `changed` is the subset whose value changed and
// was written.
function recordRecomputedTarget(self: MEKernelLike, targetKey: string, changed: boolean): void {
  const wave = self.activeRecomputeWave;
  if (!wave) return;
  wave.recomputed.add(targetKey);
  if (changed) wave.changed.add(targetKey);
}

function finalizeRecomputeWave(self: MEKernelLike): void {
  const wave = self.activeRecomputeWave;
  if (!wave) return;
  self.activeRecomputeWave = null;
  if (wave.recomputed.size === 0) return;
  const committedWave = {
    sourcePath: wave.sourcePath,
    recomputed: new Set(wave.recomputed),
    changed: new Set(wave.changed),
    at: Date.now(),
  };
  for (const targetKey of committedWave.recomputed) {
    self.lastRecomputeWaveByTarget[targetKey] = committedWave;
  }
}

export function extractExpressionRefs(expr: string): string[] {
  const raw = String(expr ?? "").trim();
  if (!raw) return [];
  const refs = new Set<string>();
  for (const t of scanExpressionTokens(raw)) {
    if (t.aggregate) continue;      // aggregate references are not scalar refs (see extractAggregateRefs)
    if (RESERVED_WORDS.has(t.text)) continue;
    refs.add(t.text);
  }
  return Array.from(refs);
}

const EXPR_SEG = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`;
const RESERVED_WORDS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);

// Same token boundaries as the evaluator's tokenizer: an aggregate reference is tried before a plain identifier.
function scanExpressionTokens(raw: string): Array<{ text: string; aggregate: boolean }> {
  const re = new RegExp(
    String.raw`(${AGGREGATE_TOKEN_SOURCE(EXPR_SEG)})|__ptr(?:\.${EXPR_SEG})*|${EXPR_SEG}(?:\.${EXPR_SEG})*`,
    "g",
  );
  const out: Array<{ text: string; aggregate: boolean }> = [];
  for (const m of raw.matchAll(re)) out.push({ text: m[0], aggregate: m[1] !== undefined });
  return out;
}

/**
 * True when formula text holds a path form the contract rejects (v3 §3): a `[]` that is not part of an accepted
 * aggregate reference (`z.[].w`, `x[].y[]`, `x[][2]`), an aggregate token that classifies as rejected
 * (`x[a > 1][]`, `x[].f[2]`), a whitespace-only selector (`z[ ].w`), or a dotted literal selector (`z.["[]"].w`). Such a formula is `evaluation-failed`,
 * never `missing-input` for the words around the bracket.
 */
export function hasRejectedPathForm(expr: string): boolean {
  const raw = String(expr ?? "");
  if (!raw.includes("[")) return false;
  if (/\.\[\s*(["'])[^"']*[\[\]][^"']*\1\s*\]/.test(raw)) return true;   // dotted literal selector z.["[]"]
  if (/\[\s+\]/.test(raw.replace(/"[^"]*"|'[^']*'/g, '""'))) return true;
  const covered: Array<[number, number]> = [];
  const re = new RegExp(String.raw`${AGGREGATE_TOKEN_SOURCE(EXPR_SEG)}`, "g");
  for (const m of raw.matchAll(re)) {
    if (classifyPathExpression(m[0]).kind !== "aggregate") return true;
    covered.push([m.index!, m.index! + m[0].length]);
  }
  let quote: string | null = null;
  for (let i = 0; i < raw.length - 1; i++) {
    const c = raw[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "[" && raw[i + 1] === "]" && !covered.some(([a, b]) => i >= a && i < b)) return true;
  }
  return false;
}

/** The aggregate references (`x[]`, `x[].f`) in a formula, parsed. Rejected forms are not returned. */
export function extractAggregateRefs(expr: string): AggregateRef[] {
  const raw = String(expr ?? "").trim();
  if (!raw || !raw.includes("[]")) return [];
  const out: AggregateRef[] = [];
  const seen = new Set<string>();
  for (const t of scanExpressionTokens(raw)) {
    if (!t.aggregate || seen.has(t.text)) continue;
    seen.add(t.text);
    const parsed = classifyPathExpression(t.text);
    if (parsed.kind === "aggregate") out.push(parsed.ref);
  }
  return out;
}

// Every path the evaluator may read for `label`: relative to evalScope first,
// then from the root (see tryResolveEvalTokenValue). A derivation subscribes to
// all of them so a write to whichever one is (or becomes) effective recomputes it.
export function refCandidatePaths(label: string, evalScope: SemanticPath): string[] {
  if (!label || label.startsWith("__ptr.")) return [];
  const parts = normalizeSelectorPath(label.split(".").filter(Boolean));
  if (parts.length === 0) return [];
  const rel = normalizeSelectorPath([...evalScope, ...parts]).join(".");
  const abs = normalizeSelectorPath(parts).join(".");
  return rel === abs ? [rel] : [rel, abs];
}

// The path the evaluator reads for `label` right now: relative if it holds a
// value, otherwise root. Mirrors tryResolveEvalTokenValue.
export function resolveRefPath(self: MEKernelLike, label: string, evalScope: SemanticPath): string | null {
  const candidates = refCandidatePaths(label, evalScope);
  if (candidates.length === 0) return null;
  const [rel, abs] = candidates;
  if (!abs) return rel;
  const relValue = self.readPath(rel.split(".").filter(Boolean));
  return relValue === undefined || relValue === null ? abs : rel;
}

function hasValue(self: MEKernelLike, path: string): boolean {
  const v = self.readPath(path.split(".").filter(Boolean));
  return v !== undefined && v !== null;
}

// Whether a change at `changedPath` can alter what the evaluator reads for this
// ref. A change to the relative candidate always can (it either now shadows the
// root, or just emptied and the root shows through). A change to the root
// candidate only can while the relative one holds no value. A change on a
// candidate's pointer trajectory (`via`) counts as a change on that candidate.
function refChangeMatters(
  self: MEKernelLike,
  ref: MEDerivationRecord["refs"][number],
  changedPath: string,
): boolean {
  const [rel, abs] = ref.candidates;
  if (changedPath === rel || (ref.via && ref.via[0]?.includes(changedPath))) return true;
  if (abs !== undefined && (changedPath === abs || (ref.via && ref.via[1]?.includes(changedPath)))) {
    return !hasValue(self, rel);
  }
  return false;
}

function derivationReadsChange(self: MEKernelLike, d: MEDerivationRecord, changedPath: string): boolean {
  return d.refs.some((ref) => refChangeMatters(self, ref, changedPath));
}

function derivationRefPaths(d: MEDerivationRecord): string[] {
  if (d.refPaths) return d.refPaths;
  const out = new Set<string>();
  for (const ref of d.refs) {
    for (const p of ref.candidates) out.add(p);
    if (ref.via) for (const list of ref.via) if (list) for (const p of list) out.add(p);
  }
  return (d.refPaths = [...out]);
}

// ─── subscriptions ───────────────────────────────────────────────────────────
// refSubscribers plus a prefix index over its keys (prefix → child prefixes
// with a subscribed path at or below them), so a pointer written at P finds the
// subscribed paths under P without scanning every key. Cached per
// refSubscribers object (replaced wholesale on reset/import), built lazily.

const subscribedPrefixIndexCache = new WeakMap<Record<string, Set<string>>, Map<string, Set<string>>>();

function parentKey(key: string): string | null {
  const i = key.lastIndexOf(".");
  return i < 0 ? null : key.slice(0, i);
}

function indexSubscribedKey(index: Map<string, Set<string>>, key: string): void {
  let child = key;
  let parent = parentKey(child);
  while (parent !== null) {
    let children = index.get(parent);
    if (!children) index.set(parent, (children = new Set()));
    else if (children.has(child)) return; // ancestors already indexed
    children.add(child);
    child = parent;
    parent = parentKey(child);
  }
}

function unindexSubscribedKey(self: MEKernelLike, index: Map<string, Set<string>>, key: string): void {
  let child = key;
  let parent = parentKey(child);
  while (parent !== null) {
    if (self.refSubscribers[child] || index.get(child)?.size) return; // still needed
    const children = index.get(parent);
    if (!children) return;
    children.delete(child);
    if (children.size > 0) return;
    index.delete(parent);
    child = parent;
    parent = parentKey(child);
  }
}

function getSubscribedPrefixIndex(self: MEKernelLike): Map<string, Set<string>> {
  let index = subscribedPrefixIndexCache.get(self.refSubscribers);
  if (index) return index;
  index = new Map();
  for (const key of Object.keys(self.refSubscribers)) indexSubscribedKey(index, key);
  subscribedPrefixIndexCache.set(self.refSubscribers, index);
  return index;
}

function subscribe(self: MEKernelLike, path: string, targetKey: string): void {
  let s = self.refSubscribers[path];
  if (!s) {
    s = self.refSubscribers[path] = new Set();
    const index = subscribedPrefixIndexCache.get(self.refSubscribers);
    if (index) indexSubscribedKey(index, path);
  }
  s.add(targetKey);
}

function unsubscribe(self: MEKernelLike, path: string, targetKey: string): void {
  const s = self.refSubscribers[path];
  if (!s) return;
  s.delete(targetKey);
  if (s.size > 0) return;
  delete self.refSubscribers[path];
  const index = subscribedPrefixIndexCache.get(self.refSubscribers);
  if (index) unindexSubscribedKey(self, index, path);
}

/** Subscribed paths strictly below `prefix`. */
function subscribedPathsUnder(self: MEKernelLike, prefix: string): string[] {
  const index = getSubscribedPrefixIndex(self);
  const out: string[] = [];
  const stack = [...(index.get(prefix) || [])];
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (self.refSubscribers[key]) out.push(key);
    const children = index.get(key);
    if (children) for (const c of children) stack.push(c);
  }
  return out;
}

// ─── pointer trajectories ────────────────────────────────────────────────────
// A ref read through pointers also depends on the pointer locations followed
// and the paths they lead to (`via`, per candidate). They are resolved at
// registration and again whenever the derivation commits a value, if it had a
// trajectory or a pointer write flagged it; the subscription set is diffed so
// a redirected pointer stops depending on its old target.

function resolveRefVia(self: MEKernelLike, ref: MEDerivationRecord["refs"][number]): void {
  let via: string[][] | undefined;
  for (let i = 0; i < ref.candidates.length; i++) {
    const candidate = ref.candidates[i];
    if (!hasPointerOnPath(self, candidate)) continue; // common case: no pointer involved
    const trace = pointerReadTrajectory(self, candidate.split(".").filter(Boolean));
    const list = [...new Set(trace)].filter((p) => p !== candidate);
    if (list.length > 0) (via ||= [])[i] = list;
  }
  if (via) ref.via = via;
  else if (ref.via) delete ref.via;
}

function refreshPointerTrajectories(self: MEKernelLike, targetKey: string, d: MEDerivationRecord): void {
  d.viaStale = false;
  const before = derivationRefPaths(d);
  for (const ref of d.refs) resolveRefVia(self, ref);
  d.refPaths = undefined;
  const after = derivationRefPaths(d);
  const afterSet = new Set(after);
  for (const p of before) if (!afterSet.has(p)) unsubscribe(self, p, targetKey);
  for (const p of after) subscribe(self, p, targetKey);
}

export function unregisterDerivation(self: MEKernelLike, targetKey: string): void {
  const old = self.derivations[targetKey];
  if (!old) return;
  for (const path of derivationRefPaths(old)) unsubscribe(self, path, targetKey);
  delete self.derivations[targetKey];
  delete self.derivationRefVersions[targetKey];
  delete self.lastRecomputeWaveByTarget[targetKey];
  self.staleDerivations.delete(targetKey);
}

export function getRefVersion(self: MEKernelLike, refPath: string): number {
  return self.refVersions[refPath] ?? 0;
}

export function bumpRefVersion(self: MEKernelLike, refPath: string): void {
  self.refVersions[refPath] = getRefVersion(self, refPath) + 1;
}

export function snapshotDerivationRefVersions(self: MEKernelLike, targetKey: string): void {
  const d = self.derivations[targetKey];
  if (!d) return;
  const snap: Record<string, number> = {};
  for (const path of derivationRefPaths(d)) snap[path] = getRefVersion(self, path);
  self.derivationRefVersions[targetKey] = snap;
}

export function registerDerivation(
  self: MEKernelLike,
  targetPath: SemanticPath,
  evalScope: SemanticPath,
  expr: string,
): void {
  const targetKey = targetPath.join(".");
  unregisterDerivation(self, targetKey);

  const labels = extractExpressionRefs(expr);
  const refs: MEDerivationRecord["refs"] = [];
  for (const label of labels) {
    const candidates = refCandidatePaths(label, evalScope);
    if (candidates.length === 0) continue;
    const ref: MEDerivationRecord["refs"][number] = { label, candidates };
    resolveRefVia(self, ref);
    refs.push(ref);
  }

  const aggregates = extractAggregateRefs(expr);
  const d: MEDerivationRecord = (self.derivations[targetKey] = {
    expression: expr,
    evalScope: [...evalScope],
    refs,
    lastComputedAt: Date.now(),
    ...(aggregates.length > 0 ? { aggregates } : {}),
    ...(hasRejectedPathForm(expr) ? { rejectedPathForm: true } : {}),
  });
  for (const path of derivationRefPaths(d)) subscribe(self, path, targetKey);
  snapshotDerivationRefVersions(self, targetKey);
  self.staleDerivations.delete(targetKey);
}

// Evaluate a derivation. A derivation with no correct value has no value:
// `undefined`, with the reason kept on the record for explain(). Evaluation
// runs first; missing inputs are only diagnosed when it fails, because the ref
// extractor also sees words inside string literals.
export function computeDerivation(
  self: MEKernelLike,
  d: MEDerivationRecord,
  targetKey?: string,
): { value: any; unresolved?: MEDerivationUnresolved } {
  if (d.rejectedPathForm) return { value: undefined, unresolved: { reason: "evaluation-failed", detail: "rejected-path-form" } };
  const missingScalars = () => {
    const missing: string[] = [];
    for (const ref of d.refs) {
      if (ref.candidates.some((p) => hasValue(self, p))) continue;
      missing.push(ref.candidates[0]);
    }
    return missing;
  };
  let aggregateValues: Map<string, number> | undefined;
  if (d.aggregates && d.aggregates.length > 0) {
    // Every aggregate is evaluated (all of them, whatever the expression order), then the primary reason is picked
    // by precedence. The formula only evaluates when every aggregate resolved.
    const context = derivationContext(self, targetKey);
    const results = d.aggregates.map((a) => ({ ref: a, path: renderAggregate(a), r: aggregateResult(self, a, context, targetKey) }));
    if (results.some((x) => x.r.status !== "resolved")) {
      return {
        value: undefined,
        unresolved: primaryUnresolved(targetKey, missingScalars(), results.map((x) => ({ path: x.path, status: x.r.status }))),
      };
    }
    aggregateValues = new Map(results.map((x) => [x.ref.text, x.r.value as number]));
  }
  const evaluated = tryEvaluateAssignExpression(self, d.evalScope, d.expression, aggregateValues);
  if (evaluated.ok) return { value: evaluated.value };
  const missing = missingScalars();
  if (aggregateValues) {
    if (missing.length > 0) return { value: undefined, unresolved: primaryUnresolved(targetKey, missing, []) };
    return { value: undefined, unresolved: { reason: "evaluation-failed" } };
  }
  if (missing.length > 0) return { value: undefined, unresolved: { reason: "missing-input", inputs: missing } };
  return { value: undefined, unresolved: { reason: "evaluation-failed" } };
}

/**
 * Context of a formula's aggregates (contract v4.1 §2.3): `authorized` when the target is inside a secret scope
 * (root or branch), `public-view` otherwise. Decided by where the target is, never by the collection's data.
 */
export function derivationContext(self: MEKernelLike, targetKey: string | undefined): AggregateContext {
  if (targetKey === undefined) return "public-view";
  const parts = targetKey.split(".").filter(Boolean);
  for (let i = parts.length; i >= 0; i--) {
    if (Object.prototype.hasOwnProperty.call(self.localSecrets, parts.slice(0, i).join("."))) return "authorized";
  }
  return "public-view";
}

// Primitive values that are Object.is-equal need no write. Objects and arrays
// are always treated as changed (no deep comparison).
function sameValue(a: any, b: any): boolean {
  if (!Object.is(a, b)) return false;
  return a === null || typeof a !== "object";
}

function commitDerivedValue(
  self: MEKernelLike,
  targetKey: string,
  value: any,
  unresolved: MEDerivationUnresolved | undefined,
): boolean {
  const d = self.derivations[targetKey];
  if (!d) return false;
  d.unresolved = unresolved;
  d.lastComputedAt = Date.now();
  const targetPath = normalizeSelectorPath(targetKey.split(".").filter(Boolean));
  const previous = "lastValue" in d ? d.lastValue : readPreviousValue(self, targetKey, targetPath);
  const changed = !sameValue(previous, value);
  recordRecomputedTarget(self, targetKey, changed);
  if (changed) {
    self.commitValueMapping(targetPath, value, "=");
    bumpRefVersion(self, targetKey);
  }
  d.lastValue = value;
  if (d.viaStale || d.refs.some((ref) => ref.via)) refreshPointerTrajectories(self, targetKey, d);
  snapshotDerivationRefVersions(self, targetKey);
  self.staleDerivations.delete(targetKey);
  return changed;
}

/** Recompute one derivation. Returns whether its value changed (early cutoff). */
export function recomputeTarget(self: MEKernelLike, targetKey: string): boolean {
  const d = self.derivations[targetKey];
  if (!d) return false;
  const { value, unresolved } = computeDerivation(self, d, targetKey);
  return commitDerivedValue(self, targetKey, value, unresolved);
}

function failCycle(self: MEKernelLike, members: string[]): Set<string> {
  const cycle = [...members].sort();
  const changed = new Set<string>();
  for (const key of cycle) {
    if (commitDerivedValue(self, key, undefined, { reason: "cycle", cycle })) changed.add(key);
  }
  return changed;
}

export function isDerivationVersionStale(self: MEKernelLike, targetKey: string): boolean {
  const d = self.derivations[targetKey];
  if (!d) return false;
  const snap = self.derivationRefVersions[targetKey] || {};
  for (const path of derivationRefPaths(d)) {
    if ((snap[path] ?? 0) !== getRefVersion(self, path) && derivationReadsChange(self, d, path)) return true;
  }
  return false;
}

type FreshContext = { stack: string[]; resolvedAsCycle: Set<string> };

// readPath() pulls a lazy derivation before returning it. Two re-entries into
// a target that is being refreshed are possible, and they must not be treated
// alike:
// - the early-cutoff comparison reading the target's own previous value: that
//   read is marked here and returns the stored value, which is what it wants;
// - anything else is the target depending on itself (a cycle the ref walk did
//   not see): it fails closed instead of computing from a stale value.
const readingPrevious = new WeakMap<MEKernelLike, Set<string>>();
const refreshing = new WeakMap<MEKernelLike, Map<string, { reentered: boolean }>>();

function readPreviousValue(self: MEKernelLike, targetKey: string, targetPath: SemanticPath): any {
  let marked = readingPrevious.get(self);
  if (!marked) readingPrevious.set(self, (marked = new Set()));
  marked.add(targetKey);
  try {
    return self.readPath(targetPath);
  } finally {
    marked.delete(targetKey);
  }
}

// Lazy pull: refresh inputs depth-first, then this target only if an input's
// version moved. A target met again on its own stack is a cycle: every member
// fails closed and is not re-evaluated on the way back up.
export function ensureTargetFresh(
  self: MEKernelLike,
  targetKey: string,
  ctx: FreshContext = { stack: [], resolvedAsCycle: new Set() },
): boolean {
  if (self.recomputeMode !== "lazy") return false;
  const d = self.derivations[targetKey];
  if (!d) return false;
  const onStack = ctx.stack.indexOf(targetKey);
  if (onStack >= 0) {
    const members = ctx.stack.slice(onStack);
    failCycle(self, members);
    for (const key of members) ctx.resolvedAsCycle.add(key);
    return false;
  }
  if (ctx.resolvedAsCycle.has(targetKey)) return false;
  if (readingPrevious.get(self)?.has(targetKey)) return false;
  let inFlight = refreshing.get(self);
  if (!inFlight) refreshing.set(self, (inFlight = new Map()));
  const running = inFlight.get(targetKey);
  if (running) {
    running.reentered = true; // fails closed once its evaluation returns
    return false;
  }
  const entry = { reentered: false };
  inFlight.set(targetKey, entry);
  const startedWave = beginRecomputeWave(self, targetKey);

  let changed = false;
  try {
    ctx.stack.push(targetKey);
    for (const path of derivationRefPaths(d)) {
      if (self.derivations[path]) ensureTargetFresh(self, path, ctx);
    }
    ctx.stack.pop();

    const needsRefresh =
      !ctx.resolvedAsCycle.has(targetKey) &&
      (self.staleDerivations.has(targetKey) || isDerivationVersionStale(self, targetKey));
    if (needsRefresh) {
      const { value, unresolved } = computeDerivation(self, d, targetKey);
      changed = entry.reentered
        ? failCycle(self, [targetKey]).size > 0
        : commitDerivedValue(self, targetKey, value, unresolved);
    }
  } finally {
    inFlight.delete(targetKey);
    if (startedWave) finalizeRecomputeWave(self);
  }
  return changed;
}

export function invalidateFromPath(self: MEKernelLike, path: SemanticPath): void {
  invalidateFromPaths(self, [normalizeSelectorPath(path).join(".")]);
}

// Eager push. Phase 1 collects every derivation reachable from the written
// paths. Phase 2 evaluates them in topological order (Kahn), each at most once
// and only if one of its inputs changed in this wave, so a derivation never
// sees a stale input and an unchanged value stops propagation. Nodes Kahn
// cannot order are cycles (and whatever sits behind them): cycle members fail
// closed, and ordering resumes for the rest.
export function invalidateFromPaths(self: MEKernelLike, roots: string[]): void {
  const sources = roots.filter(Boolean);
  if (sources.length === 0) return;
  const startedWave = beginRecomputeWave(self, sources[0]);
  for (const root of sources) {
    bumpRefVersion(self, root);
    // A write that did not come from the derivation itself (declaration, or a
    // direct write to a derived path): its cached value is no longer known.
    const own = self.derivations[root];
    if (own) delete own.lastValue;
  }
  // A pointer written at a root redirects every subscribed path below it (and
  // the root itself): those readers recompute and re-resolve their trajectory.
  // Paths already on a trajectory are reached by their own subscription; this
  // covers a pointer created where a formula read a plain path.
  let sourceSet: Set<string> | null = null;
  const written = sources.length;
  for (let i = 0; i < written; i++) {
    const root = sources[i];
    if (!isPointer(self.index[root])) continue;
    sourceSet ||= new Set(sources);
    for (const path of [root, ...subscribedPathsUnder(self, root)]) {
      for (const target of self.refSubscribers[path] || []) {
        const d = self.derivations[target];
        if (d) d.viaStale = true;
      }
      if (sourceSet.has(path)) continue;
      sourceSet.add(path);
      sources.push(path);
      bumpRefVersion(self, path);
    }
  }

  if (self.recomputeMode === "lazy") {
    if (startedWave) finalizeRecomputeWave(self);
    return;
  }

  // Phase 1: affected set and the edges between its members.
  const affected = new Set<string>();
  const dependentsOf = new Map<string, string[]>();
  const pending = [...sources];
  while (pending.length > 0) {
    const changedPath = pending.pop()!;
    for (const target of self.refSubscribers[changedPath] || []) {
      const d = self.derivations[target];
      if (!d || !derivationReadsChange(self, d, changedPath)) continue;
      const list = dependentsOf.get(changedPath);
      if (list) list.push(target);
      else dependentsOf.set(changedPath, [target]);
      if (affected.has(target)) continue;
      affected.add(target);
      pending.push(target);
    }
  }
  if (affected.size === 0) {
    if (startedWave) finalizeRecomputeWave(self);
    return;
  }

  // Flat fan-out (no affected derivation reads another affected one): every
  // target reads only the written paths, so order is irrelevant and Kahn is
  // skipped. This is the common "one input, many dependents" shape.
  let layered = false;
  for (const from of dependentsOf.keys()) {
    if (affected.has(from)) {
      layered = true;
      break;
    }
  }
  if (!layered) {
    for (const target of affected) recomputeTarget(self, target);
    if (startedWave) finalizeRecomputeWave(self);
    return;
  }

  const indegree = new Map<string, number>();
  for (const target of affected) indegree.set(target, 0);
  for (const [from, targets] of dependentsOf) {
    if (!affected.has(from)) continue;
    for (const target of targets) indegree.set(target, indegree.get(target)! + 1);
  }

  // Phase 2: topological evaluation with early cutoff.
  const changedPaths = new Set<string>(sources);
  const done = new Set<string>();
  const ready: string[] = [];
  for (const [target, deg] of indegree) if (deg === 0) ready.push(target);

  const release = (from: string) => {
    for (const target of dependentsOf.get(from) || []) {
      if (done.has(target) || !affected.has(target)) continue;
      const deg = indegree.get(target)! - 1;
      indegree.set(target, deg);
      if (deg === 0) ready.push(target);
    }
  };

  let head = 0; // queue read position (no Array.shift: O(1) per pop)
  while (done.size < affected.size) {
    while (head < ready.length) {
      const target = ready[head++];
      if (done.has(target)) continue;
      done.add(target);
      const d = self.derivations[target];
      const inputChanged = !!d && derivationRefPaths(d).some((p) => changedPaths.has(p));
      if (inputChanged && recomputeTarget(self, target)) changedPaths.add(target);
      release(target);
    }
    if (done.size >= affected.size) break;

    const remaining = [...affected].filter((t) => !done.has(t));
    const cycles = findCycles(remaining, dependentsOf);
    if (cycles.length === 0) break; // cannot happen: a stalled Kahn implies a cycle
    for (const members of cycles) {
      for (const key of failCycle(self, members)) changedPaths.add(key);
      for (const key of members) done.add(key);
      for (const key of members) release(key);
    }
  }

  if (startedWave) finalizeRecomputeWave(self);
}

// Strongly connected components (Tarjan, iterative) of `nodes` under
// `dependentsOf`; returns those that are cycles (size > 1 or a self-edge).
function findCycles(nodes: string[], dependentsOf: Map<string, string[]>): string[][] {
  const inSet = new Set(nodes);
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  let counter = 0;

  for (const start of nodes) {
    if (index.has(start)) continue;
    const work: Array<{ node: string; i: number }> = [{ node: start, i: 0 }];
    index.set(start, counter);
    low.set(start, counter++);
    stack.push(start);
    onStack.add(start);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const next = (dependentsOf.get(frame.node) || []).filter((n) => inSet.has(n));
      if (frame.i < next.length) {
        const w = next[frame.i++];
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter++);
          stack.push(w);
          onStack.add(w);
          work.push({ node: w, i: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(w)!));
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].node;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.node)!));
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== frame.node);
        const selfEdge = (dependentsOf.get(frame.node) || []).includes(frame.node);
        if (component.length > 1 || selfEdge) out.push(component);
      }
    }
  }
  return out;
}

// ─── [i] rule index ──────────────────────────────────────────────────────────
// Lookup structure over self.iteratorRules so a write costs O(path depth), not
// O(rules). Cached per rules object (replaced wholesale on reset/import) and
// dropped whenever a rule is added or removed.

export type IteratorRuleIndex = {
  /** Collection path → rules applying to its direct children. */
  byPrefix: Map<string, MEIteratorRule[]>;
  /** Every collection path and each of its ancestors (incl. "" for root). */
  ancestors: Set<string>;
};

const iteratorRuleIndexCache = new WeakMap<Record<string, MEIteratorRule>, IteratorRuleIndex>();

export function getIteratorRuleIndex(self: MEKernelLike): IteratorRuleIndex {
  const cached = iteratorRuleIndexCache.get(self.iteratorRules);
  if (cached) return cached;
  const index: IteratorRuleIndex = { byPrefix: new Map(), ancestors: new Set() };
  for (const rule of Object.values(self.iteratorRules)) {
    const key = rule.prefix.join(".");
    const list = index.byPrefix.get(key);
    if (list) list.push(rule);
    else index.byPrefix.set(key, [rule]);
    for (let i = 0; i <= rule.prefix.length; i++) index.ancestors.add(rule.prefix.slice(0, i).join("."));
  }
  iteratorRuleIndexCache.set(self.iteratorRules, index);
  return index;
}

export function setIteratorRule(self: MEKernelLike, key: string, rule: MEIteratorRule): void {
  self.iteratorRules[key] = rule;
  iteratorRuleIndexCache.delete(self.iteratorRules);
}

export function clearDerivationsByPrefix(self: MEKernelLike, prefixPath: SemanticPath): void {
  const prefix = prefixPath.join(".");
  for (const [key, rule] of Object.entries(self.iteratorRules)) {
    const collection = rule.prefix.join(".");
    if (prefix === "" || collection === prefix || collection.startsWith(prefix + ".")) {
      delete self.iteratorRules[key];
      iteratorRuleIndexCache.delete(self.iteratorRules);
    }
  }
  for (const target of Object.keys(self.derivations)) {
    if (prefix === "" || target === prefix || target.startsWith(prefix + ".")) {
      unregisterDerivation(self, target);
    }
  }
}
