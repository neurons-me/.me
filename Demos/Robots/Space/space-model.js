// Autonomous Robotics in Space: the model (shared by the page and verify.mjs).
// KERNEL (this.me 4.2 candidate: a LOCAL build of integ/4.2-rootfix, not published): one kernel per robot. Every
// robot fact, every derived value, k, explain(). The battery level is a 4.2 collection aggregate (robots[i].batteries[]).
// ADAPTER (plain JS, here): the physical truth (where a spider really stands, its real battery, where the rocks are),
// walking, the radios (range, line of sight, delay, bandwidth, loss) and which action a spider takes from its flags.
// A robot's own readings (its batteries, its sensors) and its communications (outbox / inbox) are kept apart.
// No robot ever writes into another robot's kernel: the sender writes what it sends into its OWN outbox; a message
// only reaches the receiver's adapter, and the receiver writes it (same message id) into its OWN inbox, where its own
// rule (inbox[id].acceptTip) decides whether an ice tip becomes its plan.
// No imports: the page passes the kernel constructor it loaded (sha256-checked); Node does the same.

export const VB = { w: 1000, h: 600 };
export const SUN = { x: -40, y: 290 };            // the Sun, off the left edge: light comes from the left
export const TAU = Math.PI * 2, HALF_PI = Math.PI / 2;
export const SPEED = 3;                           // walking speed, px per simulated minute (stylized)
export const DRAIN_MOVE = 0.22, DRAIN_STILL = 0.06, CHARGE_STILL = 0.3, CHARGE_MOVE = 0.1;   // % per simulated minute
export const LIT_IN = 0.25;                       // a spider charges once it stands this far inside the lit half (rad)
export const RANGE = 410;                         // radio range across the void, px
export const MSG_SPEED = 30, MSG_BASE = 1;        // message travel: 1 min + distance / 30 px per min (slowed down to be seen)
export const SEND_GAP = 6, QUEUE = 3, HELLO_EVERY = 40;    // bandwidth: one message per 6 min, a send queue of 3
export const KEEP = 2;                            // inbox and outbox keep the last 2 messages per peer (+ the tip it accepted, in the inbox)
// Each spider starts with two batteries (Wh); one can be added, swapped or removed while it runs. Its battery level is
// a rule over however many it has: total charge as a % of total capacity. The adapter fills the first battery first
// and drains the last one first.
export const BATTERIES = [{ i: 1, name: "main", capacity: 60 }, { i: 2, name: "spare", capacity: 40 }];
export const EXTRA_BATTERY = { i: 3, name: "extra", capacity: 30 };
export const capacityOf = (bats) => bats.reduce((a, b) => a + b.capacity, 0);
export const CAPACITY = capacityOf(BATTERIES);
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
  { key: "flower", name: "the flower", facts: ["objects.flower.water"] },
];
export const COMET = { first: 50, every: 420, lasts: 110, sees: 230 };
// One flower on B 612. It is NOT a kernel: the page holds how much water it really has. Oli and Tiko, who live on that
// rock, each keep in their OWN kernel what they last saw (objects.flower.water, a %) and where it grows; their own rule
// decides when to water it. Lua, on B 325, has never seen it: its kernel holds no flower facts.
export const FLOWER = { rock: 1, pos: 0.9, water: 70, dry: 0.08, sees: 0.6, fill: 100, wateringMin: 4 };   // dry: % per simulated minute · sees: how close (rad) it must be to see it
export const IDS = ROBOTS.map((r) => r.id);
export const NAME = Object.fromEntries(ROBOTS.map((r) => [r.id, r.name]));
export const ROCK_NAME = Object.fromEntries(ROCKS.map((r) => [r.id, r.name]));

