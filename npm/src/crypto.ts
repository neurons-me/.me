import sha3 from "js-sha3";
import type {
  P256PublicKeyCoordinates,
  WrappedSecretClass,
  WrappedSecretPolicy,
  WrappedSecretV1,
} from "./types.js";
// --- crypto helpers (portable) ---
const { keccak256 } = sha3;
const WRAPPED_SECRET_INFO = "this.me/wrapped-secret/v1";

export function asciiToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
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

export function xorEncrypt(value: any, secret: string, path: string[]): `0x${string}` {
  const json = JSON.stringify(value);
  const bytes = asciiToBytes(json);
  const key = keccak256(secret + ":" + path.join("."));
  const keyBytes = asciiToBytes(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return bytesToHex(out);
}

export function xorDecrypt(hex: string, secret: string, path: string[]): any {
  try {
    const encryptedBytes = hexToBytes(hex);
    const key = keccak256(secret + ":" + path.join("."));
    const keyBytes = asciiToBytes(key);
    const out = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      out[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const json = new TextDecoder().decode(out);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isEncryptedBlob(v: any): v is `0x${string}` {
  // Our xorEncrypt always returns 0x + even-length hex bytes. Require at least 1 byte.
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
  const aesKey = await deriveWrappingAesKey(new Uint8Array(sharedBits), salt);
  const secretBytes = normalizeSecretInput(input.secret);
  const sealed = new Uint8Array(
    await subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
      },
      aesKey,
      toArrayBuffer(secretBytes),
    ),
  );
  const { ciphertext, tag } = splitCiphertextAndTag(sealed);

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
  const aesKey = await deriveWrappingAesKey(new Uint8Array(sharedBits), salt);
  const clear = new Uint8Array(
    await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
      },
      aesKey,
      toArrayBuffer(concatBytes(ciphertext, tag)),
    ),
  );

  if (output === "utf8") return new TextDecoder().decode(clear);
  return clear;
}
