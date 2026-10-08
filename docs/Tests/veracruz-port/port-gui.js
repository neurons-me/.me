// Port of Veracruz: .GUI interface (this.gui@4.1.0 from npm via jsDelivr, SRI-pinned in the HTML and sha256-checked in
// the browser below). The map is GUI.OpenStreetMap with its own
// themed Legend, Chips, Overlays, Controls and MarkerList: it follows the page theme (no page map CSS, no pinned ink).
// over the real, unmodified this.me@4.1.0 kernel (sha256-checked here before import).
//
// Who owns what:
//   KERNEL (this.me): every fact, every derived value, k, recomputed sets, explain().
//   .GUI (this.gui):  the whole view is ONE spec tree resolved by GUI.mount (topbar, panels, rows, readouts,
//                     progress bars, legend, HUD, the OpenStreetMap with its markers and canvas layer), so every
//                     node is a .GUI node for the opt-in Semantic Inspector (Spec, provenance, Explain).
//                     Every kernel readout is a { read: "me/<path>" } prop, resolved and subscribed by GUI's
//                     renderer through the page's single .GUI runtime; it re-reads me(path) whenever that
//                     path is written or recomputed.
//   ADAPTER (plain JS, not kernel): the traffic model (port-traffic.js), the animation loop, the canvas dots,
//                     the SVG map labels, page stats (fps, writes/s), the redirect feed, the completion
//                     estimate, and the notification schedule (which kernel paths to re-announce, and when).

import { createPortKernel, COUNTERS, TRIP_COUNTERS, UNIT_IDS, FLEET, HEAVY, LAST_MILE, TRIP_COUNT, TEMPLATES, templateCode, SHIPS, TRAIN, SHIP_FIELDS, TRAIN_FIELDS, TRUCK_STATES, TRUCK_FIELDS, TRUCK_KIND, BAND_COUNTERS, ADAPTER_AGGREGATES, SPEED_FACTS } from "./port-sim.js";
import { createTraffic, VIS_OF, COUNTER_OF, CONFIG, SIM_START_H, HEAVY_TRUCK_KMH, LAST_MILE_KMH, MOVING_STATES } from "./port-traffic.js";
import { ROUTES, KEY, EXITS, PROJ } from "./port-routes.js";
import { CEDIS } from "./port-lastmile.js";

const KERNEL = {
  version: "4.1.0",
  sha256: "47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa",
  urls: ["https://cdn.jsdelivr.net/npm/this.me@4.1.0/dist/me.es.js", "https://unpkg.com/this.me@4.1.0/dist/me.es.js"],
};
// .GUI build: this.gui@4.1.0 as published on npm (built from neurons-me/GUI main @3b0bfc7: #2 + #3), loaded from jsDelivr.
// The same file the <script> in index.html loads (SRI there); re-hashed here (sha256) before anything runs.
// The previous self-hosted vendor/this.gui-ed06869.umd.js stays in the repo, unused.
const GUI_PIN = { label: "this.gui@4.1.0", version: "4.1.0", branch: "main", commit: "3b0bfc7", short: "4.1.0",
  repo: "https://github.com/neurons-me/GUI", npm: "https://www.npmjs.com/package/this.gui/v/4.1.0",
  url: "https://cdn.jsdelivr.net/npm/this.gui@4.1.0/dist/this.gui.umd.js", cdn: "https://cdn.jsdelivr.net/npm/this.gui@4.1.0/dist/this.gui.umd.js",
  sha256: "d50e32f6a4f7603804228c074fc59df1cfdea73a4f3d5ad93ba9475227b2a577", sri: "sha384-umBxi9YB2FkfPkyuR4Ej4TvKyweGkUbZnvIQh/ZzaF0YGstAGl5I6xJ9fnLC+76O" };

const G = window.GUI, h = React.createElement;
const { Box, Button, Typography, Chip, Progress, Paper, Link, TextField } = G.Atoms;
const { Collapse, MenuItem } = G.Molecules;
const alpha = (c, a) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;

const MONO = '"IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace';
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(n));
const pct = (x) => (typeof x === "number" ? (x * 100).toFixed(1) + "%" : "—");
const clock = (simSec) => { const t = Math.floor(SIM_START_H * 3600 + simSec); return `${String(Math.floor(t / 3600) % 24).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}`; };
const realDur = (sec) => (sec < 90 ? `${Math.round(sec)} s` : sec < 5400 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`);
const sgn = (n) => (n > 0 ? "+" : "−") + fmt(Math.abs(n));
const pad4 = (n) => String(n).padStart(4, "0"), lmName = (u) => `LM-${String(u).padStart(2, "0")}`;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Re-hash the .GUI UMD in the browser (the <script> tag already enforced SRI sha384; this shows and checks sha256 too).
async function verifyGuiBuild() {
  const res = await fetch(GUI_PIN.url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`.GUI build: HTTP ${res.status}`);
  const buf = await crypto.subtle.digest("SHA-256", await res.arrayBuffer());
  const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== GUI_PIN.sha256) { const e = new Error(`.GUI build sha256 mismatch: got ${hash}`); e.mismatch = true; throw e; }
  return hash;
}
async function loadKernel() {
  const errors = [];
  for (const url of KERNEL.urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const hash = await sha256Hex(text);
      if (hash !== KERNEL.sha256) throw new Error(`sha256 mismatch: got ${hash}`);
      const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
      const mod = await import(blobUrl);
      URL.revokeObjectURL(blobUrl);
      // The module exports no version, so the version shown is read from the final URL of the response
      // whose bytes just passed the sha256 check above (not from a page constant).
      const loadedUrl = res.url || url, version = (loadedUrl.match(/\/this\.me@([0-9]+\.[0-9]+\.[0-9]+[0-9A-Za-z.+-]*)\//) || [])[1] || "?";
      return { mod, host: new URL(loadedUrl).host, hash, url: loadedUrl, version };
    } catch (e) { errors.push(`${url}: ${e?.message || e}`); }
  }
  const err = new Error("Could not load this.me@" + KERNEL.version + " — " + errors.join(" | "));
  err.mismatch = errors.some((x) => x.includes("sha256 mismatch"));
  throw err;
}

// ── tiny external stores for page/adapter state (React useSyncExternalStore; not kernel) ──
function createStore(state) {
  const ls = new Set(); let v = 0;
  return { state, subscribe: (cb) => (ls.add(cb), () => ls.delete(cb)), version: () => v, set(patch) { if (patch) Object.assign(state, patch); v++; ls.forEach((cb) => cb()); } };
}
const useStore = (s) => { React.useSyncExternalStore(s.subscribe, s.version); return s.state; };
const VERIFY_HINT = "Flushes, then rebuilds a fresh kernel from the current facts + same formulas and compares every derived path; checks Σ counters = 500, per-truck kernel states vs counters, trips done + pending + unscheduled = 1,000, above + within + below = 100, band limits, and adapter states vs kernel counters.";
const ui = createStore({ step: 1, open: {}, running: false, finished: false, speed: 10, me: null, runtime: null, kernel: { state: "loading", text: `Loading this.me@${KERNEL.version}…` }, verify: { tone: "", text: VERIFY_HINT }, seed: "—" });
const sim = createStore({});   // bumped by the adapter at ~4 Hz: sim clock, page stats, feeds
const pick = createStore({ n: null });   // the truck instance picked on the map (me.trucks.unit[n]); page state

// ── kernel → .GUI subscribe bridge (adapter schedule, kernel values) ──
// The .GUI runtime (GUI.createMeRuntime) takes `subscribe(path, cb)`. this.me@4.1.0 has no per-instance change events,
// and on its proxy `me.subscribe(...)` would WRITE a fact named "subscribe". So this bridge is passed
// explicitly. The adapter announces exactly the paths the kernel reported for each write
// (the written fact + explain().meta.recomputed), batched to the UI tick. Components then re-read me(path).
// Keys are dotted kernel paths: a spec's { read: "me/ships.1.remaining" } subscribes as "me/ships.1.remaining",
// a hook as "ships.1.remaining"; both land on the key the adapter announces ("ships.1.remaining").
const kListeners = new Map();
const bridgeCallbacks = () => { let n = 0; for (const s of kListeners.values()) n += s.size; return n; };
const bridgeKey = (path) => { const p = String(path); return p.startsWith("me/") ? p.slice(3).replace(/\//g, ".") : p; };
function kernelSubscribe(path, cb) {
  const key = bridgeKey(path);
  let s = kListeners.get(key); if (!s) kListeners.set(key, (s = new Set()));
  s.add(cb);
  return () => { s.delete(cb); if (!s.size) kListeners.delete(key); };
}
let pendingPaths = new Set(), announced = 0;
function announceKernelPaths() {
  if (!pendingPaths.size) return;
  const paths = pendingPaths; pendingPaths = new Set();
  for (const p of paths) { const s = kListeners.get(p); if (s) { announced++; [...s].forEach((cb) => cb()); } }
}
function announceAll() { pendingPaths.clear(); for (const s of [...kListeners.values()]) [...s].forEach((cb) => cb()); }

let ME = null, P = null, T = null;
// ONE .GUI runtime per kernel instance, built once over the explicit bridge above and handed to GUI.mount
// (spec reads, hooks and the Semantic Inspector all use it), so nothing builds a second runtime or
// subscribes twice, and nothing lets .GUI duck-type me.subscribe.
let RT = null;
let running = false;
const speedOf = () => ui.state.speed;

// ── page stats (bookkeeping of what the kernel returned) ──
let flushLog = [], frameLog = [], lastFlush = null, flushCount = 0, writeCount = 0;
let hitPaths = new Set();
let lastUi = 0, maxMoving = 0, moving = 0, offMap = 0;

const NODE_PREFIX = [
  ["ships.1.", "n-ship1"], ["ships.2.", "n-ship2"], ["ships.3.", "n-ship3"], ["train.1.", "n-train"],
  ["queues.import.", "n-qimp"], ["queues.export.", "n-qexp"], ["trucks.import.", "n-qimp"], ["trucks.export.", "n-qexp"],
  ["cargo.", "n-yard"], ["trucks.heavy.available", "n-yard"], ["trucks.lastMile.", "n-cedisb"], ["trips.", "n-cedisb"],
  ["lastMile.", "n-cedisb"], ["localDelivery.", "n-yard"],
  ["flows.", "n-port"], ["port.", "n-port"], ["trucks.", "n-port"],
];
const nodeOfPath = (p) => (NODE_PREFIX.find(([pre]) => p.startsWith(pre)) || [])[1];
const EDGE_ENDS = {
  "e-ship1-q": ["n-ship1", "n-qimp"], "e-ship2-q": ["n-ship2", "n-qimp"], "e-ship3-q": ["n-ship3", "n-qimp"],
  "e-qimp-port": ["n-qimp", "n-port"], "e-yard-qexp": ["n-yard", "n-qexp"], "e-qexp-train": ["n-qexp", "n-train"],
  "e-port-yard": ["n-port", "n-yard"], "e-port-train": ["n-port", "n-train"],
};

// ── Tour ──
const TOUR = [null,
  { title: "1 · Port Simulation Overview", body: "The <strong>Port of Veracruz</strong>, modelled as kernel instances. <strong>me.ships[1..3]</strong> share one class: each ship has facts (total, remaining, tonsPerUnit) and the kernel applies one formula template to every index: <code>ships[\"[i]\"][\"=\"](\"remainingTons\", \"remaining * tonsPerUnit\")</code>. <strong>train[1]</strong> loads export sugar the same way. The 500 trucks are instances too: <strong>me.trucks.unit[1..500]</strong> with facts <strong>state</strong> (a numeric code the adapter writes on each transition) and <strong>kind</strong>, and class formulas <code>working = state &gt; 1</code>, <code>heavy = kind == 1</code>. The counts by state (trucks.import.enRoute…) are facts the adapter writes, not kernel sums of the instances; where each truck drives is adapter logic (dashed). Click any truck dot to see its instance. <strong>Model</strong> shows the live classes; <strong>Map numbers</strong> gives the kernel path behind each number on the map.",
    hlNodes: ["n-port", "n-ship1", "n-ship2", "n-ship3", "n-train"], hlEdges: ["e-ship1-q", "e-ship2-q", "e-ship3-q", "e-qexp-train"], hlPanels: ["panel-model", "panel-paths"] },
  { title: "2 · Stocks (facts)", body: "<strong>me.cargo.coffee(100000)</strong>, sugar(200000), containers(5000), <strong>me.trucks.fleet(500)</strong> = heavy.fleet(400) + lastMile.fleet(100). A fact changes only when a write says so. <strong>cargo.bulkTons</strong> is a kernel rule: coffee + sugar.",
    hlNodes: ["n-yard"], hlEdges: ["e-port-yard"], hlPanels: ["panel-stocks"] },
  { title: "3 · Ships unloading", body: "Each ship has facts <strong>total, remaining, tonsPerUnit</strong>. Kernel rules: <strong>remainingTons = remaining * tonsPerUnit</strong>, and <strong>importRemaining</strong> = the explicit sum over ships[1], [2], [3]. Laden import trucks (blue) leave Veracruz over the highways, off the map edge.",
    hlNodes: ["n-ship1", "n-ship2", "n-ship3", "n-qimp"], hlEdges: ["e-ship1-q", "e-ship2-q", "e-ship3-q"], hlPanels: ["panel-ships"] },
  { title: "4 · Train loading", body: "<strong>train[1].remainingToLoad</strong> is a fact; <strong>flows.exportRemaining</strong> and <strong>train[1].progress</strong> are kernel rules. Export trucks (amber) come in from outside the map with sugar and unload into the train.",
    hlNodes: ["n-train", "n-qexp", "n-yard"], hlEdges: ["e-yard-qexp", "e-qexp-train"], hlPanels: ["panel-train"] },
  { title: "5 · Trucks by state", body: "Each truck is a kernel instance <strong>me.trucks.unit[n]</strong> (state code, kind); the counts by state are counter facts the adapter writes (<strong>trucks.heavy.available</strong>, <strong>queues.import.length</strong>, <strong>trucks.import.enRoute</strong>, <strong>trucks.lastMile.loading</strong>…). Kernel rules sum them: <strong>trucks.working</strong>, <strong>trucks.accounted</strong>, <strong>trucks.balanced = accounted == fleet</strong>. <em>Where</em> each truck drives is adapter logic (dashed panel).",
    hlNodes: ["n-qimp", "n-qexp", "n-port", "n-yard"], hlEdges: ["e-qimp-port", "e-qexp-train"], hlPanels: ["panel-queues", "panel-adapter"] },
  { title: "6 · Last-mile dispatch", body: "100 small trucks (pink) run an example schedule of <strong>1,000 trips</strong> from CEDIS A (cargo yard) and CEDIS B (example site) to addresses on OSM streets; address points light up when delivered. A greedy plan fills each unit's shift, then units are rebalanced to <strong>avg ± 15%</strong> (amber ring above, cyan below). Trip counters, band limits and per-unit sums are kernel; the heuristic is adapter.",
    hlNodes: ["n-yard", "n-cedisb"], hlEdges: [], hlPanels: ["panel-lastmile"] },
  { title: "7 · Live traffic", body: `Press <strong>Start traffic</strong> (top of this panel; Pause, speed and Reset sit next to it). Speeds are assumptions (heavy ${HEAVY_TRUCK_KMH} km/h, last-mile ${LAST_MILE_KMH} km/h, ±${Math.round(CONFIG.speedSpread * 100)}% per truck; travel time from route metres); the HUD averages are kernel rules over speed sums the adapter samples ≤4×/s, tap a chip for its expression; playback ×10 by default. Each animation tick the adapter flushes <strong>real writes</strong> (one call per changed fact), listed exactly with the kernel's own <strong>k</strong>: each write recomputes only the rules that depend on it, and <strong>k</strong> is how many derived paths it recomputed (read from the kernel, not counted by the page).`,
    hlNodes: ["n-qimp", "n-ship2", "n-port", "n-yard"], hlEdges: ["e-ship2-q", "e-qimp-port"], hlPanels: ["panel-mutate"] },
  { title: "8 · Explain why", body: "<strong>me.explain(\"trips.bandHigh\")</strong> returns the expression, every input with its value, and <strong>sourcePath</strong>, the write that last recomputed it. <strong>Verify</strong> rebuilds a fresh kernel from the facts and compares everything.",
    hlNodes: ["n-port", "n-ship1", "n-ship2", "n-ship3"], hlEdges: ["e-ship1-q", "e-ship2-q", "e-ship3-q"], hlPanels: ["panel-explain", "panel-adapter"] },
];
const STEPS = TOUR.length - 1;
const TOUR_LABEL = "Port Simulation Overview";   // the tour section's fixed header label (no step number)
// ── open / closed state of every collapsible block on the right (one mechanism for all) ──
// "tour" = the Port Simulation Overview strip (fixed header label; the step title is in its body), "kernel" = the kernel
// strip, then the 8 panel sections. Default: only the overview is open. Each block's state is saved under
// localStorage "veracruz-port.open.<id>" = "1" | "0" when the user toggles it, and read once at boot,
// before the first render (no flash, no layout shift).
const SECTION_IDS = ["tour", "kernel", "panel-model", "panel-paths", "panel-mutate", "panel-explain", "panel-ships", "panel-train", "panel-queues", "panel-lastmile", "panel-stocks", "panel-adapter"];
const DEFAULT_OPEN = { tour: true };
const OPEN_KEY = (id) => `veracruz-port.open.${id}`;
const LEGACY_TOUR_KEY = "veracruz-port.tourOpen";   // earlier builds saved only the tour, under this key
const sectionOpen = (id) => !!ui.state.open[id];
function setSectionOpen(id, open, persist = true) {
  if (persist) tourOpened.delete(id);   // the user's own choice: the tour no longer tidies this one away
  if (persist) { try { localStorage.setItem(OPEN_KEY(id), open ? "1" : "0"); } catch (e) { /* storage unavailable */ } }
  if (sectionOpen(id) !== open) ui.set({ open: { ...ui.state.open, [id]: open } });
}
function readOpenState() {
  const open = {};
  for (const id of SECTION_IDS) {
    let v = null;
    try {
      v = localStorage.getItem(OPEN_KEY(id));
      if (v === null && id === "tour") {   // carry over a choice saved by an earlier build, once
        const old = localStorage.getItem(LEGACY_TOUR_KEY);
        if (old === "1" || old === "0") { v = old; localStorage.setItem(OPEN_KEY(id), old); }
        localStorage.removeItem(LEGACY_TOUR_KEY);
      }
    } catch (e) { /* storage unavailable: defaults */ }
    open[id] = v === "1" ? true : v === "0" ? false : !!DEFAULT_OPEN[id];
  }
  return open;
}
// Hiding the overview ends the tour: sections that only the tour had opened close again (the user's saved state).
function setTourOpen(open, persist = true) {
  if (!open) { const patch = closeTourOpened(); if (Object.keys(patch).length) ui.set({ open: { ...ui.state.open, ...patch } }); }
  setSectionOpen("tour", open, persist);
}
// A tour step opens the sections it highlights (a collapsed one would hide what the step talks about).
// That open is not saved: stored state only records the user's own header clicks, so walking through the
// tour never rewrites them (after a reload those sections are back to how the user left them).
// Sections the tour opened (and the user has not touched since) close again when a later step no longer
// highlights them, so the panel stays tidy. Then the highlighted sections are scrolled into view inside the
// panel's own scroll container (stacked layout: the page) and their headers glow briefly.
const tourOpened = new Set();
function closeTourOpened(keep = []) {
  const close = [...tourOpened].filter((id) => !keep.includes(id));
  close.forEach((id) => tourOpened.delete(id));
  return Object.fromEntries(close.map((id) => [id, false]));
}
const setStep = (step) => {
  const n = Math.min(STEPS, Math.max(1, step)), hl = TOUR[n].hlPanels;
  const shut = hl.filter((id) => !sectionOpen(id));
  shut.forEach((id) => tourOpened.add(id));
  const patch = { ...closeTourOpened(hl), ...Object.fromEntries(shut.map((id) => [id, true])) };
  ui.set({ step: n, ...(Object.keys(patch).length ? { open: { ...ui.state.open, ...patch } } : {}) });
  revealSections(hl);
};
const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let revealToken = 0;
function revealSections(ids) {
  const token = ++revealToken, t0 = performance.now();
  // wait until the open / close animations in the panel have settled, so the target positions are final
  const settled = () => [...document.querySelectorAll('[data-gui-node-id="aside/panels"] .MuiCollapse-root')]
    .every((c) => c.classList.contains("MuiCollapse-entered") || c.classList.contains("MuiCollapse-hidden"));
  const go = (pass = 0) => {
    if (token !== revealToken) return;
    if (!settled() && performance.now() - t0 < 2500) return requestAnimationFrame(() => go(pass));
    const secs = ids.map((id) => document.querySelector(`[data-section="${id}"]`)).filter(Boolean);
    if (!secs.length) return;
    const panels = document.querySelector('[data-gui-node-id="aside/panels"]');
    const stacked = window.matchMedia("(max-width:1000px)").matches || !panels;
    const behavior = reducedMotion() ? "auto" : "smooth", pad = 8;
    const vTop = stacked ? 0 : panels.getBoundingClientRect().top, vH = stacked ? window.innerHeight : panels.clientHeight;
    const rects = secs.map((e) => e.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top)) - vTop, bottom = Math.max(...rects.map((r) => r.bottom)) - vTop;
    // "nearest": move only if needed; if the span does not fit, its first header goes to the top
    let dy = 0;
    if (top < pad) dy = top - pad;
    else if (bottom > vH - pad) dy = Math.min(top - pad, bottom - (vH - pad));
    // stacked layout: the tour strip scrolls with the page, so never push its Back / Next row off the top
    if (stacked && dy > 0) { const nb = document.getElementById("btn-next")?.getBoundingClientRect(); if (nb && nb.bottom > 0) dy = Math.min(dy, nb.top - pad); }
    if (Math.abs(dy) >= 1) { if (stacked) window.scrollBy({ top: dy, behavior: pass ? "auto" : behavior }); else panels.scrollBy({ top: dy, behavior: pass ? "auto" : behavior }); }
    // one corrective pass once the smooth scroll is over (a busy page can still be animating when we measure)
    if (!pass) setTimeout(() => go(1), reducedMotion() ? 150 : 800);
    if (pass) return;
    for (const e of secs) {
      const head = e.querySelector("h2"); if (!head) continue;
      head.setAttribute("data-flash", "1");
      setTimeout(() => head.setAttribute("data-flash", "0"), reducedMotion() ? 1200 : 450);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(() => go(0)));
}

