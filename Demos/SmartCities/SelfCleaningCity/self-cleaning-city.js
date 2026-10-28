/*! Self-Cleaning City 0.1.0 · waste robots and bin sensors held in a this.me 4.2.1 kernel · MIT · neurons.me
 * The kernel (this.me 4.2.1 from npm, sha256 checked in the browser by /.me/assets/me-kernel/me-kernel.js) holds the city:
 * six colonias, each with its own collection colonias[c].bins[k].fill (a sensor), the rule colonias[c].bins[i].full =
 * fill >= city.threshold, and per-colonia aggregates colonias[i].avgFill = colonias[i].bins[].fill / colonias[i].bins[]
 * and colonias[i].fullN = colonias[i].bins[].full (a boolean field sums as its count of true). Robots carry battery, load,
 * dist and a pointer robots[r].target -> colonias.c.bins.k; targetFill and eta are rules. A bin write re-scans only its
 * own colonia's bins. Each colonia's data is sealed for that colonia OR city ops with ME.wrapSecretV1.
 */
(function () {
  var G = window.GUI, React = window.React, ROOT = document.getElementById("root"), MK = window.MeKernel;
  if (!G || !React || !window.ReactDOM || typeof G.mount !== "function" || !ROOT || !MK) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", KV = MK.KERNEL.version, KL = MK.KERNEL.label;
  var params = new URLSearchParams(location.search);
  var SRC_URL = "https://github.com/neurons-me/.me/blob/main/Demos/SmartCities/SelfCleaningCity/self-cleaning-city.js", SRC_NAME = "self-cleaning-city.js";
  var DOCS = "https://neurons-me.github.io/.me/docs/", L_OPS = DOCS + "Operators.html", L_EXP = DOCS + "Explain.html", L_PTR = DOCS + "Pointer-Composition.html",
    L_AUD = DOCS + "Audiences.html", L_PATHS = DOCS + "me-whatever-what.html", L_OK = DOCS + "O-k.html", L_AGG = DOCS + "Aggregates.html";

  // ── the city: six colonias in a 3 × 2 layout, a street grid every 60 px, a recycling depot between them ──
  var W = 1200, H = 720, PXM = 2, ST = 60;
  var COL = [{ name: "Centro", x: 20, y: 20 }, { name: "Roma", x: 410, y: 20 }, { name: "Condesa", x: 800, y: 20 }, { name: "Juárez", x: 20, y: 380 }, { name: "Doctores", x: 410, y: 380 }, { name: "Narvarte", x: 800, y: 380 }];
  COL.forEach(function (c, i) { c.id = i + 1; c.w = 380; c.h = 320; });
  var DEPOT = { x: 600, y: 360 }, NB = Math.max(4, Math.min(12, +params.get("bins") || 8));
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  var BINS = []; (function () { var R = rng(11); COL.forEach(function (c) { for (var k = 1; k <= NB; k++) {
    var gx = Math.round((c.x + 30 + R() * (c.w - 60)) / ST) * ST, gy = Math.round((c.y + 30 + R() * (c.h - 60)) / ST) * ST; gx = Math.min(c.x + c.w - 20, Math.max(c.x + 20, gx)); gy = Math.min(c.y + c.h - 20, Math.max(c.y + 20, gy));
    var horiz = R() < .5, x = horiz ? gx + (R() - .5) * 40 : gx + 10, y = horiz ? gy + 10 : gy + (R() - .5) * 40;
    BINS.push({ c: c.id, k: k, x: x, y: y, rate: .6 + R() * 1.8 + (c.name === "Centro" ? .8 : 0), fill: Math.round(10 + R() * 55), w: 0, assigned: 0 }); } }); })();
  var BIN = function (c, k) { return BINS[(c - 1) * NB + (k - 1)]; };
  var BP = function (b) { return "colonias." + b.c + ".bins." + b.k; };
  function colAt(x, y) { for (var i = 0; i < COL.length; i++) { var c = COL[i]; if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c.id; } return 0; }
  // Manhattan route along the street grid: to the nearest street, along x, then along y
  function manhattan(ax, ay, bx, by) { var sx = Math.round(ax / ST) * ST, sy = Math.round(ay / ST) * ST, ex = Math.round(bx / ST) * ST, ey = Math.round(by / ST) * ST;
    var pts = [[ax, ay], [ax, sy], [ex, sy], [ex, ey], [bx, ey], [bx, by]], out = [pts[0]]; pts.slice(1).forEach(function (p) { var l = out[out.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) > .5) out.push(p); }); return out; }
  function polyLen(p, i0) { var L = 0; for (var i = i0 || 0; i < p.length - 1; i++) L += Math.abs(p[i + 1][0] - p[i][0]) + Math.abs(p[i + 1][1] - p[i][1]); return L / PXM; }

  // ── the kernel side ──
  var K = { me: null, N: Math.max(3, Math.min(200, +params.get("n") || 12)), writes: 0, lastMs: 0, subs: [], status: "loading", ver: 0, t0: performance.now(), recomputes: 0, trace: null, traces: [], seq: 0, agg: params.get("agg") !== "0" };
  function emit() { K.ver++; K.subs.forEach(function (f) { f(K.ver); }); }
  function nodeAt(path) { var p = K.me; path.split(".").forEach(function (s) { p = p[s]; }); return p; }
  var wms = { n: 0, sum: 0, bin: { n: 0, sum: 0 }, robot: { n: 0, sum: 0 } };
  function write(path, v) { var t = performance.now(); nodeAt(path)(v); K.writes++; var d = performance.now() - t; K.lastMs = d; wms.n++; wms.sum += d; var g = path.indexOf("colonias.") === 0 ? wms.bin : path.indexOf("robots.") === 0 ? wms.robot : null; if (g) { g.n++; g.sum += d; } }
  function point(path, target) { var t = performance.now(); nodeAt(path)["->"](target); K.writes++; K.lastMs = performance.now() - t; wms.n++; wms.sum += K.lastMs; }
  function read(path) { return K.me ? K.me(path) : undefined; }
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var aggOn = function () { return K.agg && K.N <= 40; };   // fleet aggregates over robots[]; the per-colonia ones are always on (8 bins each)
  function probeFor(path) { var m = /^colonias\.(\d+)\.bins\.(\d+)\.fill$/.exec(path); if (m) return "colonias." + m[1] + ".fullN";
    m = /^robots\.(\d+)\.(\w+)$/.exec(path); if (m) return "robots." + m[1] + "." + (m[2] === "dist" || m[2] === "speed" ? "eta" : "canTake");
    if (path === "city.threshold") return "colonias.1.fullN"; return null; }
  function trace(path, v, pr, label) { var ex = K.me.explain(pr), m = ex && ex.meta; if (!m || m.sourcePath !== path || !m.recomputed) return null;
    var tr = { id: ++K.seq, path: path, value: v, recomputed: m.recomputed.slice(), changed: (m.changed || []).slice(), label: label || null, t: performance.now() };
    K.recomputes += tr.recomputed.length; if (label !== false) { K.trace = tr; K.traces.unshift(tr); if (K.traces.length > 8) K.traces.pop(); } fx.trace(tr, label === false); return tr; }
  function traced(path, v, label) { write(path, v); var pr = probeFor(path); return pr && K.me ? trace(path, v, pr, label) : null; }
  var lite = function () { return K.N > 40; };
  function simWrite(path, v) { if (lite()) write(path, v); else traced(path, v, false); }
  function seed(ME) {
    var me = new ME(), N = K.N, t = performance.now(); K.me = null;
    me.city.name("Self-Cleaning City"); me.city.threshold(80); me.city.reserve(20); me.city.collected(0);
    COL.forEach(function (c) { var C = me.colonias[c.id]; C.name(c.name); C.bins["[i]"]["="]("full", "fill >= city.threshold"); });
    BINS.forEach(function (b, i) { b.fill = Math.round(10 + ((i * 37) % 55)); b.w = b.fill; b.assigned = 0; me.colonias[b.c].bins[b.k].fill(b.fill); me.colonias[b.c].bins[b.k].assigned(0); });
    me.colonias["[i]"]["="]("avgFill", "colonias[i].bins[].fill / colonias[i].bins[]");
    me.colonias["[i]"]["="]("fullN", "colonias[i].bins[].full");
    me.colonias["[i]"]["="]("pressure", "fullN * 10 + avgFill");
    me.city["="]("avgFill", "colonias[].avgFill / colonias[]");
    me.city["="]("fullBins", "colonias[].fullN");
    me.robots["[i]"]["="]("canTake", "battery > city.reserve && load < 80 && !busy");
    me.robots["[i]"]["="]("eta", "dist / speed");
    me.robots["[i]"]["="]("targetFill", "target.fill");
    me.depot.fill(0); bots = [];
    for (var n = 1; n <= N; n++) { var r = me.robots[n], sp = r1(2.6 + (n % 4) * .3), a = n / N * Math.PI * 2, x = DEPOT.x + Math.cos(a) * 26, y = DEPOT.y + Math.sin(a) * 18;
      r.battery(60 + (n * 17) % 40); r.load(0); r.speed(sp); r.dist(0); r.busy(0); r.collecting(false); r.target["->"]("depot");
      bots.push({ id: n, x: x, y: y, path: null, seg: 0, t: 0, sp: sp, phase: "idle", bin: null, wait: (n % 5) * .2, pulse: 0, ang: 0, brush: 0 }); }
    if (aggOn()) { me.city["="]("working", "robots[].collecting"); me.city["="]("available", "robots[].canTake"); me.city["="]("avgLoad", "robots[].load / robots[]"); }
    K.me = me; K.seedMs = performance.now() - t; K.writes = 0; K.recomputes = 0; K.traces = []; K.trace = null; K.t0 = performance.now(); wms.n = 0; wms.sum = 0; wms.bin = { n: 0, sum: 0 }; wms.robot = { n: 0, sum: 0 };
  }
  var ME_CLASS = null;
  MK.load().then(function (ME) { ME_CLASS = ME; seed(ME); K.status = "ok"; emit(); audiences.seal(); }, function (e) { K.status = "error"; K.error = String(e && e.message || e); emit(); });
  function rescale(n, agg) { if (!ME_CLASS) return; K.N = n; if (agg != null) K.agg = agg; select(null); seed(ME_CLASS); emit(); audiences.seal(); }
  window.SelfCleaningKernel = { explain: function (p) { return K.me ? K.me.explain(p) : null; }, read: read };

  // ── bins fill on their own (sensor writes every 5 %); robots are dispatched to full bins of the colonia under most pressure ──
  var bots = [];
  var RP = function (b) { return "robots." + b.id; };
  function go(b, x, y) { b.path = manhattan(b.x, b.y, x, y); b.seg = 0; b.t = 0; simWrite(RP(b) + ".dist", r1(polyLen(b.path))); }
  function pressureOrder() { return COL.map(function (c) { return { c: c.id, p: read("colonias." + c.id + ".pressure") || 0 }; }).sort(function (a, b) { return b.p - a.p; }); }
  function assign(b, bin, label) { if (b.bin) b.bin.assigned = 0; b.bin = bin; bin.assigned = b.id; b.phase = "toBin";
    write(RP(b) + ".busy", 1); write(RP(b) + ".collecting", true); write(BP(bin) + ".assigned", b.id); point(RP(b) + ".target", BP(bin)); go(b, bin.x, bin.y); fx.link(b, bin); }
  function dispatch() {
    var order = pressureOrder(), want = [];
    order.forEach(function (o) { BINS.forEach(function (bin) { if (bin.c === o.c && !bin.assigned && read(BP(bin) + ".full") === true) want.push(bin); }); });
    if (!want.length) return; var free = bots.filter(function (b) { return b.phase === "idle" && read(RP(b) + ".canTake") === true; });
    want.slice(0, lite() ? 40 : 6).forEach(function (bin) { if (!free.length) return; var bi = 0, bd = 1e9; free.forEach(function (b, x) { var d = Math.abs(b.x - bin.x) + Math.abs(b.y - bin.y); if (d < bd) { bd = d; bi = x; } }); assign(free.splice(bi, 1)[0], bin); });
  }
  function arrive(b) {
    if (b.phase === "toBin" && b.bin) { var bin = b.bin, f = read(BP(bin) + ".fill") || 0; b.phase = "emptying"; b.wait = .9; b.brush = 1; b.got = f; return; }
    if (b.phase === "toDepot") { b.phase = "unloading"; b.wait = 1; return; }
    b.phase = "idle";
  }
  function finishEmpty(b) { var bin = b.bin; if (!bin) { b.phase = "idle"; return; } var load = read(RP(b) + ".load") || 0, nl = Math.min(100, Math.round(load + (b.got || 0) * .35));
    bin.fill = 0; bin.w = 0; bin.assigned = 0; simWrite(BP(bin) + ".fill", 0); write(BP(bin) + ".assigned", 0); write(RP(b) + ".load", nl); write("city.collected", (read("city.collected") || 0) + 1); fx.clean(bin);
    b.bin = null; write(RP(b) + ".collecting", false); point(RP(b) + ".target", "depot"); var bat = read(RP(b) + ".battery"); simWrite(RP(b) + ".battery", r1(Math.max(1, bat - 3)));
    if (nl >= 80 || read(RP(b) + ".battery") < 30) { b.phase = "toDepot"; go(b, DEPOT.x + (b.id % 5 - 2) * 10, DEPOT.y + 8); } else { b.phase = "idle"; write(RP(b) + ".busy", 0); } }
  function step(dt, now) {
    if (!K.me) return; var w0 = K.writes;
    BINS.forEach(function (bin) { if (bin.assigned && bin.fill >= 100) return; bin.fill = Math.min(100, bin.fill + bin.rate * dt * (T.market && T.market.c === bin.c ? 6 : 1));
      if (bin.fill - bin.w >= 5 || (bin.fill >= 100 && bin.w < 100)) { bin.w = Math.round(bin.fill); simWrite(BP(bin) + ".fill", bin.w); } });
    if (T.market && now > T.market.until) T.market = null;
    bots.forEach(function (b) {
      if (b.path) { var A = b.path[b.seg], B = b.path[b.seg + 1], len = Math.abs(B[0] - A[0]) + Math.abs(B[1] - A[1]) || 1; b.t += dt * b.sp * PXM * 9 / len;
        if (b.t >= 1) { b.seg++; b.t = 0; if (b.seg >= b.path.length - 1) { b.x = B[0]; b.y = B[1]; b.path = null; write(RP(b) + ".dist", 0); arrive(b); } else if (!lite()) simWrite(RP(b) + ".dist", r1(polyLen(b.path, b.seg))); }
        if (b.path) { var P0 = b.path[b.seg], P1 = b.path[b.seg + 1]; b.x = P0[0] + (P1[0] - P0[0]) * b.t; b.y = P0[1] + (P1[1] - P0[1]) * b.t; var ta = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]), da = ta - b.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; b.ang += da * Math.min(1, dt * 10); } }
      else if (b.phase === "emptying") { b.brush = Math.max(0, b.brush - dt); if ((b.wait -= dt) <= 0) finishEmpty(b); }
      else if (b.phase === "unloading") { if ((b.wait -= dt) <= 0) { write(RP(b) + ".load", 0); simWrite(RP(b) + ".battery", r1(Math.min(100, read(RP(b) + ".battery") + 40))); b.phase = "idle"; write(RP(b) + ".busy", 0); fx.at(DEPOT.x, DEPOT.y, "unload"); } }
    });
    if ((T.disp += dt) >= .4) { T.disp = 0; dispatch(); }
    if (K.writes !== w0 && (T.emit += dt) > .15) { T.emit = 0; emit(); }
  }
  var T = { disp: 0, emit: 0, market: null };

  // user actions: each one is a kernel write; the panel and the map show what the kernel says recomputed
  var actions = {
    fill: function (c, k) { var bin = BIN(c || 1, k || 3); bin.fill = 96; bin.w = 96; var tr = traced(BP(bin) + ".fill", 96, "bin " + c + "." + k + " → 96 %"); select({ type: "bin", c: bin.c, k: bin.k }); emit(); return tr; },
    market: function (c) { c = c || 1; T.market = { c: c, until: performance.now() + 6000 }; var all = { id: ++K.seq, path: "colonias." + c + ".bins[].fill", value: "+40", recomputed: [], changed: [], label: "market day in " + COL[c - 1].name, t: performance.now(), moved: 0 };
      BINS.forEach(function (bin) { if (bin.c !== c) return; bin.fill = Math.min(100, bin.fill + 40); bin.w = Math.round(bin.fill); write(BP(bin) + ".fill", bin.w); var ex = K.me.explain("colonias." + c + ".pressure"), m = ex && ex.meta;
        if (m && m.recomputed) { all.recomputed = all.recomputed.concat(m.recomputed); all.changed = all.changed.concat(m.changed || []); } });
      // re-allocate: robots heading to a colonia under less pressure turn to this one
      var pc = read("colonias." + c + ".pressure"); bots.forEach(function (b) { if (all.moved >= 3 || b.phase !== "toBin" || !b.bin || b.bin.c === c) return; if ((read("colonias." + b.bin.c + ".pressure") || 0) >= pc) return;
        var tgt = BINS.filter(function (x) { return x.c === c && !x.assigned && read(BP(x) + ".full") === true; })[0]; if (!tgt) return; assign(b, tgt); all.moved++; });
      var uq = function (a) { return a.filter(function (p, x) { return a.indexOf(p) === x; }); }; all.recomputed = uq(all.recomputed); all.changed = uq(all.changed); all.reroutes = all.moved;
      K.recomputes += all.recomputed.length; K.trace = all; K.traces.unshift(all); if (K.traces.length > 8) K.traces.pop(); fx.colonia(c, all); select({ type: "colonia", c: c }); emit(); return all; },
    threshold: function () { var v = read("city.threshold") === 80 ? 60 : 80; var tr = traced("city.threshold", v, "city.threshold → " + v); emit(); return tr; },
  };

  // ── effects: glow pulses and ripples drawn from meta.recomputed ──
  var FX = [], fx = {
    at: function (x, y, kind) { FX.push({ x: x, y: y, kind: kind, t: performance.now() }); if (FX.length > 400) FX.splice(0, FX.length - 400); },
    line: function (x1, y1, x2, y2, kind, delay) { FX.push({ x: x1, y: y1, x2: x2, y2: y2, kind: kind || "ripple", t: performance.now() + (delay || 0) }); },
    where: function (p) { var m = /^colonias\.(\d+)\.bins\.(\d+)\./.exec(p); if (m) { var bin = BIN(+m[1], +m[2]); return bin ? { x: bin.x, y: bin.y, bin: bin } : null; }
      m = /^colonias\.(\d+)/.exec(p); if (m) { var c = COL[m[1] - 1]; return c ? { x: c.x + 60, y: c.y + 26, col: c } : null; }
      m = /^robots\.(\d+)\./.exec(p); if (m) { var b = bots[m[1] - 1]; return b ? { x: b.x, y: b.y, b: b } : null; }
      if (/^city\./.test(p)) return { x: DEPOT.x, y: DEPOT.y - 30 }; return null; },
    trace: function (tr, quiet) { var src = fx.where(tr.path) || { x: DEPOT.x, y: DEPOT.y }, seen = {}, n = 0;
      if (quiet) { tr.recomputed.forEach(function (p) { var w = fx.where(p); if (w && w.col) w.col.pulse = performance.now(); }); return; }
      tr.recomputed.forEach(function (p) { var w = fx.where(p); if (!w) return; var key = Math.round(w.x) + "," + Math.round(w.y); if (w.b) w.b.pulse = performance.now() + n * 25; if (w.col) w.col.pulse = performance.now() + n * 25;
        if (!seen[key] && (Math.abs(w.x - src.x) + Math.abs(w.y - src.y) > 4)) { seen[key] = 1; if (n < 200) fx.line(src.x, src.y, w.x, w.y, "ripple", n * 18); } n++; });
      fx.at(src.x, src.y, "src"); },
    link: function (b, bin) { fx.line(b.x, b.y, bin.x, bin.y, "assign"); },
    clean: function (bin) { fx.at(bin.x, bin.y, "clean"); },
    colonia: function (c, all) { var C = COL[c - 1], x = C.x + C.w / 2, y = C.y + C.h / 2; fx.at(x, y, "market");
      (all.recomputed || []).forEach(function (p, n) { var w = fx.where(p); if (w) { if (w.col) w.col.pulse = performance.now() + n * 30; fx.line(x, y, w.x, w.y, "ripple", n * 20); } }); },
  };

  // ── audiences: each colonia's bins → that colonia OR city ops; the fleet → city ops; OR = one ME.wrapSecretV1 per member ──
  var AUD = COL.map(function (c) { return { k: "c" + c.id, label: c.name + " bins", members: [c.name, "city ops"] }; }).concat([{ k: "fleet", label: "fleet", members: ["city ops"] }]);
  var PARTIES = COL.map(function (c) { return c.name; }).concat(["city ops", "outsider"]);
  var audiences = { keys: null, wraps: null, view: params.get("as") || "city ops", results: {}, busy: false, sealedAt: 0, ms: 0, subs: [],
    payload: function (k) { if (k === "fleet") return bots.slice(0, 20).map(function (b) { return { robot: b.id, load: read(RP(b) + ".load"), battery: read(RP(b) + ".battery") }; });
      var c = +k.slice(1); return { colonia: COL[c - 1].name, avgFill: r1(read("colonias." + c + ".avgFill") || 0), fullN: read("colonias." + c + ".fullN"), bins: BINS.filter(function (b) { return b.c === c; }).map(function (b) { return b.w; }) }; },
    seal: function () { var A = audiences, ME = ME_CLASS; if (!ME || A.busy || typeof ME.wrapSecretV1 !== "function") return; A.busy = true; var t0 = performance.now();
      var mk = A.keys ? Promise.resolve(A.keys) : Promise.all(PARTIES.map(function () { return ME.generateP256KeyPair(); })).then(function (ks) { var o = {}; PARTIES.forEach(function (p, x) { o[p] = ks[x]; }); return (A.keys = o); });
      mk.then(function (keys) { var wr = {};
        return Promise.all(AUD.map(function (au) { var secret = JSON.stringify(A.payload(au.k)); wr[au.k] = {};
          return Promise.all(au.members.map(function (m) { return ME.wrapSecretV1({ secret: secret, recipientPublicKey: keys[m].publicKey, kid: m, class: "identity-key" }).then(function (w) { wr[au.k][m] = w; }); })); }))
          .then(function () { A.wraps = wr; A.sealedAt = Date.now(); A.ms = performance.now() - t0; return A.open(A.view); }); })
        .catch(function (e) { A.error = String(e && e.message || e); }).then(function () { A.busy = false; A.emit(); }); },
    open: function (who) { var A = audiences, ME = ME_CLASS; A.view = who; if (!A.wraps) return Promise.resolve();
      return Promise.all(AUD.map(function (au) { var mine = au.members.indexOf(who) >= 0, w = A.wraps[au.k][mine ? who : au.members[0]];
        return ME.unwrapSecretV1(w, A.keys[who].privateKey, "utf8").then(function (txt) { return { ok: true, text: txt, kid: w.kid }; },
          function (e) { return { ok: false, err: e && e.name ? e.name + (e.message && e.message !== e.name ? ": " + e.message : "") : String(e), kid: w.kid }; }); }))
        .then(function (rs) { AUD.forEach(function (au, x) { A.results[au.k] = rs[x]; }); A.emit(); }); },
    can: function (k) { var r = audiences.results[k]; return !audiences.wraps || !!(r && r.ok); },
    emit: function () { audiences.subs.forEach(function (f) { f(Date.now()); }); emit(); } };

  // ── page CSS (theme tokens only) ──
  var DIV = "var(--mui-palette-divider,rgba(128,128,128,.3))", TX2 = "var(--mui-palette-text-secondary,#8b949e)", PRI = "var(--mui-palette-primary-main,#58a6ff)", PAPER = "var(--mui-palette-background-paper,transparent)";
  var CSS = [
    ".sc-dash{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}",
    "@media (min-width:980px){.sc-dash{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}.sc-side{grid-column:1;grid-row:1}.sc-right{grid-column:2;grid-row:1;position:sticky;top:60px;max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}}",
    "@media (max-width:979px){.sc-right{order:-1}}",
    ".sc-fig{position:relative;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:var(--mui-palette-background-default,transparent)}.sc-fig canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation}",
    ".sc-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 0}.sc-btn{font:inherit;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.4));background:transparent;color:inherit;cursor:pointer}.sc-btn:hover{border-color:" + PRI + "}.sc-btn.on{color:" + PRI + ";border-color:currentColor}.sc-btn:disabled{opacity:.5;cursor:default}.sc-sep{flex:1}",
    ".sc-seg{display:inline-flex;border:1px solid " + DIV + ";border-radius:8px;overflow:hidden}.sc-seg .sc-btn{border:0;border-radius:0}.sc-seg .sc-btn+.sc-btn{border-left:1px solid " + DIV + "}",
    ".sc-panel{margin-top:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media (min-width:1240px){.sc-panel{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}",
    ".sc-card{border:1px solid " + DIV + ";border-radius:12px;background:" + PAPER + ";font-size:13px;padding:10px 12px;min-width:0}.sc-h{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:" + TX2 + "}",
    ".sc-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.sc-kpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;padding:6px 8px;border:1px solid " + DIV + ";border-radius:9px;cursor:pointer;min-width:0}.sc-kpi:hover,.sc-kpi:focus-visible,.sc-kpi[aria-pressed=true]{border-color:" + PRI + "}.sc-kpi b{font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}.sc-kpi small{font-size:11px;color:" + TX2 + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sc-row{display:flex;justify-content:space-between;gap:10px;line-height:1.6;min-width:0}.sc-row>span:first-child{color:" + TX2 + ";min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}",
    ".sc-note{margin-top:6px;font-size:12px;line-height:1.5;color:" + TX2 + "}.sc-note a,.sc-side a,.sc-k a{color:" + PRI + ";text-decoration:none}.sc-note a:hover,.sc-side a:hover,.sc-k a:hover{text-decoration:underline}",
    ".sc-json{margin:6px 0 0;padding:8px;max-height:280px;overflow:auto;border-radius:8px;border:1px solid " + DIV + ";font:11px/1.5 " + MONO + ";white-space:pre;color:var(--mui-palette-text-primary,inherit)}",
    ".sc-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 0}.sc-tab{font:11.5px " + MONO + ";padding:3px 8px;border-radius:999px;border:1px solid " + DIV + ";background:transparent;color:" + TX2 + ";cursor:pointer}.sc-tab.on{color:var(--mui-palette-text-primary,inherit);border-color:" + PRI + "}",
    ".sc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:84px;overflow:auto}.sc-chip{font:10.5px " + MONO + ";padding:1px 6px;border-radius:6px;border:1px solid " + DIV + ";color:" + TX2 + "}.sc-chip.ch{color:" + PRI + ";border-color:color-mix(in srgb," + PRI + " 50%,transparent)}",
    ".sc-aud{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:baseline;font-size:12px;margin-top:6px}.sc-aud .ok{color:var(--mui-palette-success-main,#2e9d6e)}.sc-aud .no{color:var(--mui-palette-error-main,#e5534b)}.sc-aud code{font:11px " + MONO + ";overflow-wrap:anywhere}",
    ".sc-k summary{cursor:pointer;list-style:none;font:11.5px/1.5 " + MONO + ";color:" + TX2 + "}.sc-k summary::-webkit-details-marker{display:none}.sc-k .ok{color:var(--mui-palette-success-main,#2e9d6e)}.sc-k .bad{color:var(--mui-palette-error-main,#e5534b)}.sc-k div{font:11px/1.6 " + MONO + ";color:" + TX2 + ";overflow-wrap:anywhere}",
    ".sc-side{font-size:14px;line-height:1.6}.sc-side h2{margin:0 0 8px;font-size:1.2rem;font-weight:800}.sc-step{border:1px solid " + DIV + ";border-radius:12px;padding:10px 12px 2px;margin:0 0 12px;background:" + PAPER + ";scroll-margin-top:64px;transition:border-color .2s}.sc-step.on{border-color:" + PRI + "}",
    ".sc-step h3{margin:0 0 4px;font-size:14px;font-weight:800;display:flex;gap:8px;align-items:baseline}.sc-step h3 b{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:50%;font-size:11px;border:1px solid " + PRI + ";color:" + PRI + "}.sc-step p{margin:0 0 8px;font-size:13px}.sc-step .sc-bar{margin:0 0 10px}",
    ".sc-me{font-family:" + MONO + ";font-size:12px}.sc-cap{margin:6px 2px 0;font-size:12px;line-height:1.5;color:" + TX2 + "}",
    ".sc-rel{margin:32px 0 8px}.sc-rel h2{margin:0 0 10px;font-size:1.35rem;font-weight:800}.sc-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media (max-width:900px){.sc-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.sc-cards{grid-template-columns:1fr}}",
    ".sc-card2{display:flex;flex-direction:column;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:" + PAPER + ";color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}.sc-card2:hover{transform:translateY(-2px);border-color:" + PRI + "}.sc-card2 .img{display:block;aspect-ratio:1200/630;background:var(--mui-palette-action-hover,rgba(128,128,128,.12));overflow:hidden}.sc-card2 img{width:100%;height:100%;object-fit:cover;display:block}.sc-card2 .tx{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.sc-card2 b{font-size:14px;font-weight:800}.sc-card2 small{font-size:12px;line-height:1.4;color:" + TX2 + "}",
  ].join("\n");
  (function () { var s = document.createElement("style"); s.id = "sc-css"; s.textContent = CSS; document.head.appendChild(s); })();
  var SYN = window.MeSyntax;
  if (SYN && SYN.watchTheme) SYN.watchTheme();   // --me-syn-* from the active .GUI theme; follows theme / mode changes
  var me = function (t) { return h("code", { className: "me-code sc-me" }, SYN ? SYN.render(h, t) : t); };
  var synJ = function (t) { return SYN ? SYN.render(h, t) : t; };
  var link = function (href, text) { return h("a", { href: href, target: href.indexOf("http") === 0 ? "_blank" : undefined, rel: "noopener" }, text); };
  var fmtJ = function (o) { try { return JSON.stringify(o, null, 2); } catch (e) { return String(o); } };
  function useKernel() { var s = useState(K.ver), set = s[1]; useEffect(function () { var f = function (v) { set(v); }; K.subs.push(f); return function () { K.subs = K.subs.filter(function (g) { return g !== f; }); }; }, []); return K; }
  var sel = { v: null, subs: [] }; function select(x) { sel.v = x; sel.subs.forEach(function (f) { f(x); }); }
  function useSel() { var s = useState(sel.v), set = s[1]; useEffect(function () { sel.subs.push(set); return function () { sel.subs = sel.subs.filter(function (g) { return g !== set; }); }; }, []); return s[0]; }
  var running = { on: params.get("paused") !== "1", auto: true };

  // ── the figure: the city ──
  function Floor() {
    var cv = useRef(null);
    useEffect(function () {
      var c = cv.current, ctx = c.getContext("2d"), raf = 0, last = performance.now(), pal = null, palT = 0, frames = 0, fpsT = performance.now();
      var dpr = Math.min(2, window.devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
      var css = function (n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim() || getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; };
      function rgba(col, al) { var m = String(col).match(/^#([0-9a-f]{6})$/i); if (m) { var n = parseInt(m[1], 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + al + ")"; }
        m = String(col).match(/rgba?\(([^)]+)\)/); if (m) return "rgba(" + m[1].split(",").slice(0, 3).join(",") + "," + al + ")"; return col; }
      function palette() { var bg = css("--mui-palette-background-default", ""), dark = true, m = bg.match(/\d+/g);
        if (/^#/.test(bg)) { var n = parseInt(bg.slice(1, 7), 16); dark = ((n >> 16) + (n >> 8 & 255) + (n & 255)) / 3 < 128; } else if (m && m.length >= 3) dark = (+m[0] + +m[1] + +m[2]) / 3 < 128;
        return { dark: dark, bg: bg || (dark ? "#0d1117" : "#ffffff"), paper: css("--mui-palette-background-paper", dark ? "#161b22" : "#f6f8fa"), ink: css("--mui-palette-text-primary", dark ? "#e6edf3" : "#1f2328"), muted: css("--mui-palette-text-secondary", dark ? "#8b949e" : "#57606a"),
          faint: css("--mui-palette-text-disabled", dark ? "#6e7681" : "#8c959f"), acc: css("--mui-palette-primary-main", "#58a6ff"), ok: dark ? "#3fb950" : "#1a7f37", warn: dark ? "#d29922" : "#bf8700", bad: dark ? "#f85149" : "#cf222e",
          glow: dark ? "#7ee2ff" : "#0a84c6", truck: dark ? "#56d4a0" : "#1a7f5a", roof: dark ? "#1a2130" : "#e4e8ef", shade: dark ? "rgba(0,0,0,.35)" : "rgba(31,35,40,.10)",
          tints: dark ? ["#58a6ff", "#d2a8ff", "#ff7b72", "#3fb950", "#e3b341", "#79c0ff"] : ["#0969da", "#8250df", "#cf222e", "#1a7f37", "#9a6700", "#0550ae"] }; }
      function rr(x, y, w, h2, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
      var FS = 1;
      function txt(sz, t, x, y, col, al, wt) { ctx.font = (wt || 500) + " " + (sz * FS).toFixed(1) + "px " + MONO; ctx.fillStyle = col; ctx.textAlign = al || "center"; ctx.fillText(t, x, y); }
      var BLD = []; (function () { var R = rng(5); COL.forEach(function (C) { for (var gx = C.x; gx < C.x + C.w - 10; gx += ST) for (var gy = C.y; gy < C.y + C.h - 10; gy += ST) {
        var x0 = Math.ceil(gx / ST) * ST + 9, y0 = Math.ceil(gy / ST) * ST + 9, w = ST - 18; if (x0 + w > C.x + C.w - 4 || y0 + w > C.y + C.h - 4 || x0 < C.x + 4 || y0 < C.y + 4) continue; if (R() < .12) { BLD.push({ park: true, x: x0, y: y0, w: w, c: C.id }); continue; }
        BLD.push({ x: x0, y: y0, w: w * (.7 + R() * .3), h: w * (.7 + R() * .3), hgt: 2 + R() * 6, c: C.id }); } }); })();
      function fillCol(P, f) { return f >= (read("city.threshold") || 80) ? P.bad : f >= 50 ? P.warn : P.ok; }
      function draw() {
        var now = performance.now(); if (!pal || now - palT > 500) { pal = palette(); palT = now; } var P = pal, ok = !!K.me, on = sel.v, seeF = audiences.can("fleet");
        FS = Math.max(1, Math.min(2.2, 760 / (c.clientWidth || W)));
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        // colonias: tinted ground, street grid, blocks
        COL.forEach(function (C, ci) { var tint = P.tints[ci], see = audiences.can("c" + C.id), isSel = on && on.type === "colonia" && on.c === C.id, pz = C.pulse ? (now - C.pulse) / 1000 : 9;
          ctx.fillStyle = rgba(tint, P.dark ? .05 : .05); rr(C.x, C.y, C.w, C.h, 16); ctx.fill();
          ctx.strokeStyle = rgba(tint, isSel ? .9 : pz < 1 ? .35 + .5 * (1 - pz) : .28); ctx.lineWidth = isSel ? 2 : 1.2; ctx.setLineDash([6, 5]); rr(C.x, C.y, C.w, C.h, 16); ctx.stroke(); ctx.setLineDash([]);
          ctx.save(); rr(C.x, C.y, C.w, C.h, 16); ctx.clip();
          ctx.strokeStyle = rgba(P.ink, P.dark ? .06 : .08); ctx.lineWidth = 14; ctx.beginPath(); for (var gx = Math.ceil(C.x / ST) * ST; gx < C.x + C.w; gx += ST) { ctx.moveTo(gx, C.y); ctx.lineTo(gx, C.y + C.h); } for (var gy = Math.ceil(C.y / ST) * ST; gy < C.y + C.h; gy += ST) { ctx.moveTo(C.x, gy); ctx.lineTo(C.x + C.w, gy); } ctx.stroke();
          BLD.forEach(function (b) { if (b.c !== C.id) return; if (b.park) { ctx.fillStyle = rgba(P.ok, P.dark ? .14 : .16); rr(b.x, b.y, b.w, b.w, 8); ctx.fill(); ctx.fillStyle = rgba(P.ok, .3); ctx.beginPath(); ctx.arc(b.x + b.w * .35, b.y + b.w * .4, 6, 0, 7); ctx.arc(b.x + b.w * .65, b.y + b.w * .6, 7, 0, 7); ctx.fill(); return; }
            ctx.fillStyle = P.shade; rr(b.x + b.hgt * .7, b.y + b.hgt, b.w, b.h, 3); ctx.fill(); ctx.fillStyle = P.roof; rr(b.x, b.y, b.w, b.h, 3); ctx.fill(); ctx.strokeStyle = rgba(P.ink, .1); ctx.lineWidth = 1; ctx.stroke(); });
          if (!see) { ctx.strokeStyle = rgba(P.ink, .12); ctx.lineWidth = 6; for (var hx = C.x - C.h; hx < C.x + C.w; hx += 22) { ctx.beginPath(); ctx.moveTo(hx, C.y + C.h); ctx.lineTo(hx + C.h, C.y); ctx.stroke(); } }
          ctx.restore();
          // header: name, avg fill gauge (from the kernel's aggregates), full count
          ctx.fillStyle = rgba(P.paper, .92); rr(C.x + 10, C.y + 10, 214, 34, 9); ctx.fill(); ctx.strokeStyle = rgba(tint, .5); ctx.lineWidth = 1; ctx.stroke();
          txt(11, C.name.toUpperCase(), C.x + 20, C.y + 31, tint, "left", 800);
          if (ok && see) { var av = read("colonias." + C.id + ".avgFill") || 0, fn = read("colonias." + C.id + ".fullN") || 0; ctx.fillStyle = rgba(P.ink, .12); rr(C.x + 112, C.y + 22, 60, 8, 4); ctx.fill(); ctx.fillStyle = fillCol(P, av); rr(C.x + 112, C.y + 22, Math.max(4, 60 * av / 100), 8, 4); ctx.fill();
            txt(9, Math.round(av) + "%", C.x + 178, C.y + 30, P.muted, "left", 600); if (fn) { ctx.fillStyle = P.bad; ctx.beginPath(); ctx.arc(C.x + 214, C.y + 27, 7, 0, 7); ctx.fill(); txt(9, String(fn), C.x + 214, C.y + 30.5, "#ffffff", "center", 800); } }
          else if (!see) txt(9, "SEALED", C.x + 160, C.y + 31, P.faint, "center", 700); });
        // depot
        var spin = now / 900; ctx.fillStyle = rgba(P.truck, .14); ctx.beginPath(); ctx.arc(DEPOT.x, DEPOT.y, 34, 0, 7); ctx.fill(); ctx.strokeStyle = rgba(P.truck, .6); ctx.lineWidth = 1.4; ctx.stroke();
        for (var a = 0; a < 3; a++) { var an = spin + a * 2.094; ctx.strokeStyle = P.truck; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(DEPOT.x, DEPOT.y, 17, an, an + 1.5); ctx.stroke(); var ex2 = DEPOT.x + Math.cos(an + 1.5) * 17, ey2 = DEPOT.y + Math.sin(an + 1.5) * 17; ctx.fillStyle = P.truck; ctx.beginPath(); ctx.arc(ex2, ey2, 3, 0, 7); ctx.fill(); }
        // bins
        if (ok) BINS.forEach(function (bin) { if (!audiences.can("c" + bin.c)) return; var f = bin.w, full = read(BP(bin) + ".full") === true, isSel = on && on.type === "bin" && on.c === bin.c && on.k === bin.k, col = fillCol(P, f), pulse = full ? .5 + .5 * Math.sin(now / 220 + bin.k) : 0;
          if (full) { ctx.save(); ctx.shadowColor = P.bad; ctx.shadowBlur = 8 + 10 * pulse; ctx.strokeStyle = rgba(P.bad, .4 + .5 * pulse); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bin.x, bin.y, 11, 0, 7); ctx.stroke(); ctx.restore(); }
          if (bin.assigned) { ctx.strokeStyle = rgba(P.truck, .8); ctx.setLineDash([2, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bin.x, bin.y, 15, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          ctx.fillStyle = P.paper; ctx.strokeStyle = rgba(P.ink, .6); ctx.lineWidth = 1.1; rr(bin.x - 5, bin.y - 7, 10, 13, 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = col; var fh = 11 * Math.min(1, f / 100); ctx.fillRect(bin.x - 4, bin.y + 5 - fh, 8, fh); ctx.fillStyle = rgba(P.ink, .6); ctx.fillRect(bin.x - 6.5, bin.y - 9, 13, 2.2);
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bin.x, bin.y, 18, 0, 7); ctx.stroke(); txt(9.5, "BIN " + bin.c + "." + bin.k + " · " + f + "%", bin.x, bin.y - 22, P.acc, "center", 700); } });
        // effects
        FX = FX.filter(function (f) { return now - f.t < 1400; });
        FX.forEach(function (f) { var age = (now - f.t) / 1000; if (age < 0) return; var o = Math.max(0, 1 - age / 1.4);
          if (f.x2 != null) { var u = Math.min(1, age / .55), x = f.x + (f.x2 - f.x) * u, y = f.y + (f.y2 - f.y) * u, col = f.kind === "assign" ? P.truck : P.glow;
            ctx.save(); ctx.globalAlpha = o * .55; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = o; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); ctx.restore(); return; }
          var col2 = f.kind === "clean" || f.kind === "unload" ? P.truck : f.kind === "market" ? P.warn : P.glow, r = f.kind === "src" ? 6 + age * 70 : f.kind === "market" ? 30 + age * 200 : 6 + age * 34;
          ctx.globalAlpha = o * .8; ctx.strokeStyle = col2; ctx.lineWidth = f.kind === "src" || f.kind === "market" ? 2 : 1.4; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
          if (f.kind === "clean") { for (var q = 0; q < 6; q++) { var aa = q * 1.047 + age * 3, rd = 6 + age * 26; ctx.fillStyle = rgba(P.truck, o); ctx.beginPath(); ctx.arc(f.x + Math.cos(aa) * rd, f.y + Math.sin(aa) * rd, 1.6, 0, 7); ctx.fill(); } }
          ctx.globalAlpha = 1; });
        // robots (a city ops layer; a colonia sees the robots inside its own area)
        var big = !lite(), RS = big ? Math.min(1.3, FS * .8 + .25) : 1;
        if (ok) bots.forEach(function (b) { var cid = colAt(b.x, b.y); if (!seeF && !(cid && audiences.can("c" + cid))) return; var isSel = on && on.type === "robot" && on.i === b.id, pz = b.pulse ? (now - b.pulse) / 900 : 9;
          if (b.path && (seeF) && (isSel || !lite())) { ctx.strokeStyle = rgba(isSel ? P.acc : P.truck, isSel ? .9 : .3); ctx.lineWidth = isSel ? 2.2 : 1.2; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -now / 50; ctx.beginPath(); ctx.moveTo(b.x, b.y); for (var q = b.seg + 1; q < b.path.length; q++) ctx.lineTo(b.path[q][0], b.path[q][1]); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
          if (!big) { ctx.fillStyle = rgba(P.truck, .9); ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill(); if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, 7); ctx.stroke(); } return; }
          var load = read(RP(b) + ".load") || 0, can = read(RP(b) + ".canTake") === true, led = b.phase === "emptying" ? P.warn : b.phase === "toDepot" || b.phase === "unloading" ? P.glow : b.phase === "toBin" ? P.acc : can ? P.ok : P.faint;
          ctx.save(); ctx.translate(b.x, b.y);
          if (pz >= 0 && pz < 1) { ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 18 * (1 - pz); ctx.strokeStyle = rgba(P.glow, 1 - pz); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12 * RS + pz * 14, 0, 7); ctx.stroke(); ctx.restore(); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 18 * RS, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          ctx.save(); ctx.rotate(b.ang); ctx.scale(RS, RS);
          if (b.phase === "emptying") { ctx.save(); ctx.translate(9, 0); ctx.rotate(now / 60); ctx.strokeStyle = rgba(P.truck, .8); ctx.lineWidth = 1; for (var s = 0; s < 6; s++) { ctx.rotate(1.047); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 0); ctx.stroke(); } ctx.restore(); }
          ctx.fillStyle = rgba(P.ink, .35); ctx.fillRect(-7, -7.5, 4, 2); ctx.fillRect(3, -7.5, 4, 2); ctx.fillRect(-7, 5.5, 4, 2); ctx.fillRect(3, 5.5, 4, 2);
          ctx.fillStyle = P.paper; ctx.strokeStyle = rgba(P.ink, .75); ctx.lineWidth = 1.2; rr(-9, -6, 14, 12, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = P.truck; rr(5, -5, 5, 10, 2); ctx.fill();
          ctx.fillStyle = rgba(P.truck, .7); ctx.fillRect(-7.5, 4 - 8 * load / 100, 10, 8 * load / 100 + .01);
          ctx.save(); ctx.shadowColor = led; ctx.shadowBlur = 6; ctx.fillStyle = led; ctx.beginPath(); ctx.arc(-2, -3.2, 1.6, 0, 7); ctx.fill(); ctx.restore();
          ctx.restore(); ctx.restore();
          if (isSel || K.N <= 12) txt(isSel ? 10 : 8, String(b.id), b.x, b.y + 20 * RS, isSel ? P.acc : P.faint, "center", isSel ? 700 : 500); });
        // HUD
        if (ok) { var ht = "city.threshold = " + read("city.threshold"), hot = K.trace && K.trace.path === "city.threshold" && now - K.trace.t < 900; ctx.font = "600 " + (11 * FS).toFixed(1) + "px " + MONO; var hw = ctx.measureText(ht).width + 24;
          ctx.fillStyle = rgba(P.acc, hot ? .2 : .1); rr(DEPOT.x - hw / 2, H - 46, hw, 14 + 14 * FS, 8); ctx.fill(); ctx.strokeStyle = rgba(P.acc, hot ? .9 : .35); ctx.stroke(); txt(11, ht, DEPOT.x, H - 39 + 10 * FS, P.acc, "center", 600);
          var tr = K.trace; if (tr && now - tr.t < 6000) { ctx.globalAlpha = Math.min(1, (6000 - (now - tr.t)) / 800); txt(11, (tr.label || tr.path + " = " + tr.value) + " → " + tr.recomputed.length + " recomputed", DEPOT.x, 14 + 10 * FS, P.glow, "center", 600); ctx.globalAlpha = 1; }
          if (seeF) { var ca = read("city.avgFill"); txt(10, BINS.length + " BINS · " + K.N + " ROBOTS · city.avgFill " + (ca == null ? "–" : Math.round(ca) + "%") + " · city.fullBins " + V(read("city.fullBins")) + " · " + KL.toUpperCase(), DEPOT.x, H - 54, P.muted); }
          else txt(10, "VIEW AS " + audiences.view.toUpperCase() + " · " + KL.toUpperCase(), DEPOT.x, H - 54, P.muted); }
      }
      function frame(t) { var dt = Math.min(.05, (t - last) / 1000); last = t; if (running.on) step(dt, t); draw(); frames++; if (t - fpsT > 1000) { K.fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; } raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      function hit(e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, best = null, bd = lite() ? 10 : 18;
        bots.forEach(function (b) { var d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = { type: "robot", i: b.id }; } });
        if (!best) BINS.forEach(function (bin) { if (Math.hypot(bin.x - x, bin.y - y) < 12) best = { type: "bin", c: bin.c, k: bin.k }; });
        if (!best && Math.hypot(DEPOT.x - x, DEPOT.y - y) < 40) best = { type: "city", p: "city.avgFill" };
        if (!best && y > H - 50) best = { type: "city", p: "city.threshold" };
        if (!best) { var ci = colAt(x, y); if (ci) best = { type: "colonia", c: ci }; }
        select(best); if (best && window.innerWidth < 980) setTimeout(function () { var p = document.querySelector("[data-sc=explain-card]"); if (p) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60); }
      c.addEventListener("click", hit); return function () { cancelAnimationFrame(raf); c.removeEventListener("click", hit); };
    }, []);
    return h("div", { className: "sc-fig" }, h("canvas", { ref: cv, width: W, height: H, role: "img", "data-sc": "floor", "aria-label": "Six colonias of a city with bin sensors; waste robots drive the streets to the fullest bins and back to a recycling depot" }));
  }

  // ── controls under the map ──
  function Toolbar() {
    var k = useKernel(), cur = useSel(), rs = useState(running.on), run = rs[0], setRun = rs[1], ok = k.status === "ok";
    var bc = cur && cur.type === "bin" ? cur.c : 1, bk = cur && cur.type === "bin" ? cur.k : 3, mc = cur && (cur.type === "bin" || cur.type === "colonia") ? cur.c : 1;
    var B = function (id, label, fn, title, on) { return h("button", { type: "button", className: "sc-btn" + (on ? " on" : ""), "data-sc": id, disabled: !ok, title: title, onClick: fn }, label); };
    return h("div", { className: "sc-bar", "data-sc": "toolbar" },
      B("fill", "Fill bin " + bc + "." + bk, function () { actions.fill(bc, bk); }, "Writes colonias." + bc + ".bins." + bk + ".fill = 96; only that colonia's aggregates and the city's recompute"),
      B("market", "Market day · " + COL[mc - 1].name, function () { actions.market(mc); }, "Every bin of the colonia +40; its pressure rises and up to 3 robots re-point their target to it"),
      B("threshold", "Threshold " + (ok && read("city.threshold") === 60 ? "60 → 80" : "80 → 60"), function () { actions.threshold(); }, "Writes city.threshold; every bins[i].full rule reads it"),
      h("span", { className: "sc-sep" }),
      h("span", { className: "sc-seg", role: "group", "aria-label": "Fleet size" }, [12, 40, 200].map(function (n) { return h("button", { key: n, type: "button", className: "sc-btn" + (k.N === n ? " on" : ""), "data-sc": "scale-" + n, disabled: !ok, "aria-pressed": k.N === n ? "true" : "false", onClick: function () { rescale(n); } }, n); })),
      h("button", { type: "button", className: "sc-btn" + (aggOn() ? " on" : ""), "data-sc": "agg", disabled: !ok || k.N > 40, title: k.N > 40 ? "Fleet aggregates are off above 40 robots: each robot write re-scans robots[]" : "Declare or drop the robots[] aggregates (re-seeds the city)", onClick: function () { rescale(k.N, !K.agg); } }, "[] " + (aggOn() ? "on" : "off")),
      h("button", { type: "button", className: "sc-btn" + (run ? "" : " on"), "data-sc": "pause", onClick: function () { running.on = !running.on; setRun(running.on); } }, run ? "Pause" : "Resume"));
  }

  // ── the cards under the map: explain, last propagation, fleet, audiences, kernel ──
  var V = function (x) { return x === undefined ? "–" : x === null ? "null" : typeof x === "object" ? JSON.stringify(x) : String(x); };
  var ms = function (g) { return g.n ? (g.sum / g.n).toFixed(3) + " ms · " + g.n : "–"; };
  function Fleet() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ag = aggOn(), wk = 0, av = 0, ld = 0, ops = audiences.can("fleet");
    if (ok && !ag) bots.forEach(function (b) { var p = RP(b); if (read(p + ".collecting") === true) wk++; if (read(p + ".canTake") === true) av++; ld += read(p + ".load") || 0; });
    var kpi = function (id, label, val, p) { var on = cur && cur.type === "city" && cur.p === p; return h("button", { type: "button", key: id, className: "sc-kpi", "data-sc": "kpi-" + id, "aria-pressed": on ? "true" : "false", disabled: !p, onClick: p ? function () { select({ type: "city", p: p }); } : undefined, title: p ? "me.explain(\"" + p + "\")" : "tallied by the page (aggregates off)" }, h("small", null, label), h("b", null, ok ? V(val) : "–")); };
    if (!ops) return h("section", { className: "sc-card", "data-sc": "fleet" }, h("div", { className: "sc-h" }, "Fleet"), h("div", { className: "sc-note" }, "Sealed for city ops. " + audiences.view + " opens only its own colonia's bins."));
    return h("section", { className: "sc-card", "data-sc": "fleet" }, h("div", { className: "sc-h" }, "Fleet · " + k.N + " robots · " + BINS.length + " bins · " + KL),
      h("div", { className: "sc-kpis" },
        kpi("fullBins", "city.fullBins", read("city.fullBins"), "city.fullBins"),
        kpi("avgFill", "city.avgFill", ok ? r1(read("city.avgFill")) : null, "city.avgFill"),
        kpi("working", ag ? "city.working" : "collecting", ag ? read("city.working") : wk, ag ? "city.working" : null),
        kpi("available", ag ? "city.available" : "canTake = true", ag ? read("city.available") : av, ag ? "city.available" : null),
        kpi("avgLoad", ag ? "city.avgLoad" : "avg load", ag ? r1(read("city.avgLoad")) : r1(ld / Math.max(1, k.N)), ag ? "city.avgLoad" : null),
        kpi("collected", "city.collected", read("city.collected"), "city.collected")),
      h("div", { className: "sc-row", style: { marginTop: 6 } }, h("span", null, "colonias[i].avgFill · fullN"), h("span", { className: "sc-num", "data-sc": "per-colonia" }, ok ? COL.map(function (c) { return c.name.slice(0, 3) + " " + Math.round(read("colonias." + c.id + ".avgFill") || 0) + "/" + read("colonias." + c.id + ".fullN"); }).join(" · ") : "–")),
      h("div", { className: "sc-row" }, h("span", null, "writes · writes/s · fps"), h("span", { className: "sc-num", "data-sc": "rate" }, ok ? k.writes + " · " + Math.round(k.writes / Math.max(1, (performance.now() - k.t0) / 1000)) + " · " + (k.fps || "–") : "–")),
      h("div", { className: "sc-row" }, h("span", null, "mean bin write · mean robot write"), h("span", { className: "sc-num", "data-sc": "wms" }, ms(wms.bin) + " / " + ms(wms.robot))),
      h("div", { className: "sc-row" }, h("span", null, "seed " + k.N + " robots + " + BINS.length + " bins + rules"), h("span", { className: "sc-num" }, ok && k.seedMs != null ? k.seedMs.toFixed(1) + " ms" : "–")),
      h("div", { className: "sc-note" }, "Per colonia, ", me("colonias[i].bins[].fill / colonias[i].bins[]"), " and ", me("colonias[i].bins[].full"), " (a boolean field sums as its count of true) are aggregates over that colonia's " + NB + " bins only, so a bin write re-scans " + NB + ", not " + BINS.length + ". ",
        ag ? ["The fleet numbers are aggregates over ", me("robots[]"), ", re-scanned on every robot write, so they are declared up to 40 robots. "] : ["Fleet aggregates are off" + (k.N > 40 ? " at " + k.N + " robots" : "") + ": the page tallies those from per-robot reads. "], link(L_AGG, "Aggregates")));
  }
  function Trace() {
    var k = useKernel(), tr = k.trace;
    return h("section", { className: "sc-card", "data-sc": "trace" }, h("div", { className: "sc-h" }, "Last propagation · meta.recomputed"),
      !tr ? h("div", { className: "sc-note" }, "Fill a bin, call a market day or move the threshold: the kernel recomputes only the dependents, listed here from ", me("me.explain(path).meta.recomputed"), ".")
        : h(React.Fragment, null,
          h("div", { className: "sc-row" }, h("span", null, tr.label || "write"), h("span", { className: "sc-num" }, me(tr.path + " = " + V(tr.value)))),
          h("div", { className: "sc-row" }, h("span", null, "recomputed · changed" + (tr.reroutes != null ? " · robots re-pointed" : "")), h("span", { className: "sc-num", "data-sc": "recomputed-count" }, tr.recomputed.length + " · " + tr.changed.length + (tr.reroutes != null ? " · " + tr.reroutes : ""))),
          h("div", { className: "sc-chips", "data-sc": "recomputed" }, tr.recomputed.slice(0, 80).map(function (p, x) { return h("span", { key: x, className: "sc-chip" + (tr.changed.indexOf(p) >= 0 ? " ch" : "") }, p); }).concat(tr.recomputed.length > 80 ? [h("span", { key: "m", className: "sc-chip" }, "+" + (tr.recomputed.length - 80))] : [])),
          h("div", { className: "sc-note" }, "Highlighted: the value changed. Glow and ripples on the map are drawn from this list. ", link(L_OK, "O(k)"))));
  }
  function Explain() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ts = useState(null), tab = ts[0], setTab = ts[1];
    useEffect(function () { setTab(cur && cur.tab || null); }, [cur && (cur.type + (cur.i || "") + (cur.c || "") + (cur.k || "") + (cur.p || ""))]);
    var d = null, sealed = null;
    if (ok && cur) {
      if ((cur.type === "bin" || cur.type === "colonia") && !audiences.can("c" + cur.c)) sealed = COL[cur.c - 1].name;
      else if ((cur.type === "robot" || cur.type === "city") && !audiences.can("fleet")) sealed = "city ops";
      else if (cur.type === "bin") { var p = "colonias." + cur.c + ".bins." + cur.k, cp = "colonias." + cur.c;
        d = { title: "Bin " + cur.c + "." + cur.k + " · " + COL[cur.c - 1].name, rows: [[p + ".fill", read(p + ".fill")], [p + ".full", read(p + ".full")], [p + ".assigned", read(p + ".assigned")], ["city.threshold", read("city.threshold")]], tabs: [p + ".full", cp + ".avgFill", cp + ".fullN", cp + ".pressure"] }; }
      else if (cur.type === "colonia") { var q = "colonias." + cur.c;
        d = { title: "Colonia " + COL[cur.c - 1].name, rows: ["name", "avgFill", "fullN", "pressure"].map(function (f) { return [q + "." + f, f === "avgFill" ? r1(read(q + "." + f)) : read(q + "." + f)]; }), tabs: [q + ".avgFill", q + ".fullN", q + ".pressure"], note: "Aggregates over " + q + ".bins[] (" + NB + " bins). A write to a bin of another colonia does not touch them." }; }
      else if (cur.type === "robot" && cur.i <= k.N) { var r = "robots." + cur.i, b = bots[cur.i - 1];
        d = { title: "Robot " + cur.i + " · " + (b ? b.phase : ""), rows: ["battery", "load", "speed", "dist", "busy", "collecting", "target"].map(function (f) { return [r + "." + f, read(r + "." + f)]; }), tabs: [r + ".targetFill", r + ".canTake", r + ".eta"] }; }
      else if (cur.type === "city") d = { title: cur.p, rows: [[cur.p, read(cur.p)]], tabs: [cur.p] };
    }
    var path = d ? (tab && d.tabs.indexOf(tab) >= 0 ? tab : d.tabs[0]) : null, ex = path ? K.me.explain(path) : null;
    return h("section", { className: "sc-card", "data-sc": "explain-card", style: { gridColumn: "1 / -1" } }, h("div", { className: "sc-h" }, d ? d.title : "Explain"),
      sealed ? h("div", { className: "sc-note", "data-sc": "sealed" }, "Sealed for " + sealed + (sealed === "city ops" ? "" : " OR city ops") + ". Viewing as " + audiences.view + ", the page could not unwrap it, so it shows nothing.") :
      !d ? h("div", { className: "sc-note" }, "Click a bin, a robot, a colonia or a number for its paths and ", me("me.explain(path)"), " as the kernel returns it (", link(L_EXP, "Explain"), ").") :
      h(React.Fragment, null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", columnGap: 14 } }, d.rows.map(function (r) { return h("div", { key: r[0], className: "sc-row" }, h("span", { className: "sc-num me-code", style: { color: "inherit" } }, synJ(r[0].split(".").slice(-1)[0])), h("span", { className: "sc-num" }, V(r[1]))); })),
        d.note ? h("div", { className: "sc-note" }, d.note) : null,
        h("div", { className: "sc-tabs", role: "tablist" }, d.tabs.map(function (t) { return h("button", { key: t, type: "button", role: "tab", className: "sc-tab" + (t === path ? " on" : ""), "aria-selected": t === path ? "true" : "false", onClick: function () { setTab(t); } }, t.split(".").slice(1).join(".")); })),
        h("div", { className: "sc-note" }, me('me.explain("' + path + '")'), " · " + KL + " · live"),
        h("pre", { className: "sc-json me-code", "data-sc": "explain" }, synJ(fmtJ(ex)))));
  }
  function Audiences() {
    var k = useKernel(), as = useState(0), A = audiences; useEffect(function () { var f = as[1]; A.subs.push(f); return function () { A.subs = A.subs.filter(function (g) { return g !== f; }); }; }, []);
    var ok = k.status === "ok";
    return h("section", { className: "sc-card", "data-sc": "audiences" }, h("div", { className: "sc-h" }, "Audiences · ME.wrapSecretV1 (OR)"),
      h("div", { className: "sc-bar", style: { marginTop: 0 } }, h("span", { className: "sc-seg", role: "group", "aria-label": "View as" }, PARTIES.map(function (p) { return h("button", { key: p, type: "button", className: "sc-btn" + (A.view === p ? " on" : ""), "data-sc": "as-" + p.replace(/\s|á/g, ""), disabled: !ok || !A.wraps, onClick: function () { A.open(p); } }, p); })),
        h("button", { type: "button", className: "sc-btn", "data-sc": "reseal", disabled: !ok || A.busy, onClick: function () { A.seal(); }, title: "Seal a fresh snapshot for each audience" }, A.busy ? "Sealing…" : "Re-seal")),
      h("div", { className: "sc-aud", "data-sc": "aud-results" }, AUD.map(function (au) { var r = A.results[au.k];
        return [h("span", { key: au.k + "a" }, au.label, h("br"), h("small", { style: { color: TX2 } }, au.members.join(" OR "))),
          h("span", { key: au.k + "b" }, !r ? "…" : r.ok ? h(React.Fragment, null, h("span", { className: "ok" }, "opened (wrap for " + r.kid + ") "), h("code", null, r.text.length > 110 ? r.text.slice(0, 110) + " …" : r.text))
            : h(React.Fragment, null, h("span", { className: "no" }, "unwrapSecretV1 with " + A.view + "'s key on the wrap for " + r.kid + " → "), h("code", null, r.err)))]; })),
      h("div", { className: "sc-note" }, A.wraps ? "Sealed " + new Date(A.sealedAt).toLocaleTimeString() + " in " + A.ms.toFixed(0) + " ms. " : "", "A colonia's map shows its own bins and the robots inside its streets; the rest is hatched. P-256 keys from ", me("ME.generateP256KeyPair()"), ". ", link(L_AUD, "Audiences")));
  }
  function Right() { return h("div", { className: "sc-right" }, h(Floor), h(Toolbar),
    h("p", { className: "sc-cap" }, "Bin bars: green < 50 % · amber · red at the threshold (full bins glow). Robots LED: green canTake · blue heading to a bin · amber emptying · cyan back to the depot. Glow and ripples are the paths the kernel recomputed. Click anything."),
    h("div", { className: "sc-panel" }, h(Explain), h(Trace), h(Fleet), h(Audiences), h(KernelCard))); }

  // ── left sidebar: the narrated steps; each Run executes on a shared new ME() (me-run.js), each map button acts on the live city ──
  var STEPS = [
    { t: "Each bin is a sensor path", map: [["Show bin 1.3", function () { select({ type: "bin", c: 1, k: 3 }); }]],
      body: function () { return ["A fill sensor writes one number: ", me("colonias[1].bins[3].fill"), ". Every colonia owns its own collection of bins, so its data is a subtree of the city. ", link(L_PATHS, "Paths")]; },
      code: 'me.city.threshold(80)\nme.colonias[1].name("Centro")\nme.colonias[1].bins[1].fill(40)\nme.colonias[1].bins[2].fill(70)\nme.colonias[1].bins[3].fill(20)\nme("colonias[1].bins[3].fill")' },
    { t: "A bin knows when it is full", map: [["Threshold 80 ↔ 60", function () { actions.threshold(); }]],
      body: function () { return ["One rule per colonia: ", me('colonias[1].bins["[i]"]["="]("full", "fill >= city.threshold")'), ". It reads the city threshold, so moving the threshold recomputes every bin's ", me("full"), " and nothing else. ", link(L_OPS, "Operators")]; },
      code: 'me.colonias[1].bins["[i]"]["="]("full", "fill >= city.threshold")\nme("colonias[1].bins[2].full")\nme.city.threshold(60)\nme("colonias[1].bins[2].full")\nme.city.threshold(80)\nme("colonias[1].bins[2].full")' },
    { t: "Each colonia averages its bins", map: [["Show Centro", function () { select({ type: "colonia", c: 1 }); }]],
      body: function () { return [me("colonias[i].bins[].fill / colonias[i].bins[]"), " is the mean fill; ", me("colonias[i].bins[].full"), " sums a boolean field, each ", me("true"), " counting 1, so it is how many bins are full. ", me("pressure"), " ranks colonias for dispatch. ", link(L_AGG, "Aggregates")]; },
      code: 'me.colonias["[i]"]["="]("avgFill", "colonias[i].bins[].fill / colonias[i].bins[]")\nme.colonias["[i]"]["="]("fullN", "colonias[i].bins[].full")\nme.colonias["[i]"]["="]("pressure", "fullN * 10 + avgFill")\nme("colonias[1].avgFill")\nme("colonias[1].fullN")\nme("colonias[1].pressure")' },
    { t: "A bin fills", map: [["Fill bin 1.3", function () { actions.fill(1, 3); }]],
      body: function () { return ["One sensor write. The kernel recomputes that bin's ", me("full"), " and Centro's aggregates; Roma's bins, a different collection, are not re-scanned. ", link(L_EXP, "Explain")]; },
      code: 'me.colonias[2].bins["[i]"]["="]("full", "fill >= city.threshold")\nme.colonias[2].bins[1].fill(30)\nme.colonias[1].bins[3].fill(96)\nme("colonias[1].fullN")\nme.explain("colonias[1].fullN").meta.recomputed' },
    { t: "Robots point at bins", map: [["Market day in Centro", function () { actions.market(1); }], ["robot 1", function () { select({ type: "robot", i: 1 }); }]],
      body: function () { return ["The dispatcher (page code) sends a free robot to a full bin of the colonia under most pressure: ", me('robots[1].target["->"]("colonias.1.bins.3")'), ". ", me("targetFill = target.fill"), " reads through the pointer. A market day raises a colonia's pressure and robots re-point to it. ", link(L_PTR, "Pointers")]; },
      code: 'me.city.reserve(20)\nme.robots[1].battery(80)\nme.robots[1].load(10)\nme.robots[1].busy(0)\nme.robots["[i]"]["="]("canTake", "battery > city.reserve && load < 80 && !busy")\nme.robots["[i]"]["="]("targetFill", "target.fill")\nme("robots[1].canTake")\nme.robots[1].target["->"]("colonias.1.bins.3")\nme.robots[1].busy(1)\nme("robots[1].targetFill")\nme("robots[1].canTake")' },
    { t: "Count the fleet", map: [["Show city.fullBins", function () { select({ type: "city", p: "city.fullBins" }); }], ["city.avgFill", function () { select({ type: "city", p: "city.avgFill" }); }]],
      body: function () { return [me("colonias[].fullN"), " sums the colonias' counts; ", me("robots[].collecting"), " counts the robots at work. The explain lists each as an input with ", me('kind: "aggregate"'), ". A robot write re-scans ", me("robots[]"), ", so the map declares the fleet ones up to 40 robots. ", link(L_AGG, "Aggregates")]; },
      code: 'me.robots[1].collecting(true)\nme.robots[2].collecting(false)\nme.city["="]("working", "robots[].collecting")\nme.city["="]("fullBins", "colonias[].fullN")\nme("city.working")\nme("city.fullBins")\nme.explain("city.fullBins").derivation.inputs[0].aggregate' },
    { t: "Each colonia sees its own bins", map: [["View as Roma", function () { audiences.open("Roma"); }], ["city ops", function () { audiences.open("city ops"); }], ["outsider", function () { audiences.open("outsider"); }]],
      body: function () { return ["Each colonia's snapshot is sealed for that colonia OR city ops, the fleet for city ops: one ", me("ME.wrapSecretV1"), " per member. Roma's map opens Roma's bins and hatches the other five. ", link(L_AUD, "Audiences")]; },
      static: 'const W = await ME.wrapSecretV1({ secret: binsOfRoma, recipientPublicKey: roma.publicKey, kid: "Roma", class: "identity-key" })\nawait ME.unwrapSecretV1(W, roma.privateKey, "utf8")     // Roma\'s bins\nawait ME.unwrapSecretV1(W, centro.privateKey, "utf8")   // throws OperationError' }];
  var RELATED = [
    ["https://neurons-me.github.io/smart-cities/", "https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/assets/ai-decides-og.png", "Smart Cities", "All the city demos on .me."],
    ["https://neurons-me.github.io/.me/Demos/SmartCities/CityDelivery/", "https://neurons-me.github.io/.me/Demos/SmartCities/CityDelivery/assets/city-delivery-og.png", "City Delivery", "Sidewalk robots and drones; a light or a closed street recomputes only the ETAs that depend on it."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Warehouse/", "https://neurons-me.github.io/.me/Demos/Robots/Warehouse/assets/warehouse-og.png", "Warehouse Fleet", "Robots pick orders; drain a battery or block an aisle."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Swarm/", "https://neurons-me.github.io/.me/Demos/Robots/Swarm/assets/swarm-og.png", "Rescue Swarm", "Drones search a disaster zone under fog."]];
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=4"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  var PATH = [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
    { text: "SmartCities", href: "https://neurons-me.github.io/smart-cities/", title: "Smart Cities" }, { text: "SelfCleaningCity", href: null, title: "This page" }];
  var PAGE = { kicker: "Smart Cities · Robots · " + KL, title: "Self-Cleaning City", lede: h(React.Fragment, null, "Each sensor writes ", me("colonias[1].bins[3].fill"), "; one rule, ", me('colonias[1].bins["[i]"]["="]("full", "fill >= city.threshold")'), ", and one aggregate, ", me('colonias["[i]"]["="]("fullN", "colonias[i].bins[].full")'), ". A bin fills and ", h(Reads)),
    api: function () { return window.SelfCleaningKernel; }, global: "__sc", expose: function () { return { K: K, bots: function () { return bots; }, BINS: BINS, select: select, actions: actions, audiences: audiences, rescale: rescale, wms: wms }; } };

  // ── intro: the last phrase runs a real action and lists the kernel's meta.recomputed inline ──
  (function () { var st = document.createElement("style"); st.textContent = ".sc-reads{all:unset;cursor:pointer;color:" + PRI + ";border-bottom:1px dashed " + PRI + "}.sc-reads:hover,.sc-reads:focus-visible{border-bottom-style:solid}.sc-reads-out{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px}.sc-reads-h{width:100%;font-size:12.5px}.sc-reads-chip{border:1px solid " + DIV + ";border-radius:6px;padding:1px 6px;line-height:1.5}.sc-reads-more{all:unset;cursor:pointer;font-size:12px;color:" + PRI + ";padding:0 4px}"; document.head.appendChild(st); })();
  function derivedCount() { return DERIVED().filter(function (p) { var e = K.me.explain(p); return e && e.derivation && e.derivation.expression; }).length; }
  function Reads() {
    var k = useKernel(), rs = useState(null), res = rs[0], setRes = rs[1], os = useState(false), open = os[0], setOpen = os[1], ok = k.status === "ok";
    var hover = function () { if (ok) READS.preview(); };
    var go = function () { if (!ok) return; var r = READS.run(); if (!r || !r.tr) return; setRes({ head: r.head, rec: r.tr.recomputed.slice(), total: derivedCount() }); setOpen(false); };
    var n = res ? res.rec.length : 0, shown = res ? (open ? res.rec : res.rec.slice(0, 8)) : [];
    return h(React.Fragment, null,
      h("button", { type: "button", className: "sc-reads", "data-sc": "reads", disabled: !ok, onMouseEnter: hover, onFocus: hover, onClick: go, title: READS.title }, "only what depends on it recomputes"), ".",
      res ? h("span", { className: "sc-reads-out", "data-sc": "reads-out" },
        h("span", { className: "sc-reads-h" }, res.head + " · ", h("b", null, n + " of " + res.total), " derived paths recomputed"),
        shown.map(function (p, x) { return h("span", { key: x, className: "sc-reads-chip" }, me(p)); }),
        n > 8 ? h("button", { type: "button", className: "sc-reads-more", "data-sc": "reads-more", onClick: function () { setOpen(!open); } }, open ? "less" : "+" + (n - 8) + " more") : null) : null);
  }
  function DERIVED() { var c = []; BINS.forEach(function (b) { c.push(BP(b) + ".full"); }); COL.forEach(function (x) { ["avgFill", "fullN", "pressure"].forEach(function (f) { c.push("colonias." + x.id + "." + f); }); });
    bots.forEach(function (b) { ["canTake", "eta", "targetFill"].forEach(function (f) { c.push(RP(b) + "." + f); }); });
    return c.concat(["city.avgFill", "city.fullBins", "city.working", "city.available", "city.avgLoad"]); }
  function nextBin() { var th = read("city.threshold") || 80; return BINS.filter(function (b) { return !b.assigned && b.w < th && audiences.can("c" + b.c); }).sort(function (a, b) { return b.w - a.w; })[0] || null; }
  var READS = { title: "Fills the fullest bin that is not yet full (colonias.c.bins.k.fill = 96) and lists me.explain(…).meta.recomputed",
    preview: function () { var b = nextBin(); if (b) select({ type: "bin", c: b.c, k: b.k }); },
    run: function () { var b = nextBin(); if (!b) return null; var tr = actions.fill(b.c, b.k); return { tr: tr, head: "bin " + b.c + "." + b.k + " (" + COL[b.c - 1].name + ") → 96 %" }; } };
  function KernelCard() { var k = useKernel(), st = MK.state;
    return h("section", { className: "sc-card", style: { gridColumn: "1 / -1" } }, h("details", { className: "sc-k", "data-sc": "kernel" },
      h("summary", null, "Kernel · ", link(MK.KERNEL.npm, KL), " · ", st.state === "ok" ? h("span", { className: "ok" }, "sha256 verified") : st.state === "error" ? h("span", { className: "bad" }, "failed: " + st.text) : "loading…"),
      st.state === "ok" ? [h("div", { key: "h" }, "sha256 " + st.hash), h("div", { key: "u" }, "from ", link(st.url, st.url.replace("https://", ""))), h("div", { key: "s" }, "page source: ", link(SRC_URL, SRC_NAME))] : null)); }
  function Side() {
    var ss = useState(-1), on = ss[0], setOn = ss[1], k = useKernel(), Run = window.MeRun && window.MeRun.MeRunBlock, idx = 0;
    var toMap = function () { if (window.innerWidth >= 980) return; var f = document.querySelector(".sc-fig"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" }); };
    return h("aside", { className: "sc-side", "data-sc": "steps", "aria-label": "How it works, step by step" }, h("h2", null, "How it works"),
      STEPS.map(function (s, i) { var ri = s.code ? idx++ : -1;
        return h("section", { key: i, className: "sc-step" + (on === i ? " on" : ""), "data-sc": "step-" + (i + 1) },
          h("h3", null, h("b", null, i + 1), s.t), h("p", null, s.body()),
          s.code && Run ? h(Run, { idx: ri, code: s.code, compact: true }) : s.static ? h("pre", { className: "me-code sc-json", style: { maxHeight: "none", whiteSpace: "pre-wrap", margin: "0 0 10px" } }, h("code", null, synJ(s.static))) : null,
          h("div", { className: "sc-bar" }, h("span", { style: { fontSize: 11.5, color: TX2 } }, "On the map:"), s.map.map(function (m, j) { return h("button", { key: j, type: "button", className: "sc-btn", disabled: k.status !== "ok", "data-sc": "map-" + (i + 1) + "-" + (j + 1), onClick: function () { setOn(i); m[1](); toMap(); } }, m[0]); }))); }),
      h("p", { className: "sc-cap" }, "Run executes the blocks in page order on one shared ", me("new ME()"), " from " + KL + " (", link("https://neurons-me.github.io/.me/assets/me-run/me-run.js", "me-run.js"), "); the map runs its own instance. Source: ", link(SRC_URL, SRC_NAME), "."));
  }
  function Related() {
    return h("section", { className: "sc-rel", "data-sc": "related" }, h("h2", null, "Related"),
      h("div", { className: "sc-cards" }, RELATED.map(function (c) { return h("a", { key: c[0], className: "sc-card2", href: c[0] },
        h("span", { className: "img" }, h("img", { src: c[1], alt: "", loading: "lazy" })), h("span", { className: "tx" }, h("b", null, c[2]), h("small", null, c[3]))); })));
  }
  function Dashboard() { return h("div", { className: "sc-dash" }, h(Side), h(Right)); }
  var LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  var IC = {
    github: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z",
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
    grid: "M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z",
    palette: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    moon: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z",
    sun: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    down: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  };
  var Ico = function (p) { return h("svg", { viewBox: p.kind === "github" ? "0 0 16 16" : "0 0 24 24", width: p.size || 18, height: p.size || 18, fill: "currentColor", "aria-hidden": "true", focusable: "false", style: { display: "block", flex: "none" } }, h("path", { d: IC[p.kind] }), p.off ? h("path", { d: "M3 3 21 21", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }) : null); };
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
        h(A.Link, { href: "https://neurons-me.github.io/.me/docs/", underline: "hover", sx: { fontFamily: MONO, fontSize: 12, color: "text.secondary", mx: { xs: .5, sm: 0 } } }, "Docs"),
        h(A.Link, { href: "https://github.com/neurons-me/.me", underline: "none", target: "_blank", rel: "noopener", title: "GitHub · neurons-me/.me", "aria-label": "GitHub", sx: { display: "inline-flex", lineHeight: 0, color: "text.secondary", "&:hover": { color: "text.primary" } } }, h(Ico, { kind: "github", size: 18 })),
        h(A.Box, { "data-gui-inspector-control": "true", sx: { display: "inline-flex", alignItems: "center", gap: .25 } }, h(ThemePicker), h(ModeToggle), h(SettingsMenu))));
  }
  var N = function (type, id, props, children) { return Object.assign({ type: type, props: Object.assign({}, props || {}, { "data-gui-node-id": id }) }, children ? { children: children } : {}); };
  var spec = N("Box", "page", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary" } }, [
    N("SCTopBar", "topbar"),
    N("Box", "main", { component: "main", sx: { maxWidth: 1440, mx: "auto", px: { xs: 1.5, sm: 3 }, pt: { xs: 2.5, sm: 3.5 }, pb: 8 } }, [
      N("Typography", "kicker", { component: "p", sx: { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1 } }, [PAGE.kicker]),
      N("Typography", "title", { component: "h1", sx: { fontSize: "clamp(1.9rem, 5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1 } }, [PAGE.title]),
      N("Typography", "lede", { component: "p", sx: { color: "text.secondary", mb: 3, maxWidth: 760 } }, [PAGE.lede]),
      N("SCDashboard", "fleet"),
      N("SCRelated", "related"),
    ]),
  ]);
  var scope = window.__thisGuiThemeScope || {};
  var mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; } catch (e) {}
  var PageTheme = function (p) { return h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, p.children); };
  if (G.getInspectorEnabled()) G.setInspectorEnabled(false);
  var pageType = function (Comp) { return { type: "x", resolve: function (s) { var p = Object.assign({}, s.props || {}); delete p.key; return h(Comp, p); } }; };
  var reg = Object.assign({}, G.Registry || G.registry); [["SCTopBar", TopBar], ["SCDashboard", Dashboard], ["SCRelated", Related]].forEach(function (x) { reg[x[0]] = pageType(x[1]); reg[x[0]].type = x[0]; });
  G.mount(spec, ROOT, { me: PAGE.api(), gui: Object.assign({}, G, { render: undefined, RunMe: undefined, Theme: PageTheme, registry: reg }), devtools: { enabled: true, inspector: false, adminView: false, inspectorToggleVisible: false } });
  document.documentElement.classList.add("gui-on");
  window[PAGE.global] = PAGE.expose();
})();
