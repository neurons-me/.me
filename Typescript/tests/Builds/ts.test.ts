import ME, {
  canonicalizeHumanIdentity,
  parseCanonicalMeUri,
  projectDnsHostToNamespace,
  type MeCanonicalUri,
  type MeDnsProjectionResult,
} from "../../index.ts";

const identity: any = ME({
  name: "suign",
  space: "neurons.me",
});
const namespace: string = identity("profile.namespace");
const username: string = identity("profile.username");
const uri: MeCanonicalUri = parseCanonicalMeUri("me://suign.neurons.me[macbook]/profile.name", {
  knownSpaces: ["neurons.me"],
});
const human = canonicalizeHumanIdentity("suign@neurons.me", {
  knownSpaces: ["neurons.me"],
});
const projection: MeDnsProjectionResult = projectDnsHostToNamespace("https://suign.neurons.me", ["neurons.me"]);
const compoundFactory = ME("ana", "secret");
compoundFactory.name("Ana");
const compoundName: string = compoundFactory("name");
const compoundClass: any = new ME("ana", "secret");
const me: any = new ME();
// semantic writes
me.profile.name("Abella");
me.profile.age(30);
// semantic reads
const name: string = me("profile.name");
const age: number = me("profile.age");
// type check only
console.log(namespace, username, uri.href, human.uri, projection.ok, compoundFactory["!"].identity(), compoundClass["!"].identity(), compoundName, name, age);
