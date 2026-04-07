import { unwrapSecretV1 } from "./crypto.js";
import type {
  MEKernelLike,
  MEWrappedKeyOpenOptions,
  WrappedSecretV1,
} from "./types.js";
import { cloneValue } from "./utils.js";

export function installRecipientKey(
  self: MEKernelLike,
  recipientKeyId: string,
  privateKey: CryptoKey,
): MEKernelLike {
  const keyId = String(recipientKeyId || "").trim();
  if (!keyId) throw new Error("installRecipientKey(...) requires a recipient key id.");
  self.recipientKeyring[keyId] = privateKey;
  return self;
}

export function uninstallRecipientKey(self: MEKernelLike, recipientKeyId: string): MEKernelLike {
  const keyId = String(recipientKeyId || "").trim();
  if (!keyId) return self;
  delete self.recipientKeyring[keyId];
  return self;
}

export function storeWrappedKey(
  self: MEKernelLike,
  keyId: string,
  envelope: WrappedSecretV1,
  options?: { recipientKeyId?: string },
): MEKernelLike {
  const normalizedKeyId = String(keyId || "").trim();
  if (!normalizedKeyId) throw new Error("storeWrappedKey(...) requires a key id.");
  if (!envelope || envelope.version !== 1) {
    throw new Error("storeWrappedKey(...) requires a valid WrappedSecretV1 envelope.");
  }

  self.keySpaces[normalizedKeyId] = cloneValue({
    envelope,
    recipientKeyId: options?.recipientKeyId,
  });
  return self;
}

export function handleKeySpaceTarget(
  self: MEKernelLike,
  operation: string,
  keyId: string | null,
  body?: any,
): any {
  switch (operation) {
    case "read":
      if (!keyId) {
        return cloneValue(self.keySpaces);
      }
      return readWrappedKey(self, keyId);
    case "write":
      if (!keyId) throw new Error("self:write/keys requires a key id.");
      if (body === undefined) throw new Error("self:write/keys requires a payload.");
      return writeWrappedKey(self, keyId, body);
    case "open":
    case "use":
      if (!keyId) throw new Error(`self:${operation}/keys requires a key id.`);
      return openWrappedKey(self, keyId, body);
    default:
      throw new Error(`Unsupported keys operation: ${operation}`);
  }
}

export function parseKeySpacePath(rawPath: string): { isKeySpace: boolean; keyId: string | null } {
  const trimmed = String(rawPath ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { isKeySpace: false, keyId: null };
  if (trimmed === "keys") return { isKeySpace: true, keyId: null };
  if (trimmed.startsWith("keys/")) {
    return { isKeySpace: true, keyId: trimmed.slice("keys/".length).trim() || null };
  }
  if (trimmed.startsWith("keys.")) {
    return { isKeySpace: true, keyId: trimmed.slice("keys.".length).trim() || null };
  }
  return { isKeySpace: false, keyId: null };
}

export function readWrappedKey(self: MEKernelLike, keyId: string): WrappedSecretV1 {
  const entry = self.keySpaces[keyId];
  if (!entry) throw new Error(`Key space "${keyId}" was not found.`);
  return cloneValue(entry.envelope);
}

export function writeWrappedKey(self: MEKernelLike, keyId: string, body: any): WrappedSecretV1 {
  const envelope =
    body && typeof body === "object" && body.envelope
      ? (body.envelope as WrappedSecretV1)
      : (body as WrappedSecretV1);
  const recipientKeyId =
    body && typeof body === "object" && typeof body.recipientKeyId === "string"
      ? body.recipientKeyId
      : undefined;

  self.storeWrappedKey(keyId, envelope, { recipientKeyId });
  return readWrappedKey(self, keyId);
}

export function openWrappedKey(
  self: MEKernelLike,
  keyId: string,
  body?: MEWrappedKeyOpenOptions,
): Promise<Uint8Array | string> {
  const entry = self.keySpaces[keyId];
  if (!entry) throw new Error(`Key space "${keyId}" was not found.`);

  const output = body?.output === "utf8" ? "utf8" : "bytes";
  const inlinePrivateKey = body?.recipientPrivateKey;
  const resolvedRecipientKeyId = body?.recipientKeyId ?? entry.recipientKeyId;
  const recipientPrivateKey =
    inlinePrivateKey ??
    (resolvedRecipientKeyId ? self.recipientKeyring[resolvedRecipientKeyId] : undefined);

  if (!recipientPrivateKey) {
    throw new Error(
      `No recipient private key is available to open "${keyId}". Install one first or pass it inline.`,
    );
  }

  return unwrapSecretV1(entry.envelope, recipientPrivateKey, output);
}
