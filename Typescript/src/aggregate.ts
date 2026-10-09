/**
 * Reference evaluator for the collection aggregate (contract v4.1 §1–§3; stage S3).
 *
 * Strategy: full scan at every resolution (the simplest correct strategy, §3.1). Nothing is cached; the value is
 * always recomputed from the current sources (§1.8). Cost is measured, never promised (§3.3).
 *
 * Public view (§2.3): the members of C are its direct children that have at least one entry a guest
 * (`me.as(null)`) can read; terms are read as a guest reads them. The guest barrier is the kernel's own stealth
 * check (the same rules as `isStealthBlocked(path, null)` / `hasStealthBarrier`, applied to storage keys), so the
 * public view equals what `me.as(null)` observes, including under a root-scope secret. It does not use
 * protectedScopeKeys, listScopes() or encrypted branches.
 */
import { isPointer } from "./operators.ts";
import { isEncryptedBlob } from "./crypto.ts";
import type { MEKernelLike } from "./types.ts";
import type { AggregateRef } from "./path-expr.ts";
import { renderSegments } from "./path-expr.ts";
import type { AggregateContext, AggregateResult } from "./derivation.ts";

const SAMPLE = 20;

// ─── exact sum, one rounding (contract v3 §8 / v4.1 §1.4) ───────────────────────
// Each binary64 term is an integer multiple of 2^-1074, so Σ is exact as a BigInt scaled by 2^1074; the total is
// rounded once to binary64, ties to even. Zero is +0. A total beyond the largest finite double is `non-finite`.

const view = new DataView(new ArrayBuffer(8));
function scaled(x: number): bigint {
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const neg = hi >>> 31 === 1;
  const exp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let shift: number;
  if (exp === 0) shift = 0;                       // subnormal (or zero): mant · 2^-1074
  else { mant |= 1n << 52n; shift = exp - 1; }    // normal: mant · 2^(exp-1075) = mant · 2^(exp-1) · 2^-1074
  const v = mant << BigInt(shift);
  return neg ? -v : v;
}
function bitLength(a: bigint): number {
  return a === 0n ? 0 : a.toString(2).length;
}
/** Round a·2^-1074 (a ≥ 0) to binary64, ties to even. Returns Infinity on overflow. */
function roundScaled(a: bigint): number {
  const L = bitLength(a);
  if (L <= 53) return Number(a) * 2 ** -1074;     // exact: < 2^53 ulps of 2^-1074 is representable
  let shift = L - 53;
  let m = a >> BigInt(shift);
  const rem = a - (m << BigInt(shift));
  const half = 1n << BigInt(shift - 1);
  if (rem > half || (rem === half && (m & 1n) === 1n)) m += 1n;
  if (m === 1n << 53n) { m >>= 1n; shift += 1; }
  const e = shift - 1074;                          // value = m · 2^e, m in [2^52, 2^53)
  if (e > 971) return Infinity;                    // (2^53-1)·2^971 is the largest finite double
  return Number(m) * 2 ** e;                       // exact (m has 53 bits, e ≥ -1073)
}
export function exactSum(terms: number[]): number {
  let acc = 0n;
  for (const t of terms) acc += scaled(t);
  if (acc === 0n) return 0;
  const r = roundScaled(acc < 0n ? -acc : acc);
  return acc < 0n ? -r : r;
}

// ─── public view ────────────────────────────────────────────────────────────────

/** Guest barrier on a storage key: a scope at the key or any ancestor (root included), or a stealth index node. */
function guestBlocked(self: MEKernelLike, key: string): boolean {
  const parts = key.split(".");
  for (let i = parts.length; i >= 0; i--) {
    const anc = parts.slice(0, i).join(".");
    if (typeof self.localSecrets[anc] === "string") return true;
    const node = self.index[anc] as any;
    if (node && typeof node === "object" && "meta" in node && node.meta?.origin === "stealth") return true;
  }
  return false;
}
/** A storage key a guest can read (no scope on it or above it, no stealth node): part of the public view. */
export function isPublicKey(self: MEKernelLike, key: string): boolean {
  return !guestBlocked(self, key);
}
function publicEntry(self: MEKernelLike, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(self.index, key)) return false;
  if (isEncryptedBlob(self.index[key])) return false;
  return !guestBlocked(self, key);
}

/**
 * Lazy mode: bring PUBLIC member formulas under `prefix` up to date before reading them (contract v4.1 §1.5 as
 * amended at S3 close). This refreshes derived values only; it appends no fact. Each refresh is an ordinary
 * derivation commit of that formula's own target (the same `=` memory a direct read of that target would make).
 * A formula whose target is protected is not part of the public view and is never refreshed from here.
 */
