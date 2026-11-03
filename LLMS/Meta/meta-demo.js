/*! meta-demo · LLMS hackathon demo: sentence -> Meta Muse Spark ops -> validate -> dry-run -> confirm, on a real this.me · MIT · neurons.me
 * Mounted by landing-gui.js from <div data-live="MetaDemo"> (window.LandingLive.MetaDemo). validate/paths/kernel below are a
 * line-by-line port of LLMS/typescript/src/{paths,validate,kernel}.ts to browser JS; the kernel is this.me@4.2.1 (jsDelivr UMD).
 * Recorded mode replays the ops muse-spark-1.3 returned in eval run 2026-10-29 (demo-data.js, generated from LLMS/eval/results).
 * Live mode calls https://api.meta.ai/v1/chat/completions from the browser with a key the visitor types (kept in sessionStorage).
 */
(function (root) {
  var React = root.React; if (!React) return;
  var D = root.MetaDemoData || { recorded: [], examples: [], system: "" };
  var API = "https://api.meta.ai/v1/chat/completions", MODEL = "muse-spark-1.3";
  var CHIPS = ["e24", "e07", "e05", "e23", "e20"];

  // ── paths.ts ──
  var NAME = /^[\p{L}_$][\p{L}\p{N}_$-]*$/u, SEG = /^([\p{L}_$][\p{L}\p{N}_$-]*)(\[(\d+|i)\])?$/u;
  var OPS_SEG = new Set(["_", "~", "@", "__", "->", "=", "?", "-", "+"]);
  function pathError(p, broadcast) {
    if (typeof p !== "string" || !p.length) return "path must be a non-empty string";
    if (p.length > 200) return "path is longer than 200 chars";
    var segs = p.split("."); if (segs.length > 16) return "path is deeper than 16 segments";
    for (var i = 0; i < segs.length; i++) { var s = segs[i];
      if (OPS_SEG.has(s)) return 'segment "' + s + '" is an operator, not a name';
      if (/^\d+$/.test(s)) continue;
      var m = s.match(SEG); if (!m) return 'segment "' + s + '" is not a valid name';
      if (m[3] === "i" && !broadcast) return "[i] is only allowed in a define path"; }
    return null;
  }
  var nameError = function (n) { return typeof n === "string" && NAME.test(n) && !OPS_SEG.has(n) ? null : '"' + String(n) + '" is not a valid name'; };
  var canon = function (p) { return p.split(".").reduce(function (a, s) { return /^\d+$/.test(s) && a ? a + "[" + s + "]" : a ? a + "." + s : s; }, ""); };
  var keys = function (p) { var o = []; p.split(".").forEach(function (s) { var m = s.match(/^(.*)\[(\d+)\]$/); if (m) o.push(m[1], m[2]); else o.push(s); }); return o; };

  // ── validate.ts ── (returns per-op errors too, for the pass/fail list)
  var FIELDS = { set: ["path", "value"], define: ["path", "name", "expr"], pointer: ["path", "target"], remove: ["path", "key"], secret: ["path"], noise: ["path"], identity: ["handle"], query: ["paths"] };
  var SECRETISH = /(pass(word)?|contrase(ñ|n)a|clave|secret|seed|semilla|pin|token|api[_-]?key|private[_-]?key|^key$)/i;
  var EXPR = /^[\p{L}\p{N}_$.\[\]\s+\-*/%()<>=!&|?:,'"]+$/u;
  var CONFIRM = ["secret", "noise", "identity", "remove"];
  function extractJson(t) { if (typeof t !== "string") throw new Error("model reply is not text"); t = t.trim();
    var f = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/); try { return JSON.parse(f ? f[1] : t); } catch (e) { throw new Error("model reply is not a JSON object"); } }
  function validateOps(obj) {
    var top = function (e) { return { ops: [], errors: [e], per: [] }; };
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return top('reply must be an object {"ops":[...]}');
    var ks = Object.keys(obj); if (ks.length !== 1 || ks[0] !== "ops") return top('reply must have exactly one key "ops"');
    var list = obj.ops; if (!Array.isArray(list)) return top("ops must be an array");
    if (list.length > 64) return top("ops has more than 64 items");
    var errors = [], per = list.map(function (o, i) {
      var e = [], w = "ops[" + i + "]", push = function (x) { e.push(x); errors.push(x); };
      if (!o || typeof o !== "object" || Array.isArray(o)) { push(w + " must be an object"); return e; }
      var f = FIELDS[o.op]; if (!f) { push(w + ".op " + JSON.stringify(o.op) + " is not one of " + Object.keys(FIELDS).join(", ")); return e; }
      Object.keys(o).forEach(function (k) { if (k !== "op" && f.indexOf(k) < 0) push(w + " (" + o.op + ') has unknown key "' + k + '"'); });
      f.forEach(function (k) { if (!(k in o)) push(w + " (" + o.op + ') is missing "' + k + '"'); });
      var pe = function (p, n, b) { var x = pathError(p, b); if (x) push(w + "." + n + ": " + x); };
      switch (o.op) {
        case "set": pe(o.path, "path"); if (o.value === undefined) push(w + ".value is missing");
          if (typeof o.path === "string" && SECRETISH.test(o.path.split(".").pop() || "")) push(w + ': "' + o.path + '" looks like a secret value; never write secrets'); break;
        case "define": pe(o.path, "path", true); var ne = nameError(o.name); if (ne) push(w + ".name: " + ne);
          if (typeof o.expr !== "string" || !o.expr.trim() || o.expr.length > 300 || !EXPR.test(o.expr)) push(w + ".expr must be an arithmetic/comparison expression over paths");
          else if (/=>|function|\bnew\b|`/.test(o.expr)) push(w + ".expr must not contain code"); break;
        case "pointer": pe(o.path, "path"); pe(o.target, "target"); break;
        case "remove": pe(o.path, "path"); var ke = nameError(o.key); if (ke && !/^\d+$/.test(String(o.key))) push(w + ".key: " + ke); break;
        case "secret": case "noise": pe(o.path, "path"); break;
        case "identity": if (typeof o.handle !== "string" || !/^[a-z0-9][a-z0-9._-]{0,62}$/i.test(o.handle.replace(/^@/, ""))) push(w + ".handle must be a username"); break;
        case "query": if (!Array.isArray(o.paths) || !o.paths.length) push(w + ".paths must be a non-empty array"); else o.paths.forEach(function (p, j) { pe(p, "paths[" + j + "]"); }); break;
      }
      return e;
    });
    if (errors.length) return { ops: [], errors: errors, per: per };
    return { ops: list.map(function (o) { return o.op === "identity" ? Object.assign({}, o, { handle: o.handle.replace(/^@/, "").toLowerCase() }) : o; }), errors: [], per: per };
  }

  // ── kernel.ts ──
  var isPlain = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
  function flatten(s, pre) { pre = pre || ""; if (!isPlain(s)) return pre ? [[canon(pre), s]] : []; var o = [];
    Object.keys(s).forEach(function (k) { var v = s[k], p = pre ? pre + "." + k : k; if (isPlain(v) && Object.keys(v).length) o.push.apply(o, flatten(v, p)); else if (!isPlain(v)) o.push([canon(p), v]); }); return o; }
  var MeK = function () { var M = root.Me; return M && (M.default || M.ME || M); };
  function node(me, p) { var n = me; keys(p).forEach(function (k) { n = n[k]; }); return n; }
  function read(me, p) { try { return me(canon(p)); } catch (e) { return undefined; } }
  function newME(state) { var K = MeK(); if (typeof K !== "function") throw new Error("this.me kernel not loaded"); var me = new K(); flatten(state).forEach(function (x) { node(me, x[0])(x[1]); }); return me; }
  function applyOps(me, ops, o) { o = o || {}; var reads = {};
    ops.forEach(function (op) {
      if (!o.dryRun && CONFIRM.indexOf(op.op) >= 0 && o.confirm !== true) throw new Error("op " + op.op + " needs user confirmation");
      switch (op.op) {
        case "set": node(me, op.path)(op.value); break;
        case "define": node(me, op.path)["="](op.name, op.expr); break;
        case "pointer": node(me, op.path)["->"](canon(op.target)); break;
        case "remove": node(me, op.path)["-"](op.key); break;
        case "secret": case "noise": var k = o.dryRun ? "llms-me-dry-run-placeholder" : (o.secretKeys || {})[op.path];
          if (!k) throw new Error("op " + op.op + " on " + op.path + ": the user must type the key"); node(me, op.path)[op.op === "secret" ? "_" : "~"](k); break;
        case "identity": me["@"](op.handle); break;
        case "query": op.paths.forEach(function (p) { reads[canon(p)] = read(me, p); }); break;
      }
    }); return reads; }
  function touched(ops, known) { var out = new Set();
    ops.forEach(function (o) {
      if (o.op === "set" || o.op === "pointer") out.add(canon(o.path));
      else if (o.op === "remove") out.add(canon(o.path + "." + o.key));
      else if (o.op === "define") { var p = canon(o.path);
        if (p.indexOf("[i]") >= 0) { var pre = p.split("[i]")[0], idx = new Set();
          known.forEach(function (k) { if (k.indexOf(pre + "[") === 0) { var m = k.slice(pre.length).match(/^\[(\d+)\]/); if (m) idx.add(m[1]); } });
          idx.forEach(function (i) { out.add(p.replace("[i]", "[" + i + "]") + "." + o.name); });
        } else out.add(p + "." + o.name); }
    }); return Array.from(out); }
  function dryRun(state, ops) {
    var known = flatten(state).map(function (x) { return x[0]; }), before = newME(state), after = newME(state), errors = [], reads = {};
    try { reads = applyOps(after, ops, { dryRun: true }); } catch (e) { errors.push("kernel rejected the ops: " + e.message); }
    var diff = touched(ops, known).map(function (p) { return { path: p, before: read(before, p), after: read(after, p) }; });
    ops.forEach(function (o, i) { if (o.op !== "define") return; var ps = touched([o], known);
      if (!ps.length) errors.push("ops[" + i + "]: define on " + o.path + " matches no existing members");
      ps.forEach(function (p) { if (read(after, p) === undefined) errors.push("ops[" + i + "]: " + p + ' = "' + o.expr + '" evaluates to undefined (unknown name in expr?)'); }); });
    return { diff: diff, reads: reads, errors: errors, known: known };
  }

  // ── prompt.ts (live mode) ──
  function userMessage(i) { var lv = flatten(i.state).map(function (x) { return x[0] + " = " + JSON.stringify(x[1]); });
    return [i.speaker ? 'Speaker ("I"/"me"/"yo"): ' + i.speaker : "", "State:\n" + (lv.length ? lv.join("\n") : "(empty)"), "Text: " + i.text].filter(Boolean).join("\n"); }
  function buildMessages(i) { var m = [{ role: "system", content: D.system }];
    D.examples.forEach(function (ex) { m.push({ role: "user", content: userMessage(ex) }); m.push({ role: "assistant", content: JSON.stringify({ ops: ex.ops }) }); });
    m.push({ role: "user", content: userMessage(i) }); return m; }
  async function callMeta(key, messages) {
    var res = await fetch(API, { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: messages, temperature: 0 }) })
      .catch(function (e) { throw new Error("request failed (" + (e && e.name || "network") + ")"); });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error("Meta Model API " + res.status + ": " + ((j.error && (j.error.code || j.error.message)) || j.detail || "error"));
    var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (typeof c !== "string") throw new Error("reply has no message content"); return c; }
  // parse.ts loop: reply -> validate -> dry-run; on errors send them back, up to 2 repairs
  async function liveParse(key, input, onTry) { var msgs = buildMessages(input), last = null;
    for (var a = 1; a <= 3; a++) { var reply = await callMeta(key, msgs), errs = [], obj = null;
      try { obj = extractJson(reply); var v = validateOps(obj); errs = v.errors; if (!errs.length) errs = dryRun(input.state, v.ops).errors; } catch (e) { errs = [e.message]; }
      last = { reply: reply, obj: obj, attempts: a, errors: errs }; onTry && onTry(last); if (!errs.length) return last;
      msgs.push({ role: "assistant", content: reply }); msgs.push({ role: "user", content: "Your reply was rejected:\n- " + errs.join("\n- ") + '\nReply again with ONLY the corrected JSON object {"ops":[...]}.' }); }
    return last; }

  // ── view ──
  var V = function (n, fb) { return "var(--mui-palette-" + n + ", " + fb + ")"; };
  var FG2 = V("text-secondary", "#8b949e"), GRID = V("divider", "rgba(127,127,127,.3)"), ACC = V("primary-main", "#4fd1c5");
  var OK = V("success-main", "#3fb950"), BAD = V("error-main", "#f85149"), WARN = V("warning-main", "#d29922");
  var SYN = function (r, fb) { return "var(--me-syn-" + r + ", " + fb + ")"; };
  var PATHC = SYN("path", "#79c0ff"), NUM = SYN("number", "#d29922"), DER = SYN("derived", "#a371f7");
  var mix = function (a, p, b) { return "color-mix(in srgb, " + a + " " + p + "%, " + (b || "transparent") + ")"; };
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var CSS = ".md{font-size:15px;line-height:1.5;margin:0 0 32px}.md *{box-sizing:border-box}" +
    ".md-card{border:1px solid " + GRID + ";border-radius:14px;padding:clamp(14px,3vw,24px);background:linear-gradient(135deg," + mix(ACC, 7) + ",transparent 55%)}" +
    ".md-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.md-in{flex:1 1 260px;min-width:0;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid " + GRID + ";background:transparent;color:inherit}" +
    ".md-btn{font-family:inherit;font-size:14px;font-weight:600;line-height:1;padding:10px 14px;border-radius:10px;border:1px solid " + ACC + ";background:" + mix(ACC, 18) + ";color:inherit;cursor:pointer}.md-btn:disabled{opacity:.45;cursor:default}" +
    ".md-btn.ghost{background:transparent;border-color:" + GRID + "}.md-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}" +
    ".md-chip{font-family:inherit;font-size:13px;line-height:1.25;padding:6px 10px;border-radius:999px;border:1px solid " + GRID + ";background:transparent;color:inherit;cursor:pointer;text-align:left}.md-chip.on{border-color:" + ACC + ";background:" + mix(ACC, 14) + "}" +
    ".md-mode{display:inline-flex;border:1px solid " + GRID + ";border-radius:10px;overflow:hidden;margin:0 0 12px}.md-mode button{font-family:inherit;font-size:13px;font-weight:600;line-height:1;padding:8px 12px;border:0;background:transparent;color:inherit;cursor:pointer}.md-mode button.on{background:" + mix(ACC, 20) + "}" +
    ".md-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;margin-top:14px}" +
    ".md-step{border:1px solid " + GRID + ";border-radius:12px;padding:12px 14px;min-width:0}.md-step h4{margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:" + FG2 + "}" +
    ".md-step h4 b{display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;margin-right:6px;background:" + mix(ACC, 25) + ";color:inherit}" +
    ".md pre{margin:0;font:12.5px/1.55 " + MONO + ";white-space:pre-wrap;word-break:break-word;overflow-x:auto}.md code{font-family:" + MONO + ";font-size:.92em}" +
    ".md-note{font-size:13px;color:" + FG2 + ";margin:8px 0 0}.md-src{font:12px/1.4 " + MONO + ";color:" + FG2 + ";margin:0 0 8px}" +
    ".md-op{display:flex;gap:8px;align-items:flex-start;font:12.5px/1.5 " + MONO + ";padding:3px 0}.md-ok{color:" + OK + "}.md-bad{color:" + BAD + "}.md-warn{color:" + WARN + "}" +
    ".md-p{color:" + PATHC + "}.md-n{color:" + NUM + "}.md-d{color:" + DER + "}.md-del{text-decoration:line-through;opacity:.7}" +
    ".md-ex{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px dashed " + mix(DER, 50) + ";background:" + mix(DER, 6) + "}" +
    ".md-key{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.md svg text{font-family:" + MONO + ";font-size:11px;fill:currentColor}" +
    ".md details{margin-top:10px;font-size:13px}.md summary{cursor:pointer;color:" + FG2 + "}.md a{color:" + ACC + "}";

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var J = function (v) { return v === undefined ? "∅" : JSON.stringify(v); };
  function opLine(o) { var p = function (x) { return '<span class="md-p">' + esc(x) + "</span>"; };
    switch (o && o.op) {
      case "set": return "set " + p(o.path) + " = " + '<span class="md-n">' + esc(J(o.value)) + "</span>";
      case "define": return "define " + p(o.path + "." + o.name) + ' <span class="md-d">= ' + esc(o.expr) + "</span>";
      case "pointer": return "pointer " + p(o.path) + " → " + p(o.target);
      case "remove": return "remove " + p(o.path + "." + o.key);
      case "secret": case "noise": return o.op + " " + p(o.path);
      case "identity": return "identity @" + esc(o.handle);
      case "query": return "query " + (o.paths || []).map(p).join(", ");
      default: return esc(JSON.stringify(o)); } }

  // graph of the applied state: leaf paths read back from the kernel, laid out as a tree; derived leaves in the derived colour,
  // dashed edges from each input (explain().meta.dependsOn) to the value it feeds
  function graph(leaves, derivedSet, deps) {
    var T = { k: "", c: {}, order: [] };
    leaves.forEach(function (lf) { var segs = keys(lf.path), n = T, acc = [];
      segs.forEach(function (s, i) { acc.push(s); if (!n.c[s]) { n.c[s] = { k: s, c: {}, order: [], path: lf.path, depth: i + 1 }; n.order.push(s); } n = n.c[s]; });
      n.leaf = lf; });
    var rows = [], y = 0, P = {};
    (function lay(n, d, pre) { n.order.forEach(function (s) { var c = n.c[s], p = pre ? pre + "." + s : s;
      if (c.order.length) { var y0 = y; lay(c, d + 1, p); c.y = (y0 + y - 1) / 2; } else { c.y = y++; }
      c.d = d; c.p = p; rows.push(c); }); })(T, 0, "");
    var maxD = rows.reduce(function (m, r) { return Math.max(m, r.d); }, 0), CW = 96, RH = 26, W = (maxD + 1) * CW + 150, H = Math.max(1, y) * RH + 16;
    var X = function (d) { return 10 + d * CW; }, Y = function (r) { return 14 + r * RH; }, s = "";
    rows.forEach(function (r) { P[canon(r.p)] = r; });
    var parentOf = function (p) { var i = p.lastIndexOf("."); return i < 0 ? null : p.slice(0, i); };
    rows.forEach(function (r) { var pp = parentOf(r.p); var par = pp && rows.filter(function (q) { return q.p === pp; })[0];
      if (par) s += '<path d="M' + (X(par.d) + 6) + " " + Y(par.y) + " C" + (X(r.d) - 30) + " " + Y(par.y) + " " + (X(r.d) - 30) + " " + Y(r.y) + " " + (X(r.d) - 4) + " " + Y(r.y) + '" fill="none" stroke="' + GRID + '" stroke-width="1.3"/>'; });
    var tx = function (r) { return X(r.d) + 12 + 6.7 * (r.k.length + (r.leaf ? 1 + Math.min(28, String(J(r.leaf.value)).length) : 0)); };
    deps.forEach(function (e) { var a = P[canon(e.from)], b = P[canon(e.to)]; if (!a || !b) return; var ax = tx(a), bx = tx(b), cx = Math.max(ax, bx) + 30;
      s += '<path d="M' + ax + " " + Y(a.y) + " C" + cx + " " + Y(a.y) + " " + cx + " " + Y(b.y) + " " + bx + " " + Y(b.y) + '" fill="none" stroke="' + DER + '" stroke-dasharray="3 3" stroke-width="1.2" opacity=".8"/>'; });
    W = Math.max(W, rows.reduce(function (m, r) { return Math.max(m, tx(r) + 40); }, 0));
    rows.forEach(function (r) { var der = r.leaf && derivedSet[canon(r.p)];
      s += '<circle cx="' + X(r.d) + '" cy="' + Y(r.y) + '" r="' + (r.d ? 4 : 5) + '" fill="' + (der ? DER : r.leaf ? NUM : ACC) + '"/>';
      s += '<text x="' + (X(r.d) + 9) + '" y="' + (Y(r.y) + 4) + '">' + esc(r.k) + (r.leaf ? ' <tspan fill="' + (der ? DER : NUM) + '">' + esc(String(r.leaf.value === undefined ? "∅" : J(r.leaf.value)).slice(0, 28)) + "</tspan>" : "") + "</text>"; });
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" style="display:block;max-width:none" role="img" aria-label="state graph">' + s + "</svg>";
  }
  function exBlock(x) { if (!x) return ""; var ins = (x.derivation && x.derivation.inputs) || [];
    var w = ins.reduce(function (m, i) { return Math.max(m, String(i.path).length); }, 0);
    return '<div class="md-ex"><pre><span class="md-p">' + esc(x.path) + '</span> = <span class="md-d">' + esc(J(x.value)) + "</span>\n  ← " + esc(x.expr || "") +
      ins.map(function (i) { return "\n      " + '<span class="md-p">' + esc(i.path) + "</span>" + " ".repeat(Math.max(1, w - String(i.path).length + 2)) + '<span class="md-n">' + esc(J(i.value)) + "</span>"; }).join("") + "</pre></div>"; }

  function mount(el) {
    var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} };
    var S = { mode: "recorded", cur: null, key: ss("llms-meta-key") || "" };
    var rec = {}; D.recorded.forEach(function (r) { rec[r.id] = r; });
    var byText = function (t) { t = t.trim().toLowerCase(); return D.recorded.filter(function (r) { return r.text.toLowerCase() === t; })[0]; };
    el.className = "md";
    el.innerHTML = '<div class="md-card">' +
      '<div class="md-mode" role="tablist"><button data-m="recorded" class="on">Recorded</button><button data-m="live">Live (your key)</button></div>' +
      '<div class="md-live" hidden><div class="md-row"><input class="md-in md-k" type="password" autocomplete="off" placeholder="Meta API key (kept in this tab only)"><button class="md-btn ghost md-kc">Forget key</button></div>' +
      '<p class="md-note">Get a key at <a href="https://dev.meta.ai/" target="_blank" rel="noopener">dev.meta.ai</a> (<a href="https://dev.meta.ai/docs/overview" target="_blank" rel="noopener">docs</a>). The key stays in this tab (sessionStorage) and is sent only to <code>api.meta.ai</code>. Each run is a real, billed call to <code>' + MODEL + "</code> (1 to 3 requests, with repairs).</p></div>" +
      '<div class="md-row"><input class="md-in md-t" placeholder="Type a sentence, or pick an example"><button class="md-btn md-go">Run</button></div>' +
      '<div class="md-chips"></div><p class="md-note md-msg"></p>' +
      '<div class="md-steps">' +
      '<section class="md-step"><h4><b>1</b>Meta Muse Spark proposes</h4><div class="md-s1"><p class="md-note">Pick an example.</p></div></section>' +
      '<section class="md-step"><h4><b>2</b>Validated</h4><div class="md-s2"></div></section>' +
      '<section class="md-step"><h4><b>3</b>Dry-run</h4><div class="md-s3"></div></section>' +
      '<section class="md-step"><h4><b>4</b>Confirm</h4><div class="md-s4"></div></section></div></div>';
    var $ = function (s) { return el.querySelector(s); };
    var chips = $(".md-chips");
    CHIPS.forEach(function (id) { var r = rec[id]; if (!r) return; var b = document.createElement("button"); b.className = "md-chip"; b.textContent = r.text; b.dataset.id = id;
      b.onclick = function () { $(".md-t").value = r.text; run(); }; chips.appendChild(b); });
    el.querySelectorAll(".md-mode button").forEach(function (b) { b.onclick = function () { S.mode = b.dataset.m;
      el.querySelectorAll(".md-mode button").forEach(function (x) { x.classList.toggle("on", x === b); }); $(".md-live").hidden = S.mode !== "live"; $(".md-msg").textContent = ""; }; });
    $(".md-k").value = S.key; $(".md-k").oninput = function (e) { S.key = e.target.value.trim(); ss("llms-meta-key", S.key || null); };
    $(".md-kc").onclick = function () { S.key = ""; $(".md-k").value = ""; ss("llms-meta-key", null); };
    $(".md-t").onkeydown = function (e) { if (e.key === "Enter") run(); };
    $(".md-go").onclick = run;
    var clear = function () { [".md-s2", ".md-s3", ".md-s4"].forEach(function (s) { $(s).innerHTML = ""; }); };

    function run() {
      var text = $(".md-t").value.trim(); $(".md-msg").textContent = ""; if (!text) return;
      var r = byText(text);
      chips.querySelectorAll(".md-chip").forEach(function (c) { c.classList.toggle("on", !!r && c.dataset.id === r.id && S.mode === "recorded"); });
      if (S.mode === "recorded") {
        if (!r) { clear(); $(".md-s1").innerHTML = '<p class="md-note">No recorded response for this sentence. Recorded mode only replays real outputs from the eval run. Switch to <b>Live (your key)</b> to ask the model.</p>'; return; }
        show({ text: r.text, state: r.state, speaker: r.speaker }, { obj: { ops: r.ops }, src: "recorded response from " + MODEL + ", 2026-10-29 · eval item " + r.id + " · " + r.ms + " ms" + (r.attempts > 1 ? " · " + r.attempts + " attempts" : "") });
        return;
      }
      if (!S.key) { $(".md-msg").textContent = "Paste your Meta API key first."; return; }
      var state = r ? r.state : {}, input = { text: text, state: state, speaker: r && r.speaker };
      clear(); $(".md-s1").innerHTML = '<p class="md-note">Asking ' + MODEL + "…</p>"; $(".md-go").disabled = true;
      var t0 = performance.now();
      liveParse(S.key, input, function (t) { $(".md-s1").innerHTML = '<p class="md-note">attempt ' + t.attempts + (t.errors.length ? " rejected, sending the errors back…" : "") + "</p>"; })
        .then(function (t) { show(input, { obj: t.obj, raw: t.reply, src: "live response from " + MODEL + " · " + Math.round(performance.now() - t0) + " ms · " + t.attempts + " attempt(s)" + (r ? " · state from eval item " + r.id : " · empty starting state") }); })
        .catch(function (e) { $(".md-s1").innerHTML = '<p class="md-bad">' + esc(e.message) + "</p>"; })
        .then(function () { $(".md-go").disabled = false; });
    }

    function show(input, resp) {
      clear(); S.cur = { input: input, applied: false };
      var json = resp.obj && Array.isArray(resp.obj.ops) && Object.keys(resp.obj).length === 1 ? '{"ops": [' + resp.obj.ops.map(function (o) { return "\n" + JSON.stringify(o); }).join(",") + "\n]}" : resp.obj != null ? JSON.stringify(resp.obj, null, 1) : resp.raw;
      $(".md-s1").innerHTML = '<p class="md-src">' + esc(resp.src) + '</p><pre>' + esc(json) + "</pre>" +
        '<details><summary>starting state</summary><pre>' + esc(JSON.stringify(input.state, null, 1)) + "</pre></details>";
      var v = resp.obj === null || resp.obj === undefined ? { ops: [], errors: ["model reply is not a JSON object"], per: [] } : validateOps(resp.obj), list = (resp.obj && Array.isArray(resp.obj.ops)) ? resp.obj.ops : [];
      var h2 = list.map(function (o, i) { var e = v.per[i] || [];
        return '<div class="md-op"><span class="' + (e.length ? "md-bad" : "md-ok") + '">' + (e.length ? "✗" : "✓") + "</span><span>" + opLine(o) + (CONFIRM.indexOf(o && o.op) >= 0 ? ' <span class="md-warn">· needs confirm</span>' : "") +
          (e.length ? '<br><span class="md-bad">' + e.map(esc).join("<br>") + "</span>" : "") + "</span></div>"; }).join("");
      if (!list.length && !v.errors.length) h2 = '<p class="md-note">No ops: the model found nothing to write. Nothing will change.</p>';
      if (v.per.length === 0 && v.errors.length) h2 += '<p class="md-bad">' + v.errors.map(esc).join("<br>") + "</p>";
      $(".md-s2").innerHTML = h2 + '<p class="md-note">' + (v.errors.length ? "Rejected by" : "Passed") + ' schema + path rules (<a href="https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/validate.ts">validate.ts</a>, ported to the browser).</p>';
      if (v.errors.length) { $(".md-s3").innerHTML = '<p class="md-note">Skipped: invalid ops never reach the kernel.</p>'; return; }
      var d; try { d = dryRun(input.state, v.ops); } catch (e) { $(".md-s3").innerHTML = '<p class="md-bad">' + esc(e.message) + "</p>"; return; }
      var h3 = d.diff.map(function (x) { return '<div class="md-op"><span class="md-p">' + esc(x.path) + '</span>&nbsp; <span class="' + (x.before === undefined ? "" : "md-del") + '">' + esc(J(x.before)) + '</span> → <span class="md-n">' + esc(J(x.after)) + "</span></div>"; }).join("");
      Object.keys(d.reads).forEach(function (p) { h3 += '<div class="md-op">? <span class="md-p">' + esc(p) + '</span> = <span class="md-n">' + esc(J(d.reads[p])) + "</span></div>"; });
      if (!h3) h3 = '<p class="md-note">No changes.</p>';
      h3 += d.errors.length ? '<p class="md-bad">' + d.errors.map(esc).join("<br>") + "</p>" : '<p class="md-note">Applied to a throwaway this.me ' + esc((root.Me && root.Me.version) || "4.2.1") + '. Your state is not touched yet.</p>';
      $(".md-s3").innerHTML = h3;
      if (d.errors.length) return;
      var need = v.ops.filter(function (o) { return CONFIRM.indexOf(o.op) >= 0; }), sec = v.ops.filter(function (o) { return o.op === "secret" || o.op === "noise"; });
      $(".md-s4").innerHTML = (need.length ? '<p class="md-note md-warn">' + need.length + " op(s) need your OK: " + need.map(function (o) { return o.op; }).join(", ") + ".</p>" : "") +
        sec.map(function (o, i) { return '<div class="md-key"><input class="md-in md-sk" data-p="' + esc(o.path) + '" type="password" placeholder="type the key for ' + esc(o.path) + ' (the model never sees it)"></div>'; }).join("") +
        '<div class="md-row" style="margin-top:8px"><button class="md-btn md-ok-btn">Confirm and apply</button></div><div class="md-out"></div>';
      $(".md-ok-btn").onclick = function () {
        var sk = {}; el.querySelectorAll(".md-sk").forEach(function (i) { if (i.value) sk[i.dataset.p] = i.value; });
        var out = $(".md-out");
        try { var me = newME(input.state), reads = applyOps(me, v.ops, { confirm: true, secretKeys: sk });
          var paths = new Set(d.known.concat(d.diff.map(function (x) { return x.path; })));
          v.ops.forEach(function (o) { if (o.op === "remove") paths.delete(canon(o.path + "." + o.key)); });
          var derived = {}, deps = [], exs = [];
          v.ops.filter(function (o) { return o.op === "define"; }).forEach(function (o) { touched([o], d.known).forEach(function (p) { derived[p] = 1; try { var x = me.explain(p); exs.push(x);
            ((x.meta && x.meta.dependsOn) || []).forEach(function (f) { deps.push({ from: f, to: p }); }); } catch (e) {} }); });
          var leaves = Array.from(paths).map(function (p) { return { path: p, value: read(me, p) }; });
          var qs = Object.keys(reads).map(function (p) { return '<div class="md-op">? <span class="md-p">' + esc(p) + '</span> = <span class="md-n">' + esc(J(reads[p])) + "</span></div>"; }).join("");
          out.innerHTML = '<p class="md-note md-ok">Applied to a real this.me in this page.</p>' + (leaves.length ? '<div style="overflow-x:auto;margin:6px 0">' + graph(leaves, derived, deps) + "</div>" : '<p class="md-note">(empty state)</p>') + qs +
            exs.map(exBlock).join("") + (exs.length ? '<p class="md-note">The model only named the formula. The kernel computes the value; <a href="https://neurons-me.github.io/.me/docs/Explain.html">me.explain()</a> shows where it came from.</p>' : "");
          $(".md-ok-btn").disabled = true;
        } catch (e) { out.innerHTML = '<p class="md-bad">' + esc(e.message) + "</p>"; }
      };
    }
    // start on the first chip
    var first = rec[CHIPS[0]]; if (first) { $(".md-t").value = first.text; run(); }
  }

  function MetaDemo() {
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (!document.getElementById("md-css")) { var s = document.createElement("style"); s.id = "md-css"; s.textContent = CSS; document.head.appendChild(s); }
      if (ref.current && !ref.current.dataset.on) { ref.current.dataset.on = "1"; mount(ref.current); }
    }, []);
    return React.createElement("div", { ref: ref });
  }
  root.LandingLive = Object.assign(root.LandingLive || {}, { MetaDemo: MetaDemo });
  root.MetaDemoMount = mount;
})(typeof window !== "undefined" ? window : this);
