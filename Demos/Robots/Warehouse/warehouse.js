/*! Warehouse Fleet 0.1.0 · a robot fleet held in a this.me 4.2.1 kernel · MIT · neurons.me
 * The kernel (this.me 4.2.1 from npm, sha256 checked in the browser by /.me/assets/me-kernel/me-kernel.js) holds the fleet:
 * robots[i].battery / busy / charging / speed / dist / pos / task, orders[j].status / aisle / sla and a pointer
 * orders[j].robot -> robots[i]. The rules are ["="] derivations declared once for every member (["[i]"]): canTake, eta,
 * low, range, and orders[j].eta / late through the pointer. The canvas animates the walk; every arrival is a write, and
 * the glow / ripple on the map is drawn from meta.recomputed of me.explain(), i.e. the paths the kernel says recomputed.
 * Order status, batteries and routes are sealed for their audiences with ME.wrapSecretV1 (OR: one wrap per member).
 */
(function () {
  var G = window.GUI, React = window.React, ROOT = document.getElementById("root"), MK = window.MeKernel;
  if (!G || !React || !window.ReactDOM || typeof G.mount !== "function" || !ROOT || !MK) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", KV = MK.KERNEL.version, KL = MK.KERNEL.label;
  var params = new URLSearchParams(location.search);
  var SRC_URL = "https://github.com/neurons-me/.me/blob/main/Demos/Robots/Warehouse/warehouse.js";
  var DOCS = "https://neurons-me.github.io/.me/docs/", L_OPS = DOCS + "Operators.html", L_EXP = DOCS + "Explain.html", L_PTR = DOCS + "Pointer-Composition.html",
    L_AUD = DOCS + "Audiences.html", L_PATHS = DOCS + "me-whatever-what.html", L_OK = DOCS + "O-k.html";

  // ── the warehouse: 8 aisles between racks, two cross corridors, a charging lane on the left, 3 packing stations ──
  var W = 1200, H = 720, PXM = 40;   // 40 px = 1 m
  var AIS = "ABCDEFGH".split(""), AX = function (a) { return 250 + a * 110; }, TOP = 110, BOT = 560, SLOT_Y = [180, 280, 380, 480];
  var NODES = {}, EDGES = [], adj = {};
  function node(id, x, y, extra) { NODES[id] = Object.assign({ id: id, x: x, y: y }, extra || {}); adj[id] = []; }
  function edge(a, b, aisle) { var e = { a: a, b: b, aisle: aisle || null, len: Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y) / PXM }; EDGES.push(e); adj[a].push({ n: b, e: e }); adj[b].push({ n: a, e: e }); }
  AIS.forEach(function (L, a) { var x = AX(a); node("T" + L, x, TOP); node("B" + L, x, BOT); SLOT_Y.forEach(function (y, k) { node("S" + L + k, x, y, { slot: k, aisle: L }); });
    edge("T" + L, "S" + L + 0, L); for (var k = 0; k < 3; k++) edge("S" + L + k, "S" + L + (k + 1), L); edge("S" + L + 3, "B" + L, L);
    if (a) { edge("T" + AIS[a - 1], "T" + L); edge("B" + AIS[a - 1], "B" + L); } });
  var DOCKS = 6; node("LT", 150, TOP); node("LB", 150, BOT); edge("LT", "TA"); edge("LB", "BA");
  for (var d = 0; d < DOCKS; d++) { var dy = 160 + d * 70; node("L" + d, 150, dy); node("D" + d, 72, dy, { dock: d }); edge("L" + d, "D" + d); edge(d ? "L" + (d - 1) : "LT", "L" + d); }
  edge("L" + (DOCKS - 1), "LB");
  var STATIONS = [["P0", 2], ["P1", 4], ["P2", 6]]; STATIONS.forEach(function (s, i) { node(s[0], AX(s[1]), 655, { station: i }); edge("B" + AIS[s[1]], s[0]); });
  var CORR = Object.keys(NODES).filter(function (k) { return /^[TB][A-H]$/.test(k); });

  function route(from, to, kernelBlocked) {   // Dijkstra on metres; a blocked aisle is closed to through-traffic (still enterable when it is the start or goal aisle)
    var okA = {}; [from, to].forEach(function (n) { var m = /^S([A-H])/.exec(n) || /^[TB]([A-H])$/.exec(n); if (m) okA[m[1]] = 1; });
    var dist = {}, prev = {}, done = {}, q = [from]; dist[from] = 0;
    while (q.length) { var bi = 0; for (var i = 1; i < q.length; i++) if (dist[q[i]] < dist[q[bi]]) bi = i; var c = q.splice(bi, 1)[0]; if (done[c]) continue; done[c] = 1; if (c === to) break;
      adj[c].forEach(function (o) { if (o.e.aisle && kernelBlocked[o.e.aisle] && !okA[o.e.aisle]) return; var nd = dist[c] + o.e.len; if (dist[o.n] == null || nd < dist[o.n]) { dist[o.n] = nd; prev[o.n] = c; q.push(o.n); } }); }
    if (dist[to] == null) return null; var p = [to]; while (p[0] !== from) p.unshift(prev[p[0]]); return p;
  }
  function pathLen(p, seg, t) { var L = 0; for (var i = seg; i < p.length - 1; i++) L += Math.hypot(NODES[p[i]].x - NODES[p[i + 1]].x, NODES[p[i]].y - NODES[p[i + 1]].y) / PXM; if (t) L -= t * Math.hypot(NODES[p[seg]].x - NODES[p[seg + 1]].x, NODES[p[seg]].y - NODES[p[seg + 1]].y) / PXM; return Math.max(0, L); }
  function usesAisle(p, seg, L) { if (!p) return false; for (var i = seg; i < p.length - 1; i++) { var e = edgeOf(p[i], p[i + 1]); if (e && e.aisle === L) return true; } return false; }
  function edgeOf(a, b) { var x = adj[a].filter(function (q) { return q.n === b; })[0]; return x && x.e; }

  // ── the kernel side ──
  var K = { me: null, N: Math.max(1, Math.min(1000, +params.get("n") || 20)), writes: 0, lastMs: 0, subs: [], status: "loading", ver: 0, t0: performance.now(), recomputes: 0, trace: null, traces: [], seq: 0 };
  function emit() { K.ver++; K.subs.forEach(function (f) { f(K.ver); }); }
  function nodeAt(path) { var p = K.me; path.split(".").forEach(function (s) { p = p[s]; }); return p; }
  function write(path, v) { var t = performance.now(); nodeAt(path)(v); K.writes++; K.lastMs = performance.now() - t; }
  function read(path) { return K.me ? K.me(path) : undefined; }
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  // which derived path to ask for meta.recomputed after a write (each one depends on the written path)
  function probeFor(path) { var m = /^robots\.(\d+)\.(\w+)$/.exec(path); if (m) { var f = m[2]; return "robots." + m[1] + "." + (f === "dist" || f === "speed" ? "eta" : "canTake"); }
    if (path === "fleet.threshold") return "robots.1.canTake"; if (/^orders\.\d+\.robot$/.test(path)) return path.replace(/robot$/, "eta"); return null; }
  // write + ask the kernel what recomputed: meta.recomputed of a dependent's explain(), kept when its sourcePath is this write
  function traced(path, v, label) {
    write(path, v); var pr = probeFor(path); if (!pr || !K.me) return null;
    var ex = K.me.explain(pr), m = ex && ex.meta; if (!m || m.sourcePath !== path || !m.recomputed) return null;
    var tr = { id: ++K.seq, path: path, value: v, recomputed: m.recomputed.slice(), changed: (m.changed || []).slice(), label: label || null, t: performance.now() };
    K.recomputes += tr.recomputed.length; if (label !== false) { K.trace = tr; K.traces.unshift(tr); if (K.traces.length > 8) K.traces.pop(); } fx.trace(tr); return tr;
  }
  var lite = function () { return K.N > 100; };   // at 1000 robots the sim writes only on arrival and does not trace every write
  function simWrite(path, v) { if (lite()) write(path, v); else traced(path, v, false); }
  var THRESH = 30, aggOn = function (n) { return n <= 100; };
  function seed(ME) {
    var me = new ME(), N = K.N, t = performance.now(); K.me = null;
    me.fleet.name("Warehouse Fleet"); me.fleet.size(N); me.fleet.threshold(THRESH); me.fleet.delivered(0);
    AIS.forEach(function (L) { me.aisles[L].blocked(0); });
    me.robots["[i]"]["="]("canTake", "battery > fleet.threshold && !busy && !charging");
    me.robots["[i]"]["="]("eta", "dist / speed");
    me.robots["[i]"]["="]("low", "battery < 25");
    me.robots["[i]"]["="]("range", "battery * 0.4 * speed");
    me.orders["[i]"]["="]("eta", "robot.eta");
    me.orders["[i]"]["="]("late", "robot.eta > sla");
    bots = []; orders = [];
    for (var i = 1; i <= N; i++) { var start = CORR[(i * 7) % CORR.length], r = me.robots[i], b0 = 45 + (i * 37) % 55, sp = r1(1.2 + ((i * 13) % 9) / 10);
      r.battery(b0); r.busy(0); r.charging(0); r.speed(sp); r.dist(0); r.pos(start); r.task(0); r.carry(0);
      bots.push({ id: i, at: start, path: null, seg: 0, t: 0, x: NODES[start].x, y: NODES[start].y, ang: 0, wait: (i % 10) * .15, phase: "idle", order: 0, pulse: 0, sp: sp }); }
    // fleet aggregates over the collection: robots[] counts, robots[].f sums (a true counts as 1). Each robot write re-scans
    // the collection for every aggregate on it, so they are declared up to 100 robots.
    if (aggOn(N)) { me.fleet["="]("avgBattery", "robots[].battery / robots[]"); me.fleet["="]("carrying", "robots[].carry");
      me.fleet["="]("available", "robots[].canTake"); me.fleet["="]("lowCount", "robots[].low"); }
    K.me = me; K.seedMs = performance.now() - t; K.writes = 0; K.recomputes = 0; K.traces = []; K.trace = null; K.t0 = performance.now(); nextOrder = 1;
    for (var o = 0; o < Math.min(8, Math.ceil(N / 3)); o++) addOrder();
  }
  var ME_CLASS = null;
  MK.load().then(function (ME) { ME_CLASS = ME; seed(ME); K.status = "ok"; emit(); audiences.seal(); }, function (e) { K.status = "error"; K.error = String(e && e.message || e); emit(); });
  function rescale(n) { if (!ME_CLASS) return; K.N = n; select(null); seed(ME_CLASS); emit(); audiences.seal(); }
  window.WarehouseKernel = { explain: function (p) { return K.me ? K.me.explain(p) : null; }, read: read };

  // ── orders and robots (the page walks them; every arrival, pick, drop and charge is a kernel write) ──
  var bots = [], orders = [], nextOrder = 1;
  function blockedMap() { var o = {}; AIS.forEach(function (L) { if (read("aisles." + L + ".blocked")) o[L] = 1; }); return o; }
  function addOrder(at) {
    var j = nextOrder++, a = (j * 5 + (at || 0)) % AIS.length, k = (j * 3) % 4, st = j % STATIONS.length, O = K.me.orders[j], sku = "SKU-" + String(1000 + (j * 7919) % 9000);
    O.item(sku); O.aisle(AIS[a]); O.slot(k); O.station(st); O.sla(30); O.status("queued");
    orders.push({ id: j, node: "S" + AIS[a] + k, station: STATIONS[st][0], status: "queued", t: performance.now() }); K.writes += 6;
    if (orders.length > 400) orders = orders.filter(function (x) { return x.status !== "done"; }).concat(orders.filter(function (x) { return x.status === "done"; }).slice(-40));
    return j;
  }
  var OP = function (j) { return "orders." + j; }, RP = function (b) { return "robots." + b.id; };
  function go(b, to) { var p = route(b.at, to, blockedMap()); if (!p) { b.wait = .8; return false; } b.goal = to; b.path = p.length > 1 ? p : null; b.seg = 0; b.t = 0;
    simWrite(RP(b) + ".dist", r1(pathLen(p, 0, 0))); if (!b.path) arrive(b); return true; }
  function dispatch() {
    var q = orders.filter(function (o) { return o.status === "queued"; }); if (!q.length) return;
    var free = bots.filter(function (b) { return !b.path && b.phase === "idle" && read(RP(b) + ".canTake") === true; });
    q.slice(0, lite() ? 40 : 6).forEach(function (o) { if (!free.length) return; var tn = NODES[o.node], bi = 0, bd = 1e9;
      free.forEach(function (b, i) { var d = Math.hypot(b.x - tn.x, b.y - tn.y); if (d < bd) { bd = d; bi = i; } });
      var b = free.splice(bi, 1)[0]; b.order = o.id; b.phase = "toPick"; o.status = "assigned"; o.robot = b.id;
      write(RP(b) + ".busy", 1); write(RP(b) + ".task", o.id); write(OP(o.id) + ".status", "assigned");
      go(b, o.node); nodeAt(OP(o.id)).robot["->"](RP(b)); K.writes++; if (!lite()) fx.link(b, o); });
  }
  var DRAIN = .55;   // % battery per metre
  function arrive(b) {
    b.path = null; write(RP(b) + ".pos", b.at); var o = b.order && orders.filter(function (x) { return x.id === b.order; })[0];
    if (b.phase === "toPick" && o) { b.phase = "picking"; o.status = "picking"; write(OP(o.id) + ".status", "picking"); b.wait = .7; return; }
    if (b.phase === "toStation" && o) { o.status = "done"; o.done = performance.now(); write(OP(o.id) + ".status", "done"); write(RP(b) + ".carry", 0); write(RP(b) + ".task", 0);
      write("fleet.delivered", (read("fleet.delivered") || 0) + 1); fx.drop(b); b.order = 0; b.phase = "idle"; simWrite(RP(b) + ".busy", 0); b.wait = .3;
      if (read(RP(b) + ".low") === true) toDock(b); return; }
    if (b.phase === "toDock") { b.phase = "charging"; simWrite(RP(b) + ".charging", 1); return; }
    b.phase = b.phase === "picking" || b.phase === "charging" ? b.phase : "idle";
  }
  function toDock(b) { b.phase = "toDock"; write(RP(b) + ".busy", 1); go(b, "D" + (b.id % DOCKS)); }
  function step(dt) {
    if (!K.me) return; var w0 = K.writes;
    bots.forEach(function (b) {
      if (b.path) { var A = NODES[b.path[b.seg]], B = NODES[b.path[b.seg + 1]], len = Math.hypot(B.x - A.x, B.y - A.y) || 1, v = b.sp * PXM;
        b.t += dt * v / len;
        if (b.t >= 1) { b.seg++; b.t = 0; b.at = b.path[b.seg]; var bat = read(RP(b) + ".battery");
          var nb = r1(Math.max(1, bat - len / PXM * DRAIN));
          if (b.seg >= b.path.length - 1) { write(RP(b) + ".dist", 0); simWrite(RP(b) + ".battery", nb); arrive(b); }
          else if (!lite()) { simWrite(RP(b) + ".battery", nb); simWrite(RP(b) + ".dist", r1(pathLen(b.path, b.seg, 0))); } else write(RP(b) + ".battery", nb); }
      } else if (b.phase === "charging") { if ((b.wait -= dt) <= 0) { b.wait = .5; var c = read(RP(b) + ".battery"); if (c >= 96) { b.phase = "idle"; write(RP(b) + ".busy", 0); simWrite(RP(b) + ".charging", 0); go(b, CORR[(b.id * 3) % CORR.length]); b.phase = "idle"; } else simWrite(RP(b) + ".battery", r1(Math.min(100, c + 6))); } }
      else if ((b.wait -= dt) <= 0) {
        if (b.phase === "picking") { var o = orders.filter(function (x) { return x.id === b.order; })[0]; write(RP(b) + ".carry", 1); fx.pick(b);
          if (o) { o.status = "delivering"; write(OP(o.id) + ".status", "delivering"); } b.phase = "toStation"; go(b, o ? o.station : "P0"); }
        else if (b.phase === "idle" && read(RP(b) + ".low") === true && !read(RP(b) + ".busy")) toDock(b);
        else b.wait = .4; }
      // smooth heading and position
      var p = botXY(b); b.x = p.x; b.y = p.y; if (p.ang != null) { var da = p.ang - b.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; b.ang += da * Math.min(1, dt * 10); }
    });
    if ((T.disp += dt) >= .35) { T.disp = 0; dispatch(); }
    var rate = Math.max(.6, K.N / 30); if (running.auto && (T.ord += dt) >= 1 / rate) { T.ord = 0; if (orders.filter(function (o) { return o.status === "queued"; }).length < Math.max(6, K.N / 2)) addOrder(Math.floor(performance.now() / 997)); }
    if (K.writes !== w0 && (T.emit += dt) > .12) { T.emit = 0; emit(); }
  }
  var T = { disp: 0, ord: 0, emit: 0 };
  function botXY(b) {
    if (!b.path) { var n = NODES[b.at], off = NODES[b.at].dock != null ? 0 : ((b.id % 5) - 2) * 3.2; return { x: n.x + off * .6, y: n.y + off }; }
    var A = NODES[b.path[b.seg]], B = NODES[b.path[b.seg + 1]], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, u = b.t, side = 5 + (b.id % 3) * 1.5;
    var e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, tt = u * .7 + e * .3, ease = Math.min(1, u * L / 14, (1 - u) * L / 14);
    return { x: A.x + dx * tt - dy / L * side * ease, y: A.y + dy * tt + dx / L * side * ease, ang: Math.atan2(dy, dx) };
  }
  // user actions: each one is a kernel write; the panel and the map show what the kernel says recomputed
  var actions = {
    drain: function (id) { var b = bots[(id || 1) - 1]; if (!b) return; var tr = traced(RP(b) + ".battery", 12, "drain robot " + b.id); select({ type: "robot", i: b.id, tab: "canTake" }); emit(); return tr; },
    block: function (L) { var on = !read("aisles." + L + ".blocked"); write("aisles." + L + ".blocked", on ? 1 : 0); var bm = blockedMap(), all = { id: ++K.seq, path: "aisles." + L + ".blocked", value: on ? 1 : 0, recomputed: [], changed: [], label: (on ? "block" : "open") + " aisle " + L, t: performance.now(), reroutes: 0 };
      bots.forEach(function (b) { if (!b.path || (on && !usesAisle(b.path, b.seg, L))) return; var from = b.path[b.seg + 1] || b.at, p = route(from, b.goal, bm); if (!p) return;
        var keep = b.path.slice(0, b.seg + 1); b.path = keep.concat(p); all.reroutes++; var tr = traced(RP(b) + ".dist", r1(pathLen(b.path, b.seg, b.t)), false);
        if (tr) { all.recomputed = all.recomputed.concat(tr.recomputed); all.changed = all.changed.concat(tr.changed); } });
      K.recomputes += 0; K.trace = all; K.traces.unshift(all); if (K.traces.length > 8) K.traces.pop(); fx.aisle(L, all); select({ type: "aisle", L: L }); emit(); return all; },
    order: function () { var j = addOrder(Math.floor(Math.random() * 8)); dispatch(); select({ type: "order", j: j }); emit(); return j; },
    threshold: function () { var v = read("fleet.threshold") === 30 ? 60 : 30; var tr = traced("fleet.threshold", v, "fleet.threshold → " + v); emit(); return tr; },
  };

  // ── effects: glow pulses on recomputed robots, ripple lines source → dependents (all from meta.recomputed) ──
  var FX = [], fx = {
    at: function (x, y, kind) { FX.push({ x: x, y: y, kind: kind, t: performance.now() }); if (FX.length > 400) FX.splice(0, FX.length - 400); },
    line: function (x1, y1, x2, y2, kind, delay) { FX.push({ x: x1, y: y1, x2: x2, y2: y2, kind: kind || "ripple", t: performance.now() + (delay || 0) }); },
    where: function (p) { var m = /^robots\.(\d+)\./.exec(p); if (m) { var b = bots[m[1] - 1]; return b ? { x: b.x, y: b.y, b: b } : null; }
      m = /^orders\.(\d+)\./.exec(p); if (m) { var o = orders.filter(function (x) { return x.id === +m[1]; })[0]; if (o) { var n = NODES[o.node]; return { x: n.x, y: n.y, o: o }; } }
      if (/^fleet\./.test(p)) return { x: 60, y: 40 }; return null; },
    trace: function (tr) { var src = fx.where(tr.path) || { x: 60, y: 40 }, seen = {}, i = 0;
      tr.recomputed.forEach(function (p) { var w = fx.where(p); if (!w || (/^fleet\./.test(p) && !/^fleet\./.test(tr.path))) return;   // fleet aggregates have no place on the floor: the ripple stays at the source robot
      var key = Math.round(w.x) + "," + Math.round(w.y) + p.split(".")[0]; if (w.b) w.b.pulse = performance.now() + i * 25;
        if (!seen[key] && (Math.abs(w.x - src.x) + Math.abs(w.y - src.y) > 4)) { seen[key] = 1; if (i < 220) fx.line(src.x, src.y, w.x, w.y, "ripple", i * 18); }
        if (w.o) fx.at(w.x, w.y, "order"); i++; });
      fx.at(src.x, src.y, "src"); if (!/^fleet\./.test(tr.path)) fx.at(src.x, src.y, "src"); },
    link: function (b, o) { var n = NODES[o.node]; fx.line(b.x, b.y, n.x, n.y, "assign"); },
    pick: function (b) { fx.at(b.x, b.y, "pick"); }, drop: function (b) { fx.at(b.x, b.y, "drop"); },
    aisle: function (L, all) { var x = AX(AIS.indexOf(L)); fx.at(x, (TOP + BOT) / 2, "aisle"); (all.recomputed || []).forEach(function (p, i) { var w = fx.where(p); if (w) { if (w.b) w.b.pulse = performance.now() + i * 30; fx.line(x, (TOP + BOT) / 2, w.x, w.y, "ripple", i * 30); } }); },
  };

  // ── audiences: order status → client + ops, batteries → maintenance + ops, routes → ops; OR = one ME.wrapSecretV1 per member ──
  var AUD = [{ k: "status", label: "order status", members: ["client", "ops"] }, { k: "batteries", label: "batteries", members: ["maintenance", "ops"] }, { k: "routes", label: "routes", members: ["ops"] }];
  var PARTIES = ["client", "maintenance", "ops", "outsider"];
  var audiences = { keys: null, wraps: null, view: params.get("as") || "ops", results: {}, busy: false, sealedAt: 0, ms: 0, subs: [],
    payload: function (k) { var n = Math.min(K.N, 20);
      if (k === "status") return orders.slice(-12).map(function (o) { return { order: o.id, status: read(OP(o.id) + ".status") }; });
      if (k === "batteries") { var a = []; for (var i = 1; i <= n; i++) a.push({ robot: i, battery: read("robots." + i + ".battery") }); return a; }
      return bots.slice(0, n).map(function (b) { return { robot: b.id, route: b.path ? b.path.slice(b.seg).join(">") : b.at }; }); },
    seal: function () { var A = audiences, ME = ME_CLASS; if (!ME || A.busy || typeof ME.wrapSecretV1 !== "function") return; A.busy = true; var t0 = performance.now();
      var mk = A.keys ? Promise.resolve(A.keys) : Promise.all(PARTIES.map(function () { return ME.generateP256KeyPair(); })).then(function (ks) { var o = {}; PARTIES.forEach(function (p, i) { o[p] = ks[i]; }); return (A.keys = o); });
      mk.then(function (keys) { var wr = {};
        return Promise.all(AUD.map(function (au) { var secret = JSON.stringify(A.payload(au.k)); wr[au.k] = {};
          return Promise.all(au.members.map(function (m) { return ME.wrapSecretV1({ secret: secret, recipientPublicKey: keys[m].publicKey, kid: m, class: "identity-key" }).then(function (w) { wr[au.k][m] = w; }); })); }))
          .then(function () { A.wraps = wr; A.sealedAt = Date.now(); A.ms = performance.now() - t0; return A.open(A.view); }); })
        .catch(function (e) { A.error = String(e && e.message || e); }).then(function () { A.busy = false; A.emit(); }); },
    open: function (who) { var A = audiences, ME = ME_CLASS; A.view = who; if (!A.wraps) return Promise.resolve();
      return Promise.all(AUD.map(function (au) { var mine = au.members.indexOf(who) >= 0, w = A.wraps[au.k][mine ? who : au.members[0]];
        return ME.unwrapSecretV1(w, A.keys[who].privateKey, "utf8").then(function (txt) { return { ok: true, text: txt, wrapOf: mine ? who : au.members[0], kid: w.kid }; },
          function (e) { return { ok: false, err: e && e.name ? e.name + (e.message && e.message !== e.name ? ": " + e.message : "") : String(e), wrapOf: au.members[0], kid: w.kid }; }); }))
        .then(function (rs) { AUD.forEach(function (au, i) { A.results[au.k] = rs[i]; }); A.emit(); }); },
    can: function (k) { var r = audiences.results[k]; return !audiences.wraps || !!(r && r.ok); },
    emit: function () { audiences.subs.forEach(function (f) { f(Date.now()); }); emit(); } };

  // ── page CSS (theme tokens only) ──
  var DIV = "var(--mui-palette-divider,rgba(128,128,128,.3))", TX2 = "var(--mui-palette-text-secondary,#8b949e)", PRI = "var(--mui-palette-primary-main,#58a6ff)", PAPER = "var(--mui-palette-background-paper,transparent)";
  var CSS = [
    ".wf-dash{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}",
    "@media (min-width:980px){.wf-dash{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}.wf-side{grid-column:1;grid-row:1}.wf-right{grid-column:2;grid-row:1;position:sticky;top:60px;max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}}",
    "@media (max-width:979px){.wf-right{order:-1}}",
    ".wf-fig{position:relative;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:var(--mui-palette-background-default,transparent)}.wf-fig canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation}",
    ".wf-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 0}.wf-btn{font:inherit;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.4));background:transparent;color:inherit;cursor:pointer}.wf-btn:hover{border-color:" + PRI + "}.wf-btn.on{color:" + PRI + ";border-color:currentColor}.wf-btn:disabled{opacity:.5;cursor:default}.wf-sep{flex:1}",
    ".wf-seg{display:inline-flex;border:1px solid " + DIV + ";border-radius:8px;overflow:hidden}.wf-seg .wf-btn{border:0;border-radius:0}.wf-seg .wf-btn+.wf-btn{border-left:1px solid " + DIV + "}",
    ".wf-panel{margin-top:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media (min-width:1240px){.wf-panel{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}",
    ".wf-card{border:1px solid " + DIV + ";border-radius:12px;background:" + PAPER + ";font-size:13px;padding:10px 12px;min-width:0}.wf-h{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:" + TX2 + "}",
    ".wf-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.wf-kpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;padding:6px 8px;border:1px solid " + DIV + ";border-radius:9px;cursor:pointer;min-width:0}.wf-kpi:hover,.wf-kpi:focus-visible,.wf-kpi[aria-pressed=true]{border-color:" + PRI + "}.wf-kpi b{font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}.wf-kpi small{font-size:11px;color:" + TX2 + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".wf-row{display:flex;justify-content:space-between;gap:10px;line-height:1.6;min-width:0}.wf-row>span:first-child{color:" + TX2 + ";min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wf-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}",
    ".wf-note{margin-top:6px;font-size:12px;line-height:1.5;color:" + TX2 + "}.wf-note a,.wf-side a,.wf-k a{color:" + PRI + ";text-decoration:none}.wf-note a:hover,.wf-side a:hover,.wf-k a:hover{text-decoration:underline}",
    ".wf-json{margin:6px 0 0;padding:8px;max-height:280px;overflow:auto;border-radius:8px;border:1px solid " + DIV + ";font:11px/1.5 " + MONO + ";white-space:pre;color:var(--mui-palette-text-primary,inherit)}",
    ".wf-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 0}.wf-tab{font:11.5px " + MONO + ";padding:3px 8px;border-radius:999px;border:1px solid " + DIV + ";background:transparent;color:" + TX2 + ";cursor:pointer}.wf-tab.on{color:var(--mui-palette-text-primary,inherit);border-color:" + PRI + "}",
    ".wf-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:84px;overflow:auto}.wf-chip{font:10.5px " + MONO + ";padding:1px 6px;border-radius:6px;border:1px solid " + DIV + ";color:" + TX2 + "}.wf-chip.ch{color:" + PRI + ";border-color:color-mix(in srgb," + PRI + " 50%,transparent)}",
    ".wf-aud{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:baseline;font-size:12px;margin-top:6px}.wf-aud .ok{color:var(--mui-palette-success-main,#2e9d6e)}.wf-aud .no{color:var(--mui-palette-error-main,#e5534b)}.wf-aud code{font:11px " + MONO + ";overflow-wrap:anywhere}",
    ".wf-k summary{cursor:pointer;list-style:none;font:11.5px/1.5 " + MONO + ";color:" + TX2 + "}.wf-k summary::-webkit-details-marker{display:none}.wf-k .ok{color:var(--mui-palette-success-main,#2e9d6e)}.wf-k .bad{color:var(--mui-palette-error-main,#e5534b)}.wf-k div{font:11px/1.6 " + MONO + ";color:" + TX2 + ";overflow-wrap:anywhere}",
    ".wf-side{font-size:14px;line-height:1.6}.wf-side h2{margin:0 0 8px;font-size:1.2rem;font-weight:800}.wf-step{border:1px solid " + DIV + ";border-radius:12px;padding:10px 12px 2px;margin:0 0 12px;background:" + PAPER + ";scroll-margin-top:64px;transition:border-color .2s}.wf-step.on{border-color:" + PRI + "}",
    ".wf-step h3{margin:0 0 4px;font-size:14px;font-weight:800;display:flex;gap:8px;align-items:baseline}.wf-step h3 b{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:50%;font-size:11px;border:1px solid " + PRI + ";color:" + PRI + "}.wf-step p{margin:0 0 8px;font-size:13px}.wf-step .wf-bar{margin:0 0 10px}",
    ".wf-reads{all:unset;cursor:pointer;color:" + PRI + ";border-bottom:1px dashed " + PRI + "}.wf-reads:hover,.wf-reads:focus-visible{border-bottom-style:solid}.wf-reads-out{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px}.wf-reads-h{width:100%;font-size:12.5px}.wf-reads-chip{border:1px solid " + DIV + ";border-radius:6px;padding:1px 6px;line-height:1.5}.wf-reads-more{all:unset;cursor:pointer;font-size:12px;color:" + PRI + ";padding:0 4px}",
    ".wf-me{font-family:" + MONO + ";font-size:12px}.wf-cap{margin:6px 2px 0;font-size:12px;line-height:1.5;color:" + TX2 + "}",
    ".wf-rel{margin:32px 0 8px}.wf-rel h2{margin:0 0 10px;font-size:1.35rem;font-weight:800}.wf-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media (max-width:900px){.wf-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.wf-cards{grid-template-columns:1fr}}",
    ".wf-card2{display:flex;flex-direction:column;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:" + PAPER + ";color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}.wf-card2:hover{transform:translateY(-2px);border-color:" + PRI + "}.wf-card2 .img{display:block;aspect-ratio:1200/630;background:var(--mui-palette-action-hover,rgba(128,128,128,.12));overflow:hidden}.wf-card2 img{width:100%;height:100%;object-fit:cover;display:block}.wf-card2 .tx{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.wf-card2 b{font-size:14px;font-weight:800}.wf-card2 small{font-size:12px;line-height:1.4;color:" + TX2 + "}",
  ].join("\n");
  (function () { var s = document.createElement("style"); s.id = "wf-css"; s.textContent = CSS; document.head.appendChild(s); })();
  var SYN = window.MeSyntax;
  if (SYN && SYN.watchTheme) SYN.watchTheme();   // --me-syn-* from the active .GUI theme; follows theme / mode changes
  var me = function (t) { return h("code", { className: "me-code wf-me" }, SYN ? SYN.render(h, t) : t); };
  var synJ = function (t) { return SYN ? SYN.render(h, t) : t; };
  var link = function (href, text) { return h("a", { href: href, target: href.indexOf("http") === 0 ? "_blank" : undefined, rel: "noopener" }, text); };
  var fmtJ = function (o) { try { return JSON.stringify(o, null, 2); } catch (e) { return String(o); } };
  function useKernel() { var s = useState(K.ver), set = s[1]; useEffect(function () { var f = function (v) { set(v); }; K.subs.push(f); return function () { K.subs = K.subs.filter(function (g) { return g !== f; }); }; }, []); return K; }
  var sel = { v: null, subs: [] }; function select(x) { sel.v = x; sel.subs.forEach(function (f) { f(x); }); }
  function useSel() { var s = useState(sel.v), set = s[1]; useEffect(function () { sel.subs.push(set); return function () { sel.subs = sel.subs.filter(function (g) { return g !== set; }); }; }, []); return s[0]; }
  var running = { on: params.get("paused") !== "1", auto: true };

  // ── the figure: the warehouse floor ──
  var cache = {};   // per-frame reads of the kernel (at 1000 robots refreshed in rolling slices)
  function look(b, force) { var c = cache[b.id]; if (c && !force && performance.now() - c.t < (lite() ? 400 : 0)) return c; var p = RP(b);
    c = { t: performance.now(), bat: read(p + ".battery"), can: read(p + ".canTake"), low: read(p + ".low"), chg: read(p + ".charging"), carry: read(p + ".carry"), busy: read(p + ".busy") }; cache[b.id] = c; return c; }
  function Floor() {
    var cv = useRef(null);
    useEffect(function () {
      var c = cv.current, ctx = c.getContext("2d"), raf = 0, last = performance.now(), pal = null, palT = 0, frames = 0, fpsT = performance.now(), slice = 0;
      var dpr = Math.min(2, window.devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
      var css = function (n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim() || getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; };
      function rgba(col, al) { var m = String(col).match(/^#([0-9a-f]{6})$/i); if (m) { var n = parseInt(m[1], 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + al + ")"; }
        m = String(col).match(/rgba?\(([^)]+)\)/); if (m) return "rgba(" + m[1].split(",").slice(0, 3).join(",") + "," + al + ")"; return col; }
      function palette() { var bg = css("--mui-palette-background-default", ""), dark = true, m = bg.match(/\d+/g);
        if (/^#/.test(bg)) { var n = parseInt(bg.slice(1, 7), 16); dark = ((n >> 16) + (n >> 8 & 255) + (n & 255)) / 3 < 128; } else if (m && m.length >= 3) dark = (+m[0] + +m[1] + +m[2]) / 3 < 128;
        return { dark: dark, bg: bg || (dark ? "#0d1117" : "#ffffff"), paper: css("--mui-palette-background-paper", dark ? "#161b22" : "#f6f8fa"), ink: css("--mui-palette-text-primary", dark ? "#e6edf3" : "#1f2328"), muted: css("--mui-palette-text-secondary", dark ? "#8b949e" : "#57606a"),
          faint: css("--mui-palette-text-disabled", dark ? "#6e7681" : "#8c959f"), acc: css("--mui-palette-primary-main", "#58a6ff"), ok: dark ? "#3fb950" : "#1a7f37", warn: dark ? "#d29922" : "#bf8700", bad: dark ? "#f85149" : "#cf222e",
          box: dark ? "#c08a4a" : "#b7793a", busy: dark ? "#58a6ff" : "#0969da", glow: dark ? "#7ee2ff" : "#0a84c6" }; }
      function rr(x, y, w, h2, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
      var FS = 1;
      function txt(sz, t, x, y, col, al, wt) { ctx.font = (wt || 500) + " " + (sz * FS).toFixed(1) + "px " + MONO; ctx.fillStyle = col; ctx.textAlign = al || "center"; ctx.fillText(t, x, y); }
      function draw() {
        var now = performance.now(); if (!pal || now - palT > 500) { pal = palette(); palT = now; } var P = pal, ok = !!K.me, on = sel.v; K.pal = P;
        FS = Math.max(1, Math.min(2.2, 760 / (c.clientWidth || W)));
        var seeS = audiences.can("status"), seeB = audiences.can("batteries"), seeR = audiences.can("routes");
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = rgba(P.ink, P.dark ? .045 : .06); ctx.lineWidth = 1; ctx.beginPath(); for (var gx = 0; gx <= W; gx += PXM) { ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); } for (var gy = 0; gy <= H; gy += PXM) { ctx.moveTo(0, gy + .5); ctx.lineTo(W, gy + .5); } ctx.stroke();
        // racks: between and beside the aisles, shelves with boxes
        for (var a = -1; a < AIS.length; a++) { var x0 = a < 0 ? AX(0) - 70 : AX(a) + 18, x1 = a === AIS.length - 1 ? AX(a) + 70 : a < 0 ? AX(0) - 18 : AX(a + 1) - 18, w = x1 - x0;
          ctx.fillStyle = rgba(P.ink, P.dark ? .06 : .05); rr(x0, 148, w, 366, 6); ctx.fill(); ctx.strokeStyle = rgba(P.ink, .16); ctx.stroke();
          for (var sh = 0; sh < 9; sh++) { var sy = 160 + sh * 39; ctx.strokeStyle = rgba(P.ink, .1); ctx.beginPath(); ctx.moveTo(x0 + 4, sy + 30); ctx.lineTo(x1 - 4, sy + 30); ctx.stroke();
            for (var bx = 0; bx < Math.floor((w - 10) / 16); bx++) { if ((sh * 7 + bx * 3 + a * 5) % 5 === 0) continue; ctx.fillStyle = rgba(P.box, .28 + ((sh + bx) % 3) * .1); ctx.fillRect(x0 + 6 + bx * 16, sy + 16, 12, 13); } } }
        // corridors and the charging lane
        ctx.setLineDash([6, 8]); ctx.strokeStyle = rgba(P.ink, .14); ctx.lineWidth = 1;
        EDGES.forEach(function (e) { if (e.aisle) return; var A = NODES[e.a], B = NODES[e.b]; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }); ctx.setLineDash([]);
        AIS.forEach(function (L, a) { var x = AX(a), blk = ok && read("aisles." + L + ".blocked"), isSel = on && on.type === "aisle" && on.L === L;
          ctx.strokeStyle = blk ? rgba(P.bad, .5) : rgba(P.ink, .12); ctx.lineWidth = blk ? 2 : 1; ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, BOT); ctx.stroke();
          if (blk) { ctx.save(); ctx.beginPath(); ctx.rect(x - 15, TOP + 18, 30, BOT - TOP - 36); ctx.clip(); ctx.strokeStyle = rgba(P.bad, .35); ctx.lineWidth = 3; for (var hy = TOP - 30; hy < BOT + 30; hy += 14) { ctx.beginPath(); ctx.moveTo(x - 20, hy); ctx.lineTo(x + 20, hy + 20); ctx.stroke(); } ctx.restore();
            [TOP + 24, BOT - 24].forEach(function (yy) { ctx.fillStyle = P.bad; rr(x - 13, yy - 4, 26, 8, 3); ctx.fill(); }); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4; rr(x - 17, TOP - 8, 34, BOT - TOP + 16, 8); ctx.stroke(); ctx.setLineDash([]); }
          txt(12, L, x, 92, blk ? P.bad : isSel ? P.acc : P.muted, "center", 700); if (blk) txt(9, "BLOCKED", x, BOT + 26, P.bad); });
        // charging docks
        for (var dd = 0; dd < DOCKS; dd++) { var D = NODES["D" + dd], busyD = bots.some(function (b) { return b.at === "D" + dd && b.phase === "charging"; }), pulse = busyD ? .5 + .5 * Math.sin(now / 300 + dd) : 0;
          if (busyD) { ctx.save(); ctx.shadowColor = P.ok; ctx.shadowBlur = 10 + 10 * pulse; ctx.strokeStyle = rgba(P.ok, .5 + .4 * pulse); ctx.lineWidth = 2; rr(D.x - 24, D.y - 22, 48, 44, 8); ctx.stroke(); ctx.restore(); }
          ctx.strokeStyle = rgba(P.ink, .25); ctx.lineWidth = 1; rr(D.x - 24, D.y - 22, 48, 44, 8); ctx.stroke();
          ctx.fillStyle = busyD ? P.ok : rgba(P.ink, .3); ctx.beginPath(); ctx.moveTo(D.x - 32, D.y - 7); ctx.lineTo(D.x - 38, D.y + 1); ctx.lineTo(D.x - 34, D.y + 1); ctx.lineTo(D.x - 36, D.y + 8); ctx.lineTo(D.x - 30, D.y - 1); ctx.lineTo(D.x - 34, D.y - 1); ctx.closePath(); ctx.fill(); }
        txt(10, "CHARGING", 72, 140, P.muted);
        // packing stations
        STATIONS.forEach(function (s, i) { var n = NODES[s[0]], hot = FX.some(function (f) { return f.kind === "drop" && Math.hypot(f.x - n.x, f.y - n.y) < 30 && now - f.t < 700; });
          ctx.fillStyle = rgba(P.acc, hot ? .22 : .08); rr(n.x - 52, n.y - 18, 104, 40, 8); ctx.fill(); ctx.strokeStyle = rgba(P.acc, hot ? .9 : .4); ctx.lineWidth = 1.2; ctx.stroke(); txt(10, "PACK " + (i + 1), n.x, n.y + 6, P.acc, "center", 700); });
        // orders waiting at their slot (audience: order status)
        if (ok && seeS) orders.forEach(function (o) { if (o.status === "done" || o.status === "delivering") return; var n = NODES[o.node], isSel = on && on.type === "order" && on.j === o.id, col = o.status === "queued" ? P.warn : P.busy;
          var bob = Math.sin(now / 400 + o.id) * 1.5; ctx.fillStyle = rgba(col, .9); rr(n.x + 10, n.y - 7 + bob, 11, 11, 2); ctx.fill(); ctx.strokeStyle = rgba(P.bg, .8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(n.x + 10, n.y - 2 + bob); ctx.lineTo(n.x + 21, n.y - 2 + bob); ctx.stroke();
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x + 15, n.y - 1, 12, 0, 7); ctx.stroke(); txt(9.5, "ORDER " + o.id, n.x + 15, n.y - 18, P.acc); } });
        // routes (audience: routes)
        if (ok && seeR) bots.forEach(function (b) { if (!b.path || (lite() && !(on && on.type === "robot" && on.i === b.id))) return; var isSel = on && on.type === "robot" && on.i === b.id;
          ctx.strokeStyle = rgba(isSel ? P.acc : b.phase === "toDock" ? P.ok : b.phase === "toStation" ? P.box : P.busy, isSel ? .9 : .22); ctx.lineWidth = isSel ? 2.4 : 1.4; ctx.setLineDash(isSel ? [6, 5] : [2, 5]); ctx.lineDashOffset = -now / 50;
          ctx.beginPath(); ctx.moveTo(b.x, b.y); for (var q = b.seg + 1; q < b.path.length; q++) ctx.lineTo(NODES[b.path[q]].x, NODES[b.path[q]].y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; });
        // effects
        FX = FX.filter(function (f) { return now - f.t < 1400; });
        FX.forEach(function (f) { var age = (now - f.t) / 1000; if (age < 0) return; var o = Math.max(0, 1 - age / 1.4);
          if (f.x2 != null) { var u = Math.min(1, age / .55), x = f.x + (f.x2 - f.x) * u, y = f.y + (f.y2 - f.y) * u, col = f.kind === "assign" ? P.box : P.glow;
            ctx.save(); ctx.globalAlpha = o * .55; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = o; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); ctx.restore(); return; }
          var col2 = f.kind === "pick" || f.kind === "drop" ? P.box : f.kind === "aisle" ? P.bad : P.glow, r = f.kind === "src" ? 6 + age * 70 : f.kind === "aisle" ? 20 + age * 160 : 6 + age * 30;
          ctx.globalAlpha = o * .8; ctx.strokeStyle = col2; ctx.lineWidth = f.kind === "src" || f.kind === "aisle" ? 2 : 1.3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
        // robots
        var big = !lite(), RS = big ? Math.min(1.25, FS * .8 + .2) : 1;
        if (lite()) { var n0 = slice; for (var s2 = 0; s2 < 120; s2++) { var bb = bots[(n0 + s2) % bots.length]; if (bb) look(bb, true); } slice = (slice + 120) % Math.max(1, bots.length); }
        bots.forEach(function (b) { if (!ok) return; var L = big ? look(b, true) : cache[b.id] || look(b, true), isSel = on && on.type === "robot" && on.i === b.id, pz = b.pulse ? (now - b.pulse) / 900 : 9;
          var led = L.chg ? P.ok : L.low ? P.bad : L.busy ? P.busy : L.can ? P.ok : P.warn;
          if (!big) { ctx.fillStyle = rgba(led, .9); ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill(); if (L.carry) { ctx.fillStyle = P.box; ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); }
            if (pz >= 0 && pz < 1) { ctx.globalAlpha = 1 - pz; ctx.strokeStyle = P.glow; ctx.beginPath(); ctx.arc(b.x, b.y, 4 + pz * 10, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
            if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, 7); ctx.stroke(); } return; }
          ctx.save(); ctx.translate(b.x, b.y);
          if (pz >= 0 && pz < 1) { ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 18 * (1 - pz); ctx.strokeStyle = rgba(P.glow, 1 - pz); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13 * RS + pz * 14, 0, 7); ctx.stroke(); ctx.restore(); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 19 * RS, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          ctx.save(); ctx.rotate(b.ang); ctx.scale(RS, RS);
          ctx.fillStyle = rgba(P.ink, .22); ctx.fillRect(-9, -10.5, 7, 3); ctx.fillRect(3, -10.5, 7, 3); ctx.fillRect(-9, 7.5, 7, 3); ctx.fillRect(3, 7.5, 7, 3);
          ctx.fillStyle = P.paper; ctx.strokeStyle = rgba(P.ink, .75); ctx.lineWidth = 1.3; rr(-11, -8, 22, 16, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = led; ctx.save(); ctx.shadowColor = led; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(8, 0, 2, 0, 7); ctx.fill(); ctx.restore();
          if (L.carry) { ctx.fillStyle = P.box; rr(-7, -6, 11, 12, 2); ctx.fill(); ctx.strokeStyle = rgba(P.bg, .6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(4, 0); ctx.stroke(); }
          ctx.restore();
          if (seeB) { var bw = 20 * RS, f = Math.max(0, Math.min(1, (L.bat || 0) / 100)), bc = f < .25 ? P.bad : f < .5 ? P.warn : P.ok;
            ctx.fillStyle = rgba(P.ink, .14); rr(-bw / 2, -19 * RS, bw, 4, 2); ctx.fill(); ctx.fillStyle = bc; rr(-bw / 2, -19 * RS, Math.max(2, bw * f), 4, 2); ctx.fill();
            if (L.chg) { ctx.globalAlpha = .5 + .5 * Math.sin(now / 200); ctx.fillStyle = P.ok; ctx.fillRect(-bw / 2 + bw * f - 2, -19 * RS, 2, 4); ctx.globalAlpha = 1; } }
          if (isSel || K.N <= 20) txt(isSel ? 10 : 8.5, String(b.id), 0, 22 * RS + 4, isSel ? P.acc : P.faint, "center", isSel ? 700 : 500);
          ctx.restore(); });
        // HUD: the threshold every canTake reads, and the last propagation
        if (ok) { var th = read("fleet.threshold"), hot = K.trace && K.trace.path === "fleet.threshold" && now - K.trace.t < 900; var ht = "fleet.threshold = " + th; ctx.font = "600 " + (11 * FS).toFixed(1) + "px " + MONO; var hw = ctx.measureText(ht).width + 24;
          ctx.fillStyle = rgba(P.acc, hot ? .2 : .07); rr(14, 22, hw, 14 + 14 * FS, 8); ctx.fill(); ctx.strokeStyle = rgba(P.acc, hot ? .9 : .35); ctx.stroke();
          txt(11, ht, 14 + hw / 2, 29 + 10 * FS, P.acc, "center", 600);
          var tr = K.trace; if (tr && now - tr.t < 6000) { ctx.globalAlpha = Math.min(1, (6000 - (now - tr.t)) / 800); txt(11, (tr.label || tr.path + " = " + tr.value) + " → " + tr.recomputed.length + " recomputed", W - 16, 41, P.glow, "right", 600); ctx.globalAlpha = 1; }
          txt(10, K.N + " ROBOTS · " + KL.toUpperCase() + (seeS && seeB && seeR ? "" : " · VIEW AS " + audiences.view.toUpperCase()), W / 2, H - 14, P.muted); }
      }
      function frame(t) { var dt = Math.min(.05, (t - last) / 1000); last = t; if (running.on) step(dt); draw(); frames++; if (t - fpsT > 1000) { K.fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; } raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      function hit(e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, best = null, bd = lite() ? 10 : 22;
        bots.forEach(function (b) { var d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = { type: "robot", i: b.id }; } });
        if (!best) orders.forEach(function (o) { if (o.status === "done" || o.status === "delivering") return; var n = NODES[o.node]; if (Math.hypot(n.x + 15 - x, n.y - 1 - y) < 12) best = { type: "order", j: o.id }; });
        if (!best && y > TOP - 30 && y < BOT + 30) AIS.forEach(function (L, a) { if (Math.abs(AX(a) - x) < 18) best = { type: "aisle", L: L }; });
        if (!best && x < 200 && y < 60) best = { type: "fleet", p: "fleet.threshold" };
        select(best); if (best && window.innerWidth < 980) setTimeout(function () { var p = document.querySelector("[data-wf=explain-card]"); if (p) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60); }
      c.addEventListener("click", hit); return function () { cancelAnimationFrame(raf); c.removeEventListener("click", hit); };
    }, []);
    return h("div", { className: "wf-fig" }, h("canvas", { ref: cv, width: W, height: H, role: "img", "data-wf": "floor", "aria-label": "Warehouse floor: eight aisles between racks, charging docks on the left, three packing stations; robots carry boxes between them" }));
  }

  // ── controls under the map ──
  function Toolbar() {
    var k = useKernel(), cur = useSel(), rs = useState(running.on), run = rs[0], setRun = rs[1], ok = k.status === "ok";
    var target = cur && cur.type === "robot" ? cur.i : 1 + (k.seq * 7) % k.N, aisle = cur && cur.type === "aisle" ? cur.L : "C", blk = ok && read("aisles." + aisle + ".blocked");
    var B = function (id, label, fn, title, on) { return h("button", { type: "button", className: "wf-btn" + (on ? " on" : ""), "data-wf": id, disabled: !ok, title: title, onClick: fn }, label); };
    return h("div", { className: "wf-bar", "data-wf": "toolbar" },
      B("drain", "Drain robot " + target, function () { actions.drain(target); }, "Writes robots." + target + ".battery = 12"),
      B("block", (blk ? "Open" : "Block") + " aisle " + aisle, function () { actions.block(aisle); }, "Writes aisles." + aisle + ".blocked; robots routed through it re-plan and write their dist", blk),
      B("order", "Add order", function () { actions.order(); }, "Writes orders[n]; the dispatcher points it at a robot that canTake"),
      B("threshold", "Threshold " + (ok && read("fleet.threshold") === 30 ? "30 → 60" : "60 → 30"), function () { actions.threshold(); }, "Writes fleet.threshold; every robots[i].canTake reads it"),
      h("span", { className: "wf-sep" }),
      h("span", { className: "wf-seg", role: "group", "aria-label": "Fleet size" }, [20, 100, 1000].map(function (n) { return h("button", { key: n, type: "button", className: "wf-btn" + (k.N === n ? " on" : ""), "data-wf": "scale-" + n, disabled: !ok, "aria-pressed": k.N === n ? "true" : "false", onClick: function () { rescale(n); } }, n); })),
      h("button", { type: "button", className: "wf-btn" + (run ? "" : " on"), "data-wf": "pause", onClick: function () { running.on = !running.on; setRun(running.on); } }, run ? "Pause" : "Resume"));
  }

  // ── the cards under the map: fleet, last propagation, explain, audiences, kernel ──
  var V = function (x) { return x === undefined ? "–" : x === null ? "null" : typeof x === "object" ? JSON.stringify(x) : String(x); };
  function Fleet() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ag = aggOn(k.N), avail = 0, carrying = 0;
    if (ok && !ag) bots.forEach(function (b) { var L = cache[b.id] || look(b); if (L.can === true) avail++; if (L.carry) carrying++; });
    var queued = orders.filter(function (o) { return o.status === "queued"; }).length;
    var kpi = function (id, label, val, p) { var on = cur && cur.type === "fleet" && cur.p === p; return h("button", { type: "button", key: id, className: "wf-kpi", "data-wf": "kpi-" + id, "aria-pressed": on ? "true" : "false", disabled: !p, onClick: p ? function () { select({ type: "fleet", p: p }); } : undefined, title: p ? "me.explain(\"" + p + "\")" : "tallied by the page from per-robot reads (aggregates are off above 100 robots)" }, h("small", null, label), h("b", null, ok ? V(val) : "–")); };
    return h("section", { className: "wf-card", "data-wf": "fleet" }, h("div", { className: "wf-h" }, "Fleet · " + k.N + " robots · " + KL),
      h("div", { className: "wf-kpis" },
        kpi("avail", ag ? "fleet.available" : "canTake = true", ag ? read("fleet.available") : avail, ag ? "fleet.available" : null), kpi("carrying", ag ? "fleet.carrying" : "carrying", ag ? read("fleet.carrying") : carrying, ag ? "fleet.carrying" : null),
        kpi("avg", "fleet.avgBattery", ag ? Math.round(read("fleet.avgBattery") * 10) / 10 : "–", ag ? "fleet.avgBattery" : null),
        kpi("delivered", "fleet.delivered", read("fleet.delivered"), "fleet.delivered"), kpi("queued", "orders queued", queued, null), kpi("recomputes", "recomputed (traced)", k.recomputes, null)),
      h("div", { className: "wf-row", style: { marginTop: 6 } }, h("span", null, "writes · writes/s · fps"), h("span", { className: "wf-num", "data-wf": "rate" }, ok ? k.writes + " · " + Math.round(k.writes / Math.max(1, (performance.now() - k.t0) / 1000)) + " · " + (k.fps || "–") : "–")),
      h("div", { className: "wf-row" }, h("span", null, "seed " + k.N + " robots + 6 rules"), h("span", { className: "wf-num" }, ok && k.seedMs != null ? k.seedMs.toFixed(1) + " ms" : "–")),
      k.N > 100 ? h("div", { className: "wf-note" }, "At " + k.N + " robots the floor writes on arrival only and traces your actions, not every move. The fleet aggregates (robots[].canTake, robots[].battery / robots[]) are off: each robot write would re-scan all " + k.N + " robots for every aggregate, so the page tallies these numbers itself.") : null);
  }
  function Trace() {
    var k = useKernel(), tr = k.trace;
    return h("section", { className: "wf-card", "data-wf": "trace" }, h("div", { className: "wf-h" }, "Last propagation · meta.recomputed"),
      !tr ? h("div", { className: "wf-note" }, "Drain a battery, block an aisle, add an order or change the threshold: the kernel recomputes only the dependents, listed here from ", me("me.explain(path).meta.recomputed"), ".")
        : h(React.Fragment, null,
          h("div", { className: "wf-row" }, h("span", null, tr.label || "write"), h("span", { className: "wf-num" }, me(tr.path + " = " + V(tr.value)))),
          h("div", { className: "wf-row" }, h("span", null, "recomputed · changed" + (tr.reroutes != null ? " · re-routed" : "")), h("span", { className: "wf-num", "data-wf": "recomputed-count" }, tr.recomputed.length + " · " + tr.changed.length + (tr.reroutes != null ? " · " + tr.reroutes : "") + " of " + k.N + " robots")),
          h("div", { className: "wf-chips", "data-wf": "recomputed" }, tr.recomputed.slice(0, 80).map(function (p, i) { return h("span", { key: i, className: "wf-chip" + (tr.changed.indexOf(p) >= 0 ? " ch" : "") }, p); }).concat(tr.recomputed.length > 80 ? [h("span", { key: "m", className: "wf-chip" }, "+" + (tr.recomputed.length - 80))] : [])),
          h("div", { className: "wf-note" }, "Highlighted: the value changed. Glow and ripples on the map are drawn from this list. ", link(L_OK, "O(k)"))));
  }
  function Explain() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ts = useState(null), tab = ts[0], setTab = ts[1];
    useEffect(function () { setTab(cur && cur.tab || null); }, [cur && (cur.type + (cur.i || cur.j || cur.L || cur.p))]);
    var d = null;
    if (ok && cur) {
      if (cur.type === "robot" && cur.i <= k.N) { var p = "robots." + cur.i, task = read(p + ".task"), b = bots[cur.i - 1];
        d = { title: "Robot " + cur.i + " · " + (b ? b.phase : ""), rows: ["battery", "busy", "charging", "speed", "dist", "pos", "task", "carry"].map(function (f) { return [p + "." + f, read(p + "." + f)]; }),
          tabs: [p + ".canTake", p + ".eta", p + ".low", p + ".range"].concat(task ? ["orders." + task + ".eta", "orders." + task + ".late"] : []) }; }
      else if (cur.type === "order") { var q = "orders." + cur.j;
        d = { title: "Order " + cur.j, rows: ["item", "aisle", "slot", "station", "sla", "status"].map(function (f) { return [q + "." + f, read(q + "." + f)]; }).concat([[q + ".robot", read(q + ".robot")]]), tabs: [q + ".eta", q + ".late", q + ".status"] }; }
      else if (cur.type === "aisle") { d = { title: "Aisle " + cur.L, rows: [["aisles." + cur.L + ".blocked", read("aisles." + cur.L + ".blocked")]], tabs: ["aisles." + cur.L + ".blocked"], note: "Blocking writes this value; robots routed through the aisle re-plan and write their new dist, so only their eta, their order's eta and the fleet aggregates over robots[] recompute." }; }
      else if (cur.type === "fleet") d = { title: cur.p, rows: [[cur.p, read(cur.p)]], tabs: [cur.p] };
    }
    var path = d ? (tab && d.tabs.indexOf(tab) >= 0 ? tab : tab === "canTake" ? d.tabs[0] : d.tabs[0]) : null, ex = path ? K.me.explain(path) : null;
    return h("section", { className: "wf-card", "data-wf": "explain-card", style: { gridColumn: "1 / -1" } }, h("div", { className: "wf-h" }, d ? d.title : "Explain"),
      !d ? h("div", { className: "wf-note" }, "Click a robot, an order box, an aisle or a number for its paths and ", me("me.explain(path)"), " as the kernel returns it (", link(L_EXP, "Explain"), ").") :
      h(React.Fragment, null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", columnGap: 14 } }, d.rows.map(function (r) { return h("div", { key: r[0], className: "wf-row" }, h("span", { className: "wf-num me-code", style: { color: "inherit" } }, synJ(r[0].split(".").slice(-1)[0])), h("span", { className: "wf-num" }, V(r[1]))); })),
        d.note ? h("div", { className: "wf-note" }, d.note) : null,
        h("div", { className: "wf-tabs", role: "tablist" }, d.tabs.map(function (t) { return h("button", { key: t, type: "button", role: "tab", className: "wf-tab" + (t === path ? " on" : ""), "aria-selected": t === path ? "true" : "false", onClick: function () { setTab(t); } }, t.split(".").slice(1).join(".")); })),
        h("div", { className: "wf-note" }, me('me.explain("' + path + '")'), " · " + KL + " · live"),
        h("pre", { className: "wf-json me-code", "data-wf": "explain" }, synJ(fmtJ(ex)))));
  }
  function Audiences() {
    var k = useKernel(), as = useState(0), A = audiences; useEffect(function () { var f = as[1]; A.subs.push(f); return function () { A.subs = A.subs.filter(function (g) { return g !== f; }); }; }, []);
    var ok = k.status === "ok";
    return h("section", { className: "wf-card", "data-wf": "audiences" }, h("div", { className: "wf-h" }, "Audiences · ME.wrapSecretV1 (OR)"),
      h("div", { className: "wf-bar", style: { marginTop: 0 } }, h("span", { className: "wf-seg", role: "group", "aria-label": "View as" }, PARTIES.map(function (p) { return h("button", { key: p, type: "button", className: "wf-btn" + (A.view === p ? " on" : ""), "data-wf": "as-" + p, disabled: !ok || !A.wraps, onClick: function () { A.open(p); } }, p); })),
        h("button", { type: "button", className: "wf-btn", "data-wf": "reseal", disabled: !ok || A.busy, onClick: function () { A.seal(); }, title: "Seal a fresh snapshot for each audience" }, A.busy ? "Sealing…" : "Re-seal")),
      h("div", { className: "wf-aud", "data-wf": "aud-results" }, AUD.map(function (au) { var r = A.results[au.k];
        return [h("span", { key: au.k + "a" }, au.label, h("br"), h("small", { style: { color: TX2 } }, au.members.join(" OR "))),
          h("span", { key: au.k + "b" }, !r ? "…" : r.ok ? h(React.Fragment, null, h("span", { className: "ok" }, "opened (wrap for " + r.kid + ") "), h("code", null, r.text.length > 120 ? r.text.slice(0, 120) + " …" : r.text))
            : h(React.Fragment, null, h("span", { className: "no" }, "unwrapSecretV1 with " + A.view + "'s key on the wrap for " + r.kid + " → "), h("code", null, r.err)))]; })),
      h("div", { className: "wf-note" }, A.wraps ? "Sealed " + new Date(A.sealedAt).toLocaleTimeString() + " in " + A.ms.toFixed(0) + " ms. " : "", "The map shows a layer only if this party opens its wrap: order boxes, battery bars, route lines. P-256 keys from ", me("ME.generateP256KeyPair()"), ". ", link(L_AUD, "Audiences")));
  }
  function KernelCard() { var k = useKernel(), st = MK.state;
    return h("section", { className: "wf-card", style: { gridColumn: "1 / -1" } }, h("details", { className: "wf-k", "data-wf": "kernel" },
      h("summary", null, "Kernel · ", link(MK.KERNEL.npm, KL), " · ", st.state === "ok" ? h("span", { className: "ok" }, "sha256 verified") : st.state === "error" ? h("span", { className: "bad" }, "failed: " + st.text) : "loading…"),
      st.state === "ok" ? [h("div", { key: "h" }, "sha256 " + st.hash), h("div", { key: "u" }, "from ", link(st.url, st.url.replace("https://", ""))), h("div", { key: "s" }, "page source: ", link(SRC_URL, "warehouse.js"))] : null)); }
  function Right() { return h("div", { className: "wf-right" }, h(Floor), h(Toolbar),
    h("p", { className: "wf-cap" }, "LED: green canTake · blue busy · red low · amber held. Boxes ride on robots carrying an order; bars are ", me("battery"), "; glow and ripples are the paths the kernel recomputed. Click anything."),
    h("div", { className: "wf-panel" }, h(Explain), h(Trace), h(Fleet), h(Audiences), h(KernelCard))); }

  // ── left sidebar: the narrated steps; each Run executes on a shared new ME() (me-run.js), each map button acts on the live floor ──
  var STEPS = [
    { t: "Each robot is a path", map: [["Show robot 1", function () { select({ type: "robot", i: 1 }); }]],
      body: function () { return ["A robot is a branch of one tree: ", me("robots[1].battery"), ", ", me(".busy"), ", ", me(".speed"), ", ", me(".pos"), ", ", me(".task"), ". Indexes make a collection. ", link(L_PATHS, "Paths")]; },
      code: 'me.robots[1].battery(82)\nme.robots[1].busy(0)\nme.robots[1].charging(0)\nme.robots[1].speed(1.6)\nme.robots[1].dist(24)\nme("robots[1].battery")' },
    { t: "Rules for every robot", map: [["Threshold 30 ↔ 60", function () { actions.threshold(); }]],
      body: function () { return ["One ", me('["="]'), " under ", me('["[i]"]'), " declares the rule for every member, present and future. All of them read ", me("fleet.threshold"), ", so changing it recomputes every ", me("canTake"), " and nothing else. ", link(L_OPS, "Operators")]; },
      code: 'me.fleet.threshold(30)\nme.robots["[i]"]["="]("canTake", "battery > fleet.threshold && !busy && !charging")\nme.robots["[i]"]["="]("eta", "dist / speed")\nme("robots[1].canTake")\nme("robots[1].eta")' },
    { t: "Drain a battery", map: [["Drain robot 1", function () { actions.drain(1); }]],
      body: function () { return ["One write, and only that robot's dependents recompute (plus the fleet aggregates over robots[], see step 4). The explain shows the expression, its inputs and ", me("meta.recomputed"), ". ", link(L_EXP, "Explain")]; },
      code: 'me.robots[1].battery(12)\nme("robots[1].canTake")\nme.explain("robots[1].canTake")' },
    { t: "Count the fleet", map: [["Show fleet.available", function () { select({ type: "fleet", p: "fleet.available" }); }], ["fleet.avgBattery", function () { select({ type: "fleet", p: "fleet.avgBattery" }); }]],
      body: function () { return [me("robots[]"), " counts the robots, ", me("robots[].battery"), " sums a field, and a boolean field sums as its count of ", me("true"), ": ", me("robots[].canTake"), " is how many can take an order. The explain shows it as one input with ", me('kind: "aggregate"'), ". Every robot write re-scans the collection, so the floor declares these up to 100 robots. ", link(DOCS + "Aggregates.html", "Aggregates")]; },
      code: 'me.robots[2].battery(70)\nme.robots[2].busy(0)\nme.robots[2].charging(0)\nme.fleet["="]("available", "robots[].canTake")\nme.fleet["="]("avgBattery", "robots[].battery / robots[]")\nme("fleet.available")\nme("fleet.avgBattery")\nme.explain("fleet.available").derivation.inputs[0].aggregate' },
    { t: "Orders point at robots", map: [["Add order", function () { actions.order(); }]],
      body: function () { return ["The dispatcher writes ", me('orders[j].robot["->"]("robots.i")'), "; the order's ", me("eta"), " and ", me("late"), " read through the pointer, so a robot's new ", me("dist"), " reaches its order. ", link(L_PTR, "Pointers")]; },
      code: 'me.orders[1].sla(30)\nme.orders[1].robot["->"]("robots.1")\nme.orders["[i]"]["="]("eta", "robot.eta")\nme.orders["[i]"]["="]("late", "robot.eta > sla")\nme.robots[1].dist(60)\nme("orders[1].eta")\nme("orders[1].late")' },
    { t: "Block an aisle", map: [["Block / open aisle C", function () { actions.block("C"); }]],
      body: function () { return ["Robots routed through the aisle re-plan and write their new ", me("dist"), ". Their ", me("eta"), ", their order's ", me("eta"), " and the fleet aggregates recompute; the other robots do not. The ripples go from the aisle to exactly those."]; },
      code: 'me.aisles.C.blocked(1)\nme.robots[1].dist(31.5)\nme.explain("orders[1].eta").meta.recomputed' },
    { t: "100 or 1000 robots", map: [["100", function () { rescale(100); }], ["1000", function () { rescale(1000); }], ["20", function () { rescale(20); }]],
      body: function () { return ["The rules stay the same: robot 1000 gets ", me("canTake"), " the moment it has a battery. A write still recomputes its own dependents only. ", link(DOCS + "Extreme-Fan-Out.html", "Extreme Fan-Out")]; },
      code: 'me.robots[1000].battery(64)\nme.robots[1000].busy(0)\nme.robots[1000].charging(0)\nme("robots[1000].canTake")' },
    { t: "Who sees what", map: [["View as client", function () { audiences.open("client"); }], ["maintenance", function () { audiences.open("maintenance"); }], ["ops", function () { audiences.open("ops"); }]],
      body: function () { return ["Order status is sealed for client OR ops, batteries for maintenance OR ops, routes for ops: one ", me("ME.wrapSecretV1"), " per member. A party that is not a member gets the kernel's error, and its map hides that layer. ", link(L_AUD, "Audiences")]; },
      code: null, static: 'const W = await ME.wrapSecretV1({ secret, recipientPublicKey: maintenance.publicKey, kid: "maintenance", class: "identity-key" })\nawait ME.unwrapSecretV1(W, maintenance.privateKey, "utf8")   // the batteries JSON\nawait ME.unwrapSecretV1(W, client.privateKey, "utf8")        // throws OperationError' }];
  function Side() {
    var ss = useState(-1), on = ss[0], setOn = ss[1], k = useKernel(), Run = window.MeRun && window.MeRun.MeRunBlock, idx = 0;
    var toMap = function () { if (window.innerWidth >= 980) return; var f = document.querySelector(".wf-fig"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" }); };
    return h("aside", { className: "wf-side", "data-wf": "steps", "aria-label": "How it works, step by step" }, h("h2", null, "How it works"),
      STEPS.map(function (s, i) { var ri = s.code ? idx++ : -1;
        return h("section", { key: i, className: "wf-step" + (on === i ? " on" : ""), "data-wf": "step-" + (i + 1) },
          h("h3", null, h("b", null, i + 1), s.t), h("p", null, s.body()),
          s.code && Run ? h(Run, { idx: ri, code: s.code, compact: true }) : s.static ? h("pre", { className: "me-code wf-json", style: { maxHeight: "none", whiteSpace: "pre-wrap", margin: "0 0 10px" } }, h("code", null, synJ(s.static))) : null,
          h("div", { className: "wf-bar" }, h("span", { style: { fontSize: 11.5, color: TX2 } }, "On the map:"), s.map.map(function (m, j) { return h("button", { key: j, type: "button", className: "wf-btn", disabled: k.status !== "ok", "data-wf": "map-" + (i + 1) + "-" + (j + 1), onClick: function () { setOn(i); m[1](); toMap(); } }, m[0]); }))); }),
      h("p", { className: "wf-cap" }, "Run executes the blocks in page order on one shared ", me("new ME()"), " from " + KL + " (", link("https://neurons-me.github.io/.me/assets/me-run/me-run.js", "me-run.js"), "); the floor runs its own instance. Source: ", link(SRC_URL, "warehouse.js"), "."));
  }
  var RELATED = [
    ["https://neurons-me.github.io/robots/", "https://neurons-me.github.io/robots/assets/ROBOTS-CONTEXT-LAB.jpg", "Robots", "All the robot demos on .me."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Space/", "https://neurons-me.github.io/.me/Demos/Robots/Space/assets/space-robots-og-4.2.png", "Autonomous Robotics in Space", "Three spider robots on two small rocks, each with its own .me kernel."],
    ["https://neurons-me.github.io/.me/Demos/SmartCities/AntCity/", "https://neurons-me.github.io/.me/Demos/SmartCities/AntCity/assets/ant-city-card.webp", "Ant City", "Scouts, trails and recruitment waves on the same kernel."],
    ["https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/", "https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/assets/ai-decides-og.png", "AI decides, .me computes", "One stored decision recomputes a city's bus network."]];
  function Related() {
    return h("section", { className: "wf-rel", "data-wf": "related" }, h("h2", null, "Related"),
      h("div", { className: "wf-cards" }, RELATED.map(function (c) { return h("a", { key: c[0], className: "wf-card2", href: c[0] },
        h("span", { className: "img" }, h("img", { src: c[1], alt: "", loading: "lazy" })), h("span", { className: "tx" }, h("b", null, c[2]), h("small", null, c[3]))); })));
  }
  function Dashboard() { return h("div", { className: "wf-dash" }, h(Side), h(Right)); }
  var LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=3"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  var PATH = [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
    { text: "Robots", href: "https://neurons-me.github.io/robots/", title: "Robots" }, { text: "Warehouse", href: null, title: "This page" }];
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
  // ── intro: "only what depends on it recomputes" drains a real battery and lists the kernel's meta.recomputed inline ──
  function derivedCount() { var c = [], i; for (i = 1; i <= bots.length; i++) ["canTake", "eta", "low", "range"].forEach(function (f) { c.push("robots." + i + "." + f); });
    orders.forEach(function (o) { ["eta", "late"].forEach(function (f) { c.push("orders." + o.id + "." + f); }); });
    ["fleet.avgBattery", "fleet.carrying", "fleet.available", "fleet.lowCount"].forEach(function (p) { c.push(p); });
    return c.filter(function (p) { var e = K.me.explain(p); return e && e.derivation && e.derivation.expression; }).length; }
  function pickBot() { var ok = bots.filter(function (b) { return (read(RP(b) + ".battery") || 0) > 12; }); return ok.filter(function (b) { return b.order; })[0] || ok[0] || null; }
  function Reads() {
    var k = useKernel(), rs = useState(null), res = rs[0], setRes = rs[1], os = useState(false), open = os[0], setOpen = os[1], ok = k.status === "ok";
    var hover = function () { if (!ok) return; var b = pickBot(); if (b) { b.pulse = performance.now(); select({ type: "robot", i: b.id }); } };
    var go = function () { if (!ok) return; var b = pickBot(); if (!b) return; var tr = actions.drain(b.id); if (!tr) return; setRes({ id: b.id, order: b.order, rec: tr.recomputed.slice(), total: derivedCount() }); setOpen(false); };
    var n = res ? res.rec.length : 0, shown = res ? (open ? res.rec : res.rec.slice(0, 8)) : [];
    return h(React.Fragment, null,
      h("button", { type: "button", className: "wf-reads", "data-wf": "reads", disabled: !ok, onMouseEnter: hover, onFocus: hover, onClick: go, title: "Drains a robot's battery to 12 through the kernel and lists me.explain(…).meta.recomputed" }, "only what depends on it recomputes"), ".",
      res ? h("span", { className: "wf-reads-out", "data-wf": "reads-out" },
        h("span", { className: "wf-reads-h" }, "robot " + res.id + " battery → 12 · ", h("b", null, n + " of " + res.total), " derived paths recomputed" + (res.order ? " · order " + res.order : "")),
        shown.map(function (p, x) { return h("span", { key: x, className: "wf-reads-chip" }, me(p)); }),
        n > 8 ? h("button", { type: "button", className: "wf-reads-more", "data-wf": "reads-more", onClick: function () { setOpen(!open); } }, open ? "less" : "+" + (n - 8) + " more") : null) : null);
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
    N("WFTopBar", "topbar"),
    N("Box", "main", { component: "main", sx: { maxWidth: 1440, mx: "auto", px: { xs: 1.5, sm: 3 }, pt: { xs: 2.5, sm: 3.5 }, pb: 8 } }, [
      N("Typography", "kicker", { component: "p", sx: { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1 } }, ["Robots · " + KL]),
      N("Typography", "title", { component: "h1", sx: { fontSize: "clamp(1.9rem, 5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1 } }, ["Warehouse Fleet"]),
      N("Typography", "lede", { component: "p", sx: { color: "text.secondary", mb: 3, maxWidth: 760 } }, ["Each robot is ", me("robots[i]"), " with ", me("robots[i].battery"), " and ", me(".task"), "; one rule, ", me('robots["[i]"]["="]("canTake", "battery > fleet.threshold && !busy && !charging")'), ", and one aggregate, ", me('fleet["="]("available", "robots[].canTake")'), ". Drain a battery and ", h(Reads)]),
      N("WFDashboard", "fleet"),
      N("WFRelated", "related"),
    ]),
  ]);
  var scope = window.__thisGuiThemeScope || {};
  var mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; } catch (e) {}
  var PageTheme = function (p) { return h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, p.children); };
  if (G.getInspectorEnabled()) G.setInspectorEnabled(false);
  var pageType = function (Comp) { return { type: "x", resolve: function (s) { var p = Object.assign({}, s.props || {}); delete p.key; return h(Comp, p); } }; };
  var reg = Object.assign({}, G.Registry || G.registry); [["WFTopBar", TopBar], ["WFDashboard", Dashboard], ["WFRelated", Related]].forEach(function (x) { reg[x[0]] = pageType(x[1]); reg[x[0]].type = x[0]; });
  G.mount(spec, ROOT, { me: window.WarehouseKernel, gui: Object.assign({}, G, { render: undefined, RunMe: undefined, Theme: PageTheme, registry: reg }), devtools: { enabled: true, inspector: false, adminView: false, inspectorToggleVisible: false } });
  document.documentElement.classList.add("gui-on");
  window.__wf = { K: K, bots: function () { return bots; }, orders: function () { return orders; }, select: select, actions: actions, audiences: audiences, rescale: rescale };
})();
