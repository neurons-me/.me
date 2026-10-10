// Autonomous Robotics in Space: .GUI page (this.gui@4.1.0, SRI-pinned in index.html, sha256-checked below)
// over a LOCAL candidate build of this.me 4.2 (integ/4.2-rootfix @ 2b4b1fe, not published; sha256-checked below before import).
//
// Who owns what:
//   KERNEL (this.me): one kernel per spider robot (3). Every robot fact, its own view of the shared objects (objects.*),
//                     every derived value (decisions and what each object means to it), k, explain().
//   .GUI (this.gui):  the page is one spec resolved by GUI.mount (topbar, scene, passages, panels); readouts are
//                     kernel reads through ONE .GUI runtime (GUI.createMeRuntime) over an explicit subscribe bridge.
//   ADAPTER (plain JS, space-model.js + this file): physics truth, walking, the radios (range, line of sight, delay,
//                     bandwidth, loss), which action a robot takes from its flags, the drawing, the simulation clock.

import * as M from "./space-model.js";

const KERNEL = { version: "4.2 candidate", label: "this.me 4.2 candidate", build: "local build of integ/4.2-rootfix @ 2b4b1fe, not published", sha256: "50c643e1e6306855833227993de03ea5d23e279504319f2874c62c7793fc1563",
  urls: ["./kernel/this.me-4.2-candidate.es.js"] };
const GUI_PIN = { label: "this.gui@4.1.0", repo: "https://github.com/neurons-me/GUI", npm: "https://www.npmjs.com/package/this.gui/v/4.1.0",
  url: "https://cdn.jsdelivr.net/npm/this.gui@4.1.0/dist/this.gui.umd.js", sha256: "d50e32f6a4f7603804228c074fc59df1cfdea73a4f3d5ad93ba9475227b2a577" };
const SRC = "https://github.com/neurons-me/.me/blob/main/Demos/Robots/Space/";
const BUILD_NOTES = "https://github.com/neurons-me/.me/tree/main/Demos/Robots/Space";

