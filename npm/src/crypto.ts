import sha3 from "js-sha3";
import type {
  EncryptedBlob,
  P256PublicKeyCoordinates,
  WrappedSecretClass,
  WrappedSecretPolicy,
  WrappedSecretV1,
} from "./types.js";
// --- crypto helpers (portable) ---
const { keccak256 } = sha3;
const WRAPPED_SECRET_INFO = "this.me/wrapped-secret/v1";
const LEGACY_XOR_DOMAIN_SEPARATOR = ":";
const BLOB_V2_MAGIC = new Uint8Array([0xfe, 0x6d, 0x65]);
const BLOB_V2_VERSION = 0x02;
const BLOB_V2_NONCE_LENGTH = 16;
const BLOB_V2_TAG_LENGTH = 16;
const BLOB_V3_VERSION = 0x03;
const BLOB_V3_NONCE_LENGTH = 16;
const BLOB_V3_TAG_LENGTH = 16;
const KECCAK_HMAC_BLOCK_SIZE = 136;
const V2_KDF_SALT_LABEL = "this.me/blob/v2/salt";
const V2_ENC_INFO_LABEL = "this.me/blob/v2/enc";
const V2_MAC_INFO_LABEL = "this.me/blob/v2/mac";
const V2_STREAM_INFO_LABEL = "this.me/blob/v2/stream";
const V2_TAG_INFO_LABEL = "this.me/blob/v2/tag";
const V3_KDF_LABEL = "this.me/blob/v3/kdf";
const V3_ENC_INFO_LABEL = "this.me/blob/v3/enc";
const V3_MAC_INFO_LABEL = "this.me/blob/v3/mac";
const V3_STREAM_INFO_LABEL = "this.me/blob/v3/stream";
const V3_TAG_INFO_LABEL = "this.me/blob/v3/tag";

type V3Purpose =
  | "this.me/blob/v3/branch"
  | "this.me/blob/v3/value"
  | "this.me/blob/v3/enc"
  | "this.me/blob/v3/mac";

type V3BlobMode = "branch" | "value";
export type BlobV3DerivedKeys = { encKey: Uint8Array; macKey: Uint8Array; pathContext: Uint8Array };

export function asciiToBytes(str: string): Uint8Array {
  const input = String(str ?? "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(input);
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(input, "utf8"));
  }

  const encoded = unescape(encodeURIComponent(input));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
  return out;
}

function utf8ToString(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("utf8");
  }

  let encoded = "";
  for (let i = 0; i < bytes.length; i++) encoded += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(encoded));
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(buf: Uint8Array): `0x${string}` {
  let hex = "";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, "0");
  }
  return ("0x" + hex) as `0x${string}`;
}

function uint32ToBytes(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value >>> 0, false);
  return out;
}

function uint64ToBytes(value: number): Uint8Array {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  const hi = Math.floor(value / 0x100000000);
  const lo = value >>> 0;
  view.setUint32(0, hi >>> 0, false);
  view.setUint32(4, lo, false);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function wipeBytes(...parts: Array<Uint8Array | null | undefined>): void {
  for (const part of parts) {
    if (!part) continue;
    part.fill(0);
  }
}

function getRandomBytes(length: number): Uint8Array {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.getRandomValues) {
    throw new Error("Secure random values are required for encrypted branch writes.");
  }
  const out = new Uint8Array(length);
  cryptoRef.getRandomValues(out);
  return out;
}

function keccakBytes(...parts: Uint8Array[]): Uint8Array {
  const hash = keccak256.create();
  for (const part of parts) hash.update(part);
  return hexToBytes(hash.hex());
}

function normalizePathContext(path: string[]): Uint8Array {
  return asciiToBytes(path.join("."));
}

