import { MEKernelLike, SemanticPath } from './types.js';
export declare function hashFn(input: string): string;
export declare function cloneValue<T>(value: T): T;
export declare function findTopLevelIndex(input: string, needle: string): number;
export declare function normalizeSelectorPath(path: SemanticPath): SemanticPath;
export declare function pathContainsIterator(path: SemanticPath): boolean;
export declare function substituteIteratorInPath(path: SemanticPath, indexValue: string): SemanticPath;
export declare function substituteIteratorInExpression(expr: string, indexValue: string): string;
export declare function parseFilterExpression(expr: string): {
    left: string;
    op: ">" | "<" | ">=" | "<=" | "==" | "!=";
    right: string;
} | null;
export declare function parseLogicalFilterExpression(expr: string): {
    clauses: Array<{
        left: string;
        op: ">" | "<" | ">=" | "<=" | "==" | "!=";
        right: string;
    }>;
    ops: Array<"&&" | "||">;
} | null;
export declare function compareValues(left: any, op: ">" | "<" | ">=" | "<=" | "==" | "!=", right: any): boolean;
export declare function parseLiteralOrPath(raw: string): {
    kind: "literal";
    value: any;
} | {
    kind: "path";
    parts: SemanticPath;
};
export declare function parseSelectorSegment(segment: string): {
    base: string;
    selector: string;
} | null;
export declare function parseSelectorKeys(selector: string): string[] | null;
export declare function parseTransformSelector(selector: string): {
    varName: string;
    expr: string;
} | null;
export declare function createDefaultOperators(): Record<string, {
    kind: string;
}>;
export declare function getPrevMemoryHash(self: MEKernelLike): string;
export declare function now(): number;
