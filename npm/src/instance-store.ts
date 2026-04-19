import type {
  EncryptedBlob,
  EncryptedBranchPlane,
  EncryptedScopeEntry,
} from "./types.js";

type NodeFsModule = typeof import("node:fs");
type NodePathModule = typeof import("node:path");

type DiskRecord =
  | { op: "scope:set"; scopeKey: string; value: EncryptedBlob }
  | { op: "scope:delete"; scopeKey: string }
  | { op: "chunk:set"; scopeKey: string; chunkId: string; blob: EncryptedBlob }
  | { op: "chunk:delete"; scopeKey: string; chunkId: string };

type BlobPointer = {
  offset: number;
  length: number;
};

type DiskScopeIndex = {
  legacy: BlobPointer | null;
  chunks: Record<string, BlobPointer>;
};

type DiskIndexSnapshot = Record<string, DiskScopeIndex>;

type DiskEntryKind = "legacy" | "chunk";

type DiskStoreMemorySnapshot = {
  heapUsed: number;
  external: number;
  arrayBuffers: number;
};

type DiskStoreDebugWindow = {
  appendCalls: number;
  readCalls: number;
  flushCalls: number;
  totalRecordStringifyMs: number;
  totalAppendMs: number;
  totalReadMs: number;
  totalFlushMs: number;
  maxRecordStringifyMs: number;
  maxAppendMs: number;
  maxReadMs: number;
  maxFlushMs: number;
  maxBlobBytes: number;
  maxRecordBytes: number;
  maxAppendResidentBytes: number;
  maxReadBufferBytes: number;
  maxReadResidentBytes: number;
  maxFlushIndexBytes: number;
  maxAppendHeapDelta: number;
  maxAppendExternalDelta: number;
  maxAppendArrayBuffersDelta: number;
  maxReadHeapDelta: number;
  maxReadExternalDelta: number;
  maxReadArrayBuffersDelta: number;
  maxFlushHeapDelta: number;
  maxFlushExternalDelta: number;
  maxFlushArrayBuffersDelta: number;
};

