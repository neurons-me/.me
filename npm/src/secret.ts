export {
  bumpSecretEpoch,
  computeEffectiveSecret,
  resolveBranchScope,
} from "./secret-context.js";
export {
  chunkCacheKey,
  clearScopeChunkCache,
  getChunkId,
  setAtPath,
  flattenLeaves,
  migrateLegacyScopeToChunks,
  ensureScopeChunks,
  getChunkBlob,
  setChunkBlob,
  getDecryptedChunk,
} from "./secret-storage.js";
