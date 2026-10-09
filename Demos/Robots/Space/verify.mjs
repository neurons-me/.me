#!/usr/bin/env node
// Autonomous Robotics in Space: Node verification against the real, unmodified this.me@4.1.0.
// Runs the page's own model (space-model.js) through the story's scenarios and checks, step by step:
//   every derived path in every kernel = a fresh kernel rebuilt from the same facts + same rules = the rule in plain JS;
//   the scenario outcomes the page describes; the invariants; k; the pointer limitation of 4.1.0 (known issue #4).
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

let checks = 0; const fails = []; const by = { rebuild: 0, noFlip: 0, scenario: 0 };
const check = (label, ok, detail, cat = "scenario") => { checks++; by[cat]++; if (!ok) fails.push({ label, detail }); };
const section = (s) => console.log(`\n· ${s}`);
const writeStats = { n: 0, us: 0, usMax: 0, k: 0, kMax: 0 };
function track(w) { for (const r of w.robots) for (const x of r.lastBatch) { writeStats.n++; writeStats.us += x.us; writeStats.usMax = Math.max(writeStats.usMax, x.us); writeStats.k += x.k; writeStats.kMax = Math.max(writeStats.kMax, x.k); } }
const glitched = new Set();
function noFlip(w, label) {   // a normal write order never flips positionOk (tol absorbs one step); glitches excluded
  for (const r of w.robots) if (!glitched.has(r)) for (const x of r.lastBatch) check(`${label}: write ${x.path} did not flip positionOk`, !x.changed.includes(`robots.${r.rock.id}.positionOk`), x, "noFlip");
}
function runSteps(w, n, label, { every = 5, onStep } = {}) {
  for (let i = 0; i < n; i++) {
    M.step(w, 1); track(w); noFlip(w, label); onStep?.(w, i);
    if ((i + 1) % every === 0) { const v = M.verifyWorld(ME, w); checks += v.checked - v.mismatches.length; by.rebuild += v.checked; for (const m of v.mismatches) { checks++; fails.push({ label: `${label} t=${w.t} rebuild/JS`, detail: m }); } }
  }
}
const statuses = (w) => Object.fromEntries(w.robots.map((r) => [r.rock.id, new Set()]));
const collect = (S) => (w) => { for (const r of w.robots) S[r.rock.id].add(r.status); };

section("kernel");
console.log(`  this.me@4.1.0 dist/me.es.js sha256 ${hash.slice(0, 16)}… verified`);
check("kernel sha256", hash === SHA);
{
  const w = M.createWorld(ME);
  for (const r of w.robots) for (const [n, e] of M.RULES) {
    check(`robot ${r.rock.id} ${n} expression`, r.k.me.explain(`robots.${r.rock.id}.${n}`).expr === e);
    check(`Earth mirror ${r.rock.id} ${n}: same rule text`, w.earth.me.explain(`robots.${r.rock.id}.${n}`).expr === e);
  }
  check("no rule reads through the home pointer", M.RULES.every(([, e]) => !/\bhome\b/.test(e)));
  for (const r of w.robots) {
    check(`pointer robots.${r.rock.id}.home → distanceAU (read through)`, r.k.read(`robots.${r.rock.id}.home.distanceAU`) === r.rock.distanceAU);
    check(`robot ${r.rock.id} kernel holds only its own robot`, M.IDS.filter((i) => i !== r.rock.id).every((i) => r.k.read(`robots.${i}.battery`) === undefined));
  }
}
section("this.me 4.1.0 known issue #4: a formula through a pointer is not recomputed (why the page has none)");
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

section("A · Earth decides (n=1), link up, 1,500 simulated minutes");
{
  const w = M.createWorld(ME); const S = statuses(w);
  runSteps(w, 1500, "A", { onStep: collect(S) });
  for (const r of w.robots) {
    check(`A: ${r.rock.id} never fell asleep`, !r.dead, r.truth.battery);
    check(`A: ${r.rock.id} explored and charged`, S[r.rock.id].has("surveying") && S[r.rock.id].has("charging"), [...S[r.rock.id]]);
  }
  check("A: Earth received data", w.received > 0, w.received);
  console.log(`  statuses seen: ${JSON.stringify(Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])))}; data on Earth ${w.received}`);
}

section("B · Earth decides (n=1), link cut at t=5");
{
  const w = M.createWorld(ME);
  runSteps(w, 5, "B");
  M.setLink(w, false);
  const mirror = JSON.stringify(M.IDS.map((i) => M.FACTS.map((f) => w.earth.read(`robots.${i}.${f}`))));
  const orders = w.robots.map((r) => r.order);
  let ordersChanged = false, waiting = false;
  runSteps(w, 1500, "B", { onStep: (w) => { if (w.robots.some((r, j) => r.order !== orders[j])) ordersChanged = true; if (w.robots.some((r) => r.status === "waiting for Earth")) waiting = true; } });
  check("B: no packet in flight after the cut", w.packets.length === 0);
  check("B: no order reached a robot after the cut", !ordersChanged);
  check("B: Earth's mirror froze at the cut", JSON.stringify(M.IDS.map((i) => M.FACTS.map((f) => w.earth.read(`robots.${i}.${f}`)))) === mirror);
  check("B: a robot's own kernel said goCharge while it kept its last order", waiting);
  const asleep = w.robots.filter((r) => r.dead).map((r) => r.rock.id);
  check("B: robots exploring at the cut fell asleep in the dark", asleep.length === 3, asleep);
  for (const r of w.robots) check(`B: ${r.rock.id} kernel records battery 0`, r.k.read(`robots.${r.rock.id}.battery`) === 0);
  console.log(`  asleep: ${asleep.join(", ") || "none"} (orders at the cut: ${orders.join(", ")})`);
}

