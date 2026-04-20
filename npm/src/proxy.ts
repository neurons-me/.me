import { handleCall as handleCallFn } from "./handleCall.js";
import { isMemory, splitPath } from "./operators.js";
import type {
  EncryptedBlob,
  Memory,
  MEKernelLike,
  MERuntimeMethodDescriptor,
  MEProxy,
  MESnapshotInput,
  ReplayMemoryInput,
  StoredWrappedKey,
} from "./types.js";

export const RUNTIME_ESCAPE_TOKEN = "!";

function withCallerScope<T>(self: MEKernelLike, scope: string | null | undefined, fn: () => T): T {
  const prev = (self as any)._currentCallerScope;
  (self as any)._currentCallerScope = scope;
  try {
    return fn();
  } finally {
    (self as any)._currentCallerScope = prev;
  }
}

function getProxyCallerScope(self: MEKernelLike): string | null | undefined {
  return (self as any)._currentCallerScope;
}

export function normalizeArgs(args: any[]): any {
  if (args.length === 0) return undefined;
  if (args.length === 1) return args[0];
  return args;
}

export function describeRuntimeMethod(
  _self: MEKernelLike,
  path: string,
  call: (...args: any[]) => unknown,
  docs: string,
  signature: string,
): MERuntimeMethodDescriptor {
  return {
    kind: "method",
    path,
    docs,
    signature,
    call,
  };
}

export function buildRuntimeSurface(self: MEKernelLike): Record<string, any> {
  return {
    docs: {
      kind: "runtime-surface",
      description:
        "Reflective runtime plane for .me. Use me['!'] to access inspection, replay, snapshots, and kernel controls.",
      namespaces: ["inspect", "explain", "memories", "snapshot", "runtime", "methods"],
    },
    inspect: describeRuntimeMethod(
      self,
      "inspect",
      (opts?: { last?: number }) => self.inspect(opts),
      "Return a debug snapshot of memories, index, scopes, and recompute state.",
      "inspect(opts?: { last?: number }): { memories, index, encryptedScopes, secretScopes, noiseScopes, recomputeMode, staleDerivations }",
    ),
    explain: describeRuntimeMethod(
      self,
      "explain",
      (path: string) => self.explain(path),
      "Explain how a derived value was computed, including dependency inputs and masking for stealth sources.",
      "explain(path: string): { path, value, expr, derivation, meta }",
    ),
    memories: {
      docs: "Memory log helpers and replay controls.",
      list: describeRuntimeMethod(
        self,
        "memories.list",
        () => self.memories,
        "Return the current memory log.",
        "memories.list(): Memory[]",
      ),
      replay: describeRuntimeMethod(
        self,
        "memories.replay",
        (memories: ReplayMemoryInput[]) => self.replayMemories(memories),
        "Reset kernel state and replay a public or legacy memory log into the current kernel.",
        "memories.replay(memories: ReplayMemoryInput[]): void",
      ),
    },
    snapshot: {
      docs: "Snapshot import/export helpers for full kernel state.",
      export: describeRuntimeMethod(
        self,
        "snapshot.export",
        () => self.exportSnapshot(),
        "Export the current kernel snapshot with public memories plus secrets, noises, encrypted branches, key spaces, and operators.",
        "snapshot.export(): Snapshot",
      ),
      import: describeRuntimeMethod(
        self,
        "snapshot.import",
        (snapshot: MESnapshotInput) => self.importSnapshot(snapshot),
        "Import a full snapshot into the current kernel and rebuild runtime state.",
        "snapshot.import(snapshot: Snapshot): void",
      ),
      rehydrate: describeRuntimeMethod(
        self,
        "snapshot.rehydrate",
        (snapshot: MESnapshotInput) => self.rehydrate(snapshot),
        "Alias for importSnapshot that emphasizes bringing a kernel back to life from a persisted snapshot.",
        "snapshot.rehydrate(snapshot: Snapshot): void",
      ),
    },
    runtime: {
      docs: "Kernel execution and recomputation controls.",
      getRecomputeMode: describeRuntimeMethod(
        self,
        "runtime.getRecomputeMode",
        () => self.getRecomputeMode(),
        "Return the current recomputation mode.",
        "runtime.getRecomputeMode(): 'eager' | 'lazy'",
      ),
      setRecomputeMode: describeRuntimeMethod(
        self,
        "runtime.setRecomputeMode",
        (mode: "eager" | "lazy") => self.setRecomputeMode(mode),
        "Set recomputation mode for derivations.",
        "runtime.setRecomputeMode(mode: 'eager' | 'lazy'): this",
      ),
    },
    methods: {
      docs: "Self-described method registry for the runtime surface.",
      inspect: null,
      explain: null,
      exportSnapshot: null,
      importSnapshot: null,
      rehydrate: null,
      replayMemories: null,
      getRecomputeMode: null,
      setRecomputeMode: null,
    },
  };
}