function createDiskStoreDebugWindow(): DiskStoreDebugWindow {
  return {
    appendCalls: 0,
    readCalls: 0,
    flushCalls: 0,
    totalRecordStringifyMs: 0,
    totalAppendMs: 0,
    totalReadMs: 0,
    totalFlushMs: 0,
    maxRecordStringifyMs: 0,
    maxAppendMs: 0,
    maxReadMs: 0,
    maxFlushMs: 0,
    maxBlobBytes: 0,
    maxRecordBytes: 0,
    maxAppendResidentBytes: 0,
    maxReadBufferBytes: 0,
    maxReadResidentBytes: 0,
    maxFlushIndexBytes: 0,
    maxAppendHeapDelta: 0,
    maxAppendExternalDelta: 0,
    maxAppendArrayBuffersDelta: 0,
    maxReadHeapDelta: 0,
    maxReadExternalDelta: 0,
    maxReadArrayBuffersDelta: 0,
    maxFlushHeapDelta: 0,
    maxFlushExternalDelta: 0,
    maxFlushArrayBuffersDelta: 0,
  };
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

const diskStoreDebugState: {
  enabled: boolean;
  window: DiskStoreDebugWindow;
} = {
  enabled: false,
  window: createDiskStoreDebugWindow(),
};

function currentDiskStoreMemory(): DiskStoreMemorySnapshot {
  const runtimeProcess = typeof process !== "undefined" ? (process as any) : null;
  const usage = runtimeProcess?.memoryUsage;
  if (typeof usage !== "function") {
    return {
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    };
  }
  const mem = usage.call(runtimeProcess);
  return {
    heapUsed: mem.heapUsed ?? 0,
    external: mem.external ?? 0,
    arrayBuffers: mem.arrayBuffers ?? 0,
  };
}

function estimateStringBytes(value: string): number {
  const text = String(value ?? "");
  if (typeof Buffer !== "undefined") {
    return Math.max(text.length * 2, Buffer.byteLength(text, "utf8"));
  }
  return text.length * 2;
}

function positiveDelta(next: number, prev: number): number {
  return Math.max(0, next - prev);
}

export function enableDiskStoreDebug(enabled = true): void {
  diskStoreDebugState.enabled = enabled;
  diskStoreDebugState.window = createDiskStoreDebugWindow();
}

export function takeDiskStoreDebugWindow(): DiskStoreDebugWindow {
  const window = { ...diskStoreDebugState.window };
  diskStoreDebugState.window = createDiskStoreDebugWindow();
  return window;
}

export interface InstanceStore {
  readonly kind: "memory" | "disk";
  getScope(scopeKey: string): EncryptedScopeEntry | undefined;
  getScopeMode(scopeKey: string): "none" | "legacy" | "chunks";
  getAuxiliaryPath(name: string): string | null;
  setScope(scopeKey: string, value: EncryptedScopeEntry): void;
  deleteScope(scopeKey: string): void;
  listScopes(): string[];
  getChunk(scopeKey: string, chunkId: string): EncryptedBlob | undefined;
  setChunk(scopeKey: string, chunkId: string, blob: EncryptedBlob): void;
  listChunks(scopeKey: string): string[];
  deleteChunk(scopeKey: string, chunkId: string): void;
  clear(): void;
  exportData(): EncryptedBranchPlane;
  importData(data: EncryptedBranchPlane): void;
  view(): EncryptedBranchPlane;
  close(): void;
}

export interface DiskStoreOptions {
  baseDir: string;
  maxHotBytes?: number;
  flushEvery?: number;
}

function getBuiltinModule<T>(specifier: string): T | undefined {
  const runtimeProcess = typeof process !== "undefined" ? (process as any) : null;
  const loader = runtimeProcess?.getBuiltinModule;
  if (typeof loader !== "function") return undefined;
  return loader(specifier) as T | undefined;
}

function cloneScopeEntry(entry: EncryptedScopeEntry): EncryptedScopeEntry {
  if (typeof entry === "string") return entry;
  return { ...entry };
}

function cloneBranchPlane(data: EncryptedBranchPlane | undefined | null): EncryptedBranchPlane {
  const out: EncryptedBranchPlane = {};
  for (const [scopeKey, value] of Object.entries(data || {})) {
    out[scopeKey] = cloneScopeEntry(value);
  }
  return out;
}

function estimateBlobBytes(blob: EncryptedBlob): number {
  return Math.max(64, blob.length * 2);
}

class BlobLruCache {
  private entries = new Map<string, { blob: EncryptedBlob; bytes: number }>();
  private usedBytes = 0;

  constructor(private readonly maxBytes: number) {}

  get(key: string): EncryptedBlob | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.blob;
  }

  set(key: string, blob: EncryptedBlob): void {
    const bytes = estimateBlobBytes(blob);
    const existing = this.entries.get(key);
    if (existing) {
      this.usedBytes -= existing.bytes;
      this.entries.delete(key);
    }

    // Preventive eviction keeps the hot tier under budget before we admit
    // a new blob, instead of briefly overfilling and trimming afterwards.
    if (bytes > this.maxBytes) {
      return;
    }

    this.trimFor(bytes);
    this.entries.set(key, { blob, bytes });
    this.usedBytes += bytes;
  }

  delete(key: string): void {
    const hit = this.entries.get(key);
    if (!hit) return;
    this.usedBytes -= hit.bytes;
    this.entries.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of Array.from(this.entries.keys())) {
      if (!key.startsWith(prefix)) continue;
      this.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.usedBytes = 0;
  }

  getStats(): { entries: number; usedBytes: number; maxBytes: number } {
    return {
      entries: this.entries.size,
      usedBytes: this.usedBytes,
      maxBytes: this.maxBytes,
    };
  }

  private trimFor(incomingBytes: number): void {
    while (this.usedBytes + incomingBytes > this.maxBytes && this.entries.size > 0) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.delete(oldest.value);
    }
  }
}

export class MemoryStore implements InstanceStore {
  readonly kind = "memory" as const;
  private data: EncryptedBranchPlane = {};

  getScope(scopeKey: string): EncryptedScopeEntry | undefined {
    return this.data[scopeKey];
  }

  getScopeMode(scopeKey: string): "none" | "legacy" | "chunks" {
    const current = this.data[scopeKey];
    if (!current) return "none";
    return typeof current === "string" ? "legacy" : "chunks";
  }

  getAuxiliaryPath(_name: string): string | null {
    return null;
  }

  setScope(scopeKey: string, value: EncryptedScopeEntry): void {
    this.data[scopeKey] = cloneScopeEntry(value);
  }

  deleteScope(scopeKey: string): void {
    delete this.data[scopeKey];
  }

  listScopes(): string[] {
    return Object.keys(this.data);
  }

  getChunk(scopeKey: string, chunkId: string): EncryptedBlob | undefined {
    const scope = this.data[scopeKey];
    if (!scope) return undefined;
    if (typeof scope === "string") return chunkId === "default" ? scope : undefined;
    return scope[chunkId];
  }

