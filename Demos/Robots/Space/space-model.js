// Autonomous Robots in Space: the model (shared by the page and verify.mjs).
// KERNEL (this.me@4.1.0, unmodified): every robot fact, every derived value, k, explain().
// ADAPTER (plain JS, here): the physical truth (where a robot really stands, its real battery), motion,
// the light-delay queue between Earth and the asteroids, and which action a robot takes from its flags.
// No imports: the page passes the kernel constructor it loaded (sha256-checked), Node does the same.

export const AU_LIGHT_MIN = 8.317;          // light time per AU, minutes (c)
export const HALF_PI = Math.PI / 2;
export const CRATER = Math.PI;              // pos = π: the dark pole (the survey site)
export const NOON = 0.3;                    // where a robot stops to charge, in the light
export const OMEGA = 0.012;                 // walking speed, rad per simulated minute (stylized)
export const DRAIN_MOVE = 0.3, DRAIN_STILL = 0.15, CHARGE = 0.35;   // % per simulated minute (stylized)
export const TELEMETRY_EVERY = 5;           // minutes between telemetry packets
export const STAR_FIX_MIN = 20;             // safe mode: minutes until the robot re-measures itself

export const ROCKS = [
  { id: 612, rock: "b612", name: "B 612", distanceAU: 2.4, radiusM: 400, start: { pos: 1.2, battery: 80 } },
  { id: 325, rock: "b325", name: "B 325", distanceAU: 2.9, radiusM: 520, start: { pos: 2.4, battery: 70 } },
  { id: 329, rock: "b329", name: "B 329", distanceAU: 3.3, radiusM: 330, start: { pos: 0.3, battery: 50 } },
];
export const IDS = ROCKS.map((r) => r.id);
export const delayMin = (rock) => rock.distanceAU * AU_LIGHT_MIN;
// Earth plans with the staleness of what it sees + the flight time of its order: telemetry age (≤ one period + one-way)
// plus the order's one-way flight, spent at the dark-side walking drain.
export const earthLagReserve = (rock) => (2 * delayMin(rock) + TELEMETRY_EVERY) * DRAIN_MOVE;

// The rules: ONE text per rule, installed as a class template me.robots["[i]"]["="](name, expr) in every kernel.
// No rule reads through a pointer (this.me 4.1.0 known issue #4: such a formula is not recomputed when its target changes).
export const RULES = [
  ["reserveNeeded", "shade * costPerRad + margin + lagReserve"],
  ["mustReturn", "battery < reserveNeeded"],
  ["charged", "battery >= full"],
  ["batteryOk", "battery >= 0 && battery <= 100"],
  ["drift", "pos - prevPos - vel * dt"],
  ["positionOk", "drift * drift <= tol * tol"],
  ["consistent", "batteryOk && positionOk"],
  ["safeMode", "!consistent"],
  ["goCharge", "consistent && (mustReturn || charging && !charged)"],
  ["explore", "consistent && !goCharge"],
];
export const RULE_NAMES = RULES.map(([n]) => n);
export const ruleCode = ([n, e]) => `me.robots["[i]"]["="](${JSON.stringify(n)}, ${JSON.stringify(e)})`;
// The same rules in plain JS (verify.mjs compares the kernel against these).
export function rulesJS(f) {
  const reserveNeeded = f.shade * f.costPerRad + f.margin + f.lagReserve;
  const mustReturn = f.battery < reserveNeeded, charged = f.battery >= f.full;
  const batteryOk = f.battery >= 0 && f.battery <= 100;
  const drift = f.pos - f.prevPos - f.vel * f.dt, positionOk = drift * drift <= f.tol * f.tol;
  const consistent = batteryOk && positionOk, goCharge = consistent && (mustReturn || (f.charging && !charged));
  return { reserveNeeded, mustReturn, charged, batteryOk, drift, positionOk, consistent, safeMode: !consistent, goCharge, explore: consistent && !goCharge };
}
export const FACTS = ["battery", "shade", "pos", "prevPos", "vel", "dt", "charging", "tol", "costPerRad", "margin", "lagReserve", "full"];
export const CONSTS = (lagReserve) => ({ dt: 1, tol: 0.03, costPerRad: DRAIN_MOVE / OMEGA, margin: 8, lagReserve, full: 95 });
export const shadeOf = (pos) => Math.max(0, pos - HALF_PI);
const r6 = (x) => Math.round(x * 1e6) / 1e6;

