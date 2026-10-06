// Port of Veracruz: .GUI interface (this.gui@4.0.0, UMD, pinned and SRI-checked in the HTML)
// over the real, unmodified this.me@4.1.0 kernel (sha256-checked here before import).
//
// Who owns what:
//   KERNEL (this.me): every fact, every derived value, k, recomputed sets, explain().
//   .GUI (this.gui):  topbar, panels, collapsibles, stepper, buttons, selects, progress bars and readouts.
//                     Every kernel readout is a GUI.useMeValue(path) subscription. A component re-reads
//                     me(path) whenever that path is written or recomputed.
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
const GUI_PIN = { version: "4.0.0", file: "dist/this.gui.umd.js", sha256: "42491c246d8cfbd3ed27ab606c040ce02c48196d1ee91ffbbcba2784bc478fa7" };

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
const ui = createStore({ step: 1, tourOpen: false, running: false, finished: false, speed: 10, me: null, kernel: { state: "loading", text: `Loading this.me@${KERNEL.version}…` }, verify: { tone: "", text: VERIFY_HINT }, seed: "—" });
const sim = createStore({});   // bumped by the adapter at ~4 Hz: sim clock, page stats, feeds

// ── kernel → .GUI subscribe bridge (adapter schedule, kernel values) ──
// GUI.MeRuntimeProvider takes `subscribe(path, cb)`. this.me@4.1.0 has no per-instance change events,
// and on its proxy `me.subscribe(...)` would WRITE a fact named "subscribe". So this bridge is passed
// explicitly. The adapter announces exactly the paths the kernel reported for each write
// (the written fact + explain().meta.recomputed), batched to the UI tick. Components then re-read me(path).
const kListeners = new Map();
function kernelSubscribe(path, cb) {
  let s = kListeners.get(path); if (!s) kListeners.set(path, (s = new Set()));
  s.add(cb);
  return () => { s.delete(cb); if (!s.size) kListeners.delete(path); };
}
let pendingPaths = new Set(), announced = 0;
function announceKernelPaths() {
  if (!pendingPaths.size) return;
  const paths = pendingPaths; pendingPaths = new Set();
  for (const p of paths) { const s = kListeners.get(p); if (s) { announced++; [...s].forEach((cb) => cb()); } }
}
function announceAll() { pendingPaths.clear(); for (const s of [...kListeners.values()]) [...s].forEach((cb) => cb()); }