  setChunk(scopeKey: string, chunkId: string, blob: EncryptedBlob): void {
    const scope = this.data[scopeKey];
    if (!scope) {
      this.data[scopeKey] = { [chunkId]: blob };
      return;
    }
    if (typeof scope === "string") {
      const next: Record<string, EncryptedBlob> = { default: scope };
      next[chunkId] = blob;
      this.data[scopeKey] = next;
      return;
    }
    scope[chunkId] = blob;
  }

  listChunks(scopeKey: string): string[] {
    const scope = this.data[scopeKey];
    if (!scope) return [];
    if (typeof scope === "string") return ["default"];
    return Object.keys(scope);
  }

  deleteChunk(scopeKey: string, chunkId: string): void {
    const scope = this.data[scopeKey];
    if (!scope) return;
    if (typeof scope === "string") {
      if (chunkId === "default") delete this.data[scopeKey];
      return;
    }
    delete scope[chunkId];
    if (Object.keys(scope).length === 0) {
      delete this.data[scopeKey];
    }
  }

  clear(): void {
    this.data = {};
  }

  exportData(): EncryptedBranchPlane {
    return cloneBranchPlane(this.data);
  }

  importData(data: EncryptedBranchPlane): void {
    this.data = cloneBranchPlane(data);
  }

  view(): EncryptedBranchPlane {
    return this.data;
  }

  close(): void {}
}

export class DiskStore implements InstanceStore {
  readonly kind = "disk" as const;

  private readonly fs: NodeFsModule;
  private readonly path: NodePathModule;
  private readonly baseDir: string;
  private readonly logPath: string;
  private readonly indexPath: string;
  private readonly flushEvery: number;
  private readonly hot: BlobLruCache;

  private index: DiskIndexSnapshot = {};
  private logFd: number;
  private logSize: number;
  private writesSinceFlush = 0;

  constructor(options: DiskStoreOptions);
  constructor(baseDir: string, maxHotBytes?: number);
  constructor(input: DiskStoreOptions | string, maxHotBytes = 400_000_000) {
    const opts = typeof input === "string"
      ? { baseDir: input, maxHotBytes }
      : input;

    const fs = getBuiltinModule<NodeFsModule>("node:fs");
    const path = getBuiltinModule<NodePathModule>("node:path");
    if (!fs || !path) {
      throw new Error("DiskStore requires a Node.js runtime.");
    }

    this.fs = fs;
    this.path = path;
    this.baseDir = opts.baseDir;
    this.logPath = path.join(opts.baseDir, "branch-store.log");
    this.indexPath = path.join(opts.baseDir, "branch-store.index.json");
    this.flushEvery = Math.max(1, Math.floor(opts.flushEvery ?? 32));
    this.hot = new BlobLruCache(Math.max(1, Math.floor(opts.maxHotBytes ?? 400_000_000)));

    fs.mkdirSync(this.baseDir, { recursive: true });
    this.logFd = fs.openSync(this.logPath, "a+");
    this.logSize = fs.fstatSync(this.logFd).size;
    this.index = this.loadIndex();
  }

  getScope(scopeKey: string): EncryptedScopeEntry | undefined {
    const meta = this.index[scopeKey];
    if (!meta) return undefined;
    if (meta.legacy) return this.readBlob(scopeKey, "default", meta.legacy, "legacy");
    const chunkIds = Object.keys(meta.chunks);
    if (chunkIds.length === 0) return undefined;
    const out: Record<string, EncryptedBlob> = {};
    for (const chunkId of chunkIds) {
      const pointer = meta.chunks[chunkId];
      const blob = this.readBlob(scopeKey, chunkId, pointer, "chunk");
      if (blob !== undefined) out[chunkId] = blob;
    }
    return out;
  }

  getScopeMode(scopeKey: string): "none" | "legacy" | "chunks" {
    const meta = this.index[scopeKey];
    if (!meta) return "none";
    return meta.legacy ? "legacy" : "chunks";
  }

  getAuxiliaryPath(name: string): string | null {
    return this.path.join(this.baseDir, name);
  }

