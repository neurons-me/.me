import { isColumnarChunkData } from "./secret-storage.js";
import { cosineSimilarity, cosineSimilarityAt, l2Norm, l2Normalize, pushTopK } from "./vector-math.js";
import { cacheVectorIndex, loadVectorIndex, persistVectorIndex } from "./vector-index-store.js";
import type {
  MEKernelLike,
  MEVectorIndex,
  MEVectorIndexBuildOptions,
  MEVectorIndexBuildResult,
  MEVectorPostingEntry,
  MEVectorSearchOptions,
  MEVectorSearchResult,
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

function validateCollectionScopedSecret(self: MEKernelLike, scopePath: string | SemanticPath): { scope: SemanticPath; scopeSecret: string } {
  const scope = normalizeScopePath(self, scopePath);
  const resolvedScope = self.resolveBranchScope(scope);
  if (!resolvedScope || resolvedScope.length === 0 || resolvedScope.join(".") !== scope.join(".")) {
    throw new Error(
      `Vector search requires a collection-scoped secret branch. Expected a secret declared exactly at "${scope.join(".")}".`,
    );
  }

  const scopeSecret = self.computeEffectiveSecret(scope);
  if (!scopeSecret) {
    throw new Error(`Vector search could not resolve an effective secret for "${scope.join(".")}".`);
  }

  return { scope, scopeSecret };
}

function copyVector(value: Float32Array, normalize: boolean): Float32Array {
  return normalize ? l2Normalize(value) : Float32Array.from(value);
}

function scoreAgainstCentroid(
  vector: Float32Array,
  centroids: Float32Array,
  centroidIndex: number,
  dims: number,
  normalized: boolean,
): number {
  const offset = centroidIndex * dims;
  if (normalized) {
    let dot = 0;
    for (let i = 0; i < dims; i++) dot += vector[i] * centroids[offset + i];
    return dot;
  }

  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < dims; i++) {
    const a = vector[i];
    const b = centroids[offset + i];
    dot += a * b;
    na += a * a;
    nb += b * b;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function assignNearestCentroid(
  vector: Float32Array,
  centroids: Float32Array,
  k: number,
  dims: number,
  normalized: boolean,
): number {
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < k; i++) {
    const score = scoreAgainstCentroid(vector, centroids, i, dims, normalized);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function setCentroid(centroids: Float32Array, centroidIndex: number, vector: Float32Array, dims: number): void {
  const offset = centroidIndex * dims;
  for (let i = 0; i < dims; i++) centroids[offset + i] = vector[i];
}

function writeAverageCentroid(
  centroids: Float32Array,
  centroidIndex: number,
  sums: Float32Array,
  count: number,
  dims: number,
  normalize: boolean,
): void {
  const offset = centroidIndex * dims;
  if (count <= 0) return;
  const avg = new Float32Array(dims);
  for (let i = 0; i < dims; i++) avg[i] = sums[i] / count;
  const next = normalize ? l2Normalize(avg) : avg;
  for (let i = 0; i < dims; i++) centroids[offset + i] = next[i];
}

function initializeCentroids(sample: Float32Array[], k: number, dims: number, normalize: boolean): Float32Array {
  const centroids = new Float32Array(k * dims);
  setCentroid(centroids, 0, sample[0], dims);

  for (let c = 1; c < k; c++) {
    let farthestIndex = 0;
    let farthestDistance = -Infinity;
    for (let i = 0; i < sample.length; i++) {
      const vector = sample[i];
      let bestScore = -Infinity;
      for (let existing = 0; existing < c; existing++) {
        bestScore = Math.max(bestScore, scoreAgainstCentroid(vector, centroids, existing, dims, normalize));
      }
      const distance = 1 - bestScore;
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = i;
      }
    }
    setCentroid(centroids, c, sample[farthestIndex], dims);
  }

  return centroids;
}

function runKMeans(sample: Float32Array[], k: number, dims: number, iterations: number, normalize: boolean): Float32Array {
  const centroids = initializeCentroids(sample, k, dims, normalize);

  for (let iteration = 0; iteration < iterations; iteration++) {
    const sums = Array.from({ length: k }, () => new Float32Array(dims));
    const counts = new Uint32Array(k);

    for (const vector of sample) {
      const centroidId = assignNearestCentroid(vector, centroids, k, dims, normalize);
      counts[centroidId] += 1;
      const sum = sums[centroidId];
      for (let i = 0; i < dims; i++) sum[i] += vector[i];
    }

    for (let centroidId = 0; centroidId < k; centroidId++) {
      if (counts[centroidId] <= 0) continue;
      writeAverageCentroid(centroids, centroidId, sums[centroidId], counts[centroidId], dims, normalize);
    }
  }

  return centroids;
}

type ChunkRepresentative = {
  vector: Float32Array;
  weight: number;
};

type ChunkRepresentativeSummary = {
  chunkId: string;
  vectorCount: number;
  representatives: ChunkRepresentative[];
};

function pickRepresentativeIndices(count: number, limit: number): number[] {
  if (count <= 0 || limit <= 0) return [];
  if (limit >= count) return Array.from({ length: count }, (_, index) => index);

  const selected = new Set<number>();
  for (let slot = 0; slot < limit; slot++) {
    const index = Math.min(count - 1, Math.floor(((slot + 0.5) * count) / limit));
    selected.add(index);
  }

  if (selected.size >= limit) return [...selected].sort((a, b) => a - b);
  for (let index = 0; index < count && selected.size < limit; index++) {
    selected.add(index);
  }
  return [...selected].sort((a, b) => a - b);
}

function representativeWeight(vectorCount: number, representativeCount: number): number {
  if (vectorCount <= 0 || representativeCount <= 0) return 1;
  return Math.max(1, Math.round(vectorCount / representativeCount));
}

function collectChunkRepresentatives(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkIds: string[],
  normalize: boolean,
  maxRepresentativesPerChunk: number,
): { chunks: ChunkRepresentativeSummary[]; dims: number; totalVectors: number } {
  const chunks: ChunkRepresentativeSummary[] = [];
  let dims = 0;
  let totalVectors = 0;

  for (const chunkId of chunkIds) {
    const decrypted = self.getDecryptedChunk(scope, scopeSecret, chunkId);
    if (!decrypted) continue;

    if (isColumnarChunkData(decrypted)) {
      const payload = decrypted.payload;
      const embeddings = payload.embeddings;
      const chunkDims = payload.meta.dims;
      const count = payload.meta.count;
      if (!(embeddings instanceof Float32Array) || chunkDims <= 0 || count <= 0) continue;

      if (dims === 0) dims = chunkDims;
      if (chunkDims !== dims) continue;

      totalVectors += count;
      const indices = pickRepresentativeIndices(count, maxRepresentativesPerChunk);
      const weight = representativeWeight(count, indices.length);
      const representatives = indices.map((index) => {
        const start = index * chunkDims;
        const end = start + chunkDims;
        return {
          vector: copyVector(embeddings.subarray(start, end), normalize),
          weight,
        };
      });

      if (representatives.length > 0) {
        chunks.push({
          chunkId,
          vectorCount: count,
          representatives,
        });
      }
      continue;
    }

    if (!Array.isArray(decrypted)) continue;
    const vectors: Float32Array[] = [];
    for (let i = 0; i < decrypted.length; i++) {
      const item = decrypted[i];
      if (!item || typeof item !== "object") continue;
      const candidate = coerceCandidateVector((item as Record<string, unknown>).embedding, dims || Number.MAX_SAFE_INTEGER);
      if (!candidate) continue;
      if (dims === 0) dims = candidate.length;
      if (candidate.length !== dims) continue;
      vectors.push(copyVector(candidate, normalize));
    }

    if (vectors.length <= 0) continue;
    totalVectors += vectors.length;
    const indices = pickRepresentativeIndices(vectors.length, maxRepresentativesPerChunk);
    const weight = representativeWeight(vectors.length, indices.length);
    const representatives = indices.map((index) => ({
      vector: vectors[index],
      weight,
    }));
    chunks.push({
      chunkId,
      vectorCount: vectors.length,
      representatives,
    });
  }

  return { chunks, dims, totalVectors };
}

function buildTopCentroidList(
  query: Float32Array,
  centroids: Float32Array,
  k: number,
  dims: number,
  normalized: boolean,
  nprobe: number,
): Array<{ centroidId: number; score: number }> {
  const out: Array<{ centroidId: number; score: number }> = [];
  for (let centroidId = 0; centroidId < k; centroidId++) {
    const score = scoreAgainstCentroid(query, centroids, centroidId, dims, normalized);
    out.push({ centroidId, score });
  }
  out.sort((a, b) => b.score - a.score || a.centroidId - b.centroidId);
  return out.slice(0, nprobe);
}

function forEachChunkVector(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  chunkIds: string[],
  visit: (info: {
    chunkId: string;
    localIndex: number;
    id: number;
    vector: Float32Array;
  }) => void,
): { scannedChunks: number; scannedVectors: number; dims: number } {
  let scannedChunks = 0;
  let scannedVectors = 0;
  let dims = 0;

  for (const chunkId of chunkIds) {
    const decrypted = self.getDecryptedChunk(scope, scopeSecret, chunkId);
    if (!decrypted) continue;
    scannedChunks++;

    if (isColumnarChunkData(decrypted)) {
      const payload = decrypted.payload;
      const embeddings = payload.embeddings;
      if (!(embeddings instanceof Float32Array) || payload.meta.dims <= 0 || payload.meta.count <= 0) continue;
      dims = Math.max(dims, payload.meta.dims);

      for (let i = 0; i < payload.meta.count; i++) {
        const start = i * payload.meta.dims;
        const end = start + payload.meta.dims;
        visit({
          chunkId,
          localIndex: i,
          id: payload.ids?.[i] ?? i,
          vector: embeddings.subarray(start, end),
        });
        scannedVectors++;
      }
      continue;
    }

    if (!Array.isArray(decrypted)) continue;
    for (let i = 0; i < decrypted.length; i++) {
      const item = decrypted[i];
      if (!item || typeof item !== "object") continue;
      const candidate = coerceCandidateVector((item as Record<string, unknown>).embedding, dims || Number.MAX_SAFE_INTEGER);
      if (!candidate) continue;
      dims = Math.max(dims, candidate.length);
      const idRaw = (item as Record<string, unknown>).id;
      const id = typeof idRaw === "number" && Number.isFinite(idRaw) ? Math.floor(idRaw) : i;
      visit({ chunkId, localIndex: i, id, vector: candidate });
      scannedVectors++;
    }
  }

  return { scannedChunks, scannedVectors, dims };
}

function scanCandidateChunks(
  self: MEKernelLike,
  scope: SemanticPath,
  scopeSecret: string,
  queryVector: Float32Array,
  chunkIds: string[],
  options: { k: number; minScore: number },
): { dims: number; scannedVectors: number; decryptedChunks: number; hits: MESearchHit[] } {
  const hits: MESearchHit[] = [];
  const queryNorm = l2Norm(queryVector);
  let dims = 0;
  let decryptedChunks = 0;
  let scannedVectors = 0;

  for (const chunkId of chunkIds) {
    const decrypted = self.getDecryptedChunk(scope, scopeSecret, chunkId);
    if (!decrypted) continue;
    decryptedChunks++;

    if (isColumnarChunkData(decrypted)) {
      const payload = decrypted.payload;
      const embeddings = payload.embeddings;
      if (!(embeddings instanceof Float32Array)) continue;
      if (payload.meta.dims <= 0 || payload.meta.count <= 0) continue;
      if (queryVector.length !== payload.meta.dims) {
        throw new Error(
          `searchVector dims mismatch for "${scope.join(".")}": query=${queryVector.length}, payload=${payload.meta.dims}`,
        );
      }
      dims = payload.meta.dims;

      for (let i = 0; i < payload.meta.count; i++) {
        const offset = i * payload.meta.dims;
        const score = cosineSimilarityAt(queryVector, embeddings, offset, payload.meta.dims, queryNorm);
        scannedVectors++;
        if (score < options.minScore) continue;
        const id = payload.ids?.[i] ?? i;
        const { path, index } = deriveHitPath(scope, chunkId, i, id, self.secretChunkSize);
        pushTopK(hits, {
          path,
          score,
          index,
          id,
          chunkId,
          chunkOffset: i,
        }, options.k);
      }
      continue;
    }

    if (!Array.isArray(decrypted)) continue;
    for (let i = 0; i < decrypted.length; i++) {
      const item = decrypted[i];
      if (!item || typeof item !== "object") continue;
      const candidate = coerceCandidateVector((item as Record<string, unknown>).embedding, queryVector.length);
      if (!candidate) continue;
      const score = cosineSimilarity(queryVector, candidate);
      scannedVectors++;
      if (score < options.minScore) continue;
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
      }, options.k);
    }
  }

  return {
    dims,
    scannedVectors,
    decryptedChunks,
    hits,
  };
}

