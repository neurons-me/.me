// Port of Veracruz: .GUI interface (this.gui feat/openstreetmap @ed06869, unreleased branch build, self-hosted UMD,
// SRI-pinned in the HTML and sha256-checked in the browser below). The map is GUI.OpenStreetMap.
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

import { createPortKernel, COUNTERS, TRIP_COUNTERS, UNIT_IDS, FLEET, HEAVY, LAST_MILE, TRIP_COUNT } from "./port-sim.js";
import { createTraffic, VIS_OF, CONFIG, SIM_START_H } from "./port-traffic.js";
import { ROUTES, KEY, EXITS, PROJ } from "./port-routes.js";
import { CEDIS } from "./port-lastmile.js";

const KERNEL = {
  version: "4.1.0",
  sha256: "47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa",
  urls: ["https://cdn.jsdelivr.net/npm/this.me@4.1.0/dist/me.es.js", "https://unpkg.com/this.me@4.1.0/dist/me.es.js"],
};
// .GUI build: not on npm yet, so the exact UMD built from the PR head commit is self-hosted next to this file.
const GUI_PIN = { label: "this.gui feat/openstreetmap @ed06869", branch: "feat/openstreetmap", commit: "ed06869b65a6ee921ce7b51b371e35015886af1f", short: "ed06869",
  pr: "https://github.com/neurons-me/GUI/pull/3", url: new URL("vendor/this.gui-ed06869.umd.js", import.meta.url).href,
  sha256: "d5b256370f999fcae68f9c6ccef3ad0b09528f0bd8378c6e1bb58966d62e668a", sri: "sha384-LXkXfVwL5RIcJ3MHsgVViBYklGX0njWyjo6N/jxEQYFDL4Coy8qiWGxKUfCSQmfA" };

const G = window.GUI, h = React.createElement;
const { Box, Button, Typography, Chip, Progress, Paper, Link, TextField } = G.Atoms;
const { Collapse, MenuItem } = G.Molecules;

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
const VERIFY_HINT = "Flushes, then rebuilds a fresh kernel from the current facts + same formulas and compares every derived path; checks Σ counters = 500, trips done + pending + unscheduled = 1,000, above + within + below = 100, band limits, and adapter states vs kernel counters.";
const ui = createStore({ step: 1, tourOpen: false, glossaryOpen: false, running: false, finished: false, speed: 10, me: null, runtime: null, kernel: { state: "loading", text: `Loading this.me@${KERNEL.version}…` }, verify: { tone: "", text: VERIFY_HINT }, seed: "—" });
const sim = createStore({});   // bumped by the adapter at ~4 Hz: sim clock, page stats, feeds

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
  { title: "1 · Port overview", body: "You are at the <strong>Port of Veracruz</strong>. Three ships unload (import), one train loads (export), and <strong>500 trucks</strong> (400 heavy, 100 last-mile) circulate on real OpenStreetMap roads; every dot is one truck. Every number on the right reads a path of the real kernel.",
    hlNodes: ["n-port", "n-ship1", "n-ship2", "n-ship3", "n-train"], hlEdges: ["e-ship1-q", "e-ship2-q", "e-ship3-q", "e-qexp-train"], hlPanels: [] },
  { title: "2 · Stocks (facts)", body: "<strong>me.cargo.coffee(100000)</strong>, sugar(200000), containers(5000), <strong>me.trucks.fleet(500)</strong> = heavy.fleet(400) + lastMile.fleet(100). A fact changes only when a write says so. <strong>cargo.bulkTons</strong> is a kernel rule: coffee + sugar.",
    hlNodes: ["n-yard"], hlEdges: ["e-port-yard"], hlPanels: ["panel-stocks"] },
  { title: "3 · Ships unloading", body: "Each ship has facts <strong>total, remaining, tonsPerUnit</strong>. Kernel rules: <strong>remainingTons = remaining * tonsPerUnit</strong>, and <strong>importRemaining</strong> = the explicit sum over ships[1], [2], [3]. Laden import trucks (blue) leave Veracruz over the highways, off the map edge.",
    hlNodes: ["n-ship1", "n-ship2", "n-ship3", "n-qimp"], hlEdges: ["e-ship1-q", "e-ship2-q", "e-ship3-q"], hlPanels: ["panel-ships"] },
  { title: "4 · Train loading", body: "<strong>train[1].remainingToLoad</strong> is a fact; <strong>flows.exportRemaining</strong> and <strong>train[1].progress</strong> are kernel rules. Export trucks (amber) come in from outside the map with sugar and unload into the train.",
    hlNodes: ["n-train", "n-qexp", "n-yard"], hlEdges: ["e-yard-qexp", "e-qexp-train"], hlPanels: ["panel-train"] },
  { title: "5 · Trucks by state", body: "Every truck state is a counter fact (<strong>trucks.heavy.available</strong>, <strong>queues.import.length</strong>, <strong>trucks.import.enRoute</strong>, <strong>trucks.lastMile.loading</strong>…). Kernel rules sum them: <strong>trucks.working</strong>, <strong>trucks.accounted</strong>, <strong>trucks.balanced = accounted == fleet</strong>. <em>Where</em> each truck drives is adapter logic (dashed panel).",
    hlNodes: ["n-qimp", "n-qexp", "n-port", "n-yard"], hlEdges: ["e-qimp-port", "e-qexp-train"], hlPanels: ["panel-queues", "panel-adapter"] },
  { title: "6 · Last-mile dispatch", body: "100 small trucks (pink) run an example schedule of <strong>1,000 trips</strong> from CEDIS A (cargo yard) and CEDIS B (example site) to addresses on OSM streets; address points light up when delivered. A greedy plan fills each unit's shift, then units are rebalanced to <strong>avg ± 15%</strong> (amber ring above, cyan below). Trip counters, band limits and per-unit sums are kernel; the heuristic is adapter.",
    hlNodes: ["n-yard", "n-cedisb"], hlEdges: [], hlPanels: ["panel-lastmile"] },
  { title: "7 · Live traffic", body: "Press <strong>Start traffic</strong>. Speeds are assumptions (heavy 25 km/h, last-mile 22 km/h, travel time from route metres); playback ×10 by default. Each animation tick the adapter flushes <strong>real writes</strong> (one call per changed fact), listed exactly with the kernel's own <strong>k</strong>.",
    hlNodes: ["n-qimp", "n-ship2", "n-port", "n-yard"], hlEdges: ["e-ship2-q", "e-qimp-port"], hlPanels: ["panel-mutate"] },
  { title: "8 · Explain why", body: "<strong>me.explain(\"trips.bandHigh\")</strong> returns the expression, every input with its value, and <strong>sourcePath</strong>, the write that last recomputed it. <strong>Verify</strong> rebuilds a fresh kernel from the facts and compares everything.",
    hlNodes: ["n-port", "n-ship1", "n-ship2", "n-ship3"], hlEdges: ["e-ship1-q", "e-ship2-q", "e-ship3-q"], hlPanels: ["panel-explain", "panel-adapter"] },
];
const STEPS = TOUR.length - 1;
const TOUR_KEY = "veracruz-port.tourOpen";
function setTourOpen(open, persist = true) {
  ui.set({ tourOpen: open });
  if (persist) { try { localStorage.setItem(TOUR_KEY, open ? "1" : "0"); } catch (e) { /* storage unavailable */ } }
}
const setStep = (step) => ui.set({ step: Math.min(STEPS, Math.max(1, step)) });

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
function SrcTag({ kind, label }) {   // kernel → aurora accent; adapter → ember accent
  return h(Chip, { size: "small", variant: "outlined", label, sx: srcTagSx(kind) });
}
const kindSx = { fontSize: 7.5, color: "text.disabled", letterSpacing: ".06em", textTransform: "uppercase", ml: .5, border: 1, borderColor: "divider", px: "3px", borderRadius: "2px" };