section("C · each robot decides (.me), link cut at t=5");
{
  const w = M.createWorld(ME); M.setMode(w, "local"); const S = statuses(w);
  runSteps(w, 5, "C"); M.setLink(w, false);
  let decidedAfterCut = 0;
  runSteps(w, 1500, "C", { onStep: (w) => { collect(S)(w); for (const r of w.robots) if (r.status === "returning") decidedAfterCut++; } });
  for (const r of w.robots) {
    check(`C: ${r.rock.id} never fell asleep`, !r.dead, r.truth.battery);
    check(`C: ${r.rock.id} explored and charged with no link`, S[r.rock.id].has("surveying") && S[r.rock.id].has("charging"), [...S[r.rock.id]]);
    check(`C: ${r.rock.id} keeps its new data on board while the link is cut`, r.data - r.sent > 0, { data: r.data, sent: r.sent });
  }
  check("C: robots turned back on their own after the cut", decidedAfterCut > 0);
  check("C: nothing reached Earth after the cut", w.packets.length === 0);
  console.log(`  statuses seen: ${JSON.stringify(Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])))}`);
}

section("D · invariants: glitch the position sensor, glitch the battery reading");
{
  const w = M.createWorld(ME); M.setMode(w, "local"); runSteps(w, 30, "D");
  const r = w.robots[0], id = r.rock.id, P = (n) => r.k.read(`robots.${id}.${n}`);
  const others = w.robots.slice(1).map((o) => ({ o, n: o.k.writes.length, at: o.k.me.explain(`robots.${o.rock.id}.safeMode`).meta.lastComputedAt }));
  glitched.add(r);
  const x = M.glitchPosition(w, id, 0.6);
  check("D: positionOk false at once", P("positionOk") === false);
  check("D: safeMode true at once", P("safeMode") === true);
  check("D: explain(positionOk) shows drift and tol as inputs", JSON.stringify(r.k.me.explain(`robots.${id}.positionOk`).derivation.inputs.map((i) => i.label)) === JSON.stringify(["drift", "tol"]));
  check("D: k = number of paths the kernel recomputed", x.k === x.recomputed.length && x.k > 0, x);
  check("D: the write touched only this robot's kernel", others.every(({ o, n, at }) => o.k.writes.length === n && o.k.me.explain(`robots.${o.rock.id}.safeMode`).meta.lastComputedAt === at));
  const pos0 = r.truth.pos; let held = true;
  for (let i = 0; i < M.STAR_FIX_MIN - 1; i++) { M.step(w); track(w); if (P("safeMode") !== true || r.truth.pos !== pos0) held = false; }
  check("D: robot stopped and held the flag until its star fix", held);
  M.step(w); M.step(w); track(w);
  check("D: star fix → consistent again", P("consistent") === true && P("positionOk") === true);
  const v = M.verifyWorld(ME, w); checks += v.checked; by.rebuild += v.checked; for (const m of v.mismatches) fails.push({ label: "D rebuild", detail: m });
  M.glitchBattery(w, id, 140);
  check("D: battery 140 → batteryOk false, safeMode true", P("batteryOk") === false && P("safeMode") === true);
  for (let i = 0; i < M.STAR_FIX_MIN + 2; i++) M.step(w);
  check("D: after the star fix the battery reading is real again", P("batteryOk") === true && P("battery") <= 100);
  glitched.delete(r);
}

section("E · night and the battery: the slider, in the dark");
{
  const w = M.createWorld(ME); M.setMode(w, "local");
  const r = w.robots[1], id = r.rock.id, P = (n) => r.k.read(`robots.${id}.${n}`);   // B 325 starts in the dark
  runSteps(w, 3, "E");
  check("E: B 325 is in the dark", P("shade") > 0);
  const x = M.setBattery(w, id, 15);
  check("E: mustReturn true at once", P("mustReturn") === true);
  check("E: goCharge true at once", P("goCharge") === true);
  check("E: reserveNeeded = shade × costPerRad + margin + lagReserve", Math.abs(P("reserveNeeded") - (P("shade") * P("costPerRad") + P("margin") + P("lagReserve"))) < 1e-9);
  check("E: k reported for the battery write", x.k === x.recomputed.length && x.k >= 3, x);
  M.step(w);
  check("E: next control step it walks toward the light", r.k.read(`robots.${id}.vel`) < 0 && r.status === "returning");
  const v = M.verifyWorld(ME, w); checks += v.checked; by.rebuild += v.checked; for (const m of v.mismatches) fails.push({ label: "E rebuild", detail: m });
}

section("summary");
console.log(`  kernel writes measured: ${writeStats.n.toLocaleString("en-US")} · k avg ${(writeStats.k / writeStats.n).toFixed(2)} · k max ${writeStats.kMax} · µs/write avg ${(writeStats.us / writeStats.n).toFixed(1)} · max ${writeStats.usMax.toFixed(0)} (Node ${process.version})`);
console.log(`  ${checks.toLocaleString("en-US")} checks · ${fails.length} mismatches`);
console.log(`    ${by.rebuild.toLocaleString("en-US")} derived values = fresh rebuild = rule in JS (and defined), every 5 simulated minutes, 4 kernels`);
console.log(`    ${by.noFlip.toLocaleString("en-US")} writes that did not flip positionOk (a normal write order never trips the invariant)`);
console.log(`    ${by.scenario.toLocaleString("en-US")} scenario, invariant, k, isolation and pointer checks`);
if (fails.length) { console.log(JSON.stringify(fails.slice(0, 20), null, 1)); process.exit(1); }
