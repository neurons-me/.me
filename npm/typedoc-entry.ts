// Docs-only entrypoint.
// Keeps the public runtime bundle CJS-compatible while giving TypeDoc
// a named `ME` symbol and the public type surface.
export { ME } from "./src/me.ts";
// Curated docs surface: low-level crypto/keyspace types stay out of the
// main public reference unless they become part of the user-facing guides.
export type {
  Memory,
  MeTargetAst,
  SemanticPath,
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
