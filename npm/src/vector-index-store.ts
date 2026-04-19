import type {
  MEKernelLike,
  MEVectorIndex,
  SemanticPath,
} from "./types.js";
import { hashFn } from "./utils.js";

type NodeFsModule = typeof import("node:fs");
type NodePathModule = typeof import("node:path");

type PersistedVectorIndex = {
  meta: MEVectorIndex["meta"];
  centroids: string;
  postingLists: MEVectorIndex["postingLists"];
};

function getBuiltinModule<T>(specifier: string): T | undefined {
  const runtimeProcess = typeof process !== "undefined" ? (process as any) : null;
  const loader = runtimeProcess?.getBuiltinModule;
  if (typeof loader !== "function") return undefined;
  return loader(specifier) as T | undefined;
}

function getNodeFs(): NodeFsModule | undefined {
  return getBuiltinModule<NodeFsModule>("node:fs");
}

function getNodePath(): NodePathModule | undefined {
  return getBuiltinModule<NodePathModule>("node:path");
}

function safeScopeFileStem(scopeKey: string): string {
  const slug = scopeKey.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "root";
  return `${slug}.${hashFn(scopeKey)}`;
}

function encodeFloat32Array(value: Float32Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64");
  }

  let binary = "";
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const btoaFn = (globalThis as any).btoa;
  if (typeof btoaFn !== "function") {
    throw new Error("Base64 encoding is not available in this runtime.");
  }
  return btoaFn(binary);
}

function decodeFloat32Array(base64: string): Float32Array {
  let bytes: Uint8Array;
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn !== "function") {
      throw new Error("Base64 decoding is not available in this runtime.");
    }
    const binary = atobFn(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  }

  const view = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Float32Array(view);
}

export function vectorIndexKey(scope: SemanticPath): string {
  return scope.join(".");
}

export function resolveVectorIndexPath(self: MEKernelLike, scope: SemanticPath): string | null {
  const aux = self.branchStore.getAuxiliaryPath(`vector-indexes/${safeScopeFileStem(vectorIndexKey(scope))}.json`);
  return typeof aux === "string" && aux.length > 0 ? aux : null;
}

export function cacheVectorIndex(self: MEKernelLike, scope: SemanticPath, index: MEVectorIndex): void {
  self.vectorIndexes.set(vectorIndexKey(scope), index);
}

export function getCachedVectorIndex(self: MEKernelLike, scope: SemanticPath): MEVectorIndex | null {
  return self.vectorIndexes.get(vectorIndexKey(scope)) ?? null;
}

export function persistVectorIndex(self: MEKernelLike, scope: SemanticPath, index: MEVectorIndex): { persisted: boolean; path: string | null } {
  const filePath = resolveVectorIndexPath(self, scope);
  if (!filePath) return { persisted: false, path: null };

  const fs = getNodeFs();
  const path = getNodePath();
  if (!fs || !path) return { persisted: false, path: null };

  const payload: PersistedVectorIndex = {
    meta: index.meta,
    centroids: encodeFloat32Array(index.centroids),
    postingLists: index.postingLists,
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
  return { persisted: true, path: filePath };
}

export function loadVectorIndex(self: MEKernelLike, scope: SemanticPath): MEVectorIndex | null {
  const cached = getCachedVectorIndex(self, scope);
  if (cached) return cached;

  const filePath = resolveVectorIndexPath(self, scope);
  if (!filePath) return null;

  const fs = getNodeFs();
  if (!fs || !fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedVectorIndex;
    if (!raw || typeof raw !== "object" || !raw.meta || typeof raw.centroids !== "string" || !Array.isArray(raw.postingLists)) {
      return null;
    }

    const index: MEVectorIndex = {
      meta: raw.meta,
      centroids: decodeFloat32Array(raw.centroids),
      postingLists: raw.postingLists.map((entries) =>
        Array.isArray(entries)
          ? entries
              .filter((entry) => entry && typeof entry === "object")
              .map((entry) => ({
                chunkId: String((entry as { chunkId?: unknown }).chunkId ?? ""),
                count: Math.max(0, Math.floor(Number((entry as { count?: unknown }).count ?? 0) || 0)),
              }))
              .filter((entry) => entry.chunkId.length > 0 && entry.count > 0)
          : [],
      ),
    };

    cacheVectorIndex(self, scope, index);
    return index;
  } catch {
    return null;
  }
}
