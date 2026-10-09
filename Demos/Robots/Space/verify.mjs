#!/usr/bin/env node
// Autonomous Robotics in Space: Node verification against the real, unmodified this.me@4.1.0.
// Runs the page's own model (space-model.js): two rocks, three spider robots, three separate kernels, a limited radio.
// Checks, step by step: every derived path in every kernel = a fresh kernel rebuilt from the same facts + same rules =
// the rule in plain JS; that messages only cross the void when the radio allows it; that each kernel is written only
// by its own robot; that a message sent is in the sender's outbox and, only if it arrived, in the receiver's inbox
// with the same id; that a received tip is accepted only when the receiver's own rule says so; that the battery level is
// the rule over the robot's batteries; that one object means different things in different kernels; k; and the pointer
// limitation of 4.1.0 (known issue #4).
// Usage: node verify.mjs [--kernel path/to/me.es.js]   (default: download from jsDelivr, sha256-checked)
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as M from "./space-model.js";

const SHA = "47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa";
const URL_ = "https://cdn.jsdelivr.net/npm/this.me@4.1.0/dist/me.es.js";
async function kernelFile() {
  const i = process.argv.indexOf("--kernel");
  if (i > 0) return process.argv[i + 1];
  const dir = join(tmpdir(), "space-robots-verify"); await mkdir(dir, { recursive: true });
  const f = join(dir, "this.me-4.1.0-me.es.js");
  try { const b = await readFile(f); if (createHash("sha256").update(b).digest("hex") === SHA) return f; } catch {}
  const res = await fetch(URL_); if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL_}`);
  await writeFile(f, Buffer.from(await res.arrayBuffer())); return f;
}
const file = await kernelFile();
const hash = createHash("sha256").update(await readFile(file)).digest("hex");
if (hash !== SHA) { console.error(`sha256 mismatch: ${hash}`); process.exit(2); }
const ME = (await import(pathToFileURL(file).href)).default;

let checks = 0; const fails = []; const by = { rebuild: 0, radio: 0, own: 0, scenario: 0 };
const check = (label, ok, detail, cat = "scenario") => { checks++; by[cat]++; if (!ok) fails.push({ label, detail }); };
const section = (s) => console.log(`\n· ${s}`);
const writeStats = { n: 0, us: 0, usMax: 0, k: 0, kMax: 0 };
const ownPath = (r, p) => p.startsWith(`robots.${r.id}.`) || p.startsWith("objects.");
function afterStep(w, label) {
  // every write of this step went into the writer's own kernel, under its own robot or its own view of the objects
  for (const r of w.robots) for (const x of r.lastBatch) {
    writeStats.n++; writeStats.us += x.us; writeStats.usMax = Math.max(writeStats.usMax, x.us); writeStats.k += x.k; writeStats.kMax = Math.max(writeStats.kMax, x.k);
    const v = r.k.read(x.path), there = x.removed ? v == null : x.ptr ? v?.__ptr === x.value : v !== undefined;
    check(`${label}: ${r.name} wrote ${x.path} in its own kernel`, ownPath(r, x.path) && there, x, "own");
  }
  // its boxes stay bounded: the last KEEP per peer (+ the tip it accepted, in the inbox)
  for (const r of w.robots) for (const box of ["inbox", "outbox"]) for (const [peer, ids] of Object.entries(r.ring[box]))
    check(`${label}: ${r.name}'s ${box} keeps at most ${M.KEEP} per peer`, ids.length <= M.KEEP + (box === "inbox" && ids.includes(r.tipMsg) ? 1 : 0), { peer, ids }, "radio");
  // a message sent this step: in the sender's own outbox (same id, to that peer), whether or not it can arrive;
  // one that had no link never gets into the receiver's inbox
  for (const e of w.events) if (e.t === w.t && e.kind === "send" && !e.checked) {
    e.checked = true; const s = M.robotOf(w, e.from);
    for (const x of e.ids) {
      check(`${label} t=${w.t}: ${s.name}'s outbox[${x.id}].to(${x.to})`, s.k.read(`robots.${s.id}.outbox.${x.id}.to`) === x.to, x, "radio");
      check(`${label} t=${w.t}: ${s.name} never writes message ${x.id} into an inbox`, w.robots.every((o) => o.k.read(`robots.${o.id}.inbox.${x.id}.from`) == null), x, "radio");
      if (!x.ok) (w._noLink ??= []).push({ ...x, t: w.t });
    }
  }
  // 30 min later (longer than any trip): a message sent with no link never arrived
  for (const x of w._noLink || []) if (w.t - x.t === 30) check(`${label}: message ${x.id} had no link, so it is not in ${M.NAME[x.to]}'s inbox`, M.robotOf(w, x.to).k.read(`robots.${x.to}.inbox.${x.id}.from`) == null, x, "radio");
  if (w._noLink) w._noLink = w._noLink.filter((x) => w.t - x.t < 30);
  // a message delivered this step: the radio really allowed it (recomputed here, independently of the event)
  for (const e of w.events) if (e.t === w.t && e.kind === "delivered" && !e.checked) {
    e.checked = true; const link = M.radio(w, M.robotOf(w, e.from), M.robotOf(w, e.to));
    check(`${label} t=${w.t}: ${M.NAME[e.from]} → ${M.NAME[e.to]} delivered only with a working link`, link.ok && (e.cross ? link.d <= M.RANGE : link.same), { e, link }, "radio");
    // the same message, the same id, on both sides: the receiver's inbox = the sender's outbox (while the sender keeps it)
    const s = M.robotOf(w, e.from), r = M.robotOf(w, e.to), I = (f) => r.k.read(`robots.${r.id}.inbox.${e.id}.${f}`), O = (f) => s.k.read(`robots.${s.id}.outbox.${e.id}.${f}`);
    check(`${label} t=${w.t}: ${r.name}'s inbox[${e.id}].from(${s.id})`, I("from") === s.id && I("got") === w.t && r.k.read(`robots.${r.id}.lastFrom.${s.id}`)?.__ptr === `robots.${r.id}.inbox.${e.id}`, { e }, "radio");
    if (O("to") != null) check(`${label} t=${w.t}: message ${e.id} reads the same in ${s.name}'s outbox and ${r.name}'s inbox`, O("to") === r.id && ["kind", "battery", "rock", "pos", "at"].every((f) => O(f) === I(f)), { e }, "radio");
  }
  // a tip received this step: accepted exactly when the receiver's own rule allows it (age, same rock, no fresh tip of its own)
  for (const e of w.events) if (e.t === w.t && e.kind === "tip" && !e.checked) {
    e.checked = true; const r = M.robotOf(w, e.to), P = (n) => r.k.read(`robots.${r.id}.${n}`), box = `robots.${r.id}.inbox.${e.id}`;
    check(`${label} t=${w.t}: ${r.name} accepted the tip from ${M.NAME[e.from]} only if its rule said so`,
      r.k.read(`${box}.accepted`) === e.accepted && (!e.accepted || (e.age <= P("maxAge") && e.rock === r.rock && P("tipAt") === w.t - e.age && r.k.read(`robots.${r.id}.tipMsg.from`) === e.from)), { e }, "radio");
  }
}
function runSteps(w, n, label, { every = 5, onStep } = {}) {
  for (let i = 0; i < n; i++) {
    M.step(w, 1); afterStep(w, label); onStep?.(w, i);
    if ((i + 1) % every === 0) { const v = M.verifyWorld(ME, w); checks += v.checked - v.mismatches.length; by.rebuild += v.checked; for (const m of v.mismatches) { checks++; fails.push({ label: `${label} t=${w.t} rebuild/JS`, detail: m }); } }
  }
}

