import type { MappingInstruction, MappingIntent, NormalizedCall, OperatorRegistry } from "./types.js";
import {
  isDefineOpCall,
  isEvalCall,
  isIdentityCall,
  isNoiseScopeCall,
  isPointerCall,
  isQueryCall,
  isRemoveCall,
  isSecretScopeCall,
  makeIdentityRef,
  makePointer,
  splitPath,
} from "./operators.js";

export interface NormalizeCallDeps {
  /**
   * Optional evaluator for legacy JS closures in "=" thunk mode.
   * If omitted, closure-based derivations are rejected for invariance.
   */
  evaluateThunk?: (fn: Function) => any;
  /**
   * Optional resolver for "?" query source paths.
   * Needed only if query normalization should produce concrete output values.
   */
  readPath?: (path: string[]) => any;
}

/**
 * Normalize a proxy invocation into pure mapping instructions.
 * This function is side-effect free: it does not mutate kernel state.
 */
export function normalizeCall(
  operators: OperatorRegistry,
  intent: MappingIntent,
  deps: NormalizeCallDeps = {}
): NormalizedCall {
  const { path, expression } = intent;

  const def = isDefineOpCall(path, expression);
  if (def) {
    return {
      kind: "return",
      value: {
        define: def,
      },
    };
  }

  const secret = isSecretScopeCall(operators, path, expression);
  if (secret) {
    return {
      kind: "commit",
      instructions: [{ path: secret.scopeKey ? secret.scopeKey.split(".").filter(Boolean) : [], op: "secret", value: expression }],
    };
  }

  const noise = isNoiseScopeCall(operators, path, expression);
  if (noise) {
    return {
      kind: "commit",
      instructions: [{ path: noise.scopeKey ? noise.scopeKey.split(".").filter(Boolean) : [], op: "noise", value: expression }],
    };
  }

  const ptr = isPointerCall(operators, path, expression);
  if (ptr) {
    const { scope } = splitPath(path);
    return {
      kind: "commit",
      instructions: [{ path: scope, op: "ptr", value: makePointer(ptr.targetPath) }],
    };
  }

  const id = isIdentityCall(operators, path, expression);
  if (id) {
    return {
      kind: "commit",
      instructions: [{ path: id.targetPath, op: "id", value: makeIdentityRef(id.id) }],
    };
  }

  const rm = isRemoveCall(operators, path, expression);
  if (rm) {
    return {
      kind: "commit",
      instructions: [{ path: rm.targetPath, op: "remove", value: "-" }],
    };
  }

  const ev = isEvalCall(operators, path, expression);
  if (ev) {
    if (ev.mode === "assign") {
      return {
        kind: "commit",
        instructions: [
          {
            path: [...ev.targetPath, ev.name],
            op: "derive",
            value: {
              kind: "expr",
              source: ev.expr,
            },
          },
        ],
      };
    }

    if (!deps.evaluateThunk) {
      throw new Error('Non-serializable derivation: "=" thunk requires `evaluateThunk` or serializable DNA.');
    }

    const out = deps.evaluateThunk(ev.thunk);
    if (ev.targetPath.length === 0) {
      return { kind: "return", value: out };
    }
    return {
      kind: "commit",
      instructions: [{ path: ev.targetPath, op: "derive", value: out }],
    };
  }

  const q = isQueryCall(operators, path, expression);
  if (q) {
    if (!deps.readPath) {
      return {
        kind: "commit",
        instructions: [
          {
            path: q.targetPath,
            op: "query",
            value: { paths: q.paths },
          },
        ],
      };
    }

    const values = q.paths.map((p) => deps.readPath!(p.split(".").filter(Boolean)));
    const out = q.fn ? (q.fn as any)(...values) : values;
    if (q.targetPath.length === 0) return { kind: "return", value: out };
    return {
      kind: "commit",
      instructions: [{ path: q.targetPath, op: "query", value: out }],
    };
  }

  return {
    kind: "commit",
    instructions: [{ path, op: "set", value: expression }],
  };
}

