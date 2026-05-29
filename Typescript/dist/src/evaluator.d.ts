import { MEKernelLike, SemanticPath } from './types.ts';
export declare function tryResolveEvalTokenValue(self: MEKernelLike, token: string, evalScopePath: SemanticPath): {
    ok: true;
    value: any;
} | {
    ok: false;
};
export declare function tokenizeEvalExpression(raw: string): Array<{
    kind: "literal";
    value: any;
} | {
    kind: "identifier";
    value: string;
} | {
    kind: "op";
    value: string;
} | {
    kind: "lparen";
} | {
    kind: "rparen";
}> | null;
export declare function tryEvaluateAssignExpression(self: MEKernelLike, evalScopePath: SemanticPath, expr: string): {
    ok: true;
    value: number | boolean;
} | {
    ok: false;
};
