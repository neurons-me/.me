import { MappingIntent, NormalizedCall, OperatorRegistry } from './types.ts';
export interface NormalizeCallDeps {
    /**
     * Optional evaluator for legacy JS closures in "=" thunk mode.
     * If omitted, closure-based derivations are rejected for invariance.
     */
    evaluateThunk?: (fn: Function) => any;
    /**
     * Optional resolver for "?" query source paths.
     * Needed only if query normalization should produce concrete output values.
     */
    readPath?: (path: string[]) => any;
}
/**
 * Normalize a proxy invocation into pure mapping instructions.
 * This function is side-effect free: it does not mutate kernel state.
 */
export declare function normalizeCall(operators: OperatorRegistry, intent: MappingIntent, deps?: NormalizeCallDeps): NormalizedCall;
