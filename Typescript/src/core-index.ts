import { isPointer, pathStartsWith } from "./operators.ts";
import { resolveBranchScope } from "./secret.ts";
import { MEMORY_LOG_SECRET_PLACEHOLDER } from "./core-write.ts";
import type {
  KernelMemory,
  MEKernelLike,
  SemanticPath,
} from "./types.ts";

/**
 * Axiom A9's total order for colliding writes to the same path.
 *
 * Two eras, one function, explicit compatibility rule between them:
 *
 * - MODERN entries (both sides carry a real `seq`, the Lamport-style local
 *   logical clock — see `Memory.seq`, types.ts): ordered by `(seq asc,
 *   hash asc)`. `seq` alone already resolves every SEQUENTIAL pair from the
 *   same local history — it strictly increases once per write, with no
 *   collisions, immune to the physical clock jumping around (backwards
 *   included) — so two writes issued one after another on this process
 *   ALWAYS resolve in that real order, never by coin-flip hash comparison.
 *   `hash` only matters for the case `seq` cannot resolve on its own: two
 *   entries that are genuinely concurrent from DIFFERENT histories that
 *   happen to carry the same logical clock value after a merge (no such
 *   merge exists in this codebase yet, but the rule is defined for when
 *   one does) — exactly the case A9's original title describes ("if two
 *   WRITERS collide"), which local sequential writes from one process were
 *   never actually an instance of.
 * - LEGACY entries (NEITHER side has a `seq` — persisted before this field
 *   existed): falls back to the ORIGINAL rule, `(timestamp asc, hash asc)`,
 *   exactly as it always was, so nothing about already-persisted history's
 *   relative order changes.
 * - MIXED (exactly one side has a `seq`): the `seq`'d side always wins —
 *   any real local write is causally after all pre-migration history, by
 *   construction (seq assignment only ever started counting up from "now").
 *
 * `timestamp` is NOT part of the modern-entry comparison at all — kept on
 * the record for display/audit ("what time did this happen"), never for
 * deciding order; using it for ordering is exactly what let a backward
 * clock adjustment flip two sequential writes' outcome, and what let two
 * same-millisecond sequential writes fall through to the arbitrary hash
 * tiebreak instead of "the second one wins."
 *
 * This is the SINGLE implementation of this rule, used by both
 * `rebuildIndex()`'s sort and `applyMemoryToIndex`'s live/incremental
 * winner check below, so live writes and a from-scratch replay are
 * governed by the literal same function — not two hopefully-equivalent
 * copies of "the same" rule (which is exactly how the live/rebuild
 * divergence this was built to fix happened in the first place).
 *
 * Returns >0 when `a` outranks `b` (wins the path), <0 when `b` wins, 0
 * only on a genuine full tie (both legacy with equal timestamp+hash, or —
 * theoretically, post-merge — both modern with equal seq+hash); callers
 * that need a tiebreak for that residual case use insertion order (see
 * `rebuildIndex`'s `a.i - b.i` and `applyMemoryToIndex`'s "incoming wins
 * a tie" rule).
 */
export function compareLWW(
  a: { timestamp: number; seq?: number; hash: string },
  b: { timestamp: number; seq?: number; hash: string },
): number {
  const aSeq = typeof a.seq === "number" ? a.seq : null;
  const bSeq = typeof b.seq === "number" ? b.seq : null;
  if (aSeq !== null && bSeq !== null) {
    if (aSeq !== bSeq) return aSeq - bSeq;
    if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
    return 0;
  }
  if (aSeq === null && bSeq === null) {
    // Both legacy: the ORIGINAL A9 rule, unchanged, for full backward
    // compatibility with already-persisted logs.
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
    return 0;
  }
  // Exactly one side has a real seq: it wins, unconditionally.
  return aSeq !== null ? 1 : -1;
}

function clearIndexWinnerPrefix(self: MEKernelLike, prefix: string): void {
  if (prefix === "") {
    for (const k of Object.keys(self.indexWinner)) delete self.indexWinner[k];
    return;
  }
  const dot = prefix + ".";
  for (const k of Object.keys(self.indexWinner)) {
    if (k === prefix || k.startsWith(dot)) delete self.indexWinner[k];
  }
}

