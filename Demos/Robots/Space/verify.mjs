#!/usr/bin/env node
// Autonomous Robotics in Space: Node verification against this.me@4.2.0 (npm via jsDelivr, sha256-pinned), with
// this.me@4.1.0 (jsDelivr, sha256-pinned) for the 4.1 comparison.
// Runs the page's own model (space-model.js): two rocks, three spider robots, three separate kernels, a limited radio.
// Checks, step by step: every derived path in every kernel = a fresh kernel rebuilt from the same facts + same rules =
// the rule in plain JS; that messages only cross the void when the radio allows it; that each kernel is written only
// by its own robot; that a message sent is in the sender's outbox and, only if it arrived, in the receiver's inbox
// with the same id; that a received tip is accepted only when the receiver's own rule says so; that the battery level is
// the rule over the robot's batteries; that one object means different things in different kernels; k; and the pointer
// limitation of 4.1.0 (known issue #4); the 4.2 aggregates (battery over robots[i].batteries[], kept counts over inbox[] /
// outbox[]) against the contract oracle (exact BigInt sum, rounded once) while batteries are added, swapped and removed,
// in eager and lazy; and the behaviour of the 4.2 model against the 4.1 model (explicit sum on this.me@4.1.0).
// Usage: node verify.mjs [--kernel path/to/me.es.js]   (default: this.me@4.2.0 from jsDelivr, sha256-checked)
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as M from "./space-model.js";

const SHA = "8cc94d5273b05728713e7c06bcba6ab0d88c85d2a748dc885e7bca745605a61a", URL42 = "https://cdn.jsdelivr.net/npm/this.me@4.2.0/dist/me.es.js";   // this.me@4.2.0/dist/me.es.js
const SHA41 = "47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa", URL41 = "https://cdn.jsdelivr.net/npm/this.me@4.1.0/dist/me.es.js";
async function cachedKernel(name, url, sha) {
  const dir = join(tmpdir(), "space-robots-verify"); await mkdir(dir, { recursive: true });
  const f = join(dir, name);
  try { const b = await readFile(f); if (createHash("sha256").update(b).digest("hex") === sha) return f; } catch {}
  const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await writeFile(f, Buffer.from(await res.arrayBuffer())); return f;
}
const kernel41File = () => cachedKernel("this.me-4.1.0-me.es.js", URL41, SHA41);
const ki = process.argv.indexOf("--kernel");
const file = ki > 0 ? process.argv[ki + 1] : await cachedKernel("this.me-4.2.0-me.es.js", URL42, SHA);
const hash = createHash("sha256").update(await readFile(file)).digest("hex");
if (hash !== SHA) { console.error(`sha256 mismatch: ${hash}`); process.exit(2); }
const ME = (await import(pathToFileURL(file).href)).default;
const file41 = await kernel41File(), hash41 = createHash("sha256").update(await readFile(file41)).digest("hex");
if (hash41 !== SHA41) { console.error(`4.1.0 sha256 mismatch: ${hash41}`); process.exit(2); }
const ME41 = (await import(pathToFileURL(file41).href)).default;

let checks = 0; const fails = []; const by = { rebuild: 0, radio: 0, own: 0, scenario: 0, aggregate: 0, compare: 0, cards: 0, flower: 0 };
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
  console.log(`  this.me@4.2.0 (npm, jsDelivr) sha256 ${hash.slice(0, 16)}… verified · this.me@4.1.0 sha256 ${hash41.slice(0, 16)}… verified (comparison)`);
