// Autonomous Robots in Space: .GUI page (this.gui@4.1.0, SRI-pinned in index.html, sha256-checked below)
// over the real, unmodified this.me@4.1.0 kernel (sha256-checked below before import).
//
// Who owns what:
//   KERNEL (this.me): one kernel per robot (3) + one on Earth. Every robot fact, every derived value, k, explain().
//   .GUI (this.gui):  the page is one spec resolved by GUI.mount (topbar, scene, passages, panels); readouts are
//                     kernel reads through ONE .GUI runtime (GUI.createMeRuntime) over an explicit subscribe bridge.
//   ADAPTER (plain JS, space-model.js + this file): physics truth, motion, light-delay queue, which action a robot
//                     takes from its flags, the drawing, the simulation clock, timings.

import * as M from "./space-model.js";

const KERNEL = { version: "4.1.0", sha256: "47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa",
  urls: ["https://cdn.jsdelivr.net/npm/this.me@4.1.0/dist/me.es.js", "https://unpkg.com/this.me@4.1.0/dist/me.es.js"] };
const GUI_PIN = { label: "this.gui@4.1.0", repo: "https://github.com/neurons-me/GUI", npm: "https://www.npmjs.com/package/this.gui/v/4.1.0",
  url: "https://cdn.jsdelivr.net/npm/this.gui@4.1.0/dist/this.gui.umd.js", sha256: "d50e32f6a4f7603804228c074fc59df1cfdea73a4f3d5ad93ba9475227b2a577" };
const SRC = "https://github.com/neurons-me/.me/blob/main/Demos/Robots/Space/";
const BUILD_NOTES = "https://github.com/neurons-me/.me/tree/main/Demos/Robots/Space";

const G = window.GUI, h = React.createElement;
const { Box, Button, Typography, Link, TextField } = G.Atoms;
const { MenuItem } = G.Molecules;
const Slider = G.Atoms.Slider || G.Molecules.Slider || null;
const MONO = '"IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace';
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
  throw new Error("Could not load this.me@" + KERNEL.version + ": " + errors.join(" | "));
}

// ── tiny external stores (page state, not kernel) ──
function createStore(state) { const ls = new Set(); let v = 0; return { state, subscribe: (cb) => (ls.add(cb), () => ls.delete(cb)), version: () => v, set(p) { if (p) Object.assign(state, p); v++; ls.forEach((cb) => cb()); } }; }
const useStore = (s) => { React.useSyncExternalStore(s.subscribe, s.version); return s.state; };
const ui = createStore({ step: 1, sel: 612, running: false, speed: 10, explain: "goCharge", kernel: { state: "loading" }, gui: { state: "checking" }, verify: null, ready: false });
const frame = createStore({});   // bumped every animation frame (scene only)
const tick = createStore({});    // bumped at 4 Hz (page counters)

