/*! llms-hero · the me://LLMS hero, live: one real eval item (e24), its .me ops and the state they produce · MIT · neurons.me
 * landing-gui.js renders <figure class="page-hero" data-live="LlmsHero"> as this component (window.LandingLive).
 * Every link between the sentence, the code and the graph is derived from the ops: code tokens carry the path the
 * tokenizer walked to (window.MeSyntax.tokenize), graph nodes carry the path of the state they draw, and a word links
 * to the paths whose key (or set value) it names. Hover, focus or tap any of them to see the rest.
 */
(function (root) {
  var React = root.React; if (!React) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect;

  // e24 in each language with a starting state in that language's keys, and the ops the Meta adapter (muse-spark-1.3)
  // actually returned for it: only the languages that passed the structural dry-run check
  // (eval/results/multilang-native-e24-2026-10-29.json). [word|role] marks the words (eval/multilang-native-e24.json);
  // each role resolves to a path of that language's own ops: pr = the set path, p = its parent, v = its value,
  // m = the define path, t = the derived key, c = the other price's parent.
  var LANGS = [{"lang": "en", "name": "English", "text": "change the [price|pr] of [bread|p] to [25|v] and make the [menu|m] [total|t] [coffee|c] plus [bread|p]", "state": {"menu": {"coffee": {"price": 45}, "bread": {"price": 20}}}, "ops": [{"op": "set", "path": "menu.bread.price", "value": 25}, {"op": "define", "path": "menu", "name": "total", "expr": "coffee.price + bread.price"}]}, {"lang": "es", "name": "Español", "text": "cambia el [precio|pr] del [pan|p] a [25|v] y que el [total|t] del [menú|m] sea [café|c] más [pan|p]", "state": {"menu": {"cafe": {"precio": 45}, "pan": {"precio": 20}}}, "ops": [{"op": "set", "path": "menu.pan.precio", "value": 25}, {"op": "define", "path": "menu", "name": "total", "expr": "menu.cafe.precio + menu.pan.precio"}]}, {"lang": "fr", "name": "Français", "text": "change le [prix|pr] du [pain|p] à [25|v] et que le [total|t] du [menu|m] soit [café|c] plus [pain|p]", "state": {"menu": {"cafe": {"prix": 45}, "pain": {"prix": 20}}}, "ops": [{"op": "set", "path": "menu.pain.prix", "value": 25}, {"op": "define", "path": "menu", "name": "total", "expr": "cafe.prix + pain.prix"}]}, {"lang": "de", "name": "Deutsch", "text": "ändere den [Preis|pr] des [Brots|p] auf [25|v], und die [Summe|t] des [Menüs|m] soll [Kaffee|c] plus [Brot|p] sein", "state": {"menue": {"kaffee": {"preis": 45}, "brot": {"preis": 20}}}, "ops": [{"op": "set", "path": "menue.brot.preis", "value": 25}, {"op": "define", "path": "menue", "name": "summe", "expr": "menue.kaffee.preis + menue.brot.preis"}]}, {"lang": "it", "name": "Italiano", "text": "cambia il [prezzo|pr] del [pane|p] a [25|v] e fai che il [totale|t] del [menù|m] sia [caffè|c] più [pane|p]", "state": {"menu": {"caffe": {"prezzo": 45}, "pane": {"prezzo": 20}}}, "ops": [{"op": "set", "path": "menu.pane.prezzo", "value": 25}, {"op": "define", "path": "menu", "name": "totale", "expr": "caffe.prezzo + pane.prezzo"}]}, {"lang": "pt", "name": "Português", "text": "muda o [preço|pr] do [pão|p] para [25|v] e que o [total|t] do [menu|m] seja [café|c] mais [pão|p]", "state": {"cardapio": {"cafe": {"preco": 45}, "pao": {"preco": 20}}}, "ops": [{"op": "set", "path": "cardapio.pao.preco", "value": 25}, {"op": "define", "path": "cardapio", "name": "total", "expr": "cafe.preco + pao.preco"}]}];
  var get = function (o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var ID = /[\p{L}_$][\p{L}\p{N}_$.-]*/gu;

  function build(L) {
    var state = clone(L.state), derived = {}, setOp = null, defOp = null;
    L.ops.forEach(function (o) {
      if (o.op === "set") { setOp = o; var ks = o.path.split("."), last = ks.pop(), t = ks.reduce(function (a, k) { return a[k] = a[k] || {}; }, state); t[last] = o.value; }
      if (o.op === "define") {
        defOp = o;
        var deps = (o.expr.match(ID) || []).map(function (r) { return r.indexOf(o.path + ".") === 0 ? r : o.path + "." + r; });
        var val = deps.reduce(function (s, d) { return s + Number(get(state, d)); }, 0); // a sum of two paths (checked by the eval)
        get(state, o.path)[o.name] = val; derived[o.path + "." + o.name] = { deps: deps, base: o.path, value: val };
      }
    });
    var rootKey = defOp.path, t = rootKey + "." + defOp.name, pr = setOp.path, p = pr.split(".").slice(0, -1).join(".");
    var other = derived[t].deps.filter(function (d) { return d !== pr; })[0], c = other.split(".").slice(0, -1).join(".");
    var ROLE = { m: rootKey, c: c, p: p, pr: pr, v: pr + "=", t: t };
    var segs = [], re = /\[([^|\]]+)\|([^\]]+)\]/g, i = 0, mm;
    while ((mm = re.exec(L.text))) { if (mm.index > i) segs.push({ t: L.text.slice(i, mm.index) }); segs.push({ t: mm[1], k: ROLE[mm[2]] }); i = re.lastIndex; }
    if (i < L.text.length) segs.push({ t: L.text.slice(i) });
    var lines = L.ops.map(function (o) { return o.op === "set" ? "me." + o.path + "(" + JSON.stringify(o.value) + ")" : "me." + o.path + '["="](' + JSON.stringify(o.name) + ", " + JSON.stringify(o.expr) + ")"; });
    // graph: fixed positions by role (other item top, derived middle, the item whose price is set bottom), labels from the keys
    var last = function (x) { return x.split(".").pop(); };
    var N = [{ k: rootKey, label: rootKey, x: 62, y: 128, kind: "root" }], E = [], VAL = [];
    [[c, 48, false], [t, 128, true], [p, 208, false]].forEach(function (r) {
      var k = r[0], y = r[1], d = r[2];
      N.push({ k: k, label: last(k), x: d ? 168 : 152, y: y, kind: d ? "derived" : "key", value: d ? derived[t].value : null });
      E.push({ k: k, from: rootKey, to: k });
      var v = get(state, k);
      if (v && typeof v === "object") Object.keys(v).forEach(function (leaf) { var lp = k + "." + leaf; VAL.push({ k: lp + "=", path: lp, label: String(v[leaf]), x: 268, y: y, key: leaf }); E.push({ k: lp, from: k, to: lp + "=", label: leaf }); });
    });
    var pos = {}; N.concat(VAL).forEach(function (n) { pos[n.k] = n; });
    var DEP = []; Object.keys(derived).forEach(function (x) { derived[x].deps.forEach(function (d) { DEP.push({ from: d + "=", to: x, dep: d }); }); });
    return { L: L, state: state, derived: derived, rootKey: rootKey, q: t, segs: segs, lines: lines, N: N, E: E, VAL: VAL, pos: pos, DEP: DEP, code: null };
  }
  var MODELS = LANGS.map(build);

  // the code lines, written from the ops, then tokenized; each token learns the path it is on
  function tagged(code, root0) {
    var M = root.MeSyntax, toks = M ? M.tokenize(code) : [{ c: null, v: code }], path = [], fx = [], base = "", out = [], callPath = null;
    toks.forEach(function (t) {
      var c = t.c || "", k = null;
      if (/mes-root/.test(c)) { path = []; }
      else if (/mes-fx-id/.test(c)) { fx.push(t.v); k = fx[0] === root0 ? fx.join(".") : base + "." + fx.join("."); }
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
  function codeOf(G) { if (G.code && root.MeSyntax) return G.code; var c = G.lines.map(function (l) { return tagged(l, G.rootKey); }), ql = tagged('me("' + G.q + '")', G.rootKey);
    ql.push({ c: "mes-comment", v: " // → " }, { c: "mes-num", v: String(G.derived[G.q].value), k: G.q }); c.push(ql); if (root.MeSyntax) G.code = c; return c; }


  // relation: what lights for the active path
  var derived = {}, rootKey = "", state = {}; // the current language (set on each render)
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
  var CSS = ".lh-card{border:1px solid " + GRID + ";border-radius:16px;padding:clamp(20px,4vw,44px);background:linear-gradient(135deg," + mix(ACC, 7, "transparent") + ",transparent 55%)}" +
    ".lh-title{font-size:clamp(44px,7vw,76px);font-weight:800;letter-spacing:-.02em;line-height:1;margin:0;color:" + FG + "}" +
    ".lh-sub{font-family:" + MONO + ";font-size:clamp(15px,1.8vw,20px);color:" + FG2 + ";margin:10px 0 clamp(20px,3vw,34px)}.lh-acc{color:" + ACC + "}" +
    ".lh{display:grid;grid-template-columns:1fr auto 1.15fr auto 1.15fr;gap:14px;align-items:stretch;color:" + FG + "}" +
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
    ".lh-sayhd{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 10px;margin:0 0 14px}.lh-sayhd .lh-h{margin:0}" +
    ".lh-langs{display:flex;flex-wrap:wrap;gap:4px}" +
    ".lh-pill{font:600 10px/1 " + MONO + ";letter-spacing:.04em;padding:4px 6px;border-radius:999px;border:1px solid " + GRID + ";background:transparent;color:" + FG2 + ";cursor:pointer}" +
    ".lh-lname{display:inline-block;color:" + ACC + "}" +
    ".lh-pill:hover{color:" + FG + "}.lh-pill.on{border-color:" + ACC + ";color:" + ACC + ";background:" + mix(ACC, 12, "transparent") + "}" +
    ".lh-say,.lh-fade{animation:lh-fade .45s ease both}@keyframes lh-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}" +
    ".lh-say:lang(ja),.lh-say:lang(zh),.lh-say:lang(ko){font-family:'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans','PingFang SC','Microsoft YaHei','Malgun Gothic',sans-serif;line-break:strict}" +
    ".lh-say:lang(ar){font-family:'Noto Sans Arabic','Segoe UI','Geeza Pro',sans-serif;line-height:1.7}.lh-say:lang(hi){font-family:'Noto Sans Devanagari','Nirmala UI',sans-serif;line-height:1.6}" +
    ".lh-same{font:600 10px/1 " + MONO + ";color:" + ACC + ";opacity:.75}.lh-same.go{animation:lh-same 1.6s ease both}@keyframes lh-same{0%{opacity:0}20%{opacity:1}100%{opacity:.75}}" +
    ".lh-pulse{animation:lh-pulse 1.1s ease}@keyframes lh-pulse{0%{filter:drop-shadow(0 0 0 transparent)}35%{filter:drop-shadow(0 0 6px " + mix(ACC, 70, "transparent") + ")}100%{filter:drop-shadow(0 0 0 transparent)}}" +
    "@media (prefers-reduced-motion:reduce){.lh-say,.lh-fade,.lh-pulse,.lh-same.go{animation:none}}" +
    "@media (max-width:860px){.lh{grid-template-columns:1fr}.lh-ar{transform:rotate(90deg);justify-self:center;line-height:1}}";

  function LlmsHero() {
    var st = useState(null), hov = st[0], setHov = st[1];
    var sp = useState(null), pin = sp[0], setPin = sp[1];
    var a = hov || pin;
    var sl = useState(0), li = sl[0], setLi = sl[1];
    var sh = useState(false), hold = sh[0], setHold = sh[1];
    useEffect(function () { if (hold || pin) return; var t = setTimeout(function () { setLi((li + 1) % LANGS.length); }, 4000); return function () { clearTimeout(t); }; }, [li, hold, pin]);
    var L = LANGS[li], G = MODELS[li], N = G.N, E = G.E, VAL = G.VAL, DEP = G.DEP, pos = G.pos;
    derived = G.derived; rootKey = G.rootKey; state = G.state;
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

    var words = G.segs.map(function (g, i) {
      return g.k ? h("span", Object.assign({ key: i, className: "lh-w" + rel(g.k, a) }, bind(g.k, "“" + g.t + "” → " + desc(g.k), true)), g.t) : g.t;
    });
    var pills = h("div", { className: "lh-langs", role: "tablist", "aria-label": "language" }, LANGS.map(function (l, i) {
      return h("button", { key: l.lang, type: "button", role: "tab", "aria-selected": i === li, lang: l.lang, className: "lh-pill" + (i === li ? " on" : ""), title: l.name, onClick: function () { setLi(i); } }, l.lang.toUpperCase()); }));
    var codeEls = codeOf(G).map(function (ln, i) {
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
    return h("section", { className: "lh-card", onMouseEnter: function () { setHold(true); }, onMouseLeave: function () { setHold(false); },
        onFocus: function () { setHold(true); }, onBlur: function () { setHold(false); } },
      h("h1", { className: "lh-title" }, "LLMS"),
      h("p", { className: "lh-sub" }, "natural language ", h("span", { className: "lh-acc" }, "→"), " .me"),
      h("div", { className: "lh", "aria-label": "e24: a sentence, the .me ops it becomes, and the state they produce" },
      h("div", { className: "lh-p" }, h("div", { className: "lh-sayhd" }, h("p", { className: "lh-h" }, "You say it in ", h("span", { key: "n" + L.lang, className: "lh-lname lh-fade" }, L.name)), pills), h("p", { key: L.lang, className: "lh-say", lang: L.lang, dir: L.dir || "ltr" }, "“", words, "”")),
      h("div", { className: "lh-ar", "aria-hidden": true }, "→"),
      h("div", { className: "lh-p" }, h("p", { className: "lh-h" }, ".me ops"), h("pre", { key: "c" + li, className: "lh-code me-code lh-fade" }, h("span", { className: "ln lh-cm" }, "// validated · dry-run"), codeEls)),
      h("div", { className: "lh-ar", "aria-hidden": true }, "→"),
      h("div", { className: "lh-p" }, h("div", { className: "lh-sayhd" }, h("p", { className: "lh-h" }, "State"), h("span", { key: "s" + li, className: "lh-same" + (li ? " go" : "") }, "same structure · = " + G.derived[G.q].value)), h("div", { key: "g" + li, className: li ? "lh-pulse" : "" }, svg)),
      h("p", { className: "lh-hint", "aria-live": "polite" }, a ? ["● ", h("b", { key: "b" }, desc(a))] : "hover, tap or tab through a word, a token or a node")));
  }
  root.LandingLive = Object.assign(root.LandingLive || {}, { LlmsHero: LlmsHero });
})(typeof window !== "undefined" ? window : this);
