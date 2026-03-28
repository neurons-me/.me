import assert from "node:assert/strict";
import Me from "../../dist/me.es.js";

console.log("=== WRAPPED SECRET V1 CONTRACT TEST ===");
console.log("");
console.log("--- Step 1: Generate recipient P-256 keypair ---");

const recipient = await Me.generateP256KeyPair(true, ["deriveBits"]);
const recipientPublic = await Me.exportP256PublicKey(recipient.publicKey);
console.log("   • recipient keypair generated");
console.log(`   • public curve: ${recipientPublic.crv}`);
console.log(`   • public key coords present: ${Boolean(recipientPublic.x && recipientPublic.y)}`);

console.log("");
console.log("--- Step 2: Wrap secret into a v1 envelope ---");

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
    hardwareBound: true,
  },
});

assert.equal(envelope.version, 1);
assert.equal(envelope.class, "identity-key");
assert.equal(envelope.kid, "orgboat.keysCustomName");
assert.equal(envelope.policy?.hardwareBound, true);
assert.equal(envelope.encryption.kex, "ECDH-ES");
assert.equal(envelope.encryption.kdf, "HKDF-SHA-256");
assert.equal(envelope.encryption.aead, "AES-256-GCM");
console.log("   • envelope version is 1");
console.log(`   • class: ${envelope.class}`);
console.log(`   • kid: ${envelope.kid}`);
console.log(
  `   • algorithms: ${envelope.encryption.kex} / ${envelope.encryption.kdf} / ${envelope.encryption.aead}`,
);
console.log(`   • hardwareBound policy flag preserved: ${envelope.policy?.hardwareBound === true}`);
console.log(
  `   • ciphertext material present: ${
    Boolean(envelope.encryption.ciphertext && envelope.encryption.iv && envelope.encryption.tag)
  }`,
);
console.log(
  `   • ephemeral public key included: ${
    Boolean(envelope.encryption.ephemeralPK.x && envelope.encryption.ephemeralPK.y)
  }`,
);

console.log("");
console.log("--- Step 3: Unwrap with the matching private key ---");

const unwrapped = await Me.unwrapSecretV1(envelope, recipient.privateKey, "utf8");
assert.equal(unwrapped, "orgboat-super-secret");
console.log("   • unwrap succeeded with the matching recipient private key");
console.log("   • recovered cleartext matches original secret");

console.log("");
console.log("✔ WRAPPED SECRET V1 CONTRACT PASSED");