// ── the kernels and the one .GUI runtime ──
// Four kernels; robot paths are unique across them (robot 612's kernel only holds robots.612.*), Earth's paths are
// prefixed "earth." for the page. FME is a read facade: FME(path) = the owning kernel's me(path). No writes go through it.
let ME = null, W = null, RT = null;
function kernelFor(path) {
  const p = String(path);
  if (p.startsWith("earth.")) return [W?.earth, p.slice(6)];
  const m = /^robots\.(\d+)\./.exec(p); const r = m && W?.robots.find((x) => x.rock.id === Number(m[1]));
  return [r?.k, p];
}
const FME = Object.assign((p) => { const [k, q] = kernelFor(p); return k ? k.me(q) : undefined; }, { explain: (p) => { const [k, q] = kernelFor(p); return k?.me.explain(q); } });
// Explicit subscribe bridge: this.me@4.1.0 has no change events, and me.subscribe(...) on a kernel proxy would write a
// fact named "subscribe". The page announces exactly the paths the kernel reported for each write (the written
// fact + explain().meta.recomputed), batched to the 4 Hz UI tick.
const kListeners = new Map();
const bridgeKey = (p) => { const s = String(p); return s.startsWith("me/") ? s.slice(3).replace(/\//g, ".") : s; };
function kernelSubscribe(path, cb) { const key = bridgeKey(path); let s = kListeners.get(key); if (!s) kListeners.set(key, (s = new Set())); s.add(cb); return () => { s.delete(cb); if (!s.size) kListeners.delete(key); }; }
let pending = new Set();
const noteWrite = (x, prefix = "") => { pending.add(prefix + x.path); for (const p of x.recomputed) pending.add(prefix + p); };
function announce() { const ps = pending; pending = new Set(); for (const p of ps) kListeners.get(p)?.forEach((cb) => cb()); }
function announceAll() { pending.clear(); for (const s of [...kListeners.values()]) [...s].forEach((cb) => cb()); }

// ── simulation loop ──
let acc = 0, lastNow = 0, lastUi = 0, frames = [], stepMs = [];
const wstat = { n: 0, us: 0, k: 0, kMax: 0 };   // every robot-kernel write the simulation made (count, µs, k)
const lastWrites = new Map();   // robot id → last non-empty batch (with k and µs)
function stepOnce() {
  const t0 = performance.now();
  M.step(W, 1);
  stepMs.push(performance.now() - t0); if (stepMs.length > 300) stepMs.splice(0, 150);
  for (const r of W.robots) { for (const x of r.lastBatch) { wstat.n++; wstat.us += x.us; wstat.k += x.k; wstat.kMax = Math.max(wstat.kMax, x.k); }
    if (r.lastBatch.length) { lastWrites.set(r.rock.id, { t: W.t, batch: r.lastBatch }); r.lastBatch.forEach((x) => noteWrite(x)); } if (r.earthBatch) { r.earthBatch.forEach((x) => noteWrite(x, "earth.")); r.earthBatch = null; } }
}
function loop(now) {
  const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; lastNow = now;
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
function reset({ mode = W?.mode || "earth", linkUp = true } = {}) {
  W = M.createWorld(ME, { mode, linkUp }); if (mode !== "earth") M.setMode(W, mode);
  acc = 0; lastWrites.clear(); ui.set({ verify: null }); announceAll(); tick.set(); frame.set();
}
const play = (on = true) => ui.set({ running: on });
function interact(x) { if (x) { noteWrite(x); const id = Number(x.path.split(".")[1]); lastWrites.set(id, { t: W.t, batch: [x], manual: true }); } announce(); tick.set(); frame.set(); }
const act = {
  select: (id) => ui.set({ sel: id }),
  mode: (m) => { M.setMode(W, m); tick.set(); },
  link: (up) => { M.setLink(W, up); noteWrite({ path: "link.up", recomputed: [] }, "earth."); interact(); },
  glitchPos: (id) => { ui.set({ sel: id, explain: "positionOk" }); interact(M.glitchPosition(W, id, 0.6)); },
  glitchBattery: (id) => { ui.set({ sel: id, explain: "batteryOk" }); interact(M.glitchBattery(W, id, 140)); },
  battery: (id, v) => interact(M.setBattery(W, id, v)),
  verify: () => { const t0 = performance.now(); const v = M.verifyWorld(ME, W); ui.set({ verify: { ...v, ms: performance.now() - t0, t: W.t } }); },
};
const robot = (id) => W?.robots.find((r) => r.rock.id === id);

// ── the story ──
const C = (s) => `<code>${s}</code>`;
const PASSAGES = [null,
  { title: "Three small robots",
    body: `Far from Earth, three small robots live on three small rocks. Each rock has a lit side and a dark side, and a crater on the dark pole where the ice is. Each robot carries its own .me kernel: what it knows about itself (its battery, where it stands, what it is doing) lives in its own namespace, ${C("me.robots[612]")}, and nowhere else.`,
    code: `me.robots[612].battery(80)`, tries: [["Open B 612's kernel", () => act.select(612)]] },
  { title: "The one who gives orders",
    body: `On Earth there is one kernel that decides for all three. It sees each robot through telemetry that left 20 to 27 minutes ago (light time for these distances), and its orders take as long to come back. The small dots on the lines are those messages. This is one point of control: n = 1.`,
    code: `earth: me.robots[612].goCharge  →  order "charge"  →  20 min  →  B 612`, tries: [["Earth decides, link up", () => { reset({ mode: "earth", linkUp: true }); play(); }]] },
  { title: "The link is cut",
    body: `Distance, a storm, a failed antenna: one day the line goes quiet. Under n = 1 each robot keeps doing its last order. The ones walking into the dark keep walking. A robot's own kernel can say ${C("goCharge = true")}, but under n = 1 it is not allowed to act on it. The spec states it as n = 1 ⟹ f ≤ 0: a single point of control tolerates zero faults. Here you can watch one such fault.`,
    code: `n = 1  ⟹  f ≤ 0`, tries: [["Cut the link (Earth decides) ×60", () => { reset({ mode: "earth", linkUp: true }); M.setLink(W, false); ui.set({ speed: 60 }); play(); interact(); }]] },
  { title: "Each one decides",
    body: `Start again, with the link cut, but now each robot reads its own kernel. The rules are the same text Earth uses. When the battery is no longer enough to walk back out of the dark, ${C("mustReturn")} becomes true and the robot turns toward the light, without asking anyone. Its data waits on board until the link returns.`,
    code: `me.robots["[i]"]["="]("mustReturn", "battery < reserveNeeded")`, tries: [["Each robot decides, link cut ×60", () => { reset({ mode: "local", linkUp: false }); ui.set({ speed: 60, explain: "mustReturn" }); play(); interact(); }]] },
  { title: "Knowing where you are",
    body: `A robot has to know where it stands. Every time it writes its position, its kernel re-derives ${C("drift = pos − prevPos − vel × dt")} and checks it against a tolerance, and checks that the battery is within 0..100. Glitch a sensor: the check fails on that write, ${C("safeMode")} turns on, the robot stops, and explain() shows which input broke it. After a star fix (20 simulated minutes) it writes a consistent position again.`,
    code: `me.robots["[i]"]["="]("positionOk", "drift * drift <= tol * tol")`, tries: [["Glitch the position sensor", () => act.glitchPos(ui.state.sel)], ["Glitch the battery reading (140 %)", () => act.glitchBattery(ui.state.sel)]] },
  { title: "Night and the battery",
    body: `In the dark, walking costs battery. ${C("reserveNeeded")} is what it costs to walk back to the light, plus a margin; Earth's copy also adds the round trip, because it decides late. Set a low battery on the robot deepest in the dark: ${C("mustReturn")} and ${C("goCharge")} change on that one write.`,
    code: `me.robots[325].battery(15)`, tries: [["Low battery for the robot deepest in the dark", () => { const r = [...W.robots].filter((x) => !x.dead).sort((a, b) => b.truth.pos - a.truth.pos)[0]; if (!r) return; ui.set({ sel: r.rock.id, explain: "mustReturn" }); act.battery(r.rock.id, 15); }]] },
  { title: "A small cost",
    body: `Each write recomputes only the paths that read it; that number is k. A battery write touches a few paths of one robot's kernel, and the other robots' kernels are not involved at all. So the cost of a decision follows k, not the number of robots. The times next to each write are measured in this browser. Verify rebuilds every kernel from its facts and compares every derived value.`,
    code: `cost(mutation) = O(k)`, tries: [["Verify all four kernels", () => act.verify()]] },
];
const STEPS = PASSAGES.length - 1;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

// ── scene (page-side SVG; colours from the .GUI theme) ──
const VB = { w: 1000, h: 600 };
const SUN = { x: 70, y: 300, r: 30 };
const EARTH = { x: 936, y: 96, r: 6 };
const POS = { 612: { x: 400, y: 320, R: 64 }, 325: { x: 650, y: 175, R: 50 }, 329: { x: 690, y: 450, R: 42 } };
const STARS = Array.from({ length: 56 }, (_, i) => { const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123; return [((a % 1) + 1) % 1 * VB.w, ((b % 1) + 1) % 1 * VB.h, 0.5 + ((i * 7) % 5) / 8, 0.18 + ((i * 3) % 7) / 25]; });
function sceneVars(t) {
  const dark = t.palette.mode === "dark";
  return { "--ink": t.palette.text.primary, "--muted": t.palette.text.secondary, "--faint": t.palette.text.disabled, "--bg": t.palette.background.default,
    "--sun": t.palette.warning.main, "--day": alpha(t.palette.warning.main, dark ? 0.16 : 0.22), "--night": alpha(t.palette.text.primary, dark ? 0.06 : 0.07),
    "--link": t.palette.info.main, "--err": t.palette.error.main, "--accent": t.palette.primary.main };
}
function RobotGlyph({ r, sel, FS = 1 }) {
  const P = POS[r.rock.id], a = Math.atan2(SUN.y - P.y, SUN.x - P.x), phi = a + r.truth.pos;
  const x = P.x + (P.R + 1) * Math.cos(phi), y = P.y + (P.R + 1) * Math.sin(phi), deg = (phi * 180) / Math.PI + 90;
  const col = r.dead ? "var(--err)" : "var(--ink)";
  const safe = r.status === "safe mode";
  return h("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${(1.25 * Math.min(FS, 1.8)).toFixed(2)})${r.dead ? " rotate(70 0 -6)" : ""}`, stroke: col, fill: "var(--bg)", strokeWidth: 1.3, opacity: r.dead ? 0.8 : 1 },
    h("line", { x1: -4, y1: 0, x2: 4, y2: 0 }),
    h("rect", { x: -4.5, y: -11, width: 9, height: 9, rx: 2, strokeDasharray: safe ? "2 1.5" : undefined }),
    h("circle", { cx: 0, cy: -14.5, r: 3 }),
    h("line", { x1: 0, y1: -17.5, x2: 0, y2: -21 }), h("circle", { cx: 0, cy: -22, r: 1, fill: col }));
}
function Rock({ r, sel, FS }) {
  const P = POS[r.rock.id], a = Math.atan2(SUN.y - P.y, SUN.x - P.x);
  const p1 = [P.x + P.R * Math.cos(a - Math.PI / 2), P.y + P.R * Math.sin(a - Math.PI / 2)], p2 = [P.x + P.R * Math.cos(a + Math.PI / 2), P.y + P.R * Math.sin(a + Math.PI / 2)];
  const cr = [P.x + P.R * 0.74 * Math.cos(a + Math.PI), P.y + P.R * 0.74 * Math.sin(a + Math.PI)];
  const bat = FME(`robots.${r.rock.id}.battery`);
  const words = r.status;
  return h("g", { className: "rock", "data-robot": r.rock.id, role: "button", tabIndex: 0, "aria-label": `${r.rock.name}: robot ${words}. Open its kernel.`, style: { cursor: "pointer", outline: "none" },
    onClick: () => act.select(r.rock.id), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act.select(r.rock.id); } } },
    h("circle", { cx: P.x, cy: P.y, r: P.R + 34, fill: "transparent" }),
    sel ? h("circle", { cx: P.x, cy: P.y, r: P.R + 24, fill: "none", stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 5", opacity: 0.7 }) : null,
    h("circle", { cx: P.x, cy: P.y, r: P.R, fill: "var(--night)" }),
    h("path", { d: `M${p1[0]},${p1[1]} A${P.R},${P.R} 0 0 1 ${p2[0]},${p2[1]} Z`, fill: "var(--day)" }),
    h("ellipse", { cx: cr[0], cy: cr[1], rx: P.R * 0.16, ry: P.R * 0.09, transform: `rotate(${(a * 180) / Math.PI + 90} ${cr[0]} ${cr[1]})`, fill: "none", stroke: "var(--faint)", strokeWidth: 1 }),
    h("circle", { cx: P.x, cy: P.y, r: P.R, fill: "none", stroke: "var(--ink)", strokeWidth: 1.2, opacity: 0.85 }),
    h(RobotGlyph, { r, sel, FS }),
    h("text", { x: P.x, y: P.y + P.R + 30 + 14 * FS, textAnchor: "middle", style: { font: `500 ${(12 * FS).toFixed(1)}px ${MONO}`, letterSpacing: ".18em", fill: "var(--muted)" } }, `${r.rock.name.toUpperCase()} · ${typeof bat === "number" ? Math.round(bat) : "—"} %`),
    h("text", { x: P.x, y: P.y + P.R + 30 + 32 * FS, textAnchor: "middle", style: { font: `italic ${(14 * FS).toFixed(1)}px ${SERIF}`, fill: r.dead ? "var(--err)" : "var(--ink)" } }, words));
}
// Text keeps a readable on-screen size: below ~450 px of scene width the SVG text is scaled up (FS).
function useFontScale() {
  const ref = React.useRef(null); const [fs, setFs] = React.useState(1);
  React.useLayoutEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => { const w = el.getBoundingClientRect().width || 1000; setFs(Math.max(1, Math.min(2.6, 900 / w))); }); ro.observe(el); return () => ro.disconnect(); }, [!!W]);
  return [ref, fs];
}
function Scene(p) {
  useStore(frame); const { sel } = useStore(ui); const [ref, FS] = useFontScale();
  if (!W) return h(Box, { sx: { height: "100%", display: "grid", placeItems: "center", fontFamily: SERIF, fontStyle: "italic", color: "text.secondary" } }, "…");
  const tf = W.t + acc;
  const links = W.robots.map((r) => {
    const P = POS[r.rock.id], dx = P.x - EARTH.x, dy = P.y - EARTH.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const a = [EARTH.x + ux * 10, EARTH.y + uy * 10], b = [P.x - ux * (P.R + 8), P.y - uy * (P.R + 8)], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { r, a, b, m };
  });
  const dots = W.packets.map((p, i) => {
    const l = links.find((x) => x.r.rock.id === p.id); const f = Math.max(0, Math.min(1, (tf - p.sentAt) / (p.arriveAt - p.sentAt)));
    const [s, e] = p.kind === "telemetry" ? [l.b, l.a] : [l.a, l.b];
    return h("circle", { key: `p${i}`, cx: s[0] + (e[0] - s[0]) * f, cy: s[1] + (e[1] - s[1]) * f, r: p.kind === "order" ? 3 : 2, fill: p.kind === "order" ? "var(--sun)" : "var(--link)" });
  });
  return h(Box, { component: "svg", id: "scene", ref, viewBox: `0 0 ${VB.w} ${VB.h}`, preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "Three small asteroids with one robot each, the Sun on the left, Earth far away in the upper right",
    "data-gui-node-id": p["data-gui-node-id"], sx: (t) => ({ ...sceneVars(t), display: "block", width: "100%", height: "100%", userSelect: "none" }) },
    ...STARS.map(([x, y, r, o], i) => h("circle", { key: `s${i}`, cx: x, cy: y, r, fill: "var(--ink)", opacity: o })),
    h("circle", { cx: SUN.x, cy: SUN.y, r: SUN.r * 2.2, fill: "var(--sun)", opacity: 0.08 }),
    h("circle", { cx: SUN.x, cy: SUN.y, r: SUN.r, fill: "var(--sun)", opacity: 0.9 }),
    h("text", { x: SUN.x, y: SUN.y + SUN.r + 12 + 14 * FS, textAnchor: "middle", style: { font: `500 ${(11 * FS).toFixed(1)}px ${MONO}`, letterSpacing: ".2em", fill: "var(--muted)" } }, "SUN"),
    ...links.map(({ r, a, b, m }) => W.linkUp
      ? h("line", { key: `l${r.rock.id}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "var(--link)", strokeWidth: 1, strokeDasharray: "2 6", opacity: 0.45 })
      : h("g", { key: `l${r.rock.id}`, stroke: "var(--faint)", strokeWidth: 1, opacity: 0.6 },
        h("line", { x1: a[0], y1: a[1], x2: a[0] + (m[0] - a[0]) * 0.85, y2: a[1] + (m[1] - a[1]) * 0.85, strokeDasharray: "2 6" }),
        h("line", { x1: b[0], y1: b[1], x2: b[0] + (m[0] - b[0]) * 0.85, y2: b[1] + (m[1] - b[1]) * 0.85, strokeDasharray: "2 6" }),
        h("path", { d: `M${m[0] - 4},${m[1] - 4} L${m[0] + 4},${m[1] + 4} M${m[0] + 4},${m[1] - 4} L${m[0] - 4},${m[1] + 4}` }))),
    ...dots,
    h("circle", { cx: EARTH.x, cy: EARTH.y, r: EARTH.r, fill: "var(--link)" }),
    h("text", { x: EARTH.x + 8, y: EARTH.y - 16 - 18 * FS, textAnchor: "end", style: { font: `500 ${(11 * FS).toFixed(1)}px ${MONO}`, letterSpacing: ".2em", fill: "var(--muted)" } }, "EARTH"),
    h("text", { x: EARTH.x + 8, y: EARTH.y - 16, textAnchor: "end", style: { font: `italic ${(13 * FS).toFixed(1)}px ${SERIF}`, fill: "var(--muted)" } }, W.linkUp ? (W.mode === "earth" ? "decides for all three" : "listens") : "silent"),
    ...W.robots.map((r) => h(Rock, { key: r.rock.id, r, sel: sel === r.rock.id, FS })),
    h("text", { x: 24, y: 20 + 14 * FS, style: { font: `500 ${(11 * FS).toFixed(1)}px ${MONO}`, letterSpacing: ".12em", fill: "var(--muted)" } }, `${clock(W.t).toUpperCase()}`),
    h("text", { x: 24, y: 20 + 36 * FS, style: { font: `italic ${(14 * FS).toFixed(1)}px ${SERIF}`, fill: "var(--ink)" } }, W.mode === "earth" ? "Earth decides (n = 1)" : "each robot decides (.me)"),
    h("text", { x: 24, y: 20 + 56 * FS, style: { font: `italic ${(14 * FS).toFixed(1)}px ${SERIF}`, fill: W.linkUp ? "var(--muted)" : "var(--err)" } }, W.linkUp ? "the link is up" : "the link is cut"));
}

// ── passage (main column, under the scene) ──
function Passage(p) {
  const { step } = useStore(ui); const ps = PASSAGES[step];
  const btn = { fontFamily: MONO, fontSize: 11, textTransform: "none" };
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "passage", sx: { px: { xs: 2.5, md: 5 }, pt: 2.25, pb: 2.5, borderTop: 1, borderColor: "divider", bgcolor: "background.default" } },
    h(Box, { sx: { maxWidth: 720, mx: "auto" } },
      h(Box, { sx: { display: "flex", alignItems: "center", gap: 1, mb: 1.25, flexWrap: "wrap" } },
        h(Box, { id: "passage-steps", role: "tablist", "aria-label": "Passages", sx: { display: "flex", gap: .5 } },
          ...Array.from({ length: STEPS }, (_, i) => i + 1).map((i) => h(Button, { key: i, role: "tab", "aria-selected": i === step, title: PASSAGES[i].title, onClick: () => ui.set({ step: i }), size: "small",
            sx: { minWidth: 30, width: 30, height: 26, p: 0, fontFamily: SERIF, fontSize: 13, color: i === step ? "primary.main" : "text.secondary", borderBottom: 1, borderColor: i === step ? "primary.main" : "transparent", borderRadius: 0 } }, ROMAN[i]))),
        h(Box, { sx: { ml: "auto", display: "flex", gap: .75 } },
          h(Button, { id: "btn-back", size: "small", disabled: step <= 1, onClick: () => ui.set({ step: step - 1 }), sx: btn }, "Back"),
          h(Button, { id: "btn-next", size: "small", variant: "outlined", onClick: () => ui.set({ step: step >= STEPS ? 1 : step + 1 }), sx: btn }, step >= STEPS ? "From the start" : "Next"))),
      h(Typography, { component: "h2", id: "passage-title", sx: { fontFamily: SERIF, fontWeight: 400, fontStyle: "italic", fontSize: { xs: 22, md: 26 }, lineHeight: 1.2, m: 0, mb: 1, color: "text.primary" } }, `${ROMAN[step]}. ${ps.title}`),
      h(Typography, { component: "p", id: "passage-body", sx: { fontFamily: SERIF, fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.6, color: "text.primary", m: 0, "& code": { fontFamily: MONO, fontSize: ".82em", color: "primary.main" } }, dangerouslySetInnerHTML: { __html: ps.body } }),
      h(Box, { component: "code", sx: { display: "block", mt: 1.25, fontFamily: MONO, fontSize: 12, color: "primary.main", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, ps.code),
      h(Box, { sx: { display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" } },
        ...ps.tries.map(([label, fn], i) => h(Button, { key: i, className: "try", variant: "contained", disableElevation: true, size: "small", disabled: !W, onClick: fn, sx: btn }, label)))));
}

// ── aside ──
const H2 = (title, right) => h(Typography, { component: "h2", sx: { fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "text.secondary", display: "flex", alignItems: "center", gap: 1, m: 0, mb: .75 } }, title, right ? h(Box, { component: "span", sx: { ml: "auto", letterSpacing: "normal", textTransform: "none", fontWeight: 400 } }, right) : null);
const SECTION_SX = { px: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider" };
const ROW_SX = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, py: "2px", fontFamily: MONO, fontSize: 10.5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } };

function Controls(p) {
  const { running, speed } = useStore(ui); useStore(tick);
  const fps = frames.filter((t) => performance.now() - t <= 1000).length;
  const avgStep = stepMs.length ? stepMs.reduce((a, b) => a + b, 0) / stepMs.length : 0;
  const b = { fontFamily: MONO, fontSize: 11, textTransform: "none", height: 30 };
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], sx: SECTION_SX },
    h(Box, { sx: { display: "flex", gap: .75, alignItems: "center" } },
      h(Button, { id: "btn-play", variant: running ? "outlined" : "contained", disableElevation: true, disabled: !W, onClick: () => play(!running), sx: { ...b, flex: 1 } }, running ? "Pause simulation" : "Play simulation"),
      h(TextField, { id: "sel-speed", select: true, size: "small", value: String(speed), onChange: (e) => ui.set({ speed: Number(e.target.value) || 10 }), inputProps: { "aria-label": "Simulation speed (simulated minutes per real second)" }, sx: { width: 92, flexShrink: 0, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10.5, height: 30 } } },
        ...[1, 10, 60].map((s) => h(MenuItem, { key: s, value: String(s), sx: { fontFamily: MONO, fontSize: 11 } }, `×${s}`))),
      h(Button, { id: "btn-reset", variant: "outlined", disabled: !W, onClick: () => reset(), sx: { ...b, minWidth: 0, px: 1.25, color: "text.secondary", borderColor: "divider" } }, "Reset")),
    h(Typography, { component: "div", sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mt: .75 } },
      W ? `${clock(W.t)} · ×${speed} = ${speed} simulated min / s · ${fps} fps · step ${avgStep.toFixed(2)} ms (4 kernels)` : "loading the kernel…"));
}
function ModeLink(p) {
  useStore(tick); if (!W) return null;
  const b = (on) => ({ fontFamily: MONO, fontSize: 10.5, textTransform: "none", flex: 1, lineHeight: 1.3, py: .6 });
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], sx: SECTION_SX },
    H2("Who decides"),
    h(Box, { sx: { display: "flex", gap: .75 } },
      h(Button, { id: "btn-mode-earth", variant: W.mode === "earth" ? "contained" : "outlined", disableElevation: true, onClick: () => act.mode("earth"), "aria-pressed": W.mode === "earth", sx: b() }, "Earth (n = 1)"),
      h(Button, { id: "btn-mode-local", variant: W.mode === "local" ? "contained" : "outlined", disableElevation: true, onClick: () => act.mode("local"), "aria-pressed": W.mode === "local", sx: b() }, "each robot (.me)")),
    h(Button, { id: "btn-link", fullWidth: true, variant: "outlined", color: W.linkUp ? "error" : "primary", onClick: () => act.link(!W.linkUp), sx: { ...b(), mt: .75 } }, W.linkUp ? "Cut the link to Earth" : "Restore the link to Earth"));
}
const KV = (k, v, sub, id) => h(Box, { sx: ROW_SX, key: k },
  h(Box, { component: "span", sx: { color: "text.secondary", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: sub || k }, k, sub ? h(Box, { component: "span", sx: { color: "text.disabled", ml: .75, fontSize: 9.5 } }, sub) : null),
  h(Box, { component: "span", id, sx: { color: "primary.main", textAlign: "right", whiteSpace: "nowrap" } }, v));
function MeVal({ path, d = 3 }) {   // one kernel readout: G.useMeValue(path) through the page's .GUI runtime
  const v = G.useMeValue(path);
  return h(Box, { component: "span", "data-me-path": path, "data-me-value": String(v), sx: { color: v === false ? "text.secondary" : v === true ? "primary.main" : "inherit" } }, fmt(v, d));
}
function RobotPanel(p) {
  const { sel, explain } = useStore(ui); useStore(tick);
  if (!W) return null;
  const r = robot(sel), id = sel, base = `robots.${id}`;
  const decides = W.mode === "local" ? "its own kernel" : `Earth's last order: ${r.order}`;
  const lw = lastWrites.get(id);
  const bat = FME(`${base}.battery`);
  const btn = { fontFamily: MONO, fontSize: 10.5, textTransform: "none", lineHeight: 1.3 };
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "robot-panel", sx: SECTION_SX },
    h(Box, { sx: { display: "flex", gap: .5, mb: 1 } }, ...M.IDS.map((i) => h(Button, { key: i, size: "small", variant: i === sel ? "contained" : "text", disableElevation: true, onClick: () => act.select(i), sx: { ...btn, flex: 1 } }, robot(i).rock.name))),
    H2(`Kernel of ${r.rock.name}`, h(Box, { component: "span", sx: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: r.dead ? "error.main" : "text.primary" } }, r.status)),
    h(Typography, { component: "div", sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mb: .75 } }, `acts on: ${decides}`),
    h(Box, null,
      KV("battery", h(MeVal, { path: `${base}.battery`, d: 1 }), "%"), KV("shade", h(MeVal, { path: `${base}.shade` }), "rad into the dark"),
      KV("pos", h(MeVal, { path: `${base}.pos` }), "rad"), KV("prevPos", h(MeVal, { path: `${base}.prevPos` })), KV("vel", h(MeVal, { path: `${base}.vel` }), "rad/min"),
      KV("charging", h(MeVal, { path: `${base}.charging` })), KV("data", h(MeVal, { path: `${base}.data` }), "on board"),
      KV("home →", h(Box, { component: "span" }, `${FME(`${base}.home.name`)} · ${FME(`${base}.home.distanceAU`)} AU`), "pointer, read through")),
    h(Typography, { component: "div", sx: { fontFamily: MONO, fontSize: 9, color: "text.disabled", mt: .5 } },
      `constants: tol ${fmt(FME(`${base}.tol`))} · costPerRad ${fmt(FME(`${base}.costPerRad`))} · margin ${fmt(FME(`${base}.margin`))} · lagReserve ${fmt(FME(`${base}.lagReserve`))} · full ${fmt(FME(`${base}.full`))}`),
    h(Box, { sx: { mt: 1 } }, H2("Derived (re-derived on every write)"),
      ...M.RULES.map(([n, e]) => h(Box, { key: n, sx: { ...ROW_SX, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }, onClick: () => ui.set({ explain: n }), title: `explain ${n}` },
        h(Box, { component: "span", sx: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: explain === n ? "primary.main" : "text.secondary" } }, n, h(Box, { component: "span", sx: { color: "text.disabled", ml: .75, fontSize: 9.5 } }, e)),
        h(Box, { component: "span", sx: { textAlign: "right" } }, h(MeVal, { path: `${base}.${n}` }))))),
    h(Box, { sx: { mt: 1.25 } }, H2("Change one value"),
      h(Box, { sx: { display: "flex", alignItems: "center", gap: 1.5, px: .5 } },
        h(Typography, { component: "span", sx: { fontFamily: MONO, fontSize: 10, color: "text.secondary", flexShrink: 0 } }, "battery"),
        Slider ? h(Slider, { id: "battery-slider", size: "small", min: 0, max: 100, step: 1, value: Math.max(0, Math.min(100, Math.round(typeof bat === "number" ? bat : 0))), onChange: (e, v) => act.battery(id, v), "aria-label": `${r.rock.name} battery`, sx: { flex: 1 } })
          : h("input", { id: "battery-slider", type: "range", min: 0, max: 100, value: Math.round(bat || 0), onChange: (e) => act.battery(id, Number(e.target.value)), style: { flex: 1 } })),
      h(Box, { sx: { display: "flex", gap: .75, mt: .5, flexWrap: "wrap" } },
        h(Button, { id: "btn-glitch-pos", size: "small", variant: "outlined", onClick: () => act.glitchPos(id), sx: { ...btn, flex: 1 } }, "Glitch position"),
        h(Button, { id: "btn-glitch-bat", size: "small", variant: "outlined", onClick: () => act.glitchBattery(id), sx: { ...btn, flex: 1 } }, "Glitch battery (140 %)"))),
    h(ExplainView, { path: `${base}.${explain}` }),
    h(Box, { sx: { mt: 1.25 } }, H2("Last writes", lw ? h("span", null, `${lw.manual ? "your write" : "control step"} · ${clock(lw.t)}`) : null),
      h(Box, { component: "ul", id: "writes", sx: { listStyle: "none", m: 0, p: 0, fontFamily: MONO, fontSize: 9.5, minHeight: 60 } },
        ...(lw ? lw.batch.slice(-6).map((x, i) => h(Box, { component: "li", key: i, sx: { py: .25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
          h(Box, { component: "code", sx: { color: "text.primary" } }, x.code), h(Box, { component: "span", sx: { color: "warning.main", ml: .75 } }, `k=${x.k}`), h(Box, { component: "span", sx: { color: "text.disabled", ml: .75 } }, `${x.us.toFixed(0)} µs`)))
          : [h(Box, { component: "li", key: "e", sx: { color: "text.disabled" } }, "No writes yet: play the simulation.")]))));
}
function ExplainView({ path }) {
  useStore(tick);
  let ex = null, err = null; try { ex = FME.explain(path); } catch (e) { err = e?.message || String(e); }
  if (err || !ex) return h(Typography, { sx: { fontFamily: MONO, fontSize: 9.5, color: "error.main" } }, "explain failed: " + (err || "no result"));
  const m = ex.meta || {}, em = (s) => h(Box, { component: "span", sx: { color: "primary.main" } }, s);
  const rows = [["value", em(fmt(ex.value, 4))], ["expression", ex.expr ?? "— (fact)"],
    ["inputs", (ex.derivation?.inputs || []).length ? ex.derivation.inputs.map((i, j) => h(Box, { component: "span", key: j, sx: { display: "block" } }, `${i.label} = `, em(fmt(i.value, 4)))) : "—"],
    ["last wave", m.sourcePath ? h(React.Fragment, null, "write to ", em(m.sourcePath), ` · k = ${m.k} · recomputed: ${(m.recomputed || []).map((x) => x.split(".").pop()).join(", ")}`) : "not recomputed since the seed"]];
  return h(Box, { id: "explain", sx: { mt: 1.25 } }, H2(`explain()`, h(Box, { component: "code", sx: { fontFamily: MONO, fontSize: 9.5, color: "primary.main" } }, `me.explain("${path}")`)),
    h(Box, { sx: { fontFamily: MONO, fontSize: 9.5, lineHeight: 1.5, border: 1, borderColor: "divider", borderRadius: "4px", px: 1, py: .5 } },
      ...rows.map(([l, v]) => h(Box, { key: l, sx: { display: "grid", gridTemplateColumns: "70px minmax(0, 1fr)", gap: .5, py: .25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
        h(Box, { component: "span", sx: { color: "text.disabled" } }, l), h(Box, { component: "span", className: `ex-${l.replace(" ", "-")}`, sx: { wordBreak: "break-word", minWidth: 0 } }, v)))));
}
// Earth panel: spec readouts bound with { read: "me/earth.…" } (resolved and subscribed by GUI's renderer)
function EarthVal(p) { return h(Box, { component: "span", "data-me-path": p.path, "data-me-value": String(p.value), "data-gui-node-id": p["data-gui-node-id"], sx: { color: p.value === true ? "primary.main" : p.value === false ? "text.secondary" : "inherit" } }, fmt(p.value, 1)); }
function EarthStatus(p) {
  useStore(tick); if (!W) return null;
  const fl = W.packets.length, tel = W.packets.filter((x) => x.kind === "telemetry").length;
  return h(Typography, { component: "div", "data-gui-node-id": p["data-gui-node-id"], sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mt: .75 } },
    `in flight: ${tel} telemetry · ${fl - tel} orders · lost at a cut: ${W.lost} · one-way: ${M.ROCKS.map((r) => `${r.name} ${M.delayMin(r).toFixed(0)} min`).join(", ")}`);
}
function KernelInfo(p) {
  const { kernel, gui, verify } = useStore(ui);
  const a = (href, text, title) => h(Link, { href, target: "_blank", rel: "noopener", underline: "hover", title, sx: { color: "primary.main" } }, text);
  const row = (k, v) => h(Box, { key: k, sx: { display: "grid", gridTemplateColumns: "58px minmax(0, 1fr)", gap: .75, py: .5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } }, h(Box, { component: "span", sx: { color: "text.disabled" } }, k), h(Box, { component: "span", sx: { minWidth: 0, overflowWrap: "anywhere" } }, v));
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "kernel-info", sx: { ...SECTION_SX, borderBottom: 0, fontFamily: MONO, fontSize: 9.5, lineHeight: 1.45, color: "text.secondary" } },
    H2("Source"),
    row("kernel", kernel.state === "ok" ? h(React.Fragment, null, a(`https://www.npmjs.com/package/this.me/v/${KERNEL.version}`, `this.me@${KERNEL.version}`), ` · dist/me.es.js unmodified · sha256 ${kernel.hash.slice(0, 12)}… `, h("b", null, "verified in this browser"))
      : kernel.state === "error" ? h(Box, { component: "span", sx: { color: "error.main" } }, kernel.text) : "verifying…"),
    row(".GUI", h(React.Fragment, null, a(GUI_PIN.npm, GUI_PIN.label), " · ", a(GUI_PIN.repo, "neurons-me/GUI"), ` · jsDelivr, SRI + sha256 ${GUI_PIN.sha256.slice(0, 12)}… `, gui.state === "ok" ? h("b", null, "verified") : gui.state === "error" ? h(Box, { component: "span", sx: { color: "error.main" } }, "check failed") : "checking…")),
    row("page", h(React.Fragment, null, a(SRC + "space-model.js", "space-model.js"), " (rules, model) · ", a(SRC + "space-gui.js", "space-gui.js"), " (.GUI page) · ", a(SRC + "verify.mjs", "verify.mjs"), " (Node) · ", a(BUILD_NOTES, "build notes"))),
    row("verify", h(Box, { component: "span" },
      h(Button, { id: "btn-verify", size: "small", variant: "outlined", disabled: !W, onClick: act.verify, sx: { fontFamily: MONO, fontSize: 10, textTransform: "none", py: 0, mr: 1 } }, "Verify now"),
      verify ? h(Box, { component: "span", id: "verify-out", sx: { color: verify.ok ? "success.main" : "error.main" } }, verify.ok ? `✓ ${verify.checked} checks, 0 mismatches (${clock(verify.t)}, ${verify.ms.toFixed(0)} ms): every derived value in the 4 kernels = a fresh rebuild = the rule in JS` : `✗ ${verify.mismatches.length} mismatches: ${JSON.stringify(verify.mismatches.slice(0, 3))}`) : null)));
}
function EarthPanel(p) { return h(Box, { "data-gui-node-id": p["data-gui-node-id"], id: "earth-panel", sx: SECTION_SX }, H2("Earth's kernel (n = 1 copy)"), p.children); }
function EarthRow(p) { return h(Box, { sx: ROW_SX, "data-gui-node-id": p["data-gui-node-id"] }, h(Box, { component: "span", sx: { color: "text.secondary" } }, p.k), h(Box, { component: "span", sx: { textAlign: "right", color: "primary.main" } }, p.children)); }

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
      h(G.Icon, { name: "palette", fontSize: 15, "aria-hidden": "true" }), h(Box, { component: "span", className: "lbl" }, themeId), h(G.Icon, { name: "expand_more", fontSize: 15, "aria-hidden": "true" })),
    h(G.Molecules.Menu, { id: "theme-menu", anchorEl: anchor, open: !!anchor, onClose: close, anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" },
      slotProps: { list: { "aria-label": "Themes", dense: true }, paper: { sx: { width: 220, p: .5, mt: .5 } } } },
      h(G.ThemesCatalog, { sidebarView: "expanded", onThemeSelect: close })),
    h(G.ThemeModeToggle, { id: "theme-mode-toggle", variant: "minimal", iconSize: "small", sx: { p: "2px", color: "text.secondary" } }));
}

