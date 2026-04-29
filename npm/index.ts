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
import { normalizeProofMessage, verifyEd25519Signature } from "./src/crypto.ts";
import { DiskStore, MemoryStore } from "./src/instance-store.ts";
import { createMe, write, define, subscribe } from "./src/kernel/cascade.ts";
import { createThisMe } from "./src/factory.ts";
import {
  canonicalizeLegacyAtOperator,
  canonicalizeHumanIdentity,
  formatCanonicalMeUri,
  normalizeCanonicalHandle,
  normalizeCanonicalSpace,
  parseCanonicalMeUri,
  parseMeUri,
  projectDnsHostToNamespace,
  tryParseMeUri,
} from "./src/me-uri.ts";
import type { MEOptions } from "./src/types.ts";
import type { ThisMeInput } from "./src/factory.ts";

function ThisMe(input?: Parameters<typeof createThisMe>[0], options?: Parameters<typeof createThisMe>[1]) {
  return createThisMe(input, options);
}

Object.setPrototypeOf(ThisMe, ME);
ThisMe.prototype = ME.prototype;

export type ThisMeFactory = typeof ME & {
  (input?: ThisMeInput, options?: MEOptions): ME;
  ME: typeof ME;
  createThisMe: typeof createThisMe;
  parseMeUri: typeof parseMeUri;
  tryParseMeUri: typeof tryParseMeUri;
  parseCanonicalMeUri: typeof parseCanonicalMeUri;
  formatCanonicalMeUri: typeof formatCanonicalMeUri;
  canonicalizeLegacyAtOperator: typeof canonicalizeLegacyAtOperator;
  canonicalizeHumanIdentity: typeof canonicalizeHumanIdentity;
  projectDnsHostToNamespace: typeof projectDnsHostToNamespace;
  normalizeCanonicalHandle: typeof normalizeCanonicalHandle;
  normalizeCanonicalSpace: typeof normalizeCanonicalSpace;
  DiskStore: typeof DiskStore;
  MemoryStore: typeof MemoryStore;
  createMe: typeof createMe;
  write: typeof write;
  define: typeof define;
  subscribe: typeof subscribe;
  normalizeProofMessage: typeof normalizeProofMessage;
  verifyEd25519Signature: typeof verifyEd25519Signature;
};

const MERuntime: ThisMeFactory = ThisMe as unknown as ThisMeFactory;

MERuntime.ME = ME;
MERuntime.createThisMe = createThisMe;
MERuntime.parseMeUri = parseMeUri;
MERuntime.tryParseMeUri = tryParseMeUri;
MERuntime.parseCanonicalMeUri = parseCanonicalMeUri;
MERuntime.formatCanonicalMeUri = formatCanonicalMeUri;
MERuntime.canonicalizeLegacyAtOperator = canonicalizeLegacyAtOperator;
MERuntime.canonicalizeHumanIdentity = canonicalizeHumanIdentity;
MERuntime.projectDnsHostToNamespace = projectDnsHostToNamespace;
MERuntime.normalizeCanonicalHandle = normalizeCanonicalHandle;
MERuntime.normalizeCanonicalSpace = normalizeCanonicalSpace;
MERuntime.DiskStore = DiskStore;
MERuntime.MemoryStore = MemoryStore;
MERuntime.createMe = createMe;
MERuntime.write = write;
MERuntime.define = define;
MERuntime.subscribe = subscribe;
MERuntime.normalizeProofMessage = normalizeProofMessage;
MERuntime.verifyEd25519Signature = verifyEd25519Signature;

export default MERuntime;
export {
  ME,
  canonicalizeLegacyAtOperator,
  canonicalizeHumanIdentity,
  createThisMe,
  formatCanonicalMeUri,
  normalizeCanonicalHandle,
  normalizeCanonicalSpace,
  normalizeProofMessage,
  parseCanonicalMeUri,
  parseMeUri,
  projectDnsHostToNamespace,
  tryParseMeUri,
  verifyEd25519Signature,
};
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
export type { ThisMeInit, ThisMeInput } from "./src/factory.ts";
export type { MeDB } from "./src/kernel/cascade.ts";
export type {
  CanonicalizeLegacyAtOperatorOptions,
  CanonicalizeHumanIdentityOptions,
  FormatCanonicalMeUriInput,
  MeCanonicalNamespace,
  MeCanonicalPath,
  MeCanonicalSelector,
  MeCanonicalSelectorKind,
  MeCanonicalUri,
  MeDnsProjectionFailureReason,
  MeDnsProjectionResult,
  MeHumanIdentity,
  ParseCanonicalMeUriOptions,
} from "./src/me-uri.ts";
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