function lengthPrefixed(bytes: Uint8Array): Uint8Array {
  return concatBytes(uint32ToBytes(bytes.length), bytes);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hmacKeccak256(key: Uint8Array, ...parts: Uint8Array[]): Uint8Array {
  const normalizedKey = key.length > KECCAK_HMAC_BLOCK_SIZE ? keccakBytes(key) : Uint8Array.from(key);
  const keyBlock = new Uint8Array(KECCAK_HMAC_BLOCK_SIZE);
  keyBlock.set(normalizedKey);

  const ipad = new Uint8Array(KECCAK_HMAC_BLOCK_SIZE);
  const opad = new Uint8Array(KECCAK_HMAC_BLOCK_SIZE);
  try {
    for (let i = 0; i < KECCAK_HMAC_BLOCK_SIZE; i++) {
      ipad[i] = keyBlock[i] ^ 0x36;
      opad[i] = keyBlock[i] ^ 0x5c;
    }

    const inner = keccakBytes(ipad, ...parts);
    try {
      return keccakBytes(opad, inner);
    } finally {
      wipeBytes(inner);
    }
  } finally {
    wipeBytes(normalizedKey, keyBlock, ipad, opad);
  }
}

function deriveBlobV2Keys(
  secret: string,
  path: string[],
): { encKey: Uint8Array; macKey: Uint8Array; pathContext: Uint8Array } {
  const ikm = asciiToBytes(String(secret ?? ""));
  const pathContext = normalizePathContext(path);
  const saltLabel = asciiToBytes(V2_KDF_SALT_LABEL);
  const encInfoLabel = asciiToBytes(V2_ENC_INFO_LABEL);
  const macInfoLabel = asciiToBytes(V2_MAC_INFO_LABEL);
  let salt: Uint8Array | null = null;
  let prk: Uint8Array | null = null;
  try {
    salt = hmacKeccak256(saltLabel, lengthPrefixed(pathContext));
    prk = hmacKeccak256(salt, lengthPrefixed(ikm));
    const encKey = hmacKeccak256(prk, encInfoLabel, lengthPrefixed(pathContext));
    const macKey = hmacKeccak256(prk, macInfoLabel, lengthPrefixed(pathContext));
    return { encKey, macKey, pathContext };
  } finally {
    wipeBytes(ikm, saltLabel, encInfoLabel, macInfoLabel, salt, prk);
  }
}

function generateBlobV2Keystream(
  encKey: Uint8Array,
  nonce: Uint8Array,
  pathContext: Uint8Array,
  length: number,
): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  const streamLabel = asciiToBytes(V2_STREAM_INFO_LABEL);

  try {
    while (offset < length) {
      const counterBytes = uint32ToBytes(counter);
      const block = keccakBytes(
        streamLabel,
        lengthPrefixed(encKey),
        lengthPrefixed(nonce),
        counterBytes,
        lengthPrefixed(pathContext),
      );
      try {
        const chunkLength = Math.min(block.length, length - offset);
        out.set(block.subarray(0, chunkLength), offset);
        offset += chunkLength;
        counter++;
      } finally {
        wipeBytes(counterBytes, block);
      }
    }
    return out;
  } finally {
    wipeBytes(streamLabel);
  }
}

function computeBlobV2Tag(
  macKey: Uint8Array,
  header: Uint8Array,
  nonce: Uint8Array,
  pathContext: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const tagLabel = asciiToBytes(V2_TAG_INFO_LABEL);
  const cipherLength = uint64ToBytes(ciphertext.length);
  let full: Uint8Array | null = null;
  try {
    full = hmacKeccak256(
      macKey,
      tagLabel,
      lengthPrefixed(header),
      lengthPrefixed(nonce),
      lengthPrefixed(pathContext),
      cipherLength,
      ciphertext,
    );
    return Uint8Array.from(full.subarray(0, BLOB_V2_TAG_LENGTH));
  } finally {
    wipeBytes(tagLabel, cipherLength, full);
  }
}

function encodeBlobV2(nonce: Uint8Array, tag: Uint8Array, ciphertext: Uint8Array): EncryptedBlob {
  return bytesToHex(
    concatBytes(BLOB_V2_MAGIC, new Uint8Array([BLOB_V2_VERSION]), nonce, tag, ciphertext),
  );
}

