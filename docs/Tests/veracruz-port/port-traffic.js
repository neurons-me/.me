// Port of Veracruz — truck traffic ADAPTER (plain JS, not kernel).
// Decides what happens to each of the 500 trucks (routes, queues, berths, timers) and
// accumulates the resulting fact changes as deltas. flush() turns the deltas into
// REAL kernel writes (one write per changed fact per flush); the kernel then
// recomputes every derived value and reports its own wave (k).
import { SHIPS, TRAIN, FLEET } from "./port-sim.js";

export const CONFIG = {
  berthSlots: 16,          // trucks loading at once per ship
  trainSlots: 10,          // trucks unloading into the train at once
  loadSec: [4, 7],           // ship → truck
  trainSec: [4, 6],        // truck → train
  speed: [38, 54],         // SVG px per sim second
  awaySec: [10, 22],       // each off-map leg (deliver / pick up), sim seconds
  dispatchPerSec: 6,       // pool release rate (staggered start)
  exits: ["nw", "sw", "s"],
};

// adapter state → kernel counter fact
export const COUNTER_OF = {
  pool: "trucks.available",
  impToQueue: "trucks.import.returning", impQueued: "queues.import.length",
  impToBerth: "trucks.import.loading", impLoading: "trucks.import.loading",
  impOut: "trucks.import.enRoute", impAway: "trucks.import.enRoute", impBack: "trucks.import.returning",
  expOut: "trucks.export.returning", expAway: "trucks.export.returning", expIn: "trucks.export.enRoute",
  expQueued: "queues.export.length", expToTrain: "trucks.export.loading", expUnloading: "trucks.export.loading",
  toDepotImp: "trucks.import.returning", toDepotExp: "trucks.export.returning",
};
// drawing class per state
export const VIS_OF = {
  pool: "idle", impToQueue: "returning", impQueued: "queued", impToBerth: "loading", impLoading: "loading",
  impOut: "enRouteImp", impAway: null, impBack: null, expOut: "returning", expAway: null, expIn: "enRouteExp",
  expQueued: "queued", expToTrain: "loading", expUnloading: "loading", toDepotImp: "returning", toDepotExp: "returning",
};

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function prepRoute(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
const rev = (pts) => pts.slice().reverse();
const cat = (...rs) => rs.reduce((a, r) => a.concat(a.length ? r.slice(1) : r), []);

export function createTraffic({ kernel, ROUTES, KEY, seed = 7 }) {
  const rnd = mulberry32(seed);
  const between = ([a, b]) => a + (b - a) * rnd();
  const R = {};
  for (const [k, v] of Object.entries(ROUTES)) R[k] = prepRoute(v);
  R["train>depot"] = prepRoute(cat(rev(ROUTES["qexp>train"]), ROUTES["qexp>depot"]));
  R["train>qimp"] = prepRoute(cat(rev(ROUTES["qexp>train"]), ROUTES["qexp>depot"], ROUTES["depot>qimp"]));

  const trucks = [];
  for (let id = 0; id < FLEET; id++) trucks.push({ id, st: "pool", flow: null, route: null, d: 0, seg: 0, spd: between(CONFIG.speed), t: 0, ship: 0, slot: -1, amount: 0, exit: null, x: 0, y: 0 });
  const impQ = [], expQ = [];
  const berthUsed = { 1: new Array(CONFIG.berthSlots).fill(false), 2: new Array(CONFIG.berthSlots).fill(false), 3: new Array(CONFIG.berthSlots).fill(false) };
  const trainUsed = new Array(CONFIG.trainSlots).fill(false);
  const reservedImp = { 1: 0, 2: 0, 3: 0 };   // amounts held by trucks at/to a berth (not yet written)
  let reservedExp = 0;                        // amounts committed by export trucks not yet unloaded
  const deltas = new Map();                   // kernel fact → pending delta (flushed as real writes)
  const hauls = new Map();                    // kernel fact → hauls in this batch (annotation only)
  let simTime = 0, dispatchAcc = 0, totalWrites = 0, totalFlushes = 0, totalHauls = 0;
  const stateCount = Object.fromEntries(Object.keys(COUNTER_OF).map((s) => [s, 0]));
  stateCount.pool = FLEET;

  const addDelta = (path, v) => deltas.set(path, (deltas.get(path) || 0) + v);
  const pending = (path) => deltas.get(path) || 0;
  const live = (path) => kernel.read(path) + pending(path);   // kernel value + not-yet-flushed delta

  function setState(tr, st) {
    const a = COUNTER_OF[tr.st], b = COUNTER_OF[st];
    stateCount[tr.st]--; stateCount[st]++;
    if (a !== b) { addDelta(a, -1); addDelta(b, +1); }
    tr.st = st;
  }
  function go(tr, st, routeKey) { setState(tr, st); tr.route = R[routeKey]; tr.d = 0; tr.seg = 0; tr.x = tr.route.pts[0][0]; tr.y = tr.route.pts[0][1]; }
  const pickExit = () => CONFIG.exits[Math.floor(rnd() * CONFIG.exits.length)];

  // ── open work (kernel value + pending deltas − reservations) ──
  function importOpen() {
    let hauls = 0;
    for (const s of SHIPS) hauls += Math.ceil(Math.max(0, live(`ships.${s.i}.remaining`) - reservedImp[s.i]) / s.haul);
    const heading = stateCount.impToQueue + stateCount.impQueued;
    return hauls - heading;
  }
  function exportOpen() {
    return Math.ceil(Math.max(0, live("train.1.remainingToLoad") - reservedExp) / TRAIN.haul);
  }
  const flowCount = (f) => trucks.reduce((a, t) => a + (t.st !== "pool" && t.flow === f ? 1 : 0), 0);

  // A free truck (at `from`: "depot" | exit key | "train") picks its next job.
  function decide(tr, from) {
    const io = importOpen(), eo = exportOpen();
    let flow = null;
    if (io > 0 || eo > 0) {
      const ci = flowCount("import"), ce = flowCount("export");
      flow = io > 0 && (eo <= 0 || io / (ci + 1) >= eo / (ce + 1)) ? "import" : "export";
    }
    if (flow === "import") {
      tr.flow = "import";
      if (from === "depot") go(tr, "impToQueue", "depot>qimp");
      else if (from === "train") go(tr, "impToQueue", "train>qimp");
      else go(tr, "impToQueue", `${from}>qimp`);
      return true;
    }
    if (flow === "export") {
      tr.flow = "export";
      tr.amount = Math.min(TRAIN.haul, live("train.1.remainingToLoad") - reservedExp);
      reservedExp += tr.amount;
      if (from === "depot" || from === "train") { tr.exit = pickExit(); go(tr, "expOut", `${from}>${tr.exit}`); }
      else { tr.exit = from; go(tr, "expIn", `${from}>qexp`); }   // already outside: pick up cargo there
      return true;
    }
    // no work: back to the pool
    if (from === "depot") return false;
    tr.flow = tr.flow || "import";
    if (from === "train") go(tr, "toDepotExp", "train>depot");
    else go(tr, tr.flow === "export" ? "toDepotExp" : "toDepotImp", `${from}>depot`);
    return true;
  }

  function moveAlong(tr, dt) {
    const r = tr.route;
    tr.d += tr.spd * dt;
    if (tr.d >= r.len) { tr.d = r.len; const p = r.pts[r.pts.length - 1]; tr.x = p[0]; tr.y = p[1]; return true; }
    while (r.cum[tr.seg + 1] < tr.d) tr.seg++;
    const a = r.pts[tr.seg], b = r.pts[tr.seg + 1], u = (tr.d - r.cum[tr.seg]) / (r.cum[tr.seg + 1] - r.cum[tr.seg] || 1);
    tr.x = a[0] + (b[0] - a[0]) * u; tr.y = a[1] + (b[1] - a[1]) * u;
    return false;
  }

  function step(dt) {
    simTime += dt;
    // staggered release from the pool
    dispatchAcc += dt * CONFIG.dispatchPerSec;
    for (const tr of trucks) {
      if (dispatchAcc < 1) break;
      if (tr.st !== "pool") continue;
      if (!decide(tr, "depot")) break;
      dispatchAcc -= 1;
    }
    if (dispatchAcc > 3) dispatchAcc = 3;

    for (const tr of trucks) {
      switch (tr.st) {
        case "impToQueue": if (moveAlong(tr, dt)) { setState(tr, "impQueued"); impQ.push(tr); } break;
        case "impToBerth": if (moveAlong(tr, dt)) { setState(tr, "impLoading"); tr.t = between(CONFIG.loadSec); } break;
        case "impLoading":
          if ((tr.t -= dt) <= 0) {
            const s = SHIPS[tr.ship - 1];
            addDelta(`ships.${s.i}.remaining`, -tr.amount);        // haul leaves the ship
            hauls.set(`ships.${s.i}.remaining`, (hauls.get(`ships.${s.i}.remaining`) || 0) + 1);
            reservedImp[s.i] -= tr.amount; berthUsed[s.i][tr.slot] = false; tr.slot = -1; totalHauls++;
            tr.exit = pickExit(); go(tr, "impOut", `berth${s.i}>${tr.exit}`);
          }
          break;
        case "impOut":
          if (moveAlong(tr, dt)) {
            const s = SHIPS[tr.ship - 1];
            addDelta(`cargo.${s.stock}`, -tr.amount);              // cargo has left Veracruz
            hauls.set(`cargo.${s.stock}`, (hauls.get(`cargo.${s.stock}`) || 0) + 1);
            tr.amount = 0; setState(tr, "impAway"); tr.t = between(CONFIG.awaySec);
          }
          break;
        case "impAway": if ((tr.t -= dt) <= 0) { setState(tr, "impBack"); tr.t = between(CONFIG.awaySec); } break;
        case "impBack": if ((tr.t -= dt) <= 0) decide(tr, tr.exit); break;
        case "expOut": if (moveAlong(tr, dt)) { setState(tr, "expAway"); tr.t = between(CONFIG.awaySec); } break;
        case "expAway": if ((tr.t -= dt) <= 0) go(tr, "expIn", `${tr.exit}>qexp`); break;
        case "expIn": if (moveAlong(tr, dt)) { setState(tr, "expQueued"); expQ.push(tr); } break;
        case "expToTrain": if (moveAlong(tr, dt)) { setState(tr, "expUnloading"); tr.t = between(CONFIG.trainSec); } break;
        case "expUnloading":
          if ((tr.t -= dt) <= 0) {
            addDelta("train.1.remainingToLoad", -tr.amount);       // cargo onto the train
            addDelta(`cargo.${TRAIN.stock}`, -tr.amount);
            hauls.set("train.1.remainingToLoad", (hauls.get("train.1.remainingToLoad") || 0) + 1);
            hauls.set(`cargo.${TRAIN.stock}`, (hauls.get(`cargo.${TRAIN.stock}`) || 0) + 1);
            reservedExp -= tr.amount; tr.amount = 0; trainUsed[tr.slot] = false; tr.slot = -1; totalHauls++;
            decide(tr, "train");
          }
          break;
        case "toDepotImp": case "toDepotExp":
          if (moveAlong(tr, dt)) { setState(tr, "pool"); tr.flow = null; tr.route = null; }
          break;
      }
    }

    // import queue → free berth with open work (most open tons first)
    while (impQ.length) {
      let best = null, bestOpen = 0;
      for (const s of SHIPS) {
        const open = live(`ships.${s.i}.remaining`) - reservedImp[s.i];
        const free = berthUsed[s.i].indexOf(false);
        if (open > 0 && free >= 0 && open * s.tonsPerUnit > bestOpen) { best = { s, free, open }; bestOpen = open * s.tonsPerUnit; }
      }
      const anyOpen = SHIPS.some((s) => live(`ships.${s.i}.remaining`) - reservedImp[s.i] > 0);
      if (!best) {
        if (!anyOpen) { const tr = impQ.shift(); go(tr, "toDepotImp", "qimp>depot"); continue; }
        break;                                                     // berths full: wait
      }
      const tr = impQ.shift();
      tr.ship = best.s.i; tr.slot = best.free; berthUsed[best.s.i][best.free] = true;
      tr.amount = Math.min(best.s.haul, best.open); reservedImp[best.s.i] += tr.amount;
      go(tr, "impToBerth", `qimp>berth${best.s.i}`);
    }
    // export queue → free train slot
    while (expQ.length) {
      const free = trainUsed.indexOf(false);
      if (free < 0) break;
      const tr = expQ.shift();
      tr.slot = free; trainUsed[free] = true;
      go(tr, "expToTrain", "qexp>train");
    }
  }

  // Deltas → real kernel writes (one per changed fact). Returns the exact calls + kernel waves.
  const FLUSH_ORDER = ["ships.1.remaining", "ships.2.remaining", "ships.3.remaining", "train.1.remainingToLoad", "cargo.coffee", "cargo.sugar", "cargo.containers"];
  function flush() {
    const writes = [];
    const keys = [...FLUSH_ORDER.filter((k) => deltas.has(k)), ...[...deltas.keys()].filter((k) => !FLUSH_ORDER.includes(k)).sort()];
    for (const path of keys) {
      const dv = deltas.get(path);
      if (!dv) continue;
      const w = kernel.write(path, kernel.read(path) + dv);
      w.delta = dv; w.hauls = hauls.get(path) || 0;
      writes.push(w);
    }
    deltas.clear(); hauls.clear();
    totalWrites += writes.length; totalFlushes++;
    return writes;
  }

  const done = () => kernel.read("flows.importRemaining") === 0 && kernel.read("flows.exportRemaining") === 0 && stateCount.pool === FLEET && deltas.size === 0;

  // adapter state counts aggregated per kernel counter (compare with kernel after a flush)
  function adapterCounters() {
    const out = {};
    for (const [st, n] of Object.entries(stateCount)) out[COUNTER_OF[st]] = (out[COUNTER_OF[st]] || 0) + n;
    return out;
  }

  return {
    trucks, step, flush, done, adapterCounters, KEY, R,
    get simTime() { return simTime; }, get totalWrites() { return totalWrites; },
    get totalFlushes() { return totalFlushes; }, get totalHauls() { return totalHauls; },
    queues: { impQ, expQ }, berthUsed, trainUsed,
  };
}
