// Autonomous Robotics in Space: the model (shared by the page and verify.mjs).
// KERNEL (this.me@4.1.0, unmodified): one kernel per robot. Every robot fact, every derived value, k, explain().
// ADAPTER (plain JS, here): the physical truth (where a spider really stands, its real battery, where the rocks are),
// walking, the radios (range, line of sight, delay, bandwidth, loss) and which action a spider takes from its flags.
// No robot ever writes into another robot's kernel: a message only reaches the receiver's adapter, and the receiver
// writes it into its OWN kernel as something heard; its own rule (acceptTip) decides whether it becomes a plan.
// No imports: the page passes the kernel constructor it loaded (sha256-checked); Node does the same.

export const VB = { w: 1000, h: 600 };
export const SUN = { x: -40, y: 290 };            // the Sun, off the left edge: light comes from the left
export const TAU = Math.PI * 2, HALF_PI = Math.PI / 2;
export const SPEED = 3;                           // walking speed, px per simulated minute (stylized)
export const DRAIN_MOVE = 0.22, DRAIN_STILL = 0.06, CHARGE_STILL = 0.3, CHARGE_MOVE = 0.1;   // % per simulated minute
export const LIT_IN = 0.25;                       // a spider charges once it stands this far inside the lit half (rad)
export const RANGE = 410;                         // radio range across the void, px
export const MSG_SPEED = 30, MSG_BASE = 1;        // message travel: 1 min + distance / 30 px per min (slowed down to be seen)
export const SEND_GAP = 6, OUTBOX = 3, HELLO_EVERY = 40;   // bandwidth: one message per 6 min, an outbox of 3
export const DRILL_MIN = 12;                      // minutes per unit of ice
export const LOSS_NEAR = 0.03, LOSS_FAR = 0.08, LOSS_FAR_EXTRA = 0.4;   // chance a message is lost on the way

export const ROCKS = [
  { id: 1, key: "b612", name: "B 612", R: 112, home: { x: 360, y: 330 }, ice: [2.3, -2.0, 3.0] },
  { id: 2, key: "b325", name: "B 325", R: 68, home: { x: 707, y: 168 }, ice: [-2.5, 2.1] },
];
// Roles: the same objects mean different things to each spider (as in the Robots ContextLab: one canister, many meanings).
export const ROBOTS = [
  { id: 1, name: "Oli", role: "miner", rock: 1, pos: 0.4, battery: 82, dir: 1, mines: true, slips: false, studies: false },
  { id: 2, name: "Tiko", role: "light scout", rock: 1, pos: -1.2, battery: 64, dir: -1, mines: false, slips: true, studies: false },
  { id: 3, name: "Lua", role: "scientist", rock: 2, pos: 1.4, battery: 71, dir: 1, mines: false, slips: false, studies: true },
];
// The shared objects. Each kernel holds its OWN observation of them under objects.* (written only by that robot).
export const OBJECTS = [
  { key: "ice", name: "the ice", facts: ["objects.ice.seen", "objects.ice.near"] },
  { key: "comet", name: "the comet", facts: ["objects.comet.near"] },
  { key: "rock", name: "the other rock", facts: ["objects.rock.inRange"] },
];
export const COMET = { first: 50, every: 420, lasts: 110, sees: 230 };
export const IDS = ROBOTS.map((r) => r.id);
export const NAME = Object.fromEntries(ROBOTS.map((r) => [r.id, r.name]));
export const ROCK_NAME = Object.fromEntries(ROCKS.map((r) => [r.id, r.name]));