export function applyMemoryToIndex(self: MEKernelLike, t: KernelMemory): void {
  const p = t.path;
  const pathParts = p.split(".").filter(Boolean);
  if (t.operator === "_") {
    if (pathParts.length > 0) removeIndexPrefix(self, pathParts);
    return;
  }
  const scope = resolveBranchScope(self, pathParts);
  const inSecret = scope && scope.length > 0 && pathStartsWith(pathParts, scope);
  if (t.operator === "-") {
    if (p === "") {
      for (const k of Object.keys(self.index)) delete self.index[k];
      clearIndexWinnerPrefix(self, "");
      return;
    }
    const prefix = p + ".";
    for (const k of Object.keys(self.index)) {
      if (k === p || k.startsWith(prefix)) delete self.index[k];
    }
    clearIndexWinnerPrefix(self, p);
    return;
  }

  if (inSecret) return;
  // FIX (adversarial security battery, tests/Security/isolation.test.ts —
  // "cache warming ... does not leak into a later different identity"):
  // a branch-scoped write's memory entry has BOTH `value` and `expression`
  // redacted to the same placeholder (core-write.ts's commitValueMapping,
  // MEMORY_LOG_SECRET_PLACEHOLDER) at the moment it's written. `inSecret`
  // above is recomputed from `self.localSecrets` as it stands RIGHT NOW,
  // which can be stale relative to when the write actually happened — the
  // clearest real-world case is a full identity transition (ME_RESEED):
  // `localSecrets` is wiped and then `rebuildIndex()` replays the entire
  // memory log, so `resolveBranchScope` no longer recognizes paths that
  // WERE legitimately protected, `inSecret` computes false for them, and
  // without this guard the literal "***" placeholder would be written into
  // `self.index` as if it were real public content — readable via an
  // ordinary public me() call. Not a plaintext leak (the placeholder is a
  // constant, not the real value), but a real violation of the
  // closed/absent indistinguishability §3.4 documents: a caller could learn
  // "a protected write happened here" by seeing the literal marker where
  // they should see the same "nothing" as always. Guarded directly: a
  // memory entry that IS the redaction placeholder in both fields is never
  // eligible for the public index, regardless of what `inSecret` computed.
  if (t.value === MEMORY_LOG_SECRET_PLACEHOLDER && t.expression === MEMORY_LOG_SECRET_PLACEHOLDER) return;
  // Enforce A9 on THIS write, incrementally, exactly as rebuildIndex()'s
  // sorted replay would — see compareLWW's docstring. On a genuine
  // (timestamp, hash) tie against the recorded winner, the incoming write
  // is treated as the later one (it is, literally, arriving now) and wins,
  // matching rebuildIndex()'s own tie handling (its `i` fallback lets the
  // later-inserted-into-_memories entry of an exact tie win too).
  const incoming = { timestamp: t.timestamp, seq: t.seq, hash: t.hash };
  const current = self.indexWinner[p];
  if (current && compareLWW(incoming, current) < 0) return;
  self.index[p] = t.value;
  self.indexWinner[p] = incoming;
}

export function removeIndexPrefix(self: MEKernelLike, prefixPath: SemanticPath): void {
  const prefix = prefixPath.join(".");
  if (!prefix) return;
  const dot = prefix + ".";
  for (const k of Object.keys(self.index)) {
    if (k === prefix || k.startsWith(dot)) delete self.index[k];
  }
  clearIndexWinnerPrefix(self, prefix);
}

export function rebuildIndex(self: MEKernelLike) {
  const next: Record<string, any> = {};
  const orderedMemories = self._memories
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const cmp = compareLWW(a.t, b.t);
      if (cmp !== 0) return cmp;
      return a.i - b.i;
    })
    .map((x) => x.t);

  self.index = next;
  self.indexWinner = {};
  // Restore the local logical clock to continue past whatever was just
  // reconstructed, so writes made AFTER this rebuild (e.g. right after a
  // restart) get a `seq` that's causally after all of it — the same rule a
  // future merge of a genuinely different node's history would use.
  let maxSeq = -1;
  for (const t of self._memories) {
    if (typeof t.seq === "number" && t.seq > maxSeq) maxSeq = t.seq;
  }
  self.seqCounter = maxSeq + 1;
  for (const t of orderedMemories) {
    applyMemoryToIndex(self, t);
  }
}

export function getIndex(self: MEKernelLike, path: SemanticPath): any {
  return self.index[path.join(".")];
}

export function setIndex(self: MEKernelLike, path: SemanticPath, value: any): void {
  self.index[path.join(".")] = value;
}

export function resolveIndexPointerPath(
  self: MEKernelLike,
  path: SemanticPath,
  maxHops = 8,
): { path: SemanticPath; raw: any } {
  let curPath = path;
  // Tracks the path of every pointer edge already followed in this call, not
  // every curPath value visited. A cycle is "the same edge asked to redirect
  // twice" — detecting it here means a cycle fails closed inside a single
  // bounded loop, regardless of cycle length or maxHops parity, instead of
  // relying on curPath ever landing back on its exact starting value.
  const visited = new Set<string>();

  for (let i = 0; i < maxHops; i++) {
    const exactRaw = getIndex(self, curPath);
    if (isPointer(exactRaw)) {
      const pointerKey = curPath.join(".");
      if (visited.has(pointerKey)) return { path: curPath, raw: undefined };
      visited.add(pointerKey);
      curPath = exactRaw.__ptr.split(".").filter(Boolean);
      continue;
    }

    let redirected = false;
    for (let prefixLen = curPath.length - 1; prefixLen >= 0; prefixLen--) {
      const prefix = curPath.slice(0, prefixLen);
      const prefixRaw = getIndex(self, prefix);
      if (!isPointer(prefixRaw)) continue;
      const prefixKey = prefix.join(".");
      if (visited.has(prefixKey)) return { path: curPath, raw: undefined };
      visited.add(prefixKey);
      const target = prefixRaw.__ptr.split(".").filter(Boolean);
      const suffix = curPath.slice(prefixLen);
      curPath = [...target, ...suffix];
      redirected = true;
      break;
    }
    if (redirected) continue;
    return { path: curPath, raw: exactRaw };
  }
  return { path: curPath, raw: undefined };
}
