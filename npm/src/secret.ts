export {
  bumpSecretEpoch,
  computeEffectiveSecret,
  resolveBranchScope,
} from "./secret-context.js";
export {
  createBranchContainerForRel,
  chunkCacheKey,
  clearScopeChunkCache,
  getChunkId,
  getChunkRelativePath,
  getLegacyChunkIdForPath,
  readDecryptedChunkItem,
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
