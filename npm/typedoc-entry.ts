// Docs-only entrypoint.
// Keeps the public runtime bundle CJS-compatible while giving TypeDoc
// a named `ME` symbol and the public type surface.
export { ME } from "./src/me.ts";
export type {
  Memory,
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
