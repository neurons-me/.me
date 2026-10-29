/*! llms-hero · the me://LLMS hero, live: one real eval item (e24), its .me ops and the state they produce · MIT · neurons.me
 * landing-gui.js renders <figure class="page-hero" data-live="LlmsHero"> as this component (window.LandingLive).
 * Every link between the sentence, the code and the graph is derived from the ops: code tokens carry the path the
 * tokenizer walked to (window.MeSyntax.tokenize), graph nodes carry the path of the state they draw, and a word links
 * to the paths whose key (or set value) it names. Hover, focus or tap any of them to see the rest.
 */
(function (root) {
  var React = root.React; if (!React) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect;

  // eval item e24 (LLMS/eval): sentence, starting state, validated ops
  var ITEM = {
    say: "cambia el precio del pan a 25 y que el total del menú sea café más pan",
    state: { menu: { cafe: { precio: 45 }, pan: { precio: 20 } } },
    ops: [{ op: "set", path: "menu.pan.precio", value: 25 }, { op: "define", path: "menu", name: "total", expr: "cafe.precio + pan.precio" }]
  };

  var norm = function (w) { return w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var get = function (o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  // apply the ops: set writes a value, define records a derived key (base path, expr, the absolute paths it reads)
  var state = clone(ITEM.state), derived = {};
  ITEM.ops.forEach(function (o) {
    if (o.op === "set") { var ks = o.path.split("."), last = ks.pop(), t = ks.reduce(function (a, k) { return a[k] = a[k] || {}; }, state); t[last] = o.value; }
    if (o.op === "define") {
      var base = get(state, o.path), deps = (o.expr.match(/[A-Za-z_][\w.]*/g) || []).map(function (r) { return o.path + "." + r; });
      var val = deps.reduce(function (s, d) { return s + Number(get(state, d)); }, 0); // the expr is a sum of paths (e24)
      base[o.name] = val; derived[o.path + "." + o.name] = { deps: deps, base: o.path, value: val };
    }
  });
  var setPaths = ITEM.ops.filter(function (o) { return o.op === "set"; }).map(function (o) { return o.path; });

  var allPaths = [];
  (function walk(o, pre) { Object.keys(o).forEach(function (k) { var p = pre ? pre + "." + k : k; allPaths.push(p); if (o[k] && typeof o[k] === "object") walk(o[k], p); }); })(state, "");

  // a word → paths: a number names the set op that writes it; a word names the paths whose last key it is
  // (preferring the paths the ops write, so "precio del pan" is menu.pan.precio, not every precio)
  function wordPath(w) {
    if (/^\d+$/.test(w)) { var o = ITEM.ops.filter(function (x) { return x.op === "set" && String(x.value) === w; })[0]; return o ? o.path + "=" : null; }
    var n = norm(w), hits = allPaths.filter(function (p) { return p.split(".").pop() === n; });
    if (hits.length > 1) { var s = hits.filter(function (p) { return setPaths.indexOf(p) >= 0; }); if (s.length) hits = s; }
    return hits[0] || null;
  }

  // the code lines, written from the ops, then tokenized; each token learns the path it is on
  var lines = ITEM.ops.map(function (o) { return o.op === "set" ? "me." + o.path + "(" + JSON.stringify(o.value) + ")" : "me." + o.path + '["="](' + JSON.stringify(o.name) + ", " + JSON.stringify(o.expr) + ")"; });
  var q = Object.keys(derived)[0];
  function tagged(code) {
    var M = root.MeSyntax, toks = M ? M.tokenize(code) : [{ c: null, v: code }], path = [], fx = [], base = "", out = [], callPath = null;
    toks.forEach(function (t) {
      var c = t.c || "", k = null;
      if (/mes-root/.test(c)) { path = []; }
      else if (/mes-fx-id/.test(c)) { fx.push(t.v); k = base + "." + fx.join("."); }
      else if (/mes-in-fx/.test(c) && /mes-quote/.test(c)) { fx = []; }
      else if (/mes-in-fx/.test(c) && !/mes-dot/.test(c)) { fx = []; }
      else if (/mes-key/.test(c)) { path.push(t.v); k = path.join("."); base = k; callPath = k; }
      else if (/mes-op/.test(c)) { base = path.join("."); }
      else if (/mes-def/.test(c)) { k = base + "." + JSON.parse(t.v); }
      else if (/mes-num/.test(c) && callPath) { k = callPath + "="; }
      out.push({ c: c, v: t.v, k: k });
    });
    return out;
  }
  var CODE = null; // tokenized on first render, once window.MeSyntax (loaded by landing-gui.js) is there
  function code() { if (CODE && root.MeSyntax) return CODE; var c = lines.map(tagged), ql = tagged('me("' + q + '")');
    ql.push({ c: "mes-comment", v: " // → " }, { c: "mes-num", v: String(derived[q].value), k: q }); c.push(ql); if (root.MeSyntax) CODE = c; return c; }

  // graph: the root, its children (derived keys in the middle), leaf values right of their parent
  var rootKey = Object.keys(state)[0], kids = Object.keys(state[rootKey]);
  kids.sort(function (a, b) { var da = derived[rootKey + "." + a] ? 1 : 0, db = derived[rootKey + "." + b] ? 1 : 0; return da - db; });
  if (kids.length === 3) kids = [kids[0], kids[2], kids[1]];
  var N = [{ k: rootKey, label: rootKey, x: 62, y: 128, kind: "root" }], E = [], VAL = [];
  kids.forEach(function (c, i) {
    var p = rootKey + "." + c, y = 48 + i * (160 / Math.max(1, kids.length - 1)), d = derived[p];
    N.push({ k: p, label: c, x: d ? 168 : 152, y: y, kind: d ? "derived" : "key", value: d ? d.value : null });
    E.push({ k: p, from: rootKey, to: p });
    var v = state[rootKey][c];
    if (v && typeof v === "object") Object.keys(v).forEach(function (leaf) { var lp = p + "." + leaf; VAL.push({ k: lp + "=", path: lp, label: String(v[leaf]), x: 268, y: y, key: leaf }); E.push({ k: lp, from: p, to: lp + "=", label: leaf }); });
  });
  var pos = {}; N.concat(VAL).forEach(function (n) { pos[n.k] = n; });
  var DEP = []; Object.keys(derived).forEach(function (t) { derived[t].deps.forEach(function (d) { DEP.push({ from: d + "=", to: t, dep: d }); }); });

  // relation: what lights for the active path
  var bare = function (k) { return k ? k.replace(/=$/, "") : k; };
  function rel(el, a) {
    if (!a || !el) return "";
    if (el === a) return " on";
    var A = bare(a), B = bare(el);
    if (A === B) return " on";
    if (B.indexOf(A + ".") === 0) return " rel";
    if (derived[A] && derived[A].deps.indexOf(B) >= 0) return " rel";
    if (derived[B] && derived[B].deps.indexOf(A) >= 0) return " rel";
    return "";
  }
  function depOn(e, a) { if (!a) return ""; var A = bare(a); return A === e.to || A === e.dep || e.dep.indexOf(A + ".") === 0 ? " on" : ""; }
  function edgeOn(e, a) { if (!a) return ""; var A = bare(a); return A === e.k || (e.k.indexOf(A + ".") === 0 && A !== rootKey) ? " on" : ""; }

  var V = function (n, fb) { return "var(--mui-palette-" + n + ", " + fb + ")"; };
  var FG = V("text-primary", "currentColor"), FG2 = V("text-secondary", "#8b949e"), GRID = V("divider", "rgba(127,127,127,.25)");
  var ACC = V("primary-main", "#4fd1c5"), PAPER = V("background-paper", "transparent");
  var SYN = function (r, fb) { return "var(--me-syn-" + r + ", " + fb + ")"; };
  var PATHC = SYN("path", "#79c0ff"), NUM = SYN("number", "#d29922"), DER = SYN("derived", "#a371f7");
  var mix = function (a, p, b) { return "color-mix(in srgb, " + a + " " + p + "%, " + b + ")"; };
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var CSS = ".lh{display:grid;grid-template-columns:1fr auto 1.15fr auto 1.15fr;gap:14px;align-items:stretch;color:" + FG + "}" +
    ".lh-p{border:1px solid " + GRID + ";border-radius:12px;padding:16px 18px;background:" + PAPER + ";min-width:0}" +
    ".lh-h{font-family:" + MONO + ";font-size:11px;letter-spacing:.12em;color:" + FG2 + ";margin:0 0 14px;text-transform:uppercase}" +
    ".lh-ar{align-self:center;color:" + ACC + ";font-size:20px}" +
    ".lh-say{font-size:clamp(18px,2vw,22px);font-weight:700;line-height:1.4;margin:0}" +
    ".lh-w{cursor:pointer;border-radius:4px;padding:0 2px;margin:0 -2px;text-decoration:underline dotted " + mix(ACC, 55, "transparent") + ";text-underline-offset:4px;transition:background .12s,color .12s}" +
    ".lh-w.on{background:" + mix(ACC, 22, "transparent") + ";color:" + FG + ";text-decoration-color:" + ACC + "}" +
    ".lh-w.rel{background:" + mix(ACC, 10, "transparent") + "}" +
    ".lh :focus-visible{outline:2px solid " + ACC + ";outline-offset:2px}" +
    ".lh-code{font-family:" + MONO + ";font-size:13px;line-height:1.7;margin:0;white-space:pre-wrap;word-break:break-word}" +
    ".lh-code .ln{display:block}.lh-code .ln+.ln{margin-top:2px}.lh-cm{color:" + SYN("comment", "#8b949e") + ";font-style:italic}" +
    ".lh-t[data-k]{cursor:pointer;border-radius:3px;transition:background .12s,box-shadow .12s}" +
    ".lh-t.on{background:" + mix(ACC, 25, "transparent") + ";box-shadow:0 0 0 1px " + ACC + "}" +
    ".lh-t.rel{background:" + mix(ACC, 10, "transparent") + "}" +
    ".lh svg{width:100%;height:auto;display:block;overflow:visible}" +
    ".lh-n{cursor:pointer}.lh-n circle{fill:" + PAPER + ";stroke-width:1.6;transition:stroke-width .12s,fill .12s}" +
    ".lh-n text{font-family:" + MONO + ";font-size:11px;fill:" + FG + ";text-anchor:middle;dominant-baseline:central;pointer-events:none}" +
    ".lh-n.on circle{stroke-width:3.2;fill:" + mix(ACC, 18, "transparent") + "}.lh-n.rel circle{stroke-width:2.4}" +
    ".lh-n:focus{outline:none}.lh-n:focus-visible circle{stroke-dasharray:3 2;stroke-width:3.2}" +
    ".lh-e{stroke:" + mix(FG2, 55, "transparent") + ";stroke-width:1.3;fill:none;transition:stroke .12s,stroke-width .12s}" +
    ".lh-e.on{stroke:" + ACC + ";stroke-width:2.6}" +
    ".lh-d{stroke:" + DER + ";stroke-width:1.4;stroke-dasharray:4 3;fill:none;opacity:.75}.lh-d.on{stroke-width:2.6;opacity:1}" +
    ".lh-el{font-family:" + MONO + ";font-size:9.5px;fill:" + FG2 + ";text-anchor:middle}.lh-el.on{fill:" + ACC + ";font-weight:700}" +
    ".lh-hint{grid-column:1/-1;font-family:" + MONO + ";font-size:12px;color:" + FG2 + ";min-height:1.4em;margin:2px 2px 0}" +
    ".lh-hint b{color:" + PATHC + ";font-weight:600}" +
    "@media (max-width:860px){.lh{grid-template-columns:1fr}.lh-ar{transform:rotate(90deg);justify-self:center;line-height:1}}";

  function LlmsHero() {
    var st = useState(null), hov = st[0], setHov = st[1];
    var sp = useState(null), pin = sp[0], setPin = sp[1];
    var a = hov || pin;
    useEffect(function () {
      if (!document.getElementById("lh-css")) { var s = document.createElement("style"); s.id = "lh-css"; s.textContent = CSS; document.head.appendChild(s); }
      var off = function (e) { if (!e.target.closest || !e.target.closest("[data-k]")) setPin(null); };
      document.addEventListener("pointerdown", off); return function () { document.removeEventListener("pointerdown", off); };
    }, []);
    var bind = function (k, label, focusable) {
      var p = { "data-k": k, onMouseEnter: function () { setHov(k); }, onMouseLeave: function () { setHov(null); },
        onClick: function () { setPin(pin === k ? null : k); } };
      if (focusable) Object.assign(p, { tabIndex: 0, role: "button", "aria-label": label, "aria-pressed": pin === k,
        onFocus: function () { setHov(k); }, onBlur: function () { setHov(null); },
        onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPin(pin === k ? null : k); } if (e.key === "Escape") setPin(null); } });
      return p;
    };
    var desc = function (k) { return bare(k) + (/=$/.test(k) ? " = " + get(state, bare(k)) : derived[k] ? " = " + derived[k].deps.join(" + ") + " → " + derived[k].value : ""); };

    var words = ITEM.say.split(/(\s+)/).map(function (w, i) {
      var k = /\S/.test(w) ? wordPath(w) : null;
      return k ? h("span", Object.assign({ key: i, className: "lh-w" + rel(k, a) }, bind(k, "“" + w + "” → " + desc(k), true)), w) : w;
    });
    var codeEls = code().map(function (ln, i) {
      return h("span", { key: i, className: "ln" }, ln.map(function (t, j) {
        if (t.c === "mes-comment") return h("span", { key: j, className: "lh-cm" }, t.v);
        return h("span", Object.assign({ key: j, className: (t.c + " lh-t" + rel(t.k, a)).trim() }, t.k ? bind(t.k, null, false) : {}), t.v);
      }));
    });
    var col = function (n) { return n.kind === "root" ? ACC : n.kind === "derived" ? DER : n.label ? PATHC : NUM; };
    var node = function (n, r, val) {
      return h("g", Object.assign({ key: n.k, className: "lh-n" + rel(n.k, a), transform: "translate(" + n.x + "," + n.y + ")" }, bind(n.k, (val ? n.path + " = " : "") + desc(n.k), true)),
        h("circle", { r: r, stroke: val ? NUM : col(n) }), h("text", null, n.label));
    };
    var svg = h("svg", { viewBox: "0 0 320 250", role: "group", "aria-label": "state after the ops" },
      E.map(function (e) { var f = pos[e.from], t = pos[e.to]; return h("g", { key: "e" + e.k },
        h("line", { className: "lh-e" + edgeOn(e, a), x1: f.x, y1: f.y, x2: t.x, y2: t.y }),
        e.label && h("text", { className: "lh-el" + edgeOn(e, a), x: (f.x + t.x) / 2 + 4, y: f.y - 8 }, e.label)); }),
      DEP.map(function (d, i) { var f = pos[d.from], t = pos[d.to], mx = (f.x + t.x) / 2 + 30, my = (f.y + t.y) / 2;
        return h("path", { key: "d" + i, className: "lh-d" + depOn(d, a), d: "M" + (f.x - 4) + "," + (f.y + (t.y > f.y ? 16 : -16)) + " Q" + mx + "," + my + " " + (t.x + 22) + "," + t.y, markerEnd: "url(#lh-arr)" }); }),
      h("defs", null, h("marker", { id: "lh-arr", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 8, markerHeight: 8, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, h("path", { d: "M0,0 L10,5 L0,10 z", fill: DER }))),
      N.map(function (n) { return h("g", { key: "n" + n.k }, node(n, n.kind === "root" ? 22 : 18, false),
        n.value != null && h("text", { className: "lh-el", x: n.x, y: n.y + 32, style: { fontSize: "11px", fill: DER } }, "= " + n.value)); }),
      VAL.map(function (v) { return node(v, 15, true); }));
    return h("div", { className: "lh", "aria-label": "e24: a sentence, the .me ops it becomes, and the state they produce" },
      h("div", { className: "lh-p" }, h("p", { className: "lh-h" }, "You say"), h("p", { className: "lh-say", lang: "es" }, "“", words, "”")),
      h("div", { className: "lh-ar", "aria-hidden": true }, "→"),
      h("div", { className: "lh-p" }, h("p", { className: "lh-h" }, ".me ops"), h("pre", { className: "lh-code me-code" }, h("span", { className: "ln lh-cm" }, "// validated · dry-run"), codeEls)),
      h("div", { className: "lh-ar", "aria-hidden": true }, "→"),
      h("div", { className: "lh-p" }, h("p", { className: "lh-h" }, "State"), svg),
      h("p", { className: "lh-hint", "aria-live": "polite" }, a ? ["● ", h("b", { key: "b" }, desc(a))] : "hover, tap or tab through a word, a token or a node"));
  }
  root.LandingLive = Object.assign(root.LandingLive || {}, { LlmsHero: LlmsHero });
})(typeof window !== "undefined" ? window : this);