// The rules: ONE text per rule, installed as a class template me.robots["[i]"]["="](name, expr) in every kernel.
// No rule reads through a pointer (this.me 4.1.0 known issue #4: such a formula is not recomputed when its target changes).
// 4.2: x[].f is the exact sum of f over the members of x (x[] counts them). An aggregate is bound from the root, so the
// per-robot form names robots[i] (the template substitutes i), as in contract v4.1.
export const BATTERY_RULE = "robots[i].batteries[].charge / robots[i].batteries[].capacity * 100";
// the 4.1 form, for comparison: an explicit sum over the batteries it has (redeclared whenever the set changes)
export const explicitBatteryRule = (bats) => `(${bats.map((b) => `batteries[${b.i}].charge`).join(" + ")}) / (${bats.map((b) => `batteries[${b.i}].capacity`).join(" + ")}) * 100`;
// how many messages each box keeps right now (undefined while the box is empty: an absent collection)
export const KEPT_RULES = [["inboxKept", "robots[i].inbox[]"], ["outboxKept", "robots[i].outbox[]"]];
export const RULES = [
  ["battery", BATTERY_RULE],
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
  // the flower: thirsty when the level it last saw is low; it waters it only in its free time (when it would explore,
  // so charging, sheltering and tips come first) and only with battery above its reserve. Lua has no flower facts:
  // these two stay undefined in its kernel (missing input), and nothing else reads them.
  ["flowerThirsty", "objects.flower.water < thirstyBelow"],
  ["shouldWaterFlower", "flowerThirsty && explore && battery > reserve"],
];
export const FLOWER_RULES = ["flowerThirsty", "shouldWaterFlower"];
// The inbox rule: a class template on the robot's OWN inbox, so it is computed on every message it receives. A formula
// on a message sees that message's facts by name; the robot's facts are named by their full path (robots[N].myRock):
// .me 4.1.0 has no nested ["[i]"] template and no "parent" name, so the text names its own robot: one text per kernel.
// It has no string literals either, so the kind is not compared: a hello has no rock, and the rule stays undefined.
export const inboxRule = (id) => `rock == robots[${id}].myRock && got - at <= robots[${id}].maxAge && !robots[${id}].tipFresh`;
export const inboxRuleCode = (id) => `me.robots[${id}].inbox["[i]"]["="]("acceptTip", ${JSON.stringify(inboxRule(id))})`;
export const RULE_NAMES = RULES.map(([n]) => n);
export const ruleCode = ([n, e]) => `me.robots["[i]"]["="](${JSON.stringify(n)}, ${JSON.stringify(e)})`;
// The contract oracle for x[].f: the exact sum of the terms, rounded once (BigInt, scaled by 2^-1074; independent of the
// kernel's code, the same reference as the kernel's tests: tests/aggregate/exact-sum-ref.mjs).
function toScaled(x) {
  const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4), sign = hi >>> 31, exp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), shift = 0n;
  if (exp !== 0) { mant |= 1n << 52n; shift = BigInt(exp - 1); }
  const n = mant << shift; return sign ? -n : n;
}
function roundScaled(N) {
  if (N === 0n) return 0;
  const neg = N < 0n, A = neg ? -N : N, L = A.toString(2).length; let q = A, shift = 0;
  if (L > 53) { shift = L - 53; const s = BigInt(shift); q = A >> s; const r = A - (q << s), half = 1n << (s - 1n);
    if (r > half || (r === half && (q & 1n) === 1n)) q += 1n; if (q === 1n << 53n) { q >>= 1n; shift += 1; } }
  const v = Number(q) * 2 ** (shift - 1074); return neg ? -v : v;
}
export const exactSum = (terms) => roundScaled(terms.reduce((a, t) => a + toScaled(t), 0n));
export const floatSum = (terms) => terms.reduce((a, t) => a + t);   // 4.1 explicit a + b + c: left to right, rounded each step
// battery from its batteries: the aggregate (oracle) or the 4.1 explicit sum
export const batteryJS = (bs, explicit = false) => { const S = explicit ? floatSum : exactSum; return S(bs.map((b) => b.charge)) / S(bs.map((b) => b.capacity)) * 100; };
// The same rules in plain JS (verify compares the kernel against these). f.bats = [{ charge, capacity }].
export function rulesJS(f, explicit = false) {
  const battery = batteryJS(f.bats, explicit);
  const reserve = f.lightDist * f.costPerRad + f.margin, mustCharge = battery < reserve, charged = battery >= f.full;
  const goCharge = mustCharge || (f.charging && !charged), asleep = battery <= 0;
  const iceSeen = f["objects.ice.seen"], cometNear = f["objects.comet.near"];
  const iceIsFuel = f.mines && iceSeen, iceIsHazard = f.slips && iceSeen, iceIsSample = f.studies && iceSeen;
  const cometIsHazard = !f.studies && cometNear, cometIsSample = f.studies && cometNear, rockInReach = f["objects.rock.inRange"];
  const shelter = !goCharge && cometIsHazard, watchComet = !goCharge && cometIsSample, avoidIce = iceIsHazard && f["objects.ice.near"];
  const tipAge = f.now - f.tipAt, tipFresh = tipAge <= f.maxAge, tipMine = f.tipRock === f.myRock;
  const followTip = !goCharge && !cometNear && tipFresh && tipMine && !f.slips, explore = !goCharge && !shelter && !watchComet && !followTip;
  const water = f["objects.flower.water"], flowerThirsty = water === undefined ? undefined : water < f.thirstyBelow;
  const shouldWaterFlower = flowerThirsty === undefined ? undefined : flowerThirsty && explore && battery > reserve;
  return { battery, reserve, mustCharge, charged, goCharge, asleep, iceIsFuel, iceIsHazard, iceIsSample, cometIsHazard, cometIsSample, rockInReach, shelter, watchComet, avoidIce, tipAge, tipFresh, tipMine, followTip, explore, flowerThirsty, shouldWaterFlower };
}
// the inbox rule in plain JS, for one message m (its own facts) in robot f's kernel
export const acceptTipJS = (f, m) => (m.rock === undefined ? undefined : m.rock === f.myRock && m.got - m.at <= f.maxAge && !rulesJS(f).tipFresh);
export const MSG_FACTS = ["from", "to", "kind", "battery", "rock", "pos", "at", "got", "accepted"];
export const batteryFacts = (bats) => bats.flatMap((b) => [`batteries.${b.i}.charge`, `batteries.${b.i}.capacity`]);
export const FACTS = ["lightDist", "charging", "now", "tipRock", "tipAt", "myRock", "maxAge", "costPerRad", "margin", "full",
  "mines", "slips", "studies", "objects.ice.seen", "objects.ice.near", "objects.comet.near", "objects.rock.inRange", "thirstyBelow", "objects.flower.water", "objects.flower.pos"];
// a fact name → its path in robot i's kernel ("objects.*" facts live at the kernel's top level: that robot's view of the object)
export const factPath = (i, f) => (f.startsWith("objects.") ? f : `robots.${i}.${f}`);
const NEVER = -1000000;   // "never": an observation time so old that every age check fails
const r4 = (x) => Math.round(x * 1e4) / 1e4;
export const wrap = (a) => { a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a === -Math.PI ? Math.PI : a; };
export const omega = (rock) => SPEED / rock.R;   // rad per simulated minute
export const lightDistOf = (pos) => Math.max(0, Math.abs(wrap(pos)) - (HALF_PI - LIT_IN));
export const litAt = (pos) => Math.abs(wrap(pos)) < HALF_PI;