function decodeBlobV2(blob: EncryptedBlob): {
  header: Uint8Array;
  nonce: Uint8Array;
  tag: Uint8Array;
  ciphertext: Uint8Array;
} | null {
  const bytes = hexToBytes(blob);
  const headerLength = BLOB_V2_MAGIC.length + 1;
  const minLength = headerLength + BLOB_V2_NONCE_LENGTH + BLOB_V2_TAG_LENGTH + 1;
  if (bytes.length < minLength) return null;

  for (let i = 0; i < BLOB_V2_MAGIC.length; i++) {
    if (bytes[i] !== BLOB_V2_MAGIC[i]) return null;
  }
  if (bytes[BLOB_V2_MAGIC.length] !== BLOB_V2_VERSION) return null;

  const header = bytes.subarray(0, headerLength);
  const nonceStart = headerLength;
  const tagStart = nonceStart + BLOB_V2_NONCE_LENGTH;
  const ciphertextStart = tagStart + BLOB_V2_TAG_LENGTH;

  return {
    header,
    nonce: bytes.subarray(nonceStart, tagStart),
    tag: bytes.subarray(tagStart, ciphertextStart),
    ciphertext: bytes.subarray(ciphertextStart),
  };
}

function encodeBlobV3(nonce: Uint8Array, tag: Uint8Array, ciphertext: Uint8Array): EncryptedBlob {
  return bytesToHex(
    concatBytes(BLOB_V2_MAGIC, new Uint8Array([BLOB_V3_VERSION]), nonce, tag, ciphertext),
  );
}

function decodeBlobV3(blob: EncryptedBlob): {
  header: Uint8Array;
  nonce: Uint8Array;
  tag: Uint8Array;
  ciphertext: Uint8Array;
} | null {
  const bytes = hexToBytes(blob);
  const headerLength = BLOB_V2_MAGIC.length + 1;
  const minLength = headerLength + BLOB_V3_NONCE_LENGTH + BLOB_V3_TAG_LENGTH + 1;
  if (bytes.length < minLength) return null;

  for (let i = 0; i < BLOB_V2_MAGIC.length; i++) {
    if (bytes[i] !== BLOB_V2_MAGIC[i]) return null;
  }
  if (bytes[BLOB_V2_MAGIC.length] !== BLOB_V3_VERSION) return null;

  const header = bytes.subarray(0, headerLength);
  const nonceStart = headerLength;
  const tagStart = nonceStart + BLOB_V3_NONCE_LENGTH;
  const ciphertextStart = tagStart + BLOB_V3_TAG_LENGTH;

  return {
    header,
    nonce: bytes.subarray(nonceStart, tagStart),
    tag: bytes.subarray(tagStart, ciphertextStart),
    ciphertext: bytes.subarray(ciphertextStart),
  };
}

export function deriveBlobV3Keys(
  chain: Uint8Array[],
  mode: V3BlobMode,
  path: string[],
): BlobV3DerivedKeys {
  const purpose: V3Purpose = mode === "branch" ? "this.me/blob/v3/branch" : "this.me/blob/v3/value";
  const baseKey = deriveSecretMaterialV3(chain, purpose);
  const pathContext = normalizePathContext(path);
  const encInfoLabel = asciiToBytes(V3_ENC_INFO_LABEL);
  const macInfoLabel = asciiToBytes(V3_MAC_INFO_LABEL);
  try {
    const encKey = hmacKeccak256(baseKey, encInfoLabel, lengthPrefixed(pathContext));
    const macKey = hmacKeccak256(baseKey, macInfoLabel, lengthPrefixed(pathContext));
    return { encKey, macKey, pathContext };
  } finally {
    wipeBytes(baseKey, encInfoLabel, macInfoLabel);
  }
}

