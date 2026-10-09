/*! me-syntax 1.1.0 · a small, dependency-free syntax highlighter for .me code (this.me) · MIT · neurons.me
 *
 * Usage
 *   <link rel="stylesheet" href="https://neurons-me.github.io/.me/assets/me-syntax/me-syntax.css">
 *   <script src="https://neurons-me.github.io/.me/assets/me-syntax/me-syntax.js"></script>
 *   MeSyntax.highlightAll()                    // every <code class="language-me">, [data-me-code], pre.me-code
 *   MeSyntax.highlight(el)                     // one element: its text is re-built as coloured spans
 *   MeSyntax.toHTML(code)                      // escaped HTML string (static generators)
 *   MeSyntax.render(React.createElement, code) // React children (no innerHTML)
 *   MeSyntax.tokenize(code)                    // [{ c: "mes-…" | null, v: "text" }], the v's join back to code exactly
 *   render / highlight / toHTML(code, { resolve(path, ctx) → id, ctx, selected, onSelect(id, e) })
 *                                              // tokens naming an instance (robots[1], rocks.b612, objects.ice)
 *                                              // become keyboard-reachable buttons; the text stays the same
 *
 * Safety: the text is never changed (the spans only add colour, and <wbr> break hints carry no text), so
 * element.textContent and copy / paste give the original code. highlight() and render() build DOM nodes / React
 * elements, never innerHTML; toHTML() escapes & < > " '.
 */
