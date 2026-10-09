#!/usr/bin/env node
// Autonomous Robotics in Space: Node verification against the real, unmodified this.me@4.1.0.
// Runs the page's own model (space-model.js): two rocks, three spider robots, three separate kernels, a limited radio.
// Checks, step by step: every derived path in every kernel = a fresh kernel rebuilt from the same facts + same rules =
// the rule in plain JS; that messages only cross the void when the radio allows it; that each kernel is written only
// by its own robot; that a received tip is accepted only when the receiver's own rule says so; that one object means
// different things in different kernels; k; and the pointer limitation of 4.1.0 (known issue #4).
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
    check(`${label}: ${r.name} wrote ${x.path} in its own kernel`, ownPath(r, x.path) && r.k.read(x.path) !== undefined, x, "own");
  }
  // a message delivered this step: the radio really allowed it (recomputed here, independently of the event)
  for (const e of w.events) if (e.t === w.t && e.kind === "delivered" && !e.checked) {
    e.checked = true; const link = M.radio(w, M.robotOf(w, e.from), M.robotOf(w, e.to));
    check(`${label} t=${w.t}: ${M.NAME[e.from]} → ${M.NAME[e.to]} delivered only with a working link`, link.ok && (e.cross ? link.d <= M.RANGE : link.same), { e, link }, "radio");
  }
  // a tip heard this step: accepted exactly when the receiver's own rule allows it (age, same rock, no fresh tip of its own)
  for (const e of w.events) if (e.t === w.t && e.kind === "tip" && !e.checked) {
    e.checked = true; const r = M.robotOf(w, e.to), P = (n) => r.k.read(`robots.${r.id}.${n}`);
    check(`${label} t=${w.t}: ${r.name} accepted the tip from ${M.NAME[e.from]} only if its rule said so`,
      !e.accepted || (e.age <= P("maxAge") && e.rock === r.rock && P("tipAt") === w.t - e.age && P("tipFrom") === e.from), { e }, "radio");
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
  check("no rule reads through the home pointer", M.RULES.every(([, e]) => !/\bhome\b/.test(e)));
  for (const r of w.robots) {
    check(`${r.name}: pointer robots.${r.id}.home → its rock (read through)`, r.k.read(`robots.${r.id}.home.name`) === r.rockObj.name && r.k.read(`robots.${r.id}.home.radius`) === r.rockObj.R);
    check(`${r.name}'s kernel holds only its own robot`, M.IDS.filter((i) => i !== r.id).every((i) => r.k.read(`robots.${i}.battery`) === undefined && r.k.read(`robots.${i}.role`) === undefined));
    check(`${r.name}: role ${r.role} written in its own kernel`, r.k.read(`robots.${r.id}.role`) === r.role);
  }
  check("three kernels, three different objects", new Set(w.robots.map((r) => r.k.me)).size === 3);
  console.log(`  3 kernels · ${M.RULES.length} rules each (the same text) · ${M.FACTS.length} rule inputs each`);
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
    console.log(`  ${r.name.padEnd(4)} (${r.role}): ${[...S[r.id]].join(", ")} · sent ${r.k.read(`robots.${r.id}.sent`)} · heard ${r.k.read(`robots.${r.id}.received`)} · ice ${r.k.read(`robots.${r.id}.ice`)}`);
  }
  check("A: some charging happened", w.robots.some((r) => S[r.id].has("charging")));
  check("A: messages were delivered and some were lost", w.delivered > 50 && w.lost > 0, { delivered: w.delivered, lost: w.lost });
  const T = 3000; console.log(`  messages: ${w.delivered} delivered · ${w.lost} lost on the way · ${w.unheard} never reached (no link when sent)`);
  console.log(`  Pip ↔ Lua link over time: ${(100 * avail.ok / T).toFixed(0)}% in range · ${(100 * avail.range / T).toFixed(0)}% out of range · ${(100 * avail.rock / T).toFixed(0)}% a rock in the way`);
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
  console.log(`  600 min: 0 crossed · ${w.unheard - unheard0} sends found nobody across the void · Pip and Tiko still heard each other`);
  M.moveRockNow(w, 2, M.NEAR); let back = 0;
  for (let i = 0; i < 120; i++) { M.step(w, 1); afterStep(w, "C"); if (w.robots.some((a) => w.robots.some((b) => a.rock !== b.rock && M.radio(w, a, b).ok))) back++; }
  check("C: brought close again, the link comes back", back > 0, back);
  console.log(`  brought close: a cross-void link was up ${back} of the next 120 min`);
}

section("D · drain a battery: the robot's own rule sends it to the sun");
{
  const w = M.createWorld(ME); runSteps(w, 30, "D");
  const r = M.robotOf(w, 1), P = (n) => r.k.read(`robots.1.${n}`);
  const x = M.setBattery(w, 1, 6);
  check("D: battery 6 → mustCharge and goCharge at once", P("mustCharge") === true && P("goCharge") === true);
  check("D: reserve = lightDist × costPerRad + margin", Math.abs(P("reserve") - (P("lightDist") * P("costPerRad") + P("margin"))) < 1e-9);
  check("D: k reported for the battery write", x.k === x.recomputed.length && x.k >= 2, x);
  M.step(w, 1); afterStep(w, "D");
  check("D: next step it has decided to charge", P("charging") === true && (r.status === "going to the sun" || r.status === "charging"), r.status);
  let n = 0; while (P("battery") < P("full") && n < 1500) { M.step(w, 1); afterStep(w, "D"); n++; }
  check("D: it charges until full, then goes back to its work", P("charged") === true && P("goCharge") === false, { n, b: P("battery") });
  console.log(`  6% → full (${P("full")}%) in ${n} simulated minutes; k = ${x.k} for the battery write`);
}