function generateBlobV3Keystream(
  encKey: Uint8Array,
  nonce: Uint8Array,
  pathContext: Uint8Array,
  length: number,
): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  const streamLabel = asciiToBytes(V3_STREAM_INFO_LABEL);

  try {
    while (offset < length) {
      const counterBytes = uint32ToBytes(counter);
      const block = keccakBytes(
        streamLabel,
        lengthPrefixed(encKey),
        lengthPrefixed(nonce),
        counterBytes,
        lengthPrefixed(pathContext),
      );
      try {
        const chunkLength = Math.min(block.length, length - offset);
        out.set(block.subarray(0, chunkLength), offset);
        offset += chunkLength;
        counter++;
      } finally {
        wipeBytes(counterBytes, block);
      }
    }
    return out;
  } finally {
    wipeBytes(streamLabel);
  }
}

function computeBlobV3Tag(
  macKey: Uint8Array,
  header: Uint8Array,
  nonce: Uint8Array,
  pathContext: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  const tagLabel = asciiToBytes(V3_TAG_INFO_LABEL);
  const cipherLength = uint64ToBytes(ciphertext.length);
  let full: Uint8Array | null = null;
  try {
    full = hmacKeccak256(
      macKey,
      tagLabel,
      lengthPrefixed(header),
      lengthPrefixed(nonce),
      lengthPrefixed(pathContext),
      cipherLength,
      ciphertext,
    );
    return Uint8Array.from(full.subarray(0, BLOB_V3_TAG_LENGTH));
  } finally {
    wipeBytes(tagLabel, cipherLength, full);
  }
}

function encryptBlobV2(value: any, secret: string, path: string[]): EncryptedBlob {
  const json = JSON.stringify(value);
  const bytes = asciiToBytes(String(json));
  const nonce = getRandomBytes(BLOB_V2_NONCE_LENGTH);
  const { encKey, macKey, pathContext } = deriveBlobV2Keys(secret, path);
  let keystream: Uint8Array | null = null;
  let ciphertext: Uint8Array | null = null;
  let header: Uint8Array | null = null;
  let tag: Uint8Array | null = null;
  try {
    keystream = generateBlobV2Keystream(encKey, nonce, pathContext, bytes.length);
    ciphertext = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      ciphertext[i] = bytes[i] ^ keystream[i];
    }

    header = concatBytes(BLOB_V2_MAGIC, new Uint8Array([BLOB_V2_VERSION]));
    tag = computeBlobV2Tag(macKey, header, nonce, pathContext, ciphertext);
    return encodeBlobV2(nonce, tag, ciphertext);
  } finally {
    wipeBytes(bytes, nonce, encKey, macKey, pathContext, keystream, ciphertext, header, tag);
  }
}

function decryptDecodedBlobV2(
  decoded: NonNullable<ReturnType<typeof decodeBlobV2>>,
  secret: string,
  path: string[],
): any {
  const { encKey, macKey, pathContext } = deriveBlobV2Keys(secret, path);
  let expectedTag: Uint8Array | null = null;
  let keystream: Uint8Array | null = null;
  let clear: Uint8Array | null = null;
  try {
    expectedTag = computeBlobV2Tag(macKey, decoded.header, decoded.nonce, pathContext, decoded.ciphertext);
    if (!constantTimeEqual(expectedTag, decoded.tag)) return null;

    keystream = generateBlobV2Keystream(encKey, decoded.nonce, pathContext, decoded.ciphertext.length);
    clear = new Uint8Array(decoded.ciphertext.length);
    for (let i = 0; i < decoded.ciphertext.length; i++) {
      clear[i] = decoded.ciphertext[i] ^ keystream[i];
    }

    const json = utf8ToString(clear);
    return JSON.parse(json);
  } catch {
    return null;
  } finally {
    wipeBytes(encKey, macKey, pathContext, expectedTag, keystream, clear);
  }
}

function legacyXorEncrypt(value: any, secret: string, path: string[]): EncryptedBlob {
  const json = JSON.stringify(value);
  const bytes = asciiToBytes(String(json));
  const key = keccak256(secret + LEGACY_XOR_DOMAIN_SEPARATOR + path.join("."));
  const keyBytes = asciiToBytes(key);
  const out = new Uint8Array(bytes.length);
  try {
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return bytesToHex(out);
  } finally {
    wipeBytes(bytes, keyBytes, out);
  }
}