// ── page spec (GUI.mount) ──
const pageType = (type, Comp) => ({ type, resolve: (spec) => { const { key: _k, ...p } = spec.props || {}; return h(Comp, p); } });
const PAGE_TYPES = Object.fromEntries([["SpaceBrand", BrandBar], ["SpaceScene", Scene], ["SpacePassage", Passage], ["SpaceControls", Controls], ["SpaceModeLink", ModeLink], ["SpaceRobot", RobotPanel],
  ["SpaceEarth", EarthPanel], ["SpaceEarthRow", EarthRow], ["SpaceEarthVal", EarthVal], ["SpaceEarthStatus", EarthStatus], ["SpaceKernel", KernelInfo]].map(([t, Comp]) => [t, pageType(t, Comp)]));
const N = (type, id, props = {}, children) => ({ type, props: { ...props, "data-gui-node-id": id }, ...(children !== undefined ? { children: [].concat(children) } : {}) });
const EV = (path) => N("SpaceEarthVal", `earth/${path}`, { path, value: { read: `me/${path}` } });
function earthSpec() {
  return N("SpaceEarth", "aside/earth", {}, [
    N("SpaceEarthRow", "aside/earth/link", { k: "link.up" }, [EV("earth.link.up")]),
    N("SpaceEarthRow", "aside/earth/data", { k: "data.received" }, [EV("earth.data.received")]),
    ...M.IDS.map((i) => N("SpaceEarthRow", `aside/earth/r${i}`, { k: `robots[${i}] battery · goCharge` }, [EV(`earth.robots.${i}.battery`), " · ", EV(`earth.robots.${i}.goCharge`)])),
    N("SpaceEarthStatus", "aside/earth/status"),
  ]);
}
function pageSpec(live) {
  return N("Box", "page", { sx: { display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default", color: "text.primary", "@media (min-width:1001px)": { height: "100vh" } } }, [
    N("SpaceBrand", "brand"),
    N("Box", "layout", { sx: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", "@media (max-width:1000px)": { gridTemplateColumns: "minmax(0, 1fr)" } } }, [
      N("Box", "main", { component: "main", sx: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, "@media (min-width:1001px)": { overflowY: "auto" } } }, [
        N("Box", "scene-wrap", { sx: { flex: 1, minHeight: 300, height: { xs: "70vw", md: "auto" }, maxHeight: { xs: 460, md: "none" }, px: { xs: 0, md: 2 }, pt: 1 } }, [N("SpaceScene", "scene")]),
        N("SpacePassage", "passage"),
      ]),
      N("Box", "aside", { component: "aside", sx: { bgcolor: "background.paper", borderLeft: 1, borderColor: "divider", minHeight: 0, overflowY: "auto", "@media (max-width:1000px)": { borderLeft: 0, borderTop: 1 } } },
        live ? [N("SpaceControls", "aside/controls"), N("SpaceModeLink", "aside/mode"), N("SpaceRobot", "aside/robot"), earthSpec(), N("SpaceKernel", "aside/kernel")] : [N("SpaceControls", "aside/controls"), N("SpaceKernel", "aside/kernel")]),
    ]),
  ]);
}
const PageTheme = ({ children }) => h(G.Theme, { initialThemeId: "neurons.me", initialMode: "dark" }, children);
const ROOT = document.getElementById("root"), MOUNT_GUI = { ...G, Theme: PageTheme, registry: { ...G.registry, ...PAGE_TYPES } };
let mountHandle = null;
const mountPage = () => { mountHandle = G.mount(pageSpec(!!RT), ROOT, RT ? { gui: MOUNT_GUI, me: FME, runtime: RT } : { gui: MOUNT_GUI }); };
mountPage();
requestAnimationFrame(loop);

