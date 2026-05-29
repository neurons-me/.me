import { KernelMemory, SemanticPath } from './types.js';
export type MEProxy = any;
export interface HandleCallDeps {
    /** Create (or reuse) a proxy for a semantic path. */
    createProxy(path: SemanticPath): MEProxy;
    /** Normalize call args into an expression (0 args -> undefined, 1 -> arg, 2+ -> array). */
    normalizeArgs(args: any[]): any;
    /** Read a semantic path (used by root GET bias). */
    readPath(path: SemanticPath): any;
    /** Perform a semantic write/claim at a path. May return a memory, a value, or undefined. */
    postulate(path: SemanticPath, expression: any): any;
    /** Resolve operator kinds (used only to decide chaining path when a memory was produced). */
    opKind(op: string): string | null;
    splitPath(path: SemanticPath): {
        scope: SemanticPath;
        leaf: string | null;
    };
    isMemory(obj: any): obj is KernelMemory;
    /**
     * me("ana", "luna") — derive compound seed from (who, secret) and re-initialise kernel identity.
     * seed = keccak256("me.seed/compound:v1::" + who + "::" + secret)
     */
    reseedIdentity?(who: string, secret: string): void;
    /** me("ana") — declare identity expression without reseeding (no secret). */
    setActiveExpression?(expression: string): void;
}
/**
 * Extracted `handleCall` logic from `me.ts`.
 *
 * IMPORTANT: This module is intentionally dumb about internals.
 * It only performs:
 * - root GET bias routing
 * - invoking postulate
 * - deciding what to return for chaining
 */
export declare function handleCall(deps: HandleCallDeps, path: SemanticPath, args: any[]): MEProxy | any;
