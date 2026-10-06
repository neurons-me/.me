// Port of Veracruz — .me kernel wiring (this.me@4.1.0, unmodified).
// KERNEL: every fact, every derived value, every wave (k) and every explain().
// ADAPTER (plain JS, labeled in the UI): the scheduler — which queue/ship goes
// next, next fact value = current − haul / ±1, queue rejoin/release policy.

export const SHIPS = [
  { i: 1, cargo: "coffee", unit: "t", total: 40000, haul: 200, tonsPerUnit: 1, stock: "coffee" },
  { i: 2, cargo: "sugar", unit: "t", total: 60000, haul: 200, tonsPerUnit: 1, stock: "sugar" },
  { i: 3, cargo: "containers", unit: "TEU", total: 2000, haul: 10, tonsPerUnit: 14, stock: "containers" },
];
export const TRAIN = { i: 1, cargo: "sugar", total: 50000, haul: 200, stock: "sugar" };
export const STOCKS = { coffee: 100000, sugar: 200000, containers: 5000 };
export const FLEET = 500;
export const QUEUE_DEPTH = { import: 8, export: 6 };

// Derived rules — the kernel's own `=` formulas. Explicit sums over the fixed 3 ships.
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
  [["cargo"], "bulkTons", "coffee + sugar"],
  [["port"], "busy", "flows.importRemaining + flows.exportRemaining > 0"],
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
  f.push([["trucks", "fleet"], FLEET],
    [["trucks", "available"], FLEET - QUEUE_DEPTH.import - QUEUE_DEPTH.export],
    [["queues", "import", "length"], QUEUE_DEPTH.import],
    [["queues", "export", "length"], QUEUE_DEPTH.export]);
  return f;
}

// segments → exact call text / canonical kernel path
export const codeOf = (segs) => "me" + segs.map((s) => (typeof s === "number" ? `[${s}]` : `.${s}`)).join("");
export const pathOf = (segs) => segs.join(".");
const nodeAt = (me, segs) => segs.reduce((n, s) => n[s], me);

export const DERIVED_PATHS = FORMULAS.map(([scope, name]) => pathOf([...scope, name]));
export const FACT_PATHS = seedFacts().map(([segs]) => pathOf(segs));

export function createPortKernel(ME) {
  const me = new ME();
  const seedLog = [];
  for (const [segs, v] of seedFacts()) {
    nodeAt(me, segs.slice(0, -1))[segs[segs.length - 1]](v);
    seedLog.push(`${codeOf(segs)}(${JSON.stringify(v)})`);
  }
  for (const [scope, name, expr] of FORMULAS) {
    nodeAt(me, scope)["="](name, expr);
    seedLog.push(`${codeOf(scope)}["="](${JSON.stringify(name)}, ${JSON.stringify(expr)})`);
  }
  for (const p of DERIVED_PATHS) me(p); // warm reads

  // The kernel stores the last recompute wave on every target it touched.
  // Right after writing S, any derived D whose kernel dependsOn includes S holds S's wave.
  function waveOf(source) {
    for (const d of DERIVED_PATHS) {
      const meta = me.explain(d)?.meta;
      if (meta?.dependsOn?.includes(source) && meta.sourcePath === source) {
        return { source, k: meta.k ?? 0, recomputed: meta.recomputed || [], changed: meta.changed || [] };
      }
    }
    return { source, k: 0, recomputed: [], changed: [] };
  }

  // Executes a real kernel write; returns the exact call text and the kernel's wave.
  function write(segs, value) {
    nodeAt(me, segs.slice(0, -1))[segs[segs.length - 1]](value);
    const code = `${codeOf(segs)}(${JSON.stringify(value)})`;
    return { code, ...waveOf(pathOf(segs)) };
  }

  const read = (p) => me(p);

  // ---- ADAPTER: scheduler (plain JS) ----
  let tick = 0;
  function cycle() {
    const writes = [];
    const R = (p) => me(p);
    const impWork = R("flows.importHasWork") && R("queues.import.length") > 0;
    const expWork = R("flows.exportHasWork") && R("queues.export.length") > 0;
    if (!impWork && !expWork) {
      // release any trucks still queued (no work left)
      for (const q of ["import", "export"]) {
        const L = R(`queues.${q}.length`);
        if (L > 0) {
          writes.push(write(["queues", q, "length"], 0));
          writes.push(write(["trucks", "available"], R("trucks.available") + L));
        }
      }
      return { kind: "idle", tick, writes, done: true };
    }
    tick++;
    const kind = impWork && expWork ? (tick % 2 === 1 ? "import" : "export") : impWork ? "import" : "export";
    let target;
    if (kind === "import") {
      const ship = SHIPS.filter((s) => R(`ships.${s.i}.hasWork`))
        .sort((a, b) => R(`ships.${b.i}.remainingTons`) - R(`ships.${a.i}.remainingTons`))[0];
      const rem = R(`ships.${ship.i}.remaining`);
      const haul = Math.min(R(`ships.${ship.i}.haul`), rem);
      writes.push(write(["queues", "import", "length"], R("queues.import.length") - 1));
      writes.push(write(["ships", ship.i, "remaining"], rem - haul));
      writes.push(write(["cargo", ship.stock], Math.max(0, R(`cargo.${ship.stock}`) - haul)));
      target = { ship: ship.i, haul, unit: ship.unit };
      // truck returns: rejoin queue if import work remains, else back to pool
      if (R("flows.importHasWork")) writes.push(write(["queues", "import", "length"], R("queues.import.length") + 1));
      else writes.push(write(["trucks", "available"], R("trucks.available") + 1));
    } else {
      const rem = R("train.1.remainingToLoad");
      const haul = Math.min(R("train.1.haul"), rem);
      writes.push(write(["queues", "export", "length"], R("queues.export.length") - 1));
      writes.push(write(["train", 1, "remainingToLoad"], rem - haul));
      writes.push(write(["cargo", TRAIN.stock], Math.max(0, R(`cargo.${TRAIN.stock}`) - haul)));
      target = { train: 1, haul, unit: "t" };
      if (R("flows.exportHasWork")) writes.push(write(["queues", "export", "length"], R("queues.export.length") + 1));
      else writes.push(write(["trucks", "available"], R("trucks.available") + 1));
    }
    return { kind, tick, target, writes, done: false };
  }

  // Correctness: rebuild a fresh kernel from the current facts + same formulas, compare every derived path.
  function verifyFromScratch() {
    const fresh = new ME();
    for (const [segs] of seedFacts()) nodeAt(fresh, segs.slice(0, -1))[segs[segs.length - 1]](me(pathOf(segs)));
    for (const [scope, name, expr] of FORMULAS) nodeAt(fresh, scope)["="](name, expr);
    const mismatches = [];
    for (const p of DERIVED_PATHS) {
      const a = me(p), b = fresh(p);
      if (!(a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9))) mismatches.push({ path: p, live: a, fresh: b });
    }
    // independent plain-arithmetic cross-check of the headline sums
    const imp = SHIPS.reduce((acc, s) => acc + me(`ships.${s.i}.remaining`) * s.tonsPerUnit, 0);
    if (imp !== me("flows.importRemaining")) mismatches.push({ path: "flows.importRemaining (arith)", live: me("flows.importRemaining"), fresh: imp });
    if (me("train.1.remainingToLoad") !== me("flows.exportRemaining")) mismatches.push({ path: "flows.exportRemaining (arith)" });
    return { ok: mismatches.length === 0, checked: DERIVED_PATHS.length, mismatches };
  }

  return { me, read, write, waveOf, cycle, verifyFromScratch, seedLog, get tick() { return tick; } };
}