export function installRules(me) { for (const [n, e] of RULES) me.robots["[i]"]["="](n, e); }

// One kernel (a robot's own, or Earth's). write() = one real kernel write; returns the kernel's wave for it.
export function createKernel(ME, ids) {
  const me = new ME();
  const writes = [];
  const reader = {};   // fact path → one derived path that reads it (from the kernel's own dependsOn)
  function waveOf(path) {
    const d = reader[path]; if (!d) return { k: 0, recomputed: [], changed: [] };
    const m = me.explain(d)?.meta || {};
    if (m.sourcePath !== path) return { k: 0, recomputed: [], changed: [] };
    return { k: m.k ?? 0, recomputed: m.recomputed || [], changed: m.changed || [] };
  }
  function write(path, value, log = true) {
    const segs = path.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    const t0 = performance.now();
    segs.slice(0, -1).reduce((n, s) => n[s], me)[segs[segs.length - 1]](value);
    const us = (performance.now() - t0) * 1000;
    const w = { path, value, us, code: "me" + segs.map((s) => (typeof s === "number" ? `[${s}]` : `.${s}`)).join("") + `(${JSON.stringify(value)})`, ...waveOf(path) };
    if (log) { writes.push(w); if (writes.length > 400) writes.splice(0, 200); }
    return w;
  }
  function index() {
    for (const i of ids) for (const n of RULE_NAMES) { const p = `robots.${i}.${n}`; me(p); for (const s of me.explain(p)?.meta?.dependsOn || []) reader[s] ??= p; }
  }
  return { me, write, index, writes, read: (p) => me(p) };
}

// ── the world ──
export function createWorld(ME, opts = {}) {
  const w = {
    t: 0, mode: opts.mode || "earth", linkUp: opts.linkUp ?? true, packets: [], received: 0, lost: 0,
    robots: [], earth: null, log: [],
  };
  // Earth: ONE kernel with a mirror of every robot (n=1). Same template.
  w.earth = createKernel(ME, IDS);
  for (const rock of ROCKS) {
    const k = createKernel(ME, [rock.id]);
    const base = `robots.${rock.id}`;
    const s = rock.start;
    k.write(`${base}.id`, rock.id, false); k.write(`${base}.name`, rock.name, false);
    // the robot's home rock, and a pointer to it (read through; no formula reads through it)
    k.write(`asteroids.${rock.rock}.name`, rock.name, false); k.write(`asteroids.${rock.rock}.distanceAU`, rock.distanceAU, false); k.write(`asteroids.${rock.rock}.radiusM`, rock.radiusM, false);
    k.me.robots[rock.id].home["->"](`asteroids.${rock.rock}`);
    const facts = { battery: s.battery, shade: r6(shadeOf(s.pos)), pos: s.pos, prevPos: s.pos, vel: 0, charging: false, data: 0, ...CONSTS(0) };
    for (const [f, v] of Object.entries(facts)) k.write(`${base}.${f}`, v, false);
    installRules(k.me); k.index();
    // Earth's mirror starts from the same values (as if the last telemetry had just arrived), with its own lagReserve
    const ef = { ...facts, ...CONSTS(r6(earthLagReserve(rock))) };
    w.earth.write(`${base}.id`, rock.id, false); w.earth.write(`${base}.name`, rock.name, false);
    for (const [f, v] of Object.entries(ef)) w.earth.write(`${base}.${f}`, v, false);
    w.robots.push({ rock, k, truth: { pos: s.pos, battery: s.battery }, written: { ...facts }, vel: 0, charging: false, data: 0, sent: 0,
      order: "explore", orderSentByEarth: "explore", action: "explore", status: "explore", dead: false, safeSince: null, nextTelemetry: (rock.id % 5), lastBatch: [] });
  }
  installRules(w.earth.me); w.earth.index();
  w.earth.write("link.up", true, false); w.earth.write("data.received", 0, false);
  return w;
}

const R = (w, id) => w.robots.find((r) => r.rock.id === id);
export const robotOf = R;