export function refreshPublicMemberFormulas(self: MEKernelLike, prefix: string, ownTarget?: string, refresh?: (key: string) => void): void {
  if (self.recomputeMode !== "lazy") return;
  const dot = prefix + ".";
  for (const key of Object.keys(self.derivations)) {
    if (key === ownTarget || !key.startsWith(dot) || !isPublicKey(self, key)) continue;
    if (refresh) refresh(key);
    else (self as any).ensureTargetFresh(key);
  }
}

const sortKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Evaluate one aggregate reference in a context (contract v4.1 §1.3 table, §2.4 R4).
 * Precedence inside one aggregate: unsupported (authorized) > cycle > deferred (pointer) > absent > incomplete.
 */
export function evaluateAggregate(
  self: MEKernelLike,
  ref: AggregateRef,
  context: AggregateContext,
  targetKey?: string,
): AggregateResult {
  const none = { members: null, terms: null, domain: null } as const;
  if (context === "authorized") {
    return { value: undefined, status: "unsupported", reason: "authorized-context-unsupported", ...none };
  }
  const C = ref.collection.join(".");
  if (targetKey !== undefined && (targetKey === C || targetKey.startsWith(C + "."))) {
    return { value: undefined, status: "cycle", ...none };
  }
  // A pointer on the collection path itself (C or an ancestor): deferred (§1.6).
  for (let i = 1; i <= ref.collection.length; i++) {
    if (isPointer(self.index[ref.collection.slice(0, i).join(".")])) {
      return { value: undefined, status: "deferred", reason: "pointer", ...none };
    }
  }

  refreshPublicMemberFormulas(self, C, targetKey);

  // Members: direct children of C with at least one public entry at or under them (full scan of the index).
  const dot = C + ".";
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(self.index)) {
    if (!key.startsWith(dot)) continue;
    const rest = key.slice(dot.length);
    const j = rest.indexOf(".");
    const member = j === -1 ? rest : rest.slice(0, j);
    if (!publicEntry(self, key)) continue;
    const g = groups.get(member);
    if (g) g.push(key);
    else groups.set(member, [key]);
  }
  const members = [...groups.keys()].sort(sortKeys);
  const m = members.length;
  if (m === 0) return { value: undefined, status: "absent", ...none };

  // A member that is a pointer (or a field path through one): deferred.
  for (const member of members) {
    const mk = dot + member;
    if (isPointer(self.index[mk])) return { value: undefined, status: "deferred", reason: "pointer", members: m, terms: null, domain: null };
  }
  if (ref.op === "count") return { value: m, status: "resolved", members: m, terms: null, domain: null };

  const field = ref.field!;
  const nums: number[] = [];
  let bools = 0;
  const boolMembers: string[] = [];
  const problems: Array<{ path: string; kind: string }> = [];
  for (const member of members) {
    const parts = [...ref.collection, member, ...field];
    for (let i = ref.collection.length + 2; i < parts.length; i++) {
      if (isPointer(self.index[parts.slice(0, i).join(".")])) {
        return { value: undefined, status: "deferred", reason: "pointer", members: m, terms: null, domain: null };
      }
    }
    const tk = parts.join(".");
    if (isPointer(self.index[tk])) return { value: undefined, status: "deferred", reason: "pointer", members: m, terms: null, domain: null };
    const path = renderSegments(parts);
    let v: any;
    if (publicEntry(self, tk)) v = self.index[tk];
    else if (groups.get(member)!.some((k) => k.startsWith(tk + "."))) v = {}; // a subtree, not a term
    if (v === undefined) problems.push({ path, kind: "missing" });
    else if (v === null) problems.push({ path, kind: "null" });
    else if (typeof v === "boolean") { bools++; boolMembers.push(path); nums.push(v ? 1 : 0); }
    else if (typeof v === "number") {
      if (Number.isFinite(v)) nums.push(v);
      else problems.push({ path, kind: "non-finite" });
    } else problems.push({ path, kind: "non-numeric" });
  }
  const numeric = nums.length - bools;
  if (bools > 0 && numeric > 0) for (const path of boolMembers) problems.push({ path, kind: "mixed-domain" });
  const domain: "number" | "boolean" | null = nums.length === 0 ? null : bools > 0 && numeric === 0 ? "boolean" : "number";
  const terms = bools > 0 && numeric > 0 ? numeric : nums.length;
  if (problems.length > 0) {
    problems.sort((a, b) => sortKeys(a.path, b.path) || sortKeys(a.kind, b.kind));
    return {
      value: undefined, status: "incomplete", members: m, terms, domain,
      problems: { count: problems.length, sample: problems.slice(0, SAMPLE) },
    };
  }
  const total = exactSum(nums);
  if (!Number.isFinite(total)) return { value: undefined, status: "non-finite", reason: "overflow", members: m, terms, domain };
  return { value: total, status: "resolved", members: m, terms, domain };
}