section("kernel");
console.log(`  this.me@4.1.0 dist/me.es.js sha256 ${hash.slice(0, 16)}… verified`);
check("kernel sha256", hash === SHA);
{
  const w = M.createWorld(ME);
  for (const r of w.robots) for (const [n, e] of M.RULES) check(`${r.name} ${n}: the same rule text in its kernel`, r.k.me.explain(`robots.${r.id}.${n}`).expr === e);
  for (const r of w.robots) check(`${r.name}: the inbox rule is in its setup script`, r.k.script.includes(M.inboxRuleCode(r.id)));
  for (const r of w.robots) {   // the battery level is the rule over its batteries (total charge, % of total capacity)
    const c = (i, f) => r.k.read(`robots.${r.id}.batteries.${i}.${f}`), pct = (c(1, "charge") + c(2, "charge")) / (c(1, "capacity") + c(2, "capacity")) * 100;
    check(`${r.name}: battery ${r.k.read(`robots.${r.id}.battery`)} = its batteries ${c(1, "charge")} + ${c(2, "charge")} of ${c(1, "capacity")} + ${c(2, "capacity")} Wh`, r.k.read(`robots.${r.id}.battery`) === pct && Math.abs(pct - r.def.battery) < 1e-9);
    check(`${r.name}: battery is derived (explain shows the rule), not written`, r.k.me.explain(`robots.${r.id}.battery`).expr === M.BATTERY_RULE && !r.k.script.some((x) => x.startsWith(`me.robots[${r.id}].battery(`)));
  }
  check("no rule reads through the home pointer", M.RULES.every(([, e]) => !/\bhome\b/.test(e)));
  for (const r of w.robots) {
    check(`${r.name}: pointer robots.${r.id}.home → its rock (read through)`, r.k.read(`robots.${r.id}.home.name`) === r.rockObj.name && r.k.read(`robots.${r.id}.home.radius`) === r.rockObj.R);
    check(`${r.name}'s kernel holds only its own robot`, M.IDS.filter((i) => i !== r.id).every((i) => r.k.read(`robots.${i}.battery`) === undefined && r.k.read(`robots.${i}.role`) === undefined));
    check(`${r.name}: role ${r.role} written in its own kernel`, r.k.read(`robots.${r.id}.role`) === r.role);
  }
  check("three kernels, three different objects", new Set(w.robots.map((r) => r.k.me)).size === 3);
  console.log(`  3 kernels · ${M.RULES.length} rules each (the same text) + 1 inbox rule each (names its own robot) · ${M.FACTS.length} rule inputs each`);
  console.log(`  batteries: ${M.BATTERIES.map((b) => `batteries[${b.i}] ${b.capacity} Wh (${b.name})`).join(" + ")}; battery = ${M.BATTERY_RULE}`);
}