  setScope(scopeKey: string, value: EncryptedScopeEntry): void {
    if (typeof value === "string") {
      this.hot.deleteByPrefix(this.cacheKeyPrefix(scopeKey));
      const pointer = this.appendRecord({ op: "scope:set", scopeKey, value });
      this.index[scopeKey] = { legacy: pointer, chunks: {} };
      this.hot.set(this.cacheKey(scopeKey, "default", "legacy"), value);
      this.maybeFlushIndex();
      return;
    }

    delete this.index[scopeKey];
    this.hot.deleteByPrefix(this.cacheKeyPrefix(scopeKey));
    const next: DiskScopeIndex = { legacy: null, chunks: {} };
    this.index[scopeKey] = next;
    for (const [chunkId, blob] of Object.entries(value)) {
      const pointer = this.appendRecord({ op: "chunk:set", scopeKey, chunkId, blob });
      next.chunks[chunkId] = pointer;
      this.hot.set(this.cacheKey(scopeKey, chunkId, "chunk"), blob);
    }
    this.maybeFlushIndex();
  }

  deleteScope(scopeKey: string): void {
    if (!this.index[scopeKey]) return;
    this.appendRecord({ op: "scope:delete", scopeKey });
    delete this.index[scopeKey];
    this.hot.deleteByPrefix(this.cacheKeyPrefix(scopeKey));
    this.maybeFlushIndex();
  }

  listScopes(): string[] {
    return Object.keys(this.index);
  }

  getChunk(scopeKey: string, chunkId: string): EncryptedBlob | undefined {
    const meta = this.index[scopeKey];
    if (!meta) return undefined;
    if (meta.legacy) {
      if (chunkId !== "default") return undefined;
      return this.readBlob(scopeKey, chunkId, meta.legacy, "legacy");
    }
    const pointer = meta.chunks[chunkId];
    if (!pointer) return undefined;
    return this.readBlob(scopeKey, chunkId, pointer, "chunk");
  }

  setChunk(scopeKey: string, chunkId: string, blob: EncryptedBlob): void {
    let meta = this.index[scopeKey];
    if (!meta) {
      meta = { legacy: null, chunks: {} };
      this.index[scopeKey] = meta;
    }

    if (meta.legacy) {
      meta.chunks.default = meta.legacy;
      meta.legacy = null;
    }

    const pointer = this.appendRecord({ op: "chunk:set", scopeKey, chunkId, blob });
    meta.chunks[chunkId] = pointer;
    this.hot.set(this.cacheKey(scopeKey, chunkId, "chunk"), blob);
    this.maybeFlushIndex();
  }

  listChunks(scopeKey: string): string[] {
    const meta = this.index[scopeKey];
    if (!meta) return [];
    if (meta.legacy) return ["default"];
    return Object.keys(meta.chunks);
  }

  deleteChunk(scopeKey: string, chunkId: string): void {
    const meta = this.index[scopeKey];
    if (!meta) return;

    const cacheKind: DiskEntryKind = meta.legacy && chunkId === "default" ? "legacy" : "chunk";
    this.appendRecord({ op: "chunk:delete", scopeKey, chunkId });
    if (meta.legacy && chunkId === "default") {
      meta.legacy = null;
    } else {
      delete meta.chunks[chunkId];
    }
    if (!meta.legacy && Object.keys(meta.chunks).length === 0) {
      delete this.index[scopeKey];
    }
    this.hot.delete(this.cacheKey(scopeKey, chunkId, cacheKind));
    this.maybeFlushIndex();
  }

  clear(): void {
    this.index = {};
    this.hot.clear();
    this.writesSinceFlush = 0;
    this.fs.closeSync(this.logFd);
    this.fs.writeFileSync(this.logPath, "", "utf8");
    this.fs.writeFileSync(this.indexPath, "{}", "utf8");
    this.logFd = this.fs.openSync(this.logPath, "a+");
    this.logSize = 0;
  }

  exportData(): EncryptedBranchPlane {
    const out: EncryptedBranchPlane = {};
    for (const scopeKey of this.listScopes()) {
      const scope = this.getScope(scopeKey);
      if (scope !== undefined) out[scopeKey] = scope;
    }
    return out;
  }

  importData(data: EncryptedBranchPlane): void {
    this.clear();
    for (const [scopeKey, value] of Object.entries(data || {})) {
      this.setScope(scopeKey, value);
    }
    this.flushIndex();
  }

  view(): EncryptedBranchPlane {
    return this.exportData();
  }

  close(): void {
    this.flushIndex();
    this.fs.closeSync(this.logFd);
  }

  getHotStats(): { entries: number; usedBytes: number; maxBytes: number } {
    return this.hot.getStats();
  }

