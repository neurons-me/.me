import { ME } from "./me.ts";
import { normalizeCanonicalHandle, normalizeCanonicalSpace } from "./me-uri.ts";
import type { MEOptions, MEProxy } from "./types.ts";

export interface ThisMeInit {
  name?: string;
  space?: string;
  namespace?: string;
  displayName?: string;
  seed?: string;
  options?: MEOptions;
}

export type ThisMeInput = string | ThisMeInit | undefined;
export type ThisMeKernel = ME & MEProxy;

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

function configureIdentity(runtime: ThisMeKernel, input: ThisMeInit): ThisMeKernel {
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

export function createThisMe(input?: ThisMeInput, options?: MEOptions): ThisMeKernel;
export function createThisMe(who: string, secret: string, options?: MEOptions): ThisMeKernel;
export function createThisMe(
  input?: ThisMeInput,
  secretOrOptions?: string | MEOptions,
  options?: MEOptions,
): ThisMeKernel {
  if (!isThisMeInit(input)) {
    if (typeof secretOrOptions === "string") {
      if (typeof input !== "string") {
        throw new Error("COMPOUND_SEED_WHO_REQUIRED");
      }
      return new ME(input, secretOrOptions, options) as ThisMeKernel;
    }
    return new ME(input, secretOrOptions) as ThisMeKernel;
  }

  const initOptions = input.options ?? (typeof secretOrOptions === "string" ? options : secretOrOptions);
  const runtime = new ME(input.seed, initOptions) as ThisMeKernel;
  return configureIdentity(runtime, input);
}