// The rules: ONE text per rule, installed as a class template me.robots["[i]"]["="](name, expr) in every kernel.
// No rule reads through a pointer (this.me 4.1.0 known issue #4: such a formula is not recomputed when its target changes).
export const RULES = [
  ["reserve", "lightDist * costPerRad + margin"],
  ["mustCharge", "battery < reserve"],
  ["charged", "battery >= full"],
  ["goCharge", "mustCharge || charging && !charged"],
  ["asleep", "battery <= 0"],
  // what each shared object means to THIS robot: same rule text everywhere, different role and context
  ["iceIsFuel", "mines && objects.ice.seen"],
  ["iceIsHazard", "slips && objects.ice.seen"],
  ["iceIsSample", "studies && objects.ice.seen"],
  ["cometIsHazard", "!studies && objects.comet.near"],
  ["cometIsSample", "studies && objects.comet.near"],
  ["rockInReach", "objects.rock.inRange"],
  ["shelter", "!goCharge && cometIsHazard"],
  ["watchComet", "!goCharge && cometIsSample"],
  ["avoidIce", "iceIsHazard && objects.ice.near"],
  ["tipAge", "now - tipAt"],
  ["tipFresh", "tipAge <= maxAge"],
  ["tipMine", "tipRock == myRock"],
  ["followTip", "!goCharge && !objects.comet.near && tipFresh && tipMine && !slips"],
  ["explore", "!goCharge && !shelter && !watchComet && !followTip"],
  ["inboxAge", "now - inboxAt"],
  ["acceptTip", "inboxAge <= maxAge && inboxRock == myRock && !tipFresh"],
];
export const RULE_NAMES = RULES.map(([n]) => n);
export const ruleCode = ([n, e]) => `me.robots["[i]"]["="](${JSON.stringify(n)}, ${JSON.stringify(e)})`;
// The same rules in plain JS (verify compares the kernel against these).
export function rulesJS(f) {
  const reserve = f.lightDist * f.costPerRad + f.margin, mustCharge = f.battery < reserve, charged = f.battery >= f.full;
  const goCharge = mustCharge || (f.charging && !charged), asleep = f.battery <= 0;
  const iceSeen = f["objects.ice.seen"], cometNear = f["objects.comet.near"];
  const iceIsFuel = f.mines && iceSeen, iceIsHazard = f.slips && iceSeen, iceIsSample = f.studies && iceSeen;
  const cometIsHazard = !f.studies && cometNear, cometIsSample = f.studies && cometNear, rockInReach = f["objects.rock.inRange"];
  const shelter = !goCharge && cometIsHazard, watchComet = !goCharge && cometIsSample, avoidIce = iceIsHazard && f["objects.ice.near"];
  const tipAge = f.now - f.tipAt, tipFresh = tipAge <= f.maxAge, tipMine = f.tipRock === f.myRock;
  const followTip = !goCharge && !cometNear && tipFresh && tipMine && !f.slips, explore = !goCharge && !shelter && !watchComet && !followTip;
  const inboxAge = f.now - f.inboxAt, acceptTip = inboxAge <= f.maxAge && f.inboxRock === f.myRock && !tipFresh;
  return { reserve, mustCharge, charged, goCharge, asleep, iceIsFuel, iceIsHazard, iceIsSample, cometIsHazard, cometIsSample, rockInReach, shelter, watchComet, avoidIce, tipAge, tipFresh, tipMine, followTip, explore, inboxAge, acceptTip };
}
export const FACTS = ["battery", "lightDist", "charging", "now", "tipRock", "tipAt", "inboxRock", "inboxAt", "myRock", "maxAge", "costPerRad", "margin", "full",
  "mines", "slips", "studies", "objects.ice.seen", "objects.ice.near", "objects.comet.near", "objects.rock.inRange"];
// a fact name → its path in robot i's kernel ("objects.*" facts live at the kernel's top level: that robot's view of the object)
export const factPath = (i, f) => (f.startsWith("objects.") ? f : `robots.${i}.${f}`);
const NEVER = -1000000;   // "never": an observation time so old that every age check fails
const r4 = (x) => Math.round(x * 1e4) / 1e4;
export const wrap = (a) => { a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a === -Math.PI ? Math.PI : a; };
export const omega = (rock) => SPEED / rock.R;   // rad per simulated minute
export const lightDistOf = (pos) => Math.max(0, Math.abs(wrap(pos)) - (HALF_PI - LIT_IN));
export const litAt = (pos) => Math.abs(wrap(pos)) < HALF_PI;