// one control step of one robot: decide (kernel flags) → act (adapter) → measure → write facts (kernel)
function stepRobot(w, r, dt) {
  const base = `robots.${r.rock.id}`, k = r.k;
  const batch = [];
  const put = (f, v) => { if (r.written[f] !== v) { r.written[f] = v; batch.push(k.write(`${base}.${f}`, v)); } };
  if (r.dead) { r.lastBatch = batch; return; }
  // 1. decide: under .me the robot reads its own kernel; under n=1 it does what Earth last ordered
  const flags = { safe: k.read(`${base}.safeMode`), charge: k.read(`${base}.goCharge`), explore: k.read(`${base}.explore`) };
  let action;
  if (w.mode === "local") action = flags.safe ? "safe" : flags.charge ? "charge" : "explore";
  else action = r.order;
  r.action = action;
  // 2. act (physical truth)
  let vel = 0;
  if (action === "explore") vel = r.truth.pos < CRATER - 1e-9 ? OMEGA : 0;
  else if (action === "charge") vel = r.truth.pos > NOON + 1e-9 ? -OMEGA : 0;
  // safe mode (the robot's own kernel flags an inconsistency): it stops trusting its sensors, holds the flagged
  // values (no new position / battery writes) and, after STAR_FIX_MIN, takes a star fix: re-measures everything.
  let fix = false;
  if (flags.safe) { if (r.safeSince == null) r.safeSince = w.t; if (w.t - r.safeSince >= STAR_FIX_MIN) fix = true; }
  else r.safeSince = null;
  const prev = r.truth.pos;
  r.truth.pos = Math.min(CRATER, Math.max(NOON, r.truth.pos + vel * dt));
  vel = r6((r.truth.pos - prev) / dt);
  const dark = r.truth.pos > HALF_PI;
  r.truth.battery = Math.min(100, r.truth.battery + (dark ? -(vel !== 0 ? DRAIN_MOVE : DRAIN_STILL) : CHARGE) * dt);
  if (dark && r.truth.pos >= CRATER - 1e-9 && action === "explore") r.data += dt;   // surveying the crater
  if (r.truth.battery <= 0) { r.truth.battery = 0; r.dead = true; vel = 0; }
  // 3. write what it measured (one real kernel write per changed fact)
  const pos = r6(r.truth.pos);
  if (fix) {   // star fix: prevPos and pos from the same measurement; battery re-read
    put("vel", 0); put("prevPos", pos); put("pos", pos); put("battery", r6(r.truth.battery)); r.safeSince = null;
  } else if (!flags.safe || r.dead) {
    put("vel", vel);
    if (pos !== r.written.pos || r.written.prevPos !== r.written.pos) { put("prevPos", r.written.pos); put("pos", pos); }
    put("battery", r6(r.truth.battery));
  }
  if (!flags.safe || fix) put("shade", r6(shadeOf(r.truth.pos)));
  const charging = action === "charge" && !r.dead;
  put("charging", charging);
  put("data", r.data);
  r.status = r.dead ? "asleep" : action === "safe" || flags.safe ? "safe mode" : action === "charge" ? (vel ? "returning" : "charging") : r.truth.pos >= CRATER - 1e-9 ? "surveying" : "exploring";
  if (w.mode === "earth" && !r.dead && !w.linkUp && action === "explore" && k.read(`${base}.goCharge`)) r.status = "waiting for Earth";
  r.lastBatch = batch;
}

// Earth's side: telemetry arrives → mirror writes → Earth's kernel decides → order flies back (n=1 only)
function earthReceive(w, pkt) {
  const base = `robots.${pkt.id}`;
  const batch = [];
  for (const [f, v] of Object.entries(pkt.facts)) if (w.earth.read(`${base}.${f}`) !== v) batch.push(w.earth.write(`${base}.${f}`, v));
  if (pkt.data) { w.received += pkt.data; batch.push(w.earth.write("data.received", w.received)); }
  const r = R(w, pkt.id); r.earthBatch = batch;
  if (w.mode !== "earth") return;
  const order = w.earth.read(`${base}.safeMode`) ? "safe" : w.earth.read(`${base}.goCharge`) ? "charge" : "explore";
  if (order !== r.orderSentByEarth) { r.orderSentByEarth = order; w.packets.push({ kind: "order", id: pkt.id, order, sentAt: w.t, arriveAt: w.t + delayMin(r.rock) }); }
}

