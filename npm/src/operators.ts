/**
 * Operator module for ME
 *
 * This file extracts the operator *recognizers* from `me.ts` into a standalone module.
 * It intentionally keeps ALL behavior identical to the current `me.ts` implementation.
 *
 * What lives here:
 * - Pure-ish recognition and normalization of operator calls
 * - Small value helpers for operator-related marker objects
 * - Username normalization/validation used by the identity operator
 *
 * What stays in `me.ts` (kernel):
 * - Storage planes (index / encryptedBranches / memories)
 * - Crypto primitives (xorEncrypt/xorDecrypt)
 * - Secret/noise derivation (computeEffectiveSecret)
 * - The actual postulate()/readPath() machinery
 */

import type {
  KernelMemory,
  OperatorKind,
  OperatorRegistry,
  OperatorToken,
  SemanticPath,
  MePointer,
  MeIdentityRef,
} from "./types.js";

export const OP_DEFINE: OperatorToken = "+";

// -----------------------------
// Marker helpers
// -----------------------------

export function makePointer(path: string): MePointer {
  return { __ptr: path };
}

export function isPointer(obj: any): obj is MePointer {
  return !!obj && typeof obj === "object" && typeof obj.__ptr === "string" && obj.__ptr.length > 0;
}

export function makeIdentityRef(id: string): MeIdentityRef {
  return { __id: id };
}

export function isIdentityRef(obj: any): obj is MeIdentityRef {
  return !!obj && typeof obj === "object" && typeof obj.__id === "string" && obj.__id.length > 0;
}

export function isMemory(obj: any): obj is KernelMemory {
  return (
    !!obj &&
    typeof obj === "object" &&
    typeof obj.path === "string" &&
    typeof obj.hash === "string" &&
    typeof obj.timestamp === "number"
  );
}

// -----------------------------
// Path helpers
// -----------------------------

export function splitPath(path: SemanticPath): { scope: SemanticPath; leaf: string | null } {
  if (path.length === 0) return { scope: [], leaf: null };
  return { scope: path.slice(0, -1), leaf: path[path.length - 1] };
}

export function pathStartsWith(path: SemanticPath, prefix: SemanticPath): boolean {
  if (prefix.length > path.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (path[i] !== prefix[i]) return false;
  }
  return true;
}

// -----------------------------
// Username semantics (identity operator)
// -----------------------------

/**
 * Domain-safe label rules (DNS-like):
 * - 3..63 chars total
 * - a-z, 0-9, hyphen, dot
 * - labels separated by dots
 * - each label must start/end with alphanumeric
 */
export function normalizeAndValidateUsername(input: string): string {
  const id = input.trim().toLowerCase();
  if (id.length < 3 || id.length > 63) {
    throw new Error(`Invalid username length: ${id.length}. Expected 3..63 characters.`);
  }
  if (id.startsWith(".") || id.endsWith(".") || id.includes("..")) {
    throw new Error(`Invalid username. Dot-separated labels only. Got: ${input}`);
  }
  const labelRe = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  const labels = id.split(".");
  for (const label of labels) {
    if (!labelRe.test(label)) {
      throw new Error(
        `Invalid username. Use dot-separated labels with [a-z0-9-], each starting/ending with [a-z0-9]. Got: ${input}`
      );
    }
  }
  return id;
}

// -----------------------------
// Operator registry helpers
// -----------------------------

export function opKind(operators: OperatorRegistry, op: string): OperatorKind | null {
  const hit = operators[op as OperatorToken];
  return hit?.kind ?? null;
}

// -----------------------------
// Operator recognizers
// These match *exactly* the behavior currently implemented in me.ts
// -----------------------------

export function isDefineOpCall(path: SemanticPath, expression: any): { op: string; kind: string } | null {
  // Only allow defining operators at root: me["+"]("op", "kind")
  if (path.length !== 1) return null;
  const leaf = path[0];
  if (leaf !== OP_DEFINE) return null;
  if (!Array.isArray(expression) || expression.length < 2) return null;
  const op = String(expression[0] ?? "").trim();
  const kind = String(expression[1] ?? "").trim();
  if (!op || !kind) return null;
  // protect core define operator from being overwritten
  if (op === OP_DEFINE) return null;
  return { op, kind };
}

export function isSecretScopeCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): { scopeKey: string } | null {
  if (path.length === 0) return null;
  const { scope, leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "secret") return null;
  if (typeof expression !== "string") return null;
  return { scopeKey: scope.join(".") };
}

export function isNoiseScopeCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): { scopeKey: string } | null {
  if (path.length === 0) return null;
  const { scope, leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "noise") return null;
  if (typeof expression !== "string") return null;
  return { scopeKey: scope.join(".") };
}

