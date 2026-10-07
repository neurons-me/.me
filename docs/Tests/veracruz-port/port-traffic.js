// Port of Veracruz — truck traffic ADAPTER (plain JS, not kernel).
// Decides what happens to each of the 500 trucks (routes, queues, berths, timers) and
// accumulates the resulting fact changes as deltas. flush() turns the deltas into
// REAL kernel writes (one write per changed fact per flush); the kernel then
// recomputes every derived value and reports its own wave (k).
import { SHIPS, TRAIN, HEAVY, LAST_MILE, UNIT_IDS, TRIP_COUNTERS, TRUCK_STATES, TRUCK_CODE, SPEED_FACTS } from "./port-sim.js";
import { CEDIS, NODES, PARENT, TRIPS } from "./port-lastmile.js";

// ── Speeds: ASSUMPTIONS for this demo, not sourced statistics ──
// Heavy trucks in the urban port area: roughly 20–30 km/h average including stops,
// gates and traffic lights → 25 km/h, each truck ±15%.
export const HEAVY_TRUCK_KMH = 25;
// Small last-mile delivery trucks in city traffic: roughly 20–25 km/h → 22 km/h, ±15%.
export const LAST_MILE_KMH = 22;

// ── Last-mile dispatch: ASSUMED averages used for planning (actual times vary around them) ──
export const LM = {
  shiftStartH: 8, shiftEndH: 17,      // 9 h shift, 08:00–17:00 (sim clock starts at 08:00)
  loadMinAvg: 10, loadMin: [8, 12],   // loading one small truck at a CEDIS: ~10 min
  dropMinAvg: 6.5, dropMin: [5, 8],   // unloading at an address: 5–8 min
  bays: [12, 10],                     // loading bays at CEDIS A / CEDIS B
  units: [55, 45],                    // home CEDIS of the 100 units (≈ share of trips per CEDIS)
  band: 0.15,                         // rebalance band: avg trips per unit ± 15%
  rebalanceEverySec: 20,              // sim seconds between rebalance passes
  movesPerPass: 25,                   // max redirects per pass
};
export const SIM_START_H = LM.shiftStartH;

// Durations in simulated seconds — also assumptions (order-of-magnitude, for a believable rhythm).
export const CONFIG = {
  berthSlots: 20,            // trucks loading at once per ship
  trainSlots: 20,            // trucks unloading into the train at once
  loadSec: [480, 900],       // ship → heavy truck: 8–15 min
  trainSec: [360, 600],      // heavy truck → train: 6–10 min
  awaySec: [900, 1800],      // each off-map leg (deliver inland / pick up export cargo): 15–30 min
  heavyDispatchSec: 2,       // pool release: one heavy truck every 2 s (several gate lanes; staggered start)
  speedSpread: 0.15,
  exits: ["nw", "sw", "s"],
};

// adapter state → kernel counter fact
export const COUNTER_OF = {
  pool: "trucks.heavy.available",
  impToQueue: "trucks.import.returning", impQueued: "queues.import.length",
  impToBerth: "trucks.import.loading", impLoading: "trucks.import.loading",
  impOut: "trucks.import.enRoute", impAway: "trucks.import.enRoute", impBack: "trucks.import.returning",
  expOut: "trucks.export.returning", expAway: "trucks.export.returning", expIn: "trucks.export.enRoute",
  expQueued: "queues.export.length", expToTrain: "trucks.export.loading", expUnloading: "trucks.export.loading",
  toDepotImp: "trucks.import.returning", toDepotExp: "trucks.export.returning",
  lmPool: "trucks.lastMile.available", lmLoading: "trucks.lastMile.loading",
  lmOut: "trucks.lastMile.enRoute", lmDrop: "trucks.lastMile.enRoute", lmBack: "trucks.lastMile.returning",
};
// every adapter state has exactly one numeric code in the kernel (trucks.unit[n].state)
if (TRUCK_STATES.length !== Object.keys(COUNTER_OF).length || !TRUCK_STATES.every((st) => st in COUNTER_OF))
  throw new Error("port-traffic: TRUCK_STATES (port-sim.js) and COUNTER_OF disagree");
