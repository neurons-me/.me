/*! Rescue Swarm 0.1.0 · a drone swarm held in a this.me 4.2.1 kernel · MIT · neurons.me
 * The kernel (this.me 4.2.1 from npm, sha256 checked in the browser by /.me/assets/me-kernel/me-kernel.js) holds the swarm:
 * drones[i].pos / battery / signal / zone / sees / dist / speed, zones[z].cells / scanned / victims, victims[k].heat / zone /
 * status and a pointer victims[k].rescuer -> drones[i]. The rules are ["="] derivations declared once per collection
 * (["[i]"]): needsRelay, canAssist, eta, range; coverage and priority per zone; reachable, eta and urgent per victim.
 * The canvas animates the flight; every scan, detection and signal change is a write, and the glow / ripples are drawn
 * from meta.recomputed of me.explain(). Victims, zones and the full picture are sealed per audience with ME.wrapSecretV1.
 */
(function () {
  var G = window.GUI, React = window.React, ROOT = document.getElementById("root"), MK = window.MeKernel;
  if (!G || !React || !window.ReactDOM || typeof G.mount !== "function" || !ROOT || !MK) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", KV = MK.KERNEL.version, KL = MK.KERNEL.label;
  var params = new URLSearchParams(location.search);
  var SRC_URL = "https://github.com/neurons-me/.me/blob/main/Demos/Robots/Swarm/swarm.js";
  var DOCS = "https://neurons-me.github.io/.me/docs/", L_OPS = DOCS + "Operators.html", L_EXP = DOCS + "Explain.html", L_PTR = DOCS + "Pointer-Composition.html",
    L_AUD = DOCS + "Audiences.html", L_PATHS = DOCS + "me-whatever-what.html", L_OK = DOCS + "O-k.html";

  // ── the disaster zone: 1200 × 720 px, 4 px = 1 m; 12 search zones (4 × 3); the base and relay mast bottom-left ──
  var W = 1200, H = 720, PXM = 4, ZC = 4, ZR = 3, ZW = W / ZC, ZH = H / ZR, NZ = ZC * ZR, CELL = 20, GX = W / CELL, GY = H / CELL, BASE = { x: 64, y: 664 }, LINK = 230;
  var zoneOf = function (x, y) { return 1 + Math.min(ZR - 1, Math.max(0, Math.floor(y / ZH))) * ZC + Math.min(ZC - 1, Math.max(0, Math.floor(x / ZW))); };
  var zoneRect = function (z) { var c = (z - 1) % ZC, r = Math.floor((z - 1) / ZC); return { x: c * ZW, y: r * ZH, w: ZW, h: ZH }; };
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // ── the kernel side ──
  var K = { me: null, N: Math.max(4, Math.min(300, +params.get("n") || 24)), writes: 0, subs: [], status: "loading", ver: 0, t0: performance.now(), recomputes: 0, trace: null, seq: 0, lastMs: 0 };
  function emit() { K.ver++; K.subs.forEach(function (f) { f(K.ver); }); }
  function nodeAt(path) { var p = K.me; path.split(".").forEach(function (s) { p = p[s]; }); return p; }
  function write(path, v) { var t = performance.now(); nodeAt(path)(v); K.writes++; K.lastMs = performance.now() - t; }
  function read(path) { return K.me ? K.me(path) : undefined; }
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  function probeFor(path) { var m = /^drones\.(\d+)\.(\w+)$/.exec(path); if (m) return "drones." + m[1] + "." + (m[2] === "dist" || m[2] === "speed" ? "eta" : "canAssist");
    m = /^zones\.(\d+)\.(\w+)$/.exec(path); if (m) return "zones." + m[1] + "." + (m[2] === "victims" ? "priority" : "coverage");
    m = /^victims\.(\d+)\.(\w+)$/.exec(path); if (m) return "victims." + m[1] + "." + (m[2] === "heat" ? "urgent" : "reachable");
    if (path === "swarm.reserve") return "drones.1.canAssist"; return null; }
  // write, then ask the kernel what recomputed (meta.recomputed of a dependent's explain whose sourcePath is this write)
  function traced(path, v, label) {
    write(path, v); var pr = probeFor(path); if (!pr) return null; var ex = K.me.explain(pr), m = ex && ex.meta; if (!m || m.sourcePath !== path || !m.recomputed) return null;
    var tr = { id: ++K.seq, path: path, value: v, recomputed: m.recomputed.slice(), changed: (m.changed || []).slice(), label: label || null, t: performance.now() };
    K.recomputes += tr.recomputed.length; if (label !== false) K.trace = tr; fx.trace(tr, label === false); return tr;
  }
  function pointTo(path, target) { nodeAt(path)["->"](target); K.writes++; var pr = probeFor(path), ex = pr && K.me.explain(pr), m = ex && ex.meta;
    if (m && m.recomputed) { K.recomputes += m.recomputed.length; return { path: path, value: target, recomputed: m.recomputed.slice(), changed: (m.changed || []).slice() }; } return null; }
  var lite = function () { return K.N > 60; };
  function simWrite(path, v) { if (lite()) write(path, v); else traced(path, v, false); }
  function seed(ME) {
    var me = new ME(), N = K.N, t = performance.now(), R = rng(7); K.me = null;
    me.swarm.name("Rescue Swarm"); me.swarm.size(N); me.swarm.reserve(25); me.swarm.found(0); me.swarm.assisted(0);
    me.drones["[i]"]["="]("needsRelay", "signal < 40");
    me.drones["[i]"]["="]("canAssist", "battery > swarm.reserve && signal >= 40 && !sees");
    me.drones["[i]"]["="]("eta", "dist / speed");
    me.drones["[i]"]["="]("range", "battery * 0.6 * speed");
    me.zones["[i]"]["="]("coverage", "scanned / cells * 100");
    me.zones["[i]"]["="]("priority", "victims * 10 + (100 - coverage)");
    me.victims["[i]"]["="]("reachable", "rescuer.canAssist");
    me.victims["[i]"]["="]("eta", "rescuer.eta");
    me.victims["[i]"]["="]("urgent", "heat < 35.5");
    for (var z = 1; z <= NZ; z++) { me.zones[z].cells((ZW / CELL) * (ZH / CELL)); me.zones[z].scanned(0); me.zones[z].victims(0); }
    me.swarm["="]("coverage", "zones[].coverage / zones[]");   // aggregate over the 12 zones
    // swarm counts: a boolean field sums as its count of true. Each drone write re-scans the drones for every aggregate, so up to 60 drones.
    if (!lite()) { me.swarm["="]("assisting", "drones[].canAssist"); me.swarm["="]("relays", "drones[].needsRelay"); }
    drones = []; victims = []; cells = new Uint8Array(GX * GY); zScan = new Array(NZ + 1).fill(0); zDirty = {}; fog.reset();
    for (var i = 1; i <= N; i++) { var a = (i / N) * Math.PI * .5, rr0 = 40 + (i % 6) * 14, x = BASE.x + Math.cos(-a) * rr0, y = BASE.y + Math.sin(-a) * rr0, d = me.drones[i], sp = r1(9 + (i * 7 % 6) * .8), home = 1 + ((i - 1) % NZ);
      d.battery(70 + (i * 13) % 30); d.signal(100); d.sees(0); d.speed(sp); d.dist(0); d.zone(zoneOf(x, y)); d.pos(Math.round(x) + "," + Math.round(y)); d.task(home);
      drones.push({ id: i, x: x, y: y, vx: 0, vy: 0, ang: -a, trail: [], tT: 0, home: home, mode: "search", tgt: null, sp: sp, alive: true, pulse: 0, sig: 100, zone: zoneOf(x, y), posT: 0, batT: (i % 10) / 10, seesT: 0 }); }
    var NV = Math.max(6, Math.round(N * .45));
    for (var k = 1; k <= NV; k++) { var vx = 140 + R() * (W - 180), vy = 40 + R() * (H - 80); if (Math.hypot(vx - BASE.x, vy - BASE.y) < 220) { vx += 300; }
      var v = me.victims[k], heat = r1(36.2 + R() * 1.1); v.heat(heat); v.zone(zoneOf(vx, vy)); v.status("unknown"); v.found(0); v.x(Math.round(vx / PXM)); v.y(Math.round(vy / PXM));
      victims.push({ id: k, x: vx, y: vy, heat: heat, status: "unknown", rescuer: 0, hold: 0, ph: R() * 6 }); }
    K.me = me; K.seedMs = performance.now() - t; K.writes = 0; K.recomputes = 0; K.trace = null; K.t0 = performance.now(); K.drop = null; mesh.update(true);
  }
  var ME_CLASS = null;
  MK.load().then(function (ME) { ME_CLASS = ME; seed(ME); K.status = "ok"; emit(); audiences.seal(); }, function (e) { K.status = "error"; K.error = String(e && e.message || e); emit(); });
  function rescale(n) { if (!ME_CLASS) return; K.N = n; select(null); seed(ME_CLASS); emit(); audiences.seal(); }
  window.SwarmKernel = { explain: function (p) { return K.me ? K.me.explain(p) : null; }, read: read };

  // ── mesh: drones link within 230 px; signal from hops to the base mast (the page computes it, the kernel stores it) ──
  var drones = [], victims = [], cells = new Uint8Array(GX * GY), zScan = [], zDirty = {};
  var DP = function (d) { return "drones." + d.id; }, VP = function (v) { return "victims." + v.id; };
  var mesh = { links: [], hop: {}, parent: {},
    update: function (quiet, collect) {
      var al = drones.filter(function (d) { return d.alive; }), hop = { 0: 0 }, par = {}, q = [{ id: 0, x: BASE.x, y: BASE.y }], links = [], byId = { 0: { id: 0, x: BASE.x, y: BASE.y } }, seen = { 0: 1 };
      al.forEach(function (d) { byId[d.id] = d; });
      var nodes = [byId[0]].concat(al);
      while (q.length) { var c = q.shift(); nodes.forEach(function (o) { if (seen[o.id]) return; var dd = Math.hypot(o.x - c.x, o.y - c.y); if (dd < LINK) { seen[o.id] = 1; hop[o.id] = hop[c.id] + 1; par[o.id] = { p: c.id, d: dd }; q.push(o); } }); }
      if (!lite()) for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) { var A = nodes[i], B = nodes[j], L = Math.hypot(A.x - B.x, A.y - B.y); if (L < LINK) links.push([A.id, B.id, L]); }
      else al.forEach(function (d) { if (par[d.id]) links.push([par[d.id].p, d.id, par[d.id].d]); });
      mesh.links = links; mesh.hop = hop; mesh.parent = par; mesh.byId = byId;
      al.forEach(function (d) { var s = hop[d.id] == null ? 0 : Math.max(5, Math.min(100, Math.round((100 - (hop[d.id] - 1) * 12 - par[d.id].d / LINK * 30) / 5) * 5));
        if (Math.abs(s - d.sig) >= 5 || (s === 0) !== (d.sig === 0) || (s < 40) !== (d.sig < 40)) { d.sig = s; if (quiet) write(DP(d) + ".signal", s); else { var tr = traced(DP(d) + ".signal", s, collect ? false : false); if (collect && tr) collect.push(tr); } } });
    } };

  // ── fog of war: an offscreen layer, cleared by each drone's sensor cone; revealed cells count toward zones[z].scanned ──
  var fog = { c: null, col: null, reset: function () { if (!fog.c) { fog.c = document.createElement("canvas"); fog.c.width = W; fog.c.height = H; } var x = fog.c.getContext("2d"); x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, W, H); x.fillStyle = fog.col || "#000"; x.fillRect(0, 0, W, H); },
    tint: function (col) { if (!fog.c || fog.col === col) return; fog.col = col; var x = fog.c.getContext("2d"); x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; } };
  var CONE = 74, HALF = .62;
  function scan(d) {
    if (d.sx != null && Math.hypot(d.x - d.sx, d.y - d.sy) < (lite() ? 10 : 5) && Math.abs(d.ang - d.sa) < .15) return; d.sx = d.x; d.sy = d.y; d.sa = d.ang;
    var x = fog.c.getContext("2d"); x.save(); x.globalCompositeOperation = "destination-out"; var g = x.createRadialGradient(d.x, d.y, 4, d.x, d.y, CONE); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(.7, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.beginPath(); x.moveTo(d.x, d.y); x.arc(d.x, d.y, CONE, d.ang - HALF, d.ang + HALF); x.closePath(); x.fill(); x.restore();
    var c0 = Math.max(0, Math.floor((d.x - CONE) / CELL)), c1 = Math.min(GX - 1, Math.floor((d.x + CONE) / CELL)), r0 = Math.max(0, Math.floor((d.y - CONE) / CELL)), r1_ = Math.min(GY - 1, Math.floor((d.y + CONE) / CELL));
    for (var cx = c0; cx <= c1; cx++) for (var cy = r0; cy <= r1_; cy++) { var idx = cy * GX + cx; if (cells[idx]) continue; var px = cx * CELL + CELL / 2, py = cy * CELL + CELL / 2, dx = px - d.x, dy = py - d.y, L = Math.hypot(dx, dy);
      if (L > CONE * .85) continue; var da = Math.atan2(dy, dx) - d.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(da) > HALF && L > 14) continue;
      cells[idx] = 1; var z = zoneOf(px, py); zScan[z]++; zDirty[z] = 1; }
    victims.forEach(function (v) { if (v.status !== "unknown") return; var dx = v.x - d.x, dy = v.y - d.y, L = Math.hypot(dx, dy); if (L > CONE * .8) return; var da = Math.atan2(dy, dx) - d.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(da) < HALF || L < 16) detect(v, d); });
  }

  // ── detections, allocation, flight ──
  function detect(v, d, label) {
    v.status = "detected"; v.foundBy = d.id; v.foundT = performance.now(); write(VP(v) + ".status", "detected"); write(VP(v) + ".found", 1); nodeAt(VP(v)).by["->"](DP(d)); K.writes++;
    write("swarm.found", (read("swarm.found") || 0) + 1);
    var a = traced(DP(d) + ".sees", v.id, label === undefined ? false : label), z = read(VP(v) + ".zone"), b = traced("zones." + z + ".victims", (read("zones." + z + ".victims") || 0) + 1, false);
    d.seesT = 1.6; fx.at(v.x, v.y, "heat"); fx.line(d.x, d.y, v.x, v.y, "detect");
    if (a && b) { a.recomputed = a.recomputed.concat(b.recomputed); a.changed = a.changed.concat(b.changed); }
    return a;
  }
  function allocate() {
    victims.forEach(function (v) {
      if (v.status !== "detected" && v.status !== "assigned") return;
      if (v.status === "assigned" && v.rescuer && read(VP(v) + ".reachable") === true) return;
      var best = null, bd = 1e9; drones.forEach(function (d) { if (!d.alive || d.mode !== "search" || read(DP(d) + ".canAssist") !== true) return; var L = Math.hypot(d.x - v.x, d.y - v.y); if (L < bd) { bd = L; best = d; } });
      if (!best) return; var prev = v.rescuer; if (prev) { var pd = drones[prev - 1]; if (pd && pd.tgt && pd.tgt.v === v.id) { pd.mode = "search"; pd.tgt = null; } }
      v.rescuer = best.id; v.status = "assigned"; write(VP(v) + ".status", "assigned"); var tr = pointTo(VP(v) + ".rescuer", DP(best));
      best.mode = "assist"; best.tgt = { x: v.x, y: v.y, v: v.id }; simWrite(DP(best) + ".dist", r1(bd / PXM)); fx.line(best.x, best.y, v.x, v.y, prev ? "realloc" : "assign");
      if (prev && K.drop && tr) { K.drop.realloc = (K.drop.realloc || 0) + 1; }
    });
  }
  function wander(d) {   // next search waypoint: the foggiest of a few samples in its zone
    var r = zoneRect(d.home), best = null, bf = -1;
    for (var s = 0; s < 7; s++) { var x = r.x + 18 + Math.random() * (r.w - 36), y = r.y + 18 + Math.random() * (r.h - 36), f = 0;
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) { var cx = Math.floor(x / CELL) + a, cy = Math.floor(y / CELL) + b; if (cx >= 0 && cy >= 0 && cx < GX && cy < GY && !cells[cy * GX + cx]) f++; }
      f -= Math.hypot(x - d.x, y - d.y) / 300; if (f > bf) { bf = f; best = { x: x, y: y }; } }
    return best;
  }
  var DRAIN = .016;   // % per metre
  function step(dt) {
    if (!K.me) return; var w0 = K.writes, now = performance.now();
    drones.forEach(function (d) {
      if (!d.alive) { d.vx *= .96; d.vy = d.vy * .96 + 40 * dt; if (d.fall < 1) { d.fall = Math.min(1, (d.fall || 0) + dt * .8); d.x += d.vx * dt; d.y += d.vy * dt * (1 - d.fall); } return; }
      var low = read(DP(d) + ".battery") < 18, relay = d.sig < 40;
      if (low && d.mode !== "home" && d.mode !== "charge") { if (d.tgt && d.tgt.v) { var lv = victims[d.tgt.v - 1]; if (lv && lv.status === "assigned") { lv.status = "detected"; lv.rescuer = 0; } } d.mode = "home"; d.tgt = { x: BASE.x + 24, y: BASE.y - 24 }; }
      if (d.mode === "search" && (!d.tgt || Math.hypot(d.tgt.x - d.x, d.tgt.y - d.y) < 16)) d.tgt = wander(d);
      if (d.mode === "search" && relay && mesh.parent) { var near = null, nd = 1e9; drones.forEach(function (o) { if (o === d || !o.alive || o.sig < 40) return; var L = Math.hypot(o.x - d.x, o.y - d.y); if (L < nd) { nd = L; near = o; } });
        var anchor = near && nd < Math.hypot(BASE.x - d.x, BASE.y - d.y) ? near : BASE; d.tgt = { x: d.x + (anchor.x - d.x) * .35, y: d.y + (anchor.y - d.y) * .35 }; }
      if (d.mode === "charge") { d.vx *= .9; d.vy *= .9; if ((d.batT -= dt) <= 0) { d.batT = .4; var c = read(DP(d) + ".battery"); if (c >= 95) { d.mode = "search"; d.tgt = null; } else simWrite(DP(d) + ".battery", r1(Math.min(100, c + 7))); } }
      else if (d.tgt) { var dx = d.tgt.x - d.x, dy = d.tgt.y - d.y, L = Math.hypot(dx, dy) || 1, v = d.sp * PXM * 1.6, arrive = Math.min(1, L / 50), ax = dx / L * v * arrive - d.vx, ay = dy / L * v * arrive - d.vy;
        drones.forEach(function (o) { if (o === d || !o.alive) return; var ox = d.x - o.x, oy = d.y - o.y, l2 = ox * ox + oy * oy; if (l2 < 900 && l2 > .01) { ax += ox / Math.sqrt(l2) * 40; ay += oy / Math.sqrt(l2) * 40; } });
        d.vx += ax * Math.min(1, dt * 2.2); d.vy += ay * Math.min(1, dt * 2.2); d.x = Math.max(6, Math.min(W - 6, d.x + d.vx * dt)); d.y = Math.max(6, Math.min(H - 6, d.y + d.vy * dt));
        var sp = Math.hypot(d.vx, d.vy); if (sp > 4) { var ta = Math.atan2(d.vy, d.vx), da = ta - d.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; d.ang += da * Math.min(1, dt * 4); }
        d.odo = (d.odo || 0) + sp * dt / PXM;
        if (L < 14) { if (d.mode === "assist") { var vv = victims[d.tgt.v - 1]; d.hold = (d.hold || 0) + dt; d.vx *= .8; d.vy *= .8;
            if (vv && d.hold > 3) { vv.status = "assisted"; write(VP(vv) + ".status", "assisted"); write("swarm.assisted", (read("swarm.assisted") || 0) + 1); fx.at(vv.x, vv.y, "saved"); d.hold = 0; d.mode = "search"; d.tgt = null; simWrite(DP(d) + ".dist", 0); } }
          else if (d.mode === "home") { d.mode = "charge"; d.batT = .4; } } }
      if (d.seesT > 0 && (d.seesT -= dt) <= 0) simWrite(DP(d) + ".sees", 0);
      if ((d.tT += dt) > .07) { d.tT = 0; d.trail.push(d.x, d.y); if (d.trail.length > (lite() ? 16 : 70)) d.trail.splice(0, 2); }
      if ((d.posT -= dt) <= 0) { d.posT = lite() ? 1.5 : .6; write(DP(d) + ".pos", Math.round(d.x / PXM) + "," + Math.round(d.y / PXM)); var z = zoneOf(d.x, d.y); if (z !== d.zone) { d.zone = z; write(DP(d) + ".zone", z); }
        if (d.mode === "assist" && d.tgt) write(DP(d) + ".dist", r1(Math.hypot(d.tgt.x - d.x, d.tgt.y - d.y) / PXM)); }
      if (d.mode !== "charge" && (d.batT -= dt) <= 0) { d.batT = lite() ? 3 : 1.2; var b = read(DP(d) + ".battery"), used = (d.odo || 0) * DRAIN + .15; d.odo = 0; simWrite(DP(d) + ".battery", r1(Math.max(0, b - used))); }
      scan(d);
    });
    victims.forEach(function (v) { if (v.status === "assisted") return; if ((v.hT = (v.hT || 0) + dt) > 4) { v.hT = 0; v.heat = r1(v.heat - .1); simWrite(VP(v) + ".heat", v.heat); } });
    if ((T.z += dt) > .6) { T.z = 0; Object.keys(zDirty).forEach(function (z) { simWrite("zones." + z + ".scanned", zScan[z]); }); zDirty = {}; }
    if ((T.mesh += dt) > .5) { T.mesh = 0; mesh.update(lite()); }
    if ((T.al += dt) > .4) { T.al = 0; allocate(); }
    if ((T.seal += dt) > 10) { T.seal = 0; audiences.seal(); }
    if (K.writes !== w0 && (T.emit += dt) > .15) { T.emit = 0; emit(); }
  }
  var T = { z: 0, mesh: 0, al: 0, emit: 0, seal: 0 };
  var actions = {
    drop: function (id) { var d = drones[(id || 1) - 1]; if (!d || !d.alive) return;
      d.alive = false; d.fall = 0; d.sig = 0; var main = traced(DP(d) + ".signal", 0, false), bat = traced(DP(d) + ".battery", 0, false);
      var all = { id: ++K.seq, path: DP(d) + ".signal", value: 0, label: "drone " + d.id + " lost", recomputed: [], changed: [], t: performance.now(), drone: d.id, direct: [], mesh: [], victims: [] };
      [main, bat].forEach(function (tr) { if (tr) { all.recomputed = all.recomputed.concat(tr.recomputed); all.changed = all.changed.concat(tr.changed); all.direct = all.direct.concat(tr.recomputed); } }); all.direct = all.direct.filter(function (p, i, x) { return x.indexOf(p) === i; });
      victims.forEach(function (v) { if (v.rescuer === d.id) all.victims.push(v.id); });
      var col = []; mesh.update(false, col); col.forEach(function (tr) { all.recomputed = all.recomputed.concat(tr.recomputed); all.changed = all.changed.concat(tr.changed); all.mesh.push(tr.path); });
      all.recomputed = all.recomputed.filter(function (p, i, a) { return a.indexOf(p) === i; }); all.changed = all.changed.filter(function (p, i, a) { return a.indexOf(p) === i; });
      K.trace = all; K.drop = all; fx.meshWave(d); fx.trace(all); select({ type: "drone", i: d.id, tab: "drones." + d.id + ".canAssist" }); emit(); return all; },
    ping: function () { var hid = victims.filter(function (v) { return v.status === "unknown"; }); if (!hid.length) return null; var v = hid[Math.floor(Math.random() * hid.length)], best = null, bd = 1e9;
      drones.forEach(function (d) { if (!d.alive) return; var L = Math.hypot(d.x - v.x, d.y - v.y); if (L < bd) { bd = L; best = d; } }); if (!best) return null;
      var c = fog.c.getContext("2d"); c.save(); c.globalCompositeOperation = "destination-out"; var g = c.createRadialGradient(v.x, v.y, 0, v.x, v.y, 46); g.addColorStop(0, "rgba(0,0,0,.9)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(v.x - 46, v.y - 46, 92, 92); c.restore();
      var tr = detect(v, best, "heat ping: victim " + v.id + " seen by drone " + best.id); if (tr) { tr.label = "victim " + v.id + " detected by drone " + best.id; K.trace = tr; }
      select({ type: "victim", k: v.id }); emit(); return tr; },
    reserve: function () { var v = read("swarm.reserve") === 25 ? 60 : 25; var tr = traced("swarm.reserve", v, "swarm.reserve → " + v); emit(); return tr; },
    revive: function () { drones.forEach(function (d) { if (!d.alive) { d.alive = true; d.fall = 0; d.y = Math.max(20, d.y - 10); write(DP(d) + ".battery", 60); d.mode = "search"; d.tgt = null; } }); mesh.update(false); emit(); },
  };

  // ── effects: drawn from meta.recomputed; mesh waves follow the hop order from the lost drone ──
  var FX = [], fx = {
    at: function (x, y, kind) { FX.push({ x: x, y: y, kind: kind, t: performance.now() }); if (FX.length > 500) FX.splice(0, FX.length - 500); },
    line: function (x1, y1, x2, y2, kind, delay) { FX.push({ x: x1, y: y1, x2: x2, y2: y2, kind: kind || "ripple", t: performance.now() + (delay || 0) }); },
    where: function (p) { var m = /^drones\.(\d+)\./.exec(p); if (m) { var d = drones[m[1] - 1]; return d ? { x: d.x, y: d.y, d: d } : null; }
      m = /^victims\.(\d+)\./.exec(p); if (m) { var v = victims[m[1] - 1]; return v ? { x: v.x, y: v.y, v: v } : null; }
      m = /^zones\.(\d+)\./.exec(p); if (m) { var r = zoneRect(+m[1]); return { x: r.x + r.w / 2, y: r.y + r.h / 2, z: +m[1] }; }
      if (/^swarm\./.test(p)) return { x: 90, y: 36 }; return null; },
    trace: function (tr, quiet) { var src = fx.where(tr.path) || { x: 90, y: 36 }, seen = {}, i = 0, now = performance.now();
      tr.recomputed.forEach(function (p) { var w = fx.where(p); if (!w) return; if (w.d) w.d.pulse = now + i * 22; if (quiet) { i++; return; } if (w.z) zPulse[w.z] = now + i * 22;
        var key = Math.round(w.x) + "," + Math.round(w.y); if (!seen[key] && Math.abs(w.x - src.x) + Math.abs(w.y - src.y) > 4 && i < 260) { seen[key] = 1; fx.line(src.x, src.y, w.x, w.y, "ripple", i * 16); } i++; });
      if (!quiet) fx.at(src.x, src.y, "src"); },
    meshWave: function (d) { var t0 = performance.now(); fx.at(d.x, d.y, "lost");
      mesh.links.forEach(function (l) { var A = mesh.byId[l[0]], B = mesh.byId[l[1]]; if (!A || !B) return; var h1 = Math.min(Math.hypot(A.x - d.x, A.y - d.y), Math.hypot(B.x - d.x, B.y - d.y)); fx.line(A.x, A.y, B.x, B.y, "mesh", h1 * 2.2); }); },
  };
  var zPulse = {};

  // ── audiences: victims → rescuers OR command; zone z → each drone in it OR command; one ME.wrapSecretV1 per member ──
  var audiences = { keys: null, wraps: null, members: null, view: params.get("as") || "command", viewDrone: 1, results: {}, busy: false, sealedAt: 0, ms: 0, subs: [], error: null,
    parties: function () { return ["command", "rescuers", "drone " + audiences.viewDrone, "outsider"]; },
    seal: function () { var A = audiences, ME = ME_CLASS; if (!ME || A.busy || typeof ME.wrapSecretV1 !== "function") return; A.busy = true; var t0 = performance.now(), nd = Math.min(K.N, 30);
      var need = ["command", "rescuers", "outsider"]; for (var i = 1; i <= nd; i++) need.push("drone " + i);
      var have = A.keys || {}, miss = need.filter(function (p) { return !have[p]; });
      Promise.all(miss.map(function () { return ME.generateP256KeyPair(); })).then(function (ks) { miss.forEach(function (p, i) { have[p] = ks[i]; }); A.keys = have;
        var sets = [{ k: "victims", members: ["rescuers", "command"], data: victims.filter(function (v) { return v.status !== "unknown"; }).map(function (v) { return { victim: v.id, status: v.status, heat: read(VP(v) + ".heat"), zone: read(VP(v) + ".zone") }; }) }];
        for (var z = 1; z <= NZ; z++) { var mem = drones.filter(function (d) { return d.id <= nd && d.alive && d.zone === z; }).map(function (d) { return "drone " + d.id; }).concat(["command"]);
          sets.push({ k: "zone " + z, z: z, members: mem, data: { zone: z, coverage: Math.round(read("zones." + z + ".coverage")), victims: read("zones." + z + ".victims"), drones: mem.length - 1 } }); }
        var wr = {}; return Promise.all(sets.map(function (s) { wr[s.k] = {}; var secret = JSON.stringify(s.data);
          return Promise.all(s.members.map(function (m) { return ME.wrapSecretV1({ secret: secret, recipientPublicKey: have[m].publicKey, kid: m, class: "identity-key" }).then(function (w) { wr[s.k][m] = w; }); })); }))
          .then(function () { A.wraps = wr; A.sets = sets; A.sealedAt = Date.now(); A.ms = performance.now() - t0; A.count = sets.reduce(function (n, s) { return n + s.members.length; }, 0); return A.open(A.view); }); })
        .catch(function (e) { A.error = String(e && e.message || e); }).then(function () { A.busy = false; A.emit(); }); },
    open: function (who) { var A = audiences, ME = ME_CLASS; if (/^drone/.test(who) && !A.keys[who]) who = "drone 1"; A.view = who; if (!A.wraps) return Promise.resolve();
      return Promise.all(A.sets.map(function (s) { var mine = s.members.indexOf(who) >= 0, w = A.wraps[s.k][mine ? who : s.members[0]];
        return ME.unwrapSecretV1(w, A.keys[who].privateKey, "utf8").then(function (t) { return { ok: true, text: t, kid: w.kid }; },
          function (e) { return { ok: false, kid: w.kid, err: e && e.name ? e.name + (e.message && e.message !== e.name ? ": " + e.message : "") : String(e) }; }); }))
        .then(function (rs) { A.results = {}; A.sets.forEach(function (s, i) { A.results[s.k] = rs[i]; }); A.emit(); }); },
    can: function (k) { var r = audiences.results[k]; return !audiences.wraps || !!(r && r.ok); },
    emit: function () { audiences.subs.forEach(function (f) { f(Date.now()); }); emit(); } };

  // ── page CSS (theme tokens only) ──
  var DIV = "var(--mui-palette-divider,rgba(128,128,128,.3))", TX2 = "var(--mui-palette-text-secondary,#8b949e)", PRI = "var(--mui-palette-primary-main,#58a6ff)", PAPER = "var(--mui-palette-background-paper,transparent)";
  var CSS = [
    ".sw-dash{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}",
    "@media (min-width:980px){.sw-dash{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}.sw-side{grid-column:1;grid-row:1}.sw-right{grid-column:2;grid-row:1;position:sticky;top:60px;max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}}",
    "@media (max-width:979px){.sw-right{order:-1}}",
    ".sw-fig{position:relative;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:var(--mui-palette-background-default,transparent)}.sw-fig canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation}",
    ".sw-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 0}.sw-btn{font:inherit;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.4));background:transparent;color:inherit;cursor:pointer}.sw-btn:hover{border-color:" + PRI + "}.sw-btn.on{color:" + PRI + ";border-color:currentColor}.sw-btn:disabled{opacity:.5;cursor:default}.sw-sep{flex:1}",
    ".sw-seg{display:inline-flex;border:1px solid " + DIV + ";border-radius:8px;overflow:hidden}.sw-seg .sw-btn{border:0;border-radius:0}.sw-seg .sw-btn+.sw-btn{border-left:1px solid " + DIV + "}",
    ".sw-panel{margin-top:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media (min-width:1240px){.sw-panel{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}",
    ".sw-card{border:1px solid " + DIV + ";border-radius:12px;background:" + PAPER + ";font-size:13px;padding:10px 12px;min-width:0}.sw-h{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:" + TX2 + "}",
    ".sw-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.sw-kpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;padding:6px 8px;border:1px solid " + DIV + ";border-radius:9px;cursor:pointer;min-width:0}.sw-kpi:hover,.sw-kpi:focus-visible,.sw-kpi[aria-pressed=true]{border-color:" + PRI + "}.sw-kpi b{font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}.sw-kpi small{font-size:11px;color:" + TX2 + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sw-row{display:flex;justify-content:space-between;gap:10px;line-height:1.6;min-width:0}.sw-row>span:first-child{color:" + TX2 + ";min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sw-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}",
    ".sw-note{margin-top:6px;font-size:12px;line-height:1.5;color:" + TX2 + "}.sw-note a,.sw-side a,.sw-k a{color:" + PRI + ";text-decoration:none}.sw-note a:hover,.sw-side a:hover,.sw-k a:hover{text-decoration:underline}",
    ".sw-json{margin:6px 0 0;padding:8px;max-height:280px;overflow:auto;border-radius:8px;border:1px solid " + DIV + ";font:11px/1.5 " + MONO + ";white-space:pre;color:var(--mui-palette-text-primary,inherit)}",
    ".sw-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 0}.sw-tab{font:11.5px " + MONO + ";padding:3px 8px;border-radius:999px;border:1px solid " + DIV + ";background:transparent;color:" + TX2 + ";cursor:pointer}.sw-tab.on{color:var(--mui-palette-text-primary,inherit);border-color:" + PRI + "}",
    ".sw-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:84px;overflow:auto}.sw-chip{font:10.5px " + MONO + ";padding:1px 6px;border-radius:6px;border:1px solid " + DIV + ";color:" + TX2 + "}.sw-chip.ch{color:" + PRI + ";border-color:color-mix(in srgb," + PRI + " 50%,transparent)}",
    ".sw-aud{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:baseline;font-size:12px;margin-top:6px}.sw-aud .ok{color:var(--mui-palette-success-main,#2e9d6e)}.sw-aud .no{color:var(--mui-palette-error-main,#e5534b)}.sw-aud code{font:11px " + MONO + ";overflow-wrap:anywhere}",
    ".sw-k summary{cursor:pointer;list-style:none;font:11.5px/1.5 " + MONO + ";color:" + TX2 + "}.sw-k summary::-webkit-details-marker{display:none}.sw-k .ok{color:var(--mui-palette-success-main,#2e9d6e)}.sw-k .bad{color:var(--mui-palette-error-main,#e5534b)}.sw-k div{font:11px/1.6 " + MONO + ";color:" + TX2 + ";overflow-wrap:anywhere}",
    ".sw-side{font-size:14px;line-height:1.6}.sw-side h2{margin:0 0 8px;font-size:1.2rem;font-weight:800}.sw-step{border:1px solid " + DIV + ";border-radius:12px;padding:10px 12px 2px;margin:0 0 12px;background:" + PAPER + ";scroll-margin-top:64px;transition:border-color .2s}.sw-step.on{border-color:" + PRI + "}",
    ".sw-step h3{margin:0 0 4px;font-size:14px;font-weight:800;display:flex;gap:8px;align-items:baseline}.sw-step h3 b{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:50%;font-size:11px;border:1px solid " + PRI + ";color:" + PRI + "}.sw-step p{margin:0 0 8px;font-size:13px}.sw-step .sw-bar{margin:0 0 10px}",
    ".sw-reads{all:unset;cursor:pointer;color:" + PRI + ";border-bottom:1px dashed " + PRI + "}.sw-reads:hover,.sw-reads:focus-visible{border-bottom-style:solid}.sw-reads-out{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px}.sw-reads-h{width:100%;font-size:12.5px}.sw-reads-chip{border:1px solid " + DIV + ";border-radius:6px;padding:1px 6px;line-height:1.5}.sw-reads-more{all:unset;cursor:pointer;font-size:12px;color:" + PRI + ";padding:0 4px}",
    ".sw-me{font-family:" + MONO + ";font-size:12px}.sw-cap{margin:6px 2px 0;font-size:12px;line-height:1.5;color:" + TX2 + "}",
    ".sw-rel{margin:32px 0 8px}.sw-rel h2{margin:0 0 10px;font-size:1.35rem;font-weight:800}.sw-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media (max-width:900px){.sw-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.sw-cards{grid-template-columns:1fr}}",
    ".sw-card2{display:flex;flex-direction:column;border:1px solid " + DIV + ";border-radius:14px;overflow:hidden;background:" + PAPER + ";color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}.sw-card2:hover{transform:translateY(-2px);border-color:" + PRI + "}.sw-card2 .img{display:block;aspect-ratio:1200/630;background:var(--mui-palette-action-hover,rgba(128,128,128,.12));overflow:hidden}.sw-card2 img{width:100%;height:100%;object-fit:cover;display:block}.sw-card2 .tx{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.sw-card2 b{font-size:14px;font-weight:800}.sw-card2 small{font-size:12px;line-height:1.4;color:" + TX2 + "}",
  ].join("\n");
  (function () { var s = document.createElement("style"); s.id = "sw-css"; s.textContent = CSS; document.head.appendChild(s); })();
  var SYN = window.MeSyntax;
  if (SYN && SYN.watchTheme) SYN.watchTheme();   // --me-syn-* from the active .GUI theme; follows theme / mode changes
  var me = function (t) { return h("code", { className: "me-code sw-me" }, SYN ? SYN.render(h, t) : t); };
  var synJ = function (t) { return SYN ? SYN.render(h, t) : t; };
  var link = function (href, text) { return h("a", { href: href, target: href.indexOf("http") === 0 ? "_blank" : undefined, rel: "noopener" }, text); };
  var fmtJ = function (o) { try { return JSON.stringify(o, null, 2); } catch (e) { return String(o); } };
  function useKernel() { var s = useState(K.ver), set = s[1]; useEffect(function () { var f = function (v) { set(v); }; K.subs.push(f); return function () { K.subs = K.subs.filter(function (g) { return g !== f; }); }; }, []); return K; }
  var sel = { v: null, subs: [] }; function select(x) { sel.v = x; sel.subs.forEach(function (f) { f(x); }); }
  function useSel() { var s = useState(sel.v), set = s[1]; useEffect(function () { sel.subs.push(set); return function () { sel.subs = sel.subs.filter(function (g) { return g !== set; }); }; }, []); return s[0]; }
  var running = { on: params.get("paused") !== "1" };

  // ── the figure ──
  function Floor() {
    var cv = useRef(null);
    useEffect(function () {
      var c = cv.current, ctx = c.getContext("2d"), raf = 0, last = performance.now(), pal = null, palT = 0, frames = 0, fpsT = performance.now(), terr = null, terrDark = null;
      var dpr = Math.min(1.5, window.devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
      var css = function (n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim() || getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; };
      function rgba(col, al) { var m = String(col).match(/^#([0-9a-f]{6})$/i); if (m) { var n = parseInt(m[1], 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + al + ")"; }
        m = String(col).match(/rgba?\(([^)]+)\)/); if (m) return "rgba(" + m[1].split(",").slice(0, 3).join(",") + "," + al + ")"; return col; }
      function palette() { var bg = css("--mui-palette-background-default", ""), dark = true, m = bg.match(/\d+/g);
        if (/^#/.test(bg)) { var n = parseInt(bg.slice(1, 7), 16); dark = ((n >> 16) + (n >> 8 & 255) + (n & 255)) / 3 < 128; } else if (m && m.length >= 3) dark = (+m[0] + +m[1] + +m[2]) / 3 < 128;
        return { dark: dark, bg: bg || (dark ? "#0d1117" : "#ffffff"), ink: css("--mui-palette-text-primary", dark ? "#e6edf3" : "#1f2328"), muted: css("--mui-palette-text-secondary", dark ? "#8b949e" : "#57606a"),
          faint: css("--mui-palette-text-disabled", dark ? "#6e7681" : "#8c959f"), acc: css("--mui-palette-primary-main", "#58a6ff"), fog: dark ? "#06080d" : "#dfe3ea",
          ground: dark ? "#141a22" : "#eceae4", rubble: dark ? "#2a2f38" : "#c9c3b8", bld: dark ? "#1d232c" : "#dcd8cf", water: dark ? "#10263a" : "#bcd6ea", road: dark ? "#1b2129" : "#e2dfd8",
          heat: dark ? "#ff6b3d" : "#e2531f", hot: dark ? "#ffd166" : "#d18b00", ok: dark ? "#3fb950" : "#1a7f37", bad: dark ? "#f85149" : "#cf222e", drone: dark ? "#9fd8ff" : "#0a6fb5", glow: dark ? "#7ee2ff" : "#0a84c6", mesh: dark ? "#58a6ff" : "#0969da" }; }
      function terrain(P) {   // seeded, drawn once per theme: streets, a river, intact blocks, collapsed blocks as rubble
        var t = document.createElement("canvas"); t.width = W; t.height = H; var x = t.getContext("2d"), R = rng(42);
        x.fillStyle = P.ground; x.fillRect(0, 0, W, H);
        for (var i = 0; i < 900; i++) { x.fillStyle = rgba(P.ink, .02 + R() * .03); x.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2); }
        x.strokeStyle = P.water; x.lineWidth = 34; x.lineCap = "round"; x.beginPath(); x.moveTo(560, -20); x.bezierCurveTo(640, 180, 760, 260, 900, 330); x.bezierCurveTo(1010, 390, 1100, 380, 1230, 470); x.stroke();
        x.strokeStyle = rgba(P.ink, .07); x.lineWidth = 1; x.stroke();
        x.strokeStyle = P.road; x.lineWidth = 14; [130, 360, 600].forEach(function (yy) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy + 12); x.stroke(); }); [200, 470, 760, 1020].forEach(function (xx) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx - 18, H); x.stroke(); });
        x.strokeStyle = rgba(P.ink, .12); x.lineWidth = 1; x.setLineDash([8, 10]); [130, 360, 600].forEach(function (yy) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy + 12); x.stroke(); }); x.setLineDash([]);
        for (var bx = 0; bx < 22; bx++) for (var by = 0; by < 13; by++) { var px = 20 + bx * 54 + R() * 10, py = 18 + by * 54 + R() * 10, w = 26 + R() * 18, hh = 22 + R() * 18;
          if (Math.hypot(px - BASE.x, py - BASE.y) < 120 || R() < .18) continue;
          if (R() < .45) { x.fillStyle = P.rubble; x.beginPath(); var n = 7 + Math.floor(R() * 5); for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2, rr = (w + hh) / 4 * (.6 + R() * .7); k ? x.lineTo(px + w / 2 + Math.cos(a) * rr, py + hh / 2 + Math.sin(a) * rr) : x.moveTo(px + w / 2 + Math.cos(a) * rr, py + hh / 2 + Math.sin(a) * rr); } x.closePath(); x.fill();
            x.strokeStyle = rgba(P.ink, .14); x.stroke(); x.save(); x.clip(); x.strokeStyle = rgba(P.ink, .08); for (var hl = -40; hl < 60; hl += 5) { x.beginPath(); x.moveTo(px + hl, py - 10); x.lineTo(px + hl + 30, py + hh + 10); x.stroke(); } x.restore();
            for (var dbr = 0; dbr < 10; dbr++) { x.fillStyle = rgba(P.ink, .12 + R() * .12); x.fillRect(px + R() * (w + 16) - 8, py + R() * (hh + 16) - 8, 2 + R() * 3, 2 + R() * 3); } }
          else { x.fillStyle = P.bld; x.fillRect(px, py, w, hh); x.strokeStyle = rgba(P.ink, .16); x.strokeRect(px + .5, py + .5, w, hh); x.strokeStyle = rgba(P.ink, .06); x.beginPath(); x.moveTo(px, py); x.lineTo(px + w, py + hh); x.stroke(); } }
        return t; }
      var FIRES = [[330, 240], [880, 520], [690, 110], [1080, 640], [420, 610]];
      var FS = 1;
      function txt(sz, t, x, y, col, al, wt) { ctx.font = (wt || 500) + " " + (sz * FS).toFixed(1) + "px " + MONO; ctx.fillStyle = col; ctx.textAlign = al || "center"; ctx.fillText(t, x, y); }
      function draw() {
        var now = performance.now(); if (!pal || now - palT > 500) { pal = palette(); palT = now; } var P = pal, ok = !!K.me, on = sel.v; K.pal = P;
        if (!terr || terrDark !== P.dark) { terr = terrain(P); terrDark = P.dark; } if (!fog.c) { fog.col = P.fog; fog.reset(); } fog.tint(P.fog);
        FS = Math.max(1, Math.min(2.2, 760 / (c.clientWidth || W)));
        var seeV = audiences.can("victims");
        ctx.drawImage(terr, 0, 0, W, H);
        FIRES.forEach(function (f, i) { var fl = .6 + .4 * Math.sin(now / 130 + i * 2) * Math.sin(now / 370 + i), g = ctx.createRadialGradient(f[0], f[1], 0, f[0], f[1], 40 + 10 * fl); g.addColorStop(0, rgba(P.hot, .55 * fl)); g.addColorStop(.4, rgba(P.heat, .25)); g.addColorStop(1, rgba(P.heat, 0)); ctx.fillStyle = g; ctx.fillRect(f[0] - 60, f[1] - 60, 120, 120);
          for (var s = 0; s < 4; s++) { var age = ((now / 2600 + s / 4 + i * .17) % 1), sx = f[0] + Math.sin(age * 6 + i) * 12 + age * 40, sy = f[1] - age * 90; ctx.fillStyle = rgba(P.ink, .07 * (1 - age)); ctx.beginPath(); ctx.arc(sx, sy, 10 + age * 26, 0, 7); ctx.fill(); } });
        // victims below the fog: a faint heat glow until found
        victims.forEach(function (v) { var pu = .5 + .5 * Math.sin(now / 420 + v.ph); ctx.fillStyle = rgba(P.heat, v.status === "unknown" ? .35 + .2 * pu : .2); ctx.beginPath(); ctx.arc(v.x, v.y, 5 + pu * 2, 0, 7); ctx.fill(); });
        ctx.globalAlpha = P.dark ? .9 : .82; ctx.drawImage(fog.c, 0, 0, W, H); ctx.globalAlpha = 1;
        // zones: grid, coverage bars, sealed zones for the party viewing
        for (var z = 1; z <= NZ; z++) { var r = zoneRect(z), open = audiences.can("zone " + z), cov = ok ? read("zones." + z + ".coverage") : 0, zp = zPulse[z] ? (now - zPulse[z]) / 800 : 9, isSel = on && on.type === "zone" && on.z === z;
          ctx.strokeStyle = rgba(P.ink, .1); ctx.lineWidth = 1; ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
          if (!open) { ctx.fillStyle = rgba(P.fog, .7); ctx.fillRect(r.x, r.y, r.w, r.h); ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.strokeStyle = rgba(P.ink, .06); for (var hz = -r.h; hz < r.w; hz += 12) { ctx.beginPath(); ctx.moveTo(r.x + hz, r.y); ctx.lineTo(r.x + hz + r.h, r.y + r.h); ctx.stroke(); } ctx.restore(); txt(10, "SEALED", r.x + r.w / 2, r.y + r.h / 2, P.faint); }
          if (zp >= 0 && zp < 1) { ctx.strokeStyle = rgba(P.glow, .6 * (1 - zp)); ctx.lineWidth = 2; ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.setLineDash([]); }
          txt(9.5, "Z" + z + (open && ok ? " · " + Math.round(cov) + "%" : ""), r.x + 8, r.y + 16 * Math.min(FS, 1.4), isSel ? P.acc : P.muted, "left", 600);
          if (open && ok) { ctx.fillStyle = rgba(P.ink, .1); ctx.fillRect(r.x + 8, r.y + 22 * Math.min(FS, 1.4), 60, 3); ctx.fillStyle = P.glow; ctx.fillRect(r.x + 8, r.y + 22 * Math.min(FS, 1.4), 60 * Math.min(1, cov / 100), 3); } }
        // the base and its mast
        ctx.save(); ctx.strokeStyle = P.acc; ctx.lineWidth = 1.4; for (var rw = 0; rw < 3; rw++) { var age = ((now / 1600) + rw / 3) % 1; ctx.globalAlpha = (1 - age) * .5; ctx.beginPath(); ctx.arc(BASE.x, BASE.y, 10 + age * 60, 0, 7); ctx.stroke(); } ctx.restore();
        ctx.fillStyle = P.acc; ctx.beginPath(); ctx.moveTo(BASE.x, BASE.y - 18); ctx.lineTo(BASE.x - 8, BASE.y + 10); ctx.lineTo(BASE.x + 8, BASE.y + 10); ctx.closePath(); ctx.fill(); txt(9.5, "BASE", BASE.x, BASE.y + 26, P.acc, "center", 700);
        // mesh
        if (ok) mesh.links.forEach(function (l) { var A = mesh.byId[l[0]], B = mesh.byId[l[1]]; if (!A || !B) return; var f = 1 - l[2] / LINK; ctx.strokeStyle = rgba(P.mesh, .08 + .3 * f); ctx.lineWidth = .6 + 1.2 * f; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); });
        // trails and sensor cones
        var big = !lite();
        drones.forEach(function (d) { if (!d.alive) return; var t = d.trail, n = t.length / 2; if (n > 2) { for (var q = 1; q < n; q++) { ctx.strokeStyle = rgba(d.mode === "assist" ? P.heat : P.drone, (q / n) * .45); ctx.lineWidth = big ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(t[q * 2 - 2], t[q * 2 - 1]); ctx.lineTo(t[q * 2], t[q * 2 + 1]); ctx.stroke(); } }
          if (big) { var g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, CONE); g.addColorStop(0, rgba(P.glow, .24)); g.addColorStop(1, rgba(P.glow, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.arc(d.x, d.y, CONE, d.ang - HALF, d.ang + HALF); ctx.closePath(); ctx.fill(); } });
        // victims found: heat signature rings (audience: victims)
        if (ok && seeV) victims.forEach(function (v) { if (v.status === "unknown") return; var isSel = on && on.type === "victim" && on.k === v.id, urgent = read(VP(v) + ".urgent") === true, col = v.status === "assisted" ? P.ok : urgent ? P.bad : P.heat;
          for (var rg = 0; rg < (v.status === "assisted" ? 1 : 3); rg++) { var ag = ((now / (urgent ? 700 : 1100)) + rg / 3) % 1; ctx.strokeStyle = rgba(col, (1 - ag) * .8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(v.x, v.y, 5 + ag * 26, 0, 7); ctx.stroke(); }
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(v.x, v.y, 4.5, 0, 7); ctx.fill(); ctx.restore();
          if (v.status === "assisted") { ctx.strokeStyle = P.ok; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(v.x - 4, v.y); ctx.lineTo(v.x - 1, v.y + 3); ctx.lineTo(v.x + 5, v.y - 4); ctx.stroke(); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(v.x, v.y, 16, 0, 7); ctx.stroke(); ctx.setLineDash([]); txt(10, "VICTIM " + v.id + " · " + read(VP(v) + ".heat") + "°C", v.x, v.y - 22, P.acc, "center", 700); }
          if (v.status === "assigned" && v.rescuer) { var rd = drones[v.rescuer - 1]; if (rd && rd.alive) { ctx.strokeStyle = rgba(P.heat, .35); ctx.setLineDash([2, 5]); ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.moveTo(rd.x, rd.y); ctx.lineTo(v.x, v.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; } } });
        // effects
        FX = FX.filter(function (f) { return now - f.t < 1600; });
        FX.forEach(function (f) { var age = (now - f.t) / 1000; if (age < 0) return; var o = Math.max(0, 1 - age / 1.6);
          if (f.x2 != null) { var u = Math.min(1, age / .5), x = f.x + (f.x2 - f.x) * u, y = f.y + (f.y2 - f.y) * u, col = f.kind === "assign" || f.kind === "detect" ? P.heat : f.kind === "realloc" ? P.hot : f.kind === "mesh" ? P.bad : P.glow;
            ctx.save(); ctx.globalAlpha = o * (f.kind === "mesh" ? .7 : .5); ctx.strokeStyle = col; ctx.lineWidth = f.kind === "mesh" ? 2 : 1.2; if (f.kind !== "mesh") ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = o; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); ctx.restore(); return; }
          var col2 = f.kind === "heat" ? P.heat : f.kind === "saved" ? P.ok : f.kind === "lost" ? P.bad : P.glow, rr2 = f.kind === "lost" ? 8 + age * 160 : f.kind === "src" ? 6 + age * 70 : 6 + age * 40;
          ctx.globalAlpha = o * .85; ctx.strokeStyle = col2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, rr2, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
        // drones
        drones.forEach(function (d) { if (!ok) return; var p = DP(d), isSel = on && on.type === "drone" && on.i === d.id, pz = d.pulse ? (now - d.pulse) / 900 : 9, bat = read(p + ".battery");
          var led = !d.alive ? P.bad : d.sig < 40 ? P.hot : d.mode === "assist" ? P.heat : d.mode === "home" || d.mode === "charge" ? P.ok : P.drone;
          if (!big) { ctx.fillStyle = led; ctx.beginPath(); ctx.arc(d.x, d.y, d.alive ? 2.6 : 2, 0, 7); ctx.fill(); if (pz >= 0 && pz < 1) { ctx.globalAlpha = 1 - pz; ctx.strokeStyle = P.glow; ctx.beginPath(); ctx.arc(d.x, d.y, 4 + pz * 10, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
            if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, 9, 0, 7); ctx.stroke(); } return; }
          ctx.save(); ctx.translate(d.x, d.y);
          if (!d.alive) { ctx.globalAlpha = .7; ctx.strokeStyle = P.bad; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke(); ctx.fillStyle = rgba(P.ink, .08); ctx.beginPath(); ctx.arc(0, -10 - ((now / 30) % 20), 6, 0, 7); ctx.fill(); ctx.restore(); if (isSel) { ctx.strokeStyle = P.acc; ctx.beginPath(); ctx.arc(d.x, d.y, 15, 0, 7); ctx.stroke(); } return; }
          if (pz >= 0 && pz < 1) { ctx.save(); ctx.shadowColor = P.glow; ctx.shadowBlur = 18 * (1 - pz); ctx.strokeStyle = rgba(P.glow, 1 - pz); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12 + pz * 16, 0, 7); ctx.stroke(); ctx.restore(); }
          if (isSel) { ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          ctx.save(); ctx.rotate(d.ang + Math.PI / 4); var bob = Math.sin(now / 160 + d.id) * .6;
          ctx.strokeStyle = rgba(P.ink, .7); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7); ctx.stroke();
          [[-7, -7], [7, -7], [7, 7], [-7, 7]].forEach(function (q, qi) { ctx.strokeStyle = rgba(P.drone, .55); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], 4.6 + bob * .2, 0, 7); ctx.stroke();
            var ra = now / 30 * (qi % 2 ? 1 : -1); ctx.strokeStyle = rgba(P.ink, .55); ctx.beginPath(); ctx.moveTo(q[0] + Math.cos(ra) * 4, q[1] + Math.sin(ra) * 4); ctx.lineTo(q[0] - Math.cos(ra) * 4, q[1] - Math.sin(ra) * 4); ctx.stroke(); });
          ctx.restore();
          ctx.fillStyle = P.bg; ctx.strokeStyle = rgba(P.ink, .8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, 7); ctx.fill(); ctx.stroke();
          ctx.save(); ctx.shadowColor = led; ctx.shadowBlur = 8; ctx.fillStyle = led; ctx.beginPath(); ctx.arc(Math.cos(d.ang) * 1.5, Math.sin(d.ang) * 1.5, 1.9, 0, 7); ctx.fill(); ctx.restore();
          var f = Math.max(0, Math.min(1, (bat || 0) / 100)), bc = f < .25 ? P.bad : f < .5 ? P.hot : P.ok; ctx.fillStyle = rgba(P.ink, .16); ctx.fillRect(-9, -17, 18, 3); ctx.fillStyle = bc; ctx.fillRect(-9, -17, 18 * f, 3);
          if (isSel || K.N <= 30) txt(isSel ? 10 : 8.5, String(d.id), 0, 22, isSel ? P.acc : P.faint, "center", isSel ? 700 : 500);
          ctx.restore(); });
        if (ok) { var ht = "swarm.reserve = " + read("swarm.reserve"); ctx.font = "600 " + (11 * FS).toFixed(1) + "px " + MONO; var hw = ctx.measureText(ht).width + 24, hot = K.trace && K.trace.path === "swarm.reserve" && now - K.trace.t < 900;
          ctx.fillStyle = rgba(P.acc, hot ? .25 : .12); ctx.fillRect(14, 26, hw, 14 + 14 * FS); ctx.strokeStyle = rgba(P.acc, hot ? .9 : .4); ctx.strokeRect(14.5, 26.5, hw, 14 + 14 * FS); txt(11, ht, 14 + hw / 2, 33 + 10 * FS, P.acc, "center", 600);
          var tr = K.trace; if (tr && now - tr.t < 6500) { ctx.globalAlpha = Math.min(1, (6500 - (now - tr.t)) / 800); txt(11, (tr.label || tr.path) + " → " + tr.recomputed.length + " recomputed", W - 16, 45, P.glow, "right", 700); ctx.globalAlpha = 1; }
          txt(10, K.N + " DRONES · " + KL.toUpperCase() + (audiences.view !== "command" ? " · VIEW AS " + audiences.view.toUpperCase() : ""), W / 2, H - 12, P.muted); }
      }
      function frame(t) { var dt = Math.min(.05, (t - last) / 1000); last = t; if (running.on) step(dt); draw(); frames++; if (t - fpsT > 1000) { K.fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; } raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      function hit(e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, best = null, bd = lite() ? 10 : 20;
        drones.forEach(function (d) { var L = Math.hypot(d.x - x, d.y - y); if (L < bd) { bd = L; best = { type: "drone", i: d.id }; } });
        if (!best) victims.forEach(function (v) { if (v.status === "unknown" || !audiences.can("victims")) return; if (Math.hypot(v.x - x, v.y - y) < 16) best = { type: "victim", k: v.id }; });
        if (!best && x < 220 && y < 60) best = { type: "swarm", p: "swarm.reserve" };
        if (!best) best = { type: "zone", z: zoneOf(x, y) };
        select(best); if (window.innerWidth < 980) setTimeout(function () { var p = document.querySelector("[data-sw=explain-card]"); if (p) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60); }
      c.addEventListener("click", hit); return function () { cancelAnimationFrame(raf); c.removeEventListener("click", hit); };
    }, []);
    return h("div", { className: "sw-fig" }, h("canvas", { ref: cv, width: W, height: H, role: "img", "data-sw": "map", "aria-label": "Disaster zone: rubble and streets under fog, drones with sensor cones revealing it, heat signatures of victims pulsing, mesh links to the base" }));
  }

  // ── controls and cards ──
  var V = function (x) { return x === undefined ? "–" : x === null ? "null" : typeof x === "object" ? JSON.stringify(x) : String(x); };
  function Toolbar() {
    var k = useKernel(), cur = useSel(), rs = useState(running.on), run = rs[0], setRun = rs[1], ok = k.status === "ok";
    var alive = drones.filter(function (d) { return d.alive; }), target = cur && cur.type === "drone" && drones[cur.i - 1] && drones[cur.i - 1].alive ? cur.i : (alive[(k.seq * 5) % Math.max(1, alive.length)] || {}).id;
    var B = function (id, label, fn, title, dis) { return h("button", { type: "button", className: "sw-btn", "data-sw": id, disabled: !ok || dis, title: title, onClick: fn }, label); };
    return h("div", { className: "sw-bar", "data-sw": "toolbar" },
      B("drop", "Lose drone " + (target || "–"), function () { actions.drop(target); }, "Writes drones." + target + ".signal = 0 and .battery = 0; the mesh re-computes everyone's signal", !target),
      B("ping", "Heat ping", function () { actions.ping(); }, "A hidden victim is seen by the nearest drone: writes victims[k].found / status, drones[i].sees, zones[z].victims"),
      B("reserve", "Reserve " + (ok && read("swarm.reserve") === 25 ? "25 → 60" : "60 → 25"), function () { actions.reserve(); }, "Writes swarm.reserve; every drones[i].canAssist reads it"),
      B("revive", "Relaunch lost", function () { actions.revive(); }, "Lost drones fly again", !drones.some(function (d) { return !d.alive; })),
      h("span", { className: "sw-sep" }),
      h("span", { className: "sw-seg", role: "group", "aria-label": "Swarm size" }, [12, 30, 300].map(function (n) { return h("button", { key: n, type: "button", className: "sw-btn" + (k.N === n ? " on" : ""), "data-sw": "scale-" + n, disabled: !ok, "aria-pressed": k.N === n ? "true" : "false", onClick: function () { rescale(n); } }, n); })),
      h("button", { type: "button", className: "sw-btn" + (run ? "" : " on"), "data-sw": "pause", onClick: function () { running.on = !running.on; setRun(running.on); } }, run ? "Pause" : "Resume"));
  }
  function Swarm() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", alive = 0, relay = 0, assist = 0;
    var ag = !lite(); if (ok) drones.forEach(function (d) { if (d.alive) alive++; if (!ag && read(DP(d) + ".needsRelay") === true) relay++; if (!ag && read(DP(d) + ".canAssist") === true) assist++; });
    if (ok && ag) { assist = read("swarm.assisting"); relay = read("swarm.relays"); }
    var kpi = function (id, label, val, p) { var on = cur && cur.type === "swarm" && cur.p === p; return h("button", { type: "button", key: id, className: "sw-kpi", "data-sw": "kpi-" + id, "aria-pressed": on ? "true" : "false", disabled: !p, onClick: p ? function () { select({ type: "swarm", p: p }); } : undefined, title: p ? "me.explain(\"" + p + "\")" : "tallied by the page" }, h("small", null, label), h("b", null, ok ? V(val) : "–")); };
    return h("section", { className: "sw-card", "data-sw": "swarm" }, h("div", { className: "sw-h" }, "Swarm · " + k.N + " drones · " + KL),
      h("div", { className: "sw-kpis" }, kpi("alive", "flying", alive + "/" + k.N, null), kpi("assist", ag ? "swarm.assisting" : "canAssist = true", assist, ag ? "swarm.assisting" : null), kpi("relay", ag ? "swarm.relays" : "needsRelay = true", relay, ag ? "swarm.relays" : null),
        kpi("coverage", "swarm.coverage %", ok ? Math.round(read("swarm.coverage") * 10) / 10 : 0, "swarm.coverage"), kpi("found", "swarm.found", read("swarm.found"), "swarm.found"), kpi("assisted", "swarm.assisted", read("swarm.assisted"), "swarm.assisted")),
      h("div", { className: "sw-row", style: { marginTop: 6 } }, h("span", null, "writes · writes/s · fps"), h("span", { className: "sw-num", "data-sw": "rate" }, ok ? k.writes + " · " + Math.round(k.writes / Math.max(1, (performance.now() - k.t0) / 1000)) + " · " + (k.fps || "–") : "–")),
      h("div", { className: "sw-row" }, h("span", null, "recomputed (traced) · seed"), h("span", { className: "sw-num" }, ok ? k.recomputes + " · " + (k.seedMs || 0).toFixed(1) + " ms" : "–")),
      lite() ? h("div", { className: "sw-note" }, "At " + k.N + " drones the map writes less often, links each drone to its mesh parent only and traces your actions, not every scan. The swarm counts (drones[].canAssist, drones[].needsRelay) are off: each drone write would re-scan all " + k.N + " drones, so the page tallies them.") : null);
  }
  function Trace() {
    var k = useKernel(), tr = k.trace;
    return h("section", { className: "sw-card", "data-sw": "trace" }, h("div", { className: "sw-h" }, tr && tr.drone ? "What depended on drone " + tr.drone : "Last propagation · meta.recomputed"),
      !tr ? h("div", { className: "sw-note" }, "Lose a drone, ping a heat signature or change the reserve: only the dependents recompute, listed from ", me("me.explain(path).meta.recomputed"), ".")
        : h(React.Fragment, null,
          h("div", { className: "sw-row" }, h("span", null, tr.label || "write"), h("span", { className: "sw-num" }, me(tr.path + " = " + V(tr.value)))),
          h("div", { className: "sw-row" }, h("span", null, "recomputed · changed"), h("span", { className: "sw-num", "data-sw": "recomputed-count" }, tr.recomputed.length + " · " + tr.changed.length)),
          tr.drone ? h(React.Fragment, null,
            h("div", { className: "sw-row" }, h("span", null, "its own rules"), h("span", { className: "sw-num" }, String(tr.direct.length))),
            h("div", { className: "sw-row" }, h("span", null, "victims it was rescuing"), h("span", { className: "sw-num", "data-sw": "drop-victims" }, tr.victims.length ? tr.victims.map(function (x) { return "victims." + x; }).join(", ") : "none")),
            h("div", { className: "sw-row" }, h("span", null, "mesh signal re-written"), h("span", { className: "sw-num", "data-sw": "drop-mesh" }, tr.mesh.length + " drones")),
            h("div", { className: "sw-row" }, h("span", null, "victims re-allocated"), h("span", { className: "sw-num" }, String(tr.realloc || 0)))) : null,
          h("div", { className: "sw-chips", "data-sw": "recomputed" }, tr.recomputed.slice(0, 90).map(function (p, i) { return h("span", { key: i, className: "sw-chip" + (tr.changed.indexOf(p) >= 0 ? " ch" : "") }, p); }).concat(tr.recomputed.length > 90 ? [h("span", { key: "m", className: "sw-chip" }, "+" + (tr.recomputed.length - 90))] : [])),
          h("div", { className: "sw-note" }, "Highlighted: the value changed. Ripples on the map are drawn from this list; the red wave runs along the mesh. ", link(L_OK, "O(k)"))));
  }
  function Explain() {
    var k = useKernel(), cur = useSel(), ok = k.status === "ok", ts = useState(null), tab = ts[0], setTab = ts[1];
    useEffect(function () { setTab(cur && cur.tab || null); }, [cur && (cur.type + (cur.i || cur.k || cur.z || cur.p))]);
    var d = null;
    if (ok && cur) {
      if (cur.type === "drone" && cur.i <= k.N) { var p = "drones." + cur.i, dr = drones[cur.i - 1], mine = victims.filter(function (v) { return v.rescuer === cur.i && v.status === "assigned"; });
        d = { title: "Drone " + cur.i + " · " + (dr.alive ? dr.mode : "lost"), rows: ["battery", "signal", "zone", "sees", "speed", "dist", "pos", "task"].map(function (f) { return [p + "." + f, read(p + "." + f)]; }),
          tabs: [p + ".canAssist", p + ".needsRelay", p + ".eta", p + ".range"].concat(mine.map(function (v) { return VP(v) + ".reachable"; })) }; }
      else if (cur.type === "victim") { var q = "victims." + cur.k;
        d = { title: "Victim " + cur.k, rows: ["heat", "zone", "status", "found", "x", "y"].map(function (f) { return [q + "." + f, read(q + "." + f)]; }).concat([[q + ".rescuer", read(q + ".rescuer")], [q + ".by", read(q + ".by")]]), tabs: [q + ".reachable", q + ".eta", q + ".urgent"] }; }
      else if (cur.type === "zone") { var zp = "zones." + cur.z; d = { title: "Zone " + cur.z, rows: ["cells", "scanned", "victims"].map(function (f) { return [zp + "." + f, read(zp + "." + f)]; }), tabs: [zp + ".coverage", zp + ".priority"] }; }
      else if (cur.type === "swarm") d = { title: cur.p, rows: [[cur.p, read(cur.p)]], tabs: [cur.p] };
    }
    var path = d ? (tab && d.tabs.indexOf(tab) >= 0 ? tab : d.tabs[0]) : null, ex = path ? K.me.explain(path) : null;
    return h("section", { className: "sw-card", "data-sw": "explain-card", style: { gridColumn: "1 / -1" } }, h("div", { className: "sw-h" }, d ? d.title : "Explain"),
      !d ? h("div", { className: "sw-note" }, "Click a drone, a heat signature, a zone or a number for its paths and ", me("me.explain(path)"), " exactly as the kernel returns it (", link(L_EXP, "Explain"), ").") :
      h(React.Fragment, null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", columnGap: 14 } }, d.rows.map(function (r) { return h("div", { key: r[0], className: "sw-row" }, h("span", { className: "sw-num me-code", style: { color: "inherit" } }, synJ(r[0].split(".").slice(-1)[0])), h("span", { className: "sw-num" }, V(r[1]))); })),
        h("div", { className: "sw-tabs", role: "tablist" }, d.tabs.map(function (t) { return h("button", { key: t, type: "button", role: "tab", className: "sw-tab" + (t === path ? " on" : ""), "aria-selected": t === path ? "true" : "false", onClick: function () { setTab(t); } }, t.split(".").slice(t.indexOf("victims") === 0 && cur.type === "drone" ? 0 : 1).join(".")); })),
        h("div", { className: "sw-note" }, me('me.explain("' + path + '")'), " · " + KL + " · live"),
        h("pre", { className: "sw-json me-code", "data-sw": "explain" }, synJ(fmtJ(ex)))));
  }
  function Audiences() {
    var k = useKernel(), cur = useSel(), as = useState(0), A = audiences; useEffect(function () { var f = as[1]; A.subs.push(f); return function () { A.subs = A.subs.filter(function (g) { return g !== f; }); }; }, []);
    if (cur && cur.type === "drone" && cur.i <= Math.min(k.N, 30)) A.viewDrone = cur.i;
    var ok = k.status === "ok", vr = A.results.victims, zs = []; for (var z = 1; z <= NZ; z++) zs.push(z);
    var firstErr = null; Object.keys(A.results).forEach(function (key) { if (!firstErr && !A.results[key].ok) firstErr = [key, A.results[key]]; });
    return h("section", { className: "sw-card", "data-sw": "audiences" }, h("div", { className: "sw-h" }, "Audiences · ME.wrapSecretV1 (OR)"),
      h("div", { className: "sw-bar", style: { marginTop: 0 } }, h("span", { className: "sw-seg", role: "group", "aria-label": "View as" }, A.parties().map(function (p) { return h("button", { key: p, type: "button", className: "sw-btn" + (A.view === p ? " on" : ""), "data-sw": "as-" + p.replace(" ", "-"), disabled: !ok || !A.wraps, onClick: function () { A.open(p); } }, p); })),
        h("button", { type: "button", className: "sw-btn", "data-sw": "reseal", disabled: !ok || A.busy, onClick: function () { A.seal(); } }, A.busy ? "Sealing…" : "Re-seal")),
      h("div", { className: "sw-aud", "data-sw": "aud-results" },
        h("span", null, "victims", h("br"), h("small", { style: { color: TX2 } }, "rescuers OR command")),
        h("span", null, !vr ? "…" : vr.ok ? h(React.Fragment, null, h("span", { className: "ok" }, "opened (wrap for " + vr.kid + ") "), h("code", null, vr.text.length > 110 ? vr.text.slice(0, 110) + " …" : vr.text)) : h(React.Fragment, null, h("span", { className: "no" }, "wrap for " + vr.kid + " → "), h("code", null, vr.err))),
        h("span", null, "zones", h("br"), h("small", { style: { color: TX2 } }, "its drones OR command")),
        h("span", { style: { display: "flex", flexWrap: "wrap", gap: 3 } }, zs.map(function (z) { var r = A.results["zone " + z]; return h("span", { key: z, className: "sw-chip" + (r && r.ok ? " ch" : ""), title: r ? (r.ok ? r.text : r.err) : "" }, "Z" + z + (r ? (r.ok ? " ✓" : " ✕") : "")); }))),
      firstErr ? h("div", { className: "sw-note" }, h("code", null, "unwrapSecretV1(" + firstErr[0] + " wrap for " + firstErr[1].kid + ", " + A.view + "'s key)"), " → ", h("span", { style: { color: "var(--mui-palette-error-main,#e5534b)" } }, firstErr[1].err)) : null,
      h("div", { className: "sw-note" }, A.wraps ? A.count + " wraps sealed " + new Date(A.sealedAt).toLocaleTimeString() + " in " + A.ms.toFixed(0) + " ms. " : "", "Each drone party opens only the zone it was in at sealing; sealed zones are hatched on the map. Click a drone to view as it. ", link(L_AUD, "Audiences")));
  }
  function KernelCard() { var st = MK.state; useKernel();
    return h("section", { className: "sw-card", style: { gridColumn: "1 / -1" } }, h("details", { className: "sw-k", "data-sw": "kernel" },
      h("summary", null, "Kernel · ", link(MK.KERNEL.npm, KL), " · ", st.state === "ok" ? h("span", { className: "ok" }, "sha256 verified") : st.state === "error" ? h("span", { className: "bad" }, "failed: " + st.text) : "loading…"),
      st.state === "ok" ? [h("div", { key: "h" }, "sha256 " + st.hash), h("div", { key: "u" }, "from ", link(st.url, st.url.replace("https://", ""))), h("div", { key: "s" }, "page source: ", link(SRC_URL, "swarm.js"))] : null)); }
  function Right() { return h("div", { className: "sw-right" }, h(Floor), h(Toolbar),
    h("p", { className: "sw-cap" }, "Cones clear the fog; heat rings are victims (red: ", me("urgent"), "); blue lines are the mesh to the base. Glow and ripples are the paths the kernel recomputed. Click a drone, a victim or a zone."),
    h("div", { className: "sw-panel" }, h(Explain), h(Trace), h(Swarm), h(Audiences), h(KernelCard))); }

  // ── left: the narrated steps (Run on a shared new ME() via me-run.js; map buttons act on the live swarm) ──
  var STEPS = [
    { t: "Each drone is a path", map: [["Show drone 1", function () { select({ type: "drone", i: 1 }); }]],
      body: function () { return ["A drone is a branch of one tree: ", me("drones[1].battery"), ", ", me(".signal"), ", ", me(".zone"), ", ", me(".sees"), ", ", me(".pos"), ". Zones and victims are collections too. ", link(L_PATHS, "Paths")]; },
      code: 'me.drones[1].battery(84)\nme.drones[1].signal(90)\nme.drones[1].sees(0)\nme.drones[1].speed(11)\nme.drones[1].dist(120)\nme("drones[1].signal")' },
    { t: "Rules for the whole swarm", map: [["Reserve 25 ↔ 60", function () { actions.reserve(); }]],
      body: function () { return ["Declared once under ", me('["[i]"]'), ", for every drone now and later. All of them read ", me("swarm.reserve"), ", so changing it recomputes every ", me("canAssist"), " and nothing else. ", link(L_OPS, "Operators")]; },
      code: 'me.swarm.reserve(25)\nme.drones["[i]"]["="]("needsRelay", "signal < 40")\nme.drones["[i]"]["="]("canAssist", "battery > swarm.reserve && signal >= 40 && !sees")\nme.drones["[i]"]["="]("eta", "dist / speed")\nme("drones[1].canAssist")\nme("drones[1].eta")' },
    { t: "Count the swarm", map: [["Show swarm.assisting", function () { select({ type: "swarm", p: "swarm.assisting" }); }], ["swarm.coverage", function () { select({ type: "swarm", p: "swarm.coverage" }); }]],
      body: function () { return [me("drones[].canAssist"), " sums a boolean field: each ", me("true"), " counts as 1, so it is how many drones can assist. ", me("zones[].coverage / zones[]"), " is the mean coverage. The explain lists each as an input with ", me('kind: "aggregate"'), ". Each drone write re-scans the collection, so the swarm counts are declared up to 60 drones. ", link(DOCS + "Aggregates.html", "Aggregates")]; },
      code: 'me.drones[2].battery(20)\nme.drones[2].signal(30)\nme.drones[2].sees(0)\nme.swarm["="]("assisting", "drones[].canAssist")\nme.swarm["="]("relays", "drones[].needsRelay")\nme("swarm.assisting")\nme("swarm.relays")\nme.explain("swarm.assisting").derivation.inputs[0].aggregate' },
    { t: "Zones count their coverage", map: [["Show zone 6", function () { select({ type: "zone", z: 6 }); }]],
      body: function () { return ["Every cell a sensor cone clears adds to ", me("zones[z].scanned"), "; ", me("coverage"), " and ", me("priority"), " follow. Only the zone that was scanned recomputes."]; },
      code: 'me.zones["[i]"]["="]("coverage", "scanned / cells * 100")\nme.zones["[i]"]["="]("priority", "victims * 10 + (100 - coverage)")\nme.zones[6].cells(180)\nme.zones[6].victims(0)\nme.zones[6].scanned(63)\nme("zones[6].coverage")\nme("zones[6].priority")' },
    { t: "A heat signature", map: [["Heat ping", function () { actions.ping(); }]],
      body: function () { return ["A detection writes the victim, ", me("drones[i].sees"), " and ", me("zones[z].victims"), ". The swarm then points the nearest drone that canAssist at it: ", me('victims[k].rescuer["->"]("drones.i")'), ". ", link(L_PTR, "Pointers")]; },
      code: 'me.victims[1].heat(35.2)\nme.victims[1].rescuer["->"]("drones.1")\nme.victims["[i]"]["="]("reachable", "rescuer.canAssist")\nme.victims["[i]"]["="]("eta", "rescuer.eta")\nme.victims["[i]"]["="]("urgent", "heat < 35.5")\nme("victims[1].reachable")\nme("victims[1].urgent")' },
    { t: "A drone goes down", map: [["Lose a drone", function () { var a = drones.filter(function (d) { return d.alive && d.mode === "assist"; })[0] || drones.filter(function (d) { return d.alive; })[0]; if (a) actions.drop(a.id); }]],
      body: function () { return ["Its signal goes to 0: its own rules recompute, and so does ", me("reachable"), " of the victim it was flying to, through the pointer. The mesh re-writes the signal of the drones that relayed through it. The panel lists what depended on it; the swarm re-allocates. ", link(L_EXP, "Explain")]; },
      code: 'me.drones[1].signal(0)\nme("victims[1].reachable")\nme.explain("victims[1].reachable").meta.recomputed' },
    { t: "30 or 300 drones", map: [["30", function () { rescale(30); }], ["300", function () { rescale(300); }], ["12", function () { rescale(12); }]],
      body: function () { return ["Same rules. Drone 300 gets ", me("canAssist"), " as soon as it has a battery and a signal; a write still recomputes only its own dependents. ", link(DOCS + "Extreme-Fan-Out.html", "Extreme Fan-Out")]; },
      code: 'me.drones[300].battery(70)\nme.drones[300].signal(55)\nme.drones[300].sees(0)\nme("drones[300].canAssist")\nme("drones[300].needsRelay")' },
    { t: "Who sees what", map: [["View as rescuers", function () { audiences.open("rescuers"); }], ["drone", function () { audiences.open("drone " + audiences.viewDrone); }], ["command", function () { audiences.open("command"); }]],
      body: function () { return ["Victims are sealed for rescuers OR command; each zone for the drones in it OR command: one ", me("ME.wrapSecretV1"), " per member. Other parties get the kernel's error and the map hatches what they can't open. ", link(L_AUD, "Audiences")]; },
      static: 'const W = await ME.wrapSecretV1({ secret: zone6, recipientPublicKey: drone3.publicKey, kid: "drone 3", class: "identity-key" })\nawait ME.unwrapSecretV1(W, drone3.privateKey, "utf8")   // zone 6 JSON\nawait ME.unwrapSecretV1(W, drone7.privateKey, "utf8")   // throws OperationError' }];
  function Side() {
    var ss = useState(-1), on = ss[0], setOn = ss[1], k = useKernel(), Run = window.MeRun && window.MeRun.MeRunBlock, idx = 0;
    var toMap = function () { if (window.innerWidth >= 980) return; var f = document.querySelector(".sw-fig"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" }); };
    return h("aside", { className: "sw-side", "data-sw": "steps", "aria-label": "How it works, step by step" }, h("h2", null, "How it works"),
      STEPS.map(function (s, i) { var ri = s.code ? idx++ : -1;
        return h("section", { key: i, className: "sw-step" + (on === i ? " on" : ""), "data-sw": "step-" + (i + 1) },
          h("h3", null, h("b", null, i + 1), s.t), h("p", null, s.body()),
          s.code && Run ? h(Run, { idx: ri, code: s.code, compact: true }) : s.static ? h("pre", { className: "me-code sw-json", style: { maxHeight: "none", whiteSpace: "pre-wrap", margin: "0 0 10px" } }, h("code", null, synJ(s.static))) : null,
          h("div", { className: "sw-bar" }, h("span", { style: { fontSize: 11.5, color: TX2 } }, "On the map:"), s.map.map(function (m, j) { return h("button", { key: j, type: "button", className: "sw-btn", disabled: k.status !== "ok", "data-sw": "map-" + (i + 1) + "-" + (j + 1), onClick: function () { setOn(i); m[1](); toMap(); } }, m[0]); }))); }),
      h("p", { className: "sw-cap" }, "Run executes the blocks in page order on one shared ", me("new ME()"), " from " + KL + " (", link("https://neurons-me.github.io/.me/assets/me-run/me-run.js", "me-run.js"), "); the map runs its own instance. Source: ", link(SRC_URL, "swarm.js"), "."));
  }
  var RELATED = [
    ["https://neurons-me.github.io/.me/Demos/Robots/Warehouse/", "https://neurons-me.github.io/.me/Demos/Robots/Warehouse/assets/warehouse-og.png", "Warehouse Fleet", "Robots fulfil orders; drain a battery or block an aisle and only the dependents recompute."],
    ["https://neurons-me.github.io/robots/", "https://neurons-me.github.io/robots/assets/ROBOTS-CONTEXT-LAB.jpg", "Robots", "All the robot demos on .me."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Space/", "https://neurons-me.github.io/.me/Demos/Robots/Space/assets/space-robots-og-4.2.png", "Autonomous Robotics in Space", "Three spider robots on two small rocks, each with its own .me kernel."],
    ["https://neurons-me.github.io/.me/Demos/SmartCities/AntCity/", "https://neurons-me.github.io/.me/Demos/SmartCities/AntCity/assets/ant-city-card.webp", "Ant City", "Scouts, trails and recruitment waves on the same kernel."]];
  function Related() {
    return h("section", { className: "sw-rel", "data-sw": "related" }, h("h2", null, "Related"),
      h("div", { className: "sw-cards" }, RELATED.map(function (c) { return h("a", { key: c[0], className: "sw-card2", href: c[0] },
        h("span", { className: "img" }, h("img", { src: c[1], alt: "", loading: "lazy" })), h("span", { className: "tx" }, h("b", null, c[2]), h("small", null, c[3]))); })));
  }
  function Dashboard() { return h("div", { className: "sw-dash" }, h(Side), h(Right)); }
  var LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=1"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  var PATH = [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
    { text: "Robots", href: "https://neurons-me.github.io/robots/", title: "Robots" }, { text: "Swarm", href: null, title: "This page" }];
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
  // ── intro: "only what reads it recomputes" drops a real drone and lists the kernel's meta.recomputed inline ──
  function derivedCount() { var c = [], i; for (i = 1; i <= drones.length; i++) ["needsRelay", "canAssist", "eta", "range"].forEach(function (f) { c.push("drones." + i + "." + f); });
    for (i = 1; i <= NZ; i++) ["coverage", "priority"].forEach(function (f) { c.push("zones." + i + "." + f); });
    for (i = 1; i <= victims.length; i++) ["reachable", "eta", "urgent"].forEach(function (f) { c.push("victims." + i + "." + f); });
    ["swarm.coverage", "swarm.assisting", "swarm.relays"].forEach(function (p) { c.push(p); });
    return c.filter(function (p) { var e = K.me.explain(p); return e && e.derivation && e.derivation.expression; }).length; }
  function pickDrone() { var v = victims.filter(function (v) { return v.rescuer && v.status !== "assisted" && drones[v.rescuer - 1] && drones[v.rescuer - 1].alive; })[0];
    if (v) return drones[v.rescuer - 1]; return drones.filter(function (d) { return d.alive; })[0] || null; }
  function Reads() {
    var k = useKernel(), rs = useState(null), res = rs[0], setRes = rs[1], os = useState(false), open = os[0], setOpen = os[1], ok = k.status === "ok";
    var hover = function () { if (!ok) return; var d = pickDrone(); if (d) { d.pulse = performance.now(); select({ type: "drone", i: d.id }); } };
    var go = function () { if (!ok) return; var d = pickDrone(); if (!d) return; var all = actions.drop(d.id); if (!all) return; setRes({ id: d.id, rec: all.recomputed.slice(), victims: all.victims.slice(), total: derivedCount() }); setOpen(false); };
    var n = res ? res.rec.length : 0, shown = res ? (open ? res.rec : res.rec.slice(0, 8)) : [];
    return h(React.Fragment, null,
      h("button", { type: "button", className: "sw-reads", "data-sw": "reads", disabled: !ok, onMouseEnter: hover, onFocus: hover, onClick: go, title: "Drops a drone through the kernel and lists me.explain(…).meta.recomputed" }, "only what reads it recomputes"), ".",
      res ? h("span", { className: "sw-reads-out", "data-sw": "reads-out" },
        h("span", { className: "sw-reads-h" }, "drone " + res.id + " down · ", h("b", null, n + " of " + res.total), " derived paths recomputed" + (res.victims.length ? " · victims " + res.victims.join(", ") : "")),
        shown.map(function (p, x) { return h("span", { key: x, className: "sw-reads-chip" }, me(p)); }),
        n > 8 ? h("button", { type: "button", className: "sw-reads-more", "data-sw": "reads-more", onClick: function () { setOpen(!open); } }, open ? "less" : "+" + (n - 8) + " more") : null) : null);
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
    N("SWTopBar", "topbar"),
    N("Box", "main", { component: "main", sx: { maxWidth: 1440, mx: "auto", px: { xs: 1.5, sm: 3 }, pt: { xs: 2.5, sm: 3.5 }, pb: 8 } }, [
      N("Typography", "kicker", { component: "p", sx: { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1 } }, ["Robots · " + KL]),
      N("Typography", "title", { component: "h1", sx: { fontSize: "clamp(1.9rem, 5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1 } }, ["Rescue Swarm"]),
      N("Typography", "lede", { component: "p", sx: { color: "text.secondary", mb: 3, maxWidth: 760 } }, ["Each drone is ", me("drones[i]"), " with ", me("drones[i].battery"), " and ", me(".signal"), "; one rule, ", me('drones["[i]"]["="]("canAssist", "battery > swarm.reserve && signal >= 40 && !sees")'), ", and one aggregate, ", me('swarm["="]("coverage", "zones[].coverage / zones[]")'), ". A drone goes down and ", h(Reads)]),
      N("SWDashboard", "swarm"),
      N("SWRelated", "related"),
    ]),
  ]);
  var scope = window.__thisGuiThemeScope || {};
  var mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; } catch (e) {}
  var PageTheme = function (p) { return h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, p.children); };
  if (G.getInspectorEnabled()) G.setInspectorEnabled(false);
  var pageType = function (Comp) { return { type: "x", resolve: function (s) { var p = Object.assign({}, s.props || {}); delete p.key; return h(Comp, p); } }; };
  var reg = Object.assign({}, G.Registry || G.registry); [["SWTopBar", TopBar], ["SWDashboard", Dashboard], ["SWRelated", Related]].forEach(function (x) { reg[x[0]] = pageType(x[1]); reg[x[0]].type = x[0]; });
  G.mount(spec, ROOT, { me: window.SwarmKernel, gui: Object.assign({}, G, { render: undefined, RunMe: undefined, Theme: PageTheme, registry: reg }), devtools: { enabled: true, inspector: false, adminView: false, inspectorToggleVisible: false } });
  document.documentElement.classList.add("gui-on");
  window.__sw = { K: K, drones: function () { return drones; }, victims: function () { return victims; }, select: select, actions: actions, audiences: audiences, rescale: rescale };
})();