export function isPointerCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): { targetPath: string } | null {
  if (path.length === 0) return null;
  const { leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "pointer") return null;
  if (typeof expression !== "string") return null;
  const targetPath = expression.trim().replace(/^\./, "");
  if (!targetPath) return null;
  return { targetPath };
}

export function isIdentityCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): { id: string; targetPath: SemanticPath } | null {
  // Root form: me["@"]("id") is represented as path=["@"]
  if (path.length === 1 && opKind(operators, path[0]) === "identity") {
    if (typeof expression !== "string") return null;
    const id = normalizeAndValidateUsername(expression);
    return { id, targetPath: [] };
  }

  // Non-root form: me.something["@"]("id")
  const { scope, leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "identity") return null;
  if (typeof expression !== "string") return null;
  const id = normalizeAndValidateUsername(expression);
  return { id, targetPath: scope };
}

export type EvalCallMatch =
  | { mode: "thunk"; targetPath: SemanticPath; thunk: Function }
  | { mode: "assign"; targetPath: SemanticPath; name: string; expr: string };

export function isEvalCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): EvalCallMatch | null {
  // Supported:
  //   me["="](() => expr)                 -> returns computed value (root) OR assigns (non-root)
  //   me.foo.bar["="](() => expr)         -> assigns result to foo.bar
  //   me.foo["="]("net", "a - b")        -> assigns derived value to foo.net
  //   me.foo["="](["net", "a - b"])      -> same as above
  if (path.length === 0) return null;
  const { scope, leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "eval") return null;

  if (typeof expression === "function") {
    return { mode: "thunk", targetPath: scope, thunk: expression };
  }

  if (Array.isArray(expression) && expression.length >= 2) {
    const name = String(expression[0] ?? "").trim();
    const expr = String(expression[1] ?? "").trim();
    if (!name || !expr) return null;
    return { mode: "assign", targetPath: scope, name, expr };
  }

  return null;
}

export function isQueryCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): { targetPath: SemanticPath; paths: string[]; fn?: Function } | null {
  // Supported:
  //   me["?"](["a.b", "c.d"], fn?)
  //   me["?"](["a.b", "c.d"])
  //   me.foo["?"](["x.y"], fn?)      -> assigns result to foo
  //   me.foo["?"]("x.y", "z.k")     -> variadic, packed by normalizeArgs into an array
  if (path.length === 0) return null;
  const { scope, leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "query") return null;
  let pathsArg: any = null;
  let fn: Function | undefined;
  if (Array.isArray(expression) && expression.length > 0) {
    const looksLikeTuple =
      Array.isArray(expression[0]) && (expression.length === 1 || typeof expression[1] === "function");
    if (looksLikeTuple) {
      pathsArg = expression[0];
      fn = typeof expression[1] === "function" ? (expression[1] as Function) : undefined;
    } else {
      pathsArg = expression;
    }
  } else {
    return null;
  }

  if (!Array.isArray(pathsArg) || pathsArg.length === 0) return null;
  const paths = pathsArg
    .map((p: any) => String(p))
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);
  if (paths.length === 0) return null;
  return { targetPath: scope, paths, fn };
}

export function isRemoveCall(
  operators: OperatorRegistry,
  path: SemanticPath,
  expression: any
): { targetPath: SemanticPath } | null {
  if (path.length === 0) return null;
  const { scope, leaf } = splitPath(path);
  if (!leaf) return null;
  if (opKind(operators, leaf) !== "remove") return null;
  // Allow:
  //   me.foo.bar["-"]()          -> removes subtree rooted at foo.bar
  //   me["-"]("a.b.c")           -> removes subtree rooted at a.b.c (root operator)
  //   me.foo["-"]("x.y")         -> removes subtree rooted at foo.x.y (relative)
  if (expression === undefined || expression === null) {
    return { targetPath: scope };
  }

  if (typeof expression === "string") {
    const rel = expression.split(".").filter(Boolean);
    const targetPath = [...scope, ...rel];
    return { targetPath };
  }

  return null;
}

// -----------------------------
// Bundled recognizer surface
// -----------------------------
export const Operators = {
  OP_DEFINE,
  opKind,
  splitPath,
  pathStartsWith,
  makePointer,
  isPointer,
  makeIdentityRef,
  isIdentityRef,
  isMemory,
  normalizeAndValidateUsername,
  isDefineOpCall,
  isSecretScopeCall,
  isNoiseScopeCall,
  isPointerCall,
  isIdentityCall,
  isEvalCall,
  isQueryCall,
  isRemoveCall,
} as const;