const params = new URLSearchParams(location.search);
try {
  const [k, guiHash] = await Promise.all([loadKernel(), verifyGuiBuild()]);
  ME = k.ME;
  ui.set({ kernel: { state: "ok", hash: k.hash, url: k.url }, gui: { state: "ok", hash: guiHash } });
  reset({ mode: params.get("mode") === "local" ? "local" : "earth", linkUp: params.get("link") !== "cut" });
  RT = G.createMeRuntime(FME, { subscribe: kernelSubscribe });
  mountPage(); announceAll();
  if (params.get("step")) ui.set({ step: Math.min(STEPS, Math.max(1, parseInt(params.get("step"), 10) || 1)) });
  if (params.get("autoplay") !== "0") play(true);
  window.__space = {   // hooks for headless checks
    get W() { return W; }, M, FME, act, reset, play, step: (n = 1) => { for (let i = 0; i < n; i++) stepOnce(); announce(); tick.set(); frame.set(); },
    stats: () => ({ fps: frames.filter((t) => performance.now() - t <= 1000).length, stepMsAvg: stepMs.reduce((a, b) => a + b, 0) / (stepMs.length || 1), stepMsMax: Math.max(0, ...stepMs),
      usPerWrite: +(wstat.us / (wstat.n || 1)).toFixed(1), kAvg: +(wstat.k / (wstat.n || 1)).toFixed(2), kMax: wstat.kMax }),
    writeCount: () => wstat.n, setSpeed: (s) => ui.set({ speed: s }),
    async consistency() { announceAll(); await new Promise((r) => setTimeout(r, 80)); const els = [...document.querySelectorAll("[data-me-path][data-me-value]")];
      const bad = els.filter((e) => e.dataset.meValue !== String(FME(e.dataset.mePath))).map((e) => ({ path: e.dataset.mePath, dom: e.dataset.meValue, kernel: String(FME(e.dataset.mePath)) }));
      return { bound: els.length, mismatches: bad }; },
    subscribeFact: () => W.robots.map((r) => r.k.me("subscribe")).concat(W.earth.me("subscribe")),
  };
  window.__spaceReady = true;
} catch (e) {
  const msg = String(e?.message || e);
  if (/^\.GUI build/.test(msg)) ui.set({ gui: { state: "error" } });
  if (!ME) ui.set({ kernel: { state: "error", text: `${msg}. Nothing on this page runs without it.` } });
  window.__spaceError = msg;
}
