/**
 * Change tracking for collection aggregates (contract v4.1 §3.1, R1).
 *
 * A formula with `C[]` / `C[].f` subscribes to one pseudo path per collection, `aggregateKey(C)`. That key's version
 * is bumped ONLY when the public index changes at or under `C` (a key is set or deleted by applyMemoryToIndex,
 * removeIndexPrefix, a rollback, or a full rebuild). Writes that never reach the public index (protected writes
 * under a branch scope, `~`, a `_` over a member with no public entries) change nothing here, so they wake nothing.
 *
 * Bookkeeping only: nothing here is a source of truth (§1.8). It is rebuilt from the subscriptions.
 */
import type { MEKernelLike } from "./types.ts";

/** Pseudo path of a collection, a child of `C` in the subscription prefix index. Never a storage key. */
export const AGGREGATE_KEY_SUFFIX = "\u0000[]";
export function aggregateKey(collectionKey: string): string {
  return `${collectionKey}.${AGGREGATE_KEY_SUFFIX}`;
}
export function isAggregateKey(key: string): boolean {
  return key.endsWith(`.${AGGREGATE_KEY_SUFFIX}`);
}
export function collectionOfAggregateKey(key: string): string {
  return key.slice(0, key.length - AGGREGATE_KEY_SUFFIX.length - 1);
}

type Pending = { keys: Set<string>; all: boolean };
const pendingByKernel = new WeakMap<object, Pending>();
const flushedByKernel = new WeakMap<object, string[]>();

/** Whether any aggregate subscription exists; cached per refSubscribers object (replaced wholesale on reset). */
const subscriptionCount = new WeakMap<object, number>();
function aggregateSubscriptionCount(self: MEKernelLike): number {
  const subs = self.refSubscribers as Record<string, Set<string>>;
  let n = subscriptionCount.get(subs);
  if (n === undefined) {
    n = 0;
    for (const k of Object.keys(subs)) if (isAggregateKey(k)) n++;
    subscriptionCount.set(subs, n);
  }
  return n;
}
export function noteAggregateSubscription(self: MEKernelLike, delta: 1 | -1): void {
  const subs = self.refSubscribers as Record<string, Set<string>>;
  subscriptionCount.set(subs, aggregateSubscriptionCount(self) + delta);
}

/** A public index key was set or deleted. O(1); ignored when no aggregate formula exists. */
export function noteIndexChange(self: MEKernelLike, key: string): void {
  if (aggregateSubscriptionCount(self) === 0) return;
  let p = pendingByKernel.get(self);
  if (!p) pendingByKernel.set(self, (p = { keys: new Set(), all: false }));
  if (!p.all) p.keys.add(key);
}
/** The whole public index was replaced (rebuildIndex, reset). */
export function noteIndexReplaced(self: MEKernelLike): void {
  if (aggregateSubscriptionCount(self) === 0) return;
  let p = pendingByKernel.get(self);
  if (!p) pendingByKernel.set(self, (p = { keys: new Set(), all: true }));
  p.all = true;
  p.keys.clear();
}

/**
 * Turn the pending index changes into the aggregate keys they touch (the collection is a proper ancestor of a
 * changed key, or the change replaced the index), bump those keys' versions, and return them. O(depth) per change.
 */
export function flushAggregateChanges(self: MEKernelLike): string[] {
  const p = pendingByKernel.get(self);
  if (!p || (!p.all && p.keys.size === 0)) return [];
  pendingByKernel.delete(self);
  const subs = self.refSubscribers as Record<string, Set<string>>;
  const out = new Set<string>();
  if (p.all) {
    for (const k of Object.keys(subs)) if (isAggregateKey(k)) out.add(k);
  } else {
    for (const key of p.keys) {
      let i = key.indexOf(".");
      while (i !== -1) {
        const ak = aggregateKey(key.slice(0, i));
        if (subs[ak]) out.add(ak);
        i = key.indexOf(".", i + 1);
      }
    }
  }
  const keys = [...out];
  for (const k of keys) self.refVersions[k] = (self.refVersions[k] ?? 0) + 1;
  if (keys.length > 0) {
    const prev = flushedByKernel.get(self);
    flushedByKernel.set(self, prev ? prev.concat(keys) : keys);
  }
  return keys;
}
/** Aggregate keys flushed since the last call (used by the eager wave after each recompute). */
export function takeFlushedAggregateKeys(self: MEKernelLike): string[] {
  const keys = flushedByKernel.get(self);
  if (!keys) return [];
  flushedByKernel.delete(self);
  return keys;
}