const G = window.GUI, h = React.createElement;
const { Box, Button, Typography, Link, TextField } = G.Atoms;
const { MenuItem } = G.Molecules;
const Slider = G.Atoms.Slider || G.Molecules.Slider || null;
const MONO = '"IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace';
// .me code on screen goes through the shared highlighter (assets/me-syntax): colours from the .GUI theme, text unchanged.
const SYN = window.MeSyntax || null;
if (SYN && SYN.watchTheme) SYN.watchTheme(); // re-measures the colours whenever .GUI writes a new theme / mode
// Code → object: a path in the code that names an instance (a robot, a rock, the ice, the comet) is a button that
// selects it, as tapping it in the sky does; the selected one is marked in every line of code. ctx = the kernel the
// line runs in (objects.rock is "the other rock" of that kernel's robot).
function resolveInstance(path, ctx) {
  let m;
  if ((m = /^robots\.(\d+)$/.exec(path))) return M.NAME[m[1]] ? `robot:${m[1]}` : null;
  // a message names its peer: inbox[id] / its .from → the sender, outbox[id] / its .to → the receiver (read in that kernel)
  if ((m = /^robots\.(\d+)\.(inbox|outbox)\.(\d+)(?:\.(?:from|to))?$/.exec(path))) { const peer = FME(`robots.${m[1]}.${m[2]}.${m[3]}.${m[2] === "inbox" ? "from" : "to"}`); return M.NAME[peer] ? `robot:${peer}` : null; }
  if ((m = /^robots\.\d+\.(?:lastFrom|lastTo)\.(\d+)$/.exec(path))) return M.NAME[m[1]] ? `robot:${m[1]}` : null;   // the pointer to the latest from / to robot m
  if ((m = /^robots\.(\d+)\.tipMsg$/.exec(path))) { const f = FME(`robots.${m[1]}.tipMsg.from`); return M.NAME[f] ? `robot:${f}` : null; }   // whose tip it keeps
  if ((m = /^robots\.(\d+)\.home$/.exec(path))) { const r = M.ROBOTS.find((x) => x.id === Number(m[1])); return r ? `rock:${r.rock}` : null; }   // the pointer → its rock
  if ((m = /^rocks\.(\w+)$/.exec(path))) { const rk = M.ROCKS.find((x) => x.key === m[1]); return rk ? `rock:${rk.id}` : null; }
  if (path === "objects.ice" || path === "objects.comet" || path === "objects.flower") return `object:${path.slice(8)}`;
  if (path === "objects.rock" && ctx) { const r = M.ROBOTS.find((x) => x.id === ctx); return r ? `rock:${r.rock === 1 ? 2 : 1}` : null; }
  return null;
}
const refTitle = (id) => { const [k, v] = id.split(":"); return k === "robot" ? `select ${M.NAME[v]}` : k === "rock" ? `select the rock ${M.ROCK_NAME[v]}` : `select the ${v}`; };
function MeCode({ code, sx, id, className, ctx, unmarked }) {   // unmarked: a ref not marked even when selected (e.g. the panel's own robot)
  const { focus } = useStore(ui);
  const opts = { resolve: resolveInstance, ctx, selected: (ref) => ref === focus && ref !== unmarked, onSelect: (ref) => act.focus(ref), title: refTitle };
  return h(Box, { component: "code", id, className: `me-code${className ? " " + className : ""}`, sx: { fontFamily: MONO, minWidth: 0, ...(sx || {}) } }, ...(SYN ? SYN.render(h, code, opts) : [code]));
}
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
const alpha = (c, a) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
const fmt = (v, d = 2) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(d)) : v === undefined ? "—" : String(v));
const clock = (min) => { const m = Math.floor(min); return `day ${Math.floor(m / 1440) + 1} · ${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

async function sha256Hex(buf) { const d = await crypto.subtle.digest("SHA-256", buf); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function verifyGuiBuild() {
  const res = await fetch(GUI_PIN.url, { cache: "force-cache" }); if (!res.ok) throw new Error(`.GUI build: HTTP ${res.status}`);
  const hash = await sha256Hex(await res.arrayBuffer());
  if (hash !== GUI_PIN.sha256) throw new Error(`.GUI build sha256 mismatch: got ${hash}`);
  return hash;
}
async function loadKernel() {
  const errors = [];
  for (const url of KERNEL.urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" }); if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text(); const hash = await sha256Hex(new TextEncoder().encode(text));
      if (hash !== KERNEL.sha256) throw new Error(`sha256 mismatch: got ${hash}`);
      const blob = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
      const mod = await import(blob); URL.revokeObjectURL(blob);
      return { ME: mod.default || mod.ME, hash, url: res.url || url };
    } catch (e) { errors.push(`${url}: ${e?.message || e}`); }
  }
  throw new Error("Could not load " + KERNEL.label + ": " + errors.join(" | "));
}


// ── tiny external stores (page state, not kernel) ──
function createStore(state) { const ls = new Set(); let v = 0; return { state, subscribe: (cb) => (ls.add(cb), () => ls.delete(cb)), version: () => v, set(p) { if (p) Object.assign(state, p); v++; ls.forEach((cb) => cb()); } }; }
const useStore = (s) => { React.useSyncExternalStore(s.subscribe, s.version); return s.state; };
const ui = createStore({ step: 1, sel: 1, obj: "ice", focus: "robot:1", hood: false, running: false, speed: 10, explain: "goCharge", kernel: { state: "loading" }, gui: { state: "checking" }, verify: null });
const frame = createStore({});   // bumped every animation frame (scene only)
const tick = createStore({});    // bumped at 4 Hz (panels)

// ── the kernels and the one .GUI runtime ──
// Three kernels, one per spider. Read facade FME(path): "robots.<id>.…" → that robot's kernel; "r<id>.objects.…" →
// robot <id>'s own view of a shared object (objects.* in its kernel). No writes go through it.
let ME = null, W = null, RT = null;
function kernelFor(path) {
  const p = String(path); let m = /^r(\d+)\.(.*)$/.exec(p);
  if (m) return [W?.robots.find((x) => x.id === Number(m[1]))?.k, m[2]];
  m = /^robots\.(\d+)\./.exec(p); return [m && W?.robots.find((x) => x.id === Number(m[1]))?.k, p];
}
const FME = Object.assign((p) => { const [k, q] = kernelFor(p); return k ? k.me(q) : undefined; }, { explain: (p) => { const [k, q] = kernelFor(p); return k?.me.explain(q); } });
// Explicit subscribe bridge: this.me@4.1.0 has no change events, and me.subscribe(...) on a kernel proxy would write a
// fact named "subscribe". The page announces exactly the paths the kernel reported for each write (the written fact +
// explain().meta.recomputed), batched to the 4 Hz UI tick.
const kListeners = new Map();
const bridgeKey = (p) => { const s = String(p); return s.startsWith("me/") ? s.slice(3).replace(/\//g, ".") : s; };
function kernelSubscribe(path, cb) { const key = bridgeKey(path); let s = kListeners.get(key); if (!s) kListeners.set(key, (s = new Set())); s.add(cb); return () => { s.delete(cb); if (!s.size) kListeners.delete(key); }; }
let pending = new Set();
const pagePath = (id, p) => (p.startsWith("objects.") ? `r${id}.${p}` : p);
const noteWrite = (id, x) => { pending.add(pagePath(id, x.path)); for (const p of x.recomputed) pending.add(pagePath(id, p)); };
function announce() { const ps = pending; pending = new Set(); for (const p of ps) kListeners.get(p)?.forEach((cb) => cb()); }
function announceAll() { pending.clear(); for (const s of [...kListeners.values()]) [...s].forEach((cb) => cb()); }

// ── simulation loop ──
let acc = 0, lastNow = 0, lastUi = 0, frames = [], stepMs = [], frameMs = [];
const wstat = { n: 0, us: 0, k: 0, kMax: 0 };
const lastWrites = new Map();   // robot id → last batch with more than the clock (with k and µs)
function stepOnce() {
  for (const r of W.robots) r._p0 = r.truth.pos;
  for (const rk of W.rocks) { rk._x0 = rk.x; rk._y0 = rk.y; }
  W.comet._x0 = W.comet.x; W.comet._y0 = W.comet.y; W.comet._on0 = W.comet.on;
  const t0 = performance.now();
  M.step(W, 1);
  stepMs.push(performance.now() - t0); if (stepMs.length > 300) stepMs.splice(0, 150);
  for (const r of W.robots) {
    for (const x of r.lastBatch) { wstat.n++; wstat.us += x.us; wstat.k += x.k; wstat.kMax = Math.max(wstat.kMax, x.k); noteWrite(r.id, x); }
    if (r.lastBatch.some((x) => !x.path.endsWith(".now"))) lastWrites.set(r.id, { t: W.t, batch: r.lastBatch });
  }
}
function loop(now) {
  const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
  if (lastNow) { frameMs.push(now - lastNow); if (frameMs.length > 600) frameMs.splice(0, 300); }
  lastNow = now;
  frames.push(now); if (frames.length > 240) frames = frames.filter((t) => now - t <= 1000);
  if (W && ui.state.running) {
    acc += dt * ui.state.speed;
    let n = 0; while (acc >= 1 && n < 12) { stepOnce(); acc -= 1; n++; }
    if (n === 12) acc = 0;
  }
  frame.set();
  if (now - lastUi > 250) { lastUi = now; announce(); tick.set(); }
  requestAnimationFrame(loop);
}
const FLOWER_ON = new URLSearchParams(location.search).get("flower") === "1";   // the flower is a follow-up, off by default
function reset() { W = M.createWorld(ME, { flower: FLOWER_ON }); acc = 0; lastWrites.clear(); ui.set({ verify: null }); announceAll(); tick.set(); frame.set(); }
const play = (on = true) => ui.set({ running: on });
function interact(id, xs) { for (const x of [].concat(xs || [])) { noteWrite(id, x); lastWrites.set(id, { t: W.t, batch: [x], manual: true }); } announce(); tick.set(); frame.set(); }
const robot = (id) => W?.robots.find((r) => r.id === id);
const act = {
  select: (id) => ui.set({ sel: id, focus: `robot:${id}` }),
  object: (k) => ui.set({ obj: k, focus: k === "rock" ? "rock:2" : `object:${k}` }),
  // one selection for the sky, the panels and the code: robot:N, rock:N, object:ice / object:comet
  focus: (ref) => { const [k, v] = String(ref).split(":");
    if (k === "robot") ui.set({ sel: Number(v), focus: ref });
    else if (k === "rock") ui.set({ obj: "rock", focus: ref });
    else if (k === "object") ui.set({ obj: v, focus: ref }); },
  drain: (id) => { ui.set({ sel: id, focus: `robot:${id}`, explain: "mustCharge" }); interact(id, M.setBattery(W, id, 6)); },
  battery: (id, v) => interact(id, M.setBattery(W, id, v)),
  addBattery: (id) => interact(id, M.addBattery(W, id)),
  swapBattery: (id) => interact(id, M.swapBattery(W, id, 2, 50, 10)),
  removeBattery: (id) => { const r = robot(id); interact(id, M.removeBattery(W, id, r.bats[r.bats.length - 1].i)); },
  hello: (id) => { ui.set({ sel: id, focus: `robot:${id}` }); M.sayHello(W, id); interact(); },
  tip: (id) => { ui.set({ sel: id, focus: `robot:${id}` }); M.shareTip(W, id); interact(); },
  away: () => { M.holdRock(W, 2, M.FAR); interact(); },
  close: () => { M.holdRock(W, 2, M.NEAR); interact(); },
  drift: () => { M.holdRock(W, 2, null); interact(); },
  thirsty: () => { M.dryFlower(W, 20); ui.set({ obj: "flower", focus: "object:flower" }); interact(); },
  verify: () => { const t0 = performance.now(); const v = M.verifyWorld(ME, W); ui.set({ verify: { ...v, ms: performance.now() - t0, t: W.t } }); },
};

// ── the story: the acts and their .me lines live in space-model.js (M.STORY); verify checks every line runs ──
const TRIES = [null,
  [["Meet Oli", () => act.select(1)], ["Meet Tiko", () => act.select(2)], ["Meet Lua", () => act.select(3)]],
  [["Drain Tiko's battery", () => { act.drain(2); play(); }]],
  [["What is the ice to each?", () => act.object("ice")], ["And the comet?", () => act.object("comet")]],
  [["Lua says hello", () => { act.hello(3); play(); }], ["Bring the rocks close", () => { act.close(); play(); }]],
  [["Oli shares an ice tip", () => { act.tip(1); act.object("ice"); play(); }]],
  [["Push B 325 away", () => { act.away(); play(); }], ["Bring it close", () => { act.close(); play(); }], ["Let it drift", () => act.drift()]],
  [["Verify all three kernels", () => { act.verify(); ui.set({ hood: true }); }]],
];
const PASSAGES = M.STORY.map((s, i) => (s ? { ...s, tries: TRIES[i] } : null));
const STEPS = PASSAGES.length - 1;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

// ── scene (page-side SVG; colours from the .GUI theme) ──
const VB = M.VB;
const STARS = Array.from({ length: 70 }, (_, i) => { const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123; return [((a % 1) + 1) % 1 * VB.w, ((b % 1) + 1) % 1 * VB.h, 0.5 + ((i * 7) % 5) / 8, 0.15 + ((i * 3) % 7) / 25]; });
function sceneVars(t) {
  const dark = t.palette.mode === "dark";
  return { "--ink": t.palette.text.primary, "--muted": t.palette.text.secondary, "--faint": t.palette.text.disabled, "--bg": t.palette.background.default,
    "--sun": t.palette.warning.main, "--day": alpha(t.palette.warning.main, dark ? 0.16 : 0.24), "--night": alpha(t.palette.text.primary, dark ? 0.06 : 0.08),
    "--link": t.palette.info.main, "--err": t.palette.error.main, "--accent": t.palette.primary.main, "--ice": dark ? "#9fd8ff" : "#2a86c7" };
}
const lerp = (a, b, f) => a + (b - a) * f;
const lerpA = (a, b, f) => a + M.wrap(b - a) * f;
function view(f) {   // positions interpolated between simulation steps (smooth motion)
  const rocks = Object.fromEntries(W.rocks.map((rk) => [rk.id, { ...rk, x: lerp(rk._x0 ?? rk.x, rk.x, f), y: lerp(rk._y0 ?? rk.y, rk.y, f) }]));
  const pos = (r) => lerpA(r._p0 ?? r.truth.pos, r.truth.pos, f);
  const xy = (r, lift = 0, p = pos(r)) => { const rk = rocks[r.rock], a = M.sunAngle(rk) + p; return { x: rk.x + (rk.R + lift) * Math.cos(a), y: rk.y + (rk.R + lift) * Math.sin(a), a }; };
  return { rocks, pos, xy };
}
const ICE_POS = (rk, s, k = 0.78) => { const a = M.sunAngle(rk) + s.pos; return { x: rk.x + rk.R * k * Math.cos(a), y: rk.y + rk.R * k * Math.sin(a), a }; };
function Spider({ r, V, FS, sel }) {   // a small spider: body, head, antenna, eight legs that step while it walks
  const p = V.xy(r, 0), deg = (p.a * 180) / Math.PI + 90, walking = Math.abs(r.moving) > 1e-9 && !r.dead;
  const ph = (r.walked + (walking ? acc * Math.abs(r.moving) * r.rockObj.R : 0)) * 0.9;
  const s = 1.5 * Math.min(FS, 1.6), col = r.dead ? "var(--faint)" : "var(--ink)";
  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const base = -4.5 + i * 3, sw = walking ? Math.sin(ph + (i * Math.PI) / 2 + (side > 0 ? Math.PI : 0)) * 2.2 : 0;
    const pts = r.dead ? `${side * 3},${-5 + i} ${side * 5},${-8 + i} ${side * 4},${-10 + i}` : `${side * 3},${-6 + i * 1.2} ${side * 7},${-9 + base * 0.4 + sw * 0.5} ${side * 10},${base * 0.8 + sw}`;
    legs.push(h("polyline", { key: `${side}${i}`, points: pts, fill: "none" }));
  }
  return h("g", { transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${s.toFixed(2)})`, stroke: col, strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
    ...legs,
    h("ellipse", { cx: 0, cy: -8, rx: 5.2, ry: 4, fill: "var(--bg)" }),
    h("circle", { cx: r.moving < 0 ? -5.5 : 5.5, cy: -10, r: 2.4, fill: "var(--bg)" }),
    h("line", { x1: 0, y1: -12, x2: 0, y2: -17 }), h("circle", { cx: 0, cy: -18, r: 1.1, fill: sel ? "var(--accent)" : col, stroke: "none" }));
}
// The flower (page state: the world's real water level; each robot only knows what it last saw). Tap it: what is it to each?
function FlowerG({ rk, FS, focus }) {
  const fl = W.flower, a = M.sunAngle(rk) + fl.pos, s = Math.min(FS, 1.5), deg = (a * 180) / Math.PI + 90;
  const base = { x: rk.x + rk.R * Math.cos(a), y: rk.y + rk.R * Math.sin(a) }, lvl = Math.max(0, Math.min(1, fl.water / 100));
  const dry = fl.water < 40, col = dry ? "var(--sun)" : "var(--accent)";
  return h("g", { className: "flower", "data-water": Math.round(fl.water), role: "button", tabIndex: 0, "aria-label": `A flower, ${Math.round(fl.water)}% water. What is it to each spider?`, style: { cursor: "pointer" },
      onClick: (e) => { e.stopPropagation(); act.object("flower"); }, onPointerDown: (e) => e.stopPropagation(), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act.object("flower"); } } },
    h("g", { transform: `translate(${base.x.toFixed(1)} ${base.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${s.toFixed(2)})` },
      h("path", { d: `M0,0 Q${dry ? 3 : 0},-7 ${dry ? 5 : 0},-13`, fill: "none", stroke: "var(--ink)", strokeWidth: 1.3, strokeLinecap: "round" }),
      h("path", { d: "M0,-5 Q-5,-6 -6,-9 Q-2,-9 0,-5", fill: "var(--accent)", opacity: 0.7 }),
      h("g", { transform: `translate(${dry ? 5 : 0} -15) rotate(${dry ? 35 : 0})` },
        ...[0, 1, 2, 3, 4].map((i) => { const b = (i * 2 * Math.PI) / 5; return h("circle", { key: i, cx: 3.2 * Math.cos(b), cy: 3.2 * Math.sin(b), r: 2.4, fill: col, opacity: dry ? 0.6 : 0.9 }); }),
        h("circle", { r: 1.6, fill: "var(--sun)" })),
      // the water drop beside it: filled up to its water level
      h("g", { transform: "translate(11 -9)" }, h("clipPath", { id: "drop-clip" }, h("path", { d: "M0,-6 Q4,-1 4,2 A4,4 0 0 1 -4,2 Q-4,-1 0,-6 Z" })),
        h("rect", { x: -5, y: 6 - 12 * lvl, width: 10, height: 12 * lvl, fill: "var(--ice)", clipPath: "url(#drop-clip)" }),
        h("path", { d: "M0,-6 Q4,-1 4,2 A4,4 0 0 1 -4,2 Q-4,-1 0,-6 Z", fill: "none", stroke: "var(--ice)", strokeWidth: 1 })),
      focus === "object:flower" ? h("circle", { className: "focus-ring", cx: 2, cy: -11, r: 12, fill: "none", stroke: "var(--accent)", strokeWidth: 1.4, strokeDasharray: "3 2" }) : null,
      h("circle", { cx: 3, cy: -10, r: 14, fill: "transparent" })));
}
function arcPath(rk, a0, a1, rad) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.08)); let d = "";
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); d += `${i ? "L" : "M"}${(rk.x + rad * Math.cos(a)).toFixed(1)},${(rk.y + rad * Math.sin(a)).toFixed(1)}`; }
  return d;
}
function Intent({ r, V, FS }) {   // where it is heading: a dashed arc along the surface, with an arrowhead at the end
  if (r.dead) return null;
  const rk = V.rocks[r.rock], sa = M.sunAngle(rk), p = V.pos(r), rad = rk.R + 13;
  let goal = null, mark = null;
  if (r.action === "charge" && M.lightDistOf(r.truth.pos) > 1e-9) { goal = Math.sign(M.wrap(r.truth.pos) || 1) * (M.HALF_PI - M.LIT_IN); mark = "sun"; }
  else if (r.action === "tip") { const tp = r.k.read(`robots.${r.id}.tipPos`); if (Math.abs(M.wrap(tp - r.truth.pos)) > 0.02) { goal = tp; mark = "ice"; } }
  else if (r.action === "water") { const fp = r.k.read("objects.flower.pos"); if (Math.abs(M.wrap(fp - r.truth.pos)) > 0.02) { goal = fp; mark = "flower"; } }
  else if (r.action === "explore") { goal = p + r.dir * 0.9; mark = "look"; }
  if (goal == null) return null;
  const a0 = sa + p, a1 = a0 + M.wrap(goal - p);
  const end = { x: rk.x + rad * Math.cos(a1), y: rk.y + rad * Math.sin(a1) }, tdir = Math.sign(a1 - a0) || 1;
  const ta = a1 + (tdir * Math.PI) / 2, ax = Math.cos(ta), ay = Math.sin(ta), nx = Math.cos(a1), ny = Math.sin(a1), u = 6 * Math.min(FS, 1.6);
  const colr = mark === "sun" ? "var(--sun)" : mark === "ice" || mark === "flower" ? "var(--ice)" : "var(--accent)";
  return h("g", { className: "intent", "data-robot": r.id, "data-mark": mark, opacity: 0.9, style: { pointerEvents: "none" } },
    h("path", { d: arcPath(rk, a0, a1, rad), fill: "none", stroke: colr, strokeWidth: 1.6, strokeDasharray: "3 5", strokeLinecap: "round" }),
    h("path", { d: `M${(end.x - ax * u + nx * u * 0.6).toFixed(1)},${(end.y - ay * u + ny * u * 0.6).toFixed(1)} L${(end.x + ax * u * 0.4).toFixed(1)},${(end.y + ay * u * 0.4).toFixed(1)} L${(end.x - ax * u - nx * u * 0.6).toFixed(1)},${(end.y - ay * u - ny * u * 0.6).toFixed(1)}`, fill: "none", stroke: colr, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }));
}
const STATUS_SVG = { "going to the sun": "sun", charging: "bolt", "going to the ice": "ice", "mining ice": "pick", "studying the ice": "eye", "studying the comet": "eye", "hiding from the comet dust": "shield", "turning away from the ice": "turn", exploring: "look", asleep: "zz", "going to the flower": "drop", "watering the flower": "drop" };
function Glyph({ kind, x, y, s = 1, color }) {
  const g = (...c) => h("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`, fill: "none", stroke: color || "var(--ink)", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }, ...c);
  switch (kind) {
    case "sun": return g(h("circle", { r: 3.2, fill: "var(--sun)", stroke: "var(--sun)" }), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return h("line", { key: i, x1: 5 * Math.cos(a), y1: 5 * Math.sin(a), x2: 7 * Math.cos(a), y2: 7 * Math.sin(a), stroke: "var(--sun)" }); }));
    case "bolt": return g(h("path", { d: "M1,-7 L-4,1 L0,1 L-1,7 L4,-1 L0,-1 Z", fill: "var(--sun)", stroke: "var(--sun)" }));
    case "ice": return g(...[0, 1, 2].map((i) => { const a = (i * Math.PI) / 3; return h("line", { key: i, x1: -6 * Math.cos(a), y1: -6 * Math.sin(a), x2: 6 * Math.cos(a), y2: 6 * Math.sin(a), stroke: "var(--ice)" }); }));
    case "pick": return g(h("path", { d: "M-6,-3 Q0,-8 6,-3 M0,-5.5 L0,6" }));
    case "eye": return g(h("path", { d: "M-7,0 Q0,-6 7,0 Q0,6 -7,0 Z" }), h("circle", { r: 2, fill: color || "var(--ink)" }));
    case "shield": return g(h("path", { d: "M0,-7 L6,-4 L5,3 Q3,6 0,7 Q-3,6 -5,3 L-6,-4 Z" }));
    case "turn": return g(h("path", { d: "M4,6 L4,-2 Q4,-6 0,-6 Q-4,-6 -4,-2 L-4,3 M-7,0 L-4,3.5 L-1,0" }));
    case "zz": return g(h("path", { d: "M-5,-5 L0,-5 L-5,0 L0,0 M1,-1 L5,-1 L1,4 L5,4" }));
    // the dashboard's icons (drawn here as SVG: no icon font, so no icon names can ever show as text)
    case "drop": return g(h("path", { d: "M0,-7 Q5,-1 5,2.5 A5,5 0 0 1 -5,2.5 Q-5,-1 0,-7 Z", stroke: color || "var(--ice)" }));
    case "flower": return g(h("path", { d: "M0,7 L0,-1 M0,3 Q-4,2 -5,-1 M0,4 Q4,3 5,0" }), ...[0, 1, 2, 3, 4].map((i) => { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2; return h("circle", { key: i, cx: 2.6 * Math.cos(a), cy: -3.5 + 2.6 * Math.sin(a), r: 1.7 }); }), h("circle", { cy: -3.5, r: 1.1, fill: color || "var(--ink)" }));
    case "go": return g(h("path", { d: "M-6,0 L5,0 M1,-4 L5,0 L1,4" }));
    case "radio": return g(h("path", { d: "M0,-1 L-3.5,7 M0,-1 L3.5,7 M-2.2,4 L2.2,4" }), h("circle", { cy: -2.5, r: 1.3, fill: color || "var(--ink)" }), h("path", { d: "M-3.6,-5.6 Q-5.4,-2.5 -3.6,0.6 M3.6,-5.6 Q5.4,-2.5 3.6,0.6" }));
    case "warn": return g(h("path", { d: "M0,-6.5 L7,6 L-7,6 Z" }), h("path", { d: "M0,-2 L0,2" }), h("circle", { cy: 4, r: 0.4, fill: color || "var(--ink)" }));
    case "flask": return g(h("path", { d: "M-2.5,-7 L2.5,-7 M-1.5,-7 L-1.5,-2 L-6,6 L6,6 L1.5,-2 L1.5,-7 M-4,2.5 L4,2.5" }));
    case "noeye": return g(h("path", { d: "M-7,0 Q0,-6 7,0 Q0,6 -7,0 Z M-6,6 L6,-6" }));
    case "dash": return g(h("circle", { r: 6 }), h("path", { d: "M-3,0 L3,0" }));
    case "nosignal": return g(h("path", { d: "M-3.6,-5.6 Q-5.4,-2.5 -3.6,0.6 M3.6,-5.6 Q5.4,-2.5 3.6,0.6 M-6,6 L6,-6" }), h("circle", { cy: -2.5, r: 1.3, fill: color || "var(--ink)" }));
    case "moon": return g(h("path", { d: "M2.5,-6.2 A6.5,6.5 0 1 0 6.2,2.5 A5,5 0 0 1 2.5,-6.2 Z" }));
    case "sunline": return g(h("circle", { r: 3 }), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return h("line", { key: i, x1: 5 * Math.cos(a), y1: 5 * Math.sin(a), x2: 6.8 * Math.cos(a), y2: 6.8 * Math.sin(a) }); }));
    case "down": return g(h("path", { d: "M-4,-2 L0,2 L4,-2" }));
    case "up": return g(h("path", { d: "M-4,2 L0,-2 L4,2" }));
    case "palette": return g(h("path", { d: "M0,-6.5 C-4,-6.5 -6.5,-3.5 -6.5,0 C-6.5,4 -3.5,6.5 0,6.5 C1.5,6.5 1.5,4.5 0.5,4 C-0.5,3.2 0.3,1.8 1.8,1.8 L3.5,1.8 C5.3,1.8 6.5,0.5 6.5,-1 C6.5,-4 3.5,-6.5 0,-6.5 Z" }), ...[[-3, -1], [-1, -4], [2.5, -3.5]].map(([cx, cy], i) => h("circle", { key: i, cx, cy, r: 0.6, fill: color || "var(--ink)" })));
    default: return g(h("circle", { cx: -1, cy: -1, r: 4 }), h("line", { x1: 2, y1: 2, x2: 6, y2: 6 }));
  }
}
// An icon for the panels: the same SVG glyphs as the scene, in the current text colour.
function Ico({ kind, size = 18, sx }) {
  return h(Box, { component: "svg", viewBox: "-8 -8 16 16", width: size, height: size, "aria-hidden": "true", focusable: "false", className: "ico",
    sx: (t) => ({ ...sceneVars(t), flex: "none", display: "inline-block", verticalAlign: "middle", overflow: "visible", ...(sx || {}) }) }, h(Glyph, { kind, x: 0, y: 0, s: 1, color: "currentColor" }));
}
function Label({ r, V, FS, sel, F }) {   // name, battery and the action in words, just outside the rock (kept inside the frame)
  const rk = V.rocks[r.rock], a = V.xy(r, 0).a, out = rk.R + 40 * Math.min(FS, 1.5);
  let x = rk.x + out * Math.cos(a), y = rk.y + out * Math.sin(a); let anchor = Math.cos(a) > 0.35 ? "start" : Math.cos(a) < -0.35 ? "end" : "middle";
  const wTxt = Math.max(r.status.length * 6.6, (r.name.length + 6) * 8.2) * FS, lo = F.x + 6, hi = F.x + F.w - 6;
  let left = anchor === "start" ? x : anchor === "end" ? x - wTxt : x - wTxt / 2;
  if (left < lo || left + wTxt > hi) {   // no room beside the spider: put the words above (or below) it instead
    const p = V.xy(r, 0); anchor = "middle"; x = Math.max(lo + wTxt / 2, Math.min(hi - wTxt / 2, p.x));
    y = p.y + (Math.sin(a) < 0.2 ? -46 * FS : 62 * FS); left = x - wTxt / 2;
  }
  y = Math.max(F.y + 36 * FS, Math.min(F.y + F.h - 16 * FS, y));
  const bat = FME(`robots.${r.id}.battery`);
  return h("g", { className: "label", "data-robot": r.id, style: { pointerEvents: "none" } },
    h(Glyph, { kind: STATUS_SVG[r.status] || "look", x, y: y - 24 * FS, s: Math.min(FS, 1.6), color: r.dead ? "var(--faint)" : undefined }),
    h("text", { x, y: y - 4 * FS, textAnchor: anchor, style: { font: `600 ${(12.5 * FS).toFixed(1)}px ${MONO}`, letterSpacing: ".06em", fill: sel ? "var(--accent)" : "var(--ink)" } }, `${r.name} · ${typeof bat === "number" ? Math.round(bat) : "—"}%`),
    h("text", { x, y: y + 13 * FS, textAnchor: anchor, className: "status", style: { font: `italic ${(14 * FS).toFixed(1)}px ${SERIF}`, fill: r.dead ? "var(--err)" : "var(--muted)" } }, r.status));
}
// The scene keeps a readable on-screen text size (FS), and on narrow screens frames the two rocks more closely.
const FRAME_WIDE = { x: 10, y: 35, w: 990, h: 525 }, FRAME_NARROW = { x: 200, y: 45, w: 795, h: 505 };
function useFrame() {
  const ref = React.useRef(null); const [st, setSt] = React.useState({ FS: 1, F: FRAME_WIDE });
  React.useLayoutEffect(() => { const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => { const b = el.getBoundingClientRect(), w = b.width || 1000, hh = b.height || 540; const F = w < 600 ? FRAME_NARROW : FRAME_WIDE;
      const scale = Math.min(w / F.w, hh / F.h) || 1; setSt({ FS: Math.max(1, Math.min(2.4, 0.95 / scale)), F }); });
    ro.observe(el); return () => ro.disconnect(); }, [!!W]);
  return [ref, st.FS, st.F];
}
const svgPoint = (svg, e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
function Scene(p) {
  useStore(frame); const { sel, obj, focus } = useStore(ui); const [ref, FS, F] = useFrame(); const drag = React.useRef(null);
  if (!W) return h(Box, { sx: { height: "100%", display: "grid", placeItems: "center", fontFamily: SERIF, fontStyle: "italic", color: "text.secondary" } }, "…");
  const f = ui.state.running ? Math.min(1, acc) : 1, V = view(f), tf = W.t - 1 + f;
  const A = V.rocks[1], B = V.rocks[2];
  const pairs = [];
  for (let i = 0; i < W.robots.length; i++) for (let j = i + 1; j < W.robots.length; j++) { const a = W.robots[i], b = W.robots[j]; pairs.push({ a, b, l: M.radio(W, a, b) }); }
  const cross = pairs.filter((x) => !x.l.same), best = cross.find((x) => x.l.ok) || [...cross].sort((x, y) => x.l.d - y.l.d)[0];
  const dAB = Math.hypot(B.x - A.x, B.y - A.y) || 1, gapAt = A.R + (dAB - A.R - B.R) / 2;
  const mid = { x: A.x + ((B.x - A.x) / dAB) * gapAt, y: A.y + ((B.y - A.y) / dAB) * gapAt };   // the middle of the gap between the rocks
  const onDown = (e) => { const q = svgPoint(ref.current, e); drag.current = { x: q.x, y: q.y, moved: 0, dx: q.x - B.x, dy: q.y - B.y }; e.currentTarget.setPointerCapture?.(e.pointerId); e.stopPropagation(); };
  const onMove = (e) => { const d = drag.current; if (!d) return; const q = svgPoint(ref.current, e); d.moved = Math.max(d.moved, Math.hypot(q.x - d.x, q.y - d.y));
    if (d.moved > 4) { let x = Math.max(560, Math.min(950, q.x - d.dx)), y = Math.max(70, Math.min(540, q.y - d.dy)); const dd = Math.hypot(x - A.x, y - A.y); if (dd < 235) { x = A.x + ((x - A.x) * 235) / dd; y = A.y + ((y - A.y) * 235) / dd; }
      M.moveRockNow(W, 2, { x, y }); const rb = W.rocks[1]; rb._x0 = x; rb._y0 = y; frame.set(); } };
  const onUp = () => { const d = drag.current; drag.current = null; if (d && d.moved <= 4) act.object("rock"); else if (d) interact(); };
  const label = (x, y, t, sz = 12, col = "var(--muted)", it = true, extra = {}) => h("text", { x, y, textAnchor: "middle", ...extra, style: { font: `${it ? "italic " : "500 "}${(sz * FS).toFixed(1)}px ${it ? SERIF : MONO}`, fill: col, pointerEvents: "none", letterSpacing: it ? 0 : ".14em" } }, t);
  const rockG = (rk) => {
    const sa = M.sunAngle(rk), p1 = [rk.x + rk.R * Math.cos(sa - Math.PI / 2), rk.y + rk.R * Math.sin(sa - Math.PI / 2)], p2 = [rk.x + rk.R * Math.cos(sa + Math.PI / 2), rk.y + rk.R * Math.sin(sa + Math.PI / 2)];
    const isB = rk.id === 2;
    return h("g", { key: `rock${rk.id}`, className: "rock", "data-rock": rk.id },
      h("circle", { cx: rk.x, cy: rk.y, r: rk.R, fill: "var(--night)" }),
      h("path", { d: `M${p1[0]},${p1[1]} A${rk.R},${rk.R} 0 0 1 ${p2[0]},${p2[1]} Z`, fill: "var(--day)" }),
      !isB ? h("circle", { className: "pick-rock", cx: rk.x, cy: rk.y, r: rk.R, fill: "transparent", style: { cursor: "pointer" }, onClick: () => act.focus("rock:1"),
        role: "button", tabIndex: 0, "aria-label": "B 612: tap it to select it", onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act.focus("rock:1"); } } }) : null,
      isB ? h("circle", { className: "drag-rock", cx: rk.x, cy: rk.y, r: rk.R, fill: "transparent", style: { cursor: "grab", touchAction: "none" }, onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
        role: "button", tabIndex: 0, "aria-label": "B 325: drag it to move it; tap it to see what it means to each spider", onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act.object("rock"); } } }) : null,
      ...rk.spots.map((s) => { const c = ICE_POS(rk, s), known = W.robots.some((r) => r.known.has(s.id)), a = (c.a * 180) / Math.PI + 90;
        return h("g", { key: s.id, className: "ice", "data-spot": s.id, role: "button", tabIndex: 0, "aria-label": "Ice in a crater. What does it mean to each spider?", style: { cursor: "pointer" },
          onClick: (e) => { e.stopPropagation(); act.object("ice"); }, onPointerDown: (e) => e.stopPropagation() },
          h("ellipse", { cx: c.x, cy: c.y, rx: rk.R * 0.17, ry: rk.R * 0.09, transform: `rotate(${a} ${c.x} ${c.y})`, fill: "none", stroke: "var(--faint)", strokeWidth: 1 }),
          s.left > 0 ? h(Glyph, { kind: "ice", x: c.x, y: c.y, s: 0.5 + 0.12 * s.left, color: "var(--ice)" }) : null,
          s.left > 0 && !known ? h("circle", { cx: c.x, cy: c.y, r: 8, fill: "var(--bg)", opacity: 0.55 }) : null,
          focus === "object:ice" ? h("circle", { className: "focus-ring", cx: c.x, cy: c.y, r: 12, fill: "none", stroke: "var(--accent)", strokeWidth: 1.6, strokeDasharray: "3 2" }) : null,
          h("circle", { cx: c.x, cy: c.y, r: 13, fill: "transparent" })); }),
      W.flower && rk.id === W.flower.rock ? h(FlowerG, { rk, FS, focus }) : null,
      h("circle", { cx: rk.x, cy: rk.y, r: rk.R, fill: "none", stroke: focus === `rock:${rk.id}` ? "var(--accent)" : "var(--ink)", strokeWidth: focus === `rock:${rk.id}` ? 2.4 : 1.2, opacity: 0.85, style: { pointerEvents: "none" } }),
      label(rk.x, rk.y + 4, rk.name, 10, "var(--faint)", false));
  };
  const posOf = (id) => V.xy(robot(id), 8);
  const dots = W.packets.map((pk, i) => {
    const to = posOf(pk.to), u = Math.max(0, Math.min(1, (tf - pk.sentAt) / (pk.arriveAt - pk.sentAt)));
    const x = lerp(pk.x0, to.x, u), y = lerp(pk.y0, to.y, u), sz = 8 * Math.min(FS, 1.8), tip = pk.kind === "tip", c = tip ? "var(--ice)" : "var(--link)";
    return h("g", { key: `m${i}`, className: `msg msg-${pk.kind}`, style: { pointerEvents: "none" } },
      h("line", { x1: lerp(pk.x0, to.x, Math.max(0, u - 0.18)), y1: lerp(pk.y0, to.y, Math.max(0, u - 0.18)), x2: x, y2: y, stroke: c, strokeWidth: sz * 0.3, strokeLinecap: "round", opacity: 0.35 }),
      h("circle", { cx: x, cy: y, r: sz * 1.25, fill: c, opacity: 0.18 }),
      tip ? h("rect", { x: x - sz / 2, y: y - sz / 2, width: sz, height: sz, transform: `rotate(45 ${x} ${y})`, fill: c }) : h("circle", { cx: x, cy: y, r: sz * 0.55, fill: c }));
  });
  const marks = W.events.filter((e) => tf - e.t < 8 && tf >= e.t - 1).map((e, i) => {
    const age = Math.max(0, tf - e.t), o = Math.max(0, 1 - age / 8);
    if (e.kind === "lost") return h("g", { key: `e${i}`, className: "lost", opacity: o, style: { pointerEvents: "none" } },
      h("path", { d: `M${e.x - 5},${e.y - 5} L${e.x + 5},${e.y + 5} M${e.x + 5},${e.y - 5} L${e.x - 5},${e.y + 5}`, stroke: "var(--err)", strokeWidth: 1.5 }), label(e.x, e.y - 10 * FS, "lost", 12, "var(--err)"));
    if (e.kind === "delivered") return h("circle", { key: `e${i}`, cx: e.x, cy: e.y, r: 6 + age * 3, fill: "none", stroke: "var(--link)", strokeWidth: 1, opacity: o * 0.8, style: { pointerEvents: "none" } });
    if (e.kind === "send") return h("circle", { key: `e${i}`, cx: e.x, cy: e.y, r: 4 + age * 9, fill: "none", stroke: "var(--link)", strokeWidth: 0.8, opacity: o * 0.5, style: { pointerEvents: "none" } });
    return null;
  });
  const selR = robot(sel), sp = selR ? V.xy(selR, 6) : null;
  const c = W.comet, cf = c.on ? (c._on0 ? { x: lerp(c._x0, c.x, f), y: lerp(c._y0, c.y, f) } : { x: c.x, y: c.y }) : null;
  const tail = cf ? (() => { const L = Math.hypot(c.dx || 1, c.dy || 1) || 1; return { x: cf.x - ((c.dx || 1) / L) * 70, y: cf.y - ((c.dy || 1) / L) * 70 }; })() : null;
  return h(Box, { component: "svg", id: "scene", ref, viewBox: `${F.x} ${F.y} ${F.w} ${F.h}`, preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "Two small rocks in the void with three spider robots, the Sun far to the left",
    "data-gui-node-id": p["data-gui-node-id"], sx: (t) => ({ ...sceneVars(t), display: "block", width: "100%", height: "100%", userSelect: "none" }) },
    h("defs", null, h("radialGradient", { id: "sunglow" }, h("stop", { offset: "0%", stopColor: "var(--sun)", stopOpacity: 0.5 }), h("stop", { offset: "100%", stopColor: "var(--sun)", stopOpacity: 0 })),
      cf ? h("linearGradient", { id: "tail", gradientUnits: "userSpaceOnUse", x1: cf.x, y1: cf.y, x2: tail.x, y2: tail.y }, h("stop", { offset: "0%", stopColor: "var(--ice)", stopOpacity: 0.8 }), h("stop", { offset: "100%", stopColor: "var(--ice)", stopOpacity: 0 })) : null),
    ...STARS.map(([x, y, r, o], i) => h("circle", { key: `s${i}`, cx: x, cy: y, r, fill: "var(--ink)", opacity: o })),
    h("circle", { cx: M.SUN.x, cy: M.SUN.y, r: 170, fill: "url(#sunglow)" }),
    h("circle", { cx: M.SUN.x, cy: M.SUN.y, r: 70, fill: "var(--sun)", opacity: 0.85 }),
    F === FRAME_NARROW ? label(F.x + 30 * FS, M.SUN.y + 4, "← SUN", 10.5, "var(--sun)", false) : label(68, M.SUN.y + 100, "SUN", 10.5, "var(--muted)", false),
    sp ? h("circle", { className: "range-ring", cx: sp.x, cy: sp.y, r: M.RANGE, fill: "none", stroke: "var(--accent)", strokeWidth: 0.8, strokeDasharray: "1 7", opacity: 0.35, style: { pointerEvents: "none" } }) : null,
    ...pairs.filter((x) => x.l.ok).map(({ a, b, l }) => { const p1 = V.xy(a, 8), p2 = V.xy(b, 8); return h("line", { key: `r${a.id}${b.id}`, className: l.same ? "radio-same" : "radio-cross", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: "var(--link)", strokeWidth: 1, strokeDasharray: "2 6", opacity: l.same ? 0.3 : 0.6, style: { pointerEvents: "none" } }); }),
    best ? h("g", { id: "radio-status", "data-why": best.l.ok ? "in range" : best.l.why, style: { pointerEvents: "none" } },
      best.l.ok ? label(mid.x, mid.y - 4 * FS, "in range: they can talk", 12, "var(--link)")
        : [label(mid.x, mid.y - 6 * FS, best.l.why, 13, "var(--err)", true, { key: "a" }), label(mid.x, mid.y + 12 * FS, "they cannot hear each other", 11, "var(--faint)", true, { key: "b" })]) : null,
    rockG(A), rockG(B),
    cf ? h("g", { className: "comet", role: "button", tabIndex: 0, "aria-label": "A comet. What does it mean to each spider?", style: { cursor: "pointer" }, onClick: () => act.object("comet") },
      h("path", { d: `M${cf.x},${cf.y} L${tail.x},${tail.y}`, stroke: "url(#tail)", strokeWidth: 5, strokeLinecap: "round" }),
      h("circle", { cx: cf.x, cy: cf.y, r: 4.5, fill: "var(--ice)", stroke: focus === "object:comet" ? "var(--accent)" : "none", strokeWidth: 2 }), h("circle", { cx: cf.x, cy: cf.y, r: 22, fill: "transparent" }),
      label(cf.x + 26, cf.y - 12, "comet", 12, "var(--muted)")) : null,
    ...W.robots.map((r) => h(Intent, { key: `i${r.id}`, r, V, FS })),
    ...W.robots.map((r) => { const q = V.xy(r, 6); return h("g", { key: `g${r.id}`, className: "spider", "data-robot": r.id, role: "button", tabIndex: 0, "aria-label": `${r.name}: ${r.status}. Open its dashboard.`, style: { cursor: "pointer" },
      onClick: () => act.select(r.id), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act.select(r.id); } } },
      sel === r.id ? h("circle", { className: focus === `robot:${r.id}` ? "sel-ring focus-ring" : "sel-ring", cx: q.x, cy: q.y, r: 17 * Math.min(FS, 1.6), fill: "none", stroke: "var(--accent)", strokeWidth: focus === `robot:${r.id}` ? 2 : 1.2, strokeDasharray: "3 3" }) : null,
      h(Spider, { r, V, FS, sel: sel === r.id }), h("circle", { cx: q.x, cy: q.y, r: 24, fill: "transparent" })); }),
    ...W.robots.map((r) => h(Label, { key: `l${r.id}`, r, V, FS, F, sel: sel === r.id })),
    ...dots, ...marks,
    h("text", { x: F.x + F.w / 2, y: F.y + 8 + 12 * FS, textAnchor: "middle", style: { font: `500 ${(11 * FS).toFixed(1)}px ${MONO}`, letterSpacing: ".12em", fill: "var(--muted)" } }, clock(W.t).toUpperCase()),
    F === FRAME_NARROW ? null : h("text", { x: F.x + F.w / 2, y: F.y + 8 + 29 * FS, textAnchor: "middle", style: { font: `italic ${(12.5 * FS).toFixed(1)}px ${SERIF}`, fill: "var(--faint)" } }, "a simulation: nobody drives them"));
}