section("this.me 4.1.0 known issue #4: a formula through a pointer is not recomputed (why no rule here reads through one)");
{
  const me = new ME(); me.asteroids.b612.radiusM(400); me.robots[612].home["->"]("asteroids.b612");
  me.robots["[i]"]["="]("homeDiameter", "home.radiusM * 2");
  const before = me("robots.612.homeDiameter"); me.asteroids.b612.radiusM(500);
  const after = me("robots.612.homeDiameter"), direct = me("robots.612.home.radiusM");
  console.log(`  formula via pointer: ${before} → after target change: ${after} (target now ${direct}; a fresh read through the pointer sees it)`);
  check("issue #4 reproduced: formula through pointer stays stale in 4.1.0", before === 800 && after === 800 && direct === 500);
  me.robots["[i]"]["="]("homeDiameter", "home.radiusM * 2");
  check("re-applying the formula recomputes it", me("robots.612.homeDiameter") === 1000);
}


section("A · the simulation runs by itself: 3,000 simulated minutes, seed 7");
{
  const w = M.createWorld(ME); const S = Object.fromEntries(w.robots.map((r) => [r.id, new Set()]));
  let minBat = Infinity, cometSeen = 0, avail = { ok: 0, range: 0, rock: 0 };
  runSteps(w, 3000, "A", { onStep: (w) => {
    for (const r of w.robots) { S[r.id].add(r.status); minBat = Math.min(minBat, r.truth.battery); }
    if (w.comet.on) cometSeen++;
    const l = M.radio(w, M.robotOf(w, 1), M.robotOf(w, 3)); avail[l.ok ? "ok" : l.why === "out of range" ? "range" : "rock"]++;
  } });
  for (const r of w.robots) {
    check(`A: ${r.name} never fell asleep`, !r.dead, r.truth.battery);
    check(`A: ${r.name} did several different things`, S[r.id].size >= 3, [...S[r.id]]);
    console.log(`  ${r.name.padEnd(4)} (${r.role}): ${[...S[r.id]].join(", ")} · sent ${r.k.read(`robots.${r.id}.sent`)} · received ${r.k.read(`robots.${r.id}.received`)} · ice ${r.k.read(`robots.${r.id}.ice`)}`);
  }
  check("A: some charging happened", w.robots.some((r) => S[r.id].has("charging")));
  check("A: messages were delivered and some were lost", w.delivered > 50 && w.lost > 0, { delivered: w.delivered, lost: w.lost });
  const T = 3000; console.log(`  messages: ${w.delivered} delivered · ${w.lost} lost on the way · ${w.unheard} never reached (no link when sent)`);
  console.log(`  Oli ↔ Lua link over time: ${(100 * avail.ok / T).toFixed(0)}% in range · ${(100 * avail.range / T).toFixed(0)}% out of range · ${(100 * avail.rock / T).toFixed(0)}% a rock in the way`);
  console.log(`  lowest battery ${minBat.toFixed(1)}% · comet in the sky ${cometSeen} min`);
  check("A: the link between the rocks is sometimes up, sometimes out of range, sometimes blocked", avail.ok > 0 && avail.range > 0 && avail.rock > 0, avail);
}

