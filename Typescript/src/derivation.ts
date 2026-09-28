import { pathStartsWith } from "./operators.ts";
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

export function explain(self: MEKernelLike, path: string): MEExplainResult {
  const target = normalizeSelectorPath(String(path ?? "").split(".").filter(Boolean));
  const key = target.join(".");
  if (self.recomputeMode === "lazy") ensureTargetFresh(self, key);
  const value = self.readPath(target);
  const d = self.derivations[key];
  const wave = self.lastRecomputeWaveByTarget[key];
  if (!d) {
    return {
      path: key,
      value,
      expr: null,
      derivation: null,
      meta: {
        dependsOn: [],
        ...(wave
          ? {
              k: wave.recomputed.size,
              recomputed: [...wave.recomputed],
              changed: [...wave.changed],
              sourcePath: wave.sourcePath,
              recomputedAt: wave.at,
            }
          : {}),
      },
    };
  }

  const effectiveRefs = d.refs.map((r) => ({
    label: r.label,
    path: resolveRefPath(self, r.label, d.evalScope) ?? r.candidates[0],
  }));
  const inputs = effectiveRefs.map((r) => {
    const refParts = normalizeSelectorPath(r.path.split(".").filter(Boolean));
    const refScope = resolveBranchScope(self, refParts);
    const isStealth = !!(refScope && refScope.length > 0 && pathStartsWith(refParts, refScope));
    const raw = self.readPath(refParts);
    return {
      label: r.label,
      path: r.path,
      value: isStealth ? "●●●●" : raw,
      origin: (isStealth ? "stealth" : "public") as "public" | "stealth",
      masked: isStealth,
    };
  });

  return {
    path: key,
    value,
    expr: d.expression,
    derivation: {
      expression: d.expression,
      inputs,
    },
    meta: {
      dependsOn: [...new Set(effectiveRefs.map((r) => r.path))],
      lastComputedAt: d.lastComputedAt,
      ...(d.unresolved ? { unresolved: d.unresolved } : {}),
      ...(wave
        ? {
            k: wave.recomputed.size,
            recomputed: [...wave.recomputed],
            changed: [...wave.changed],
            sourcePath: wave.sourcePath,
            recomputedAt: wave.at,
          }
        : {}),
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
  const seg = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`;
  const tokenRegex = new RegExp(String.raw`__ptr(?:\.${seg})*|${seg}(?:\.${seg})*`, "g");
  const reserved = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
  const refs = new Set<string>();
  const m = raw.match(tokenRegex) || [];
  for (const t of m) {
    if (reserved.has(t)) continue;
    refs.add(t);
  }
  return Array.from(refs);
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
// candidate only can while the relative one holds no value.
function refChangeMatters(
  self: MEKernelLike,
  ref: MEDerivationRecord["refs"][number],
  changedPath: string,
): boolean {
  const [rel, abs] = ref.candidates;
  if (changedPath === rel) return true;
  if (abs !== undefined && changedPath === abs) return !hasValue(self, rel);
  return false;
}

function derivationReadsChange(self: MEKernelLike, d: MEDerivationRecord, changedPath: string): boolean {
  return d.refs.some((ref) => refChangeMatters(self, ref, changedPath));
}

function derivationRefPaths(d: MEDerivationRecord): string[] {
  if (d.refPaths) return d.refPaths;
  const out = new Set<string>();
  for (const ref of d.refs) for (const p of ref.candidates) out.add(p);
  return (d.refPaths = [...out]);
}

export function unregisterDerivation(self: MEKernelLike, targetKey: string): void {
  const old = self.derivations[targetKey];
  if (!old) return;
  for (const path of derivationRefPaths(old)) {
    const s = self.refSubscribers[path];
    if (s) {
      s.delete(targetKey);
      if (s.size === 0) delete self.refSubscribers[path];
    }
  }
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
    refs.push({ label, candidates });
    for (const path of candidates) {
      const s = self.refSubscribers[path] || (self.refSubscribers[path] = new Set());
      s.add(targetKey);
    }
  }

  self.derivations[targetKey] = {
    expression: expr,
    evalScope: [...evalScope],
    refs,
    lastComputedAt: Date.now(),
  };
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
): { value: any; unresolved?: MEDerivationUnresolved } {
  const evaluated = tryEvaluateAssignExpression(self, d.evalScope, d.expression);
  if (evaluated.ok) return { value: evaluated.value };
  const missing: string[] = [];
  for (const ref of d.refs) {
    if (ref.candidates.some((p) => hasValue(self, p))) continue;
    missing.push(ref.candidates[0]);
  }
  if (missing.length > 0) return { value: undefined, unresolved: { reason: "missing-input", inputs: missing } };
  return { value: undefined, unresolved: { reason: "evaluation-failed" } };
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
  snapshotDerivationRefVersions(self, targetKey);
  self.staleDerivations.delete(targetKey);
  return changed;
}

/** Recompute one derivation. Returns whether its value changed (early cutoff). */
export function recomputeTarget(self: MEKernelLike, targetKey: string): boolean {
  const d = self.derivations[targetKey];
  if (!d) return false;
  const { value, unresolved } = computeDerivation(self, d);
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
      const { value, unresolved } = computeDerivation(self, d);
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
