import ME from "../dist/me.es.js";
console.log("=== ESM BUILD TEST ===");
try {
  const me = new ME();
  if (typeof me !== "function") {
    throw new Error("ME instance is not callable");
  }
  // semantic writes
  me.profile.name("Abella");
  me.profile.age(30);
  // semantic reads
  const name = me("profile.name");
  const age = me("profile.age");
  console.log("profile.name =", name);
  console.log("profile.age  =", age);
  if (name === "Abella" && age === 30) {
    console.log("✔ ESM Test PASSED");
  } else {
    console.log("❌ ESM Test FAILED (values mismatch)");
    process.exitCode = 1;
  }
} catch (err) {
  console.error("❌ ESM Test FAILED with error:");
  console.error(err);
  process.exitCode = 1;
}
