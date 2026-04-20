import { tryEvaluateAssignExpression } from "./evaluator.js";
import type {
  MEKernelLike,
  SemanticPath,
} from "./types.js";
import {
  compareValues,
  normalizeSelectorPath,
  parseLiteralOrPath,
  parseLogicalFilterExpression,
  parseSelectorKeys,
  parseSelectorSegment,
  parseTransformSelector,
} from "./utils.js";

function getCallerScope(self: MEKernelLike): string | null | undefined {
  const value = (self as any)._currentCallerScope;
  if (value === undefined) return undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

type StealthMetaCarrier = {
  meta?: {
    origin?: string;
    scopeKey?: string;
  };
};

function hasStealthBarrier(
  self: MEKernelLike,
  path: SemanticPath,
  callerScope: string | null | undefined = getCallerScope(self),
): boolean {
  if (callerScope === undefined) return false;
  for (let i = path.length; i > 0; i--) {
    const ancestorKey = path.slice(0, i).join(".");
    const localSecret = self.localSecrets[ancestorKey];
    if (typeof localSecret === "string" && localSecret !== callerScope) {
      return true;
    }
    const rawNode = self.index[ancestorKey] as StealthMetaCarrier | undefined;
    if (rawNode && typeof rawNode === "object" && "meta" in rawNode) {
      const meta = (rawNode as any).meta;
      if (meta?.origin === "stealth" && meta.scopeKey !== callerScope) {
        return true;
      }
    }
  }
  return false;
}

function readPathWithStealth(self: MEKernelLike, path: SemanticPath): any {
  const normalized = normalizeSelectorPath(path);
  if (normalized.length === 0) return self.readPath(normalized);
  if (hasStealthBarrier(self, normalized)) return undefined;
  return self.readPath(normalized);
}

export function collectIteratorIndices(self: MEKernelLike, path: SemanticPath): string[] {
  const firstIteratorPos = path.findIndex((segment) => segment.includes("[i]"));
  if (firstIteratorPos === -1) return [];

  const prefix: string[] = [];
  for (let i = 0; i <= firstIteratorPos; i++) {
    const segment = path[i];
    if (i === firstIteratorPos) {
      const base = segment.split("[i]").join("").trim();
      if (base) prefix.push(base);
    } else {
      prefix.push(segment);
    }
  }

  const out = new Set<string>();
  for (const key of Object.keys(self.index)) {
    const parts = key.split(".").filter(Boolean);
    if (parts.length <= prefix.length) continue;
    let ok = true;
    for (let i = 0; i < prefix.length; i++) {
      if (parts[i] !== prefix[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.add(parts[prefix.length]);
  }

  return Array.from(out).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
}

export function resolveRelativeFirst(self: MEKernelLike, scope: SemanticPath, parts: SemanticPath): any {
  const rel = readPathWithStealth(self, [...scope, ...parts]);
  if (rel !== undefined && rel !== null) return rel;
  return readPathWithStealth(self, parts);
}

export function evaluateFilterClauseForScope(
  self: MEKernelLike,
  scope: SemanticPath,
  clause: { left: string; op: ">" | "<" | ">=" | "<=" | "==" | "!="; right: string },
): boolean {
  const leftParts = normalizeSelectorPath(clause.left.split(".").filter(Boolean));
  const leftValue = resolveRelativeFirst(self, scope, leftParts);
  if (leftValue === undefined || leftValue === null) return false;

  const rightParsed = parseLiteralOrPath(clause.right);
  const rightValue =
    rightParsed.kind === "literal"
      ? rightParsed.value
      : resolveRelativeFirst(self, scope, rightParsed.parts);
  if (rightValue === undefined || rightValue === null) return false;

  return compareValues(leftValue, clause.op, rightValue);
}

export function evaluateLogicalFilterForScope(
  self: MEKernelLike,
  scope: SemanticPath,
  expr: string,
): boolean {
  const parsed = parseLogicalFilterExpression(expr);
  if (!parsed) return false;
  let acc = evaluateFilterClauseForScope(self, scope, parsed.clauses[0]);
  for (let i = 1; i < parsed.clauses.length; i++) {
    const v = evaluateFilterClauseForScope(self, scope, parsed.clauses[i]);
    const op = parsed.ops[i - 1];
    acc = op === "&&" ? acc && v : acc || v;
  }
  return acc;
}

export function collectChildrenForPrefix(self: MEKernelLike, prefix: SemanticPath): string[] {
  const out = new Set<string>();
  for (const key of Object.keys(self.index)) {
    const parts = key.split(".").filter(Boolean);
    if (parts.length <= prefix.length) continue;
    let ok = true;
    for (let i = 0; i < prefix.length; i++) {
      if (parts[i] !== prefix[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.add(parts[prefix.length]);
  }
  return Array.from(out);
}

export function evaluateTransformPath(self: MEKernelLike, path: SemanticPath): any {
  const selPos = path.findIndex((segment) => {
    const parsed = parseSelectorSegment(segment);
    if (!parsed) return false;
    return parseTransformSelector(parsed.selector) !== null;
  });
  if (selPos === -1) return undefined;

  const parsedSeg = parseSelectorSegment(path[selPos]);
  if (!parsedSeg) return undefined;
  const transform = parseTransformSelector(parsedSeg.selector);
  if (!transform) return undefined;

  const collectionPrefix = [...path.slice(0, selPos), parsedSeg.base];
  const suffix = path.slice(selPos + 1);
  if (suffix.length > 0) return undefined;

  const children = collectChildrenForPrefix(self, collectionPrefix);
  const out: Record<string, any> = {};
  for (const child of children) {
    const scope = [...collectionPrefix, child];
    const expr = transform.expr.replace(
      new RegExp(String.raw`\b${transform.varName}\.`, "g"),
      "",
    );
    const evaluated = tryEvaluateAssignExpression(self, scope, expr);
    if (evaluated.ok) {
      out[child] = evaluated.value;
    }
  }
  return out;
}

export function evaluateSelectionPath(self: MEKernelLike, path: SemanticPath): any {
  const selPos = path.findIndex((segment) => parseSelectorSegment(segment) !== null);
  if (selPos === -1) return undefined;

  const parsed = parseSelectorSegment(path[selPos]);
  if (!parsed) return undefined;

  const keys = parseSelectorKeys(parsed.selector);
  if (keys === null) return undefined;

  const collectionPrefix = [...path.slice(0, selPos), parsed.base];
  const suffix = path.slice(selPos + 1);
  const out: Record<string, any> = {};

  for (const key of keys) {
    const scope = [...collectionPrefix, key];
    const value =
      suffix.length === 0
        ? buildPublicSubtree(self, scope)
        : readPathWithStealth(self, [...scope, ...suffix]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function buildPublicSubtree(self: MEKernelLike, prefix: SemanticPath): any {
  const normalizedPrefix = normalizeSelectorPath(prefix);
  const prefixKey = normalizedPrefix.join(".");
  const root: any = {};
  let wroteAny = false;
  for (const [k, v] of Object.entries(self.index)) {
    const candidatePath = k.split(".").filter(Boolean);
    if (k === prefixKey) {
      if (hasStealthBarrier(self, candidatePath)) return undefined;
      return v;
    }
    if (!k.startsWith(prefixKey + ".")) continue;
    if (hasStealthBarrier(self, candidatePath)) continue;
    const rel = k.slice(prefixKey.length + 1).split(".").filter(Boolean);
    let ref = root;
    for (let i = 0; i < rel.length - 1; i++) {
      const part = rel[i];
      if (!ref[part] || typeof ref[part] !== "object") ref[part] = {};
      ref = ref[part];
    }
    ref[rel[rel.length - 1]] = v;
    wroteAny = true;
  }
  return wroteAny ? root : undefined;
}

export function evaluateFilterPath(self: MEKernelLike, path: SemanticPath): any {
  const filterPos = path.findIndex((segment) => parseLogicalFilterExpression(segment) !== null);
  if (filterPos === -1) return undefined;

  const filterExpr = path[filterPos];

  const collectionPrefix = path.slice(0, filterPos);
  const suffix = path.slice(filterPos + 1);
  if (collectionPrefix.length === 0) return undefined;

  const children = collectChildrenForPrefix(self, collectionPrefix);
  const out: Record<string, any> = {};

  for (const child of children) {
    const scope = [...collectionPrefix, child];
    if (!evaluateLogicalFilterForScope(self, scope, filterExpr)) continue;

    if (suffix.length === 0) {
      out[child] = buildPublicSubtree(self, scope);
    } else {
      out[child] = readPathWithStealth(self, [...scope, ...suffix]);
    }
  }

  return out;
}

export function pathContainsFilterSelector(self: MEKernelLike, path: SemanticPath): boolean {
  void self;
  return path.some((segment) => {
    const parsed = parseSelectorSegment(segment);
    if (!parsed) return false;
    return parseLogicalFilterExpression(parsed.selector) !== null;
  });
}

export function collectFilteredScopes(self: MEKernelLike, path: SemanticPath): SemanticPath[] {
  const selPos = path.findIndex((segment) => {
    const parsed = parseSelectorSegment(segment);
    if (!parsed) return false;
    return parseLogicalFilterExpression(parsed.selector) !== null;
  });
  if (selPos === -1) return [];

  const parsed = parseSelectorSegment(path[selPos]);
  if (!parsed) return [];

  const collectionPrefix = [...path.slice(0, selPos), parsed.base];
  const tail = path.slice(selPos + 1);
  const children = collectChildrenForPrefix(self, collectionPrefix);
  const out: SemanticPath[] = [];
  for (const child of children) {
    const scope = [...collectionPrefix, child];
    if (!evaluateLogicalFilterForScope(self, scope, parsed.selector)) continue;
    out.push([...scope, ...tail]);
  }
  return out;
}