export function buildVectorIndex(
  self: MEKernelLike,
  scopePath: string | SemanticPath,
  options: MEVectorIndexBuildOptions = {},
): MEVectorIndexBuildResult {
  const startedAt = nowMs();
  const { scope, scopeSecret } = validateCollectionScopedSecret(self, scopePath);
  const chunkIds = sortChunkIds(self.branchStore.listChunks(scope.join(".")));
  const maxRepresentativesPerChunk = Math.max(1, Math.floor(options.chunkRepresentativesPerChunk ?? 4));
  const maxTrainingVectors = Math.max(256, Math.floor(options.maxTrainingVectors ?? 4096));
  const normalize = options.normalize !== false;
  const collected = collectChunkRepresentatives(
    self,
    scope,
    scopeSecret,
    chunkIds,
    normalize,
    maxRepresentativesPerChunk,
  );
  const dims = collected.dims;
  const totalVectors = collected.totalVectors;
  const representativeVectors = collected.chunks.flatMap((chunk) => chunk.representatives.map((entry) => entry.vector));
  const sampleStride = Math.max(1, Math.floor(representativeVectors.length / maxTrainingVectors));
  const sample: Float32Array[] = [];
  for (let i = 0; i < representativeVectors.length && sample.length < maxTrainingVectors; i += sampleStride) {
    sample.push(representativeVectors[i]);
  }

  if (dims <= 0 || totalVectors <= 0 || sample.length === 0) {
    throw new Error(`buildVectorIndex could not find any vectors under "${scope.join(".")}".`);
  }

  const k = Math.max(1, Math.min(totalVectors, Math.min(sample.length, Math.floor(options.k ?? Math.round(Math.sqrt(totalVectors))))));
  const nprobe = Math.max(1, Math.min(k, Math.floor(options.nprobe ?? 3)));
  const iterations = Math.max(1, Math.floor(options.iterations ?? 6));
  const centroids = runKMeans(sample, k, dims, iterations, normalize);

  const postingMaps = Array.from({ length: k }, () => new Map<string, number>());
  for (const chunk of collected.chunks) {
    for (const representative of chunk.representatives) {
      if (representative.vector.length !== dims) continue;
      const centroidId = assignNearestCentroid(representative.vector, centroids, k, dims, normalize);
      postingMaps[centroidId].set(
        chunk.chunkId,
        (postingMaps[centroidId].get(chunk.chunkId) ?? 0) + representative.weight,
      );
    }
  }

  const postingLists: MEVectorPostingEntry[][] = postingMaps.map((entries) =>
    [...entries.entries()]
      .map(([chunkId, count]) => ({ chunkId, count }))
      .sort((a, b) => b.count - a.count || a.chunkId.localeCompare(b.chunkId)),
  );

  const index: MEVectorIndex = {
    meta: {
      version: 1,
      scopePath: scope.join("."),
      dims,
      k,
      nprobe,
      totalVectors,
      totalChunks: chunkIds.length,
      trainingVectors: sample.length,
      normalize,
      builtAt: Date.now(),
    },
    centroids,
    postingLists,
  };

  cacheVectorIndex(self, scope, index);
  const persisted = persistVectorIndex(self, scope, index);

  return {
    scopePath: scope.join("."),
    tookMs: nowMs() - startedAt,
    dims,
    k,
    nprobe,
    totalVectors,
    totalChunks: chunkIds.length,
    trainingVectors: sample.length,
    persisted: persisted.persisted,
    indexPath: persisted.path,
  };
}

