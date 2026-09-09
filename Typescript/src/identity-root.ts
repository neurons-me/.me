/**
 * Identity-Bound Secrets — private root lifecycle.
 * ---------------------------------------------------------
 * See `me/Typescript/typedocs/Identity-Bound-Secrets.md` for the design this
 * module implements.
 *
 * This module is deliberately self-contained and kernel-agnostic: it knows
 * nothing about `.me`'s memory log, index, or proxy surface. It only knows
 * how to generate a private random root, wrap it under a password-derived
 * key (envelope encryption), and unwrap it back. The kernel glue that wires
 * this into `ME` instances lives in `identity-context.ts`.
 *
 * KDF choice (documented per the task's requirement to record the decision):
 * - Password -> wrapping key: PBKDF2-HMAC-SHA256 via WebCrypto `subtle`,
 *   which this package already depends on for HKDF/ECDH/Ed25519 in
 *   `crypto.ts` — no new dependency. PBKDF2 is deliberately NOT a fast hash
 *   and NOT HKDF: HKDF is an *extraction/expansion* primitive for
 *   already-high-entropy input, not a brute-force-resistant password KDF.
 *   Argon2id/scrypt would be preferable in the abstract, but neither has a
 *   maintained, dependency-free binding that works identically under both
 *   Node and browser WebCrypto without adding a new package — introducing
 *   one is a real option for a future revision, not done silently here.
 *   Iteration count defaults to 600,000 (OWASP 2023 guidance for
 *   PBKDF2-HMAC-SHA256) with a hard floor of 210,000 so a caller cannot
 *   accidentally weaken it into a fast hash.
 * - Root -> branch keys: HMAC-Keccak256 (the same primitive `crypto.ts`
 *   already uses for v2/v3 blob derivation), because the root is already
 *   high-entropy (CSPRNG, 32 bytes) — that is the "different problem" the
 *   design doc's §6 calls out explicitly.
 *
 * The root itself is generated with a CSPRNG (`crypto.getRandomValues`),
 * never derived from `(username, password)` — that is the deliberate
 * divergence from `deriveCompoundSeed` this whole feature exists to close.
 */

function getWebCrypto(): Crypto {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.subtle) {
    throw new Error("WebCrypto subtle crypto is required for identity root operations.");
  }
  return cryptoRef;
}

function getRandomBytes(length: number): Uint8Array {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.getRandomValues) {
    throw new Error("Secure random values are required for identity root operations.");
  }
  const out = new Uint8Array(length);
  cryptoRef.getRandomValues(out);
  return out;
}

function asciiToBytes(str: string): Uint8Array {
  const input = String(str ?? "");
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(input);
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(input, "utf8"));
  const encoded = unescape(encodeURIComponent(input));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
  return out;
}

function bytesToHex(buf: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16).padStart(2, "0");
  return hex;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(input || "").length / 4) * 4, "=");
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(normalized, "base64"));
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const clean = Uint8Array.from(bytes);
  return clean.buffer.slice(clean.byteOffset, clean.byteOffset + clean.byteLength);
}

function wipeBytes(...parts: Array<Uint8Array | null | undefined>): void {
  for (const part of parts) {
    if (!part) continue;
    part.fill(0);
  }
}

// --- Format constants ---
export const IDENTITY_ROOT_FORMAT_VERSION = 1 as const;
export const IDENTITY_ROOT_BYTES = 32;
export const ROOT_ID_BYTES = 16;
export const WRAP_SALT_BYTES = 16;
export const WRAP_NONCE_BYTES = 12;
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
/** Hard floor. A caller cannot pass a lower iteration count than this. */
export const MIN_PBKDF2_ITERATIONS = 210_000;
export const MAX_PBKDF2_ITERATIONS = 5_000_000;
const WRAP_AAD_LABEL = "this.me/identity-root/v1";
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 1024;