function legacyXorDecrypt(hex: string, secret: string, path: string[]): any {
  let encryptedBytes: Uint8Array | null = null;
  let keyBytes: Uint8Array | null = null;
  let out: Uint8Array | null = null;
  try {
    encryptedBytes = hexToBytes(hex);
    const key = keccak256(secret + LEGACY_XOR_DOMAIN_SEPARATOR + path.join("."));
    keyBytes = asciiToBytes(key);
    out = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      out[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const json = utf8ToString(out);
    return JSON.parse(json);
  } catch {
    return null;
  } finally {
    wipeBytes(encryptedBytes, keyBytes, out);
  }
}

export function deriveSecretMaterialV3(chain: Uint8Array[], purpose: V3Purpose): Uint8Array {
  if (!Array.isArray(chain) || chain.length < 6) {
    throw new Error("V3 derivation requires a complete secret chain.");
  }

  const kdfLabel = asciiToBytes(V3_KDF_LABEL);
  const purposeBytes = asciiToBytes(purpose);
  const transcriptParts = [kdfLabel, lengthPrefixed(purposeBytes), ...chain.map((segment) => lengthPrefixed(segment))];
  let transcript: Uint8Array | null = null;

  try {
    transcript = concatBytes(...transcriptParts);
    return keccakBytes(transcript);
  } finally {
    wipeBytes(kdfLabel, purposeBytes, transcript, ...transcriptParts);
  }
}

// From Corte 4 onward, v3 is the default write format. Version detection keeps v2/legacy readable.
export function detectBlobVersion(blob: EncryptedBlob): "v3" | "v2" | "legacy" {
  try {
    const bytes = hexToBytes(blob);
    if (bytes.length < BLOB_V2_MAGIC.length + 1) return "legacy";
    for (let i = 0; i < BLOB_V2_MAGIC.length; i++) {
      if (bytes[i] !== BLOB_V2_MAGIC[i]) return "legacy";
    }
    const version = bytes[BLOB_V2_MAGIC.length];
    if (version === BLOB_V3_VERSION) return "v3";
    if (version === BLOB_V2_VERSION) return "v2";
    return "legacy";
  } catch {
    return "legacy";
  }
}

export function encryptBlobV3(
  value: any,
  chain: Uint8Array[],
  mode: V3BlobMode,
  path: string[],
): EncryptedBlob {
  const json = JSON.stringify(value);
  const bytes = asciiToBytes(String(json));
  const nonce = getRandomBytes(BLOB_V3_NONCE_LENGTH);
  const { encKey, macKey, pathContext } = deriveBlobV3Keys(chain, mode, path);
  let keystream: Uint8Array | null = null;
  let ciphertext: Uint8Array | null = null;
  let header: Uint8Array | null = null;
  let tag: Uint8Array | null = null;
  try {
    keystream = generateBlobV3Keystream(encKey, nonce, pathContext, bytes.length);
    ciphertext = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      ciphertext[i] = bytes[i] ^ keystream[i];
    }

    header = concatBytes(BLOB_V2_MAGIC, new Uint8Array([BLOB_V3_VERSION]));
    tag = computeBlobV3Tag(macKey, header, nonce, pathContext, ciphertext);
    return encodeBlobV3(nonce, tag, ciphertext);
  } finally {
    wipeBytes(bytes, nonce, encKey, macKey, pathContext, keystream, ciphertext, header, tag);
  }
}

export function decryptBlobV3(
  blob: EncryptedBlob,
  chain: Uint8Array[],
  mode: V3BlobMode,
  path: string[],
): any {
  const { encKey, macKey, pathContext } = deriveBlobV3Keys(chain, mode, path);
  try {
    return decryptBlobV3WithDerivedKeys(blob, { encKey, macKey, pathContext });
  } finally {
    wipeBytes(encKey, macKey, pathContext);
  }
}

