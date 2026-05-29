type NodeId = string;
type Listener = (val: any) => void;
interface DepGraph {
    [key: NodeId]: Set<NodeId>;
}
export interface MeDB {
    data: Map<NodeId, any>;
    deps: DepGraph;
    dependents: DepGraph;
    listeners: Map<NodeId, Set<Listener>>;
    dirty: Set<NodeId>;
    scheduled: boolean;
}
export declare function createMe(): MeDB;
export declare function write(db: MeDB, key: NodeId, val: any): void;
export declare function define(db: MeDB, key: NodeId, depKeys: NodeId[]): void;
export declare function subscribe(db: MeDB, key: NodeId, fn: Listener): () => void;
export {};
