/**
 * Audience algebra — who can open a value, as a closed algebra.
 * Spec (laws L1–L9, construction, groups): https://suign.github.io/AudienceAlgebra.html
 * Background: https://suign.github.io/SetChemistry.html · https://suign.github.io/EncryptedAudiences.html
 *
 *   A ::= k | OR(A₁…Aₙ) | AND(A₁…Aₙ)      k = (identityHash, P256 public key)
 *
 * A plain array is OR, `{ and: [...] }` is AND, a canonical audience (a group)
 * nests like any other node. There is no NOT and no user-level XOR: `⊕` only
 * appears inside `sealAudience`, as the share split that implements AND.
 *
 * Canonical form = the antichain of minimal coalitions; `id(A)` hashes it, so
 * how an audience was written does not change its id. Sealing compiles the
 * formula into a tree of key envelopes: OR hands the same node key to every
 * child, AND splits it into XOR shares, and a leaf wraps what it receives with
 * the kernel's `wrapSecretV1`. The value itself is sealed with the kernel's
 * v4 blob AEAD under a fresh content key, bound to `{ version, audience, epoch }`.
 *
 * Key distribution is out of scope: callers pass identities as
 * `{ identityHash, publicKey }` and open with `{ identityHash, privateKey }`.
 */
import sha3 from "js-sha3";
import {
  asciiToBytes,
  decryptBlobV4WithDerivedKeys,
  deriveHkdfBytes,
  encryptBlobV4WithDerivedKeys,
  normalizeProofMessage,
  unwrapSecretV1,
  wrapSecretV1,
} from "./crypto.ts";
import type { EncryptedBlob, P256PublicKeyCoordinates, WrappedSecretV1 } from "./types.ts";

const { keccak256 } = sha3;
const AUDIENCE_ID_DOMAIN = "this.me/audience:v1::";
const AUDIENCE_KDF_SALT = "this.me/audience/v1";
const KEY_LENGTH = 32;

/** A kernel identity as an audience element: membership id + encryption target. */
export interface AudienceIdentity {
  identityHash: string;
  publicKey: P256PublicKeyCoordinates;
}

/** What a party brings to `openAudience`: one entry per private key it holds. */
export interface AudienceKey {
  identityHash: string;
  privateKey: CryptoKey;
}

/** `min(A)`: sorted antichain of sorted coalitions, plus the keys of the members it references. */
export interface CanonicalAudience {
  readonly id: string;
  readonly coalitions: ReadonlyArray<ReadonlyArray<string>>;
  readonly members: Readonly<Record<string, P256PublicKeyCoordinates>>;
}

/** Array = OR, `{ and }` = AND, a canonical audience (group) nests as a value. */
export type AudienceFormula =
  | AudienceIdentity
  | CanonicalAudience
  | ReadonlyArray<AudienceFormula>
  | { readonly and: ReadonlyArray<AudienceFormula> };

export type AudienceNodeV1 =
  | { leaf: string; wrapped: WrappedSecretV1 }
  | { or: AudienceNodeV1[] }
  | { and: AudienceNodeV1[] };

export interface AudienceEnvelopeV1 {
  version: 1;
  /** `audienceId` of the sealed audience; authenticated with `version` and `epoch`. */
  audience: string;
  /** Seal version (L5/L7): revocation is a new seal with a higher epoch. */
  epoch: number;
  ciphertext: EncryptedBlob;
  tree: AudienceNodeV1;
}

type Tree<L> = L | { or: Tree<L>[] } | { and: Tree<L>[] };
type FormulaLeaf = { leaf: string; publicKey: P256PublicKeyCoordinates };
type Members = Map<string, P256PublicKeyCoordinates>;

// --- algebra -------------------------------------------------------------

export function canonicalize(formula: AudienceFormula): CanonicalAudience {
  const members: Members = new Map();
  return toCanonical(coalitionsOf(normalize(formula, members)), members);
}

export function audienceId(formula: AudienceFormula): string {
  return canonicalize(formula).id;
}

/** A group is an immutable audience value identified by its canonical member set (OR unless an AND is declared). */
export function group(members: ReadonlyArray<AudienceFormula>): CanonicalAudience {
  return canonicalize(members);
}

/** `A \ x` (L6): drops every coalition containing `x`. Resolved once, at seal time; may be empty. */
export function minus(formula: AudienceFormula, member: AudienceIdentity | string): CanonicalAudience {
  const removed = typeof member === "string" ? member : member.identityHash;
  const canonical = canonicalize(formula);
  const members: Members = new Map(Object.entries(canonical.members));
  const kept = canonical.coalitions.filter((c) => !c.includes(removed)).map((c) => [...c]);
  return toCanonical(kept, members);
}