// ── passage (main column, under the scene) ──
function Passage(p) {   // a compact card under the scene: the story, one passage at a time
  const { step } = useStore(ui); useStore(tick); const ps = PASSAGES[step];
  const btn = { fontFamily: MONO, fontSize: 10.5, textTransform: "none", lineHeight: 1.3, py: .4 };
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "passage", sx: { px: { xs: 1.25, md: 2 }, pt: { xs: .75, md: 1 }, pb: { xs: 1.25, md: 1.5 } } },
    h(Box, { id: "passage-card", sx: { maxWidth: 900, mx: "auto", border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", px: { xs: 1.5, md: 2 }, py: { xs: 1.1, md: 1.25 } } },
      h(Box, { sx: { display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap", mb: .5 } },
        h(Typography, { component: "h1", id: "page-title", sx: { fontFamily: SERIF, fontWeight: 400, fontSize: 13, letterSpacing: ".03em", lineHeight: 1.2, m: 0, color: "text.secondary", mr: .5 } }, "Autonomous Robotics in Space"),
        h(Box, { id: "passage-steps", role: "tablist", "aria-label": "Passages", sx: { display: "flex", gap: .25 } },
          ...Array.from({ length: STEPS }, (_, i) => i + 1).map((i) => h(Button, { key: i, role: "tab", "aria-selected": i === step, title: PASSAGES[i].title, onClick: () => ui.set({ step: i }), size: "small",
            sx: { minWidth: 24, width: 24, height: 22, p: 0, fontFamily: SERIF, fontSize: 11.5, color: i === step ? "primary.main" : "text.secondary", borderBottom: 1, borderColor: i === step ? "primary.main" : "transparent", borderRadius: 0 } }, ROMAN[i]))),
        h(Box, { sx: { ml: "auto", display: "flex", gap: .5 } },
          h(Button, { id: "btn-back", size: "small", disabled: step <= 1, onClick: () => ui.set({ step: step - 1 }), sx: { ...btn, minWidth: 0 } }, "Back"),
          h(Button, { id: "btn-next", size: "small", variant: "outlined", onClick: () => ui.set({ step: step >= STEPS ? 1 : step + 1 }), sx: { ...btn, minWidth: 0 } }, step >= STEPS ? "From the start" : "Next"))),
      h(Typography, { component: "h2", id: "passage-title", sx: { fontFamily: SERIF, fontWeight: 400, fontStyle: "italic", fontSize: { xs: 17, md: 18 }, lineHeight: 1.2, m: 0, mb: .4, color: "text.primary" } }, `${ROMAN[step]}. ${ps.title}`),
      h(Typography, { component: "p", id: "passage-body", sx: { fontFamily: SERIF, fontSize: { xs: 13.5, md: 14 }, lineHeight: 1.45, color: "text.primary", m: 0 } }, ...storyText(ps)),
      h(StoryCode, { act: step }),
      h(Box, { sx: { display: "flex", alignItems: "center", gap: .75, mt: .75, flexWrap: "wrap" } },
        ...ps.tries.map(([label, fn], i) => h(Button, { key: i, className: "try", variant: "contained", disableElevation: true, size: "small", disabled: !W, onClick: fn, sx: btn }, label)))));
}

// The act's prose; an optional link on its first occurrence of link.text (e.g. ".me kernel" → the .me docs)
function storyText(ps) {
  const L = ps.link, i = L ? ps.text.indexOf(L.text) : -1; if (i < 0) return [ps.text];
  return [ps.text.slice(0, i), h(Link, { key: "l", id: "story-link", href: L.href, underline: "always", onClick: (e) => e.stopPropagation(), onPointerDown: (e) => e.stopPropagation(),
    sx: { color: "primary.main", fontWeight: 600, textUnderlineOffset: "3px", textDecorationColor: (t) => alpha(t.palette.primary.main, 0.5), "&:hover": { textDecorationColor: "currentColor" } } }, L.text), ps.text.slice(i + L.text.length)];
}
// The act's .me lines, grouped by the kernel they run in. A fixed line is the code that kernel ran when it was set
// up; a live line is the latest write to that path in that kernel, exactly as it was made (with k, in act VII).
// A message line (acts IV-VI) expands into that message's real writes, by id (M.expandLines).
const kernelLabel = (who) => (who === "all" ? "every kernel" : `${M.NAME[who]}'s kernel`);
function StoryCode({ act: n }) {
  const story = M.STORY[n]; if (!story) return null;
  const line = (who, ln, i) => {
    const L = typeof ln === "string" ? { code: ln } : ln, k = W && who !== "all" ? robot(who).k : null;
    const x = L.live && k ? k.last[L.live] : null, code = L.code || x?.code;
    if (!code) return L.none === "" ? null : h(Box, { key: i, className: "story-none", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 12.5, color: "text.disabled" } }, L.none || "not written yet");
    return h(Box, { key: i, className: "story-line", "data-live": L.live || undefined, sx: { fontSize: { xs: 10.5, md: 11 }, lineHeight: 1.5, py: "1px" } },
      h(MeCode, { code, ctx: who === "all" ? undefined : who }),
      L.value ? h(Box, { component: "span", className: "me-code", sx: { fontFamily: MONO, ml: .75, whiteSpace: "nowrap" } }, h("span", { className: "mes-arrow" }, "→ "), h(MeVal, { path: L.value, syn: true, d: 2 })) : null,
      L.k && x ? h(Box, { component: "span", sx: { fontFamily: MONO, ml: .75, color: "warning.main", whiteSpace: "nowrap" } }, `k=${x.k}`) : null);
  };
  return h(Box, { id: "story-code", "data-act": n, sx: { mt: .75, display: "grid", gap: { xs: .75, md: 1 }, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fit, minmax(240px, 1fr))" } } },
    ...story.groups.map((g, gi) => h(Box, { key: gi, className: "story-group", "data-who": String(g.who), sx: { minWidth: 0, borderLeft: 2, borderColor: "divider", pl: 1 } },
      h(Box, { sx: { fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "text.secondary", mb: .25 } }, kernelLabel(g.who)),
      ...(W ? M.expandLines(W, g) : g.lines).map((ln, i) => line(g.who, ln, i)))));
}

// ── aside: controls, the dashboard, what things mean, under the hood ──
const H2 = (title, right) => h(Typography, { component: "h2", sx: { fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "text.secondary", display: "flex", alignItems: "center", gap: 1, m: 0, mb: .75, flexWrap: "wrap" } }, title, right ? h(Box, { component: "span", sx: { ml: "auto", letterSpacing: "normal", textTransform: "none", fontWeight: 400 } }, right) : null);
const SECTION_SX = { px: 1.75, py: 1.5, borderBottom: 1, borderColor: "divider" };
const ROW_SX = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, py: "2px", fontFamily: MONO, fontSize: 10.5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } };
const useK = (path) => G.useMeValue(path);   // one kernel read through the page's .GUI runtime
// a kernel value on screen, bound for the headless consistency check (data-me-path / data-me-value)
const Bound = ({ path, value, children, sx, id }) => h(Box, { component: "span", id, "data-me-path": path, "data-me-value": String(value), sx }, children ?? fmt(value, 1));