// opts.explicit: the 4.1 form of the battery rule over these batteries (opts.bats), for comparison runs
export function installRules(me, script, id, opts = {}) {
  for (const [n, e0] of RULES) { if (!opts.flower && FLOWER_RULES.includes(n)) continue; const e = n === "battery" && opts.explicit ? explicitBatteryRule(opts.bats || BATTERIES) : e0; me.robots["[i]"]["="](n, e); script?.push(ruleCode([n, e])); }
  if (!opts.explicit) for (const [n, e] of KEPT_RULES) { me.robots["[i]"]["="](n, e); script?.push(ruleCode([n, e])); }
  if (id != null) { me.robots[id].inbox["[i]"]["="]("acceptTip", inboxRule(id)); script?.push(inboxRuleCode(id)); }
}
// a battery level (%) → the charge in each battery (Wh): fill the first battery first, drain the last one first
export function charges(pct, bats = BATTERIES) {
  const wh = (pct * capacityOf(bats)) / 100; let before = 0;
  return bats.map((b) => { const c = r4(Math.max(0, Math.min(b.capacity, wh - before))); before += b.capacity; return c; });
}
// the code of one write, exactly as the call is made: "robots.1.battery" + 82 → me.robots[1].battery(82)
export const codeOf = (path, value) => "me" + path.split(".").map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`)).join("") + `(${JSON.stringify(value)})`;

// ── the story: each act told with .me lines that really run ──
// A line is either fixed code that the kernel ran while it was set up (verify checks it is in that kernel's setup
// script, word for word), or { live: path }: the latest real write to that path in that kernel, shown as written.
// { value: path } adds "→ value" read from the same kernel. who: the kernel (robot id), or "all" (in all three).
// { msg: { box, peer | kind, fields } } stands for one message in that kernel's inbox or outbox, found by the page
// (the latest to / from that peer through the lastTo / lastFrom pointer, or the newest of that kind); it expands
// into live lines: the pointer (when used) and the message's own writes, e.g. me.robots[1].inbox[42].battery(71).
// { msgs: { box, fields } }: every message the box keeps, newest first.
const rule = (n) => ruleCode([...RULES, ...KEPT_RULES].find(([x]) => x === n));
const seed = (id, f) => codeOf(`robots.${id}.${f}`, f === "name" ? ROBOTS[id - 1].name : f === "role" ? ROBOTS[id - 1].role : ROBOTS[id - 1][f]);
const ROCK_KEY = (id) => ROCKS.find((x) => x.id === ROBOTS[id - 1].rock).key;
const homeLines = (id) => [seed(id, "name"), codeOf(`rocks.${ROCK_KEY(id)}.name`, ROCKS.find((x) => x.key === ROCK_KEY(id)).name), `me.robots[${id}].home["->"]("rocks.${ROCK_KEY(id)}")`];
const meaning = (id, f, n) => [seed(id, "role"), seed(id, f), { live: "objects.ice.seen" }, { code: rule(n), value: `robots.${id}.${n}` }];
const MSG_SHOW = ["from", "to", "kind", "battery", "rock", "at"];
export const STORY = [null,
  { title: "Two small rocks", text: "Two small rocks, three spider robots, and nobody drives them. Each spider keeps its own .me kernel and first writes down who it is and where it lives. Tap a spider in the sky or in the code.", link: { text: ".me kernel", href: "https://neurons-me.github.io/.me/" },
    groups: [{ who: 1, lines: homeLines(1) }, { who: 2, lines: homeLines(2) }, { who: 3, lines: homeLines(3) }] },
  { title: "Each one decides", text: "Every simulated minute each spider measures its batteries; one rule adds up however many it carries, and its rules decide when to walk to the sun.",
    groups: [{ who: 2, lines: [{ live: "robots.2.batteries.1.charge" }, { live: "robots.2.batteries.2.charge" }, { code: rule("battery"), value: "robots.2.battery" }, { code: rule("mustCharge"), value: "robots.2.mustCharge" }, { code: rule("goCharge"), value: "robots.2.goCharge" }] }] },
  { title: "One ice, three meanings", text: "The same ice and the same rule text in every kernel: what the ice means comes from each spider's role.",
    groups: [{ who: 1, lines: meaning(1, "mines", "iceIsFuel") }, { who: 2, lines: meaning(2, "slips", "iceIsHazard") }, { who: 3, lines: meaning(3, "studies", "iceIsSample") }] },
  { title: "Talking across the void", text: "Small radios with a short range. The sender writes each message in its own outbox; the receiver writes the same message id in its own inbox, only if it arrives.",
    groups: [{ who: 3, lines: [{ msg: { box: "outbox", peer: 1, fields: MSG_SHOW }, none: "nothing sent to Oli yet" }] },
      { who: 1, lines: [{ msg: { box: "inbox", peer: 3, fields: MSG_SHOW }, none: "nothing from Lua yet" }] }] },
  { title: "An inbox, not orders", text: "Nobody writes into another spider's kernel. An ice tip lands in the receiver's inbox, and its own rule there decides.",
    groups: [{ who: 2, lines: [inboxRuleCode(2), { msg: { box: "inbox", kind: "ice", fields: ["from", "rock", "accepted"] }, none: "no ice tip in Tiko's inbox yet" }, { live: "robots.2.tipMsg", none: "" }] },
      { who: 3, lines: [inboxRuleCode(3), { msg: { box: "inbox", kind: "ice", fields: ["from", "rock", "accepted"] }, none: "no ice tip in Lua's inbox yet" }] }] },
  { title: "Drifting apart", text: "B 325 drifts. Out of range nothing arrives, and the last message in the inbox keeps its age.",
    groups: [{ who: 1, lines: [{ live: "objects.rock.inRange" }, { live: "robots.1.now" }, { msg: { box: "inbox", peer: 3, fields: ["at"] }, none: "nothing from Lua yet" }] },
      { who: 3, lines: [{ live: "objects.rock.inRange" }, { live: "robots.3.now" }, { msg: { box: "inbox", peer: 1, fields: ["at"] }, none: "nothing from Oli yet" }] }] },
  { title: "A small cost", text: "Each write recomputes only the paths that read it: that number is k. Verify rebuilds all three kernels and compares.",
    groups: [{ who: 1, lines: [{ live: "robots.1.batteries.1.charge", k: true }, { live: "robots.1.batteries.2.charge", k: true }, { live: "robots.1.lightDist", k: true }, { live: "robots.1.now", k: true }] }] },
];
// the flower act: a follow-up, off by default (createWorld(ME, { flower: true }) / ?flower=1); not in STORY yet
export const FLOWER_ACT = { title: "A flower to care for", text: "A flower grows on B 612. Oli and Tiko each write down how much water they see in it; their own rule says when to water it, but only in their free time, and never before charging. Lua has never seen it: its rule cannot decide.",
    groups: [{ who: 1, lines: [{ live: "objects.flower.water" }, { code: rule("flowerThirsty"), value: "robots.1.flowerThirsty" }, { code: rule("shouldWaterFlower"), value: "robots.1.shouldWaterFlower" }] },
      { who: 2, lines: [{ live: "objects.flower.water" }, { code: rule("shouldWaterFlower"), value: "robots.2.shouldWaterFlower" }] },
      { who: 3, lines: [{ code: rule("flowerThirsty"), value: "robots.3.flowerThirsty" }] }] };
// the message ids a robot's box keeps, newest first (the adapter's index of what it wrote; the facts are in the kernel)
export const msgIds = (r, box) => Object.values(r.ring[box]).flat().filter((id) => r.k.last[`robots.${r.id}.${box}.${id}.at`]).sort((a, b) => b - a);
const ptrId = (k, path) => { const t = k.read(path)?.__ptr; const m = t && /\.(\d+)$/.exec(t); return m && k.last[`${t}.at`] ? Number(m[1]) : null; };
// one group → its concrete lines in that kernel (msg / msgs specs expanded into live lines)
export function expandLines(w, g) {
  const r = g.who === "all" ? null : w.robots.find((x) => x.id === g.who), out = [];
  for (const ln of g.lines) {
    const L = typeof ln === "string" ? { code: ln } : ln, spec = L.msg || L.msgs;
    if (!spec) { out.push(L); continue; }
    const base = `robots.${r.id}`, ptr = L.msg?.peer != null ? `${base}.${spec.box === "inbox" ? "lastFrom" : "lastTo"}.${spec.peer}` : null;
    const ids = L.msgs ? msgIds(r, spec.box) : [ptr ? ptrId(r.k, ptr) : msgIds(r, spec.box).find((id) => r.k.read(`${base}.${spec.box}.${id}.kind`) === spec.kind)].filter((x) => x != null);
    if (!ids.length) { out.push({ none: L.none ?? "" }); continue; }
    if (ptr) out.push({ live: ptr });
    for (const id of ids) for (const f of spec.fields) { const path = `${base}.${spec.box}.${id}.${f}`; if (r.k.last[path]) out.push({ live: path, box: spec.box, mid: id, field: f, hint: L.hint }); }
  }
  return out;
}
// check lines against the world's kernels: fixed lines in the setup script, live lines = the latest real write
export function checkGroups(w, groups) {
  const out = [];
  for (const g of groups) for (const L of expandLines(w, g)) {
    if (L.none !== undefined && !L.live && !L.code) continue;
    const ks = (g.who === "all" ? w.robots : [w.robots.find((r) => r.id === g.who)]).map((r) => r.k);
    if (L.code) { out.push({ who: g.who, code: L.code, ok: ks.every((k) => k.script.includes(L.code)) }); continue; }
    const k = ks[0], x = k.last[L.live], v = k.read(L.live);
    const ok = !x || (x.ptr ? v?.__ptr === x.value && x.code === `${codeOf(L.live, x.value).replace(/\((.*)\)$/, '["->"]($1)')}` : x.code === codeOf(L.live, v) && x.value === v);
    out.push({ who: g.who, live: L.live, code: x?.code, ok });
  }
  return out;
}
export const storyLines = (w, act) => checkGroups(w, STORY[act].groups);

// The robot panel. "It knows": its own readings (its batteries, its sensors). "Inbox" / "Outbox": its communications,
// every message the box keeps, by id. Every line is live: the latest write to that path in that robot's own kernel.
export const PANEL = (id, w) => [
  { key: "knows", title: "It knows", sub: "its own readings", who: id,
    lines: [...(w ? robotOf(w, id).bats : BATTERIES).map((b) => ({ live: `robots.${id}.batteries.${b.i}.charge`, hint: "charge", bat: b })), { live: `robots.${id}.lightDist`, hint: "light" }, { live: "objects.ice.seen", hint: "ice" }, { live: "objects.comet.near", hint: "comet" }, { live: "objects.rock.inRange", hint: "reach" }, ...(w?.flower ? [{ live: "objects.flower.water", hint: "flower" }] : [])] },
  { key: "inbox", title: "Inbox", sub: `what arrived: the last ${KEEP} from each`, who: id, lines: [{ msgs: { box: "inbox", fields: ["from", "battery", "rock"] }, none: "nothing has arrived yet" }] },
  { key: "outbox", title: "Outbox", sub: `what it sent: the last ${KEEP} to each`, who: id, lines: [{ msgs: { box: "outbox", fields: ["to", "battery", "rock"] }, none: "nothing sent yet" }] },
];
export const panelLines = (w, id) => checkGroups(w, PANEL(id, w));

// The dashboard cards. Each card shows real .me lines from that robot's kernel (a rule → its value, the latest write
// to a fact, or a line of its setup script) and, under them, the same thing in plain words. Where a card's content
// is not in the kernel (where an exploring robot walks is the simulation's own state), the card says "page state".
// The flag that decided what it is doing, in the adapter's order (the kernel's flags; asleep when its battery is empty)
export const DECIDED = [["charge", "goCharge"], ["shelter", "shelter"], ["watch", "watchComet"], ["tip", "followTip"], ["water", "shouldWaterFlower"], ["explore", "explore"], ["sleep", "asleep"]];
export const flagOf = (r) => (DECIDED.find(([a]) => a === r.action) || DECIDED[5])[1];
export function CARDS(w, id) {
  const r = robotOf(w, id), base = `robots.${id}`, flag = flagOf(r);
  const doing = { key: "doing", title: "Doing", who: id, lines: [{ code: rule(flag), value: `${base}.${flag}` }] };
  const going = { key: "going", title: "Going to", who: id,
    lines: r.action === "charge" ? [{ live: `${base}.lightDist` }] : r.action === "tip" ? [{ live: `${base}.tipPos` }, ...(r.tipMsg != null ? [{ live: `${base}.tipMsg` }] : [])]
      : r.action === "water" ? [{ code: codeOf("objects.flower.pos", r.k.read("objects.flower.pos")) }] : [],
    page: !["charge", "tip", "water"].includes(r.action) };   // explore / shelter / watch / sleep: its path is the simulation's state
  const msgs = { key: "msgs", title: "Messages", who: id, lines: [{ live: `${base}.sent` }, { live: `${base}.received` }, { code: rule("outboxKept"), value: `${base}.outboxKept` }, { code: rule("inboxKept"), value: `${base}.inboxKept` }] };
  const ice = { key: "ice", title: r.studies ? "Ice samples" : r.slips ? "Ice spots found" : "Ice mined", who: id, lines: [{ live: `${base}.${r.slips ? "found" : "ice"}` }] };
  return [doing, going, msgs, ice];
}
export const cardLines = (w, id) => checkGroups(w, CARDS(w, id));

// One robot kernel. write() = one real kernel write; returns the kernel's wave for it (k, recomputed, changed).
export function createKernel(ME, id, opts = {}) {
  const me = new ME();
  if (opts.mode) me.setRecomputeMode(opts.mode);
  const writes = [];
  const script = [];   // every call made while the kernel was set up (seed writes, the pointer, the rules), as code
  const last = {};     // path → its latest write (code, k), the setup included
  const reader = {};   // fact path → one derived path that reads it (from the kernel's own dependsOn)
  const aggReader = [];   // [collection prefix, derived path]: an aggregate (dependsOn "C[].f" / "C[]") reads every fact under C
  function waveOf(path) {
    // a fact of a received message is read by that message's own acceptTip
    const mm = /^(robots\.\d+\.inbox\.\d+)\.\w+$/.exec(path);
    const d = reader[path] || (mm && `${mm[1]}.acceptTip`) || aggReader.find(([c]) => (path + ".").startsWith(c))?.[1]; if (!d) return { k: 0, recomputed: [], changed: [] };
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
  function index() { for (const n of [...RULE_NAMES, ...KEPT_RULES.map(([x]) => x)]) { const p = `robots.${id}.${n}`; if (!me.explain(p)?.expr) continue; me(p);
    for (const s of me.explain(p)?.meta?.dependsOn || []) { const a = /^(.*)\[\](\..*)?$/.exec(s); if (a) { if (!aggReader.some(([c]) => c === a[1] + ".")) aggReader.push([a[1] + ".", p]); } else reader[s] ??= p; } } }
  const node = (path) => path.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s)).reduce((n, s) => n[s], me);
  // a pointer, made with the .me operator ["->"] (log = a live write, kept in last[path] like any other write)
  function point(path, target, log = false) {
    const t0 = performance.now(); node(path)["->"](target);
    const w = { path, value: target, ptr: true, us: (performance.now() - t0) * 1000, code: `${codeOf(path, target).replace(/\((.*)\)$/, '["->"]($1)')}`, k: 0, recomputed: [], changed: [] };
    if (log) { writes.push(w); if (writes.length > 400) writes.splice(0, 200); } else script.push(w.code);
    last[path] = w; return w;
  }
  // remove a branch, with the .me operator ["-"] (an old message, a battery taken out, a pointer no longer needed)
  function remove(path) {
    const t0 = performance.now(); node(path)["-"]();
    const us = (performance.now() - t0) * 1000;
    for (const p of Object.keys(last)) if (p === path || p.startsWith(path + ".")) delete last[p];
    const w = { path, removed: true, us, code: `${codeOf(path, 0).replace(/\((.*)\)$/, '["-"]()')}`, ...waveOf(path) };
    writes.push(w); if (writes.length > 400) writes.splice(0, 200); return w;
  }
  // redeclare one rule (the 4.1 comparison: the explicit battery sum names each battery, so it changes with the set)
  function rule(n, e) { me.robots["[i]"]["="](n, e); script.push(ruleCode([n, e])); index(); }
  return { me, write, point, remove, index, rule, writes, script, last, read: (p) => me(p) };
}

// deterministic random numbers (the same simulation every time: verify can replay it)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── the world ──
export function createWorld(ME, opts = {}) {
  // opts.mode: "eager" (default) or "lazy" recompute; opts.explicit: the 4.1 explicit battery sum instead of the aggregate
  const w = { t: 0, rand: rng(opts.seed ?? 7), rocks: [], robots: [], packets: [], events: [], lost: 0, delivered: 0, unheard: 0, nextMsg: 1, log: [], comet: { on: false, x: 0, y: 0, n: 0 }, mode: opts.mode || "eager", explicit: !!opts.explicit,
    flower: !opts.flower ? null : { ...FLOWER, waterings: 0 } };
  for (const rk of ROCKS) w.rocks.push({ ...rk, x: rk.home.x, y: rk.home.y, pinned: null, phase: 0, spots: rk.ice.map((a, i) => ({ id: `${rk.id}.${i}`, rock: rk.id, pos: a, left: 3 })) });
  for (const def of ROBOTS) {
    const rock = w.rocks.find((x) => x.id === def.rock);
    const k = createKernel(ME, def.id, { mode: opts.mode }), base = `robots.${def.id}`, bats = BATTERIES.map((b) => ({ ...b }));
    k.write(`${base}.id`, def.id, false); k.write(`${base}.name`, def.name, false);
    // the robot's home rock, and a pointer to it (read through; no formula reads through it)
    k.write(`rocks.${rock.key}.name`, rock.name, false); k.write(`rocks.${rock.key}.radius`, rock.R, false);
    k.point(`${base}.home`, `rocks.${rock.key}`);
    const c0 = charges(def.battery), bat = Object.fromEntries(BATTERIES.flatMap((b, j) => [[`batteries.${b.i}.capacity`, b.capacity], [`batteries.${b.i}.charge`, c0[j]]]));
    const facts = { ...bat, pos: def.pos, lightDist: r4(lightDistOf(def.pos)), charging: false, now: 0,
      tipRock: 0, tipPos: 0, tipAt: NEVER,
      myRock: rock.id, maxAge: 120, costPerRad: r4(DRAIN_MOVE / omega(rock)), margin: 8, full: 95, ice: 0, found: 0, sent: 0, received: 0,
      role: def.role, mines: def.mines, slips: def.slips, studies: def.studies, ...(w.flower ? { thirstyBelow: 40 } : {}),
      "objects.ice.seen": false, "objects.ice.near": false, "objects.comet.near": false, "objects.rock.inRange": false };
    // the robots on the flower's rock know it from the start: where it grows and the water they see in it now
    if (w.flower && rock.id === w.flower.rock) Object.assign(facts, { "objects.flower.pos": w.flower.pos, "objects.flower.water": Math.round(w.flower.water) });
    for (const [f, v] of Object.entries(facts)) k.write(factPath(def.id, f), v, false);
    k.write("objects.ice.name", "ice", false); k.write("objects.comet.name", "comet", false); k.write("objects.rock.name", ROCKS.find((x) => x.id !== rock.id).name, false);
    installRules(k.me, k.script, def.id, { explicit: w.explicit, bats, flower: !!w.flower }); k.index();
    w.robots.push({ ...def, def, rockObj: rock, bats, k, truth: { pos: def.pos, battery: def.battery }, written: { ...facts }, moving: 0, walked: 0,
      dead: false, drillT: 0, waterT: 0, queue: [], ring: { inbox: {}, outbox: {} }, tipMsg: null, known: new Set(), lastSend: -SEND_GAP, nextHello: 3 + def.id * 7, seen: new Set(), action: "explore", status: "exploring", dest: "around the rock", lastBatch: [] });
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

// the radio: one message per SEND_GAP minutes; a send queue of QUEUE (when full, the oldest waiting message is dropped)
export function enqueue(w, r, msg) {
  if (r.dead) return false;
  if (r.queue.length >= QUEUE) { r.queue.shift(); w.events.push({ t: w.t, kind: "dropped", from: r.id }); }
  r.queue.push(msg); return true;
}
// what a message says, as facts: a hello carries a battery level, an ice tip a rock and a place on it
const msgFacts = (p) => (p.kind === "tip" ? { kind: "ice", rock: p.rock, pos: p.pos, at: p.at } : { kind: "hello", battery: p.battery, at: p.at });
// keep the last KEEP messages per peer in a box (never the message of the tip it is following); older ones are removed
function trim(r, box, peer, b) {
  const ids = (r.ring[box][peer] ??= []);
  while (ids.length > KEEP) { const j = ids.findIndex((x) => !(box === "inbox" && x === r.tipMsg)); if (j < 0 || j >= ids.length - 1) break; b.push(r.k.remove(`robots.${r.id}.${box}.${ids.splice(j, 1)[0]}`)); }
}
// one message per peer, each with its own id: the sender writes it into its OWN outbox, whether or not it will arrive
function transmit(w, r) {
  if (r.dead || !r.queue.length || w.t - r.lastSend < SEND_GAP) return;
  const msg = r.queue.shift(); r.lastSend = w.t;
  const batch = r.lastBatch, base = `robots.${r.id}`; batch.push(r.k.write(`${base}.sent`, (r.written.sent += 1)));
  const from = robotXY(w, r, 8); let reached = 0; const ids = [];
  for (const o of w.robots) {
    if (o === r) continue;
    const id = w.nextMsg++, box = `${base}.outbox.${id}`;
    batch.push(r.k.write(`${box}.to`, o.id)); for (const [f, v] of Object.entries(msgFacts(msg))) batch.push(r.k.write(`${box}.${f}`, v));
    batch.push(r.k.point(`${base}.lastTo.${o.id}`, box, true));
    (r.ring.outbox[o.id] ??= []).push(id); trim(r, "outbox", o.id, batch);
    const link = radio(w, r, o); ids.push({ id, to: o.id, ok: link.ok });
    if (!link.ok) { w.unheard++; continue; }
    reached++;
    w.packets.push({ ...msg, id, from: r.id, to: o.id, sentAt: w.t, arriveAt: w.t + MSG_BASE + link.d / MSG_SPEED, x0: from.x, y0: from.y, roll: w.rand() });
  }
  w.events.push({ t: w.t, kind: "send", from: r.id, msg: msg.kind, reached, ids, x: from.x, y: from.y });
}
// arrival: the link must still be there, and the message must survive the trip
function arrive(w, p) {
  const to = robotOf(w, p.to), from = robotOf(w, p.from), link = radio(w, from, to);
  const at = robotXY(w, to, 8);
  if (to.dead || !link.ok || p.roll < lossChance(link)) { w.lost++; w.events.push({ t: w.t, kind: "lost", id: p.id, from: p.from, to: p.to, why: to.dead ? "asleep" : !link.ok ? link.why : "noise", x: at.x, y: at.y }); return; }
  w.delivered++; w.events.push({ t: w.t, kind: "delivered", id: p.id, from: p.from, to: p.to, msg: p.kind, x: at.x, y: at.y, cross: !link.same, d: link.d });
  receive(w, to, p);
}
// the receiver writes the message (same id) into ITS OWN inbox, then its own rule there decides what to accept
export function receive(w, r, p) {
  const base = `robots.${r.id}`, k = r.k, b = [], id = p.id ?? w.nextMsg++, box = `${base}.inbox.${id}`;
  const put = (f, v) => { r.written[f] = v; b.push(k.write(factPath(r.id, f), v)); };
  put("received", r.written.received + 1);
  b.push(k.write(`${box}.from`, p.from)); for (const [f, v] of Object.entries(msgFacts(p))) b.push(k.write(`${box}.${f}`, v));
  b.push(k.write(`${box}.got`, w.t));
  b.push(k.point(`${base}.lastFrom.${p.from}`, box, true));
  let accepted = null;
  if (p.kind === "tip") {
    accepted = !!k.read(`${box}.acceptTip`);
    b.push(k.write(`${box}.accepted`, accepted));   // what its rule said when the tip arrived
    if (accepted) {
      put("tipRock", p.rock); put("tipPos", p.pos); put("tipAt", p.at);
      b.push(k.point(`${base}.tipMsg`, box, true)); r.tipMsg = id;   // where the plan came from (read through, never by a rule)
      if (p.spot) r.known.add(p.spot);
      if (!r.written["objects.ice.seen"]) { r.written["objects.ice.seen"] = true; b.push(k.write("objects.ice.seen", true)); }   // an accepted observation: it now knows there is ice
    }
    w.events.push({ t: w.t, kind: "tip", to: r.id, from: p.from, rock: p.rock, accepted, age: w.t - p.at, id });
  }
  (r.ring.inbox[p.from] ??= []).push(id); trim(r, "inbox", p.from, b);
  r.lastBatch.push(...b);
  return { batch: b, accepted, id };
}
// the plan no longer comes from a message (it found ice itself, or the tip is used up / forgotten)
function dropTipMsg(r, batch) { if (r.tipMsg != null) { batch.push(r.k.remove(`robots.${r.id}.tipMsg`)); r.tipMsg = null; } }

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
  // the flower: a robot on its rock that is close enough sees how much water it has, and writes what it sees
  const fl = w.flower, seesFlower = fl && r.rock === fl.rock && !r.dead && Math.abs(wrap(fl.pos - r.truth.pos)) < fl.sees;
  if (seesFlower) put("objects.flower.water", Math.round(fl.water));
  if (r.dead) { r.status = "asleep"; r.action = "sleep"; r.dest = "nowhere"; r.moving = 0; return; }
  const flags = { charge: k.read(`${base}.goCharge`), shelter: k.read(`${base}.shelter`), watch: k.read(`${base}.watchComet`), follow: k.read(`${base}.followTip`), avoid: k.read(`${base}.avoidIce`),
    water: fl ? k.read(`${base}.shouldWaterFlower`) === true : false };   // Lua's is undefined: it does not know the flower
  const tipFrom = r.tipMsg != null ? k.read(`${base}.tipMsg.from`) : null;   // whose tip its plan is, read through the pointer as it decides
  const om = omega(rk) * dt, pos = r.truth.pos;
  let target = null, action, mv = 0;
  if (flags.charge) { action = "charge"; if (lightDistOf(pos) > 1e-9) target = Math.sign(wrap(pos) || 1) * (HALF_PI - LIT_IN); }
  else if (flags.shelter) action = "shelter";
  else if (flags.watch) action = "watch";
  else if (flags.follow) { action = "tip"; const tp = k.read(`${base}.tipPos`); if (Math.abs(wrap(tp - pos)) > 0.02) target = tp; }
  else if (flags.water) { action = "water"; const fp = k.read("objects.flower.pos"); if (Math.abs(wrap(fp - pos)) > 0.02) target = fp; }   // its own fact: where the flower grows
  else {
    action = "explore";
    if (flags.avoid && ki && Math.sign(wrap(ki.pos - pos)) === r.dir) { r.dir = -r.dir; r.avoidedAt = w.t; }   // ice ahead means "slippery": turn around
  }
  r.action = action;
  // the flag that decided it, as read at this moment (its own writes later this minute can flip it: a one-minute lag)
  r.decided = { flag: (DECIDED.find(([a]) => a === action) || DECIDED[5])[1], t: w.t, v: action === "explore" ? k.read(`${base}.explore`) : true };
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
      if (!r.slips) { r.truth.pos = s.pos; put("tipRock", rk.id); put("tipPos", s.pos); put("tipAt", w.t); dropTipMsg(r, batch); }
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
      if (s.left <= 0) { put("tipAt", NEVER); dropTipMsg(r, batch); drilling = false; }   // nothing left: forget the tip
    } else { put("tipAt", NEVER); dropTipMsg(r, batch); }                                 // nothing there (any more): forget the tip
  } else r.drillT = 0;
  // watering: at the flower for a few minutes, then it has water again; the robot sees it and writes the new level
  let watering = false;
  if (action === "water" && target == null && !r.dead) {
    watering = true; r.waterT += dt;
    if (r.waterT >= fl.wateringMin) { r.waterT = 0; fl.water = fl.fill; fl.waterings++; put("objects.flower.water", Math.round(fl.water)); w.events.push({ t: w.t, kind: "watered", by: r.id }); watering = false; }
  } else r.waterT = 0;
  put("pos", r4(r.truth.pos)); put("lightDist", r4(lightDistOf(r.truth.pos)));
  charges(r4(r.truth.battery), r.bats).forEach((c, j) => put(`batteries.${r.bats[j].i}.charge`, c));   // it measures each of its batteries
  // charging = "I have decided to charge": it stays true until the battery is full (goCharge reads it back)
  put("charging", action === "charge" && !r.dead);
  const charging = action === "charge" && lightDistOf(r.truth.pos) <= 1e-9 && !r.dead;
  if (w.t >= r.nextHello) { r.nextHello = w.t + HELLO_EVERY; enqueue(w, r, { kind: "hello", battery: Math.round(r.truth.battery), at: w.t }); }
  const work = r.studies ? "studying the ice" : "mining ice";
  r.status = r.dead ? "asleep" : action === "charge" ? (charging ? "charging" : "going to the sun")
    : action === "shelter" ? "hiding from the comet dust" : action === "watch" ? "studying the comet"
    : action === "tip" ? (drilling ? work : "going to the ice") : action === "water" ? (watering ? "watering the flower" : "going to the flower") : (r.avoidedAt != null && w.t - r.avoidedAt < 25 ? "turning away from the ice" : "exploring");
  r.dest = r.dead ? "nowhere: it is asleep" : action === "charge" ? (charging ? "stays here, in the sun" : "the sunny side") : action === "shelter" || action === "watch" ? "stays where it is"
    : action === "tip" ? (drilling ? "stays here, at the ice" : tipFrom ? `the ice ${NAME[tipFrom]} told it about` : "the ice it found")
    : action === "water" ? (watering ? "stays here, at the flower" : "the flower") : "around its rock, looking";
}

export function step(w, dt = 1) {
  w.t += dt;
  if (w.flower) w.flower.water = Math.max(0, w.flower.water - w.flower.dry * dt);   // the flower dries a little every minute
  placeRocks(w, dt); placeComet(w);
  for (const r of w.robots) r.lastBatch = [];
  for (const r of w.robots) stepRobot(w, r, dt);
  for (const r of w.robots) transmit(w, r);
  const due = w.packets.filter((p) => p.arriveAt <= w.t); w.packets = w.packets.filter((p) => p.arriveAt > w.t);
  for (const p of due) arrive(w, p);
  if (w.events.length > 300) w.events.splice(0, 150);
}

// ── interactions (the user acts on the world, or presses a robot's radio button; never on another robot's kernel) ──
export function setBattery(w, id, value) {   // the slider / "drain": the real battery changes, and the robot measures its batteries at once
  const r = robotOf(w, id); if (r.dead && value > 0) r.dead = false;
  r.truth.battery = value; r.lastBatch = [];
  return charges(value, r.bats).map((c, j) => { const f = `batteries.${r.bats[j].i}.charge`; r.written[f] = c; return r.k.write(factPath(id, f), c); });
}
// Batteries change while it runs: a battery plugged in, one swapped for another, one taken out. The charge it holds
// stays with the robot (Wh); the adapter then spreads it as always (first battery filled first). With the aggregate
// nothing else changes; the 4.1 explicit sum has to be redeclared over the new set (w.explicit).
const whOf = (r) => (r.truth.battery * capacityOf(r.bats)) / 100;
function afterBatteries(w, r, wh, b) {
  if (w.explicit) r.k.rule("battery", explicitBatteryRule(r.bats));
  r.truth.battery = Math.min(100, (wh / capacityOf(r.bats)) * 100); r.dead = r.truth.battery <= 0;
  charges(r4(r.truth.battery), r.bats).forEach((c, j) => { const f = `batteries.${r.bats[j].i}.charge`; if (r.written[f] !== c) { r.written[f] = c; b.push(r.k.write(factPath(r.id, f), c)); } });
  r.lastBatch.push(...b); return b;
}
export function addBattery(w, id, bat = EXTRA_BATTERY, charge = bat.capacity) {   // plugged in, with its own charge
  const r = robotOf(w, id), wh = whOf(r) + charge, b = [], base = `batteries.${bat.i}`;
  r.bats.push({ ...bat }); r.bats.sort((x, y) => x.i - y.i);
  r.written[`${base}.capacity`] = bat.capacity; b.push(r.k.write(factPath(id, `${base}.capacity`), bat.capacity));
  r.written[`${base}.charge`] = charge; b.push(r.k.write(factPath(id, `${base}.charge`), charge));
  return afterBatteries(w, r, wh, b);
}
export function swapBattery(w, id, i, capacity, charge = capacity) {   // battery i out, another one (capacity, charge) in its place
  const r = robotOf(w, id), j = r.bats.findIndex((x) => x.i === i), old = charges(r4(r.truth.battery), r.bats)[j], b = [], base = `batteries.${i}`;
  const wh = whOf(r) - old + charge; r.bats[j] = { ...r.bats[j], capacity };
  r.written[`${base}.capacity`] = capacity; b.push(r.k.write(factPath(id, `${base}.capacity`), capacity));
  r.written[`${base}.charge`] = charge; b.push(r.k.write(factPath(id, `${base}.charge`), charge));
  return afterBatteries(w, r, wh, b);
}
export function removeBattery(w, id, i) {   // battery i taken out, with the charge it held
  const r = robotOf(w, id), j = r.bats.findIndex((x) => x.i === i); if (j < 0 || r.bats.length < 2) return [];
  const wh = whOf(r) - charges(r4(r.truth.battery), r.bats)[j], b = [];
  r.bats.splice(j, 1); delete r.written[`batteries.${i}.charge`]; delete r.written[`batteries.${i}.capacity`];
  b.push(r.k.remove(`robots.${id}.batteries.${i}`));
  return afterBatteries(w, r, wh, b);
}
export function sayHello(w, id) { const r = robotOf(w, id); return enqueue(w, r, { kind: "hello", battery: Math.round(r.truth.battery), at: w.t }); }
export function shareTip(w, id) {   // the robot's radio sends a tip about the nearest crater with ice left on its own rock
  const r = robotOf(w, id), s = [...r.rockObj.spots].filter((x) => x.left > 0).sort((a, b) => Math.abs(wrap(a.pos - r.truth.pos)) - Math.abs(wrap(b.pos - r.truth.pos)))[0];
  if (!s) return false; return enqueue(w, r, { kind: "tip", rock: r.rock, pos: s.pos, at: w.t, spot: s.id });
}
export function holdRock(w, id, xy) { const rk = rockOf(w, id); rk.pinned = xy ? { x: xy.x, y: xy.y } : null; if (!xy) rk.phase = Math.atan2((rk.y - DRIFT[id].cy) / DRIFT[id].ay, (rk.x - DRIFT[id].cx) / DRIFT[id].ax) + 1.9; }
export function moveRockNow(w, id, xy) { const rk = rockOf(w, id); rk.x = xy.x; rk.y = xy.y; rk.pinned = { ...xy }; }
export const FAR = { x: 925, y: 110 }, NEAR = { x: 600, y: 230 };
// the user lets the flower get thirsty (the world changes; the robots only learn it when they see it)
export function dryFlower(w, level = 20) { if (w.flower) w.flower.water = level; }

// Every derived path of every kernel compared with a fresh kernel rebuilt from the same facts + same rules,
// and with the same rules computed in plain JS.
export function verifyWorld(ME, w) {
  const mismatches = []; let checked = 0;
  const eq = (x, y) => x === y || (typeof x === "number" && typeof y === "number" && Math.abs(x - y) < 1e-9);
  for (const r of w.robots) {
    const i = r.id, fresh = new ME();
    if (w.mode !== "eager") fresh.setRecomputeMode(w.mode);
    const all = [...batteryFacts(r.bats), ...FACTS];
    const facts = Object.fromEntries(all.map((f) => [f, r.k.read(factPath(i, f))]));
    facts.bats = r.bats.map((b) => ({ charge: facts[`batteries.${b.i}.charge`], capacity: facts[`batteries.${b.i}.capacity`] }));
    const put = (path, v) => path.split(".").map((x) => (/^\d+$/.test(x) ? Number(x) : x)).reduce((n, seg, j, arr) => (j === arr.length - 1 ? n[seg](v) : n[seg]), fresh);
    for (const f of all) if (facts[f] !== undefined) put(factPath(i, f), facts[f]);   // Lua holds no flower facts
    // every message its inbox keeps, with its own facts (acceptTip is computed on each of them)
    const inbox = msgIds(r, "inbox").map((id) => { const m = { id }; for (const f of MSG_FACTS) { const v = r.k.read(`robots.${i}.inbox.${id}.${f}`); if (v != null) { m[f] = v; put(`robots.${i}.inbox.${id}.${f}`, v); } } return m; });
    // every message its outbox keeps (the kept counts read them)
    for (const id of msgIds(r, "outbox")) for (const f of MSG_FACTS) { const v = r.k.read(`robots.${i}.outbox.${id}.${f}`); if (v != null) put(`robots.${i}.outbox.${id}.${f}`, v); }
    installRules(fresh, null, i, { explicit: w.explicit, bats: r.bats, flower: !!w.flower });
    const js = rulesJS(facts, w.explicit);
    for (const n of RULE_NAMES) {
      if (!w.flower && FLOWER_RULES.includes(n)) continue;
      const p = `robots.${i}.${n}`, a = r.k.read(p), b = fresh(p), c = js[n];
      checked++; if (!eq(a, b)) mismatches.push({ who: r.name, path: p, live: a, fresh: b });
      checked++; if (!eq(a, c)) mismatches.push({ who: r.name, path: p + " (JS)", live: a, js: c });
      // every rule is defined, except the flower rules of a robot that does not know the flower (they must be undefined)
      const knows = r.k.read("objects.flower.water") !== undefined, expectUndef = FLOWER_RULES.includes(n) && !knows;
      checked++; if ((a === undefined) !== expectUndef) mismatches.push({ who: r.name, path: p + (expectUndef ? " (should be undefined: no flower facts)" : " (undefined)"), live: a });
    }
    if (!w.explicit) for (const box of ["inbox", "outbox"]) {   // the kept counts: x[] over each box (undefined while empty)
      const p = `robots.${i}.${box}Kept`, a = r.k.read(p), b = fresh(p), n = msgIds(r, box).length, c = n || undefined;
      checked++; if (!eq(a, b)) mismatches.push({ who: r.name, path: p, live: a, fresh: b });
      checked++; if (!eq(a, c)) mismatches.push({ who: r.name, path: p + " (JS)", live: a, js: c });
    }
    for (const m of inbox) {   // a hello has no rock: its acceptTip is undefined in the kernel, the rebuild and JS alike
      const p = `robots.${i}.inbox.${m.id}.acceptTip`, a = r.k.read(p) ?? undefined, b = fresh(p) ?? undefined, c = acceptTipJS(facts, m);
      checked++; if (!eq(a, b)) mismatches.push({ who: r.name, path: p, live: a, fresh: b });
      checked++; if (!eq(a, c)) mismatches.push({ who: r.name, path: p + " (JS)", live: a, js: c });
      checked++; if (m.kind === "ice" && typeof a !== "boolean") mismatches.push({ who: r.name, path: p + " (an ice tip, not decided)", live: a });
    }
  }
  return { ok: mismatches.length === 0, checked, mismatches };
}
