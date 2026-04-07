import { isPointer, pathStartsWith } from "./operators.js";
import { resolveBranchScope } from "./secret.js";
import type {
  KernelMemory,
  MEKernelLike,
  SemanticPath,
} from "./types.js";

export function applyMemoryToIndex(self: MEKernelLike, t: KernelMemory): void {
  const p = t.path;
  const pathParts = p.split(".").filter(Boolean);
  if (t.operator === "_") {
    if (pathParts.length > 0) removeIndexPrefix(self, pathParts);
    return;
  }
  const scope = resolveBranchScope(self, pathParts);
  const inSecret = scope && scope.length > 0 && pathStartsWith(pathParts, scope);
  if (t.operator === "-") {
    if (p === "") {
      for (const k of Object.keys(self.index)) delete self.index[k];
      return;
    }
    const prefix = p + ".";
    for (const k of Object.keys(self.index)) {
      if (k === p || k.startsWith(prefix)) delete self.index[k];
    }
    return;
  }

  if (inSecret) return;
  self.index[p] = t.value;
}

export function removeIndexPrefix(self: MEKernelLike, prefixPath: SemanticPath): void {
  const prefix = prefixPath.join(".");
  if (!prefix) return;
  const dot = prefix + ".";
  for (const k of Object.keys(self.index)) {
    if (k === prefix || k.startsWith(dot)) delete self.index[k];
  }
}

export function rebuildIndex(self: MEKernelLike) {
  const next: Record<string, any> = {};
  const orderedMemories = self._memories
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      if (a.t.timestamp !== b.t.timestamp) return a.t.timestamp - b.t.timestamp;
      if (a.t.hash !== b.t.hash) return a.t.hash < b.t.hash ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.t);

  self.index = next;
  for (const t of orderedMemories) {
    applyMemoryToIndex(self, t);
  }
}

export function getIndex(self: MEKernelLike, path: SemanticPath): any {
  return self.index[path.join(".")];
}

export function setIndex(self: MEKernelLike, path: SemanticPath, value: any): void {
  self.index[path.join(".")] = value;
}

export function resolveIndexPointerPath(
  self: MEKernelLike,
  path: SemanticPath,
  maxHops = 8,
): { path: SemanticPath; raw: any } {
  let curPath = path;
  for (let i = 0; i < maxHops; i++) {
    const exactRaw = getIndex(self, curPath);
    if (isPointer(exactRaw)) {
      curPath = exactRaw.__ptr.split(".").filter(Boolean);
      continue;
    }

    let redirected = false;
    for (let prefixLen = curPath.length - 1; prefixLen >= 0; prefixLen--) {
      const prefix = curPath.slice(0, prefixLen);
      const prefixRaw = getIndex(self, prefix);
      if (!isPointer(prefixRaw)) continue;
      const target = prefixRaw.__ptr.split(".").filter(Boolean);
      const suffix = curPath.slice(prefixLen);
      curPath = [...target, ...suffix];
      redirected = true;
      break;
    }
    if (redirected) continue;
    return { path: curPath, raw: exactRaw };
  }
  return { path: curPath, raw: undefined };
}