let ME = null, P = null, T = null;
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
  { title: "1 · Port overview", body: "You are at the <strong>Port of Veracruz</strong>. Three ships unload (import), one train loads (export), and <strong>500 trucks</strong> (400 heavy, 100 last-mile) circulate on real OpenStreetMap roads; every dot is one truck. Every number on the right is a <strong>.GUI</strong> component subscribed to a path of a real <strong>this.me@4.1.0</strong> kernel.",
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

// ══════════════════════════ .GUI components ══════════════════════════
const accentColor = (t, accent) => t.palette[t.visuals?.accents?.[accent]?.chip]?.main || t.palette.text.secondary;

function SrcTag({ kind, label }) {   // kernel → aurora accent; adapter → ember accent
  const accent = kind === "adapter" ? "ember" : "aurora";
  return h(Chip, { size: "small", variant: "outlined", label, sx: (t) => ({ height: 16, fontSize: 8, fontFamily: MONO, letterSpacing: ".08em", textTransform: "uppercase", borderRadius: "3px", color: accentColor(t, accent), borderColor: accentColor(t, accent), borderStyle: kind === "adapter" ? "dashed" : "solid", "& .MuiChip-label": { px: "5px" } }) });
}
const kindSx = { fontSize: 7.5, color: "text.disabled", letterSpacing: ".06em", textTransform: "uppercase", ml: .5, border: 1, borderColor: "divider", px: "3px", borderRadius: "2px" };

// One kernel readout = one GUI subscription to one .me path.
function Val({ path, f = fmt, suffix = "" }) {
  const v = G.useMeValue(path);
  return h(Box, { component: "span", "data-me-path": path, "data-me-value": String(v) }, f(v) + suffix);
}
function Sum({ paths }) {   // display-side sum of two kernel reads (legend only)
  const vals = paths.map((p) => G.useMeValue(p));
  return h(Box, { component: "span" }, fmt(vals.reduce((a, b) => a + b, 0)));
}
const J = (...parts) => parts.flatMap((p, i) => (i ? [" · ", p] : [p]));
const V = (path, opts = {}) => h(Val, { key: path, path, ...opts });
const S = String;

// A value keeps the widest width it has shown (numbers pre-padded to 3 digits), so its key never re-wraps
// as digits change: rows keep a constant height while values stream in.
const reserveChars = (text) => [...text.replace(/\d[\d,.]*/g, (d) => d.padStart(3, "0")).replace(/\btrue\b/g, "false")].length;
function Row({ k, kind, children, minCh = 0 }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let max = 0;
    const fit = () => { const n = Math.max(minCh, reserveChars(el.textContent)); if (n > max) { max = n; el.style.minWidth = n + "ch"; } };
    fit();
    const mo = new MutationObserver(fit); mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [minCh]);
  return h(Box, { sx: { display: "flex", justifyContent: "space-between", gap: 1, py: "3px", borderBottom: 1, borderColor: "divider", fontFamily: MONO, fontSize: 10.5, "&:last-of-type": { borderBottom: 0 } } },
    h(Box, { component: "span", sx: { color: "text.secondary", minWidth: 0 } }, k, h(Box, { component: "span", sx: kindSx }, kind)),
    h(Box, { component: "span", ref, sx: { color: "primary.main", textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 } }, children));
}
function BoundBar({ path, color = "primary" }) {
  const v = G.useMeValue(path);
  return h(Progress, { variant: "determinate", color, value: Math.max(0, Math.min(100, (Number(v) || 0) * 100)), "data-me-path": path, sx: { height: 4, borderRadius: 2, mt: .5 } });
}
const Formula = ({ children }) => h(Box, { sx: { fontFamily: MONO, fontSize: 9.5, color: "text.secondary", mt: .75, p: "5px 7px", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", lineHeight: 1.45, "& b": { color: "primary.main", fontWeight: 500, display: "inline-block", minWidth: "7ch", textAlign: "right", whiteSpace: "nowrap" } } }, children);
const Sub = ({ children, sx }) => h(Typography, { component: "div", sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", mt: .75, lineHeight: 1.4, ...sx } }, children);

function Panel({ id, title, tags = [], adapter = false, children }) {
  const { step } = useStore(ui);
  const hl = !!TOUR[step]?.hlPanels.includes(id);
  return h(Box, null,
    h(Typography, { component: "h2", sx: { fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "text.secondary", mb: .75, display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap" } },
      title, ...tags.map(([kind, label]) => h(SrcTag, { key: label, kind, label }))),
    h(Paper, { id, variant: "outlined", "data-hl": hl ? "1" : "0", sx: (t) => ({ p: "8px 10px", borderRadius: "4px", borderStyle: adapter ? "dashed" : "solid", borderColor: hl ? t.palette.primary.main : adapter ? accentColor(t, "ember") : t.palette.divider, background: hl ? t.visuals.accents.aurora.soft : t.visuals.accents.neutral.soft, transition: "border-color .2s, background .2s" }) }, children));
}

// ── chrome ──
const LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
const TOPBAR = G.registry.TopBar.resolve({ type: "TopBar", props: {
  title: ".me", logo: LOGO, homeTo: "https://neurons-me.github.io/", position: "static",
  sx: { "& img": { height: 34, width: 34, objectFit: "contain" } },
  elementsRight: [
    { type: "link", props: { label: "Smart Cities", href: "https://neurons-me.github.io/smart-cities/" } },
    { type: "link", props: { label: "Docs", href: "https://neurons-me.github.io/.me/docs/" } },
    { type: "link", props: { label: "GitHub", href: "https://github.com/neurons-me/.me" } },
  ],
} }, {});

// Kernel link (top bar + footer): text, target and title come from the running kernel's in-browser check.
const NPM_KERNEL = "https://www.npmjs.com/package/this.me";
function KernelLink({ before = "", after = "", id, minCh }) {
  const { kernel: k } = useStore(ui);
  const ok = k.state === "ok", label = ok ? `${before}this.me@${k.version} · sha256 ${k.hash.slice(0, 8)}${after}`
    : `${before}this.me · ${k.state === "loading" ? "verifying…" : k.mismatch ? "sha256 mismatch" : "not loaded"}`;
  return h(Link, { id, className: "kver " + (ok ? "ok" : k.state === "loading" ? "verifying" : k.mismatch ? "mismatch" : "failed"),
    href: ok ? `${NPM_KERNEL}/v/${encodeURIComponent(k.version)}` : NPM_KERNEL, target: "_blank", rel: "noopener", underline: "hover",
    title: ok ? `sha256 ${k.hash} (verified in this browser)\nloaded: ${k.url}` : k.detail || "Checking the kernel file's sha256 in this browser…",
    sx: { display: "inline-block", minWidth: `${minCh}ch`, whiteSpace: "nowrap", color: ok ? "primary.main" : k.state === "loading" ? "text.secondary" : "error.main" } }, label);
}
function TitleStrip() {
  return h(Box, { sx: { display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", px: 2, py: 1, borderBottom: 1, borderColor: "divider" } },
    h(Typography, { component: "h1", sx: { fontWeight: 600, fontSize: 14, letterSpacing: ".04em" } }, "VERACRUZ"),
    h(Typography, { sx: { fontFamily: MONO, fontSize: 12, color: "primary.main" } }, "me://port"),
    h(SrcTag, { kind: "adapter", label: "port operations · 500 trucks · guided" }),
    h(Typography, { sx: { ml: "auto", fontFamily: MONO, fontSize: 11, color: "text.secondary" } },
      `UI: this.gui@${GUI_PIN.version} · kernel: `, h(KernelLink, { id: "kver-top", minCh: 31 }), " · ",
      h(Link, { href: "veracruz-port.html", underline: "hover" }, "classic page")));
}

const GLOSSARY = [
  ["What is this?", ["Port of Veracruz on the real .me kernel: ships, train, 500 trucks (400 heavy + 100 last-mile, 1,000 example trips) and stocks are facts; totals, averages and flags are kernel formulas. The interface is .GUI; OSM is just the map."]],
  ["fact", ["A value you write: ", h("code", { key: 1 }, "me.cargo.coffee(100000)"), ". It never computes itself."]],
  ["rule / derived", ["A kernel ", h("code", { key: 1 }, "="), " formula: ", h("code", { key: 2 }, "importRemaining = ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons"), "."]],
  ["mutation", ["Each animation tick the traffic adapter flushes its batch: one real kernel write per changed fact. Each write recomputes only its dependents."]],
  ["k", ["How many derived paths the kernel recomputed for a write (its affected set), read from the kernel, not counted by the UI."]],
  ["explain", [h("code", { key: 1 }, "me.explain(path)"), ": expression, inputs with values, and the write (sourcePath) that last recomputed it."]],
  [".GUI binding", ["Each readout is ", h("code", { key: 1 }, "GUI.useMeValue(path)"), " under ", h("code", { key: 2 }, "GUI.MeRuntimeProvider"), ". After each flush the adapter announces the paths the kernel reported (written + recomputed); only those components re-read the kernel."]],
];
function GlossaryItem({ label, body }) {
  const [open, setOpen] = React.useState(false);
  return h(Box, { sx: { flex: "1 1 140px", minWidth: 120, borderRight: 1, borderColor: "divider", px: 1.25, py: .5, "&:last-of-type": { borderRight: 0 } } },
    h(Button, { size: "small", onClick: () => setOpen(!open), "aria-expanded": open, sx: { p: 0, minWidth: 0, fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", color: open ? "primary.main" : "text.secondary", justifyContent: "flex-start" } }, (open ? "▾ " : "▸ ") + label),
    h(Collapse, { in: open },
      h(Typography, { component: "p", sx: { mt: .4, fontFamily: MONO, fontSize: 10, lineHeight: 1.35, "& code": { fontSize: 9.5, color: "primary.main" } } }, ...body)));
}
const Glossary = () => h(Box, { id: "glossary", sx: { display: "flex", flexWrap: "wrap", borderBottom: 1, borderColor: "divider", bgcolor: "background.default" } },
  ...GLOSSARY.map(([label, body]) => h(GlossaryItem, { key: label, label, body })));

function KernelLine({ compact }) {
  const { kernel } = useStore(ui);
  const ok = kernel.state === "ok", err = kernel.state === "error";
  if (compact) return h(Box, { component: "span", id: "tt-kernel", sx: { color: ok ? "success.main" : err ? "error.main" : "text.secondary" } }, ok ? `✓ this.me@${kernel.version} verified` : err ? "✗ kernel failed" : "kernel loading…");
  return h(Typography, { id: "kernel-status", component: "div", sx: { fontFamily: MONO, fontSize: 9.5, color: err ? "error.main" : "text.secondary", px: 1.5, py: .75, borderBottom: 1, borderColor: "divider", lineHeight: 1.4, "& b": { color: err ? "error.main" : "success.main", fontWeight: 500 } }, dangerouslySetInnerHTML: { __html: kernel.text } });
}
function TourStrip() {
  const { step, tourOpen } = useStore(ui);
  const t = TOUR[step];
  return h(Box, { id: "tour-wrap", "data-open": tourOpen ? "1" : "0", sx: { flexShrink: 0, borderBottom: 1, borderColor: "divider" } },
    h(Button, { id: "tour-toggle", fullWidth: true, onClick: () => setTourOpen(!tourOpen), "aria-expanded": tourOpen, "aria-controls": "tour-panel", title: "Show / hide kernel status and the guided tour",
      sx: { justifyContent: "flex-start", gap: .75, px: 1.5, py: .9, borderRadius: 0, fontFamily: MONO, fontSize: 10, textTransform: "none", color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", borderBottom: tourOpen ? 1 : 0, borderColor: "divider" } },
      h(KernelLine, { compact: true }), h(Box, { component: "span", sx: { color: "text.disabled" } }, "·"),
      h(Box, { component: "span", id: "tt-step", sx: { color: "primary.main", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 } }, t.title),
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

// ── panels ──
function RunControls() {
  const { running: on, finished, speed, me } = useStore(ui);
  const label = finished ? ["All work done ✓", "Reset to replay"] : on ? ["Pause ■", "500 trucks · real me.… writes"] : ["Start traffic ▸", "500 trucks · real me.… writes"];
  return h(Box, { sx: { display: "flex", gap: .75, flexWrap: "wrap", alignItems: "stretch" } },
    h(Button, { id: "btn-run", variant: "outlined", disabled: !me, onClick: () => setRunning(!running), sx: { flex: 1, fontFamily: MONO, fontSize: 10.5, textTransform: "none", textAlign: "left", lineHeight: 1.35, display: "block", py: 1, minHeight: "calc(4.05em + 18px)" } },
      label[0], h("br"), h(Box, { component: "span", sx: { color: "text.secondary", fontSize: 9 } }, label[1])),
    h(TextField, { id: "sel-speed", select: true, size: "small", value: String(speed), onChange: (e) => ui.set({ speed: Number(e.target.value) || 10 }), inputProps: { "aria-label": "Playback speed (1 s real = N s simulated)" }, title: "Playback: 1 s real = N s simulated",
      sx: { minWidth: 96, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10.5, height: "100%" } } },
      h(MenuItem, { value: "1", sx: { fontFamily: MONO, fontSize: 11 } }, "×1 real time"), h(MenuItem, { value: "10", sx: { fontFamily: MONO, fontSize: 11 } }, "×10"), h(MenuItem, { value: "60", sx: { fontFamily: MONO, fontSize: 11 } }, "×60")),
    h(Button, { id: "btn-reset", variant: "text", disabled: !me, onClick: resetKernel, sx: { fontFamily: MONO, fontSize: 10.5, color: "text.secondary" } }, "Reset"));
}
function Stat({ id, label, value, adapter }) {
  return h(Box, { sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", border: 1, borderColor: "divider", borderRadius: "3px", p: "4px 5px", bgcolor: "background.default", borderStyle: adapter ? "dashed" : "solid" } },
    label, h(Box, { id, component: "b", sx: (t) => ({ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, fontWeight: 500, color: adapter ? accentColor(t, "ember") : t.palette.primary.main }) }, value));
}
function Stats() {
  useStore(sim);
  const now = performance.now(), win = flushLog.filter((f) => now - f.t <= 1000);
  return h(Box, { sx: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: .5, mt: .75 } },
    h(Stat, { id: "st-wps", label: "writes/s", value: fmt(win.reduce((a, f) => a + f.n, 0)) }),
    h(Stat, { id: "st-fps-flush", label: "flushes/s", value: fmt(win.length) }),
    h(Stat, { id: "st-k", label: "recent k", value: win.length && lastFlush ? `${lastFlush.writes[lastFlush.writes.length - 1].k}·max ${Math.max(...win.map((f) => f.kMax))}` : "—" }),
    h(Stat, { id: "st-writes", label: "total writes", value: fmt(writeCount) }),
    h(Stat, { id: "st-fps", label: "fps (page)", value: fmt(frameLog.filter((t) => now - t <= 1000).length), adapter: true }),
    h(Stat, { id: "st-moving", label: "moving dots", value: fmt(moving), adapter: true }));
}
// The writes list has a fixed height and never auto-scrolls. While the pointer is over it or it was just
// scrolled, its content is held (the shown flush stays put) so it can be read; the header says so.
const wHold = { hover: false, until: 0, topAfterRender: 0, shown: null };
const holdWrites = (ms) => { wHold.until = Math.max(wHold.until, performance.now() + ms); };
const flushMetaText = (f) => `flush #${f.idx} · sim ${clock(f.sim)} · ${f.writes.length} real writes (one per changed fact) · k ${f.writes.map((w) => w.k).join("·")}`;
function Writes() {
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
    h(Sub, { sx: { color: "text.disabled", height: 24, lineHeight: "12px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" } },
      h("span", { id: "flush-meta", title: meta }, held ? h(Box, { component: "span", sx: { color: "warning.main" } }, `held while you read · latest #${lastFlush.idx}`) : null, held ? " · " : null, meta)),
    h(Box, { component: "ul", id: "writes", ref: ulRef,
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
function ExplainView({ path }) {
  useWave(path);
  const { me } = G.useMe();
  const [raw, setRaw] = React.useState(false);
  let ex, err = null;
  try { ex = me.explain(path); } catch (e) { err = e?.message || String(e); }
  if (err) return h(Typography, { sx: { fontFamily: MONO, fontSize: 9.5, color: "error.main" } }, "explain failed: " + err);
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
    h(Box, { id: "explain-grid", sx: { fontFamily: MONO, fontSize: 9.5, lineHeight: 1.5 } }, ...rows.map(([l, v]) =>
      h(Box, { key: l, sx: { display: "grid", gridTemplateColumns: "78px 1fr", gap: .5, py: .25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } } },
        h(Box, { component: "span", sx: { color: "text.disabled" } }, l), h(Box, { component: "span", sx: l === "value" ? ONE_LINE : l === "last wave" ? { wordBreak: "break-word", height: 57, overflowY: "auto", overflowAnchor: "none" } : { wordBreak: "break-word" } }, v)))),
    h(Formula, null, h("span", { id: "explain-code" }, `me.explain(${JSON.stringify(path)})`)),
    h(Button, { size: "small", onClick: () => setRaw(!raw), sx: { mt: .5, p: 0, minWidth: 0, fontFamily: MONO, fontSize: 9.5, textTransform: "none", color: "text.secondary" } }, (raw ? "▾ " : "▸ ") + "raw explain() JSON"),
    h(Collapse, { in: raw, unmountOnExit: true }, h(Box, { component: "pre", id: "explain-raw", sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 220, overflow: "auto", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", p: .75, mt: .5 } }, JSON.stringify(ex, null, 2))));
}
function ExplainPanel() {
  const [path, setPath] = React.useState(EXPLAIN_PATHS[0]);
  return h(Panel, { id: "panel-explain", title: "Explain · why", tags: [["kernel", "me.explain()"]] },
    h(TextField, { id: "ex-select", select: true, size: "small", fullWidth: true, value: path, onChange: (e) => setPath(e.target.value), inputProps: { "aria-label": "Path to explain" }, sx: { mb: .75, "& .MuiInputBase-root": { fontFamily: MONO, fontSize: 10 } } },
      ...EXPLAIN_PATHS.map((p) => h(MenuItem, { key: p, value: p, sx: { fontFamily: MONO, fontSize: 11 } }, p))),
    h(ExplainView, { path }));
}

const SHIPS_META = [{ i: 1, unit: "t" }, { i: 2, unit: "t" }, { i: 3, unit: "TEU" }];
const ShipsPanel = () => h(Panel, { id: "panel-ships", title: "Ships · unloading (import)", tags: [["kernel", "kernel"]] },
  ...SHIPS_META.flatMap((s) => [
    h(Row, { key: `r${s.i}`, k: `ships[${s.i}].remaining`, kind: "fact" }, V(`ships.${s.i}.remaining`, { suffix: " " + s.unit })),
    h(Row, { key: `p${s.i}`, k: `ships[${s.i}].progress`, kind: "rule" }, V(`ships.${s.i}.progress`, { f: pct })),
  ]),
  h(Formula, null, "flows.importRemaining = ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons = ", h("b", null, V("flows.importRemaining")), " t"),
  h(BoundBar, { path: "flows.importProgress" }));
const TrainPanel = () => h(Panel, { id: "panel-train", title: "Train · loading (export)", tags: [["kernel", "kernel"]] },
  h(Row, { k: "train[1].remainingToLoad", kind: "fact" }, V("train.1.remainingToLoad", { suffix: " t" })),
  h(Row, { k: "train[1].progress", kind: "rule" }, V("train.1.progress", { f: pct })),
  h(Row, { k: "train[1].hasWork", kind: "rule" }, V("train.1.hasWork", { f: S })),
  h(Formula, null, "flows.exportRemaining = train[1].remainingToLoad = ", h("b", null, V("flows.exportRemaining")), " t"),
  h(BoundBar, { path: "train.1.progress", color: "warning" }));
const TrucksPanel = () => h(Panel, { id: "panel-queues", title: "Trucks · by state", tags: [["kernel", "kernel"]] },
  h(Row, { k: "trucks.heavy.available", kind: "fact" }, V("trucks.heavy.available")),
  h(Row, { k: "queues.import.length", kind: "fact" }, V("queues.import.length")),
  h(Row, { k: "trucks.import.loading · enRoute · returning", kind: "facts" }, J(V("trucks.import.loading"), V("trucks.import.enRoute"), V("trucks.import.returning"))),
  h(Row, { k: "queues.export.length", kind: "fact" }, V("queues.export.length")),
  h(Row, { k: "trucks.export.loading · enRoute · returning", kind: "facts" }, J(V("trucks.export.loading"), V("trucks.export.enRoute"), V("trucks.export.returning"))),
  h(Row, { k: "trucks.lastMile.available", kind: "fact" }, V("trucks.lastMile.available")),
  h(Row, { k: "trucks.lastMile.loading · enRoute · returning", kind: "facts" }, J(V("trucks.lastMile.loading"), V("trucks.lastMile.enRoute"), V("trucks.lastMile.returning"))),
  h(Row, { k: "trucks.heavy.working · balanced", kind: "rules" }, J(V("trucks.heavy.working"), V("trucks.heavy.balanced", { f: S }))),
  h(Row, { k: "trucks.lastMile.working · balanced", kind: "rules" }, J(V("trucks.lastMile.working"), V("trucks.lastMile.balanced", { f: S }))),
  h(Row, { k: "trucks.inQueue · loading · enRoute · returning", kind: "rules" }, J(V("trucks.inQueue"), V("trucks.loading"), V("trucks.enRoute"), V("trucks.returning"))),
  h(Row, { k: "trucks.available · working", kind: "rules" }, J(V("trucks.available"), V("trucks.working"))),
  h(Row, { k: "trucks.accounted", kind: "rule" }, V("trucks.accounted")),
  h(Row, { k: "trucks.balanced", kind: "rule" }, V("trucks.balanced", { f: S })),
  h(Row, { k: "trucks.splitOk", kind: "rule" }, V("trucks.splitOk", { f: S })),
  h(Row, { k: "port.busy", kind: "rule" }, V("port.busy", { f: S })),
  h(Formula, null, "trucks.working = trucks.inQueue + trucks.loading + trucks.enRoute + trucks.returning · trucks.balanced = trucks.accounted == trucks.fleet"));

function LmStrip() {   // per-unit strip (adapter view); band lines read from the kernel
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
  return h(Box, { component: "canvas", ref, id: "lm-strip", height: 46, sx: { width: "100%", height: 46, display: "block", mt: .4, bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px" } });
}
function LmEstimate() {
  useStore(sim);
  if (!T || !P) return h("b", { id: "lm-est" }, "—");
  const end = T.lmEstimate(), left = Math.max(0, end - T.simTime);
  return h(Box, { component: "b", id: "lm-est", sx: { color: "text.primary", fontWeight: 500 } }, P.read("trips.pending") === 0 ? `all last-mile trips settled · ${fmt(P.read("trips.done"))} done` : `≈ ${clock(end)} sim · ≈ ${realDur(left / speedOf())} real at ×${speedOf()}`);
}
function LmFeed() {
  useStore(sim);
  const items = T && T.feed.length ? T.feed.slice(0, 6).map((f, i) => h(Box, { component: "li", key: i, sx: { py: "1px" } }, `${clock(f.t)} · trip #${pad4(f.trip)} · ${lmName(f.from)} → ${lmName(f.to)}`)) : [h(Box, { component: "li", key: "e", sx: { color: "text.disabled" } }, "no redirects yet")];
  return h(Box, { component: "ul", id: "lm-feed", sx: { listStyle: "none", m: 0, p: 0, fontFamily: MONO, fontSize: 9, color: "text.secondary", mt: .25, height: 84, overflow: "hidden", contain: "strict" } }, ...items);
}
const LastMilePanel = () => h(Panel, { id: "panel-lastmile", title: "Last-mile · 1,000 scheduled trips", tags: [["kernel", "kernel"], ["adapter", "dispatch = adapter"]] },
  h(Box, { sx: { display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: "text.secondary" } }, h("span", null, "trips.done"),
    h(Box, { component: "b", id: "lm-done", sx: { color: "#f4e6b8", fontSize: 14, fontWeight: 500 } }, V("trips.done"), " / ", V("trips.total"))),
  h(BoundBar, { path: "trips.doneShare", color: "secondary" }),
  h(Box, { sx: { mt: .75 } },
    h(Row, { k: "trips.pending · active", kind: "rule · fact" }, J(V("trips.pending"), V("trips.active"))),
    h(Row, { k: "trips.unscheduled (can't fit today)", kind: "fact" }, V("trips.unscheduled")),
    h(Row, { k: "trips.perUnitAvg (assigned)", kind: "rule" }, V("trips.perUnitAvg")),
    h(Row, { k: "trips.perUnitDoneAvg", kind: "rule" }, V("trips.perUnitDoneAvg")),
    h(Row, { k: "trips.unitMax · unitMin", kind: "adapter aggregate" }, J(V("trips.unitMax"), V("trips.unitMin"))),
    h(Row, { k: "trips.bandLow – bandHigh (±15%)", kind: "rules", minCh: 13 }, V("trips.bandLow"), " – ", V("trips.bandHigh")),
    h(Row, { k: "lastMile.unitsAbove · Within · Below", kind: "adapter → facts" }, J(V("lastMile.unitsAbove"), V("lastMile.unitsWithin"), V("lastMile.unitsBelow"))),
    h(Row, { k: "lastMile.unitsOk · trips.balanced", kind: "rules" }, J(V("lastMile.unitsOk", { f: S }), V("trips.balanced", { f: S }))),
    h(Row, { k: "trips.redirects", kind: "fact" }, V("trips.redirects")),
    h(Row, { k: "localDelivery.remainingKg", kind: "fact" }, V("localDelivery.remainingKg", { suffix: " kg" }))),
  h(Sub, null, "per unit (adapter view): bright = done, dim = assigned · dashed = kernel bandLow/bandHigh"),
  h(LmStrip),
  h(Sub, { sx: { display: "flex", alignItems: "center", gap: .75, flexWrap: "wrap", height: "25.2px", overflow: "hidden" } }, "est. completion", h(SrcTag, { kind: "adapter", label: "adapter estimate" }), h(LmEstimate)),
  h(Sub, { sx: { display: "flex", alignItems: "center", gap: .75 } }, "redirects", h(SrcTag, { kind: "adapter", label: "adapter log" })),
  h(LmFeed),
  h(Formula, null, "trips.bandHigh = trips.perUnitAvg + trips.perUnitAvg * trips.band · trips.perUnitAvg = trips.assigned / trucks.lastMile.fleet · lastMile.unitDoneSum = units[1].done + … + units[100].done (explicit) · trips.balanced = trips.accounted == trips.total"),
  h(Sub, null, "Assumed averages (not sourced): 22 km/h, load at CEDIS ~10 min, drop 5–8 min, shift 08:00–17:00, band ±15%. Plan: each unit greedily takes the trip it can finish earliest until its shift is full; then trips move from units above the band to units below (nearest to the receiver's next stop, only if its shift and windows still fit)."));

function SeedCode() {
  const { seed } = useStore(ui);
  const [open, setOpen] = React.useState(false);
  return h(React.Fragment, null,
    h(Button, { size: "small", onClick: () => setOpen(!open), sx: { mt: .5, p: 0, minWidth: 0, fontFamily: MONO, fontSize: 9.5, textTransform: "none", color: "text.secondary" } }, (open ? "▾ " : "▸ ") + "seed: exact calls run at load / reset"),
    h(Collapse, { in: open }, h(Box, { component: "pre", id: "seed-code", sx: { fontFamily: MONO, fontSize: 9, color: "text.secondary", maxHeight: 160, overflow: "auto", whiteSpace: "pre", mt: .75, bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: "3px", p: "6px 7px" } }, seed)));
}
const StocksPanel = () => h(Panel, { id: "panel-stocks", title: "Stocks · me.cargo", tags: [["kernel", "kernel"]] },
  h(Row, { k: "cargo.coffee", kind: "fact" }, V("cargo.coffee", { suffix: " t" })),
  h(Row, { k: "cargo.sugar", kind: "fact" }, V("cargo.sugar", { suffix: " t" })),
  h(Row, { k: "cargo.containers", kind: "fact" }, V("cargo.containers")),
  h(Row, { k: "cargo.bulkTons", kind: "rule" }, V("cargo.bulkTons", { suffix: " t" })),
  h(Row, { k: "trucks.fleet", kind: "fact" }, V("trucks.fleet")),
  h(Row, { k: "trucks.heavy.fleet · trucks.lastMile.fleet", kind: "facts" }, J(V("trucks.heavy.fleet"), V("trucks.lastMile.fleet"))),
  h(SeedCode));

function VerifyOut() {
  const { verify: v } = useStore(ui);
  return h(Typography, { id: "verify-out", "data-tone": v.tone, sx: { fontFamily: MONO, fontSize: 9.5, mt: .75, color: v.tone === "ok" ? "success.main" : v.tone === "bad" ? "error.main" : "text.secondary" } }, v.text);
}
function VerifyButton() {
  const { me } = useStore(ui);
  return h(Button, { id: "btn-verify", variant: "outlined", size: "small", disabled: !me, onClick: verify, sx: { mt: 1, fontFamily: MONO, fontSize: 10.5, textTransform: "none", color: "text.secondary", borderColor: "divider" } }, "Verify: rebuild kernel from facts");
}
const AdapterPanel = () => h(Panel, { id: "panel-adapter", title: "Adapter · plain JS", tags: [["adapter", "not kernel"]], adapter: true },
  h(Typography, { sx: { fontSize: 11, lineHeight: 1.45, color: "text.secondary", "& code": { fontFamily: MONO, fontSize: 10 } } },
    "The traffic model (", h("code", null, "port-traffic.js"), ") decides ", h("em", null, "what to write"), "; the kernel holds every value and decides ", h("em", null, "what recomputes"),
    ". Adapter only: each truck's route over OSM roads, berth/train/bay slots, timers, which flow it joins, the last-mile greedy plan, band classification and redirects, dot positions, the pending deltas it flushes, and the schedule that tells the .GUI components which kernel paths changed (the paths themselves come from the kernel's own wave). Totals, averages, band limits, flags, k and explain() are kernel. Speeds and durations are assumptions (named constants in ",
    h("code", null, "port-traffic.js"), ")."),
  h(VerifyButton), h(VerifyOut));
const MutatePanel = () => h(Panel, { id: "panel-mutate", title: "Mutate · live traffic", tags: [["kernel", "kernel writes"]] }, h(RunControls), h(Stats), h(Writes));

function Aside() {
  const { me, kernel } = useStore(ui);
  return h(Box, { component: "aside", sx: { bgcolor: "background.paper", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, borderLeft: 1, borderColor: "divider" } },
    h(TourStrip),
    h(Box, { sx: { flex: 1, overflowY: "auto", p: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 1.25 } },
      me ? h(G.MeRuntimeProvider, { me, subscribe: kernelSubscribe },
        h(MutatePanel), h(ExplainPanel), h(ShipsPanel), h(TrainPanel), h(TrucksPanel), h(LastMilePanel), h(StocksPanel), h(AdapterPanel))
        : h(Typography, { sx: { fontFamily: MONO, fontSize: 11, color: "text.secondary" } }, kernel.state === "error" ? "Nothing on this page runs without the kernel." : "Waiting for the kernel…")));
}

// ── map overlays (GUI, kernel-bound) ──
function LgRow({ dot, label, children }) {
  return h(Box, { sx: { display: "flex", alignItems: "center", gap: .75 } },
    h(Box, { component: "i", sx: { width: 7, height: 7, borderRadius: "50%", display: "inline-block", flexShrink: 0, ...dot } }), label,
    h(Box, { component: "b", sx: { ml: "auto", color: "text.primary", fontWeight: 500 } }, children));
}
function OffMap() { useStore(sim); return h("span", { id: "lg-off" }, String(offMap)); }
const LgH = ({ children, sx }) => h(Box, { sx: { fontSize: 8.5, letterSpacing: ".1em", textTransform: "uppercase", color: "text.disabled", mb: .25, ...sx } }, children);
const Legend = () => h(Paper, { id: "legend", variant: "outlined", sx: { position: "absolute", top: 10, right: 12, pointerEvents: "none", fontFamily: MONO, fontSize: 9.5, bgcolor: "rgba(11,13,16,0.86)", borderRadius: "3px", p: "5px 7px", color: "text.secondary", lineHeight: 1.5, width: 200 } },
  h(LgH, null, "heavy · 400"),
  h(LgRow, { dot: { bgcolor: "#7eb8c9" }, label: "import, laden" }, V("trucks.import.enRoute")),
  h(LgRow, { dot: { bgcolor: "#c9b87e" }, label: "export, laden" }, V("trucks.export.enRoute")),
  h(LgRow, { dot: { bgcolor: "#7ec99a" }, label: "load / unload" }, h(Sum, { paths: ["trucks.import.loading", "trucks.export.loading"] })),
  h(LgRow, { dot: { bgcolor: "#b39ddb" }, label: "queued" }, V("trucks.inQueue")),
  h(LgRow, { dot: { bgcolor: "#5f6b78" }, label: "returning" }, h(Sum, { paths: ["trucks.import.returning", "trucks.export.returning"] })),
  h(LgRow, { dot: { bgcolor: "#3a424e", border: "1px solid #6a7380" }, label: "pool" }, V("trucks.heavy.available")),
  h(LgH, { sx: { mt: .4 } }, "last-mile · 100"),
  h(LgRow, { dot: { bgcolor: "#e58fc0", width: 5, height: 5 }, label: "out · back" }, J(V("trucks.lastMile.enRoute"), V("trucks.lastMile.returning"))),
  h(LgRow, { dot: { bgcolor: "#6a4a5e", width: 5, height: 5 }, label: "load · idle" }, J(V("trucks.lastMile.loading"), V("trucks.lastMile.available"))),
  h(LgRow, { dot: { border: "1px solid #e0a050", boxShadow: "4px 0 0 -2px #5ec8e0" }, label: "band ↑ · ↓" }, J(V("lastMile.unitsAbove"), V("lastMile.unitsBelow"))),
  h(LgRow, { dot: { bgcolor: "#f4e6b8", borderRadius: 0, width: 4, height: 4 }, label: "trips ○ · ✓ · ✗" }, J(V("trips.pending"), V("trips.done"), V("trips.unscheduled"))),
  h(Box, { sx: { borderTop: 1, borderColor: "divider", mt: .5, pt: .4, fontSize: 9, color: "text.disabled" } }, "kernel counts · ", h(OffMap), " off-map (adapter)"));
function SimClock() { useStore(sim); const { speed } = useStore(ui); return h("strong", { id: "hud-tick" }, `${T ? clock(T.simTime) : clock(0)} · ×${speed}`); }
const HudChip = ({ label, children, adapter }) => h(Chip, { size: "small", variant: "outlined", label: h(React.Fragment, null, label, " ", children),
  sx: (t) => ({ fontFamily: MONO, fontSize: 10, bgcolor: "rgba(11,13,16,0.88)", borderRadius: "3px", color: "text.secondary", borderStyle: adapter ? "dashed" : "solid", borderColor: adapter ? accentColor(t, "ember") : t.palette.divider, "& strong": { color: "text.primary", fontWeight: 500 } }) });
const Hud = () => h(Box, { sx: { position: "absolute", left: 12, bottom: 12, right: 12, display: "flex", flexWrap: "wrap", gap: 1, pointerEvents: "none" } },
  h(HudChip, { label: "import left" }, h(Box, { component: "strong", sx: { color: "#7eb8c9 !important" } }, V("flows.importRemaining", { suffix: " t" }))),
  h(HudChip, { label: "export left" }, h(Box, { component: "strong", sx: { color: "#c9b87e !important" } }, V("flows.exportRemaining", { suffix: " t" }))),
  h(HudChip, { label: "trucks.working" }, h("strong", null, V("trucks.working"), " / ", V("trucks.fleet"))),
  h(HudChip, { label: "trucks.balanced" }, h("strong", null, V("trucks.balanced", { f: S }))),
  h(HudChip, { label: "sim (adapter)", adapter: true }, h(SimClock)),
  h(HudChip, { label: "assumed: heavy", adapter: true }, h("strong", null, "25 km/h"), " · last-mile ", h("strong", null, "22 km/h")));

// The SVG basemap + canvas stay hand-written (GUI has no scene component); mounted once from <template>.
const MapScene = React.memo(function MapScene() {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => { initMap(ref.current); }, []);
  return h(Box, { ref, sx: { position: "absolute", inset: 0 } });
});
function MapPanel() {
  const { me } = useStore(ui);
  return h(Box, { className: "map-wrap", sx: { position: "relative", overflow: "hidden", bgcolor: "#0b0d10", minHeight: 300 } },
    h(MapScene),
    me ? h(G.MeRuntimeProvider, { me, subscribe: kernelSubscribe }, h(Legend), h(Hud)) : null);
}

const Footer = () => h(Box, { component: "footer", sx: { px: 2, py: .9, borderTop: 1, borderColor: "divider", fontFamily: MONO, fontSize: 10, color: "text.disabled", display: "flex", justifyContent: "space-between", gap: 1.25, flexWrap: "wrap", "& a": { color: "text.secondary" } } },
  h("span", null, "© ", h(Link, { href: "https://www.openstreetmap.org/copyright", target: "_blank", rel: "noopener", underline: "hover" }, "OpenStreetMap"), " contributors · static SVG basemap · no live tiles"),
  h("span", null, h(KernelLink, { id: "kver-foot", after: " (unmodified)", minCh: 44 }), ` · this.gui@${GUI_PIN.version} (pinned, SRI) · `, h(Link, { href: "veracruz-port/", underline: "hover" }, "build notes")));

function App() {
  return h(G.Theme, { initialThemeId: "neurons.me", initialMode: "dark" },
    h(Box, { sx: { display: "flex", flexDirection: "column", height: "100vh", minHeight: 640, bgcolor: "background.default", color: "text.primary", "@media (max-width:1000px)": { height: "auto" } } },
      TOPBAR, h(TitleStrip), h(Glossary),
      h(Box, { className: "layout", sx: { flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", minHeight: 0, "@media (max-width:1000px)": { gridTemplateColumns: "1fr", gridTemplateRows: "minmax(300px, 42vh) auto" } } },
        h(MapPanel), h(Aside)),
      h(Footer)));
}

// ══════════════════════════ adapter: map layer, loop, kernel lifecycle ══════════════════════════
let canvas = null, ctx = null, wrap = null, view = { s: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
function resize() {
  if (!wrap) return;
  const r = wrap.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const s = Math.min(r.width / 1200, r.height / 800);   // matches preserveAspectRatio="xMidYMid meet"
  view = { s, ox: (r.width - 1200 * s) / 2, oy: (r.height - 800 * s) / 2, dpr, w: r.width, h: r.height };
}
function initMap(host) {
  host.appendChild(document.getElementById("map-tpl").content.cloneNode(true));
  wrap = host; canvas = host.querySelector("#traffic"); ctx = canvas.getContext("2d");
  new ResizeObserver(resize).observe(host); resize();
  exitLabels(); applyMapHighlights();
  requestAnimationFrame(frame);
}
function exitLabels() {
  const g = $("#exit-labels"), NS = "http://www.w3.org/2000/svg";
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
    const t = document.createElementNS(NS, "text");
    t.setAttribute("class", "exit-label");
    t.setAttribute("x", (cross[0] + (left ? 8 : -8)).toFixed(1));
    t.setAttribute("y", (top ? 16 : 728).toFixed(1));
    t.setAttribute("text-anchor", left ? "start" : "end");
    t.textContent = (top ? "↖ " : "↓ ") + EXITS[ex] + " · off map";
    g.appendChild(t);
  }
}
let lastHlStep = 0;
function applyMapHighlights() {
  const step = ui.state.step; if (!wrap || step === lastHlStep) return; lastHlStep = step;
  const t = TOUR[step];
  $$("#nodes .node").forEach((n) => { n.classList.remove("hl", "dimmed"); n.classList.add(t.hlNodes.includes(n.id) ? "hl" : "dimmed"); });
  $$("#edges .edge").forEach((e) => { e.classList.remove("hl", "dimmed"); e.classList.add(t.hlEdges.includes(e.id) ? "hl" : "dimmed"); });
}
ui.subscribe(applyMapHighlights);

// SVG node labels: map layer, read from the kernel at the UI tick (adapter render; not a GUI component)
function renderMapLabels() {
  if (!P || !wrap) return;
  const R = P.read;
  for (const s of SHIPS_META) {
    const work = R(`ships.${s.i}.hasWork`);
    $(`#ship${s.i}-meta`).textContent = `${work ? "unloading" : "done"} · ${fmt(R(`ships.${s.i}.remaining`))} ${s.unit}`;
    $(`#n-ship${s.i}`).classList.toggle("done", !work); $(`#n-ship${s.i}`).classList.toggle("busy", !!work);
  }
  const tw = R("train.1.hasWork");
  $("#train-meta").textContent = `${tw ? "loading" : "done"} · ${fmt(R("train.1.remainingToLoad"))} t`;
  $("#n-train").classList.toggle("done", !tw); $("#n-train").classList.toggle("busy", !!tw);
  $("#qimp-meta").textContent = `${R("queues.import.length")} queued${R("queues.import.busy") ? "" : " · idle"}`;
  $("#qexp-meta").textContent = `${R("queues.export.length")} queued${R("queues.export.busy") ? "" : " · idle"}`;
  $("#yard-meta").textContent = `pool: ${fmt(R("trucks.heavy.available"))} heavy · ${T ? T.units.filter((u) => u.home === 0 && u.st === "lmPool").length : 0} small (adapter)`;
  $("#port-status").textContent = R("port.busy") ? "port.busy = true" : "port.busy = false";
}
function lightHits() {
  if (!wrap) return;
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

function draw() {
  const { s, ox, oy, dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  if (!T) return;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 1200, 800); ctx.clip();   // trucks vanish at the map edge
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
  ctx.restore();
}

// ── main loop: adapter steps → one flush per animation tick → kernel writes ──
let lastNow = 0;
function frame(now) {
  requestAnimationFrame(frame);
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
  draw();
  if (now - lastUi > 250) { lastUi = now; if (P) uiTick(); }
}

function setRunning(on, finished = false) {
  running = on && !(T && T.done());
  ui.set({ running, finished: finished || !!(T && T.done()) });
}
function resetKernel() {
  P = createPortKernel(ME);
  T = createTraffic({ kernel: P, ROUTES, KEY, PROJ });
  flushLog = []; lastFlush = null; flushCount = 0; writeCount = 0; maxMoving = 0; hitPaths.clear(); pendingPaths.clear();
  running = false;
  ui.set({ me: P.me, seed: P.seedLog.join("\n"), verify: { tone: "", text: VERIFY_HINT }, running: false, finished: false });
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
ReactDOM.createRoot(document.getElementById("root")).render(h(App));

try {
  const { mod, host, hash, url, version } = await loadKernel();
  ME = mod.default || mod.ME;
  ui.set({ kernel: { state: "ok", version, hash, url, text: `Kernel <b>this.me@${version.replace(/[&<>"]/g, "")}</b> · dist/me.es.js from ${host} · sha256 ${hash.slice(0, 12)}… <b>verified</b> · unmodified · UI <b>this.gui@${G.version}</b> (UMD, SRI-pinned)` } });
  resetKernel();
  if (params.get("autostart") !== "0") setRunning(true);
  // hooks for headless checks
  window.__port = {
    get P() { return P; }, get T() { return T; },
    verify,
    pause: () => setRunning(false),
    gui: { version: G.version, pinned: GUI_PIN, get announced() { return announced; }, listeners: () => kListeners.size },
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
  if (!ME) ui.set({ kernel: { state: "error", mismatch: !!e?.mismatch, detail: String(e?.message || e), text: `<b>Kernel failed to load</b>: ${msg}. Nothing on this page runs without it.` } });
  setTourOpen(true, false);
  window.__portError = String(e?.message || e);
}