export function step(w, dt = 1) {
  w.t += dt;
  for (const r of w.robots) stepRobot(w, r, dt);
  // telemetry out (every TELEMETRY_EVERY minutes), carrying what the robot's kernel holds now
  for (const r of w.robots) {
    if (r.dead || w.t < r.nextTelemetry) continue;
    r.nextTelemetry = w.t + TELEMETRY_EVERY;
    if (!w.linkUp) continue;
    const base = `robots.${r.rock.id}`;
    const facts = {}; for (const f of ["battery", "shade", "pos", "prevPos", "vel", "charging"]) facts[f] = r.k.read(`${base}.${f}`);
    const data = r.data - r.sent; r.sent = r.data;
    w.packets.push({ kind: "telemetry", id: r.rock.id, facts, data, sentAt: w.t, arriveAt: w.t + delayMin(r.rock) });
  }
  // deliver what has arrived
  const due = w.packets.filter((p) => p.arriveAt <= w.t); w.packets = w.packets.filter((p) => p.arriveAt > w.t);
  for (const p of due) {
    if (p.kind === "telemetry") earthReceive(w, p);
    else { const r = R(w, p.id); if (!r.dead) r.order = p.order; }
  }
}

export function setLink(w, up) {
  if (w.linkUp === up) return;
  w.linkUp = up;
  if (!up) { w.lost += w.packets.length; for (const p of w.packets) if (p.kind === "telemetry") { const r = R(w, p.id); r.sent -= p.data; } w.packets = []; }   // signals in flight are lost (their data stays on board)
  w.earth.write("link.up", up);
}
export function setMode(w, mode) {
  w.mode = mode;
  // switching to n=1: robots act on Earth's last order (Earth re-decides on the next telemetry)
  for (const r of w.robots) { r.order = r.action === "safe" ? "explore" : r.action; r.orderSentByEarth = r.order; }
}
// interactions that write one value into a robot's kernel
export function glitchPosition(w, id, by = 0.6) {
  const r = R(w, id), base = `robots.${id}`;
  const v = r6(r.written.pos + by); r.written.pos = v;
  const x = r.k.write(`${base}.pos`, v);
  if (!r.dead && r.k.read(`${base}.safeMode`)) r.status = "safe mode";
  return x;
}
export function glitchBattery(w, id, value = 140) {
  const r = R(w, id); r.written.battery = value;
  const x = r.k.write(`robots.${id}.battery`, value);
  if (!r.dead && r.k.read(`robots.${id}.safeMode`)) r.status = "safe mode";
  return x;
}
export function setBattery(w, id, value) {   // the slider: the real battery changes, and the robot measures it at once
  const r = R(w, id); if (r.dead && value > 0) r.dead = false;
  r.truth.battery = value; r.written.battery = value;
  return r.k.write(`robots.${id}.battery`, value);
}

// Every derived path of every kernel compared with a fresh kernel rebuilt from the same facts + same rules,
// and with the same rules computed in plain JS.
export function verifyWorld(ME, w) {
  const mismatches = []; let checked = 0;
  const kernels = [...w.robots.map((r) => ({ k: r.k, ids: [r.rock.id], who: `robot ${r.rock.id}` })), { k: w.earth, ids: IDS, who: "Earth" }];
  for (const { k, ids, who } of kernels) {
    const fresh = new ME();
    for (const i of ids) for (const f of FACTS) fresh.robots[i][f](k.read(`robots.${i}.${f}`));
    installRules(fresh);
    for (const i of ids) {
      const facts = Object.fromEntries(FACTS.map((f) => [f, k.read(`robots.${i}.${f}`)]));
      const js = rulesJS(facts);
      for (const n of RULE_NAMES) {
        const p = `robots.${i}.${n}`, a = k.read(p), b = fresh(p), c = js[n];
        const eq = (x, y) => x === y || (typeof x === "number" && typeof y === "number" && Math.abs(x - y) < 1e-9);
        checked++; if (!eq(a, b)) mismatches.push({ who, path: p, live: a, fresh: b });
        checked++; if (!eq(a, c)) mismatches.push({ who, path: p + " (JS)", live: a, js: c });
        checked++; if (a === undefined) mismatches.push({ who, path: p + " (undefined)" });
      }
    }
  }
  return { ok: mismatches.length === 0, checked, mismatches };
}