function Controls(p) {
  const { running, speed } = useStore(ui); useStore(tick);
  const fps = frames.filter((t) => performance.now() - t <= 1000).length;
  const b = { fontFamily: MONO, fontSize: 11, textTransform: "none", height: 32 };
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], sx: SECTION_SX },
    h(Box, { sx: { display: "flex", gap: .75, alignItems: "center" } },
      h(Button, { id: "btn-play", variant: running ? "outlined" : "contained", disableElevation: true, disabled: !W, onClick: () => play(!running), sx: { ...b, flex: 1 } }, running ? "Pause simulation" : "Play simulation"),
      h(TextField, { id: "sel-speed", select: true, size: "small", value: String(speed), onChange: (e) => ui.set({ speed: Number(e.target.value) || 10 }), inputProps: { "aria-label": "Simulation speed (simulated minutes per real second)" }, sx: { width: 86, flexShrink: 0, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10.5, height: 32 } } },
        ...[1, 10, 30].map((s) => h(MenuItem, { key: s, value: String(s), sx: { fontFamily: MONO, fontSize: 11 } }, `×${s}`))),
      h(Button, { id: "btn-reset", variant: "outlined", disabled: !W, onClick: () => reset(), sx: { ...b, minWidth: 0, px: 1.25, color: "text.secondary", borderColor: "divider" } }, "Reset")),
    h(Typography, { component: "div", sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mt: .75 } }, W ? `${clock(W.t)} · ×${speed} = ${speed} simulated min / s · ${fps} fps` : "loading the kernels…"));
}
const levelColor = (v) => (v >= 50 ? "success" : v >= 20 ? "warning" : "error");
function BatteryGauge({ id }) {
  const path = `robots.${id}.battery`, v = useK(path), charging = useK(`robots.${id}.charging`), ld = useK(`robots.${id}.lightDist`);
  const pct = typeof v === "number" ? Math.max(0, Math.min(100, v)) : 0, lv = levelColor(pct);
  return h(Box, { id: "battery", sx: { display: "flex", alignItems: "center", gap: 2 } },
    h(Box, { component: "svg", viewBox: "0 0 132 60", "aria-hidden": "true", sx: (t) => ({ width: 132, height: 60, flexShrink: 0, "--fill": t.palette[lv].main, "--ink": t.palette.text.primary, "--bg": t.palette.background.paper }) },
      h("rect", { x: 2, y: 4, width: 116, height: 52, rx: 11, fill: "none", stroke: "var(--ink)", strokeWidth: 2.5, opacity: 0.75 }),
      h("rect", { x: 120, y: 20, width: 8, height: 20, rx: 3, fill: "var(--ink)", opacity: 0.75 }),
      h("rect", { id: "battery-fill", x: 8, y: 10, width: Math.max(0, (104 * pct) / 100), height: 40, rx: 7, fill: "var(--fill)", style: { transition: "width .25s" } }),
      charging && ld === 0 ? h("path", { d: "M64,12 L50,32 L60,32 L56,48 L72,26 L62,26 Z", fill: "var(--bg)", stroke: "var(--ink)", strokeWidth: 1.2 }) : null),
    h(Box, null,
      h(Bound, { path, value: v, id: "battery-pct", sx: { display: "block", fontSize: 46, lineHeight: 1, fontWeight: 600, fontFamily: SERIF, color: `${lv}.main` } }, `${Math.round(pct)}%`),
      h(Typography, { component: "div", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: "text.secondary", mt: .25 } }, charging && ld === 0 ? "charging in the sun" : pct >= 50 ? "plenty of battery" : pct >= 20 ? "getting low" : pct > 0 ? "very low" : "empty")));
}
const STATUS_ICON = { "going to the flower": "drop", "watering the flower": "drop", exploring: "look", "going to the sun": "sun", charging: "bolt", "going to the ice": "ice", "mining ice": "pick", "studying the ice": "flask", "studying the comet": "flask",
  "hiding from the comet dust": "shield", "turning away from the ice": "turn", asleep: "zz" };
