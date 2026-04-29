export type MeCanonicalSelectorKind = "fanout" | "current" | "surface" | "claim";

export interface MeCanonicalNamespace {
  handle: string;
  space: string;
  value: string;
}

export interface MeCanonicalSelector {
  kind: MeCanonicalSelectorKind;
  raw: string;
  value: string;
  shorthand: boolean;
}

export interface MeCanonicalPath {
  value: string;
  segments: string[];
}

export interface MeCanonicalUri {
  scheme: "me";
  raw: string;
  href: string;
  namespace: string;
  handle: string;
  space: string;
  selector: MeCanonicalSelector | null;
  path: string | null;
  segments: string[];
}

export interface ParseCanonicalMeUriOptions {
  knownSpaces?: readonly string[];
}

export interface CanonicalizeHumanIdentityOptions {
  knownSpaces?: readonly string[];
}

export interface FormatCanonicalMeUriInput {
  handle: string;
  space: string;
  selector?: string | MeCanonicalSelector | null;
  path?: string | null;
}

export type MeDnsProjectionFailureReason =
  | "INVALID_HOST"
  | "TRANSPORT_ONLY_HOST"
  | "UNKNOWN_SPACE"
  | "NOT_CANONICAL_NAMESPACE";

export type MeDnsProjectionResult =
  | {
      ok: true;
      kind: "space";
      rawHost: string;
      host: string;
      matchedSpace: string;
      prefixLabels: [];
      space: string;
    }
  | {
      ok: true;
      kind: "namespace";
      rawHost: string;
      host: string;
      matchedSpace: string;
      prefixLabels: [string];
      handle: string;
      space: string;
      namespace: string;
      uri: string;
    }
  | {
      ok: false;
      kind: "invalid";
      rawHost: string;
      host: string;
      matchedSpace: string | null;
      prefixLabels: string[];
      reason: MeDnsProjectionFailureReason;
    };

export interface MeHumanIdentity {
  raw: string;
  alias: string;
  handle: string;
  space: string;
  namespace: string;
  uri: string;
}

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LABEL_RE = HANDLE_RE;
const SURFACE_NAME_RE = /^[A-Za-z0-9_-]+$/;
const CLAIM_TOKEN_RE = SURFACE_NAME_RE;
const PATH_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;