export function installRules(me, script) { for (const [n, e] of RULES) { me.robots["[i]"]["="](n, e); script?.push(ruleCode([n, e])); } }
// the code of one write, exactly as the call is made: "robots.1.battery" + 82 → me.robots[1].battery(82)
export const codeOf = (path, value) => "me" + path.split(".").map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`)).join("") + `(${JSON.stringify(value)})`;

// ── the story: each act told with .me lines that really run ──
// A line is either fixed code that the kernel ran while it was set up (verify checks it is in that kernel's setup
// script, word for word), or { live: path }: the latest real write to that path in that kernel, shown as written.
// { value: path } adds "→ value" read from the same kernel. who: the kernel (robot id), or "all" (in all three).
const rule = (n) => ruleCode(RULES.find(([x]) => x === n));
const seed = (id, f) => codeOf(`robots.${id}.${f}`, f === "name" ? ROBOTS[id - 1].name : f === "role" ? ROBOTS[id - 1].role : ROBOTS[id - 1][f]);
const ROCK_KEY = (id) => ROCKS.find((x) => x.id === ROBOTS[id - 1].rock).key;
const homeLines = (id) => [seed(id, "name"), codeOf(`rocks.${ROCK_KEY(id)}.name`, ROCKS.find((x) => x.key === ROCK_KEY(id)).name), `me.robots[${id}].home["->"]("rocks.${ROCK_KEY(id)}")`];
const meaning = (id, f, n) => [seed(id, "role"), seed(id, f), { live: "objects.ice.seen" }, { code: rule(n), value: `robots.${id}.${n}` }];
export const STORY = [null,
  { title: "Two small rocks", text: "Two small rocks, three spider robots, and nobody drives them. Each spider keeps its own .me kernel and first writes down who it is and where it lives. Tap a spider in the sky or in the code.", link: { text: ".me kernel", href: "https://neurons-me.github.io/.me/" },
    groups: [{ who: 1, lines: homeLines(1) }, { who: 2, lines: homeLines(2) }, { who: 3, lines: homeLines(3) }] },
  { title: "Each one decides", text: "Every simulated minute each spider writes what it measures; its own rules decide when to walk to the sun.",
    groups: [{ who: 2, lines: [{ live: "robots.2.battery" }, { code: rule("reserve"), value: "robots.2.reserve" }, { code: rule("mustCharge"), value: "robots.2.mustCharge" }, { code: rule("goCharge"), value: "robots.2.goCharge" }] }] },
  { title: "One ice, three meanings", text: "The same ice and the same rule text in every kernel: what the ice means comes from each spider's role.",
    groups: [{ who: 1, lines: meaning(1, "mines", "iceIsFuel") }, { who: 2, lines: meaning(2, "slips", "iceIsHazard") }, { who: 3, lines: meaning(3, "studies", "iceIsSample") }] },
  { title: "Talking across the void", text: "Small radios with a short range. What a spider hears is written only into its own kernel.",
    groups: [{ who: 3, lines: [{ live: "robots.3.sent" }] },
      { who: 1, lines: [{ live: "robots.1.heard.3.battery", none: "nothing heard from Lua yet" }, { live: "robots.1.heard.3.at", none: "" }] },
      { who: 2, lines: [{ live: "robots.2.heard.3.battery", none: "nothing heard from Lua yet" }, { live: "robots.2.heard.3.at", none: "" }] }] },
  { title: "Heard is not known", text: "Nobody writes into another spider's kernel. A tip lands in the inbox, and the receiver's own rule decides.",
    groups: [{ who: "all", lines: [rule("acceptTip")] },
      { who: 2, lines: [{ live: "robots.2.inboxFrom" }, { live: "robots.2.inboxRock" }, { live: "robots.2.tipFrom" }] },
      { who: 3, lines: [{ live: "robots.3.inboxFrom" }, { live: "robots.3.inboxRock" }, { live: "robots.3.tipFrom" }] }] },
  { title: "Drifting apart", text: "B 325 drifts. Out of range nothing arrives, and what was heard keeps its age.",
    groups: [{ who: 1, lines: [{ live: "objects.rock.inRange" }, { live: "robots.1.now" }, { live: "robots.1.heard.3.at", none: "nothing heard from Lua yet" }] },
      { who: 3, lines: [{ live: "objects.rock.inRange" }, { live: "robots.3.now" }, { live: "robots.3.heard.1.at", none: "nothing heard from Oli yet" }] }] },
  { title: "A small cost", text: "Each write recomputes only the paths that read it: that number is k. Verify rebuilds all three kernels and compares.",
    groups: [{ who: 1, lines: [{ live: "robots.1.battery", k: true }, { live: "robots.1.lightDist", k: true }, { live: "robots.1.now", k: true }] }] },
];
// check lines against the world's kernels: fixed lines in the setup script, live lines = the latest real write
export function checkGroups(w, groups) {
  const out = [];
  for (const g of groups) for (const ln of g.lines) {
    const ks = (g.who === "all" ? w.robots : [w.robots.find((r) => r.id === g.who)]).map((r) => r.k);
    const L = typeof ln === "string" ? { code: ln } : ln;
    if (L.code) out.push({ who: g.who, code: L.code, ok: ks.every((k) => k.script.includes(L.code)) });
    else { const x = ks[0].last[L.live]; out.push({ who: g.who, live: L.live, code: x?.code, ok: !x || (x.code === codeOf(L.live, ks[0].read(L.live)) && x.value === ks[0].read(L.live)) }); }
  }
  return out;
}
export const storyLines = (w, act) => checkGroups(w, STORY[act].groups);

// The robot panel: what a robot knows (its own sensors) and what it heard, as the real facts in its own kernel.
// Every line is live: the latest write to that path in that robot's kernel (k.last), exactly as it was made.
export const PANEL = (id) => [
  { key: "knows", title: "It knows", sub: "own sensors", who: id,
    lines: [{ live: `robots.${id}.lightDist`, hint: "light" }, { live: "objects.ice.seen", hint: "ice" }, { live: "objects.comet.near", hint: "comet" }, { live: "objects.rock.inRange", hint: "reach" }] },
  { key: "heard", title: "It heard", sub: "may be old", who: id,
    lines: [...IDS.filter((o) => o !== id).flatMap((o) => [{ live: `robots.${id}.heard.${o}.battery`, hint: "said", from: o }, { live: `robots.${id}.heard.${o}.at`, hint: "ago", from: o }]),
      { live: `robots.${id}.inboxFrom`, hint: "tip" }, { live: `robots.${id}.inboxRock`, hint: "tipRock" }, { live: `robots.${id}.tipFrom`, hint: "accepted" }] },
];
export const panelLines = (w, id) => checkGroups(w, PANEL(id));

// One robot kernel. write() = one real kernel write; returns the kernel's wave for it (k, recomputed, changed).
export function createKernel(ME, id) {
  const me = new ME();
  const writes = [];
  const script = [];   // every call made while the kernel was set up (seed writes, the pointer, the rules), as code
  const last = {};     // path → its latest write (code, k), the setup included
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
    const w = { path, value, us, code: codeOf(path, value), ...waveOf(path) };
    if (log) { writes.push(w); if (writes.length > 400) writes.splice(0, 200); } else script.push(w.code);
    last[path] = w;
    return w;
  }
  function index() { for (const n of RULE_NAMES) { const p = `robots.${id}.${n}`; me(p); for (const s of me.explain(p)?.meta?.dependsOn || []) reader[s] ??= p; } }
  // a pointer, made with the .me operator ["->"]
  function point(path, target) { path.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s)).reduce((n, s) => n[s], me)["->"](target); script.push(`${codeOf(path, target).replace(/\((.*)\)$/, '["->"]($1)')}`); }
  return { me, write, point, index, writes, script, last, read: (p) => me(p) };
}

// deterministic random numbers (the same simulation every time: verify can replay it)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── the world ──
export function createWorld(ME, opts = {}) {
  const w = { t: 0, rand: rng(opts.seed ?? 7), rocks: [], robots: [], packets: [], events: [], lost: 0, delivered: 0, unheard: 0, log: [], comet: { on: false, x: 0, y: 0, n: 0 } };
  for (const rk of ROCKS) w.rocks.push({ ...rk, x: rk.home.x, y: rk.home.y, pinned: null, phase: 0, spots: rk.ice.map((a, i) => ({ id: `${rk.id}.${i}`, rock: rk.id, pos: a, left: 3 })) });
  for (const def of ROBOTS) {
    const rock = w.rocks.find((x) => x.id === def.rock);
    const k = createKernel(ME, def.id), base = `robots.${def.id}`;
    k.write(`${base}.id`, def.id, false); k.write(`${base}.name`, def.name, false);
    // the robot's home rock, and a pointer to it (read through; no formula reads through it)
    k.write(`rocks.${rock.key}.name`, rock.name, false); k.write(`rocks.${rock.key}.radius`, rock.R, false);
    k.point(`${base}.home`, `rocks.${rock.key}`);
    const facts = { battery: def.battery, pos: def.pos, lightDist: r4(lightDistOf(def.pos)), charging: false, now: 0,
      tipRock: 0, tipPos: 0, tipAt: NEVER, tipFrom: 0, inboxRock: 0, inboxPos: 0, inboxAt: NEVER, inboxFrom: 0,
      myRock: rock.id, maxAge: 120, costPerRad: r4(DRAIN_MOVE / omega(rock)), margin: 8, full: 95, ice: 0, found: 0, sent: 0, received: 0,
      role: def.role, mines: def.mines, slips: def.slips, studies: def.studies,
      "objects.ice.seen": false, "objects.ice.near": false, "objects.comet.near": false, "objects.rock.inRange": false };
    for (const [f, v] of Object.entries(facts)) k.write(factPath(def.id, f), v, false);
    k.write("objects.ice.name", "ice", false); k.write("objects.comet.name", "comet", false); k.write("objects.rock.name", ROCKS.find((x) => x.id !== rock.id).name, false);
    installRules(k.me, k.script); k.index();
    w.robots.push({ ...def, def, rockObj: rock, k, truth: { pos: def.pos, battery: def.battery }, written: { ...facts }, moving: 0, walked: 0,
      dead: false, drillT: 0, outbox: [], known: new Set(), lastSend: -SEND_GAP, nextHello: 3 + def.id * 7, seen: new Set(), action: "explore", status: "exploring", dest: "around the rock", lastBatch: [], heardFrom: {} });
  }
  return w;
}
export const robotOf = (w, id) => w.robots.find((r) => r.id === id);
export const rockOf = (w, id) => w.rocks.find((r) => r.id === id);

// where a rock is: it drifts on a slow loop unless someone holds it (pinned)
const DRIFT = { 2: { cx: 760, cy: 310, ax: 165, ay: 150, period: 900 } };
function placeRocks(w, dt) {
  for (const rk of w.rocks) {
    const d = DRIFT[rk.id]; if (!d) continue;
    if (rk.pinned) { rk.x += (rk.pinned.x - rk.x) * Math.min(1, 0.08 * dt); rk.y += (rk.pinned.y - rk.y) * Math.min(1, 0.08 * dt); continue; }
    rk.phase += (TAU / d.period) * dt;
    const tx = d.cx + d.ax * Math.cos(rk.phase - 1.9), ty = d.cy + d.ay * Math.sin(rk.phase - 1.9);
    rk.x += (tx - rk.x) * Math.min(1, 0.2 * dt); rk.y += (ty - rk.y) * Math.min(1, 0.2 * dt);
  }
}
export const sunAngle = (rk) => Math.atan2(SUN.y - rk.y, SUN.x - rk.x);
export function robotXY(w, r, lift = 0) { const rk = r.rockObj, a = sunAngle(rk) + r.truth.pos; return { x: rk.x + (rk.R + lift) * Math.cos(a), y: rk.y + (rk.R + lift) * Math.sin(a), a }; }
// line of sight: the segment between two robots must not cut through a rock (each robot's own rock: allowed at its foot)
function segHitsDisk(p, q, c, R) {
  const dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / L2));
  const x = p.x + t * dx - c.x, y = p.y + t * dy - c.y; return x * x + y * y < R * R;
}
export function radio(w, a, b) {   // can a hear b right now? and why not
  const p = robotXY(w, a, 4), q = robotXY(w, b, 4), d = Math.hypot(q.x - p.x, q.y - p.y);
  if (a.rock === b.rock) return { ok: true, d, same: true, why: "same rock" };
  if (d > RANGE) return { ok: false, d, why: "out of range" };
  for (const rk of w.rocks) if (segHitsDisk(p, q, rk, rk.R * 0.97)) return { ok: false, d, why: "a rock is in the way" };
  return { ok: true, d, why: "in range" };
}
const lossChance = (link) => (link.same ? LOSS_NEAR : LOSS_FAR + LOSS_FAR_EXTRA * (link.d / RANGE) ** 2);

// the radio: one message per SEND_GAP minutes; an outbox of OUTBOX (when full, the oldest waiting message is dropped)
export function enqueue(w, r, msg) {
  if (r.dead) return false;
  if (r.outbox.length >= OUTBOX) { r.outbox.shift(); w.events.push({ t: w.t, kind: "dropped", from: r.id }); }
  r.outbox.push(msg); return true;
}
function transmit(w, r) {
  if (r.dead || !r.outbox.length || w.t - r.lastSend < SEND_GAP) return;
  const msg = r.outbox.shift(); r.lastSend = w.t;
  const batch = r.lastBatch; batch.push(r.k.write(`robots.${r.id}.sent`, (r.written.sent += 1)));
  const from = robotXY(w, r, 8); let reached = 0;
  for (const o of w.robots) {
    if (o === r) continue;
    const link = radio(w, r, o);
    if (!link.ok) { w.unheard++; continue; }
    reached++;
    w.packets.push({ ...msg, from: r.id, to: o.id, sentAt: w.t, arriveAt: w.t + MSG_BASE + link.d / MSG_SPEED, x0: from.x, y0: from.y, roll: w.rand() });
  }
  w.events.push({ t: w.t, kind: "send", from: r.id, msg: msg.kind, reached, x: from.x, y: from.y });
}
// arrival: the link must still be there, and the message must survive the trip
function arrive(w, p) {
  const to = robotOf(w, p.to), from = robotOf(w, p.from), link = radio(w, from, to);
  const at = robotXY(w, to, 8);
  if (to.dead || !link.ok || p.roll < lossChance(link)) { w.lost++; w.events.push({ t: w.t, kind: "lost", from: p.from, to: p.to, why: to.dead ? "asleep" : !link.ok ? link.why : "noise", x: at.x, y: at.y }); return; }
  w.delivered++; w.events.push({ t: w.t, kind: "delivered", from: p.from, to: p.to, msg: p.kind, x: at.x, y: at.y, cross: !link.same, d: link.d });
  receive(w, to, p);
}
// the receiver writes what it heard into ITS OWN kernel, then its own rule decides what to accept
export function receive(w, r, p) {
  const base = `robots.${r.id}`, k = r.k, b = [];
  const put = (f, v) => { r.written[f] = v; b.push(k.write(factPath(r.id, f), v)); };
  put("received", r.written.received + 1);
  r.heardFrom[p.from] = (r.heardFrom[p.from] || 0) + 1;
  if (p.kind === "hello") { b.push(k.write(`${base}.heard.${p.from}.battery`, p.battery)); b.push(k.write(`${base}.heard.${p.from}.at`, p.at)); }
  let accepted = null;
  if (p.kind === "tip") {
    put("inboxFrom", p.from); put("inboxRock", p.rock); put("inboxPos", p.pos); put("inboxAt", p.at);
    accepted = !!k.read(`${base}.acceptTip`);
    if (accepted) {
      put("tipFrom", p.from); put("tipRock", p.rock); put("tipPos", p.pos); put("tipAt", p.at);
      if (p.spot) r.known.add(p.spot);
      if (!r.written["objects.ice.seen"]) { r.written["objects.ice.seen"] = true; b.push(k.write("objects.ice.seen", true)); }   // an accepted observation: it now knows there is ice
    }
    r.lastTip = { from: p.from, rock: p.rock, at: p.at, heardAt: w.t, accepted };
    w.events.push({ t: w.t, kind: "tip", to: r.id, from: p.from, rock: p.rock, accepted, age: w.t - p.at });
  }
  r.lastBatch.push(...b);
  return { batch: b, accepted };
}

// the comet: every COMET.every minutes it crosses the void, passing close to one rock, then the other
function placeComet(w) {
  const c = w.comet, k = w.t - COMET.first;
  if (k < 0) { c.on = false; return; }
  const n = Math.floor(k / COMET.every), f = (k - n * COMET.every) / COMET.lasts;
  c.on = f <= 1; c.n = n; if (!c.on) return;
  const rk = w.rocks[n % 2 === 0 ? 1 : 0];
  const from = { x: rk.x + 520, y: rk.y - 330 }, to = { x: rk.x - 420, y: rk.y + 300 };
  const via = { x: rk.x + 30, y: rk.y - rk.R - 70 };   // passes just above the rock
  const u = f, x = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * via.x + u * u * to.x, y = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * via.y + u * u * to.y;
  c.dx = x - (c.x ?? x); c.dy = y - (c.y ?? y); c.x = x; c.y = y;
}
const nearestKnownIce = (r) => [...r.rockObj.spots].filter((s) => r.known.has(s.id)).sort((a, b) => Math.abs(wrap(a.pos - r.truth.pos)) - Math.abs(wrap(b.pos - r.truth.pos)))[0];

// one control step of one robot: sense → write own facts → decide (its own kernel's flags) → act (adapter) → write
function stepRobot(w, r, dt) {
  const base = `robots.${r.id}`, k = r.k, rk = r.rockObj, batch = r.lastBatch;
  const put = (f, v) => { if (r.written[f] !== v) { r.written[f] = v; batch.push(k.write(factPath(r.id, f), v)); } };
  put("now", w.t);
  // its own sensors: the comet, the other rock (can its radio reach anyone there?), known ice close by
  const me = robotXY(w, r, 6);
  put("objects.comet.near", !r.dead && w.comet.on && Math.hypot(w.comet.x - me.x, w.comet.y - me.y) < COMET.sees);
  put("objects.rock.inRange", !r.dead && w.robots.some((o) => o.rock !== r.rock && radio(w, r, o).ok));
  const ki = nearestKnownIce(r);
  put("objects.ice.near", !!ki && Math.abs(wrap(ki.pos - r.truth.pos)) < 0.4);
  if (r.dead) { r.status = "asleep"; r.action = "sleep"; r.dest = "nowhere"; r.moving = 0; return; }
  const flags = { charge: k.read(`${base}.goCharge`), shelter: k.read(`${base}.shelter`), watch: k.read(`${base}.watchComet`), follow: k.read(`${base}.followTip`), avoid: k.read(`${base}.avoidIce`) };
  const om = omega(rk) * dt, pos = r.truth.pos;
  let target = null, action, mv = 0;
  if (flags.charge) { action = "charge"; if (lightDistOf(pos) > 1e-9) target = Math.sign(wrap(pos) || 1) * (HALF_PI - LIT_IN); }
  else if (flags.shelter) action = "shelter";
  else if (flags.watch) action = "watch";
  else if (flags.follow) { action = "tip"; const tp = k.read(`${base}.tipPos`); if (Math.abs(wrap(tp - pos)) > 0.02) target = tp; }
  else {
    action = "explore";
    if (flags.avoid && ki && Math.sign(wrap(ki.pos - pos)) === r.dir) { r.dir = -r.dir; r.avoidedAt = w.t; }   // ice ahead means "slippery": turn around
  }
  r.action = action;
  if (target != null) { const d = wrap(target - pos); mv = Math.sign(d) * Math.min(Math.abs(d), om); }
  else if (action === "explore") mv = r.dir * om;
  r.truth.pos = wrap(pos + mv); r.moving = mv;
  r.walked += Math.abs(mv) * rk.R;
  const lit = litAt(r.truth.pos), still = Math.abs(mv) < 1e-9;
  r.truth.battery = Math.min(100, r.truth.battery + (lit ? (still ? CHARGE_STILL : CHARGE_MOVE) : -(still ? DRAIN_STILL : DRAIN_MOVE)) * dt);
  if (r.truth.battery <= 0) { r.truth.battery = 0; r.dead = true; r.moving = 0; }
  // ice: walking over a crater with ice it did not know about, a spider notices it. It writes what it saw into its own
  // kernel; a miner or a scientist also makes it its plan (tip); everyone tells the others what they saw.
  if (action === "explore" && !r.dead) for (const s of rk.spots) {
    if (s.left > 0 && !r.known.has(s.id) && Math.abs(wrap(s.pos - r.truth.pos)) < om + 0.02) {
      r.known.add(s.id);
      put("found", r.written.found + 1); put("objects.ice.seen", true);
      if (!r.slips) { r.truth.pos = s.pos; put("tipFrom", r.id); put("tipRock", rk.id); put("tipPos", s.pos); put("tipAt", w.t); }
      enqueue(w, r, { kind: "tip", rock: rk.id, pos: s.pos, at: w.t, spot: s.id });
      w.events.push({ t: w.t, kind: "found", by: r.id, spot: s.id });
      break;
    }
  }
  // working at the crater (mining or sampling)
  let drilling = false;
  if (action === "tip" && target == null && !r.dead) {
    const s = rk.spots.find((x) => Math.abs(wrap(x.pos - r.truth.pos)) < 0.03);
    if (s && s.left > 0) {
      drilling = true; r.known.add(s.id); r.drillT += dt; put("tipAt", w.t);   // it sees the ice itself now
      if (r.drillT >= DRILL_MIN) { r.drillT = 0; s.left -= 1; put("ice", r.written.ice + 1); }
      if (s.left <= 0) { put("tipAt", NEVER); drilling = false; }       // nothing left: forget the tip
    } else put("tipAt", NEVER);                                         // nothing there (any more): forget the tip
  } else r.drillT = 0;
  put("pos", r4(r.truth.pos)); put("lightDist", r4(lightDistOf(r.truth.pos))); put("battery", r4(r.truth.battery));
  // charging = "I have decided to charge": it stays true until the battery is full (goCharge reads it back)
  put("charging", action === "charge" && !r.dead);
  const charging = action === "charge" && lightDistOf(r.truth.pos) <= 1e-9 && !r.dead;
  if (w.t >= r.nextHello) { r.nextHello = w.t + HELLO_EVERY; enqueue(w, r, { kind: "hello", battery: Math.round(r.truth.battery), at: w.t }); }
  const tipFrom = k.read(`${base}.tipFrom`);
  const work = r.studies ? "studying the ice" : "mining ice";
  r.status = r.dead ? "asleep" : action === "charge" ? (charging ? "charging" : "going to the sun")
    : action === "shelter" ? "hiding from the comet dust" : action === "watch" ? "studying the comet"
    : action === "tip" ? (drilling ? work : "going to the ice") : (r.avoidedAt != null && w.t - r.avoidedAt < 25 ? "turning away from the ice" : "exploring");
  r.dest = r.dead ? "nowhere: it is asleep" : action === "charge" ? (charging ? "stays here, in the sun" : "the sunny side") : action === "shelter" || action === "watch" ? "stays where it is"
    : action === "tip" ? (drilling ? "stays here, at the ice" : tipFrom !== r.id ? `the ice ${NAME[tipFrom]} told it about` : "the ice it found") : "around its rock, looking";
}

export function step(w, dt = 1) {
  w.t += dt;
  placeRocks(w, dt); placeComet(w);
  for (const r of w.robots) r.lastBatch = [];
  for (const r of w.robots) stepRobot(w, r, dt);
  for (const r of w.robots) transmit(w, r);
  const due = w.packets.filter((p) => p.arriveAt <= w.t); w.packets = w.packets.filter((p) => p.arriveAt > w.t);
  for (const p of due) arrive(w, p);
  if (w.events.length > 300) w.events.splice(0, 150);
}

// ── interactions (the user acts on the world, or presses a robot's radio button; never on another robot's kernel) ──
export function setBattery(w, id, value) {   // the slider / "drain": the real battery changes, and the robot measures it at once
  const r = robotOf(w, id); if (r.dead && value > 0) r.dead = false;
  r.truth.battery = value; r.written.battery = value; r.lastBatch = [];
  return r.k.write(`robots.${id}.battery`, value);
}
export function sayHello(w, id) { const r = robotOf(w, id); return enqueue(w, r, { kind: "hello", battery: Math.round(r.truth.battery), at: w.t }); }
export function shareTip(w, id) {   // the robot's radio sends a tip about the nearest crater with ice left on its own rock
  const r = robotOf(w, id), s = [...r.rockObj.spots].filter((x) => x.left > 0).sort((a, b) => Math.abs(wrap(a.pos - r.truth.pos)) - Math.abs(wrap(b.pos - r.truth.pos)))[0];
  if (!s) return false; return enqueue(w, r, { kind: "tip", rock: r.rock, pos: s.pos, at: w.t, spot: s.id });
}
export function holdRock(w, id, xy) { const rk = rockOf(w, id); rk.pinned = xy ? { x: xy.x, y: xy.y } : null; if (!xy) rk.phase = Math.atan2((rk.y - DRIFT[id].cy) / DRIFT[id].ay, (rk.x - DRIFT[id].cx) / DRIFT[id].ax) + 1.9; }
export function moveRockNow(w, id, xy) { const rk = rockOf(w, id); rk.x = xy.x; rk.y = xy.y; rk.pinned = { ...xy }; }
export const FAR = { x: 925, y: 110 }, NEAR = { x: 600, y: 230 };

// Every derived path of every kernel compared with a fresh kernel rebuilt from the same facts + same rules,
// and with the same rules computed in plain JS.
export function verifyWorld(ME, w) {
  const mismatches = []; let checked = 0;
  const eq = (x, y) => x === y || (typeof x === "number" && typeof y === "number" && Math.abs(x - y) < 1e-9);
  for (const r of w.robots) {
    const i = r.id, fresh = new ME();
    const facts = Object.fromEntries(FACTS.map((f) => [f, r.k.read(factPath(i, f))]));
    for (const f of FACTS) factPath(i, f).split(".").map((x) => (/^\d+$/.test(x) ? Number(x) : x)).reduce((n, seg, j, arr) => (j === arr.length - 1 ? n[seg](facts[f]) : n[seg]), fresh);
    installRules(fresh);
    const js = rulesJS(facts);
    for (const n of RULE_NAMES) {
      const p = `robots.${i}.${n}`, a = r.k.read(p), b = fresh(p), c = js[n];
      checked++; if (!eq(a, b)) mismatches.push({ who: r.name, path: p, live: a, fresh: b });
      checked++; if (!eq(a, c)) mismatches.push({ who: r.name, path: p + " (JS)", live: a, js: c });
      checked++; if (a === undefined) mismatches.push({ who: r.name, path: p + " (undefined)" });
    }
  }
  return { ok: mismatches.length === 0, checked, mismatches };
}
