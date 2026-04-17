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
  listEncryptedScopes,
  deleteEncryptedScope,
  getChunkBlob,
  setChunkBlob,
  primeDecryptedBranchCache,
  getDecryptedChunk,
} from "./secret-storage.js";