// ══════════════════════════ .GUI view: ONE spec tree resolved by GUI.mount ══════════════════════════
// The page is a spec ({ type, props, children, provenance }) that GUI.mount resolves through the GUI
// registry: every node gets data-gui-node-id and is recorded (Spec / provenance) for the Semantic
// Inspector, and Layout Grid outlines it. Kernel readouts are { read: "me/<path>" } props: the renderer
// resolves them through RT and subscribes through RT → the explicit bridge above. mount() puts the same
// me + RT in the runtime environment (useMe / useMeValue read it there), so the page needs no
// MeRuntimeProvider. Page-local registry types (PAGE_TYPES, below) render the page's own components;
// specialized leaves (tour, sim clock, kernel link, verify output, run controls, writes list, explain,
// last-mile strip/estimate/feed, truck canvas) stay internal components: each is a node (id + Spec),
// its insides are not. Decorative nodes carry an id + Spec only; provenance.semanticPath is set only
// where a node shows one kernel path.
const accentColor = (t, accent) => t.palette[t.visuals?.accents?.[accent]?.chip]?.main || t.palette.text.secondary;
const nodeAttrs = (p) => ({ "data-gui-node-id": p["data-gui-node-id"], "data-gui-component": p["data-gui-component"] });

const srcTagSx = (kind) => (t) => { const accent = kind === "adapter" ? "ember" : "aurora"; return { height: 16, fontSize: 8, fontFamily: MONO, letterSpacing: ".08em", textTransform: "uppercase", borderRadius: "3px", color: accentColor(t, accent), borderColor: accentColor(t, accent), borderStyle: kind === "adapter" ? "dashed" : "solid", "& .MuiChip-label": { px: "5px" } }; };
const kindSx = { fontSize: 7.5, color: "text.disabled", letterSpacing: ".06em", textTransform: "uppercase", ml: .5, border: 1, borderColor: "divider", px: "3px", borderRadius: "2px" };

// One kernel readout = one spec node with value: { read: "me/<path>" } (resolved + subscribed by GUI's renderer).
function ValView(p) {
  const { path, value: v, f = fmt, suffix = "", wrap, ch } = p;   // ch: fixed right-aligned slot (digits change, neighbours stay put)
  const el = h(Box, { component: "span", ...nodeAttrs(p), "data-me-path": path, "data-me-value": String(v), ...(ch ? { sx: { display: "inline-block", minWidth: `${ch}ch`, textAlign: "right" } } : {}) }, f(v) + suffix);
  return wrap ? h(wrap, null, el) : el;
}
function SumView(p) {   // display-side sum of two kernel reads (legend only)
  return h(Box, { component: "span", ...nodeAttrs(p) }, fmt((p.values || []).reduce((a, b) => a + b, 0)));
}
function BarView(p) {
  const v = p.value;
  return h(Progress, { ...nodeAttrs(p), variant: "determinate", color: p.color || "primary", value: Math.max(0, Math.min(100, (Number(v) || 0) * 100)), "data-me-path": p.path, sx: { height: 4, borderRadius: 2, mt: .5 } });
}

