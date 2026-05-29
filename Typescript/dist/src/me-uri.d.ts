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
export interface CanonicalizeLegacyAtOperatorOptions {
    knownSpaces?: readonly string[];
}
export interface FormatCanonicalMeUriInput {
    handle: string;
    space: string;
    selector?: string | MeCanonicalSelector | null;
    path?: string | null;
}
export type MeDnsProjectionFailureReason = "INVALID_HOST" | "TRANSPORT_ONLY_HOST" | "UNKNOWN_SPACE" | "NOT_CANONICAL_NAMESPACE";
export type MeDnsProjectionResult = {
    ok: true;
    kind: "space";
    rawHost: string;
    host: string;
    matchedSpace: string;
    prefixLabels: [];
    space: string;
} | {
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
} | {
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
export declare function normalizeCanonicalHandle(rawHandle: unknown): string;
export declare function normalizeCanonicalSpace(rawSpace: unknown): string;
export declare function formatCanonicalMeUri(input: FormatCanonicalMeUriInput): string;
export declare function parseMeUri(rawInput: string): MeCanonicalUri;
export declare function tryParseMeUri(rawInput: string): MeCanonicalUri | null;
export declare function parseCanonicalMeUri(rawInput: string, options?: ParseCanonicalMeUriOptions): MeCanonicalUri;
export declare function canonicalizeHumanIdentity(rawInput: string, options?: CanonicalizeHumanIdentityOptions): MeHumanIdentity;
export declare function canonicalizeLegacyAtOperator(rawInput: string, options?: CanonicalizeLegacyAtOperatorOptions): string | null;
export declare function projectDnsHostToNamespace(rawHost: string, knownSpaces: readonly string[]): MeDnsProjectionResult;
