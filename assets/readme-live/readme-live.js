/*! readme-live 1.0.0 · the README examples, run live in the browser · MIT · neurons.me
 * Ports Typescript/tests/readme.examples.test.mjs (same 8 examples, same assertions) and runs them against this.me
 * loaded from jsDelivr (ESM, +esm). The version selector lists the npm versions (jsDelivr data API) and defaults to the
 * npm "latest" tag; the version shown is read back from the loaded package's own package.json.
 * keccak256 comes from js-sha3 (the same package the Node test uses); assert.equal / assert.deepEqual are small strict
 * equivalents of node:assert/strict. An example that fails only because a Node-only API is missing is shown as
 * "Node only" instead of as a failure.
 * landing-gui.js renders <section data-live="ReadmeLive"> as this component (window.LandingLive registry).
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
    "@media (max-width:600px){.rl-body{padding-left:12px}.rl-ms{display:none}}";

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
    equal: function (a, b) { if (!Object.is(a, b)) throw AssertionError("Expected values to be strictly equal:\n  actual:   " + show(a) + "\n  expected: " + show(b)); },
    deepEqual: function (a, b) { if (!deq(a, b)) throw AssertionError("Expected values to be strictly deep-equal:\n  actual:   " + show(a) + "\n  expected: " + show(b)); },
  };

  // ---- the 8 examples, verbatim from readme.examples.test.mjs (each returns what it observed, for the panel) ------
  var EX = [
    ["identity derives the documented compound seed", function (ThisMe, keccak256, assert) {
  const me = ThisMe("ana", "secret");

  const seed = keccak256("me.seed/compound:v1::ana::secret");
  const identityHash = keccak256("this.me/identity:v1::" + seed);

  assert.deepEqual(me["!"].identity(), {
    hash: identityHash,
    expression: "ana",
  });
  return { identity: me["!"].identity() };
    }],
    ["kernel callable reseed uses the same compound seed", function (ThisMe, keccak256, assert) {
  const me = ThisMe();
  me("ana", "secret");

  const same = ThisMe("ana", "secret");
  const constructed = new ThisMe.ME("ana", "secret");

  assert.deepEqual(me["!"].identity(), same["!"].identity());
  assert.deepEqual(constructed["!"].identity(), same["!"].identity());
  return { reseeded: me["!"].identity(), constructed: constructed["!"].identity() };
    }],
    ["semantic tree reads, private branch reads, and links work", function (ThisMe, keccak256, assert) {
  const me = ThisMe("suign", "secret");
  me.name("Sui Gn");
  me.bio("Building the semantic web.");
  me.wallet["_"]("wallet-key-2026");
  me.wallet.balance(12480);

  me.people.ana.name("Ana");
  me.people.ana.age(24);
  me.people.pablo.name("Pablo");
  me.people.pablo.age(17);
  me.people["[i]"]["="]("isAdult", "age >= 18");

  me.users.ana.name("Ana");
  me.friends.ana["->"]("users.ana");

  assert.equal(me("name"), "Sui Gn");
  assert.equal(me("wallet"), undefined);
  assert.equal(me("wallet.balance"), 12480);
  assert.equal(me("people.ana.isAdult"), true);
  assert.equal(me("people.pablo.isAdult"), false);
  assert.equal(me("friends.ana.name"), "Ana");
  return { name: me("name"), wallet: me("wallet"), "wallet.balance": me("wallet.balance"), "people.ana.isAdult": me("people.ana.isAdult"), "people.pablo.isAdult": me("people.pablo.isAdult"), "friends.ana.name": me("friends.ana.name") };
    }],
    ["privacy example keeps encrypted root hidden", function (ThisMe, keccak256, assert) {
  const me = ThisMe();

  me.secrets["_"]("private-key-2026");
  me.secrets.notes("Only I can see this.");
  me.name("Public Name");

  assert.equal(me("secrets"), undefined);
  assert.equal(me("secrets.notes"), "Only I can see this.");
  assert.equal(me("name"), "Public Name");
  return { secrets: me("secrets"), "secrets.notes": me("secrets.notes"), name: me("name") };
    }],
    ["reactivity and explainability example recomputes total", function (ThisMe, keccak256, assert) {
  const me = ThisMe();

  me.order.price(100);
  me.order.quantity(5);
  me.order["="]("total", "price * quantity");
  me.order.price(200);

  const trace = me.explain("order.total");

  assert.equal(me("order.total"), 1000);
  assert.equal(trace.value, 1000);
  assert.equal(trace.expr, "price * quantity");
  assert.deepEqual(trace.meta.dependsOn, ["order.price", "order.quantity"]);
  return { "order.total": me("order.total"), trace: { value: trace.value, expr: trace.expr, dependsOn: trace.meta.dependsOn } };
    }],
    ["search examples return the nearest encrypted vector", function (ThisMe, keccak256, assert) {
  const me = ThisMe();

  me.memory.episodic["_"]("search-key");
  me.memory.episodic[0]({
    id: 0,
    embedding: [1, 0],
    text: "semantic web",
  });
  me.memory.episodic[1]({
    id: 1,
    embedding: [0, 1],
    text: "robotics",
  });

  const exact = me.searchExact("memory.episodic", [1, 0], { k: 1 });
  assert.equal(exact.hits[0].path, "memory.episodic.0");

  const build = me.buildVectorIndex("memory.episodic", { k: 2, nprobe: 1 });
  assert.equal(build.totalVectors, 2);

  const approx = me.searchVector("memory.episodic", [1, 0], { k: 1, nprobe: 1 });
  assert.equal(approx.hits[0].path, "memory.episodic.0");
  return { exact: exact.hits[0], totalVectors: build.totalVectors, approx: approx.hits[0] };
    }],
    ["snapshot and replay example restores state", function (ThisMe, keccak256, assert) {
  const me = ThisMe();
  me.name("Sui Gn");

  const snapshot = me.exportSnapshot();
  const restored = ThisMe();
  restored.hydrate(snapshot);

  assert.equal(restored("name"), "Sui Gn");
  return { "restored.name": restored("name") };
    }],
    ["audience seed example is order independent", function (ThisMe, keccak256, assert) {
  function audienceSeed(seeds) {
    return keccak256("me.seed/audience:v1::" + [...seeds].sort().join("::"));
  }

  assert.equal(
    audienceSeed(["frank-seed", "ana-seed"]),
    audienceSeed(["ana-seed", "frank-seed"]),
  );
  return { seed: audienceSeed(["frank-seed", "ana-seed"]) };
    }],
  ].map(function (e) {
    var src = e[1].toString(), body = src.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    var lines = body.split("\n").filter(function (l) { return !/^\s*return \{/.test(l); });
    return { name: e[0], fn: e[1], code: lines.join("\n").replace(/^\s*\n|\s+$/g, "") };
  });

  var CDN = "https://cdn.jsdelivr.net/npm/";
  var NODE_ONLY = /\b(require|process|Buffer|__dirname|module) is not defined\b|node:|Cannot find module/;
  function fmt(v) {
    return JSON.stringify(v, function (k, x) { return x === undefined ? "‹undefined›" : x; }, 2);
  }

  function ReadmeLive() {
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
            try { var res = EX[i].fn(ThisMe, keccak256, assert); r = { status: "pass", ms: performance.now() - t0, result: fmt(res) }; }
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
            h("span", { key: "t", className: "rl-name" }, ex.name),
            h("span", { key: "m", className: "rl-ms" }, r.ms != null ? r.ms.toFixed(1) + " ms" : ""),
            h("span", { key: "st", className: "rl-st " + r.status }, label[r.status]),
          ]),
          h("div", { key: "b", className: "rl-body" }, [
            h("div", { key: "l1", className: "rl-lab" }, "Code"),
            h("pre", { key: "c" }, ex.code),
            r.result != null && h("div", { key: "l2", className: "rl-lab" }, "Result"),
            r.result != null && h("pre", { key: "r" }, r.result),
            r.error && h("div", { key: "l3", className: "rl-lab" }, r.status === "node" ? "Needs Node" : "Error"),
            r.error && h("pre", { key: "e", className: "err" }, r.error),
          ]),
        ]);
      })),
      h("p", { key: "note", className: "rl-note" }, "Runs in this tab: this.me and js-sha3 from jsDelivr (ESM), the same 8 examples and assertions as readme.examples.test.mjs. Pick a version, or add ?v=x.y.z to the URL."),
    ]);
  }
  root.LandingLive = Object.assign(root.LandingLive || {}, { ReadmeLive: ReadmeLive });
})(window);