(function (root) {
  "use strict";
  var OP_TOKEN = /^\[\s*(["'])(?:\[i\]|_|[^A-Za-z0-9_$\s"'\\]+|\[[^\]]*\])\1\s*\]$/;      // ["="] ["->"] ["[i]"] ["@"] ["_"] ["~"] ...
  var KEYWORDS = { "const": 1, "let": 1, "var": 1, "new": 1, "await": 1, "async": 1, "return": 1, "import": 1, "export": 1, "function": 1 };
  var VALUES = { "true": "mes-true", "false": "mes-false", "null": "mes-null", "undefined": "mes-null", "NaN": "mes-num", "Infinity": "mes-num" };
  var FX_OPS = ["===", "!==", "==", "!=", "<=", ">=", "&&", "||", "->", "=>", "<", ">", "!", "+", "-", "*", "/", "%", "?", ":", "="];

  function isIdStart(ch) { return /[A-Za-z_$]/.test(ch); }
  function isId(ch) { return /[A-Za-z0-9_$]/.test(ch); }

  // a string's inside: a formula ("mines && objects.ice.seen") or a path / query ("robots[canProceed == true].name")
  function inner(text, idClass, extra, out) {
    var i = 0, n = text.length, prevDot = false;
    while (i < n) {
      var ch = text[i], m;
      if (/\s/.test(ch)) { m = /^\s+/.exec(text.slice(i))[0]; out.push({ c: extra || null, v: m }); i += m.length; continue; }
      if (/[0-9]/.test(ch) && !prevDot) { m = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))[0]; out.push({ c: "mes-num" + (extra ? " " + extra : ""), v: m }); i += m.length; continue; }
      if (isIdStart(ch) || (/[0-9]/.test(ch) && prevDot)) {
        m = /^[A-Za-z0-9_$]+/.exec(text.slice(i))[0];
        out.push({ c: (VALUES[m] && !prevDot ? VALUES[m] : idClass) + (extra ? " " + extra : ""), v: m }); i += m.length; prevDot = false; continue;
      }
      if (ch === ".") { out.push({ c: "mes-punct mes-dot" + (extra ? " " + extra : ""), v: "." , brk: true }); i++; prevDot = true; continue; }
      if ("()[],".indexOf(ch) >= 0) { out.push({ c: "mes-punct" + (extra ? " " + extra : ""), v: ch, brk: ch === "," }); i++; prevDot = false; continue; }
      var op = null; for (var k = 0; k < FX_OPS.length; k++) if (text.substr(i, FX_OPS[k].length) === FX_OPS[k]) { op = FX_OPS[k]; break; }
      if (op) { out.push({ c: "mes-fx-op" + (extra ? " " + extra : ""), v: op, brkBefore: op === "&&" || op === "||" }); i += op.length; prevDot = false; continue; }
      out.push({ c: extra || null, v: ch }); i++; prevDot = false;
    }
  }

  function readString(code, i) {   // returns the end index (exclusive) of the string literal starting at i
    var q = code[i], j = i + 1;
    while (j < code.length) { if (code[j] === "\\") { j += 2; continue; } if (code[j] === q) return j + 1; if (q !== "`" && code[j] === "\n") return j; j++; }
    return j;
  }

  function tokenize(code) {
    code = String(code == null ? "" : code);
    var out = [], i = 0, n = code.length, prev = null, frames = [], chain = false;
    function push(c, v, more) { var t = { c: c, v: v }; if (more) for (var k in more) t[k] = more[k]; out.push(t); if (c !== null || /\S/.test(v)) prev = t; return t; }
    while (i < n) {
      var ch = code[i], rest = code.slice(i), m;
      if (/\s/.test(ch)) { m = /^\s+/.exec(rest)[0]; push(null, m); i += m.length; if (/\n/.test(m)) chain = false; continue; }
      if (rest.slice(0, 2) === "//") { m = /^\/\/[^\n]*/.exec(rest)[0]; push("mes-comment", m); i += m.length; continue; }
      if (rest.slice(0, 2) === "/*") { var e = code.indexOf("*/", i + 2); e = e < 0 ? n : e + 2; push("mes-comment", code.slice(i, e)); i = e; continue; }
      if (ch === "\u2192" || (rest.slice(0, 2) === "->" && !chain) || rest.slice(0, 2) === "=>") { var a = ch === "\u2192" ? ch : rest.slice(0, 2); push("mes-arrow", a); i += a.length; chain = false; continue; }
      if (ch === "[") {   // an operator token ["="], or a bracketed key ["name"] / index [1]
        m = /^\[\s*(["'])(?:\\.|(?!\1).)*\1\s*\]/.exec(rest);
        if (m && OP_TOKEN.test(m[0])) { push("mes-op", m[0], { brk: false }); i += m[0].length; chain = true; continue; }
        if (m) { var q0 = m[0].indexOf(m[1]), q1 = m[0].lastIndexOf(m[1]);
          push("mes-punct", m[0].slice(0, q0)); push("mes-str", m[0].slice(q0, q0 + 1)); inner(m[0].slice(q0 + 1, q1), "mes-key", null, out); push("mes-str", m[0].slice(q1, q1 + 1)); push("mes-punct", m[0].slice(q1 + 1));
          prev = out[out.length - 1]; i += m[0].length; chain = true; continue; }
        m = /^\[\s*(-?\d+)\s*\]/.exec(rest);
        if (m) { var p = m[0].indexOf(m[1]); push("mes-punct", m[0].slice(0, p)); push("mes-index", m[1]); push("mes-punct", m[0].slice(p + m[1].length)); i += m[0].length; chain = true; continue; }
        push("mes-punct", "["); i++; continue;
      }
      if (ch === "\"" || ch === "'" || ch === "`") {
        var end = readString(code, i), lit = code.slice(i, end), q = lit[0], body = lit.slice(1, lit[lit.length - 1] === q && lit.length > 1 ? -1 : undefined), closed = body.length === lit.length - 2;
        var f = frames[frames.length - 1], role = "str";
        if (f && f.kind === "def") role = f.arg === 0 ? "def" : f.arg === 1 ? "fx" : "str";
        else if (f && (f.kind === "ptr" || f.kind === "read")) role = f.arg === 0 ? "path" : "str";
        if (role === "def") push("mes-def", lit);
        else if (role === "fx" || role === "path") {
          push("mes-str mes-quote" + (role === "fx" ? " mes-in-fx" : ""), q);
          inner(body, role === "fx" ? "mes-fx-id" : "mes-key", role === "fx" ? "mes-in-fx" : null, out);
          if (closed) push("mes-str mes-quote" + (role === "fx" ? " mes-in-fx" : ""), q);
          prev = out[out.length - 1];
        } else push("mes-str", lit);
        i = end; chain = false; continue;
      }
      if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(code[i + 1] || "") && !(prev && /mes-(key|index|num|root|id)|\)/.test(prev.c + prev.v)))) {
        m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)[0]; push("mes-num", m); i += m.length; chain = false; continue;
      }
      if (isIdStart(ch)) {
        m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest)[0];
        var after = code[i + m.length] || "", afterDot = prev && prev.v === "." && /mes-dot/.test(prev.c || "");
        var cls = afterDot ? "mes-key" : m === "me" && /[.(\[]/.test(after) ? "mes-root" : VALUES[m] ? VALUES[m] : KEYWORDS[m] ? "mes-kw" : "mes-id";
        push(cls, m); i += m.length; chain = cls === "mes-root" || cls === "mes-key"; continue;
      }
      if (ch === "." ) { push("mes-punct mes-dot", ".", { brk: true }); i++; continue; }
      if (ch === "(") {
        var kind = prev && prev.c === "mes-op" ? (/"="|'='/.test(prev.v) ? "def" : /->/.test(prev.v) ? "ptr" : "call") : prev && (prev.c === "mes-root" || (prev.c === "mes-key" && /^(explain|read|get|subscribe)$/.test(prev.v))) ? "read" : "call";
        frames.push({ kind: kind, arg: 0 }); push("mes-paren", "("); i++; chain = false; continue;
      }
      if (ch === ")") { frames.pop(); push("mes-paren", ")"); i++; chain = true; continue; }
      if (ch === ",") { if (frames.length) frames[frames.length - 1].arg++; push("mes-punct", ",", { brk: true }); i++; chain = false; continue; }
      if (ch === "]") { push("mes-punct", "]"); i++; continue; }
      m = /^(===|!==|==|!=|<=|>=|&&|\|\||[=<>!+\-*\/%?:;{}·])/.exec(rest);
      if (m) { push(m[0] === "·" || m[0] === ";" || m[0] === "{" || m[0] === "}" ? "mes-punct" : "mes-fx-op", m[0]); i += m[0].length; chain = false; continue; }
      push(null, ch); i++;
    }
    return out;
  }

  // ── references: tokens that name an instance (code → object) ──
  // Every path-chain token gets t.path, the dotted path up to it: me.robots[1].home → "robots", "robots.1", "robots.1.home";
  // the same inside path strings ("rocks.b612") and formulas ("objects.ice.seen").
  function annotatePaths(toks) {
    var path = null, open = false;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i], c = " " + (t.c || "") + " ", v = t.v;
      if (c.indexOf(" mes-root ") >= 0) { path = []; open = true; continue; }
      if (c.indexOf(" mes-dot ") >= 0) { if (path) open = true; continue; }
      if (c.indexOf(" mes-key ") >= 0 || c.indexOf(" mes-fx-id ") >= 0) { if (!path || !open) path = []; path.push(v); t.path = path.join("."); open = false; continue; }
      if (c.indexOf(" mes-index ") >= 0) { if (path) { path.push(v); t.path = path.join("."); open = false; } continue; }
      if (t.c === "mes-punct" && /^\s*\[\s*$/.test(v)) { if (path) { open = true; t.seg = 1; } continue; }
      if (t.c === "mes-punct" && /^\s*\]\s*$/.test(v)) continue;
      if (t.c === "mes-str" && /^["']$/.test(v) && path) { t.seg = 1; continue; }   // the quotes of a bracketed key ["name"]
      path = null; open = false;
    }
    return toks;
  }
  // Group tokens into runs that resolve to an instance: opts.resolve(path, opts.ctx) → an id (or null).
  // The run covers the segment(s) that name it, e.g. robots[1] in me.robots[1].battery(82), or rocks.b612 in a string.
  function refItems(code, opts) {
    var toks = annotatePaths(tokenize(code)), items = [], start = -1;
    if (!opts || typeof opts.resolve !== "function") return toks.map(function (t) { return { t: t }; });
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.path == null) { if (t.seg && start < 0) start = i; else if (!/mes-dot|mes-punct|^mes-str$/.test(t.c || "") || /,/.test(t.v)) start = -1; continue; }
      if (start < 0) start = i;
      var id = opts.resolve(t.path, opts.ctx);
      if (id != null && id !== false) {
        var end = i; if (toks[i + 1] && toks[i + 1].c === "mes-punct" && /^\s*\]/.test(toks[i + 1].v) && /mes-index/.test(t.c)) end = i + 1;
        for (var j = start; j <= end; j++) toks[j].ref = String(id);
        start = -1; i = end;
      }
    }
    for (var k = 0; k < toks.length; k++) {
      var last = items[items.length - 1];
      if (toks[k].ref && last && last.ref === toks[k].ref && last.open) last.toks.push(toks[k]);
      else if (toks[k].ref) items.push({ ref: toks[k].ref, toks: [toks[k]], open: true });
      else { if (last) last.open = false; items.push({ t: toks[k] }); }
    }
    return items;
  }
  function isSel(opts, id) { var s = opts && opts.selected; return typeof s === "function" ? !!s(id) : s != null && (Array.isArray(s) ? s.indexOf(id) >= 0 : String(s) === id); }
  function refText(toks) { return toks.map(function (t) { return t.v; }).join(""); }
  function hasTextSelection(el) { try { var s = el.ownerDocument.getSelection(); return s && !s.isCollapsed && s.toString().length > 0; } catch (e) { return false; } }

  function valueClass(v) {   // the class for a result value, e.g. after "→"
    return v === true || v === "true" ? "mes-true" : v === false || v === "false" ? "mes-false" : typeof v === "number" ? "mes-num" : v == null ? "mes-null" : "mes-str";
  }

  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function tokHTML(t) { var s = t.c ? "<span class=\"" + t.c + "\">" + esc(t.v) + "</span>" : esc(t.v); return (t.brkBefore ? "<wbr>" : "") + s + (t.brk ? "<wbr>" : ""); }
  // toHTML(code, opts?): with opts.resolve, instance runs become <span class="mes-ref" data-me-ref="id" role="button"
  // tabindex="0">; wire them with bindRefs(root, onSelect) (static pages: no inline handlers).
  function toHTML(code, opts) {
    return refItems(code, opts).map(function (it) {
      if (!it.ref) return tokHTML(it.t);
      var on = isSel(opts, it.ref);
      return "<span class=\"mes-ref" + (on ? " mes-ref-on" : "") + "\" data-me-ref=\"" + esc(it.ref) + "\" role=\"button\" tabindex=\"0\" aria-pressed=\"" + on + "\" title=\"" + esc((opts.title ? opts.title(it.ref, refText(it.toks)) : "select " + refText(it.toks))) + "\">" + it.toks.map(tokHTML).join("") + "</span>";
    }).join("");
  }
  // render(h, code, opts?): React children. opts = { resolve(path, ctx) → id, ctx, selected: id | ids | (id) → bool,
  // onSelect(id, event), title(id, text) }. Click, Enter or Space on a reference calls onSelect; the text is unchanged.
  function render(h, code, opts) {
    var kids = [], n = 0;
    function tok(t) { var out = []; if (t.brkBefore) out.push(h("wbr", { key: "b" + n })); out.push(t.c ? h("span", { key: "t" + n, className: t.c }, t.v) : t.v); if (t.brk) out.push(h("wbr", { key: "a" + n })); n++; return out; }
    refItems(code, opts).forEach(function (it) {
      if (!it.ref) { kids.push.apply(kids, tok(it.t)); return; }
      var id = it.ref, on = isSel(opts, id), inner = []; it.toks.forEach(function (t) { inner.push.apply(inner, tok(t)); });
      var fire = function (e) { if (opts.onSelect) opts.onSelect(id, e); };
      kids.push(h("span", { key: "r" + n++, className: "mes-ref" + (on ? " mes-ref-on" : ""), "data-me-ref": id, role: "button", tabIndex: 0, "aria-pressed": on ? "true" : "false",
        title: opts.title ? opts.title(id, refText(it.toks)) : "select " + refText(it.toks),
        onClick: function (e) { if (hasTextSelection(e.currentTarget)) return; fire(e); },
        onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(e); } } }, inner));
    });
    return kids;
  }
  // highlight(el, opts?): in place, DOM nodes only; with opts.onSelect the references are wired too
  function highlight(el, opts) {
    if (!el || el.getAttribute("data-me-highlighted") === "1") return el;
    var code = el.textContent, doc = el.ownerDocument, frag = doc.createDocumentFragment();
    var add = function (parent, t) {
      if (t.brkBefore) parent.appendChild(doc.createElement("wbr"));
      if (t.c) { var s = doc.createElement("span"); s.className = t.c; s.textContent = t.v; parent.appendChild(s); } else parent.appendChild(doc.createTextNode(t.v));
      if (t.brk) parent.appendChild(doc.createElement("wbr"));
    };
    refItems(code, opts).forEach(function (it) {
      if (!it.ref) return add(frag, it.t);
      var r = doc.createElement("span"), on = isSel(opts, it.ref); r.className = "mes-ref" + (on ? " mes-ref-on" : "");
      r.setAttribute("data-me-ref", it.ref); r.setAttribute("role", "button"); r.setAttribute("tabindex", "0"); r.setAttribute("aria-pressed", String(on));
      r.setAttribute("title", opts.title ? opts.title(it.ref, refText(it.toks)) : "select " + refText(it.toks));
      it.toks.forEach(function (t) { add(r, t); }); frag.appendChild(r);
    });
    el.replaceChildren(frag);
    el.classList.add("me-code"); el.setAttribute("data-me-highlighted", "1");
    if (opts && opts.onSelect && !el.__meRefs) { el.__meRefs = 1; bindRefs(el, opts.onSelect); }
    return el;
  }
  // one listener for every reference under root (click, Enter, Space) → onSelect(id, event)
  function bindRefs(rootEl, onSelect) {
    var pick = function (e) { var r = e.target && e.target.closest && e.target.closest("[data-me-ref]"); return r && rootEl.contains(r) ? r : null; };
    var click = function (e) { var r = pick(e); if (r && !hasTextSelection(r)) onSelect(r.getAttribute("data-me-ref"), e); };
    var key = function (e) { var r = pick(e); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(r.getAttribute("data-me-ref"), e); } };
    rootEl.addEventListener("click", click); rootEl.addEventListener("keydown", key);
    return function () { rootEl.removeEventListener("click", click); rootEl.removeEventListener("keydown", key); };
  }
  // mark the references of the selected instance(s) under root (for pages that are not React)
  function markSelected(rootEl, selected) {
    var list = rootEl.querySelectorAll("[data-me-ref]"), o = { selected: selected };
    for (var i = 0; i < list.length; i++) { var on = isSel(o, list[i].getAttribute("data-me-ref")); list[i].classList.toggle("mes-ref-on", on); list[i].setAttribute("aria-pressed", String(on)); }
  }
  function highlightAll(rootEl, selector, opts) {
    var r = rootEl || (typeof document !== "undefined" ? document : null); if (!r) return 0;
    var list = r.querySelectorAll(selector || "code.language-me, [data-me-code], pre.me-code > code, code.me-code");
    for (var i = 0; i < list.length; i++) highlight(list[i], opts);
    return list.length;
  }
  // ── colours: one mapping layer from the active theme to --me-syn-* ──
  // Order: a theme syntax token (--mui-palette-syntax-<role> / --gui-syntax-<role>) if the theme has one; otherwise a
  // colour derived from the theme's own tokens: the first candidate hue that, mixed toward the theme's text colour as
  // little as possible, reaches WCAG 4.5:1 on the theme's background and paper and stays distinct from its neighbours.
  var ROLES = [
    ["root", ["primary", "info", "secondary"], []],
    ["true", ["success", "info"], []],
    ["false", ["error", "warning", "secondary"], ["true"]],
    ["operator", ["info", "secondary", "primary", "warning"], ["root", "true", "false"]],
    ["string", ["warning", "success", "secondary", "info"], ["true", "false", "operator", "root"]],
    ["number", ["secondary", "warning", "info", "primary", "text"], ["string", "false", "true", "operator", "root"]],
    ["derived", ["primary", "info"], ["operator", "string", "true", "false"]]
  ];
  var SAME_AS = { logic: "operator", index: "number" }, TEXT_ROLES = { path: "text-primary", formula: "text-primary", punct: "text-secondary", comment: "text-secondary", arrow: "text-secondary", null: "text-secondary", keyword: null };
  function parseColor(str, doc) {
    if (!str) return null; var el = doc.createElement("span"); el.style.color = ""; el.style.color = str; if (!el.style.color) return null;
    el.style.display = "none"; doc.body.appendChild(el); var c = getComputedStyle(el).color; doc.body.removeChild(el);
    var m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; var p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mixc(a, b, p) { return [0, 1, 2].map(function (i) { return Math.round(a[i] * p + b[i] * (1 - p)); }); }
  function lab(c) {
    var r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    var X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }
  function dist(a, b) { var A = lab(a), B = lab(b); return Math.sqrt(Math.pow(A[0] - B[0], 2) + Math.pow(A[1] - B[1], 2) + Math.pow(A[2] - B[2], 2)); }
  function hex(c) { return "#" + c.slice(0, 3).map(function (x) { return ("0" + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(""); }
  function themeColors(target) {
    var doc = (target && target.ownerDocument) || document, el = target || doc.documentElement, cs = getComputedStyle(el);
    var v = function (n) { return cs.getPropertyValue(n).trim(); }, pal = function (n) { return parseColor(v("--mui-palette-" + n) || v("--palette-" + n), doc); };
    var text = pal("text-primary") || parseColor(getComputedStyle(doc.body).color, doc) || [31, 35, 40];
    var bg = pal("background-default") || parseColor(getComputedStyle(doc.body).backgroundColor, doc) || [255, 255, 255];
    var paper = pal("background-paper") || bg, text2 = pal("text-secondary") || mixc(text, bg, 0.7);
    if (bg[3] === 0) bg = lum(text) > 0.5 ? [13, 17, 23] : [255, 255, 255];
    var out = {}, chosen = {}, notes = {};
    var minC = function (c) { return Math.min(contrast(c, bg), contrast(c, paper)); };
    ROLES.forEach(function (role) {
      var name = role[0], own = parseColor(v("--mui-palette-syntax-" + name) || v("--gui-syntax-" + name), doc);
      if (own) { chosen[name] = own; notes[name] = "theme syntax token"; return; }
      var best = null;
      var bases = role[1].filter(function (x) { return x !== "text"; }).concat(["primary", "info", "success", "warning", "secondary", "error"].filter(function (x) { return role[1].indexOf(x) < 0; }));
      if (role[1].indexOf("text") >= 0) bases.push("text"); // last resort for numbers: plain ink, distinct by being uncoloured
      bases.forEach(function (base) {
        if (best && best.ok) return; var c0 = base === "text" ? text : pal(base + "-main"); if (!c0) return;
        var c = null, p;
        for (p = 0.95; p >= 0.25; p -= 0.05) { var m = mixc(c0, text, p); if (minC(m) >= 4.6) { c = m; break; } }
        if (!c) c = mixc(c0, text, 0.25);
        var gap = role[2].reduce(function (g, o) { return chosen[o] ? Math.min(g, dist(c, chosen[o])) : g; }, 999), ok = gap >= 22;
        // the first listed hue that is distinct wins; if none is, the one furthest from its neighbours
        if (!best || (ok && !best.ok) || (!ok && !best.ok && gap > best.gap)) best = { c: c, ok: ok, gap: gap, from: base + " " + Math.round(Math.max(p, 0.25) * 100) + "%" };
      });
      chosen[name] = best ? best.c : text; notes[name] = best ? best.from + (best.ok ? "" : " (closest available)") : "text";
    });
    for (var k in chosen) out[k] = hex(chosen[k]);
    for (var s in SAME_AS) out[s] = out[SAME_AS[s]];
    for (var t in TEXT_ROLES) out[t] = t === "keyword" ? out.operator : hex(TEXT_ROLES[t] === "text-primary" ? text : text2);
    out._notes = notes; return out;
  }
  // write the mapping as --me-syn-* on <html> (or a given element); the CSS has a static fallback for pages without JS
  function syncTheme(target) {
    if (typeof document === "undefined") return null;
    var el = target || document.documentElement, map = themeColors(el);
    for (var k in map) if (k[0] !== "_") el.style.setProperty("--me-syn-" + k, map[k]);
    return map;
  }
  // keep it in sync when the theme writes new variables (attribute / <style> changes), throttled to one frame
  function watchTheme(target) {
    if (typeof MutationObserver === "undefined") return function () {};
    var queued = false, last = "", run = function () { queued = false; var cs = getComputedStyle(document.documentElement);
      var key = ["text-primary", "background-default", "background-paper", "primary-main", "info-main", "success-main", "error-main", "warning-main", "secondary-main"].map(function (n) { return cs.getPropertyValue("--mui-palette-" + n); }).join("|");
      if (key !== last) { last = key; syncTheme(target); } };
    var mo = new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(run); } });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-mui-color-scheme"] });
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    run(); return function () { mo.disconnect(); };
  }
  var api = { version: "1.1.0", tokenize: tokenize, toHTML: toHTML, render: render, highlight: highlight, highlightAll: highlightAll, valueClass: valueClass, escape: esc,
    paths: function (code) { return annotatePaths(tokenize(code)); }, refs: refItems, bindRefs: bindRefs, markSelected: markSelected,
    themeColors: themeColors, syncTheme: syncTheme, watchTheme: watchTheme, contrast: contrast };
  root.MeSyntax = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