function toCanonical(coalitions: string[][], members: Members): CanonicalAudience {
  const used: Record<string, P256PublicKeyCoordinates> = {};
  for (const id of [...new Set(coalitions.flat())].sort()) {
    const key = members.get(id)!;
    used[id] = Object.freeze({ kty: key.kty, crv: key.crv, x: key.x, y: key.y });
  }
  return Object.freeze({
    id: idOf(coalitions),
    coalitions: Object.freeze(coalitions.map((c) => Object.freeze(c))),
    members: Object.freeze(used),
  });
}

function idOf(coalitions: ReadonlyArray<ReadonlyArray<string>>): string {
  return keccak256(AUDIENCE_ID_DOMAIN + JSON.stringify(coalitions));
}

/** Formula → tree of leaves, flattened (associativity) with ⊥ = null propagated (A ∨ ⊥ = A, A ∧ ⊥ = ⊥). */
function normalize(node: AudienceFormula, members: Members): Tree<FormulaLeaf> | null {
  const n = node as any;
  if (Array.isArray(n)) return combine("or", n.map((child) => normalize(child, members)));
  if (n && Array.isArray(n.and)) {
    if (n.and.length === 0) throw new Error("AND of nothing would open for everyone; declare at least one member.");
    return combine("and", n.and.map((child: AudienceFormula) => normalize(child, members)));
  }
  if (n && Array.isArray(n.coalitions) && n.members && typeof n.members === "object") {
    return combine(
      "or",
      n.coalitions.map((coalition: string[]) => {
        if (!Array.isArray(coalition) || coalition.length === 0) throw new Error("Canonical audience has an empty coalition.");
        return combine("and", coalition.map((id) => leafOf({ identityHash: id, publicKey: n.members[id] }, members)));
      }),
    );
  }
  return leafOf(n, members);
}

function combine<L extends object>(kind: "or" | "and", children: Array<Tree<L> | null>): Tree<L> | null {
  const out: Tree<L>[] = [];
  for (const child of children) {
    if (child === null) {
      if (kind === "and") return null;
      continue;
    }
    if (kind in child) out.push(...(child as any)[kind]);
    else out.push(child);
  }
  if (out.length === 0) return null;
  return out.length === 1 ? out[0] : ({ [kind]: out } as Tree<L>);
}

function leafOf(identity: AudienceIdentity, members: Members): FormulaLeaf {
  const id = identity?.identityHash;
  const key = identity?.publicKey;
  if (typeof id !== "string" || !id.trim()) throw new Error("Audience identity requires an identityHash.");
  if (!key || key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string") {
    throw new Error(`Audience identity ${id} requires a P-256 public key.`);
  }
  const known = members.get(id);
  if (known && (known.x !== key.x || known.y !== key.y)) {
    throw new Error(`Audience identity ${id} appears with two different public keys.`);
  }
  members.set(id, key);
  return { leaf: id, publicKey: key };
}

/** min(A): OR = ⌊ ∪ ⌋, AND = ⌊ pairwise unions ⌋, leaf = {{k}}. Works on formula trees and envelope trees alike. */
function coalitionsOf(node: Tree<{ leaf: string }> | null): string[][] {
  if (node === null) return [];
  if ("or" in node) return absorb(node.or.flatMap(coalitionsOf));
  if ("and" in node) {
    return node.and
      .map(coalitionsOf)
      .reduce((acc, next) => absorb(acc.flatMap((x) => next.map((y) => [...x, ...y]))));
  }
  if (typeof node.leaf !== "string") throw new Error("Malformed audience node.");
  return [[node.leaf]];
}

function absorb(coalitions: string[][]): string[][] {
  const sorted = coalitions.map((c) => [...new Set(c)].sort()).sort(compareCoalitions);
  const kept: string[][] = [];
  for (const c of sorted) {
    if (!kept.some((k) => k.every((id) => c.includes(id)))) kept.push(c);
  }
  return kept;
}

function compareCoalitions(a: string[], b: string[]): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

// --- seal / open -----------------------------------------------------------

