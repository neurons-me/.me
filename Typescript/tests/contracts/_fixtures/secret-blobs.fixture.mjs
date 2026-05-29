import sha3 from "js-sha3";
import ME from "../../../dist/me.es.js";

const { keccak256 } = sha3;

export function asciiToBytes(str) {
  return new TextEncoder().encode(str);
}

export function bytesToHex(buf) {
  let hex = "";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, "0");
  }
  return `0x${hex}`;
}

function base64UrlToBytes(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4? 4 - (b64.length % 4) : 0;
  const bin = atob(b64 + '='.repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isEncryptedBlob(val) {
  if (val instanceof Uint8Array) return true;
  if (typeof val === 'string') {
    return val.startsWith('0x') || val.startsWith('b64u:');
  }
  return false;
}

export function legacyXorEncrypt(value, secret, path) {
  const json = JSON.stringify(value);
  const bytes = asciiToBytes(String(json));
  const key = keccak256(secret + ":" + path.join("."));
  const keyBytes = asciiToBytes(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return bytesToHex(out);
}

export function hashFn(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export function clone(value) {
  return typeof structuredClone === "function"
   ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function flipLastHexNibble(blob) {
  const hex = String(blob).slice(2);
  const last = hex.slice(-1).toLowerCase();
  const next = last === "a"? "b" : "a";
  return `0x${hex.slice(0, -1)}${next}`;
}

function flipLastB64uByte(blob) {
  const raw = blob.slice(5); // after 'b64u:'
  if (!raw.length) return blob;
  const bytes = base64UrlToBytes(raw);
  // flip last byte to force decrypt failure
  bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0xff;
  return `b64u:${bytesToBase64Url(bytes)}`;
}

export function makeBranchSecretRuntime() {
  const me = new ME();
  me.setSecretBlobVersionForTesting("v2");
  me.profile.name("Fixture");
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);
  me.wallet.note("private-savings");
  me.profile.primary["->"]("wallet");
  return me;
}

export function makeBranchSecretSnapshot() {
  const me = makeBranchSecretRuntime();
  return { me, snapshot: clone(me.exportSnapshot()) };
}

export function makeMixedSecretSnapshot() {
  const me = new ME();
  me.profile.name("Mixed");
  me.public.status("ok");
  me.wallet["_"]("steel-door");
  me.wallet.balance(100);
  me.wallet.note("private-savings");
  me.profile.primary["->"]("wallet");
  return { me, snapshot: clone(me.exportSnapshot()) };
}

export function makeNoisySecretSnapshot() {
  const me = new ME();
  me.wallet["_"]("alpha");
  me.wallet.hidden.notes("alpha-note");
  me.wallet["~"]("noise-A");
  me.wallet.hidden["_"]("beta");
  me.wallet.hidden.seed("beta-seed");
  return { me, snapshot: clone(me.exportSnapshot()) };
}

export function makeValueLevelSecretSnapshot() {
  const me = new ME();
  me["_"]("root-secret");
  me.profile.name("RootPrivate");
  me.profile.mode("locked");
  return { me, snapshot: clone(me.exportSnapshot()) };
}

export function makeLegacySecretSnapshot() {
  const rawSecret = "legacy-steel-door";
  const effectiveScopeSecret = hashFn(`root::${rawSecret}`);
  const legacyBlob = legacyXorEncrypt({ payload: 42 }, effectiveScopeSecret, ["vault"]);

  return {
    rawSecret,
    snapshot: {
      memories: [],
      localSecrets: { vault: rawSecret },
      localNoises: {},
      encryptedBranches: {
        vault: {
          payload_root: legacyBlob,
        },
      },
      keySpaces: {},
      operators: {},
    },
  };
}

export function getFirstChunkKey(snapshot, scopeKey) {
  const scope = snapshot?.encryptedBranches?.[scopeKey];
  if (!scope || typeof scope!== "object" || Array.isArray(scope)) {
    throw new Error(`No chunk map found at encryptedBranches.${scopeKey}`);
  }
  const keys = Object.keys(scope);
  if (keys.length === 0) throw new Error(`No chunks found for secret scope "${scopeKey}"`);
  return keys[0];
}

export function tamperBranchChunk(snapshot, scopeKey, chunkId = null) {
  const next = clone(snapshot);
  const key = chunkId || getFirstChunkKey(next, scopeKey);
  const blob = next.encryptedBranches[scopeKey][key];
  if (typeof blob === 'string' && blob.startsWith('b64u:')) {
    next.encryptedBranches[scopeKey][key] = flipLastB64uByte(blob);
  } else {
    next.encryptedBranches[scopeKey][key] = flipLastHexNibble(blob);
  }
  return next;
}

export function tamperValueMemory(snapshot, path) {
  const next = clone(snapshot);
  const memory = next.memories.find((entry) => entry.path === path);
  if (!memory) throw new Error(`No memory found at path "${path}"`);
  if (!isEncryptedBlob(memory.value)) {
    throw new Error(`Memory at path "${path}" is not an encrypted blob value`);
  }
  if (typeof memory.value === 'string' && memory.value.startsWith('b64u:')) {
    memory.value = flipLastB64uByte(memory.value);
  } else if (typeof memory.value === 'string' && memory.value.startsWith('0x')) {
    memory.value = flipLastHexNibble(memory.value);
  } else if (memory.value instanceof Uint8Array) {
    // flip last byte in-place on a copy
    const copy = new Uint8Array(memory.value);
    copy[copy.length - 1] = copy[copy.length - 1] ^ 0xff;
    memory.value = copy;
  }
  return next;
}

export function overrideSecret(snapshot, scopeKey, nextSecret) {
  const next = clone(snapshot);
  next.localSecrets = next.localSecrets || {};
  next.localSecrets[scopeKey] = nextSecret;
  return next;
}

export function overrideNoise(snapshot, scopeKey, nextNoise) {
  const next = clone(snapshot);
  next.localNoises = next.localNoises || {};
  next.localNoises[scopeKey] = nextNoise;
  return next;
}

export function transplantScope(snapshot, fromScopeKey, toScopeKey) {
  const next = clone(snapshot);
  const source = next.encryptedBranches?.[fromScopeKey];
  if (!source) throw new Error(`No encrypted scope found at "${fromScopeKey}"`);
  next.encryptedBranches[toScopeKey] = clone(source);
  next.localSecrets = next.localSecrets || {};
  next.localSecrets[toScopeKey] = next.localSecrets[fromScopeKey];
  if (next.localNoises?.[fromScopeKey]!== undefined) {
    next.localNoises[toScopeKey] = next.localNoises[fromScopeKey];
  }
  return next;
}