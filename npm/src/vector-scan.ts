import { isColumnarChunkData } from "./secret-storage.js";
import { cosineSimilarity, cosineSimilarityAt, l2Norm, pushTopK } from "./vector-math.js";
import type {
  MEKernelLike,
  MESearchExactOptions,
  MESearchExactResult,
  MESearchHit,
  SemanticPath,
} from "./types.js";

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function normalizeScopePath(self: MEKernelLike, input: string | SemanticPath): SemanticPath {
  const path = Array.isArray(input) ? input : String(input || "").split(".").filter(Boolean);
  return self.normalizeSelectorPath(path);
}

function toFloat32Query(query: ArrayLike<number>): Float32Array {
  if (query instanceof Float32Array) return query;
  const out = new Float32Array(query.length);
  for (let i = 0; i < query.length; i++) out[i] = Number(query[i]) || 0;
  return out;
}

function coerceCandidateVector(embedding: unknown, dims: number): Float32Array | null {
  if (embedding instanceof Float32Array) {
    return embedding.length === dims ? embedding : null;
  }

  if (Array.isArray(embedding)) {
    if (embedding.length !== dims) return null;
    return Float32Array.from(embedding.map((value) => Number(value) || 0));
  }

  if (embedding && typeof embedding === "object") {
    const out = new Float32Array(dims);
    let seen = false;
    const record = embedding as Record<string, unknown>;
    for (let i = 0; i < dims; i++) {
      const value = record[String(i)];
      if (value !== undefined) seen = true;
      out[i] = Number(value) || 0;
    }
    return seen ? out : null;
  }

  return null;
}

function sortChunkIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => chunkBaseIndex(a) - chunkBaseIndex(b) || a.localeCompare(b));
}

function chunkBaseIndex(chunkId: string): number {
  const rootIndexed = /^idx_(\d+)$/.exec(chunkId);
  if (rootIndexed) return Number(rootIndexed[1]);
  const legacyRoot = /^(\d+)_root$/.exec(chunkId);
  if (legacyRoot) return Number(legacyRoot[1]);
  return Number.MAX_SAFE_INTEGER;
}

function deriveHitPath(
  scope: SemanticPath,
  chunkId: string,
  localIndex: number,
  id: number,
  chunkSize: number,
): { path: string; index: number } {
  const rootIndexed = /^idx_(\d+)$/.exec(chunkId);
  if (rootIndexed) {
    const index = Number(rootIndexed[1]) * chunkSize + localIndex;
    return {
      path: [...scope, String(index)].join("."),
      index,
    };
  }

  const legacyRoot = /^(\d+)_root$/.exec(chunkId);
  if (legacyRoot) {
    const index = Number(legacyRoot[1]);
    return {
      path: [...scope, String(index)].join("."),
      index,
    };
  }

  return {
    path: [...scope, String(id)].join("."),
    index: id,
  };
}

export function searchExact(
  self: MEKernelLike,
  scopePath: string | SemanticPath,
  query: ArrayLike<number>,
  options: MESearchExactOptions = {},
): MESearchExactResult {
  const startedAt = nowMs();
  const scope = normalizeScopePath(self, scopePath);
  const resolvedScope = self.resolveBranchScope(scope);
  if (!resolvedScope || resolvedScope.length === 0 || resolvedScope.join(".") !== scope.join(".")) {
    throw new Error(
      `searchExact requires a collection-scoped secret branch. Expected a secret declared exactly at "${scope.join(".")}".`,
    );
  }

  const scopeSecret = self.computeEffectiveSecret(scope);
  if (!scopeSecret) {
    throw new Error(`searchExact could not resolve an effective secret for "${scope.join(".")}".`);
  }

  const k = Math.max(1, Math.floor(options.k ?? 10));
  const minScore = Number.isFinite(options.minScore as number) ? Number(options.minScore) : -Infinity;
  const queryVector = toFloat32Query(query);
  const queryNorm = l2Norm(queryVector);
  const chunkIds = sortChunkIds(self.branchStore.listChunks(scope.join(".")));
  const hits: MESearchHit[] = [];

  let dims = 0;
  let scannedChunks = 0;
  let scannedVectors = 0;

  for (const chunkId of chunkIds) {
    const decrypted = self.getDecryptedChunk(scope, scopeSecret, chunkId);
    if (!decrypted) continue;
    scannedChunks++;

    if (isColumnarChunkData(decrypted)) {
      const payload = decrypted.payload;
      const embeddings = payload.embeddings;
      if (!(embeddings instanceof Float32Array)) continue;
      if (payload.meta.dims <= 0 || payload.meta.count <= 0) continue;
      if (queryVector.length !== payload.meta.dims) {
        throw new Error(
          `searchExact dims mismatch for "${scope.join(".")}": query=${queryVector.length}, payload=${payload.meta.dims}`,
        );
      }
      dims = payload.meta.dims;

      for (let i = 0; i < payload.meta.count; i++) {
        const offset = i * payload.meta.dims;
        const score = cosineSimilarityAt(queryVector, embeddings, offset, payload.meta.dims, queryNorm);
        scannedVectors++;
        if (score < minScore) continue;
        const id = payload.ids?.[i] ?? i;
        const { path, index } = deriveHitPath(scope, chunkId, i, id, self.secretChunkSize);
        pushTopK(hits, {
          path,
          score,
          index,
          id,
          chunkId,
          chunkOffset: i,
        }, k);
      }
      continue;
    }

    if (!Array.isArray(decrypted)) continue;
    for (let i = 0; i < decrypted.length; i++) {
      const item = decrypted[i];
      if (!item || typeof item !== "object") continue;
      const embedding = (item as Record<string, unknown>).embedding;
      const candidate = coerceCandidateVector(embedding, queryVector.length);
      if (!candidate) continue;
      const score = cosineSimilarity(queryVector, candidate);
      scannedVectors++;
      if (score < minScore) continue;
      const idRaw = (item as Record<string, unknown>).id;
      const id = typeof idRaw === "number" && Number.isFinite(idRaw) ? Math.floor(idRaw) : i;
      const { path, index } = deriveHitPath(scope, chunkId, i, id, self.secretChunkSize);
      pushTopK(hits, {
        path,
        score,
        index,
        id,
        chunkId,
        chunkOffset: i,
      }, k);
    }
  }

  return {
    scopePath: scope.join("."),
    tookMs: nowMs() - startedAt,
    scannedChunks,
    scannedVectors,
    dims,
    hits,
  };
}