  getIndexStats(): { scopes: number; chunks: number; pointers: number } {
    const scopeKeys = Object.keys(this.index);
    let chunks = 0;
    let pointers = 0;

    for (const scopeKey of scopeKeys) {
      const meta = this.index[scopeKey];
      if (!meta) continue;
      if (meta.legacy) {
        pointers += 1;
      }
      const chunkKeys = Object.keys(meta.chunks || {});
      chunks += chunkKeys.length;
      pointers += chunkKeys.length;
    }

    return {
      scopes: scopeKeys.length,
      chunks,
      pointers,
    };
  }

  private loadIndex(): DiskIndexSnapshot {
    if (!this.fs.existsSync(this.indexPath)) return this.rebuildIndexFromLog();
    try {
      const raw = JSON.parse(this.fs.readFileSync(this.indexPath, "utf8")) as DiskIndexSnapshot;
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return this.rebuildIndexFromLog();
    }
  }

  private rebuildIndexFromLog(): DiskIndexSnapshot {
    if (!this.fs.existsSync(this.logPath)) return {};
    const raw = this.fs.readFileSync(this.logPath, "utf8");
    const next: DiskIndexSnapshot = {};
    let offset = 0;
    for (const line of raw.split("\n")) {
      const length = Buffer.byteLength(line + "\n");
      const trimmed = line.trim();
      if (!trimmed) {
        offset += length;
        continue;
      }
      try {
        const record = JSON.parse(trimmed) as DiskRecord;
        const pointer = { offset, length };
        this.applyRecord(next, record, pointer);
      } catch {
      }
      offset += length;
    }
    return next;
  }

  private appendRecord(record: DiskRecord): BlobPointer {
    const debugEnabled = diskStoreDebugState.enabled;
    const startedMem = debugEnabled ? currentDiskStoreMemory() : null;
    const startedAt = debugEnabled ? nowMs() : 0;
    const blobBytes =
      record.op === "scope:set"
        ? estimateStringBytes(record.value)
        : record.op === "chunk:set"
          ? estimateStringBytes(record.blob)
          : 0;
    const stringifyStartedAt = debugEnabled ? nowMs() : 0;
    const line = `${JSON.stringify(record)}\n`;
    const stringifyMs = debugEnabled ? nowMs() - stringifyStartedAt : 0;
    const length = Buffer.byteLength(line);
    const pointer = {
      offset: this.logSize,
      length,
    };
    this.fs.writeSync(this.logFd, line);
    this.logSize += length;
    if (debugEnabled && startedMem) {
      const endedMem = currentDiskStoreMemory();
      const elapsedMs = nowMs() - startedAt;
      const lineBytes = estimateStringBytes(line);
      const window = diskStoreDebugState.window;
      window.appendCalls += 1;
      window.totalRecordStringifyMs += stringifyMs;
      window.totalAppendMs += elapsedMs;
      window.maxRecordStringifyMs = Math.max(window.maxRecordStringifyMs, stringifyMs);
      window.maxAppendMs = Math.max(window.maxAppendMs, elapsedMs);
      window.maxBlobBytes = Math.max(window.maxBlobBytes, blobBytes);
      window.maxRecordBytes = Math.max(window.maxRecordBytes, lineBytes);
      window.maxAppendResidentBytes = Math.max(window.maxAppendResidentBytes, blobBytes + lineBytes);
      window.maxAppendHeapDelta = Math.max(window.maxAppendHeapDelta, positiveDelta(endedMem.heapUsed, startedMem.heapUsed));
      window.maxAppendExternalDelta = Math.max(window.maxAppendExternalDelta, positiveDelta(endedMem.external, startedMem.external));
      window.maxAppendArrayBuffersDelta = Math.max(
        window.maxAppendArrayBuffersDelta,
        positiveDelta(endedMem.arrayBuffers, startedMem.arrayBuffers),
      );
    }
    return pointer;
  }

  private applyRecord(index: DiskIndexSnapshot, record: DiskRecord, pointer: BlobPointer): void {
    switch (record.op) {
      case "scope:set":
        index[record.scopeKey] = { legacy: pointer, chunks: {} };
        return;
      case "scope:delete":
        delete index[record.scopeKey];
        return;
      case "chunk:set": {
        const scope = index[record.scopeKey] || { legacy: null, chunks: {} };
        if (scope.legacy) {
          scope.chunks.default = scope.legacy;
          scope.legacy = null;
        }
        scope.chunks[record.chunkId] = pointer;
        index[record.scopeKey] = scope;
        return;
      }
      case "chunk:delete": {
        const scope = index[record.scopeKey];
        if (!scope) return;
        if (scope.legacy && record.chunkId === "default") {
          scope.legacy = null;
        } else {
          delete scope.chunks[record.chunkId];
        }
        if (!scope.legacy && Object.keys(scope.chunks).length === 0) {
          delete index[record.scopeKey];
        }
      }
    }
  }