export async function sealAudience(
  value: unknown,
  audience: AudienceFormula,
  options: { epoch?: number } = {},
): Promise<AudienceEnvelopeV1> {
  const members: Members = new Map();
  const tree = normalize(audience, members);
  if (tree === null) throw new Error("Empty audience opens for no one; seal refuses.");
  const epoch = options.epoch ?? 1;
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error("Audience epoch must be a non-negative integer.");

  const header = { version: 1 as const, audience: idOf(coalitionsOf(tree)), epoch };
  const key = randomKey();
  try {
    const ciphertext = await withContentKeys(key, header, (keys) => encryptBlobV4WithDerivedKeys([value], keys));
    return { ...header, ciphertext, tree: await wrapTree(tree, key, header.audience) };
  } finally {
    key.fill(0);
  }
}

/** Opens iff the held keys satisfy the audience (for AND: the whole coalition's keys together). */
export async function openAudience(envelope: AudienceEnvelopeV1, keys: ReadonlyArray<AudienceKey>): Promise<unknown> {
  if (envelope?.version !== 1) throw new Error("Unsupported audience envelope version.");
  const coalitions = coalitionsOf(envelope.tree);
  if (idOf(coalitions) !== envelope.audience) throw new Error("Audience envelope tree does not match its audience id.");

  const held = new Map(keys.map((k) => [k.identityHash, k.privateKey]));
  if (!coalitions.some((c) => c.every((id) => held.has(id)))) throw new Error("Held keys do not satisfy the audience.");

  const key = await unlock(envelope.tree, held);
  if (!key) throw new Error("Audience envelope failed to open.");
  try {
    const header = { version: envelope.version, audience: envelope.audience, epoch: envelope.epoch };
    const opened = await withContentKeys(key, header, (keys) => decryptBlobV4WithDerivedKeys(envelope.ciphertext, keys));
    if (!Array.isArray(opened) || opened.length !== 1) throw new Error("Audience envelope failed to open.");
    return opened[0];
  } finally {
    key.fill(0);
  }
}

async function wrapTree(node: Tree<FormulaLeaf>, key: Uint8Array, kid: string): Promise<AudienceNodeV1> {
  if ("or" in node) return { or: await Promise.all(node.or.map((child) => wrapTree(child, key, kid))) };
  if ("and" in node) {
    const shares = splitXor(key, node.and.length);
    try {
      return { and: await Promise.all(node.and.map((child, i) => wrapTree(child, shares[i], kid))) };
    } finally {
      for (const share of shares) share.fill(0);
    }
  }
  return {
    leaf: node.leaf,
    wrapped: await wrapSecretV1({ secret: key, recipientPublicKey: node.publicKey, kid, class: "data-key" }),
  };
}

async function unlock(node: AudienceNodeV1, held: Map<string, CryptoKey>): Promise<Uint8Array | null> {
  if ("or" in node) {
    for (const child of node.or) {
      const key = await unlock(child, held);
      if (key) return key;
    }
    return null;
  }
  if ("and" in node) {
    const shares: Uint8Array[] = [];
    try {
      for (const child of node.and) {
        const share = await unlock(child, held);
        if (!share) return null;
        shares.push(share);
      }
      return xorAll(shares);
    } finally {
      for (const share of shares) share.fill(0);
    }
  }
  const privateKey = held.get(node.leaf);
  if (!privateKey) return null;
  try {
    const key = (await unwrapSecretV1(node.wrapped, privateKey)) as Uint8Array;
    return key.length === KEY_LENGTH ? key : null;
  } catch {
    return null;
  }
}

/** K = s₁ ⊕ … ⊕ sₙ: n−1 random shares, the last one closes the XOR. */
function splitXor(key: Uint8Array, n: number): Uint8Array[] {
  const shares = Array.from({ length: n - 1 }, randomKey);
  return [...shares, xorAll([key, ...shares])];
}

function xorAll(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(KEY_LENGTH);
  for (const part of parts) for (let i = 0; i < KEY_LENGTH; i++) out[i] ^= part[i];
  return out;
}

function randomKey(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
}

/** Content key → v4 blob AEAD keys; the header rides in pathContext, so it is authenticated. */
async function withContentKeys<T>(
  key: Uint8Array,
  header: { version: number; audience: string; epoch: number },
  fn: (keys: { encKey: Uint8Array; macKey: Uint8Array; pathContext: Uint8Array }) => T,
): Promise<T> {
  const keys = {
    encKey: await deriveHkdfBytes(key, AUDIENCE_KDF_SALT, "enc"),
    macKey: await deriveHkdfBytes(key, AUDIENCE_KDF_SALT, "mac"),
    pathContext: asciiToBytes(normalizeProofMessage(header)),
  };
  try {
    return fn(keys);
  } finally {
    keys.encKey.fill(0);
    keys.macKey.fill(0);
  }
}