export interface IdentityRootEnvelope {
  v: typeof IDENTITY_ROOT_FORMAT_VERSION;
  /** Public, non-secret identifier for *which* root this is. Safe to log/display. */
  rootId: string;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    /** base64url-encoded random salt. */
    salt: string;
  };
  aead: {
    name: "AES-256-GCM";
    /** base64url-encoded 12-byte nonce. */
    iv: string;
    /** base64url-encoded ciphertext with the GCM tag appended. */
    ciphertext: string;
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * Thrown when an envelope cannot be unwrapped — wrong password, or a
 * corrupted/tampered envelope. Deliberately does not distinguish the two
 * (a distinguishing error message would be a password-guessing oracle).
 */
export class IdentityRootAuthError extends Error {
  constructor(message = "Unable to unlock identity root: wrong password or corrupted envelope.") {
    super(message);
    this.name = "IdentityRootAuthError";
  }
}

export class IdentityRootFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityRootFormatError";
  }
}

function assertPassword(password: unknown): asserts password is string {
  if (typeof password !== "string") {
    throw new IdentityRootFormatError("Password must be a string.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new IdentityRootFormatError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new IdentityRootFormatError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
}

function assertIterations(iterations: number): asserts iterations is number {
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new IdentityRootFormatError(
      `PBKDF2 iterations must be an integer between ${MIN_PBKDF2_ITERATIONS} and ${MAX_PBKDF2_ITERATIONS}.`,
    );
  }
}

/** CSPRNG root generation. Never derived from any password or username. */
export function generateIdentityRoot(): { rootId: string; root: Uint8Array } {
  return {
    rootId: bytesToHex(getRandomBytes(ROOT_ID_BYTES)),
    root: getRandomBytes(IDENTITY_ROOT_BYTES),
  };
}

async function deriveWrapKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const { subtle } = getWebCrypto();
  const passwordBytes = asciiToBytes(password);
  try {
    const baseKey = await subtle.importKey("raw", toArrayBuffer(passwordBytes), "PBKDF2", false, ["deriveKey"]);
    return await subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    wipeBytes(passwordBytes);
  }
}

function aadFor(rootId: string): Uint8Array {
  return asciiToBytes(`${WRAP_AAD_LABEL}::${IDENTITY_ROOT_FORMAT_VERSION}::${rootId}`);
}

/**
 * Wrap (envelope-encrypt) a private root under a password-derived key.
 * The wrapping credential unlocks the root — it never regenerates it.
 */
export async function wrapIdentityRoot(
  root: Uint8Array,
  rootId: string,
  password: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
): Promise<IdentityRootEnvelope> {
  if (!(root instanceof Uint8Array) || root.length !== IDENTITY_ROOT_BYTES) {
    throw new IdentityRootFormatError(`Identity root must be exactly ${IDENTITY_ROOT_BYTES} bytes.`);
  }
  if (typeof rootId !== "string" || rootId.length === 0) {
    throw new IdentityRootFormatError("rootId is required.");
  }
  assertPassword(password);
  assertIterations(iterations);

  const { subtle } = getWebCrypto();
  const salt = getRandomBytes(WRAP_SALT_BYTES);
  const iv = getRandomBytes(WRAP_NONCE_BYTES);
  const key = await deriveWrapKey(password, salt, iterations);
  const sealed = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(aadFor(rootId)) },
      key,
      toArrayBuffer(root),
    ),
  );
  const now = Date.now();
  const envelope: IdentityRootEnvelope = {
    v: IDENTITY_ROOT_FORMAT_VERSION,
    rootId,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: bytesToBase64Url(salt) },
    aead: { name: "AES-256-GCM", iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(sealed) },
    createdAt: now,
    updatedAt: now,
  };
  wipeBytes(salt, iv, sealed);
  return envelope;
}

