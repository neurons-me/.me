type NodeId = string;
type Listener = (val: any) => void;

interface DepGraph {
  [key: NodeId]: NodeId[];
}

export interface MeDB {
  data: Map<NodeId, any>;
  deps: DepGraph;
  dependents: DepGraph;
  listeners: Map<NodeId, Set<Listener>>;
  dirty: Set<NodeId>;
  scheduled: boolean;
}

function listFor(graph: DepGraph, key: NodeId): NodeId[] {
  return graph[key] || [];
}

function addUnique(graph: DepGraph, key: NodeId, value: NodeId): void {
  const list = graph[key] || (graph[key] = []);
  if (!list.includes(value)) list.push(value);
}

function removeValue(graph: DepGraph, key: NodeId, value: NodeId): void {
  const list = graph[key];
  if (!list) return;
  graph[key] = list.filter((entry) => entry !== value);
  if (graph[key].length === 0) delete graph[key];
}

export function createMe(): MeDB {
  return {
    data: new Map(),
    deps: {},
    dependents: {},
    listeners: new Map(),
    dirty: new Set(),
    scheduled: false,
  };
}

export function write(db: MeDB, key: NodeId, val: any): void {
  const prev = db.data.get(key);
  if (prev === val) return;

  db.data.set(key, val);
  markDirty(db, key);
}

function markDirty(db: MeDB, key: NodeId): void {
  if (db.dirty.has(key)) return;
  db.dirty.add(key);

  const dependents = listFor(db.dependents, key);
  for (let i = 0; i < dependents.length; i++) {
    markDirty(db, dependents[i]);
  }

  scheduleFlush(db);
}

function scheduleFlush(db: MeDB): void {
  if (db.scheduled) return;
  db.scheduled = true;
  queueMicrotask(() => flush(db));
}

function flush(db: MeDB): void {
  db.scheduled = false;
  if (db.dirty.size === 0) return;

  const sorted = topoSort(db.dirty, db.deps);

  for (let i = 0; i < sorted.length; i++) {
    const key = sorted[i];
    const val = db.data.get(key);
    const subs = db.listeners.get(key);
    if (!subs) continue;
    for (const fn of subs) fn(val);
  }

  db.dirty.clear();
}

function topoSort(dirty: Set<NodeId>, deps: DepGraph): NodeId[] {
  const result: NodeId[] = [];
  const visited = new Set<NodeId>();
  const visiting = new Set<NodeId>();

  function visit(node: NodeId): void {
    if (visited.has(node)) return;
    if (visiting.has(node)) return;
    visiting.add(node);

    const nodeDeps = listFor(deps, node);
    for (let i = 0; i < nodeDeps.length; i++) {
      if (dirty.has(nodeDeps[i])) visit(nodeDeps[i]);
    }

    visiting.delete(node);
    visited.add(node);
    result.push(node);
  }

  for (const node of dirty) visit(node);
  return result;
}

export function define(db: MeDB, key: NodeId, depKeys: NodeId[]): void {
  const nextDeps = Array.from(new Set(depKeys));
  const prevDeps = listFor(db.deps, key);

  for (let i = 0; i < prevDeps.length; i++) {
    removeValue(db.dependents, prevDeps[i], key);
  }

  db.deps[key] = nextDeps;

  for (let i = 0; i < nextDeps.length; i++) {
    addUnique(db.dependents, nextDeps[i], key);
  }
}

export function subscribe(db: MeDB, key: NodeId, fn: Listener): () => void {
  if (!db.listeners.has(key)) db.listeners.set(key, new Set());
  const listeners = db.listeners.get(key)!;
  listeners.add(fn);

  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) db.listeners.delete(key);
  };
}