export function describeRuntimeSurface(): Record<string, any> {
  return {
    kind: "runtime-surface",
    escape: RUNTIME_ESCAPE_TOKEN,
    description:
      "Use me['!'] to enter the reflective runtime plane. This plane exposes snapshots, replay, explainability, and kernel controls.",
    namespaces: ["inspect", "explain", "memories", "snapshot", "runtime", "methods"],
  };
}

export function resolveRuntimeValue(self: MEKernelLike, path: string[]): unknown {
  const surface = buildRuntimeSurface(self);

  surface.methods.inspect = surface.inspect;
  surface.methods.explain = surface.explain;
  surface.methods.exportSnapshot = surface.snapshot.export;
  surface.methods.importSnapshot = surface.snapshot.import;
  surface.methods.rehydrate = surface.snapshot.rehydrate;
  surface.methods.replayMemories = surface.memories.replay;
  surface.methods.getRecomputeMode = surface.runtime.getRecomputeMode;
  surface.methods.setRecomputeMode = surface.runtime.setRecomputeMode;

  if (path.length === 0) return surface;

  let ref: any = surface;
  for (const segment of path) {
    if (ref == null) return undefined;
    ref = ref[segment];
  }
  return ref;
}

export function createRuntimeProxy(
  self: MEKernelLike,
  path: string[],
  callerScope: string | null | undefined = getProxyCallerScope(self),
): any {
  const fn: any = (...args: any[]) => {
    return withCallerScope(self, callerScope, () => {
      const resolved = resolveRuntimeValue(self, path);
      if (typeof resolved === "function") {
        return resolved(...args);
      }
      if (resolved && typeof resolved === "object" && typeof (resolved as any).call === "function") {
        return (resolved as any).call(...args);
      }
      if (path.length === 0) return describeRuntimeSurface();
      return resolved;
    });
  };

  return new Proxy(fn, {
    get(target, prop) {
      if (typeof prop === "symbol") return (target as any)[prop];
      const key = String(prop);
      const nextPath = [...path, key];
      const resolved = resolveRuntimeValue(self, nextPath);
      if (resolved === undefined) return undefined;
      if (resolved === null) return null;
      if (Array.isArray(resolved)) return resolved;
      if (typeof resolved === "function") return createRuntimeProxy(self, nextPath, callerScope);
      if (typeof resolved === "object") return createRuntimeProxy(self, nextPath, callerScope);
      return resolved;
    },
    apply(target, _thisArg, args) {
      return Reflect.apply(target as any, undefined, args);
    },
  });
}

export function createProxy(
  self: MEKernelLike,
  path: string[],
  callerScope: string | null | undefined = getProxyCallerScope(self),
): MEProxy {
  const fn: any = (...args: any[]) => {
    return withCallerScope(self, callerScope, () =>
      handleCallFn(
        {
          createProxy: (p) => createProxy(self, p, callerScope),
          normalizeArgs: (a) => self.normalizeArgs(a),
          readPath: (p) => self.readPath(p),
          postulate: (p, e) => self.postulate(p, e),
          opKind: (op) => self.opKind(op),
          splitPath,
          isMemory,
        },
        path,
        args,
      )
    );
  };

  return new Proxy(fn, {
    get(target, prop) {
      if (typeof prop === "symbol") return (target as any)[prop];
      if (prop === RUNTIME_ESCAPE_TOKEN) {
        return createRuntimeProxy(self, [], callerScope);
      }
      if (prop in self) {
        const existing = (self as any)[prop];
        if (typeof existing === "function") {
          return (...args: any[]) => withCallerScope(self, callerScope, () => existing.apply(self, args));
        }
        return existing;
      }

      const newPath = [...path, String(prop)];
      return createProxy(self, newPath, callerScope);
    },
    apply(target, _thisArg, args) {
      return Reflect.apply(target as any, undefined, args);
    },
  }) as MEProxy;
}