// A value keeps the widest width it has shown (numbers pre-padded to 3 digits), so its key never re-wraps
// as digits change: rows keep a constant height while values stream in.
const reserveChars = (text) => [...text.replace(/\d[\d,.]*/g, (d) => d.padStart(3, "0")).replace(/\btrue\b/g, "false")].length;
function useReservedWidth(minCh = 0) {   // ref for an element that keeps the widest width its text has shown
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let max = 0;
    const fit = () => { const n = Math.max(minCh, reserveChars(el.textContent)); if (n > max) { max = n; el.style.minWidth = n + "ch"; } };
    fit();
    const mo = new MutationObserver(fit); mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [minCh]);
  return ref;
}
function Row(p) {
  const { k, kind, children, minCh = 0 } = p;
  const ref = useReservedWidth(minCh);
  return h(Box, { ...nodeAttrs(p), sx: { display: "flex", justifyContent: "space-between", gap: 1, py: "3px", borderBottom: 1, borderColor: "divider", fontFamily: MONO, fontSize: 10.5, "&:last-of-type": { borderBottom: 0 } } },
    h(Box, { component: "span", sx: { color: "text.secondary", minWidth: 0 } }, k, h(Box, { component: "span", sx: kindSx }, kind)),
    h(Box, { component: "span", ref, sx: { color: "primary.main", textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 } }, children));
}
const Formula = (p) => h(Box, { ...nodeAttrs(p), sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mt: .75, p: "5px 7px", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", lineHeight: 1.45, "& b": { color: "primary.main", fontWeight: 500, display: "inline-block", minWidth: "7ch", textAlign: "right", whiteSpace: "nowrap" } } }, p.children);
const SUB_SX = { fontFamily: MONO, fontSize: 9, color: "text.secondary", mt: .75, lineHeight: 1.4 };

// Collapsible sections: the same ▸/▾ caret as the kernel strip and the tour (Port Simulation Overview).
// Open / closed state and its storage: see SECTION_IDS above (default collapsed, remembered per section).
// Collapsing only hides the body (MUI Collapse keeps it mounted): kernel reads, the adapter and the live
// counters keep running, and reopening shows current values. Fixed heights and internal scrolling are untouched.
// Spec nodes: <id> (section) → <id>/header (h2: title + badges) → <id>/toggle (caret button), and <id>/body.
// The caret toggles (here, the kernel strip, the tour) are marked as inspector controls, so they keep working
// while the Semantic Inspector is on; a click anywhere else on a header still inspects it.
const CARET_SX = { ml: "auto", flexShrink: 0, minWidth: 0, px: .5, py: 0, lineHeight: "16px", fontFamily: MONO, fontSize: 10, fontWeight: 400, letterSpacing: "normal", textTransform: "none", color: "text.disabled" };
function Panel(p) {
  const { id, children } = p;
  useStore(ui);
  return h(Box, { ...nodeAttrs(p), "data-section": id, "data-open": sectionOpen(id) ? "1" : "0" }, children);
}
function SectionHeader(p) {   // children: title, badge chips, toggle (spec nodes)
  const { section, children } = p;
  return h(Typography, { component: "h2", ...nodeAttrs(p), onClick: () => setSectionOpen(section, !sectionOpen(section)),
    // tour glow (data-flash, set by revealSections): a box-shadow ring that fades; no layout effect; no fade with reduced motion
    sx: (t) => ({ fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "text.secondary", display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap", cursor: "pointer", userSelect: "none", "&:hover": { color: "text.primary" },
      borderRadius: "3px", boxShadow: `0 0 0 2px ${alpha(t.palette.primary.main, 0)}`, transition: "box-shadow 1.2s ease-out",
      "&[data-flash='1']": { boxShadow: `0 0 0 2px ${alpha(t.palette.primary.main, .75)}, 0 0 10px ${alpha(t.palette.primary.main, .45)}`, transition: "none" },
      "@media (prefers-reduced-motion: reduce)": { transition: "none" } }) },
    children);
}
function SectionToggle(p) {   // no onClick of its own: the click bubbles to the header, keyboard Enter/Space included
  const { section, title } = p;
  useStore(ui);
  const open = sectionOpen(section);
  return h(Button, { ...nodeAttrs(p), id: `${section}-toggle`, size: "small", "data-gui-inspector-control": "true", "aria-expanded": open, "aria-controls": section,
    "aria-label": `${open ? "Hide" : "Show"} ${title}`, title: `${open ? "Hide" : "Show"} this section`, sx: CARET_SX }, open ? "▾ hide" : "▸ show");
}
function SectionBody(p) {
  const { id, adapter = false, children } = p;
  const { step } = useStore(ui);
  const hl = !!TOUR[step]?.hlPanels.includes(id);
  return h(Collapse, { ...nodeAttrs(p), in: sectionOpen(id) },
    h(Box, { sx: { pt: .75 } },
      h(Paper, { id, variant: "outlined", "data-hl": hl ? "1" : "0", sx: (t) => ({ p: "8px 10px", borderRadius: "4px", borderStyle: adapter ? "dashed" : "solid", borderColor: hl ? t.palette.primary.main : adapter ? accentColor(t, "ember") : t.palette.divider, background: hl ? t.visuals.accents.aurora.soft : t.visuals.accents.neutral.soft, transition: "border-color .2s, background .2s" }) }, children)));
}

// ── chrome ──
const LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
// Inspector toggle: visible at every width. Two instances of the same GUI.InspectorToggle share GUI's one
// inspector state; CSS shows exactly one: the full label on a wide bar, a compact one on a bar of 1100px or less.
// Sizes are container queries on the top bar itself (not the viewport): opening the inspector panel splits
// the window and narrows the page, so the bar adapts to the width it really has. Container widths are the
// bar's content box (bar width minus 28px of padding), so 1072px here is a 1100px bar.
// Fixed min widths so "on"/"off" never nudges the top bar.
const INSPECTOR_TITLE = "Semantic Inspector (.GUI devtools): turn on, click a map node, then Explain. Clicks inspect instead of acting while it is on.";
const INSPECTOR_SX = { minWidth: 0, py: .25, lineHeight: 1.4, fontFamily: MONO, fontSize: 11, textTransform: "none", color: "text.secondary", borderColor: "divider", whiteSpace: "nowrap",
  "&.MuiButton-contained": { color: "success.contrastText" } }; // "on" is a filled button: keep its label legible
const INSPECTOR_ACTION = h(Box, { component: "span", "data-gui-node-id": "brand/inspector", sx: { display: "inline-flex", alignItems: "center", flexShrink: 0 } },
  h(Box, { component: "span", className: "insp-full", sx: { display: "inline-flex", "@container brandbar (max-width: 1072px)": { display: "none" } } },
    h(G.InspectorToggle, { id: "inspector-toggle", "data-gui-inspector-control": true, show: "both", label: "Inspector", onText: "on", offText: "off", size: "small", variant: "button",
      title: INSPECTOR_TITLE, sx: { ...INSPECTOR_SX, px: 1, minWidth: "calc(15ch + 16px)" } })),
  h(Box, { component: "span", className: "insp-compact", sx: { display: "none", "@container brandbar (max-width: 1072px)": { display: "inline-flex" } } },
    h(G.InspectorToggle, { id: "inspector-toggle-compact", "data-gui-inspector-control": true, show: "state", onText: "Insp on", offText: "Insp off", size: "small", variant: "button",
      "aria-label": "Semantic Inspector", title: INSPECTOR_TITLE, sx: { ...INSPECTOR_SX, py: .125, px: .75, minWidth: "calc(8ch + 12px)" } })));

// Kernel link (kernel strip): text, target and title come from the running kernel's in-browser check.
const NPM_KERNEL = "https://www.npmjs.com/package/this.me";
function KernelLink(p) {
  const { before = "", after = "", id, minCh } = p;
  const { kernel: k } = useStore(ui);
  const ok = k.state === "ok", label = ok ? `${before}this.me@${k.version} · sha256 ${k.hash.slice(0, 8)}${after}`
    : `${before}this.me · ${k.state === "loading" ? "verifying…" : k.mismatch ? "sha256 mismatch" : "not loaded"}`;
  return h(Link, { id, ...nodeAttrs(p), className: "kver " + (ok ? "ok" : k.state === "loading" ? "verifying" : k.mismatch ? "mismatch" : "failed"),
    href: ok ? `${NPM_KERNEL}/v/${encodeURIComponent(k.version)}` : NPM_KERNEL, target: "_blank", rel: "noopener", underline: "hover",
    title: ok ? `sha256 ${k.hash} (verified in this browser)\nloaded: ${k.url}` : k.detail || "Checking the kernel file's sha256 in this browser…",
    sx: { display: "inline-block", minWidth: `${minCh}ch`, whiteSpace: "nowrap", color: ok ? "primary.main" : k.state === "loading" ? "text.secondary" : "error.main" } }, label);
}

// Everything about the UI layer lives here (version, where the build is served from, its hash check, docs).
const GUI_DOCS = [[".GUI docs", "https://neurons-me.github.io/GUI/docs/"], ["GUI.mount", "https://neurons-me.github.io/GUI/docs/doc.html?f=GUI-Mount.md"], ["Storybook", "https://neurons-me.github.io/GUI/storybook/"]];
// All .GUI details in one place (kernel strip → provenance → .GUI): build, PR, served file + its hash check, docs.
function GuiBuildInfo(p) {
  const { gui } = useStore(ui);
  const a = (href, text, title) => h(Link, { href, target: "_blank", rel: "noopener", underline: "hover", title }, text);
  const check = gui?.state === "ok" ? h("b", { key: "v" }, "verified") : gui?.state === "error" ? h(Box, { component: "span", sx: { color: "error.main" } }, "check failed") : "checking…";
  return h(Box, { component: "span", ...nodeAttrs(p) },
    a(GUI_PIN.npm, GUI_PIN.label, "npm: this.gui@4.1.0"), " · ", a(GUI_PIN.repo, "neurons-me/GUI", "neurons-me/GUI"), ` @${GUI_PIN.commit} · jsDelivr, SRI + sha256 · `,
    a(GUI_PIN.url, "this.gui.umd.js", `sha256 ${GUI_PIN.sha256}`), " sha256 ", GUI_PIN.sha256.slice(0, 12), "… ", check,
    " · docs: ", ...GUI_DOCS.flatMap(([t, u], i) => [i ? " · " : "", a(u, t)]));
}
// Kernel failure line (in the kernel strip and the overview). Only on error: while loading, the strip's
// "verifying…" link already says so, and a loading line that vanishes on success would shift what is below it.
function KernelLine() {
  const { kernel } = useStore(ui);
  const err = kernel.state === "error";
  if (!err) return null;
  return h(Typography, { id: "kernel-status", component: "div", sx: { fontFamily: MONO, fontSize: 9.5, color: err ? "error.main" : "text.secondary", px: 1.5, py: .75, borderBottom: 1, borderColor: "divider", lineHeight: 1.4, "& b": { color: err ? "error.main" : "success.main", fontWeight: 500 } }, dangerouslySetInnerHTML: { __html: kernel.text } });
}

function KernelStrip(p) {   // children: provenance rows (spec nodes), shown under the header line when open
  useStore(ui);
  const kernelOpen = sectionOpen("kernel");
  return h(Box, { id: "kernel-wrap", ...nodeAttrs(p), "data-open": kernelOpen ? "1" : "0", sx: { flexShrink: 0, borderBottom: 1, borderColor: "divider" } },
    h(Box, { sx: { display: "flex", alignItems: "center", gap: .75, px: 1.5, py: .75, borderBottom: kernelOpen ? 1 : 0, borderColor: "divider", fontFamily: MONO, fontSize: 10, color: "text.secondary", minHeight: 36 } },
      h(Box, { component: "span", sx: { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, whiteSpace: "nowrap" } },
        "kernel: ", h(KernelLink, { id: "kver-aside", minCh: 28 })),
      h(Button, { id: "kernel-toggle", "data-gui-inspector-control": "true", size: "small", onClick: () => setSectionOpen("kernel", !kernelOpen), "aria-expanded": kernelOpen, "aria-controls": "kernel-panel", title: "Show / hide kernel details: build provenance",
        sx: { ml: "auto", flexShrink: 0, minWidth: 0, px: .75, py: .25, fontFamily: MONO, fontSize: 10, textTransform: "none", color: "text.disabled" } },
        kernelOpen ? "▾ hide" : "▸ kernel")),
    h(Collapse, { in: kernelOpen, id: "kernel-panel" },
      h(KernelLine),
      p.children));
}
function TourStrip(p) {
  const { step } = useStore(ui);
  const tourOpen = sectionOpen("tour"), t = TOUR[step];
  return h(Box, { id: "tour-wrap", ...nodeAttrs(p), "data-open": tourOpen ? "1" : "0", sx: { flexShrink: 0, borderBottom: 1, borderColor: "divider" } },
    h(Button, { id: "tour-toggle", "data-gui-inspector-control": "true", fullWidth: true, onClick: () => setTourOpen(!tourOpen), "aria-expanded": tourOpen, "aria-controls": "tour-panel", "aria-label": "Port Simulation Overview (guided tour)", title: "Show / hide the Port Simulation Overview (guided tour)",
      sx: { justifyContent: "flex-start", gap: .75, px: 1.5, py: .9, borderRadius: 0, fontFamily: MONO, fontSize: 10, textTransform: "none", color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", borderBottom: tourOpen ? 1 : 0, borderColor: "divider" } },
      // fixed section label; the current step's number + title is shown once, inside the body (#tour-title)
      h(Box, { component: "span", id: "tt-label", sx: { color: "primary.main", fontSize: 12.5, fontWeight: 500, letterSpacing: ".02em", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 } }, TOUR_LABEL),
      h(Box, { component: "span", id: "tt-caret", sx: { ml: "auto", color: "text.disabled", flexShrink: 0 } }, tourOpen ? "▾ hide" : "▸ tour")),
    h(Collapse, { in: tourOpen, id: "tour-panel" },
      h(KernelLine),
      h(Box, { sx: { px: 1.5, pt: 1.25, pb: 1 } },
        h(Box, { id: "tour-steps", sx: { display: "flex", gap: "3px", flexWrap: "wrap", mb: 1 } },
          ...Array.from({ length: STEPS }, (_, i) => i + 1).map((i) => h(Button, { key: i, size: "small", title: TOUR[i].title, variant: i === step ? "outlined" : "text", color: i < step ? "success" : "primary", onClick: () => setStep(i), sx: { minWidth: 24, width: 24, height: 24, p: 0, fontFamily: MONO, fontSize: 10, color: i === step ? "primary.main" : i < step ? "success.main" : "text.secondary" } }, String(i)))),
        h(Typography, { id: "tour-title", sx: { fontFamily: MONO, fontSize: 10.5, color: "primary.main", letterSpacing: ".07em", textTransform: "uppercase", mb: .6 } }, t.title),
        h(Typography, { id: "tour-body", component: "div", sx: { fontSize: 12, lineHeight: 1.4, minHeight: "3.2em", "& strong": { fontWeight: 600, color: "text.primary" }, "& code": { fontFamily: MONO, fontSize: 10.5, color: "primary.main", wordBreak: "break-word" } }, dangerouslySetInnerHTML: { __html: t.body } }),
        h(Box, { sx: { display: "flex", gap: .75, mt: 1.25, alignItems: "center" } },
          h(Button, { id: "btn-prev", size: "small", variant: "text", disabled: step <= 1, onClick: () => setStep(step - 1), sx: { fontFamily: MONO, fontSize: 11 } }, "Back"),
          h(Button, { id: "btn-next", size: "small", variant: "outlined", onClick: () => setStep(step >= STEPS ? 1 : step + 1), sx: { fontFamily: MONO, fontSize: 11 } }, step >= STEPS ? "Restart" : "Next"),
          h(Typography, { id: "step-label", sx: { ml: "auto", fontFamily: MONO, fontSize: 10, color: "text.disabled" } }, `${step} / ${STEPS}`)))));
}

// ── panel leaves (page state, not kernel paths) ──
// Primary traffic controls: one compact row pinned at the top of the right panel (never inside a collapsible
// section). Fixed height and fixed-width button labels, so switching Start / Pause never moves anything.
// The buttons and the speed selector act even while the .GUI inspector is on (inspector controls).
function RunControls(p) {
  const { running: on, finished, speed, me } = useStore(ui);
  const ctl = { "data-gui-inspector-control": "true" };
  const runLabel = finished ? "All work done ✓" : on ? "Pause ■" : "Start traffic ▸";
  const runTitle = finished ? "All work done. Press Reset to replay." : on ? "Pause the traffic" : "Start the traffic: 500 trucks, real me.… kernel writes";
  return h(Box, { ...nodeAttrs(p), id: "run-controls", role: "toolbar", "aria-label": "Traffic controls", sx: { flexShrink: 0, display: "flex", gap: .75, alignItems: "center", px: 1.5, py: .75, height: 46, boxSizing: "border-box", borderBottom: 1, borderColor: "divider" } },
    h(Button, { id: "btn-run", ...ctl, variant: on ? "outlined" : "contained", disableElevation: true, disabled: !me || finished, onClick: () => setRunning(!running), title: runTitle,
      sx: { flex: 1, minWidth: 0, height: 30, fontFamily: MONO, fontSize: 11, textTransform: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, runLabel),
    h(TextField, { id: "sel-speed", select: true, size: "small", value: String(speed), onChange: (e) => ui.set({ speed: Number(e.target.value) || 10 }), inputProps: { "aria-label": "Playback speed (1 s real = N s simulated)" }, SelectProps: { SelectDisplayProps: ctl }, title: "Playback: 1 s real = N s simulated",
      sx: { width: 112, flexShrink: 0, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10.5, height: 30 } } },
      h(MenuItem, { value: "1", sx: { fontFamily: MONO, fontSize: 11 } }, "×1 real time"), h(MenuItem, { value: "10", sx: { fontFamily: MONO, fontSize: 11 } }, "×10"), h(MenuItem, { value: "60", sx: { fontFamily: MONO, fontSize: 11 } }, "×60")),
    h(Button, { id: "btn-reset", ...ctl, variant: "outlined", disabled: !me, onClick: resetKernel, title: "Reset the kernel and the traffic to the seed", sx: { flexShrink: 0, height: 30, minWidth: 0, px: 1.25, fontFamily: MONO, fontSize: 10.5, textTransform: "none", color: "text.secondary", borderColor: "divider" } }, "Reset"));
}
const OK_DOC = "https://neurons-me.github.io/Inverted-Dependency-Indexing-Beautiful-Viz.html";
function InfoLink({ id, href, title }) {
  return h(Link, { id, href, target: "_blank", rel: "noopener", title, "aria-label": title, underline: "none",
    sx: (t) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 12, height: 12, ml: .5, verticalAlign: "1px", borderRadius: "50%", border: 1, borderColor: "currentColor", fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 8.5, lineHeight: 1, color: "text.secondary", "&:hover": { color: t.palette.primary.main } }) }, "i");
}
function Stat({ id, label, value, adapter, info }) {
  return h(Box, { sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", border: 1, borderColor: "divider", borderRadius: "3px", p: "4px 5px", bgcolor: "background.default", borderStyle: adapter ? "dashed" : "solid" } },
    label, info ? h(InfoLink, info) : null, h(Box, { id, component: "b", sx: (t) => ({ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, fontWeight: 500, color: adapter ? accentColor(t, "ember") : t.palette.primary.main }) }, value));
}
function Stats(p) {
  useStore(sim);
  const now = performance.now(), win = flushLog.filter((f) => now - f.t <= 1000);
  return h(Box, { ...nodeAttrs(p), sx: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: .5, mt: .75 } },
    h(Stat, { id: "st-wps", label: "writes/s", value: fmt(win.reduce((a, f) => a + f.n, 0)) }),
    h(Stat, { id: "st-fps-flush", label: "flushes/s", value: fmt(win.length) }),
    h(Stat, { id: "st-k", label: "recent k", info: { id: "st-k-info", href: OK_DOC, title: "What is k? O(k) reactivity, visualized" }, value: win.length && lastFlush ? `${lastFlush.writes[lastFlush.writes.length - 1].k}·max ${Math.max(...win.map((f) => f.kMax))}` : "—" }),
    h(Stat, { id: "st-writes", label: "total writes", value: fmt(writeCount) }),
    h(Stat, { id: "st-fps", label: "fps (page)", value: fmt(frameLog.filter((t) => now - t <= 1000).length), adapter: true }),
    h(Stat, { id: "st-moving", label: "moving dots", value: fmt(moving), adapter: true }));
}
// The writes list has a fixed height and never auto-scrolls. Its rows are keyed per flush, so each flush
// renders fresh rows instead of re-flowing the old ones (an existing row moving down would count as layout shift). While the pointer is over it or it was just
// scrolled, its content is held (the shown flush stays put) so it can be read; the header says so.
const wHold = { hover: false, until: 0, topAfterRender: 0, shown: null };
const holdWrites = (ms) => { wHold.until = Math.max(wHold.until, performance.now() + ms); };
const flushMetaText = (f) => `flush #${f.idx} · sim ${clock(f.sim)} · ${f.writes.length} real writes (one per changed fact) · k ${f.writes.map((w) => w.k).join("·")}`;
function Writes(p) {   // node id on the list itself (the header line above it belongs to it)
  useStore(sim);
  const ulRef = React.useRef(null);
  const held = !!(lastFlush && wHold.shown && wHold.shown !== lastFlush && (wHold.hover || performance.now() < wHold.until));
  if (!lastFlush) wHold.shown = null; else if (!held) wHold.shown = lastFlush;
  const shown = wHold.shown;
  React.useLayoutEffect(() => { if (ulRef.current) wHold.topAfterRender = ulRef.current.scrollTop; });
  const meta = shown ? flushMetaText(shown) : "Each animation tick the adapter flushes its pending deltas: one real write per changed fact.";
  const items = shown ? shown.writes.map((w, i) => {
    const note = w.note ? `// ${w.note}` : w.hauls ? `// ${sgn(w.delta)} · ${w.hauls} ${w.source.startsWith("trips.") || w.source.startsWith("localDelivery.") ? "deliver" + (w.hauls > 1 ? "ies" : "y") : "haul" + (w.hauls > 1 ? "s" : "")}` : `// ${sgn(w.delta)}`;
    return h(Box, { component: "li", key: `${shown.idx}:${i}`, sx: { py: .5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
      h(Box, { component: "code", sx: { color: "text.primary" } }, w.code), h(Box, { component: "span", sx: { color: "warning.main", ml: .75 } }, `k=${w.k}`), h(Box, { component: "span", sx: { color: "text.disabled", ml: .75 } }, note),
      h(Box, { component: "span", sx: { display: "block", color: "text.disabled", mt: .25, wordBreak: "break-all" } }, "recomputed: ",
        w.recomputed.length ? w.recomputed.flatMap((p, j) => [j ? ", " : "", w.changed.includes(p) ? h(Box, { component: "span", key: p, sx: { color: "primary.main" } }, p) : p]) : "no dependents"));
  }) : [h(Box, { component: "li", key: "e", sx: { color: "text.disabled" } }, "No writes yet: press Start.")];
  return h(React.Fragment, null,
    h(Typography, { component: "div", sx: { ...SUB_SX, color: "text.disabled", height: 24, lineHeight: "12px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" } },
      // keyed by the hold state: the "held" note swaps in fresh text instead of pushing the old text aside (no layout shift on hover)
      h("span", { id: "flush-meta", key: held ? "held" : "live", title: meta }, held ? h(Box, { component: "span", sx: { color: "warning.main" } }, `held while you read · latest #${lastFlush.idx}`) : null, held ? " · " : null, meta)),
    h(Box, { component: "ul", id: "writes", ref: ulRef, ...nodeAttrs(p),
      onPointerEnter: (e) => { if (e.pointerType === "mouse") wHold.hover = true; },
      onPointerLeave: () => { wHold.hover = false; holdWrites(600); },
      onTouchStart: () => holdWrites(4000), onWheel: () => holdWrites(2500),
      onScroll: (e) => { if (e.currentTarget.scrollTop !== wHold.topAfterRender) holdWrites(2500); },
      sx: { listStyle: "none", m: 0, p: 0, fontFamily: MONO, fontSize: 9.5, mt: .75, height: 240, overflowY: "auto", overflowAnchor: "none", contain: "strict", scrollbarGutter: "stable", borderTop: 1, borderColor: "divider" } }, ...items));
}

const EXPLAIN_PATHS = ["flows.importRemaining", "ships.2.remainingTons", "train.1.progress", "trucks.unit.1.working", "flows.exportRemaining", "flows.importProgress", "trips.bandHigh", "trips.perUnitAvg", "trips.balanced", "lastMile.unitsOk", "trucks.working", "trucks.balanced", "trucks.inQueue", "queues.import.busy", "port.busy", "cargo.bulkTons"];
function useWave(path) {   // re-render when the kernel reports `path` in a wave, even if its value did not change
  const { runtime } = G.useMe();
  const [, setN] = React.useState(0);
  React.useEffect(() => runtime?.subscribe?.(path, () => setN((x) => x + 1)), [runtime, path]);
}
const ONE_LINE = { display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
function ExplainView({ path, na }) {
  useWave(path);
  const { me } = G.useMe();
  const [raw, setRaw] = React.useState(false);
  let ex, err = null;
  try { ex = me.explain(path); } catch (e) { err = e?.message || String(e); }
  if (err) return h(Typography, { ...na, sx: { fontFamily: MONO, fontSize: 9.5, color: "error.main" } }, "explain failed: " + err);
  const m = ex?.meta || {};
  const em = (s) => h(Box, { component: "span", sx: { color: "primary.main" } }, s);
  const inputs = ex?.derivation?.inputs || [];
  const rows = [
    ["path", ex.path], ["value", em(fmt(ex.value))], ["expression", ex.expr ?? "— (fact)"],
    ["inputs", inputs.length ? inputs.map((i, j) => h(Box, { component: "span", key: j, title: `${i.label} = ${fmt(i.value)}`, sx: ONE_LINE }, `${i.label} = `, em(fmt(i.value)))) : "—"],
    ["dependsOn", (m.dependsOn || []).join(", ") || "—"],
    ["last wave", m.sourcePath ? h(React.Fragment, null, "write to ", em(m.sourcePath), ` · k=${m.k} · recomputed: ${(m.recomputed || []).join(", ")}`) : "not recomputed yet (no write has reached it since seed)"],
  ];
  return h(React.Fragment, null,
    h(Box, { id: "explain-grid", ...na, sx: { fontFamily: MONO, fontSize: 9.5, lineHeight: 1.5 } }, ...rows.map(([l, v]) =>
      h(Box, { key: l, sx: { display: "grid", gridTemplateColumns: "78px 1fr", gap: .5, py: .25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
        h(Box, { component: "span", sx: { color: "text.disabled" } }, l), h(Box, { component: "span", sx: l === "value" ? ONE_LINE : l === "last wave" ? { wordBreak: "break-word", height: 57, overflowY: "auto", overflowAnchor: "none" } : { wordBreak: "break-word" } }, v)))),
    h(Formula, null, h("span", { id: "explain-code" }, `me.explain(${JSON.stringify(path)})`)),
    h(Button, { size: "small", onClick: () => setRaw(!raw), sx: { mt: .5, p: 0, minWidth: 0, fontFamily: MONO, fontSize: 9.5, textTransform: "none", color: "text.secondary" } }, (raw ? "▾ " : "▸ ") + "raw explain() JSON"),
    h(Collapse, { in: raw, unmountOnExit: true }, h(Box, { component: "pre", id: "explain-raw", sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 220, overflow: "auto", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", p: .75, mt: .5 } }, JSON.stringify(ex, null, 2))));
}
function ExplainLeaf(p) {   // path picker + me.explain() view (component state); node id on the explain grid
  const [path, setPath] = React.useState(EXPLAIN_PATHS[0]);
  return h(React.Fragment, null,
    h(TextField, { id: "ex-select", select: true, size: "small", fullWidth: true, value: path, onChange: (e) => setPath(e.target.value), inputProps: { "aria-label": "Path to explain" }, sx: { mb: .75, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10 } } },
      ...EXPLAIN_PATHS.map((x) => h(MenuItem, { key: x, value: x, sx: { fontFamily: MONO, fontSize: 11 } }, x))),
    h(ExplainView, { path, na: nodeAttrs(p) }));
}

// One live me.explain() of a class-template instance (Model card). Fixed height; pick the instance.
const CX_LINE = { display: "grid", gridTemplateColumns: "62px minmax(0, 1fr)", gap: .5, height: 16, lineHeight: "16px" };
function ClassExplain(p) {
  const { family, ids, name } = p;
  const [sel, setSel] = React.useState(ids[0]);
  const path = `${family}.${sel}.${name}`;
  useWave(path);
  const { me } = G.useMe();
  let ex = null;
  try { ex = me.explain(path); } catch (e) { /* shown as — */ }
  const m = ex?.meta || {}, inputs = ex?.derivation?.inputs || [];
  const em = (t) => h(Box, { component: "span", sx: { color: "primary.main" } }, t);
  const line = (k, v, title) => h(Box, { key: k, sx: CX_LINE }, h(Box, { component: "span", sx: { color: "text.disabled" } }, k), h(Box, { component: "span", title, sx: ONE_LINE }, v));
  const inputsText = inputs.map((x) => `${x.path} = ${fmt(x.value)}`).join(" · ");
  return h(Box, { ...nodeAttrs(p), sx: { mt: .75, fontFamily: MONO, fontSize: 9.5, p: "5px 7px", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px" } },
    h(Box, { sx: { display: "flex", alignItems: "center", gap: .5, height: 20, mb: .25 } },
      h(Box, { component: "span", sx: { ...ONE_LINE, color: "text.secondary", flex: 1, minWidth: 0 } }, `me.explain("${path}")`),
      ids.length > 1 ? ids.map((i) => h(Button, { key: i, size: "small", variant: i === sel ? "outlined" : "text", "aria-pressed": i === sel, title: `Explain ${family}[${i}].${name}`, onClick: () => setSel(i),
        sx: { minWidth: 28, height: 18, p: 0, fontFamily: MONO, fontSize: 9.5, color: i === sel ? "primary.main" : "text.secondary" } }, `[${i}]`)) : null),
    line("expression", h(React.Fragment, null, ex?.expr ?? "—", h(Box, { component: "span", sx: { color: "text.disabled" } }, `  · ${family}["[i]"] template`)), ex?.expr),
    line("inputs", inputs.length ? inputs.map((x, j) => h(React.Fragment, { key: j }, j ? " · " : "", `${x.path} = `, em(fmt(x.value)))) : "—", inputsText),
    line("value", em(fmt(ex?.value))),
    line("last wave", m.sourcePath ? h(React.Fragment, null, "write ", em(m.sourcePath), ` · k=${m.k}`) : "not recomputed yet (press Start traffic)", (m.recomputed || []).join(", ")));
}

// Map overlay colours: the truck card and the HUD expression popover are page content docked INSIDE GUI.OpenStreetMap
// (OpenStreetMap.Overlay), so they use the map's own theme-derived overlay variables (set on the map root for the
// current theme and mode). Nothing on the map is pinned to dark ink any more; it follows the page theme.
const OV = { primary: "var(--gui-osm-overlay-strong)", secondary: "var(--gui-osm-overlay-text)", disabled: "var(--gui-osm-overlay-muted)",
  divider: "var(--gui-osm-overlay-border)", accent: "var(--gui-osm-overlay-accent)", ember: "var(--gui-osm-tone-warning)", bg: "var(--gui-osm-overlay-bg)" };
// The truck instance picked on the map: me.trucks.unit[n] live, with one me.explain(). A docked map overlay with a
// fixed size (so it never moves anything); before a pick it is a one-line hint. Clicks on the map are hit-tested
// by the adapter against the dot positions it drew (positions are adapter, not kernel).
const TC_LINE = { display: "grid", gridTemplateColumns: "70px minmax(0, 1fr)", gap: .5, height: 16, lineHeight: "16px" };
const TC_H = 222;
function TruckCard(p) {
  const { n } = useStore(pick);
  const base = `trucks.unit.${n}`;
  useWave(`${base}.state`); useWave(`${base}.working`);
  const { me } = G.useMe();
  const ctl = { "data-gui-inspector-control": "true" };
  const boxSx = { fontFamily: MONO, fontSize: 9.5, bgcolor: OV.bg, border: 1, borderColor: OV.divider, borderRadius: "4px", color: OV.secondary };
  if (!n || !me) return h(OSM.Overlay, { position: "top-left", interactive: false, hideBelow: 640 },
    h(Box, { ...nodeAttrs(p), id: "truck-card", "data-state": "hint", sx: { ...boxSx, height: 22, lineHeight: "20px", px: "7px", boxSizing: "border-box", whiteSpace: "nowrap" } },
      "click a truck dot → me.trucks.unit[n]"));
  const R = (k) => me(`${base}.${k}`);
  const state = R("state"), kind = R("kind"), working = R("working"), heavy = R("heavy");
  let ex = null; try { ex = me.explain(`${base}.working`); } catch (e) { /* shown as — */ }
  const m = ex?.meta || {}, inputs = ex?.derivation?.inputs || [];
  // live values sit in fixed-width slots (or end the line), so nothing after them moves when they change (CLS 0)
  const em = (t, path, v, ch) => h(Box, { component: "span", sx: { color: OV.accent, ...(ch ? { display: "inline-block", width: `${ch}ch` } : {}) }, ...(path ? { "data-me-path": path, "data-me-value": String(v) } : {}) }, t);
  const line = (k, v, title) => h(Box, { key: k, sx: TC_LINE }, h(Box, { component: "span", sx: { color: OV.disabled } }, k), h(Box, { component: "span", title, sx: ONE_LINE }, v));
  const dim = (t) => h(Box, { component: "span", sx: { color: OV.disabled } }, t);
  const st = TRUCK_STATES[state];
  const step = (d) => pick.set({ n: ((n - 1 + d + FLEET) % FLEET) + 1 });
  const btn = (label, title, onClick) => h(Button, { size: "small", title, "aria-label": title, onClick, ...ctl, sx: { minWidth: 20, height: 18, p: 0, fontFamily: MONO, fontSize: 11, color: OV.secondary } }, label);
  return h(OSM.Overlay, { position: "top-left" },
    h(Box, { ...nodeAttrs(p), id: "truck-card", "data-state": "picked", "data-unit": n, role: "region", "aria-label": `Truck instance me.trucks.unit[${n}]`,
      sx: { ...boxSx, width: 316, maxWidth: "100%", height: TC_H, p: "5px 7px", boxSizing: "border-box", overflow: "hidden" } },
      h(Box, { sx: { display: "flex", alignItems: "center", gap: .25, height: 20, mb: .25 } },
        h(Box, { component: "span", sx: { ...ONE_LINE, flex: 1, minWidth: 0, color: OV.primary, fontSize: 10.5 } }, `me.trucks.unit[${n}]`),
        btn("‹", "Previous truck instance", () => step(-1)), btn("›", "Next truck instance", () => step(1)), btn("×", "Close truck instance", () => pick.set({ n: null }))),
      line("state", h(React.Fragment, null, em(fmt(state), `${base}.state`, state, 3), dim("adapter fact · "), st ?? "?"), `trucks.unit.${n}.state = ${state} (${st}); the adapter writes it on each transition`),
      line("kind", h(React.Fragment, null, em(fmt(kind), `${base}.kind`, kind, 3), dim("fact · "), TRUCK_KIND[kind] ?? "?")),
      line("working", h(React.Fragment, null, em(String(working), `${base}.working`, working, 6), dim("template state > 1"))),
      line("heavy", h(React.Fragment, null, em(String(heavy), `${base}.heavy`, heavy, 6), dim("template kind == 1"))),
      h(Box, { sx: { ...ONE_LINE, height: 18, lineHeight: "18px", mt: .5, pt: "2px", borderTop: 1, borderColor: OV.divider, color: OV.secondary } }, `me.explain("${base}.working")`),
      line("expression", h(React.Fragment, null, ex?.expr ?? "—", dim(`  · trucks.unit["[i]"] template`)), ex?.expr),
      line("inputs", inputs.length ? inputs.map((x, j) => h(React.Fragment, { key: j }, j ? " · " : "", `${x.path} = `, em(fmt(x.value)))) : "—", inputs.map((x) => `${x.path} = ${x.value}`).join(" · ")),
      line("value", em(String(ex?.value))),
      line("last wave", m.sourcePath ? h(React.Fragment, null, "write ", em(m.sourcePath), ` · k=${m.k}`) : "not recomputed yet (no state write since seed)", (m.recomputed || []).join(", ")),
      h(Box, { sx: { ...TC_LINE, mt: .5, pt: "2px", height: 18, borderTop: 1, borderColor: OV.divider } }, h(Box, { component: "span", sx: { color: OV.disabled } }, "counted in"),
        h(Box, { component: "span", sx: ONE_LINE, title: "Counter fact the adapter writes; the kernel does not count instances" }, dim("adapter-written "), h(Box, { component: "span", sx: { color: OV.primary } }, COUNTER_OF[st] ?? "—"))),
      line("position", dim("adapter only (route, x/y, timers)"))));
}

function LmStrip(p) {   // per-unit strip (adapter view); band lines read from the kernel
  useStore(sim);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current; if (!c || !T || !P) return;
    const w = c.clientWidth || 320, hgt = 46, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hgt);
    const R = P.read, max = Math.max(1, R("trips.unitMax"), Math.ceil(R("trips.bandHigh")) + 1), bw = w / T.units.length, sy = (hgt - 4) / max;
    for (const u of T.units) {
      const x = (u.unit - 1) * bw, a = u.done, L = a + u.plan.length + (u.trip && u.trip.st === "active" ? 1 : 0);
      g.fillStyle = u.band === "above" ? "#6a5530" : u.band === "below" ? "#2c4f5c" : "#3a2c36"; g.fillRect(x + 0.3, hgt - L * sy, bw - 0.6, L * sy);
      g.fillStyle = "#e58fc0"; g.fillRect(x + 0.3, hgt - a * sy, bw - 0.6, a * sy);
    }
    g.strokeStyle = "#7eb8c9"; g.setLineDash([3, 3]); g.lineWidth = 1;
    for (const v of [R("trips.bandHigh"), R("trips.bandLow")]) { const y = Math.round(hgt - v * sy) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.setLineDash([]);
  });
  return h(Box, { component: "canvas", ref, id: "lm-strip", ...nodeAttrs(p), height: 46, sx: { width: "100%", height: 46, display: "block", mt: .4, bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px" } });
}
function LmEstimate(p) {
  useStore(sim);
  if (!T || !P) return h("b", { id: "lm-est", ...nodeAttrs(p) }, "—");
  const end = T.lmEstimate(), left = Math.max(0, end - T.simTime);
  return h(Box, { component: "b", id: "lm-est", ...nodeAttrs(p), sx: { color: "text.primary", fontWeight: 500 } }, P.read("trips.pending") === 0 ? `all last-mile trips settled · ${fmt(P.read("trips.done"))} done` : `≈ ${clock(end)} sim · ≈ ${realDur(left / speedOf())} real at ×${speedOf()}`);
}
function LmFeed(p) {
  useStore(sim);
  const items = T && T.feed.length ? T.feed.slice(0, 6).map((f, i) => h(Box, { component: "li", key: i, sx: { py: "1px" } }, `${clock(f.t)} · trip #${pad4(f.trip)} · ${lmName(f.from)} → ${lmName(f.to)}`)) : [h(Box, { component: "li", key: "e", sx: { color: "text.disabled" } }, "no redirects yet")];
  return h(Box, { component: "ul", id: "lm-feed", ...nodeAttrs(p), sx: { listStyle: "none", m: 0, p: 0, fontFamily: MONO, fontSize: 9, color: "text.secondary", mt: .25, height: 84, overflow: "hidden", contain: "strict" } }, ...items);
}
function SeedCode(p) {   // node id on the toggle (the collapsible code belongs to it)
  const { seed } = useStore(ui);
  const [open, setOpen] = React.useState(false);
  return h(React.Fragment, null,
    h(Button, { ...nodeAttrs(p), size: "small", onClick: () => setOpen(!open), sx: { mt: .5, p: 0, minWidth: 0, fontFamily: MONO, fontSize: 9.5, textTransform: "none", color: "text.secondary" } }, (open ? "▾ " : "▸ ") + "seed: exact calls run at load / reset"),
    h(Collapse, { in: open }, h(Box, { component: "pre", id: "seed-code", sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", maxHeight: 160, overflow: "auto", whiteSpace: "pre", mt: .75, bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", p: "6px 7px" } }, seed)));
}
function VerifyOut(p) {
  const { verify: v } = useStore(ui);
  return h(Typography, { id: "verify-out", ...nodeAttrs(p), "data-tone": v.tone, sx: { fontFamily: MONO, fontSize: 9.5, mt: .75, color: v.tone === "ok" ? "success.main" : v.tone === "bad" ? "error.main" : "text.secondary" } }, v.text);
}
function KernelWait(p) {   // aside placeholder before the kernel is loaded
  const { kernel } = useStore(ui);
  return h(Typography, { ...nodeAttrs(p), sx: { fontFamily: MONO, fontSize: 11, color: "text.secondary" } }, kernel.state === "error" ? "Nothing on this page runs without the kernel." : "Waiting for the kernel…");
}

// ── map overlays ──
function OffMap(p) { useStore(sim); return h("span", { id: "lg-off", ...nodeAttrs(p) }, String(offMap)); }
function SimClock(p) { useStore(sim); const { speed } = useStore(ui); return h("strong", { id: "hud-tick", ...nodeAttrs(p) }, `${T ? clock(T.simTime) : clock(0)} · ×${speed}`); }
// Compact extra text in a chip, shown only while the map is at least minMap px wide (it never re-wraps the chip rows;
// below that width the same facts are in the chip's popover). Measured before paint, and again when the map resizes.
function HudMore(p) {
  const { minMap = 0, children } = p;
  const ref = React.useRef(null);
  const [show, setShow] = React.useState(false);
  React.useLayoutEffect(() => {
    const mapEl = ref.current?.closest(".gui-osm"); if (!mapEl) return undefined;
    const fit = () => setShow(mapEl.clientWidth >= minMap);
    fit(); const ro = new ResizeObserver(fit); ro.observe(mapEl); return () => ro.disconnect();
  }, [minMap]);
  return h(Box, { component: "span", ref, ...nodeAttrs(p), "data-shown": show ? "1" : "0", sx: { display: show ? "inline" : "none" } }, children);
}
// Remaining import per ship and product, read from the kernel: ships[i].cargo, remaining + unit (facts), remainingTons (rule)
function ImportCargo() {
  const { me } = G.useMe();
  useWave("flows.importRemaining");
  const items = SHIPS.map(({ i }) => { const r = (f) => me(`ships.${i}.${f}`), unit = r("unit"); return `${r("cargo")} ${fmt(r("remaining"))} ${unit}${unit !== "t" ? ` (${fmt(r("remainingTons"))} t)` : ""}`; });
  return h(Box, { sx: { mb: .5 } },
    h(Box, { id: "hud-import-cargo", sx: { color: OV.primary } }, items.join(" · ")),
    h(Box, { sx: { color: OV.disabled } }, "by product: ships[i].cargo, ships[i].remaining + ships[i].unit (facts), ships[i].remainingTons (rule)"));
}
// ── HUD expression popover: what produced each chip's value (kernel explain() or the adapter's constants) ──
const hudX = createStore({ key: null });
const toggleHudExpr = (key) => hudX.set({ key: hudX.state.key === key ? null : key });
const ADAPTER_FACTS = new Set([...COUNTERS, ...TRIP_COUNTERS, ...BAND_COUNTERS, ...ADAPTER_AGGREGATES, ...SPEED_FACTS, "trips.redirects", "localDelivery.remainingKg", "train.1.remainingToLoad"]);
const factWriter = (path) => (ADAPTER_FACTS.has(path) || /^ships\.\d+\.remaining$|^cargo\.|^lastMile\.units\.\d+\.done$|^trucks\.unit\.\d+\.state$/.test(path) ? "fact · adapter writes" : "fact · seed (set once at load)");
const speedNote = (fleet, name, kmh) => `each ${fleet} truck drives at ${name} = ${kmh} km/h × (1 ± ${CONFIG.speedSpread}), drawn once per truck: an assumption in port-traffic.js, not a measured statistic. kmhSum = Σ speeds of the ${fleet} trucks driving right now, moving = how many; facts the adapter samples at most 4×/s. Shown as — while none is moving (0 / 0 is undefined in the kernel).`;
const MOVING_NOTE = `moving = driving along a route on the map (adapter states ${MOVING_STATES.join(", ")}); a moving truck's speed is exactly its configured one (no acceleration model).`;
const SIM_SRC = "https://github.com/neurons-me/.me/blob/main/docs/Tests/veracruz-port/port-traffic.js";
const HUD_EXPR = {
  import: { title: "import left", paths: ["flows.importRemaining"], extra: ImportCargo },
  export: { title: "export left", paths: ["flows.exportRemaining", "train.1.cargo"] },
  working: { title: "trucks.working / trucks.fleet", paths: ["trucks.working", "trucks.fleet"] },
  balanced: { title: "trucks.balanced", paths: ["trucks.balanced"] },
  sim: { title: "simulation", adapter: true, badge: null, source: SIM_SRC, notes: () => [`simulator clock (not a kernel path): starts ${clock(0)}, advances real time × playback speed (now ×${speedOf()}).`, `now ${T ? clock(T.simTime) : clock(0)}, ${fmt(Math.floor((T ? T.simTime : 0) / 60))} min since the start.`] },
  "speed-all": { title: "avg speed of moving trucks · all", paths: ["trucks.speed.avg"], notes: () => ["= Σ speed / Σ moving over both fleets, i.e. the moving-count-weighted mean of the heavy and last-mile averages (not a mean of the two means).", MOVING_NOTE] },
  "speed-heavy": { title: "avg speed of moving trucks · heavy", paths: ["trucks.speed.heavy.avg"], notes: () => [speedNote("heavy", "HEAVY_TRUCK_KMH", HEAVY_TRUCK_KMH), MOVING_NOTE] },
  "speed-lastMile": { title: "avg speed of moving trucks · last-mile", paths: ["trucks.speed.lastMile.avg"], notes: () => [speedNote("last-mile", "LAST_MILE_KMH", LAST_MILE_KMH), MOVING_NOTE] },
};
function ExprPath({ path }) {   // one kernel path: rule (expression + inputs from explain()) or fact (who writes it)
  useWave(path);
  const { me } = G.useMe();
  let ex = null; try { ex = me.explain(path); } catch (e) { /* — */ }
  const em = (t) => h(Box, { component: "span", sx: { color: OV.accent } }, t);
  const dim = (t) => h(Box, { component: "span", sx: { color: OV.disabled } }, t);
  const val = (v) => (v === undefined ? "undefined" : typeof v === "string" ? `"${v}"` : fmt(v));
  if (!ex?.expr) return h(Box, { sx: { mb: .5 } }, h("code", null, path), " = ", em(val(me(path))), "  ", dim(factWriter(path)));
  const m = ex.meta || {};
  return h(Box, { sx: { mb: .5 } },
    h(Box, null, h("code", { "data-expr": path }, `${path} = ${ex.expr}`), "  ", dim("kernel rule")),
    h(Box, { component: "ul", sx: { m: 0, mt: .25, pl: 1.75 } }, ...(ex.derivation?.inputs || []).map((x, i) => {
      let ix = null; try { ix = me.explain(x.path); } catch (e) { /* — */ }
      return h(Box, { component: "li", key: i }, `${x.path} = `, em(val(x.value)), "  ", dim(ix?.expr ? `rule: ${ix.expr}` : factWriter(x.path)));
    })),
    h(Box, null, "value ", em(val(ex.value)), m.sourcePath ? dim(`  · last wave: write ${m.sourcePath} · k=${m.k}`) : dim("  · not recomputed since seed")));
}
function HudExpr(p) {
  const { key } = useStore(hudX);
  useStore(sim);
  React.useEffect(() => { if (!key) return undefined; const esc = (e) => { if (e.key === "Escape") hudX.set({ key: null }); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [key]);
  const d = key && HUD_EXPR[key];
  // One popover, docked by the map as a full-width row above the chips (same bottom dock), fixed max size with
  // internal scroll, so opening it never moves anything else on the map.
  if (!d) return null;
  return h(OSM.Overlay, { position: "bottom", style: { flexBasis: "100%", order: -1 } }, h(Box, { ...nodeAttrs(p), id: "hud-expr", "data-open": "1", "data-key": key, role: "region", "aria-label": `${d.title}: .me expression`,
    sx: { width: "min(480px, 100%)", maxHeight: 210, overflowY: "auto", overscrollBehavior: "contain", boxSizing: "border-box",
      p: "6px 8px", bgcolor: OV.bg, backdropFilter: "blur(2px)", border: 1, borderStyle: d.adapter ? "dashed" : "solid", borderColor: d.adapter ? OV.ember : OV.accent, borderRadius: "4px",
      fontFamily: MONO, fontSize: 9.5, lineHeight: 1.5, color: OV.secondary, "& code": { fontFamily: MONO, color: OV.primary, wordBreak: "break-word" } } },
    h(Box, { sx: { display: "flex", alignItems: "center", gap: .75, mb: .5, position: "sticky", top: -6, bgcolor: OV.bg } },
      h(Box, { component: "span", sx: { color: OV.primary } }, d.title),
      d.badge === null ? null : h(Box, { component: "span", sx: { fontSize: 8, letterSpacing: ".08em", textTransform: "uppercase", px: "4px", border: 1, borderRadius: "2px", color: OV.accent } }, d.badge || "kernel"),
      h(Button, { size: "small", "data-gui-inspector-control": "true", "aria-label": "Close the expression", onClick: () => hudX.set({ key: null }), sx: { ml: "auto", minWidth: 20, height: 18, p: 0, fontFamily: MONO, fontSize: 11, color: OV.secondary } }, "×")),
    d.extra ? h(d.extra, { key: "extra" }) : null,
    ...(d.paths || []).map((path) => h(ExprPath, { key: path, path })),
    ...(d.notes ? d.notes() : []).map((n, i) => h(Box, { key: `n${i}`, sx: { color: OV.disabled, mt: .25 } }, n)),
    d.source ? h(Box, { key: "src", sx: { mt: .25 } }, h(Link, { href: d.source, target: "_blank", rel: "noopener", "data-gui-inspector-control": "true", sx: { fontFamily: MONO, fontSize: 9.5, color: OV.accent } }, "source: port-traffic.js")) : null));
}
// One kernel readout that is not its own spec node (legend rows, chip values): subscribed through the page's runtime
// (G.useMeValue re-reads me(path) whenever the bridge announces the path) and tagged for __port.consistency().
function MeVal({ path, f = fmt, suffix = "", ch, strong }) {
  const v = G.useMeValue(path);
  const el = h("span", { "data-me-path": path, "data-me-value": String(v), style: ch ? { display: "inline-block", minWidth: `${ch}ch`, textAlign: "right" } : undefined }, f(v) + suffix);
  return strong ? h("strong", null, el) : el;
}
const MV = (path, o) => h(MeVal, { path, ...o });
function MeSum({ paths }) {   // display-side sum of two kernel reads (legend only; the paths panel says so)
  const a = G.useMeValue(paths[0]), b = G.useMeValue(paths[1]);
  return fmt((Number(a) || 0) + (Number(b) || 0));
}
const JOIN = (...xs) => h(React.Fragment, null, ...xs.flatMap((x, i) => (i ? [" · ", x] : [x])));

// Legend: GUI.OpenStreetMap.Legend (themed, docked top-right, passive so clicks reach the map). Swatch tones are the
// same theme tones the canvas uses for the truck dots (drawTrucks), so the legend always matches the map.
const LEGEND_ITEMS = [
  { heading: `heavy · ${HEAVY}` },
  { label: "import, laden", tone: "ship", value: MV("trucks.import.enRoute") },
  { label: "export, laden", tone: "train", value: MV("trucks.export.enRoute") },
  { label: "load / unload", tone: "yard", value: h(MeSum, { paths: ["trucks.import.loading", "trucks.export.loading"] }) },
  { label: "queued", tone: "secondary", value: MV("trucks.inQueue") },
  { label: "returning", tone: "neutral", value: h(MeSum, { paths: ["trucks.import.returning", "trucks.export.returning"] }) },
  { label: "pool", tone: "neutral", swatch: "ring", value: MV("trucks.heavy.available") },
  { heading: `last-mile · ${LAST_MILE}` },
  { label: "out · back", tone: "error", swatch: { size: 5 }, value: JOIN(MV("trucks.lastMile.enRoute"), MV("trucks.lastMile.returning")) },
  { label: "load · idle", tone: "error", swatch: { shape: "ring", size: 6 }, value: JOIN(MV("trucks.lastMile.loading"), MV("trucks.lastMile.available")) },
  { label: "band ↑ · ↓", tone: "warning", swatch: "ring", value: JOIN(MV("lastMile.unitsAbove"), MV("lastMile.unitsBelow")) },
  { label: "trips ○ · ✓ · ✗", tone: "warning", swatch: { shape: "square", size: 5 }, value: JOIN(MV("trips.pending"), MV("trips.done"), MV("trips.unscheduled")) },
];
function PortLegend(p) {
  return h(OSM.Legend, { "data-gui-node-id": p["data-gui-node-id"], id: "legend", mono: true, width: 200, items: LEGEND_ITEMS,
    footer: h(React.Fragment, null, "kernel counts · ", h(OffMap, {}), " off-map (adapter)") });
}

// HUD: GUI.OpenStreetMap.Chip × 8 in the map's bottom dock (they wrap above the OSM attribution, never under it).
// Each chip with ƒ opens its .me expression in ONE docked popover (HudExpr) above the chips; the expressions are
// read from the kernel (explain()) and from the adapter's own constants, never typed by hand. The simulation clock is
// the adapter's (not a kernel path): dashed adapter chip.
const IMPORT_CH = fmt(SHIPS.reduce((a, x) => a + x.total * x.tonsPerUnit, 0)).length + 2;   // "128,000 t"
const KMH = (v) => (typeof v === "number" ? v.toFixed(1) : "—");   // — while undefined (0 moving)
function PortHud(p) {
  const { key } = useStore(hudX);
  const s = p["data-gui-node-id"] || "hud";
  const chip = (k, label, props, value, more) => h(OSM.Chip, { key: k, "data-gui-node-id": `${s}/${k}`, mono: true, label, value, fx: true, active: key === k,
    onClick: () => toggleHudExpr(k), "aria-controls": "hud-expr", title: key === k ? "Hide the .me expression" : "Show the .me expression behind this value", ...props }, more);
  return h(React.Fragment, null,
    h(HudExpr, { "data-gui-node-id": `${s}/expr` }),
    chip("import", "import left", { tone: "ship", minValueCh: IMPORT_CH }, MV("flows.importRemaining", { suffix: " t" }),
      h(HudMore, { minMap: 944 }, ...SHIPS.flatMap(({ i, total }) => [" · ", MV(`ships.${i}.cargo`, { f: S }), " ", MV(`ships.${i}.remaining`, { ch: fmt(total).length, strong: true }), " ", MV(`ships.${i}.unit`, { f: S })]))),
    chip("export", "export left", { tone: "train", minValueCh: fmt(TRAIN.total).length + 2 }, MV("flows.exportRemaining", { suffix: " t" }),
      h(HudMore, { minMap: 624 }, " · ", MV("train.1.cargo", { f: S }))),
    chip("working", "trucks.working", { minValueCh: 9 }, h(React.Fragment, null, MV("trucks.working", { ch: 3 }), " / ", MV("trucks.fleet"))),
    chip("balanced", "trucks.balanced", {}, MV("trucks.balanced", { f: S })),
    chip("speed-all", "avg km/h, moving trucks · all", { minValueCh: 4 }, MV("trucks.speed.avg", { f: KMH })),
    chip("speed-heavy", "heavy", { minValueCh: 4 }, MV("trucks.speed.heavy.avg", { f: KMH })),
    chip("speed-lastMile", "last-mile", { minValueCh: 4 }, MV("trucks.speed.lastMile.avg", { f: KMH })),
    chip("sim", "simulation", { variant: "adapter" }, h(SimClock, {})));
}
const SvgGroup = (p) => { const { children, "data-gui-component": _c, ...rest } = p; return h("g", rest, children); };

// ── page-local registry types (rendered by GUI's renderer like any registry entry; no new GUI types) ──
const pageType = (type, C) => ({ type, resolve: (spec) => { const { key: _k, ...p } = spec.props || {}; return h(C, p); } });
const PAGE_TYPES = Object.fromEntries([
  ["PortValue", ValView], ["PortSum", SumView], ["PortBar", BarView], ["PortRow", Row], ["PortFormula", Formula], ["PortPanel", Panel], ["PortSectionHeader", SectionHeader], ["PortSectionToggle", SectionToggle], ["PortSectionBody", SectionBody],
  ["PortLegend", PortLegend], ["PortHud", PortHud], ["PortMarker", PortMarker], ["PortSvgGroup", SvgGroup],
  ["PortTour", TourStrip], ["PortKernelStrip", KernelStrip], ["PortBrandLogo", BrandLogo], ["PortBrandActions", BrandActions], ["PortKernelLink", KernelLink], ["PortRunControls", RunControls], ["PortStats", Stats], ["PortWrites", Writes],
  ["PortExplain", ExplainLeaf], ["PortClassExplain", ClassExplain], ["PortGuiBuild", GuiBuildInfo], ["PortTruckCard", TruckCard], ["PortLmStrip", LmStrip], ["PortLmEstimate", LmEstimate], ["PortLmFeed", LmFeed], ["PortSeed", SeedCode],
  ["PortVerifyOut", VerifyOut], ["PortKernelWait", KernelWait], ["PortOffMap", OffMap], ["PortSimClock", SimClock],
].map(([t, C]) => [t, pageType(t, C)]).concat([
  // GUI's registered Link resolver drops target / rel / title / data-gui-node-id, so links use GUI.Atoms.Link as is
  ["PortLink", Link],
]));

// ── spec builders ──
// N(type, nodeId, props, children, provenance): one spec node; nodeId → data-gui-node-id (the DOM id is untouched).
const N = (type, id, props = {}, children, provenance) => ({ type, props: { ...props, "data-gui-node-id": id }, ...(children !== undefined ? { children: [].concat(children) } : {}), ...(provenance ? { provenance } : {}) });
const V = (scope, path, opts = {}) => N("PortValue", `${scope}/${path}`, { path, value: { read: `me/${path}` }, ...opts }, undefined, { semanticPath: path });
const BAR = (scope, path, color) => N("PortBar", `${scope}/bar:${path}`, { path, value: { read: `me/${path}` }, ...(color ? { color } : {}) }, undefined, { semanticPath: path });
const SUM = (scope, paths) => N("PortSum", `${scope}/sum:${paths.join("+")}`, { values: paths.map((p) => ({ read: `me/${p}` })) });
const J = (...parts) => parts.flatMap((p, i) => (i ? [" · ", p] : [p]));
const S = String;
const ROW = (scope, k, kind, children, minCh) => N("PortRow", `${scope}/row:${k}`, { k, kind, ...(minCh ? { minCh } : {}) }, children);
const FORMULA = (scope, name, children) => N("PortFormula", `${scope}/formula:${name}`, {}, children);
const SUB = (id, children, sx) => N("Typography", id, { component: "div", sx: { ...SUB_SX, ...sx } }, children);
const SCENARIO_SRC = "https://github.com/neurons-me/.me/blob/main/docs/Tests/veracruz-port/port-sim.js";
const TAG = (id, kind, label) => N("Chip", id, { size: "small", variant: "outlined", label, sx: srcTagSx(kind) });
const PANEL = (id, title, tags, children, adapter) => N("PortPanel", id, { id }, [
  N("PortSectionHeader", `${id}/header`, { section: id }, [title, ...tags.map(([kind, label]) => TAG(`${id}/header/tag:${label}`, kind, label)), N("PortSectionToggle", `${id}/toggle`, { section: id, title })]),
  N("PortSectionBody", `${id}/body`, { id, ...(adapter ? { adapter } : {}) }, children),
]);
const LINK = (id, props, children) => N("PortLink", id, props, children);

const SHIPS_META = [{ i: 1, unit: "t" }, { i: 2, unit: "t" }, { i: 3, unit: "TEU" }];
function shipsPanel(s = "panel-ships") {
  return PANEL(s, "Ships · unloading (import)", [["kernel", "kernel"]], [
    ...SHIPS_META.flatMap((m) => [
      ROW(s, `ships[${m.i}].remaining`, "fact", V(s, `ships.${m.i}.remaining`, { suffix: " " + m.unit })),
      ROW(s, `ships[${m.i}].progress`, "rule", V(s, `ships.${m.i}.progress`, { f: pct })),
    ]),
    FORMULA(s, "flows.importRemaining", ["flows.importRemaining = ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons = ", V(s, "flows.importRemaining", { wrap: "b" }), " t"]),
    BAR(s, "flows.importProgress"),
  ]);
}
function trainPanel(s = "panel-train") {
  return PANEL(s, "Train · loading (export)", [["kernel", "kernel"]], [
    ROW(s, "train[1].remainingToLoad", "fact", V(s, "train.1.remainingToLoad", { suffix: " t" })),
    ROW(s, "train[1].progress", "rule", V(s, "train.1.progress", { f: pct })),
    ROW(s, "train[1].hasWork", "rule", V(s, "train.1.hasWork", { f: S })),
    FORMULA(s, "flows.exportRemaining", ["flows.exportRemaining = train[1].remainingToLoad = ", V(s, "flows.exportRemaining", { wrap: "b" }), " t"]),
    BAR(s, "train.1.progress", "warning"),
  ]);
}
function trucksPanel(s = "panel-queues") {
  return PANEL(s, "Trucks · by state", [["kernel", "kernel"]], [
    ROW(s, "trucks.heavy.available", "fact", V(s, "trucks.heavy.available")),
    ROW(s, "queues.import.length", "fact", V(s, "queues.import.length")),
    ROW(s, "trucks.import.loading · enRoute · returning", "facts", J(V(s, "trucks.import.loading"), V(s, "trucks.import.enRoute"), V(s, "trucks.import.returning"))),
    ROW(s, "queues.export.length", "fact", V(s, "queues.export.length")),
    ROW(s, "trucks.export.loading · enRoute · returning", "facts", J(V(s, "trucks.export.loading"), V(s, "trucks.export.enRoute"), V(s, "trucks.export.returning"))),
    ROW(s, "trucks.lastMile.available", "fact", V(s, "trucks.lastMile.available")),
    ROW(s, "trucks.lastMile.loading · enRoute · returning", "facts", J(V(s, "trucks.lastMile.loading"), V(s, "trucks.lastMile.enRoute"), V(s, "trucks.lastMile.returning"))),
    ROW(s, "trucks.heavy.working · balanced", "rules", J(V(s, "trucks.heavy.working"), V(s, "trucks.heavy.balanced", { f: S }))),
    ROW(s, "trucks.lastMile.working · balanced", "rules", J(V(s, "trucks.lastMile.working"), V(s, "trucks.lastMile.balanced", { f: S }))),
    ROW(s, "trucks.inQueue · loading · enRoute · returning", "rules", J(V(s, "trucks.inQueue"), V(s, "trucks.loading"), V(s, "trucks.enRoute"), V(s, "trucks.returning"))),
    ROW(s, "trucks.available · working", "rules", J(V(s, "trucks.available"), V(s, "trucks.working"))),
    ROW(s, "trucks.accounted", "rule", V(s, "trucks.accounted")),
    ROW(s, "trucks.balanced", "rule", V(s, "trucks.balanced", { f: S })),
    ROW(s, "trucks.splitOk", "rule", V(s, "trucks.splitOk", { f: S })),
    ROW(s, "port.busy", "rule", V(s, "port.busy", { f: S })),
    FORMULA(s, "trucks.working", "trucks.working = trucks.inQueue + trucks.loading + trucks.enRoute + trucks.returning · trucks.balanced = trucks.accounted == trucks.fleet"),
  ]);
}
function lastMilePanel(s = "panel-lastmile") {
  return PANEL(s, "Last-mile · 1,000 scheduled trips", [["kernel", "kernel"], ["adapter", "dispatch = adapter"]], [
    N("Box", `${s}/done`, { sx: { display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: "text.secondary" } }, [
      h("span", { key: "l" }, "trips.done"),
      N("Box", `${s}/done:value`, { component: "b", id: "lm-done", sx: { color: "#f4e6b8", fontSize: 14, fontWeight: 500 } }, [V(s, "trips.done"), " / ", V(s, "trips.total")]),
    ]),
    BAR(s, "trips.doneShare", "secondary"),
    N("Box", `${s}/rows`, { sx: { mt: .75 } }, [
      ROW(s, "trips.pending · active", "rule · fact", J(V(s, "trips.pending"), V(s, "trips.active"))),
      ROW(s, "trips.unscheduled (can't fit today)", "fact", V(s, "trips.unscheduled")),
      ROW(s, "trips.perUnitAvg (assigned)", "rule", V(s, "trips.perUnitAvg")),
      ROW(s, "trips.perUnitDoneAvg", "rule", V(s, "trips.perUnitDoneAvg")),
      ROW(s, "trips.unitMax · unitMin", "adapter aggregate", J(V(s, "trips.unitMax"), V(s, "trips.unitMin"))),
      ROW(s, "trips.bandLow – bandHigh (±15%)", "rules", [V(s, "trips.bandLow"), " – ", V(s, "trips.bandHigh")], 13),
      ROW(s, "lastMile.unitsAbove · Within · Below", "adapter → facts", J(V(s, "lastMile.unitsAbove"), V(s, "lastMile.unitsWithin"), V(s, "lastMile.unitsBelow"))),
      ROW(s, "lastMile.unitsOk · trips.balanced", "rules", J(V(s, "lastMile.unitsOk", { f: S }), V(s, "trips.balanced", { f: S }))),
      ROW(s, "trips.redirects", "fact", V(s, "trips.redirects")),
      ROW(s, "localDelivery.remainingKg", "fact", V(s, "localDelivery.remainingKg", { suffix: " kg" })),
    ]),
    SUB(`${s}/note:strip`, "per unit (adapter view): bright = done, dim = assigned · dashed = kernel bandLow/bandHigh"),
    N("PortLmStrip", `${s}/units-strip`),
    SUB(`${s}/estimate`, ["est. completion", TAG(`${s}/estimate:tag`, "adapter", "adapter estimate"), N("PortLmEstimate", `${s}/estimate:value`)], { display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap", height: "25.2px", overflow: "hidden" }),
    SUB(`${s}/redirects`, ["redirects", TAG(`${s}/redirects:tag`, "adapter", "adapter log")], { display: "flex", alignItems: "center", gap: .75 }),
    N("PortLmFeed", `${s}/redirects:feed`),
    FORMULA(s, "trips.bandHigh", "trips.bandHigh = trips.perUnitAvg + trips.perUnitAvg * trips.band · trips.perUnitAvg = trips.assigned / trucks.lastMile.fleet · lastMile.unitDoneSum = units[1].done + … + units[100].done (explicit) · trips.balanced = trips.accounted == trips.total"),
    SUB(`${s}/note:assumptions`, "Assumed averages (not sourced): 22 km/h, load at CEDIS ~10 min, drop 5–8 min, shift 08:00–17:00, band ±15%. Plan: each unit greedily takes the trip it can finish earliest until its shift is full; then trips move from units above the band to units below (nearest to the receiver's next stop, only if its shift and windows still fit)."),
  ]);
}
function stocksPanel(s = "panel-stocks") {
  return PANEL(s, "Stocks · me.cargo", [["kernel", "kernel"]], [
    ROW(s, "cargo.coffee", "fact", V(s, "cargo.coffee", { suffix: " t" })),
    ROW(s, "cargo.sugar", "fact", V(s, "cargo.sugar", { suffix: " t" })),
    ROW(s, "cargo.containers", "fact", V(s, "cargo.containers")),
    ROW(s, "cargo.bulkTons", "rule", V(s, "cargo.bulkTons", { suffix: " t" })),
    ROW(s, "trucks.fleet", "fact", V(s, "trucks.fleet")),
    ROW(s, "trucks.heavy.fleet · trucks.lastMile.fleet", "facts", J(V(s, "trucks.heavy.fleet"), V(s, "trucks.lastMile.fleet"))),
    N("PortSeed", `${s}/seed`),
  ]);
}
function adapterPanel(live, s = "panel-adapter") {
  return PANEL(s, "Adapter · plain JS", [["adapter", "not kernel"]], [
    N("Typography", `${s}/text`, { sx: { fontSize: 11, lineHeight: 1.45, color: "text.secondary", "& code": { fontFamily: MONO, fontSize: 10 } } }, [
      "The traffic model (", h("code", { key: 1 }, "port-traffic.js"), ") decides ", h("em", { key: 2 }, "what to write"), "; the kernel holds every value and decides ", h("em", { key: 3 }, "what recomputes"),
      ". Adapter only: each truck's route over OSM roads, berth/train/bay slots, timers, which flow it joins, the last-mile greedy plan, band classification and redirects, dot positions, the pending deltas it flushes, and the schedule that tells the .GUI components which kernel paths changed (the paths themselves come from the kernel's own wave). Totals, averages, band limits, flags, k and explain() are kernel. Speeds and durations are assumptions (named constants in ",
      h("code", { key: 4 }, "port-traffic.js"), ")."]),
    N("Button", `${s}/verify`, { id: "btn-verify", variant: "outlined", color: "primary", size: "small", disabled: !live, onClick: verify, sx: { mt: 1, fontFamily: MONO, fontSize: 10.5, textTransform: "none", color: "text.secondary", borderColor: "divider" } }, "Verify: rebuild kernel from facts"),
    N("PortVerifyOut", `${s}/verify:result`),
  ], true);
}
// ── Model: the kernel's classes (templates) and their live instances ──
const CELL_SX = { fontFamily: MONO, fontSize: 9.5, height: 18, lineHeight: "18px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const SHIP_COLS = [["cargo", { f: S }], ["remaining"], ["remainingTons", { rule: true }], ["progress", { f: pct, rule: true }], ["hasWork", { f: S, rule: true }]];
const TRAIN_COLS = [["cargo", { f: S }], ["remainingToLoad"], ["progress", { f: pct, rule: true }], ["hasWork", { f: S, rule: true }]];
function instanceTable(s, family, ids, cols) {   // one row per instance, every cell a live kernel read
  const cell = (id, children, sx, title) => N("Box", id, { title, sx: { ...CELL_SX, ...sx } }, children);
  return N("Box", `${s}/instances`, { role: "table", "aria-label": `${family} instances`, sx: { display: "grid", gridTemplateColumns: `30px repeat(${cols.length}, minmax(0, 1fr))`, columnGap: 1, mt: .75, borderTop: 1, borderBottom: 1, borderColor: "divider" } }, [
    cell(`${s}/th:i`, "i", { color: "text.disabled" }),
    ...cols.map(([f, o = {}]) => cell(`${s}/th:${f}`, f, { color: o.rule ? "primary.main" : "text.disabled", textAlign: "right", opacity: o.rule ? .8 : 1 }, `${f}: ${o.rule ? "template formula" : "fact"}`)),
    ...ids.flatMap((i) => [cell(`${s}/[${i}]`, `[${i}]`, { color: "text.secondary" }),
      ...cols.map(([f, o = {}]) => cell(`${s}/[${i}].${f}`, [V(s, `${family}.${i}.${f}`, o.f ? { f: o.f } : {})], { textAlign: "right", color: o.rule ? "primary.main" : "text.primary" }, `${family}[${i}].${f}`))]),
  ]);
}
function classBlock(s, family, fields, cols, ids, explainName, countText) {
  const tpl = TEMPLATES.filter((t) => t.family.join(".") === family);
  return N("Box", s, { sx: { "& + &": { mt: 1.5, pt: 1.25, borderTop: 1, borderColor: "divider" } } }, [
    N("Box", `${s}/title`, { sx: { display: "flex", alignItems: "baseline", gap: .75, fontFamily: MONO, fontSize: 11, color: "text.primary", whiteSpace: "nowrap", height: 18, lineHeight: "18px" } },
      [N("Box", `${s}/class`, { component: "span", sx: { flexShrink: 0 } }, `class ${family}[i]`), N("Box", `${s}/count`, { component: "span", sx: { fontSize: 9.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 } }, countText || `· ${ids.length} instance${ids.length > 1 ? "s" : ""}: ${ids.map((i) => `${family}[${i}]`).join(", ")}`)]),
    SUB(`${s}/facts`, `facts per instance: ${fields.join(" · ")}`),
    N("Box", `${s}/templates`, { component: "pre", sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", m: 0, mt: .75, p: "5px 7px", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" } },
      tpl.map((t) => templateCode(t)).join("\n")),
    instanceTable(s, family, ids, cols),
    N("PortClassExplain", `${s}/explain`, { family, ids, name: explainName }),
  ]);
}
const TRUCK_COLS = [["state", { f: (v) => (typeof v === "number" ? `${v} ${TRUCK_STATES[v] ?? "?"}` : "—") }], ["kind", { f: (v) => (typeof v === "number" ? `${v} ${TRUCK_KIND[v] ?? "?"}` : "—") }], ["working", { f: S, rule: true }], ["heavy", { f: S, rule: true }]];
const TRUCK_SAMPLE = [1, 2, HEAVY + 1];
const modelPanel = (s = "panel-model") => PANEL(s, "Model · classes & instances", [["kernel", "kernel"]], [
  SUB(`${s}/intro`, "One formula template per class; the kernel applies it to every index. Blue = template formula, white = fact. Values are live kernel reads.", { mt: 0 }),
  classBlock(`${s}/ships`, "ships", SHIP_FIELDS, SHIP_COLS, SHIPS.map((x) => x.i), "remainingTons"),
  classBlock(`${s}/train`, "train", TRAIN_FIELDS, TRAIN_COLS, [TRAIN.i], "progress"),
  classBlock(`${s}/trucks`, "trucks.unit", TRUCK_FIELDS, TRUCK_COLS, TRUCK_SAMPLE, "working", `· ${FLEET} instances · rows: unit[${TRUCK_SAMPLE.join("], [")}] (click any dot)`),
  SUB(`${s}/trucks:codes`, `state codes (formulas compare numbers, not strings): ${TRUCK_STATES.map((st, c) => `${c} ${st}`).join(" · ")}. 0–1 idle, 2–${TRUCK_STATES.length - 1} working.`, { fontSize: 8.5, color: "text.disabled" }),
  N("Box", `${s}/trucks:counts`, { sx: { mt: .75, fontFamily: MONO, fontSize: 9.5, color: "text.secondary", lineHeight: 1.45 } }, [
    N("Box", `${s}/trucks:counts:title`, { sx: { display: "flex", alignItems: "center", gap: .75, height: 22, color: "text.primary" } }, ["counts by state", TAG(`${s}/trucks:counts:tag`, "adapter", "adapter-written facts")]),
    "The 13 counters (trucks.heavy.available, queues.import.length, trucks.import.enRoute …) are still facts the adapter writes; the kernel does not count the instances (this.me@4.1.0 has no aggregate over [i]; an explicit 500-term sum would cost milliseconds per write). Verify recounts the instances in JS and checks they match the counters. Positions stay in the adapter.",
  ]),
]);

// ── Map numbers → kernel paths ──
// [where, what the map shows, kernel path(s), kind]
const MAP_PATHS = [
  ["HUD", "import left", "flows.importRemaining", "rule"],
  ["HUD", "export left", "flows.exportRemaining", "rule"],
  ["HUD", "trucks.working N / 500", "trucks.working · trucks.fleet", "rule · fact"],
  ["HUD", "trucks.balanced", "trucks.balanced", "rule"],
  ["HUD", "avg km/h, moving · all · heavy · last-mile", "trucks.speed.avg · trucks.speed.heavy.avg · trucks.speed.lastMile.avg", "rule"],
  ["HUD", "simulation", "— (simulator clock, not a kernel path)", "adapter"],
  ["map", "VERACRUZ · port.busy", "port.busy", "rule"],
  ["map", "SHIP[i] · unloading · N t", "ships[i].hasWork · ships[i].remaining", "template · fact"],
  ["map", "TRAIN[1] · loading · N t", "train[1].hasWork · train[1].remainingToLoad", "template · fact"],
  ["map", "Q.IMPORT / Q.EXPORT · N queued", "queues.import.length · queues.export.length", "adapter-written facts"],
  ["map", "CARGO YARD · pool: N heavy", "trucks.heavy.available", "adapter-written fact"],
  ["legend", "import, laden · export, laden", "trucks.import.enRoute · trucks.export.enRoute", "adapter-written facts"],
  ["legend", "load / unload", "trucks.import.loading + trucks.export.loading", "display sum of facts"],
  ["legend", "queued", "trucks.inQueue", "rule"],
  ["legend", "returning", "trucks.import.returning + trucks.export.returning", "display sum of facts"],
  ["legend", "pool", "trucks.heavy.available", "adapter-written fact"],
  ["legend", "last-mile out · back · load · idle", "trucks.lastMile.enRoute · returning · loading · available", "adapter-written facts"],
  ["legend", "band ↑ · ↓", "lastMile.unitsAbove · lastMile.unitsBelow", "adapter → facts"],
  ["legend", "trips ○ · ✓ · ✗", "trips.pending · trips.done · trips.unscheduled", "rule · facts"],
  ["map", "each truck dot (click it)", "trucks.unit[n].state · kind → working · heavy", "adapter-written facts · template"],
  ["map", "dot position, route, timers", "— (adapter object, not kernel)", "adapter"],
];
const pathsPanel = (s = "panel-paths") => PANEL(s, "Map numbers → kernel paths", [["kernel", "kernel"], ["adapter", "adapter"]], [
  SUB(`${s}/intro`, "Where each number on the map comes from. Each truck is a kernel instance trucks.unit[n] (click a dot); the counts by state are facts the adapter writes.", { mt: 0, mb: .5 }),
  ...MAP_PATHS.map(([where, what, path, kind]) => N("Box", `${s}/row:${where}:${what}`, { title: `${what} → ${path} (${kind})`, sx: { height: 32, py: "2px", borderBottom: 1, borderColor: "divider", fontFamily: MONO, fontSize: 9.5, "&:last-of-type": { borderBottom: 0 } } }, [
    N("Box", `${s}/row:${where}:${what}/label`, { sx: { display: "flex", gap: .75, height: 14, lineHeight: "14px", color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden" } }, [
      N("Box", `${s}/row:${where}:${what}/where`, { component: "span", sx: { color: "text.disabled", width: "6ch", flexShrink: 0 } }, where),
      N("Box", `${s}/row:${where}:${what}/what`, { component: "span", sx: { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 } }, what),
      N("Box", `${s}/row:${where}:${what}/kind`, { component: "span", sx: { ...kindSx, ml: "auto", flexShrink: 0, borderStyle: kind.startsWith("adapter") || kind.includes("adapter-written") ? "dashed" : "solid" } }, kind)]),
    N("Box", `${s}/row:${where}:${what}/path`, { sx: { height: 14, lineHeight: "14px", pl: "calc(6ch + 6px)", color: kind === "adapter" ? "text.disabled" : "primary.main", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, path),
  ])),
]);
const mutatePanel = (s = "panel-mutate") => PANEL(s, "Mutate · live traffic", [["kernel", "kernel writes"]], [N("PortStats", `${s}/stats`), N("PortWrites", `${s}/writes`)]);
const explainPanel = (s = "panel-explain") => PANEL(s, "Explain · why", [["kernel", "me.explain()"]], [N("PortExplain", `${s}/explain`)]);

// ── map: GUI.OpenStreetMap over the EXISTING build_basemap.py output (GUI presents; this adapter only reads it) ──
const OSM = G.OpenStreetMap;
const FRAME = { bbox: { south: PROJ.south, west: PROJ.west, north: PROJ.north, east: PROJ.east }, width: PROJ.W, height: PROJ.H, pad: PROJ.PAD };
const OSM_PROJ = G.createOsmProjection(FRAME);   // the map's projection = build_basemap.py's (equirectangular, same bbox/pad)
const OSM_SOURCE = { generator: "veracruz-port/build_basemap.py", dataSource: "OpenStreetMap via Overpass API", query: "veracruz-port/overpass_query.txt", notes: "static SVG basemap · no live tiles", license: "ODbL" };
function readBasemap() {   // generator SVG (inline <template>) → layers; geometry and styles unchanged
  const svg = document.getElementById("basemap-tpl").content.querySelector("svg");
  const attr = (el, k) => el.getAttribute(k) ?? undefined, num = (el, k) => (el.hasAttribute(k) ? Number(el.getAttribute(k)) : undefined);
  return {
    background: svg.querySelector(":scope > rect")?.getAttribute("fill") || "#0b0d10",
    layers: [...svg.querySelectorAll(":scope > g[id]")].map((g) => ({
      id: g.id,
      style: { fill: attr(g, "fill"), stroke: attr(g, "stroke"), strokeWidth: num(g, "stroke-width"), opacity: num(g, "opacity"), strokeLinecap: attr(g, "stroke-linecap"), strokeLinejoin: attr(g, "stroke-linejoin") },
      paths: [...g.querySelectorAll("path")].map((p) => p.getAttribute("d")),
      circles: [...g.querySelectorAll("circle")].map((c) => ({ cx: Number(c.getAttribute("cx")), cy: Number(c.getAttribute("cy")), r: Number(c.getAttribute("r")) })),
    })),
  };
}
const BASEMAP = readBasemap();
// flow edges between nodes (page overlay, map pixels)
const EDGES = [
  ["e-ship1-q", "edge flow-imp", "M801.6,168.6 L686.4,313.2"], ["e-ship2-q", "edge flow-imp", "M888.0,284.3 L686.4,313.2"],
  ["e-ship3-q", "edge flow-imp", "M945.6,382.6 L686.4,313.2"], ["e-qimp-port", "edge flow-imp", "M686.4,313.2 L600.0,255.4"],
  ["e-yard-qexp", "edge flow-exp", "M513.6,457.8 L484.8,284.3"], ["e-qexp-train", "edge flow-exp", "M484.8,284.3 L340.8,342.2"],
  ["e-port-yard", "edge", "M600.0,255.4 L513.6,457.8"], ["e-port-train", "edge", "M600.0,255.4 L340.8,342.2"],
];
function exitLabelData() {
  const out = [];
  for (const ex of CONFIG.exits) {
    const r = ROUTES[`berth1>${ex}`];
    let cross = null;
    for (let i = 1; i < r.length && !cross; i++) {
      const [x1, y1] = r[i - 1], [x2, y2] = r[i];
      if (x2 < 0 || x2 > 1200 || y2 < 0 || y2 > 800) {
        const u = Math.min(...[[-x1, x2 - x1], [1200 - x1, x2 - x1], [-y1, y2 - y1], [800 - y1, y2 - y1]].map(([n, d]) => (d ? n / d : Infinity)).filter((t) => t >= 0 && t <= 1));
        cross = [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u];
      }
    }
    if (!cross) continue;
    const top = cross[1] < 400, left = cross[0] < 600;
    out.push({ key: ex, x: (cross[0] + (left ? 8 : -8)).toFixed(1), y: (top ? 16 : 728).toFixed(1), anchor: left ? "start" : "end", text: (top ? "↖ " : "↓ ") + EXITS[ex] + " · off map" });
  }
  return out;
}
const EXIT_LABELS = exitLabelData();

// Node meta lines: GUI subscriptions to kernel paths (re-read when the bridge announces those paths). Plain strings, so
// the map can measure each label, put it in the pin's accessible name and list it in the MarkerList.
const useShipMeta = ({ s }) => { const work = G.useMeValue(`ships.${s.i}.hasWork`), rem = G.useMeValue(`ships.${s.i}.remaining`); return `${work ? "unloading" : "done"} · ${fmt(rem)} ${s.unit}`; };
const useTrainMeta = () => { const work = G.useMeValue("train.1.hasWork"), rem = G.useMeValue("train.1.remainingToLoad"); return `${work ? "loading" : "done"} · ${fmt(rem)} t`; };
const useQueueMeta = ({ q }) => { const n = G.useMeValue(`queues.${q}.length`), busy = G.useMeValue(`queues.${q}.busy`); return `${n} queued${busy ? "" : " · idle"}`; };
const useYardMeta = () => { useStore(sim); const heavy = G.useMeValue("trucks.heavy.available"); return `pool: ${fmt(heavy)} heavy · ${T ? T.units.filter((u) => u.home === 0 && u.st === "lmPool").length : 0} small (adapter)`; };
const usePortMeta = () => (G.useMeValue("port.busy") ? "port.busy = true" : "port.busy = false");
// Node positions are the page's existing map pixels, converted to lat/lon with the map's own projection.
// `path` = the derived kernel path each marker carries as provenance.semanticPath (Explain in the inspector).
// `work` = the kernel flag behind the busy / done marker state. Colours are theme tones (port, ship, train, queue, yard).
const NODES = [
  { id: "n-port", kind: "port", tone: "port", path: "port.busy", x: 600.0, y: 255.4, shape: "circle", size: 28, gap: 7, icon: "anchor", label: "VERACRUZ", useMeta: usePortMeta },
  ...SHIPS_META.map((s, i) => ({ id: `n-ship${s.i}`, kind: "ship", tone: "ship", path: `ships.${s.i}.hasWork`, work: `ships.${s.i}.hasWork`, x: [801.6, 888.0, 945.6][i], y: [168.6, 284.3, 382.6][i], shape: "rect", w: 32, hh: 18, gap: 5, icon: "directions_boat", label: `SHIP[${s.i}] ${["coffee", "sugar", "TEU"][i]}`, useMeta: useShipMeta, mp: { s } })),
  { id: "n-train", kind: "train", tone: "train", path: "train.1.hasWork", work: "train.1.hasWork", x: 340.8, y: 342.2, shape: "rect", w: 36, hh: 16, gap: 5, place: "left", icon: "train", label: "TRAIN[1]", useMeta: useTrainMeta },
  { id: "n-qimp", kind: "queue", tone: "queue", path: "queues.import.busy", x: 686.4, y: 313.2, shape: "circle", size: 24, gap: 4, icon: "local_shipping", label: "Q.IMPORT", useMeta: useQueueMeta, mp: { q: "import" } },
  { id: "n-qexp", kind: "queue", tone: "queue", path: "queues.export.busy", x: 484.8, y: 284.3, shape: "circle", size: 24, gap: 4, place: "left", icon: "local_shipping", label: "Q.EXPORT", useMeta: useQueueMeta, mp: { q: "export" } },
  { id: "n-yard", kind: "yard", tone: "yard", path: "cargo.bulkTons", x: 513.6, y: 457.8, shape: "square", size: 28, gap: 7, icon: "warehouse", label: "CARGO YARD · CEDIS A", useMeta: useYardMeta },
  { id: "n-cedisb", kind: "yard", tone: "yard", path: "trips.pending", x: 220.7, y: 529.8, shape: "square", size: 18, gap: 5, icon: "inventory_2", label: "CEDIS B", meta: "example site" },
].map((n) => ({ ...n, ...OSM_PROJ.unproject(n.x, n.y) }));
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
// Default pin selection (page state, not kernel): the port, the ships with cargo at the start of the scenario (all
// three ships in port-sim.js), and the cargo yard. The rest are dots until picked on the map or in the pin list.
const DEFAULT_SELECTED = ["n-port", ...SHIPS.filter((x) => x.total > 0).map((x) => `n-ship${x.i}`), "n-yard"];
const markerProps = (n) => ({ id: n.id, className: `node ${n.kind}`, lat: n.lat, lon: n.lon, shape: n.shape, size: n.size, width: n.w, height: n.hh,
  tone: n.tone, icon: n.icon, label: n.label, labelPlacement: n.place || "right", labelOffset: n.gap });
// Boot (no kernel yet): plain markers. Live: PortMarker, a page type that reads the node's meta + work flag from the kernel
// and the tour step, and renders GUI.OpenStreetMap.Marker with a theme `state`:
//   in the current tour step: busy / done from the kernel flag, else highlight;   not in the step: dimmed.
const markerSpec = (n, live) => live
  ? N("PortMarker", `map.${n.id}`, { nodeId: n.id }, undefined, { semanticPath: n.path })
  : N("OpenStreetMapMarker", `map.${n.id}`, { ...markerProps(n), meta: n.meta || "—" }, undefined, { semanticPath: n.path });
const NO_META = () => undefined, NO_WORK = () => undefined;
function PortMarker(p) {
  const n = NODE_BY_ID[p.nodeId];
  const { step } = useStore(ui);
  const meta = (n.useMeta || NO_META)(n.mp || {}) ?? n.meta;
  const work = n.work ? G.useMeValue(n.work) : NO_WORK();
  const inStep = TOUR[step].hlNodes.includes(n.id);
  const state = !inStep ? "dimmed" : work === true ? "busy" : work === false ? "done" : "highlight";
  return h(OSM.Marker, { ...markerProps(n), meta, state, "data-gui-node-id": p["data-gui-node-id"] });
}
let mapMounted = false;
const isOverlayTarget = (t) => !!t?.closest?.(".gui-osm-marker, .gui-osm-legend, .gui-osm-chip, .gui-osm-pins, .gui-osm-controls, .gui-osm-overlay, .gui-osm__attribution");
function MapLifecycle() {   // no element: marks the map as mounted for the adapter's DOM highlights
  React.useEffect(() => { mapMounted = true; lastHlStep = 0; applyMapHighlights(); return () => { mapMounted = false; }; }, []);
  // truck pick: a click / tap on the map is hit-tested against the drawn dots (adapter). pointerdown/up, not
  // click, so it also works while the .GUI inspector (which captures clicks) is on. Clicks on pins and on the
  // map's overlays (legend, chips, pin list, controls, truck card) are theirs, not a truck pick.
  React.useEffect(() => {
    const root = document.querySelector('[data-gui-node-id="map"]'); if (!root) return undefined;
    let down = null;
    const pd = (e) => { down = e.isPrimary && !isOverlayTarget(e.target) ? [e.clientX, e.clientY] : null; };
    const pu = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      down = null;
      const n = truckAt(e.clientX, e.clientY, mapSvg(root), e.pointerType === "touch" ? 14 : 9);
      if (n) pick.set({ n });
    };
    const pm = (e) => { if (e.pointerType === "mouse") root.style.cursor = !isOverlayTarget(e.target) && truckAt(e.clientX, e.clientY, mapSvg(root)) ? "pointer" : ""; };
    root.addEventListener("pointerdown", pd); root.addEventListener("pointerup", pu); root.addEventListener("pointermove", pm);
    return () => { root.removeEventListener("pointerdown", pd); root.removeEventListener("pointerup", pu); root.removeEventListener("pointermove", pm); };
  }, []);
  return null;
}
// The map: theme basemap (by layer kind), markerScale "screen" (pins keep their CSS size while zooming), cooperative
// wheel (the component default: Ctrl/⌘ + wheel or a focused map zooms; otherwise the page scrolls), pin selection with
// edge pins, and the map's own overlays: Legend (top-right), HUD chips (bottom), pin list + truck card (top-left),
// Controls with the layer toggle (right). Flow edges and exit labels stay page SVG drawn in the map's theme variables.
function mapSpec(live) {
  return N("OpenStreetMap", "map", { ...FRAME, basemap: BASEMAP, source: OSM_SOURCE, ariaLabel: "Veracruz port operations", attribution: { position: "bottom-right" },
    markerScale: "screen", defaultSelected: DEFAULT_SELECTED }, [   // in the boot spec too: the map keeps its instance (and selection) when the live spec arrives
    N("PortSvgGroup", "map.edges", { id: "edges" }, EDGES.map(([id, cls, d]) => h("path", { key: id, id, className: cls, d }))),
    N("PortSvgGroup", "map.exit-labels", { id: "exit-labels" }, EXIT_LABELS.map((l) => h("text", { key: l.key, className: "exit-label", x: l.x, y: l.y, textAnchor: l.anchor }, l.text))),
    h("circle", { key: "spotlight", className: "spotlight", id: "spotlight", cx: 0, cy: 0, r: 30, visibility: "hidden" }),
    ...NODES.map((n) => markerSpec(n, live)),
    { type: MapLifecycle },
    N(OSM.Canvas, "map.traffic", { id: "traffic", className: "traffic", onFrame: onMapFrame }),
    ...(live ? [
      N("OpenStreetMapMarkerList", "map.pins", { title: "Pins", mono: true, width: 236, maxHeight: 230, hideBelow: 820 }),
      N("PortTruckCard", "map.truck-card"),
      N("PortLegend", "map.legend"),
      N("PortHud", "map.hud"),
      N("OpenStreetMapControls", "map.controls", { layers: true }),
    ] : []),
  ]);
}

// One brand line: cerebrito + navigable me:// path (SmartCity → hub). Smart Cities left the right menu.
const PATH_SEGMENTS = [
  { text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" },
  { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
  { text: "SmartCities", href: "https://neurons-me.github.io/smart-cities/", title: "Smart Cities hub" },
  { text: "Veracruz.Port", href: null, title: "This page" },
];
function brandBarSpec(s = "brand") {
  const crumb = (seg, i) => {
    const id = `${s}/path:${seg.text.replace(/[^A-Za-z0-9]+/g, "-")}`;
    // After me:// no slash; between later segments use /
    const needSlash = i > 0 && !PATH_SEGMENTS[i - 1].text.endsWith("://");
    const sep = needSlash ? N("Typography", `${s}/sep:${i}`, { component: "span", sx: { color: "text.disabled", mx: .15 } }, "/") : null;
    const node = seg.href
      ? LINK(id, { href: seg.href, underline: "hover", title: seg.title, sx: { color: "primary.main", fontFamily: MONO, fontSize: 13 } }, seg.text)
      : N("Typography", id, { component: "span", title: seg.title, sx: { color: "text.primary", fontFamily: MONO, fontSize: 13, fontWeight: 600 } }, seg.text);
    return sep ? [sep, node] : [node];
  };
  return N("Box", s, {
    component: "header",
    sx: { display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", px: 1.75, py: .85, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", containerType: "inline-size", containerName: "brandbar" },
  }, [
    N("PortBrandLogo", `${s}/logo`),
    N("Box", `${s}/path`, { component: "nav", "aria-label": "me path", sx: { display: "inline-flex", alignItems: "center", flexWrap: "wrap", minWidth: 0 } },
      PATH_SEGMENTS.flatMap(crumb)),
    // Scenario label read from the recipe itself (port-sim.js), never hand-typed.
    N("Box", `${s}/tag:link`, { component: "a", href: SCENARIO_SRC, target: "_blank", rel: "noopener",
      title: `Scenario recipe: port-sim.js (HEAVY = ${HEAVY}, LAST_MILE = ${LAST_MILE})`,
      // The scenario tag gives way before the Inspector does: hidden where it alone would wrap the bar
      // (content box 558–783px: one row fits without it, not with it) and below 450px (no room on row two).
      // (Widths include the theme picker + light/dark toggle in the actions.)
      sx: { display: "inline-flex", textDecoration: "none", cursor: "pointer", "@container brandbar (min-width: 558px) and (max-width: 783.98px)": { display: "none" }, "@container brandbar (max-width: 449.98px)": { display: "none" } } },
      [TAG(`${s}/tag`, "adapter", `port operations · ${HEAVY + LAST_MILE} trucks · guided`)]),
    N("Box", `${s}/actions`, { sx: { ml: "auto", display: "inline-flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" } }, [
      // Spec can't hold a live React element; PortBrandActions mounts the inspector + Docs / GitHub.
      N("PortBrandActions", `${s}/actions:nav`),
    ]),
  ]);
}
function BrandLogo(p) {
  return h(Link, { ...nodeAttrs(p), href: "https://neurons-me.github.io/", title: "neurons.me", underline: "none",
    sx: { display: "inline-flex", alignItems: "center", flexShrink: 0, lineHeight: 0 } },
    h("img", { src: LOGO, alt: ".me", width: 34, height: 34, style: { display: "block", objectFit: "contain" } }));
}
const GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";
function BrandActions(p) {
  return h(Box, { ...nodeAttrs(p), sx: { display: "inline-flex", alignItems: "center", gap: 1.25 } },
    INSPECTOR_ACTION,
    h(Link, { href: "https://neurons-me.github.io/.me/docs/", underline: "hover", "data-gui-node-id": "brand/link.docs",
      sx: { fontFamily: MONO, fontSize: 12, color: "text.secondary" } }, "Docs"),
    h(Link, { href: "https://github.com/neurons-me/.me", underline: "none", "data-gui-node-id": "brand/link.github",
      target: "_blank", rel: "noopener", title: "GitHub · neurons-me/.me", "aria-label": "GitHub",
      sx: { display: "inline-flex", alignItems: "center", lineHeight: 0, color: "text.secondary", "&:hover": { color: "text.primary" } } },
      h("svg", { viewBox: "0 0 16 16", width: 18, height: 18, fill: "currentColor", "aria-hidden": "true" },
        h("path", { d: GITHUB_MARK }))),
    h(ThemeControls, { "data-gui-node-id": "brand/theme" }));
}
// Theme picker + light/dark toggle, both .GUI's own: GUI.ThemesCatalog (the 8-theme catalog, compact row layout)
// in a GUI.Menu, and GUI.ThemeModeToggle. They act on the Theme that GUI.mount wraps the page in (PageTheme), which
// persists to the page-scoped keys in window.__thisGuiThemeScope. The button's label is the Theme's own state
// (GUI.useThemeContext, exported since 4.1.0). The whole map follows the same theme: basemap, pins, overlays, canvas ink.
// data-gui-inspector-control: these keep acting while the Semantic Inspector is on (like ThemeLauncher).
const THEME_BTN_SX = { ...INSPECTOR_SX, px: .75, gap: .5, minWidth: 0, "& .theme-picker__label": { "@container brandbar (max-width: 1072px)": { display: "none" } } };
function themeMenuKeys(e) {
  if (e.key === "Tab") { e.stopPropagation(); return; }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const btns = [...e.currentTarget.querySelectorAll("button")], i = btns.indexOf(document.activeElement);
  const next = btns[(i < 0 ? 0 : i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length];
  if (next) { e.preventDefault(); e.stopPropagation(); next.focus(); }
}
function ThemeControls(p) {
  const [anchor, setAnchor] = React.useState(null);
  const { themeId } = G.useThemeContext();
  const close = () => setAnchor(null);
  return h(Box, { "data-gui-node-id": p["data-gui-node-id"], "data-gui-inspector-control": "true", sx: { display: "inline-flex", alignItems: "center", gap: .25, flexShrink: 0 } },
    h(Button, { id: "theme-picker", size: "small", variant: "outlined", "data-gui-inspector-control": "true",
      "aria-label": `Theme: ${themeId}`, "aria-haspopup": "true", "aria-expanded": anchor ? "true" : "false", "aria-controls": anchor ? "theme-menu" : undefined,
      title: `Theme: ${themeId} (.GUI theme catalog)`, onClick: (e) => setAnchor(e.currentTarget), sx: THEME_BTN_SX },
      h(G.Icon, { name: "palette", fontSize: 15, "aria-hidden": "true" }),
      h(Box, { component: "span", className: "theme-picker__label" }, themeId),
      h(G.Icon, { name: "expand_more", fontSize: 15, "aria-hidden": "true" })),
    h(G.Molecules.Menu, { id: "theme-menu", anchorEl: anchor, open: !!anchor, onClose: close,
      anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" },
      slotProps: { list: { "aria-label": "Themes", dense: true }, paper: { "data-gui-inspector-control": "true", "data-gui-node-id": "brand/theme.menu", sx: { width: 220, p: .5, mt: .5 } } } },
      // Keyboard: Tab / Shift+Tab and ↑ / ↓ move between the catalog's theme buttons (MUI Menu closes on Tab and
      // only arrows through MenuItems, so those keys stop here); Enter picks; Escape / click-away close.
      h(Box, { onKeyDown: themeMenuKeys },
        h(G.ThemesCatalog, { sidebarView: "expanded", onThemeSelect: close }))),
    h(G.ThemeModeToggle, { id: "theme-mode-toggle", variant: "minimal", iconSize: "small", "data-testid": "theme-mode-toggle",
      sx: { p: "2px", color: "text.secondary" } }));
}
function asideSpec(live) {
  // Nothing sits below the aside (the old page footer now lives in the kernel strip), so in the stacked layout
  // (≤1000px) the aside simply ends where its content ends: growing when the kernel arrives moves nothing (CLS 0).
  return N("Box", "aside", { component: "aside", sx: { bgcolor: "background.paper", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, borderLeft: 1, borderColor: "divider" } }, [
    N("PortRunControls", "aside/controls"),
    N("PortKernelStrip", "aside/kernel", {}, [provenanceSpec()]),
    N("PortTour", "aside/tour"),
    N("Box", "aside/panels", { sx: { flex: 1, overflowY: "auto", p: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 1.25 } },
      live ? [modelPanel(), pathsPanel(), mutatePanel(), explainPanel(), shipsPanel(), trainPanel(), trucksPanel(), lastMilePanel(), stocksPanel(), adapterPanel(live)] : [N("PortKernelWait", "aside/waiting")]),
  ]);
}
const mapPanelSpec = (live) => N("Box", "map-panel", { className: "map-wrap", sx: { position: "relative", overflow: "hidden", bgcolor: "background.default", minHeight: 300 } },
  [mapSpec(live)]);
// Build provenance (formerly the page footer), inside the kernel strip under its header line. The kernel's
// version and sha256 are on that header line (npm link), so they are not repeated here. The map keeps its own
// "© OpenStreetMap contributors · ODbL" corner attribution at all times (license), whatever this strip shows.
const BUILD_NOTES = "https://github.com/neurons-me/.me/tree/main/docs/Tests/veracruz-port";
function provenanceSpec(s = "aside/kernel/provenance") {
  const A = (id, href, text) => LINK(`${s}/${id}`, { href, target: "_blank", rel: "noopener", underline: "hover" }, text);
  const ROW = (key, label, children) => N("Box", `${s}/${key}`, { sx: { display: "grid", gridTemplateColumns: "58px minmax(0, 1fr)", gap: .75, px: 1.5, py: .55, borderBottom: 1, borderColor: "divider" } }, [
    N("Box", `${s}/${key}:label`, { component: "span", sx: { color: "text.disabled" } }, label),
    N("Box", `${s}/${key}:value`, { component: "span", sx: { minWidth: 0, overflowWrap: "anywhere" } }, children)]);
  return N("Box", s, { id: "kernel-provenance", "aria-label": "Build provenance", sx: { fontFamily: MONO, fontSize: 9.5, lineHeight: 1.45, color: "text.secondary", bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
    "& a": { color: "primary.main" }, "& b": { color: "text.primary", fontWeight: 500 }, "& > :last-of-type": { borderBottom: 0 } } }, [
    ROW("kernel", "kernel", ["dist/me.es.js unmodified · sha256 checked in this browser · ", A("kernel:npm", NPM_KERNEL, "npm")]),
    ROW("gui", ".GUI", [N("PortGuiBuild", `${s}/gui:build`)]),
    ROW("basemap", "basemap", ["© ", A("basemap:osm", "https://www.openstreetmap.org/copyright", "OpenStreetMap"), " contributors · ODbL · static SVG basemap · no live tiles"]),
    ROW("notes", "build", [A("notes:link", BUILD_NOTES, "build notes"), " · how this page is built and pinned"]),
  ]);
}
function pageSpec(live) {
  return N("Box", "page", { sx: { display: "flex", flexDirection: "column", height: "100vh", minHeight: 640, bgcolor: "background.default", color: "text.primary", "@media (max-width:1000px)": { height: "auto" } } }, [
    brandBarSpec(),
    N("Box", "layout", { className: "layout", sx: { flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", minHeight: 0, "@media (max-width:1000px)": { gridTemplateColumns: "1fr", gridTemplateRows: "minmax(300px, 42vh) auto" } } },
      [mapPanelSpec(live), asideSpec(live)]),
  ]);
}
// Built once: the same spec objects are handed to every mount() call (before / after the kernel loads).
const SPEC_BOOT = pageSpec(false), SPEC_LIVE = pageSpec(true);

// The page theme is handed to GUI.mount (which wraps the tree, inspector included, in gui.Theme). These are only the
// defaults: the topbar ThemeControls change theme / mode and Theme persists them to the page-scoped keys.
const PageTheme = ({ children }) => h(G.Theme, { initialThemeId: "neurons.me", initialMode: "dark" }, children);

// ══════════════════════════ adapter: map layer, loop, kernel lifecycle ══════════════════════════
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
let lastHlStep = 0;
function applyMapHighlights() {
  const step = ui.state.step; if (!mapMounted || step === lastHlStep) return; lastHlStep = step;
  const t = TOUR[step];
  $$("#edges .edge").forEach((e) => { e.classList.remove("hl", "dimmed"); e.classList.add(t.hlEdges.includes(e.id) ? "hl" : "dimmed"); });
}
ui.subscribe(applyMapHighlights);

// Marker busy / done / highlight / dimmed are GUI marker states now (PortMarker: kernel flag + tour step). The adapter
// only flashes the kernel writes on the map: a short "hit" class on the pins whose paths were written, and the wave on
// edges between two hit pins.
function lightHits() {
  if (!mapMounted) return;
  const lit = new Set([...hitPaths].map(nodeOfPath).filter(Boolean));
  hitPaths.clear();
  $$(".gui-osm-marker.node").forEach((n) => n.classList.toggle("hit", lit.has(n.id)));
  for (const [eid, [a, b]] of Object.entries(EDGE_ENDS)) document.getElementById(eid)?.classList.toggle("wave", lit.has(a) && lit.has(b));
}
function onFlush(writes, now) {
  flushCount++; writeCount += writes.length;
  lastFlush = { writes, idx: flushCount, sim: T.simTime };
  flushLog.push({ t: now, n: writes.length, kMax: Math.max(...writes.map((w) => w.k)) });
  if (flushLog.length > 400) flushLog = flushLog.filter((f) => now - f.t <= 2000);
  for (const w of writes) { hitPaths.add(w.source); pendingPaths.add(w.source); for (const p of w.recomputed) { hitPaths.add(p); pendingPaths.add(p); } }
}
// one UI tick: kernel-reported paths → GUI subscribers; adapter state → GUI; map labels
function uiTick() { announceKernelPaths(); sim.set(); lightHits(); }
function uiRefreshAll() { announceAll(); sim.set(); }

// Truck / address colours are the map's theme palette (Canvas onFrame → palette), the same tones the legend swatches use:
// [colour from the palette, alpha]. Positions stay adapter-only; only the ink follows the theme.
const COLORS = {
  enRouteImp: (p) => [p.domain.ship, 1], enRouteExp: (p) => [p.domain.train, 1], loading: (p) => [p.domain.yard, 1], queued: (p) => [p.tones.secondary, 1],
  returning: (p) => [p.tones.neutral, 0.85], idle: (p) => [p.tones.neutral, 0.5],
  lmEnRoute: (p) => [p.tones.error, 1], lmReturning: (p) => [p.tones.error, 0.6], lmLoading: (p) => [p.tones.error, 1], lmIdle: (p) => [p.tones.error, 0.35] };
const DRAW_ORDER = ["idle", "returning", "queued", "enRouteExp", "enRouteImp", "loading", "lmIdle", "lmReturning", "lmLoading", "lmEnRoute"];
const MOVING = new Set(MOVING_STATES);   // driving along a route (the adapter's own list)
const jit = (id, k) => ((Math.sin(id * 12.9898 + k * 78.233) * 43758.5453) % 1) * 1.6;   // lane offset per truck
const POOL = { x: 470, y: 478, cols: 20, gap: 3.2 };
const LM_POOL = [{ x: 540, y: 478 }, { x: CEDIS[1].pt[0] - 14, y: CEDIS[1].pt[1] + 14 }];
const BERTH_OFF = (slot) => [-12 + (slot % 8) * 4.2, -2 + Math.floor(slot / 8) * 4.2];
const buckets = Object.fromEntries(DRAW_ORDER.map((k) => [k, []]));
const ADDR = { planned: (p) => [p.tones.neutral, 0.35], unassigned: (p) => [p.tones.neutral, 0.35], active: (p) => [p.tones.error, 0.7], done: (p) => [p.tones.warning, 0.9], unscheduled: (p) => [p.tones.error, 0.3] };
const ADDR_ORDER = ["planned", "unassigned", "unscheduled", "active", "done"];
const addrB = Object.fromEntries(ADDR_ORDER.map((k) => [k, []]));
const ringAbove = [], ringBelow = [];
// where each truck dot was drawn this frame (map pixels), for the click hit-test; adapter-side only
const drawnX = new Float32Array(FLEET), drawnY = new Float32Array(FLEET), drawnOn = new Uint8Array(FLEET);
function truckAt(clientX, clientY, svg, tolPx = 9) {   // client point → nearest drawn truck (unit n) within tolPx
  const m = svg?.getScreenCTM?.(); if (!m) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  const tol = tolPx / (m.a || 1); let best = -1, bd = tol * tol;
  for (let i = 0; i < FLEET; i++) if (drawnOn[i]) { const dx = drawnX[i] - pt.x, dy = drawnY[i] - pt.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
  return best < 0 ? null : best + 1;
}
const mapSvg = (root) => root?.querySelector("svg.gui-osm__svg");   // the map's own SVG (not a control glyph); its CTM follows zoom / pan

// ctx / pal / ms: from GUI.OpenStreetMap.Canvas (map pixels, cleared, clipped; theme palette; markerScale, so with
// markerScale "screen" the dots and rings keep their on-screen size while zooming; positions are still map pixels).
function drawTrucks(ctx, pal, ms = 1) {
  if (!T) return;
  // 1,000 address points: dim until delivered
  for (const k of ADDR_ORDER) addrB[k].length = 0;
  for (const tp of T.trips) addrB[tp.st].push(tp.x, tp.y);
  for (const k of ADDR_ORDER) {
    const b = addrB[k]; if (!b.length) continue;
    const r = (k === "done" ? 1.4 : 1.1) * ms;
    [ctx.fillStyle, ctx.globalAlpha] = ADDR[k](pal);
    for (let i = 0; i < b.length; i += 2) ctx.fillRect(b[i] - r, b[i + 1] - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  for (const k of DRAW_ORDER) buckets[k].length = 0;
  ringAbove.length = 0; ringBelow.length = 0;
  moving = 0; offMap = 0; drawnOn.fill(0);
  const lmPoolIdx = [0, 0];
  for (const tr of T.trucks) {
    const vis = VIS_OF[tr.st];
    if (!vis) { offMap++; continue; }
    if (vis === "queued") continue;   // laid out from the queue arrays below
    if (MOVING.has(tr.st)) moving++;
    let x, y;
    if (tr.st === "pool") { x = POOL.x + (tr.id % POOL.cols) * POOL.gap; y = POOL.y + Math.floor(tr.id / POOL.cols) * POOL.gap; }
    else if (tr.st === "impLoading") { const b = KEY[`berth${tr.ship}`], o = BERTH_OFF(tr.slot); x = b[0] + o[0]; y = b[1] + o[1]; }
    else if (tr.st === "expUnloading") { x = KEY.train[0] - 38 + (tr.slot % 20) * 4; y = KEY.train[1] + 13; }
    else if (tr.st === "lmPool") { const p = LM_POOL[tr.home], i = lmPoolIdx[tr.home]++; x = p.x + (i % 8) * 3.2; y = p.y + Math.floor(i / 8) * 3.2; }
    else if (tr.st === "lmLoading") { const c = CEDIS[tr.home].pt; x = c[0] - 12 + (tr.slot % 6) * 4; y = c[1] - 16 - Math.floor(tr.slot / 6) * 4; }
    else { x = tr.x + jit(tr.id, 1); y = tr.y + jit(tr.id, 2); }
    buckets[vis].push(x, y); drawnX[tr.id] = x; drawnY[tr.id] = y; drawnOn[tr.id] = 1;
    if (tr.cat === "lastMile" && tr.band !== "within") (tr.band === "above" ? ringAbove : ringBelow).push(x, y);
  }
  const lay = (q, node) => q.forEach((tr, i) => { const x = node[0] - 14 + (i % 10) * 3.6, y = node[1] + 17 + Math.floor(i / 10) * 3.6; buckets.queued.push(x, y); drawnX[tr.id] = x; drawnY[tr.id] = y; drawnOn[tr.id] = 1; });
  lay(T.queues.impQ, KEY.qimp); lay(T.queues.expQ, KEY.qexp);
  if (moving > maxMoving) maxMoving = moving;
  for (const k of DRAW_ORDER) {
    const b = buckets[k]; if (!b.length) continue;
    const r = (k === "idle" ? 1.2 : k.startsWith("lm") ? (k === "lmIdle" ? 1.1 : 1.9) : 2.2) * ms;
    [ctx.fillStyle, ctx.globalAlpha] = COLORS[k](pal);
    ctx.beginPath();
    for (let i = 0; i < b.length; i += 2) { ctx.moveTo(b[i] + r, b[i + 1]); ctx.arc(b[i], b[i + 1], r, 0, 6.2832); }
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.lineWidth = 0.9 * ms;
  for (const [b, col] of [[ringAbove, pal.tones.warning], [ringBelow, pal.tones.info]]) {
    if (!b.length) continue;
    ctx.strokeStyle = col; ctx.beginPath();
    for (let i = 0; i < b.length; i += 2) { ctx.moveTo(b[i] + 3 * ms, b[i + 1]); ctx.arc(b[i], b[i + 1], 3 * ms, 0, 6.2832); }
    ctx.stroke();
  }
  const sel = pick.state.n;   // ring around the picked truck instance (if it is on the map)
  if (sel && drawnOn[sel - 1]) { ctx.strokeStyle = pal.states.highlight; ctx.lineWidth = 1.3 * ms; ctx.beginPath(); ctx.arc(drawnX[sel - 1], drawnY[sel - 1], 5.5 * ms, 0, 6.2832); ctx.stroke(); }
}


// ── main loop: adapter steps → one flush per animation tick → kernel writes (driven by the map canvas layer) ──
let lastNow = 0, lastSpeedAt = -1e9;
const SPEED_SAMPLE_MS = 250;   // the per-fleet speed facts are sampled at most 4×/s (they only feed averages)
function onMapFrame({ ctx, now, palette, markerScale }) {
  const dtReal = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
  lastNow = now;
  frameLog.push(now); if (frameLog.length > 240) frameLog = frameLog.filter((t) => now - t <= 1000);
  if (running && T) {
    let s = dtReal * speedOf();
    while (s > 1e-9) { const d = Math.min(0.5, s); T.step(d); s -= d; }
    const writes = T.flush();                 // ← real kernel writes happen here
    if (now - lastSpeedAt >= SPEED_SAMPLE_MS) { lastSpeedAt = now; writes.push(...T.speedFlush()); }
    if (writes.length) onFlush(writes, now);
    if (T.done()) setRunning(false, true);
  }
  drawTrucks(ctx, palette, markerScale);
  if (now - lastUi > 250) { lastUi = now; if (P) uiTick(); }
}

function setRunning(on, finished = false) {
  running = on && !(T && T.done());
  ui.set({ running, finished: finished || !!(T && T.done()) });
}
function resetKernel() {
  P = createPortKernel(ME);
  T = createTraffic({ kernel: P, ROUTES, KEY, PROJ });
  RT = G.createMeRuntime(P.me, { subscribe: kernelSubscribe });
  flushLog = []; lastFlush = null; flushCount = 0; writeCount = 0; maxMoving = 0; hitPaths.clear(); pendingPaths.clear();
  running = false;
  mountPage();
  ui.set({ me: P.me, runtime: RT, seed: P.seedLog.join("\n"), verify: { tone: "", text: VERIFY_HINT }, running: false, finished: false });
  uiRefreshAll();
}
// adapter-vs-kernel cross-checks passed to verifyFromScratch (after a flush)
function adapterChecks() {
  const ac = T.adapterCounters();
  const hi = P.read("trips.bandHigh"), lo = P.read("trips.bandLow");
  const n = { above: 0, within: 0, below: 0 }; let mx = 0, mn = Infinity;
  for (const u of T.units) { n[T.classify(u, hi, lo)]++; const L = u.done + u.plan.length + (u.trip && u.trip.st === "active" ? 1 : 0); mx = Math.max(mx, L); mn = Math.min(mn, L); }
  return [
    ...[...COUNTERS, ...TRIP_COUNTERS].map((c) => [`adapter vs kernel ${c}`, P.read(c), ac[c] || 0]),
    ...UNIT_IDS.map((i) => [`adapter vs kernel lastMile.units[${i}].done`, P.read(`lastMile.units.${i}.done`), ac[`lastMile.units.${i}.done`]]),
    ["band: unitsAbove = adapter recount", P.read("lastMile.unitsAbove"), n.above],
    ["band: unitsWithin = adapter recount", P.read("lastMile.unitsWithin"), n.within],
    ["band: unitsBelow = adapter recount", P.read("lastMile.unitsBelow"), n.below],
    ["trips.unitMax = adapter recount", P.read("trips.unitMax"), mx],
    ["trips.unitMin = adapter recount", P.read("trips.unitMin"), mn],
    ["trips.redirects = adapter count", P.read("trips.redirects"), T.redirects],
    ...(() => { const v = T.speedNow(); return SPEED_FACTS.map((f) => [`adapter vs kernel ${f} (speed sample)`, P.read(f), v[f]]); })(),
    ...truckInstanceChecks(),
  ];
}
// per-truck kernel instances vs the counters and the adapter (a JS recount: the kernel does not count instances)
function truckInstanceChecks() {
  const byCounter = {}; let stateMismatch = 0, working = 0, heavy = 0;
  for (const tr of T.trucks) {
    const n = tr.id + 1, st = TRUCK_STATES[P.read(`trucks.unit.${n}.state`)];
    if (st !== tr.st) stateMismatch++;
    byCounter[COUNTER_OF[st]] = (byCounter[COUNTER_OF[st]] || 0) + 1;
    if (P.read(`trucks.unit.${n}.working`) === true) working++;
    if (P.read(`trucks.unit.${n}.heavy`) === true) heavy++;
  }
  return [
    ...COUNTERS.map((c) => [`Σ trucks.unit[i] with state in ${c} = ${c}`, byCounter[c] || 0, P.read(c)]),
    ["trucks whose kernel state ≠ adapter state", stateMismatch, 0],
    ["Σ trucks.unit[i].working = trucks.working", working, P.read("trucks.working")],
    ["Σ trucks.unit[i].heavy = trucks.heavy.fleet", heavy, P.read("trucks.heavy.fleet")],
  ];
}
function verifyNow() {
  const writes = [...T.flush(), ...T.speedFlush()];
  if (writes.length) onFlush(writes, performance.now());
  return P.verifyFromScratch(adapterChecks());
}
function verify() {
  const v = verifyNow();
  ui.set({ verify: v.ok
    ? { tone: "ok", text: `✓ ${v.checked} checks pass: every derived path matches a fresh kernel rebuild (none undefined, except a speed average while its fleet has 0 moving); Σ counters = ${FLEET} (${HEAVY} heavy + ${LAST_MILE} last-mile); trips done + pending + unscheduled = ${TRIP_COUNT}; above + within + below = ${LAST_MILE}; bandHigh/bandLow = avg × 1.15 / × 0.85; adapter states = kernel counters; Σ trucks.unit[i] by state = counters (JS recount); speed facts = adapter sample, trucks.speed.avg = weighted mean (undefined only while 0 moving) (sim ${clock(T.simTime)}, ${fmt(writeCount)} writes).` }
    : { tone: "bad", text: `✗ mismatches: ${JSON.stringify(v.mismatches)}` } });
  uiTick();
  return v;
}

// ── boot ──
const params = new URLSearchParams(location.search);
{
  ui.set({ open: readOpenState(), step: Math.min(STEPS, Math.max(1, parseInt(params.get("step") || "1", 10) || 1)) });
  if (params.has("step")) setTourOpen(true);   // a ?step= link opens the overview (saved, as before)
  if (params.get("speed")) ui.set({ speed: Number(params.get("speed")) || 10 });
}
// GUI.mount resolves the page spec (SPEC_BOOT until the kernel is loaded, then SPEC_LIVE) through the GUI
// registry + the page-local types, with .GUI's Semantic Inspector (lazy, opt-in).
// Re-called after each kernel reset so readouts and the inspector use the current kernel and the SAME runtime (RT).
const ROOT = document.getElementById("root"), MOUNT_GUI = { ...G, Theme: PageTheme, registry: { ...G.registry, ...PAGE_TYPES } };
const INSPECTOR_ON = params.get("inspector") === "1";
// The top-bar toggle reads GUI's stored preference: align it with the real start state (off unless ?inspector=1).
if (G.getInspectorEnabled() !== INSPECTOR_ON) G.setInspectorEnabled(INSPECTOR_ON);
const DEVTOOLS = { enabled: true, inspector: INSPECTOR_ON, adminView: false, inspectorToggleVisible: false };
let mountHandle = null;
function mountPage() { mountHandle = G.mount(RT ? SPEC_LIVE : SPEC_BOOT, ROOT, RT ? { gui: MOUNT_GUI, me: P.me, runtime: RT, devtools: DEVTOOLS } : { gui: MOUNT_GUI, devtools: DEVTOOLS }); }
mountPage();

try {
  const [{ mod, host, hash, url, version }, guiHash] = await Promise.all([loadKernel(), verifyGuiBuild()]);
  ME = mod.default || mod.ME;
  ui.set({ kernel: { state: "ok", version, hash, url, text: `Kernel <b>this.me@${version.replace(/[&<>"]/g, "")}</b> · dist/me.es.js from ${host} · sha256 ${hash.slice(0, 12)}… <b>verified</b> · unmodified` }, gui: { state: "ok", hash: guiHash } });
  resetKernel();
  if (params.get("autostart") !== "0") setRunning(true);
  // hooks for headless checks
  window.__port = {
    get P() { return P; }, get T() { return T; },
    verify,
    pause: () => setRunning(false),
    // truck dots as drawn last frame, in client pixels: [unit n, x, y, adapter state]
    truckPoints() {
      const m = mapSvg(document.querySelector('[data-gui-node-id="map"]'))?.getScreenCTM(); if (!m) return [];
      const out = [];
      for (let i = 0; i < FLEET; i++) if (drawnOn[i]) { const q = new DOMPoint(drawnX[i], drawnY[i]).matrixTransform(m); out.push([i + 1, q.x, q.y, T.trucks[i].st]); }
      return out;
    },
    pick: (n) => pick.set({ n }),
    gui: { version: G.version, build: GUI_PIN, get announced() { return announced; }, listeners: () => kListeners.size, callbacks: bridgeCallbacks,
      get runtime() { return RT; }, unmount: () => mountHandle?.unmount(), remount: () => mountPage() },
    // every GUI readout bound to a .me path, compared with a direct kernel read (after React commits)
    // (UI ticks at 4 Hz, so while traffic runs the readouts trail the kernel by up to 250 ms: pause first)
    async consistency() {
      uiTick();
      await new Promise((r) => setTimeout(r, 80));
      const els = [...document.querySelectorAll("[data-me-path][data-me-value]")];
      const bad = els.filter((e) => e.dataset.meValue !== String(P.read(e.dataset.mePath))).map((e) => ({ path: e.dataset.mePath, dom: e.dataset.meValue, kernel: String(P.read(e.dataset.mePath)) }));
      return { bound: els.length, paths: new Set(els.map((e) => e.dataset.mePath)).size, mismatches: bad };
    },
    // run the same adapter + flush loop synchronously to completion (no animation)
    drain({ dt = 1, stepsPerFlush = 2, verifyEvery = 1000 } = {}) {
      setRunning(false);
      const t0 = performance.now();
      let flushes = 0, writes = 0, checks = 0, failures = [], kMax = 0, kSum = 0, steps = 0;
      while (!T.done() && T.simTime < 200000) {
        for (let i = 0; i < stepsPerFlush; i++) T.step(dt);
        const w = T.flush();
        if (++steps % 8 === 0) w.push(...T.speedFlush());   // speed facts: sampled, not every flush
        if (!w.length) continue;
        onFlush(w, performance.now()); flushes++; writes += w.length;
        for (const x of w) { kMax = Math.max(kMax, x.k); kSum += x.k; }
        if (flushes % verifyEvery === 0) { const v = verifyNow(); checks++; if (!v.ok) failures.push({ sim: T.simTime, mismatches: v.mismatches }); }
      }
      const wallMs = performance.now() - t0;
      const final = verify();
      setRunning(false, true); uiTick();
      return { done: T.done(), simTime: T.simTime, simClock: clock(T.simTime), flushes, writes, hauls: T.totalHauls,
        trips: { done: P.read("trips.done"), unscheduled: P.read("trips.unscheduled"), pending: P.read("trips.pending"), redirects: P.read("trips.redirects"), perUnitDoneAvg: P.read("trips.perUnitDoneAvg"), max: P.read("trips.unitMax"), min: P.read("trips.unitMin"), band: [P.read("lastMile.unitsAbove"), P.read("lastMile.unitsWithin"), P.read("lastMile.unitsBelow")] }, wallMs, writesPerSec: Math.round(writes / (wallMs / 1000)), kMax, kAvg: kSum / writes, periodicChecks: checks, failures, final: { ok: final.ok, checked: final.checked, mismatches: final.mismatches } };
    },
    // fast-forward `simSec` simulated seconds with the same step + flush loop (no animation)
    advance(simSec, dt = 1) {
      const end = T.simTime + simSec;
      while (!T.done() && T.simTime < end) { T.step(dt); const w = T.flush(); if (w.length) onFlush(w, performance.now()); }
      { const w = T.speedFlush(); if (w.length) onFlush(w, performance.now()); }
      uiTick();
      return { simClock: clock(T.simTime), tripsDone: P.read("trips.done"), band: [P.read("lastMile.unitsAbove"), P.read("lastMile.unitsWithin"), P.read("lastMile.unitsBelow")] };
    },
    // real-time animated run for `ms`; returns fps and kernel writes/s actually achieved
    realtime(ms = 5000, spd = 10) {
      ui.set({ speed: spd }); setRunning(true);
      const w0 = writeCount, f0 = flushCount, t0 = performance.now(); let frames = 0, worst = 0, last = t0; maxMoving = 0;
      return new Promise((resolve) => {
        (function tick(now) {
          frames++; worst = Math.max(worst, now - last); last = now;
          if (now - t0 < ms) return requestAnimationFrame(tick);
          const sec = (now - t0) / 1000;
          resolve({ simClock: clock(T.simTime), tripsDone: P.read("trips.done"), redirects: P.read("trips.redirects"), band: [P.read("lastMile.unitsAbove"), P.read("lastMile.unitsWithin"), P.read("lastMile.unitsBelow")], seconds: sec, fps: frames / sec, worstFrameMs: worst, writesPerSec: (writeCount - w0) / sec, flushesPerSec: (flushCount - f0) / sec, maxMovingDots: maxMoving, simTime: T.simTime, working: P.read("trucks.working"), balanced: P.read("trucks.balanced") });
        })(t0);
      });
    },
  };
  window.__portReady = true;
} catch (e) {
  const msg = String(e?.message || e).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const guiFail = /^\.GUI build/.test(String(e?.message || ""));
  if (guiFail) ui.set({ gui: { state: "error" } });
  if (!ME) ui.set({ kernel: { state: "error", mismatch: !!e?.mismatch && !guiFail, detail: String(e?.message || e), text: `<b>${guiFail ? ".GUI build check failed" : "Kernel failed to load"}</b>: ${msg}. Nothing on this page runs without it.` } });
  setTourOpen(true, false);
  window.__portError = String(e?.message || e);
}