  private flushIndex(): void {
    const debugEnabled = diskStoreDebugState.enabled;
    const startedMem = debugEnabled ? currentDiskStoreMemory() : null;
    const startedAt = debugEnabled ? nowMs() : 0;
    const json = JSON.stringify(this.index);
    this.fs.writeFileSync(this.indexPath, json, "utf8");
    if (debugEnabled && startedMem) {
      const endedMem = currentDiskStoreMemory();
      const elapsedMs = nowMs() - startedAt;
      const window = diskStoreDebugState.window;
      window.flushCalls += 1;
      window.totalFlushMs += elapsedMs;
      window.maxFlushMs = Math.max(window.maxFlushMs, elapsedMs);
      window.maxFlushIndexBytes = Math.max(window.maxFlushIndexBytes, estimateStringBytes(json));
      window.maxFlushHeapDelta = Math.max(window.maxFlushHeapDelta, positiveDelta(endedMem.heapUsed, startedMem.heapUsed));
      window.maxFlushExternalDelta = Math.max(window.maxFlushExternalDelta, positiveDelta(endedMem.external, startedMem.external));
      window.maxFlushArrayBuffersDelta = Math.max(
        window.maxFlushArrayBuffersDelta,
        positiveDelta(endedMem.arrayBuffers, startedMem.arrayBuffers),
      );
    }
    this.writesSinceFlush = 0;
  }

  private maybeFlushIndex(): void {
    this.writesSinceFlush += 1;
    if (this.writesSinceFlush >= this.flushEvery) {
      this.flushIndex();
    }
  }

  private readBlob(
    scopeKey: string,
    chunkId: string,
    pointer: BlobPointer,
    kind: DiskEntryKind,
  ): EncryptedBlob | undefined {
    const cacheKey = this.cacheKey(scopeKey, chunkId, kind);
    const hot = this.hot.get(cacheKey);
    if (hot !== undefined) return hot;

    const debugEnabled = diskStoreDebugState.enabled;
    const startedMem = debugEnabled ? currentDiskStoreMemory() : null;
    const startedAt = debugEnabled ? nowMs() : 0;
    const buffer = Buffer.alloc(pointer.length);
    this.fs.readSync(this.logFd, buffer, 0, pointer.length, pointer.offset);
    const line = buffer.toString("utf8").trim();
    if (!line) return undefined;

    const record = JSON.parse(line) as DiskRecord;
    const blob = record.op === "scope:set" ? record.value : record.op === "chunk:set" ? record.blob : undefined;
    if (blob === undefined) return undefined;

    this.hot.set(cacheKey, blob);
    if (debugEnabled && startedMem) {
      const endedMem = currentDiskStoreMemory();
      const elapsedMs = nowMs() - startedAt;
      const blobBytes = estimateStringBytes(blob);
      const window = diskStoreDebugState.window;
      window.readCalls += 1;
      window.totalReadMs += elapsedMs;
      window.maxReadMs = Math.max(window.maxReadMs, elapsedMs);
      window.maxBlobBytes = Math.max(window.maxBlobBytes, blobBytes);
      window.maxReadBufferBytes = Math.max(window.maxReadBufferBytes, pointer.length);
      window.maxReadResidentBytes = Math.max(
        window.maxReadResidentBytes,
        pointer.length + estimateStringBytes(line) + blobBytes,
      );
      window.maxReadHeapDelta = Math.max(window.maxReadHeapDelta, positiveDelta(endedMem.heapUsed, startedMem.heapUsed));
      window.maxReadExternalDelta = Math.max(window.maxReadExternalDelta, positiveDelta(endedMem.external, startedMem.external));
      window.maxReadArrayBuffersDelta = Math.max(
        window.maxReadArrayBuffersDelta,
        positiveDelta(endedMem.arrayBuffers, startedMem.arrayBuffers),
      );
    }
    return blob;
  }

  private cacheKey(scopeKey: string, chunkId: string, kind: DiskEntryKind): string {
    return `${scopeKey}::${kind}::${chunkId}`;
  }

  private cacheKeyPrefix(scopeKey: string): string {
    return `${scopeKey}::`;
  }
}