section("B · cross-void messages: counted over a fresh run (events kept)");
{
  const w = M.createWorld(ME); let crossDelivered = 0, crossTips = 0;
  for (let i = 0; i < 3000; i++) { M.step(w, 1); afterStep(w, "B"); for (const e of w.events) if (e.t === w.t && e.kind === "delivered" && e.cross) { crossDelivered++; if (e.msg === "tip") crossTips++; } }
  console.log(`  ${crossDelivered} messages crossed the void (${crossTips} of them ice tips), each with the link recomputed and in range`);
  check("B: messages do cross the void when the rocks come in range", crossDelivered > 0, crossDelivered);
}

section("C · pushed away: B 325 held far out, nothing crosses the void");
{
  const w = M.createWorld(ME); M.moveRockNow(w, 2, M.FAR); let crossed = 0, unheard0 = w.unheard;
  runSteps(w, 600, "C", { onStep: (w) => { for (const e of w.events) if (e.t === w.t && e.kind === "delivered" && e.cross) crossed++;
    for (const a of w.robots) for (const b of w.robots) if (a.rock !== b.rock) check(`C t=${w.t}: ${a.name} ↔ ${b.name} out of range`, M.radio(w, a, b).why === "out of range", null, "radio"); } });
  check("C: no message crossed the void", crossed === 0, crossed);
  check("C: Lua's own view: the other rock is out of reach", M.robotOf(w, 3).k.read("objects.rock.inRange") === false && M.robotOf(w, 3).k.read("robots.3.rockInReach") === false);
  check("C: the rock robots kept talking among themselves", M.robotOf(w, 2).k.read("robots.2.received") > 0);
  console.log(`  600 min: 0 crossed · ${w.unheard - unheard0} sends found nobody across the void · Oli and Tiko still received each other's messages`);
  M.moveRockNow(w, 2, M.NEAR); let back = 0;
  for (let i = 0; i < 120; i++) { M.step(w, 1); afterStep(w, "C"); if (w.robots.some((a) => w.robots.some((b) => a.rock !== b.rock && M.radio(w, a, b).ok))) back++; }
  check("C: brought close again, the link comes back", back > 0, back);
  console.log(`  brought close: a cross-void link was up ${back} of the next 120 min`);
}

section("D · drain a battery: the robot's own rule sends it to the sun");
{
  const w = M.createWorld(ME); runSteps(w, 30, "D");
  const r = M.robotOf(w, 1), P = (n) => r.k.read(`robots.1.${n}`);
  const xs = M.setBattery(w, 1, 6), x = xs[xs.length - 1];
  check("D: batteries 6 + 0 Wh → battery 6 → mustCharge and goCharge at once", P("batteries.1.charge") === 6 && P("batteries.2.charge") === 0 && P("battery") === 6 && P("mustCharge") === true && P("goCharge") === true);
  check("D: reserve = lightDist × costPerRad + margin", Math.abs(P("reserve") - (P("lightDist") * P("costPerRad") + P("margin"))) < 1e-9);
  check("D: k reported for the battery writes", xs.every((y) => y.k === y.recomputed.length) && x.k >= 3 && x.recomputed.includes("robots.1.battery"), xs);
  M.step(w, 1); afterStep(w, "D");
  check("D: next step it has decided to charge", P("charging") === true && (r.status === "going to the sun" || r.status === "charging"), r.status);
  let n = 0; while (P("battery") < P("full") && n < 1500) { M.step(w, 1); afterStep(w, "D"); n++; }
  check("D: it charges until full, then goes back to its work", P("charged") === true && P("goCharge") === false, { n, b: P("battery") });
  console.log(`  6% → full (${P("full")}%) in ${n} simulated minutes; k = ${xs.map((y) => y.k).join(" and ")} for the two battery writes (each recomputes battery and the rules that read it)`);
}

