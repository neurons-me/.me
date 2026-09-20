/// <reference types="node" />
/**
 * §10 SEED PERSISTENCE — no plaintext private material in localStorage
 *
 * Regression battery for a real bug found and fixed by this session:
 * `resolveSeed()` (src/me.ts) used to call `persistSeed()` unconditionally,
 * for EVERY construction path — including `new ME(seed)` (an explicit raw
 * seed) and `new ME(who, secret)` (an explicit compound seed derived from
 * username+password). Both are private identity root material, yet were
 * being written in PLAINTEXT to a single, unnamespaced, shared localStorage
 * key (`this.me.seed:v1`) as a side effect of construction — readable by
 * any script with localStorage access on that origin, and silently
 * overwriting whatever anonymous fallback seed was cached there.
 *
 * The fix: `persistSeed()`/localStorage is now reached ONLY by the true
 * anonymous fallback path (`new ME()` with no seed and no compound
 * secret) — see src/me.ts's `resolveSeed()`. This battery proves both
 * halves: explicit-seed construction never touches storage, and the
 * anonymous fallback (read AND write) is completely unchanged, including
 * reading a seed a pre-fix runtime already persisted (no migration break).
 */
import { MEConstructor as ME, assert, assertNoMarkers, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("§10 Seed persistence");

const STORAGE_KEY = "this.me.seed:v1";
// Same well-known symbol binder.ts (modules/cleaker) reads identityHash
// through — Symbol.for() is process-wide, so this resolves to the exact
// same symbol the kernel itself defined it under, no import needed.
const ME_IDENTITY_SYMBOL = Symbol.for("me.identity");

function identityHashOf(me: any): string | null {
  const identity = me[ME_IDENTITY_SYMBOL];
  return identity && typeof identity === "object" ? String(identity.hash || "") || null : null;
}

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  /** Every stored value concatenated, for a single markers-scan assertion. */
  dump(): string {
    return Array.from(this.map.values()).join("\n");
  }
}

function withStubStorage<T>(fn: (storage: MemoryStorage) => T): T {
  const storage = new MemoryStorage();
  const previous = (globalThis as any).localStorage;
  (globalThis as any).localStorage = storage;
  try {
    return fn(storage);
  } finally {
    if (previous === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = previous;
  }
}

async function main() {
  console.log("\n### §10 — Seed persistence");

  await test("new ME(seed) — explicit raw seed is never written to localStorage", () => {
    withStubStorage((storage) => {
      const explicitSeed = "seed-persistence-explicit-raw-seed-marker-01";
      const me: any = new ME(explicitSeed);
      assert.ok(identityHashOf(me), "sanity: construction succeeded and identity resolved");
      assert.equal(storage.getItem(STORAGE_KEY), null, "explicit seed must not be persisted under the shared key");
      assertNoMarkers(storage.dump(), [explicitSeed], "localStorage after new ME(explicitSeed)");
    });
  });

  await test("new ME(who, secret) — compound seed is never written to localStorage", () => {
    withStubStorage((storage) => {
      const who = "seed-persistence-user-02";
      const secret = "seed-persistence-secret-marker-02";
      const me: any = new (ME as any)(who, secret);
      void me;
      assert.equal(storage.getItem(STORAGE_KEY), null, "compound seed must not be persisted under the shared key");
      // The compound seed itself is a keccak256 digest we don't have a
      // standalone import for here — the meaningful assertion is simply
      // that nothing was ever written at all (checked above); the literal
      // who/secret inputs are never part of what would be stored anyway.
    });
  });

  // Deliberately runs BEFORE any other test in this file constructs an
  // anonymous `new ME()`: `readStoredSeed()`'s cache (`runtimeDefaultSeed`,
  // src/me.ts) is a MODULE-level singleton that outlives any one test's own
  // storage stub, so once one anonymous construction has happened anywhere
  // in this process, later ones short-circuit to that cached value instead
  // of re-reading storage — same as a real long-lived runtime, but it means
  // this specific "does it read what storage already had" proof only holds
  // before that cache is first populated.
  await test("new ME() — reads a seed a pre-fix runtime already persisted (no migration break)", () => {
    withStubStorage((storage) => {
      const preExistingAnonymousSeed = "seed-persistence-pre-existing-anonymous-seed-04";
      storage.setItem(STORAGE_KEY, preExistingAnonymousSeed);
      const me: any = new ME();
      // No standalone seed getter is part of the public surface, so the
      // observable proof is indirect: the stored value must be completely
      // untouched (same exact string, not regenerated/overwritten), and the
      // kernel's own identityHash must be deterministic for that seed —
      // constructing a second anonymous ME right after must derive the
      // SAME identity, proving both read the same persisted value rather
      // than each generating its own random one.
      assert.equal(storage.getItem(STORAGE_KEY), preExistingAnonymousSeed, "pre-existing anonymous seed must be preserved verbatim");
      const meAgain: any = new ME();
      const first = identityHashOf(me);
      const second = identityHashOf(meAgain);
      assert.ok(first, "first anonymous kernel must resolve an identity");
      assert.equal(first, second, "two anonymous kernels reading the same persisted seed must derive the same identity");
    });
  });

  await test("new ME() — anonymous fallback still persists (existing behavior, unchanged)", () => {
    withStubStorage((storage) => {
      const me: any = new ME();
      void me;
      const stored = storage.getItem(STORAGE_KEY);
      assert.ok(stored, "anonymous construction must still persist a fallback seed");
    });
  });

  await test("new ME(explicitSeed) never clobbers a pre-existing anonymous fallback entry", () => {
    withStubStorage((storage) => {
      const preExistingAnonymousSeed = "seed-persistence-pre-existing-anonymous-seed-05";
      storage.setItem(STORAGE_KEY, preExistingAnonymousSeed);
      const me: any = new ME("seed-persistence-unrelated-explicit-seed-05");
      void me;
      assert.equal(
        storage.getItem(STORAGE_KEY),
        preExistingAnonymousSeed,
        "an explicit-seed construction must leave a pre-existing anonymous entry byte-for-byte untouched",
      );
    });
  });

  const ok = summarize();
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