section("E · a shared observation: one tip, each kernel decides");
{
  const w = M.createWorld(ME); const tiko = M.robotOf(w, 2), lua = M.robotOf(w, 3);
  const tip = { kind: "tip", from: 1, rock: 1, pos: 2.3, at: 0, spot: "1.0" };
  const a = M.receive(w, tiko, tip), b = M.receive(w, lua, tip);
  check("E: Tiko (same rock) accepts Pip's tip", a.accepted === true && tiko.k.read("robots.2.tipFrom") === 1);
  check("E: Lua (other rock) does not accept it", b.accepted === false && lua.k.read("robots.3.tipFrom") === 0);
  check("E: Lua still keeps what it heard, as heard", lua.k.read("robots.3.inboxFrom") === 1 && lua.k.read("robots.3.inboxRock") === 1);
  check("E: Pip's own kernel was not touched by the others", M.robotOf(w, 1).k.writes.length === 0);
  check("E: Tiko slips: it accepts the tip but does not follow it", tiko.k.read("robots.2.followTip") === false && tiko.k.read("robots.2.iceIsHazard") === true);
  for (let i = 0; i < 200; i++) M.step(w, 1);
  const old = { ...tip, at: w.t - 200, from: 3 };
  const pip = M.robotOf(w, 1), fresh = pip.k.read("robots.1.tipFresh");
  const c = M.receive(w, pip, { ...old, rock: 1 });
  check("E: an old tip (200 min) is not accepted", c.accepted === false && pip.k.read("robots.1.inboxAge") > pip.k.read("robots.1.maxAge"), { fresh });
  afterStep(w, "E");
  console.log(`  Tiko: ${a.accepted ? "accepted" : "refused"} · Lua: ${b.accepted ? "accepted" : "refused"} (not its rock) · an old tip: ${c.accepted ? "accepted" : "refused"}`);
}

section("F · one object, three meanings (the same rule text, three kernels)");
{
  const w = M.createWorld(ME);
  for (const r of w.robots) { r.k.write("objects.ice.seen", true); r.k.write("objects.comet.near", true); }
  const F = (r, n) => r.k.read(`robots.${r.id}.${n}`), [pip, tiko, lua] = w.robots;
  check("F: ice is fuel to Pip only", F(pip, "iceIsFuel") && !F(tiko, "iceIsFuel") && !F(lua, "iceIsFuel"));
  check("F: ice is a hazard to Tiko only", F(tiko, "iceIsHazard") && !F(pip, "iceIsHazard") && !F(lua, "iceIsHazard"));
  check("F: ice is a sample to Lua only", F(lua, "iceIsSample") && !F(pip, "iceIsSample") && !F(tiko, "iceIsSample"));
  check("F: the comet is a hazard to Pip and Tiko, a sample to Lua", F(pip, "cometIsHazard") && F(tiko, "cometIsHazard") && !F(lua, "cometIsHazard") && F(lua, "cometIsSample"));
  check("F: so Pip and Tiko shelter, Lua watches", F(pip, "shelter") && F(tiko, "shelter") && F(lua, "watchComet") && !F(lua, "shelter"));
  for (const r of w.robots) console.log(`  ${r.name.padEnd(4)} (${r.role}): ice → fuel ${F(r, "iceIsFuel")} · hazard ${F(r, "iceIsHazard")} · sample ${F(r, "iceIsSample")} | comet → hazard ${F(r, "cometIsHazard")} · sample ${F(r, "cometIsSample")}`);
  console.log(`  the rule text is identical in the three kernels, e.g. iceIsFuel = ${pip.k.me.explain("robots.1.iceIsFuel").expr}`);
  for (const r of w.robots) r.k.write("objects.ice.seen", false);
  check("F: ice not seen → it means nothing yet, in every kernel", w.robots.every((r) => !F(r, "iceIsFuel") && !F(r, "iceIsHazard") && !F(r, "iceIsSample")));
  const v = M.verifyWorld(ME, w); checks += v.checked; by.rebuild += v.checked; for (const m of v.mismatches) fails.push({ label: "F rebuild", detail: m });
}

section("summary");
console.log(`  kernel writes measured: ${writeStats.n.toLocaleString("en-US")} · k avg ${(writeStats.k / writeStats.n).toFixed(2)} · k max ${writeStats.kMax} · µs/write avg ${(writeStats.us / writeStats.n).toFixed(1)} · max ${writeStats.usMax.toFixed(0)} (Node ${process.version})`);
console.log(`  ${checks.toLocaleString("en-US")} checks · ${fails.length} mismatches`);
console.log(`    ${by.rebuild.toLocaleString("en-US")} derived values = fresh rebuild = rule in JS (and defined), every 5 simulated minutes, 3 kernels`);
console.log(`    ${by.own.toLocaleString("en-US")} writes, each into the writer's own kernel (no robot writes into another's)`);
console.log(`    ${by.radio.toLocaleString("en-US")} radio checks (delivered only with a working link, tips accepted only by the receiver's rule, out of range)`);
console.log(`    ${by.scenario.toLocaleString("en-US")} scenario, meaning, isolation and pointer checks`);
if (fails.length) { console.log(JSON.stringify(fails.slice(0, 20), null, 1)); process.exit(1); }
