import { MEKernelLike, SemanticPath } from './types.js';
export declare function collectIteratorIndices(self: MEKernelLike, path: SemanticPath): string[];
export declare function resolveRelativeFirst(self: MEKernelLike, scope: SemanticPath, parts: SemanticPath): any;
export declare function evaluateFilterClauseForScope(self: MEKernelLike, scope: SemanticPath, clause: {
    left: string;
    op: ">" | "<" | ">=" | "<=" | "==" | "!=";
    right: string;
}): boolean;
export declare function evaluateLogicalFilterForScope(self: MEKernelLike, scope: SemanticPath, expr: string): boolean;
export declare function collectChildrenForPrefix(self: MEKernelLike, prefix: SemanticPath): string[];
export declare function evaluateTransformPath(self: MEKernelLike, path: SemanticPath): any;
export declare function evaluateSelectionPath(self: MEKernelLike, path: SemanticPath): any;
export declare function buildPublicSubtree(self: MEKernelLike, prefix: SemanticPath): any;
export declare function evaluateFilterPath(self: MEKernelLike, path: SemanticPath): any;
export declare function pathContainsFilterSelector(self: MEKernelLike, path: SemanticPath): boolean;
export declare function collectFilteredScopes(self: MEKernelLike, path: SemanticPath): SemanticPath[];
