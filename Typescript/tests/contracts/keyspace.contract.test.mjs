import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";

console.log("=== KEYSPACE CONTRACT TEST ===");

console.log("\n--- Step 1: Create a wrapped key envelope for the active self ---");
const recipient = await ME.generateP256KeyPair(true, ["deriveBits"]);
const recipientPublicKey = await ME.exportP256PublicKey(recipient.publicKey);
const envelope = await ME.wrapSecretV1({
  secret: "orgboat-super-secret",
  recipientPublicKey,
  kid: "orgboat.keysCustomName",
  class: "identity-key",
  publicKey: recipientPublicKey,
  policy: {
    appId: "orgboat",
    usage: ["sign", "derive"],
    label: "Orgboat Key",
  },
});
console.log("   • wrapped secret envelope created");

console.log("\n--- Step 2: Store the envelope in the local keyspace ---");
const me = new ME();
me.installRecipientKey("self.master", recipient.privateKey);

const stored = me.execute("me://self:write/keys/orgboat.keysCustomName", {
  envelope,
  recipientKeyId: "self.master",
});
assert.equal(stored.kid, "orgboat.keysCustomName");
console.log("   • self:write/keys/... stored the wrapped key envelope");

const readEnvelope = me.execute("me://self:read/keys/orgboat.keysCustomName");
assert.deepEqual(readEnvelope, envelope);
console.log("   • self:read/keys/... returned the stored envelope");

const keyManifest = me.execute("me://self:read/keys");
assert.equal(typeof keyManifest, "object");
assert.equal(typeof keyManifest["orgboat.keysCustomName"], "object");
console.log("   • self:read/keys returned the keyspace manifest");

console.log("\n--- Step 3: Open the key using the installed recipient key ---");
const opened = await me.execute("me://self:open/keys/orgboat.keysCustomName", { output: "utf8" });
assert.equal(opened, "orgboat-super-secret");
console.log("   • self:open/keys/... unwrapped the key in memory");

const used = await me.execute("me://self:use/keys/orgboat.keysCustomName", { output: "utf8" });
assert.equal(used, "orgboat-super-secret");
console.log("   • self:use/keys/... aliases the same open flow");

console.log("\n--- Step 4: Key envelopes survive snapshot hydration, private keys do not ---");
const snapshot = me.execute("me://kernel:export/snapshot");
const recovered = new ME();
recovered.execute("me://kernel:import/snapshot", snapshot);

const recoveredEnvelope = recovered.execute("me://self:read/keys/orgboat.keysCustomName");
assert.deepEqual(recoveredEnvelope, envelope);
console.log("   • keyspace envelopes are persisted in the snapshot");

await assert.rejects(
  async () => recovered.execute("me://self:open/keys/orgboat.keysCustomName", { output: "utf8" }),
  /No recipient private key is available/,
);
console.log("   • opening without an installed private key is denied");

recovered.installRecipientKey("self.master", recipient.privateKey);
const reopened = await recovered.execute("me://self:open/keys/orgboat.keysCustomName", { output: "utf8" });
assert.equal(reopened, "orgboat-super-secret");
console.log("   • reinstalling the local recipient key restores access");

console.log("\n✔ KEYSPACE CONTRACT PASSED");
