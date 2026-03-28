import assert from "node:assert/strict";
import Me from "../../dist/me.es.js";

console.log("=== WRAPPED SECRET V1 NEGATIVE CONTRACT TEST ===");

console.log("");
console.log("--- Setup: create recipient and outsider keys ---");
const recipient = await Me.generateP256KeyPair(true, ["deriveBits"]);
const outsider = await Me.generateP256KeyPair(true, ["deriveBits"]);
const recipientPublic = await Me.exportP256PublicKey(recipient.publicKey);
console.log("   • recipient keypair generated");
console.log("   • outsider keypair generated");

const envelope = await Me.wrapSecretV1({
  secret: "orgboat-super-secret",
  recipientPublicKey: recipientPublic,
  kid: "orgboat.keysCustomName",
  class: "identity-key",
  publicKey: recipientPublic,
  policy: {
    appId: "orgboat",
    usage: ["sign", "derive"],
    label: "Orgboat Key",
  },
});
console.log("   • envelope created for recipient only");

console.log("");
console.log("--- Case 1: wrong private key must fail ---");
let wrongKeyRejected = false;
try {
  await Me.unwrapSecretV1(envelope, outsider.privateKey, "utf8");
} catch {
  wrongKeyRejected = true;
}
assert.equal(wrongKeyRejected, true);
console.log("   • outsider private key could not unwrap the secret");

console.log("");
console.log("--- Case 2: tampered ciphertext must fail ---");
const tamperedCiphertext = {
  ...envelope,
  encryption: {
    ...envelope.encryption,
    ciphertext:
      envelope.encryption.ciphertext.slice(0, -1) +
      (envelope.encryption.ciphertext.endsWith("A") ? "B" : "A"),
  },
};

let tamperedCiphertextRejected = false;
try {
  await Me.unwrapSecretV1(tamperedCiphertext, recipient.privateKey, "utf8");
} catch {
  tamperedCiphertextRejected = true;
}
assert.equal(tamperedCiphertextRejected, true);
console.log("   • modified ciphertext was detected and rejected");

console.log("");
console.log("--- Case 3: tampered tag must fail ---");
const tamperedTag = {
  ...envelope,
  encryption: {
    ...envelope.encryption,
    tag: envelope.encryption.tag.slice(0, -1) + (envelope.encryption.tag.endsWith("A") ? "B" : "A"),
  },
};

let tamperedTagRejected = false;
try {
  await Me.unwrapSecretV1(tamperedTag, recipient.privateKey, "utf8");
} catch {
  tamperedTagRejected = true;
}
assert.equal(tamperedTagRejected, true);
console.log("   • modified authentication tag was detected and rejected");

console.log("");
console.log("✔ WRAPPED SECRET V1 NEGATIVE CONTRACT PASSED");