// states in which a truck is driving along a route on the map (moveAlong at its own speed tr.spd)
export const MOVING_STATES = ["impToQueue", "impToBerth", "impOut", "expOut", "expIn", "expToTrain", "toDepotImp", "toDepotExp", "lmOut", "lmBack"];
const MOVING = new Set(MOVING_STATES);
// drawing class per state (null = off map, not drawn)
export const VIS_OF = {
  pool: "idle", impToQueue: "returning", impQueued: "queued", impToBerth: "loading", impLoading: "loading",
  impOut: "enRouteImp", impAway: null, impBack: null, expOut: "returning", expAway: null, expIn: "enRouteExp",
  expQueued: "queued", expToTrain: "loading", expUnloading: "loading", toDepotImp: "returning", toDepotExp: "returning",
  lmPool: "lmIdle", lmLoading: "lmLoading", lmOut: "lmEnRoute", lmDrop: "lmEnRoute", lmBack: "lmReturning",
};
const TRIP_COUNTER_OF = { unassigned: "trips.unassigned", planned: "trips.planned", active: "trips.active", done: "trips.done", unscheduled: "trips.unscheduled" };

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// page SVG px → lon/lat (inverse of the basemap's equirectangular projection), haversine metres
export function makeGeo(PROJ) {
  const { south, west, north, east, W, H, PAD } = PROJ;
  const toLL = ([x, y]) => [west + (x - PAD) / (W - 2 * PAD) * (east - west), north - (y - PAD) / (H - 2 * PAD) * (north - south)];
  const RAD = Math.PI / 180, R_EARTH = 6371008.8;
  const hav = (a, b) => {
    const [lon1, lat1] = toLL(a), [lon2, lat2] = toLL(b);
    const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.sqrt(s));
  };
  return { toLL, hav };
}

const cat = (...rs) => rs.reduce((a, r) => a.concat(a.length ? r.slice(1) : r), []);
const rev = (pts) => pts.slice().reverse();

