// Port of Veracruz — .me kernel wiring (this.me@4.1.0, unmodified).
// KERNEL: every fact, every derived value, every wave (k) and every explain().
// The traffic model that decides WHAT to write lives in port-traffic.js (adapter).

import { TRIPS as LM_TRIPS } from "./port-lastmile.js";

export const SHIPS = [
  { i: 1, cargo: "coffee", unit: "t", total: 40000, haul: 50, tonsPerUnit: 1, stock: "coffee" },
  { i: 2, cargo: "sugar", unit: "t", total: 60000, haul: 50, tonsPerUnit: 1, stock: "sugar" },
  { i: 3, cargo: "containers", unit: "TEU", total: 2000, haul: 2, tonsPerUnit: 14, stock: "containers" },
];
export const TRAIN = { i: 1, cargo: "sugar", total: 50000, haul: 50, stock: "sugar" };
export const STOCKS = { coffee: 100000, sugar: 200000, containers: 5000 };
export const FLEET = 500;
// Fleet split (assumption, not a sourced statistic): 400 heavy trucks for ship/train
// cargo + 100 small trucks for last-mile delivery from 2 CEDIS into the city.
export const HEAVY = 400;
export const LAST_MILE = 100;
// Last-mile: an EXAMPLE schedule of 1,000 trips (port-lastmile.js, seeded), goods in kg.
export const TRIP_COUNT = LM_TRIPS.length;
export const LOCAL_KG = LM_TRIPS.reduce((a, t) => a + t[6], 0);
export const BAND = 0.15;   // rebalancing band: units within avg ± 15% trips
export const UNIT_IDS = Array.from({ length: LAST_MILE }, (_, i) => i + 1);

// Truck counters by state — kernel facts, mutated in batches by the adapter.
export const HEAVY_COUNTERS = [
  "trucks.heavy.available",
  "queues.import.length", "trucks.import.loading", "trucks.import.enRoute", "trucks.import.returning",
  "queues.export.length", "trucks.export.loading", "trucks.export.enRoute", "trucks.export.returning",
];
export const LAST_MILE_COUNTERS = [
  "trucks.lastMile.available", "trucks.lastMile.loading", "trucks.lastMile.enRoute", "trucks.lastMile.returning",
];
export const COUNTERS = [...HEAVY_COUNTERS, ...LAST_MILE_COUNTERS];
// Trip states (kernel facts, adapter-written counters): every trip is in exactly one.
export const TRIP_COUNTERS = ["trips.unassigned", "trips.planned", "trips.active", "trips.done", "trips.unscheduled"];
// Unit band classification (adapter classifies with the kernel's bandHigh/bandLow, writes the counts).
export const BAND_COUNTERS = ["lastMile.unitsAbove", "lastMile.unitsWithin", "lastMile.unitsBelow"];
// Adapter aggregates written as facts (the kernel has no min()/max()): labelled "adapter aggregate" in the UI.
export const ADAPTER_AGGREGATES = ["trips.unitMax", "trips.unitMin"];
const POOL_COUNTERS = { "trucks.heavy.available": HEAVY, "trucks.lastMile.available": LAST_MILE };

// Instance facts per class (seeded below for every index).
export const SHIP_FIELDS = ["cargo", "unit", "total", "remaining", "haul", "tonsPerUnit"];
export const TRAIN_FIELDS = ["cargo", "total", "remainingToLoad", "haul"];
// Class templates — ONE formula text per family; the kernel applies it to every index of that family
// (me.ships["[i]"]["="](name, expr) → ships[1], ships[2], ships[3], and any ships[n] added later).
// `ids` = the instances seeded here; the kernel itself does not need them (templates apply to every index).
const SHIP_IDS = SHIPS.map((s) => s.i);
export const TEMPLATES = [
  { family: ["ships"], name: "remainingTons", expr: "remaining * tonsPerUnit", ids: SHIP_IDS },
  { family: ["ships"], name: "progress", expr: "1 - remaining / total", ids: SHIP_IDS },
  { family: ["ships"], name: "hasWork", expr: "remaining > 0", ids: SHIP_IDS },
  { family: ["train"], name: "progress", expr: "1 - remainingToLoad / total", ids: [TRAIN.i] },
  { family: ["train"], name: "hasWork", expr: "remainingToLoad > 0", ids: [TRAIN.i] },
];
export const templateCode = (t) => `${codeOf(t.family)}["[i]"]["="](${JSON.stringify(t.name)}, ${JSON.stringify(t.expr)})`;

