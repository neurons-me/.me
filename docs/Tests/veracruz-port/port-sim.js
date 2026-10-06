// Port of Veracruz — .me kernel wiring (this.me@4.1.0, unmodified).
// KERNEL: every fact, every derived value, every wave (k) and every explain().
// The traffic model that decides WHAT to write lives in port-traffic.js (adapter).

export const SHIPS = [
  { i: 1, cargo: "coffee", unit: "t", total: 40000, haul: 50, tonsPerUnit: 1, stock: "coffee" },
  { i: 2, cargo: "sugar", unit: "t", total: 60000, haul: 50, tonsPerUnit: 1, stock: "sugar" },
  { i: 3, cargo: "containers", unit: "TEU", total: 2000, haul: 2, tonsPerUnit: 14, stock: "containers" },
];
export const TRAIN = { i: 1, cargo: "sugar", total: 50000, haul: 50, stock: "sugar" };
export const STOCKS = { coffee: 100000, sugar: 200000, containers: 5000 };
export const FLEET = 500;

// Truck counters by state — kernel facts, mutated in batches by the adapter.
export const COUNTERS = [
  "trucks.available",
  "queues.import.length", "trucks.import.loading", "trucks.import.enRoute", "trucks.import.returning",
  "queues.export.length", "trucks.export.loading", "trucks.export.enRoute", "trucks.export.returning",
];

// Derived rules — the kernel's own `=` formulas. Explicit sums, bracket index paths.
export const FORMULAS = [
  ...SHIPS.flatMap((s) => [
    [["ships", s.i], "remainingTons", "remaining * tonsPerUnit"],
    [["ships", s.i], "progress", "1 - remaining / total"],
    [["ships", s.i], "hasWork", "remaining > 0"],
  ]),
  [["train", 1], "progress", "1 - remainingToLoad / total"],
  [["train", 1], "hasWork", "remainingToLoad > 0"],
  [["flows"], "importRemaining", "ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons"],
  [["flows"], "importTotal", "ships[1].total * ships[1].tonsPerUnit + ships[2].total * ships[2].tonsPerUnit + ships[3].total * ships[3].tonsPerUnit"],
  [["flows"], "importProgress", "1 - importRemaining / importTotal"],
  [["flows"], "importHasWork", "importRemaining > 0"],
  [["flows"], "exportRemaining", "train[1].remainingToLoad"],
  [["flows"], "exportHasWork", "exportRemaining > 0"],
  [["queues", "import"], "busy", "length > 0"],
  [["queues", "export"], "busy", "length > 0"],
  [["trucks"], "inQueue", "queues.import.length + queues.export.length"],
  [["trucks"], "loading", "trucks.import.loading + trucks.export.loading"],
  [["trucks"], "enRoute", "trucks.import.enRoute + trucks.export.enRoute"],
  [["trucks"], "returning", "trucks.import.returning + trucks.export.returning"],
  [["trucks"], "working", "trucks.inQueue + trucks.loading + trucks.enRoute + trucks.returning"],
  [["trucks"], "accounted", "trucks.working + trucks.available"],
  [["trucks"], "balanced", "trucks.accounted == trucks.fleet"],
  [["cargo"], "bulkTons", "coffee + sugar"],
  [["port"], "busy", "flows.importRemaining + flows.exportRemaining + trucks.working > 0"],
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
  f.push([["trucks", "fleet"], FLEET]);
  for (const c of COUNTERS) f.push([c.split("."), c === "trucks.available" ? FLEET : 0]);
  return f;
}

// path "ships.2.remaining" ⇄ segments ["ships", 2, "remaining"] ⇄ call text me.ships[2].remaining
export const segsOf = (path) => path.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s));
export const codeOf = (segs) => "me" + segs.map((s) => (typeof s === "number" ? `[${s}]` : `.${s}`)).join("");
export const pathOf = (segs) => segs.join(".");
const nodeAt = (me, segs) => segs.reduce((n, s) => n[s], me);
const setLeaf = (me, segs, v) => nodeAt(me, segs.slice(0, -1))[segs[segs.length - 1]](v);

export const DERIVED_PATHS = FORMULAS.map(([scope, name]) => pathOf([...scope, name]));
export const FACT_PATHS = seedFacts().map(([segs]) => pathOf(segs.map(String).map((s) => (/^\d+$/.test(s) ? Number(s) : s))));

export function createPortKernel(ME) {
  const me = new ME();
  const seedLog = [];
  for (const [segs, v] of seedFacts()) {
    const sg = segs.map((s) => (typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s));
    setLeaf(me, sg, v);
    seedLog.push(`${codeOf(sg)}(${JSON.stringify(v)})`);
  }
  for (const [scope, name, expr] of FORMULAS) {
    nodeAt(me, scope)["="](name, expr);
    seedLog.push(`${codeOf(scope)}["="](${JSON.stringify(name)}, ${JSON.stringify(expr)})`);
  }
  for (const p of DERIVED_PATHS) me(p); // warm reads

  // Reverse index from the kernel's own dependsOn: fact/derived S → one derived D that reads S.
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
    for (const [scope, name, expr] of FORMULAS) nodeAt(fresh, scope)["="](name, expr);
    const mismatches = [];
    for (const p of DERIVED_PATHS) {
      const a = me(p), b = fresh(p);
      if (!(a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9))) mismatches.push({ path: p, live: a, fresh: b });
    }
    const imp = SHIPS.reduce((acc, s) => acc + me(`ships.${s.i}.remaining`) * s.tonsPerUnit, 0);
    if (imp !== me("flows.importRemaining")) mismatches.push({ path: "flows.importRemaining (arith)", live: me("flows.importRemaining"), fresh: imp });
    const total = COUNTERS.reduce((a, c) => a + me(c), 0);
    if (total !== FLEET || me("trucks.balanced") !== true) mismatches.push({ path: "trucks.balanced (Σ counters)", live: total, fresh: FLEET });
    for (const [label, live, expected] of extraChecks) if (live !== expected) mismatches.push({ path: label, live, fresh: expected });
    return { ok: mismatches.length === 0, checked: DERIVED_PATHS.length + 2 + extraChecks.length, mismatches };
  }

  return { me, read, write, waveOf, verifyFromScratch, seedLog };
}
