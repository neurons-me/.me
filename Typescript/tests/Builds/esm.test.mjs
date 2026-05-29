import ME, {
  canonicalizeHumanIdentity,
  parseCanonicalMeUri,
  projectDnsHostToNamespace,
} from "../../dist/me.es.js";
console.log("=== ESM BUILD TEST ===");
try {
  const identity = ME({ name: "suiGn", space: "neurons.me" });
  if (typeof identity !== "function") {
    throw new Error("Factory instance is not callable");
  }
  if (identity("profile.namespace") !== "suign.neurons.me") {
    throw new Error("Factory namespace bootstrap failed");
  }
  if (identity("profile.username") !== "suign") {
    throw new Error("Factory username bootstrap failed");
  }
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
  const parsed = parseCanonicalMeUri("me://suign.neurons.me[macbook]/profile.name", {
    knownSpaces: ["neurons.me"],
  });
  const human = canonicalizeHumanIdentity("suign@neurons.me", {
    knownSpaces: ["neurons.me"],
  });
  const projection = projectDnsHostToNamespace("https://suign.neurons.me", ["neurons.me"]);
  console.log("profile.name =", name);
  console.log("profile.age  =", age);
  if (
    name === "Abella" &&
    age === 30 &&
    parsed.href === "me://suign.neurons.me[surface:macbook]/profile.name" &&
    human.uri === "me://suign.neurons.me" &&
    projection.ok &&
    projection.kind === "namespace" &&
    projection.namespace === "suign.neurons.me"
  ) {
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
