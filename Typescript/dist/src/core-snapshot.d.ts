import { MEKernelLike, MESnapshot, MESnapshotInput } from './types.ts';
export declare function exportSnapshot(self: MEKernelLike): MESnapshot;
export declare function hydrate(self: MEKernelLike, snapshot: MESnapshotInput): void;
export declare function importSnapshot(self: MEKernelLike, snapshot: MESnapshotInput): void;
export declare function rehydrate(self: MEKernelLike, snapshot: MESnapshotInput): void;
