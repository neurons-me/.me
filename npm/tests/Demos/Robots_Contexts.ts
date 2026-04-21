import assert from "node:assert/strict";
import ME from "this.me";

const me = new ME() as any;

function section(title: string) {
  console.log(`\n${"=".repeat(64)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(64)}`);
}

function note(text: string) {
  console.log(`\n  - ${text}`);
}

function show(label: string, value: unknown) {
  const formatted =
    value === undefined
      ? "undefined"
      : JSON.stringify(value, null, 2)
          .split("\n")
          .map((line, index) => (index === 0 ? line : "    " + line))
          .join("\n");
  console.log(`\n  ${label}\n    -> ${formatted}`);
}

function showExplain(path: string) {
  const trace = me.explain(path);
  const printable = {
    value: trace.value,
    expression: trace.derivation?.expression ?? null,
    inputs: (trace.derivation?.inputs ?? []).map((input: any) => ({
      label: input.label,
      value: input.masked ? "MASKED" : input.value,
      origin: input.origin,
    })),
    dependsOn: trace.meta?.dependsOn ?? [],
  };

  console.log(`\n  explain("${path}")`);
  console.log(
    "    -> " +
      JSON.stringify(printable, null, 2)
        .split("\n")
        .map((line, index) => (index === 0 ? line : "    " + line))
        .join("\n"),
  );

  return trace;
}

function applyRobotPolicies() {
  me.robots["[i]"]["="]("canLift", "target.massKg < liftCapacityKg");
  me.robots["[i]"]["="]("needsSoftGrip", "target.fragile && context.pickupZone");
  me.robots["[i]"]["="]("needsSterileHandling", "context.sterileZone && !target.sterile");
  me.robots["[i]"]["="]("mustYield", "context.movingVehicles");
  me.robots["[i]"]["="]("canPickDirectly", "context.pickupZone && canLift");
  me.robots["[i]"]["="]("contextAllowsMotion", "canPickDirectly || !context.pickupZone");
  me.robots["[i]"]["="]("needsHumanReview", "needsSterileHandling || mustYield");
  me.robots["[i]"]["="]("canProceed", "canLift && !needsHumanReview && contextAllowsMotion");
}

console.log(`
+------------------------------------------------------------------+
| .me demo - Robots understand context                             |
| Same object, different context, different action                 |
+------------------------------------------------------------------+
`);

section("1 · Shared object");

note("All robots point to the exact same physical object.");
note("The object itself stays stable. Meaning changes with context.");

me["@"]("robot-context-lab");

me.objects.canister7.name("Blue canister");
me.objects.canister7.massKg(6);
me.objects.canister7.fragile(true);
me.objects.canister7.sterile(false);

show("objects.canister7", me("objects.canister7"));

section("2 · Contexts");

note("Warehouse context: object is cargo.");
note("Hospital context: object may require sterile handling.");
note("Street context: object may be safe, but traffic changes the action.");

me.contexts.warehouse.name("Warehouse inbound lane");
me.contexts.warehouse.pickupZone(true);
me.contexts.warehouse.sterileZone(false);
me.contexts.warehouse.movingVehicles(false);

me.contexts.hospital.name("Hospital sterile corridor");
me.contexts.hospital.pickupZone(false);
me.contexts.hospital.sterileZone(true);
me.contexts.hospital.movingVehicles(false);

me.contexts.street.name("Street crossing");
me.contexts.street.pickupZone(false);
me.contexts.street.sterileZone(false);
me.contexts.street.movingVehicles(true);

show("contexts.warehouse", me("contexts.warehouse"));
show("contexts.hospital", me("contexts.hospital"));
show("contexts.street", me("contexts.street"));

section("3 · Robots link the same object to different contexts");

me.robots.loader.name("Loader-1");
me.robots.loader.liftCapacityKg(20);
me.robots.loader.target["->"]("objects.canister7");
me.robots.loader.context["->"]("contexts.warehouse");

me.robots.nurse.name("NurseBot-2");
me.robots.nurse.liftCapacityKg(12);
me.robots.nurse.target["->"]("objects.canister7");
me.robots.nurse.context["->"]("contexts.hospital");

