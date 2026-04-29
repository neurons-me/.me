import { ME } from "./me.js";
import { normalizeCanonicalHandle, normalizeCanonicalSpace } from "./me-uri.js";
import type { MEOptions } from "./types.js";

export interface ThisMeInit {
  name?: string;
  space?: string;
  namespace?: string;
  displayName?: string;
  seed?: string;
  options?: MEOptions;
}

export type ThisMeInput = string | ThisMeInit | undefined;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isThisMeInit(value: unknown): value is ThisMeInit {
  return isPlainObject(value);
}

function normalizeFactorySpace(rawSpace: string): string {
  if (!String(rawSpace || "").trim()) return "";
  return normalizeCanonicalSpace(rawSpace);
}

function configureIdentity(runtime: ME, input: ThisMeInit): ME {
  const rawName = String(input.name || "").trim();
  if (!rawName) return runtime;

  const username = normalizeCanonicalHandle(rawName);
  const displayName = String(input.displayName || rawName).trim() || rawName;
  const rootNamespace = normalizeFactorySpace(String(input.space || input.namespace || ""));

  runtime["@"](username);
  runtime.profile.name(displayName);
  runtime.profile.username(username);

  if (rootNamespace) {
    runtime.profile.rootNamespace(rootNamespace);
    runtime.profile.namespace(`${username}.${rootNamespace}`);
  }

  return runtime;
}

export function createThisMe(input?: ThisMeInput, options?: MEOptions): ME {
  if (!isThisMeInit(input)) {
    return new ME(input, options);
  }

  const runtime = new ME(input.seed, input.options ?? options);
  return configureIdentity(runtime, input);
}
