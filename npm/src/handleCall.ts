import type { SemanticPath, Thought } from "./types.js";
// Forward declarations to avoid circular type imports.
// MEProxy is defined in me.ts; we only need it as `any` at runtime.
export type MEProxy = any;
export interface HandleCallDeps {
  /** Create (or reuse) a proxy for a semantic path. */
  createProxy(path: SemanticPath): MEProxy;
  /** Normalize call args into an expression (0 args -> undefined, 1 -> arg, 2+ -> array). */
  normalizeArgs(args: any[]): any;
  /** Read a semantic path (used by root GET bias). */
  readPath(path: SemanticPath): any;
  /** Perform a semantic write/claim at a path. May return a thought, a value, or undefined. */
  postulate(path: SemanticPath, expression: any): any;
  /** Resolve operator kinds (used only to decide chaining path when a thought was produced). */
  opKind(op: string): string | null;
  splitPath(path: SemanticPath): { scope: SemanticPath; leaf: string | null };
  isThought(obj: any): obj is Thought;
}

function splitPathExpr(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let bracketDepth = 0;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "[") {
      bracketDepth++;
      cur += ch;
      continue;
    }
    if (ch === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      cur += ch;
      continue;
    }

    if (ch === "." && bracketDepth === 0) {
      const part = cur.trim();
      if (part) out.push(part);
      cur = "";
      continue;
    }

    cur += ch;
  }

  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Extracted `handleCall` logic from `me.ts`.
 *
 * IMPORTANT: This module is intentionally dumb about internals.
 * It only performs:
 * - root GET bias routing
 * - invoking postulate
 * - deciding what to return for chaining
 */
export function handleCall(deps: HandleCallDeps, path: SemanticPath, args: any[]): MEProxy | any {
  // Root call
  if (path.length === 0) {
    // GET bias: me("a.b.c") or me("username")
    if (args.length === 1 && typeof args[0] === "string") {
      const s = (args[0] as string).trim();
      const isOperatorPrefixed = s.startsWith("_") || s.startsWith("~") || s.startsWith("@");
      const isDottedPath = s.includes(".");
      const isSingleLabelPath = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s);
      if (isDottedPath || isOperatorPrefixed || isSingleLabelPath) {
        const getPath = splitPathExpr(s);
        return deps.readPath(getPath);
      }
    }

    // me() -> return root proxy
    if (args.length === 0) {
      return deps.createProxy([]);
    }

    // Root postulate: me(expression)
    const expression = deps.normalizeArgs(args);
    const out = deps.postulate([], expression);
    // Operators like root "=" thunk and root "?" query return values.
    if (out !== undefined) return out;
    return deps.createProxy([]);
  }

  // Non-root call
  const expression = deps.normalizeArgs(args);
  const out = deps.postulate(path, expression);
  // If a thought was produced, keep chaining along semantic path.
  const { scope, leaf } = deps.splitPath(path);
  const leafKind = leaf ? deps.opKind(leaf) : null;
  if (deps.isThought(out)) {
    const chainPath = leafKind ? scope : path;
    return deps.createProxy(chainPath);
  }

  // Operators may return values.
  if (out !== undefined) return out;
  // Normal write: stay on same branch.
  return deps.createProxy(path);
}
