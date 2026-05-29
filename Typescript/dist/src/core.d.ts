import { MeTargetAst, MEInspectResult, MEKernelLike, SemanticPath } from './types.ts';
export { commitIndexedBatch, commitMapping, commitMemoryOnly, commitValueMapping, learn, postulate, removeSubtree, replayMemories, } from './core-write.ts';
export { getRecomputeMode, handleKernelExport, handleKernelHydrate, handleKernelGet, handleKernelImport, handleKernelRead, handleKernelRehydrate, handleKernelReplay, handleKernelSet, handleKernelTarget, normalizeExecutablePath, normalizeExecutableTarget, parseExecutableTarget, setRecomputeMode, splitTargetNamespace, } from './core-dispatch.ts';
export { applyMemoryToIndex, getIndex, rebuildIndex, removeIndexPrefix, resolveIndexPointerPath, setIndex, } from './core-index.ts';
export { handleKeySpaceTarget, installRecipientKey, openWrappedKey, parseKeySpacePath, readWrappedKey, storeWrappedKey, uninstallRecipientKey, writeWrappedKey, } from './core-keyspace.ts';
export { exportSnapshot, hydrate, importSnapshot, rehydrate, } from './core-snapshot.ts';
export { buildPublicSubtree, collectChildrenForPrefix, collectFilteredScopes, collectIteratorIndices, evaluateFilterClauseForScope, evaluateFilterPath, evaluateLogicalFilterForScope, evaluateSelectionPath, evaluateTransformPath, pathContainsFilterSelector, resolveRelativeFirst, } from './core-read.ts';
export declare function inspect(self: MEKernelLike, opts?: {
    last?: number;
}): MEInspectResult;
export declare function execute(self: MEKernelLike, rawTarget: string | MeTargetAst, body?: any): any;
export declare function handleSelfTarget(self: MEKernelLike, operation: string, rawPath: string, body?: any): any;
export declare function inspectAtPath(self: MEKernelLike, scopeKey: string): MEInspectResult | {
    path: string;
    value: any;
    memories: import('./types.ts').Memory[];
    index: {
        [k: string]: any;
    };
    encryptedScopes: string[];
    secretScopes: string[];
    noiseScopes: string[];
    recomputeMode: import('./types.ts').MERecomputeMode;
    staleDerivations: number;
};
export declare function readPath(self: MEKernelLike, rawPath: SemanticPath): any;