// the action in a few plain words, for the "Doing" card
const DOING_WORDS = { exploring: "exploring its rock", "going to the sun": "walking to the sun", charging: "charging in the sun", "going to the ice": "walking to the ice", "mining ice": "mining ice",
  "studying the ice": "studying the ice", "studying the comet": "watching the comet", "hiding from the comet dust": "hiding from the comet dust", "turning away from the ice": "turning away from slippery ice", asleep: "asleep: its battery is empty",
  "going to the flower": "walking to the flower to water it", "watering the flower": "watering the flower" };
// A dashboard card: the real .me lines from that robot's kernel (M.CARDS: a rule → its value, the latest write, or
// a setup line), highlighted and clickable, with the plain words under them in dim text.
function CardLines({ r, g }) {
  const k = r.k;
  return h(React.Fragment, null, ...g.lines.map((L, i) => {
    const x = L.live ? k.last[L.live] : null, code = L.code || x?.code; if (!code) return null;
    const path = L.value || L.live, v = L.value ? FME(L.value) : x?.value;
    return h(Box, { key: i, className: "card-line", "data-live": L.live || undefined, "data-me-path": path && !x?.ptr ? pagePath(r.id, path) : undefined, "data-me-value": path && !x?.ptr ? String(v) : undefined, sx: { fontSize: 10, lineHeight: 1.45, py: "1px" } },
      h(MeCode, { code, ctx: r.id, unmarked: `robot:${r.id}`, sx: { fontSize: 10 } }),
      L.value ? h(Box, { component: "span", className: "me-code", sx: { fontFamily: MONO, ml: .5, whiteSpace: "nowrap" } }, h("span", { className: "mes-arrow" }, "→ "), h(MeVal, { path: L.value, syn: true, d: 2 })) : null); }));
}
const Card = ({ icon, label, children, words, id, color, page }) => h(Box, { id, className: "card", sx: { border: 1, borderColor: "divider", borderRadius: 2, p: 1.1, minWidth: 0, bgcolor: "background.default" } },
  h(Box, { sx: { display: "flex", alignItems: "center", gap: .75, color: "text.secondary", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600, mb: .4 } }, h(Ico, { kind: icon, size: 16 }), label,
    page ? h(Box, { component: "span", className: "page-state", title: "not a kernel fact: the simulation's own state", sx: { ml: "auto", letterSpacing: ".04em", textTransform: "none", fontWeight: 400, color: "text.disabled", fontStyle: "italic", fontFamily: SERIF, fontSize: 11 } }, "page state") : null),
  children,
  h(Box, { className: "card-words", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.3, color: color || "text.secondary", mt: .3, overflowWrap: "anywhere" } }, words));