export function createTraffic({ kernel, ROUTES, KEY, PROJ, seed = 7 }) {
  const rnd = mulberry32(seed);
  const between = ([a, b]) => a + (b - a) * rnd();
  const { hav } = makeGeo(PROJ);
  const prepRoute = (pts) => {
    const cum = [0];   // cumulative metres along the OSM geometry
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
    return { pts, cum, len: cum[cum.length - 1] };
  };
  const R = {};
  for (const [k, v] of Object.entries(ROUTES)) R[k] = prepRoute(v);
  R["train>depot"] = prepRoute(cat(rev(ROUTES["qexp>train"]), ROUTES["qexp>depot"]));
  R["train>qimp"] = prepRoute(cat(rev(ROUTES["qexp>train"]), ROUTES["qexp>depot"], ROUTES["depot>qimp"]));

  const mps = (kmh) => (kmh * (1 + CONFIG.speedSpread * (2 * rnd() - 1))) / 3.6;
  const trucks = [];
  for (let id = 0; id < HEAVY + LAST_MILE; id++) {
    const lm = id >= HEAVY;
    trucks.push({ id, cat: lm ? "lastMile" : "heavy", st: lm ? "lmPool" : "pool", flow: null, route: null, d: 0, seg: 0,
      spd: mps(lm ? LAST_MILE_KMH : HEAVY_TRUCK_KMH), t: 0, ship: 0, slot: -1, amount: 0, exit: null, x: 0, y: 0 });
  }
  const impQ = [], expQ = [];
  const berthUsed = Object.fromEntries(SHIPS.map((s) => [s.i, new Array(CONFIG.berthSlots).fill(false)]));
  const trainUsed = new Array(CONFIG.trainSlots).fill(false);
  const bayUsed = LM.bays.map((n) => new Array(n).fill(false));
  const reservedImp = Object.fromEntries(SHIPS.map((s) => [s.i, 0]));   // held by trucks at/to a berth (not yet written)
  let reservedExp = 0;
  const deltas = new Map();                   // kernel fact → pending delta (flushed as real writes)
  const hauls = new Map();                    // kernel fact → hauls in this batch (annotation only)
  let simTime = 0, dispatchAcc = 0, totalWrites = 0, totalFlushes = 0, totalHauls = 0;
  const stateCount = Object.fromEntries(Object.keys(COUNTER_OF).map((s) => [s, 0]));
  stateCount.pool = HEAVY; stateCount.lmPool = LAST_MILE;

  const addDelta = (path, v) => deltas.set(path, (deltas.get(path) || 0) + v);
  const addHaul = (path) => hauls.set(path, (hauls.get(path) || 0) + 1);
  // kernel values only change at flush(), so reads are cached until the next flush
  const cache = new Map();
  const kread = (path) => { let v = cache.get(path); if (v === undefined) { v = kernel.read(path); cache.set(path, v); } return v; };
  const live = (path) => kread(path) + (deltas.get(path) || 0);   // kernel value + not-yet-flushed delta

  const dirty = new Set();                    // trucks whose state changed since the last flush
  function setState(tr, st) {
    const a = COUNTER_OF[tr.st], b = COUNTER_OF[st];
    stateCount[tr.st]--; stateCount[st]++;
    if (a !== b) { addDelta(a, -1); addDelta(b, +1); }
    tr.st = st; dirty.add(tr);
  }
  function go(tr, st, routeKey, route) { setState(tr, st); tr.route = route || R[routeKey]; tr.d = 0; tr.seg = 0; tr.x = tr.route.pts[0][0]; tr.y = tr.route.pts[0][1]; }
  const pickExit = () => CONFIG.exits[Math.floor(rnd() * CONFIG.exits.length)];

  // ── open work (kernel value + pending deltas − reservations) ──
  function importOpen() {
    let n = 0;
    for (const s of SHIPS) n += Math.ceil(Math.max(0, live(`ships.${s.i}.remaining`) - reservedImp[s.i]) / s.haul);
    return n - (stateCount.impToQueue + stateCount.impQueued);
  }
  const exportOpen = () => Math.ceil(Math.max(0, live("train.1.remainingToLoad") - reservedExp) / TRAIN.haul);
  const flowCount = (f) => trucks.reduce((a, t) => a + (t.cat === "heavy" && t.st !== "pool" && t.flow === f ? 1 : 0), 0);

  // A free heavy truck (at "depot" | exit key | "train") picks its next job.
  function decide(tr, from) {
    const io = importOpen(), eo = exportOpen();
    let flow = null;
    if (io > 0 || eo > 0) {
      const ci = flowCount("import"), ce = flowCount("export");
      flow = io > 0 && (eo <= 0 || io / (ci + 1) >= eo / (ce + 1)) ? "import" : "export";
    }
    if (flow === "import") {
      tr.flow = "import";
      go(tr, "impToQueue", from === "depot" ? "depot>qimp" : from === "train" ? "train>qimp" : `${from}>qimp`);
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
    if (from === "depot") return false;                            // no work: stay in the pool
    tr.flow = tr.flow || "import";
    if (from === "train") go(tr, "toDepotExp", "train>depot");
    else go(tr, tr.flow === "export" ? "toDepotExp" : "toDepotImp", `${from}>depot`);
    return true;
  }

  // ════════ Last-mile dispatch (ADAPTER, not kernel) ════════
  const SHIFT_END = (LM.shiftEndH - SIM_START_H) * 3600;
  const LOAD_AVG = LM.loadMinAvg * 60, DROP_AVG = LM.dropMinAvg * 60, LM_MPS = LAST_MILE_KMH / 3.6;
  // trips: road route CEDIS → address rebuilt from the OSM shortest-path tree; length by haversine
  const pathTo = (c, node) => { const out = []; for (let n = node; n >= 0; n = PARENT[c][n]) out.push(NODES[n]); return out.reverse(); };
  const trips = TRIPS.map(([x, y, node, c, w0, w1, kg], i) => {
    const route = prepRoute([CEDIS[c].pt, ...pathTo(c, node), [x, y]]);
    return { id: i + 1, x, y, c, kg, w0: (w0 - SIM_START_H) * 3600, w1: (w1 - SIM_START_H) * 3600, w0h: w0, w1h: w1,
      route, back: prepRoute(route.pts.slice().reverse()), travel: route.len / LM_MPS, st: "unassigned", unit: 0 };
  });
  const tripCount = { unassigned: trips.length, planned: 0, active: 0, done: 0, unscheduled: 0 };
  function setTrip(trip, st) {
    tripCount[trip.st]--; tripCount[st]++;
    addDelta(TRIP_COUNTER_OF[trip.st], -1); addDelta(TRIP_COUNTER_OF[st], +1);
    if (st === "done") addHaul("trips.done");
    trip.st = st;
  }
  // units = the 100 last-mile trucks; home CEDIS by LM.units split
  const units = trucks.slice(HEAVY).map((tr, i) => Object.assign(tr, {
    unit: i + 1, home: i < LM.units[0] ? 0 : 1, plan: [], trip: null, done: 0, freeAt: 0, band: "within" }));
  const loadOf = (u) => u.done + u.plan.length + (u.trip && u.trip.st === "active" ? 1 : 0);

  // Estimated sequence for one unit (averages only): repeatedly take the feasible trip it can
  // FINISH earliest (wait for the window to open if needed). Feasible = arrive ≤ window end and
  // back at the CEDIS before the shift ends.
  function sequence(startT, cand, maxTake = Infinity) {
    const left = cand.slice(), order = []; let t = startT;
    while (left.length && order.length < maxTake) {
      let best = -1, bestFin = Infinity;
      for (let k = 0; k < left.length; k++) {
        const tp = left[k];
        const arrive = Math.max(t + LOAD_AVG + tp.travel, tp.w0);
        if (arrive > tp.w1 || arrive + DROP_AVG + tp.travel > SHIFT_END) continue;
        if (arrive + DROP_AVG < bestFin) { bestFin = arrive + DROP_AVG; best = k; }
      }
      if (best < 0) break;
      const tp = left.splice(best, 1)[0];
      order.push(tp); t = bestFin + tp.travel;
    }
    return { order, left, end: t };
  }
  const unitStart = (u) => Math.max(simTime, u.freeAt);

  // 1) Initial greedy assignment: unit by unit, each fills its shift with the most trips it can do.
  let planned = false;
  function initialPlan() {
    planned = true;
    for (let c = 0; c < CEDIS.length; c++) {
      let pool = trips.filter((tp) => tp.c === c && tp.st === "unassigned");
      for (const u of units.filter((u) => u.home === c)) {
        const { order, left } = sequence(unitStart(u), pool);
        for (const tp of order) { tp.unit = u.unit; setTrip(tp, "planned"); }
        u.plan = order; pool = left;
      }
      for (const tp of pool) setTrip(tp, "unscheduled");   // can't fit today
    }
  }

  // 2) Continuous rebalancing around the kernel's band (bandHigh/bandLow = avg × 1.15 / × 0.85).
  const feed = []; let redirects = 0, nextRebalance = 0;
  function classify(u, hi, lo) { const L = loadOf(u); return L > hi + 1e-9 ? "above" : L < lo - 1e-9 ? "below" : "within"; }
  function rebalance() {
    const hi = kread("trips.bandHigh"), lo = kread("trips.bandLow");
    for (let moves = 0; moves < LM.movesPerPass; moves++) {
      let over = units.filter((u) => loadOf(u) > hi + 1e-9 && u.plan.length).sort((a, b) => loadOf(b) - loadOf(a));
      let under = units.filter((u) => loadOf(u) < lo - 1e-9).sort((a, b) => loadOf(a) - loadOf(b));
      if (!over.length && !under.length) return;
      // only one side out of band: trade with in-band units that stay in band after the move
      if (!under.length) under = units.filter((u) => loadOf(u) + 1 <= hi + 1e-9).sort((a, b) => loadOf(a) - loadOf(b));
      if (!over.length) over = units.filter((u) => loadOf(u) - 1 >= lo - 1e-9 && u.plan.length).sort((a, b) => loadOf(b) - loadOf(a));
      if (!over.length || !under.length) return;
      let moved = false;
      search: for (const O of over) for (const U of under) {
        if (U.home !== O.home || loadOf(O) - loadOf(U) < 2) continue;   // same CEDIS; a move must narrow the gap
        const last = U.plan.length ? U.plan[U.plan.length - 1] : null;
        const nx = last ? last.x : CEDIS[U.home].pt[0], ny = last ? last.y : CEDIS[U.home].pt[1];
        const cands = O.plan.slice().sort((a, b) => Math.hypot(a.x - nx, a.y - ny) - Math.hypot(b.x - nx, b.y - ny));
        for (const tp of cands.slice(0, 10)) {                 // nearest first
          const s = sequence(unitStart(U), [...U.plan, tp]);
          if (s.left.length) continue;                         // would break U's shift/windows
          O.plan = O.plan.filter((x) => x !== tp);
          U.plan = s.order; tp.unit = U.unit;
          redirects++; addDelta("trips.redirects", +1);
          feed.unshift({ trip: tp.id, from: O.unit, to: U.unit, t: simTime });
          if (feed.length > 40) feed.pop();
          moved = true; break search;
        }
      }
      if (!moved) return;                                      // no feasible move remains
    }
  }

  // 3) Execution: an idle unit starts its next planned trip when the window allows and a bay is free.
  function lmStep() {
    if (!planned) initialPlan();
    if (simTime >= nextRebalance) { nextRebalance = simTime + LM.rebalanceEverySec; rebalance(); }
    for (const u of units) {
      if (u.st !== "lmPool" || !u.plan.length) continue;
      const tp = u.plan[0];
      if (simTime + LOAD_AVG + tp.travel < tp.w0) continue;   // too early: wait at the CEDIS
      if (simTime + LOAD_AVG + tp.travel > tp.w1 || simTime + LOAD_AVG + 2 * tp.travel + DROP_AVG > SHIFT_END) {
        u.plan.shift(); setTrip(tp, "unscheduled"); continue;  // slipped: can't fit today
      }
      const bay = bayUsed[u.home].indexOf(false);
      if (bay < 0) continue;
      bayUsed[u.home][bay] = true; u.slot = bay;
      u.plan.shift(); u.trip = tp; setTrip(tp, "active");
      u.freeAt = simTime + LOAD_AVG + 2 * tp.travel + DROP_AVG;
      setState(u, "lmLoading"); u.t = between(LM.loadMin) * 60;
      u.x = CEDIS[u.home].pt[0]; u.y = CEDIS[u.home].pt[1];
    }
  }

  // classification counters + per-unit max/min, written after each flush (adapter → kernel facts)
  function bandWrites() {
    const hi = kernel.read("trips.bandHigh"), lo = kernel.read("trips.bandLow");
    const n = { above: 0, within: 0, below: 0 }; let mx = 0, mn = Infinity;
    for (const u of units) { u.band = classify(u, hi, lo); n[u.band]++; const L = loadOf(u); mx = Math.max(mx, L); mn = Math.min(mn, L); }
    return [["lastMile.unitsAbove", n.above, "adapter classification"], ["lastMile.unitsWithin", n.within, "adapter classification"],
      ["lastMile.unitsBelow", n.below, "adapter classification"], ["trips.unitMax", mx, "adapter aggregate"], ["trips.unitMin", mn, "adapter aggregate"]];
  }

  // estimated end of all planned last-mile work (sim seconds), from each unit's remaining plan
  function lmEstimate() {
    let end = 0;
    for (const u of units) {
      const busy = u.st !== "lmPool" ? Math.max(simTime, u.freeAt) : simTime;
      end = Math.max(end, u.plan.length ? sequence(busy, u.plan).end : u.st !== "lmPool" ? busy : 0);
    }
    return end;
  }

  function moveAlong(tr, dt) {
    const r = tr.route;
    tr.d += tr.spd * dt;   // metres
    if (tr.d >= r.len) { tr.d = r.len; const p = r.pts[r.pts.length - 1]; tr.x = p[0]; tr.y = p[1]; return true; }
    while (r.cum[tr.seg + 1] < tr.d) tr.seg++;
    const a = r.pts[tr.seg], b = r.pts[tr.seg + 1], u = (tr.d - r.cum[tr.seg]) / (r.cum[tr.seg + 1] - r.cum[tr.seg] || 1);
    tr.x = a[0] + (b[0] - a[0]) * u; tr.y = a[1] + (b[1] - a[1]) * u;
    return false;
  }

  function step(dt) {
    simTime += dt;
    // staggered release from the pools
    dispatchAcc = Math.min(3, dispatchAcc + dt / CONFIG.heavyDispatchSec);
    for (let i = 0; i < HEAVY && stateCount.pool > 0; i++) {
      const tr = trucks[i];
      if (dispatchAcc < 1) break;
      if (tr.st !== "pool") continue;
      if (!decide(tr, "depot")) break;
      dispatchAcc -= 1;
    }
    lmStep();

    for (const tr of trucks) {
      switch (tr.st) {
        case "impToQueue": if (moveAlong(tr, dt)) { setState(tr, "impQueued"); impQ.push(tr); } break;
        case "impToBerth": if (moveAlong(tr, dt)) { setState(tr, "impLoading"); tr.t = between(CONFIG.loadSec); } break;
        case "impLoading":
          if ((tr.t -= dt) <= 0) {
            const s = SHIPS[tr.ship - 1];
            addDelta(`ships.${s.i}.remaining`, -tr.amount); addHaul(`ships.${s.i}.remaining`);   // haul leaves the ship
            reservedImp[s.i] -= tr.amount; berthUsed[s.i][tr.slot] = false; tr.slot = -1; totalHauls++;
            tr.exit = pickExit(); go(tr, "impOut", `berth${s.i}>${tr.exit}`);
          }
          break;
        case "impOut":
          if (moveAlong(tr, dt)) {
            const s = SHIPS[tr.ship - 1];
            addDelta(`cargo.${s.stock}`, -tr.amount); addHaul(`cargo.${s.stock}`);              // cargo has left Veracruz
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
            addDelta("train.1.remainingToLoad", -tr.amount); addHaul("train.1.remainingToLoad");   // cargo onto the train
            addDelta(`cargo.${TRAIN.stock}`, -tr.amount); addHaul(`cargo.${TRAIN.stock}`);
            reservedExp -= tr.amount; tr.amount = 0; trainUsed[tr.slot] = false; tr.slot = -1; totalHauls++;
            decide(tr, "train");
          }
          break;
        case "toDepotImp": case "toDepotExp":
          if (moveAlong(tr, dt)) { setState(tr, "pool"); tr.flow = null; tr.route = null; }
          break;
        // ── last-mile (unit executes its plan) ──
        case "lmLoading": if ((tr.t -= dt) <= 0) { bayUsed[tr.home][tr.slot] = false; tr.slot = -1; go(tr, "lmOut", null, tr.trip.route); } break;
        case "lmOut": if (moveAlong(tr, dt)) { setState(tr, "lmDrop"); tr.t = between(LM.dropMin) * 60; } break;
        case "lmDrop":
          if ((tr.t -= dt) <= 0) {
            const trip = tr.trip;
            setTrip(trip, "done");
            addDelta(`lastMile.units.${tr.unit}.done`, +1);
            addDelta("localDelivery.remainingKg", -trip.kg); addHaul("localDelivery.remainingKg");   // goods delivered
            tr.done++;
            go(tr, "lmBack", null, trip.back);
          }
          break;
        case "lmBack": if (moveAlong(tr, dt)) { setState(tr, "lmPool"); tr.route = null; tr.trip = null; } break;
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
  const FLUSH_ORDER = ["ships.1.remaining", "ships.2.remaining", "ships.3.remaining", "train.1.remainingToLoad", "localDelivery.remainingKg", "trips.done", "cargo.coffee", "cargo.sugar", "cargo.containers"];
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
    deltas.clear(); hauls.clear(); cache.clear();
    // per-truck instance facts: one write per truck whose state changed (final state of this batch only)
    if (dirty.size) {
      for (const tr of [...dirty].sort((x, y) => x.id - y.id)) {
        const path = `trucks.unit.${tr.id + 1}.state`, code = TRUCK_CODE[tr.st], prev = kernel.read(path);
        if (prev === code) continue;
        const w = kernel.write(path, code);
        w.delta = code - prev; w.note = tr.st; w.hauls = 0; w.unit = true;
        writes.push(w);
      }
      dirty.clear();
    }
    // adapter classification with the kernel's own bandHigh/bandLow (read after the writes above)
    for (const [path, value, note] of bandWrites()) {
      const prev = kernel.read(path);
      if (prev === value) continue;
      const w = kernel.write(path, value);
      w.delta = value - prev; w.note = note; w.hauls = 0;
      writes.push(w);
    }
    cache.clear();
    totalWrites += writes.length; totalFlushes++;
    return writes;
  }

  // Speed sample of the trucks driving right now: per fleet Σ km/h (2 decimals) and count. A moving truck's speed
  // is exactly its configured tr.spd (no acceleration model). Written by speedFlush(), at most a few times per second.
  function speedNow() {
    let hs = 0, hm = 0, ls = 0, lm = 0;
    for (const tr of trucks) if (MOVING.has(tr.st)) { const kmh = tr.spd * 3.6; if (tr.cat === "lastMile") { ls += kmh; lm++; } else { hs += kmh; hm++; } }
    const r2 = (x) => Math.round(x * 100) / 100;
    return { "trucks.speed.heavy.kmhSum": r2(hs), "trucks.speed.heavy.moving": hm, "trucks.speed.lastMile.kmhSum": r2(ls), "trucks.speed.lastMile.moving": lm };
  }
  function speedFlush() {
    const v = speedNow(), writes = [];
    for (const path of SPEED_FACTS) {
      const prev = kernel.read(path);
      if (prev === v[path]) continue;
      const w = kernel.write(path, v[path]);
      w.delta = Math.round((v[path] - prev) * 100) / 100; w.note = "speed sample"; w.hauls = 0;
      writes.push(w);
    }
    totalWrites += writes.length;
    return writes;
  }

  const done = () => kread("flows.importRemaining") === 0 && kread("flows.exportRemaining") === 0 &&
    tripCount.unassigned === 0 && tripCount.planned === 0 && tripCount.active === 0 &&
    stateCount.pool === HEAVY && stateCount.lmPool === LAST_MILE && deltas.size === 0;

  // adapter state counts aggregated per kernel counter (compare with kernel after a flush)
  function adapterCounters() {
    const out = {};
    for (const [st, n] of Object.entries(stateCount)) out[COUNTER_OF[st]] = (out[COUNTER_OF[st]] || 0) + n;
    for (const [st, n] of Object.entries(tripCount)) out[TRIP_COUNTER_OF[st]] = n;
    for (const u of units) out[`lastMile.units.${u.unit}.done`] = u.done;
    return out;
  }

  return {
    trucks, step, flush, speedFlush, speedNow, done, adapterCounters, KEY, R,
    get simTime() { return simTime; }, get totalWrites() { return totalWrites; },
    get totalFlushes() { return totalFlushes; }, get totalHauls() { return totalHauls; },
    queues: { impQ, expQ }, berthUsed, trainUsed, bayUsed,
    trips, units, feed, tripCount, lmEstimate, classify, CEDIS, get redirects() { return redirects; },
  };
}