me.robots.courier.name("Courier-3");
me.robots.courier.liftCapacityKg(18);
me.robots.courier.target["->"]("objects.canister7");
me.robots.courier.context["->"]("contexts.street");

show("robots.loader.target.name", me("robots.loader.target.name"));
show("robots.nurse.target.name", me("robots.nurse.target.name"));
show("robots.courier.target.name", me("robots.courier.target.name"));

section("4 · Context-aware understanding");

note("The same object yields different flags depending on robot context.");
note("Warehouse cares about grip and pickup.");
note("Hospital cares about sterility.");
note("Street robot cares about traffic conditions.");

applyRobotPolicies();

show("robots.loader", {
  canLift: me("robots.loader.canLift"),
  needsSoftGrip: me("robots.loader.needsSoftGrip"),
  needsSterileHandling: me("robots.loader.needsSterileHandling"),
  mustYield: me("robots.loader.mustYield"),
  canProceed: me("robots.loader.canProceed"),
});

show("robots.nurse", {
  canLift: me("robots.nurse.canLift"),
  needsSoftGrip: me("robots.nurse.needsSoftGrip"),
  needsSterileHandling: me("robots.nurse.needsSterileHandling"),
  mustYield: me("robots.nurse.mustYield"),
  canProceed: me("robots.nurse.canProceed"),
});

show("robots.courier", {
  canLift: me("robots.courier.canLift"),
  needsSoftGrip: me("robots.courier.needsSoftGrip"),
  needsSterileHandling: me("robots.courier.needsSterileHandling"),
  mustYield: me("robots.courier.mustYield"),
  canProceed: me("robots.courier.canProceed"),
});

show("robots[needsSoftGrip == true].name", me("robots[needsSoftGrip == true].name"));
show("robots[needsSterileHandling == true].name", me("robots[needsSterileHandling == true].name"));
show("robots[mustYield == true].name", me("robots[mustYield == true].name"));
show("robots[canProceed == true].name", me("robots[canProceed == true].name"));

assert.equal(me("robots.loader.canProceed"), true);
assert.equal(me("robots.nurse.canProceed"), false);
assert.equal(me("robots.courier.canProceed"), false);
assert.deepEqual(me("robots[needsSoftGrip == true].name"), { loader: "Loader-1" });
assert.deepEqual(me("robots[needsSterileHandling == true].name"), { nurse: "NurseBot-2" });
assert.deepEqual(me("robots[mustYield == true].name"), { courier: "Courier-3" });

section("5 · Live updates change understanding without changing robot code");

note("Once the canister becomes sterile, the hospital robot can proceed.");
note("Once traffic clears, the street robot can proceed.");

me.objects.canister7.sterile(true);
me.contexts.street.movingVehicles(false);
applyRobotPolicies();

show("robots.nurse.canProceed AFTER sterilization", me("robots.nurse.canProceed"));
show("robots.courier.canProceed AFTER traffic clears", me("robots.courier.canProceed"));
show("robots[canProceed == true].name AFTER updates", me("robots[canProceed == true].name"));
showExplain("robots.nurse.canProceed");
showExplain("robots.courier.canProceed");

assert.equal(me("robots.nurse.canProceed"), true);
assert.equal(me("robots.courier.canProceed"), true);
assert.deepEqual(me("robots[canProceed == true].name"), {
  courier: "Courier-3",
  loader: "Loader-1",
  nurse: "NurseBot-2",
});

section("6 · Audit why a robot made the call");

const nurseTrace = showExplain("robots.nurse.canProceed");
const courierTrace = showExplain("robots.courier.canProceed");

assert.equal(nurseTrace.value, true);
assert.equal(courierTrace.value, true);
assert.ok((nurseTrace.meta?.dependsOn ?? []).includes("robots.nurse.target.sterile"));
assert.ok((courierTrace.meta?.dependsOn ?? []).includes("robots.courier.context.movingVehicles"));

console.log(`
+------------------------------------------------------------------+
| PASS: Robots + Contexts demo                                     |
|                                                                  |
| What this demo showed:                                           |
| - one shared object can mean different things in different paths |
| - pointers let robots reuse the same world state                 |
| - context branches change interpretation without branching code  |
| - broadcast derivations scale the policy to every robot          |
| - explain() shows why a robot decided to act                     |
+------------------------------------------------------------------+
`);