export function decryptBlobV3WithDerivedKeys(blob: EncryptedBlob, keys: BlobV3DerivedKeys): any {
  const decoded = decodeBlobV3(blob);
  if (!decoded) return null;

  let expectedTag: Uint8Array | null = null;
  let keystream: Uint8Array | null = null;
  let clear: Uint8Array | null = null;
  try {
    expectedTag = computeBlobV3Tag(keys.macKey, decoded.header, decoded.nonce, keys.pathContext, decoded.ciphertext);
    const tagOk = constantTimeEqual(expectedTag, decoded.tag);
    if (!tagOk) return null;

    keystream = generateBlobV3Keystream(keys.encKey, decoded.nonce, keys.pathContext, decoded.ciphertext.length);
    clear = new Uint8Array(decoded.ciphertext.length);
    for (let i = 0; i < decoded.ciphertext.length; i++) {
      clear[i] = decoded.ciphertext[i] ^ keystream[i];
    }

    const json = utf8ToString(clear);
    return JSON.parse(json);
  } catch {
    return null;
  } finally {
    wipeBytes(expectedTag, keystream, clear);
  }
}

export function xorEncrypt(value: any, secret: string, path: string[]): EncryptedBlob {
  return encryptBlobV2(value, secret, path);
}

export function xorDecrypt(hex: string, secret: string, path: string[]): any {
  try {
    const decodedV2 = decodeBlobV2(hex as EncryptedBlob);
    if (decodedV2) {
      return decryptDecodedBlobV2(decodedV2, secret, path);
    }
    return legacyXorDecrypt(hex, secret, path);
  } catch {
    return null;
  }
}

export function isEncryptedBlob(v: any): v is `0x${string}` {
  if (typeof v !== "string") return false;
  if (!v.startsWith("0x")) return false;
  const hex = v.slice(2);
  if (hex.length < 2) return false; // at least 1 byte
  if (hex.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(input: string): Uint8Array {
  const normalized = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(input || "").length / 4) * 4, "=");

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function getWebCrypto(): Crypto {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.subtle) {
    throw new Error("WebCrypto subtle crypto is required for wrapped secret operations.");
  }
  return cryptoRef;
}

function splitCiphertextAndTag(input: Uint8Array): { ciphertext: Uint8Array; tag: Uint8Array } {
  if (input.length < 16) throw new Error("AES-GCM payload is too short.");
  return {
    ciphertext: input.slice(0, input.length - 16),
    tag: input.slice(input.length - 16),
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const clean = Uint8Array.from(bytes);
  return clean.buffer.slice(clean.byteOffset, clean.byteOffset + clean.byteLength);
}

function normalizeSecretInput(secret: Uint8Array | string): Uint8Array {
  return typeof secret === "string" ? asciiToBytes(secret) : new Uint8Array(secret);
}

async function deriveWrappingAesKey(
  sharedSecret: Uint8Array,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const { subtle } = getWebCrypto();
  const hkdfKey = await subtle.importKey("raw", toArrayBuffer(sharedSecret), "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(asciiToBytes(WRAPPED_SECRET_INFO)),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateP256KeyPair(
  extractable = true,
  usages: KeyUsage[] = ["deriveKey", "deriveBits"],
): Promise<CryptoKeyPair> {
  const { subtle } = getWebCrypto();
  return subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    extractable,
    usages,
  ) as Promise<CryptoKeyPair>;
}

export async function exportP256PublicKey(key: CryptoKey): Promise<P256PublicKeyCoordinates> {
  const { subtle } = getWebCrypto();
  const jwk = await subtle.exportKey("jwk", key);
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
    throw new Error("Public key is not a valid P-256 EC key.");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: jwk.x,
    y: jwk.y,
  };
}

export async function importP256PublicKey(publicKey: P256PublicKeyCoordinates): Promise<CryptoKey> {
  const { subtle } = getWebCrypto();
  return subtle.importKey(
    "jwk",
    {
      key_ops: [],
      ext: true,
      kty: publicKey.kty,
      crv: publicKey.crv,
      x: publicKey.x,
      y: publicKey.y,
    },
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [],
  );
}