section("E · a shared observation: one tip, each kernel decides");
{
  const w = M.createWorld(ME); const tiko = M.robotOf(w, 2), lua = M.robotOf(w, 3);
  const tip = { kind: "tip", from: 1, rock: 1, pos: 2.3, at: 0, spot: "1.0" };
  const a = M.receive(w, tiko, tip), b = M.receive(w, lua, tip);
  check("E: Tiko (same rock) accepts Oli's tip", a.accepted === true && tiko.k.read(`robots.2.inbox.${a.id}.accepted`) === true && tiko.k.read("robots.2.tipMsg.from") === 1);
  check("E: Lua (other rock) does not accept it", b.accepted === false && lua.k.read(`robots.3.inbox.${b.id}.acceptTip`) === false && lua.k.read("robots.3.tipMsg") === undefined);
  check("E: Lua still keeps it in its inbox", lua.k.read(`robots.3.inbox.${b.id}.from`) === 1 && lua.k.read(`robots.3.inbox.${b.id}.rock`) === 1 && lua.k.read(`robots.3.inbox.${b.id}.kind`) === "ice" && lua.k.read(`robots.3.inbox.${b.id}.accepted`) === false);
  check("E: explain: the decision is the rule on that message, in Lua's own kernel", lua.k.me.explain(`robots.3.inbox.${b.id}.acceptTip`).expr === M.inboxRule(3));
  check("E: Oli's own kernel was not touched by the others", M.robotOf(w, 1).k.writes.length === 0);
  check("E: Tiko slips: it accepts the tip but does not follow it", tiko.k.read("robots.2.followTip") === false && tiko.k.read("robots.2.iceIsHazard") === true);
  for (let i = 0; i < 200; i++) M.step(w, 1);
  const old = { ...tip, at: w.t - 200, from: 3 };
  const oli = M.robotOf(w, 1), fresh = oli.k.read("robots.1.tipFresh");
  const c = M.receive(w, oli, { ...old, rock: 1 });
  const I = (f) => oli.k.read(`robots.1.inbox.${c.id}.${f}`);
  check("E: an old tip (200 min) is not accepted", c.accepted === false && I("got") - I("at") > oli.k.read("robots.1.maxAge") && I("acceptTip") === false, { fresh });
  afterStep(w, "E");
  console.log(`  Tiko: ${a.accepted ? "accepted" : "refused"} · Lua: ${b.accepted ? "accepted" : "refused"} (not its rock) · an old tip: ${c.accepted ? "accepted" : "refused"}`);
}

section("F · one object, three meanings (the same rule text, three kernels)");
{
  const w = M.createWorld(ME);
  for (const r of w.robots) { r.k.write("objects.ice.seen", true); r.k.write("objects.comet.near", true); }
  const F = (r, n) => r.k.read(`robots.${r.id}.${n}`), [oli, tiko, lua] = w.robots;
  check("F: ice is fuel to Oli only", F(oli, "iceIsFuel") && !F(tiko, "iceIsFuel") && !F(lua, "iceIsFuel"));
  check("F: ice is a hazard to Tiko only", F(tiko, "iceIsHazard") && !F(oli, "iceIsHazard") && !F(lua, "iceIsHazard"));
  check("F: ice is a sample to Lua only", F(lua, "iceIsSample") && !F(oli, "iceIsSample") && !F(tiko, "iceIsSample"));
  check("F: the comet is a hazard to Oli and Tiko, a sample to Lua", F(oli, "cometIsHazard") && F(tiko, "cometIsHazard") && !F(lua, "cometIsHazard") && F(lua, "cometIsSample"));
  check("F: so Oli and Tiko shelter, Lua watches", F(oli, "shelter") && F(tiko, "shelter") && F(lua, "watchComet") && !F(lua, "shelter"));
  for (const r of w.robots) console.log(`  ${r.name.padEnd(4)} (${r.role}): ice → fuel ${F(r, "iceIsFuel")} · hazard ${F(r, "iceIsHazard")} · sample ${F(r, "iceIsSample")} | comet → hazard ${F(r, "cometIsHazard")} · sample ${F(r, "cometIsSample")}`);
  console.log(`  the rule text is identical in the three kernels, e.g. iceIsFuel = ${oli.k.me.explain("robots.1.iceIsFuel").expr}`);
  for (const r of w.robots) r.k.write("objects.ice.seen", false);
  check("F: ice not seen → it means nothing yet, in every kernel", w.robots.every((r) => !F(r, "iceIsFuel") && !F(r, "iceIsHazard") && !F(r, "iceIsSample")));
  const v = M.verifyWorld(ME, w); checks += v.checked; by.rebuild += v.checked; for (const m of v.mismatches) fails.push({ label: "F rebuild", detail: m });
}

