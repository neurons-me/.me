import { pathStartsWith } from "./operators.js";
import { resolveBranchScope } from "./secret.js";
import type {
  MEExplainResult,
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import { tryEvaluateAssignExpression } from "./evaluator.js";
import { normalizeSelectorPath } from "./utils.js";

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
              k: wave.recomputed.length,
              recomputed: [...wave.recomputed],
              sourcePath: wave.sourcePath,
              recomputedAt: wave.at,
            }
          : {}),
      },
    };
  }

  const inputs = d.refs.map((r) => {
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
      dependsOn: d.refs.map((r) => r.path),
      lastComputedAt: d.lastComputedAt,
      ...(wave
        ? {
            k: wave.recomputed.length,
            recomputed: [...wave.recomputed],
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
    recomputed: [],
    at: Date.now(),
  };
  return true;
}

function recordRecomputedTarget(self: MEKernelLike, targetKey: string): void {
  const wave = self.activeRecomputeWave;
  if (!wave) return;
  if (!wave.recomputed.includes(targetKey)) wave.recomputed.push(targetKey);
}

function finalizeRecomputeWave(self: MEKernelLike): void {
  const wave = self.activeRecomputeWave;
  if (!wave) return;
  self.activeRecomputeWave = null;
  if (wave.recomputed.length === 0) return;
  const committedWave = {
    sourcePath: wave.sourcePath,
    recomputed: [...wave.recomputed],
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

export function resolveRefPath(self: MEKernelLike, label: string, evalScope: SemanticPath): string | null {
  if (!label || label.startsWith("__ptr.")) return null;
  const parts = normalizeSelectorPath(label.split(".").filter(Boolean));
  if (parts.length === 0) return null;
  const rel = normalizeSelectorPath([...evalScope, ...parts]).join(".");
  const abs = normalizeSelectorPath(parts).join(".");
  if (!label.includes(".")) return rel;
  return abs;
}

export function unregisterDerivation(self: MEKernelLike, targetKey: string): void {
  const old = self.derivations[targetKey];
  if (!old) return;
  for (const ref of old.refs) {
    const arr = self.refSubscribers[ref.path] || [];
    self.refSubscribers[ref.path] = arr.filter((t) => t !== targetKey);
    if (self.refSubscribers[ref.path].length === 0) delete self.refSubscribers[ref.path];
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
  for (const ref of d.refs) snap[ref.path] = getRefVersion(self, ref.path);
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
  const refs: Array<{ label: string; path: string }> = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const resolved = resolveRefPath(self, label, evalScope);
    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    refs.push({ label, path: resolved });
    const arr = self.refSubscribers[resolved] || [];
    if (!arr.includes(targetKey)) arr.push(targetKey);
    self.refSubscribers[resolved] = arr;
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

export function recomputeTarget(self: MEKernelLike, targetKey: string): boolean {
  const d = self.derivations[targetKey];
  if (!d) return false;
  const targetPath = normalizeSelectorPath(targetKey.split(".").filter(Boolean));
  const evaluated = tryEvaluateAssignExpression(self, d.evalScope, d.expression);
  recordRecomputedTarget(self, targetKey);
  self.commitValueMapping(targetPath, evaluated.ok ? evaluated.value : d.expression, "=");
  bumpRefVersion(self, targetKey);
  d.lastComputedAt = Date.now();
  snapshotDerivationRefVersions(self, targetKey);
  self.staleDerivations.delete(targetKey);
  return true;
}

export function isDerivationVersionStale(self: MEKernelLike, targetKey: string): boolean {
  const d = self.derivations[targetKey];
  if (!d) return false;
  const snap = self.derivationRefVersions[targetKey] || {};
  for (const ref of d.refs) {
    if ((snap[ref.path] ?? 0) !== getRefVersion(self, ref.path)) return true;
  }
  return false;
}

export function ensureTargetFresh(
  self: MEKernelLike,
  targetKey: string,
  visiting: Set<string> = new Set(),
): boolean {
  if (self.recomputeMode !== "lazy") return false;
  const startedWave = beginRecomputeWave(self, targetKey);
  const d = self.derivations[targetKey];
  if (!d) {
    if (startedWave) finalizeRecomputeWave(self);
    return false;
  }
  if (visiting.has(targetKey)) {
    if (startedWave) finalizeRecomputeWave(self);
    return false;
  }
  visiting.add(targetKey);

  for (const ref of d.refs) {
    if (self.derivations[ref.path]) ensureTargetFresh(self, ref.path, visiting);
  }

  const needsRefresh =
    self.staleDerivations.has(targetKey) || isDerivationVersionStale(self, targetKey);
  let changed = false;
  if (needsRefresh) changed = recomputeTarget(self, targetKey);

  visiting.delete(targetKey);
  if (startedWave) finalizeRecomputeWave(self);
  return changed;
}

export function invalidateFromPath(self: MEKernelLike, path: SemanticPath): void {
  const root = normalizeSelectorPath(path).join(".");
  if (!root) return;
  const startedWave = beginRecomputeWave(self, root);
  bumpRefVersion(self, root);

  if (self.recomputeMode === "lazy") {
    if (startedWave) finalizeRecomputeWave(self);
    return;
  }

  const queue: string[] = [root];
  const seenTargets = new Set<string>();

  while (queue.length > 0) {
    const changed = queue.shift()!;
    const subs = self.refSubscribers[changed] || [];
    for (const target of subs) {
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);
      const updated = recomputeTarget(self, target);
      if (updated) queue.push(target);
    }
  }

  if (startedWave) finalizeRecomputeWave(self);
}

export function clearDerivationsByPrefix(self: MEKernelLike, prefixPath: SemanticPath): void {
  const prefix = prefixPath.join(".");
  for (const target of Object.keys(self.derivations)) {
    if (prefix === "" || target === prefix || target.startsWith(prefix + ".")) {
      unregisterDerivation(self, target);
    }
  }
}
