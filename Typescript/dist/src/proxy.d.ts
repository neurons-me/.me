import { MEKernelLike, MERuntimeMethodDescriptor, MEProxy } from './types.ts';
export declare const RUNTIME_ESCAPE_TOKEN = "!";
export declare function normalizeArgs(args: any[]): any;
export declare function describeRuntimeMethod(_self: MEKernelLike, path: string, call: (...args: any[]) => unknown, docs: string, signature: string): MERuntimeMethodDescriptor;
export declare function buildRuntimeSurface(self: MEKernelLike): Record<string, any>;
export declare function describeRuntimeSurface(): Record<string, any>;
export declare function resolveRuntimeValue(self: MEKernelLike, path: string[]): unknown;
export declare function createRuntimeProxy(self: MEKernelLike, path: string[], callerScope?: string | null | undefined): any;
export declare function createProxy(self: MEKernelLike, path: string[], callerScope?: string | null | undefined): MEProxy;