export function assertIdentityRootEnvelopeShape(value: unknown): asserts value is IdentityRootEnvelope {
  if (!value || typeof value !== "object") {
    throw new IdentityRootFormatError("Identity root envelope must be an object.");
  }
  const envelope = value as Partial<IdentityRootEnvelope>;
  if (envelope.v !== IDENTITY_ROOT_FORMAT_VERSION) {
    throw new IdentityRootFormatError(`Unsupported identity root envelope version: ${String(envelope.v)}.`);
  }
  if (typeof envelope.rootId !== "string" || envelope.rootId.length === 0) {
    throw new IdentityRootFormatError("Identity root envelope is missing rootId.");
  }
  if (!envelope.kdf || envelope.kdf.name !== "PBKDF2" || envelope.kdf.hash !== "SHA-256") {
    throw new IdentityRootFormatError("Unsupported or missing identity root KDF.");
  }
  if (!Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < MIN_PBKDF2_ITERATIONS) {
    throw new IdentityRootFormatError("Identity root KDF iteration count is below the safety floor.");
  }
  if (typeof envelope.kdf.salt !== "string" || !envelope.kdf.salt) {
    throw new IdentityRootFormatError("Identity root envelope is missing a KDF salt.");
  }
  if (!envelope.aead || envelope.aead.name !== "AES-256-GCM") {
    throw new IdentityRootFormatError("Unsupported or missing identity root AEAD.");
  }
  if (typeof envelope.aead.iv !== "string" || !envelope.aead.iv) {
    throw new IdentityRootFormatError("Identity root envelope is missing an AEAD nonce.");
  }
  if (typeof envelope.aead.ciphertext !== "string" || !envelope.aead.ciphertext) {
    throw new IdentityRootFormatError("Identity root envelope is missing ciphertext.");
  }
}

/**
 * Unwrap a root from its envelope. Throws `IdentityRootAuthError` on a wrong
 * password or a tampered/corrupted envelope — callers must never fall back
 * to any other behavior (e.g. treating the scope as public) on this failure.
 */
export async function unwrapIdentityRoot(envelope: IdentityRootEnvelope, password: string): Promise<Uint8Array> {
  assertIdentityRootEnvelopeShape(envelope);
  assertPassword(password);

  const { subtle } = getWebCrypto();
  const salt = base64UrlToBytes(envelope.kdf.salt);
  const iv = base64UrlToBytes(envelope.aead.iv);
  const ciphertext = base64UrlToBytes(envelope.aead.ciphertext);
  try {
    const key = await deriveWrapKey(password, salt, envelope.kdf.iterations);
    const clear = new Uint8Array(
      await subtle.decrypt(
        { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(aadFor(envelope.rootId)) },
        key,
        toArrayBuffer(ciphertext),
      ),
    );
    if (clear.length !== IDENTITY_ROOT_BYTES) {
      wipeBytes(clear);
      throw new IdentityRootAuthError();
    }
    return clear;
  } catch (err) {
    if (err instanceof IdentityRootAuthError) throw err;
    // WebCrypto throws a generic OperationError on GCM tag mismatch — normalize
    // it into our own error type so callers get one predictable failure mode.
    throw new IdentityRootAuthError();
  } finally {
    wipeBytes(salt, iv, ciphertext);
  }
}

/**
 * Password change: unwrap under the old password, rewrap the SAME root
 * bytes and rootId under the new password with a fresh salt/nonce. Branch
 * ciphertext is untouched — nothing derived from the root changes.
 */
export async function changeIdentityRootPassword(
  envelope: IdentityRootEnvelope,
  oldPassword: string,
  newPassword: string,
  iterations?: number,
): Promise<IdentityRootEnvelope> {
  const root = await unwrapIdentityRoot(envelope, oldPassword);
  try {
    const next = await wrapIdentityRoot(root, envelope.rootId, newPassword, iterations ?? envelope.kdf.iterations);
    next.createdAt = envelope.createdAt;
    next.updatedAt = Date.now();
    return next;
  } finally {
    wipeBytes(root);
  }
}

export function cloneIdentityRootEnvelope(envelope: IdentityRootEnvelope): IdentityRootEnvelope {
  assertIdentityRootEnvelopeShape(envelope);
  return JSON.parse(JSON.stringify(envelope));
}
