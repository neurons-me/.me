import type { MESearchHit } from "./types.js";

export function dotProduct(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let out = 0;
  for (let i = 0; i < length; i++) out += a[i] * b[i];
  return out;
}

export function l2Norm(a: Float32Array): number {
  let out = 0;
  for (let i = 0; i < a.length; i++) out += a[i] * a[i];
  return Math.sqrt(out);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function cosineSimilarityAt(
  query: Float32Array,
  haystack: Float32Array,
  offset: number,
  dims: number,
  queryNorm = l2Norm(query),
): number {
  let dot = 0;
  let candidateNormSq = 0;
  for (let i = 0; i < dims; i++) {
    const q = query[i];
    const v = haystack[offset + i];
    dot += q * v;
    candidateNormSq += v * v;
  }
  if (queryNorm <= 0 || candidateNormSq <= 0) return 0;
  return dot / (queryNorm * Math.sqrt(candidateNormSq));
}

export function l2Normalize(v: Float32Array): Float32Array {
  const norm = l2Norm(v);
  if (norm <= 0) return Float32Array.from(v);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

export function pushTopK(
  hits: MESearchHit[],
  hit: MESearchHit,
  k: number,
): void {
  if (k <= 0) return;
  let insertAt = hits.length;
  while (insertAt > 0 && compareHits(hit, hits[insertAt - 1]) < 0) {
    insertAt--;
  }
  if (insertAt >= k) return;
  hits.splice(insertAt, 0, hit);
  if (hits.length > k) hits.length = k;
}

function compareHits(a: MESearchHit, b: MESearchHit): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.index !== b.index) return a.index - b.index;
  return a.path.localeCompare(b.path);
}
