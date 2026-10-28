/*! City Delivery 0.1.0 · sidewalk robots and drones held in a this.me 4.2.1 kernel · MIT · neurons.me
 * The kernel (this.me 4.2.1 from npm, sha256 checked in the browser by /.me/assets/me-kernel/me-kernel.js) holds the city:
 * streets[s].closed, lights[l].red with lights[i].wait = red * city.cycle, couriers[i].battery / speed / dist / busy /
 * delivering / flying and a pointer couriers[i].next -> lights.l (the next light on its route; drones point at lights.sky).
 * Rules are ["="] derivations declared once for every member: couriers[i].eta = dist / speed + next.wait, canTake, low;
 * orders[j].eta / late through the pointer orders[j].courier -> couriers.i. A light change or a closed street recomputes
 * only the ETAs that depend on it; glow and ripples on the map are drawn from meta.recomputed of me.explain(). Fleet
 * numbers are collection aggregates (couriers[].delivering, couriers[].battery / couriers[]), declared up to 60 couriers.
 * Each customer's orders are sealed for that customer OR city ops, the fleet for ops, with ME.wrapSecretV1.
 */
(function () {
  var G = window.GUI, React = window.React, ROOT = document.getElementById("root"), MK = window.MeKernel;
  if (!G || !React || !window.ReactDOM || typeof G.mount !== "function" || !ROOT || !MK) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", KV = MK.KERNEL.version, KL = MK.KERNEL.label;
  var params = new URLSearchParams(location.search);
  var SRC_URL = "https://github.com/neurons-me/.me/blob/main/Demos/SmartCities/CityDelivery/city-delivery.js", SRC_NAME = "city-delivery.js";
  var DOCS = "https://neurons-me.github.io/.me/docs/", L_OPS = DOCS + "Operators.html", L_EXP = DOCS + "Explain.html", L_PTR = DOCS + "Pointer-Composition.html",
    L_AUD = DOCS + "Audiences.html", L_PATHS = DOCS + "me-whatever-what.html", L_OK = DOCS + "O-k.html", L_AGG = DOCS + "Aggregates.html";

  // ── the city: a 7 × 5 street grid, traffic lights on inner crossings, a robot hub and a drone pad ──
  var W = 1200, H = 720, PXM = 2;   // 2 px = 1 m
  var CX = function (i) { return 110 + i * 163; }, CY = function (j) { return 80 + j * 140; }, NI = 7, NJ = 5;
  var NODES = {}, EDGES = {}, adj = {};
  function node(id, x, y) { NODES[id] = { id: id, x: x, y: y }; adj[id] = []; }
  function street(id, a, b) { var e = { id: id, a: a, b: b, len: Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y) / PXM }; EDGES[id] = e; adj[a].push({ n: b, e: e }); adj[b].push({ n: a, e: e }); }
  var i, j;
  for (i = 0; i < NI; i++) for (j = 0; j < NJ; j++) node("n" + i + "_" + j, CX(i), CY(j));
  for (i = 0; i < NI; i++) for (j = 0; j < NJ; j++) { if (i < NI - 1) street("h" + i + "_" + j, "n" + i + "_" + j, "n" + (i + 1) + "_" + j); if (j < NJ - 1) street("v" + i + "_" + j, "n" + i + "_" + j, "n" + i + "_" + (j + 1)); }
  var LIGHTS = []; for (i = 1; i < NI - 1; i++) for (j = 1; j < NJ - 1; j++) if ((i + j) % 2 === 0 || i === 3) { var lid = "L" + (LIGHTS.length + 1); NODES["n" + i + "_" + j].light = lid; LIGHTS.push({ id: lid, node: "n" + i + "_" + j, phase: (i * 3 + j * 5) % 7 }); }
  var LIGHT_BY = {}; LIGHTS.forEach(function (l) { LIGHT_BY[l.id] = l; });
  var HUB = "n0_4", PAD = { x: 60, y: 300 }, CYCLE = 25;
  var HOMES = []; (function () { var k = 0; for (var a = 0; a < NI - 1; a++) for (var b = 0; b < NJ - 1; b++) { if ((a * 5 + b * 3) % 4 === 3) continue; HOMES.push({ id: HOMES.length + 1, node: "n" + (a + (k % 2)) + "_" + b, x: CX(a) + 82, y: CY(b) + 70, customer: 1 + (HOMES.length % 6) }); k++; } })();

  function route(from, to, closed) {   // Dijkstra on metres over open streets (page code; the kernel holds the result)
    var dist = {}, prev = {}, done = {}, q = [from]; dist[from] = 0;
    while (q.length) { var bi = 0; for (var x = 1; x < q.length; x++) if (dist[q[x]] < dist[q[bi]]) bi = x; var c = q.splice(bi, 1)[0]; if (done[c]) continue; done[c] = 1; if (c === to) break;
      adj[c].forEach(function (o) { if (closed[o.e.id]) return; var nd = dist[c] + o.e.len; if (dist[o.n] == null || nd < dist[o.n]) { dist[o.n] = nd; prev[o.n] = c; q.push(o.n); } }); }
    if (dist[to] == null) return null; var p = [to]; while (p[0] !== from) p.unshift(prev[p[0]]); return p;
  }
  function edgeOf(a, b) { var x = adj[a].filter(function (q) { return q.n === b; })[0]; return x && x.e; }
  function pathLen(p, seg, t) { var L = 0; for (var x = seg; x < p.length - 1; x++) L += edgeOf(p[x], p[x + 1]).len; if (t && p[seg + 1]) L -= t * edgeOf(p[seg], p[seg + 1]).len; return Math.max(0, L); }
  function usesStreet(p, seg, sid) { if (!p) return false; for (var x = seg; x < p.length - 1; x++) if (edgeOf(p[x], p[x + 1]).id === sid) return true; return false; }
  function nextLight(p, seg) { if (!p) return "sky"; for (var x = seg + 1; x < p.length; x++) if (NODES[p[x]].light) return NODES[p[x]].light; return "sky"; }

  // ── the kernel side ──
  var K = { me: null, N: Math.max(4, Math.min(240, +params.get("n") || 24)), writes: 0, lastMs: 0, subs: [], status: "loading", ver: 0, t0: performance.now(), recomputes: 0, trace: null, traces: [], seq: 0, agg: params.get("agg") !== "0" };
  function emit() { K.ver++; K.subs.forEach(function (f) { f(K.ver); }); }
  function nodeAt(path) { var p = K.me; path.split(".").forEach(function (s) { p = p[s]; }); return p; }
  var wms = { n: 0, sum: 0 };
  function write(path, v) { var t = performance.now(); nodeAt(path)(v); K.writes++; K.lastMs = performance.now() - t; wms.n++; wms.sum += K.lastMs; }
  function point(path, target) { var t = performance.now(); nodeAt(path)["->"](target); K.writes++; K.lastMs = performance.now() - t; wms.n++; wms.sum += K.lastMs; }
  function read(path) { return K.me ? K.me(path) : undefined; }
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var aggOn = function () { return K.agg && K.N <= 60; };
  function probeFor(path) { var m = /^couriers\.(\d+)\.(\w+)$/.exec(path); if (m) return "couriers." + m[1] + "." + (m[2] === "battery" || m[2] === "busy" ? "canTake" : "eta");
    m = /^lights\.(\w+)\.red$/.exec(path); if (m) return "lights." + m[1] + ".wait"; if (path === "city.reserve") return "couriers.1.canTake"; return null; }
  function trace(path, v, pr, label) { var ex = K.me.explain(pr), m = ex && ex.meta; if (!m || m.sourcePath !== path || !m.recomputed) return null;
    var tr = { id: ++K.seq, path: path, value: v, recomputed: m.recomputed.slice(), changed: (m.changed || []).slice(), label: label || null, t: performance.now() };
    K.recomputes += tr.recomputed.length; if (label !== false) { K.trace = tr; K.traces.unshift(tr); if (K.traces.length > 8) K.traces.pop(); } fx.trace(tr, label === false); return tr; }
  function traced(path, v, label) { write(path, v); var pr = probeFor(path); return pr && K.me ? trace(path, v, pr, label) : null; }
  var lite = function () { return K.N > 60; };
  function simWrite(path, v) { if (lite()) write(path, v); else traced(path, v, false); }
  function seed(ME) {
    var me = new ME(), N = K.N, t = performance.now(); K.me = null;
    me.city.name("City Delivery"); me.city.reserve(30); me.city.delivered(0); me.city.cycle(CYCLE);
    Object.keys(EDGES).forEach(function (s) { me.streets[s].closed(0); EDGES[s].closed = false; });
    me.lights["[i]"]["="]("wait", "red * city.cycle");
    LIGHTS.forEach(function (l) { l.red = lightRed(l, performance.now()) ? 1 : 0; me.lights[l.id].red(l.red); }); me.lights.sky.red(0);
    me.couriers["[i]"]["="]("eta", "dist / speed + next.wait");
    me.couriers["[i]"]["="]("canTake", "battery > city.reserve && !busy");
    me.couriers["[i]"]["="]("low", "battery < 25");
    me.orders["[i]"]["="]("eta", "courier.eta");
    me.orders["[i]"]["="]("late", "courier.eta > promise");
    bots = []; orders = []; nextOrder = 1;
    for (var n = 1; n <= N; n++) { var air = n % 3 === 0, c = me.couriers[n], sp = air ? r1(11 + (n % 4)) : r1(1.4 + (n % 5) * .15), at = air ? null : "n" + (n % 3) + "_" + (4 - (n % 2)), b0 = 55 + (n * 29) % 45;
      c.kind(air ? "drone" : "robot"); c.battery(b0); c.speed(sp); c.dist(0); c.busy(0); c.delivering(false); c.flying(false); c.next["->"]("lights.sky");
      var x = air ? PAD.x + (n % 4) * 14 - 20 : NODES[at].x, y = air ? PAD.y + (Math.floor(n / 4) % 4) * 14 - 20 : NODES[at].y;
      bots.push({ id: n, air: air, at: at, path: null, seg: 0, t: 0, x: x, y: y, hx: x, hy: y, ang: 0, sp: sp, phase: "idle", order: 0, wait: (n % 7) * .2, pulse: 0, light: "sky", alt: 0, distT: 0 }); }
    if (aggOn()) { me.city["="]("delivering", "couriers[].delivering"); me.city["="]("available", "couriers[].canTake");
      me.city["="]("avgBattery", "couriers[].battery / couriers[]"); me.city["="]("inAir", "couriers[].flying"); }
    K.me = me; K.seedMs = performance.now() - t; K.writes = 0; K.recomputes = 0; K.traces = []; K.trace = null; K.t0 = performance.now(); wms.n = 0; wms.sum = 0;
    for (var o = 0; o < Math.min(6, Math.ceil(N / 3)); o++) addOrder();
  }
  var ME_CLASS = null;
  MK.load().then(function (ME) { ME_CLASS = ME; seed(ME); K.status = "ok"; emit(); audiences.seal(); }, function (e) { K.status = "error"; K.error = String(e && e.message || e); emit(); });
  function rescale(n, agg) { if (!ME_CLASS) return; K.N = n; if (agg != null) K.agg = agg; select(null); seed(ME_CLASS); emit(); audiences.seal(); }
  window.CityDeliveryKernel = { explain: function (p) { return K.me ? K.me.explain(p) : null; }, read: read };

  // lights cycle on their own; each change is a write to lights[l].red
  function lightRed(l, now) { var u = ((now / 9000) + l.phase / 7) % 1; return u < .45; }
  function closedMap() { var o = {}; Object.keys(EDGES).forEach(function (s) { if (EDGES[s].closed) o[s] = 1; }); return o; }

  // ── orders and couriers (the page moves them; every hop, light, pickup and drop is a kernel write) ──
  var bots = [], orders = [], nextOrder = 1;
  var CP = function (b) { return "couriers." + b.id; }, OP = function (j) { return "orders." + j; };
  function addOrder(sv) { var j = nextOrder++, home = HOMES[(j * 7 + (sv || 0)) % HOMES.length], O = K.me.orders[j];
    O.customer(home.customer); O.home(home.id); O.promise(home.customer <= 2 ? 240 : 300); O.status("queued");
    orders.push({ id: j, home: home, customer: home.customer, status: "queued", t: performance.now() }); K.writes += 4;
    if (orders.length > 300) orders = orders.filter(function (x) { return x.status !== "done"; }).concat(orders.filter(function (x) { return x.status === "done"; }).slice(-30));
    return j; }
  function updLight(b) { var nl = b.air ? "sky" : nextLight(b.path, b.seg); if (nl !== b.light) { b.light = nl; point(CP(b) + ".next", "lights." + nl); } }
  function setPath(b, p) { b.path = p && p.length > 1 ? p : null; b.seg = 0; b.t = 0; simWrite(CP(b) + ".dist", r1(b.path ? pathLen(b.path, 0, 0) : 0)); updLight(b); }
  function goGround(b, to) { var p = route(b.at, to, closedMap()); if (!p) { b.wait = .8; return false; } b.goal = to; setPath(b, p); if (!b.path) arrive(b); return true; }
  function goAir(b, x, y) { b.tx = x; b.ty = y; b.fly = true; write(CP(b) + ".flying", true); simWrite(CP(b) + ".dist", r1(Math.hypot(x - b.x, y - b.y) / PXM)); }
  function orderOf(b) { return b.order ? orders.filter(function (x) { return x.id === b.order; })[0] : null; }
  function dispatch() {
    var q = orders.filter(function (o) { return o.status === "queued"; }); if (!q.length) return;
    var free = bots.filter(function (b) { return b.phase === "idle" && !b.path && !b.fly && read(CP(b) + ".canTake") === true; });
    q.slice(0, lite() ? 30 : 5).forEach(function (o) { if (!free.length) return; var bi = 0, bd = 1e9;
      free.forEach(function (b, x) { var d = Math.hypot(b.x - o.home.x, b.y - o.home.y) / (b.air ? 6 : 1); if (d < bd) { bd = d; bi = x; } });
      var b = free.splice(bi, 1)[0]; b.order = o.id; o.courier = b.id; o.status = "on the way"; b.phase = "toHome";
      write(CP(b) + ".busy", 1); write(CP(b) + ".delivering", true); write(OP(o.id) + ".status", "on the way"); point(OP(o.id) + ".courier", CP(b));
      if (b.air) goAir(b, o.home.x, o.home.y); else goGround(b, o.home.node); if (!lite()) fx.link(b, o); });
  }
  function arrive(b) {
    var o = orderOf(b);
    if (b.phase === "toHome" && o) { o.status = "done"; o.done = performance.now(); write(OP(o.id) + ".status", "delivered"); write("city.delivered", (read("city.delivered") || 0) + 1); fx.drop(o.home);
      write(CP(b) + ".delivering", false); b.order = 0; b.phase = "back";
      if (b.air) goAir(b, b.hx, b.hy); else if (read(CP(b) + ".low") === true) goGround(b, HUB); else { b.phase = "idle"; write(CP(b) + ".busy", 0); b.wait = .4; } return; }
    if (b.phase === "back") { b.phase = read(CP(b) + ".low") === true ? "charging" : "idle"; write(CP(b) + ".busy", 0); if (b.air) { b.fly = false; write(CP(b) + ".flying", false); } b.wait = .4; return; }
    b.phase = "idle";
  }
  var DRAIN_G = .05;
  function idle(b, dt) { if (b.phase === "charging" && (b.wait -= dt) <= 0) { b.wait = .5; var c = read(CP(b) + ".battery"); if (c >= 95) b.phase = "idle"; else simWrite(CP(b) + ".battery", r1(Math.min(100, c + 7))); } }
  function step(dt, now) {
    if (!K.me) return; var w0 = K.writes;
    LIGHTS.forEach(function (l) { var r = lightRed(l, now) ? 1 : 0; if (r !== l.red) { l.red = r; if (lite()) write("lights." + l.id + ".red", r); else { var tr = traced("lights." + l.id + ".red", r, false); if (tr) fx.light(l); } } });
    bots.forEach(function (b) {
      if (b.air) { if (b.fly) { var dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), v = b.sp * PXM * 2.2; b.alt = Math.min(1, b.alt + dt * 1.5);
          if (d < v * dt + 1) { b.x = b.tx; b.y = b.ty; write(CP(b) + ".dist", 0); var bat = read(CP(b) + ".battery"); write(CP(b) + ".battery", r1(Math.max(1, bat - 4))); arrive(b); }
          else { b.x += dx / d * v * dt; b.y += dy / d * v * dt; b.ang = Math.atan2(dy, dx); if ((b.distT += dt) > .6) { b.distT = 0; simWrite(CP(b) + ".dist", r1(d / PXM)); } } }
        else { b.alt = Math.max(0, b.alt - dt * 1.2); idle(b, dt); } return; }
      if (b.path) { var A = NODES[b.path[b.seg]], B = NODES[b.path[b.seg + 1]], e = edgeOf(A.id, B.id), len = Math.hypot(B.x - A.x, B.y - A.y) || 1, Ln = B.light && LIGHT_BY[B.light];
        if (Ln && Ln.red && b.t > .8 && b.t < .9) b.waiting = true; else { b.waiting = false; b.t += dt * b.sp * PXM * 5 / len; }   // stop at a red light before the crossing
        if (b.t >= 1) { b.seg++; b.t = 0; b.at = b.path[b.seg]; var nb = r1(Math.max(1, read(CP(b) + ".battery") - e.len * DRAIN_G));
          if (b.seg >= b.path.length - 1) { b.path = null; write(CP(b) + ".dist", 0); simWrite(CP(b) + ".battery", nb); updLight(b); arrive(b); }
          else { simWrite(CP(b) + ".battery", nb); simWrite(CP(b) + ".dist", r1(pathLen(b.path, b.seg, 0))); updLight(b); } } }
      else idle(b, dt);
      var p = botXY(b), da = (p.ang != null ? p.ang : b.ang) - b.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; b.ang += da * Math.min(1, dt * 10); b.x = p.x; b.y = p.y;
    });
    if ((T.disp += dt) >= .35) { T.disp = 0; dispatch(); }
    var rate = Math.max(.5, K.N / 25); if (running.auto && (T.ord += dt) >= 1 / rate) { T.ord = 0; if (orders.filter(function (o) { return o.status === "queued"; }).length < Math.max(5, K.N / 2)) addOrder(Math.floor(now / 991)); }
    if (K.writes !== w0 && (T.emit += dt) > .12) { T.emit = 0; emit(); }
  }
  var T = { disp: 0, ord: 0, emit: 0 };
  function botXY(b) { if (!b.path) { var n = NODES[b.at], off = ((b.id % 5) - 2) * 4; return { x: n.x + off, y: n.y + off * .5 }; }
    var A = NODES[b.path[b.seg]], B = NODES[b.path[b.seg + 1]], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, side = 9;   // keep to the right-hand sidewalk
    return { x: A.x + dx * b.t - dy / L * side, y: A.y + dy * b.t + dx / L * side, ang: Math.atan2(dy, dx) }; }

  // user actions: each one is a kernel write; the panel and the map show what the kernel says recomputed
  var actions = {
    close: function (sid) { var e = EDGES[sid]; if (!e) return; var on = !e.closed; e.closed = on; write("streets." + sid + ".closed", on ? 1 : 0); var cm = closedMap();
      var all = { id: ++K.seq, path: "streets." + sid + ".closed", value: on ? 1 : 0, recomputed: [], changed: [], label: (on ? "close" : "open") + " street " + sid, t: performance.now(), reroutes: 0 };
      bots.forEach(function (b) { if (b.air || !b.path || (on && !usesStreet(b.path, b.seg, sid))) return; var from = b.path[b.seg + 1] || b.at, p = route(from, b.goal, cm); if (!p) return;
        var keep = b.path.slice(0, b.seg + 1); b.path = keep.concat(keep[keep.length - 1] === p[0] ? p.slice(1) : p); all.reroutes++; var dp = CP(b) + ".dist"; write(dp, r1(pathLen(b.path, b.seg, b.t))); updLight(b);
        var ex = K.me.explain(CP(b) + ".eta"), m = ex && ex.meta; if (m && m.recomputed) { all.recomputed = all.recomputed.concat(m.recomputed); all.changed = all.changed.concat(m.changed || []); } });
      var uq = function (a) { return a.filter(function (p, x) { return a.indexOf(p) === x; }); }; all.recomputed = uq(all.recomputed); all.changed = uq(all.changed);
      K.recomputes += all.recomputed.length; K.trace = all; K.traces.unshift(all); if (K.traces.length > 8) K.traces.pop(); fx.street(sid, all); select({ type: "street", s: sid }); emit(); return all; },
    light: function (lid) { var l = LIGHT_BY[lid || "L4"]; var want = l.red ? .7 : .2; l.phase = ((((want - performance.now() / 9000) % 1) + 1) % 1) * 7; l.red = lightRed(l, performance.now()) ? 1 : 0; var tr = traced("lights." + l.id + ".red", l.red, (l.red ? "red" : "green") + " at " + l.id); fx.light(l); select({ type: "light", l: l.id }); emit(); return tr; },
    order: function () { var j = addOrder(Math.floor(Math.random() * 13)); dispatch(); select({ type: "order", j: j }); emit(); return j; },
    reserve: function () { var v = read("city.reserve") === 30 ? 70 : 30; var tr = traced("city.reserve", v, "city.reserve → " + v); emit(); return tr; },
  };

  // ── effects: glow pulses on recomputed couriers, ripple lines source → dependents (all from meta.recomputed) ──
  var FX = [], fx = {
    at: function (x, y, kind) { FX.push({ x: x, y: y, kind: kind, t: performance.now() }); if (FX.length > 400) FX.splice(0, FX.length - 400); },
    line: function (x1, y1, x2, y2, kind, delay) { FX.push({ x: x1, y: y1, x2: x2, y2: y2, kind: kind || "ripple", t: performance.now() + (delay || 0) }); },
    where: function (p) { var m = /^couriers\.(\d+)\./.exec(p); if (m) { var b = bots[m[1] - 1]; return b ? { x: b.x, y: b.y, b: b } : null; }
      m = /^orders\.(\d+)\./.exec(p); if (m) { var o = orders.filter(function (x) { return x.id === +m[1]; })[0]; if (o) return { x: o.home.x, y: o.home.y, o: o }; }
      m = /^lights\.(L\d+)\./.exec(p); if (m) { var n = NODES[LIGHT_BY[m[1]].node]; return { x: n.x, y: n.y }; }
      if (/^city\./.test(p)) return { x: 70, y: 36 }; return null; },
    trace: function (tr, quiet) { var src = fx.where(tr.path) || { x: 70, y: 36 }, seen = {}, n = 0;
      if (quiet) { tr.recomputed.forEach(function (p) { var w = fx.where(p); if (w && w.b && p.indexOf(tr.path.split(".").slice(0, 2).join(".") + ".") !== 0) w.b.pulse = performance.now(); }); return; }   // the simulation's own writes: a soft pulse on other dependents only
      tr.recomputed.forEach(function (p) { var w = fx.where(p); if (!w || (/^city\./.test(p) && !/^city\./.test(tr.path))) return;   // city aggregates have no place on the map: ripples stay with the couriers var key = Math.round(w.x) + "," + Math.round(w.y) + p.split(".")[0]; if (w.b) w.b.pulse = performance.now() + n * 25;
        if (!seen[key] && (Math.abs(w.x - src.x) + Math.abs(w.y - src.y) > 4)) { seen[key] = 1; if (n < 200) fx.line(src.x, src.y, w.x, w.y, "ripple", n * 18); }
        if (w.o) fx.at(w.x, w.y, "order"); n++; });
      fx.at(src.x, src.y, "src"); },
    light: function (l) { var n = NODES[l.node]; fx.at(n.x, n.y, l.red ? "red" : "green"); },
    link: function (b, o) { fx.line(b.x, b.y, o.home.x, o.home.y, "assign"); },
    drop: function (home) { fx.at(home.x, home.y, "drop"); },
    street: function (sid, all) { var e = EDGES[sid], A = NODES[e.a], B = NODES[e.b], x = (A.x + B.x) / 2, y = (A.y + B.y) / 2; fx.at(x, y, "street");
      (all.recomputed || []).forEach(function (p, n) { var w = /^city\./.test(p) ? null : fx.where(p); if (w) { if (w.b) w.b.pulse = performance.now() + n * 30; fx.line(x, y, w.x, w.y, "ripple", n * 30); } }); },
  };

  // ── audiences: each customer's orders → that customer OR ops; the fleet → ops; OR = one ME.wrapSecretV1 per member ──
  var AUD = [{ k: "c1", label: "customer 1's orders", members: ["customer 1", "ops"] }, { k: "c2", label: "customer 2's orders", members: ["customer 2", "ops"] }, { k: "fleet", label: "fleet: positions, batteries, routes", members: ["ops"] }];
  var PARTIES = ["customer 1", "customer 2", "ops", "outsider"];
  var audiences = { keys: null, wraps: null, view: params.get("as") || "ops", results: {}, busy: false, sealedAt: 0, ms: 0, subs: [],
    payload: function (k) {
      if (k === "c1" || k === "c2") { var c = +k.slice(1); return orders.filter(function (o) { return o.customer === c; }).slice(-6).map(function (o) { var e = read(OP(o.id) + ".eta"); return { order: o.id, status: read(OP(o.id) + ".status"), eta: e == null ? null : r1(e), courier: o.courier || null }; }); }
      return bots.slice(0, 20).map(function (b) { return { courier: b.id, kind: b.air ? "drone" : "robot", battery: read(CP(b) + ".battery"), at: b.air ? [Math.round(b.x), Math.round(b.y)] : b.at }; }); },
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
    seesOrder: function (o) { var A = audiences; if (!A.wraps || A.can("fleet")) return true; return (o.customer === 1 && A.can("c1")) || (o.customer === 2 && A.can("c2")); },
    emit: function () { audiences.subs.forEach(function (f) { f(Date.now()); }); emit(); } };

  // ── page CSS (theme tokens only) ──
  var DIV = "var(--mui-palette-divider,rgba(128,128,128,.3))", TX2 = "var(--mui-palette-text-secondary,#8b949e)", PRI = "var(--mui-palette-primary-main,#58a6ff)", PAPER = "var(--mui-palette-background-paper,transparent)";
  var CSS = [
    ".cd-dash{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}",
    "@media (min-width:980px){.cd-dash{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}.cd-side{grid-column:1;grid-row:1}.cd-right{grid-column:2;grid-row:1;position:sticky;top:60px;max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}}",
    "@media (max-width:979px){.cd-right{order:-1}}",
    ".cd-fig{position:relative;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:var(--mui-palette-background-default,transparent)}.cd-fig canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation}",
    ".cd-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 0}.cd-btn{font:inherit;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.4));background:transparent;color:inherit;cursor:pointer}.cd-btn:hover{border-color:" + PRI + "}.cd-btn.on{color:" + PRI + ";border-color:currentColor}.cd-btn:disabled{opacity:.5;cursor:default}.cd-sep{flex:1}",
    ".cd-seg{display:inline-flex;border:1px solid " + DIV + ";border-radius:8px;overflow:hidden}.cd-seg .cd-btn{border:0;border-radius:0}.cd-seg .cd-btn+.cd-btn{border-left:1px solid " + DIV + "}",
    ".cd-panel{margin-top:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media (min-width:1240px){.cd-panel{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}",
    ".cd-card{border:1px solid " + DIV + ";border-radius:12px;background:" + PAPER + ";font-size:13px;padding:10px 12px;min-width:0}.cd-h{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:" + TX2 + "}",
    ".cd-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.cd-kpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;padding:6px 8px;border:1px solid " + DIV + ";border-radius:9px;cursor:pointer;min-width:0}.cd-kpi:hover,.cd-kpi:focus-visible,.cd-kpi[aria-pressed=true]{border-color:" + PRI + "}.cd-kpi b{font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}.cd-kpi small{font-size:11px;color:" + TX2 + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".cd-row{display:flex;justify-content:space-between;gap:10px;line-height:1.6;min-width:0}.cd-row>span:first-child{color:" + TX2 + ";min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cd-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}",
    ".cd-note{margin-top:6px;font-size:12px;line-height:1.5;color:" + TX2 + "}.cd-note a,.cd-side a,.cd-k a{color:" + PRI + ";text-decoration:none}.cd-note a:hover,.cd-side a:hover,.cd-k a:hover{text-decoration:underline}",
    ".cd-json{margin:6px 0 0;padding:8px;max-height:280px;overflow:auto;border-radius:8px;border:1px solid " + DIV + ";font:11px/1.5 " + MONO + ";white-space:pre;color:var(--mui-palette-text-primary,inherit)}",
    ".cd-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 0}.cd-tab{font:11.5px " + MONO + ";padding:3px 8px;border-radius:999px;border:1px solid " + DIV + ";background:transparent;color:" + TX2 + ";cursor:pointer}.cd-tab.on{color:var(--mui-palette-text-primary,inherit);border-color:" + PRI + "}",
    ".cd-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:84px;overflow:auto}.cd-chip{font:10.5px " + MONO + ";padding:1px 6px;border-radius:6px;border:1px solid " + DIV + ";color:" + TX2 + "}.cd-chip.ch{color:" + PRI + ";border-color:color-mix(in srgb," + PRI + " 50%,transparent)}",
    ".cd-aud{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:baseline;font-size:12px;margin-top:6px}.cd-aud .ok{color:var(--mui-palette-success-main,#2e9d6e)}.cd-aud .no{color:var(--mui-palette-error-main,#e5534b)}.cd-aud code{font:11px " + MONO + ";overflow-wrap:anywhere}",
    ".cd-k summary{cursor:pointer;list-style:none;font:11.5px/1.5 " + MONO + ";color:" + TX2 + "}.cd-k summary::-webkit-details-marker{display:none}.cd-k .ok{color:var(--mui-palette-success-main,#2e9d6e)}.cd-k .bad{color:var(--mui-palette-error-main,#e5534b)}.cd-k div{font:11px/1.6 " + MONO + ";color:" + TX2 + ";overflow-wrap:anywhere}",
    ".cd-side{font-size:14px;line-height:1.6}.cd-side h2{margin:0 0 8px;font-size:1.2rem;font-weight:800}.cd-step{border:1px solid " + DIV + ";border-radius:12px;padding:10px 12px 2px;margin:0 0 12px;background:" + PAPER + ";scroll-margin-top:64px;transition:border-color .2s}.cd-step.on{border-color:" + PRI + "}",
    ".cd-step h3{margin:0 0 4px;font-size:14px;font-weight:800;display:flex;gap:8px;align-items:baseline}.cd-step h3 b{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:50%;font-size:11px;border:1px solid " + PRI + ";color:" + PRI + "}.cd-step p{margin:0 0 8px;font-size:13px}.cd-step .cd-bar{margin:0 0 10px}",
    ".cd-me{font-family:" + MONO + ";font-size:12px}.cd-cap{margin:6px 2px 0;font-size:12px;line-height:1.5;color:" + TX2 + "}",
    ".cd-rel{margin:32px 0 8px}.cd-rel h2{margin:0 0 10px;font-size:1.35rem;font-weight:800}.cd-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media (max-width:900px){.cd-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.cd-cards{grid-template-columns:1fr}}",
    ".cd-card2{display:flex;flex-direction:column;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:" + PAPER + ";color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}.cd-card2:hover{transform:translateY(-2px);border-color:" + PRI + "}.cd-card2 .img{display:block;aspect-ratio:1200/630;background:var(--mui-palette-action-hover,rgba(128,128,128,.12));overflow:hidden}.cd-card2 img{width:100%;height:100%;object-fit:cover;display:block}.cd-card2 .tx{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.cd-card2 b{font-size:14px;font-weight:800}.cd-card2 small{font-size:12px;line-height:1.4;color:" + TX2 + "}",
  ].join("\n");
  (function () { var s = document.createElement("style"); s.id = "cd-css"; s.textContent = CSS; document.head.appendChild(s); })();
  var SYN = window.MeSyntax;
  if (SYN && SYN.watchTheme) SYN.watchTheme();   // --me-syn-* from the active .GUI theme; follows theme / mode changes
  var me = function (t) { return h("code", { className: "me-code cd-me" }, SYN ? SYN.render(h, t) : t); };
  var synJ = function (t) { return SYN ? SYN.render(h, t) : t; };
  var link = function (href, text) { return h("a", { href: href, target: href.indexOf("http") === 0 ? "_blank" : undefined, rel: "noopener" }, text); };
  var fmtJ = function (o) { try { return JSON.stringify(o, null, 2); } catch (e) { return String(o); } };
  function useKernel() { var s = useState(K.ver), set = s[1]; useEffect(function () { var f = function (v) { set(v); }; K.subs.push(f); return function () { K.subs = K.subs.filter(function (g) { return g !== f; }); }; }, []); return K; }
  var sel = { v: null, subs: [] }; function select(x) { sel.v = x; sel.subs.forEach(function (f) { f(x); }); }
  function useSel() { var s = useState(sel.v), set = s[1]; useEffect(function () { sel.subs.push(set); return function () { sel.subs = sel.subs.filter(function (g) { return g !== set; }); }; }, []); return s[0]; }
  var running = { on: params.get("paused") !== "1", auto: true };

  // ── the figure: the city ──
  var cache = {};
  function look(b, force) { var c = cache[b.id]; if (c && !force && performance.now() - c.t < 400) return c; var p = CP(b);
    c = { t: performance.now(), bat: read(p + ".battery"), can: read(p + ".canTake"), low: read(p + ".low"), busy: read(p + ".busy"), del: read(p + ".delivering") }; cache[b.id] = c; return c; }
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
          box: dark ? "#e3a35b" : "#b7793a", busy: dark ? "#58a6ff" : "#0969da", glow: dark ? "#7ee2ff" : "#0a84c6", air: dark ? "#d2a8ff" : "#8250df", park: dark ? "#14241a" : "#dcefe0", roof: dark ? "#1a2130" : "#e4e8ef", shade: dark ? "rgba(0,0,0,.35)" : "rgba(31,35,40,.10)" }; }
      function rr(x, y, w, h2, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
      var FS = 1;
      function txt(sz, t, x, y, col, al, wt) { ctx.font = (wt || 500) + " " + (sz * FS).toFixed(1) + "px " + MONO; ctx.fillStyle = col; ctx.textAlign = al || "center"; ctx.fillText(t, x, y); }
      var BLD = []; (function () { var R = 7; function rnd() { R = (R * 1664525 + 1013904223) >>> 0; return R / 4294967296; }
        for (var a = 0; a < NI - 1; a++) for (var b = 0; b < NJ - 1; b++) { var x0 = CX(a) + 22, y0 = CY(b) + 22, w = 163 - 44, hh = 140 - 44;
          if ((a * 7 + b * 3) % 9 === 4) { BLD.push({ park: true, x: x0, y: y0, w: w, h: hh }); continue; }
          var cols = 2 + Math.floor(rnd() * 2); for (var u = 0; u < cols; u++) for (var v = 0; v < 2; v++) { var bw = w / cols - 6, bh = hh / 2 - 6; BLD.push({ x: x0 + u * (w / cols) + 3, y: y0 + v * (hh / 2) + 3, w: bw * (.78 + rnd() * .22), h: bh * (.78 + rnd() * .22), hgt: 2 + rnd() * 8, win: rnd() }); } } })();
      function draw() {
        var now = performance.now(); if (!pal || now - palT > 500) { pal = palette(); palT = now; } var P = pal, ok = !!K.me, on = sel.v, seeF = audiences.can("fleet");
        FS = Math.max(1, Math.min(2.2, 760 / (c.clientWidth || W)));
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        // streets first (asphalt), then blocks on top
        Object.keys(EDGES).forEach(function (sid) { var e = EDGES[sid], A = NODES[e.a], B = NODES[e.b];
          ctx.strokeStyle = e.closed ? rgba(P.bad, .22) : rgba(P.ink, P.dark ? .06 : .08); ctx.lineWidth = 30; ctx.lineCap = "square"; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }); ctx.lineCap = "butt";
        Object.keys(EDGES).forEach(function (sid) { var e = EDGES[sid], A = NODES[e.a], B = NODES[e.b];
          ctx.strokeStyle = e.closed ? rgba(P.bad, .7) : rgba(P.ink, .16); ctx.lineWidth = 1; ctx.setLineDash(e.closed ? [] : [8, 10]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); });
        BLD.forEach(function (b) { if (b.park) { ctx.fillStyle = P.park; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); for (var t = 0; t < 7; t++) { ctx.fillStyle = rgba(P.ok, .22 + (t % 3) * .06); ctx.beginPath(); ctx.arc(b.x + 14 + (t * 37) % (b.w - 24), b.y + 16 + (t * 23) % (b.h - 28), 6 + (t % 3) * 2, 0, 7); ctx.fill(); } return; }
          ctx.fillStyle = P.shade; rr(b.x + b.hgt * .7, b.y + b.hgt, b.w, b.h, 3); ctx.fill();
          ctx.fillStyle = P.roof; rr(b.x, b.y, b.w, b.h, 3); ctx.fill(); ctx.strokeStyle = rgba(P.ink, .12); ctx.lineWidth = 1; ctx.stroke();
          if (b.win > .5) { ctx.fillStyle = rgba(P.ink, .07); ctx.fillRect(b.x + b.w * .25, b.y + b.h * .3, b.w * .5, b.h * .4); } });
        // crossings: zebra stripes at lit crossings
        LIGHTS.forEach(function (l) { var n = NODES[l.node]; ctx.fillStyle = rgba(P.ink, .1); for (var z = -2; z <= 2; z++) { ctx.fillRect(n.x + z * 5 - 1.5, n.y - 24, 3, 8); ctx.fillRect(n.x + z * 5 - 1.5, n.y + 16, 3, 8); ctx.fillRect(n.x - 24, n.y + z * 5 - 1.5, 8, 3); ctx.fillRect(n.x + 16, n.y + z * 5 - 1.5, 8, 3); } });
        // closed streets: barriers
        Object.keys(EDGES).forEach(function (sid) { var e = EDGES[sid], A = NODES[e.a], B = NODES[e.b], isSel = on && on.type === "street" && on.s === sid;
          if (e.closed) { var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, vert = A.x === B.x; ctx.save(); ctx.translate(mx, my); if (vert) ctx.rotate(Math.PI / 2);
            for (var s = -1; s <= 1; s += 2) { ctx.fillStyle = P.bad; rr(s * 24 - 4, -14, 8, 28, 2); ctx.fill(); ctx.fillStyle = rgba(P.bg, .9); ctx.fillRect(s * 24 - 4, -5, 8, 3); ctx.fillRect(s * 24 - 4, 3, 8, 3); }
            ctx.restore(); txt(9, "CLOSED", mx, my + (vert ? 3 : -18), P.bad, "center", 700); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); txt(9.5, sid, (A.x + B.x) / 2, (A.y + B.y) / 2 + (A.x === B.x ? 0 : 20), P.acc, "center", 700); } });
        // hub and drone pad
        var hub = NODES[HUB]; ctx.fillStyle = rgba(P.busy, .12); rr(hub.x - 42, hub.y - 28, 84, 56, 10); ctx.fill(); ctx.strokeStyle = rgba(P.busy, .5); ctx.lineWidth = 1; ctx.stroke(); txt(9, "ROBOT HUB", hub.x, hub.y + 44, P.busy, "center", 700);
        ctx.strokeStyle = rgba(P.air, .55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(PAD.x, PAD.y, 46, 0, 7); ctx.stroke(); txt(18, "H", PAD.x, PAD.y + 7, rgba(P.air, .4), "center", 800); txt(9, "DRONE PAD", PAD.x, PAD.y + 62, P.air, "center", 700);
        // traffic lights
        LIGHTS.forEach(function (l) { var n = NODES[l.node], red = ok ? read("lights." + l.id + ".red") : l.red, col = red ? P.bad : P.ok, isSel = on && on.type === "light" && on.l === l.id;
          ctx.fillStyle = rgba(P.ink, .55); rr(n.x + 17, n.y - 27, 10, 18, 3); ctx.fill();
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(n.x + 22, red ? n.y - 22 : n.y - 14, 3.4, 0, 7); ctx.fill(); ctx.restore();
          ctx.fillStyle = rgba(col, .12); ctx.beginPath(); ctx.arc(n.x, n.y, 13, 0, 7); ctx.fill();
          if (isSel || K.N <= 24) txt(isSel ? 9.5 : 8, l.id, n.x + 22, n.y - 32, isSel ? P.acc : P.faint, "center", isSel ? 700 : 500);
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, 7); ctx.stroke(); } });
        // homes with an open order (audience: that customer, or ops)
        if (ok) orders.forEach(function (o) { if (o.status === "done" && now - o.done > 1500) return; if (!audiences.seesOrder(o)) return; var hm = o.home, isSel = on && on.type === "order" && on.j === o.id, col = o.status === "queued" ? P.warn : o.status === "done" ? P.ok : P.box, bob = Math.sin(now / 380 + o.id) * 1.5;
          ctx.fillStyle = rgba(col, .18); ctx.beginPath(); ctx.arc(hm.x, hm.y, 12 + (o.status === "queued" ? 2 * Math.sin(now / 300) : 0), 0, 7); ctx.fill();
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hm.x - 7, hm.y - 1 + bob); ctx.lineTo(hm.x, hm.y - 8 + bob); ctx.lineTo(hm.x + 7, hm.y - 1 + bob); ctx.lineTo(hm.x + 7, hm.y + 6 + bob); ctx.lineTo(hm.x - 7, hm.y + 6 + bob); ctx.closePath(); ctx.fill();
          ctx.fillStyle = rgba(P.bg, .85); ctx.fillRect(hm.x - 2, hm.y + 1.5 + bob, 4, 4.5);
          if (isSel || o.customer <= 2) txt(8.5, "C" + o.customer, hm.x, hm.y + 19, isSel ? P.acc : P.muted, "center", 600);
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hm.x, hm.y, 17, 0, 7); ctx.stroke(); txt(9.5, "ORDER " + o.id, hm.x, hm.y - 21, P.acc); } });
        // routes
        if (ok) bots.forEach(function (b) { var o = orderOf(b); if (!seeF && !(o && audiences.seesOrder(o))) return; var isSel = on && on.type === "courier" && on.i === b.id; if (lite() && !isSel) return;
          if (b.air && b.fly) { ctx.strokeStyle = rgba(P.air, isSel ? .9 : .35); ctx.lineWidth = isSel ? 2 : 1.2; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.tx, b.ty); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; return; }
          if (!b.path) return; ctx.strokeStyle = rgba(isSel ? P.acc : b.phase === "toHome" ? P.box : P.busy, isSel ? .9 : .32); ctx.lineWidth = isSel ? 2.4 : 1.4; ctx.setLineDash(isSel ? [6, 5] : [3, 5]); ctx.lineDashOffset = -now / 50;
          ctx.beginPath(); ctx.moveTo(b.x, b.y); for (var q = b.seg + 1; q < b.path.length; q++) ctx.lineTo(NODES[b.path[q]].x, NODES[b.path[q]].y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; });
        // effects
        FX = FX.filter(function (f) { return now - f.t < 1400; });
        FX.forEach(function (f) { var age = (now - f.t) / 1000; if (age < 0) return; var o = Math.max(0, 1 - age / 1.4);
          if (f.x2 != null) { var u = Math.min(1, age / .55), x = f.x + (f.x2 - f.x) * u, y = f.y + (f.y2 - f.y) * u, col = f.kind === "assign" ? P.box : P.glow;
            ctx.save(); ctx.globalAlpha = o * .55; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = o; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); ctx.restore(); return; }
          var col2 = f.kind === "drop" ? P.box : f.kind === "street" || f.kind === "red" ? P.bad : f.kind === "green" ? P.ok : P.glow, r = f.kind === "src" ? 6 + age * 70 : f.kind === "street" ? 20 + age * 160 : f.kind === "drop" ? 8 + age * 50 : 8 + age * 34;
          ctx.globalAlpha = o * .8; ctx.strokeStyle = col2; ctx.lineWidth = f.kind === "src" || f.kind === "street" ? 2 : 1.3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
        // couriers
        var big = !lite(), RS = big ? Math.min(1.25, FS * .8 + .2) : 1;
        if (lite()) { for (var s2 = 0; s2 < 60; s2++) { var bb = bots[(slice + s2) % bots.length]; if (bb) look(bb, true); } slice = (slice + 60) % Math.max(1, bots.length); }
        bots.forEach(function (b) { if (!ok) return; var o = orderOf(b); if (!seeF && !(o && audiences.seesOrder(o))) return;
          var L = big ? look(b, true) : cache[b.id] || look(b, true), isSel = on && on.type === "courier" && on.i === b.id, pz = b.pulse ? (now - b.pulse) / 900 : 9;
          var led = L.low ? P.bad : L.del ? P.box : L.busy ? P.busy : L.can ? P.ok : P.warn;
          if (!big) { ctx.fillStyle = rgba(b.air ? P.air : led, .9); ctx.beginPath(); ctx.arc(b.x, b.y, b.air ? 3.4 : 2.8, 0, 7); ctx.fill();
            if (pz >= 0 && pz < 1) { ctx.globalAlpha = 1 - pz; ctx.strokeStyle = P.glow; ctx.beginPath(); ctx.arc(b.x, b.y, 4 + pz * 10, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
            if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, 7); ctx.stroke(); } return; }
          if (b.air) { var al = b.alt || 0;
            ctx.fillStyle = rgba("#000000", P.dark ? .35 : .14); ctx.beginPath(); ctx.ellipse(b.x + 12 * al, b.y + 16 * al, 10 * RS, 6 * RS, 0, 0, 7); ctx.fill();
            ctx.save(); ctx.translate(b.x, b.y); ctx.scale(RS * (1 + al * .18), RS * (1 + al * .18));
            if (pz >= 0 && pz < 1) { ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 18 * (1 - pz); ctx.strokeStyle = rgba(P.glow, 1 - pz); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 14 + pz * 14, 0, 7); ctx.stroke(); ctx.restore(); }
            ctx.rotate(b.ang); ctx.strokeStyle = rgba(P.ink, .7); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
            [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(function (q, qi) { ctx.strokeStyle = rgba(P.air, .28); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], 5.5, 0, 7); ctx.stroke();
              ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(now / 25 * (qi % 2 ? 1 : -1) * (b.fly ? 1 : .1)); ctx.strokeStyle = rgba(P.air, .85); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); ctx.restore(); });
            ctx.fillStyle = P.paper; ctx.strokeStyle = P.air; ctx.lineWidth = 1.2; rr(-5, -4, 10, 8, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = led; ctx.beginPath(); ctx.arc(3, 0, 1.6, 0, 7); ctx.fill();
            if (L.del) { ctx.strokeStyle = rgba(P.ink, .5); ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 7); ctx.stroke(); ctx.fillStyle = P.box; rr(-3.5, 7, 7, 6, 1.5); ctx.fill(); }
            ctx.restore(); if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(b.x, b.y, 20 * RS, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          } else {
            ctx.save(); ctx.translate(b.x, b.y);
            if (pz >= 0 && pz < 1) { ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 18 * (1 - pz); ctx.strokeStyle = rgba(P.glow, 1 - pz); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11 * RS + pz * 14, 0, 7); ctx.stroke(); ctx.restore(); }
            if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 17 * RS, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
            ctx.save(); ctx.rotate(b.ang); ctx.scale(RS, RS);
            ctx.fillStyle = rgba(P.ink, .35); [-5, 0, 5].forEach(function (wx) { ctx.beginPath(); ctx.arc(wx, -6.5, 1.9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(wx, 6.5, 1.9, 0, 7); ctx.fill(); });
            ctx.fillStyle = P.paper; ctx.strokeStyle = rgba(P.ink, .75); ctx.lineWidth = 1.2; rr(-8, -5.5, 16, 11, 4); ctx.fill(); ctx.stroke();
            if (L.del) { ctx.fillStyle = P.box; rr(-5.5, -3.5, 8, 7, 1.5); ctx.fill(); }
            ctx.save(); ctx.shadowColor = led; ctx.shadowBlur = 6; ctx.fillStyle = led; ctx.beginPath(); ctx.arc(6, 0, 1.8, 0, 7); ctx.fill(); ctx.restore();
            ctx.strokeStyle = rgba(led, .9); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-9, -12); ctx.stroke(); ctx.fillStyle = led; ctx.fillRect(-9, -12, 4, 2.5);
            ctx.restore();
            if (b.waiting) { ctx.globalAlpha = .55 + .45 * Math.sin(now / 150); txt(8, "WAIT", 0, -13 * RS, P.bad, "center", 700); ctx.globalAlpha = 1; }
            ctx.restore(); }
          if (seeF) { var bw = 18 * RS, f = Math.max(0, Math.min(1, (L.bat || 0) / 100)), bc = f < .25 ? P.bad : f < .5 ? P.warn : P.ok, by = b.y - (b.air ? 22 : 18) * RS;
            ctx.fillStyle = rgba(P.ink, .14); rr(b.x - bw / 2, by, bw, 3.5, 2); ctx.fill(); ctx.fillStyle = bc; rr(b.x - bw / 2, by, Math.max(2, bw * f), 3.5, 2); ctx.fill(); }
          if (isSel || K.N <= 24) txt(isSel ? 10 : 8, String(b.id), b.x, b.y + 21 * RS, isSel ? P.acc : P.faint, "center", isSel ? 700 : 500); });
        // HUD
        if (ok) { var ht = "city.reserve = " + read("city.reserve"), hot = K.trace && K.trace.path === "city.reserve" && now - K.trace.t < 900; ctx.font = "600 " + (11 * FS).toFixed(1) + "px " + MONO; var hw = ctx.measureText(ht).width + 24;
          ctx.fillStyle = rgba(P.acc, hot ? .2 : .07); rr(14, 12, hw, 14 + 14 * FS, 8); ctx.fill(); ctx.strokeStyle = rgba(P.acc, hot ? .9 : .35); ctx.stroke(); txt(11, ht, 14 + hw / 2, 19 + 10 * FS, P.acc, "center", 600);
          var tr = K.trace; if (tr && now - tr.t < 6000) { ctx.globalAlpha = Math.min(1, (6000 - (now - tr.t)) / 800); txt(11, (tr.label || tr.path + " = " + tr.value) + " → " + tr.recomputed.length + " recomputed", W - 16, 31, P.glow, "right", 600); ctx.globalAlpha = 1; }
          var nr = bots.filter(function (b) { return !b.air; }).length; txt(10, nr + " ROBOTS · " + (K.N - nr) + " DRONES · " + KL.toUpperCase() + (seeF ? "" : " · VIEW AS " + audiences.view.toUpperCase()), W / 2, H - 8, P.muted); }
      }
      function frame(t) { var dt = Math.min(.05, (t - last) / 1000); last = t; if (running.on) step(dt, t); draw(); frames++; if (t - fpsT > 1000) { K.fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; } raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      function hit(e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, best = null, bd = lite() ? 10 : 20;
        bots.forEach(function (b) { var d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = { type: "courier", i: b.id }; } });
        if (!best) orders.forEach(function (o) { if (o.status === "done") return; if (Math.hypot(o.home.x - x, o.home.y - y) < 14) best = { type: "order", j: o.id }; });
        if (!best) LIGHTS.forEach(function (l) { var n = NODES[l.node]; if (Math.hypot(n.x - x, n.y - y) < 20 || Math.hypot(n.x + 22 - x, n.y - 18 - y) < 12) best = { type: "light", l: l.id }; });
        if (!best) { var bs = null, bdd = 15; Object.keys(EDGES).forEach(function (sid) { var e2 = EDGES[sid], A = NODES[e2.a], B = NODES[e2.b], vx = B.x - A.x, vy = B.y - A.y, u = Math.max(0, Math.min(1, ((x - A.x) * vx + (y - A.y) * vy) / (vx * vx + vy * vy))), d = Math.hypot(A.x + vx * u - x, A.y + vy * u - y); if (d < bdd) { bdd = d; bs = sid; } }); if (bs) best = { type: "street", s: bs }; }
        if (!best && x < 220 && y < 50) best = { type: "city", p: "city.reserve" };
        select(best); if (best && window.innerWidth < 980) setTimeout(function () { var p = document.querySelector("[data-cd=explain-card]"); if (p) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60); }
      c.addEventListener("click", hit); return function () { cancelAnimationFrame(raf); c.removeEventListener("click", hit); };
    }, []);
    return h("div", { className: "cd-fig" }, h("canvas", { ref: cv, width: W, height: H, role: "img", "data-cd": "floor", "aria-label": "A city grid: sidewalk robots and drones deliver parcels to homes; traffic lights at the crossings, a robot hub and a drone pad" }));
  }

  // ── controls under the map ──
  function Toolbar() {
    var k = useKernel(), cur = useSel(), rs = useState(running.on), run = rs[0], setRun = rs[1], ok = k.status === "ok";
    var sid = cur && cur.type === "street" ? cur.s : "h2_2", lid = cur && cur.type === "light" ? cur.l : "L4", closed = EDGES[sid] && EDGES[sid].closed;
    var B = function (id, label, fn, title, on) { return h("button", { type: "button", className: "cd-btn" + (on ? " on" : ""), "data-cd": id, disabled: !ok, title: title, onClick: fn }, label); };
    return h("div", { className: "cd-bar", "data-cd": "toolbar" },
      B("close", (closed ? "Open" : "Close") + " street " + sid, function () { actions.close(sid); }, "Writes streets." + sid + ".closed; robots routed through it re-plan and write dist and next", closed),
      B("light", "Flip light " + lid, function () { actions.light(lid); }, "Writes lights." + lid + ".red; couriers whose next light it is recompute eta"),
      B("order", "Add order", function () { actions.order(); }, "Writes orders[n]; the dispatcher points it at a courier that canTake"),
      B("reserve", "Reserve " + (ok && read("city.reserve") === 30 ? "30 → 70" : "70 → 30"), function () { actions.reserve(); }, "Writes city.reserve; every couriers[i].canTake reads it"),
      h("span", { className: "cd-sep" }),
      h("span", { className: "cd-seg", role: "group", "aria-label": "Fleet size" }, [24, 60, 240].map(function (n) { return h("button", { key: n, type: "button", className: "cd-btn" + (k.N === n ? " on" : ""), "data-cd": "scale-" + n, disabled: !ok, "aria-pressed": k.N === n ? "true" : "false", onClick: function () { rescale(n); } }, n); })),
      h("button", { type: "button", className: "cd-btn" + (aggOn() ? " on" : ""), "data-cd": "agg", disabled: !ok || k.N > 60, title: k.N > 60 ? "Aggregates are off above 60 couriers: each courier write re-scans the collection" : "Declare or drop the couriers[] aggregates (re-seeds the city)", onClick: function () { rescale(k.N, !K.agg); } }, "[] " + (aggOn() ? "on" : "off")),
      h("button", { type: "button", className: "cd-btn" + (run ? "" : " on"), "data-cd": "pause", onClick: function () { running.on = !running.on; setRun(running.on); } }, run ? "Pause" : "Resume"));
  }

  // ── the cards under the map: explain, last propagation, fleet, audiences, kernel ──
  var V = function (x) { return x === undefined ? "–" : x === null ? "null" : typeof x === "object" ? JSON.stringify(x) : String(x); };
  function Fleet() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ag = aggOn(), dl = 0, av = 0, air = 0, bs = 0;
    if (ok && !ag) bots.forEach(function (b) { var L = cache[b.id] || look(b); if (L.del === true) dl++; if (L.can === true) av++; if (b.fly) air++; bs += L.bat || 0; });
    var kpi = function (id, label, val, p) { var on = cur && cur.type === "city" && cur.p === p; return h("button", { type: "button", key: id, className: "cd-kpi", "data-cd": "kpi-" + id, "aria-pressed": on ? "true" : "false", disabled: !p, onClick: p ? function () { select({ type: "city", p: p }); } : undefined, title: p ? "me.explain(\"" + p + "\")" : "tallied by the page (aggregates off)" }, h("small", null, label), h("b", null, ok ? V(val) : "–")); };
    return h("section", { className: "cd-card", "data-cd": "fleet" }, h("div", { className: "cd-h" }, "Fleet · " + k.N + " couriers · " + KL),
      h("div", { className: "cd-kpis" },
        kpi("delivering", ag ? "city.delivering" : "delivering", ag ? read("city.delivering") : dl, ag ? "city.delivering" : null),
        kpi("available", ag ? "city.available" : "canTake = true", ag ? read("city.available") : av, ag ? "city.available" : null),
        kpi("air", ag ? "city.inAir" : "in the air", ag ? read("city.inAir") : air, ag ? "city.inAir" : null),
        kpi("avg", ag ? "city.avgBattery" : "avg battery", ag ? r1(read("city.avgBattery")) : r1(bs / Math.max(1, k.N)), ag ? "city.avgBattery" : null),
        kpi("delivered", "city.delivered", read("city.delivered"), "city.delivered"), kpi("recomputes", "recomputed (traced)", k.recomputes, null)),
      h("div", { className: "cd-row", style: { marginTop: 6 } }, h("span", null, "writes · writes/s · fps"), h("span", { className: "cd-num", "data-cd": "rate" }, ok ? k.writes + " · " + Math.round(k.writes / Math.max(1, (performance.now() - k.t0) / 1000)) + " · " + (k.fps || "–") : "–")),
      h("div", { className: "cd-row" }, h("span", null, "mean kernel write"), h("span", { className: "cd-num", "data-cd": "wms" }, wms.n ? (wms.sum / wms.n).toFixed(3) + " ms · " + wms.n + " writes" : "–")),
      h("div", { className: "cd-row" }, h("span", null, "seed " + k.N + " couriers + rules"), h("span", { className: "cd-num" }, ok && k.seedMs != null ? k.seedMs.toFixed(1) + " ms" : "–")),
      h("div", { className: "cd-note" }, ag ? ["Four of these are collection aggregates; ", me("couriers[].delivering"), " sums a boolean field (each true counts 1). Every courier write re-scans the ", String(k.N), " couriers for each of them, so they are declared up to 60. ", link(L_AGG, "Aggregates")]
        : ["Aggregates are off" + (k.N > 60 ? " at " + k.N + " couriers" : "") + ": each courier write would re-scan the whole collection for every aggregate, so the page tallies these from per-courier reads."]));
  }
  function Trace() {
    var k = useKernel(), tr = k.trace;
    return h("section", { className: "cd-card", "data-cd": "trace" }, h("div", { className: "cd-h" }, "Last propagation · meta.recomputed"),
      !tr ? h("div", { className: "cd-note" }, "Close a street, flip a light, add an order or change the reserve: the kernel recomputes only the dependents, listed here from ", me("me.explain(path).meta.recomputed"), ".")
        : h(React.Fragment, null,
          h("div", { className: "cd-row" }, h("span", null, tr.label || "write"), h("span", { className: "cd-num" }, me(tr.path + " = " + V(tr.value)))),
          h("div", { className: "cd-row" }, h("span", null, "recomputed · changed" + (tr.reroutes != null ? " · re-routed" : "")), h("span", { className: "cd-num", "data-cd": "recomputed-count" }, tr.recomputed.length + " · " + tr.changed.length + (tr.reroutes != null ? " · " + tr.reroutes : "") + " of " + k.N + " couriers")),
          h("div", { className: "cd-chips", "data-cd": "recomputed" }, tr.recomputed.slice(0, 80).map(function (p, x) { return h("span", { key: x, className: "cd-chip" + (tr.changed.indexOf(p) >= 0 ? " ch" : "") }, p); }).concat(tr.recomputed.length > 80 ? [h("span", { key: "m", className: "cd-chip" }, "+" + (tr.recomputed.length - 80))] : [])),
          h("div", { className: "cd-note" }, "Highlighted: the value changed. Glow and ripples on the map are drawn from this list. ", link(L_OK, "O(k)"))));
  }
  function Explain() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ts = useState(null), tab = ts[0], setTab = ts[1];
    useEffect(function () { setTab(cur && cur.tab || null); }, [cur && (cur.type + (cur.i || cur.j || cur.s || cur.l || cur.p))]);
    var d = null;
    if (ok && cur) {
      if (cur.type === "courier" && cur.i <= k.N) { var p = "couriers." + cur.i, b = bots[cur.i - 1], oj = b && b.order;
        d = { title: (b && b.air ? "Drone " : "Robot ") + cur.i + " · " + (b ? b.phase : ""), rows: ["kind", "battery", "speed", "dist", "busy", "delivering", "flying", "next"].map(function (f) { return [p + "." + f, read(p + "." + f)]; }),
          tabs: [p + ".eta", p + ".canTake", p + ".low"].concat(oj ? ["orders." + oj + ".eta", "orders." + oj + ".late"] : []) }; }
      else if (cur.type === "order") { var q = "orders." + cur.j;
        d = { title: "Order " + cur.j, rows: ["customer", "home", "promise", "status"].map(function (f) { return [q + "." + f, read(q + "." + f)]; }).concat([[q + ".courier", read(q + ".courier")]]), tabs: [q + ".eta", q + ".late", q + ".status"] }; }
      else if (cur.type === "street") d = { title: "Street " + cur.s, rows: [["streets." + cur.s + ".closed", read("streets." + cur.s + ".closed")]], tabs: ["streets." + cur.s + ".closed"], note: "Closing writes this value; the robots routed through the street re-plan and write their new dist (and next light), so their eta and their order's eta recompute. Drones fly over it." };
      else if (cur.type === "light") { var lp = "lights." + cur.l; d = { title: "Light " + cur.l, rows: [[lp + ".red", read(lp + ".red")], [lp + ".wait", read(lp + ".wait")]], tabs: [lp + ".wait", lp + ".red"], note: "Couriers whose next light this is point at it (couriers[i].next → " + lp + "); a change recomputes their eta through the pointer." }; }
      else if (cur.type === "city") d = { title: cur.p, rows: [[cur.p, read(cur.p)]], tabs: [cur.p] };
    }
    var path = d ? (tab && d.tabs.indexOf(tab) >= 0 ? tab : d.tabs[0]) : null, ex = path ? K.me.explain(path) : null;
    return h("section", { className: "cd-card", "data-cd": "explain-card", style: { gridColumn: "1 / -1" } }, h("div", { className: "cd-h" }, d ? d.title : "Explain"),
      !d ? h("div", { className: "cd-note" }, "Click a courier, a home, a light, a street or a number for its paths and ", me("me.explain(path)"), " as the kernel returns it (", link(L_EXP, "Explain"), ").") :
      h(React.Fragment, null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", columnGap: 14 } }, d.rows.map(function (r) { return h("div", { key: r[0], className: "cd-row" }, h("span", { className: "cd-num me-code", style: { color: "inherit" } }, synJ(r[0].split(".").slice(-1)[0])), h("span", { className: "cd-num" }, V(r[1]))); })),
        d.note ? h("div", { className: "cd-note" }, d.note) : null,
        h("div", { className: "cd-tabs", role: "tablist" }, d.tabs.map(function (t) { return h("button", { key: t, type: "button", role: "tab", className: "cd-tab" + (t === path ? " on" : ""), "aria-selected": t === path ? "true" : "false", onClick: function () { setTab(t); } }, t.split(".").slice(1).join(".")); })),
        h("div", { className: "cd-note" }, me('me.explain("' + path + '")'), " · " + KL + " · live"),
        h("pre", { className: "cd-json me-code", "data-cd": "explain" }, synJ(fmtJ(ex)))));
  }
  function Audiences() {
    var k = useKernel(), as = useState(0), A = audiences; useEffect(function () { var f = as[1]; A.subs.push(f); return function () { A.subs = A.subs.filter(function (g) { return g !== f; }); }; }, []);
    var ok = k.status === "ok";
    return h("section", { className: "cd-card", "data-cd": "audiences" }, h("div", { className: "cd-h" }, "Audiences · ME.wrapSecretV1 (OR)"),
      h("div", { className: "cd-bar", style: { marginTop: 0 } }, h("span", { className: "cd-seg", role: "group", "aria-label": "View as" }, PARTIES.map(function (p) { return h("button", { key: p, type: "button", className: "cd-btn" + (A.view === p ? " on" : ""), "data-cd": "as-" + p.replace(" ", ""), disabled: !ok || !A.wraps, onClick: function () { A.open(p); } }, p); })),
        h("button", { type: "button", className: "cd-btn", "data-cd": "reseal", disabled: !ok || A.busy, onClick: function () { A.seal(); }, title: "Seal a fresh snapshot for each audience" }, A.busy ? "Sealing…" : "Re-seal")),
      h("div", { className: "cd-aud", "data-cd": "aud-results" }, AUD.map(function (au) { var r = A.results[au.k];
        return [h("span", { key: au.k + "a" }, au.label, h("br"), h("small", { style: { color: TX2 } }, au.members.join(" OR "))),
          h("span", { key: au.k + "b" }, !r ? "…" : r.ok ? h(React.Fragment, null, h("span", { className: "ok" }, "opened (wrap for " + r.kid + ") "), h("code", null, r.text.length > 120 ? r.text.slice(0, 120) + " …" : r.text))
            : h(React.Fragment, null, h("span", { className: "no" }, "unwrapSecretV1 with " + A.view + "'s key on the wrap for " + r.kid + " → "), h("code", null, r.err)))]; })),
      h("div", { className: "cd-note" }, A.wraps ? "Sealed " + new Date(A.sealedAt).toLocaleTimeString() + " in " + A.ms.toFixed(0) + " ms. " : "", "A customer's map shows only the orders it can open and the couriers carrying them; ops opens the fleet. P-256 keys from ", me("ME.generateP256KeyPair()"), ". ", link(L_AUD, "Audiences")));
  }
  function Right() { return h("div", { className: "cd-right" }, h(Floor), h(Toolbar),
    h("p", { className: "cd-cap" }, "Robots keep to the sidewalks and wait at red lights; drones fly straight over the blocks. LED: green canTake · amber parcel aboard · blue busy · red low. Glow and ripples are the paths the kernel recomputed. Click anything."),
    h("div", { className: "cd-panel" }, h(Explain), h(Trace), h(Fleet), h(Audiences), h(KernelCard))); }

  // ── left sidebar: the narrated steps; each Run executes on a shared new ME() (me-run.js), each map button acts on the live city ──
  var STEPS = [
    { t: "Each courier is a path", map: [["Show robot 1", function () { select({ type: "courier", i: 1 }); }], ["drone 3", function () { select({ type: "courier", i: 3 }); }]],
      body: function () { return ["A sidewalk robot and a drone are branches of one tree: ", me("couriers[1].battery"), ", ", me(".speed"), ", ", me(".dist"), ", ", me(".busy"), ", ", me(".delivering"), ". ", link(L_PATHS, "Paths")]; },
      code: 'me.couriers[1].kind("robot")\nme.couriers[1].battery(80)\nme.couriers[1].speed(1.5)\nme.couriers[1].dist(300)\nme.couriers[1].busy(1)\nme.couriers[1].delivering(true)\nme("couriers[1].dist")' },
    { t: "An ETA that waits for the light", map: [["Show light L4", function () { select({ type: "light", l: "L4" }); }]],
      body: function () { return ["Each light declares ", me("wait = red * city.cycle"), ". A courier points at the next light on its route, ", me('couriers[i].next["->"]("lights.L4")'), ", and its ", me("eta"), " reads through the pointer. Drones point at ", me("lights.sky"), ". ", link(L_PTR, "Pointers")]; },
      code: 'me.city.cycle(25)\nme.city.reserve(30)\nme.lights["[i]"]["="]("wait", "red * city.cycle")\nme.lights.L4.red(1)\nme.lights.sky.red(0)\nme.couriers[1].next["->"]("lights.L4")\nme.couriers["[i]"]["="]("eta", "dist / speed + next.wait")\nme.couriers["[i]"]["="]("canTake", "battery > city.reserve && !busy")\nme("couriers[1].eta")' },
    { t: "A light turns green", map: [["Flip light L4", function () { actions.light("L4"); }]],
      body: function () { return ["One write to ", me("lights.L4.red"), ": its ", me("wait"), " and the ETAs of the couriers heading for it recompute. A drone pointing at ", me("lights.sky"), " is not touched. ", link(L_EXP, "Explain")]; },
      code: 'me.couriers[2].kind("drone")\nme.couriers[2].battery(90)\nme.couriers[2].speed(12)\nme.couriers[2].dist(600)\nme.couriers[2].busy(1)\nme.couriers[2].delivering(true)\nme.couriers[2].next["->"]("lights.sky")\nme.lights.L4.red(0)\nme("couriers[1].eta")\nme("couriers[2].eta")\nme.explain("couriers[1].eta").meta.recomputed' },
    { t: "Close a street", map: [["Close / open h2_2", function () { actions.close("h2_2"); }]],
      body: function () { return ["The router (page code) re-plans the robots whose route used the street and writes their new ", me("dist"), ". Their ", me("eta"), " and their order's recompute; drones and the other robots do not."]; },
      code: 'me.streets.h2_2.closed(1)\nme.couriers[1].dist(420)\nme("couriers[1].eta")\nme.explain("couriers[1].eta").meta.recomputed' },
    { t: "Orders point at couriers", map: [["Add order", function () { actions.order(); }]],
      body: function () { return ["The dispatcher writes ", me('orders[j].courier["->"]("couriers.i")'), "; the order's ", me("eta"), " and ", me("late"), " read through it, so a light or a closed street reaches the customer's ETA."]; },
      code: 'me.orders[1].customer(1)\nme.orders[1].promise(240)\nme.orders[1].courier["->"]("couriers.1")\nme.orders["[i]"]["="]("eta", "courier.eta")\nme.orders["[i]"]["="]("late", "courier.eta > promise")\nme("orders[1].eta")\nme("orders[1].late")' },
    { t: "Count the fleet", map: [["Show city.delivering", function () { select({ type: "city", p: "city.delivering" }); }], ["city.avgBattery", function () { select({ type: "city", p: "city.avgBattery" }); }]],
      body: function () { return [me("couriers[].delivering"), " sums a boolean field: each ", me("true"), " counts as 1, so it is how many couriers carry a parcel. ", me("couriers[].battery / couriers[]"), " is the mean battery. The explain lists each as an input with ", me('kind: "aggregate"'), ". Every courier write re-scans the collection, so the map declares them up to 60 couriers. ", link(L_AGG, "Aggregates")]; },
      code: 'me.city["="]("delivering", "couriers[].delivering")\nme.city["="]("avgBattery", "couriers[].battery / couriers[]")\nme("city.delivering")\nme("city.avgBattery")\nme.couriers[2].delivering(false)\nme("city.delivering")\nme.explain("city.delivering").derivation.inputs[0].aggregate' },
    { t: "Who sees what", map: [["View as customer 1", function () { audiences.open("customer 1"); }], ["ops", function () { audiences.open("ops"); }], ["outsider", function () { audiences.open("outsider"); }]],
      body: function () { return ["Each customer's orders are sealed for that customer OR ops, the fleet for ops: one ", me("ME.wrapSecretV1"), " per member. Customer 1's map shows its own parcels and the couriers carrying them, nothing else. ", link(L_AUD, "Audiences")]; },
      static: 'const W = await ME.wrapSecretV1({ secret: ordersOfCustomer1, recipientPublicKey: customer1.publicKey, kid: "customer 1", class: "identity-key" })\nawait ME.unwrapSecretV1(W, customer1.privateKey, "utf8")   // customer 1\'s orders\nawait ME.unwrapSecretV1(W, customer2.privateKey, "utf8")   // throws OperationError' }];
  var RELATED = [
    ["https://neurons-me.github.io/smart-cities/", "https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/assets/ai-decides-og.png", "Smart Cities", "All the city demos on .me."],
    ["https://neurons-me.github.io/.me/Demos/SmartCities/SelfCleaningCity/", "https://neurons-me.github.io/.me/Demos/SmartCities/SelfCleaningCity/assets/self-cleaning-og.png", "Self-Cleaning City", "Bin sensors and waste robots; each colonia sees only its own data."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Warehouse/", "https://neurons-me.github.io/.me/Demos/Robots/Warehouse/assets/warehouse-og.png", "Warehouse Fleet", "Robots pick orders; drain a battery or block an aisle."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Swarm/", "https://neurons-me.github.io/.me/Demos/Robots/Swarm/assets/swarm-og.png", "Rescue Swarm", "Drones search a disaster zone under fog."]];
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=2"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  var PATH = [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
    { text: "SmartCities", href: "https://neurons-me.github.io/smart-cities/", title: "Smart Cities" }, { text: "CityDelivery", href: null, title: "This page" }];
  var PAGE = { kicker: "Smart Cities · Robots · " + KL, title: "City Delivery", lede: h(React.Fragment, null, "Each courier is ", me("couriers[i]"), " with ", me("couriers[i].battery"), " and ", me(".dist"), "; one rule, ", me('couriers["[i]"]["="]("eta", "dist / speed + next.wait")'), ", and one aggregate, ", me('city["="]("delivering", "couriers[].delivering")'), ". Close a street and ", h(Reads)),
    api: function () { return window.CityDeliveryKernel; }, global: "__cd", expose: function () { return { K: K, bots: function () { return bots; }, orders: function () { return orders; }, select: select, actions: actions, audiences: audiences, rescale: rescale, wms: wms, EDGES: EDGES, LIGHTS: LIGHTS }; } };

  // ── intro: the last phrase runs a real action and lists the kernel's meta.recomputed inline ──
  (function () { var st = document.createElement("style"); st.textContent = ".cd-reads{all:unset;cursor:pointer;color:" + PRI + ";border-bottom:1px dashed " + PRI + "}.cd-reads:hover,.cd-reads:focus-visible{border-bottom-style:solid}.cd-reads-out{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px}.cd-reads-h{width:100%;font-size:12.5px}.cd-reads-chip{border:1px solid " + DIV + ";border-radius:6px;padding:1px 6px;line-height:1.5}.cd-reads-more{all:unset;cursor:pointer;font-size:12px;color:" + PRI + ";padding:0 4px}"; document.head.appendChild(st); })();
  function derivedCount() { return DERIVED().filter(function (p) { var e = K.me.explain(p); return e && e.derivation && e.derivation.expression; }).length; }
  function Reads() {
    var k = useKernel(), rs = useState(null), res = rs[0], setRes = rs[1], os = useState(false), open = os[0], setOpen = os[1], ok = k.status === "ok";
    var hover = function () { if (ok) READS.preview(); };
    var go = function () { if (!ok) return; var r = READS.run(); if (!r || !r.tr) return; setRes({ head: r.head, rec: r.tr.recomputed.slice(), total: derivedCount() }); setOpen(false); };
    var n = res ? res.rec.length : 0, shown = res ? (open ? res.rec : res.rec.slice(0, 8)) : [];
    return h(React.Fragment, null,
      h("button", { type: "button", className: "cd-reads", "data-cd": "reads", disabled: !ok, onMouseEnter: hover, onFocus: hover, onClick: go, title: READS.title }, "only what depends on it recomputes"), ".",
      res ? h("span", { className: "cd-reads-out", "data-cd": "reads-out" },
        h("span", { className: "cd-reads-h" }, res.head + " · ", h("b", null, n + " of " + res.total), " derived paths recomputed"),
        shown.map(function (p, x) { return h("span", { key: x, className: "cd-reads-chip" }, me(p)); }),
        n > 8 ? h("button", { type: "button", className: "cd-reads-more", "data-cd": "reads-more", onClick: function () { setOpen(!open); } }, open ? "less" : "+" + (n - 8) + " more") : null) : null);
  }
  function DERIVED() { var c = []; LIGHTS.forEach(function (l) { c.push("lights." + l.id + ".wait"); }); c.push("lights.sky.wait");
    bots.forEach(function (b) { ["eta", "canTake", "low"].forEach(function (f) { c.push(CP(b) + "." + f); }); });
    orders.forEach(function (o) { ["eta", "late"].forEach(function (f) { c.push("orders." + o.id + "." + f); }); });
    return c.concat(["city.delivering", "city.available", "city.avgBattery", "city.inAir"]); }
  function busyStreet() { var cnt = {}; bots.forEach(function (b) { if (b.air || !b.path) return; Object.keys(EDGES).forEach(function (sid) { if (!EDGES[sid].closed && usesStreet(b.path, b.seg, sid)) cnt[sid] = (cnt[sid] || 0) + 1; }); });
    var best = null; Object.keys(cnt).forEach(function (s) { if (!best || cnt[s] > cnt[best]) best = s; }); return best; }
  var READS = { title: "Closes the street most robots are routed through (streets.<id>.closed) and lists me.explain(…).meta.recomputed",
    preview: function () { var s = busyStreet(); if (s) select({ type: "street", s: s }); },
    run: function () { var s = busyStreet(); if (!s) return null; var tr = actions.close(s); return { tr: tr, head: "street " + s + " closed · " + (tr ? tr.reroutes : 0) + (tr && tr.reroutes === 1 ? " robot" : " robots") + " re-routed" }; } };
  function KernelCard() { var k = useKernel(), st = MK.state;
    return h("section", { className: "cd-card", style: { gridColumn: "1 / -1" } }, h("details", { className: "cd-k", "data-cd": "kernel" },
      h("summary", null, "Kernel · ", link(MK.KERNEL.npm, KL), " · ", st.state === "ok" ? h("span", { className: "ok" }, "sha256 verified") : st.state === "error" ? h("span", { className: "bad" }, "failed: " + st.text) : "loading…"),
      st.state === "ok" ? [h("div", { key: "h" }, "sha256 " + st.hash), h("div", { key: "u" }, "from ", link(st.url, st.url.replace("https://", ""))), h("div", { key: "s" }, "page source: ", link(SRC_URL, SRC_NAME))] : null)); }
  function Side() {
    var ss = useState(-1), on = ss[0], setOn = ss[1], k = useKernel(), Run = window.MeRun && window.MeRun.MeRunBlock, idx = 0;
    var toMap = function () { if (window.innerWidth >= 980) return; var f = document.querySelector(".cd-fig"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" }); };
    return h("aside", { className: "cd-side", "data-cd": "steps", "aria-label": "How it works, step by step" }, h("h2", null, "How it works"),
      STEPS.map(function (s, i) { var ri = s.code ? idx++ : -1;
        return h("section", { key: i, className: "cd-step" + (on === i ? " on" : ""), "data-cd": "step-" + (i + 1) },
          h("h3", null, h("b", null, i + 1), s.t), h("p", null, s.body()),
          s.code && Run ? h(Run, { idx: ri, code: s.code, compact: true }) : s.static ? h("pre", { className: "me-code cd-json", style: { maxHeight: "none", whiteSpace: "pre-wrap", margin: "0 0 10px" } }, h("code", null, synJ(s.static))) : null,
          h("div", { className: "cd-bar" }, h("span", { style: { fontSize: 11.5, color: TX2 } }, "On the map:"), s.map.map(function (m, j) { return h("button", { key: j, type: "button", className: "cd-btn", disabled: k.status !== "ok", "data-cd": "map-" + (i + 1) + "-" + (j + 1), onClick: function () { setOn(i); m[1](); toMap(); } }, m[0]); }))); }),
      h("p", { className: "cd-cap" }, "Run executes the blocks in page order on one shared ", me("new ME()"), " from " + KL + " (", link("https://neurons-me.github.io/.me/assets/me-run/me-run.js", "me-run.js"), "); the map runs its own instance. Source: ", link(SRC_URL, SRC_NAME), "."));
  }
  function Related() {
    return h("section", { className: "cd-rel", "data-cd": "related" }, h("h2", null, "Related"),
      h("div", { className: "cd-cards" }, RELATED.map(function (c) { return h("a", { key: c[0], className: "cd-card2", href: c[0] },
        h("span", { className: "img" }, h("img", { src: c[1], alt: "", loading: "lazy" })), h("span", { className: "tx" }, h("b", null, c[2]), h("small", null, c[3]))); })));
  }
  function Dashboard() { return h("div", { className: "cd-dash" }, h(Side), h(Right)); }
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
    N("CDTopBar", "topbar"),
    N("Box", "main", { component: "main", sx: { maxWidth: 1440, mx: "auto", px: { xs: 1.5, sm: 3 }, pt: { xs: 2.5, sm: 3.5 }, pb: 8 } }, [
      N("Typography", "kicker", { component: "p", sx: { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1 } }, [PAGE.kicker]),
      N("Typography", "title", { component: "h1", sx: { fontSize: "clamp(1.9rem, 5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1 } }, [PAGE.title]),
      N("Typography", "lede", { component: "p", sx: { color: "text.secondary", mb: 3, maxWidth: 760 } }, [PAGE.lede]),
      N("CDDashboard", "fleet"),
      N("CDRelated", "related"),
    ]),
  ]);
  var scope = window.__thisGuiThemeScope || {};
  var mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; } catch (e) {}
  var PageTheme = function (p) { return h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, p.children); };
  if (G.getInspectorEnabled()) G.setInspectorEnabled(false);
  var pageType = function (Comp) { return { type: "x", resolve: function (s) { var p = Object.assign({}, s.props || {}); delete p.key; return h(Comp, p); } }; };
  var reg = Object.assign({}, G.Registry || G.registry); [["CDTopBar", TopBar], ["CDDashboard", Dashboard], ["CDRelated", Related]].forEach(function (x) { reg[x[0]] = pageType(x[1]); reg[x[0]].type = x[0]; });
  G.mount(spec, ROOT, { me: PAGE.api(), gui: Object.assign({}, G, { render: undefined, RunMe: undefined, Theme: PageTheme, registry: reg }), devtools: { enabled: true, inspector: false, adminView: false, inspectorToggleVisible: false } });
  document.documentElement.classList.add("gui-on");
  window[PAGE.global] = PAGE.expose();
})();
