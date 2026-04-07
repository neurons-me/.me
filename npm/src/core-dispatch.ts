import type {
  MeTargetAst,
  MEKernelLike,
} from "./types.js";
import {
  cloneValue,
  findTopLevelIndex,
  normalizeSelectorPath,
} from "./utils.js";

export function setRecomputeMode(self: MEKernelLike, mode: "eager" | "lazy"): MEKernelLike {
  self.recomputeMode = mode;
  return self;
}

export function getRecomputeMode(self: MEKernelLike): "eager" | "lazy" {
  return self.recomputeMode;
}

export function handleKernelTarget(
  self: MEKernelLike,
  operation: string,
  rawPath: string,
  body?: any,
): any {
  const path = normalizeExecutablePath(rawPath);
  const key = path.key;

  switch (operation) {
    case "read":
      return handleKernelRead(self, key);
    case "export":
      return handleKernelExport(self, key);
    case "import":
      if (body === undefined) throw new Error("kernel:import requires a payload.");
      return handleKernelImport(self, key, body);
    case "replay":
      if (body === undefined) throw new Error("kernel:replay requires a payload.");
      return handleKernelReplay(self, key, body);
    case "rehydrate":
      if (body === undefined) throw new Error("kernel:rehydrate requires a payload.");
      return handleKernelRehydrate(self, key, body);
    case "get":
      return handleKernelGet(self, key);
    case "set":
      if (body === undefined) throw new Error("kernel:set requires a payload.");
      return handleKernelSet(self, key, body);
    default:
      throw new Error(`Unsupported kernel operation: ${operation}`);
  }
}

export function handleKernelRead(self: MEKernelLike, key: string): any {
  switch (key) {
    case "memory":
    case "memories":
    case "logs":
      return cloneValue(self.memories);
    case "snapshot":
      return self.exportSnapshot();
    case "mode":
    case "recompute.mode":
      return self.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:read path: ${key || "<root>"}`);
  }
}

export function handleKernelExport(self: MEKernelLike, key: string): any {
  switch (key) {
    case "memory":
    case "memories":
    case "logs":
      return cloneValue(self.memories);
    case "snapshot":
      return self.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:export path: ${key || "<root>"}`);
  }
}

export function handleKernelImport(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "snapshot":
      self.importSnapshot(body ?? {});
      return self.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:import path: ${key || "<root>"}`);
  }
}

export function handleKernelReplay(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "memory":
    case "memories":
    case "logs":
      if (!Array.isArray(body)) throw new Error("kernel:replay/memory requires a replayable memory payload.");
      self.replayMemories(body);
      return cloneValue(self.memories);
    default:
      throw new Error(`Unsupported kernel:replay path: ${key || "<root>"}`);
  }
}

export function handleKernelRehydrate(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "snapshot":
      self.rehydrate(body ?? {});
      return self.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:rehydrate path: ${key || "<root>"}`);
  }
}

export function handleKernelGet(self: MEKernelLike, key: string): any {
  switch (key) {
    case "mode":
    case "recompute.mode":
      return self.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:get path: ${key || "<root>"}`);
  }
}

export function handleKernelSet(self: MEKernelLike, key: string, body: any): any {
  switch (key) {
    case "mode":
    case "recompute.mode":
      if (body !== "eager" && body !== "lazy") {
        throw new Error(`kernel:set/${key} only accepts "eager" or "lazy".`);
      }
      self.setRecomputeMode(body);
      return self.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:set path: ${key || "<root>"}`);
  }
}

export function normalizeExecutableTarget(
  self: MEKernelLike,
  rawTarget: string | MeTargetAst,
): MeTargetAst {
  if (typeof rawTarget === "string") return parseExecutableTarget(rawTarget);
  if (!rawTarget || typeof rawTarget !== "object") {
    throw new Error("execute(...) requires a me target string or AST.");
  }

  const namespace = String(rawTarget.namespace ?? "").trim();
  const operation = String(rawTarget.operation ?? "").trim().toLowerCase();
  const path = String(rawTarget.path ?? "").trim();
  if (!namespace) throw new Error("Executable me target is missing a namespace.");
  if (!operation) throw new Error("Executable me target is missing an operation.");

  return {
    scheme: "me",
    namespace,
    operation,
    path,
    raw: rawTarget.raw,
    contextRaw: rawTarget.contextRaw ?? null,
  };
}

export function parseExecutableTarget(rawTarget: string): MeTargetAst {
  const raw = String(rawTarget ?? "").trim();
  if (!raw) throw new Error("execute(...) received an empty me target.");

  const withoutScheme = raw.startsWith("me://") ? raw.slice(5) : raw;
  const colonIndex = findTopLevelIndex(withoutScheme, ":");
  if (colonIndex < 0) {
    throw new Error(`Invalid me target "${raw}": expected ":" between namespace and operation.`);
  }

  const namespaceWithContext = withoutScheme.slice(0, colonIndex).trim();
  const rhs = withoutScheme.slice(colonIndex + 1).trim();
  if (!namespaceWithContext) throw new Error(`Invalid me target "${raw}": missing namespace.`);
  if (!rhs) throw new Error(`Invalid me target "${raw}": missing operation.`);

  const slashIndex = rhs.indexOf("/");
  const operation = (slashIndex >= 0 ? rhs.slice(0, slashIndex) : rhs).trim().toLowerCase();
  const path = (slashIndex >= 0 ? rhs.slice(slashIndex + 1) : "").trim();
  if (!operation) throw new Error(`Invalid me target "${raw}": missing operation.`);

  const { namespace, contextRaw } = splitTargetNamespace(namespaceWithContext, raw);
  return {
    scheme: "me",
    namespace,
    operation,
    path,
    raw,
    contextRaw,
  };
}

export function splitTargetNamespace(
  namespaceWithContext: string,
  rawTarget: string,
): { namespace: string; contextRaw: string | null } {
  const openIndex = namespaceWithContext.indexOf("[");
  if (openIndex < 0) {
    return { namespace: namespaceWithContext, contextRaw: null };
  }

  const closeIndex = namespaceWithContext.lastIndexOf("]");
  if (closeIndex < openIndex || closeIndex !== namespaceWithContext.length - 1) {
    throw new Error(`Invalid me target "${rawTarget}": malformed context segment.`);
  }

  const namespace = namespaceWithContext.slice(0, openIndex).trim();
  const contextRaw = namespaceWithContext.slice(openIndex + 1, closeIndex).trim();
  if (!namespace) throw new Error(`Invalid me target "${rawTarget}": missing namespace before context.`);
  return { namespace, contextRaw: contextRaw || null };
}

export function normalizeExecutablePath(
  rawPath: string,
): { key: string; parts: string[] } {
  const dotted = String(rawPath ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, ".");
  const parts = dotted
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  const normalized = normalizeSelectorPath(parts);
  return {
    key: normalized.join("."),
    parts: normalized,
  };
}