section("G · the story and the robot panel: every .me line shown really runs in that kernel");
{
  const w = M.createWorld(ME); let fixed = 0, live = 0;
  const all = (when) => { for (let a = 1; a < M.STORY.length; a++) for (const x of M.storyLines(w, a)) check(`G ${when} act ${a}: ${x.code || x.live} (${x.who === "all" ? "every kernel" : M.NAME[x.who] + "'s kernel"})`, x.ok, x);
    for (const id of M.IDS) for (const x of M.panelLines(w, id)) check(`G ${when} panel ${M.NAME[id]}: ${x.code || x.live}`, x.ok, x); };
  all("start");   // at the start: fixed lines are in each kernel's setup script, word for word; the boxes are empty
  for (const id of M.IDS) check(`G start: ${M.NAME[id]}'s inbox and outbox are empty`, !M.panelLines(w, id).some((x) => /\.(inbox|outbox)\./.test(x.live || "")));
  M.moveRockNow(w, 2, M.NEAR); M.sayHello(w, 3); M.shareTip(w, 1);
  for (let i = 0; i < 1200; i++) { M.step(w, 1); afterStep(w, "G"); }
  M.setBattery(w, 2, 6); M.step(w, 1); afterStep(w, "G");
  all("after the run");   // after play: every live line is the latest real write, and the kernel still holds that value
  for (let a = 1; a < M.STORY.length; a++) for (const x of M.storyLines(w, a)) { if (x.live) { live++; check(`G act ${a}: ${x.live} was written by the simulation`, !!x.code, x); } else fixed++; }
  let panel = 0; for (const id of M.IDS) { const ls = M.panelLines(w, id);
    for (const x of ls) { panel++; check(`G panel ${M.NAME[id]}: ${x.live} was written by the simulation`, !!x.code, x);
      check(`G panel ${M.NAME[id]}: ${x.live} is in its own kernel`, x.live.startsWith("objects.") || x.live.startsWith(`robots.${id}.`), x); }
    const r = M.robotOf(w, id), inb = M.msgIds(r, "inbox"), outb = M.msgIds(r, "outbox");
    check(`G panel ${M.NAME[id]}: Inbox lists every message its inbox keeps, by id (from + what it says)`, inb.length > 0 && inb.every((m) => ls.some((x) => x.live === `robots.${id}.inbox.${m}.from`) && ls.some((x) => /\.(battery|rock)$/.test(x.live) && x.live.startsWith(`robots.${id}.inbox.${m}.`))), inb);
    check(`G panel ${M.NAME[id]}: Outbox lists every message its outbox keeps, by id`, outb.length > 0 && outb.every((m) => ls.some((x) => x.live === `robots.${id}.outbox.${m}.to`)), outb);
    check(`G panel ${M.NAME[id]}: It knows shows its own two batteries, no message`, ["batteries.1.charge", "batteries.2.charge"].every((f) => ls.some((x) => x.live === `robots.${id}.${f}`)) && ls.filter((x) => /\.(inbox|outbox)\./.test(x.live)).every((x) => !/batteries/.test(x.live))); }
  console.log(`  panel: ${panel} lines (3 robots), each the latest write to that path in that robot's own kernel, at the start and after the run`);
  console.log(`  e.g. Lua: ${M.panelLines(w, 3).map((x) => x.code).filter(Boolean).slice(0, 2).join(" · ")} | inbox ${M.panelLines(w, 3).map((x) => x.code).filter((c) => /inbox/.test(c || "")).slice(0, 2).join(" · ")}`);
  check("G: no act shows an operator other than the real .me ones", M.STORY.slice(1).every((s) => s.groups.every((g) => g.lines.every((l) => !/\["(?!\[i\]"|="|->")[^"]*"\]/.test(typeof l === "string" ? l : l.code || "")))));
  const four = M.storyLines(w, 4);
  check("G act IV: the sender's outbox and the receiver's inbox, each through its own pointer", four.some((x) => /lastTo\[1\]\["->"\]\("robots\.3\.outbox\.\d+"\)/.test(x.code || "")) && four.some((x) => /lastFrom\[3\]\["->"\]\("robots\.1\.inbox\.\d+"\)/.test(x.code || "")), four);
  console.log(`  ${fixed} fixed lines found word for word in the setup script of their kernel(s) · ${live} live lines = the latest write in that kernel`);
  console.log(`  e.g. ${M.storyLines(w, 2)[2].code.slice(0, 60)}… · ${four.filter((x) => x.code).map((x) => x.code).slice(0, 2).join(" · ")}`);
}

