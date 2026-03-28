import assert from "node:assert/strict";
import ME from "../../dist/me.es.js";

console.log("=== ME EXECUTE CONTRACT TEST ===");

console.log("\n--- Step 1: self targets execute locally inside the kernel ---");
const me = new ME();
me.profile.name("Abella");
me.wallet.income(1000);
me.wallet.expenses.rent(500);
me.wallet["="]("netWorth", "wallet.income - wallet.expenses.rent");

const initialRead = me.execute("me://self:read/profile.name");
assert.equal(initialRead, "Abella");
console.log(`   • self:read/profile.name -> ${JSON.stringify(initialRead)}`);

me.execute("me://self:write/profile.city", "Veracruz");
assert.equal(me("profile.city"), "Veracruz");
console.log("   • self:write/profile.city wrote a semantic value");

const scopedInspect = me.execute("me://self:inspect/profile");
assert.equal(scopedInspect.index["profile.name"], "Abella");
assert.equal(scopedInspect.index["profile.city"], "Veracruz");
console.log("   • self:inspect/profile returned a filtered runtime snapshot");

const explained = me.execute({
  scheme: "me",
  namespace: "self",
  operation: "explain",
  path: "wallet.netWorth",
});
assert.equal(explained.value, 500);
assert.deepEqual(explained.meta.dependsOn.sort(), ["wallet.expenses.rent", "wallet.income"]);
console.log("   • self:explain/wallet.netWorth produced a logic trace");

console.log("\n--- Step 2: kernel targets expose memory, snapshots, and mode control ---");
const memoryLog = me.execute("me://kernel:read/memory");
assert.equal(Array.isArray(memoryLog), true);
assert.equal(memoryLog.length > 0, true);
console.log(`   • kernel:read/memory returned ${memoryLog.length} memories`);

const exportedSnapshot = me.execute("me://kernel:export/snapshot");
assert.equal(Array.isArray(exportedSnapshot.memories), true);
console.log("   • kernel:export/snapshot returned a full kernel snapshot");

assert.equal(me.execute("me://kernel:get/recompute.mode"), "eager");
assert.equal(me.execute("me://kernel:set/recompute.mode", "lazy"), "lazy");
assert.equal(me.execute("me://kernel:get/mode"), "lazy");
console.log("   • kernel:get/set recompute.mode controls the live kernel state");

console.log("\n--- Step 3: snapshot import and memory replay reconstruct state deterministically ---");
const imported = new ME();
imported.execute("me://kernel:import/snapshot", exportedSnapshot);
assert.equal(imported("profile.name"), "Abella");
assert.equal(imported("profile.city"), "Veracruz");
console.log("   • kernel:import/snapshot rehydrated a fresh kernel");

const replayed = new ME();
replayed.execute("me://kernel:replay/memory", memoryLog);
assert.equal(replayed("profile.name"), "Abella");
assert.equal(replayed("wallet.netWorth"), 500);
console.log("   • kernel:replay/memory reconstructed semantic state from the log");

console.log("\n--- Step 4: external namespaces stay out of the local kernel ---");
assert.throws(
  () => me.execute("me://ana.cleaker:read/profile"),
  /External me target/,
);
console.log("   • external targets are rejected and left for cleaker/monad.ai");

console.log("\n✔ ME EXECUTE CONTRACT PASSED");
