import assert from "node:assert/strict";
import ME from "this.me";

const me = new ME() as any;

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function format(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  return JSON.stringify(value, null, 2);
}

function show(label: string, value: unknown) {
  console.log(`${label} -> ${format(value)}`);
}

function showExplain(path: string) {
  const trace = me.explain(path);
  console.log(
    `explain(${path}) -> ${format({
      path: trace.path,
      value: trace.value,
      expression: trace.derivation?.expression ?? null,
      inputs: trace.derivation?.inputs ?? [],
      dependsOn: trace.meta?.dependsOn ?? [],
    })}`,
  );
  return trace;
}

function showInspect(last = 8) {
  const state = me.inspect({ last });
  const indexKeys = Object.keys(state.index).filter(Boolean).sort();
  console.log(`index keys (${indexKeys.length}) -> ${format(indexKeys)}`);
  console.log(`secret scopes -> ${format(state.secretScopes)}`);
  console.log(
    `recent memories -> ${format(
      state.memories.map((entry: any) => ({
        path: entry.path,
        operator: entry.operator ?? "set",
        value: entry.value,
      })),
    )}`,
  );
}

console.log("\n.me demo: Social Graph");

me["@"]("jabellae");
me.profile.name("J. Abella");
me.profile.age(28);
me.profile.city("Veracruz");

me.users.ana.name("Ana");
me.users.ana.age(22);
me.users.ana.city("CDMX");

me.users.pablo.name("Pablo");
me.users.pablo.age(17);
me.users.pablo.city("Monterrey");

me.users.luisa.name("Luisa");
me.users.luisa.age(31);
me.users.luisa.city("Xalapa");

me.users["[i]"]["="]("isAdult", "age >= 18");
me.users["[i]"]["="]("ageGapVsOwner", "age - profile.age");
me.users["[i]"]["="]("canInvite", "isAdult && age < 30");

me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
me.friends.luisa["->"]("users.luisa");

section("Identity + Public Graph");
show("profile summary", {
  name: me("profile.name"),
  age: me("profile.age"),
  city: me("profile.city"),
});
show("friends.ana.name", me("friends.ana.name"));
show("friends.ana.ageGapVsOwner", me("friends.ana.ageGapVsOwner"));
show("friends[isAdult == true].name", me("friends[isAdult == true].name"));
show("friends[canInvite == true].name", me("friends[canInvite == true].name"));

assert.deepEqual(me("friends[isAdult == true].name"), { ana: "Ana", luisa: "Luisa" });
assert.deepEqual(me("friends[canInvite == true].name"), { ana: "Ana" });
assert.equal(me("friends.ana.ageGapVsOwner"), -6);

section("Reactive Update");
show("adult friends before", me("friends[isAdult == true].name"));
me.users.pablo.age(18);
show("adult friends after pablo turns 18", me("friends[isAdult == true].name"));

assert.deepEqual(me("friends[isAdult == true].name"), {
  ana: "Ana",
  pablo: "Pablo",
  luisa: "Luisa",
});

section("Explain Public Derivation");
const publicTrace = showExplain("users.pablo.isAdult");
assert.equal(publicTrace.value, true);
assert.deepEqual(publicTrace.meta.dependsOn, ["users.pablo.age"]);

me.contacts.ana["_"]("thread-ana-key");
me.contacts.ana.lastSeenDays(3);
me.contacts.ana.priority(0.9);
me.contacts.ana["="]("needsReply", "lastSeenDays > 2");

section("Private Follow-up");
show("contacts.ana", me("contacts.ana"));
show("contacts.ana.needsReply", me("contacts.ana.needsReply"));
show("guest contacts.ana", me.as(null)("contacts.ana"));
show("guest contacts.ana.needsReply", me.as(null)("contacts.ana.needsReply"));

assert.equal(me("contacts.ana"), undefined);
assert.equal(me("contacts.ana.needsReply"), true);
assert.equal(me.as(null)("contacts.ana"), undefined);
assert.equal(me.as(null)("contacts.ana.needsReply"), undefined);

const privateTrace = showExplain("contacts.ana.needsReply");
assert.equal(privateTrace.value, true);
assert.equal(privateTrace.derivation?.inputs?.[0]?.origin, "stealth");
assert.equal(privateTrace.derivation?.inputs?.[0]?.masked, true);
assert.equal(privateTrace.derivation?.inputs?.[0]?.value, "●●●●");

section("Inspect Tail");
showInspect();

console.log("\nPASS: Social Graph demo\n");
