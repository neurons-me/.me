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

function approx(actual: number, expected: number, epsilon = 1e-10) {
  return Math.abs(actual - expected) <= epsilon;
}

function snapshotTarget(index: number) {
  return {
    code: me(`affinity.targets[${index}].code`),
    label: me(`affinity.targets[${index}].label`),
    score: me(`affinity.targets[${index}].score`),
    isStrong: me(`affinity.targets[${index}].isStrong`),
    needsNudge: me(`affinity.targets[${index}].needsNudge`),
  };
}

console.log("\n.me demo: Affinity Model");

me.affinity.targets[1].code("abc");
me.affinity.targets[1].label("Project ABC");
me.affinity.targets[1].recency(0.9);
me.affinity.targets[1].frequency(0.8);
me.affinity.targets[1].quality(0.7);

me.affinity.targets[2].code("xyz");
me.affinity.targets[2].label("Project XYZ");
me.affinity.targets[2].recency(0.4);
me.affinity.targets[2].frequency(0.5);
me.affinity.targets[2].quality(0.6);

me.affinity.targets[3].code("lmn");
me.affinity.targets[3].label("Project LMN");
me.affinity.targets[3].recency(0.6);
me.affinity.targets[3].frequency(0.6);
me.affinity.targets[3].quality(0.6);

me.affinity.targets["[i]"]["="]("score", "(recency + frequency + quality) / 3");
me.affinity.targets["[i]"]["="]("isStrong", "score >= 0.6");
me.affinity.targets["[i]"]["="]("needsNudge", "score < 0.55");

section("Initial Scoreboard");
show("scoreboard", {
  1: snapshotTarget(1),
  2: snapshotTarget(2),
  3: snapshotTarget(3),
});
show("affinity.targets[isStrong == true].label", me("affinity.targets[isStrong == true].label"));
show("affinity.targets[needsNudge == true].label", me("affinity.targets[needsNudge == true].label"));

assert.ok(approx(me("affinity.targets[1].score"), 0.8));
assert.ok(approx(me("affinity.targets[2].score"), 0.5));
assert.ok(approx(me("affinity.targets[3].score"), 0.6));
assert.deepEqual(me("affinity.targets[isStrong == true].label"), {
  1: "Project ABC",
  3: "Project LMN",
});
assert.deepEqual(me("affinity.targets[needsNudge == true].label"), {
  2: "Project XYZ",
});

section("Reactive Signal Update");
show("target 2 score before", me("affinity.targets[2].score"));
me.affinity.targets[2].recency(0.75);
show("target 2 score after", me("affinity.targets[2].score"));
show("strong targets after update", me("affinity.targets[isStrong == true].label"));

assert.ok(approx(me("affinity.targets[2].score"), 0.6166666666666667));
assert.deepEqual(me("affinity.targets[isStrong == true].label"), {
  1: "Project ABC",
  2: "Project XYZ",
  3: "Project LMN",
});

section("Explain Public Derivation");
const publicTrace = showExplain("affinity.targets[2].score");
assert.ok(approx(publicTrace.value, 0.6166666666666667));
assert.deepEqual(publicTrace.meta.dependsOn, [
  "affinity.targets.2.recency",
  "affinity.targets.2.frequency",
  "affinity.targets.2.quality",
]);

me.affinity.private["_"]("affinity-private-key");
me.affinity.private.boostThreshold(0.7);
me.affinity.private["="]("readyToBoost", "boostThreshold >= 0.7");

section("Private Policy Lane");
show("affinity.private", me("affinity.private"));
show("affinity.private.readyToBoost", me("affinity.private.readyToBoost"));
show("guest affinity.private", me.as(null)("affinity.private"));
show("guest affinity.private.readyToBoost", me.as(null)("affinity.private.readyToBoost"));

assert.equal(me("affinity.private"), undefined);
assert.equal(me("affinity.private.readyToBoost"), true);
assert.equal(me.as(null)("affinity.private"), undefined);
assert.equal(me.as(null)("affinity.private.readyToBoost"), undefined);

const privateTrace = showExplain("affinity.private.readyToBoost");
assert.equal(privateTrace.value, true);
assert.equal(privateTrace.derivation?.inputs?.[0]?.origin, "stealth");
assert.equal(privateTrace.derivation?.inputs?.[0]?.masked, true);
assert.equal(privateTrace.derivation?.inputs?.[0]?.value, "●●●●");

section("Inspect Tail");
showInspect();

console.log("\nPASS: Affinity Model demo\n");