// Derived rules — the kernel's own `=` formulas. Explicit sums, bracket index paths.
export const FORMULAS = [
  [["flows"], "importRemaining", "ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons"],
  [["flows"], "importTotal", "ships[1].total * ships[1].tonsPerUnit + ships[2].total * ships[2].tonsPerUnit + ships[3].total * ships[3].tonsPerUnit"],
  [["flows"], "importProgress", "1 - importRemaining / importTotal"],
  [["flows"], "importHasWork", "importRemaining > 0"],
  [["flows"], "exportRemaining", "train[1].remainingToLoad"],
  [["flows"], "exportHasWork", "exportRemaining > 0"],
  [["queues", "import"], "busy", "length > 0"],
  [["queues", "export"], "busy", "length > 0"],
  [["localDelivery"], "deliveredKg", "totalKg - remainingKg"],
  [["localDelivery"], "progress", "1 - remainingKg / totalKg"],
  [["trips"], "pending", "trips.unassigned + trips.planned + trips.active"],
  [["trips"], "assigned", "trips.planned + trips.active + trips.done"],
  [["trips"], "accounted", "trips.done + trips.pending + trips.unscheduled"],
  [["trips"], "balanced", "trips.accounted == trips.total"],
  [["trips"], "doneShare", "trips.done / trips.total"],
  [["trips"], "perUnitAvg", "trips.assigned / trucks.lastMile.fleet"],
  [["trips"], "perUnitDoneAvg", "trips.done / trucks.lastMile.fleet"],
  [["trips"], "bandHigh", "trips.perUnitAvg + trips.perUnitAvg * trips.band"],
  [["trips"], "bandLow", "trips.perUnitAvg - trips.perUnitAvg * trips.band"],
  [["lastMile"], "unitDoneSum", UNIT_IDS.map((i) => `lastMile.units[${i}].done`).join(" + ")],
  [["lastMile"], "unitSumOk", "lastMile.unitDoneSum == trips.done"],
  [["lastMile"], "unitsCounted", "lastMile.unitsAbove + lastMile.unitsWithin + lastMile.unitsBelow"],
  [["lastMile"], "unitsOk", "lastMile.unitsCounted == trucks.lastMile.fleet"],
  [["trucks", "heavy"], "working", "queues.import.length + queues.export.length + trucks.import.loading + trucks.export.loading + trucks.import.enRoute + trucks.export.enRoute + trucks.import.returning + trucks.export.returning"],
  [["trucks", "heavy"], "balanced", "trucks.heavy.working + trucks.heavy.available == trucks.heavy.fleet"],
  [["trucks", "lastMile"], "working", "trucks.lastMile.loading + trucks.lastMile.enRoute + trucks.lastMile.returning"],
  [["trucks", "lastMile"], "balanced", "trucks.lastMile.working + trucks.lastMile.available == trucks.lastMile.fleet"],
  [["trucks"], "inQueue", "queues.import.length + queues.export.length"],
  [["trucks"], "loading", "trucks.import.loading + trucks.export.loading + trucks.lastMile.loading"],
  [["trucks"], "enRoute", "trucks.import.enRoute + trucks.export.enRoute + trucks.lastMile.enRoute"],
  [["trucks"], "returning", "trucks.import.returning + trucks.export.returning + trucks.lastMile.returning"],
  [["trucks"], "available", "trucks.heavy.available + trucks.lastMile.available"],
  [["trucks"], "working", "trucks.inQueue + trucks.loading + trucks.enRoute + trucks.returning"],
  [["trucks"], "accounted", "trucks.working + trucks.available"],
  [["trucks"], "balanced", "trucks.accounted == trucks.fleet"],
  [["trucks"], "splitOk", "trucks.heavy.fleet + trucks.lastMile.fleet == trucks.fleet"],
  [["cargo"], "bulkTons", "coffee + sugar"],
  [["port"], "busy", "flows.importRemaining + flows.exportRemaining + trips.pending + trucks.working > 0"],
];

