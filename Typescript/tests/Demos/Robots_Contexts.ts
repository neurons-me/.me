import assert from "node:assert/strict";
import ME from "../../dist/index.js";

const me = new ME() as any;

me["@"]("robot-context-lab");

const ROBOTS = ["loader", "nurse", "courier", "surgeon"] as const;

function section(title: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(80)}\n`);
}

function note(text: string) {
  console.log(`  • ${text}`);
}

function formatValue(value: unknown) {
  return value === undefined ? "undefined" : JSON.stringify(value, null, 2);
}

function show(label: string, value: unknown) {
  console.log(`  ${label}`);
  console.log(
    "    → " +
      formatValue(value)
        .split("\n")
        .map((line, index) => (index === 0 ? line : "    " + line))
        .join("\n"),
  );
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
    "    → " +
      JSON.stringify(printable, null, 2)
        .split("\n")
        .map((line, index) => (index === 0 ? line : "    " + line))
        .join("\n"),
  );

  return trace;
}

function yesNo(value: unknown) {
  return value ? "YES" : "NO";
}

function pad(value: unknown, width: number) {
  const text = String(value ?? "—");
  return text.length >= width ? text.slice(0, width) : text.padEnd(width, " ");
}

function canisterSnapshot() {
  return {
    name: me("objects.canister7.name"),
    massKg: me("objects.canister7.massKg"),
    fragile: me("objects.canister7.fragile"),
    sterile: me("objects.canister7.sterile"),
  };
}

function contextSnapshot(name: string) {
  return {
    name: me(`contexts.${name}.name`),
    pickupZone: me(`contexts.${name}.pickupZone`),
    sterileZone: me(`contexts.${name}.sterileZone`),
    precisionZone: me(`contexts.${name}.precisionZone`),
    movingVehicles: me(`contexts.${name}.movingVehicles`),
  };
}

function robotSnapshot(name: string) {
  return {
    name: me(`robots.${name}.name`),
    context: me(`robots.${name}.context.name`),
    target: me(`robots.${name}.target.name`),
    liftCapacityKg: me(`robots.${name}.liftCapacityKg`),
    hasSoftGrip: me(`robots.${name}.hasSoftGrip`),
    requiresTargetSterile: me(`robots.${name}.requiresTargetSterile`),
    requiresPrecisionGrip: me(`robots.${name}.requiresPrecisionGrip`),
    canLift: me(`robots.${name}.canLift`),
    needsSoftGrip: me(`robots.${name}.needsSoftGrip`),
    softGripReady: me(`robots.${name}.softGripReady`),
    needsSterileHandling: me(`robots.${name}.needsSterileHandling`),
    needsSterileClearance: me(`robots.${name}.needsSterileClearance`),
    mustYield: me(`robots.${name}.mustYield`),
    needsHumanReview: me(`robots.${name}.needsHumanReview`),
    canProceed: me(`robots.${name}.canProceed`),
  };
}

function showRobotMap(title: string) {
  console.log(`\n  ${title}`);
  
  const cols = {
    robot: 14,
    context: 26,
    lift: 7,
    soft: 7,
    sterile: 9,
    yield: 7,
    review: 8,
    proceed: 9,
  };
  
  const draw = (char: string, len: number) => char.repeat(len);
  const cell = (text: string, width: number) => pad(text, width);
  
  console.log(`    ┌${draw("─", cols.robot)}┬${draw("─", cols.context)}┬${draw("─", cols.lift)}┬${draw("─", cols.soft)}┬${draw("─", cols.sterile)}┬${draw("─", cols.yield)}┬${draw("─", cols.review)}┬${draw("─", cols.proceed)}┐`);
  
  const header = `    │${cell("ROBOT", cols.robot)}│${cell("CONTEXT", cols.context)}│${cell("LIFT", cols.lift)}│${cell("SOFT", cols.soft)}│${cell("STERILE", cols.sterile)}│${cell("YIELD", cols.yield)}│${cell("REVIEW", cols.review)}│${cell("PROCEED", cols.proceed)}│`;
  console.log(header);
  
  console.log(`    ├${draw("─", cols.robot)}┼${draw("─", cols.context)}┼${draw("─", cols.lift)}┼${draw("─", cols.soft)}┼${draw("─", cols.sterile)}┼${draw("─", cols.yield)}┼${draw("─", cols.review)}┼${draw("─", cols.proceed)}┤`);

  for (const id of ROBOTS) {
    const canProceed = me(`robots.${id}.canProceed`);
    const needsReview = me(`robots.${id}.needsHumanReview`);
    const sterileCheck =
      me(`robots.${id}.needsSterileHandling`) || me(`robots.${id}.needsSterileClearance`);
    
    const lift = me(`robots.${id}.canLift`) ? "✓ OK" : "✗ BLK";
    const soft = me(`robots.${id}.needsSoftGrip`) ? "● YES" : "○ NO";
    const sterile = sterileCheck ? "● CHK" : "○ OK";
    const yieldVal = me(`robots.${id}.mustYield`) ? "● YES" : "○ NO";
    const review = needsReview ? "● YES" : "○ NO";
    const proceed = canProceed ? "✓ YES" : "✗ NO";
    
    const row = `    │${cell(me(`robots.${id}.name`), cols.robot)}│${cell(me(`robots.${id}.context.name`), cols.context)}│${cell(lift, cols.lift)}│${cell(soft, cols.soft)}│${cell(sterile, cols.sterile)}│${cell(yieldVal, cols.yield)}│${cell(review, cols.review)}│${cell(proceed, cols.proceed)}│`;
    console.log(row);
  }

  console.log(`    └${draw("─", cols.robot)}┴${draw("─", cols.context)}┴${draw("─", cols.lift)}┴${draw("─", cols.soft)}┴${draw("─", cols.sterile)}┴${draw("─", cols.yield)}┴${draw("─", cols.review)}┴${draw("─", cols.proceed)}┘`);
}

function defineRobot(
  id: string,
  input: {
    name: string;
    liftCapacityKg: number;
    contextPath: string;
    hasSoftGrip: boolean;
    requiresTargetSterile: boolean;
    requiresPrecisionGrip: boolean;
  },
) {
  me.robots[id].name(input.name);
  me.robots[id].liftCapacityKg(input.liftCapacityKg);
  me.robots[id].hasSoftGrip(input.hasSoftGrip);
  me.robots[id].requiresTargetSterile(input.requiresTargetSterile);
  me.robots[id].requiresPrecisionGrip(input.requiresPrecisionGrip);
  me.robots[id].target["->"]("objects.canister7");
  me.robots[id].context["->"](input.contextPath);
}

function applyRobotPolicies() {
  me.robots["[i]"]["="]("canLift", "target.massKg < liftCapacityKg");
  me.robots["[i]"]["="](
    "needsSoftGrip",
    "target.fragile && (context.pickupZone || context.precisionZone || requiresPrecisionGrip)",
  );
  me.robots["[i]"]["="]("softGripReady", "!needsSoftGrip || hasSoftGrip");
  me.robots["[i]"]["="]("needsSterileHandling", "context.sterileZone && !target.sterile");
  me.robots["[i]"]["="]("needsSterileClearance", "requiresTargetSterile && !target.sterile");
  me.robots["[i]"]["="]("mustYield", "context.movingVehicles");
  me.robots["[i]"]["="]("contextAllowsMotion", "!mustYield");
  me.robots["[i]"]["="](
    "needsHumanReview",
    "needsSterileHandling || needsSterileClearance || mustYield",
  );
  me.robots["[i]"]["="](
    "canProceed",
    "canLift && softGripReady && !needsHumanReview && contextAllowsMotion",
  );
}

console.log(`
+======================================================================+
| .me DEMO - Robots that Understand Context                            |
| Same object → Different meaning depending on robot + environment     |
+======================================================================+
`);

section("1. Shared Physical Object");
note("All robots point to the exact same canister.");
note("We print an explicit snapshot so the demo never shows undefined roots.");

me.objects.canister7.name("Blue Canister");
me.objects.canister7.massKg(6);
me.objects.canister7.fragile(true);
me.objects.canister7.sterile(false);

show("objects.canister7", canisterSnapshot());

section("2. Different Contexts");
note("The object is stable; the environment changes the meaning.");
note("SurgeonBot gets a stricter operating room context.");

me.contexts.warehouse.name("Warehouse Inbound");
me.contexts.warehouse.pickupZone(true);
me.contexts.warehouse.sterileZone(false);
me.contexts.warehouse.precisionZone(false);
me.contexts.warehouse.movingVehicles(false);

me.contexts.hospital.name("Hospital Sterile Corridor");
me.contexts.hospital.pickupZone(false);
me.contexts.hospital.sterileZone(true);
me.contexts.hospital.precisionZone(false);
me.contexts.hospital.movingVehicles(false);

me.contexts.street.name("Street Crossing");
me.contexts.street.pickupZone(false);
me.contexts.street.sterileZone(false);
me.contexts.street.precisionZone(false);
me.contexts.street.movingVehicles(true);

me.contexts.operatingRoom.name("Operating Room");
me.contexts.operatingRoom.pickupZone(false);
me.contexts.operatingRoom.sterileZone(true);
me.contexts.operatingRoom.precisionZone(true);
me.contexts.operatingRoom.movingVehicles(false);

show("contexts.warehouse", contextSnapshot("warehouse"));
show("contexts.hospital", contextSnapshot("hospital"));
show("contexts.street", contextSnapshot("street"));
show("contexts.operatingRoom", contextSnapshot("operatingRoom"));

section("3. Robots + Pointers");
note("All four robots point to the same object, but through different contexts.");

defineRobot("loader", {
  name: "Loader-1",
  liftCapacityKg: 20,
  contextPath: "contexts.warehouse",
  hasSoftGrip: true,
  requiresTargetSterile: false,
  requiresPrecisionGrip: false,
});

defineRobot("nurse", {
  name: "NurseBot-2",
  liftCapacityKg: 12,
  contextPath: "contexts.hospital",
  hasSoftGrip: false,
  requiresTargetSterile: false,
  requiresPrecisionGrip: false,
});

defineRobot("courier", {
  name: "Courier-3",
  liftCapacityKg: 18,
  contextPath: "contexts.street",
  hasSoftGrip: false,
  requiresTargetSterile: false,
  requiresPrecisionGrip: false,
});

defineRobot("surgeon", {
  name: "SurgeonBot-4",
  liftCapacityKg: 10,
  contextPath: "contexts.operatingRoom",
  hasSoftGrip: true,
  requiresTargetSterile: true,
  requiresPrecisionGrip: true,
});

show("robots.loader.target.name", me("robots.loader.target.name"));
show("robots.nurse.target.name", me("robots.nurse.target.name"));
show("robots.courier.target.name", me("robots.courier.target.name"));
show("robots.surgeon.target.name", me("robots.surgeon.target.name"));

section("4. Context-Aware Policies");
note("Loader cares about pickup grip.");
note("NurseBot cares about sterile context.");
note("Courier cares about traffic.");
note("SurgeonBot is stricter: sterile target + precision grip.");

applyRobotPolicies();

show("robots.loader", robotSnapshot("loader"));
show("robots.nurse", robotSnapshot("nurse"));
show("robots.courier", robotSnapshot("courier"));
show("robots.surgeon", robotSnapshot("surgeon"));
showRobotMap("Robot map BEFORE live updates");

const softGripNames = me("robots[needsSoftGrip == true].name") as Record<string, string>;
const sterileNames = me("robots[needsSterileHandling == true].name") as Record<string, string>;
const yieldNames = me("robots[mustYield == true].name") as Record<string, string>;

show("robots[needsSoftGrip == true].name", softGripNames);
show("robots[needsSterileHandling == true].name", sterileNames);
show("robots[mustYield == true].name", yieldNames);
show("robots[canProceed == true].name", me("robots[canProceed == true].name"));

assert.equal(me("robots.loader.canProceed"), true);
assert.equal(me("robots.nurse.canProceed"), false);
assert.equal(me("robots.courier.canProceed"), false);
assert.equal(me("robots.surgeon.canProceed"), false);
assert.equal(softGripNames.loader, "Loader-1");
assert.equal(softGripNames.surgeon, "SurgeonBot-4");
assert.equal(sterileNames.nurse, "NurseBot-2");
assert.equal(sterileNames.surgeon, "SurgeonBot-4");
assert.equal(yieldNames.courier, "Courier-3");

section("5. Live Updates");
note("Changing the world → all robots re-evaluate automatically.");
note("Sterilize the canister. Clear the street. The strict robot should also unlock.");

me.objects.canister7.sterile(true);
me.contexts.street.movingVehicles(false);
applyRobotPolicies();

show("objects.canister7 AFTER sterilization", canisterSnapshot());
show("contexts.street AFTER traffic clears", contextSnapshot("street"));
show("robots.nurse.canProceed", me("robots.nurse.canProceed"));
show("robots.courier.canProceed", me("robots.courier.canProceed"));
show("robots.surgeon.canProceed", me("robots.surgeon.canProceed"));
show("robots[canProceed == true].name", me("robots[canProceed == true].name"));
showRobotMap("Robot map AFTER live updates");

assert.equal(me("robots.nurse.canProceed"), true);
assert.equal(me("robots.courier.canProceed"), true);
assert.equal(me("robots.surgeon.canProceed"), true);
assert.deepEqual(me("robots[canProceed == true].name"), {
  loader: "Loader-1",
  nurse: "NurseBot-2",
  courier: "Courier-3",
  surgeon: "SurgeonBot-4",
});

section("6. Explainability");
const nurseTrace = showExplain("robots.nurse.canProceed");
const surgeonTrace = showExplain("robots.surgeon.canProceed");

assert.equal(nurseTrace.value, true);
assert.equal(surgeonTrace.value, true);
assert.ok((nurseTrace.meta?.dependsOn ?? []).includes("robots.nurse.contextAllowsMotion"));
assert.ok((surgeonTrace.meta?.dependsOn ?? []).includes("robots.surgeon.softGripReady"));
assert.ok((surgeonTrace.meta?.dependsOn ?? []).includes("robots.surgeon.needsHumanReview"));

console.log(`
+======================================================================+
| ✓ DEMO COMPLETED - Robots truly understand context                   |
| - one shared object, multiple interpretations                        |
| - a stricter SurgeonBot adds precision + sterile requirements        |
| - declarative policies broadcast to all robots                       |
| - live reactivity updates every robot without new imperative code    |
| - the robot map makes the whole scene readable at a glance           |
+======================================================================+
`);