check("kernel sha256", hash === SHA);
{
  const w = M.createWorld(ME);
  for (const r of w.robots) for (const [n, e] of M.RULES) if (w.flower || !M.FLOWER_RULES.includes(n)) check(`${r.name} ${n}: the same rule text in its kernel`, r.k.me.explain(`robots.${r.id}.${n}`).expr === e.replace(/\[i\]/g, `[${r.id}]`));
  for (const r of w.robots) check(`${r.name}: the inbox rule is in its setup script`, r.k.script.includes(M.inboxRuleCode(r.id)));
  for (const r of w.robots) {   // the battery level is the rule over its batteries (total charge, % of total capacity)
    const c = (i, f) => r.k.read(`robots.${r.id}.batteries.${i}.${f}`), pct = M.batteryJS([1, 2].map((i) => ({ charge: c(i, "charge"), capacity: c(i, "capacity") })));
    check(`${r.name}: battery ${r.k.read(`robots.${r.id}.battery`)} = its batteries ${c(1, "charge")} + ${c(2, "charge")} of ${c(1, "capacity")} + ${c(2, "capacity")} Wh (oracle)`, Object.is(r.k.read(`robots.${r.id}.battery`), pct) && Math.abs(pct - r.def.battery) < 1e-9);
    check(`${r.name}: battery is derived (explain shows the rule), not written`, r.k.me.explain(`robots.${r.id}.battery`).expr === M.BATTERY_RULE.replace(/\[i\]/g, `[${r.id}]`) && !r.k.script.some((x) => x.startsWith(`me.robots[${r.id}].battery(`)));
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
for (const [K, name] of [[ME41, "this.me@4.1.0"], [ME, "this.me@4.2.0"]]) {
  const me = new K(); me.asteroids.b612.radiusM(400); me.robots[612].home["->"]("asteroids.b612");
  me.robots["[i]"]["="]("homeDiameter", "home.radiusM * 2");
  const before = me("robots.612.homeDiameter"); me.asteroids.b612.radiusM(500);
  const after = me("robots.612.homeDiameter"), direct = me("robots.612.home.radiusM");
  console.log(`  ${name}: formula via pointer: ${before} → after target change: ${after} (target now ${direct})`);
  if (K === ME41) check("issue #4 reproduced: formula through pointer stays stale in 4.1.0", before === 800 && after === 800 && direct === 500);
  else check("issue #4 fixed in this.me@4.2.0: the formula follows its pointer target", before === 800 && after === 1000 && direct === 500);
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
    for (const x of ls) { if (!w.flower && x.live?.startsWith("objects.flower.")) continue; panel++; check(`G panel ${M.NAME[id]}: ${x.live} was written by the simulation`, !!x.code, x);
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

// ── the dashboard cards ──
section("K · the dashboard cards: every line is a rule → value, the latest write or a setup line of that robot's kernel");
{
  const w = M.createWorld(ME); let n = 0, page = 0; const seen = {};
  for (let i = 0; i < 3000; i++) {
    M.step(w, 1);
    if (w.t % 10) continue;
    for (const r of w.robots) {
      const groups = M.CARDS(w, r.id), lines = M.cardLines(w, r.id), [doing, going, msgs, ice] = groups, flag = M.flagOf(r), base = `robots.${r.id}`;
      for (const x of lines) { n++; check(`K t=${w.t} ${r.name} card: ${x.code || x.live}`, x.ok, x, "cards"); }
      check(`K t=${w.t} ${r.name} Doing: ${flag} is true in its kernel and is what it does (${r.action})`, r.decided?.flag === flag && r.decided.v === true && doing.lines[0].value === `${base}.${flag}`, { flag, v: r.k.read(`${base}.${flag}`), action: r.action }, "cards");
      check(`K t=${w.t} ${r.name} Going to: a kernel fact when it has a goal, page state otherwise`, going.page === !["charge", "tip", "water"].includes(r.action) && (going.page ? going.lines.length === 0 : going.lines.length > 0), going, "cards");
      if (going.page) page++;
      for (const box of ["inbox", "outbox"]) check(`K t=${w.t} ${r.name} Messages: ${box}Kept = the messages its ${box} keeps`, r.k.read(`${base}.${box}Kept`) === (M.msgIds(r, box).length || undefined), null, "cards");
      check(`K t=${w.t} ${r.name} Messages: sent / received are its latest writes`, r.k.last[`${base}.sent`].value === r.written.sent && r.k.last[`${base}.received`].value === r.written.received, null, "cards");
      check(`K t=${w.t} ${r.name} ${ice.title}: its latest write`, r.k.last[ice.lines[0].live].value === r.written[r.slips ? "found" : "ice"], null, "cards");
      seen[`${r.name}: ${flag}`] = (seen[`${r.name}: ${flag}`] || 0) + 1;
    }
  }
  console.log(`  ${n} card lines checked (every 10 min, 3 robots, 3,000 min) · Going to was page state in ${page} of 900 readings (exploring, sheltering, watching: its path is the simulation's)`);
  console.log(`  Doing, by the kernel flag that decided it: ${Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
}

// ── the flower ──
if (process.env.FLOWER !== "0") {
section("L · the flower on B 612: not a kernel; Oli and Tiko keep what they see of it, and their own rule decides");
{
  const w = M.createWorld(ME, { flower: true }), [oli, tiko, lua] = w.robots;
  check("L: Lua's kernel holds no flower facts", lua.k.read("objects.flower.water") === undefined && lua.k.read("objects.flower.pos") === undefined && !lua.k.script.some((x) => x.startsWith("me.objects.flower")), null, "flower");
  const ex = lua.k.me.explain("robots.3.flowerThirsty");
  check("L: Lua's flowerThirsty and shouldWaterFlower are undefined (missing input objects.flower.water): it cannot decide", lua.k.read("robots.3.flowerThirsty") === undefined && lua.k.read("robots.3.shouldWaterFlower") === undefined && ex.meta.unresolved?.reason === "missing-input" && ex.meta.unresolved.inputs.some((x) => x.endsWith("objects.flower.water")), ex.meta.unresolved, "flower");
  check("L: the same rule text in the three kernels", w.robots.every((r) => M.FLOWER_RULES.every((n) => r.k.me.explain(`robots.${r.id}.${n}`).expr === M.RULES.find(([x]) => x === n)[1])), null, "flower");
  check("L: Oli and Tiko know it from the start (where it grows, the water they see)", [oli, tiko].every((r) => r.k.read("objects.flower.pos") === M.FLOWER.pos && r.k.read("objects.flower.water") === M.FLOWER.water), null, "flower");
  let waterings = 0, stale = 0, wateringMin = 0; const by = { 1: 0, 2: 0 };
  runSteps(w, 3000, "L", { onStep: (w) => {
    for (const r of w.robots) {
      const P = (n) => r.k.read(`robots.${r.id}.${n}`);
      const D = r.decided?.at || {};   // its flags as read when it decided this minute (its own writes later can flip them)
      if (r.action === "water") { wateringMin++;
        check(`L t=${w.t}: ${r.name} goes to / waters the flower only when its own rule says so, never before charging`, D.shouldWaterFlower === true && D.goCharge === false && D.mustCharge === false && D.battery > D.reserve && D.flowerThirsty === true && D.explore === true, D, "flower"); }
      if (r.rock === 1 && Math.round(w.flower.water) !== r.k.read("objects.flower.water")) stale++;
    }
    for (const e of w.events) if (e.t === w.t && e.kind === "watered") { waterings++; by[e.by]++; const r = M.robotOf(w, e.by);
      check(`L t=${w.t}: ${r.name} watered it and wrote what it sees now: me.objects.flower.water(${M.FLOWER.fill})`, r.k.last["objects.flower.water"].code === `me.objects.flower.water(${M.FLOWER.fill})` && r.k.read(`robots.${r.id}.flowerThirsty`) === false, null, "flower"); }
    check(`L t=${w.t}: Lua never acts on the flower`, lua.action !== "water" && lua.k.read("objects.flower.water") === undefined, null, "flower");
  } });
  check("L: the flower got water several times in 3,000 min", waterings >= 2, waterings, "flower");
  console.log(`  3,000 min: watered ${waterings} times (Oli ${by[1]}, Tiko ${by[2]}) · ${wateringMin} robot-minutes going to or watering it · the level a robot on B 612 knows differs from the real one in ${stale} of 6,000 readings (it only knows what it last saw)`);
}
{ // charging wins: a thirsty flower and an empty battery
  const w = M.createWorld(ME, { flower: true }), oli = M.robotOf(w, 1), P = (n) => oli.k.read(`robots.1.${n}`);
  M.dryFlower(w, 10); oli.truth.pos = M.FLOWER.pos + 0.3; M.step(w, 1);
  check("L: Oli sees the thirsty flower (10%) and its rule says water it", oli.k.read("objects.flower.water") === 10 && P("flowerThirsty") === true && P("shouldWaterFlower") === true, { b: P("battery"), r: P("reserve") }, "flower");
  M.setBattery(w, 1, 6);
  check("L: battery 6%: mustCharge → goCharge, so shouldWaterFlower is false (charging wins)", P("mustCharge") === true && P("goCharge") === true && P("shouldWaterFlower") === false, null, "flower");
  M.step(w, 1);
  check("L: and it goes to charge, not to the flower", oli.action === "charge", oli.action, "flower");
  let n = 0; while (oli.action !== "water" && n < 2000) { M.step(w, 1); n++; }
  check("L: once charged it goes back and waters the flower", oli.action === "water" && P("charged") === true || (oli.action === "water" && P("battery") > P("reserve")), { n, a: oli.action }, "flower");
  while (w.flower.water < M.FLOWER.fill - 1 && n < 3000) { M.step(w, 1); n++; }
  console.log(`  thirsty flower + battery 6%: it charged first (charging wins), then went back and watered it (${n} min later, the flower at ${Math.round(w.flower.water)}%)`);
}
{ // what the flower changes: the same world with and without it
  const a = M.createWorld(ME, { flower: true }), b = M.createWorld(ME, { flower: false }); let diffAct = 0, firstDiff = null; const cnt = (w, k) => w.events.filter((e) => e.kind === k).length; let tipsA = 0, tipsB = 0, foundA = 0, foundB = 0;
  for (let i = 0; i < 3000; i++) { M.step(a, 1); M.step(b, 1);
    for (let j = 0; j < 3; j++) if (a.robots[j].action !== b.robots[j].action) { diffAct++; firstDiff ??= { t: a.t, robot: a.robots[j].name, with: a.robots[j].action, without: b.robots[j].action }; }
    for (const e of a.events) if (e.t === a.t) { if (e.kind === "tip") tipsA++; if (e.kind === "found") foundA++; }
    for (const e of b.events) if (e.t === b.t) { if (e.kind === "tip") tipsB++; if (e.kind === "found") foundB++; } }
  const ice = (w) => w.robots.map((r) => r.written.ice).join("/"), sleep = (w) => w.robots.some((r) => r.dead);
  check("L: with the flower nobody falls asleep", !sleep(a), null, "flower");
  console.log(`  with vs without the flower (seed 7, 3,000 min): ${diffAct} robot-minutes with a different action (first: t=${firstDiff?.t} ${firstDiff?.robot} ${firstDiff?.with} instead of ${firstDiff?.without})`);
  console.log(`    ice mined Oli/Tiko/Lua ${ice(a)} vs ${ice(b)} · ice found ${foundA} vs ${foundB} · tips received ${tipsA} vs ${tipsB} · lowest battery ${Math.min(...a.robots.map((r) => r.truth.battery)).toFixed(1)}% at the end vs ${Math.min(...b.robots.map((r) => r.truth.battery)).toFixed(1)}%`);
}
} // FLOWER=0 skips

// ── 4.2: aggregates ──
const readBats = (r) => r.bats.map((b) => ({ i: b.i, charge: r.k.read(`robots.${r.id}.batteries.${b.i}.charge`), capacity: r.k.read(`robots.${r.id}.batteries.${b.i}.capacity`) }));
const aggOf = (r) => (r.k.me.explain(`robots.${r.id}.battery`).derivation?.inputs || []).filter((x) => x.kind === "aggregate").map((x) => x.aggregate);
// the battery changes, mid-run (minute, change, robot): a third battery plugged in, the spare swapped, one taken out
const PLAN = [[300, "add", 1], [450, "swap", 2], [600, "add", 3], [750, "remove", 1], [900, "remove", 3], [1050, "add", 2], [1200, "swap", 1], [1350, "remove", 2]];
const doChange = (w, kind, id) => kind === "add" ? M.addBattery(w, id) : kind === "swap" ? M.swapBattery(w, id, 2, 50, 10) : M.removeBattery(w, id, M.robotOf(w, id).bats[M.robotOf(w, id).bats.length - 1].i);
const traceOf = (w) => w.robots.map((r) => [r.k.read(`robots.${r.id}.battery`), r.action, r.status, r.truth.battery, r.truth.pos].map(String).join("|")).join(" ");
const traces = {};
section("I · aggregates: battery = " + M.BATTERY_RULE + ", checked against the contract oracle (exact BigInt sum, rounded once)");
for (const mode of ["eager", "lazy"]) {
  const w = M.createWorld(ME, { mode }); const rows = []; let steps = 0, floatDiff = 0, keptChecks = 0; traces[mode] = [];
  const oracleCheck = (label, r) => {
    const bs = readBats(r), v = r.k.read(`robots.${r.id}.battery`), ref = M.batteryJS(bs), f41 = M.batteryJS(bs, true), ag = aggOf(r);
    check(`${label}: ${r.name} battery ${v} = oracle ${ref} (${bs.length} batteries)`, Object.is(v, ref), { v, ref, bs }, "aggregate");
    check(`${label}: ${r.name} explain: ${bs.length} members, ${bs.length} terms, resolved, public-view`, ag.length === 2 && ag.every((a) => a.members === bs.length && a.terms === bs.length && a.status === "resolved" && a.context === "public-view"), ag, "aggregate");
    if (!Object.is(f41, ref)) floatDiff++;
    return { bs, v, ref, f41 };
  };
  runSteps(w, 1500, `I ${mode}`, { onStep: (w) => {
    steps++;
    for (const [t, kind, id] of PLAN) if (w.t === t) {
      const r = M.robotOf(w, id), before = r.k.read(`robots.${id}.battery`), xs = doChange(w, kind, id), o = oracleCheck(`I ${mode} t=${t} ${kind}`, r);
      rows.push({ t, robot: r.name, kind, bats: o.bs.map((b) => `${b.capacity}`).join("+"), charges: o.bs.map((b) => b.charge).join(" + "), before, after: o.v, oracle: o.ref, f41: o.f41, k: xs.map((x) => x.k).join(",") });
    }
    for (const r of w.robots) {
      oracleCheck(`I ${mode} t=${w.t}`, r);
      for (const box of ["inbox", "outbox"]) { const n = M.msgIds(r, box).length; keptChecks++;
        check(`I ${mode} t=${w.t}: ${r.name} ${box}Kept = ${n} messages its ${box} keeps`, r.k.read(`robots.${r.id}.${box}Kept`) === (n || undefined), { n, kernel: r.k.read(`robots.${r.id}.${box}Kept`) }, "aggregate"); }
    }
    traces[mode].push(traceOf(w));
  } });
  console.log(`  ${mode}: ${steps} min, every minute every robot's battery Object.is the oracle; ${keptChecks} kept-count checks; the 4.1 explicit float sum would differ from the oracle in ${floatDiff} of ${steps * 3} readings`);
  if (mode === "eager") { console.log("  t     robot change  batteries (Wh)  charges (Wh)                battery before → after   = oracle   4.1 float sum      k of the writes");
    for (const x of rows) console.log(`  ${String(x.t).padEnd(5)} ${x.robot.padEnd(5)} ${x.kind.padEnd(7)} ${x.bats.padEnd(15)} ${x.charges.padEnd(27)} ${String(+x.before.toFixed(6)).padEnd(10)} → ${String(x.after).padEnd(19)} ${Object.is(x.after, x.oracle) ? "yes" : "NO "}   ${Object.is(x.f41, x.oracle) ? "same" : String(x.f41).padEnd(18)} ${x.k}`); }
}
check("I: eager and lazy give the same world, minute by minute (battery, action, status, position)", traces.eager.join("\n") === traces.lazy.join("\n"), traces.eager.findIndex((x, i) => x !== traces.lazy[i]), "aggregate");
console.log(`  eager vs lazy: ${traces.eager.filter((x, i) => x === traces.lazy[i]).length} of ${traces.eager.length} minutes identical`);
{ // a member without the field, a delete of the whole collection: the battery says so, it never sums part of it
  const w = M.createWorld(ME), r = M.robotOf(w, 1);
  r.k.write("robots.1.batteries.4.capacity", 10);
  const e = r.k.me.explain("robots.1.battery");
  check("I: a battery with no charge reading yet: battery undefined (incomplete), never a partial sum", r.k.read("robots.1.battery") === undefined && e.meta.unresolved?.reason === "incomplete", e.meta.unresolved, "aggregate");
  r.k.write("robots.1.batteries.4.charge", 5);
  check("I: once it reads its charge, it counts", Object.is(r.k.read("robots.1.battery"), M.batteryJS(readBats({ ...r, bats: [...r.bats, { i: 4 }] }))), null, "aggregate");
  r.k.remove("robots.1.batteries");
  check("I: no batteries at all: battery undefined (absent), and the rules that read it say so", r.k.read("robots.1.battery") === undefined && r.k.me.explain("robots.1.battery").meta.unresolved?.reason === "missing-input" && r.k.read("robots.1.mustCharge") === undefined, null, "aggregate");
  console.log("  a battery with no charge reading → battery undefined (incomplete) · then counted · all batteries removed → undefined (absent)");
}
{ // why the oracle and not the explicit 4.1 sum: here the demo's charges add exactly (at most one battery is partly charged),
  // so both agree; with terms that do not, the aggregate is the exact sum rounded once, the explicit sum rounds at each +
  const me = new ME(); [0.1, 0.2, 0.3].forEach((c, j) => { me.robots[9].batteries[j + 1].charge(c); me.robots[9].batteries[j + 1].capacity(1); });
  me.robots["[i]"]["="]("battery", M.BATTERY_RULE); me.robots["[i]"]["="]("sumC", "robots[i].batteries[].charge");
  const bs = [0.1, 0.2, 0.3].map((charge) => ({ charge, capacity: 1 })), ref = M.exactSum([0.1, 0.2, 0.3]), f41 = 0.1 + 0.2 + 0.3;
  check("I: 0.1 + 0.2 + 0.3 Wh: the aggregate is the oracle (0.6), not the left-to-right float sum (0.6000000000000001)", Object.is(me("robots.9.sumC"), ref) && ref === 0.6 && f41 !== ref && Object.is(me("robots.9.battery"), M.batteryJS(bs)), { kernel: me("robots.9.sumC"), ref, f41 }, "aggregate");
  console.log(`  charges 0.1 + 0.2 + 0.3: robots[9].batteries[].charge = ${me("robots.9.sumC")} (oracle ${ref}; the 4.1 explicit sum gives ${f41})`);
}

// ── 4.2 vs 4.1: the same world on this.me@4.1.0 with the explicit sum ──
section("J · behaviour: the 4.2 model (aggregate, this.me@4.2.0) vs the 4.1 model (explicit sum, this.me@4.1.0), long runs");
const FLAGS = ["goCharge", "mustCharge", "followTip", "shelter", "explore"];
const diffRuns = (a, b, n, plan) => {
  const d = { battery: 0, decision: 0, status: 0, truth: 0, events: 0, first: null, firstDecision: null };
  for (let i = 0; i < n; i++) {
    for (const w of [a, b]) { M.step(w, 1); if (plan) for (const [t, kind, id] of plan) if (w.t === t) doChange(w, kind, id); }
    for (const [x, y] of a.robots.map((r, j) => [r, b.robots[j]])) {
      const bx = x.k.read(`robots.${x.id}.battery`), by_ = y.k.read(`robots.${y.id}.battery`);
      if (!Object.is(bx, by_)) { d.battery++; d.first ??= { t: a.t, robot: x.name, a: bx, b: by_ }; }
      const fx = FLAGS.map((n) => x.k.read(`robots.${x.id}.${n}`)).join(), fy = FLAGS.map((n) => y.k.read(`robots.${y.id}.${n}`)).join();
      if (fx !== fy || x.action !== y.action) { d.decision++; d.firstDecision ??= { t: a.t, robot: x.name, a: fx + " " + x.action, b: fy + " " + y.action }; }
      if (x.status !== y.status) d.status++;
      if (!Object.is(x.truth.battery, y.truth.battery) || !Object.is(x.truth.pos, y.truth.pos)) d.truth++;
    }
    const ev = (w) => w.events.filter((e) => e.t === w.t && ["tip", "found", "delivered", "lost", "send"].includes(e.kind)).map((e) => `${e.kind}:${e.from ?? e.by}>${e.to ?? ""}:${e.accepted ?? ""}`).join(";");
    if (ev(a) !== ev(b)) d.events++;
  }
  return d;
};
for (const seed of [7, 1, 2, 3, 4]) {
  const d = diffRuns(M.createWorld(ME, { seed }), M.createWorld(ME41, { seed, explicit: true }), 3000);
  check(`J seed ${seed}: 3,000 min, 2 batteries: no difference in battery, decisions, status, tips or messages`, !d.battery && !d.decision && !d.status && !d.truth && !d.events, d, "compare");
  console.log(`  seed ${seed}, 2 batteries, 3,000 min: battery ${d.battery} · decisions ${d.decision} · status ${d.status} · physical state ${d.truth} · tip/message events ${d.events} differences`);
}
for (const seed of [7, 1, 2]) {
  const d = diffRuns(M.createWorld(ME, { seed }), M.createWorld(ME41, { seed, explicit: true }), 3000, PLAN);
  check(`J seed ${seed}: batteries added, swapped, removed (4.1: rule redeclared each time): decisions and tips identical`, !d.decision && !d.status && !d.events, d, "compare");
  console.log(`  seed ${seed}, battery changes, 3,000 min: battery ${d.battery} readings differ in the last bits (exact sum vs left-to-right float sum) · decisions ${d.decision} · status ${d.status} · physical ${d.truth} · events ${d.events}${d.first ? ` · e.g. t=${d.first.t} ${d.first.robot} ${d.first.a} vs ${d.first.b}` : ""}`);
}

section("summary");
console.log(`  kernel writes measured: ${writeStats.n.toLocaleString("en-US")} · k avg ${(writeStats.k / writeStats.n).toFixed(2)} · k max ${writeStats.kMax} · µs/write avg ${(writeStats.us / writeStats.n).toFixed(1)} · max ${writeStats.usMax.toFixed(0)} (Node ${process.version})`);
console.log(`  ${checks.toLocaleString("en-US")} checks · ${fails.length} mismatches`);
console.log(`    ${by.rebuild.toLocaleString("en-US")} derived values = fresh rebuild = rule in JS (and defined), every 5 simulated minutes, 3 kernels`);
console.log(`    ${by.own.toLocaleString("en-US")} writes, each into the writer's own kernel (no robot writes into another's)`);
console.log(`    ${by.radio.toLocaleString("en-US")} radio checks (delivered only with a working link; same id in the sender's outbox and the receiver's inbox; no link, no inbox; boxes bounded; tips accepted only by the receiver's rule; out of range)`);
console.log(`    ${by.scenario.toLocaleString("en-US")} scenario, meaning, isolation and pointer checks`);
console.log(`    ${by.aggregate.toLocaleString("en-US")} aggregate checks (battery = oracle every minute while batteries change, explain members/terms, kept counts, incomplete/absent; eager and lazy)`);
console.log(`    ${by.cards.toLocaleString("en-US")} dashboard card checks (each line a rule → value, the latest write or a setup line; Doing = the flag that decided it; Messages = the kept counts)`);
console.log(`    ${by.flower.toLocaleString("en-US")} flower checks (Lua knows nothing of it; waters only when its own rule says so, charging first; the written level)`);
console.log(`    ${by.compare.toLocaleString("en-US")} 4.2 vs 4.1 behaviour comparisons (long runs, 5 seeds + 3 with battery changes)`);
if (fails.length) { console.log(JSON.stringify(fails.slice(0, 20), null, 1)); process.exit(1); }
