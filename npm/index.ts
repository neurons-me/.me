// me/npm/index.ts
// .me = local crypto runtime (it can exist with no ledger)
// Runtime entry stays default-export-first so CommonJS consumers can do:
//   const ME = require("this.me")
// without having to reach through `.default`.
export { ME as default } from "./src/me.ts";
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
