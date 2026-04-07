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
  const next = last === "a" ? "b" : "a";
  return `0x${hex.slice(0, -1)}${next}`;
}

export function makeBranchSecretRuntime() {
  const me = new ME();
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
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    throw new Error(`No chunk map found at encryptedBranches.${scopeKey}`);
  }
  const keys = Object.keys(scope);
  if (keys.length === 0) throw new Error(`No chunks found for secret scope "${scopeKey}"`);
  return keys[0];
}

export function tamperBranchChunk(snapshot, scopeKey, chunkId = null) {
  const next = clone(snapshot);
  const key = chunkId || getFirstChunkKey(next, scopeKey);
  next.encryptedBranches[scopeKey][key] = flipLastHexNibble(next.encryptedBranches[scopeKey][key]);
  return next;
}

export function tamperValueMemory(snapshot, path) {
  const next = clone(snapshot);
  const memory = next.memories.find((entry) => entry.path === path);
  if (!memory) throw new Error(`No memory found at path "${path}"`);
  if (typeof memory.value !== "string" || !memory.value.startsWith("0x")) {
    throw new Error(`Memory at path "${path}" is not an encrypted blob value`);
  }
  memory.value = flipLastHexNibble(memory.value);
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
  if (next.localNoises?.[fromScopeKey] !== undefined) {
    next.localNoises[toScopeKey] = next.localNoises[fromScopeKey];
  }
  return next;
}
