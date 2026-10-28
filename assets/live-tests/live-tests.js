/*! live-tests 1.0.0 · test suites run live in the browser, one shared runner · MIT · neurons.me
 * Runs a suite registered on window.LiveSuites[name] (assets/live-tests/suite-*.js, each a verbatim port of a Node
 * test file: README examples, axioms) against this.me loaded from jsDelivr (ESM, +esm). The version selector lists the npm versions (jsDelivr data API) and defaults to the
 * npm "latest" tag; the version shown is read back from the loaded package's own package.json.
 * keccak256 comes from js-sha3 (the same package the Node test uses); assert.equal / assert.deepEqual are small strict
 * equivalents of node:assert/strict. An example that fails only because a Node-only API is missing is shown as
 * "Node only" instead of as a failure.
 * landing-gui.js renders <section data-live="LiveTests" data-suite="axioms"> as this component (window.LandingLive
 * registry; the section's data-* attributes become props). ?v=x.y.z picks the version on every page that uses it.
 */
(function (root) {
  var React = root.React; if (!React) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var V = function (n, fb) { return "var(--mui-palette-" + n + ", " + fb + ")"; };
  var FG = V("text-primary", "currentColor"), FG2 = V("text-secondary", "#8b949e"), GRID = V("divider", "rgba(127,127,127,.25)");
  var OK = V("success-main", "#3fb950"), BAD = V("error-main", "#ff7b72"), RUN = V("primary-main", "#58a6ff"), WARN = V("warning-main", "#d29922");
  var mix = function (a, p, b) { return "color-mix(in srgb, " + a + " " + p + "%, " + b + ")"; };
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var CSS = ".rl{margin:8px 0 28px;color:" + FG + ";font-size:14px}" +
    ".rl-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 12px}.rl-sp{flex:1}" +
    ".rl-ver{font-family:" + MONO + ";font-size:15px;font-weight:800;padding:6px 12px;border-radius:999px;border:1px solid " + RUN + ";color:" + RUN + "}" +
    ".rl select,.rl button{font:inherit;font-size:13px;color:" + FG + ";background:transparent;border:1px solid " + GRID + ";border-radius:8px;padding:6px 10px;cursor:pointer}" +
    ".rl select option{color:#111;background:#fff}" +
    ".rl button.rl-go{border-color:" + RUN + ";color:" + RUN + ";font-weight:700}.rl button:disabled{opacity:.5;cursor:default}" +
    ".rl :focus-visible{outline:2px solid " + RUN + ";outline-offset:2px}" +
    ".rl-sum{font-weight:700;margin:0 0 10px}.rl-sum.ok{color:" + OK + "}.rl-sum.bad{color:" + BAD + "}" +
    ".rl-list{border:1px solid " + GRID + ";border-radius:12px;overflow:hidden}" +
    ".rl-row+.rl-row{border-top:1px solid " + GRID + "}" +
    ".rl-row>summary{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;list-style:none}.rl-row>summary::-webkit-details-marker{display:none}" +
    ".rl-row>summary:hover{background:" + mix(FG, 5, "transparent") + "}" +
    ".rl-n{font-family:" + MONO + ";color:" + FG2 + ";width:1.4em;text-align:right;flex:none}" +
    ".rl-name{flex:1;min-width:0}.rl-ms{font-family:" + MONO + ";font-size:12px;color:" + FG2 + ";flex:none}" +
    ".rl-st{flex:none;font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid currentColor;min-width:5.4em;text-align:center}" +
    ".rl-st.pending{color:" + FG2 + "}.rl-st.running{color:" + RUN + "}.rl-st.pass{color:" + OK + "}.rl-st.fail{color:" + BAD + "}.rl-st.node{color:" + WARN + "}" +
    ".rl-car{flex:none;color:" + FG2 + ";transition:transform .15s}.rl-row[open] .rl-car{transform:rotate(90deg)}" +
    ".rl-body{padding:0 12px 12px 40px}.rl-lab{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:" + FG2 + ";margin:8px 0 4px}" +
    ".rl pre{margin:0;padding:10px 12px;border-radius:8px;border:1px solid " + GRID + ";background:" + mix(FG, 4, "transparent") + ";font-family:" + MONO + ";font-size:12.5px;line-height:1.55;overflow:auto;white-space:pre}" +
    ".rl pre.err{color:" + BAD + ";white-space:pre-wrap}" +
    ".rl-note{color:" + FG2 + ";font-size:12.5px;margin:10px 0 0}" +
    ".rl-id{flex:none;font-family:" + MONO + ";font-size:12px;font-weight:800;color:" + RUN + ";min-width:5.6em}" +
    ".rl-ck{margin:0;padding-left:18px;color:" + FG2 + ";font-size:13px;line-height:1.6}.rl-twin{margin:8px 0 0;font-size:12.5px;color:" + FG2 + "}.rl-twin code{font-family:" + MONO + "}" +
    "@media (max-width:600px){.rl-id{min-width:0;font-size:11px}.rl-body{padding-left:12px}.rl-ms{display:none}}";

  // ---- node:assert/strict, the two calls the test uses ----------------------------------------------------------
  function show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  function deq(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b) || Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && deq(a[k], b[k]); });
  }
  function AssertionError(m) { var e = new Error(m); e.name = "AssertionError"; return e; }
  var assert = {
    equal: function (a, b, m) { if (!Object.is(a, b)) throw AssertionError((m ? m + "\n" : "") + "Expected values to be strictly equal:\n  actual:   " + show(a) + "\n  expected: " + show(b)); },
    deepEqual: function (a, b, m) { if (!deq(a, b)) throw AssertionError((m ? m + "\n" : "") + "Expected values to be strictly deep-equal:\n  actual:   " + show(a) + "\n  expected: " + show(b)); },
    notEqual: function (a, b, m) { if (Object.is(a, b)) throw AssertionError(m || "Expected " + show(a) + " to be not strictly equal to " + show(b)); },
    ok: function (v, m) { if (!v) throw AssertionError(m || "Expected a truthy value, got " + show(v)); },
    throws: function (fn, m) { try { fn(); } catch (e) { return; } throw AssertionError(m || "Missing expected exception."); },
    doesNotThrow: function (fn, m) { try { fn(); } catch (e) { throw AssertionError((m || "Got unwanted exception.") + "\n  " + (e && e.message)); } },
  };
  root.LiveAssert = assert;

  var CDN = "https://cdn.jsdelivr.net/npm/";
  var NODE_ONLY = /^Node only|\b(require|process|Buffer|__dirname|module) is not defined\b|node:|Cannot find module/;
  function fmt(v) {
    return JSON.stringify(v, function (k, x) { return x === undefined ? "‹undefined›" : x; }, 2);
  }

  function LiveTests(props) {
    var SUITE = (root.LiveSuites || {})[props.suite] || { cases: [] }, EX = SUITE.cases;
    var st = useState({ tags: null, versions: [] }), meta = st[0], setMeta = st[1];
    var sv = useState(""), ver = sv[0], setVer = sv[1];
    var sl = useState(null), loaded = sl[0], setLoaded = sl[1];
    var sr = useState(EX.map(function () { return { status: "pending" }; })), rows = sr[0], setRows = sr[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    var se = useState(""), err = se[0], setErr = se[1];
    var runId = useRef(0);

    useEffect(function () {
      var want = new URLSearchParams(location.search).get("v");
      fetch("https://data.jsdelivr.com/v1/packages/npm/this.me").then(function (r) { return r.json(); }).then(function (d) {
        var vs = (d.versions || []).map(function (x) { return x.version; });
        setMeta({ tags: d.tags || {}, versions: vs });
        setVer(want && vs.indexOf(want) >= 0 ? want : (d.tags && d.tags.latest) || vs[0]);
      }).catch(function () { setMeta({ tags: { latest: "latest" }, versions: [] }); setVer(want || "latest"); });
    }, []);

    function run(v) {
      var id = ++runId.current; setBusy(true); setErr(""); setLoaded(null);
      setRows(EX.map(function () { return { status: "pending" }; }));
      Promise.all([
        import(CDN + "this.me@" + v + "/+esm"),
        import(CDN + "js-sha3@0.9.3/+esm"),
        fetch(CDN + "this.me@" + v + "/package.json").then(function (r) { return r.json(); }).catch(function () { return {}; }),
      ]).then(function (m) {
        if (id !== runId.current) return;
        var ThisMe = m[0].default || m[0].ThisMe || m[0], sha3 = m[1].default || m[1], keccak256 = sha3.keccak256 || m[1].keccak256;
        setLoaded(m[2].version || v);
        var out = [];
        (function step(i) {
          if (id !== runId.current) return;
          if (i >= EX.length) { setBusy(false); return; }
          out[i] = { status: "running" }; setRows(EX.map(function (_, j) { return out[j] || { status: "pending" }; }));
          setTimeout(function () {
            var t0 = performance.now(), r;
            try { if (EX[i].nodeOnly) throw new Error("Node only: " + EX[i].nodeOnly); var res = EX[i].fn(ThisMe, keccak256, assert); r = { status: "pass", ms: performance.now() - t0, result: fmt(res) }; }
            catch (e) { var msg = (e && (e.stack && e.name !== "AssertionError" ? e.name + ": " + e.message : e.message)) || String(e);
              r = { status: NODE_ONLY.test(msg) ? "node" : "fail", ms: performance.now() - t0, error: msg }; }
            out[i] = r; setRows(EX.map(function (_, j) { return out[j] || { status: "pending" }; }));
            step(i + 1);
          }, 60);
        })(0);
      }).catch(function (e) { if (id !== runId.current) return; setBusy(false); setErr("Could not load this.me@" + v + " from jsDelivr: " + (e && e.message || e)); });
    }
    useEffect(function () { if (ver) run(ver); }, [ver]);

    var done = rows.filter(function (r) { return r.status === "pass" || r.status === "fail" || r.status === "node"; }).length;
    var passed = rows.filter(function (r) { return r.status === "pass"; }).length, nodeOnly = rows.filter(function (r) { return r.status === "node"; }).length;
    var label = { pending: "pending", running: "running", pass: "pass", fail: "fail", node: "Node only" };
    var latest = meta.tags && meta.tags.latest;

    return h("div", { className: "rl", "data-done": !busy && done === EX.length ? "1" : "0" }, [
      h("style", { key: "css" }, CSS),
      h("div", { key: "bar", className: "rl-bar" }, [
        h("span", { key: "v", className: "rl-ver", title: "version read from the loaded package.json" }, "this.me@" + (loaded || (ver ? ver + " …" : "…"))),
        h("span", { key: "sp", className: "rl-sp" }),
        h("label", { key: "l", style: { display: "inline-flex", alignItems: "center", gap: 6, color: FG2, fontSize: 13 } }, ["Version",
          h("select", { key: "s", value: ver, disabled: !meta.versions.length, onChange: function (e) { setVer(e.target.value); }, "aria-label": "this.me version" },
            (meta.versions.length ? meta.versions : [ver]).map(function (v) {
              return h("option", { key: v, value: v }, v + (v === latest ? " (latest)" : "") + (meta.tags && v === meta.tags.stable ? " (stable)" : ""));
            }))]),
        h("button", { key: "b", className: "rl-go", disabled: busy || !ver, onClick: function () { run(ver); } }, busy ? "Running…" : "Run again"),
      ]),
      h("p", { key: "sum", className: "rl-sum " + (busy || !loaded ? "" : passed === EX.length ? "ok" : "bad"), "aria-live": "polite" },
        err ? err : (busy ? "Running " + done + " of " + EX.length + "…" : passed + " of " + EX.length + " passed") + " · this.me@" + (loaded || ver || "…") + (nodeOnly ? " · " + nodeOnly + " Node only" : "")),
      h("div", { key: "list", className: "rl-list" }, EX.map(function (ex, i) {
        var r = rows[i];
        return h("details", { key: i, className: "rl-row", "data-status": r.status }, [
          h("summary", { key: "s" }, [
            h("span", { key: "c", className: "rl-car", "aria-hidden": "true" }, "▸"),
            h("span", { key: "n", className: "rl-n" }, i + 1),
            ex.id && h("span", { key: "id", className: "rl-id" }, ex.id),
            h("span", { key: "t", className: "rl-name" }, ex.name),
            h("span", { key: "m", className: "rl-ms" }, r.ms != null ? r.ms.toFixed(1) + " ms" : ""),
            h("span", { key: "st", className: "rl-st " + r.status }, label[r.status]),
          ]),
          h("div", { key: "b", className: "rl-body" }, [
            ex.checks && h("div", { key: "l0", className: "rl-lab" }, "Checks"),
            ex.checks && h("ul", { key: "ck", className: "rl-ck" }, ex.checks.map(function (c, k) { return h("li", { key: k }, c); })),
            ex.twin && h("p", { key: "tw", className: "rl-twin" }, ["Rust twin: ", h("code", { key: "c" }, ex.twin)]),
            h("div", { key: "l1", className: "rl-lab" }, "Code"),
            h("pre", { key: "c" }, ex.code),
            r.result != null && h("div", { key: "l2", className: "rl-lab" }, "Result"),
            r.result != null && h("pre", { key: "r" }, r.result),
            r.error && h("div", { key: "l3", className: "rl-lab" }, r.status === "node" ? "Needs Node" : "Error"),
            r.error && h("pre", { key: "e", className: "err" }, r.error),
          ]),
        ]);
      })),
      h("p", { key: "note", className: "rl-note" }, "Runs in this tab: this.me and js-sha3 from jsDelivr (ESM), the same " + EX.length + " cases and assertions as " + (SUITE.source || "the Node test") + ". Pick a version, or add ?v=x.y.z to the URL."),
    ]);
  }
  root.LandingLive = Object.assign(root.LandingLive || {}, { LiveTests: LiveTests });
})(window);
