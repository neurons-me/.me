import { KernelMemory, OperatorKind, OperatorRegistry, OperatorToken, SemanticPath, MePointer, MeIdentityRef } from './types.ts';
export declare const OP_DEFINE: OperatorToken;
export declare function makePointer(path: string): MePointer;
export declare function isPointer(obj: any): obj is MePointer;
export declare function makeIdentityRef(id: string): MeIdentityRef;
export declare function isIdentityRef(obj: any): obj is MeIdentityRef;
export declare function isMemory(obj: any): obj is KernelMemory;
export declare function splitPath(path: SemanticPath): {
    scope: SemanticPath;
    leaf: string | null;
};
export declare function pathStartsWith(path: SemanticPath, prefix: SemanticPath): boolean;
/**
 * Domain-safe label rules (DNS-like):
 * - 3..63 chars total
 * - a-z, 0-9, hyphen
 * - single structural label only
 * - each handle must start/end with alphanumeric
 */
export declare function normalizeAndValidateUsername(input: string): string;
export declare function opKind(operators: OperatorRegistry, op: string): OperatorKind | null;
export declare function isDefineOpCall(path: SemanticPath, expression: any): {
    op: string;
    kind: string;
} | null;
export declare function isSecretScopeCall(operators: OperatorRegistry, path: SemanticPath, expression: any): {
    scopeKey: string;
} | null;
export declare function isNoiseScopeCall(operators: OperatorRegistry, path: SemanticPath, expression: any): {
    scopeKey: string;
} | null;
export declare function isPointerCall(operators: OperatorRegistry, path: SemanticPath, expression: any): {
    targetPath: string;
} | null;
export declare function isIdentityCall(operators: OperatorRegistry, path: SemanticPath, expression: any): {
    id: string;
    targetPath: SemanticPath;
} | null;
export type EvalCallMatch = {
    mode: "thunk";
    targetPath: SemanticPath;
    thunk: Function;
} | {
    mode: "assign";
    targetPath: SemanticPath;
    name: string;
    expr: string;
};
export declare function isEvalCall(operators: OperatorRegistry, path: SemanticPath, expression: any): EvalCallMatch | null;
export declare function isQueryCall(operators: OperatorRegistry, path: SemanticPath, expression: any): {
    targetPath: SemanticPath;
    paths: string[];
    fn?: Function;
} | null;
export declare function isRemoveCall(operators: OperatorRegistry, path: SemanticPath, expression: any): {
    targetPath: SemanticPath;
} | null;
export declare const Operators: {
    readonly OP_DEFINE: string;
    readonly opKind: typeof opKind;
    readonly splitPath: typeof splitPath;
    readonly pathStartsWith: typeof pathStartsWith;
    readonly makePointer: typeof makePointer;
    readonly isPointer: typeof isPointer;
    readonly makeIdentityRef: typeof makeIdentityRef;
    readonly isIdentityRef: typeof isIdentityRef;
    readonly isMemory: typeof isMemory;
    readonly normalizeAndValidateUsername: typeof normalizeAndValidateUsername;
    readonly isDefineOpCall: typeof isDefineOpCall;
    readonly isSecretScopeCall: typeof isSecretScopeCall;
    readonly isNoiseScopeCall: typeof isNoiseScopeCall;
    readonly isPointerCall: typeof isPointerCall;
    readonly isIdentityCall: typeof isIdentityCall;
    readonly isEvalCall: typeof isEvalCall;
    readonly isQueryCall: typeof isQueryCall;
    readonly isRemoveCall: typeof isRemoveCall;
};
