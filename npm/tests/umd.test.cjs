const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

console.log("=== UMD BUILD TEST ===");

try {
  const umdPath = path.resolve(__dirname, "../dist/me.umd.js");
  const umdCode = fs.readFileSync(umdPath, "utf8");

  const sandbox = {
    console,
    window: {},
    self: {},
    global: {},
    globalThis: {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(umdCode, sandbox, { filename: "me.umd.js" });

  const exported = sandbox.Me;
  const ME = typeof exported === "function" ? exported : exported?.ME;
  if (typeof ME !== "function") {
    throw new Error("UMD export not found: expected global `Me` (constructor) or `Me.ME`");
  }

  const me = new ME();
  if (typeof me !== "function") {
    throw new Error("ME instance is not callable");
  }

  me.profile.name("Abella");
  me.profile.age(30);

  const name = me("profile.name");
  const age = me("profile.age");

  console.log("profile.name =", name);
  console.log("profile.age  =", age);

  if (name !== "Abella" || age !== 30) {
    throw new Error("UMD values mismatch");
  }

  console.log("✔ UMD Test PASSED");
} catch (err) {
  console.error("❌ UMD Test FAILED with error:");
  console.error(err);
  process.exitCode = 1;
}
