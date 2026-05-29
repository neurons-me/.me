import { MeTargetAst, MEKernelLike } from './types.js';
export declare function setRecomputeMode(self: MEKernelLike, mode: "eager" | "lazy"): MEKernelLike;
export declare function getRecomputeMode(self: MEKernelLike): "eager" | "lazy";
export declare function handleKernelTarget(self: MEKernelLike, operation: string, rawPath: string, body?: any): any;
export declare function handleKernelRead(self: MEKernelLike, key: string): any;
export declare function handleKernelExport(self: MEKernelLike, key: string): any;
export declare function handleKernelImport(self: MEKernelLike, key: string, body: any): any;
export declare function handleKernelHydrate(self: MEKernelLike, key: string, body: any): any;
export declare function handleKernelReplay(self: MEKernelLike, key: string, body: any): any;
export declare function handleKernelRehydrate(self: MEKernelLike, key: string, body: any): any;
export declare function handleKernelGet(self: MEKernelLike, key: string): any;
export declare function handleKernelSet(self: MEKernelLike, key: string, body: any): any;
export declare function normalizeExecutableTarget(self: MEKernelLike, rawTarget: string | MeTargetAst): MeTargetAst;
export declare function parseExecutableTarget(rawTarget: string): MeTargetAst;
export declare function splitTargetNamespace(namespaceWithContext: string, rawTarget: string): {
    namespace: string;
    contextRaw: string | null;
};
export declare function normalizeExecutablePath(rawPath: string): {
    key: string;
    parts: string[];
};
