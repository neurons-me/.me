/*! AI-Decides 1.0.3 · "AI decides, .me computes" on GTFS-Madrid-Bench data · MIT · neurons.me
 * A versioned policy function (policy:fair-headway@1, ai-model.js) proposes a headway decision with its reason; the
 * decision is stored in a real this.me 4.2.1 kernel as facts (decisions.<n>.by/at/scenario/reason/…/inputsHash) and ONE
 * write (policy.factor, or services.<s>.enabled for a suspension) starts the wave. The kernel runs in a Web Worker
 * (CDN, SRI-checked); the page gets the wave's real recompute order as indices and replays it at the measured duration.
 * explain() on any node walks node → the write that last recomputed it → the decision behind that write → its wave →
 * the change (before is read from the kernel just before the write).
 * .GUI (this.gui 4.2.0): the figure, its centre, one part per route, the selected node, the panel and its sections are
 * registered parts (Grid Layout, Inspector); the Inspector's Explain is answered by the worker kernel.
 */
(function () {
  var G = window.GUI, React = window.React, ROOT = document.getElementById("root");
  if (!G || !React || !window.ReactDOM || typeof G.mount !== "function" || !ROOT) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useMemo = React.useMemo;
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var HERE = new URL(".", (document.currentScript && document.currentScript.src) || location.href).href;
  var MODEL_URL = HERE + "ai-model.js?v=1.0.2", DATA_URL = function (s) { return HERE + "data/madrid-s" + s + ".json?v=1"; };
  var ME_VERSION = "4.2.1", ME_URL = "https://cdn.jsdelivr.net/npm/this.me@" + ME_VERSION + "/dist/me.umd.js", ME_SRI = "sha384-ElnWCZOb324gqFJ2M/Fxy4CZ6Si131WIbR54iYomzEbTloUDLfBzZ05qi1nZ7+4G";
  var SRC_URL = "https://github.com/neurons-me/.me/blob/main/Demos/SmartCities/AI-Decides/";
  var params = new URLSearchParams(location.search);
  var NF = {}, fmt = function (n, d) { if (n == null || isNaN(n)) return "–"; var k = d == null ? 0 : d;   // formatters cached: the replay updates k every frame
    var f = NF[k] || (NF[k] = new Intl.NumberFormat("en-US", { maximumFractionDigits: k, minimumFractionDigits: Math.min(k, 1) })); return f.format(Number(n)); };
  var ms = function (x) { return x == null ? "–" : x >= 100 ? fmt(x) + " ms" : x.toFixed(1) + " ms"; };
  var val = function (v) { return typeof v === "number" ? (Number.isInteger(v) ? fmt(v) : fmt(v, 2)) : v === undefined ? "–" : String(v); };
  var SCEN = [["ten", "Buses 10% more often"], ["am-peak", "Weekday AM peak"], ["event", "Event tonight"], ["save", "Off-peak, save energy"], ["timetable", "Back to the timetable"]];

  // ── the kernel worker: this.me 4.2.1 (fetched with SRI) + ai-model.js + the data; everything heavy happens here ──
  function KERNEL_WORKER() {
    var E = null, ready = null, scale = 0, KV = "?";
    function load(q) {
      KV = (String(q.url).match(/this\.me@([\w.-]+)/) || [])[1] || "?";   // the worker's kernel version, from the URL it loads
      if (!ready) ready = fetch(q.url, { integrity: q.sri, mode: "cors", credentials: "omit" }).then(function (r) { if (!r.ok) throw new Error("this.me: HTTP " + r.status); return r.text(); })
        .then(function (txt) { var u = URL.createObjectURL(new Blob([txt], { type: "text/javascript" })); importScripts(u); URL.revokeObjectURL(u); importScripts(q.model); if (!self.Me || !self.Me.ME || !self.AIDecidesModel) throw new Error("this.me or the model did not load"); });
      return ready;
    }
    var first = function (a) { return Array.isArray(a) ? a.slice(0, 6) : undefined; };
    function shortExplain(path) {
      var t = performance.now(), ex = E.me.explain(path) || {}, dt = performance.now() - t, m = ex.meta || {}, d = ex.derivation;
      return { path: ex.path || path, value: ex.value, expr: ex.expr, derivation: d ? { expression: d.expression, inputs: (d.inputs || []).slice(0, 8), inputsTotal: (d.inputs || []).length } : undefined,
        meta: { dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn.slice(0, 12) : m.dependsOn, dependsOnCount: Array.isArray(m.dependsOn) ? m.dependsOn.length : undefined, k: m.k, sourcePath: m.sourcePath, lastComputedAt: m.lastComputedAt, recomputedAt: m.recomputedAt,
          recomputedCount: Array.isArray(m.recomputed) ? m.recomputed.length : undefined, recomputedFirst: first(m.recomputed), changedCount: Array.isArray(m.changed) ? m.changed.length : undefined, changedFirst: first(m.changed),
          kernel: "this.me " + KV + " · Web Worker · GTFS-Madrid-Bench scale " + scale, explainMs: +dt.toFixed(2), shortened: "recomputed / changed cross from the worker as counts + first 6 paths" } };
    }
    function shortInspect(path) {
      var req = { scheme: "me", namespace: "self", operation: "inspect", path: path, raw: "me://self:inspect/" + path, contextRaw: null };
      var ins = (typeof E.me.execute === "function" ? E.me.execute(req) : E.me.inspect()) || {}, mem = Array.isArray(ins.memories) ? ins.memories : [];
      var keep = mem.filter(function (q) { var p = String(q && q.path || ""); return p === path || p.indexOf(path + ".") === 0; });
      return { path: path, value: ins.value, recomputeMode: ins.recomputeMode, secretScopes: ins.secretScopes, encryptedScopes: ins.encryptedScopes, noiseScopes: ins.noiseScopes,
        staleDerivationsCount: Array.isArray(ins.staleDerivations) ? ins.staleDerivations.length : undefined, memories: keep.slice(-50), memoriesTotal: mem.length, shortened: "memories filtered in the worker to this path (" + keep.length + " of " + mem.length + "); index omitted" };
    }
    function state() { var s = E.st; return { perHour: s.perHour.slice(), tight: s.tight.slice(), live: s.live.slice(), routeAny: s.routeAny.slice(), routePh: Array.from(s.routePh), city: s.city, factor: s.factor, enabled: Array.from(s.enabled) }; }
    function postWave(w) {
      var S = state(), msg = { op: "wave", wave: w, state: S, decisions: E.decisions(), undoable: E.undoable() };
      postMessage(msg, [w.order.buffer, w.chWin.buffer, w.chTrip.buffer, w.chRoute.buffer, w.chStops.buffer, S.perHour.buffer, S.tight.buffer, S.live.buffer, S.routeAny.buffer]);
    }
    onmessage = function (e) {
      var q = e.data, reply = function (o) { o.id = q.id; o.ok = true; postMessage(o); }, fail = function (err) { postMessage({ id: q.id, ok: false, error: String(err && err.message || err) }); };
      load(q).then(function () {
        if (q.op === "build") {
          return fetch(q.data).then(function (r) { if (!r.ok) throw new Error("data: HTTP " + r.status); return r.json(); }).then(function (data) {
            E = null; scale = data.scale;
            E = self.AIDecidesModel.Engine(self.Me.ME, data, function (p) { postMessage({ op: "progress", id: q.id, p: p }); });
            var I = E.idx, svc = data.services.map(function (s, i) { return { id: s.id, days: s.days, trips: I.trips.filter(function (x) { return x.s === i + 1; }).length }; });
            reply({ scale: data.scale, counts: data.counts, source: data.source, derived: I.derived, buildMs: E.buildMs, readMs: E.readMs, wins: I.wins, stops: I.stops,
              routes: I.routes.map(function (r) { return { id: r.id, trip0: r.trip0, trips: r.trips }; }), trips: I.trips.map(function (x) { return [x.r, x.t, x.s, x.win0, x.wins, x.st0, x.st, x.dir]; }),
              services: svc, state: state(), floor: E.me("policy.minHeadway"), policy: self.AIDecidesModel.POLICY });
          });
        }
        if (!E) throw new Error("no kernel yet");
        if (q.op === "propose") return reply({ payload: E.propose(q.scenario) });
        if (q.op === "apply") { postWave(E.apply(q.scenario)); return reply({}); }
        if (q.op === "service") { postWave(E.setService(q.s, q.on)); return reply({}); }
        if (q.op === "undo") { var w = E.undo(); if (w) postWave(w); return reply({ none: !w }); }
        if (q.op === "chain") return reply({ payload: E.chain(q.path) });
        if (q.op === "explain") return reply({ payload: shortExplain(q.path) });
        if (q.op === "read") { var t0 = performance.now(), vals = q.paths.map(function (p) { return E.me(p); }); return reply({ payload: { values: vals, ms: +(performance.now() - t0).toFixed(3) } }); }
        if (q.op === "inspect") return reply({ payload: shortInspect(q.path) });
        throw new Error("unknown op " + q.op);
      }).catch(fail);
    };
  }

  // ── one kernel per page, shared by the figure, the panel and the Inspector (window.AIDecidesKernel) ──
  var live = (function () {
    var w = null, seq = 0, pending = {}, subs = [];
    var st = { phase: "idle", scale: 0, target: params.get("scale") === "10" ? 10 : 1, progress: 0, error: null, info: null, state: null, wave: null, waveSeq: 0, decisions: [], undoable: 0, proposal: null, scenario: null };
    var emit = function () { subs.forEach(function (f) { f(st); }); };
    var set = function (o) { for (var k in o) st[k] = o[k]; emit(); };
    function worker() {
      if (w) return w;
      var url = URL.createObjectURL(new Blob(["(" + KERNEL_WORKER + ")();"], { type: "text/javascript" })); w = new Worker(url); URL.revokeObjectURL(url);
      w.onmessage = function (e) {
        var d = e.data;
        if (d.op === "progress") { set({ progress: d.p }); return; }
        if (d.op === "wave") { set({ wave: d.wave, state: d.state, decisions: d.decisions, undoable: d.undoable, waveSeq: st.waveSeq + 1 }); return; }
        var q = pending[d.id]; if (!q) return; delete pending[d.id]; d.ok ? q.res(d) : q.rej(new Error(d.error));
      };
      w.onerror = function (e) { set({ phase: "error", error: (e && e.message) || "worker error" }); };
      return w;
    }
    function call(op, args) { return new Promise(function (res, rej) { var id = ++seq; pending[id] = { res: res, rej: rej }; var m = { id: id, op: op, url: ME_URL, sri: ME_SRI, model: MODEL_URL }; for (var k in args) m[k] = args[k]; worker().postMessage(m); }); }
    var building = null;
    function build(scale) {
      if (building) return building;
      set({ phase: "building", target: scale, progress: 0, error: null, wave: null, decisions: [], undoable: 0, proposal: null, scenario: null, info: null, state: null });
      var b = building = call("build", { data: DATA_URL(scale) }).then(function (r) { building = null; set({ phase: "ready", scale: r.scale, info: r, state: r.state }); return r; },
        function (err) { building = null; set({ phase: "error", error: err.message }); throw err; });
      return b;
    }
    var busy = function (label, p) { set({ phase: "writing", busyLabel: label }); return p.then(function (r) { set({ phase: "ready" }); return r; }, function (err) { set({ phase: "error", error: err.message }); throw err; }); };
    function waveList(count, firstPaths) { if (typeof count !== "number") return undefined; var a = new Array(count); (firstPaths || []).forEach(function (p, i) { a[i] = p; });
      Object.defineProperty(a, "toJSON", { value: function () { return { count: count, first: firstPaths || [], note: "full list stays in the worker" }; } }); return a; }
    function adapt(p) { var m = p && p.meta; if (!m) return p; if (m.recomputedCount != null) m.recomputed = waveList(m.recomputedCount, m.recomputedFirst); if (m.changedCount != null) m.changed = waveList(m.changedCount, m.changedFirst); return p; }
    var PATH_RE = /^(policy\.(factor|minHeadway|decision|count)|city\.perHour|services\.\d+\.(enabled|days)|routes\.\d+\.(perHour|anyTight)|routes\.\d+\.trips\.\d+\.(perHour|live|service)|routes\.\d+\.trips\.\d+\.win\.\d+\.(base|headway|perHour|tight)|routes\.\d+\.trips\.\d+\.st\.\d+\.served|decisions\.\d+\.[A-Za-z.]+)$/;
    var ready = function () { return st.phase === "ready" || st.phase === "writing" ? Promise.resolve() : building || build(st.target); };
    var api = {
      state: function () { return st; }, set: set,
      subscribe: function (f) { subs.push(f); return function () { subs = subs.filter(function (g) { return g !== f; }); }; },
      build: build,
      propose: function (id) { set({ scenario: id }); return ready().then(function () { return call("propose", { scenario: id }); }).then(function (r) { if (st.scenario === id) set({ proposal: r.payload }); return r.payload; }); },
      apply: function (id) { return busy("Applying the decision", call("apply", { scenario: id })).then(function () { return api.propose(id); }); },
      service: function (s, on) { return busy((on ? "Resuming" : "Suspending") + " service " + s, call("service", { s: s, on: on })).then(function () { if (st.scenario) return api.propose(st.scenario); }); },
      undo: function () { return busy("Undoing", call("undo", {})).then(function () { if (st.scenario) return api.propose(st.scenario); }); },
      chain: function (path) { return ready().then(function () { return call("chain", { path: path }); }).then(function (r) { return r.payload; }); },
      // plain reads, me(path) in the worker's kernel (the How. block's Try it panel); only this demo's own paths
      read: function (paths) { paths = [].concat(paths).map(String); if (!paths.every(function (p) { return PATH_RE.test(p); })) return Promise.reject(new Error("not a path of this demo's kernel"));
        return ready().then(function () { return call("read", { paths: paths }); }).then(function (r) { return r.payload; }); },
      explain: function (path) { path = String(path || "");
        if (!PATH_RE.test(path)) return Promise.resolve({ path: path, value: undefined, meta: { note: "not a path of this demo's kernel" } });
        return ready().then(function () { return call("explain", { path: path }); }).then(function (r) { return adapt(r.payload); }); },
      execute: function (req) { var path = String(req && req.path || "");
        if (!req || req.operation !== "inspect" || !PATH_RE.test(path)) return Promise.reject(new Error("this demo's kernel only answers self:inspect for its own paths"));
        return ready().then(function () { return call("inspect", { path: path }); }).then(function (r) { return r.payload; }); },
    };
    return api;
  })();
  window.AIDecidesKernel = { explain: live.explain, execute: live.execute, __live: live };
  if (params.get("autobuild") !== "0") live.build(live.state().target).catch(function () {});

  var CSS = [
    ".aid{container-type:inline-size}.aid-dash{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}",
    "@container (min-width: 820px){.aid-dash{grid-template-columns:minmax(0,1fr) 360px}.aid-dash .aid-panel{position:sticky;top:60px;max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}}",
    ".aid-disc{position:relative;margin:0 auto;max-width:100%;outline:none;touch-action:manipulation}.aid-disc:focus-visible{box-shadow:0 0 0 2px var(--mui-palette-primary-main,#2aa);border-radius:50%}",
    ".aid-disc canvas{position:absolute;left:0;top:0;display:block}",
    ".aid-lit{transition:opacity .9s ease}@media (prefers-reduced-motion: reduce){.aid-lit{transition:none}}",
    ".aid-hit{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}",
    ".aid-hit [data-gui-node-id]{outline:none!important;box-shadow:none!important}",
    ".aid-hit path,.aid-hit circle{fill:transparent;stroke:none;pointer-events:all;cursor:pointer}.aid-hit circle.aid-mark{pointer-events:none}.aid-hit circle.aid-mark[data-armed]{pointer-events:all}",
    ".aid-hit .on>path,.aid-hit .on>circle{stroke:var(--gui-inspector-accent,var(--mui-palette-primary-main,#2aa));stroke-width:1.5px}",
    ".aid-hit .on>path{fill:color-mix(in srgb,var(--gui-inspector-accent,var(--mui-palette-primary-main,#2aa)) 8%,transparent)}",
    ".gui-grid-overlay-active .aid-hit path,.gui-grid-overlay-active .aid-hit circle{stroke:color-mix(in srgb,var(--gui-inspector-accent,#3b82f6) 55%,transparent);stroke-width:1px}",
    ".aid-k{margin-top:6px;text-align:center;font:12.5px/1.5 " + MONO + ";font-variant-numeric:tabular-nums;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".aid-cap{margin:4px auto 0;max-width:640px;text-align:center;font-size:13px;line-height:1.55;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".aid-legend{display:inline-flex;flex-wrap:wrap;gap:4px 12px;justify-content:center}.aid-sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}",
    ".aid-tag{display:inline-block;margin:0 6px;padding:0 7px;line-height:1.5;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:1px solid currentColor}",
    ".aid-tag.rep{color:var(--mui-palette-text-secondary,#8b949e)}.aid-tag.live{color:var(--mui-palette-success-main,#2e9d6e)}.aid-tag.gen{color:var(--mui-palette-warning-main,#b7791f)}",
    ".aid-kernel{padding:6px 14px 2px;font:11.5px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--mui-palette-text-secondary,#888)}.aid-kernel a{color:var(--mui-palette-primary-main,inherit);text-decoration:none}.aid-kernel a:hover{text-decoration:underline}.aid-panel{contain:layout paint;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;background:var(--mui-palette-background-paper,transparent);font-size:13px;color:var(--mui-palette-text-primary,inherit);overflow:hidden}",
    "@container (max-width: 819px){.aid-panel{border-radius:16px 16px 12px 12px}.aid-phead{padding-top:14px}.aid-phead::before{content:'';position:absolute;left:50%;top:5px;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:var(--mui-palette-divider,rgba(128,128,128,.4))}}",
    ".aid-phead{position:relative;display:flex;align-items:center;gap:6px;padding:8px 8px 8px 12px}.aid-ptitle{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font-weight:600;white-space:nowrap;overflow:hidden}",
    ".aid-pmini{font:11.5px " + MONO + ";font-weight:400;color:var(--mui-palette-text-secondary,#8b949e);overflow:hidden;text-overflow:ellipsis}",
    ".aid-ibtn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border-radius:8px;border:0;background:transparent;color:inherit;cursor:pointer}.aid-ibtn:hover{background:color-mix(in srgb,currentColor 10%,transparent)}.aid-ibtn:focus-visible{outline:2px solid var(--mui-palette-primary-main,#2aa)}.aid-ibtn svg{width:15px;height:15px}",
    ".aid-chev{display:inline-flex;transition:transform .15s}.aid-chev.up{transform:rotate(180deg)}@media (prefers-reduced-motion: reduce){.aid-chev{transition:none}}",
    ".aid-sec{border-top:1px solid var(--mui-palette-divider,rgba(128,128,128,.25))}",
    ".aid-shead{display:flex;width:100%;align-items:center;gap:6px;padding:8px 12px;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;text-align:left}",
    ".aid-shead:hover{background:color-mix(in srgb,currentColor 5%,transparent)}.aid-shead:focus-visible{outline:2px solid var(--mui-palette-primary-main,#2aa);outline-offset:-2px}.aid-shead>span:first-child{flex:1}",
    ".aid-shead small{font:11.5px " + MONO + ";text-transform:none;letter-spacing:0;font-weight:400;color:var(--mui-palette-text-secondary,#8b949e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}",
    ".aid-sbody{padding:2px 12px 12px}.aid-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;line-height:1.6}.aid-row>span:first-child{color:var(--mui-palette-text-secondary,#8b949e);min-width:0}",
    ".aid-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}",
    ".aid-note{margin-top:4px;color:var(--mui-palette-text-secondary,#8b949e);font-size:12px;line-height:1.5}.aid-warn{color:var(--mui-palette-warning-main,#b7791f)}",
    ".aid-ctl{display:flex;flex-wrap:wrap;gap:6px}.aid-card{margin-top:8px;padding:10px 12px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:10px;background:color-mix(in srgb,var(--mui-palette-primary-main,#2aa) 5%,transparent)}",
    ".aid-card h4{margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--mui-palette-primary-main,#2aa)}",
    ".aid-reason{margin:6px 0;line-height:1.5}.aid-mono{font-family:" + MONO + ";font-size:12px}.aid-sel{min-height:30px;padding:2px 8px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.4));background:transparent;color:inherit;font:inherit;font-size:13px;max-width:100%}",
    ".aid-sel option{color:#111;background:#fff}",
    ".aid-rlist{list-style:none;margin:4px 0 0;padding:0}.aid-rlist li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;padding:5px 6px;margin:0 -6px;border-radius:6px;cursor:pointer}",
    ".aid-rlist li:hover,.aid-rlist li:focus-visible,.aid-rlist li[aria-pressed=true]{background:color-mix(in srgb,var(--mui-palette-primary-main,#2aa) 10%,transparent);outline:none}.aid-rlist small{grid-column:1/-1;color:var(--mui-palette-text-secondary,#8b949e);font-family:" + MONO + ";font-size:11.5px}",
    ".aid-chain{list-style:none;margin:6px 0 0;padding:0;counter-reset:c}.aid-chain>li{position:relative;padding:0 0 10px 26px;overflow-wrap:anywhere}.aid-chain>li::before{counter-increment:c;content:counter(c);position:absolute;left:0;top:1px;width:18px;height:18px;border-radius:50%;font-size:11px;line-height:18px;text-align:center;font-weight:700;color:var(--mui-palette-primary-contrastText,#fff);background:var(--mui-palette-primary-main,#2aa)}",
    ".aid-chain>li::after{content:'';position:absolute;left:8.5px;top:21px;bottom:2px;width:1px;background:var(--mui-palette-divider,rgba(128,128,128,.4))}.aid-chain>li:last-child::after{display:none}.aid-chain b{display:block;font-size:12px;letter-spacing:.03em;text-transform:uppercase}",
    ".aid-hist{list-style:none;margin:0;padding:0}.aid-hist li{padding:4px 0;border-bottom:1px dashed var(--mui-palette-divider,rgba(128,128,128,.3));font-size:12px;line-height:1.45;overflow-wrap:anywhere}.aid-hist li:last-child{border-bottom:0}",
    ".aid-how{margin:0 0 28px}.aid-how h2{margin:0 0 12px;font-size:1.35rem;font-weight:800;letter-spacing:-.01em}",
    ".aid-how-flow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 12px;font:12px/1.4 " + MONO + "}.aid-how-flow>span{padding:3px 8px;border-radius:999px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3))}.aid-how-flow>i{font-style:normal;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".aid-how-grid{display:grid;grid-template-columns:1fr;gap:10px}@media (min-width:900px){.aid-how-grid{grid-template-columns:minmax(0,1.05fr) minmax(0,1.35fr) minmax(0,.9fr)}}",
    ".aid-how-card{padding:12px 14px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;background:var(--mui-palette-background-paper,transparent);min-width:0}",
    ".aid-how-card h3{margin:0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.aid-how-t{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;min-height:32px;cursor:pointer;color:var(--mui-palette-primary-main,#2aa);border-radius:6px}.aid-how-t:focus-visible{outline:2px solid var(--mui-palette-primary-main,#2aa);outline-offset:2px}.aid-how-t b{display:inline-block;min-width:18px;color:var(--mui-palette-text-secondary,#8b949e)}.aid-how-chev{margin-left:auto;display:inline-flex;width:16px;height:16px;transition:transform .15s;color:var(--mui-palette-text-secondary,#8b949e)}.aid-how-chev svg{width:16px;height:16px}.aid-how-card.on .aid-how-chev{transform:rotate(180deg)}.aid-how-body{margin-top:8px}.aid-how-grid{align-items:start}.aid-how-card .aid-how-t{display:none}",
    ".aid-how-map{list-style:none;margin:0;padding:0}.aid-how-map li{display:grid;grid-template-columns:minmax(0,.85fr) 14px minmax(0,1.3fr);gap:6px;align-items:baseline;padding:5px 0;border-bottom:1px dashed var(--mui-palette-divider,rgba(128,128,128,.25));font-size:12px;line-height:1.45}.aid-how-map li:last-child{border-bottom:0}",
    ".aid-how-map .a{color:var(--mui-palette-text-secondary,#8b949e);text-align:center}.aid-how code,.aid-how-der code{font-family:" + MONO + ";font-size:11.5px;overflow-wrap:anywhere}.aid-how code.me-code{font-family:" + MONO + ";font-size:11.5px;overflow-wrap:normal;word-break:normal;background:none;padding:0}.aid-how code.nw{white-space:nowrap}.aid-how-flow code.me-code{border:0;background:none;padding:0;margin:0;box-shadow:none;font-size:12px}.aid-how-map small{display:block;color:var(--mui-palette-text-secondary,#8b949e);font-size:11px}",
    ".aid-how-der{list-style:none;margin:0;padding:0}.aid-how-der li{padding:4px 0;border-bottom:1px dashed var(--mui-palette-divider,rgba(128,128,128,.25));font:11.5px/1.5 " + MONO + "}.aid-how-der li:last-child{border-bottom:0}.aid-how-der .p{color:var(--mui-palette-text-secondary,#8b949e)}.aid-how-der .k{color:var(--mui-palette-primary-main,#2aa)}",
    ".aid-how-w{margin:0;padding:0;list-style:none;font:11.5px/1.5 " + MONO + "}.aid-how-w li{padding:3px 0 3px 14px;position:relative;overflow-wrap:anywhere}.aid-how-w li::before{content:'↓';position:absolute;left:0;color:var(--mui-palette-text-secondary,#8b949e)}.aid-how-w li:first-child::before{content:'✎';color:var(--mui-palette-primary-main,#2aa)}",
    ".aid-how-main{margin:2px 0 10px;padding:8px 12px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:10px;font-size:13px;font-weight:600;width:auto;display:inline-flex;gap:10px}.aid-how-main .aid-how-chev{margin-left:4px}.aid-how-main[aria-expanded=true] .aid-how-chev{transform:rotate(180deg)}.aid-how-body>*+*{margin-top:10px}",
    ".aid-how-file{color:inherit;text-decoration:underline dotted;text-underline-offset:3px}.aid-how-map a.a{text-decoration:none}.aid-how-map a.a:hover{color:var(--mui-palette-primary-main,#2aa)}",
    ".aid-try h4{margin:10px 0 6px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mui-palette-text-secondary,#8b949e)}.aid-try-grid{display:grid;grid-template-columns:1fr;gap:14px}@media (min-width:900px){.aid-try-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}.aid-try-col{min-width:0}",
    ".aid-try-raw{margin-bottom:8px}.aid-try-rl{font-size:11.5px;color:var(--mui-palette-text-secondary,#8b949e);margin-bottom:2px}.aid-try-raw pre{margin:0;padding:6px 8px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));font:11px/1.55 " + MONO + ";overflow-x:auto;white-space:pre}.aid-try-raw .hd{color:var(--mui-palette-text-secondary,#8b949e)}",
    ".aid-try-paths{list-style:none;margin:0;padding:0}.aid-try-paths li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 10px;padding:3px 0;border-bottom:1px dashed var(--mui-palette-divider,rgba(128,128,128,.25));align-items:baseline}.aid-try-paths .v{font:600 12px " + MONO + "}.aid-try-paths small{grid-column:1/-1;font-size:11px;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".aid-qa{display:grid;gap:12px;margin:0 0 22px}.aid-qa.ans{margin:18px 0 22px}.aid-qn{margin:10px 0 0;padding:8px 10px;border-radius:10px;border:1px dashed var(--mui-palette-warning-main,#f0b429);font-size:12.5px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}.aid-other{margin-top:8px;font-size:12.5px}.aid-other summary{cursor:pointer;color:var(--mui-palette-text-secondary,#8b949e)}"+
    ".aid-q,.aid-a{border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:14px;padding:14px 16px;background:var(--mui-palette-background-paper,transparent)}.aid-a{border-color:var(--mui-palette-primary-main,#58a6ff)}",
    ".aid-qk{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mui-palette-text-secondary,#8b949e);margin-bottom:6px}.aid-qstate{letter-spacing:0;text-transform:none;font-weight:600}",
    ".aid-q h2{margin:0;font-size:clamp(1.15rem,2.6vw,1.5rem);line-height:1.3;font-weight:800}.aid-qs{margin-top:6px;font-size:12.5px;color:var(--mui-palette-text-secondary,#8b949e)}.aid-qbtns{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}.aid-qkern{padding:0 4px}",
    ".aid-akpis{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:600px){.aid-akpis{grid-template-columns:1fr}}.aid-akpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;cursor:pointer}button.aid-akpi:hover{border-color:var(--mui-palette-primary-main,#58a6ff)}",
    ".aid-akpi small{font-size:11.5px;color:var(--mui-palette-text-secondary,#8b949e)}.aid-akpi b{font-size:1.6rem;font-weight:800;font-variant-numeric:tabular-nums}.aid-akpi .arr{color:var(--mui-palette-success-main,#2e9d6e)}.aid-akpi .arr.dn,.aid-akpi em.dn{color:var(--mui-palette-error-main,#e5534b)}.aid-qbtn-s{font:inherit;font-weight:700;padding:3px 10px;border-radius:8px;border:1px solid currentColor;background:none;color:var(--mui-palette-primary-main,#58a6ff);cursor:pointer}.aid-rel code.me-code{font-size:11.5px}.aid-akpi em{font-style:normal;font-size:12.5px;color:var(--mui-palette-text-secondary,#8b949e)}.aid-akpi em.up{color:var(--mui-palette-success-main,#2e9d6e);font-weight:700}.aid-akpi.warn{border-color:var(--mui-palette-warning-main,#f0b429)}.aid-akpi.warn b{color:var(--mui-palette-warning-main,#f0b429)}",
    ".aid-alist{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:4px}.aid-alist button{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:10px 70px minmax(40px,1fr) auto auto;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:12.5px;font-variant-numeric:tabular-nums}.aid-alist button:hover,.aid-alist button:focus-visible{background:var(--mui-palette-action-hover,rgba(128,128,128,.12))}",
    ".aid-alist i{width:10px;height:10px;border-radius:3px}.aid-alist .bar{height:6px;border-radius:3px;background:var(--mui-palette-divider,rgba(128,128,128,.25));overflow:hidden}.aid-alist .bar span{display:block;height:100%;background:var(--mui-palette-warning-main,#f0b429)}.aid-alist .ph{color:var(--mui-palette-text-secondary,#8b949e)}@media (max-width:600px){.aid-alist button{grid-template-columns:10px 62px minmax(30px,1fr) auto}.aid-alist .ph{display:none}}",
    ".aid-pqa{padding:8px 10px 4px;border-bottom:1px solid var(--mui-palette-divider,rgba(128,128,128,.25))}.aid-pqa .aid-qa{gap:8px;margin:0 0 8px}.aid-pqa .aid-qa.ans{margin:8px 0 6px}.aid-pqa .aid-q,.aid-pqa .aid-a{padding:9px 10px;border-radius:10px}",
    ".aid-pqa .aid-qk{font-size:10px;margin-bottom:3px}.aid-pqa .aid-q h2{font-size:14.5px;line-height:1.35}.aid-pqa .aid-qs{font-size:11px;margin-top:4px}.aid-pqa .aid-qbtns{margin-top:8px;gap:6px}.aid-pqa .aid-qbtns button{font-size:12.5px;padding:4px 10px;min-height:0}",
    ".aid-pqa .aid-how{margin:0}.aid-pqa .aid-how h2{font-size:13px;margin:0 0 6px}.aid-pqa .aid-how-flow{font-size:10.5px;gap:3px;margin:0 0 6px}.aid-pqa .aid-how-grid,.aid-pqa .aid-try-grid{grid-template-columns:1fr!important}.aid-pqa .aid-how-map li{grid-template-columns:minmax(0,1fr) 12px minmax(0,1.2fr)}",
    ".aid-pqa .aid-akpis{grid-template-columns:1fr;gap:6px}.aid-pqa .aid-akpi{padding:7px 9px}.aid-pqa .aid-akpi b{font-size:1.2rem}.aid-pqa .aid-akpi small,.aid-pqa .aid-akpi em{font-size:11px}.aid-pqa .aid-note{font-size:11px;line-height:1.4}",
    ".aid-pqa .aid-alist{gap:1px;margin-top:6px}.aid-pqa .aid-alist button{grid-template-columns:8px 56px minmax(24px,1fr) auto;gap:6px;padding:3px 4px;font-size:11.5px}.aid-pqa .aid-alist .ph{display:block;grid-column:2 / -1;font-size:10.5px;margin-top:-2px}.aid-pqa .aid-alist i{width:8px;height:8px}.aid-pqa .aid-qn{font-size:11px;padding:6px 8px}.aid-pqa .aid-map-card{font-size:11px;padding:8px}",
    ".aid-syn{margin:18px 0 6px;min-width:0;max-width:100%}.aid-syn-l{display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mui-palette-text-secondary,#8b949e);margin:0 0 6px}.aid-syn-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media (max-width:640px){.aid-syn-row{grid-template-columns:1fr}}.aid-syn-card{min-width:0;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px dashed var(--mui-palette-divider,rgba(127,127,127,.3));border-radius:10px;background:transparent;color:inherit;cursor:default}.aid-syn-h .me-code{font:600 13px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;background:none;padding:0}.aid-syn-p{margin:0;font-size:13px;line-height:1.45;color:var(--mui-palette-text-secondary,#8b949e);overflow-wrap:anywhere}.aid-syn-p .me-code{font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 4px;border-radius:4px;background:var(--mui-palette-action-hover,rgba(127,127,127,.12))}.aid-syn-more{align-self:flex-start;font-size:12px;font-weight:600;color:var(--mui-palette-primary-main,#58a6ff);text-decoration:none}.aid-syn-more:hover,.aid-syn-more:focus-visible{text-decoration:underline}",
    ".aid-rel-cards{margin:32px 0 8px}.aid-doclink{color:var(--mui-palette-primary-main,#58a6ff)}.aid-rel-cards h2{margin:0 0 10px;font-size:1.35rem;font-weight:800}.aid-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media (max-width:900px){.aid-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.aid-cards{grid-template-columns:1fr}}",
    ".aid-card2{display:flex;flex-direction:column;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:14px;overflow:hidden;background:var(--mui-palette-background-paper,transparent);color:inherit;text-decoration:none;transition:transform .15s,border-color .15s,box-shadow .15s}.aid-card2:hover,.aid-card2:focus-visible{transform:translateY(-2px);border-color:var(--mui-palette-primary-main,#58a6ff);box-shadow:0 6px 18px rgba(0,0,0,.18)}",
    ".aid-card2 .img{display:block;aspect-ratio:1200/630;background:var(--mui-palette-action-hover,rgba(128,128,128,.12));overflow:hidden}.aid-card2 img{width:100%;height:100%;object-fit:cover;display:block}.aid-card2 .tx{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.aid-card2 b{font-size:14px;font-weight:800}.aid-card2 small{font-size:12px;line-height:1.4;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".aid-map{margin:28px 0 8px}.aid-map h2{margin:0 0 4px;font-size:1.35rem;font-weight:800}.aid-map-label{display:inline-block;margin-bottom:10px;padding:2px 8px;border:1px dashed var(--mui-palette-warning-main,#b7791f);border-radius:6px;color:var(--mui-palette-warning-main,#b7791f);font-size:12px;font-weight:600}",
    ".aid-map-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px}@media (max-width:760px){.aid-map-grid{grid-template-columns:1fr}}",
    ".aid-map-fig{min-width:0}.aid-map-svg{display:block;width:100%;max-width:680px;aspect-ratio:1;cursor:crosshair;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;background-image:linear-gradient(var(--mui-palette-divider,rgba(128,128,128,.15)) 1px,transparent 1px),linear-gradient(90deg,var(--mui-palette-divider,rgba(128,128,128,.15)) 1px,transparent 1px);background-size:10% 10%}",
    ".aid-map-bg{fill:transparent}.aid-map-line{fill:none;stroke-linejoin:round;stroke-linecap:round;opacity:.55;transition:opacity .25s,stroke-width .25s}.aid-map-line.off{opacity:.08;stroke-dasharray:6 6}.aid-map-line.sel{opacity:1}",
    ".aid-map-stop.on{fill:var(--mui-palette-text-primary,#e6edf3)}.aid-map-stop.off{fill:none;stroke:var(--mui-palette-text-secondary,#8b949e);stroke-width:1.5}.aid-map-ring{fill:none;stroke:var(--mui-palette-warning-main,#d29922);stroke-width:2.5}.aid-map-pick{fill:none;stroke:var(--mui-palette-primary-main,#58a6ff);stroke-width:3}",
    ".aid-map-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px}.aid-map-tabs [aria-selected=true]{border-color:var(--mui-palette-primary-main,#58a6ff)!important;color:var(--mui-palette-primary-main,#58a6ff)}",
    ".aid-metro-wrap{overflow-x:auto;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;-webkit-overflow-scrolling:touch}.aid-metro-svg{display:block;width:100%;min-width:760px;height:auto;cursor:pointer}",
    ".aid-metro-link{fill:none;stroke:var(--mui-palette-text-secondary,#8b949e);stroke-width:.6;opacity:.14}.aid-metro-link.on{opacity:.9;stroke-width:1.2;stroke:var(--mui-palette-primary-main,#58a6ff)}",
    ".aid-metro-rl{font:700 11px " + MONO + ";fill:var(--mui-palette-text-primary,#e6edf3)}.aid-metro-rv{font:10px " + MONO + ";fill:var(--mui-palette-text-secondary,#8b949e)}.aid-metro-row.sel .aid-metro-rl{fill:var(--mui-palette-primary-main,#58a6ff)}",
    ".aid-metro-seg{fill:none;stroke-linecap:round;transition:stroke-width .35s,opacity .35s}.aid-metro-seg.off{opacity:.22;stroke-dasharray:3 5;stroke-width:1.6!important}.aid-metro-seg.sel,.aid-metro-seg.rsel{filter:drop-shadow(0 0 3px var(--mui-palette-primary-main,#58a6ff))}",
    ".aid-metro-tight{fill:none;stroke:var(--mui-palette-warning-main,#f0b429);stroke-linecap:round;transition:opacity .35s,stroke-width .35s}",
    ".aid-metro-win{fill:var(--mui-palette-divider,rgba(128,128,128,.35))}.aid-metro-win.tight{fill:var(--mui-palette-warning-main,#f0b429)}",
    ".aid-metro-stop.on{fill:var(--mui-palette-background-default,#0d1117);stroke:var(--mui-palette-text-primary,#e6edf3);stroke-width:.9}.aid-metro-stop.off{fill:none;stroke:var(--mui-palette-text-secondary,#8b949e);stroke-width:.7;opacity:.45}.aid-metro-stop.ic.on{stroke-width:1.6}",
    ".aid-map-legend .sw.tightc{border-radius:3px;height:8px;width:16px;vertical-align:0;background:var(--mui-palette-warning-main,#f0b429)}.aid-map-legend .sw.strip{border-radius:0;height:3px;width:16px;vertical-align:3px;background:repeating-linear-gradient(90deg,var(--mui-palette-warning-main,#f0b429) 0 3px,transparent 3px 5px)}.aid-map-legend .sw.ic{background:transparent;border:2px solid var(--mui-palette-text-primary,#e6edf3);width:8px;height:8px}",
    ".aid-map-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:12px;color:var(--mui-palette-text-secondary,#8b949e)}.aid-map-legend .sw{display:inline-block;width:12px;height:12px;margin-right:5px;vertical-align:-2px;border-radius:50%}",
    ".aid-map-legend .sw.line{border-radius:2px;height:4px;vertical-align:2px;width:16px;background:hsl(210 70% 52%)}.aid-map-legend .sw.on{background:var(--mui-palette-text-primary,#e6edf3)}.aid-map-legend .sw.off{border:1.5px solid var(--mui-palette-text-secondary,#8b949e)}.aid-map-legend .sw.ring{border:2.5px solid var(--mui-palette-warning-main,#d29922)}.aid-map-legend .sw.faded{border-radius:2px;height:4px;vertical-align:2px;width:16px;background:hsl(210 70% 52%);opacity:.15}",
    ".aid-map-side{min-width:0}.aid-map-side h3{margin:0 0 6px;font-size:13px;font-weight:700}.aid-map-routes{display:flex;flex-wrap:wrap;gap:6px}.aid-map-rt i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}",
    ".aid-map-card{margin-top:10px;padding:10px 12px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;background:var(--mui-palette-background-paper,transparent);font-size:12px;overflow-wrap:anywhere}.aid-map-ct{font-weight:600;margin-bottom:4px}",
    ".aid-try-res{margin-top:8px;min-height:20px}.aid-try-out{font-size:12px;line-height:1.7;overflow-wrap:anywhere}",
    ".aid-how-foot{margin-top:10px;font-size:12px;color:var(--mui-palette-text-secondary,#8b949e)}.aid-how-foot a{color:var(--mui-palette-primary-main,#2aa)}",
    ".aid-formula{font:12px/1.7 " + MONO + ";overflow-x:auto;white-space:pre}",
    ".aid-busy{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;vertical-align:-1px;animation:aidspin .8s linear infinite}@keyframes aidspin{to{transform:rotate(360deg)}}",
    "@media (prefers-reduced-motion: reduce){.aid-busy{animation:none;border-right-color:currentColor;opacity:.6}}",
    ".aid-info{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-left:3px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--mui-palette-text-secondary,#8b949e);cursor:help;vertical-align:-4px}.aid-info:hover,.aid-info:focus-visible{color:var(--mui-palette-primary-main,#2aa);outline:none}.aid-info svg{width:14px;height:14px}",
  ].join("");
  (function () { if (document.getElementById("aid-css")) return; var s = document.createElement("style"); s.id = "aid-css"; s.textContent = CSS; document.head.appendChild(s); })();
  var ICON = {
    chev: h("svg", { viewBox: "0 0 16 16", "aria-hidden": "true" }, h("path", { d: "M4 6l4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })),
    info: h("svg", { viewBox: "0 0 16 16", "aria-hidden": "true" }, h("circle", { cx: 8, cy: 8, r: 6.6, fill: "none", stroke: "currentColor", strokeWidth: 1.3 }), h("rect", { x: 7.3, y: 7, width: 1.4, height: 4.6, rx: .7, fill: "currentColor" }), h("circle", { cx: 8, cy: 4.9, r: .9, fill: "currentColor" })),
  };
  var InfoTip = React.memo(function InfoTip(p) {
    var GA = G.Atoms || {}, btn = h("button", { type: "button", className: "aid-info", "aria-label": p.label || "More information", "data-gui-inspector-control": "true" }, ICON.info);
    return GA.Tooltip ? h(GA.Tooltip, { title: p.tip, arrow: true, size: "sm", enterTouchDelay: 0, leaveTouchDelay: 6000, describeChild: true, placement: "top" }, btn) : h("span", { title: p.tip }, btn);
  });
  var Info = function (tip, label) { return h(InfoTip, { tip: tip, label: label }); };
  var PERF = {};   // page-side timings for the checks (window.__aid.perf)
  function nodeStore() { return window["GUI-NODES-STORE"] || null; }

  // ── geometry: routes → trips → windows around the circle (one slot per frequency window, a gap between routes) ──
  var RAD = { center: .075, r0: .14, r1: .26, t0: .29, t1: .46, w0: .5, wMax: .88, s0: .91, s1: .965 };
  var tipOf = function (ph) { return Math.max(RAD.w0 + .01, Math.min(RAD.wMax, RAD.w0 + (ph - 10) / 20 * (RAD.wMax - RAD.w0))); };
  function geometry(info) {
    var R = info.routes.length, Wn = info.wins, GAP = R > 40 ? 1 : 3, units = Wn + GAP * R, slot = Math.PI * 2 / units;
    var winRoute = new Uint16Array(Wn), winTrip = new Uint32Array(Wn), rStart = new Float64Array(R), rEnd = new Float64Array(R);
    info.trips.forEach(function (x, g) { for (var w = 0; w < x[4]; w++) { winRoute[x[3] + w] = x[0]; winTrip[x[3] + w] = g; } });
    info.routes.forEach(function (r, ri) { var a = info.trips[r.trip0], b = info.trips[r.trip0 + r.trips - 1]; rStart[ri] = a[3] + GAP * ri + GAP / 2; rEnd[ri] = b[3] + b[4] + GAP * ri + GAP / 2; });
    var uOf = function (g) { return g + GAP * winRoute[g] + GAP / 2; };
    return { R: R, W: Wn, GAP: GAP, slot: slot, winRoute: winRoute, winTrip: winTrip, rStart: rStart, rEnd: rEnd, uOf: uOf, ang: function (u) { return u * slot - Math.PI / 2; },
      // pointer (angle from the top, clockwise; radius in disc units) → { type, r, trip, win, stop }
      hit: function (th, rad, ph) {
        if (rad < RAD.center + .02) return { type: "center" };
        if (rad > RAD.s1 + .02) return null;
        var u = th / slot, lo = 0, hi = R - 1; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (rStart[mid] <= u) lo = mid; else hi = mid - 1; }
        var r = lo; if (u < rStart[r] || u >= rEnd[r]) return null;
        var g = Math.floor(u - GAP * r - GAP / 2); if (g < 0 || g >= Wn) return null; var tg = winTrip[g], x = info.trips[tg];
        if (rad >= RAD.r0 - .01 && rad <= RAD.r1 + .015) return { type: "route", r: r };
        if (rad >= RAD.t0 - .015 && rad <= RAD.t1 + .015) return { type: "trip", r: r, trip: tg };
        if (rad >= RAD.w0 - .02 && rad <= (ph ? tipOf(ph[g]) : RAD.wMax) + .03) return { type: "win", r: r, trip: tg, win: g };
        if (rad >= RAD.s0 - .02 && x[6] > 0) { var f = (u - uOf(x[3])) / Math.max(1e-9, x[4]); return { type: "stop", r: r, trip: tg, stop: Math.min(x[6], Math.max(1, Math.floor(f * x[6]) + 1)) }; }
        return null;
      } };
  }
  var pathOf = function (info, sel, leaf) {
    if (!sel || !info) return null;
    if (sel.type === "center") return "policy.factor";
    if (sel.type === "route") return "routes." + (sel.r + 1) + "." + (leaf === "anyTight" ? "anyTight" : "perHour");
    var x = info.trips[sel.trip], tp = "routes." + (x[0] + 1) + ".trips." + (x[1] + 1);
    if (sel.type === "trip") return tp + "." + (leaf === "live" ? "live" : "perHour");
    if (sel.type === "win") return tp + ".win." + (sel.win - x[3] + 1) + "." + (leaf === "perHour" || leaf === "tight" || leaf === "base" ? leaf : "headway");
    if (sel.type === "stop") return tp + ".st." + sel.stop + ".served";
    return null;
  };
  var labelOf = function (info, sel) {
    if (!sel || !info) return "";
    if (sel.type === "center") return "policy.factor (the write)";
    if (sel.type === "route") return "Route " + (sel.r + 1);
    var x = info.trips[sel.trip];
    if (sel.type === "trip") return "Route " + (x[0] + 1) + " · trip " + (x[1] + 1);
    if (sel.type === "win") return "Route " + (x[0] + 1) + " · trip " + (x[1] + 1) + " · window " + (sel.win - x[3] + 1);
    return "Route " + (x[0] + 1) + " · trip " + (x[1] + 1) + " · stop_time " + sel.stop;
  };
  var LEAVES = { center: [], route: ["perHour", "anyTight"], trip: ["perHour", "live"], win: ["headway", "perHour", "tight", "base"], stop: [] };
  var PANEL_KEY = "ai-decides.panel", SLOW_KEY = "ai-decides.slow";
  var SECTIONS = [["decision", "Decision", true], ["service", "Other scenarios · try a suspension", false], ["wave", "This wave", true], ["routes", "Changed, by route", true], ["chain", "Explain chain", true], ["history", "Decisions log", false], ["model", "Model & data", false]];
  function loadPanel() { var d = { open: true, sec: {} }; SECTIONS.forEach(function (x) { d.sec[x[0]] = x[2]; });
    try { var v = JSON.parse(localStorage.getItem(PANEL_KEY) || "null"); if (v && typeof v === "object") { if (typeof v.open === "boolean") d.open = v.open; for (var k in v.sec) if (k in d.sec) d.sec[k] = !!v.sec[k]; } } catch (e) {}
    return d; }

  // Route highlight shared by the answer list, the figure (route ring) and the map: hover = transient, click = pinned
  var routeHi = { r: -1, subs: [] };
  function hiRoute(r, pin) { routeHi.r = r; routeHi.subs.slice().forEach(function (f) { f(r, !!pin); }); }
  function useRouteHi(onPin) { var st = useState(-1); useEffect(function () { var f = function (r, pin) { st[1](r); if (pin && onPin) onPin(r); }; routeHi.subs.push(f); return function () { routeHi.subs = routeHi.subs.filter(function (g) { return g !== f; }); }; }, []); return st[0]; }
  function Dashboard(props) {
    var rootId = props["data-gui-node-id"] || "ai-decides", nodeId = rootId + "/node";
    var ls = useState(live.state()), lst = ls[0], setLst = ls[1];
    useEffect(function () { return live.subscribe(function (s) { setLst(Object.assign({}, s)); }); }, []);
    var info = lst.info, S = lst.state, Wv = lst.wave;
    var geo = useMemo(function () { return info ? geometry(info) : null; }, [info]);
    var ss = useState(null), sel = ss[0], setSel = ss[1];
    var lf = useState(null), leaf = lf[0], setLeaf = lf[1];
    var selPath = pathOf(info, sel, leaf);
    var sp = useState(function () { try { return localStorage.getItem(SLOW_KEY) === "1"; } catch (e) { return false; } }), slow = sp[0], setSlow = sp[1];
    var discRef = useRef(null), baseRef = useRef(null), base2Ref = useRef(null), ringsRef = useRef(null), litRef = useRef(null), overRef = useRef(null), hitRef = useRef(null), markRef = useRef(null), kRef = useRef(null), vizColRef = useRef(null);
    var C = useRef({}).current; C.sel = sel; C.slow = slow; C.info = info;
    var hovR = useRouteHi(function (r) { if (r >= 0 && C.select) C.select({ type: "route", r: r }, true); }); C.hov = hovR;
    var themeCtx = G.useThemeContext ? G.useThemeContext() : { mode: "dark" }, dark = themeCtx.mode !== "light", mode = dark ? "dark" : "light";

    // ── .GUI parts: the figure's centre, one part per route, the selected node, the panel and its sections ──
    var partIds = useRef(null);
    var rec = function (seg, type, prov, rp, parent) { var id = rootId + "/" + seg; return { id: id, path: rootId + "." + seg, type: type, part: seg, parentId: parent || rootId, provenance: prov, spec: { type: type, props: rp, provenance: prov }, resolvedProps: rp }; };
    var SRC = "live kernel (this.me " + ME_VERSION + ", Web Worker) · GTFS-Madrid-Bench (generated)";
    var nodeRecord = function (path, label) { return rec("node", "AIDecides.Node", { semanticPath: path, source: SRC, note: label + ": " + path + ". Explain reads it from the worker kernel." }, { path: path, label: label }); };
    useEffect(function () {
      var store = nodeStore(); if (!store || !store.actions || !info) return;
      var recs = [rec("center", "AIDecides.Write", { semanticPath: "policy.factor", source: SRC, note: "The decided headway multiplier: the one write of a headway decision." }, { path: "policy.factor" })];
      info.routes.forEach(function (r, ri) { recs.push(rec("route-" + String(ri + 1).padStart(3, "0"), "AIDecides.Route", { semanticPath: "routes." + (ri + 1) + ".perHour", source: SRC,
        note: "Route " + (ri + 1) + " (route_id " + r.id + "): " + r.trips + " trips. perHour = sum of its trips' mean departures/hour." }, { route: ri + 1, route_id: r.id, trips: r.trips })); });
      recs.push(nodeRecord(pathOf(info, C.sel, null) || "policy.factor", labelOf(info, C.sel) || "policy.factor"));
      var pr = rec("panel", "AIDecides.Panel", { semanticPath: "policy.decision", source: SRC, note: "Decision, wave and explain panel: reads the same worker kernel as the figure." }, { sections: SECTIONS.map(function (x) { return x[0]; }) }); recs.push(pr);
      SECTIONS.forEach(function (x) { recs.push(rec("panel-" + x[0], "AIDecides.Panel.Section", { source: SRC, note: x[1] }, { section: x[1] }, pr.id)); });
      var old = partIds.current; partIds.current = recs.map(function (r) { return r.id; });
      if (old) old.forEach(function (id) { if (partIds.current.indexOf(id) < 0) store.actions.unregisterNode(id); });
      // 24 parts per frame: each registration copies the .GUI store and notifies it
      var i = 0, raf = 0, step = function () { raf = 0; for (var j = 0; j < 24 && i < recs.length; j++, i++) store.actions.registerNode(recs[i]); if (i < recs.length) raf = requestAnimationFrame(step); };
      step();
      return function () { if (raf) { cancelAnimationFrame(raf); for (; i < recs.length; i++) store.actions.registerNode(recs[i]); } };
    }, [rootId, info]);
    useEffect(function () { return function () { var store = nodeStore(); if (store && partIds.current) partIds.current.forEach(function (id) { store.actions.unregisterNode(id); }); }; }, []);
    var select = function (s, viaStore) {
      var store = nodeStore(); setSel(s); setLeaf(null); var p = pathOf(C.info, s, null);
      if (store && p) { store.actions.registerNode(nodeRecord(p, labelOf(C.info, s))); if (viaStore) store.actions.selectNode(s.type === "route" ? rootId + "/route-" + String(s.r + 1).padStart(3, "0") : s.type === "center" ? rootId + "/center" : nodeId); }
    };
    useEffect(function () {   // store → selection (clicks on parts, the Inspector's tree)
      var store = nodeStore(); if (!store) return; var last = null, pre = rootId + "/route-";
      var sync = function () { var id = store.getState().selectedNodeId; if (id === last) return; last = id;
        if (id && id.indexOf(pre) === 0) { var r = +id.slice(pre.length) - 1; setSel(function (s) { return s && s.type === "route" && s.r === r ? s : { type: "route", r: r }; }); }
        else if (id === rootId + "/center") setSel(function (s) { return s && s.type === "center" ? s : { type: "center" }; }); };
      sync(); return store.subscribe(sync);
    }, [rootId]);
    useEffect(function () { var store = nodeStore(); if (store && selPath) store.actions.registerNode(nodeRecord(selPath, labelOf(info, sel))); }, [selPath]);
    useEffect(function () { setSel(null); setLeaf(null); }, [info]);

    // ── the explain chain of the selected node (re-read after every wave) ──
    var cs = useState(null), chain = cs[0], setChain = cs[1];
    useEffect(function () { if (!selPath || !info) { setChain(null); return; } var alive = true;
      live.chain(selPath).then(function (c) { if (alive) setChain(c); }, function (e) { if (alive) setChain({ error: e.message }); }); return function () { alive = false; }; }, [selPath, lst.waveSeq, info]);

    // ── the canvas: base (structure + the kernel's current values), lit (the replayed wave), over (selection) ──
    useEffect(function () {
      var disc = discRef.current, base = baseRef.current, base2 = base2Ref.current, ringsCv = ringsRef.current, lit = litRef.current, over = overRef.current; if (!disc || !base || !geo || !S) return;
      var bctx = base.getContext("2d"), lctx = lit.getContext("2d"), octx = over.getContext("2d"), size = 0, dpr = 1, raf = 0, reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
      var col = dark ? { teal: "#26aa94", tealDim: "rgba(38,170,148,.38)", amber: "#f0b429", grey: "rgba(140,150,160,.32)", coral: "#ff7b5c", lit: "rgba(255,255,255,.95)", gold: "#ffd166", guide: "rgba(255,255,255,.28)", text: "rgba(230,237,243,.75)", sel: "#ffffff" }
        : { teal: "#046c5c", tealDim: "rgba(4,108,92,.30)", amber: "#c27c00", grey: "rgba(90,100,110,.28)", coral: "#e8553a", lit: "rgba(10,40,70,.9)", gold: "#b45309", guide: "rgba(0,0,0,.3)", text: "rgba(30,40,50,.75)", sel: "#111827" };
      var Rpx = 0, cx = 0, A = geo.ang;
      function ring(ctx, a0, a1, r0, r1) { ctx.moveTo(cx + Math.cos(a0) * r1 * Rpx, cx + Math.sin(a0) * r1 * Rpx); ctx.arc(cx, cx, r1 * Rpx, a0, a1); ctx.arc(cx, cx, r0 * Rpx, a1, a0, true); ctx.closePath(); }
      function tripArc(x) { var u0 = geo.uOf(x[3]); return [A(u0 + .15), A(u0 + x[4] - .15)]; }
      function routeArc(r) { return [A(geo.rStart[r]), A(geo.rEnd[r])]; }
      function tick(ctx, g, ph) { var a = A(geo.uOf(g) + .5), c = Math.cos(a), s = Math.sin(a), r1 = tipOf(ph); ctx.moveTo(cx + c * RAD.w0 * Rpx, cx + s * RAD.w0 * Rpx); ctx.lineTo(cx + c * r1 * Rpx, cx + s * r1 * Rpx); }
      var lw = function () { return Math.max(.6 * dpr, Math.min(3 * dpr, geo.slot * RAD.w0 * Rpx * .75)); };
      // rings (routes, trips, stop_times) are cached on their own canvas: redrawn only when what they show changes
      var rctx = ringsCv.getContext("2d");   // rings live on their own canvas under the ticks
      function drawRings() {
        var key = [base.width, mode, info.wins, S.live.join(""), S.routeAny.join("")].join("|"); if (C.ringsKey === key) return; C.ringsKey = key;
        var ctx = rctx; ctx.clearRect(0, 0, ringsCv.width, ringsCv.width);
        var pr = new Path2D(), pra = new Path2D(); for (var r = 0; r < geo.R; r++) { var ra = routeArc(r); ring(S.routeAny[r] ? pra : pr, ra[0], ra[1], RAD.r0, RAD.r1); }
        ctx.globalAlpha = .85; ctx.fillStyle = col.teal; ctx.fill(pr); ctx.fillStyle = col.amber; ctx.fill(pra); ctx.globalAlpha = 1;
        var pl = new Path2D(), pd = new Path2D(), sl = new Path2D(), sd = new Path2D();
        info.trips.forEach(function (x, g) { var ta = tripArc(x), on = S.live[g]; ring(on ? pl : pd, ta[0], ta[1], RAD.t0, RAD.t1); if (x[6]) ring(on ? sl : sd, ta[0], ta[1], RAD.s0, RAD.s1); });
        ctx.fillStyle = col.tealDim; ctx.fill(pl); ctx.fill(sl); ctx.fillStyle = col.grey; ctx.fill(pd); ctx.fill(sd);
      }
      // the base is composed off screen in short steps (one per frame: rings, ticks in halves, the rest) and shown at
      // the end, so a wave's arrival never costs one long frame, even at scale 10 (8,550 ticks, 1,300 trips)
      // two tick canvases: the next one is drawn hidden, in steps, then shown in place of the other (no copy, no long frame)
      var job = 0;
      function ticks(ctx, from, to) { var pn = new Path2D(), pt = new Path2D(), px = new Path2D();
        for (var g = from; g < to; g++) tick(!S.live[geo.winTrip[g]] ? px : S.tight[g] ? pt : pn, g, S.perHour[g]);
        ctx.lineWidth = lw(); ctx.lineCap = "butt"; ctx.strokeStyle = col.teal; ctx.stroke(pn); ctx.strokeStyle = col.amber; ctx.stroke(pt); ctx.strokeStyle = col.grey; ctx.stroke(px); }
      function finish(ctx) {
        // the floor: a tick that crosses this ring is a window below policy.minHeadway
        var fr = tipOf(3600 / info.floor) * Rpx; ctx.beginPath(); ctx.setLineDash([3 * dpr, 4 * dpr]); ctx.strokeStyle = col.guide; ctx.lineWidth = dpr; ctx.arc(cx, cx, fr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        
        // centre: the write
        ctx.beginPath(); ctx.fillStyle = col.coral; ctx.arc(cx, cx, RAD.center * Rpx, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "600 " + Math.round(Math.max(9 * dpr, RAD.center * Rpx * .5)) + "px " + MONO; ctx.fillText("×" + Number(S.factor).toFixed(2), cx, cx); ctx.textBaseline = "alphabetic";
        // the last wave's tight flips: a gold dot past the tick's tip
        if (Wv && Wv.chWin) { var pg = new Path2D(), rr = Math.max(1.3 * dpr, Math.min(2.6 * dpr, geo.slot * RAD.wMax * Rpx * .45));
          for (var q = 0; q < geo.W; q++) if (Wv.chWin[q] & 2) { var a = A(geo.uOf(q) + .5), t = tipOf(S.perHour[q]) * Rpx + 3.5 * dpr, x0 = cx + Math.cos(a) * t, y0 = cx + Math.sin(a) * t; pg.moveTo(x0 + rr, y0); pg.arc(x0, y0, rr, 0, Math.PI * 2); }
          ctx.fillStyle = col.gold; ctx.fill(pg); }
        // the floor's label last, on its plate, above the ticks and dots
        ctx.font = Math.round(10.5 * dpr) + "px " + MONO; ctx.textAlign = "left"; var lx = cx + fr * .71 + 5 * dpr, ly = cx - fr * .71 - 3 * dpr, lab = info.floor + " s minimum", tw = ctx.measureText(lab).width;
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor || (dark ? "#0d1117" : "#fff"); ctx.globalAlpha = .85; ctx.fillRect(lx - 3 * dpr, ly - 11 * dpr, tw + 6 * dpr, 15 * dpr); ctx.globalAlpha = 1;   // a plate: readable over dense ticks
        ctx.fillStyle = col.text; ctx.fillText(lab, lx, ly);
      }
      function drawBase(sync) {
        var id = ++job, W = base.width, half = geo.W >> 1, t0 = performance.now(), front = C.front || base, back = front === base ? base2 : base, bc = back.getContext("2d");
        var steps = [function () { var t1 = performance.now(); drawRings(); PERF.ringsMs = performance.now() - t1; bc.clearRect(0, 0, W, W); },
          function () { ticks(bc, 0, half); }, function () { ticks(bc, half, geo.W); },
          function () { finish(bc); back.style.visibility = ""; front.style.visibility = "hidden"; C.front = back; PERF.drawMs = performance.now() - t0; }];
        if (sync || geo.W < 2000) { steps.forEach(function (f) { f(); }); return; }
        var i = 0, run = function () { if (id !== job) return; var ts = performance.now(); do { steps[i++](); } while (i < steps.length && performance.now() - ts < 8); if (i < steps.length) C.baseRaf = requestAnimationFrame(run); };
        run();
      }
      function drawOver() {
        var ctx = octx; ctx.clearRect(0, 0, over.width, over.width); var s = C.sel; if (!C.info) return;
        if (C.hov >= 0 && C.hov < info.routes.length) { var hr = routeArc(C.hov), hc = "hsl(" + HUES[C.hov % HUES.length] + " 70% 52%)", hm = (hr[0] + hr[1]) / 2, hx = cx + Math.cos(hm) * (RAD.r0 + RAD.r1) / 2 * Rpx, hy = cx + Math.sin(hm) * (RAD.r0 + RAD.r1) / 2 * Rpx;
          ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = hc; ctx.beginPath(); ring(ctx, hr[0], hr[1], RAD.r0, RAD.r1); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = hc; ctx.lineWidth = 2.5 * dpr; ctx.beginPath(); ring(ctx, hr[0], hr[1], RAD.r0 - .012, RAD.r1 + .012); ctx.stroke();
          ctx.font = "700 " + Math.round(12 * dpr) + "px ui-monospace,SFMono-Regular,Menlo,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; var lbl = "Route " + (C.hov + 1), tw = ctx.measureText(lbl).width + 10 * dpr;
          ctx.fillStyle = "rgba(13,17,23,.85)"; ctx.fillRect(hx - tw / 2, hy - 10 * dpr, tw, 20 * dpr); ctx.fillStyle = "#fff"; ctx.fillText(lbl, hx, hy); ctx.restore(); }
        if (!s) return;
        ctx.strokeStyle = col.sel; ctx.lineWidth = 1.6 * dpr; ctx.beginPath();
        if (s.type === "center") ctx.arc(cx, cx, (RAD.center + .02) * Rpx, 0, Math.PI * 2);
        else if (s.type === "route") { var ra = routeArc(s.r); ring(ctx, ra[0], ra[1], RAD.r0 - .008, RAD.r1 + .008); }
        else if (s.type === "trip") { var ta = tripArc(info.trips[s.trip]); ring(ctx, ta[0], ta[1], RAD.t0 - .008, RAD.t1 + .008); }
        else if (s.type === "win") { var a = A(geo.uOf(s.win) + .5), r1 = tipOf(S.perHour[s.win]); ctx.moveTo(cx + Math.cos(a) * (RAD.w0 - .01) * Rpx, cx + Math.sin(a) * (RAD.w0 - .01) * Rpx); ctx.lineTo(cx + Math.cos(a) * (r1 + .01) * Rpx, cx + Math.sin(a) * (r1 + .01) * Rpx);
          ctx.stroke(); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r1 + .03) * Rpx, cx + Math.sin(a) * (r1 + .03) * Rpx, 4 * dpr, 0, Math.PI * 2); }
        else if (s.type === "stop") { var x = info.trips[s.trip], u0 = geo.uOf(x[3]), a0 = A(u0 + (s.stop - 1) / x[6] * x[4]), a1 = A(u0 + s.stop / x[6] * x[4]); ring(ctx, a0, Math.max(a1, a0 + .004), RAD.s0 - .01, RAD.s1 + .01); }
        ctx.stroke();
      }
      // ── the replay: the wave's real recompute order (codes type·2^26 + index), paced over the measured write ──
      var order = Wv && Wv.order, E = order ? order.length : 0, P = 0, t0 = 0;
      var tripOfStop = function (gi) { var lo = 0, hi = info.trips.length - 1; while (lo < hi) { var m = (lo + hi + 1) >> 1; if (info.trips[m][5] <= gi) lo = m; else hi = m - 1; } return lo; };
      function drawEvents(from, to) {
        var pw = new Path2D(), pa = new Path2D();
        for (var i = from; i < to; i++) { var c = order[i], ty = Math.floor(c / 67108864), gi = c % 67108864;
          if (ty === 3) tick(pw, gi, S.perHour[gi]);
          else if (ty === 2) { var ta = tripArc(info.trips[gi]); ring(pa, ta[0], ta[1], RAD.t1 - .035, RAD.t1); }
          else if (ty === 1) { var ra = routeArc(gi); ring(pa, ra[0], ra[1], RAD.r1 - .035, RAD.r1); }
          else if (ty === 4) { var x = info.trips[tripOfStop(gi)], j = gi - x[5], u0 = geo.uOf(x[3]); ring(pa, A(u0 + j / x[6] * x[4]), A(u0 + (j + 1) / x[6] * x[4]), RAD.s0, RAD.s1); }
          else if (ty === 0) { pa.moveTo(cx + (RAD.center + .035) * Rpx, cx); pa.arc(cx, cx, (RAD.center + .035) * Rpx, 0, Math.PI * 2); pa.arc(cx, cx, (RAD.center + .015) * Rpx, Math.PI * 2, 0, true); }
        }
        lctx.lineWidth = lw(); lctx.strokeStyle = col.lit; lctx.fillStyle = col.lit; lctx.stroke(pw); lctx.fill(pa);
        if (kRef.current) kRef.current.textContent = "k = " + fmt(to) + " / " + fmt(E);
      }
      var still = function () { return !!(reduce && reduce.matches); };
      var fadeT = 0; function fade() { clearTimeout(fadeT); fadeT = setTimeout(function () { lit.style.opacity = "0"; }, still() ? 0 : 600); }
      function loop(ts) {
        raf = 0; if (!t0) t0 = ts; var dur = Math.max(1, Wv.writeMs) * (C.slow ? 10 : 1), nP = Math.min(E, Math.floor((ts - t0) / dur * E));
        if (nP > P) { drawEvents(P, nP); P = nP; }
        if (P < E) raf = requestAnimationFrame(loop); else fade();
      }
      function replay() { if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(fadeT); lctx.clearRect(0, 0, lit.width, lit.height); lit.style.transition = "none"; lit.style.opacity = "1"; void lit.offsetWidth; lit.style.transition = "";
        P = 0; t0 = 0; if (!E) { if (kRef.current) kRef.current.textContent = Wv ? "k = 0 (nothing recomputed)" : "k = –"; return; }
        if (still()) { drawEvents(0, E); P = E; fade(); return; } raf = requestAnimationFrame(loop); }
      C.replay = replay;
      function layout() {
        var host = vizColRef.current || disc, w = Math.max(200, Math.floor(Math.min(560, host.clientWidth)));
        var d = Math.min(2, window.devicePixelRatio || 1); if (w === size && d === dpr) return false; size = w; dpr = d;
        C.ringsKey = null; [ringsCv, base, base2, lit, over].forEach(function (cv) { cv.width = cv.height = Math.round(w * d); cv.style.width = cv.style.height = w + "px"; }); disc.style.width = disc.style.height = w + "px";
        Rpx = w * d / 2 * .97; cx = w * d / 2; return true;
      }
      // drawn in the next frame, so a wave's arrival splits into two short tasks (React's panel, then the canvas)
      var first = requestAnimationFrame(function () { first = 0;
        var tb = performance.now(); layout(); PERF.layoutMs = performance.now() - tb; drawBase(); drawOver(); C.drawOver = drawOver;
        if (Wv && C.lastWave !== lst.waveSeq) { C.lastWave = lst.waveSeq; replay(); } else if (kRef.current) kRef.current.textContent = Wv ? "k = " + fmt(E) + " / " + fmt(E) : "k = –"; });
      var rto = 0, ro = window.ResizeObserver ? new ResizeObserver(function () { clearTimeout(rto); rto = setTimeout(function () { if (layout()) { drawBase(true); drawOver(); lctx.clearRect(0, 0, lit.width, lit.height); if (P) drawEvents(0, P); } }, 100); }) : null;
      if (ro) ro.observe(vizColRef.current || disc);
      // pointer → element (angle + ring); the marker follows the pointer onto it, so a click (ours or the Inspector's) lands on the node part
      var locateP = function (e) { var b = disc.getBoundingClientRect(), half = b.width / 2, dx = e.clientX - b.left - half, dy = e.clientY - b.top - half, rad = Math.hypot(dx, dy) / (half * .97);
        var th = Math.atan2(dy, dx) + Math.PI / 2; th = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return geo.hit(th, rad, S.perHour); };
      var arm = function (e) { var m = markRef.current, t = locateP(e); if (!m) return t;
        if (!t || t.type === "route" || t.type === "center") { m.removeAttribute("data-armed"); disc.style.cursor = t ? "pointer" : ""; return t; }
        var b = disc.getBoundingClientRect(), half = b.width / 2; m.setAttribute("cx", ((e.clientX - b.left - half) / half).toFixed(4)); m.setAttribute("cy", ((e.clientY - b.top - half) / half).toFixed(4)); m.setAttribute("data-armed", ""); disc.style.cursor = "pointer"; return t; };
      var onMove = function (e) { if (e.pointerType === "mouse") arm(e); };
      var onDown = function (e) { var t = arm(e); if (t) { C.pending = t; select(t, e.pointerType !== "mouse"); } };
      disc.addEventListener("pointermove", onMove); disc.addEventListener("pointerdown", onDown);
      return function () { job++; if (C.baseRaf) cancelAnimationFrame(C.baseRaf); if (first) cancelAnimationFrame(first); disc.removeEventListener("pointermove", onMove); disc.removeEventListener("pointerdown", onDown); if (raf) cancelAnimationFrame(raf); clearTimeout(fadeT); clearTimeout(rto); if (ro) ro.disconnect(); C.replay = null; C.drawOver = null; };
    }, [geo, S, Wv, mode]);
    useEffect(function () { C.ringsKey = null; }, [geo]);
    C.select = select;
    useEffect(function () { if (C.drawOver) C.drawOver(); }, [sel, hovR]);
    var onHit = function (e) {   // clicks on the SVG parts (the node marker, a route wedge, the centre) select that part
      var g = e.target && e.target.closest && e.target.closest("[data-gui-node-id]"); if (!g || !hitRef.current || !hitRef.current.contains(g)) return;
      var store = nodeStore(), id = g.getAttribute("data-gui-node-id"); if (store) store.actions.selectNode(id);
    };
    var onKey = function (e) {   // arrows step through windows (or routes / trips, when one is selected); Escape clears
      if (!info || !geo) return; var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (e.key === "Escape") { setSel(null); return; } if (!d) return; e.preventDefault(); var s = sel || { type: "win", win: -1 };
      if (s.type === "route" || s.type === "center") { select({ type: "route", r: ((s.type === "center" ? -1 : s.r) + d + geo.R) % geo.R }, true); return; }
      if (s.type === "trip") { var t = (s.trip + d + info.trips.length) % info.trips.length; select({ type: "trip", r: info.trips[t][0], trip: t }, true); return; }
      var g = ((s.type === "win" ? s.win : info.trips[s.trip][3]) + d + geo.W) % geo.W; select({ type: "win", r: geo.winRoute[g], trip: geo.winTrip[g], win: g }, true);
    };
    var wedges = useMemo(function () {
      if (!geo) return null; var P2 = function (r, a) { return (r * Math.cos(a)).toFixed(4) + " " + (r * Math.sin(a)).toFixed(4); };
      return info.routes.map(function (r, ri) { var a0 = geo.ang(geo.rStart[ri]), a1 = geo.ang(geo.rEnd[ri]), r0 = RAD.r0 * .97, r1 = RAD.s1 * .97, big = a1 - a0 > Math.PI ? 1 : 0;
        return "M" + P2(r0, a0) + "L" + P2(r1, a0) + "A" + r1 + " " + r1 + " 0 " + big + " 1 " + P2(r1, a1) + "L" + P2(r0, a1) + "A" + r0 + " " + r0 + " 0 " + big + " 0 " + P2(r0, a0) + "Z"; });
    }, [geo]);
    var hitLayer = !geo ? null : h("svg", { className: "aid-hit", ref: hitRef, viewBox: "-1 -1 2 2", "aria-hidden": "true", onClick: onHit },
      wedges.map(function (d, ri) { return h("g", { key: ri, "data-gui-node-id": rootId + "/route-" + String(ri + 1).padStart(3, "0"), "data-gui-component": "AIDecides.Route", className: sel && sel.type === "route" && sel.r === ri ? "on" : undefined }, h("path", { d: d, vectorEffect: "non-scaling-stroke" })); }),
      h("g", { "data-gui-node-id": rootId + "/center", "data-gui-component": "AIDecides.Write", className: sel && sel.type === "center" ? "on" : undefined }, h("circle", { cx: 0, cy: 0, r: RAD.center * .97 + .012, vectorEffect: "non-scaling-stroke" })),
      h("g", { "data-gui-node-id": nodeId, "data-gui-component": "AIDecides.Node" }, h("circle", { ref: markRef, className: "aid-mark", cx: 0, cy: 0, r: .025, vectorEffect: "non-scaling-stroke" })));

    // ── panel (.GUI Buttons / Chip / Tooltip; collapsible sections; state in localStorage) ──
    var pv = useState(loadPanel), panel = pv[0], setPanel = pv[1];
    var updPanel = function (fn) { setPanel(function (p) { var n = { open: p.open, sec: Object.assign({}, p.sec) }; fn(n); try { localStorage.setItem(PANEL_KEY, JSON.stringify(n)); } catch (e) {} return n; }); };
    var uid = useRef("aid" + Math.random().toString(36).slice(2, 7)).current, GA = G.Atoms || {};
    var Btn = function (o, text) { var active = !!o.active, p = Object.assign({ type: "button", "data-gui-inspector-control": "true" }, o); delete p.active;
      if (GA.Button) return h(GA.Button, Object.assign(p, { variant: active ? "contained" : "outlined", size: "small", color: active ? "primary" : "inherit", disableElevation: true,
        sx: { textTransform: "none", minHeight: 30, py: .25, px: 1.25, borderRadius: "8px", fontSize: 13, lineHeight: 1.2, borderColor: active ? undefined : "divider" } }), text);
      return h("button", Object.assign(p, { className: "aid-ibtn", style: { width: "auto", padding: "4px 10px", border: "1px solid" } }), text); };
    var row = function (label, v, k) { return h("div", { key: k, className: "aid-row" }, h("span", null, label), h("span", { className: "aid-num" }, v)); };
    var section = function (key, title, summary, body) { var open = panel.sec[key], bid = uid + "-" + key;
      return h("section", { className: "aid-sec", key: key, "data-gui-node-id": rootId + "/panel-" + key, "data-gui-component": "AIDecides.Panel.Section", "data-aid-sec": key },
        h("button", { type: "button", className: "aid-shead", "aria-expanded": open ? "true" : "false", "aria-controls": bid, "data-gui-inspector-control": "true", onClick: function () { updPanel(function (p) { p.sec[key] = !p.sec[key]; }); } },
          h("span", null, title), summary ? h("small", null, summary) : null, h("span", { className: "aid-chev" + (open ? " up" : "") }, ICON.chev)),
        open ? h("div", { className: "aid-sbody", id: bid }, body) : null); };
    var busy = lst.phase === "building" || lst.phase === "writing", ready = lst.phase === "ready";
    var P = lst.proposal, scen = lst.scenario;
    var status = lst.phase === "building" ? h("div", { className: "aid-note", role: "status" }, h("span", { className: "aid-busy", "aria-hidden": "true" }), "Building the kernel (scale " + lst.target + ") in the worker… " + Math.round(lst.progress * 100) + "%")
      : lst.phase === "writing" ? h("div", { className: "aid-note", role: "status" }, h("span", { className: "aid-busy", "aria-hidden": "true" }), (lst.busyLabel || "Writing") + "… (in the worker; the page stays responsive)")
      : lst.phase === "error" ? h("div", { className: "aid-note aid-warn", role: "status" }, "Kernel unavailable: " + lst.error) : null;
    var undoBtn = Btn({ "data-aid": "undo", disabled: !ready || !lst.undoable, title: lst.undoable ? "Undo decision #" + lst.undoable + ": a new decision that writes the previous value" : "Nothing to undo", onClick: function () { live.undo().catch(function () {}); } }, lst.undoable ? "Undo #" + lst.undoable : "Undo");
    var decisionBody = [
      h("div", { key: "q", className: "aid-note", style: { marginTop: 0 } }, "Use “Apply: buses 10% more often” above, or the same decision here. The policy proposes it with its reason; Apply stores it in the kernel and makes one write.",
        Info("The decider is a plain, versioned function (policy:fair-headway@1 in ai-model.js), not a language model. Same scenario + same data = the same proposal and the same inputs hash. It uses one factor for every line (fair) and the largest cut, in 1% steps, that keeps the share of frequency windows below the 165 s minimum within the scenario's limit (safe). The feed has no demand data, so a scenario is what you ask for, not a prediction.", "About the decider")),
      h("div", { key: "s", className: "aid-ctl", role: "group", "aria-label": "Scenario", style: { marginTop: 8 } }, SCEN.slice(0, 1).map(function (x) { return h(React.Fragment, { key: x[0] }, Btn({ "data-aid": "scen-" + x[0], "aria-pressed": scen === x[0] ? "true" : "false", active: scen === x[0], disabled: !info, onClick: function () { live.propose(x[0]).catch(function () {}); } }, x[1])); })),
      h("details", { key: "o", className: "aid-other", "data-aid": "other-scen", open: !!(scen && scen !== "ten") || undefined }, h("summary", null, "Other scenarios (not the 10% question)"),
        h("div", { className: "aid-ctl", role: "group", "aria-label": "Other scenarios", style: { marginTop: 6 } }, SCEN.slice(1).map(function (x) { return h(React.Fragment, { key: x[0] }, Btn({ "data-aid": "scen-" + x[0], "aria-pressed": scen === x[0] ? "true" : "false", active: scen === x[0], disabled: !info, onClick: function () { live.propose(x[0]).catch(function () {}); } }, x[1])); }))),
      P && scen === P.scenario && P.noop ? h("div", { key: "pn", className: "aid-note", "data-aid": "proposal-noop" }, "Already applied: policy.factor = " + P.factor + " (" + P.scenarioLabel + ").", h("div", { className: "aid-ctl", style: { marginTop: 6 } }, undoBtn)) :
      P && scen === P.scenario ? h("div", { key: "p", className: "aid-card", "data-aid": "proposal" },
        h("h4", null, "Proposal · would be decision #" + ((lst.decisions.length || 0) + 1)),
        row("by", h("span", { className: "aid-mono" }, P.by), "by"), h("div", { key: "ask", className: "aid-note", style: { marginTop: 0 } }, "Asked: " + P.ask),
        row("write", h("span", { className: "aid-mono" }, "policy.factor " + P.from + " → " + P.factor), "w"),
        h("div", { key: "r", className: "aid-reason", "data-aid": "reason" }, P.reason),
        row(h("span", null, "inputs hash", Info("FNV-1a over the policy version, the scenario, the 165 s minimum, the limits and the headways it read (count and sum). Stored with the decision: the same inputs must give the same hash.", "About the inputs hash")), h("span", { className: "aid-mono" }, P.inputsHash), "h"),
        P.noop ? h("div", { className: "aid-note" }, "policy.factor is already " + P.factor + ": nothing to write.") : null,
        h("div", { className: "aid-ctl", style: { marginTop: 8 } }, Btn({ "data-aid": "apply", active: true, disabled: !ready || P.noop, onClick: function () { live.apply(P.scenario).catch(function () {}); } }, "Apply"), undoBtn))
        : h("div", { key: "p0", className: "aid-ctl", style: { marginTop: 8 } }, undoBtn),
      h("div", { key: "st" }, status)];
    var svcSel = useState(""), svc = svcSel[0], setSvc = svcSel[1];
    var svcList = ((info && info.services) || []).map(function (s, i) { return { n: i + 1, id: s.id, trips: s.trips, days: s.days, on: S ? S.enabled[i] === 1 : true }; }).filter(function (s) { return s.trips > 0; });
    var cur = svcList.filter(function (s) { return String(s.n) === svc; })[0] || svcList[0];
    var serviceBody = !info ? h("div", { className: "aid-note" }, "Waiting for the kernel…") : [
      h("div", { key: "n", className: "aid-note", style: { marginTop: 0 } }, "A manual decision, recorded like the policy's: services.<s>.enabled (a switch we add) goes 1 → 0, so its trips stop; trip.live, their stop_times (served) and the departures/hour above them recompute."),
      h("div", { key: "c", className: "aid-ctl", style: { marginTop: 8, alignItems: "center" } },
        h("label", { htmlFor: uid + "-svc", className: "aid-note", style: { margin: 0 } }, "Service"),
        h("select", { id: uid + "-svc", className: "aid-sel", "data-aid": "svc", "data-gui-inspector-control": "true", value: cur ? String(cur.n) : "", onChange: function (e) { setSvc(e.target.value); } },
          svcList.map(function (s) { return h("option", { key: s.n, value: String(s.n) }, "service " + s.n + " · " + s.trips + " trips" + (s.on ? "" : " · suspended")); })),
        cur ? Btn({ "data-aid": "svc-toggle", disabled: !ready, onClick: function () { live.service(cur.n, !cur.on).catch(function () {}); } }, cur.on ? "Suspend" : "Resume") : null),
      cur ? h("div", { key: "d", className: "aid-note" }, "service_id ", h("span", { className: "aid-mono" }, cur.id), " · days ", h("span", { className: "aid-mono" }, cur.days),
        Info("Day flags as in CALENDAR (Mon…Sun). In this generated feed every service runs either every day or no day, and calendar_dates only uses exception_type 0, so the demo does not gate on the calendar: the switch is ours.", "About the calendar")) : null];
    var cut = Wv && Wv.cutoff, counts = info && info.counts, lastD = (lst.decisions || [])[lst.decisions.length - 1] || {};
    var waveBody = !Wv ? h("div", { className: "aid-note" }, "No decision applied yet. Use “Apply: buses 10% more often” above.") : [
      row("decision", "#" + Wv.n + " · " + (lastD.scenarioLabel || ""), "n"),
      row("write", h("span", { className: "aid-mono" }, Wv.write + " " + Wv.from + " → " + Wv.to), "w"),
      row(h("span", null, "k recomputed", Info("Every derived value this write recomputed: explain().meta.k of the wave (the length of meta.recomputed).", "About k")), h("span", { "data-aid": "wave-k" }, fmt(Wv.k)), "k"),
      row("changed", fmt(Wv.changed), "c"),
      row(h("span", null, "write took", Info("Measured in the worker around the one write (performance.now). The kernel recomputes eagerly inside the write.", "About the timing")), h("span", { "data-aid": "wave-ms" }, ms(Wv.writeMs)), "ms"),
      row("reading the wave · values", ms(Wv.analysisMs) + " · " + ms(Wv.readMs), "rd"),
      Wv.k ? h("div", { key: "cut", className: "aid-card", "data-aid": "cutoff" }, h("h4", null, "Early cutoff", Info("A value whose inputs did not change is not recomputed, and a recomputed value that comes out equal stops the wave there. tight = headway < 165 s minimum recomputes for every window but only flips where the headway crosses the 165 s minimum; a route's anyTight only recomputes behind a flip.", "About early cutoff")),
        cut.tightRec ? row("tight recomputed · flipped", fmt(cut.tightRec) + " · " + fmt(cut.tightFlip), "t") : null,
        cut.tightRec ? row("route anyTight recomputed · changed", fmt(cut.anyRec) + " · " + fmt(cut.anyFlip), "a") : null,
        cut.tightRec ? row("anyTight not recomputed (no flip)", fmt(geo ? geo.R - cut.anyRec : 0), "as") : null,
        cut.liveRec ? row("trip.live recomputed", fmt(cut.liveRec), "l") : null,
        row("stop_times recomputed", fmt(cut.servedRec) + " of " + fmt(info.stops), "s"),
        cut.servedRec === 0 ? h("div", { key: "sn", className: "aid-note" }, "None of the " + fmt(info.stops) + " stop_times reads the headway: this write never reaches them.") : null)
        : h("div", { key: "nk", className: "aid-note" }, "The write did not change the value, so nothing recomputed."),
      row("city departures/hour", fmt(Wv.city[0], 1) + " → " + fmt(Wv.city[1], 1), "city"),
      h("div", { key: "rp", className: "aid-ctl", style: { marginTop: 8 } }, Btn({ "data-aid": "replay", onClick: function () { if (C.replay) C.replay(); } }, "Replay"),
        Btn({ "data-aid": "slow", active: slow, "aria-pressed": slow ? "true" : "false", onClick: function () { var n = !slow; setSlow(n); try { localStorage.setItem(SLOW_KEY, n ? "1" : "0"); } catch (e) {} } }, "×10 slower"))];
    var sr = useState(false), showAll = sr[0], setShowAll = sr[1];
    var routesSorted = Wv ? Wv.routes.slice().sort(function (a, b) { return a.r - b.r; }) : [];
    var routesBody = !Wv ? h("div", { className: "aid-note" }, "Nothing changed yet.") : !routesSorted.length ? h("div", { className: "aid-note" }, "No route changed in this wave.") : [
      h("div", { key: "h", className: "aid-note", style: { marginTop: 0 } }, fmt(routesSorted.length) + " of " + fmt(info.routes.length) + " routes changed. Mean headway and departures/hour, before → after (read from the kernel)."),
      h("ul", { key: "l", className: "aid-rlist", "data-aid": "routes" }, (showAll ? routesSorted : routesSorted.slice(0, 8)).map(function (x) {
        var on = sel && sel.type === "route" && sel.r === x.r, go = function () { select({ type: "route", r: x.r }, true); };
        return h("li", { key: x.r, tabIndex: 0, role: "button", "aria-pressed": on ? "true" : "false", "data-gui-inspector-control": "true", title: "route_id " + x.id, onClick: go, onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } },
          h("span", null, h("b", null, "Route " + (x.r + 1)), " ", Math.round(x.headway[0]) + " → " + Math.round(x.headway[1]) + " s"),
          h("span", { className: "aid-num" }, fmt(x.perHour[0], 1) + " → " + fmt(x.perHour[1], 1) + "/h"),
          h("small", null, [x.flips ? x.flips + " windows crossed the 165 s minimum" : null, x.trips ? x.trips + " trips recomputed" : null, x.stops ? fmt(x.stops) + " stop_times" : null, x.notLive ? x.notLive + "/" + x.tripsTotal + " trips not running" : null, x.anyTight[0] !== x.anyTight[1] ? "anyTight " + !!x.anyTight[0] + " → " + !!x.anyTight[1] : null].filter(Boolean).join(" · ") || "values changed")); })),
      routesSorted.length > 8 ? h("div", { key: "m", style: { marginTop: 6 } }, Btn({ "data-aid": "routes-more", onClick: function () { setShowAll(!showAll); } }, showAll ? "Show fewer" : "Show all " + routesSorted.length)) : null];
    var c = chain, leaves = sel ? LEAVES[sel.type] : [];
    var explainInInspector = function () { var store = nodeStore(); if (!store || !selPath) return; store.actions.registerNode(nodeRecord(selPath, labelOf(info, sel))); store.actions.setInspectorEnabled(true); store.actions.selectNode(nodeId);
      var tries = 0, t = setInterval(function () { var aside = document.querySelector('aside[data-gui-inspector-control="true"]'), b = aside && [].find.call(aside.querySelectorAll("button"), function (x) { return /^explain$/i.test(x.textContent.trim()); }); if (b) { clearInterval(t); b.click(); } else if (++tries > 30) clearInterval(t); }, 100); };
    var chainBody = !sel ? h("div", { className: "aid-note" }, "Click anything on the figure (the centre, a route, a trip, a window's tick, a stop_time) or a route in the list. Arrow keys step through the windows.")
      : [h("div", { key: "n", className: "aid-row" }, h("b", { "data-aid": "sel-label" }, labelOf(info, sel))),
        leaves.length ? h("div", { key: "lv", className: "aid-ctl", role: "group", "aria-label": "Value", style: { margin: "4px 0" } }, leaves.map(function (l) { var on = (leaf || leaves[0]) === l; return h(React.Fragment, { key: l }, Btn({ active: on, "aria-pressed": on ? "true" : "false", "data-aid": "leaf-" + l, onClick: function () { setLeaf(l); } }, l)); })) : null,
        h("div", { key: "p", className: "aid-mono", style: { wordBreak: "break-all" }, "data-aid": "sel-path" }, selPath),
        !c ? h("div", { key: "w", className: "aid-note" }, "Reading…") : c.error ? h("div", { key: "e", className: "aid-note aid-warn" }, c.error) : h("ol", { key: "ch", className: "aid-chain", "data-aid": "chain" },
          h("li", null, h("b", null, "Decision"), c.decision ? h(React.Fragment, null, "#" + c.decision.n + " · ", h("span", { className: "aid-mono" }, c.decision.by), " · " + String(c.decision.at).replace("T", " ").slice(0, 19) + " UTC",
              h("div", { className: "aid-note" }, c.decision.reason), h("div", { className: "aid-note aid-mono" }, "decisions." + c.decision.n + ".inputsHash = " + c.decision.inputsHash))
            : h("span", { className: "aid-note" }, c.isFact ? " none: a fact (from the feed, or a parameter at its initial value)." : " none yet: not recomputed since the kernel was built.")),
          h("li", null, h("b", null, "Write"), c.decision ? h("span", { className: "aid-mono" }, c.decision.write + ": " + c.decision.from + " → " + c.decision.to) : h("span", { className: "aid-note" }, c.write ? c.write.path : "–"),
            c.write && !c.isFact ? h("div", { className: "aid-note" }, "explain().meta.sourcePath = ", h("span", { className: "aid-mono" }, c.write.path)) : null),
          h("li", null, h("b", null, "Wave"), c.wave ? "k = " + fmt(c.wave.k) + " recomputed · " + fmt(c.wave.changed) + " changed" + (c.decision ? " · " + ms(c.decision.outcome.ms) : "") : h("span", { className: "aid-note" }, c.isFact ? "Facts are not recomputed." : "–")),
          h("li", null, h("b", null, "Change"), h("span", { className: "aid-mono", "data-aid": "chain-change" }, c.change && c.change.before !== undefined && c.decision ? val(c.change.before) + " → " + val(c.value) : val(c.value)),
            c.change && c.change.changedInThatWave === false && !c.isFact && c.decision ? h("div", { className: "aid-note" }, "Recomputed in that wave to the same value: the wave stops here.") : null,
            c.expr ? h("div", { className: "aid-note" }, h("span", { className: "aid-mono", style: { wordBreak: "break-all" } }, String(c.expr).length > 140 ? String(c.expr).slice(0, 140) + "…" : String(c.expr)), c.inputsTotal ? " · reads " + c.inputsTotal + " value" + (c.inputsTotal > 1 ? "s" : "") : "") : null)),
        h("div", { key: "b", className: "aid-ctl", style: { marginTop: 4 } }, Btn({ "data-aid": "explain", onClick: explainInInspector, title: "Open the .GUI Inspector on " + selPath + " and run explain() in the worker" }, "Explain in Inspector"))];
    var hist = (lst.decisions || []).slice().reverse();
    var historyBody = !hist.length ? h("div", { className: "aid-note" }, "No decisions yet. Each one is stored as facts under decisions.<n> in the kernel.") : h("ul", { className: "aid-hist", "data-aid": "history" }, hist.map(function (d) {
      return h("li", { key: d.n }, h("b", null, "#" + d.n + " " + d.scenarioLabel), " · ", h("span", { className: "aid-mono" }, d.by), h("div", { className: "aid-mono" }, d.write + " " + d.from + " → " + d.to + " · k " + fmt(d.k) + " · " + ms(d.ms) + " · hash " + d.inputsHash)); }));
    var pick = function (s) { if (busy || (lst.scale === s && lst.phase !== "error")) return; setSel(null); live.build(s).catch(function () {}); };
    var modelBody = !info ? h("div", { className: "aid-note" }, "Waiting for the kernel…") : [
      h("div", { key: "f", className: "aid-formula" }, ["win.headway   = base * policy.factor", "win.perHour   = 3600 / headway", "win.tight     = headway < policy.minHeadway", "trip.live     = services[s].enabled == 1", "st[j].served  = trip.live",
        "trip.perHour  = (win[1].perHour + … + win[n].perHour) / n", "                * services[s].enabled", "route.perHour = trip 1 + … + trip n  (explicit sum)", "route.anyTight = win.tight || …", "city.perHour  = route 1 + … + route R"].join("\n")),
      h("div", { key: "d", className: "aid-note" }, h("span", { className: "aid-tag gen", style: { marginLeft: 0 } }, "generated data"), "GTFS-Madrid-Bench scale " + info.scale + ": " + fmt(counts.routes) + " routes, " + fmt(counts.trips) + " trips, " + fmt(counts.frequencies) + " frequency windows, " + fmt(counts.stop_times) + " stop_times, " + fmt(counts.calendar) + " services. ",
        "From the feed: headway_secs, trips, stop_times, day flags · Set by this run: policy.factor, policy.minHeadway = " + info.floor + " s, services[s].enabled. No fares, capacity or demand (not in the feed)."),
      row("derived values", fmt(info.derived), "dv"), row("built in (worker)", ms(info.buildMs), "b"),
      h("div", { key: "sc", className: "aid-ctl", role: "group", "aria-label": "Data scale", style: { marginTop: 8 } },
        Btn({ "data-aid": "scale-1", active: lst.target === 1, "aria-pressed": lst.target === 1 ? "true" : "false", disabled: busy, onClick: function () { pick(1); } }, "Scale 1"),
        Btn({ "data-aid": "scale-10", active: lst.target === 10, "aria-pressed": lst.target === 10 ? "true" : "false", disabled: busy, title: "1,300 trips, 8,550 windows, 23,640 stop_times: a few seconds to build, ~1.5 s per headway decision (in the worker)", onClick: function () { pick(10); } }, "Scale 10 · slower")),
      h("div", { key: "src", className: "aid-note" }, "Source: ", h("a", { href: SRC_URL + "ai-model.js", target: "_blank", rel: "noopener" }, "ai-model.js"), " (model, policy, engine) · ", h("a", { href: SRC_URL + "ai-decides.js", target: "_blank", rel: "noopener" }, "ai-decides.js"), " (page, worker) · ", h("a", { href: SRC_URL + "tools/verify.mjs", target: "_blank", rel: "noopener" }, "verify.mjs"), " (Node check)")];
    var mini = Wv ? "#" + Wv.n + " · k " + fmt(Wv.k) + " · " + ms(Wv.writeMs) : lst.phase === "building" ? Math.round(lst.progress * 100) + "%" : info ? "scale " + info.scale : "";
    var suspended = svcList.filter(function (s) { return !s.on; }).length;
    var panelEl = h("aside", { className: "aid-panel", "data-gui-node-id": rootId + "/panel", "data-gui-component": "AIDecides.Panel", "aria-label": "Decision panel", "data-aid": "panel", "data-open": panel.open ? "true" : "false" },
      h("div", { className: "aid-phead" },
        h("div", { className: "aid-ptitle" }, GA.Chip ? h(GA.Chip, { label: "LIVE", size: "small", color: "success", variant: "outlined", sx: { height: 20, fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em" } }) : h("span", { className: "aid-tag live" }, "live"), h("span", null, "Decide & compute"), h("span", { className: "aid-pmini", "data-aid": "mini" }, mini)),
        h("button", { type: "button", className: "aid-ibtn", "aria-label": panel.open ? "Close the panel" : "Open the panel", "aria-expanded": panel.open ? "true" : "false", "aria-controls": uid + "-body", "data-gui-inspector-control": "true", "data-aid": "panel-toggle", onClick: function () { updPanel(function (p) { p.open = !p.open; }); } }, h("span", { className: "aid-chev" + (panel.open ? " up" : "") }, ICON.chev))),
      panel.open ? h("div", { id: uid + "-body", "aria-busy": busy ? "true" : "false" },
        h("div", { key: "kernel", className: "aid-kernel", "data-aid": "kernel" }, h("a", { href: "https://www.npmjs.com/package/this.me", target: "_blank", rel: "noopener", title: "this.me on npm" }, "this.me@" + ME_VERSION), " · TypeScript · Web Worker"),
        h("div", { key: "qha", className: "aid-pqa", "data-aid": "panel-qa" }, h(Question), h(How), h(Answer)),
                section("decision", "Decision", scen ? (SCEN.filter(function (x) { return x[0] === scen; })[0] || [0, ""])[1] : null, decisionBody),
        section("service", "Other scenarios · try a suspension", suspended ? suspended + " suspended" : null, serviceBody),
        section("wave", "This wave", Wv ? "k " + fmt(Wv.k) + " · " + ms(Wv.writeMs) : null, waveBody),
        section("routes", "Changed, by route", Wv ? fmt(Wv.routes.length) + " routes" : null, routesBody),
        section("chain", "Explain chain", sel ? labelOf(info, sel) : null, chainBody),
        section("history", "Decisions log", hist.length ? String(hist.length) : null, historyBody),
        section("model", "Model & data", info ? "scale " + info.scale : null, modelBody)) : null);
    var aria = info ? "Routes, trips and frequency windows of GTFS-Madrid-Bench scale " + info.scale + " around the circle; tick length is departures per hour; amber is below the " + info.floor + " s minimum. Click, or use the arrow keys, to select." : "Loading the kernel";
    var sw = function (bg, round) { return h("span", { className: "aid-sw", style: { background: bg, borderRadius: round ? "50%" : undefined } }); };
    return h("figure", { className: "aid", "data-gui-node-id": rootId, style: { margin: 0 } },
      h("div", { className: "aid-dash" },
        h("div", { ref: vizColRef, style: { minWidth: 0 } },
          h("div", { className: "aid-disc", ref: discRef, tabIndex: 0, role: "group", "aria-label": aria, onKeyDown: onKey, "data-aid": "disc", style: { width: 320, height: 320 } },
            h("canvas", { ref: ringsRef, "aria-hidden": "true" }), h("canvas", { ref: baseRef, "aria-hidden": "true" }), h("canvas", { ref: base2Ref, "aria-hidden": "true", style: { visibility: "hidden" } }), h("canvas", { ref: litRef, className: "aid-lit", "aria-hidden": "true" }), h("canvas", { ref: overRef, "aria-hidden": "true" }), hitLayer,
            !info ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 13, color: "var(--mui-palette-text-secondary, #8b949e)" } }, status || "Starting the kernel…") : null),
          h("div", { className: "aid-k" }, h("span", { ref: kRef, "data-aid": "k" }, "k = –"), h("span", { className: "aid-tag rep" }, slow ? "replay · ×10 slower" : "replay · measured duration"),
            Info("The wave is replayed in the kernel's real recompute order (explain().meta.recomputed) over the write's measured duration (or 10× slower if you ask). this.me " + ME_VERSION + " has no progress hook, so this is a replay of the real order, not a live stream. k and the timing are measured.", "About the replay")),
          h("figcaption", { className: "aid-cap" }, "Inner ring: routes · then trips · ticks: frequency windows (length = departures/hour) · outer ring: stop_times.", h("br"),
            h("span", { className: "aid-legend" }, h("span", null, sw(dark ? "#26aa94" : "#046c5c"), "running"), h("span", null, sw(dark ? "#f0b429" : "#c27c00"), "below the 165 s minimum"),
              h("span", null, sw(dark ? "#ffd166" : "#b45309", true), "tight flipped"), h("span", null, sw("rgba(140,150,160,.55)"), "suspended")))),
        panelEl));
  }

  // ── topbar (as on the .me Demos pages): logo, me:// path, search, theme, light/dark, gear (Inspector, Grid Layout) ──
  var LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=2"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  var PATH = [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
    { text: "SmartCities", href: "https://neurons-me.github.io/smart-cities/", title: "Smart Cities" }, { text: "AI-Decides", href: null, title: "This page" }];
  var IC = {
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
    grid: "M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z",
    palette: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    moon: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z",
    sun: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    down: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  };
  var Ico = function (p) { return h("svg", { viewBox: "0 0 24 24", width: p.size || 18, height: p.size || 18, fill: "currentColor", "aria-hidden": "true", focusable: "false", style: { display: "block", flex: "none" } }, h("path", { d: IC[p.kind] }), p.off ? h("path", { d: "M3 3 21 21", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }) : null); };
  var A = G.Atoms, Mo = G.Molecules, SEARCH_SRC = "https://neurons-me.github.io/index.json";
  var searchSkin = function (t) { var P = t.palette, I = function (v) { return v + " !important"; }, shadow = (t.shadows && t.shadows[8]) || "none";
    return { "& > div > div:first-of-type": { background: I(P.background.paper), borderColor: I(P.divider), color: I(P.text.primary), padding: I("6px 12px") }, "& > div > div:first-of-type:focus-within": { borderColor: I(P.primary.main) },
      "& input": { color: I(P.text.primary), caretColor: P.primary.main }, "& input::placeholder": { color: P.text.secondary, opacity: 1 }, "& [role=listbox]": { background: I(P.background.paper), borderColor: I(P.divider), boxShadow: I(shadow), color: P.text.primary },
      "& [role=listbox] > div": { color: I(P.text.secondary) }, "& [role=option]": { color: I(P.text.primary), borderColor: I(P.divider) }, "& [role=option]:hover, & [role=option][aria-selected=true]": { background: I(P.action.hover) },
      "& [role=option] > span:nth-of-type(2) > span:nth-of-type(2), & [role=option] > span:nth-of-type(3)": { color: I(P.text.secondary) } }; };
  function TopSearch() {
    var SB = G.Components && G.Components.SearchBar, os = useState(false), open = os[0], setOpen = os[1], box = useRef(null), btn = useRef(null);
    useEffect(function () { if (open) { var i = box.current && box.current.querySelector("input"); if (i) i.focus(); } }, [open]);
    useEffect(function () { if (open) return undefined; var k = function (e) { var t = e.target; if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))) { e.preventDefault(); setOpen(true); } };
      window.addEventListener("keydown", k); return function () { window.removeEventListener("keydown", k); }; }, [open]);
    if (!SB) return null;
    var close = function (refocus) { setOpen(false); if (refocus) setTimeout(function () { if (btn.current) btn.current.focus(); }, 0); };
    if (!open) return h(A.IconButton, { ref: btn, id: "site-search-open", size: "small", "aria-label": "Search", title: "Search (/)", onClick: function () { setOpen(true); }, sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: "search" }));
    return h(A.Box, { ref: box, id: "site-search", role: "search", onKeyDown: function (e) { if (e.key === "Escape") { e.preventDefault(); close(true); } },
      onBlur: function (e) { var nx = e.relatedTarget; if (nx && box.current && box.current.contains(nx)) return; var i = box.current && box.current.querySelector("input"); if (!i || !i.value.trim()) close(false); },
      sx: function (t) { var o = { zIndex: 1200, width: 300, minWidth: 0, flexShrink: 1, "& > div": { maxWidth: "none !important" } }; o[t.breakpoints.down("sm")] = { position: "absolute", left: 8, right: 8, top: "50%", transform: "translateY(-50%)", width: "auto" }; return Object.assign(o, searchSkin(t)); } },
      h(SB, { src: SEARCH_SRC, placeholder: "Search in All.This", themeMode: "auto", enableSlashShortcut: false }));
  }
  function ThemePicker() {
    var as = useState(null), anchor = as[0], setAnchor = as[1], themeId = G.useThemeContext().themeId, close = function () { setAnchor(null); };
    return h(React.Fragment, null,
      h(A.Button, { id: "theme-picker", size: "small", variant: "outlined", "aria-label": "Theme: " + themeId, "aria-haspopup": "true", "aria-expanded": anchor ? "true" : "false", onClick: function (e) { setAnchor(e.currentTarget); },
        sx: { minWidth: 0, py: { xs: .5, sm: .25 }, px: { xs: .5, sm: .75 }, gap: .5, fontFamily: MONO, fontSize: 11, textTransform: "none", color: "text.secondary", borderColor: { xs: "transparent", sm: "divider" }, whiteSpace: "nowrap", "& .lbl": { display: { xs: "none", sm: "inline" } } } },
        h(Ico, { kind: "palette", size: 15 }), h(A.Box, { component: "span", className: "lbl" }, themeId), h(A.Box, { component: "span", className: "lbl" }, h(Ico, { kind: "down", size: 14 }))),
      h(Mo.Menu, { id: "theme-menu", anchorEl: anchor, open: !!anchor, onClose: close, anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" }, "data-gui-inspector-control": "true", slotProps: { list: { "aria-label": "Themes", dense: true }, paper: { sx: { width: 220, p: .5, mt: .5 } } } },
        h(G.ThemesCatalog, { sidebarView: "expanded", onThemeSelect: close })));
  }
  function ModeToggle() { var t = G.useThemeContext(), dark = t.mode === "dark";
    return h(A.IconButton, { id: "theme-mode-toggle", size: "small", onClick: function () { t.toggleMode(); }, "aria-label": dark ? "Switch to light mode" : "Switch to dark mode", title: dark ? "Light mode" : "Dark mode", sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: dark ? "moon" : "sun" })); }
  function SettingsMenu() {
    var sel = G.useOptionalSelection ? G.useOptionalSelection() : null, as = useState(null), anchor = as[0], setAnchor = as[1], close = function () { setAnchor(null); };
    useEffect(function () { if (sel && params.get("grid") === "1" && !sel.gridEnabled) sel.setGridEnabled(true); }, []);
    var insp = Boolean(G.getInspectorEnabled()), grid = Boolean(sel && sel.gridEnabled);
    var items = [{ key: "inspector", label: insp ? "Inspector · ON" : "Inspector · OFF", icon: h(Ico, { kind: "code", off: !insp }), onClick: function () { G.toggleInspector(); } },
      sel && { key: "grid", label: grid ? "Grid Layout · ON" : "Grid Layout · OFF", icon: h(Ico, { kind: "grid", off: !grid }), onClick: function () { sel.setGridEnabled(!grid); } }].filter(Boolean);
    return h(React.Fragment, null,
      h(A.IconButton, { id: "gui-settings", "aria-label": "GUI settings", title: "GUI settings", size: "small", onClick: function (e) { setAnchor(e.currentTarget); }, sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: "settings" })),
      h(Mo.Menu, { id: "settings-menu", anchorEl: anchor, open: !!anchor, onClose: close, "data-gui-inspector-control": "true", anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" } },
        items.map(function (it) { return h(Mo.MenuItem, { key: it.key, "data-settings-item": it.key, onClick: function () { close(); it.onClick(); } }, h(Mo.ListItemIcon, null, it.icon), h(Mo.ListItemText, null, it.label)); })));
  }
  function TopBar(p) {
    // when the path doesn't fit, the middle segments collapse to "…" (a link to the parent), so the page's own name always shows in full
    var cst = useState("measure"), mode = cst[0], setMode = cst[1], col = mode === "col", pathRef = useRef(null), last = PATH.length - 1;
    useEffect(function () { var re = function () { setMode("measure"); }; window.addEventListener("resize", re); if (document.fonts && document.fonts.ready) document.fonts.ready.then(re);
      return function () { window.removeEventListener("resize", re); }; }, []);
    useEffect(function () { var b = pathRef.current; if (mode === "measure" && b) setMode(b.scrollWidth > b.clientWidth + 1 ? "col" : "full"); }, [mode]);   // measured expanded, after commit
    var mids = PATH.slice(1, last).map(function (x) { return x.text; }).join(" / ");
    var seg = function (s, i) { var hide = col && i > 0 && i < last;
      return [i > 0 && !PATH[i - 1].text.endsWith("://") && !hide && !(col && i === last) ? h(A.Box, { component: "span", key: "sep" + i, sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      col && i === last && last > 1 ? h(A.Link, { key: "ell", href: PATH[last - 1].href, underline: "hover", title: mids, "aria-label": mids, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, "…") : null,
      col && i === last && last > 1 ? h(A.Box, { component: "span", key: "ellsep", sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      hide ? null : s.href ? h(A.Link, { key: s.text, href: s.href, underline: "hover", title: s.title, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, s.text)
        : h(A.Box, { component: "span", key: s.text, "aria-current": "page", sx: { color: "text.primary", fontFamily: MONO, fontSize: { xs: 12, sm: 13 }, fontWeight: 600, flexShrink: 0 } }, s.text), hide ? null : h(SibSlot, { key: "sib" + i, path: PATH, i: i })]; };
    return h(A.Box, { component: "nav", "aria-label": "me path", "data-gui-node-id": p["data-gui-node-id"], sx: { position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: { xs: .5, sm: 1.25 }, px: { xs: .75, sm: 2.5 }, minHeight: 48, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" } },
      h(A.Link, { href: "https://neurons-me.github.io/", title: "neurons.me", underline: "none", sx: { display: "inline-flex", lineHeight: 0, flexShrink: 0 } }, h("img", { src: LOGO, alt: "neurons.me", width: 28, height: 28, style: { display: "block", objectFit: "contain" } })),
      h(A.Box, { ref: pathRef, "data-aid": "mepath", sx: { display: "inline-flex", alignItems: "center", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } } }, [].concat.apply([], PATH.map(seg))),
      h(A.Box, { sx: { ml: "auto", display: "inline-flex", alignItems: "center", gap: { xs: .25, sm: 1.25 }, flexShrink: 0 } }, h(TopSearch),
        h(A.Box, { "data-gui-inspector-control": "true", sx: { display: "inline-flex", alignItems: "center", gap: .25 } }, h(ThemePicker), h(ModeToggle), h(SettingsMenu))));
  }
  function Notes(p) {
    var L = function (href, text) { return h(A.Link, { href: href, underline: "hover", sx: { color: "primary.main" } }, text); };
    var li = function (k, a) { return h("li", { key: k, style: { marginBottom: 8 } }, a); };
    return h(A.Box, { component: "section", "data-gui-node-id": p["data-gui-node-id"], sx: { mt: 5, pt: 3, borderTop: 1, borderColor: "divider", color: "text.secondary", fontSize: ".95rem", lineHeight: 1.65, maxWidth: 860, "& b": { color: "text.primary" } } },
      h(A.Typography, { component: "h2", sx: { fontSize: "1.25rem", fontWeight: 800, color: "text.primary", mb: 1.5 } }, "What's in this run"),
      h("ul", { style: { paddingLeft: 20, margin: 0 }, "data-aid": "whatsin" },
        li("d", [h("b", { key: 0 }, "Data"), ": ", L("https://doi.org/10.5281/zenodo.14038823", "GTFS-Madrid-Bench"), " (Zenodo 10.5281/zenodo.14038823), base version, generated by the benchmark from Madrid Metro's feed with encoded ids, names and times. Headways, trips, stop_times and day flags are used as-is. Measured on it: ", L(DOCS + "Benchmarks/GTFS/Madrid/", "GTFS-Madrid benchmark"), "."]),
        li("p", [h("b", { key: 0 }, "Decision"), ": ", L(GH + "ai-model.js#L23", "policy:fair-headway@1"), ", one factor for every line (", L(GH + "ai-model.js#L40-L60", "propose"), "). Its reason, scenario and inputs hash are recorded as facts (", L(GH + "ai-model.js#L126-L131", "decisions.<n>.*"), ") before the ", L(GH + "ai-model.js#L132-L136", "one write"), ". A language model could propose later under the same record and checks."]),
        li("k", [h("b", { key: 0 }, "Kernel"), ": ", L("https://www.npmjs.com/package/this.me", "this.me " + ME_VERSION), " from npm, ", L(GH + "ai-decides.js#L18", "SRI-pinned"), ", in a ", L(GH + "ai-decides.js#L28-L34", "Web Worker"), ". Values are read with ", L(DOCS + "me-whatever-what.html", "me(path)"), "; ", L(DOCS + "Extreme-Fan-Out.html", "k"), ", changed values, early cutoff and timings come from ", L(DOCS + "Explain.html", "explain().meta"), "; the animation replays the actual recompute order."]),
        li("a", [h("b", { key: 0 }, "Scenario inputs we set"), ": policy.factor, the 165 s minimum headway (policy.minHeadway) and each service's on/off switch. The feed has no fares, capacity or demand, so this run models supply only."]),
        li("l", [h("b", { key: 0 }, "Open kernel items"), ": the [] aggregate is much slower than explicit sums at this size, so the model spells the sums out (", L("https://github.com/neurons-me/.me/issues/6", "#6"), ", ", L("https://github.com/neurons-me/.me/issues/7", "#7"), "); the ?: ternary does not evaluate and booleans do not take part in arithmetic (", L("https://github.com/neurons-me/.me/issues/8", "#8"), ")."])));
  }

  // ── How: GTFS-Madrid-Bench → .me paths → ["="] → one write → the wave. Every row is what tools/build-data.mjs keeps
  // from the feed and ai-model.js build() declares (r, t, w, j, s = 1-based file order; s = CALENDAR row). One toggle opens
  // the three columns and a Try it panel on one real trip, driven by the demo's own kernel (the Web Worker).
  var GH = "https://github.com/neurons-me/.me/blob/main/Demos/SmartCities/AI-Decides/", DOCS = "https://neurons-me.github.io/.me/docs/";
  var ZEN = "https://zenodo.org/records/14038823/files/GTFS-Scale-1-CHANGE.tar.xz";   // the CSVs ship inside it (no per-file URL)
  var SAMPLE_URL = HERE + "data/madrid-s1-sample.json?v=1";
  function How() {
    var SYN = window.MeSyntax || null;
    // cls "nw": one unbreakable chip (tokens without the highlighter's <wbr> break hints)
    var me = function (t, cls) { var nw = cls === "nw";
      return h("code", { className: "me-code" + (cls ? " " + cls : "") }, !SYN ? t : nw && SYN.tokenize ? SYN.tokenize(t).map(function (k, i) { return k.c ? h("span", { key: i, className: k.c }, k.v) : k.v; }) : SYN.render(h, t)); };
    var a = function (href, text, title, cls) { return h("a", { href: href, target: "_blank", rel: "noopener", title: title, className: cls }, text); };
    var file = function (name) { return a(ZEN, h("code", null, name), "In GTFS-Scale-1-CHANGE.tar.xz (Zenodo 10.5281/zenodo.14038823): data/shared/base-1-" + name.replace(".txt", "").toUpperCase() + ".csv", "aid-how-file"); };
    // [GTFS file, field, .me path, build-data.mjs line]
    var MAP = [
      ["routes.txt", "route_id", "routes[r]", 19],
      ["trips.txt", "trip_id · route_id", "routes[r].trips[t]", 21],
      ["trips.txt", "service_id", "routes[r].trips[t].service", 16],
      ["calendar.txt", "monday…sunday", "services[s].days", 26],
      ["frequencies.txt", "headway_secs", "routes[r].trips[t].win[w].base", 17],
      ["stop_times.txt", "one row per stop", "routes[r].trips[t].st[j]", 18],
    ];
    var ADDED = ["policy.factor(1)", "policy.minHeadway(165)", "services[s].enabled(1)"];
    var DER = [
      ["win", "headway", "base * policy.factor"],
      ["win", "perHour", "3600 / headway"],
      ["win", "tight", "headway < policy.minHeadway"],
      ["trip", "live", "services[s].enabled == 1"],
      ["st[j]", "served", "routes[r].trips[t].live"],
      ["trip", "perHour", "(win[1].perHour + … + win[n].perHour) / n * services[s].enabled"],
      ["route", "perHour", "trips[1].perHour + … + trips[n].perHour"],
      ["route", "anyTight", "win[1].tight || … || win[n].tight"],
      ["city", "perHour", "routes[1].perHour + … + routes[R].perHour"],
    ];
    var WAVE = ["policy.factor(0.9)", "win.headway", "win.perHour · win.tight", "trip.perHour", "route.perHour · route.anyTight", "city.perHour"];
    var os = useState(false), open = os[0], setOpen = os[1];
    useEffect(function () { if (SYN && SYN.watchTheme) SYN.watchTheme(); }, []);
    return h("section", { className: "aid-how", "aria-labelledby": "aid-how-h", "data-aid": "how" },
      h("h2", { id: "aid-how-h" }, "How."),
      h("div", { className: "aid-how-flow", "aria-label": "GTFS table, .me path, [\"=\"], one write, wave" }, h("span", null, "GTFS table"), h("i", null, "→"), h("span", null, ".me path"), h("i", null, "→"), h("span", null, me('["="]', "nw")), h("i", null, "→"), h("span", null, "one write"), h("i", null, "→"), h("span", null, "wave")),
      h("button", { type: "button", className: "aid-how-t aid-how-main", "aria-expanded": open ? "true" : "false", "aria-controls": "aid-how-body", "data-aid": "how-toggle", onClick: function () { setOpen(!open); } },
        h("span", null, open ? "Hide the mapping" : "Show the mapping, the derivations and a live trip"), h("span", { className: "aid-how-chev", "aria-hidden": "true" }, ICON.chev)),
      h("div", { id: "aid-how-body", className: "aid-how-body", hidden: !open },
        h("div", { className: "aid-how-grid" },
          h("div", { className: "aid-how-card" }, h("h3", null, h("b", null, "1"), "GTFS → path"),
            h("ul", { className: "aid-how-map" }, MAP.map(function (m, i) { return h("li", { key: i }, h("span", null, file(m[0]), h("small", null, m[1])),
              a(GH + "tools/build-data.mjs#L" + m[3], "→", "build-data.mjs line " + m[3], "a"), me(m[2])); })),
            h("div", { className: "aid-how-foot" }, "Added, not in the feed: ", ADDED.map(function (x, i) { return h(React.Fragment, { key: i }, i ? " · " : null, me(x, "nw")); }))),
          h("div", { className: "aid-how-card" }, h("h3", null, h("b", null, "2"), '["="] derivations'),
            h("ul", { className: "aid-how-der" }, DER.map(function (d, i) { return h("li", { key: i }, me(d[0] + '["="]("' + d[1] + '", "' + d[2] + '")')); }))),
          h("div", { className: "aid-how-card" }, h("h3", null, h("b", null, "3"), "One write → wave"),
            h("ul", { className: "aid-how-w" }, WAVE.map(function (w, i) { return h("li", { key: i }, w.split(" · ").map(function (x, j) { return h(React.Fragment, { key: j }, j ? " · " : null, me(x)); })); })),
            h("div", { className: "aid-how-foot" }, me("st[j].served"), " reads only ", me("trip.live"), ": a headway write never reaches stop_times. ", me("services[s].enabled(0)"), " does."))),
        h("div", { className: "aid-how-foot" }, "Adapter: ", a(GH + "tools/build-data.mjs#L12-L29", "build-data.mjs"), " (CSV → compact JSON) → ", a(GH + "ai-model.js#L61-L90", "ai-model.js build()"), " (JSON → .me paths and ", me('["="]', "nw"), "). ",
          "Data: ", a(ZEN, "GTFS-Scale-1-CHANGE.tar.xz"), " (Zenodo 10.5281/zenodo.14038823, data/shared/base-1-*.csv; no per-file links, the CSVs ship inside the package)."),
        open ? h(TryIt, { me: me }) : null),
      h("div", { className: "aid-how-foot" }, "Full model: ", h("a", { href: "https://neurons-me.github.io/.me/docs/Benchmarks/GTFS/Madrid/" }, "GTFS Madrid benchmark"), " · source: ", h("a", { href: SRC_URL + "ai-model.js", target: "_blank", rel: "noopener" }, "ai-model.js"), " build()"));
  }
  // Try it: one real trip (routes.1.trips.1 at scale 1): its raw CSV rows (data/madrid-s1-sample.json, extracted verbatim by
  // tools/build-sample.mjs), the paths they became read live from the kernel, and real calls: read, explain, one write, undo.
  function TryIt(p) {
    var me = p.me, T = "routes.1.trips.1", W1 = T + ".win.1";
    var GA = G.Atoms || {}, Btn = function (o, text) { var q = Object.assign({ type: "button", "data-gui-inspector-control": "true" }, o);
      return GA.Button ? h(GA.Button, Object.assign(q, { variant: "outlined", size: "small", color: "inherit", disableElevation: true, sx: { textTransform: "none", minHeight: 30, py: .25, px: 1.25, borderRadius: "8px", fontSize: 13, lineHeight: 1.2, borderColor: "divider" } }), text) : h("button", q, text); };
    var ls = useState(live.state()), lst = ls[0], setLst = ls[1];
    useEffect(function () { return live.subscribe(function (s) { setLst(Object.assign({}, s)); }); }, []);
    var ss = useState(null), sample = ss[0], setSample = ss[1];
    useEffect(function () { var alive = true; fetch(SAMPLE_URL).then(function (r) { return r.json(); }).then(function (j) { if (alive) setSample(j); }, function (e) { if (alive) setSample({ error: e.message }); }); return function () { alive = false; }; }, []);
    var PATHS = [
      ["trips.txt · service_id", T + ".service"], ["calendar.txt · day flags", "services.1.days"], ["(added)", "services.1.enabled"],
      ["frequencies.txt · headway_secs, row 1", W1 + ".base"], ["= base * policy.factor", W1 + ".headway"], ["= 3600 / headway", W1 + ".perHour"], ["= headway < policy.minHeadway", W1 + ".tight"],
      ["= services[1].enabled == 1", T + ".live"], ["= mean win perHour * enabled", T + ".perHour"], ["stop_times.txt row 1 · = trip.live", T + ".st.1.served"],
      ["= trips sum", "routes.1.perHour"], ["= routes sum", "city.perHour"], ["(added)", "policy.factor"]];
    var vs = useState(null), vals = vs[0], setVals = vs[1];
    var ready = (lst.phase === "ready" || lst.phase === "writing") && lst.scale === 1;
    useEffect(function () { if (!ready) return; var alive = true; live.read(PATHS.map(function (x) { return x[1]; })).then(function (r) { if (alive) setVals(r.values); }, function () {}); return function () { alive = false; }; }, [ready, lst.waveSeq]);
    var rs = useState(null), out = rs[0], setOut = rs[1];
    var fmtV = function (v) { return typeof v === "number" ? String(Math.round(v * 1000) / 1000) : JSON.stringify(v); };
    var doRead = function () { live.read(W1 + ".headway").then(function (r) { setOut({ kind: "read", code: 'me("' + W1 + '.headway")', value: r.values[0], ms: r.ms }); }, function (e) { setOut({ kind: "error", text: e.message }); }); };
    var doExplain = function () { live.explain(W1 + ".headway").then(function (x) { setOut({ kind: "explain", code: 'me.explain("' + W1 + '.headway")', x: x }); }, function (e) { setOut({ kind: "error", text: e.message }); }); };
    var en = lst.state && lst.state.enabled ? lst.state.enabled[0] : 1, busy = lst.phase !== "ready";
    var doWrite = function () { live.service(1, !en).then(function () { var w = live.state().wave; setOut({ kind: "write", code: "me.services[1].enabled(" + (en ? 0 : 1) + ")", w: w }); }, function (e) { setOut({ kind: "error", text: e.message }); }); };
    var doUndo = function () { live.undo().then(function () { var w = live.state().wave; setOut({ kind: "undo", w: w }); }, function (e) { setOut({ kind: "error", text: e.message }); }); };
    var raw = function (k, label) { var f = sample && sample.rows && sample.rows[k]; if (!f) return null;
      return h("div", { key: k, className: "aid-try-raw" }, h("div", { className: "aid-try-rl" }, h("code", null, f.file), " ", label, f.total > f.rows.length ? " · " + f.rows.length + " of " + f.total + " rows" : ""),
        h("pre", null, h("span", { className: "hd" }, "    " + f.header), "\n", f.rows.map(function (r) { return ("    " + r.line).slice(-4) + " " + r.text; }).join("\n"))); };
    var waveLine = function (w) { return w ? h("div", { className: "aid-try-out" }, me(w.write.replace(/\.(\d+)\./g, "[$1].") + "(" + w.to + ")"), "  ", w.from + " → " + w.to, " · k = ", h("b", null, fmt(w.k)), " recomputed · ", h("b", null, fmt(w.changed)), " changed") : null; };
    if (lst.scale && lst.scale !== 1) return h("div", { className: "aid-how-card aid-try", "data-aid": "try" }, h("h3", null, "Try it"), h("div", { className: "aid-note" }, "The Try it trip is from scale 1; switch the demo to Scale 1 to use it."));
    return h("div", { className: "aid-how-card aid-try", "data-aid": "try" },
      h("h3", null, "Try it · one real trip"),
      h("div", { className: "aid-note" }, me("routes[1].trips[1]"), " = trip_id ", h("code", null, sample ? sample.trip_id : "…"), " (route_id ", h("code", null, sample ? sample.route_id : "…"), ", service_id ", h("code", null, sample ? sample.service_id : "…"), "), GTFS-Madrid-Bench scale 1, generated data: ids are encoded by the benchmark."),
      h("div", { className: "aid-try-grid" },
        h("div", { className: "aid-try-col" }, h("h4", null, "Raw GTFS rows"),
          sample && sample.error ? h("div", { className: "aid-note" }, "Could not load the rows: " + sample.error) : !sample ? h("div", { className: "aid-note" }, "Loading…") :
          [raw("routes", "· the route"), raw("trips", "· the trip"), raw("calendar", "· its service"), raw("frequencies", "· its headway windows"), raw("stop_times", "· its stops")]),
        h("div", { className: "aid-try-col" }, h("h4", null, "The paths they became · live"),
          h("ul", { className: "aid-try-paths", "data-aid": "try-paths" }, PATHS.map(function (x, i) { return h("li", { key: i }, me('me("' + x[1] + '")'), h("span", { className: "v" }, vals ? fmtV(vals[i]) : "…"), h("small", null, x[0])); })),
          h("h4", null, "Real kernel calls"),
          h("div", { className: "aid-ctl" },
            Btn({ "data-aid": "try-read", disabled: !ready, onClick: doRead }, "Read"),
            Btn({ "data-aid": "try-explain", disabled: !ready, onClick: doExplain }, "Explain"),
            Btn({ "data-aid": "try-write", disabled: !ready || busy, onClick: doWrite }, en ? "Suspend service 1" : "Resume service 1"),
            Btn({ "data-aid": "try-undo", disabled: !ready || busy || !lst.undoable, onClick: doUndo }, "Undo")),
          h("div", { className: "aid-note" }, "Suspend and Undo are the demo's own actions (the Service and Decision panels): they go into its history too."),
          h("div", { className: "aid-try-res", "data-aid": "try-out", "aria-live": "polite" },
            !out ? null : out.kind === "error" ? h("div", { className: "aid-warn" }, out.text)
            : out.kind === "read" ? h("div", { className: "aid-try-out" }, me(out.code), " → ", h("b", null, fmtV(out.value)), " · " + out.ms + " ms in the worker")
            : out.kind === "explain" ? h("div", { className: "aid-try-out" }, me(out.code), h("br"), "value ", h("b", null, fmtV(out.x.value)), " · ", me('"' + ((out.x.derivation && out.x.derivation.expression) || out.x.expr || "") + '"'),
                h("br"), "inputs: ", ((out.x.derivation && out.x.derivation.inputs) || []).map(function (q, i) { return h(React.Fragment, { key: i }, i ? " · " : null, me(String(q && q.path || q)), q && q.value !== undefined ? " = " + fmtV(q.value) : null); }),
                out.x.meta && out.x.meta.k != null ? [h("br", { key: "b" }), "last wave k = " + fmt(out.x.meta.k) + (out.x.meta.sourcePath ? " · from " : "")] : null, out.x.meta && out.x.meta.sourcePath ? me(String(out.x.meta.sourcePath)) : null)
            : waveLine(out.w)))));
  }
  // ── Map (schematic): GTFS-Madrid-Bench stops at their benchmark x / y (GENERATED by the benchmark, not Madrid
  // geography), each trip a line through its stops in STOP_TIMES file order (stop j = routes[r].trips[t].st[j]).
  // Every mark is a value read from the worker's kernel with live.read, re-read after every wave:
  // line width = routes[r].perHour, faded line = routes[r].trips[t].live false, filled dot = some st[j].served,
  // ring = some trip through the stop has a win[w].tight. One SVG, a handful of <path>s; no per-stop DOM nodes.
  var MAP_URL = HERE + "data/madrid-s1-map.json?v=2";
  var HUES = [210, 12, 140, 280, 45, 320, 180, 95, 250, 0, 160, 30, 300];
  var MY0 = 34, MDY = 44;
  // how many values a formula reads: the worker passes at most 8 of explain()'s inputs, with inputsTotal = the real count
  var nIn = function (der) { if (der && der.inputsTotal) return der.inputsTotal; var e = String(der && der.expression || ""), m = e.match(/[A-Za-z_]\w*(\[\d+\])*(\.[A-Za-z_]\w*(\[\d+\])*)+/g) || [], u = {}; m.forEach(function (x) { u[x] = 1; }); return Math.max(Object.keys(u).length, (der && der.inputs || []).length); };
  function CityMap() {
    var fmtV = function (v) { return typeof v === "number" ? String(Math.round(v * 1000) / 1000) : JSON.stringify(v); }, fmtN = function (v) { return String(Math.round(v * 10) / 10); };
    var SYN = window.MeSyntax || null;
    var me = function (t) { return h("code", { className: "me-code" }, SYN ? SYN.render(h, t) : t); };
    var ls = useState(live.state()), lst = ls[0], setLst = ls[1];
    useEffect(function () { return live.subscribe(function (s) { setLst(Object.assign({}, s)); }); }, []);
    var gs = useState(null), geo = gs[0], setGeo = gs[1];
    useEffect(function () { var alive = true;
      Promise.all([fetch(MAP_URL).then(function (r) { return r.json(); }), fetch(DATA_URL(1)).then(function (r) { return r.json(); })]).then(function (x) {
        var m = x[0], d = x[1], trips = [], paths = [];
        m.routes.forEach(function (rt, ri) { rt.forEach(function (stops, ti) { var p = "routes." + (ri + 1) + ".trips." + (ti + 1), wins = d.routes[ri].trips[ti].h.length;
          trips.push({ r: ri, t: ti, p: p, stops: stops, wins: wins, d: "M" + stops.map(function (s) { return m.stops[s][0] + "," + (1000 - m.stops[s][1]); }).join("L") }); }); });
        // read list: route perHour, trip live, every st[j].served, every win[w].tight
        var at = { route: [], live: [], served: [], tight: [] };
        m.routes.forEach(function (rt, ri) { at.route.push(paths.length); paths.push("routes." + (ri + 1) + ".perHour"); });
        trips.forEach(function (x) { at.live.push(paths.length); paths.push(x.p + ".live");
          x.st0 = paths.length; x.stops.forEach(function (s, j) { paths.push(x.p + ".st." + (j + 1) + ".served"); });
          x.w0 = paths.length; for (var w = 1; w <= x.wins; w++) paths.push(x.p + ".win." + w + ".tight"); });
        at.tph = []; trips.forEach(function (x) { at.tph.push(paths.length); paths.push(x.p + ".perHour"); });
        var used = new Uint8Array(m.stops.length); trips.forEach(function (x) { x.stops.forEach(function (s) { used[s] = 1; }); });
        // metro layout: route r = row r; its trips (TRIPS order) end to end, each trip's stops in STOP_TIMES order.
        // Only order and membership are used, never the generated x / y.
        var MX0 = 92, MX1 = 992, GAP = 10, occ = {}, row = [], segs = [];
        m.routes.forEach(function (rt, ri) { var y = MY0 + ri * MDY, n = 0; rt.forEach(function (st) { n += st.length; });
          var u = (MX1 - MX0 - GAP * (rt.length - 1)) / Math.max(1, n - rt.length), x = MX0, list = [];
          rt.forEach(function (st, ti) { var g = trips.findIndex(function (q) { return q.r === ri && q.t === ti; }), xs = [];
            st.forEach(function (s, j) { xs.push(x); (occ[s] = occ[s] || []).push({ r: ri, g: g, j: j, x: x, y: y }); list.push({ s: s, g: g, j: j, x: x }); if (j < st.length - 1) x += u; });
            segs.push({ g: g, r: ri, y: y, x0: xs[0], x1: xs[xs.length - 1] }); x += GAP; });
          row.push({ y: y, stops: list }); });
        var links = []; Object.keys(occ).forEach(function (s) { var o = occ[s]; if (new Set(o.map(function (q) { return q.r; })).size < 2) return;
          for (var i = 1; i < o.length; i++) if (o[i].r !== o[i - 1].r) links.push({ s: +s, a: o[i - 1], b: o[i] }); });
        var metro = { occ: occ, row: row, segs: segs, links: links, H: MY0 + (m.routes.length - 1) * MDY + 28,
          inter: Object.keys(occ).filter(function (s) { return new Set(occ[s].map(function (q) { return q.r; })).size > 1; }).length };
        if (alive) setGeo({ m: m, trips: trips, paths: paths, at: at, used: used, metro: metro });
      }, function (e) { if (alive) setGeo({ error: e.message }); });
      return function () { alive = false; }; }, []);
    var ready = (lst.phase === "ready" || lst.phase === "writing") && lst.scale === 1;
    var vs = useState(null), vals = vs[0], setVals = vs[1];
    useEffect(function () { if (!ready || !geo || geo.error) return; var alive = true;
      live.read(geo.paths).then(function (r) { if (alive) setVals({ v: r.values, ms: r.ms, seq: lst.waveSeq }); }, function () {});
      return function () { alive = false; }; }, [ready, geo, lst.waveSeq]);
    var sel = useState(null), pick = sel[0], setPick = sel[1];
    var pinS = useState(-1), hovR = useRouteHi(function (r) { pinS[1](r); }); if (hovR < 0) hovR = pinS[0];
    var xs = useState(null), ex = xs[0], setEx = xs[1];
    var explainPath = function (target) { setPick(target); setEx(null);
      live.explain(target.path).then(function (x) { setEx({ path: target.path, x: x }); }, function (e) { setEx({ path: target.path, error: e.message }); }); };
    useEffect(function () { if (pick && ready) explainPath(pick); }, [lst.waveSeq]);   // keep the card in step with the kernel
    // derived marks (pure functions of the values just read)
    var base = useRef(0), ts = useState("metro"), tab = ts[0], setTab = ts[1];
    var marks = useMemo(function () {
      if (!geo || geo.error || !vals) return null; var V = vals.v, m = geo.m, n = m.stops.length;
      var served = new Uint8Array(n), tight = new Uint8Array(n), max = 0, rph = geo.at.route.map(function (i) { var x = +V[i] || 0; if (x > max) max = x; return x; });
      var tl = geo.trips.map(function (x, g) { var any = 0; for (var w = 0; w < x.wins; w++) if (V[x.w0 + w]) any = 1;
        x.stops.forEach(function (s, j) { if (V[x.st0 + j]) served[s] = 1; if (any) tight[s] = 1; }); return { live: !!V[geo.at.live[g]], tight: any }; });
      var dot = function (s) { var p = m.stops[s]; return "M" + (p[0] - 4) + "," + (1000 - p[1]) + "a4,4 0 1,0 8,0a4,4 0 1,0 -8,0"; };
      var on = [], off = [], ring = [];
      for (var s = 0; s < n; s++) { if (!geo.used[s]) continue; (served[s] ? on : off).push(dot(s)); if (tight[s]) { var p = m.stops[s]; ring.push("M" + (p[0] - 9) + "," + (1000 - p[1]) + "a9,9 0 1,0 18,0a9,9 0 1,0 -18,0"); } }
      var tph = geo.at.tph.map(function (i) { return +V[i] || 0; }), tw = geo.trips.map(function (x, g) { var n = 0; if (!V[geo.at.live[g]]) return 0; for (var w = 0; w < x.wins; w++) if (V[x.w0 + w]) n++; return n; });
      var tsv = geo.trips.map(function (x) { var n = 0; x.stops.forEach(function (s, j) { if (V[x.st0 + j]) n++; }); return n; });
      if (!base.current) { var b = 0; tph.forEach(function (q) { if (q > b) b = q; }); if (b) base.current = b; }
      return { rph: rph, max: max || 1, tl: tl, tph: tph, tw: tw, tsv: tsv, nTightWin: tw.reduce(function (a, b) { return a + b; }, 0), nWin: geo.trips.reduce(function (a, x, g) { return a + (tl[g].live ? x.wins : 0); }, 0),
        nTightTrip: tw.filter(function (q) { return q > 0; }).length, nDead: tl.filter(function (q) { return !q.live; }).length, nServedSt: tsv.reduce(function (a, b) { return a + b; }, 0), on: on.join(""), off: off.join(""), ring: ring.join(""), nOn: on.length, nOff: off.length, nRing: ring.length, nUsed: on.length + off.length };
    }, [geo, vals]);
    // click → nearest stop (within 14 units) else nearest trip line; both answered by me.explain in the worker
    var svgRef = useRef(null);
    var onClick = function (e) { if (!marks) return; var svg = svgRef.current, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var q = pt.matrixTransform(svg.getScreenCTM().inverse()), m = geo.m, best = null, bd = 196;
      geo.trips.forEach(function (x) { x.stops.forEach(function (s, j) { var p = m.stops[s], dx = p[0] - q.x, dy = 1000 - p[1] - q.y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = { kind: "stop", stop: s, path: x.p + ".st." + (j + 1) + ".served" }; } }); });
      if (!best) { var bl = 64; geo.trips.forEach(function (x) { for (var j = 1; j < x.stops.length; j++) { var a = m.stops[x.stops[j - 1]], b = m.stops[x.stops[j]];
        var ax = a[0], ay = 1000 - a[1], bx = b[0] - ax, by = 1000 - b[1] - ay, L = bx * bx + by * by || 1, t = Math.max(0, Math.min(1, ((q.x - ax) * bx + (q.y - ay) * by) / L));
        var dx = ax + t * bx - q.x, dy = ay + t * by - q.y, d2 = dx * dx + dy * dy; if (d2 < bl) { bl = d2; best = { kind: "trip", r: x.r, path: x.p + ".perHour" }; } } }); }
      if (best) { if (best.kind === "stop") best.on = geo.trips.filter(function (x) { return x.stops.indexOf(best.stop) >= 0; }).length; explainPath(best); } };
    var metroRef = useRef(null);
    var onMetro = function (e) { if (!marks || !geo.metro) return; var svg = metroRef.current, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var q = pt.matrixTransform(svg.getScreenCTM().inverse()), M = geo.metro, ri = Math.round((q.y - MY0) / MDY); if (ri < 0 || ri >= M.row.length || Math.abs(q.y - M.row[ri].y) > 18) return;
      if (q.x < 86) return explainPath({ kind: "trip", r: ri, path: "routes." + (ri + 1) + ".perHour" });
      var best = null, bd = 3.2; M.row[ri].stops.forEach(function (o) { var d = Math.abs(o.x - q.x); if (d < bd) { bd = d; best = o; } });
      if (best && Math.abs(q.y - M.row[ri].y) < 8) { var t = geo.trips[best.g]; return explainPath({ kind: "stop", stop: best.s, on: M.occ[best.s].length, path: t.p + ".st." + (best.j + 1) + ".served" }); }
      var sg = M.segs.filter(function (z) { return z.r === ri && q.x >= z.x0 - 5 && q.x <= z.x1 + 5; })[0];
      if (sg) explainPath({ kind: "seg", r: ri, g: sg.g, path: geo.trips[sg.g].p + ".perHour" }); };
    // line width: the trip's perHour read from the kernel, cubed against the timetable's busiest trip (first read)
    var segW = function (g) { var ph = marks ? marks.tph[g] : 0, b = base.current || 1; return ph <= 0 ? 1.2 : 2 + 8 * Math.pow(ph / b, 3); };
    var hue = function (r) { return "hsl(" + HUES[r % HUES.length] + " 70% 52%)"; };
    var metroDots = useMemo(function () { if (!geo || !geo.metro || !vals) return null; var M = geo.metro, V = vals.v, on = [], off = [], ion = [], ioff = [], win = [], wt = [];
      var dot = function (x, y, r) { return "M" + (x - r).toFixed(1) + "," + y + "a" + r + "," + r + " 0 1,0 " + 2 * r + ",0a" + r + "," + r + " 0 1,0 " + -2 * r + ",0"; };
      M.row.forEach(function (rw) { rw.stops.forEach(function (o) { var t = geo.trips[o.g], sv = V[t.st0 + o.j], ic = new Set(M.occ[o.s].map(function (q) { return q.r; })).size > 1;
        (ic ? (sv ? ion : ioff) : (sv ? on : off)).push(dot(+o.x.toFixed(1), rw.y, ic ? 3.4 : 2)); }); });
      M.segs.forEach(function (z) { var t = geo.trips[z.g], w = (z.x1 - z.x0) / t.wins; for (var k = 0; k < t.wins; k++) (V[t.w0 + k] ? wt : win).push("M" + (z.x0 + k * w + .6).toFixed(1) + "," + (z.y + 14) + "h" + Math.max(.6, w - 1.2).toFixed(1) + "v3h" + (-Math.max(.6, w - 1.2)).toFixed(1) + "z"); });
      return { on: on.join(""), off: off.join(""), ion: ion.join(""), ioff: ioff.join(""), win: win.join(""), wt: wt.join("") }; }, [geo, vals]);
    var metroFig = function () { var M = geo && geo.metro;
      if (geo && geo.error) return h("div", { className: "aid-map-fig" }, h("div", { className: "aid-warn" }, "Could not load the map data: " + geo.error));
      if (!M) return h("div", { className: "aid-map-fig" }, h("div", { className: "aid-note" }, "Loading the map…"));
      var selStop = pick && pick.kind === "stop" ? pick.stop : -1, selR = pick && (pick.kind === "trip" || pick.kind === "seg") ? pick.r : hovR, D = metroDots;
      return h("div", { className: "aid-map-fig" },
        h("div", { className: "aid-metro-wrap" },
          h("svg", { ref: metroRef, viewBox: "0 0 1000 " + M.H, className: "aid-metro-svg", role: "img", "data-aid": "metro-svg", onClick: onMetro,
            "aria-label": "Metro diagram: 13 routes as rows, trips and stops in their data order, interchanges connected; widths, rings and fades are kernel values" },
            h("g", { className: "aid-metro-links" }, M.links.map(function (l, i) { var on = l.s === selStop || l.a.r === selR || l.b.r === selR;
              return h("path", { key: i, d: "M" + l.a.x.toFixed(1) + "," + l.a.y + "L" + l.b.x.toFixed(1) + "," + l.b.y, className: "aid-metro-link" + (on ? " on" : "") }); })),
            M.row.map(function (rw, ri) { return h("g", { key: "r" + ri, className: "aid-metro-row" + (selR === ri ? " sel" : ""), "data-aid": "metro-row" },
              h("rect", { x: 2, y: rw.y - 9, width: 5, height: 18, rx: 2, fill: hue(ri) }),
              h("text", { x: 12, y: rw.y - 2, className: "aid-metro-rl" }, "Route " + (ri + 1)),
              h("text", { x: 12, y: rw.y + 11, className: "aid-metro-rv" }, (marks ? fmtN(marks.rph[ri]) : "…") + " dep/h")); }),
            marks ? M.segs.map(function (z) { var n = marks.tw[z.g], W = geo.trips[z.g].wins; return n ? h("path", { key: "t" + z.g, d: "M" + z.x0.toFixed(1) + "," + z.y + "H" + z.x1.toFixed(1), className: "aid-metro-tight", strokeWidth: segW(z.g) + 7, style: { opacity: .35 + .65 * n / W } }) : null; }) : null,
            M.segs.map(function (z) { var lv = marks ? marks.tl[z.g].live : true;
              return h("path", { key: "s" + z.g, d: "M" + z.x0.toFixed(1) + "," + z.y + "H" + z.x1.toFixed(1), stroke: hue(z.r), strokeWidth: segW(z.g), "data-aid": "metro-seg",
                className: "aid-metro-seg" + (lv ? "" : " off") + (pick && pick.kind === "seg" && pick.g === z.g ? " sel" : "") + (selR === z.r ? " rsel" : "") }); }),
            D ? [h("path", { key: "w", d: D.win, className: "aid-metro-win" }), h("path", { key: "wt", d: D.wt, className: "aid-metro-win tight" }),
              h("path", { key: "off", d: D.off, className: "aid-metro-stop off" }), h("path", { key: "on", d: D.on, className: "aid-metro-stop on" }),
              h("path", { key: "ioff", d: D.ioff, className: "aid-metro-stop ic off" }), h("path", { key: "ion", d: D.ion, className: "aid-metro-stop ic on" })] : null,
            selStop >= 0 ? (M.occ[selStop] || []).map(function (o, i) { return h("circle", { key: "p" + i, cx: o.x, cy: o.y, r: 7, className: "aid-map-pick" }); }) : null)),
        h("div", { className: "aid-map-legend", "data-aid": "map-legend" },
          h("span", null, h("i", { className: "sw line" }), "width = trip departures/hour ", me("trips[t].perHour"), " (cubed, vs the timetable)"),
          h("span", null, h("i", { className: "sw tightc" }), "amber casing = running trip with a window below the 165 s minimum ", me("win[w].tight"), marks ? " · " + marks.nTightTrip + " of " + (geo.trips.length - marks.nDead) + " running" : ""),
          h("span", null, h("i", { className: "sw strip" }), "ticks = its windows, amber = below the 165 s minimum", marks ? " · " + marks.nTightWin + " of " + marks.nWin : ""),
          h("span", null, h("i", { className: "sw faded" }), "dashed, hollow stops = ", me("trips[t].live"), " / ", me("st[j].served"), " false", marks ? " · " + marks.nDead + " trips" : ""),
          h("span", null, h("i", { className: "sw ic" }), "interchange · " + M.inter + " stops on 2+ routes")),
        h("div", { className: "aid-note", "data-aid": "map-status" }, !vals ? "Reading the kernel…" :
          fmt(geo.paths.length) + " paths read with me(path) in the worker in " + vals.ms + " ms after wave " + vals.seq + " · served stop_times " + (marks ? marks.nServedSt : 0) + " of " + fmt(geo.trips.reduce(function (a, t) { return a + t.stops.length; }, 0)))); };
    var GA = G.Atoms || {}, Btn = function (o, text) { var q2 = Object.assign({ type: "button", "data-gui-inspector-control": "true" }, o);
      return GA.Button ? h(GA.Button, Object.assign(q2, { variant: "outlined", size: "small", color: "inherit", disableElevation: true, sx: { textTransform: "none", minHeight: 28, py: .15, px: 1, borderRadius: "8px", fontSize: 12, lineHeight: 1.2, borderColor: "divider" } }), text) : h("button", q2, text); };
    var LABEL = "Schematic · positions generated by the benchmark (not geographic)";
    var head = [h("h2", { key: "h", id: "aid-map-h" }, "Map."),
      h("div", { key: "t", className: "aid-ctl aid-map-tabs", role: "tablist", "aria-label": "Map view", "data-aid": "map-tabs" },
        Btn({ role: "tab", "aria-selected": tab === "metro" ? "true" : "false", "aria-pressed": tab === "metro" ? "true" : "false", "data-aid": "tab-metro", onClick: function () { setTab("metro"); } }, "Metro · route order from the data"),
        Btn({ role: "tab", "aria-selected": tab === "schem" ? "true" : "false", "aria-pressed": tab === "schem" ? "true" : "false", "data-aid": "tab-schem", onClick: function () { setTab("schem"); } }, LABEL)),
      tab === "schem" ? h("div", { key: "l", className: "aid-map-label", "data-aid": "map-label" }, LABEL) : h("div", { key: "l", className: "aid-note", "data-aid": "map-label", style: { marginBottom: 8 } }, "One row per route: its 10 trips end to end (TRIPS order), each trip's stops in STOP_TIMES order. Grey connectors join the same stop on two routes. No coordinates are used.")];
    if (lst.scale && lst.scale !== 1) return h("section", { className: "aid-map", "aria-labelledby": "aid-map-h", "data-aid": "map" }, head, h("div", { className: "aid-note" }, "The map is drawn for scale 1; switch the demo to Scale 1 to see it."));
    var x = ex && ex.x, der = x && x.derivation;
    return h("section", { className: "aid-map", "aria-labelledby": "aid-map-h", "data-aid": "map" }, head,
      h("div", { className: "aid-map-grid" },
        tab === "metro" ? metroFig() : h("div", { className: "aid-map-fig" },
          geo && geo.error ? h("div", { className: "aid-warn" }, "Could not load the map data: " + geo.error) :
          h("svg", { ref: svgRef, viewBox: "-20 -20 1040 1040", className: "aid-map-svg", role: "img", "data-aid": "map-svg", onClick: onClick,
            "aria-label": "Schematic of the 13 routes and their stops at generated benchmark positions; values from the kernel" },
            h("rect", { x: -20, y: -20, width: 1040, height: 1040, className: "aid-map-bg" }),
            geo && !geo.error ? h("g", { className: "aid-map-lines" }, geo.trips.map(function (t, g) { var M = marks, ph = M ? M.rph[t.r] : 0, lv = M ? M.tl[g].live : true;
              return h("path", { key: g, d: t.d, stroke: "hsl(" + HUES[t.r % HUES.length] + " 70% 52%)", strokeWidth: M ? Math.max(.8, ph / 80) : 1.5, className: "aid-map-line" + (lv ? "" : " off") + (pick && pick.kind === "trip" && pick.r === t.r ? " sel" : "") }); })) : null,
            marks ? [h("path", { key: "off", d: marks.off, className: "aid-map-stop off" }), h("path", { key: "on", d: marks.on, className: "aid-map-stop on" }), h("path", { key: "ring", d: marks.ring, className: "aid-map-ring" })] : null,
            pick && pick.kind === "stop" && geo ? h("circle", { cx: geo.m.stops[pick.stop][0], cy: 1000 - geo.m.stops[pick.stop][1], r: 14, className: "aid-map-pick" }) : null),
          h("div", { className: "aid-map-legend", "data-aid": "map-legend" },
            h("span", null, h("i", { className: "sw line" }), "line width = ", me("routes[r].perHour")),
            h("span", null, h("i", { className: "sw on" }), "served (", me("st[j].served"), ")", marks ? " · " + marks.nOn : ""),
            h("span", null, h("i", { className: "sw off" }), "not served", marks ? " · " + marks.nOff : ""),
            h("span", null, h("i", { className: "sw ring" }), "tight (a ", me("win[w].tight"), " on a trip)", marks ? " · " + marks.nRing : ""),
            h("span", null, h("i", { className: "sw faded" }), "faded = ", me("trips[t].live"), " false")),
          h("div", { className: "aid-note", "data-aid": "map-status" }, !geo ? "Loading the map…" : !vals ? "Reading the kernel…" :
            fmt(geo.paths.length) + " paths read with me(path) in the worker in " + vals.ms + " ms after wave " + vals.seq + " · " + (marks ? marks.nUsed : 0) + " stops on trips (of " + fmt(geo.m.stops.length) + " in STOPS) · " + geo.trips.length + " trips")),
        h("div", { className: "aid-map-side" },
          h("h3", null, "Routes · departures/hour ", me("routes[r].perHour")),
          h("div", { className: "aid-map-routes", "data-aid": "map-routes" }, (geo && geo.m ? geo.m.routes : []).map(function (rt, ri) {
            return Btn({ key: ri, "data-aid": "map-route", "aria-pressed": pick && (pick.kind === "trip" || pick.kind === "seg") && pick.r === ri ? "true" : "false", onClick: function () { explainPath({ kind: "trip", r: ri, path: "routes." + (ri + 1) + ".perHour" }); } },
              h("span", { className: "aid-map-rt" }, h("i", { style: { background: "hsl(" + HUES[ri % HUES.length] + " 70% 52%)" } }), "Route " + (ri + 1) + " · " + (marks ? fmtN(marks.rph[ri]) : "…"))); })),
          h("div", { className: "aid-note" }, "Click a stop or a line on the map, or a route here: the card is ", me("me.explain(path)"), " from the kernel (", h("a", { href: "https://neurons-me.github.io/.me/docs/Explain.html", target: "_blank", rel: "noopener", className: "aid-doclink" }, "docs"), ")."),
          h("div", { className: "aid-map-card", "data-aid": "map-card", "aria-live": "polite" },
            !pick ? h("div", { className: "aid-note" }, "Nothing selected.") :
            h("div", null,
              h("div", { className: "aid-map-ct" }, pick.kind === "stop" ? "Stop #" + (pick.stop + 1) + " (STOPS row " + (pick.stop + 2) + ") · on " + pick.on + " trip" + (pick.on === 1 ? "" : "s") + " · explaining the first:" : pick.kind === "seg" ? "Route " + (pick.r + 1) + " · trip " + (geo.trips[pick.g].t + 1) : "Route " + (pick.r + 1)),
              me('me.explain("' + pick.path + '")'),
              !ex ? h("div", { className: "aid-note" }, "…") : ex.error ? h("div", { className: "aid-warn" }, ex.error) :
              h("div", { className: "aid-try-out" }, "value ", h("b", null, fmtV(x.value)),
                der && der.expression ? [h("br", { key: "b" }), me('"' + (der.expression.length > 160 ? der.expression.slice(0, 160) + "…" : der.expression) + '"')] : null,
                der && der.inputs && der.inputs.length ? [h("br", { key: "c" }), "inputs: ", der.inputs.slice(0, 4).map(function (q, i) { return h(React.Fragment, { key: i }, i ? " · " : null, me(String(q && q.path || q)), q && q.value !== undefined ? " = " + fmtV(q.value) : null); }),
                  nIn(der) > 4 ? " · inputs (first 4 shown of " + nIn(der) + (nIn(der) > der.inputs.length ? ", the worker passes " + der.inputs.length : "") + ")" : null] : null,
                x.meta && x.meta.k != null ? [h("br", { key: "d" }), "last wave k = " + fmt(x.meta.k)] : null))))));
  }
  // ── Question → How → Answer. The answer is read live from the worker's kernel with me(path); nothing is hardcoded.
  // Before = the values read while policy.factor is 1 and every service runs (the timetable); after = the values read now.
  function useLive() { var ls = useState(live.state()), lst = ls[0], setLst = ls[1];
    useEffect(function () { return live.subscribe(function (s) { setLst(Object.assign({}, s)); }); }, []); return lst; }
  var TEN = 0.9;
  function Question() {
    var GA = G.Atoms || {}, lst = useLive(), ready = lst.phase === "ready" && !!lst.info, f = lst.state ? lst.state.factor : 1;
    var Btn = function (o, text) { var q = Object.assign({ type: "button", "data-gui-inspector-control": "true" }, o);
      return GA.Button ? h(GA.Button, Object.assign(q, { disableElevation: true, sx: { textTransform: "none", borderRadius: "10px", fontWeight: 700 } }), text) : h("button", q, text); };
    var at10 = f === TEN;
    return h("section", { className: "aid-qa", "data-aid": "qa", "aria-labelledby": "aid-q" },
      h("div", { className: "aid-q" },
        h("div", { className: "aid-qk" }, "Question"),
        h("h2", { id: "aid-q" }, "If Madrid's buses came 10% more often, how much more service would the city get, and which routes would drop below the minimum safe headway?"),
        h("div", { className: "aid-qs" }, "Headway = time between buses · minimum 165 s · supply data only (no passengers, no traffic)."),
        h("div", { className: "aid-qbtns" },
          Btn({ variant: "contained", color: "primary", "data-aid": "qa-apply", disabled: !ready || at10, onClick: function () { live.apply("ten").catch(function () {}); } },
            at10 ? "Applied: buses 10% more often" : f === 1 ? "Apply: buses 10% more often" : "Set to 10% (headway × 0.9)"),
          Btn({ variant: "outlined", color: "inherit", "data-aid": "qa-reset", disabled: !ready || f === 1, onClick: function () { live.apply("timetable").catch(function () {}); } }, "Back to the timetable"),
          null)));
  }
  function Answer() {
    var SYN = window.MeSyntax || null, me = function (t) { return h("code", { className: "me-code" }, SYN ? SYN.render(h, t) : t); };
    var fmtV = function (v) { return typeof v === "number" ? String(Math.round(v * 1000) / 1000) : JSON.stringify(v); }, r1 = function (v) { return (Math.round(v * 10) / 10).toLocaleString("en-US"); };
    var lst = useLive(), info = lst.info, ready = (lst.phase === "ready" || lst.phase === "writing") && !!info;
    var plan = useMemo(function () { if (!info) return null; var P = ["policy.factor", "policy.minHeadway", "city.perHour"], R = info.routes.length, tw = [];
      for (var r = 1; r <= R; r++) P.push("routes." + r + ".perHour");
      info.services.forEach(function (x, i) { P.push("services." + (i + 1) + ".enabled"); });
      info.trips.forEach(function (x) { var p = "routes." + (x[0] + 1) + ".trips." + (x[1] + 1), t = { r: x[0], live: P.length, at: [], hw: [] }; P.push(p + ".live");
        for (var w = 1; w <= x[4]; w++) { t.at.push(P.length); P.push(p + ".win." + w + ".tight"); t.hw.push(P.length); P.push(p + ".win." + w + ".headway"); } tw.push(t); });
      return { P: P, R: R, S: info.services.length, tw: tw }; }, [info]);
    var vs = useState(null), cur = vs[0], setCur = vs[1], before = useRef(null);
    useEffect(function () { before.current = null; setCur(null); }, [info]);   // a new kernel (scale switch): new baseline
    useEffect(function () { if (!ready || !plan) return; var alive = true;
      live.read(plan.P).then(function (res) { if (!alive) return; var V = res.values, k = 3, o = { factor: V[0], floor: V[1], city: V[2], ms: res.ms, routes: [], off: [], trips: 0, wins: 0, nTrips: 0, nWins: 0 };
        for (var r = 0; r < plan.R; r++) o.routes.push({ r: r, ph: V[k++], trips: 0, wins: 0, nTrips: 0, nWins: 0, hw: 0, nHw: 0 });
        for (var s2 = 0; s2 < plan.S; s2++) { if (!V[k] && info.services[s2].trips) o.off.push(s2 + 1); k++; }
        plan.tw.forEach(function (t) { var R0 = o.routes[t.r]; t.hw.forEach(function (i) { R0.hw += V[i]; R0.nHw++; });
          if (!V[t.live]) return;   // only running trips count
          var n = 0; t.at.forEach(function (i) { if (V[i]) n++; }); R0.nTrips++; o.nTrips++; R0.nWins += t.at.length; o.nWins += t.at.length; if (n) { R0.trips++; o.trips++; } R0.wins += n; o.wins += n; });
        o.routes.forEach(function (q) { q.hw = q.nHw ? q.hw / q.nHw : 0; });
        if (o.factor === 1 && !o.off.length && !before.current) before.current = o; setCur(o); }, function () {});
      return function () { alive = false; }; }, [ready, plan, lst.waveSeq]);
    var xs = useState(null), ex = xs[0], setEx = xs[1];
    var explain = function (path, title) { setEx({ path: path, title: title }); live.explain(path).then(function (x) { setEx({ path: path, title: title, x: x }); }, function (e) { setEx({ path: path, title: title, error: e.message }); }); };
    useEffect(function () { if (ex && ready) explain(ex.path, ex.title); }, [lst.waveSeq]);
    var B = before.current, A = cur, at10 = A && A.factor === TEN, other = A && A.factor !== 1 && A.factor !== TEN;
    var lastHw = (lst.decisions || []).filter(function (d) { return d.write === "policy.factor"; }).slice(-1)[0];
    var down = A ? A.routes.filter(function (q) { return q.wins > 0; }) : [];
    var pct = B && A ? (A.city / B.city - 1) * 100 : 0, uni = B && A ? A.routes.map(function (q) { return Math.round((q.ph / B.routes[q.r].ph - 1) * 1000) / 10; }) : [];
    var uniform = uni.length && uni.every(function (u) { return u === uni[0]; });
    var x = ex && ex.x, der = x && x.derivation, nI = der ? nIn(der) : 0;
    var off = A && A.off.length ? h("div", { className: "aid-qn", "data-aid": "qa-suspended" }, "Service " + A.off.join(", ") + " is suspended (from the panel) — not part of the 10% question. Its trips are left out of the counts below and lower the departures/hour.",
      A.off.map(function (s2) { return h("button", { key: s2, type: "button", className: "aid-qbtn-s", "data-aid": "qa-resume", onClick: function () { live.service(s2, true).catch(function () {}); } }, "Resume service " + s2); })) : null;
    var state = !A ? " · reading the kernel…" : at10 ? " · after the decision (headway × 0.9)" : other ? " · current state is not the 10% question" : " · before the decision (timetable)";
    return h("section", { className: "aid-qa ans", "data-aid": "qa-answer-sec", "aria-labelledby": "aid-a" },
      h("div", { className: "aid-a", "data-aid": "qa-answer", "aria-live": "polite" },
        h("div", { className: "aid-qk", id: "aid-a" }, "Answer", h("span", { className: "aid-qstate" }, state)),
        !A || !B || !plan ? h("div", { className: "aid-note" }, ready ? "Reading the kernel…" : "Building the kernel" + (lst.target === 10 ? " (scale 10, a few seconds)" : "") + "…") : other ? h("div", null,
          h("div", { className: "aid-qn", "data-aid": "qa-other" }, "Current state: factor × " + A.factor + (lastHw ? " (from “" + lastHw.scenarioLabel + "”)" : "") + " — not the 10% question.",
            h("button", { type: "button", className: "aid-qbtn-s", "data-aid": "qa-set10", onClick: function () { live.apply("ten").catch(function () {}); } }, "Set to 10%")), off) : h("div", null,
          off,
          h("div", { className: "aid-akpis" },
            h("button", { type: "button", className: "aid-akpi", "data-aid": "qa-city", onClick: function () { explain("city.perHour", "City departures/hour = sum of the 13 routes"); } },
              h("small", null, "Service · departures/hour, city"), h("b", null, r1(B.city), at10 || A.off.length ? h("span", { className: "arr" + (A.city < B.city ? " dn" : "") }, " → " + r1(A.city)) : null),
              h("em", { className: at10 || A.off.length ? (pct >= 0 ? "up" : "dn") : "" }, at10 || A.off.length ? (pct >= 0 ? "+" + r1(pct) + "% more service" : r1(-pct) + "% less service") + (A.off.length ? " (includes the suspension)" : "") : "apply the decision to compare")),
            h("div", { className: "aid-akpi" + (A.wins ? " warn" : ""), "data-aid": "qa-tight" },
              h("small", null, "Below the 165 s minimum (" + Math.floor(A.floor / 60) + " min " + (A.floor % 60) + " s between buses)"),
              h("b", null, down.length + " of " + A.routes.length + " routes"),
              h("em", null, A.trips + " of " + A.nTrips + " running trips · " + A.wins + " of " + A.nWins + " time windows"))),
          !at10 && !A.off.length ? h("div", { className: "aid-note" }, (function () { var hs = A.routes.map(function (q) { return q.hw; }), lo = Math.min.apply(null, hs), hi = Math.max.apply(null, hs); return "Before: no window is below the 165 s minimum. Mean headway per route: " + (Math.round(lo) === Math.round(hi) ? "about " + r1(lo) : Math.round(lo) + "–" + Math.round(hi)) + " s."; })()) : null,
          down.length ? h("ul", { className: "aid-alist", "data-aid": "qa-routes" }, down.map(function (q) { return h("li", { key: q.r },
            h("button", { type: "button", "data-aid": "qa-route", "data-route": q.r + 1,
                "aria-label": "Route " + (q.r + 1) + ": " + q.wins + " of " + q.nWins + " time windows and " + q.trips + " of " + q.nTrips + " trips below 165 s. Headway " + Math.round(B.routes[q.r].hw) + " to " + Math.round(q.hw) + " s, " + r1(B.routes[q.r].ph) + " to " + r1(q.ph) + " departures per hour. Highlights the route in the figure and the map.",
                onMouseEnter: function () { hiRoute(q.r); }, onFocus: function () { hiRoute(q.r); }, onMouseLeave: function () { hiRoute(-1); }, onBlur: function () { hiRoute(-1); },
                onClick: function () { hiRoute(q.r, true); explain("routes." + (q.r + 1) + ".anyTight", "Route " + (q.r + 1) + " · any window below the 165 s minimum"); } },
              h("i", { style: { background: "hsl(" + HUES[q.r % HUES.length] + " 70% 52%)" } }), " ", h("b", null, "Route " + (q.r + 1)), " ",
              h("span", { className: "bar", title: q.wins + " of " + q.nWins + " windows below 165 s" }, h("span", { style: { width: Math.round(q.wins / q.nWins * 100) + "%" } })), " ",
              h("span", { className: "ct" }, q.wins + " of " + q.nWins + " windows · " + q.trips + " of " + q.nTrips + " trips below 165 s"), " ",
              h("span", { className: "ph" }, "headway " + Math.round(B.routes[q.r].hw) + " → " + Math.round(q.hw) + " s · " + r1(B.routes[q.r].ph) + " → " + r1(q.ph) + " dep/h"))); })) : null,
          at10 ? h("div", { className: "aid-note", "data-aid": "qa-uniform" }, uniform ? "Departures/hour " + (uni[0] >= 0 ? "rise" : "fall") + " by the same " + Math.abs(uni[0]) + "% on every route: one factor for all lines (departures/hour = 3600 / headway), so the change is uniform. What differs is how close each route's published headways already were to 165 s." : "Change per route: " + uni.join("% · ") + "%.") : null,
          h("div", { className: "aid-note aid-rel" }, "How the values relate: ", me("headway = base × policy.factor"), " → ", me("perHour = 3600 / headway"), " → trip → route → city; ", me("tight = headway < 165"), " → route ", me("anyTight"), ". Read with ", me("me(path)"), " in the worker: ", fmt(plan.P.length), " paths in " + A.ms + " ms · click a card or a row for ", me("me.explain(path)"), " (", h("a", { href: "https://neurons-me.github.io/.me/docs/Explain.html", target: "_blank", rel: "noopener", className: "aid-doclink" }, "docs"), ")."),
          ex ? h("div", { className: "aid-map-card", "data-aid": "qa-card" }, h("div", { className: "aid-map-ct" }, ex.title), me('me.explain("' + ex.path + '")'),
            !x ? (ex.error ? h("div", { className: "aid-warn" }, ex.error) : h("div", { className: "aid-note" }, "…")) :
            h("div", { className: "aid-try-out" }, "value ", h("b", null, fmtV(x.value)),
              der && der.expression ? [h("br", { key: "b" }), me('"' + (der.expression.length > 140 ? der.expression.slice(0, 140) + "…" : der.expression) + '"')] : null,
              der && der.inputs && der.inputs.length ? [h("br", { key: "c" }), "reads " + nI + " values" + (nI > der.inputs.length ? " (this page's worker passes the first " + der.inputs.length + ")" : "") + " · first: ", me(String(der.inputs[0] && der.inputs[0].path || der.inputs[0])), der.inputs[0] && der.inputs[0].value !== undefined ? " = " + fmtV(der.inputs[0].value) : null] : null,
              x.meta && x.meta.k != null ? [h("br", { key: "d" }), "last wave k = " + fmt(x.meta.k)] : null)) : null)));
  }
  // related pages, as image cards (the Smart Cities landing style)
  var RELATED = [
    ["https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html", "https://suign.github.io/assets/imgs/EXTREME-FAN-OUT.jpg", "Extreme Fan-Out", "The concept behind k: one write, every dependent value recomputes."],
    ["https://neurons-me.github.io/.me/docs/Benchmarks/GTFS/Madrid/", "https://suign.github.io/assets/imgs/MADRID-GRAPH-ME.jpg", "GTFS-Madrid benchmark", "The same feed measured at scale: build, write and read timings."],
    ["https://neurons-me.github.io/smart-cities/", "https://neurons-me.github.io/smart-cities/assets/SMART-CITIES-ME.jpg", "Smart Cities", "The other city demos on the same kernel."],
    ["https://neurons-me.github.io/robots/", "https://neurons-me.github.io/robots/assets/ROBOTS-CONTEXT-LAB.jpg", "Robots", "Robots that understand context: one object, four meanings, zero copies."]];
  // Read the syntax: two explanatory notes (not buttons). Only "Learn more →" is a link. Examples checked on this.me 4.2.1.
  var SYNTAX = [
    ["https://neurons-me.github.io/.me/docs/me-whatever-what.html", "me.whatever(what)", [["me", 'me("routes.1.perHour")'], " reads a path; writing it is ", ["me", "me.routes[1].perHour(value)"], "."], "Learn more about paths"],
    ["https://neurons-me.github.io/.me/docs/Explain.html", "me.explain(path)", ["Shows the inputs and last change behind a value, like a route's headway: ", ["me", 'me.explain("routes.1.trips.1.win.1.headway")'], "."], "Learn more about explain"]];
  function Syntax(p) {
    var SYN = window.MeSyntax || null;
    var code = function (t, k) { return h("code", { key: k, className: "me-code aid-syn-c" }, !SYN ? t : SYN.tokenize ? SYN.tokenize(t).map(function (x, i) { return x.c ? h("span", { key: i, className: x.c }, x.v) : x.v; }) : SYN.render(h, t)); };
    return h("section", { className: "aid-syn", "data-gui-node-id": p["data-gui-node-id"], "data-aid": "syntax", "aria-label": "Read the syntax" },
      h("small", { className: "aid-syn-l" }, "Read the syntax"),
      h("div", { className: "aid-syn-row" }, SYNTAX.map(function (c) { return h("div", { key: c[0], className: "aid-syn-card", "data-aid": "syntax-card" },
        h("div", { className: "aid-syn-h" }, code(c[1], "h")),
        h("p", { className: "aid-syn-p" }, c[2].map(function (x, i) { return typeof x === "string" ? x : code(x[1], i); })),
        h("a", { className: "aid-syn-more", href: c[0], "aria-label": c[3] }, "Learn more \u2192")); })));
  }
  function Related(p) {
    return h("section", { className: "aid-rel-cards", "data-gui-node-id": p["data-gui-node-id"], "data-aid": "related", "aria-labelledby": "aid-rel-h" },
      h("h2", { id: "aid-rel-h" }, "Related"),
      h("div", { className: "aid-cards" }, RELATED.map(function (c) { return h("a", { key: c[0], className: "aid-card2", href: c[0], "data-aid": "related-card" },
        h("span", { className: "img" }, h("img", { src: c[1], alt: "", loading: "lazy", decoding: "async" })),
        h("span", { className: "tx" }, h("b", null, c[2]), h("small", null, c[3]))); })));
  }
  var N = function (type, id, props, children) { return Object.assign({ type: type, props: Object.assign({}, props || {}, { "data-gui-node-id": id }) }, children ? { children: children } : {}); };
  // never blank the page: a component that throws is replaced by a message, the rest keeps rendering
  function Boundary(props) { React.Component.call(this, props); this.state = { err: null }; }
  Boundary.prototype = Object.create(React.Component.prototype); Boundary.prototype.constructor = Boundary;
  Boundary.getDerivedStateFromError = function (err) { return { err: err }; };
  Boundary.prototype.componentDidCatch = function (err) { try { console.warn("[AI-Decides] " + this.props.name + " failed:", err); } catch (e) {} };
  Boundary.prototype.render = function () { var self = this; if (!this.state.err) return this.props.children;
    return h("div", { className: "aid-note aid-warn", role: "alert", "data-aid": "boundary", style: { padding: "10px 12px", border: "1px dashed currentColor", borderRadius: 10, margin: "8px 0" } }, this.props.name + " could not render: " + String(this.state.err && this.state.err.message || this.state.err) + ". ",
      h("button", { type: "button", className: "aid-qbtn-s", onClick: function () { self.setState({ err: null }); } }, "Retry"), " ",
      h("button", { type: "button", className: "aid-qbtn-s", onClick: function () { live.build(1).catch(function () {}); self.setState({ err: null }); } }, "Back to scale 1")); };
  var Safe = function (name, Comp) { return function (p) { return h(Boundary, { name: name }, h(Comp, p)); }; };
  Question = Safe("Question", Question); How = Safe("How", How); Answer = Safe("Answer", Answer);
  var pageType = function (type, Comp) { return { type: type, resolve: function (spec) { var p = Object.assign({}, spec.props || {}); delete p.key; return h(Boundary, { name: type.replace(/^AID/, "") }, h(Comp, p)); } }; };
  var spec = N("Box", "page", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary" } }, [
    N("AIDTopBar", "topbar"),
    N("Box", "main", { component: "main", sx: { maxWidth: 1180, mx: "auto", px: { xs: 2, sm: 4 }, pt: { xs: 3, sm: 4.5 }, pb: 8 } }, [
      N("Typography", "kicker", { component: "p", sx: { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1 } }, ["Smart Cities · GTFS-Madrid-Bench"]),
      N("Typography", "title", { component: "h1", sx: { fontSize: "clamp(2rem, 5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 3 } }, ["AI decides, .me computes"]),
      N("AIDDashboard", "ai-decides"),
      N("AIDSyntax", "syntax"),
      N("AIDMap", "map"),
      N("AIDNotes", "notes"),
      N("AIDRelated", "related"),
    ]),
  ]);
  var scope = window.__thisGuiThemeScope || {};
  var mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; if (params.get("mode")) localStorage.setItem(scope.themeModeKey, mode); } catch (e) {}
  var PageTheme = function (p) { return h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, p.children); };
  var INSPECTOR_ON = params.get("inspector") === "1"; if (G.getInspectorEnabled() !== INSPECTOR_ON) G.setInspectorEnabled(INSPECTOR_ON);
  var reg = Object.assign({}, G.Registry || G.registry); [["AIDTopBar", TopBar], ["AIDDashboard", Dashboard], ["AIDNotes", Notes], ["AIDHow", How], ["AIDMap", CityMap], ["AIDRelated", Related], ["AIDSyntax", Syntax], ["AIDQuestion", Question], ["AIDAnswer", Answer]].forEach(function (x) { reg[x[0]] = pageType(x[0], x[1]); });
  // render / RunMe left out: mount() must not wrap the worker facade in a full runtime (Explain is answered by the worker)
  G.mount(spec, ROOT, { me: window.AIDecidesKernel, gui: Object.assign({}, G, { render: undefined, RunMe: undefined, Theme: PageTheme, registry: reg }), devtools: { enabled: true, inspector: INSPECTOR_ON, adminView: false, inspectorToggleVisible: false } });
  document.documentElement.classList.add("gui-on");
  window.__aid = { live: live, perf: PERF };
})();
