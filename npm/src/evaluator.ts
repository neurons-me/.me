import { isPointer } from "./operators.js";
import type {
  MEKernelLike,
  SemanticPath,
} from "./types.js";

export function tryResolveEvalTokenValue(
  self: MEKernelLike,
  token: string,
  evalScopePath: SemanticPath,
): { ok: true; value: any } | { ok: false } {
  if (token.startsWith("__ptr.")) {
    const raw = self.getIndex(evalScopePath);
    if (!isPointer(raw)) return { ok: false };
    const ptrSuffix = token.slice("__ptr.".length).split(".").filter(Boolean);
    const ptrPath = [...raw.__ptr.split(".").filter(Boolean), ...ptrSuffix];
    const ptrValue = self.readPath(ptrPath);
    if (ptrValue === undefined || ptrValue === null) return { ok: false };
    return { ok: true, value: ptrValue };
  }

  const tokenParts = token.split(".").filter(Boolean);
  const relativePath = [...evalScopePath, ...tokenParts];
  let value = self.readPath(relativePath);
  if (value === undefined || value === null) {
    value = self.readPath(tokenParts);
  }
  if (value === undefined || value === null) return { ok: false };
  return { ok: true, value };
}

export function tokenizeEvalExpression(
  raw: string,
):
  | Array<
      | { kind: "literal"; value: any }
      | { kind: "identifier"; value: string }
      | { kind: "op"; value: string }
      | { kind: "lparen" }
      | { kind: "rparen" }
    >
  | null {
  const tokens: Array<
    | { kind: "literal"; value: any }
    | { kind: "identifier"; value: string }
    | { kind: "op"; value: string }
    | { kind: "lparen" }
    | { kind: "rparen" }
  > = [];

  const seg = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`;
  const tokenRe = new RegExp(String.raw`^(?:__ptr(?:\.${seg})*|${seg}(?:\.${seg})*)`);
  const reservedValues: Record<string, any> = {
    true: true,
    false: false,
    null: null,
    undefined: undefined,
    NaN: NaN,
    Infinity: Infinity,
  };
  const twoCharOps = new Set([">=", "<=", "==", "!=", "&&", "||"]);
  const oneCharOps = new Set(["+", "-", "*", "/", "%", "<", ">", "!"]);

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }

    const two = raw.slice(i, i + 2);
    if (twoCharOps.has(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }

    if (oneCharOps.has(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }

    if (/\d/.test(ch) || (ch === "." && /\d/.test(raw[i + 1] ?? ""))) {
      let j = i;
      while (j < raw.length && /[0-9]/.test(raw[j])) j++;
      if (raw[j] === ".") {
        j++;
        while (j < raw.length && /[0-9]/.test(raw[j])) j++;
      }
      if (raw[j] === "e" || raw[j] === "E") {
        let k = j + 1;
        if (raw[k] === "+" || raw[k] === "-") k++;
        let hasExpDigit = false;
        while (k < raw.length && /[0-9]/.test(raw[k])) {
          hasExpDigit = true;
          k++;
        }
        if (!hasExpDigit) return null;
        j = k;
      }
      const n = Number(raw.slice(i, j));
      if (!Number.isFinite(n)) return null;
      tokens.push({ kind: "literal", value: n });
      i = j;
      continue;
    }

    const m = raw.slice(i).match(tokenRe);
    if (m && m[0]) {
      const token = m[0];
      if (Object.prototype.hasOwnProperty.call(reservedValues, token)) {
        tokens.push({ kind: "literal", value: reservedValues[token] });
      } else {
        tokens.push({ kind: "identifier", value: token });
      }
      i += token.length;
      continue;
    }

    return null;
  }

  return tokens;
}

export function tryEvaluateAssignExpression(
  self: MEKernelLike,
  evalScopePath: SemanticPath,
  expr: string,
): { ok: true; value: number | boolean } | { ok: false } {
  const raw = String(expr ?? "").trim();
  if (!raw) return { ok: false };

  if (!/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(raw)) return { ok: false };
  if (self.unsafeEval) return { ok: false };

  const tokens = tokenizeEvalExpression(raw);
  if (!tokens || tokens.length === 0) return { ok: false };

  const precedence: Record<string, number> = {
    "u-": 7,
    "!": 7,
    "*": 6,
    "/": 6,
    "%": 6,
    "+": 5,
    "-": 5,
    "<": 4,
    "<=": 4,
    ">": 4,
    ">=": 4,
    "==": 3,
    "!=": 3,
    "&&": 2,
    "||": 1,
  };
  const rightAssoc = new Set(["u-", "!"]);
  const out: Array<
    { kind: "literal"; value: any } |
    { kind: "identifier"; value: string } |
    { kind: "op"; value: string }
  > = [];
  const ops: Array<{ kind: "op"; value: string } | { kind: "lparen" }> = [];

  type Prev = "start" | "value" | "op" | "lparen" | "rparen";
  let prev: Prev = "start";

  for (const token of tokens) {
    if (token.kind === "literal" || token.kind === "identifier") {
      out.push(token);
      prev = "value";
      continue;
    }

    if (token.kind === "lparen") {
      ops.push(token);
      prev = "lparen";
      continue;
    }

    if (token.kind === "rparen") {
      let found = false;
      while (ops.length > 0) {
        const top = ops.pop()!;
        if (top.kind === "lparen") {
          found = true;
          break;
        }
        out.push(top);
      }
      if (!found) return { ok: false };
      prev = "rparen";
      continue;
    }

    let op = token.value;
    if (op === "-" && (prev === "start" || prev === "op" || prev === "lparen")) {
      op = "u-";
    } else if (op === "!" && (prev === "value" || prev === "rparen")) {
      return { ok: false };
    } else if (op !== "!" && (prev === "start" || prev === "op" || prev === "lparen")) {
      return { ok: false };
    }

    while (ops.length > 0) {
      const top = ops[ops.length - 1];
      if (top.kind !== "op") break;
      const pTop = precedence[top.value] ?? -1;
      const pCur = precedence[op] ?? -1;
      if (pCur < 0) return { ok: false };
      const shouldPop = rightAssoc.has(op) ? pCur < pTop : pCur <= pTop;
      if (!shouldPop) break;
      out.push(ops.pop() as { kind: "op"; value: string });
    }
    ops.push({ kind: "op", value: op });
    prev = "op";
  }

  if (prev === "op" || prev === "lparen" || prev === "start") return { ok: false };

  while (ops.length > 0) {
    const top = ops.pop()!;
    if (top.kind === "lparen") return { ok: false };
    out.push(top);
  }

  const toFiniteNumber = (v: any): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  const stack: any[] = [];
  for (const token of out) {
    if (token.kind === "literal") {
      stack.push(token.value);
      continue;
    }

    if (token.kind === "identifier") {
      const resolved = tryResolveEvalTokenValue(self, token.value, evalScopePath);
      if (!resolved.ok) return { ok: false };
      stack.push(resolved.value);
      continue;
    }

    const op = token.value;
    if (op === "u-" || op === "!") {
      if (stack.length < 1) return { ok: false };
      const a = stack.pop();
      if (op === "u-") {
        const n = toFiniteNumber(a);
        if (n === null) return { ok: false };
        stack.push(-n);
      } else {
        stack.push(!Boolean(a));
      }
      continue;
    }

    if (stack.length < 2) return { ok: false };
    const b = stack.pop();
    const a = stack.pop();

    if (op === "&&" || op === "||") {
      stack.push(op === "&&" ? Boolean(a) && Boolean(b) : Boolean(a) || Boolean(b));
      continue;
    }

    if (op === "==" || op === "!=") {
      stack.push(op === "==" ? a == b : a != b);
      continue;
    }

    if (op === "<" || op === "<=" || op === ">" || op === ">=") {
      const an = toFiniteNumber(a);
      const bn = toFiniteNumber(b);
      if (an === null || bn === null) return { ok: false };
      if (op === "<") stack.push(an < bn);
      if (op === "<=") stack.push(an <= bn);
      if (op === ">") stack.push(an > bn);
      if (op === ">=") stack.push(an >= bn);
      continue;
    }

    const an = toFiniteNumber(a);
    const bn = toFiniteNumber(b);
    if (an === null || bn === null) return { ok: false };
    let outNum: number;
    if (op === "+") outNum = an + bn;
    else if (op === "-") outNum = an - bn;
    else if (op === "*") outNum = an * bn;
    else if (op === "/") outNum = an / bn;
    else if (op === "%") outNum = an % bn;
    else return { ok: false };
    if (!Number.isFinite(outNum)) return { ok: false };
    stack.push(outNum);
  }

  if (stack.length !== 1) return { ok: false };
  const result = stack[0];
  if (typeof result === "number" && Number.isFinite(result)) return { ok: true, value: result };
  if (typeof result === "boolean") return { ok: true, value: result };
  return { ok: false };
}
