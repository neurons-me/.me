/*! Ant City 0.1.0 · an anthill held in a this.me 4.2.1 kernel · MIT · neurons.me
 * The kernel (this.me 4.2.1 from npm, sha256 checked in the browser by /.me/assets/me-kernel/me-kernel.js) holds the
 * colony: chambers (depth, stock, capacity), tunnels (from/to), ants (at, carry, home -> chamber). The canvas only
 * animates the walk between chambers; every arrival is a write to the kernel, and every number on the page is read back
 * from it with me(path). colony.food and colony.carried are ["="] derived values; click a chamber, an ant or a number
 * for me.explain(path).
 */
(function () {
  var G = window.GUI, React = window.React, ROOT = document.getElementById("root"), MK = window.MeKernel;
  if (!G || !React || !window.ReactDOM || typeof G.mount !== "function" || !ROOT || !MK) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", KV = MK.KERNEL.version, KL = "this.me " + KV;
  var params = new URLSearchParams(location.search);
  var SRC_URL = "https://github.com/neurons-me/.me/blob/main/Demos/SmartCities/AntCity/ant-city.js";

  // ── the world: a surface map with three trees and an anthill under it (page layout); the state lives in the kernel ──
  var W = 1200, H = 780, GROUND = 250;
  var CH = {   // chambers (underground nodes)
    entrance: { x: 640, y: 300, r: 20, label: "Entrance", depth: 2 },
    upper:    { x: 640, y: 395, r: 30, label: "Upper hall", depth: 6 },
    pantry:   { x: 390, y: 420, r: 42, label: "Pantry", depth: 8, capacity: 60, stock: 24 },
    granary:  { x: 905, y: 430, r: 38, label: "Granary", depth: 9, capacity: 40, stock: 14 },
    fungus:   { x: 590, y: 545, r: 34, label: "Fungus garden", depth: 12 },
    cellar:   { x: 190, y: 560, r: 34, label: "Cellar", depth: 13, capacity: 50, stock: 10 },
    barracks: { x: 1060, y: 580, r: 30, label: "Barracks", depth: 13 },
    nursery:  { x: 400, y: 680, r: 42, label: "Nursery", depth: 17 },
    queen:    { x: 790, y: 690, r: 44, label: "Queen", depth: 18 },
    midden:   { x: 150, y: 715, r: 24, label: "Midden", depth: 18 },
  };
  var SN = {   // surface nodes: the mouth, waypoints, and three trees (only tree 1 is known at the start)
    mouth: { x: 640, y: GROUND - 4 }, a: { x: 505, y: 205 }, b: { x: 370, y: 190 }, c: { x: 245, y: 150 }, d: { x: 125, y: 105 },
    e: { x: 780, y: 205 }, f: { x: 925, y: 170 }, g: { x: 1060, y: 125 }, h: { x: 640, y: 140 }, i: { x: 470, y: 90 }, j: { x: 810, y: 85 },
    tree1: { x: 395, y: 120, tree: 1, seeds: 60 }, tree2: { x: 62, y: 52, tree: 2, seeds: 160 }, tree3: { x: 1145, y: 58, tree: 3, seeds: 200 },
  };
  var NODES = {}; Object.keys(CH).forEach(function (k) { NODES[k] = CH[k]; }); Object.keys(SN).forEach(function (k) { NODES[k] = SN[k]; });
  var NAMES = Object.keys(CH), TREES = [1, 2, 3], treeNode = function (n) { return "tree" + n; };
  var EDGES = [   // [from, to, royal]: royal = on the queen's custom routes (her influence biases them)
    ["mouth", "entrance"], ["entrance", "upper"], ["upper", "pantry"], ["upper", "granary"], ["upper", "fungus"], ["pantry", "cellar"], ["pantry", "fungus"],
    ["pantry", "nursery", 1], ["fungus", "nursery", 1], ["fungus", "queen", 1], ["nursery", "queen", 1], ["granary", "barracks"], ["granary", "queen"], ["barracks", "queen"],
    ["cellar", "midden"], ["cellar", "nursery"],
    ["mouth", "a"], ["mouth", "e"], ["mouth", "h"], ["a", "b"], ["b", "c"], ["c", "d"], ["a", "i"], ["i", "h"], ["h", "j"], ["e", "f"], ["f", "g"], ["j", "f"],
    ["b", "tree1"], ["h", "tree1"], ["i", "tree1"], ["d", "tree2"], ["c", "tree2"], ["g", "tree3"], ["j", "tree3"]];
  EDGES.forEach(function (e, i) { e.id = i + 1; e.len = Math.round(Math.hypot(NODES[e[0]].x - NODES[e[1]].x, NODES[e[0]].y - NODES[e[1]].y)); e.surf = !CH[e[0]] || !CH[e[1]]; });
  var adj = {}; Object.keys(NODES).forEach(function (n) { adj[n] = []; }); EDGES.forEach(function (e) { adj[e[0]].push({ n: e[1], e: e }); adj[e[1]].push({ n: e[0], e: e }); });
  var ANTS = 24, ROLE = function (i) { return i <= 17 ? "worker" : i <= 20 ? "nurse" : "scout"; }, STORES = ["pantry", "granary", "cellar"];

  // ── the kernel side: one ME per page ──
  var K = { me: null, writes: 0, last: null, lastMs: 0, subs: [], status: "loading", ver: 0, wave: 0, t0: performance.now() };
  function emit() { K.ver++; K.subs.forEach(function (f) { f(K.ver); }); }
  function write(path, v) { var t = performance.now(), segs = path.split("."), p = K.me; segs.forEach(function (s) { p = p[s]; }); p(v);
    K.writes++; K.lastMs = performance.now() - t; K.last = { path: path, value: v }; }
  function read(path) { return K.me(path); }
  function add(path, d) { var v = read(path) || 0; write(path, Math.round((v + d) * 1000) / 1000); return v + d; }
  var TP = function (e) { return "colony.trails." + e.id; };
  function seed(me) {
    var C = me.colony; C.name("Ant City");
    C.queen.name("Queen"); C.queen.influence(10); C.queen.eggsLaid(0); C.queen.home["->"]("colony.chambers.queen");
    NAMES.forEach(function (n) { var c = CH[n], s = C.chambers[n]; s.depth(c.depth); if (c.capacity) { s.capacity(c.capacity); s.stock(c.stock); s["="]("free", "capacity - stock"); } });
    var nu = C.chambers.nursery; nu.eggs(4); nu.larvae(3); nu.fed(0); nu.born(0); nu["="]("brood", "eggs + larvae");
    C["="]("broodNeed", "chambers.nursery.larvae * queen.influence");   // the queen's need: how strongly deliveries lean toward the nursery side
    EDGES.forEach(function (e) { var t = C.trails[e.id]; t.from(e[0]); t.to(e[1]); t.length(e.len); t.weight(0);
      if (e[2]) t["="]("bias", "colony.queen.influence * 0.6"); else t.bias(0);   // royal routes: the queen's influence is a standing bias
      t["="]("strength", "weight + bias"); t["="]("cost", "length / (1 + strength)"); });
    TREES.forEach(function (n) { var s = SN[treeNode(n)], t = C.trees[n]; t.seeds(s.seeds); t.known(n === 1 ? 1 : 0); t.foundBy(0); t.x(s.x); t.y(s.y); });
    for (var i = 1; i <= ANTS; i++) { var a = C.ants[i], r = ROLE(i); a.role(r); a.isWorker(r === "worker" ? 1 : 0); a.isNurse(r === "nurse" ? 1 : 0); a.isScout(r === "scout" ? 1 : 0);
      a.carry(0); a.at("upper"); a.recruited(0); a.recruitedTo(0); a.hop(0); a.home["->"]("colony.chambers." + (r === "nurse" ? "nursery" : i % 3 === 0 ? "queen" : "barracks")); if (r === "scout") a.found(0); }
    var sum = function (f) { var s = []; for (var j = 1; j <= ANTS; j++) s.push("ants[" + j + "]." + f); return s.join(" + "); };
    C["="]("workers", sum("isWorker")); C["="]("nurses", sum("isNurse")); C["="]("scouts", sum("isScout")); C["="]("carried", sum("carry")); C["="]("recruited", sum("recruited"));
    C["="]("food", "chambers.pantry.stock + chambers.granary.stock + chambers.cellar.stock");
    C["="]("treesKnown", "trees[1].known + trees[2].known + trees[3].known");
    // readable group paths: colony.ants.workers / .nurses / .scouts / .recruited and colony.trees.known, each a ["="] sum of the per-member flags
    var abs = function (f) { var s = []; for (var j = 1; j <= ANTS; j++) s.push("colony.ants[" + j + "]." + f); return s.join(" + "); };
    C.ants["="]("workers", abs("isWorker")); C.ants["="]("nurses", abs("isNurse")); C.ants["="]("scouts", abs("isScout")); C.ants["="]("recruited", abs("recruited"));
    C.trees["="]("known", "colony.trees[1].known + colony.trees[2].known + colony.trees[3].known");
    C.recruit.tree(0); C.recruit.wave(0);
    K.me = me; declareRoute(1, route("mouth", "tree1", true));
  }
  // a tree's attractiveness, declared when its route is known: seeds × trail strength along the route / route length
  function declareRoute(n, pts) {
    var ids = [], len = 0; for (var k = 0; k < pts.length - 1; k++) { var e = edgeOf(pts[k], pts[k + 1]); ids.push(e.id); len += e.len; }
    var t = K.me.colony.trees[n]; t.dist(len); t.route(ids.join(","));
    t["="]("trail", ids.map(function (id) { return "colony.trails[" + id + "].strength"; }).join(" + "));
    t["="]("attract", "seeds * (1 + trail) / dist"); K.writes += 4;
  }
  MK.load().then(function (ME) { seed(new ME()); K.status = "ok"; emit(); }, function (e) { K.status = "error"; K.error = String(e && e.message || e); emit(); });
  window.AntCityKernel = { explain: function (p) { return K.me ? K.me.explain(p) : null; }, read: function (p) { return K.me ? K.me(p) : undefined; } };

  // ── paths: cheapest route by the kernel's trail cost (so strong trails and the queen's customs pull traffic) ──
  function edgeOf(a, b) { var x = adj[a].filter(function (q) { return q.n === b; })[0]; return x && x.e; }
  function costOf(e) { return K.me ? read(TP(e) + ".cost") : e.len; }
  function route(a, b, surfaceOK) {
    var dist = {}, prev = {}, done = {}, q = [a]; dist[a] = 0;
    while (q.length) { q.sort(function (x, y) { return dist[x] - dist[y]; }); var c = q.shift(); if (done[c]) continue; done[c] = 1; if (c === b) break;
      adj[c].forEach(function (o) { if (SN[o.n] && SN[o.n].tree && o.n !== b) return; var d = dist[c] + costOf(o.e); if (dist[o.n] == null || d < dist[o.n]) { dist[o.n] = d; prev[o.n] = c; q.push(o.n); } }); }
    if (dist[b] == null) return [a]; var p = [b]; while (p[0] !== a) p.unshift(prev[p[0]]); return p;
  }

  // ── the ants (page side walks them; every arrival, pickup, delivery, deposit and recruitment is a kernel write) ──
  var ants = [], visits = {};
  for (var i = 1; i <= ANTS; i++) ants.push({ id: i, role: ROLE(i), at: "upper", path: null, seg: 0, t: 0, speed: ROLE(i) === "scout" ? 105 : 72 + (i * 37) % 36, wait: 0.4 + (i - 1) * 0.45, odo: 0, mem: [] });
  var P = function (a) { return "colony.ants." + a.id; };
  function go(a, nodes, goal) { a.goal = goal; if (nodes.length < 2) return arrive(a); a.path = nodes; a.seg = 0; a.t = 0; }
  function knownTrees() { return TREES.filter(function (n) { return read("colony.trees." + n + ".known") && read("colony.trees." + n + ".seeds") > 0; }); }
  function bestTree() { var k = knownTrees(); k.sort(function (x, y) { return read("colony.trees." + y + ".attract") - read("colony.trees." + x + ".attract"); }); return k[0] || 0; }
  function storeFor() {   // the queen's customs: when the brood needs food, deliveries go to the pantry (next to the nursery)
    if (read("colony.broodNeed") >= 40 && read("colony.chambers.pantry.free") > 0) return "pantry";
    return STORES.filter(function (s) { return read("colony.chambers." + s + ".free") > 0; }).sort(function (x, y) { return read("colony.chambers." + y + ".free") - read("colony.chambers." + x + ".free"); })[0];
  }
  function plan(a) {
    var carry = read(P(a) + ".carry");
    if (a.role === "worker") {
      if (carry) { var st = storeFor(); if (!st) { a.wait = 1.5; return; } return go(a, route(a.at, st), { ch: st, deposit: true }); }
      var rt = read(P(a) + ".recruitedTo"), tr = rt && read("colony.trees." + rt + ".seeds") > 0 ? rt : bestTree(); if (!tr) { a.wait = 2; return; }
      return go(a, route(a.at, treeNode(tr)), { tree: tr });
    }
    if (a.role === "nurse") {
      if (carry) return go(a, route(a.at, "nursery"), { ch: "nursery" });
      var full = STORES.slice().sort(function (x, y) { return read("colony.chambers." + y + ".stock") - read("colony.chambers." + x + ".stock"); })[0];
      if (read("colony.chambers." + full + ".stock") <= 0) { a.wait = 2; return; } return go(a, route(a.at, full), { ch: full });
    }
    // scout: explore the surface one edge at a time, preferring places visited least; a tree it reaches is a discovery
    if (CH[a.at]) return go(a, route(a.at, "mouth"), { surf: "mouth" });
    var opts = adj[a.at].filter(function (o) { return SN[o.n]; }); opts.sort(function (x, y) { return ((visits[x.n] || 0) + Math.random() * 1.5) - ((visits[y.n] || 0) + Math.random() * 1.5); });
    var nx = opts[0].n; return go(a, [a.at, nx], { surf: nx });
  }
  var fx = [], fxAt = function (x, y, kind) { fx.push({ x: x, y: y, t: performance.now(), kind: kind || "write" }); };
  function deposit(a, e, amt) { add(TP(e) + ".weight", amt); e.flash = performance.now(); }
  function arrive(a) {
    var g = a.goal || {}, end = a.path ? a.path[a.path.length - 1] : a.at; a.path = null; a.at = end;
    write(P(a) + ".at", end); var nd = NODES[end]; visits[end] = (visits[end] || 0) + 1;
    var carry = read(P(a) + ".carry");
    if (a.role === "worker") {
      if (g.tree) { var sp = "colony.trees." + g.tree + ".seeds"; if (read(sp) > 0) { add(sp, -1); write(P(a) + ".carry", 1); a.carryFrom = g.tree; } a.wait = .4; return; }
      if (g.ch && STORES.indexOf(g.ch) >= 0 && carry) { add("colony.chambers." + g.ch + ".stock", 1); write(P(a) + ".carry", 0); fxAt(nd.x, nd.y); a.wait = .4; return; }
    } else if (a.role === "nurse") {
      if (g.ch && STORES.indexOf(g.ch) >= 0 && !carry) { var s2 = "colony.chambers." + g.ch + ".stock"; if (read(s2) > 0) { add(s2, -1); write(P(a) + ".carry", 1); } a.wait = .5; return; }
      if (g.ch === "nursery" && carry) { write(P(a) + ".carry", 0); var fed = add("colony.chambers.nursery.fed", 1);
        if (fed % 3 === 0 && read("colony.chambers.nursery.larvae") > 0) { add("colony.chambers.nursery.larvae", -1); add("colony.chambers.nursery.born", 1); } a.wait = .8; return; }
    } else {
      a.mem.push(end); if (a.mem.length > 40) a.mem.shift();
      if (nd.tree && !read("colony.trees." + nd.tree + ".known")) {   // discovery: the scout knows the way back and lays a trail home
        var n = nd.tree; write("colony.trees." + n + ".known", 1); write("colony.trees." + n + ".foundBy", a.id); add(P(a) + ".found", 1);
        var home = route(end, "mouth"); declareRoute(n, home.slice().reverse()); a.news = n; fxAt(nd.x, nd.y, "find");
        return go(a, home.concat(route("mouth", "upper").slice(1)), { recruit: n });
      }
      if (g.recruit) {   // back in the upper hall with news: recruitment starts here and spreads ant to ant
        K.wave++; write("colony.recruit.tree", g.recruit); write("colony.recruit.wave", K.wave); write(P(a) + ".recruited", 1); write(P(a) + ".recruitedTo", g.recruit); write(P(a) + ".hop", 0);
        fxAt(nd.x, nd.y, "wave"); a.news = 0; a.wait = 2; return;
      }
      a.wait = .15 + Math.random() * .5; return;
    }
    a.wait = .3;
  }
  function onEdgeDone(a, from, to) {   // laying pheromone: scouts bringing news, workers carrying food home
    var e = edgeOf(from, to); if (!e) return;
    if (a.role === "scout" && a.goal && a.goal.recruit) deposit(a, e, 4);
    else if (a.role === "worker" && read(P(a) + ".carry")) deposit(a, e, 1);
  }
  var spreadT = 0, evapT = 0, eatT = 0, layT = 0, hatchT = 0, frames = 0, fpsT = performance.now(), K_FPS = 0;
  function spread() {   // recruitment passes from a recruited ant to a worker nearby, if its tree is more attractive than what that worker follows
    var pos = ants.map(antXY);
    ants.forEach(function (a, ia) { var to = read(P(a) + ".recruitedTo"); if (!to) return;
      ants.forEach(function (b, ib) { if (b.role !== "worker" || ia === ib) return; var cur = read(P(b) + ".recruitedTo");
        if (cur === to || Math.hypot(pos[ia].x - pos[ib].x, pos[ia].y - pos[ib].y) > 30) return;
        if (cur && read("colony.trees." + cur + ".attract") >= read("colony.trees." + to + ".attract")) return;
        write(P(b) + ".recruitedTo", to); write(P(b) + ".recruited", 1); write(P(b) + ".hop", (read(P(a) + ".hop") || 0) + 1); fxAt(pos[ib].x, pos[ib].y, "recruit"); }); });
  }
  function evaporate() { EDGES.forEach(function (e) { var w = read(TP(e) + ".weight"); if (w > 0.05) write(TP(e) + ".weight", Math.round(w * 0.93 * 1000) / 1000); else if (w) write(TP(e) + ".weight", 0); }); }
  function step(dt) {
    if (!K.me) return;
    var w0 = K.writes;
    ants.forEach(function (a) {
      if (a.path) { var A = NODES[a.path[a.seg]], B = NODES[a.path[a.seg + 1]], len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
        a.t += dt * a.speed / len; a.odo += dt * a.speed;
        if (a.t >= 1) { onEdgeDone(a, a.path[a.seg], a.path[a.seg + 1]); a.seg++; a.t = 0; if (a.seg >= a.path.length - 1) arrive(a); }
      } else if ((a.wait -= dt) <= 0) plan(a);
    });
    if ((spreadT += dt) >= .25) { spreadT = 0; spread(); }
    if ((evapT += dt) >= 2) { evapT = 0; evaporate(); }
    if ((eatT += dt) >= 5) { eatT = 0; var s = STORES.slice().sort(function (x, y) { return read("colony.chambers." + y + ".stock") - read("colony.chambers." + x + ".stock"); })[0]; if (read("colony.chambers." + s + ".stock") > 0) add("colony.chambers." + s + ".stock", -1); }
    if ((layT += dt) >= 7) { layT = 0; add("colony.chambers.nursery.eggs", 1); add("colony.queen.eggsLaid", 1); fxAt(CH.queen.x, CH.queen.y); }
    if ((hatchT += dt) >= 9) { hatchT = 0; if (read("colony.chambers.nursery.eggs") > 0) { add("colony.chambers.nursery.eggs", -1); add("colony.chambers.nursery.larvae", 1); } }
    if (K.writes !== w0) emit();
  }
  function antXY(a) {
    if (!a.path) { var c = NODES[a.at], k = a.id * 2.4, r = CH[a.at] ? CH[a.at].r : 8; return { x: c.x + Math.cos(k) * r * .6, y: c.y + Math.sin(k) * r * .45 }; }
    // two-way traffic: each direction keeps to its own side of the edge, three lanes per side
    var A = NODES[a.path[a.seg]], B = NODES[a.path[a.seg + 1]], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, off = 4.5 + (a.id % 3) * 2.6, ease = Math.min(1, a.t * L / 18, (1 - a.t) * L / 18);
    var u = a.t < .5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2, tt = a.t * .8 + u * .2;   // a slight ease in/out at nodes
    return { x: A.x + dx * tt - dy / L * off * ease, y: A.y + dy * tt + dx / L * off * ease, ang: Math.atan2(dy, dx) };
  }

  // ── page CSS (theme tokens only) ──
  var CSS = [
    ".ac-dash{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}@media (min-width:900px){.ac-dash{grid-template-columns:minmax(0,1fr) 340px}.ac-panel{position:sticky;top:60px;grid-column:2;grid-row:1 / span 2}.ac-dash{grid-template-rows:auto 1fr}.ac-dash>.ac-notes{grid-column:1;grid-row:2;margin-top:12px}}",
    ".ac-fig{scroll-margin-top:60px;position:relative;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:14px;overflow:hidden;background:var(--mui-palette-background-default,transparent)}.ac-fig canvas{display:block;width:100%;height:auto;cursor:pointer;touch-action:manipulation}",
    ".ac-cap{margin:8px 2px 0;font-size:12.5px;line-height:1.5;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".ac-panel{border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;background:var(--mui-palette-background-paper,transparent);font-size:13px;overflow:hidden}",
    ".ac-sec{padding:10px 12px;border-top:1px solid var(--mui-palette-divider,rgba(128,128,128,.25))}.ac-sec:first-child{border-top:0}.ac-h{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--mui-palette-text-secondary,#8b949e)}",
    ".ac-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ac-kpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:1px;padding:8px 10px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:10px;cursor:pointer}.ac-kpi:hover,.ac-kpi:focus-visible,.ac-kpi[aria-pressed=true]{border-color:var(--mui-palette-primary-main,#58a6ff)}",
    ".ac-kpi b{font-size:1.5rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15}.ac-kpi small{font-size:11.5px;color:var(--mui-palette-text-secondary,#8b949e)}.ac-kpi code{font:11px " + MONO + ";color:var(--mui-palette-text-secondary,#8b949e)}",
    ".ac-row{display:flex;justify-content:space-between;gap:10px;line-height:1.65}.ac-row>span:first-child{color:var(--mui-palette-text-secondary,#8b949e)}.ac-grp{cursor:pointer;border-radius:6px;padding:0 6px;margin:0 -6px}.ac-grp:hover,.ac-grp:focus-visible{background:var(--mui-palette-action-hover,rgba(127,127,127,.12));outline:none}.ac-grp.on{background:var(--mui-palette-action-selected,rgba(88,166,255,.16))}.ac-grp.on>span:first-child{color:var(--mui-palette-primary-main,#58a6ff)}.ac-path{display:block;font-family:" + MONO + ";font-size:10.5px;opacity:.7;margin-left:17px;line-height:1.2;padding-bottom:3px}.ac-sw{display:inline-block;width:9px;height:9px;border:1.5px solid;border-radius:50%;margin-right:8px;vertical-align:0}.ac-sw-trees,.ac-sw-broodNeed,.ac-sw-brood{border-radius:2px}.ac-sw-waves{border-radius:0;border-width:0 0 2px;border-style:dashed;width:12px;height:6px}.ac-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".ac-note{margin-top:6px;font-size:12px;line-height:1.5;color:var(--mui-palette-text-secondary,#8b949e)}.ac-note a,.ac-k a,.ac-notes a{color:var(--mui-palette-primary-main,#58a6ff);text-decoration:none}.ac-note a:hover,.ac-k a:hover,.ac-notes a:hover{text-decoration:underline}",
    ".ac-json{margin:6px 0 0;padding:8px;max-height:260px;overflow:auto;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));font:11px/1.5 " + MONO + ";white-space:pre;color:var(--mui-palette-text-primary,inherit)}",
    ".ac-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ac-btn{font:inherit;font-size:12.5px;font-weight:600;padding:4px 10px;border-radius:8px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.4));background:transparent;color:inherit;cursor:pointer}.ac-btn:hover{border-color:var(--mui-palette-primary-main,#58a6ff)}.ac-btn.on{color:var(--mui-palette-primary-main,#58a6ff);border-color:currentColor}",
    ".ac-k summary{cursor:pointer;list-style:none;font:11.5px/1.5 " + MONO + ";color:var(--mui-palette-text-secondary,#8b949e)}.ac-k summary::-webkit-details-marker{display:none}.ac-k summary::before{content:'▸ ';}.ac-k[open] summary::before{content:'▾ '}.ac-k .ok{color:var(--mui-palette-success-main,#2e9d6e)}.ac-k .bad{color:var(--mui-palette-error-main,#e5534b)}.ac-k div{font:11px/1.6 " + MONO + ";color:var(--mui-palette-text-secondary,#8b949e);overflow-wrap:anywhere}",
    ".ac-steps{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-wrap:wrap;gap:6px}.ac-steps li{margin:0}.ac-step{font:inherit;font-size:12.5px;cursor:pointer;padding:4px 10px;border-radius:999px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));background:transparent;color:var(--mui-palette-text-secondary,#8b949e)}.ac-step b{font-weight:700;margin-right:2px}.ac-step.on{color:var(--mui-palette-text-primary,inherit);border-color:var(--mui-palette-primary-main,#58a6ff);background:var(--mui-palette-action-selected,rgba(88,166,255,.12))}.ac-how:focus-visible{outline:2px solid var(--mui-palette-primary-main,#58a6ff);outline-offset:4px;border-radius:8px}.ac-stepbody{padding:12px 14px;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:12px;background:var(--mui-palette-background-paper,transparent)}.ac-stepbody>p{margin:0 0 4px}.ac-stepbody .ac-json{max-height:200px}.ac-stepn{align-self:center;margin-left:auto;font-size:12px;color:var(--mui-palette-text-secondary,#8b949e)}"+
    ".ac-reads{all:unset;cursor:pointer;color:var(--mui-palette-primary-main,#58a6ff);border-bottom:1px dashed var(--mui-palette-primary-main,#58a6ff)}.ac-reads:hover,.ac-reads:focus-visible{border-bottom-style:solid}.ac-reads-out{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px}.ac-reads-h{width:100%;font-size:12.5px}.ac-reads-chip{border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:6px;padding:1px 6px;line-height:1.5}.ac-reads-more{all:unset;cursor:pointer;font-size:12px;color:var(--mui-palette-primary-main,#58a6ff);padding:0 4px}",
    ".ac-me{font-family:" + MONO + ";font-size:12px}.ac-notes{margin:28px 0 0;max-width:760px;font-size:14px;line-height:1.65}.ac-notes h2,.ac-rel h2{margin:0 0 10px;font-size:1.35rem;font-weight:800}.ac-notes ul{margin:0;padding-left:20px}.ac-notes li{margin-bottom:6px}.ac-notes code{font-family:" + MONO + ";font-size:12.5px}",
    ".ac-rel{margin:32px 0 8px}.ac-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media (max-width:900px){.ac-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:480px){.ac-cards{grid-template-columns:1fr}}",
    ".ac-card{display:flex;flex-direction:column;border:1px solid var(--mui-palette-divider,rgba(128,128,128,.3));border-radius:14px;overflow:hidden;background:var(--mui-palette-background-paper,transparent);color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}.ac-card:hover{transform:translateY(-2px);border-color:var(--mui-palette-primary-main,#58a6ff)}",
    ".ac-card .img{display:block;aspect-ratio:1200/630;background:var(--mui-palette-action-hover,rgba(128,128,128,.12));overflow:hidden}.ac-card img{width:100%;height:100%;object-fit:cover;display:block}.ac-card .tx{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.ac-card b{font-size:14px;font-weight:800}.ac-card small{font-size:12px;line-height:1.4;color:var(--mui-palette-text-secondary,#8b949e)}",
  ].join("\n");
  (function () { var s = document.createElement("style"); s.id = "ac-css"; s.textContent = CSS; document.head.appendChild(s); })();
  var SYN = window.MeSyntax;
  if (SYN && SYN.watchTheme) SYN.watchTheme(); // measures the active .GUI theme and writes --me-syn-* (same colours as the other pages); re-runs on theme / mode change
  var me = function (t) { return h("code", { className: "me-code ac-me" }, SYN ? SYN.render(h, t) : t); };
  var link = function (href, text) { return h("a", { href: href, target: href.indexOf("http") === 0 ? "_blank" : undefined, rel: "noopener" }, text); };
  function useKernel() { var s = useState(K.ver), set = s[1]; useEffect(function () { var f = function (v) { set(v); }; K.subs.push(f); return function () { K.subs = K.subs.filter(function (g) { return g !== f; }); }; }, []); return K; }
  var sel = { v: null, subs: [] }; function select(x) { sel.v = x; sel.subs.forEach(function (f) { f(x); }); }
  function useSel() { var s = useState(sel.v), set = s[1]; useEffect(function () { sel.subs.push(set); return function () { sel.subs = sel.subs.filter(function (g) { return g !== set; }); }; }, []); return s[0]; }
  var running = { on: params.get("paused") !== "1" };

  // ── the figure: the surface map and the anthill cross-section, in the Robots in Space line style ──
  function Hill() {
    var cv = useRef(null), k = useKernel(), cur = useSel();
    useEffect(function () {
      var c = cv.current, ctx = c.getContext("2d"), raf = 0, last = performance.now(), pal = null, palT = 0;
      var dpr = Math.min(2, window.devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
      var css = function (n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim() || getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; };
      var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
      var STARS = []; for (var s0 = 0; s0 < 70; s0++) { var a0 = Math.sin(s0 * 12.9898) * 43758.5453, b0 = Math.sin(s0 * 78.233) * 12543.123; STARS.push([((a0 % 1) + 1) % 1 * W, ((b0 % 1) + 1) % 1 * (GROUND - 20), .5 + ((s0 * 7) % 5) / 8, .12 + ((s0 * 3) % 7) / 28]); }
      var GRAINS = []; for (var g0 = 0; g0 < 140; g0++) GRAINS.push([((Math.sin(g0 * 3.7) * 9999) % 1 + 1) % 1 * W, GROUND + 10 + ((Math.sin(g0 * 7.1) * 9999) % 1 + 1) % 1 * (H - GROUND - 14), .6 + (g0 % 4) * .3]);
      function rgba(col, al) { var m = String(col).match(/^#([0-9a-f]{6})$/i); if (m) { var n = parseInt(m[1], 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + al + ")"; }
        m = String(col).match(/rgba?\(([^)]+)\)/); if (m) return "rgba(" + m[1].split(",").slice(0, 3).join(",") + "," + al + ")"; return col; }
      function palette() { var bg = css("--mui-palette-background-default", ""), dark = true, m = bg.match(/\d+/g);
        if (/^#/.test(bg)) { var n = parseInt(bg.slice(1, 7), 16); dark = ((n >> 16) + (n >> 8 & 255) + (n & 255)) / 3 < 128; } else if (m && m.length >= 3) dark = (+m[0] + +m[1] + +m[2]) / 3 < 128;
        var ink = css("--mui-palette-text-primary", dark ? "#e6edf3" : "#1f2328"), sun = css("--mui-palette-warning-main", "#d29922");
        return { dark: dark, bg: bg || (dark ? "#0d1117" : "#ffffff"), ink: ink, muted: css("--mui-palette-text-secondary", dark ? "#8b949e" : "#57606a"), faint: css("--mui-palette-text-disabled", dark ? "#6e7681" : "#8c959f"),
          sun: sun, day: rgba(sun, dark ? .16 : .24), night: rgba(ink, dark ? .05 : .07), night2: rgba(ink, dark ? .09 : .11), ice: dark ? "#9fd8ff" : "#2a86c7", nurse: dark ? "#7ee2a8" : "#1a7f37", link: css("--mui-palette-info-main", "#58a6ff"), accent: css("--mui-palette-primary-main", "#58a6ff") }; }
      // a panel row selects a group; membership is always asked of the kernel (role flags, known, recruited, the wave tree's route)
      function ok0() { return !!K.me; }
      function grpOf(on) { return K.hov || (on && on.g) || null; }
      function antIn(g, id) { var p = "colony.ants." + id + ".";
        return g === "workers" ? !!read(p + "isWorker") : g === "nurses" ? !!read(p + "isNurse") : g === "scouts" ? !!read(p + "isScout") : g === "recruited" ? !!read(p + "recruited") : g === "waves" ? !!read(p + "recruited") && read(p + "recruitedTo") === read("colony.recruit.tree") : false; }
      function waveEdges() { var t = read("colony.recruit.tree"), r = t ? String(read("colony.trees." + t + ".route") || "") : ""; return r ? r.split(",").map(Number) : []; }
      function draw() {
        if (!pal || performance.now() - palT > 500) { pal = palette(); palT = performance.now(); }
        K.pal = pal; var P = pal, G = ok0() ? grpOf(sel.v) : null, WE = G === "waves" ? waveEdges() : [], FS = Math.max(1, Math.min(2.6, 720 / (c.clientWidth || W))), now = performance.now(), on = sel.v, ok = !!K.me;
        var mono = function (sz, t, x, y, col) { ctx.font = "500 " + (sz * FS).toFixed(1) + "px " + MONO; ctx.fillStyle = col; ctx.textAlign = "center"; if (ctx.letterSpacing !== undefined) ctx.letterSpacing = (.12 * sz * FS).toFixed(1) + "px"; ctx.fillText(t, x, y); if (ctx.letterSpacing !== undefined) ctx.letterSpacing = "0px"; };
        var ital = function (sz, t, x, y, col) { ctx.font = "italic " + (sz * FS).toFixed(1) + "px " + SERIF; ctx.fillStyle = col; ctx.textAlign = "center"; ctx.fillText(t, x, y); };
        var ring = function (x, y, r, col) { ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]); };
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        STARS.forEach(function (s) { ctx.globalAlpha = s[3]; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
        var gl = ctx.createRadialGradient(1120, -20, 0, 1120, -20, 190); gl.addColorStop(0, rgba(P.sun, .45)); gl.addColorStop(1, rgba(P.sun, 0)); ctx.fillStyle = gl; ctx.fillRect(900, 0, 300, 200);
        ctx.globalAlpha = .85; ctx.fillStyle = P.sun; ctx.beginPath(); ctx.arc(1120, -20, 46, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = P.night; ctx.fillRect(0, GROUND, W, H - GROUND);
        GRAINS.forEach(function (g) { ctx.fillStyle = P.night2; ctx.beginPath(); ctx.arc(g[0], g[1], g[2], 0, 7); ctx.fill(); });
        ctx.strokeStyle = P.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(570, GROUND); ctx.quadraticCurveTo(640, GROUND - 26, 710, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
        // edges: tunnels as bands, surface paths as faint dashes; on top, the trail strength from the kernel (width + glow), the queen's bias in warm dashes
        ctx.lineCap = "round";
        EDGES.forEach(function (e) { var A = NODES[e[0]], B = NODES[e[1]];
          if (!e.surf) { ctx.strokeStyle = P.night2; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
          else { ctx.strokeStyle = P.faint; ctx.globalAlpha = .35; ctx.lineWidth = 1; ctx.setLineDash([1, 6]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; } });
        if (ok) EDGES.forEach(function (e) { var A = NODES[e[0]], B = NODES[e[1]], w = read(TP(e) + ".weight") || 0, bias = read(TP(e) + ".bias") || 0, isSel = on && on.type === "edge" && on.id === e.id;
          if (bias) { ctx.strokeStyle = P.sun; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
          if (w > 0.05) { var f = Math.min(1, w / 30), flash = e.flash ? Math.max(0, 1 - (now - e.flash) / 600) : 0;
            ctx.save(); ctx.shadowColor = P.link; ctx.shadowBlur = 4 + 14 * f + 8 * flash; ctx.strokeStyle = P.link; ctx.globalAlpha = .35 + .55 * f; ctx.lineWidth = 1 + 5 * f;
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.restore(); }
          if (isSel) { ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
            mono(10, "TRAIL " + e.id, (A.x + B.x) / 2, (A.y + B.y) / 2 - 10, P.accent); } });
        if (WE.length) { ctx.save(); ctx.strokeStyle = P.accent; ctx.lineWidth = 3; ctx.shadowColor = P.accent; ctx.shadowBlur = 10; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -now / 40;
          WE.forEach(function (id) { var e = EDGES[id - 1]; if (!e) return; var A = NODES[e[0]], B = NODES[e[1]]; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }); ctx.restore(); }
        // trees: a line drawing; fruit in the sun colour, as many as the kernel says it has; unknown trees stay faint
        TREES.forEach(function (n) { var s = SN[treeNode(n)], known = ok && read("colony.trees." + n + ".known"), seeds = ok ? read("colony.trees." + n + ".seeds") : 0, isSel = on && on.type === "tree" && on.n === n;
          ctx.globalAlpha = (known ? 1 : .22) * (G && G !== "trees" ? .35 : 1); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(s.x, s.y + 30); ctx.lineTo(s.x, s.y + 4); ctx.moveTo(s.x, s.y + 14); ctx.lineTo(s.x - 9, s.y + 4); ctx.moveTo(s.x, s.y + 12); ctx.lineTo(s.x + 8, s.y + 2); ctx.stroke();
          ctx.fillStyle = P.bg; [[-10, -2, 11], [9, -4, 12], [0, -14, 13]].forEach(function (q) { ctx.beginPath(); ctx.arc(s.x + q[0], s.y + q[1], q[2], 0, 7); ctx.fill(); ctx.stroke(); });
          if (known) for (var q = 0; q < Math.min(14, Math.ceil(seeds / 12)); q++) seedAt(s.x - 14 + (q * 7.3) % 28, s.y - 18 + ((q * 11) % 20), q, P);
          ctx.globalAlpha = 1; mono(9.5, known ? "TREE " + n + " · " + seeds : "TREE " + n + " · ?", Math.max(52 * FS, Math.min(W - 52 * FS, s.x)), s.y + 44 * Math.min(FS, 1.3), isSel ? P.accent : known ? P.muted : P.faint);
          if (isSel || (G === "trees" && known) || (G === "waves" && read("colony.recruit.tree") === n)) ring(s.x, s.y, 34, P.accent); });
        NAMES.forEach(function (n) { var ch = CH[n], isSel = on && on.type === "chamber" && on.n === n, rx = ch.r * 1.35, ry = ch.r;
          ctx.fillStyle = P.bg; ctx.beginPath(); ctx.ellipse(ch.x, ch.y, rx, ry, 0, 0, 7); ctx.fill(); ctx.fillStyle = P.night; ctx.fill();
          if (ch.capacity && ok) { var st = read("colony.chambers." + n + ".stock") || 0, f = Math.min(1, st / ch.capacity);
            ctx.save(); ctx.beginPath(); ctx.ellipse(ch.x, ch.y, rx, ry, 0, 0, 7); ctx.clip(); ctx.fillStyle = P.day; ctx.fillRect(ch.x - rx, ch.y + ry - 2 * ry * f, rx * 2, 2 * ry * f); ctx.restore();
            ital(12, st + " of " + ch.capacity, ch.x, ch.y + 5 * FS, P.ink); }
          if (n === "nursery" && ok) { var eg = read("colony.chambers.nursery.eggs") || 0, lv = read("colony.chambers.nursery.larvae") || 0; ctx.lineWidth = 1; ctx.strokeStyle = P.ink;
            for (var e1 = 0; e1 < Math.min(eg, 14); e1++) { var ex = ch.x - 34 + (e1 % 7) * 10, ey = ch.y - 14 + Math.floor(e1 / 7) * 9; ctx.fillStyle = P.bg; ctx.beginPath(); ctx.ellipse(ex, ey, 3, 4, .3, 0, 7); ctx.fill(); ctx.stroke(); }
            for (var l1 = 0; l1 < Math.min(lv, 8); l1++) { var lx = ch.x - 30 + (l1 % 4) * 20, ly = ch.y + 12 + Math.floor(l1 / 4) * 13; ctx.beginPath(); ctx.arc(lx, ly, 5, .5, 5.2); ctx.lineWidth = 2.6; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = P.bg; ctx.stroke(); }
            ctx.lineWidth = 1; ital(11, eg + " eggs · " + lv + " larvae", ch.x, ch.y + ry + 15 * FS, P.muted); }
          if (n === "fungus") { ctx.strokeStyle = P.faint; ctx.lineWidth = 1; for (var fu = 0; fu < 6; fu++) { var fx0 = ch.x - 22 + fu * 9; ctx.beginPath(); ctx.moveTo(fx0, ch.y + 12); ctx.lineTo(fx0, ch.y - 2 + (fu % 2) * 4); ctx.stroke(); ctx.beginPath(); ctx.arc(fx0, ch.y - 4 + (fu % 2) * 4, 4, Math.PI, 0); ctx.stroke(); } }
          if (n === "queen") { drawAnt(ch.x, ch.y + 4, -0.35, 2.3 * Math.min(FS, 1.4), P.ink, Math.sin(now / 900) * .6, false, P, "queen");
            if (on && on.type === "queen") ring(ch.x, ch.y + 4, 30 * Math.min(FS, 1.4), P.accent);
            ok && ital(11, "influence " + read("colony.queen.influence") + " · " + (read("colony.queen.eggsLaid") || 0) + " eggs laid", ch.x, ch.y + ry + 15 * FS, P.muted); }
          ctx.strokeStyle = P.faint; ctx.globalAlpha = .55; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ch.x, ch.y, rx, ry, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
          if (isSel) { ctx.strokeStyle = P.accent; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(ch.x, ch.y, rx + 7, ry + 7, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          var gHit = (G === "brood" && n === "nursery") || (G === "broodNeed" && (n === "queen" || n === "nursery"));
          if (gHit) { ctx.save(); ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.shadowColor = P.accent; ctx.shadowBlur = 8; ctx.beginPath(); ctx.ellipse(ch.x, ch.y, rx + 6, ry + 6, 0, 0, 7); ctx.stroke(); ctx.restore(); }
          mono(10, ch.label.toUpperCase(), ch.x, ch.y - ry - 7, isSel || gHit ? P.accent : P.muted); });
        // events: writes (thin rings), discoveries (warm), recruitment hand-offs (link, filled pulse), the wave start (wide ring)
        fx = fx.filter(function (e) { return now - e.t < 1800; });
        fx.forEach(function (e) { var age = (now - e.t) / 1000, o = Math.max(0, 1 - age / 1.8), col = e.kind === "find" ? P.sun : P.link, r = e.kind === "wave" ? 10 + age * 120 : e.kind === "find" ? 8 + age * 50 : 5 + age * 20;
          ctx.globalAlpha = o * (e.kind === "write" ? .5 : .85); ctx.strokeStyle = col; ctx.lineWidth = e.kind === "write" ? 1 : 1.6; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.stroke();
          if (e.kind === "recruit") { ctx.fillStyle = col; ctx.globalAlpha = o * .25; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 7); ctx.fill(); } }); ctx.globalAlpha = 1;
        ants.forEach(function (a) { var p = antXY(a), carry = ok && read("colony.ants." + a.id + ".carry"), rec = ok && read("colony.ants." + a.id + ".recruitedTo"), hl = on && on.type === "ant" && on.i === a.id;
          var mem = G && antIn(G, a.id); ctx.globalAlpha = G && !mem ? .16 : 1;
          if (mem) { ctx.save(); ctx.fillStyle = rgba(P.accent, .18); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, 11 * Math.min(FS, 1.6), 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
          drawAnt(p.x, p.y, p.ang == null ? a.id * 1.3 : p.ang, 1.1 * Math.min(FS, 1.8), a.role === "scout" ? P.ice : a.role === "nurse" ? P.nurse : P.ink, a.path ? (a.odo || 0) * .35 : null, carry, P, a.role, rec ? P.link : null, a.news ? P.sun : null);
          ctx.globalAlpha = 1;
          if (hl) { ring(p.x, p.y, 15 * Math.min(FS, 1.6), P.accent); mono(10, "ANT " + a.id, p.x, p.y - 20 * Math.min(FS, 1.6), P.accent); } });
        if (ok && K.wave) mono(10, "RECRUITMENT WAVE " + K.wave + " · TREE " + read("colony.recruit.tree") + " · " + read("colony.recruited") + " ANTS", W / 2, 18 * FS, P.link);
        if (FS < 1.3) mono(10, "COLONY · THIS.ME " + KV, W / 2, H - 12, P.muted);
      }
      // one ant in the Space line style; scouts in the ice colour, nurses with a dot, recruited ants with lit antennae, a scout with news glows warm
      function drawAnt(x, y, ang, s, col, ph, carry, P, role, recCol, newsCol) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.scale(s, s);
        if (newsCol) { ctx.save(); ctx.shadowColor = newsCol; ctx.shadowBlur = 12; ctx.fillStyle = rgba(newsCol, .25); ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.restore(); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.2 / s; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (role === "queen") { ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(-5, 2, 3, 8, -.5, 0, 7); ctx.moveTo(10, 2); ctx.ellipse(5, 2, 3, 8, .5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
        for (var sd = -1; sd <= 1; sd += 2) for (var l = 0; l < 3; l++) { var sw = ph != null ? Math.sin(ph + l * 2.1 + (sd > 0 ? Math.PI : 0)) * 2 : 0, by = -2 + l * 3;
          ctx.beginPath(); ctx.moveTo(sd * 2, by); ctx.quadraticCurveTo(sd * 6, by - 2.5 + sw * .5, sd * 8.5, by + 1 + sw); ctx.stroke(); }
        ctx.fillStyle = P.bg; [[0, role === "queen" ? 8 : 6, 3.4, role === "queen" ? 6.4 : 4.4], [0, 0.5, 2.2, 2.8], [0, -5, 2.8, 2.6]].forEach(function (b) { ctx.beginPath(); ctx.ellipse(b[0], b[1], b[2], b[3], 0, 0, 7); ctx.fill(); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(-1, -7.4); ctx.quadraticCurveTo(-2.4, -9.5, -3.4, -11); ctx.moveTo(1, -7.4); ctx.quadraticCurveTo(2.4, -9.5, 3.4, -11); ctx.stroke();
        if (recCol) { ctx.fillStyle = recCol; ctx.beginPath(); ctx.arc(-3.4, -11, 1.3, 0, 7); ctx.arc(3.4, -11, 1.3, 0, 7); ctx.fill(); }
        if (role === "nurse") { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 6, 2.2, 0, 7); ctx.fill(); }
        if (role === "scout") { ctx.beginPath(); ctx.moveTo(-3, -11); ctx.lineTo(0, -14); ctx.lineTo(3, -11); ctx.stroke(); }
        if (role === "queen") { ctx.fillStyle = P.sun; ctx.beginPath(); ctx.arc(0, -5, 1.1, 0, 7); ctx.fill(); }
        if (carry) seedAt(0, -10.5, 1, P);
        ctx.restore();
      }
      function seedAt(x, y, k, P) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4 + k * .3); ctx.fillStyle = P.sun; ctx.fillRect(-2.4, -2.4, 4.8, 4.8); ctx.restore(); }
      function frame(t) { var dt = Math.min(.05, (t - last) / 1000); last = t; if (running.on) { step(dt); } draw(); frames++; if (t - fpsT > 1000) { K_FPS = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; K.fps = K_FPS; } raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      function segDist(px, py, A, B) { var dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - A.x) * dx + (py - A.y) * dy) / L2)); return Math.hypot(px - A.x - u * dx, py - A.y - u * dy); }
      function hit(e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, best = null, bd = 18;
        ants.forEach(function (a) { var p = antXY(a), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = { type: "ant", i: a.id }; } });
        if (!best && Math.hypot(x - CH.queen.x, y - CH.queen.y - 4) < 26) best = { type: "queen" };
        if (!best) TREES.forEach(function (n) { var s = SN[treeNode(n)]; if (Math.hypot(x - s.x, y - s.y) < 34) best = { type: "tree", n: n }; });
        if (!best) NAMES.forEach(function (n) { var c2 = CH[n]; if (Math.hypot((x - c2.x) / 1.35, y - c2.y) < c2.r + 4) best = { type: "chamber", n: n }; });
        if (!best) { var bdist = 12; EDGES.forEach(function (ed) { var d = segDist(x, y, NODES[ed[0]], NODES[ed[1]]); if (d < bdist) { bdist = d; best = { type: "edge", id: ed.id }; } }); }
        select(best); }
      c.addEventListener("click", hit); return function () { cancelAnimationFrame(raf); c.removeEventListener("click", hit); };
    }, []);
    return h("div", null, h("div", { className: "ac-fig" }, h("canvas", { ref: cv, width: W, height: H, role: "img", "aria-label": "A surface map with three trees above an anthill: chambers joined by tunnels, ants walking between them, trails lit by their kernel weight", "data-ac": "hill" })),
      h("p", { className: "ac-cap" }, "Scouts (light blue) explore the surface; when one finds a tree it lays a trail home (", me("colony.trails.<n>.weight"), ") and starts a recruitment wave that passes ant to ant (lit antennae). Workers follow the cheapest route by ", me('["="]("cost", "length / (1 + strength)")'), "; the queen's influence biases her routes (warm dashes). Every number is read from " + KL + ". Click a trail, a tree, a chamber or an ant."));
  }

  // ── the right panel ──
  var synJ = function (t) { return SYN ? SYN.render(h, t) : t; };
  var fmtJ = function (o) { try { return JSON.stringify(o, function (k2, v) { return k2 === "lastComputedAt" || k2 === "recomputedAt" ? undefined : v; }, 2); } catch (e) { return String(o); } };
  function Panel() {
    var k = useKernel(), cur = useSel(), rs = useState(running.on), run = rs[0], setRun = rs[1];
    var ok = k.status === "ok", R = function (p) { return ok ? read(p) : undefined; }, v = function (x) { return x === undefined ? "–" : typeof x === "object" ? JSON.stringify(x) : String(x); };
    var kpi = function (path, label) { var on = cur && cur.type === "path" && cur.p === path;
      return h("button", { type: "button", className: "ac-kpi", "aria-pressed": on ? "true" : "false", "data-ac": "kpi-" + path.split(".").pop(), onClick: function () { select({ type: "path", p: path }); } },
        h("small", null, label), h("b", null, v(R(path))), h("code", { className: "me-code" }, synJ(path))); };
    var detail = null;
    if (ok && cur) {
      if (cur.type === "path") { var GQ = { workers: "isWorker", nurses: "isNurse", scouts: "isScout", recruited: "recruited" }[cur.g], ids = [];
        if (GQ) for (var gi = 1; gi <= ANTS; gi++) if (R("colony.ants." + gi + "." + GQ)) ids.push(gi);
        detail = { title: cur.p, rows: GQ ? [["ants[n]." + GQ + " = 1", ids.length ? ids.join(", ") : "none"]] : [], ex: cur.p, note: cur.g ? "Highlighted on the map. Click the row again (or Esc) to clear." : null }; }
      else if (cur.type === "chamber") { var n = cur.n, c = CH[n], base = "colony.chambers." + n, homes = [];
        for (var i = 1; i <= ANTS; i++) { var hp = R("colony.ants." + i + ".home"); if (hp && hp.__ptr === base) homes.push(i); }
        var here = ants.filter(function (a) { return !a.path && a.at === n; }).map(function (a) { return a.id; });
        detail = { title: c.label + " chamber", rows: [[base + ".depth", R(base + ".depth") + " cm"]].concat(c.capacity ? [[base + ".stock", R(base + ".stock")], [base + ".free", R(base + ".free")]] : [])
          .concat(n === "nursery" ? [[base + ".eggs", R(base + ".eggs")], [base + ".larvae", R(base + ".larvae")], [base + ".fed", R(base + ".fed")], [base + ".born", R(base + ".born")]] : [])
          .concat([["ants here now", here.length ? here.join(", ") : "none"], ["home of ants", homes.length ? homes.join(", ") : "none"]]), ex: c.capacity ? base + ".free" : n === "nursery" ? base + ".brood" : base + ".depth" }; }
      else if (cur.type === "ant") { var p = "colony.ants." + cur.i, role = R(p + ".role"), rt = R(p + ".recruitedTo");
        detail = { title: "Ant " + cur.i + " · " + role, rows: [[p + ".role", role], [p + ".at", R(p + ".at")], [p + ".carry", R(p + ".carry")]]
          .concat(role === "scout" ? [[p + ".found", R(p + ".found")]] : []).concat(role !== "nurse" ? [[p + ".recruitedTo", rt ? "tree " + rt : "none"], [p + ".hop", R(p + ".hop")]] : [])
          .concat([[p + ".home", R(p + ".home")], [p + ".home.depth", R(p + ".home.depth") + " cm"]]),
          ex: role === "nurse" ? "colony.broodNeed" : role === "scout" ? "colony.recruited" : "colony.trees." + (rt || bestTree() || 1) + ".attract" }; }
      else if (cur.type === "queen") {
        detail = { title: "The queen", rows: [["colony.queen.influence", R("colony.queen.influence")], ["colony.broodNeed", R("colony.broodNeed")], ["colony.queen.eggsLaid", R("colony.queen.eggsLaid")], ["colony.queen.home", R("colony.queen.home")],
          ["colony.chambers.nursery.larvae", R("colony.chambers.nursery.larvae")]], ex: "colony.broodNeed", note: "Her influence is a standing bias on the royal trails (warm dashes): bias = queen.influence × 0.6, so cost = length / (1 + weight + bias) stays low there. When broodNeed ≥ 40, deliveries go to the pantry next to the nursery." }; }
      else if (cur.type === "edge") { var e = EDGES[cur.id - 1], tp = TP(e);
        detail = { title: "Trail " + e.id + " · " + e[0] + " ↔ " + e[1], rows: [[tp + ".length", R(tp + ".length")], [tp + ".weight", R(tp + ".weight")], [tp + ".bias", R(tp + ".bias")], [tp + ".strength", R(tp + ".strength")], [tp + ".cost", Math.round(R(tp + ".cost") * 100) / 100]],
          ex: tp + ".cost", note: "weight rises with every ant that walks it carrying food (+1) or news (+4) and evaporates ×0.93 every 2 s." }; }
      else if (cur.type === "tree") { var tq = "colony.trees." + cur.n;
        detail = { title: "Tree " + cur.n, rows: [[tq + ".known", R(tq + ".known")], [tq + ".seeds", R(tq + ".seeds")], [tq + ".foundBy", R(tq + ".foundBy") ? "ant " + R(tq + ".foundBy") : "–"], [tq + ".dist", R(tq + ".dist")], [tq + ".route", R(tq + ".route")], [tq + ".trail", R(tq + ".trail")], [tq + ".attract", R(tq + ".attract")]],
          ex: R(tq + ".known") ? tq + ".attract" : tq + ".known", note: R(tq + ".known") ? "attract = seeds × (1 + trail) / dist, where trail sums the strength of the trails on its route." : "Not found yet: a scout has to reach it." }; }
    }
    var ex = detail && detail.ex ? K.me.explain(detail.ex) : null, st = MK.state;
    return h("aside", { className: "ac-panel", "data-ac": "panel", "aria-label": "Colony panel" },
      h("div", { className: "ac-sec" }, h("div", { className: "ac-h" }, "Colony · read on " + KL),
        h("div", { className: "ac-kpis" }, kpi("colony.food", "Food in store"), kpi("colony.carried", "Seeds being carried")),
        h("div", { style: { marginTop: 8 } }, [["colony.ants.workers", "workers", "workers", "ink"], ["colony.ants.nurses", "nurses", "nurses", "nurse"], ["colony.ants.scouts", "scouts", "scouts", "ice"], ["colony.trees.known", "trees known", "trees", "sun"], ["colony.ants.recruited", "recruited ants", "recruited", "link"], ["colony.recruit.wave", "recruitment waves", "waves", "accent"], ["colony.broodNeed", "brood need (queen)", "broodNeed", "sun"], ["colony.chambers.nursery.brood", "brood (eggs + larvae)", "brood", "nurse"]].map(function (x) {
          var act = cur && cur.g === x[2], tog = function () { K.hov = null; select(act ? null : { type: "path", p: x[0], g: x[2] }); }, P0 = K.pal || {};
          return h("div", { key: x[0], className: "ac-row ac-grp" + (act ? " on" : ""), role: "button", tabIndex: 0, "aria-pressed": act ? "true" : "false", "aria-label": "Highlight " + x[1] + " on the map", "data-ac": "count-" + x[2],
            onClick: tog, onKeyDown: function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tog(); } else if (ev.key === "Escape") { select(null); } },
            onMouseEnter: function () { K.hov = x[2]; }, onMouseLeave: function () { K.hov = null; }, onFocus: function () { K.hov = x[2]; }, onBlur: function () { K.hov = null; } },
            h("span", { className: "ac-lab" }, h("i", { className: "ac-sw ac-sw-" + x[2], style: { borderColor: P0[x[3]], background: /workers|nurses|scouts|recruited/.test(x[2]) ? P0[x[3]] : "transparent" }, "aria-hidden": "true" }), x[1], h("code", { className: "ac-path me-code" }, synJ(x[0]))), h("span", { className: "ac-num" }, v(R(x[0])))); })),
        h("div", { className: "ac-note" }, me('colony["="]("food", "chambers.pantry.stock + chambers.granary.stock + chambers.cellar.stock")'), " recomputes on every stock write. Each group is a [\"=\"] sum of per-ant flags, e.g. ", me('colony.ants["="]("scouts", "colony.ants[1].isScout + …")'), ". Click a row to highlight its members on the map (asked of ", me("ants[n].isScout"), " etc.) and explain the count; click again or Esc to clear."),
        h("div", { className: "ac-btns" },
          h("button", { type: "button", className: "ac-btn" + (run ? "" : " on"), "data-ac": "pause", onClick: function () { running.on = !running.on; setRun(running.on); } }, run ? "Pause" : "Resume"),
          h("button", { type: "button", className: "ac-btn", "data-ac": "rain", disabled: !ok, onClick: function () { rain(); select({ type: "path", p: "colony.food" }); }, title: "Writes colony.chambers.granary.stock − 10" }, "Rain floods the granary (−10)"))),
      h("div", { className: "ac-sec", "data-ac": "writes" }, h("div", { className: "ac-h" }, "Writes · " + KL),
        h("div", { className: "ac-row" }, h("span", null, "writes so far"), h("span", { className: "ac-num" }, ok ? String(k.writes) : "–")),
        h("div", { className: "ac-row" }, h("span", null, "last"), h("span", { className: "ac-num", title: k.last ? k.last.path : "" }, k.last ? k.last.path.replace("colony.", "") + " = " + v(k.last.value) : "–")),
        h("div", { className: "ac-row" }, h("span", null, "writes / s · frames / s"), h("span", { className: "ac-num", "data-ac": "rate" }, ok ? Math.round(k.writes / Math.max(1, (performance.now() - k.t0) / 1000)) + " · " + (k.fps || "–") : "–")),
        h("div", { className: "ac-row" }, h("span", null, "write + recompute"), h("span", { className: "ac-num" }, ok ? k.lastMs.toFixed(3) + " ms" : "–"))),
      h("div", { className: "ac-sec", "data-ac": "detail" }, h("div", { className: "ac-h" }, detail ? detail.title : "Explain"),
        !detail ? h("div", { className: "ac-note" }, "Click a chamber, an ant or a number to see its paths and ", me("me.explain(path)"), " (", link("https://neurons-me.github.io/.me/docs/Explain.html", "docs"), ").") :
        h(React.Fragment, null, detail.rows.map(function (r) { return h("div", { key: r[0], className: "ac-row" }, h("span", { className: "ac-num me-code", style: { color: "inherit" } }, /^colony\./.test(r[0]) ? synJ(r[0].replace("colony.", "")) : r[0]), h("span", { className: "ac-num" }, v(r[1]))); }),
          detail.ptr ? h("div", { className: "ac-note" }, "home is a pointer (", me('home["->"]("colony.chambers.…")'), "): reading ", me("home.depth"), " goes through it. ", link("https://neurons-me.github.io/.me/docs/Pointer-Composition.html", "Pointers")) : null,
          detail.note ? h("div", { className: "ac-note" }, detail.note) : null,
          h("div", { className: "ac-note" }, me('me.explain("' + detail.ex + '")'), " · " + KL),
          h("pre", { className: "ac-json me-code", "data-ac": "explain" }, synJ(fmtJ(ex))))),
      h("div", { className: "ac-sec" }, h("details", { className: "ac-k", "data-ac": "kernel" },
        h("summary", null, "Kernel · ", link(MK.KERNEL.npm, "this.me@" + KV), " · ", st.state === "ok" ? h("span", { className: "ok" }, "sha256 verified") : st.state === "error" ? h("span", { className: "bad" }, "failed") : "loading…"),
        st.state === "ok" ? [h("div", { key: "h" }, "sha256 " + st.hash), h("div", { key: "u" }, "from ", link(st.url, st.url.replace("https://", ""))), h("div", { key: "s" }, "page source: ", link(SRC_URL, "ant-city.js"))] : st.state === "error" ? h("div", null, st.text) : null)));
  }

  // ── How it works: a narrated stepper; each step selects on the live map and explains one path on the running kernel ──
  var L_PATHS = "https://neurons-me.github.io/.me/docs/me-whatever-what.html", L_PTR = "https://neurons-me.github.io/.me/docs/Pointer-Composition.html", L_OPS = "https://neurons-me.github.io/.me/docs/Operators.html";
  var STEPS = [
    { t: "One tree of paths", sel: { type: "chamber", n: "pantry" }, ex: "colony.chambers.pantry.depth",
      body: function () { return ["The whole colony is one tree in the kernel: chambers, tunnels (trails) and ants are paths like ", me("colony.chambers.pantry.depth"), " or ", me("colony.trails.<n>.length"), ". See ", link(L_PATHS, "me.whatever(what)"), "."]; } },
    { t: "Home is a pointer", sel: { type: "ant", i: 3 }, ex: "colony.ants.3.home.depth",
      body: function () { return ["Each ant's ", me("home"), " points to a chamber, so ", me('me("colony.ants.3.home.depth")'), " reads that chamber's depth. See ", link(L_PTR, "Pointer Composition"), "."]; } },
    { t: "Food is a formula", sel: { type: "path", p: "colony.food" }, ex: "colony.food",
      body: function () { return [me("colony.food"), " is a ", me('["="]'), " sum of the three stores. Any stock write recomputes it, and each store's ", me("free"), ". See ", link(L_OPS, "Operators"), "."]; } },
    { t: "Trails and the cost rule", sel: { type: "edge", id: 8 }, ex: "colony.trails.8.cost",
      body: function () { return ["A trail's ", me('["="]("cost", "length / (1 + strength)")'), " drops as ants walk it (+1 per food trip, +4 per scout with news; ×0.93 every 2 s). Ants take the cheapest route."]; } },
    { t: "Roles are counts", sel: { type: "path", p: "colony.ants.scouts", g: "scouts" }, ex: "colony.ants.scouts",
      body: function () { return ["Each group is a ", me('["="]'), " sum of per-ant flags, e.g. ", me("ants[n].isScout"), ". The highlighted ants are the ones the kernel says are scouts."]; } },
    { t: "The queen biases routes", sel: { type: "queen" }, ex: "colony.broodNeed",
      body: function () { return ["Her ", me("influence"), " adds ", me("bias = queen.influence * 0.6"), " to her trails, and ", me("broodNeed = larvae * influence"), " sends food to the pantry when it reaches 40."]; } },
    { t: "Trees and recruitment", sel: { type: "tree", n: 1 }, ex: function () { return read("colony.trees.1.attract") === undefined ? "colony.trees.1.known" : "colony.trees.1.attract"; },
      body: function () { return ["A found tree gets ", me("attract = seeds * (1 + trail) / dist"), ". Recruited ants pass the news to workers on a weaker tree (", me("ants.<n>.recruitedTo / hop"), "). The walk is animated by the page; every number is read from the kernel. Source: ", link(SRC_URL, "ant-city.js"), "."]; } }];
  function Notes() {
    var k = useKernel(), ss = useState(0), i = ss[0], setI = ss[1], ap = useState(false), auto = ap[0], setAuto = ap[1], ok = k.status === "ok";
    var toMap = function () { if (window.innerWidth >= 900) return; var f = document.querySelector(".ac-fig"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" }); };
    var go = function (n) { var j = (n + STEPS.length) % STEPS.length; setI(j); K.hov = null; select(STEPS[j].sel); toMap(); };
    useEffect(function () { if (!auto) return; var t = setInterval(function () { setI(function (x) { var j = (x + 1) % STEPS.length; select(STEPS[j].sel); return j; }); }, 6000); return function () { clearInterval(t); }; }, [auto]);
    var S = STEPS[i], path = typeof S.ex === "function" ? (ok ? S.ex() : "") : S.ex, ex = ok && path ? K.me.explain(path) : null;
    var key = function (ev) { if (ev.target.tagName === "A") return; if (ev.key === "ArrowRight") { ev.preventDefault(); setAuto(false); go(i + 1); } else if (ev.key === "ArrowLeft") { ev.preventDefault(); setAuto(false); go(i - 1); } };
    return h("section", { className: "ac-notes ac-how", "data-ac": "notes", tabIndex: 0, onKeyDown: key, "aria-label": "How it works, step by step (arrow keys move)" }, h("h2", null, "How it works"),
      h("ol", { className: "ac-steps", role: "tablist" }, STEPS.map(function (x, j) { return h("li", { key: j }, h("button", { type: "button", role: "tab", "aria-selected": j === i ? "true" : "false", className: "ac-step" + (j === i ? " on" : ""), "data-ac": "step-" + (j + 1), onClick: function () { setAuto(false); go(j); } }, h("b", null, j + 1), " ", x.t)); })),
      h("div", { className: "ac-stepbody", role: "tabpanel", "data-ac": "stepbody" },
        h("p", null, S.body()),
        h("div", { className: "ac-note" }, me('me.explain("' + path + '")'), " · " + KL + (ok ? " · live" : " · loading…")),
        h("pre", { className: "ac-json me-code", "data-ac": "step-explain" }, ok ? synJ(fmtJ(ex)) : "…"),
        h("div", { className: "ac-btns" },
          h("button", { type: "button", className: "ac-btn", "data-ac": "prev", onClick: function () { setAuto(false); go(i - 1); } }, "← Prev"),
          h("button", { type: "button", className: "ac-btn", "data-ac": "next", onClick: function () { setAuto(false); go(i + 1); } }, "Next →"),
          h("button", { type: "button", className: "ac-btn" + (auto ? " on" : ""), "aria-pressed": auto ? "true" : "false", "data-ac": "autoplay", onClick: function () { if (!auto) go(i); setAuto(!auto); } }, auto ? "Stop" : "Autoplay"),
          h("span", { className: "ac-stepn" }, (i + 1) + " / " + STEPS.length + " · ← → keys"))));
  }
  var RELATED = [
    ["https://neurons-me.github.io/.me/docs/me-whatever-what.html", "https://neurons-me.github.io/.me/docs/assets/card-paths.webp", "me.whatever(what)", "How a path is written and read, with the same ant colony as runnable examples."],
    ["https://neurons-me.github.io/smart-cities/", "https://neurons-me.github.io/smart-cities/assets/SMART-CITIES-ME.jpg", "Smart Cities", "The other city demos on the same kernel."],
    ["https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/", "https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/assets/ai-decides-og.png", "AI decides, .me computes", "A policy decision stored as a fact; one write recomputes a city's bus network."],
    ["https://neurons-me.github.io/.me/Demos/Robots/Space/", "https://neurons-me.github.io/.me/Demos/Robots/Space/assets/space-robots-og-4.2.png", "Autonomous Robotics in Space", "Three spider robots on two small rocks, each with its own .me kernel."]];
  function Related() {
    return h("section", { className: "ac-rel", "data-ac": "related" }, h("h2", null, "Related"),
      h("div", { className: "ac-cards" }, RELATED.map(function (c) { return h("a", { key: c[0], className: "ac-card", href: c[0] },
        h("span", { className: "img" }, h("img", { src: c[1], alt: "", loading: "lazy" })), h("span", { className: "tx" }, h("b", null, c[2]), h("small", null, c[3]))); })));
  }
  function Dashboard() { return h("div", { className: "ac-dash" }, h(Hill), h(Panel), h(Notes)); }

  var LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=4"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  var PATH = [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: "Demos", href: "https://neurons-me.github.io/.me/Demos/", title: ".me demos" },
    { text: "SmartCities", href: "https://neurons-me.github.io/smart-cities/", title: "Smart Cities" }, { text: "AntCity", href: null, title: "This page" }];
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
  // ── the rain action (toolbar button and the intro phrase share it) ──
  function rain() { var sp = "colony.chambers.granary.stock", v0 = read(sp), v = Math.max(0, v0 - 10); write(sp, v); emit();
    var ex = K.me.explain("colony.food"), m = ex && ex.meta; return { from: v0, to: v, recomputed: m && m.sourcePath === sp && m.recomputed ? m.recomputed.slice() : [] }; }
  // ── intro: "only what depends on it recomputes" runs the rain and lists the kernel's meta.recomputed inline ──
  function derivedCount() { var c = ["colony.broodNeed", "colony.workers", "colony.nurses", "colony.scouts", "colony.carried", "colony.recruited", "colony.food", "colony.treesKnown",
      "colony.ants.workers", "colony.ants.nurses", "colony.ants.scouts", "colony.ants.recruited", "colony.trees.known", "colony.chambers.nursery.brood"];
    NAMES.forEach(function (n) { c.push("colony.chambers." + n + ".free"); }); EDGES.forEach(function (e) { ["bias", "strength", "cost"].forEach(function (f) { c.push("colony.trails." + e.id + "." + f); }); });
    TREES.forEach(function (n) { ["trail", "attract"].forEach(function (f) { c.push("colony.trees." + n + "." + f); }); });
    return c.filter(function (p) { var e = K.me.explain(p); return e && e.derivation && e.derivation.expression; }).length; }
  function Reads() {
    var k = useKernel(), rs = useState(null), res = rs[0], setRes = rs[1], os = useState(false), open = os[0], setOpen = os[1], ok = k.status === "ok";
    var hover = function () { if (ok) select({ type: "chamber", n: "granary" }); };
    var go = function () { if (!ok) return; var r = rain(); select({ type: "chamber", n: "granary" }); setRes({ head: "granary.stock " + r.from + " → " + r.to, rec: r.recomputed, total: derivedCount() }); setOpen(false); };
    var n = res ? res.rec.length : 0, shown = res ? (open ? res.rec : res.rec.slice(0, 8)) : [];
    return h(React.Fragment, null,
      h("button", { type: "button", className: "ac-reads", "data-ac": "reads", disabled: !ok, onMouseEnter: hover, onFocus: hover, onClick: go, title: "Rain: writes colony.chambers.granary.stock − 10 and lists me.explain(\"colony.food\").meta.recomputed" }, "only what depends on it recomputes"), ".",
      res ? h("span", { className: "ac-reads-out", "data-ac": "reads-out" },
        h("span", { className: "ac-reads-h" }, res.head + " · ", h("b", null, n + " of " + res.total), " derived paths recomputed"),
        shown.map(function (p, x) { return h("span", { key: x, className: "ac-reads-chip" }, me(p)); }),
        n > 8 ? h("button", { type: "button", className: "ac-reads-more", "data-ac": "reads-more", onClick: function () { setOpen(!open); } }, open ? "less" : "+" + (n - 8) + " more") : null) : null);
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
    N("ACTopBar", "topbar"),
    N("Box", "main", { component: "main", sx: { maxWidth: 1180, mx: "auto", px: { xs: 2, sm: 4 }, pt: { xs: 3, sm: 4.5 }, pb: 8 } }, [
      N("Typography", "kicker", { component: "p", sx: { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1 } }, ["Smart Cities · " + KL]),
      N("Typography", "title", { component: "h1", sx: { fontSize: "clamp(2rem, 5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1 } }, ["Ant City"]),
      N("Typography", "lede", { component: "p", sx: { color: "text.secondary", mb: 3, maxWidth: 720 } }, ["Each ant is ", me("colony.ants[i]"), " with ", me("colony.ants[i].carry"), " and ", me(".role"), "; one rule, ", me('colony.trails[1]["="]("cost", "length / (1 + strength)")'), ", and one total, ", me('colony["="]("food", "chambers.pantry.stock + chambers.granary.stock + chambers.cellar.stock")'), ". Rain floods the granary and ", h(Reads)]),
      N("ACDashboard", "colony"),
      N("ACRelated", "related"),
    ]),
  ]);
  var scope = window.__thisGuiThemeScope || {};
  var mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; } catch (e) {}
  var PageTheme = function (p) { return h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, p.children); };
  if (G.getInspectorEnabled()) G.setInspectorEnabled(false);
  var pageType = function (Comp) { return { type: "x", resolve: function (s) { var p = Object.assign({}, s.props || {}); delete p.key; return h(Comp, p); } }; };
  var reg = Object.assign({}, G.Registry || G.registry); [["ACTopBar", TopBar], ["ACDashboard", Dashboard], ["ACNotes", Notes], ["ACRelated", Related]].forEach(function (x) { reg[x[0]] = pageType(x[1]); reg[x[0]].type = x[0]; });
  G.mount(spec, ROOT, { me: window.AntCityKernel, gui: Object.assign({}, G, { render: undefined, RunMe: undefined, Theme: PageTheme, registry: reg }), devtools: { enabled: true, inspector: false, adminView: false, inspectorToggleVisible: false } });
  document.documentElement.classList.add("gui-on");
  window.__ac = { K: K, ants: ants, select: select };
})();