export function searchVector(
  self: MEKernelLike,
  scopePath: string | SemanticPath,
  query: ArrayLike<number>,
  options: MEVectorSearchOptions = {},
): MEVectorSearchResult {
  const startedAt = nowMs();
  const { scope, scopeSecret } = validateCollectionScopedSecret(self, scopePath);
  const index = loadVectorIndex(self, scope);
  if (!index) {
    throw new Error(`searchVector could not find an IVF sidecar for "${scope.join(".")}". Build it first with buildVectorIndex().`);
  }

  const k = Math.max(1, Math.floor(options.k ?? 10));
  const nprobe = Math.max(1, Math.min(index.meta.k, Math.floor(options.nprobe ?? index.meta.nprobe)));
  const minScore = Number.isFinite(options.minScore as number) ? Number(options.minScore) : -Infinity;
  const maxCandidateChunks = Math.max(1, Math.floor(options.maxCandidateChunks ?? Math.max(k, nprobe * 4)));
  const queryVector = toFloat32Query(query);
  if (queryVector.length !== index.meta.dims) {
    throw new Error(
      `searchVector dims mismatch for "${scope.join(".")}": query=${queryVector.length}, index=${index.meta.dims}`,
    );
  }
  const coarseQuery = index.meta.normalize ? l2Normalize(queryVector) : queryVector;

  const coarseStartedAt = nowMs();
  const bestCentroids = buildTopCentroidList(coarseQuery, index.centroids, index.meta.k, index.meta.dims, index.meta.normalize, nprobe);
  const candidateScores = new Map<string, number>();
  for (const { centroidId, score } of bestCentroids) {
    const postings = index.postingLists[centroidId] ?? [];
    for (const posting of postings) {
      candidateScores.set(posting.chunkId, (candidateScores.get(posting.chunkId) ?? 0) + score * posting.count);
    }
  }
  const candidateChunks = [...candidateScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxCandidateChunks)
    .map(([chunkId]) => chunkId);
  const coarseMs = nowMs() - coarseStartedAt;

  const exactStartedAt = nowMs();
  const scanned = scanCandidateChunks(self, scope, scopeSecret, queryVector, sortChunkIds(candidateChunks), { k, minScore });
  const exactMs = nowMs() - exactStartedAt;

  return {
    scopePath: scope.join("."),
    tookMs: nowMs() - startedAt,
    coarseMs,
    exactMs,
    dims: scanned.dims,
    k,
    nprobe,
    candidateChunks: candidateChunks.length,
    decryptedChunks: scanned.decryptedChunks,
    scannedVectors: scanned.scannedVectors,
    hits: scanned.hits,
  };
}
