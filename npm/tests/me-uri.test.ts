import assert from "node:assert/strict";
import {
  canonicalizeHumanIdentity,
  parseCanonicalMeUri,
  projectDnsHostToNamespace,
  tryParseMeUri,
} from "../src/me-uri.ts";

const parsed = parseCanonicalMeUri("me://suign.neurons.me[macbook]/profile.name", {
  knownSpaces: ["neurons.me"],
});
assert.equal(parsed.handle, "suign");
assert.equal(parsed.space, "neurons.me");
assert.equal(parsed.selector?.kind, "surface");
assert.equal(parsed.selector?.value, "surface:macbook");
assert.equal(parsed.path, "profile.name");
assert.equal(parsed.href, "me://suign.neurons.me[surface:macbook]/profile.name");

const fanout = parseCanonicalMeUri("me://suign.neurons.me[]/chat.general", {
  knownSpaces: ["neurons.me"],
});
assert.equal(fanout.selector?.kind, "fanout");
assert.equal(fanout.href, "me://suign.neurons.me[]/chat.general");

assert.equal(tryParseMeUri("me://neurons.me"), null);
assert.throws(() => parseCanonicalMeUri("me://neurons.me"), /handle\.space/i);
assert.throws(() => parseCanonicalMeUri("me://sui_gn.neurons.me"), /canonical handle/i);
assert.throws(
  () => parseCanonicalMeUri("me://john.dev.neurons.me", { knownSpaces: ["neurons.me"] }),
  /Unknown canonical space/i,
);

const subSpace = parseCanonicalMeUri("me://john.dev.neurons.me", {
  knownSpaces: ["neurons.me", "dev.neurons.me"],
});
assert.equal(subSpace.space, "dev.neurons.me");
assert.equal(subSpace.namespace, "john.dev.neurons.me");

const human = canonicalizeHumanIdentity("SuiGn@Neurons.me", {
  knownSpaces: ["neurons.me"],
});
assert.equal(human.alias, "suign@neurons.me");
assert.equal(human.namespace, "suign.neurons.me");
assert.equal(human.uri, "me://suign.neurons.me");

const rootProjection = projectDnsHostToNamespace("https://neurons.me", ["neurons.me"]);
assert.equal(rootProjection.ok, true);
assert.equal(rootProjection.kind, "space");
if (rootProjection.ok && rootProjection.kind === "space") {
  assert.equal(rootProjection.space, "neurons.me");
}

const namespaceProjection = projectDnsHostToNamespace("https://suign.neurons.me", ["neurons.me"]);
assert.equal(namespaceProjection.ok, true);
assert.equal(namespaceProjection.kind, "namespace");
if (namespaceProjection.ok && namespaceProjection.kind === "namespace") {
  assert.equal(namespaceProjection.namespace, "suign.neurons.me");
  assert.equal(namespaceProjection.uri, "me://suign.neurons.me");
}

const multiLabelProjection = projectDnsHostToNamespace("https://foo.bar.neurons.me", ["neurons.me"]);
assert.equal(multiLabelProjection.ok, false);
if (!multiLabelProjection.ok) {
  assert.equal(multiLabelProjection.reason, "NOT_CANONICAL_NAMESPACE");
}

const longestSuffixProjection = projectDnsHostToNamespace(
  "https://user.community.neurons.me",
  ["neurons.me", "community.neurons.me"],
);
assert.equal(longestSuffixProjection.ok, true);
assert.equal(longestSuffixProjection.kind, "namespace");
if (longestSuffixProjection.ok && longestSuffixProjection.kind === "namespace") {
  assert.equal(longestSuffixProjection.space, "community.neurons.me");
  assert.equal(longestSuffixProjection.namespace, "user.community.neurons.me");
}

const localhostProjection = projectDnsHostToNamespace("localhost", ["neurons.me"]);
assert.equal(localhostProjection.ok, false);
if (!localhostProjection.ok) {
  assert.equal(localhostProjection.reason, "TRANSPORT_ONLY_HOST");
}

console.log("✔ me:// canonical URI tests passed");
