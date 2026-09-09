/**
 * v3 -> v4 migration (Identity-Bound Secrets). Scope-by-scope and
 * value-by-value, resumable and idempotent. See
 * typedocs/Identity-Bound-Secrets.md for the full design and the two
 * documented limitations below.
 *
 * Branch blobs (`branchStore` chunks): decrypt under v3, re-encrypt under
 * v4, VERIFY the fresh v4 blob decrypts back to the same plaintext, and
 * only then overwrite the stored chunk. `branchStore` holds one blob per
 * chunk key (no version history), so "don't delete the original before
 * verifying" is implemented as "never call `setChunkBlob` until the
 * verify-decrypt of the newly produced v4 ciphertext has already
 * succeeded in memory" — the v3 blob is never touched until its v4
 * replacement is proven correct.
 *
 * Value blobs (root-scope leaf writes stored directly in the memory log):
 * these do NOT get mutated in place. `.me`'s memory log is hash-chained
 * (axiom A8, `tests/axioms.test.ts`) — rewriting a historical memory's
 * `value` field after the fact would silently break that chain's
 * integrity. Instead, migrating a value blob means decrypting it under v3
 * and re-asserting the same plaintext through the normal write path
 * (`commitValueMapping`), which appends a NEW, properly hash-chained memory
 * entry and — because the identity is unlocked — that new write is
 * automatically encrypted under v4. The original v3-encrypted historical
 * entry is left exactly as it was (this is correct, not a residual bug: an
 * append-only log's history is supposed to stay untouched). The *current*
 * value (what `self.index`/reads return) becomes v4 from that point on.
 *
 * Both migrations only touch scopes/values whose secret is currently
 * available (`localSecrets`/`localNoises` loaded this session) AND whose
 * identity is unlocked. Anything else is recorded as "pending" and left
 * completely alone — never dropped, never guessed at.
 */
import {
  decryptBlobV3WithDerivedKeys,
  decryptBlobV4,
  detectBlobVersion,
  encryptBlobV4,
  isEncryptedBlob,
} from "./crypto.ts";
import { collectSecretChainV4, computeEffectiveSecret, getOrDeriveV3Keys } from "./secret-context.ts";
import {
  clearScopeChunkCache,
  ensureScopeChunks,
  getDecryptedChunk,
  setChunkBlob,
} from "./secret-storage.ts";
import { commitValueMapping } from "./core-write.ts";
import type { MEKernelLike, SemanticPath } from "./types.ts";

export interface MigrateBranchesToV4Report {
  migratedScopes: number;
  migratedChunks: number;
  pendingScopes: string[];
  skippedAlreadyV4: number;
  skippedOtherFormat: number;
  errors: number;
}

export function migrateBranchesToV4(self: MEKernelLike): MigrateBranchesToV4Report {
  const report: MigrateBranchesToV4Report = {
    migratedScopes: 0,
    migratedChunks: 0,
    pendingScopes: [],
    skippedAlreadyV4: 0,
    skippedOtherFormat: 0,
    errors: 0,
  };

  if (!self.identityRootUnwrapped) {
    // Nothing can be migrated without a root to bind the new ciphertext to.
    // Record every currently-known scope as pending rather than throwing —
    // the caller may legitimately be probing status.
    for (const scopeKey of self.branchStore.listScopes()) {
      self.migrationV4[scopeKey] = "pending";
      report.pendingScopes.push(scopeKey);
    }
    return report;
  }

  for (const scopeKey of self.branchStore.listScopes()) {
    const scope: SemanticPath = scopeKey.split(".").filter(Boolean);
    const scopeSecret = computeEffectiveSecret(self, scope);
    if (!scopeSecret) {
      self.migrationV4[scopeKey] = "pending";
      report.pendingScopes.push(scopeKey);
      continue;
    }

    let migratedInScope = 0;
    let sawError = false;
    try {
      const chunks = ensureScopeChunks(self, scope, scopeSecret);
      const chain = collectSecretChainV4(self, scope, "branch");
      for (const [chunkId, blob] of Object.entries(chunks)) {
        const version = detectBlobVersion(blob as any);
        if (version === "v4") {
          report.skippedAlreadyV4++;
          continue;
        }
        if (version !== "v3") {
          // v2/legacy branch migration is out of scope here (v3->v4 only);
          // leave it exactly as-is rather than guessing.
          report.skippedOtherFormat++;
          continue;
        }

        const data = getDecryptedChunk(self, scope, scopeSecret, chunkId);
        if (!data || typeof data !== "object") {
          report.errors++;
          sawError = true;
          continue;
        }

        const nextBlob = encryptBlobV4(data, chain, "branch", scope, self.identityRootUnwrapped);
        const verify = decryptBlobV4(nextBlob, chain, "branch", scope, self.identityRootUnwrapped);
        if (JSON.stringify(verify) !== JSON.stringify(data)) {
          // Verification failed: do NOT touch the stored v3 blob.
          report.errors++;
          sawError = true;
          continue;
        }

        setChunkBlob(self, scope, chunkId, nextBlob, scopeSecret);
        migratedInScope++;
        report.migratedChunks++;
      }
    } catch {
      report.errors++;
      sawError = true;
    } finally {
      clearScopeChunkCache(self, scopeKey);
    }

    if (migratedInScope > 0) report.migratedScopes++;
    if (!sawError && migratedInScope === 0) {
      // Everything in this scope was already v4/other-format; nothing pending.
    } else if (sawError) {
      self.migrationV4[scopeKey] = "pending";
      report.pendingScopes.push(scopeKey);
    } else {
      self.migrationV4[scopeKey] = "migrated";
    }
  }

  return report;
}

export interface MigrateValuesToV4Report {
  migrated: number;
  pending: string[];
  skippedAlreadyV4: number;
  errors: number;
}

export function migrateValuesToV4(self: MEKernelLike): MigrateValuesToV4Report {
  const report: MigrateValuesToV4Report = { migrated: 0, pending: [], skippedAlreadyV4: 0, errors: 0 };

  const candidates = Object.entries(self.index).filter(([, raw]) => isEncryptedBlob(raw));
  for (const [pathKey, raw] of candidates) {
    const version = detectBlobVersion(raw as any);
    if (version === "v4") {
      report.skippedAlreadyV4++;
      continue;
    }
    if (version !== "v3") continue; // v2/legacy value migration is out of scope here.

    if (!self.identityRootUnwrapped) {
      self.migrationV4Values[pathKey] = "pending";
      report.pending.push(pathKey);
      continue;
    }

    const pathParts: SemanticPath = pathKey.split(".").filter(Boolean);
    let plaintext: any;
    try {
      const keys = getOrDeriveV3Keys(self, pathParts, "value");
      plaintext = decryptBlobV3WithDerivedKeys(raw as any, keys);
    } catch {
      plaintext = null;
    }

    if (plaintext === null || plaintext === undefined) {
      self.migrationV4Values[pathKey] = "pending";
      report.pending.push(pathKey);
      continue;
    }

    try {
      commitValueMapping(self, pathParts, plaintext, null);
      self.migrationV4Values[pathKey] = "migrated";
      report.migrated++;
    } catch {
      report.errors++;
      self.migrationV4Values[pathKey] = "pending";
      report.pending.push(pathKey);
    }
  }

  return report;
}
