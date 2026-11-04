/*! meta-demo · LLMS hackathon demo: sentence -> Meta Muse Spark ops -> validate -> dry-run -> confirm, on a real this.me · MIT · neurons.me
 * Mounted by landing-gui.js from <div data-live="MetaDemo"> (window.LandingLive.MetaDemo). validate/paths/kernel below are a
 * line-by-line port of LLMS/typescript/src/{paths,validate,kernel}.ts to browser JS; the kernel is this.me@4.2.1 (jsDelivr UMD).
 * Recorded mode replays the ops muse-spark-1.3 returned in eval run 2026-10-29 (demo-data.js, generated from LLMS/eval/results).
 * Live mode calls https://api.meta.ai/v1/chat/completions from the browser with a key the visitor types (kept in localStorage, Service keys).
 */
(function (root) {
  var React = root.React; if (!React) return;
  var D = root.MetaDemoData || { recorded: [], examples: [], system: "" };
  var API = "https://api.meta.ai/v1/chat/completions", MODEL = "muse-spark-1.3";
  var CHIPS = ["e24", "e05", "e20", "e07", "e23"]; // removals last, so no chip undoes an earlier chip's result

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

  // ── chat mode (live): the model decides. State in the message -> {"ops":[...]} (same schema); otherwise plain text. ──
  var CHAT = "\n\nCHAT MODE: you are also a normal assistant in a chat. If the user's message contains state to record (facts, values, rules, links, deletions) or asks to read recorded values, reply with ONLY the JSON object {\"ops\":[...]} as above. If it has nothing to record (a greeting, a general question, a request for an opinion), reply in plain conversational text, no JSON. Never mix the two.";
  var FORCE = "\n\nThis message MUST be answered with ONLY the JSON object {\"ops\":[...]}.";
  function chatMessages(i, hist, force) { var m = [{ role: "system", content: D.system + CHAT + (force ? FORCE : "") }];
    D.examples.forEach(function (ex) { m.push({ role: "user", content: userMessage(ex) }); m.push({ role: "assistant", content: JSON.stringify({ ops: ex.ops }) }); });
    hist.slice(-6).forEach(function (t) { m.push({ role: t.role, content: t.content }); });
    m.push({ role: "user", content: userMessage(i) }); return m; }
  var looksJson = function (t) { t = String(t).trim(); return /^(```(json)?\s*)?\{/.test(t); };
  async function liveChat(key, input, hist, force, onTry, check) { var msgs = chatMessages(input, hist, force), last = null;
    for (var a = 1; a <= 3; a++) { var reply = await callMeta(key, msgs);
      if (!looksJson(reply) && !force) return { text: reply, attempts: a };
      var errs = [], obj = null;
      try { obj = extractJson(reply); var v = validateOps(obj); errs = v.errors; if (!errs.length) errs = check(v.ops); } catch (e) { errs = [e.message]; }
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
  var BG = V("background-default", "#0d1117"), PAPER = V("background-paper", "#161b22");
  var CSS = ".mc{position:fixed;left:0;right:0;bottom:0;top:var(--mc-top,56px);z-index:20;display:flex;font-size:15px;line-height:1.5;background:" + BG + ";color:inherit}.mc *{box-sizing:border-box}" +
    "body.mc-on{overflow:hidden}" +
    ".mc-sb{width:300px;flex:0 0 300px;border-right:1px solid " + GRID + ";display:flex;flex-direction:column;min-height:0;background:" + mix(FG2, 4, BG) + ";transition:margin .2s}" +
    ".mc.shut .mc-sb{margin-left:-300px}" +
    ".mc-sbx{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:14px}" +
    ".mc-sb h4{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:" + FG2 + ";font-weight:600}" +
    ".mc-cv{display:flex;flex-direction:column;gap:2px}.mc-cv button{font:inherit;font-size:13px;text-align:left;background:transparent;color:inherit;border:0;border-radius:8px;padding:6px 9px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mc-cv button:hover{background:" + mix(FG2, 10) + "}.mc-cv button.cur{background:" + mix(ACC, 16) + "}" +
    ".mc-wide{width:100%;text-align:left;border-radius:10px!important;padding:7px 12px!important}" +
    ".mc-kc{display:flex;gap:8px;align-items:center;font:inherit;font-size:13px;width:100%;background:transparent;color:" + FG2 + ";border:1px solid " + GRID + ";border-radius:10px;padding:7px 10px;cursor:pointer}.mc-kc svg{flex:none}.mc-kc.on{color:" + ACC + ";border-color:" + ACC + ";box-shadow:0 0 10px " + mix(ACC, 35) + "}" +
    ".mc-info{font-size:12.5px;color:" + FG2 + ";margin:0}" +
    ".mc-main{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}" +
    ".mc-top{display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:13px;color:" + FG2 + "}.mc-top b{color:inherit;font-weight:600}.mc-sp{flex:1}" +
    ".mc-ib{font:inherit;font-size:13px;background:transparent;color:inherit;border:1px solid " + GRID + ";border-radius:999px;padding:4px 10px;cursor:pointer}.mc-ib.on{border-color:" + ACC + ";color:" + ACC + "}.mc-tg{border:0;font-size:17px;padding:2px 8px}" +
    ".mc-pop{position:absolute;z-index:30;width:min(340px,calc(100vw - 20px));padding:14px;border-radius:12px;border:1px solid " + GRID + ";background:" + PAPER + ";box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:13px}" +
    ".mc-log{flex:1;overflow-y:auto;padding:16px 14px}.mc-col{max-width:780px;margin:0 auto;display:flex;flex-direction:column;gap:14px}" +
    ".mc-m{max-width:88%;padding:9px 13px;border-radius:16px;white-space:pre-wrap;word-break:break-word}.mc-u{align-self:flex-end;background:" + mix(ACC, 18) + ";border-bottom-right-radius:5px}" +
    ".mc-a{align-self:flex-start;max-width:100%;width:100%;padding:2px 2px}.mc-a .mc-tx{white-space:pre-wrap}" +
    ".mc-src{font:11px/1.4 " + MONO + ";color:" + FG2 + ";opacity:.8;margin:2px 0 6px}" +
    ".mc pre{margin:0;font:12.5px/1.6 " + MONO + ";white-space:pre-wrap;word-break:break-word}" +
    ".mc-code{padding:10px 12px;border-radius:10px;background:" + mix(FG2, 9) + "}" +
    ".mc-v{font-size:12.5px;margin:6px 0 0}.mc-ok{color:" + OK + "}.mc-bad{color:" + BAD + "}.mc-warn{color:" + WARN + "}.mc-note{font-size:12.5px;color:" + FG2 + ";margin:6px 0 0}" +
    ".mc-diff{font:12px/1.55 " + MONO + ";margin:6px 0 0;color:" + FG2 + "}.mc-p{color:" + PATHC + "}.mc-n{color:" + NUM + "}.mc-d{color:" + DER + "}.mc-del{text-decoration:line-through;opacity:.7}" +
    ".mc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}" +
    ".mc-btn{font:600 13px/1 inherit;font-family:inherit;padding:8px 14px;border-radius:999px;border:1px solid " + ACC + ";background:" + mix(ACC, 20) + ";color:inherit;cursor:pointer}.mc-btn.ghost{background:transparent;border-color:" + GRID + "}.mc-btn:disabled{opacity:.45;cursor:default}" +
    ".mc-in{flex:1 1 200px;min-width:0;font:inherit;padding:8px 12px;border-radius:10px;border:1px solid " + GRID + ";background:transparent;color:inherit}" +
    ".mc-foot{padding:8px 14px 14px}.mc-foot>div,.mc-foot>p{max-width:780px;margin-left:auto;margin-right:auto}.mc-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px!important}" +
    ".mc-chip{font:inherit;font-size:12.5px;line-height:1.3;padding:5px 10px;border-radius:999px;border:1px solid " + GRID + ";background:transparent;color:inherit;cursor:pointer;text-align:left}.mc-chip:hover{border-color:" + ACC + "}" +
    ".mc-send{display:flex;gap:8px;align-items:flex-end;padding:6px;border:1px solid " + GRID + ";border-radius:24px;background:" + PAPER + "}.mc-send textarea{flex:1;min-width:0;resize:none;font:inherit;padding:8px 12px;border:0;outline:0;background:transparent;color:inherit;max-height:180px}" +
    ".mc-hint{font-size:11.5px;color:" + FG2 + ";margin-top:6px!important;padding:0 4px;opacity:.85}.mc-hint code{font-family:" + MONO + "}" +
    ".mc-g{margin-top:4px}.mc-g svg{display:block;width:100%;height:auto}.mc-g svg text{font-family:" + MONO + ";font-size:11px;fill:currentColor}" +
    ".mc-mini{margin:8px 0 0;padding:6px 8px;border-radius:10px;border:1px solid " + GRID + ";overflow-x:auto}.mc-mini svg{display:block;max-height:150px;width:auto;max-width:100%;height:auto}.mc-mini svg text{font-family:" + MONO + ";font-size:11px;fill:currentColor}" +
    ".mc-hl{animation:mchl 2.4s ease}@keyframes mchl{0%,40%{r:11;opacity:1}100%{r:7}}" +
    ".mc-ex{margin-top:10px;padding:9px 11px;border-radius:10px;border:1px dashed " + mix(DER, 50) + ";background:" + mix(DER, 6) + "}.mc-ex pre{font-size:11.5px;white-space:pre;overflow-x:auto}" +
    ".mc-bd{display:none}" +
    "@media(max-width:860px){.mc-sb{position:absolute;top:0;bottom:0;left:0;z-index:25;width:86vw;max-width:320px;margin-left:0!important;transform:translateX(-102%);transition:transform .2s;background:" + PAPER + "}.mc.drw .mc-sb{transform:none}.mc.drw .mc-bd{display:block;position:absolute;inset:0;z-index:24;background:rgba(0,0,0,.4)}}" +
    ".mc a{color:" + ACC + "}.mc code{font-family:" + MONO + ";font-size:.92em}";

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var J = function (v) { return v === undefined ? "∅" : JSON.stringify(v); };
  // ops -> .me code (what the kernel runs), coloured by the shared .me highlighter
  function opCode(o) { var P = function (p) { return "me." + canon(p); }, Q = JSON.stringify;
    switch (o && o.op) {
      case "set": return P(o.path) + "(" + Q(o.value) + ")";
      case "define": return P(o.path) + '["="](' + Q(o.name) + ", " + Q(o.expr) + ")";
      case "pointer": return P(o.path) + '["->"](' + Q(canon(o.target)) + ")";
      case "remove": return P(o.path) + '["-"](' + Q(String(o.key)) + ")";
      case "secret": return P(o.path) + '["_"](/* your key */)';
      case "noise": return P(o.path) + '["~"](/* your key */)';
      case "identity": return 'me["@"](' + Q(o.handle) + ")";
      case "query": return (o.paths || []).map(function (p) { return "me(" + Q(canon(p)) + ")"; }).join("\n");
      default: return "// " + JSON.stringify(o); } }
  var hl = function (code) { try { return root.MeSyntax ? root.MeSyntax.toHTML(code) : esc(code); } catch (e) { return esc(code); } };

  // state graph: tree of leaf paths; index segments labelled by their path (items[1]); fits its box (viewBox, width 100%)
  function graph(leaves, derivedSet, deps, changed) {
    var T = { c: {}, order: [] };
    leaves.forEach(function (lf) { var segs = keys(lf.path), n = T;
      segs.forEach(function (s, i) { if (!n.c[s]) { n.c[s] = { k: /^\d+$/.test(s) ? (segs[i - 1] || "") + "[" + s + "]" : s, c: {}, order: [] }; n.order.push(s); } n = n.c[s]; });
      n.leaf = lf; });
    var rows = [], y = 0, P = {};
    (function lay(n, d, pre) { n.order.forEach(function (s) { var c = n.c[s], p = pre ? pre + "." + s : s;
      if (c.order.length) { var y0 = y; lay(c, d + 1, p); c.y = (y0 + y - 1) / 2; } else { c.y = y++; }
      c.d = d; c.p = canon(p); rows.push(c); P[c.p] = c; }); })(T, 0, "");
    var RH = 24, CH = 6.7, XS = [10]; rows.forEach(function (r) { if (r.order.length) XS[r.d + 1] = Math.max(XS[r.d + 1] || 0, r.k.length); });
    for (var q = 1; q < XS.length; q++) XS[q] = XS[q - 1] + 40 + CH * (XS[q] || 0);
    var X = function (d) { return XS[d]; }, Y = function (r) { return 14 + r * RH; }, s = "";
    var val = function (r) { return String(r.leaf.value === undefined ? "∅" : J(r.leaf.value)).slice(0, 22); };
    var tx = function (r) { return X(r.d) + 12 + CH * (r.k.length + (r.leaf ? 1 + val(r).length : 0)); };
    var parentOf = function (p) { var i = Math.max(p.lastIndexOf("."), p.lastIndexOf("[")); return i < 0 ? null : p.slice(0, i); };
    rows.forEach(function (r) { var par = P[parentOf(r.p)];
      if (par) s += '<path d="M' + (X(par.d) + 6) + " " + Y(par.y) + " C" + (X(r.d) - 26) + " " + Y(par.y) + " " + (X(r.d) - 26) + " " + Y(r.y) + " " + (X(r.d) - 4) + " " + Y(r.y) + '" fill="none" stroke="' + GRID + '" stroke-width="1.3"/>'; });
    var W = rows.reduce(function (m, r) { return Math.max(m, tx(r) + 10); }, 200);
    deps.forEach(function (e) { var a = P[canon(e.from)], b = P[canon(e.to)]; if (!a || !b) return; var ax = tx(a), bx = tx(b), cx = Math.max(ax, bx) + 24; W = Math.max(W, cx + 6);
      s += '<path d="M' + ax + " " + Y(a.y) + " C" + cx + " " + Y(a.y) + " " + cx + " " + Y(b.y) + " " + bx + " " + Y(b.y) + '" fill="none" stroke="' + DER + '" stroke-dasharray="3 3" stroke-width="1.2" opacity=".8"/>'; });
    rows.forEach(function (r) { var der = r.leaf && derivedSet[r.p], ch = changed[r.p], col = der ? DER : r.leaf ? NUM : ACC;
      if (ch) s += '<circle class="mc-hl" cx="' + X(r.d) + '" cy="' + Y(r.y) + '" r="7" fill="none" stroke="' + ACC + '" stroke-width="1.5"/>';
      s += '<circle cx="' + X(r.d) + '" cy="' + Y(r.y) + '" r="' + (r.d ? 4 : 5) + '" fill="' + col + '"/>';
      s += '<text x="' + (X(r.d) + 9) + '" y="' + (Y(r.y) + 4) + '"' + (ch ? ' font-weight="700"' : "") + ">" + esc(r.k) + (r.leaf ? ' <tspan fill="' + col + '">' + esc(val(r)) + "</tspan>" : "") + "</text>"; });
    var H = Math.max(1, y) * RH + 10;
    return '<svg viewBox="0 0 ' + Math.ceil(W) + " " + H + '" style="max-width:' + Math.ceil(W * 1.15) + 'px" role="img" aria-label="state graph">' + s + "</svg>";
  }
  function exBlock(x) { if (!x) return ""; var ins = (x.derivation && x.derivation.inputs) || [];
    var w = ins.reduce(function (m, i) { return Math.max(m, String(i.path).length); }, 0);
    return '<div class="mc-ex"><pre><span class="mc-p">' + esc(x.path) + '</span> = <span class="mc-d">' + esc(J(x.value)) + "</span>\n  ← " + esc(x.expr || "") +
      ins.map(function (i) { return "\n      " + '<span class="mc-p">' + esc(i.path) + "</span>" + " ".repeat(Math.max(1, w - String(i.path).length + 2)) + '<span class="mc-n">' + esc(J(i.value)) + "</span>"; }).join("") + "</pre></div>"; }

  // deep-merge b into a, keeping what a already has (eval starting states seed the shared conversation state)
  function seedMerge(a, b) { Object.keys(b || {}).forEach(function (k) { if (isPlain(b[k])) { if (!isPlain(a[k])) { if (a[k] !== undefined) return; a[k] = {}; } seedMerge(a[k], b[k]); } else if (a[k] === undefined) a[k] = b[k]; }); return a; }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var KEYI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>';
  function mount(el) {
    var KS = "llms-meta-key", ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
    try { var old = sessionStorage.getItem(KS); if (old && !ls(KS)) ls(KS, old); sessionStorage.removeItem(KS); } catch (e) {}
    var S = { live: false, key: ls(KS) || "", seed: {}, batches: [], paths: new Set(), derived: {}, hist: [], busy: false, changed: {}, focus: [], convs: [], cur: 0, n: 0 };
    var rec = {}; D.recorded.forEach(function (r) { rec[r.id] = r; });
    var byText = function (t) { t = t.trim().toLowerCase(); return D.recorded.filter(function (r) { return r.text.toLowerCase() === t; })[0]; };
    var mobile = function () { return !!(root.matchMedia && root.matchMedia("(max-width:860px)").matches); };
    el.className = "mc"; document.body.classList.add("mc-on");
    el.innerHTML = '<aside class="mc-sb"><div class="mc-sbx">' +
      '<button class="mc-ib mc-new mc-wide" title="Clear the chat and the state">+ New chat</button>' +
      '<div><h4>Chats</h4><div class="mc-cv"></div></div>' +
      '<div><h4>State · live graph</h4><div class="mc-g"></div><div class="mc-exs"></div></div>' +
      '<div><h4>Service keys</h4><button class="mc-kc" title="Meta API key">' + KEYI + '<span>Meta · Muse Spark</span></button></div>' +
      '<div><h4>About</h4><p class="mc-info">The model proposes .me ops; this.me validates, dry-runs and computes. Nothing is written until you confirm.</p>' +
      '<p class="mc-info" style="margin-top:4px"><a href="/.me/LLMS/">LLMS</a> · <a href="docs.html">Meta adapter docs</a> · <a href="https://github.com/neurons-me/.me/tree/main/LLMS/Meta" target="_blank" rel="noopener">source</a></p></div>' +
      '</div></aside><div class="mc-bd"></div>' +
      '<div class="mc-main"><div class="mc-top"><button class="mc-ib mc-tg" aria-label="sidebar" title="Sidebar">☰</button><b>Muse Spark</b><span class="mc-mode">recorded</span><span class="mc-sp"></span>' +
      '<button class="mc-ib mc-lv" title="Use your own Meta API key">Live</button></div>' +
      '<div class="mc-log" aria-live="polite"><div class="mc-col"></div></div>' +
      '<div class="mc-foot"><div class="mc-chips"></div><div class="mc-send"><textarea class="mc-t" rows="1" placeholder="Message Muse Spark"></textarea><button class="mc-btn mc-go">Send</button></div>' +
      '<p class="mc-hint">Tell it facts, values or rules and it proposes changes for you to confirm. Start with <code>me:</code> to force that.</p></div></div>' +
      '<div class="mc-pop" hidden><div style="font-weight:600;margin-bottom:6px">Keychain · Meta · Muse Spark</div><div class="mc-row" style="margin:0"><input class="mc-in mc-k" type="password" autocomplete="off" placeholder="Paste your Meta API key"></div>' +
      '<div class="mc-row"><button class="mc-btn mc-ksave">Save</button><button class="mc-btn ghost mc-kdel">Remove</button><button class="mc-btn ghost mc-kx">Close</button></div>' +
      '<p class="mc-note">Get one at <a href="https://dev.meta.ai/" target="_blank" rel="noopener">dev.meta.ai</a>. Stored only in this browser (localStorage), sent only to <code>api.meta.ai</code>. Each live message is a billed call to <code>' + MODEL + "</code>.</p></div>";
    var $ = function (s) { return el.querySelector(s); }, scr = $(".mc-log"), log = $(".mc-col"), EMPTY = '<p class="mc-note">Empty. Confirmed changes from the chat build up here.</p>', ta = $(".mc-t");
    // full height under the shared topbar
    function fit() { var tb = document.querySelector(".topbar") || document.querySelector("header"); var t = tb ? Math.max(0, tb.getBoundingClientRect().bottom) : 56; el.style.setProperty("--mc-top", t + "px"); }
    fit(); root.addEventListener("resize", fit); setTimeout(fit, 300); setTimeout(fit, 1500);
    $(".mc-tg").onclick = function () { if (mobile()) el.classList.toggle("drw"); else el.classList.toggle("shut"); };
    $(".mc-bd").onclick = function () { el.classList.remove("drw"); };
    // keychain
    var pop = $(".mc-pop");
    function openKeys() { var r = $(".mc-kc").getBoundingClientRect(), m = el.getBoundingClientRect(); pop.style.left = Math.max(10, Math.min(r.left - m.left, m.width - 350)) + "px"; pop.style.top = ""; pop.style.bottom = Math.max(10, m.bottom - r.top + 6) + "px";
      if (mobile() && !el.classList.contains("drw")) { pop.style.left = "10px"; pop.style.bottom = ""; pop.style.top = "50px"; }
      $(".mc-k").value = ""; $(".mc-k").placeholder = S.key ? "Key saved · paste to replace" : "Paste your Meta API key"; pop.hidden = false; $(".mc-k").focus(); }
    function keyUI() { $(".mc-kc").classList.toggle("on", !!S.key); $(".mc-kc").title = S.key ? "Meta API key saved" : "Add your Meta API key"; $(".mc-kdel").disabled = !S.key; }
    $(".mc-kc").onclick = function () { pop.hidden ? openKeys() : (pop.hidden = true); };
    $(".mc-kx").onclick = function () { pop.hidden = true; };
    $(".mc-ksave").onclick = function () { var k = $(".mc-k").value.trim(); if (!k) return; S.key = k; ls(KS, k); $(".mc-k").value = ""; keyUI(); setLive(true); pop.hidden = true; };
    $(".mc-k").onkeydown = function (e) { if (e.key === "Enter") $(".mc-ksave").onclick(); };
    $(".mc-kdel").onclick = function () { S.key = ""; ls(KS, null); keyUI(); setLive(false); pop.hidden = true; };
    function setLive(on) { S.live = on; $(".mc-lv").classList.toggle("on", on); $(".mc-mode").textContent = on ? "live · " + MODEL : "recorded"; $(".mc-t").placeholder = on ? "Message Muse Spark" : "Pick an example, or add your key for live"; }
    $(".mc-lv").onclick = function () { if (S.live) return setLive(false); if (!S.key) return openKeys(); setLive(true); };
    // conversations (this session, in memory)
    function snap() { return { seed: S.seed, batches: S.batches, paths: S.paths, derived: S.derived, hist: S.hist, changed: S.changed, html: log.innerHTML, ex: $(".mc-exs").innerHTML, g: $(".mc-g").innerHTML }; }
    function load(c) { S.seed = c.seed; S.batches = c.batches; S.paths = c.paths; S.derived = c.derived; S.hist = c.hist; S.changed = c.changed; log.innerHTML = c.html; $(".mc-exs").innerHTML = c.ex; $(".mc-g").innerHTML = c.g;
      log.querySelectorAll(".mc-yes,.mc-no,.mc-addkey").forEach(function (b) { b.remove(); }); }
    function conv() { return S.convs.filter(function (c) { return c.id === S.cur; })[0]; }
    function save() { var c = conv(); if (c) Object.assign(c, snap()); }
    function listUI() { var box = $(".mc-cv"); box.innerHTML = "";
      S.convs.slice().reverse().forEach(function (c) { var b = document.createElement("button"); b.textContent = c.title; b.title = c.title; if (c.id === S.cur) b.className = "cur";
        b.onclick = function () { if (S.busy || c.id === S.cur) return; save(); S.cur = c.id; load(c); listUI(); el.classList.remove("drw"); scr.scrollTop = scr.scrollHeight; }; box.appendChild(b); });
      if (!S.convs.length) box.innerHTML = '<p class="mc-info">No chats yet.</p>'; }
    function fresh() { S.seed = {}; S.batches = []; S.paths = new Set(); S.derived = {}; S.hist = []; S.changed = {}; S.focus = [];
      log.innerHTML = ""; $(".mc-exs").innerHTML = ""; $(".mc-g").innerHTML = EMPTY; ta.value = ""; ta.oninput(); S.cur = 0; listUI(); }
    function title(text) { if (S.cur) return; S.cur = ++S.n; S.convs.push(Object.assign({ id: S.cur, title: text.length > 42 ? text.slice(0, 40) + "…" : text }, snap())); listUI(); }
    $(".mc-new").onclick = function () { if (S.busy) return; save(); fresh(); el.classList.remove("drw"); ta.focus(); };
    CHIPS.forEach(function (id) { var r = rec[id]; if (!r) return; var b = document.createElement("button"); b.className = "mc-chip"; b.textContent = r.text;
      b.onclick = function () { send(r.text, r); }; $(".mc-chips").appendChild(b); });
    ta.oninput = function () { ta.style.height = "auto"; ta.style.height = Math.min(180, ta.scrollHeight) + "px"; };
    ta.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ta.value); } };
    $(".mc-go").onclick = function () { send(ta.value); };
    keyUI(); setLive(!!S.key); listUI();

    // the conversation's this.me: seed state + every confirmed batch, replayed on a real kernel
    function build(extraSeed, extraOps) { var seed = extraSeed ? seedMerge(clone(S.seed), extraSeed) : S.seed, me = newME(seed);
      S.batches.forEach(function (b) { applyOps(me, b.ops, { confirm: true, secretKeys: b.keys }); }); if (extraOps) applyOps(me, extraOps, { dryRun: true }); return me; }
    function known(extraSeed) { var k = new Set(S.paths); if (extraSeed) flatten(extraSeed).forEach(function (x) { k.add(x[0]); }); Object.keys(S.derived).forEach(function (p) { k.add(p); }); return Array.from(k); }
    // kernel.ts dryRun, against the cumulative state
    function dry(ops, seed) { var kn = known(seed), before = build(seed), after, errors = [], reads = {};
      try { after = build(seed); reads = applyOps(after, ops, { dryRun: true }); } catch (e) { errors.push("kernel rejected the ops: " + e.message); }
      var diff = touched(ops, kn).map(function (p) { return { path: p, before: read(before, p), after: after ? read(after, p) : undefined }; });
      ops.forEach(function (o, i) { if (o.op !== "define") return; var ps = touched([o], kn);
        if (!ps.length) errors.push("ops[" + i + "]: define on " + o.path + " matches no existing members");
        ps.forEach(function (p) { if (after && read(after, p) === undefined) errors.push("ops[" + i + "]: " + p + ' = "' + o.expr + '" evaluates to undefined (unknown name in expr?)'); }); });
      return { diff: diff, reads: reads, errors: errors, known: kn, after: after }; }
    // only what the proposal touches: written paths, derived nodes that recompute, and their direct inputs
    function mini(ops, d) { if (!d.after || d.errors.length) return ""; var ch = {}, der = {}, deps = [], nodes = new Set();
      d.diff.forEach(function (x) { ch[x.path] = 1; nodes.add(x.path); });
      ops.forEach(function (o) { if (o.op === "define") touched([o], d.known).forEach(function (p) { der[p] = 1; }); });
      Object.keys(S.derived).concat(Object.keys(der)).forEach(function (p) { try { var on = ((d.after.explain(p).meta || {}).dependsOn || []).map(canon);
        if (der[p] || on.some(function (f) { return ch[f]; })) { der[p] = 1; ch[p] = 1; nodes.add(p); on.forEach(function (f) { nodes.add(f); deps.push({ from: f, to: p }); }); } } catch (e) {} });
      if (!nodes.size) return "";
      return '<div class="mc-mini">' + graph(Array.from(nodes).map(function (p) { return { path: p, value: read(d.after, p) }; }), der, deps, ch) + "</div>"; }

    function bubble(cls, html) { var d = document.createElement("div"); d.className = "mc-m " + cls; d.innerHTML = html; log.appendChild(d); scr.scrollTop = scr.scrollHeight; return d; }
    function send(text, r) {
      text = String(text || "").trim(); if (!text || S.busy) return; ta.value = ""; ta.oninput();
      var force = /^me:/i.test(text), body = force ? text.replace(/^me:\s*/i, "") : text;
      r = r || byText(body);
      title(text); bubble("mc-u", esc(text));
      if (!S.live) {
        if (!r) { bubble("mc-a", '<div class="mc-note">Recorded mode only replays real responses from the eval run, so there is no answer for this message. <a href="#" class="mc-addkey">Add your Meta API key</a> to talk to ' + MODEL + " live, or pick an example above.</div>")
          .querySelector(".mc-addkey").onclick = function (e) { e.preventDefault(); openKeys(); }; save(); return; }
        proposal(bubble("mc-a", ""), { ops: r.ops }, "recorded · " + MODEL + " · " + String((D.run && D.run.date) || "").slice(0, 10), r.state, { text: r.text }); return save();
      }
      var seed = r ? r.state : null, a = bubble("mc-a", '<div class="mc-note">…</div>'), t0 = performance.now();
      var input = { text: body, state: (function () { var me = build(seed), st = {}; known(seed).forEach(function (p) { st[p] = read(me, p); }); return st; })(), speaker: r && r.speaker };
      // userMessage() flattens nested objects; here state is already flat path -> value
      S.busy = true; $(".mc-go").disabled = true;
      liveChat(S.key, input, S.hist, force, function (t) { if (t.errors.length) a.innerHTML = '<div class="mc-note">attempt ' + t.attempts + " rejected, sending the errors back…</div>"; },
        function (ops) { return dry(ops, seed).errors; })
        .then(function (t) { var src = "live · " + MODEL + " · " + Math.round(performance.now() - t0) + " ms" + (t.attempts > 1 ? " · " + t.attempts + " attempts" : "");
          S.hist.push({ role: "user", content: body });
          if (t.text !== undefined) { S.hist.push({ role: "assistant", content: t.text }); a.innerHTML = '<div class="mc-tx">' + esc(t.text) + '</div><div class="mc-src">' + esc(src) + "</div>"; return; }
          S.hist.push({ role: "assistant", content: t.reply });
          if (t.obj == null) { a.innerHTML = '<div class="mc-src">' + esc(src) + '</div><pre class="mc-code">' + esc(t.reply) + '</pre><div class="mc-v mc-bad">✗ model reply is not a JSON object</div>'; return; }
          proposal(a, t.obj, src, seed, { text: body }); })
        .catch(function (e) { a.innerHTML = '<div class="mc-v mc-bad">' + esc(e.message) + "</div>"; })
        .then(function () { S.busy = false; $(".mc-go").disabled = false; scr.scrollTop = scr.scrollHeight; save(); });
    }

    function proposal(a, obj, src, seed) {
      var list = obj && Array.isArray(obj.ops) ? obj.ops : [], v = validateOps(obj);
      var h = '<div class="mc-src">' + esc(src) + "</div>";
      if (list.length) h += '<pre class="mc-code me-code">' + hl(list.map(opCode).join("\n")) + "</pre>";
      else if (!v.errors.length) { a.innerHTML = h + '<div class="mc-note">Nothing to record in that message.</div>'; return; }
      if (v.errors.length) { a.innerHTML = h + '<div class="mc-v mc-bad">✗ ' + v.errors.map(esc).join("<br>✗ ") + '</div><div class="mc-note">Rejected by the validator; nothing reaches the kernel.</div>'; return; }
      var d = dry(v.ops, seed);
      h += '<div class="mc-v ' + (d.errors.length ? "mc-bad" : "mc-ok") + '">' + (d.errors.length ? "✗ " + d.errors.map(esc).join("<br>✗ ") : '✓ <span style="color:' + FG2 + '">validated · dry-run ok</span>') + "</div>";
      var df = d.diff.map(function (x) { return '<span class="mc-p">' + esc(x.path) + "</span> " + (x.before === undefined ? "" : '<span class="mc-del">' + esc(J(x.before)) + "</span> ") + '→ <span class="mc-n">' + esc(J(x.after)) + "</span>"; })
        .concat(Object.keys(d.reads).map(function (p) { return '<span class="mc-p">' + esc(p) + '</span> = <span class="mc-n">' + esc(J(d.reads[p])) + "</span>"; }));
      if (df.length) h += '<div class="mc-diff">' + df.join("<br>") + "</div>";
      h += mini(v.ops, d);
      var onlyQuery = v.ops.every(function (o) { return o.op === "query"; });
      if (!d.errors.length && !onlyQuery) {
        var sec = v.ops.filter(function (o) { return o.op === "secret" || o.op === "noise"; }), need = v.ops.filter(function (o) { return CONFIRM.indexOf(o.op) >= 0; });
        if (need.length) h += '<div class="mc-note mc-warn">Needs your OK: ' + need.map(function (o) { return o.op; }).join(", ") + ".</div>";
        h += sec.map(function (o) { return '<div class="mc-row"><input class="mc-in mc-sk" data-p="' + esc(o.path) + '" type="password" placeholder="key for ' + esc(o.path) + ' (never sent to the model)"></div>'; }).join("");
        h += '<div class="mc-row"><button class="mc-btn mc-yes">Confirm</button><button class="mc-btn ghost mc-no">Discard</button><span class="mc-out mc-note" style="margin:0"></span></div>';
      }
      a.innerHTML = h; scr.scrollTop = scr.scrollHeight;
      var yes = a.querySelector(".mc-yes"); if (!yes) return;
      var done = function (msg, cls) { a.querySelectorAll(".mc-yes,.mc-no").forEach(function (b) { b.remove(); }); var o = a.querySelector(".mc-out"); o.className = "mc-out mc-note " + (cls || ""); o.textContent = msg; };
      a.querySelector(".mc-no").onclick = function () { done("Discarded. Nothing changed."); save(); };
      yes.onclick = function () {
        var sk = {}; a.querySelectorAll(".mc-sk").forEach(function (i) { if (i.value) sk[i.dataset.p] = i.value; });
        var prevSeed = S.seed, prevPaths = new Set(S.paths), prevDer = Object.assign({}, S.derived);
        try {
          if (seed) S.seed = seedMerge(clone(S.seed), seed);
          flatten(S.seed).forEach(function (x) { S.paths.add(x[0]); });
          S.batches.push({ ops: v.ops, keys: sk });
          var me = build();
          d.diff.forEach(function (x) { if (x.after !== undefined) S.paths.add(x.path); });
          v.ops.forEach(function (o) { if (o.op === "remove") { var p = canon(o.path + "." + o.key); Array.from(S.paths).forEach(function (q) { if (q === p || q.indexOf(p + ".") === 0 || q.indexOf(p + "[") === 0) S.paths.delete(q); }); delete S.derived[p]; try { var so = keys(canon(o.path)).reduce(function (x, k) { return x[k]; }, S.seed); if (so) delete so[o.key]; } catch (e) {} }
            if (o.op === "define") touched([o], d.known).forEach(function (p) { S.derived[p] = 1; S.paths.delete(p); }); });
          S.changed = {}; d.diff.forEach(function (x) { S.changed[x.path] = 1; });
          render(me); done("Applied.", "mc-ok"); save();
        } catch (e) { S.batches.pop(); S.seed = prevSeed; S.paths = prevPaths; S.derived = prevDer; done(e.message, "mc-bad"); }
      };
    }

    function render(me) {
      var deps = [], exs = [], dpaths = Object.keys(S.derived);
      dpaths.forEach(function (p) { try { var x = me.explain(p); var on = ((x.meta && x.meta.dependsOn) || []);
        on.forEach(function (f) { deps.push({ from: f, to: p }); });
        if (S.changed[p] || on.some(function (f) { return S.changed[canon(f)]; })) exs.push(x); } catch (e) {} });
      var leaves = Array.from(S.paths).concat(dpaths).map(function (p) { return { path: p, value: read(me, p) }; });
      $(".mc-g").innerHTML = leaves.length ? graph(leaves, S.derived, deps, S.changed) : "";
      $(".mc-exs").innerHTML = exs.length ? exs.map(exBlock).join("") + '<p class="mc-note">The model only named the formula; the kernel computed the value. <a href="https://neurons-me.github.io/.me/docs/Explain.html">explain()</a> shows where it came from.</p>' : "";
    }
    $(".mc-g").innerHTML = EMPTY;
  }

  function MetaDemo() {
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (!document.getElementById("mc-css")) { var s = document.createElement("style"); s.id = "mc-css"; s.textContent = CSS; document.head.appendChild(s); }
      if (ref.current && !ref.current.dataset.on) { ref.current.dataset.on = "1"; mount(ref.current); }
    }, []);
    return React.createElement("div", { ref: ref });
  }
  root.LandingLive = Object.assign(root.LandingLive || {}, { MetaDemo: MetaDemo });
  root.MetaDemoMount = mount;
})(typeof window !== "undefined" ? window : this);