// One kernel readout = one spec node with value: { read: "me/<path>" } (resolved + subscribed by GUI's renderer).
function ValView(p) {
  const { path, value: v, f = fmt, suffix = "", wrap } = p;
  const el = h(Box, { component: "span", ...nodeAttrs(p), "data-me-path": path, "data-me-value": String(v) }, f(v) + suffix);
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
function Row(p) {
  const { k, kind, children, minCh = 0 } = p;
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let max = 0;
    const fit = () => { const n = Math.max(minCh, reserveChars(el.textContent)); if (n > max) { max = n; el.style.minWidth = n + "ch"; } };
    fit();
    const mo = new MutationObserver(fit); mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [minCh]);
  return h(Box, { ...nodeAttrs(p), sx: { display: "flex", justifyContent: "space-between", gap: 1, py: "3px", borderBottom: 1, borderColor: "divider", fontFamily: MONO, fontSize: 10.5, "&:last-of-type": { borderBottom: 0 } } },
    h(Box, { component: "span", sx: { color: "text.secondary", minWidth: 0 } }, k, h(Box, { component: "span", sx: kindSx }, kind)),
    h(Box, { component: "span", ref, sx: { color: "primary.main", textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 } }, children));
}
const Formula = (p) => h(Box, { ...nodeAttrs(p), sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mt: .75, p: "5px 7px", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", lineHeight: 1.45, "& b": { color: "primary.main", fontWeight: 500, display: "inline-block", minWidth: "7ch", textAlign: "right", whiteSpace: "nowrap" } } }, p.children);
const SUB_SX = { fontFamily: MONO, fontSize: 9, color: "text.secondary", mt: .75, lineHeight: 1.4 };

function Panel(p) {
  const { id, title, tags = [], adapter = false, children } = p;
  const { step } = useStore(ui);
  const hl = !!TOUR[step]?.hlPanels.includes(id);
  return h(Box, nodeAttrs(p),
    h(Typography, { component: "h2", sx: { fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "text.secondary", mb: .75, display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap" } },
      title, ...tags.map(([kind, label]) => h(SrcTag, { key: label, kind, label }))),
    h(Paper, { id, variant: "outlined", "data-hl": hl ? "1" : "0", sx: (t) => ({ p: "8px 10px", borderRadius: "4px", borderStyle: adapter ? "dashed" : "solid", borderColor: hl ? t.palette.primary.main : adapter ? accentColor(t, "ember") : t.palette.divider, background: hl ? t.visuals.accents.aurora.soft : t.visuals.accents.neutral.soft, transition: "border-color .2s, background .2s" }) }, children));
}

// ── chrome ──
const LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
const INSPECTOR_ACTION = h(Box, { component: "span", sx: { display: "inline-flex", "@media (max-width:1100px)": { display: "none" } } },
  h(G.InspectorToggle, { id: "inspector-toggle", "data-gui-inspector-control": true, show: "both", label: "Inspector", onText: "on", offText: "off", size: "small", variant: "button",
    title: "Semantic Inspector (.GUI devtools): turn on, click a map node, then Explain. Clicks inspect instead of acting while it is on.",
    sx: { minWidth: 0, py: .25, px: 1, lineHeight: 1.4, fontFamily: MONO, fontSize: 11, textTransform: "none", color: "text.secondary", borderColor: "divider" } }));

// Kernel link (top bar + footer): text, target and title come from the running kernel's in-browser check.
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
function GuiBuildInfo() {
  const { gui } = useStore(ui);
  const a = (href, text, title) => h(Link, { href, target: "_blank", rel: "noopener", underline: "hover", title }, text);
  const check = gui?.state === "ok" ? h("b", { key: "v" }, "verified") : gui?.state === "error" ? h(Box, { component: "span", sx: { color: "error.main" } }, "check failed") : "checking…";
  return h(React.Fragment, null,
    "UI: ", a(GUI_PIN.pr, `this.gui@${GUI_PIN.short}`, `${GUI_PIN.label}: unreleased branch build (PR #3)`), " (branch ", h("code", { key: "b" }, GUI_PIN.branch), ", not on npm yet). Build served from this site: ",
    a(GUI_PIN.url, `this.gui-${GUI_PIN.short}.umd.js`, `sha256 ${GUI_PIN.sha256}`), " · sha256 ", GUI_PIN.sha256.slice(0, 12), "… ", check, ".",
    h("br"), "Docs: ", ...GUI_DOCS.flatMap(([t, u], i) => [i ? " · " : "", a(u, t)]));
}
const GLOSSARY = [
  ["What is this?", ["Port of Veracruz on the real .me kernel: ships, train, 500 trucks (400 heavy + 100 last-mile, 1,000 example trips) and stocks are facts; totals, averages and flags are kernel formulas. OSM is just the map."]],
  ["fact", ["A value you write: ", h("code", { key: 1 }, "me.cargo.coffee(100000)"), ". It never computes itself."]],
  ["rule / derived", ["A kernel ", h("code", { key: 1 }, "="), " formula: ", h("code", { key: 2 }, "importRemaining = ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons"), "."]],
  ["mutation", ["Each animation tick the traffic adapter flushes its batch: one real kernel write per changed fact. Each write recomputes only its dependents."]],
  ["k", ["How many derived paths the kernel recomputed for a write (its affected set), read from the kernel, not counted by the UI."]],
  ["explain", [h("code", { key: 1 }, "me.explain(path)"), ": expression, inputs with values, and the write (sourcePath) that last recomputed it."]],
  [".GUI binding", [h(GuiBuildInfo, { key: 1 })]],
];
function GlossaryItem(p) {
  const [label, body] = GLOSSARY[p.idx];
  const [open, setOpen] = React.useState(false);
  return h(Box, { ...nodeAttrs(p), sx: { borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
    h(Button, { size: "small", fullWidth: true, onClick: () => setOpen(!open), "aria-expanded": open,
      sx: { justifyContent: "flex-start", px: 1.25, py: .55, borderRadius: 0, fontFamily: MONO, fontSize: 10, letterSpacing: ".04em", textTransform: "none", color: open ? "primary.main" : "text.secondary", minHeight: 0 } },
      (open ? "▾ " : "▸ ") + label),
    h(Collapse, { in: open },
      h(Typography, { component: "p", sx: { px: 1.25, pb: .75, mt: 0, fontFamily: MONO, fontSize: 10, lineHeight: 1.4, color: "text.secondary", "& code": { fontSize: 9.5, color: "primary.main" }, "& a": { color: "primary.main" }, "& b": { color: "text.primary", fontWeight: 500 } } }, ...body)));
}

function KernelLine() {
  const { kernel } = useStore(ui);
  const ok = kernel.state === "ok", err = kernel.state === "error";
  if (ok) return null;
  return h(Typography, { id: "kernel-status", component: "div", sx: { fontFamily: MONO, fontSize: 9.5, color: err ? "error.main" : "text.secondary", px: 1.5, py: .75, borderBottom: 1, borderColor: "divider", lineHeight: 1.4, "& b": { color: err ? "error.main" : "success.main", fontWeight: 500 } }, dangerouslySetInnerHTML: { __html: kernel.text } });
}

function KernelStrip(p) {
  const { glossaryOpen } = useStore(ui);
  return h(Box, { id: "kernel-wrap", ...nodeAttrs(p), "data-open": glossaryOpen ? "1" : "0", sx: { flexShrink: 0, borderBottom: 1, borderColor: "divider" } },
    h(Box, { sx: { display: "flex", alignItems: "center", gap: .75, px: 1.5, py: .75, borderBottom: glossaryOpen ? 1 : 0, borderColor: "divider", fontFamily: MONO, fontSize: 10, color: "text.secondary", minHeight: 36 } },
      h(Box, { component: "span", sx: { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, whiteSpace: "nowrap" } },
        "kernel: ", h(KernelLink, { id: "kver-aside", minCh: 28 })),
      h(Button, { id: "kernel-toggle", size: "small", onClick: () => ui.set({ glossaryOpen: !glossaryOpen }), "aria-expanded": glossaryOpen, "aria-controls": "kernel-panel", title: "Show / hide kernel glossary",
        sx: { ml: "auto", flexShrink: 0, minWidth: 0, px: .75, py: .25, fontFamily: MONO, fontSize: 10, textTransform: "none", color: "text.disabled" } },
        glossaryOpen ? "▾ hide" : "▸ kernel")),
    h(Collapse, { in: glossaryOpen, id: "kernel-panel" },
      h(KernelLine),
      h(Box, { id: "glossary", sx: { bgcolor: "background.default" } },
        GLOSSARY.map(([label], idx) => h(GlossaryItem, { key: label, idx, "data-gui-node-id": `glossary/${label}` })))));
}
function TourStrip(p) {
  const { step, tourOpen } = useStore(ui);
  const t = TOUR[step];
  return h(Box, { id: "tour-wrap", ...nodeAttrs(p), "data-open": tourOpen ? "1" : "0", sx: { flexShrink: 0, borderBottom: 1, borderColor: "divider" } },
    h(Button, { id: "tour-toggle", fullWidth: true, onClick: () => setTourOpen(!tourOpen), "aria-expanded": tourOpen, "aria-controls": "tour-panel", title: "Show / hide the guided tour",
      sx: { justifyContent: "flex-start", gap: .75, px: 1.5, py: .9, borderRadius: 0, fontFamily: MONO, fontSize: 10, textTransform: "none", color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", borderBottom: tourOpen ? 1 : 0, borderColor: "divider" } },
      h(Box, { component: "span", id: "tt-step", sx: { color: "primary.main", fontSize: 12.5, fontWeight: 500, letterSpacing: ".02em", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 } }, t.title),
      h(Box, { component: "span", id: "tt-caret", sx: { ml: "auto", color: "text.disabled", flexShrink: 0 } }, tourOpen ? "▾ hide" : "▸ tour")),
    h(Collapse, { in: tourOpen, id: "tour-panel" },
      h(KernelLine),
      h(Box, { sx: { px: 1.5, pt: 1.25, pb: 1 } },
        h(Box, { id: "tour-steps", sx: { display: "flex", gap: "3px", flexWrap: "wrap", mb: 1 } },
          ...Array.from({ length: STEPS }, (_, i) => i + 1).map((i) => h(Button, { key: i, size: "small", title: TOUR[i].title, variant: i === step ? "outlined" : "text", color: i < step ? "success" : "primary", onClick: () => setStep(i), sx: { minWidth: 24, width: 24, height: 24, p: 0, fontFamily: MONO, fontSize: 10, color: i === step ? "primary.main" : i < step ? "success.main" : "text.secondary" } }, String(i)))),
        h(Typography, { id: "tour-title", sx: { fontFamily: MONO, fontSize: 10.5, color: "primary.main", letterSpacing: ".07em", textTransform: "uppercase", mb: .6 } }, t.title),
        h(Typography, { id: "tour-body", component: "div", sx: { fontSize: 12, lineHeight: 1.4, minHeight: "3.2em", "& strong": { fontWeight: 600, color: "text.primary" } }, dangerouslySetInnerHTML: { __html: t.body } }),
        h(Box, { sx: { display: "flex", gap: .75, mt: 1.25, alignItems: "center" } },
          h(Button, { id: "btn-prev", size: "small", variant: "text", disabled: step <= 1, onClick: () => setStep(step - 1), sx: { fontFamily: MONO, fontSize: 11 } }, "Back"),
          h(Button, { id: "btn-next", size: "small", variant: "outlined", onClick: () => setStep(step >= STEPS ? 1 : step + 1), sx: { fontFamily: MONO, fontSize: 11 } }, step >= STEPS ? "Restart" : "Next"),
          h(Typography, { id: "step-label", sx: { ml: "auto", fontFamily: MONO, fontSize: 10, color: "text.disabled" } }, `${step} / ${STEPS}`)))));
}

// ── panel leaves (page state, not kernel paths) ──
function RunControls(p) {
  const { running: on, finished, speed, me } = useStore(ui);
  const label = finished ? ["All work done ✓", "Reset to replay"] : on ? ["Pause ■", "500 trucks · real me.… writes"] : ["Start traffic ▸", "500 trucks · real me.… writes"];
  return h(Box, { ...nodeAttrs(p), sx: { display: "flex", gap: .75, flexWrap: "wrap", alignItems: "stretch" } },
    h(Button, { id: "btn-run", variant: "outlined", disabled: !me, onClick: () => setRunning(!running), sx: { flex: 1, fontFamily: MONO, fontSize: 10.5, textTransform: "none", textAlign: "left", lineHeight: 1.35, display: "block", py: 1, minHeight: "calc(4.05em + 18px)" } },
      label[0], h("br"), h(Box, { component: "span", sx: { color: "text.secondary", fontSize: 9 } }, label[1])),
    h(TextField, { id: "sel-speed", select: true, size: "small", value: String(speed), onChange: (e) => ui.set({ speed: Number(e.target.value) || 10 }), inputProps: { "aria-label": "Playback speed (1 s real = N s simulated)" }, title: "Playback: 1 s real = N s simulated",
      sx: { minWidth: 96, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10.5, height: "100%" } } },
      h(MenuItem, { value: "1", sx: { fontFamily: MONO, fontSize: 11 } }, "×1 real time"), h(MenuItem, { value: "10", sx: { fontFamily: MONO, fontSize: 11 } }, "×10"), h(MenuItem, { value: "60", sx: { fontFamily: MONO, fontSize: 11 } }, "×60")),
    h(Button, { id: "btn-reset", variant: "text", disabled: !me, onClick: resetKernel, sx: { fontFamily: MONO, fontSize: 10.5, color: "text.secondary" } }, "Reset"));
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
// The writes list has a fixed height and never auto-scrolls. While the pointer is over it or it was just
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
    return h(Box, { component: "li", key: i, sx: { py: .5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
      h(Box, { component: "code", sx: { color: "text.primary" } }, w.code), h(Box, { component: "span", sx: { color: "warning.main", ml: .75 } }, `k=${w.k}`), h(Box, { component: "span", sx: { color: "text.disabled", ml: .75 } }, note),
      h(Box, { component: "span", sx: { display: "block", color: "text.disabled", mt: .25, wordBreak: "break-all" } }, "recomputed: ",
        w.recomputed.length ? w.recomputed.flatMap((p, j) => [j ? ", " : "", w.changed.includes(p) ? h(Box, { component: "span", key: p, sx: { color: "primary.main" } }, p) : p]) : "no dependents"));
  }) : [h(Box, { component: "li", key: "e", sx: { color: "text.disabled" } }, "No writes yet: press Start.")];
  return h(React.Fragment, null,
    h(Typography, { component: "div", sx: { ...SUB_SX, color: "text.disabled", height: 24, lineHeight: "12px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" } },
      h("span", { id: "flush-meta", title: meta }, held ? h(Box, { component: "span", sx: { color: "warning.main" } }, `held while you read · latest #${lastFlush.idx}`) : null, held ? " · " : null, meta)),
    h(Box, { component: "ul", id: "writes", ref: ulRef, ...nodeAttrs(p),
      onPointerEnter: (e) => { if (e.pointerType === "mouse") wHold.hover = true; },
      onPointerLeave: () => { wHold.hover = false; holdWrites(600); },
      onTouchStart: () => holdWrites(4000), onWheel: () => holdWrites(2500),
      onScroll: (e) => { if (e.currentTarget.scrollTop !== wHold.topAfterRender) holdWrites(2500); },
      sx: { listStyle: "none", m: 0, p: 0, fontFamily: MONO, fontSize: 9.5, mt: .75, height: 240, overflowY: "auto", overflowAnchor: "none", contain: "strict", scrollbarGutter: "stable", borderTop: 1, borderColor: "divider" } }, ...items));
}

const EXPLAIN_PATHS = ["flows.importRemaining", "flows.exportRemaining", "flows.importProgress", "trips.bandHigh", "trips.perUnitAvg", "trips.balanced", "lastMile.unitsOk", "trucks.working", "trucks.balanced", "trucks.inQueue", "queues.import.busy", "port.busy", "cargo.bulkTons"];
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
function LgRow(p) {
  const { dot, label, children } = p;
  return h(Box, { ...nodeAttrs(p), sx: { display: "flex", alignItems: "center", gap: .75 } },
    h(Box, { component: "i", sx: { width: 7, height: 7, borderRadius: "50%", display: "inline-block", flexShrink: 0, ...dot } }), label,
    h(Box, { component: "b", sx: { ml: "auto", color: "text.primary", fontWeight: 500 } }, children));
}
function OffMap(p) { useStore(sim); return h("span", { id: "lg-off", ...nodeAttrs(p) }, String(offMap)); }
const LGH_SX = { fontSize: 8.5, letterSpacing: ".1em", textTransform: "uppercase", color: "text.disabled", mb: .25 };
function SimClock(p) { useStore(sim); const { speed } = useStore(ui); return h("strong", { id: "hud-tick", ...nodeAttrs(p) }, `${T ? clock(T.simTime) : clock(0)} · ×${speed}`); }
function HudChip(p) {   // strong: wrap the children in <strong> (with strongSx: a styled one); otherwise children as given
  const { label, children, adapter, strong, strongSx } = p;
  const value = !strong ? children : strongSx ? h(Box, { component: "strong", sx: strongSx }, children) : h("strong", null, children);
  return h(Chip, { ...nodeAttrs(p), size: "small", variant: "outlined", label: h(React.Fragment, null, label, " ", value),
    sx: (t) => ({ fontFamily: MONO, fontSize: 10, bgcolor: "rgba(11,13,16,0.88)", borderRadius: "3px", color: "text.secondary", borderStyle: adapter ? "dashed" : "solid", borderColor: adapter ? accentColor(t, "ember") : t.palette.divider, "& strong": { color: "text.primary", fontWeight: 500 } }) });
}
const SvgGroup = (p) => { const { children, "data-gui-component": _c, ...rest } = p; return h("g", rest, children); };

// ── page-local registry types (rendered by GUI's renderer like any registry entry; no new GUI types) ──
const pageType = (type, C) => ({ type, resolve: (spec) => { const { key: _k, ...p } = spec.props || {}; return h(C, p); } });
const PAGE_TYPES = Object.fromEntries([
  ["PortValue", ValView], ["PortSum", SumView], ["PortBar", BarView], ["PortRow", Row], ["PortFormula", Formula], ["PortPanel", Panel],
  ["PortLegendRow", LgRow], ["PortHudChip", HudChip], ["PortSvgGroup", SvgGroup],
  ["PortTour", TourStrip], ["PortKernelStrip", KernelStrip], ["PortKernelLink", KernelLink], ["PortRunControls", RunControls], ["PortStats", Stats], ["PortWrites", Writes],
  ["PortExplain", ExplainLeaf], ["PortLmStrip", LmStrip], ["PortLmEstimate", LmEstimate], ["PortLmFeed", LmFeed], ["PortSeed", SeedCode],
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
const TAG = (id, kind, label) => N("Chip", id, { size: "small", variant: "outlined", label, sx: srcTagSx(kind) });
const PANEL = (id, title, tags, children, adapter) => N("PortPanel", id, { id, title, tags, ...(adapter ? { adapter } : {}) }, children);
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
const mutatePanel = (s = "panel-mutate") => PANEL(s, "Mutate · live traffic", [["kernel", "kernel writes"]], [N("PortRunControls", `${s}/run`), N("PortStats", `${s}/stats`), N("PortWrites", `${s}/writes`)]);
const explainPanel = (s = "panel-explain") => PANEL(s, "Explain · why", [["kernel", "me.explain()"]], [N("PortExplain", `${s}/explain`)]);

function legend(s = "legend") {
  const LR = (label, dot, children) => N("PortLegendRow", `${s}/${label}`, { label, dot }, children);
  return N("Paper", s, { id: "legend", variant: "outlined", sx: { position: "absolute", top: 10, right: 12, pointerEvents: "none", fontFamily: MONO, fontSize: 9.5, bgcolor: "rgba(11,13,16,0.86)", borderRadius: "3px", p: "5px 7px", color: "text.secondary", lineHeight: 1.5, width: 200 } }, [
    N("Box", `${s}/heavy`, { sx: LGH_SX }, "heavy · 400"),
    LR("import, laden", { bgcolor: "#7eb8c9" }, V(s, "trucks.import.enRoute")),
    LR("export, laden", { bgcolor: "#c9b87e" }, V(s, "trucks.export.enRoute")),
    LR("load / unload", { bgcolor: "#7ec99a" }, SUM(s, ["trucks.import.loading", "trucks.export.loading"])),
    LR("queued", { bgcolor: "#b39ddb" }, V(s, "trucks.inQueue")),
    LR("returning", { bgcolor: "#5f6b78" }, SUM(s, ["trucks.import.returning", "trucks.export.returning"])),
    LR("pool", { bgcolor: "#3a424e", border: "1px solid #6a7380" }, V(s, "trucks.heavy.available")),
    N("Box", `${s}/last-mile`, { sx: { ...LGH_SX, mt: .4 } }, "last-mile · 100"),
    LR("out · back", { bgcolor: "#e58fc0", width: 5, height: 5 }, J(V(s, "trucks.lastMile.enRoute"), V(s, "trucks.lastMile.returning"))),
    LR("load · idle", { bgcolor: "#6a4a5e", width: 5, height: 5 }, J(V(s, "trucks.lastMile.loading"), V(s, "trucks.lastMile.available"))),
    LR("band ↑ · ↓", { border: "1px solid #e0a050", boxShadow: "4px 0 0 -2px #5ec8e0" }, J(V(s, "lastMile.unitsAbove"), V(s, "lastMile.unitsBelow"))),
    LR("trips ○ · ✓ · ✗", { bgcolor: "#f4e6b8", borderRadius: 0, width: 4, height: 4 }, J(V(s, "trips.pending"), V(s, "trips.done"), V(s, "trips.unscheduled"))),
    N("Box", `${s}/foot`, { sx: { borderTop: 1, borderColor: "divider", mt: .5, pt: .4, fontSize: 9, color: "text.disabled" } }, ["kernel counts · ", N("PortOffMap", `${s}/off-map`), " off-map (adapter)"]),
  ]);
}
// HUD sits 24 px up so the map's OSM attribution strip (bottom-right, 17 px) never sits under a chip
function hud(s = "hud") {
  const CHIP = (label, props, children) => N("PortHudChip", `${s}/${label}`, { label, ...props }, children);
  return N("Box", s, { sx: { position: "absolute", left: 12, bottom: 24, right: 12, display: "flex", flexWrap: "wrap", gap: 1, pointerEvents: "none" } }, [
    CHIP("import left", { strong: true, strongSx: { color: "#7eb8c9 !important" } }, V(s, "flows.importRemaining", { suffix: " t" })),
    CHIP("export left", { strong: true, strongSx: { color: "#c9b87e !important" } }, V(s, "flows.exportRemaining", { suffix: " t" })),
    CHIP("trucks.working", { strong: true }, [V(s, "trucks.working"), " / ", V(s, "trucks.fleet")]),
    CHIP("trucks.balanced", { strong: true }, V(s, "trucks.balanced", { f: S })),
    CHIP("sim (adapter)", { adapter: true }, N("PortSimClock", `${s}/sim-clock`)),
    CHIP("Average Speed · Heavy Load:", { adapter: true }, [h("strong", { key: "a" }, "25 km/h"), " · Last-Mile: ", h("strong", { key: "b" }, "22 km/h")]),
  ]);
}

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

// node meta lines: GUI subscriptions to kernel paths (re-read when the bridge announces those paths)
function ShipMeta({ s }) { const work = G.useMeValue(`ships.${s.i}.hasWork`), rem = G.useMeValue(`ships.${s.i}.remaining`); return `${work ? "unloading" : "done"} · ${fmt(rem)} ${s.unit}`; }
function TrainMeta() { const work = G.useMeValue("train.1.hasWork"), rem = G.useMeValue("train.1.remainingToLoad"); return `${work ? "loading" : "done"} · ${fmt(rem)} t`; }
function QueueMeta({ q }) { const n = G.useMeValue(`queues.${q}.length`), busy = G.useMeValue(`queues.${q}.busy`); return `${n} queued${busy ? "" : " · idle"}`; }
function YardMeta() { useStore(sim); const heavy = G.useMeValue("trucks.heavy.available"); return `pool: ${fmt(heavy)} heavy · ${T ? T.units.filter((u) => u.home === 0 && u.st === "lmPool").length : 0} small (adapter)`; }
function PortMeta() { const busy = G.useMeValue("port.busy"); return busy ? "port.busy = true" : "port.busy = false"; }
// node positions are the page's existing map pixels, converted to lat/lon with the map's own projection.
// `path` = the derived kernel path each marker carries as provenance.semanticPath (Explain in the inspector).
const NODES = [
  { id: "n-port", kind: "port", path: "port.busy", x: 600.0, y: 255.4, shape: "circle", size: 28, gap: 7, icon: "anchor", color: "#7eb8c9", label: "VERACRUZ", Meta: PortMeta },
  ...SHIPS_META.map((s, i) => ({ id: `n-ship${s.i}`, kind: "ship", path: `ships.${s.i}.hasWork`, x: [801.6, 888.0, 945.6][i], y: [168.6, 284.3, 382.6][i], shape: "rect", w: 32, hh: 18, gap: 5, icon: "directions_boat", color: "#6a9bb0", label: `SHIP[${s.i}] ${["coffee", "sugar", "TEU"][i]}`, Meta: ShipMeta, mp: { s } })),
  { id: "n-train", kind: "train", path: "train.1.hasWork", x: 340.8, y: 342.2, shape: "rect", w: 36, hh: 16, gap: 5, place: "left", icon: "train", color: "#b0a06a", label: "TRAIN[1]", Meta: TrainMeta },
  { id: "n-qimp", kind: "queue", path: "queues.import.busy", x: 686.4, y: 313.2, shape: "circle", size: 24, gap: 4, icon: "local_shipping", color: "#7a7a90", label: "Q.IMPORT", Meta: QueueMeta, mp: { q: "import" } },
  { id: "n-qexp", kind: "queue", path: "queues.export.busy", x: 484.8, y: 284.3, shape: "circle", size: 24, gap: 4, place: "left", icon: "local_shipping", color: "#7a7a90", label: "Q.EXPORT", Meta: QueueMeta, mp: { q: "export" } },
  { id: "n-yard", kind: "yard", path: "cargo.bulkTons", x: 513.6, y: 457.8, shape: "square", size: 28, gap: 7, icon: "warehouse", color: "#7a9a7a", label: "CARGO YARD · CEDIS A", Meta: YardMeta },
  { id: "n-cedisb", kind: "yard", path: "trips.pending", x: 220.7, y: 529.8, shape: "square", size: 18, gap: 5, icon: "inventory_2", color: "#7a9a7a", label: "CEDIS B", meta: "example site" },
].map((n) => ({ ...n, ...OSM_PROJ.unproject(n.x, n.y) }));
const markerSpec = (n, live) => N("OpenStreetMapMarker", `map.${n.id}`, { id: n.id, className: `node ${n.kind}`, lat: n.lat, lon: n.lon, shape: n.shape, size: n.size, width: n.w, height: n.hh,
  color: n.color, icon: n.icon, iconColor: n.color, label: n.label, labelPlacement: n.place || "right", labelOffset: n.gap,
  meta: n.Meta ? (live ? h(n.Meta, n.mp || {}) : "—") : n.meta }, undefined, { semanticPath: n.path });
let mapMounted = false;
function MapLifecycle() {   // no element: marks the map as mounted for the adapter's DOM highlights
  React.useEffect(() => { mapMounted = true; lastHlStep = 0; applyMapHighlights(); renderMapLabels(); return () => { mapMounted = false; }; }, []);
  return null;
}
function mapSpec(live) {
  return N("OpenStreetMap", "map", { ...FRAME, basemap: BASEMAP, source: OSM_SOURCE, ariaLabel: "Veracruz port operations", attribution: { position: "bottom-right" } }, [
    N("PortSvgGroup", "map.edges", { id: "edges" }, EDGES.map(([id, cls, d]) => h("path", { key: id, id, className: cls, d }))),
    N("PortSvgGroup", "map.exit-labels", { id: "exit-labels" }, EXIT_LABELS.map((l) => h("text", { key: l.key, className: "exit-label", x: l.x, y: l.y, textAnchor: l.anchor }, l.text))),
    h("circle", { key: "spotlight", className: "spotlight", id: "spotlight", cx: 0, cy: 0, r: 30, visibility: "hidden" }),
    N("PortSvgGroup", "map.nodes", { id: "nodes" }, NODES.map((n) => markerSpec(n, live))),
    { type: MapLifecycle },
    N(OSM.Canvas, "map.traffic", { id: "traffic", className: "traffic", onFrame: onMapFrame }),
  ]);
}

function topBarSpec() {
  return N("TopBar", "GUI.bars.top", {
    title: ".me", logo: LOGO, homeTo: "https://neurons-me.github.io/", position: "static",
    sx: { "& img": { height: 34, width: 34, objectFit: "contain" } },
    elementsRight: [
      // Opt-in .GUI Semantic Inspector (off by default; hidden at ≤1100 px, where its 440 px side panel has no room).
      { type: "action", props: { element: INSPECTOR_ACTION } },
      { type: "link", props: { label: "Smart Cities", href: "https://neurons-me.github.io/smart-cities/", "data-gui-node-id": "GUI.bars.top.link.smart-cities" } },
      { type: "link", props: { label: "Docs", href: "https://neurons-me.github.io/.me/docs/", "data-gui-node-id": "GUI.bars.top.link.docs" } },
      { type: "link", props: { label: "GitHub", href: "https://github.com/neurons-me/.me", "data-gui-node-id": "GUI.bars.top.link.github" } },
    ],
  });
}
function titleStripSpec(s = "title") {
  return N("Box", s, { sx: { display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", px: 2, py: 1, borderBottom: 1, borderColor: "divider" } }, [
    N("Typography", `${s}/name`, { component: "h1", sx: { fontWeight: 600, fontSize: 14, letterSpacing: ".04em" } }, "VERACRUZ"),
    N("Typography", `${s}/address`, { sx: { fontFamily: MONO, fontSize: 12, color: "primary.main" } }, "me://port"),
    TAG(`${s}/tag`, "adapter", "port operations · 500 trucks · guided"),
  ]);
}
function asideSpec(live) {
  return N("Box", "aside", { component: "aside", sx: { bgcolor: "background.paper", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, borderLeft: 1, borderColor: "divider" } }, [
    N("PortKernelStrip", "aside/kernel"),
    N("PortTour", "aside/tour"),
    N("Box", "aside/panels", { sx: { flex: 1, overflowY: "auto", p: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 1.25 } },
      live ? [mutatePanel(), explainPanel(), shipsPanel(), trainPanel(), trucksPanel(), lastMilePanel(), stocksPanel(), adapterPanel(live)] : [N("PortKernelWait", "aside/waiting")]),
  ]);
}
const mapPanelSpec = (live) => N("Box", "map-panel", { className: "map-wrap", sx: { position: "relative", overflow: "hidden", bgcolor: "#0b0d10", minHeight: 300 } },
  live ? [mapSpec(true), legend(), hud()] : [mapSpec(false)]);
const footerSpec = (s = "footer") => N("Box", s, { component: "footer", sx: { px: 2, py: .9, borderTop: 1, borderColor: "divider", fontFamily: MONO, fontSize: 10, color: "text.disabled", display: "flex", justifyContent: "space-between", gap: 1.25, flexWrap: "wrap", "& a": { color: "text.secondary" } } }, [
  N("Box", `${s}/osm`, { component: "span" }, ["© ", LINK(`${s}/osm:link`, { href: "https://www.openstreetmap.org/copyright", target: "_blank", rel: "noopener", underline: "hover" }, "OpenStreetMap"), " contributors · static SVG basemap · no live tiles"]),
  N("Box", `${s}/builds`, { component: "span" }, [
    N("PortKernelLink", `${s}/builds:kernel`, { id: "kver-foot", after: " (unmodified)", minCh: 44 }), " · ",
    LINK(`${s}/builds:gui`, { href: GUI_PIN.pr, target: "_blank", rel: "noopener", underline: "hover" }, `${GUI_PIN.label}`),
    " (unreleased branch build, self-hosted, SRI + sha256) · ", LINK(`${s}/builds:notes`, { href: "veracruz-port/", underline: "hover" }, "build notes"),
  ]),
]);
function pageSpec(live) {
  return N("Box", "page", { sx: { display: "flex", flexDirection: "column", height: "100vh", minHeight: 640, bgcolor: "background.default", color: "text.primary", "@media (max-width:1000px)": { height: "auto" } } }, [
    topBarSpec(), titleStripSpec(),
    N("Box", "layout", { className: "layout", sx: { flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", minHeight: 0, "@media (max-width:1000px)": { gridTemplateColumns: "1fr", gridTemplateRows: "minmax(300px, 42vh) auto" } } },
      [mapPanelSpec(live), asideSpec(live)]),
    footerSpec(),
  ]);
}
// Built once: the same spec objects are handed to every mount() call (before / after the kernel loads).
const SPEC_BOOT = pageSpec(false), SPEC_LIVE = pageSpec(true);

// The page theme is handed to GUI.mount (which wraps the tree, inspector included, in gui.Theme).
const PageTheme = ({ children }) => h(G.Theme, { initialThemeId: "neurons.me", initialMode: "dark" }, children);

// ══════════════════════════ adapter: map layer, loop, kernel lifecycle ══════════════════════════
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
let lastHlStep = 0;
function applyMapHighlights() {
  const step = ui.state.step; if (!mapMounted || step === lastHlStep) return; lastHlStep = step;
  const t = TOUR[step];
  $$("#nodes .node").forEach((n) => { n.classList.remove("hl", "dimmed"); n.classList.add(t.hlNodes.includes(n.id) ? "hl" : "dimmed"); });
  $$("#edges .edge").forEach((e) => { e.classList.remove("hl", "dimmed"); e.classList.add(t.hlEdges.includes(e.id) ? "hl" : "dimmed"); });
}
ui.subscribe(applyMapHighlights);

// node state classes (adapter-side highlight of the GUI markers; the meta text lines are GUI bindings)
function renderMapLabels() {
  if (!P || !mapMounted) return;
  const R = P.read;
  for (const s of SHIPS_META) { const work = R(`ships.${s.i}.hasWork`); $(`#n-ship${s.i}`)?.classList.toggle("done", !work); $(`#n-ship${s.i}`)?.classList.toggle("busy", !!work); }
  const tw = R("train.1.hasWork");
  $("#n-train")?.classList.toggle("done", !tw); $("#n-train")?.classList.toggle("busy", !!tw);
}
function lightHits() {
  if (!mapMounted) return;
  const lit = new Set([...hitPaths].map(nodeOfPath).filter(Boolean));
  hitPaths.clear();
  $$("#nodes .node").forEach((n) => n.classList.toggle("hit", lit.has(n.id)));
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
function uiTick() { announceKernelPaths(); sim.set(); renderMapLabels(); lightHits(); }
function uiRefreshAll() { announceAll(); sim.set(); renderMapLabels(); }

const COLORS = { enRouteImp: "#7eb8c9", enRouteExp: "#c9b87e", loading: "#7ec99a", queued: "#b39ddb", returning: "#5f6b78", idle: "#4a535e",
  lmEnRoute: "#e58fc0", lmReturning: "#9a6585", lmLoading: "#e58fc0", lmIdle: "#6a4a5e" };
const DRAW_ORDER = ["idle", "returning", "queued", "enRouteExp", "enRouteImp", "loading", "lmIdle", "lmReturning", "lmLoading", "lmEnRoute"];
const MOVING = new Set(["impToQueue", "impToBerth", "impOut", "expOut", "expIn", "expToTrain", "toDepotImp", "toDepotExp", "lmOut", "lmBack"]);
const jit = (id, k) => ((Math.sin(id * 12.9898 + k * 78.233) * 43758.5453) % 1) * 1.6;   // lane offset per truck
const POOL = { x: 470, y: 478, cols: 20, gap: 3.2 };
const LM_POOL = [{ x: 540, y: 478 }, { x: CEDIS[1].pt[0] - 14, y: CEDIS[1].pt[1] + 14 }];
const BERTH_OFF = (slot) => [-12 + (slot % 8) * 4.2, -2 + Math.floor(slot / 8) * 4.2];
const buckets = Object.fromEntries(DRAW_ORDER.map((k) => [k, []]));
const ADDR = { planned: "#4a3a45", unassigned: "#4a3a45", active: "#b0789a", done: "#f4e6b8", unscheduled: "#8a3a3a" };
const ADDR_ORDER = ["planned", "unassigned", "unscheduled", "active", "done"];
const addrB = Object.fromEntries(ADDR_ORDER.map((k) => [k, []]));
const ringAbove = [], ringBelow = [];

function drawTrucks(ctx) {   // ctx: from GUI.OpenStreetMap.Canvas (map pixels, cleared, clipped to the frame)
  if (!T) return;
  // 1,000 address points: dim until delivered
  for (const k of ADDR_ORDER) addrB[k].length = 0;
  for (const tp of T.trips) addrB[tp.st].push(tp.x, tp.y);
  for (const k of ADDR_ORDER) {
    const b = addrB[k]; if (!b.length) continue;
    const r = k === "done" ? 1.4 : 1.1;
    ctx.fillStyle = ADDR[k]; ctx.globalAlpha = k === "done" ? 0.9 : 0.8;
    for (let i = 0; i < b.length; i += 2) ctx.fillRect(b[i] - r, b[i + 1] - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  for (const k of DRAW_ORDER) buckets[k].length = 0;
  ringAbove.length = 0; ringBelow.length = 0;
  moving = 0; offMap = 0;
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
    buckets[vis].push(x, y);
    if (tr.cat === "lastMile" && tr.band !== "within") (tr.band === "above" ? ringAbove : ringBelow).push(x, y);
  }
  const lay = (q, node) => q.forEach((tr, i) => buckets.queued.push(node[0] - 14 + (i % 10) * 3.6, node[1] + 17 + Math.floor(i / 10) * 3.6));
  lay(T.queues.impQ, KEY.qimp); lay(T.queues.expQ, KEY.qexp);
  if (moving > maxMoving) maxMoving = moving;
  for (const k of DRAW_ORDER) {
    const b = buckets[k]; if (!b.length) continue;
    const r = k === "idle" ? 1.2 : k.startsWith("lm") ? (k === "lmIdle" ? 1.1 : 1.9) : 2.2;
    ctx.fillStyle = COLORS[k];
    ctx.globalAlpha = k === "returning" || k === "lmReturning" ? 0.85 : 1;
    ctx.beginPath();
    for (let i = 0; i < b.length; i += 2) { ctx.moveTo(b[i] + r, b[i + 1]); ctx.arc(b[i], b[i + 1], r, 0, 6.2832); }
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.lineWidth = 0.9;
  for (const [b, col] of [[ringAbove, "#e0a050"], [ringBelow, "#5ec8e0"]]) {
    if (!b.length) continue;
    ctx.strokeStyle = col; ctx.beginPath();
    for (let i = 0; i < b.length; i += 2) { ctx.moveTo(b[i] + 3, b[i + 1]); ctx.arc(b[i], b[i + 1], 3, 0, 6.2832); }
    ctx.stroke();
  }
}


// ── main loop: adapter steps → one flush per animation tick → kernel writes (driven by the map canvas layer) ──
let lastNow = 0;
function onMapFrame({ ctx, now }) {
  const dtReal = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
  lastNow = now;
  frameLog.push(now); if (frameLog.length > 240) frameLog = frameLog.filter((t) => now - t <= 1000);
  if (running && T) {
    let s = dtReal * speedOf();
    while (s > 1e-9) { const d = Math.min(0.5, s); T.step(d); s -= d; }
    const writes = T.flush();                 // ← real kernel writes happen here
    if (writes.length) onFlush(writes, now);
    if (T.done()) setRunning(false, true);
  }
  drawTrucks(ctx);
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
  ];
}
function verifyNow() {
  const writes = T.flush();
  if (writes.length) onFlush(writes, performance.now());
  return P.verifyFromScratch(adapterChecks());
}
function verify() {
  const v = verifyNow();
  ui.set({ verify: v.ok
    ? { tone: "ok", text: `✓ ${v.checked} checks pass: every derived path matches a fresh kernel rebuild (none undefined); Σ counters = ${FLEET} (${HEAVY} heavy + ${LAST_MILE} last-mile); trips done + pending + unscheduled = ${TRIP_COUNT}; above + within + below = ${LAST_MILE}; bandHigh/bandLow = avg × 1.15 / × 0.85; adapter states = kernel counters (sim ${clock(T.simTime)}, ${fmt(writeCount)} writes).` }
    : { tone: "bad", text: `✗ mismatches: ${JSON.stringify(v.mismatches)}` } });
  uiTick();
  return v;
}

// ── boot ──
const params = new URLSearchParams(location.search);
{
  let stored = null;
  try { stored = localStorage.getItem(TOUR_KEY); } catch (e) { /* storage unavailable */ }
  ui.set({ step: Math.min(STEPS, Math.max(1, parseInt(params.get("step") || "1", 10) || 1)) });
  setTourOpen(params.has("step") || stored === "1", params.has("step"));
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
      let flushes = 0, writes = 0, checks = 0, failures = [], kMax = 0, kSum = 0;
      while (!T.done() && T.simTime < 200000) {
        for (let i = 0; i < stepsPerFlush; i++) T.step(dt);
        const w = T.flush();
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