export async function wrapSecretV1(input: {
  secret: Uint8Array | string;
  recipientPublicKey: CryptoKey | P256PublicKeyCoordinates;
  kid: string;
  class: WrappedSecretClass;
  publicKey?: P256PublicKeyCoordinates;
  policy?: WrappedSecretPolicy;
}): Promise<WrappedSecretV1> {
  const cryptoRef = getWebCrypto();
  const { subtle } = cryptoRef;
  const recipientPublicKey =
    input.recipientPublicKey instanceof CryptoKey
      ? input.recipientPublicKey
      : await importP256PublicKey(input.recipientPublicKey);

  const ephemeral = await generateP256KeyPair(true, ["deriveBits"]);
  const sharedBits = await subtle.deriveBits(
    {
      name: "ECDH",
      public: recipientPublicKey,
    },
    ephemeral.privateKey,
    256,
  );

  const salt = cryptoRef.getRandomValues(new Uint8Array(32));
  const iv = cryptoRef.getRandomValues(new Uint8Array(12));
  const sharedSecret = new Uint8Array(sharedBits);
  const aesKey = await deriveWrappingAesKey(sharedSecret, salt);
  const secretBytes = normalizeSecretInput(input.secret);
  let sealed: Uint8Array | null = null;
  let ciphertext: Uint8Array | null = null;
  let tag: Uint8Array | null = null;
  try {
    sealed = new Uint8Array(
      await subtle.encrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
        },
        aesKey,
        toArrayBuffer(secretBytes),
      ),
    );
    ({ ciphertext, tag } = splitCiphertextAndTag(sealed));

    return {
      version: 1,
      class: input.class,
      kid: String(input.kid || "").trim(),
      publicKey: input.publicKey,
      encryption: {
        kex: "ECDH-ES",
        kdf: "HKDF-SHA-256",
        aead: "AES-256-GCM",
        iv: bytesToBase64Url(iv),
        salt: bytesToBase64Url(salt),
        tag: bytesToBase64Url(tag),
        ciphertext: bytesToBase64Url(ciphertext),
        ephemeralPK: await exportP256PublicKey(ephemeral.publicKey),
      },
      policy: input.policy,
    };
  } finally {
    wipeBytes(sharedSecret, salt, iv, secretBytes, sealed, ciphertext, tag);
  }
}

export async function unwrapSecretV1(
  envelope: WrappedSecretV1,
  recipientPrivateKey: CryptoKey,
  output: "bytes" | "utf8" = "bytes",
): Promise<Uint8Array | string> {
  const { subtle } = getWebCrypto();
  if (envelope.version !== 1) throw new Error(`Unsupported wrapped secret version: ${envelope.version}`);
  if (envelope.encryption.kex !== "ECDH-ES") throw new Error("Unsupported key exchange algorithm.");
  if (envelope.encryption.kdf !== "HKDF-SHA-256") throw new Error("Unsupported KDF.");
  if (envelope.encryption.aead !== "AES-256-GCM") throw new Error("Unsupported AEAD.");

  const ephemeralPublicKey = await importP256PublicKey(envelope.encryption.ephemeralPK);
  const sharedBits = await subtle.deriveBits(
    {
      name: "ECDH",
      public: ephemeralPublicKey,
    },
    recipientPrivateKey,
    256,
  );
  const salt = base64UrlToBytes(envelope.encryption.salt);
  const iv = base64UrlToBytes(envelope.encryption.iv);
  const ciphertext = base64UrlToBytes(envelope.encryption.ciphertext);
  const tag = base64UrlToBytes(envelope.encryption.tag);
  const sharedSecret = new Uint8Array(sharedBits);
  const aesKey = await deriveWrappingAesKey(sharedSecret, salt);
  const payload = concatBytes(ciphertext, tag);
  let clear: Uint8Array | null = null;
  try {
    clear = new Uint8Array(
      await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
        },
        aesKey,
        toArrayBuffer(payload),
      ),
    );

    if (output === "utf8") {
      const text = utf8ToString(clear);
      wipeBytes(clear);
      return text;
    }
    return clear;
  } finally {
    wipeBytes(sharedSecret, salt, iv, ciphertext, tag, payload);
  }
}