function assertNonEmpty(rawValue: unknown, label: string): string {
  const value = String(rawValue ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function assertPattern(value: string, pattern: RegExp, label: string, rawValue?: string): string {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}: ${rawValue ?? value}`);
  }
  return value;
}

function normalizeHostishValue(rawValue: unknown): string {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "";

  try {
    if (/^[a-z]+:\/\//i.test(raw)) {
      return new URL(raw).hostname.trim().toLowerCase();
    }
  } catch {
    // Fall through to manual normalization.
  }

  return raw
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[/?#].*$/g, "")
    .replace(/:\d+$/g, "")
    .replace(/\.+$/g, "")
    .trim()
    .toLowerCase();
}

function normalizeKnownSpaces(knownSpaces: readonly string[] | undefined): string[] {
  if (!knownSpaces?.length) return [];
  const unique = new Set<string>();
  for (const rawSpace of knownSpaces) {
    unique.add(normalizeCanonicalSpace(rawSpace));
  }
  return Array.from(unique).sort((left, right) => {
    const labelDelta = right.split(".").length - left.split(".").length;
    if (labelDelta !== 0) return labelDelta;
    return right.length - left.length;
  });
}

function parseCanonicalNamespace(rawNamespace: unknown): MeCanonicalNamespace {
  const namespace = assertNonEmpty(rawNamespace, "Canonical namespace")
    .replace(/^me:\/\//i, "")
    .trim()
    .toLowerCase();

  const labels = namespace.split(".").map((label) => label.trim()).filter(Boolean);
  if (labels.length < 3) {
    throw new Error(`Invalid canonical namespace "${rawNamespace}": expected handle.space with a dotted space.`);
  }

  const handle = normalizeCanonicalHandle(labels[0]);
  const space = normalizeCanonicalSpace(labels.slice(1).join("."));
  return {
    handle,
    space,
    value: `${handle}.${space}`,
  };
}

function parseCanonicalSelector(rawSelector: string | null): MeCanonicalSelector | null {
  if (rawSelector === null) return null;
  const value = String(rawSelector).trim();

  if (value === "") {
    return {
      kind: "fanout",
      raw: value,
      value,
      shorthand: false,
    };
  }

  if (value === "current") {
    return {
      kind: "current",
      raw: value,
      value,
      shorthand: false,
    };
  }

  if (value.startsWith("claim:")) {
    const token = assertPattern(value.slice("claim:".length), CLAIM_TOKEN_RE, "claim selector token", value);
    return {
      kind: "claim",
      raw: value,
      value: `claim:${token}`,
      shorthand: false,
    };
  }

  const shorthand = !value.startsWith("surface:");
  const surfaceName = assertPattern(
    shorthand ? value : value.slice("surface:".length),
    SURFACE_NAME_RE,
    "surface selector",
    value,
  );
  return {
    kind: "surface",
    raw: value,
    value: `surface:${surfaceName}`,
    shorthand,
  };
}

function parseCanonicalPath(rawPath: string): MeCanonicalPath {
  const trimmed = String(rawPath ?? "").trim();
  if (!trimmed) {
    throw new Error("Canonical me URI path cannot be empty after '/'.");
  }
  if (trimmed.includes("/")) {
    throw new Error(`Invalid canonical path "${rawPath}": use "." for descent, not "/".`);
  }

  const segments = trimmed.split(".").map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) {
    throw new Error(`Invalid canonical path "${rawPath}": empty segments are not allowed.`);
  }
  for (const segment of segments) {
    assertPattern(segment, PATH_SEGMENT_RE, "canonical path segment", rawPath);
  }

  return {
    value: segments.join("."),
    segments,
  };
}

function serializeSelector(selector: string | MeCanonicalSelector | null | undefined): string {
  if (!selector) return "";
  const parsed = typeof selector === "string" ? parseCanonicalSelector(selector) : parseCanonicalSelector(selector.raw);
  if (!parsed) return "";
  return `[${parsed.value}]`;
}

function findLongestKnownSpaceSuffix(host: string, knownSpaces: readonly string[]): string | null {
  for (const knownSpace of normalizeKnownSpaces(knownSpaces)) {
    if (host === knownSpace || host.endsWith(`.${knownSpace}`)) {
      return knownSpace;
    }
  }
  return null;
}

export function normalizeCanonicalHandle(rawHandle: unknown): string {
  return assertPattern(assertNonEmpty(rawHandle, "Handle").toLowerCase(), HANDLE_RE, "canonical handle", String(rawHandle));
}

export function normalizeCanonicalSpace(rawSpace: unknown): string {
  const normalized = normalizeHostishValue(assertNonEmpty(rawSpace, "Space"));
  const labels = normalized.split(".").map((label) => label.trim()).filter(Boolean);
  if (labels.length < 2) {
    throw new Error(`Invalid canonical space "${rawSpace}": expected at least two labels.`);
  }
  for (const label of labels) {
    assertPattern(label, LABEL_RE, "space label", String(rawSpace));
  }
  return labels.join(".");
}

export function formatCanonicalMeUri(input: FormatCanonicalMeUriInput): string {
  const handle = normalizeCanonicalHandle(input.handle);
  const space = normalizeCanonicalSpace(input.space);
  const selector = serializeSelector(input.selector);
  const path = input.path == null || String(input.path).trim() === ""
    ? ""
    : `/${parseCanonicalPath(String(input.path)).value}`;
  return `me://${handle}.${space}${selector}${path}`;
}

export function parseMeUri(rawInput: string): MeCanonicalUri {
  const raw = assertNonEmpty(rawInput, "me:// URI");
  if (!raw.toLowerCase().startsWith("me://")) {
    throw new Error(`Invalid me URI "${rawInput}": expected "me://" scheme.`);
  }

  const withoutScheme = raw.slice(5);
  if (!withoutScheme.trim()) {
    throw new Error(`Invalid me URI "${rawInput}": missing namespace.`);
  }

  const slashIndex = withoutScheme.indexOf("/");
  const head = (slashIndex >= 0 ? withoutScheme.slice(0, slashIndex) : withoutScheme).trim();
  const pathPart = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";

  let namespacePart = head;
  let selectorPart: string | null = null;
  const openIndex = head.indexOf("[");
  if (openIndex >= 0) {
    const closeIndex = head.lastIndexOf("]");
    if (closeIndex < openIndex || closeIndex !== head.length - 1) {
      throw new Error(`Invalid me URI "${rawInput}": malformed selector.`);
    }
    namespacePart = head.slice(0, openIndex).trim();
    selectorPart = head.slice(openIndex + 1, closeIndex).trim();
  }

  const namespace = parseCanonicalNamespace(namespacePart);
  const selector = parseCanonicalSelector(selectorPart);
  const path = slashIndex >= 0 ? parseCanonicalPath(pathPart) : null;
  const href = formatCanonicalMeUri({
    handle: namespace.handle,
    space: namespace.space,
    selector,
    path: path?.value ?? null,
  });

  return {
    scheme: "me",
    raw,
    href,
    namespace: namespace.value,
    handle: namespace.handle,
    space: namespace.space,
    selector,
    path: path?.value ?? null,
    segments: path?.segments ?? [],
  };
}

export function tryParseMeUri(rawInput: string): MeCanonicalUri | null {
  try {
    return parseMeUri(rawInput);
  } catch {
    return null;
  }
}

export function parseCanonicalMeUri(
  rawInput: string,
  options: ParseCanonicalMeUriOptions = {},
): MeCanonicalUri {
  const parsed = parseMeUri(rawInput);
  const knownSpaces = normalizeKnownSpaces(options.knownSpaces);
  if (knownSpaces.length > 0 && !knownSpaces.includes(parsed.space)) {
    throw new Error(`Unknown canonical space "${parsed.space}" in "${rawInput}".`);
  }
  return parsed;
}

export function canonicalizeHumanIdentity(
  rawInput: string,
  options: CanonicalizeHumanIdentityOptions = {},
): MeHumanIdentity {
  const raw = assertNonEmpty(rawInput, "Human identity");
  const parts = raw.split("@");
  if (parts.length !== 2) {
    throw new Error(`Invalid human identity "${rawInput}": expected handle@space.`);
  }

  const handle = normalizeCanonicalHandle(parts[0]);
  const space = normalizeCanonicalSpace(parts[1]);
  const uri = formatCanonicalMeUri({ handle, space });
  parseCanonicalMeUri(uri, options);

  return {
    raw,
    alias: `${handle}@${space}`,
    handle,
    space,
    namespace: `${handle}.${space}`,
    uri,
  };
}

export function projectDnsHostToNamespace(
  rawHost: string,
  knownSpaces: readonly string[],
): MeDnsProjectionResult {
  const host = normalizeHostishValue(rawHost);
  if (!host) {
    return {
      ok: false,
      kind: "invalid",
      rawHost: String(rawHost ?? ""),
      host: "",
      matchedSpace: null,
      prefixLabels: [],
      reason: "INVALID_HOST",
    };
  }

  if (host === "localhost" || host.endsWith(".local")) {
    return {
      ok: false,
      kind: "invalid",
      rawHost,
      host,
      matchedSpace: null,
      prefixLabels: [],
      reason: "TRANSPORT_ONLY_HOST",
    };
  }

  const labels = host.split(".").map((label) => label.trim()).filter(Boolean);
  if (labels.length < 2) {
    return {
      ok: false,
      kind: "invalid",
      rawHost,
      host,
      matchedSpace: null,
      prefixLabels: labels,
      reason: "INVALID_HOST",
    };
  }
  for (const label of labels) {
    if (!LABEL_RE.test(label)) {
      return {
        ok: false,
        kind: "invalid",
        rawHost,
        host,
        matchedSpace: null,
        prefixLabels: labels,
        reason: "INVALID_HOST",
      };
    }
  }

  const matchedSpace = findLongestKnownSpaceSuffix(host, knownSpaces);
  if (!matchedSpace) {
    return {
      ok: false,
      kind: "invalid",
      rawHost,
      host,
      matchedSpace: null,
      prefixLabels: labels,
      reason: "UNKNOWN_SPACE",
    };
  }

  const prefix = host === matchedSpace ? "" : host.slice(0, -(matchedSpace.length + 1));
  const prefixLabels = prefix ? prefix.split(".").filter(Boolean) : [];
  if (prefixLabels.length === 0) {
    return {
      ok: true,
      kind: "space",
      rawHost,
      host,
      matchedSpace,
      prefixLabels: [],
      space: matchedSpace,
    };
  }

  if (prefixLabels.length !== 1) {
    return {
      ok: false,
      kind: "invalid",
      rawHost,
      host,
      matchedSpace,
      prefixLabels,
      reason: "NOT_CANONICAL_NAMESPACE",
    };
  }

  const handle = normalizeCanonicalHandle(prefixLabels[0]);
  const namespace = `${handle}.${matchedSpace}`;
  return {
    ok: true,
    kind: "namespace",
    rawHost,
    host,
    matchedSpace,
    prefixLabels: [handle],
    handle,
    space: matchedSpace,
    namespace,
    uri: formatCanonicalMeUri({ handle, space: matchedSpace }),
  };
}
