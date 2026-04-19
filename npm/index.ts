// me/npm/index.ts
// .me = local crypto runtime (it can exist with no ledger)
// Runtime entry stays default-export-first so CommonJS consumers can do:
//   const ME = require("this.me")
// without having to reach through `.default`.
//
// Patch 3 note:
// The caller-scope enforcement surface does NOT live in this barrel file.
// This file should remain a thin export boundary.
// The actual public API behavior for owner vs guest reads must be wired in
// `./src/me.ts`, where the callable ME surface is constructed.
//
// Expected public contract after Patch 3:
// - default owner reads keep working
// - guest reads can be simulated with an explicit caller scope
// - ergonomic sugar like `.as(null)` can be layered on top afterward
import { ME } from "./src/me.ts";
import { DiskStore, MemoryStore } from "./src/instance-store.ts";

const MERuntime = ME as typeof ME & {
  DiskStore: typeof DiskStore;
  MemoryStore: typeof MemoryStore;
};

MERuntime.DiskStore = DiskStore;
MERuntime.MemoryStore = MemoryStore;

export default MERuntime;
export type {
  EncryptedBranchPlane,
  EncryptedScopeEntry,
  Memory,
  MESearchExactOptions,
  MESearchExactResult,
  MESearchHit,
  MEOptions,
  MEVectorIndex,
  MEVectorIndexBuildOptions,
  MEVectorIndexBuildResult,
  MEVectorIndexMeta,
  MEVectorPostingEntry,
  MEVectorSearchOptions,
  MEVectorSearchResult,
  MeTargetAst,
  SemanticPath,
  StoredWrappedKey,
  EncryptedBlob,
  OperatorToken,
  OperatorKind,
  OperatorRegistry,
  OperatorRegistryEntry,
  MEInstance,
  MEProxy,
  OperatorCall,
  OperatorMatch,
  OperatorKernel,
  OperatorResult,
  OperatorHandler,
} from "./src/types.ts";
export type {
  DiskStoreOptions,
  InstanceStore,
} from "./src/instance-store.ts";

/*
▄ ▄▄▄▄  ▗▞▀▚▖
  █ █ █ ▐▛▀▀▘
  █   █ ▝▚▄▄▖
             ",
        "
   ┓   ┏┓
┓┏┏┣┓┏┓┏┛
┗┻┛┛┗┗┛•
*/