export function seedFacts() {
  const f = [[["port", "name"], "Veracruz"]];
  for (const s of SHIPS) {
    f.push([["ships", s.i, "cargo"], s.cargo], [["ships", s.i, "unit"], s.unit],
      [["ships", s.i, "total"], s.total], [["ships", s.i, "remaining"], s.total],
      [["ships", s.i, "haul"], s.haul], [["ships", s.i, "tonsPerUnit"], s.tonsPerUnit]);
  }
  f.push([["train", 1, "cargo"], TRAIN.cargo], [["train", 1, "total"], TRAIN.total],
    [["train", 1, "remainingToLoad"], TRAIN.total], [["train", 1, "haul"], TRAIN.haul]);
  for (const [k, v] of Object.entries(STOCKS)) f.push([["cargo", k], v]);
  f.push([["localDelivery", "totalKg"], LOCAL_KG], [["localDelivery", "remainingKg"], LOCAL_KG]);
  f.push([["trips", "total"], TRIP_COUNT], [["trips", "band"], BAND], [["trips", "redirects"], 0]);
  for (const c of TRIP_COUNTERS) f.push([c.split("."), c === "trips.unassigned" ? TRIP_COUNT : 0]);
  for (const c of BAND_COUNTERS) f.push([c.split("."), c === "lastMile.unitsWithin" ? LAST_MILE : 0]);
  for (const c of ADAPTER_AGGREGATES) f.push([c.split("."), 0]);
  for (const i of UNIT_IDS) f.push([["lastMile", "units", i, "done"], 0]);
  f.push([["trucks", "fleet"], FLEET], [["trucks", "heavy", "fleet"], HEAVY], [["trucks", "lastMile", "fleet"], LAST_MILE]);
  for (const c of COUNTERS) f.push([c.split("."), POOL_COUNTERS[c] ?? 0]);
  return f;
}

// path "ships.2.remaining" ⇄ segments ["ships", 2, "remaining"] ⇄ call text me.ships[2].remaining
export const segsOf = (path) => path.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s));
export const codeOf = (segs) => "me" + segs.map((s) => (typeof s === "number" ? `[${s}]` : `.${s}`)).join("");
export const pathOf = (segs) => segs.join(".");
const nodeAt = (me, segs) => segs.reduce((n, s) => n[s], me);
const setLeaf = (me, segs, v) => nodeAt(me, segs.slice(0, -1))[segs[segs.length - 1]](v);

// every derived path the kernel computes: each template expanded per instance, then the plain formulas
export const TEMPLATE_PATHS = TEMPLATES.flatMap((t) => t.ids.map((i) => pathOf([...t.family, i, t.name])));
export const DERIVED_PATHS = [...TEMPLATE_PATHS, ...FORMULAS.map(([scope, name]) => pathOf([...scope, name]))];
// install the rules on a kernel (live one and the fresh one in verifyFromScratch): templates, then formulas
function installRules(me, log) {
  for (const t of TEMPLATES) { nodeAt(me, t.family)["[i]"]["="](t.name, t.expr); log?.push(templateCode(t)); }
  for (const [scope, name, expr] of FORMULAS) {
    nodeAt(me, scope)["="](name, expr);
    log?.push(`${codeOf(scope)}["="](${JSON.stringify(name)}, ${JSON.stringify(expr)})`);
  }
}
export const FACT_PATHS = seedFacts().map(([segs]) => pathOf(segs));

