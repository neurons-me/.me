const ME = require("../dist/me.cjs");
console.log("=== CJS BUILD TEST ===");
try {
  const me = new ME();
  if (typeof me !== "function") {
    throw new Error("ME instance is not callable");
  }
  // semantic write
  me.profile.name("Abella");
  me.profile.age(30);
  // semantic read
  const name = me("profile.name");
  const age = me("profile.age");
  console.log("profile.name =", name);
  console.log("profile.age  =", age);
  if (name === "Abella" && age === 30) {
    console.log("✔ CJS Test PASSED");
  } else {
    console.log("❌ CJS Test FAILED (values mismatch)");
    process.exitCode = 1;
  }
} catch (err) {
  console.error("❌ CJS Test FAILED with error:");
  console.error(err);
  process.exitCode = 1;
}