section("H · outbox and inbox: one message, one id, each side in its own kernel");
{
  const w = M.createWorld(ME); let delivered = 0, same = 0, noLink = 0, removed = 0, kMax = 0, kNow = 0, nNow = 0;
  runSteps(w, 3000, "H", { onStep: (w) => {
    for (const e of w.events) if (e.t === w.t && e.kind === "delivered") delivered++;
    for (const e of w.events) if (e.t === w.t && e.kind === "send") noLink += e.ids.filter((x) => !x.ok).length;
    for (const r of w.robots) for (const x of r.lastBatch) { if (x.removed) removed++; kMax = Math.max(kMax, x.k); if (x.path.endsWith(".now")) { kNow += x.k; nNow++; } }
  } });
  for (const r of w.robots) {
    const out = M.msgIds(r, "outbox"), inb = M.msgIds(r, "inbox");
    for (const id of inb) { const from = r.k.read(`robots.${r.id}.inbox.${id}.from`), s = M.robotOf(w, from);
      if (s.k.read(`robots.${s.id}.outbox.${id}.to`) === r.id) same++;
      check(`H: ${r.name}'s inbox[${id}] is not in its own outbox, nor in anyone else's inbox`, r.k.read(`robots.${r.id}.outbox.${id}.to`) == null && w.robots.every((o) => o === r || o.k.read(`robots.${o.id}.inbox.${id}.from`) == null)); }
    check(`H: ${r.name} keeps at most ${M.KEEP} per peer in its outbox`, Object.values(r.ring.outbox).every((ids) => ids.length <= M.KEEP));
    check(`H: ${r.name}'s kernel only has its own boxes`, M.IDS.filter((i) => i !== r.id).every((i) => r.k.read(`robots.${i}.inbox`) === undefined && r.k.read(`robots.${i}.outbox`) === undefined));
    console.log(`  ${r.name.padEnd(4)} outbox ${out.map((x) => `[${x}]→${M.NAME[r.k.read(`robots.${r.id}.outbox.${x}.to`)]}`).join(" ")} · inbox ${inb.map((x) => `[${x}]←${M.NAME[r.k.read(`robots.${r.id}.inbox.${x}.from`)]}`).join(" ")}`);
  }
  check("H: messages arrived, and some had no link (in the outbox only)", delivered > 50 && noLink > 0, { delivered, noLink });
  check("H: old messages were removed with [\"-\"]", removed > 0, removed);
  console.log(`  ${delivered} delivered (same id both sides) · ${noLink} sent with no link: in the sender's outbox only · ${removed} old messages removed with ["-"] · ${same} kept messages still in both boxes now`);
  console.log(`  cost: k of a now write avg ${(kNow / nNow).toFixed(2)} · k max of any write ${kMax} · at most ${M.KEEP} messages per peer per box (+ the accepted tip)`);
}

section("summary");
console.log(`  kernel writes measured: ${writeStats.n.toLocaleString("en-US")} · k avg ${(writeStats.k / writeStats.n).toFixed(2)} · k max ${writeStats.kMax} · µs/write avg ${(writeStats.us / writeStats.n).toFixed(1)} · max ${writeStats.usMax.toFixed(0)} (Node ${process.version})`);
console.log(`  ${checks.toLocaleString("en-US")} checks · ${fails.length} mismatches`);
console.log(`    ${by.rebuild.toLocaleString("en-US")} derived values = fresh rebuild = rule in JS (and defined), every 5 simulated minutes, 3 kernels`);
console.log(`    ${by.own.toLocaleString("en-US")} writes, each into the writer's own kernel (no robot writes into another's)`);
console.log(`    ${by.radio.toLocaleString("en-US")} radio checks (delivered only with a working link; same id in the sender's outbox and the receiver's inbox; no link, no inbox; boxes bounded; tips accepted only by the receiver's rule; out of range)`);
console.log(`    ${by.scenario.toLocaleString("en-US")} scenario, meaning, isolation and pointer checks`);
if (fails.length) { console.log(JSON.stringify(fails.slice(0, 20), null, 1)); process.exit(1); }