export function createPortKernel(ME) {
  const me = new ME();
  const seedLog = [];
  for (const [segs, v] of seedFacts()) {
    const sg = segs.map((s) => (typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s));
    setLeaf(me, sg, v);
    seedLog.push(`${codeOf(sg)}(${JSON.stringify(v)})`);
  }
  installRules(me, seedLog);
  for (const p of DERIVED_PATHS) me(p); // warm reads (template instances included)

  // Reverse index from the kernel's own dependsOn: fact/derived S → one derived D that reads S
  // (template instances included: explain("ships.2.remainingTons").meta.dependsOn = ["ships.2.remaining", …]).
  // The kernel stores the last recompute wave on every target it touched, so right after a
  // write to S, D's explain().meta is exactly S's wave (k, recomputed, changed, sourcePath).
  const reader = {};
  for (const d of DERIVED_PATHS) for (const s of me.explain(d)?.meta?.dependsOn || []) reader[s] ??= d;

  function waveOf(source) {
    const d = reader[source];
    if (!d) return { source, k: 0, recomputed: [], changed: [] };
    const meta = me.explain(d)?.meta || {};
    if (meta.sourcePath !== source) return { source, k: 0, recomputed: [], changed: [] };
    return { source, k: meta.k ?? 0, recomputed: meta.recomputed || [], changed: meta.changed || [] };
  }

  // Real kernel write; returns the exact call text plus the kernel's wave for that write.
  function write(path, value) {
    const segs = segsOf(path);
    setLeaf(me, segs, value);
    return { code: `${codeOf(segs)}(${JSON.stringify(value)})`, ...waveOf(path) };
  }
  const read = (p) => me(p);

  function verifyFromScratch(extraChecks = []) {
    const fresh = new ME();
    for (const p of FACT_PATHS) setLeaf(fresh, segsOf(p), me(p));
    installRules(fresh);
    const mismatches = [];
    for (const p of DERIVED_PATHS) {
      const a = me(p), b = fresh(p);
      if (!(a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9))) mismatches.push({ path: p, live: a, fresh: b });
    }
    const imp = SHIPS.reduce((acc, s) => acc + me(`ships.${s.i}.remaining`) * s.tonsPerUnit, 0);
    if (imp !== me("flows.importRemaining")) mismatches.push({ path: "flows.importRemaining (arith)", live: me("flows.importRemaining"), fresh: imp });
    // no derived value may be undefined (the kernel returns undefined silently for unsupported syntax)
    for (const p of DERIVED_PATHS) if (me(p) === undefined) mismatches.push({ path: p + " (undefined)", live: undefined, fresh: "defined" });
    const sum = (list) => list.reduce((a, c) => a + me(c), 0);
    const checks = [
      ["Σ all counters = fleet", sum(COUNTERS), FLEET],
      ["Σ heavy counters = heavy fleet", sum(HEAVY_COUNTERS), HEAVY],
      ["Σ last-mile counters = last-mile fleet", sum(LAST_MILE_COUNTERS), LAST_MILE],
      ["trucks.balanced", me("trucks.balanced"), true],
      ["trucks.heavy.balanced", me("trucks.heavy.balanced"), true],
      ["trucks.lastMile.balanced", me("trucks.lastMile.balanced"), true],
      ["trucks.splitOk", me("trucks.splitOk"), true],
      ["localDelivery.deliveredKg (arith)", me("localDelivery.deliveredKg"), me("localDelivery.totalKg") - me("localDelivery.remainingKg")],
      ["trips: done + pending + unscheduled = total", me("trips.done") + me("trips.pending") + me("trips.unscheduled"), TRIP_COUNT],
      ["trips: Σ state counters = total", sum(TRIP_COUNTERS), TRIP_COUNT],
      ["trips.balanced", me("trips.balanced"), true],
      ["Σ units[i].done = trips.done", UNIT_IDS.reduce((a, i) => a + me(`lastMile.units.${i}.done`), 0), me("trips.done")],
      ["lastMile.unitSumOk", me("lastMile.unitSumOk"), true],
      ["above + within + below = last-mile units", sum(BAND_COUNTERS), LAST_MILE],
      ["lastMile.unitsOk", me("lastMile.unitsOk"), true],
    ];
    const near = (a, b) => typeof a === "number" && Math.abs(a - b) < 1e-9;
    const avg = (me("trips.planned") + me("trips.active") + me("trips.done")) / LAST_MILE;
    if (!near(me("trips.bandHigh"), avg * (1 + BAND))) mismatches.push({ path: "trips.bandHigh (arith avg × 1.15)", live: me("trips.bandHigh"), fresh: avg * (1 + BAND) });
    if (!near(me("trips.bandLow"), avg * (1 - BAND))) mismatches.push({ path: "trips.bandLow (arith avg × 0.85)", live: me("trips.bandLow"), fresh: avg * (1 - BAND) });
    for (const [label, live, expected] of checks) if (live !== expected) mismatches.push({ path: label, live, fresh: expected });
    for (const [label, live, expected] of extraChecks) if (live !== expected) mismatches.push({ path: label, live, fresh: expected });
    return { ok: mismatches.length === 0, checked: DERIVED_PATHS.length * 2 + 1 + 16 + 2 + extraChecks.length, mismatches };
  }

  return { me, read, write, waveOf, verifyFromScratch, seedLog };
}