function RobotPanel(p) {
  const { sel } = useStore(ui); useStore(tick);
  const r = robot(sel), id = sel, base = `robots.${id}`;
  if (!r) return null;
  const rd = (q) => r.k.read(q), cards = Object.fromEntries(M.CARDS(W, id).map((g) => [g.key, g]));
  const kept = (b) => rd(`${base}.${b}Kept`) ?? 0;
  const btn = { fontFamily: MONO, fontSize: 10.5, textTransform: "none", lineHeight: 1.3 };
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "robot-panel", sx: SECTION_SX },
    h(Box, { sx: { display: "flex", gap: .5, mb: 1.25 } }, ...W.robots.map((x) => h(Button, { key: x.id, className: "pick-robot", size: "small", variant: x.id === sel ? "contained" : "text", disableElevation: true, onClick: () => act.select(x.id), sx: { ...btn, flex: 1, fontSize: 12 } }, x.name))),
    h(Box, { sx: { display: "flex", alignItems: "baseline", gap: 1, mb: 1, flexWrap: "wrap" } },
      h(Typography, { component: "h2", id: "robot-name", sx: { fontFamily: SERIF, fontSize: 28, m: 0, fontWeight: 400 } }, r.name),
      h(Typography, { component: "span", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: "text.secondary" } }, `the ${r.role}, on ${M.ROCK_NAME[r.rock]}`)),
    h(BatteryGauge, { id }),
    h(Box, { id: "cards", sx: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: .75, mt: 1.5 } },
      h(Card, { id: "card-doing", icon: STATUS_ICON[r.status] || "look", label: "Doing", color: r.dead ? "error.main" : undefined, words: DOING_WORDS[r.status] || r.status }, h(CardLines, { r, g: cards.doing })),
      h(Card, { id: "card-going", icon: "go", label: "Going to", page: cards.going.page, words: r.dest }, h(CardLines, { r, g: cards.going })),
      h(Card, { id: "card-msgs", icon: "radio", label: "Messages", words: `${fmt(rd(`${base}.sent`))} sent, ${fmt(rd(`${base}.received`))} received · it keeps ${kept("outbox")} it sent and ${kept("inbox")} it received` }, h(CardLines, { r, g: cards.msgs })),
      h(Card, { id: "card-ice", icon: r.studies ? "flask" : r.slips ? "ice" : "pick", label: cards.ice.title,
        words: r.studies ? "pieces of ice it has studied" : r.slips ? "patches of ice it found (and stays away from)" : "pieces of ice it has mined" }, h(CardLines, { r, g: cards.ice }))),
    h(KnowsHeard, { r }),
    h(Box, { sx: { display: "flex", gap: .75, mt: 1.25, flexWrap: "wrap" } },
      h(Button, { id: "btn-hello", size: "small", variant: "outlined", onClick: () => act.hello(id), sx: { ...btn, flex: 1 } }, "Say hello"),
      h(Button, { id: "btn-tip", size: "small", variant: "outlined", onClick: () => act.tip(id), sx: { ...btn, flex: 1 } }, "Share an ice tip"),
      h(Button, { id: "btn-drain", size: "small", variant: "outlined", color: "warning", onClick: () => act.drain(id), sx: { ...btn, flex: 1 } }, "Drain battery")));
}
// "It knows" (its own readings) / "Inbox" / "Outbox" (its communications): the real facts in this robot's own kernel
// (M.PANEL), each the latest write to that path (k.last) exactly as it was made, with a small dimmed hint in plain
// words read from the same kernel. Messages are listed by id, newest first.
function KnowsHeard({ r }) {
  const id = r.id, k = r.k, rd = (p) => k.read(p), base = `robots.${id}`, now = rd(`${base}.now`);
  const ago = (t) => { const m = Math.max(0, Math.round(now - t)); return m === 0 ? "just now" : `${m} min ago`; };
  const what = (mb) => (rd(`${mb}.kind`) === "ice" ? "ice tip" : "hello");
  const hint = (L, v) => {
    if (L.box) {
      const mb = `${base}.${L.box}.${L.mid}`;
      switch (L.field) {
        case "from": return `from ${M.NAME[v]}, ${what(mb)}, ${ago(rd(`${mb}.at`))}`;
        case "to": return `to ${M.NAME[v]}, ${what(mb)}, ${ago(rd(`${mb}.at`))}`;
        case "battery": return L.box === "inbox" ? `${M.NAME[rd(`${mb}.from`)]} said ${v}%` : `it said ${v}%`;
        case "rock": {
          if (L.box === "outbox") return `about ${M.ROCK_NAME[v]}`;
          const why = rd(`${mb}.accepted`) ? `its rock: accepted${r.tipMsg === L.mid ? ", its plan" : ""}`
            : v !== rd(`${base}.myRock`) ? "not its rock, kept" : rd(`${mb}.got`) - rd(`${mb}.at`) > rd(`${base}.maxAge`) ? "too old, kept" : "it had a fresh tip, kept";
          return `about ${M.ROCK_NAME[v]}: ${why}`; }
        default: return "";
      }
    }
    switch (L.hint) {
      case "charge": return `of ${L.bat.capacity} Wh, the ${L.bat.name} battery`;
      case "light": return v === 0 ? "in the sun" : "in the shade";
      case "ice": return v ? "there is ice on its rock" : "no ice seen yet";
      case "comet": return v ? "a comet is close" : "no comet close";
      case "reach": return v ? "its radio reaches the other rock" : "its radio can't reach the other rock";
      case "flower": return `the water it last saw in the flower${v < rd(`${base}.thirstyBelow`) ? ": thirsty!" : ""}`;
      default: return "";
    }
  };
  const lineOf = (L, i, all) => {
    if (!L.live) return L.none ? h(Box, { key: i, className: "panel-none", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: "text.disabled", py: "1px" } }, L.none) : null;
    const x = k.last[L.live]; if (!x) return null;
    const first = L.box && i > 0 && all[i - 1].mid !== L.mid;   // a little space between two messages
    return h(Box, { key: i, className: "panel-line", "data-live": L.live, "data-msg": L.mid ?? undefined, "data-me-path": pagePath(id, L.live), "data-me-value": String(x.value), sx: { py: "1px", lineHeight: 1.45, mt: first ? .5 : 0 } },
      h(MeCode, { code: x.code, ctx: id, unmarked: `robot:${id}`, sx: { fontSize: 10, mr: .75 } }), " ",
      h(Box, { component: "span", className: "panel-hint", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 11.5, color: "text.disabled" } }, hint(L, x.value)));
  };
  return h(Box, { id: "knows-heard", sx: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.25, mt: 1.5 } },
    ...M.PANEL(id, W).map((g) => { const ls = M.expandLines(W, g);
      const kept = g.key === "knows" ? null : rd(`${base}.${g.key}Kept`);   // robots[i].inbox[] / outbox[]: the kernel counts what the box keeps
      const sub = g.key === "knows" ? g.sub : h(React.Fragment, null, g.sub, " · ", h(Box, { component: "span", className: "kept-count", "data-me-path": `${base}.${g.key}Kept`, "data-me-value": String(kept) }, `${kept ?? 0} kept`));
      return h(Box, { key: g.key, id: g.key, sx: { minWidth: 0 } }, H2(g.title, h(Box, { component: "span", sx: { fontStyle: "italic", fontFamily: SERIF, color: "text.disabled", fontSize: 11 } }, sub)),
        h(Box, { sx: { borderLeft: 2, borderColor: "divider", pl: 1 } }, ...ls.map(lineOf))); }));
}
// What does a shared object mean to each spider? One column per kernel, each read from that robot's own kernel.
const MEANINGS = {
  ice: { title: "The ice", flags: [["iceIsFuel", "something to mine", "pick"], ["iceIsHazard", "slippery: stay away", "warn"], ["iceIsSample", "a sample to study", "flask"]], none: ["objects.ice.seen", "hasn't seen any yet", "noeye"], rules: ["iceIsFuel", "iceIsHazard", "iceIsSample", "avoidIce"] },
  comet: { title: "The comet", flags: [["cometIsHazard", "dust! hide and wait", "shield"], ["cometIsSample", "something to study", "flask"]], none: ["objects.comet.near", "not close: nothing to do", "dash"], rules: ["cometIsHazard", "cometIsSample", "shelter", "watchComet"] },
  rock: { title: "The other rock", flags: [["rockInReach", "friends it can talk to", "radio"]], none: ["objects.rock.inRange", "too far to hear", "nosignal"], rules: ["rockInReach"] },
  flower: { title: "The flower", flags: [["shouldWaterFlower", "thirsty: it goes to water it", "drop"], ["flowerThirsty", "thirsty, but it is busy first", "drop"]],
    none: ["objects.flower.water", (v) => (v === undefined ? "never seen it: its rule can't decide" : "has water: nothing to do"), "flower"], rules: ["flowerThirsty", "shouldWaterFlower"] },
};
function MeaningCol({ r, objKey }) {
  const def = MEANINGS[objKey], vals = def.flags.map(([f]) => G.useMeValue(`robots.${r.id}.${f}`)), seen = G.useMeValue(`r${r.id}.${def.none[0]}`);
  const i = vals.findIndex((v) => v === true), m = i >= 0 ? def.flags[i] : null;
  const path = m ? `robots.${r.id}.${m[0]}` : `r${r.id}.${def.none[0]}`, value = m ? vals[i] : seen;
  return h(Box, { className: "meaning", "data-robot": r.id, sx: { textAlign: "center", border: 1, borderColor: m ? "primary.main" : "divider", borderRadius: 2, p: 1, minWidth: 0 } },
    h(Box, { sx: { fontFamily: MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: ".06em" } }, r.name),
    h(Box, { sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 11.5, color: "text.secondary" } }, r.role),
    h(Box, { sx: { my: .5, color: m ? "primary.main" : "text.disabled", lineHeight: 0 } }, h(Ico, { kind: m ? m[2] : def.none[2], size: 30 })),
    h(Bound, { path, value, sx: { display: "block", fontFamily: SERIF, fontSize: 14, lineHeight: 1.25, color: m ? "text.primary" : "text.secondary" } }, m ? m[1] : typeof def.none[1] === "function" ? def.none[1](value) : def.none[1]));
}
function ObjectsPanel(p) {
  const { obj } = useStore(ui); useStore(tick); if (!W) return null;
  const btn = (k, label) => h(Button, { key: k, className: "pick-object", size: "small", variant: obj === k ? "contained" : "outlined", disableElevation: true, onClick: () => act.object(k), sx: { fontFamily: MONO, fontSize: 10.5, textTransform: "none", flex: 1 } }, label);
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "objects-panel", sx: SECTION_SX },
    H2("What is it to each of them?"),
    h(Box, { sx: { display: "flex", gap: .5, mb: 1, flexWrap: "wrap" } }, btn("ice", "the ice"), btn("comet", "the comet"), btn("rock", "the other rock"), btn("flower", "the flower")),
    h(Box, { id: "meanings", "data-object": obj, sx: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: .75 } }, ...W.robots.map((r) => h(MeaningCol, { key: `${obj}${r.id}`, r, objKey: obj }))),
    h(Typography, { component: "div", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: "text.secondary", mt: .75 } }, "Same object, same rule text, three kernels: each answer is read from that spider's own kernel. Tap the ice, the comet, the flower or B 325 in the sky too."));
}
// ── under the hood (collapsed by default) ──
function Hood(p) {
  const { hood } = useStore(ui);
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "hood", sx: { ...SECTION_SX, borderBottom: 0 } },
    h(Button, { id: "btn-hood", fullWidth: true, variant: "outlined", onClick: () => ui.set({ hood: !hood }), "aria-expanded": hood ? "true" : "false",
      sx: { fontFamily: MONO, fontSize: 11, textTransform: "none", justifyContent: "space-between", color: "text.secondary", borderColor: "divider" }, endIcon: h(Ico, { kind: hood ? "up" : "down", size: 16 }) },
      hood ? "Hide the kernels" : "Under the hood: show the kernels"),
    hood ? h(Box, { id: "hood-body", sx: { mt: 1.25 } }, h(HoodObjects), h(HoodRobot), h(HoodStats), h(KernelInfo)) : null);
}
function MeVal({ path, d = 3, syn }) { const v = G.useMeValue(path); return h(Box, { component: "span", "data-me-path": path, "data-me-value": String(v), className: syn && SYN ? SYN.valueClass(v) : undefined, sx: syn && SYN ? {} : { color: v === false ? "text.secondary" : v === true ? "primary.main" : "inherit" } }, fmt(v, d)); }
const KV = (k, v, sub) => h(Box, { sx: ROW_SX, key: k }, h(Box, { component: "span", sx: { color: "text.secondary", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: sub || k }, k, sub ? h(Box, { component: "span", sx: { color: "text.disabled", ml: .75, fontSize: 9.5 } }, sub) : null), h(Box, { component: "span", sx: { color: "primary.main", textAlign: "right", whiteSpace: "nowrap" } }, v));
// Like the ContextLab steps: the script lines in each kernel, beside what they give in that kernel.
function HoodObjects() {
  const { obj } = useStore(ui); useStore(tick); if (!W) return null;
  const def = MEANINGS[obj], o = M.OBJECTS.find((x) => x.key === obj), rules = M.RULES.filter(([n]) => def.rules.includes(n));
  const line = (code, path, key, ctx) => h(Box, { key, sx: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, py: .25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
    h(MeCode, { code, ctx, sx: { fontSize: 9.5 } }), h(Box, { component: "span", className: "me-code", sx: { fontFamily: MONO, fontSize: 9.5, textAlign: "right", whiteSpace: "nowrap" } }, h("span", { className: "mes-arrow" }, "→ "), h(MeVal, { path, syn: true })));
  return h(Box, { id: "hood-objects" }, H2(`${def.title} in each kernel`, h(Box, { component: "span", sx: { fontFamily: SERIF, fontStyle: "italic" } }, "script line → value in that kernel")),
    ...W.robots.map((r) => h(Box, { key: r.id, className: "hood-kernel", sx: { mb: 1, border: 1, borderColor: "divider", borderRadius: 1, px: 1, py: .5 } },
      h(Box, { sx: { fontFamily: MONO, fontSize: 10, fontWeight: 600, mb: .25 } }, `${r.name}'s kernel · the ${r.role}`),
      ...["mines", "slips", "studies"].map((f) => line(`me.robots[${r.id}].${f}(${r[f]})`, `robots.${r.id}.${f}`, f, r.id)),
      ...o.facts.map((f) => r.k.last[f] ? line(`${r.k.last[f].code}   // its own view`, `r${r.id}.${f}`, f, r.id)
        : h(Box, { key: f, className: "no-fact", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 11.5, color: "text.disabled", py: .25 } }, `no ${f} in its kernel: it has never seen it`)),
      ...rules.map(([n, e]) => line(`me.robots["[i]"]["="]("${n}", "${e}")`, `robots.${r.id}.${n}`, n, r.id)))));
}
function HoodRobot() {
  const { sel, explain } = useStore(ui); useStore(tick); if (!W) return null;
  const r = robot(sel), base = `robots.${sel}`, lw = lastWrites.get(sel), bat = FME(`${base}.battery`);
  const facts = [...M.batteryFacts(r.bats), "thirstyBelow", "pos", "lightDist", "charging", "now", "role", "myRock", "tipRock", "tipPos", "tipAt", "sent", "received", "ice", "found", "maxAge", "costPerRad", "margin", "full"];
  const key = (f) => f.replace(/\.(\d+)\./g, "[$1].");
  // a pointer, read through: lastFrom[i] / lastTo[i] → the message, tipMsg → the tip it accepted
  const ptr = (p, label, sub) => { const t = FME(p)?.__ptr, m = t && /\.(inbox|outbox)\.(\d+)$/.exec(t), there = t && FME(`${t}.at`) != null;
    return KV(label, !t ? h(Box, { component: "span", sx: { color: "text.disabled" } }, "nothing yet (undefined)") : !there ? h(Box, { component: "span", sx: { color: "text.disabled" } }, `${m[1]}[${m[2]}] (removed)`)
      : h(Box, { component: "span" }, `${m[1]}[${m[2]}] · ${FME(`${t}.kind`)} · `, FME(`${t}.kind`) === "ice" ? `rock ${FME(`${t}.rock`)}` : `${FME(`${t}.battery`)}%`, ` · at ${FME(`${t}.at`)}`), sub); };
  return h(Box, { id: "hood-robot", sx: { mt: 1.5 } },
    H2(`${r.name}'s kernel`, h(MeCode, { code: `me.robots[${sel}]`, ctx: sel, sx: { fontSize: 9.5 } })),
    h(Box, null, ...facts.map((f) => KV(key(f), h(MeVal, { path: `${base}.${f}` })))),
    ...M.IDS.filter((i) => i !== sel).flatMap((i) => [ptr(`${base}.lastFrom.${i}`, `lastFrom[${i}] →`, `the latest from ${M.NAME[i]}`), ptr(`${base}.lastTo.${i}`, `lastTo[${i}] →`, `the latest to ${M.NAME[i]}`)]),
    ptr(`${base}.tipMsg`, "tipMsg →", "the tip it accepted"),
    KV("inbox · outbox", `${M.msgIds(r, "inbox").map((x) => `[${x}]`).join(" ") || "—"} · ${M.msgIds(r, "outbox").map((x) => `[${x}]`).join(" ") || "—"}`, `the last ${M.KEEP} per peer`),
    KV("home →", h(Box, { component: "span" }, `${FME(`${base}.home.name`)} · radius ${FME(`${base}.home.radius`)}`), "pointer, read through"),
    h(Box, { sx: { mt: 1 } }, H2("Rules (the same text in every kernel)"),
      ...M.RULES.map(([n, e]) => h(Box, { key: n, className: "rule", sx: { ...ROW_SX, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }, onClick: () => ui.set({ explain: n }), title: `explain ${n}` },
        h(Box, { component: "span", sx: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: explain === n ? "primary.main" : "text.secondary" } }, n, h(MeCode, { code: e, sx: { ml: .75, fontSize: 9.5, whiteSpace: "nowrap", opacity: .85 } })),
        h(Box, { component: "span", sx: { textAlign: "right" } }, h(MeVal, { path: `${base}.${n}` })))),
      H2("Its inbox rule (computed on each message it receives)"),
      h(Box, { className: "rule", id: "inbox-rule", sx: { ...ROW_SX, gridTemplateColumns: "minmax(0, 1fr)", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }, onClick: () => ui.set({ explain: "inbox" }), title: "explain acceptTip on its newest ice tip" },
        h(MeCode, { code: M.inboxRuleCode(sel), ctx: sel, sx: { fontSize: 9.5, color: explain === "inbox" ? "primary.main" : undefined } }))),
    h(Box, { sx: { mt: 1 } }, H2(`Battery (measures its ${r.bats.length} batteries: ${r.bats.map((b) => `${b.capacity} Wh`).join(" + ")})`),
      h(Box, { sx: { display: "flex", gap: .5, mb: .5 } },
        h(Button, { id: "btn-add-battery", size: "small", variant: "outlined", disabled: r.bats.some((b) => b.i === M.EXTRA_BATTERY.i), onClick: () => act.addBattery(sel), sx: { fontFamily: MONO, fontSize: 10, textTransform: "none", flex: 1 } }, `Plug in a ${M.EXTRA_BATTERY.capacity} Wh battery`),
        h(Button, { id: "btn-swap-battery", size: "small", variant: "outlined", disabled: !r.bats.some((b) => b.i === 2), onClick: () => act.swapBattery(sel), sx: { fontFamily: MONO, fontSize: 10, textTransform: "none", flex: 1 } }, "Swap the spare (50 Wh)"),
        h(Button, { id: "btn-remove-battery", size: "small", variant: "outlined", disabled: r.bats.length < 2, onClick: () => act.removeBattery(sel), sx: { fontFamily: MONO, fontSize: 10, textTransform: "none", flex: 1 } }, "Take the last one out")),
      Slider ? h(Slider, { id: "battery-slider", size: "small", min: 0, max: 100, step: 1, value: Math.max(0, Math.min(100, Math.round(typeof bat === "number" ? bat : 0))), onChange: (e, v) => act.battery(sel, v), "aria-label": `${r.name} battery`, sx: { mx: 1, width: "calc(100% - 16px)" } })
        : h("input", { id: "battery-slider", type: "range", min: 0, max: 100, value: Math.round(bat || 0), onChange: (e) => act.battery(sel, Number(e.target.value)), style: { width: "100%" } })),
    h(ExplainView, { path: explainPath(r, explain) }),
    h(Box, { sx: { mt: 1.25 } }, H2("Last writes", lw ? h("span", null, `${lw.manual ? "your write" : "control step"} · ${clock(lw.t)}`) : null),
      h(Box, { component: "ul", id: "writes", sx: { listStyle: "none", m: 0, p: 0, fontFamily: MONO, fontSize: 9.5, minHeight: 40 } },
        ...(lw ? lw.batch.slice(-7).map((x, i) => h(Box, { component: "li", key: i, sx: { py: .25, borderBottom: 1, borderColor: "divider", overflowWrap: "anywhere", "&:last-of-type": { borderBottom: 0 } } },
          h(MeCode, { code: x.code, ctx: sel, sx: { fontSize: 9.5 } }), h(Box, { component: "span", sx: { color: "warning.main", ml: .75 } }, `k=${x.k}`), h(Box, { component: "span", sx: { color: "text.disabled", ml: .75 } }, `${x.us.toFixed(0)} µs`)))
          : [h(Box, { component: "li", key: "e", sx: { color: "text.disabled" } }, "No writes yet: play the simulation.")]))));
}
// what explain() shows: a rule of the robot, or ("inbox") acceptTip on the newest ice tip its inbox keeps
function explainPath(r, explain) {
  const base = `robots.${r.id}`; if (explain !== "inbox") return `${base}.${explain}`;
  const ids = M.msgIds(r, "inbox"), id = ids.find((x) => FME(`${base}.inbox.${x}.kind`) === "ice") ?? ids[0];
  return id != null ? `${base}.inbox.${id}.acceptTip` : `${base}.tipFresh`;
}
function HoodStats() {
  useStore(tick); if (!W) return null;
  const avg = stepMs.length ? stepMs.reduce((a, b) => a + b, 0) / stepMs.length : 0, fps = frames.filter((t) => performance.now() - t <= 1000).length;
  return h(Box, { id: "hood-stats", sx: { mt: 1.5, fontFamily: MONO, fontSize: 9.5, color: "text.secondary", lineHeight: 1.6 } }, H2("The simulation"),
    `${fps} fps · step ${avg.toFixed(2)} ms (3 kernels) · ${wstat.n} writes · ${(wstat.us / (wstat.n || 1)).toFixed(0)} µs per write · k avg ${(wstat.k / (wstat.n || 1)).toFixed(2)}, max ${wstat.kMax}`, h("br"),
    `messages: ${W.delivered} arrived · ${W.lost} lost on the way · ${W.packets.length} in flight · ${W.unheard} times nobody across the void could hear (counted by the simulation; the robots do not know it)`);
}
function ExplainView({ path }) {
  useStore(tick);
  let ex = null, err = null; try { ex = FME.explain(path); } catch (e) { err = e?.message || String(e); }
  if (err || !ex) return h(Typography, { sx: { fontFamily: MONO, fontSize: 9.5, color: "error.main" } }, "explain failed: " + (err || "no result"));
  const m = ex.meta || {}, em = (s) => h(Box, { component: "span", sx: { color: "primary.main" } }, s);
  const rows = [["value", em(fmt(ex.value, 4))], ["expression", ex.expr != null ? h(MeCode, { code: ex.expr, sx: { fontSize: 9.5 } }) : "— (fact)"],
    ["inputs", (ex.derivation?.inputs || []).length ? ex.derivation.inputs.map((i, j) => h(Box, { component: "span", key: j, sx: { display: "block" } }, `${i.label} = `, em(fmt(i.value, 4)))) : "—"],
    ["last wave", m.sourcePath ? h(React.Fragment, null, "write to ", em(m.sourcePath), ` · k = ${m.k} · recomputed: ${(m.recomputed || []).map((x) => x.split(".").pop()).join(", ")}`) : "not recomputed since the seed"]];
  return h(Box, { id: "explain", sx: { mt: 1.25 } }, H2(`explain()`, h(MeCode, { code: `me.explain("${path}")`, ctx: Number(path.split(".")[1]) || undefined, sx: { fontSize: 9.5 } })),
    h(Box, { sx: { fontFamily: MONO, fontSize: 9.5, lineHeight: 1.5, border: 1, borderColor: "divider", borderRadius: "4px", px: 1, py: .5 } },
      ...rows.map(([l, v]) => h(Box, { key: l, sx: { display: "grid", gridTemplateColumns: "70px minmax(0, 1fr)", gap: .5, py: .25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
        h(Box, { component: "span", sx: { color: "text.disabled" } }, l), h(Box, { component: "span", className: `ex-${l.replace(" ", "-")}`, sx: { wordBreak: "break-word", minWidth: 0 } }, v)))));
}
function KernelInfo() {
  const { kernel, gui, verify } = useStore(ui);
  const a = (href, text, title) => h(Link, { href, target: "_blank", rel: "noopener", underline: "hover", title, sx: { color: "primary.main" } }, text);
  const row = (k, v) => h(Box, { key: k, sx: { display: "grid", gridTemplateColumns: "58px minmax(0, 1fr)", gap: .75, py: .5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } }, h(Box, { component: "span", sx: { color: "text.disabled" } }, k), h(Box, { component: "span", sx: { minWidth: 0, overflowWrap: "anywhere" } }, v));
  return h(Box, { id: "kernel-info", sx: { mt: 1.5, fontFamily: MONO, fontSize: 9.5, lineHeight: 1.45, color: "text.secondary" } },
    H2("Source"),
    row("kernel", kernel.state === "ok" ? h(React.Fragment, null, h("b", null, KERNEL.label), ` · ${KERNEL.build} · sha256 ${kernel.hash.slice(0, 12)}… `, h("b", null, "verified in this browser"))
      : kernel.state === "error" ? h(Box, { component: "span", sx: { color: "error.main" } }, kernel.text) : "verifying…"),
    row(".GUI", h(React.Fragment, null, a(GUI_PIN.npm, GUI_PIN.label), " · ", a(GUI_PIN.repo, "neurons-me/GUI"), ` · jsDelivr, SRI + sha256 ${GUI_PIN.sha256.slice(0, 12)}… `, gui.state === "ok" ? h("b", null, "verified") : gui.state === "error" ? h(Box, { component: "span", sx: { color: "error.main" } }, "check failed") : "checking…")),
    row("page", h(React.Fragment, null, a(SRC + "space-model.js", "space-model.js"), " (rules, model) · ", a(SRC + "space-gui.js", "space-gui.js"), " (.GUI page) · ", a(SRC + "verify.mjs", "verify.mjs"), " (Node) · ", a(BUILD_NOTES, "build notes"))),
    row("verify", h(Box, { component: "span" },
      h(Button, { id: "btn-verify", size: "small", variant: "outlined", disabled: !W, onClick: act.verify, sx: { fontFamily: MONO, fontSize: 10, textTransform: "none", py: 0, mr: 1 } }, "Verify now"),
      verify ? h(Box, { component: "span", id: "verify-out", sx: { color: verify.ok ? "success.main" : "error.main" } }, verify.ok ? `✓ ${verify.checked} checks, 0 mismatches (${clock(verify.t)}, ${verify.ms.toFixed(0)} ms): every derived value in the 3 kernels = a fresh rebuild = the rule in JS` : `✗ ${verify.mismatches.length} mismatches: ${JSON.stringify(verify.mismatches.slice(0, 3))}`) : null)));
}
// before the kernels load (and if they fail)
function KernelStatus(p) { const { kernel } = useStore(ui); return h(Box, { "data-gui-node-id": p["data-gui-node-id"], sx: { ...SECTION_SX, fontFamily: MONO, fontSize: 10, color: kernel.state === "error" ? "error.main" : "text.secondary" } }, kernel.state === "error" ? kernel.text : `verifying ${KERNEL.label} and .GUI…`); }

// ── chrome (as on the Veracruz .GUI page) ──
const LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
const GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";
const PATH_SEGMENTS = [
  { text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" },
  { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
  { text: "Robots", href: "https://neurons-me.github.io/robots/", title: "Robots" },
  { text: "Space", href: null, title: "This page" },
];
function BrandBar(p) {
  const seg = (s, i) => [i > 0 && !PATH_SEGMENTS[i - 1].text.endsWith("://") ? h(Box, { component: "span", key: `sep${i}`, sx: { color: "text.disabled", mx: .15 } }, "/") : null,
    s.href ? h(Link, { key: s.text, href: s.href, underline: "hover", title: s.title, sx: { color: "primary.main", fontFamily: MONO, fontSize: 13 } }, s.text)
      : h(Box, { component: "span", key: s.text, "aria-current": "page", sx: { color: "text.primary", fontFamily: MONO, fontSize: 13, fontWeight: 600 } }, s.text)];
  return h(Box, { component: "header", "data-gui-node-id": p["data-gui-node-id"], sx: { display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", px: 1.75, py: .85, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" } },
    h(Link, { href: "https://neurons-me.github.io/", title: "neurons.me", underline: "none", sx: { display: "inline-flex", lineHeight: 0, flexShrink: 0 } }, h("img", { src: LOGO, alt: ".me", width: 34, height: 34, style: { display: "block", objectFit: "contain" } })),
    h(Box, { component: "nav", "aria-label": "me path", sx: { display: "inline-flex", alignItems: "center", flexWrap: "wrap", minWidth: 0 } }, ...PATH_SEGMENTS.flatMap(seg)),
    h(Box, { sx: { ml: "auto", display: "inline-flex", alignItems: "center", gap: 1.25 } },
      h(Link, { href: "https://neurons-me.github.io/.me/docs/", underline: "hover", sx: { fontFamily: MONO, fontSize: 12, color: "text.secondary" } }, "Docs"),
      h(Link, { href: "https://github.com/neurons-me/.me", underline: "none", target: "_blank", rel: "noopener", title: "GitHub · neurons-me/.me", "aria-label": "GitHub", sx: { display: "inline-flex", lineHeight: 0, color: "text.secondary", "&:hover": { color: "text.primary" } } },
        h("svg", { viewBox: "0 0 16 16", width: 18, height: 18, fill: "currentColor", "aria-hidden": "true" }, h("path", { d: GITHUB_MARK }))),
      h(ThemeControls)));
}
function ThemeControls() {
  const [anchor, setAnchor] = React.useState(null); const { themeId } = G.useThemeContext(); const close = () => setAnchor(null);
  return h(Box, { sx: { display: "inline-flex", alignItems: "center", gap: .25, flexShrink: 0 } },
    h(Button, { id: "theme-picker", size: "small", variant: "outlined", "aria-label": `Theme: ${themeId}`, "aria-haspopup": "true", "aria-expanded": anchor ? "true" : "false", onClick: (e) => setAnchor(e.currentTarget),
      sx: { minWidth: 0, py: .25, px: .75, gap: .5, fontFamily: MONO, fontSize: 11, textTransform: "none", color: "text.secondary", borderColor: "divider", whiteSpace: "nowrap", "& .lbl": { display: { xs: "none", sm: "inline" } } } },
      h(Ico, { kind: "palette", size: 15 }), h(Box, { component: "span", className: "lbl" }, themeId), h(Ico, { kind: "down", size: 13 })),
    h(G.Molecules.Menu, { id: "theme-menu", anchorEl: anchor, open: !!anchor, onClose: close, anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" },
      slotProps: { list: { "aria-label": "Themes", dense: true }, paper: { sx: { width: 220, p: .5, mt: .5 } } } },
      h(G.ThemesCatalog, { sidebarView: "expanded", onThemeSelect: close })),
    h(ModeToggle));
}
function ModeToggle() {   // light / dark, with SVG icons (the .GUI toggle draws its icons with the icon font)
  const { mode, toggleMode } = G.useThemeContext(), dark = mode === "dark";
  return h(Button, { id: "theme-mode-toggle", size: "small", onClick: () => toggleMode(), "aria-label": dark ? "Switch to light mode" : "Switch to dark mode", title: dark ? "Light mode" : "Dark mode",
    sx: { minWidth: 0, p: "4px", color: "text.secondary", borderRadius: 2 } }, h(Ico, { kind: dark ? "moon" : "sunline", size: 17 }));
}

// ── page spec (GUI.mount) ──
const pageType = (type, Comp) => ({ type, resolve: (spec) => { const { key: _k, ...p } = spec.props || {}; return h(Comp, p); } });
const PAGE_TYPES = Object.fromEntries([["SpaceBrand", BrandBar], ["SpaceScene", Scene], ["SpacePassage", Passage], ["SpaceControls", Controls], ["SpaceRobot", RobotPanel],
  ["SpaceObjects", ObjectsPanel], ["SpaceHood", Hood], ["SpaceKernelStatus", KernelStatus]].map(([t, Comp]) => [t, pageType(t, Comp)]));
const N = (type, id, props = {}, children) => ({ type, props: { ...props, "data-gui-node-id": id }, ...(children !== undefined ? { children: [].concat(children) } : {}) });
function pageSpec(live) {
  return N("Box", "page", { sx: { display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default", color: "text.primary", "@media (min-width:1001px)": { height: "100vh" } } }, [
    N("SpaceBrand", "brand"),
    N("Box", "layout", { sx: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", "@media (max-width:1000px)": { gridTemplateColumns: "minmax(0, 1fr)" } } }, [
      N("Box", "main", { component: "main", sx: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, "@media (min-width:1001px)": { overflowY: "auto" } } }, [
        N("Box", "scene-wrap", { sx: { flex: 1, minHeight: { xs: 0, md: 360 }, height: { xs: "66vw", md: "auto" }, maxHeight: { xs: 520, md: "none" }, px: { xs: 0, md: 1 }, pt: { xs: .5, md: 0 } } }, [N("SpaceScene", "scene")]),
        N("SpacePassage", "passage"),
      ]),
      N("Box", "aside", { component: "aside", sx: { bgcolor: "background.paper", borderLeft: 1, borderColor: "divider", minHeight: 0, overflowY: "auto", "@media (max-width:1000px)": { borderLeft: 0, borderTop: 1 } } },
        live ? [N("SpaceControls", "aside/controls"), N("SpaceRobot", "aside/robot"), N("SpaceObjects", "aside/objects"), N("SpaceHood", "aside/hood")] : [N("SpaceControls", "aside/controls"), N("SpaceKernelStatus", "aside/status")]),
    ]),
  ]);
}
const PageTheme = ({ children }) => h(G.Theme, { initialThemeId: "neurons.me", initialMode: "dark" }, children);
const ROOT = document.getElementById("root"), MOUNT_GUI = { ...G, Theme: PageTheme, registry: { ...G.registry, ...PAGE_TYPES } };
const mountPage = () => { G.mount(pageSpec(!!RT), ROOT, RT ? { gui: MOUNT_GUI, me: FME, runtime: RT } : { gui: MOUNT_GUI }); };
mountPage();
requestAnimationFrame(loop);

const params = new URLSearchParams(location.search);
try {
  const [k, guiHash] = await Promise.all([loadKernel(), verifyGuiBuild()]);
  ME = k.ME;
  ui.set({ kernel: { state: "ok", hash: k.hash, url: k.url }, gui: { state: "ok", hash: guiHash } });
  reset();
  RT = G.createMeRuntime(FME, { subscribe: kernelSubscribe });
  mountPage(); announceAll();
  if (params.get("step")) ui.set({ step: Math.min(STEPS, Math.max(1, parseInt(params.get("step"), 10) || 1)) });
  if (params.get("autoplay") !== "0") play(true);
  window.__space = {   // hooks for headless checks
    get W() { return W; }, M, FME, act, reset, play, ui, step: (n = 1) => { for (let i = 0; i < n; i++) stepOnce(); announce(); tick.set(); frame.set(); },
    stats: () => { const fm = frameMs.slice(-240); return { fps: frames.filter((t) => performance.now() - t <= 1000).length, stepMsAvg: stepMs.reduce((a, b) => a + b, 0) / (stepMs.length || 1), stepMsMax: Math.max(0, ...stepMs),
      frameMsAvg: fm.reduce((a, b) => a + b, 0) / (fm.length || 1), frameMsMax: Math.max(0, ...fm), usPerWrite: +(wstat.us / (wstat.n || 1)).toFixed(1), kAvg: +(wstat.k / (wstat.n || 1)).toFixed(2), kMax: wstat.kMax, writes: wstat.n }; },
    writeCount: () => wstat.n, setSpeed: (s) => ui.set({ speed: s }),
    async consistency() { announceAll(); await new Promise((r) => setTimeout(r, 80)); const els = [...document.querySelectorAll("[data-me-path][data-me-value]")];
      const bad = els.filter((e) => e.dataset.meValue !== String(FME(e.dataset.mePath))).map((e) => ({ path: e.dataset.mePath, dom: e.dataset.meValue, kernel: String(FME(e.dataset.mePath)) }));
      return { bound: els.length, mismatches: bad }; },
    subscribeFact: () => W.robots.map((r) => r.k.me("subscribe")),
    storyLines: (a) => M.storyLines(W, a), panelLines: (id) => M.panelLines(W, id),
  };
  window.__spaceReady = true;
} catch (e) {
  const msg = String(e?.message || e);
  if (/^\.GUI build/.test(msg)) ui.set({ gui: { state: "error" } });
  if (!ME) ui.set({ kernel: { state: "error", text: `${msg}. Nothing on this page runs without it.` } });
  window.__spaceError = msg;
  console.error(e);
}
