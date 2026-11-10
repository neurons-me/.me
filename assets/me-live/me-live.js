// The .me running on this page, shown where the text names it, and built from the page's own inputs.
// - <code data-live="MeLive" data-me="me|identityHash|prove"> (inline, rendered by landing-gui.js through window.LandingLive)
//   opens a small card on hover, focus or tap with that .me's public data.
// - <div data-live="MeSeedInput" data-mode="seed|compound"> draws the Seed field (new ME(seed)) or the Username + Secret
//   fields (new ME(username, secret)) with the same .GUI TextField the Cleaker sign-in form uses (GUI.Atoms.TextField).
// The kernel is the unmodified this.me 4.2.1 through window.MeKernel (assets/me-kernel, sha256 checked); identity is read
// from me[Symbol.for("me.identity")] → { hash, expression }.
// Which .me is "running here": the last input typed into that is not empty; with none, the anonymous .me of this browser.
// Anonymous: if the kernel already keeps an anonymous seed (this.me.seed:v1, left by a Run block on another doc page),
// new ME() reuses it, as the kernel always does; if not, the page builds it from 32 random bytes passed as an explicit seed,
// so nothing is written to storage. Explicit and compound seeds are never persisted by the kernel. Typed values stay in the
// masked fields only: they are never shown, logged or stored. Only public data is kept: identityHash, the expression
// (username), and for a held name the public key and namespace returned by a real prove() call.
(function () {
  "use strict";
  var G = window.GUI, R = window.React;
  if (!G || !R) return;
  var h = R.createElement, MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var SEED_KEY = "this.me.seed:v1", ID = Symbol.for("me.identity");
  var ROOT_NS = (location.hostname || "neurons-me.github.io").replace(/^www\./, "");

  // ── the page's .me: anonymous by default, or the last non-empty input ──
  var anon = { state: "idle" }, typed = { seed: null, compound: null }, order = [], subs = new Set(), anonStarted = false;
  function emit() { subs.forEach(function (f) { f(); }); }
  function current() {
    for (var i = order.length - 1; i >= 0; i--) if (typed[order[i]]) return typed[order[i]];
    return anon;
  }
  function hasStoredAnon() { try { return !!window.localStorage && Object.prototype.hasOwnProperty.call(window.localStorage, SEED_KEY); } catch (e) { return false; } }
  function freshHex() { var b = new Uint8Array(32); crypto.getRandomValues(b); var s = ""; for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0"); return s; }
  function kernel() { return window.MeKernel ? window.MeKernel.load() : Promise.reject(new Error("kernel loader missing (assets/me-kernel)")); }
  // public facts of a kernel instance; for a held name, one real prove() for the page's own root namespace (no challenge)
  function facts(me, source, extra) {
    var id = me[ID] || {}, out = Object.assign({ state: "ok", source: source, hash: String(id.hash || ""), expression: id.expression || null, kernel: window.MeKernel.KERNEL }, extra || {});
    if (!out.expression) return Promise.resolve(Object.assign(out, { prove: { ok: false, error: "ACTIVE_EXPRESSION_REQUIRED" } }));
    return me.prove({ rootNamespace: ROOT_NS }).then(function (r) { return Object.assign(out, { prove: { ok: true, publicKey: r.publicKey, namespace: r.namespace } }); },
      function (e) { return Object.assign(out, { prove: { ok: false, error: String(e && e.message || e) } }); });
  }
  function startAnon() {
    if (anonStarted) return; anonStarted = true;
    anon = { state: "loading" }; emit();
    kernel().then(function (ME) { var reused = hasStoredAnon(); return facts(reused ? new ME() : new ME(freshHex()), "anonymous", { reused: reused }); })
      .then(function (f) { anon = f; emit(); }, function (e) { anon = { state: "error", text: String(e && e.message || e) }; emit(); });
  }
  // build the .me of one input (seed: [s]; compound: [username, secret]); null clears it. Last call wins.
  var gen = { seed: 0, compound: 0 };
  function setTyped(which, args) {
    var g = ++gen[which];
    order = order.filter(function (x) { return x !== which; });
    if (!args) { typed[which] = null; if (!current().state || current() === anon) startAnon(); emit(); return; }
    order.push(which);
    typed[which] = { state: "loading", source: which }; emit();
    kernel().then(function (ME) {
      var me = which === "seed" ? new ME(args[0]) : new ME(args[0], args[1]);
      args = null;
      return facts(me, which);
    }).then(function (f) { if (g === gen[which]) { typed[which] = f; emit(); } },
      function (e) { if (g === gen[which]) { typed[which] = { state: "error", source: which, text: String(e && e.message || e) }; emit(); } });
  }
  function useTick() { var f = R.useState(0)[1]; R.useEffect(function () { var on = function () { f(function (n) { return n + 1; }); }; subs.add(on); return function () { subs.delete(on); }; }, []); }
  var short = function (x, a, b) { return x ? x.slice(0, a || 8) + "…" + x.slice(-(b || 6)) : "…"; };
  function statusOf(L) {
    if (L.source === "seed") return "seed typed here · not stored";
    if (L.source === "compound") return "held as " + L.expression + " · not stored";
    return L.expression ? "held as " + L.expression : L.reused ? "anonymous · seed kept by this browser" : "anonymous · this page load only, not stored";
  }
  function proveOf(L) {
    var p = L.prove || {};
    if (p.ok) return "can sign as " + p.namespace + " · public key " + short(p.publicKey, 8, 4) + " (private key derived locally, not shown)";
    if (p.error === "ACTIVE_EXPRESSION_REQUIRED") return "no active name yet — can't sign";
    return "can't sign here: " + (p.error || "unknown");
  }

  // ── the card ──
  function Row(p) {
    return h(G.Atoms.Box, { "data-me-row": p.k, sx: function (t) { return { display: "grid", gridTemplateColumns: "92px minmax(0, 1fr)", columnGap: 1.25, alignItems: "baseline", px: 1, py: .625, borderRadius: "6px",
        transition: "background-color .12s", bgcolor: p.on ? "color-mix(in srgb, " + t.palette.primary.main + " 14%, transparent)" : "transparent",
        boxShadow: p.on ? "inset 2px 0 0 " + t.palette.primary.main : "none" }; } },
      h(G.Atoms.Box, { component: "span", sx: { fontFamily: MONO, fontSize: ".72rem", color: p.on ? "primary.main" : "text.secondary" } }, p.label),
      h(G.Atoms.Box, { component: "span", sx: Object.assign({ fontSize: ".8rem", color: "text.primary", minWidth: 0, overflowWrap: "anywhere" }, p.sx || {}) }, p.children));
  }
  function MeCard(p) {
    useTick();
    var L = current(), Monad = (G.Widgets && G.Widgets.Monad) || G.Monad, ok = L.state === "ok", f = p.focus;
    return h(G.Atoms.Box, { "data-me-card": "", sx: { width: "min(340px, calc(100vw - 32px))", p: 1.25 } },
      h(G.Atoms.Box, { sx: { display: "flex", alignItems: "center", gap: 1.25, px: 1, pb: 1, mb: .5, borderBottom: 1, borderColor: "divider" } },
        h(G.Atoms.Box, { sx: { width: 34, height: 34, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", "& .monad-tooltip": { display: "none" } } },
          ok && Monad ? h(Monad, { key: L.hash, variant: "identity", kind: "me", seed: L.hash, mode: "contained", size: 26, tooltip: false, solid: true }) : null),
        h(G.Atoms.Box, { sx: { minWidth: 0 } },
          h(G.Atoms.Box, { sx: { fontWeight: 700, fontSize: ".92rem", color: "text.primary", lineHeight: 1.3 } }, ".me running here"),
          h(G.Atoms.Box, { sx: { fontFamily: MONO, fontSize: ".7rem", color: "text.secondary", lineHeight: 1.4 } },
            L.state === "error" ? "could not build the .me" : ok ? "this browser" : "loading…"))),
      L.state === "error" ? h(G.Atoms.Box, { sx: { px: 1, py: .5, fontSize: ".78rem", color: "text.secondary", overflowWrap: "anywhere" } }, L.text) : null,
      ok ? h(R.Fragment, null,
        h(Row, { k: "identityHash", label: "identityHash", on: f === "identityHash", sx: { fontFamily: MONO, fontSize: ".74rem", wordBreak: "break-all", userSelect: "all" } }, L.hash),
        h(Row, { k: "status", label: "status", on: f === "me" }, statusOf(L)),
        h(Row, { k: "prove", label: "prove()", on: f === "prove" }, proveOf(L))) : null);
  }

  // the one card, as a themed tooltip anchored to whatever opened it (a word in the text, or the inputs)
  var cardSlot = { tooltip: { sx: { bgcolor: "background.paper", color: "text.primary", border: 1, borderColor: "divider", borderRadius: "12px", boxShadow: 6, p: 0, maxWidth: "none", fontWeight: 400 } } };
  // ── the marked word in the text ──
  function MeLive(p) {
    var which = p.me || "me", text = p.text || (which === "me" ? ".me" : which);
    var st = R.useState(false), hover = st[0], setHover = st[1], pn = R.useState(false), pin = pn[0], setPin = pn[1], ref = R.useRef(null);
    var open = hover || pin;
    R.useEffect(function () { if (open) startAnon(); }, [open]);
    R.useEffect(function () {
      if (!pin) return undefined;
      var off = function (e) { if (e.type === "keydown" ? e.key === "Escape" : !(ref.current && ref.current.contains(e.target)) && !(e.target.closest && e.target.closest("[data-me-card]"))) { setPin(false); setHover(false); } };
      document.addEventListener("pointerdown", off); document.addEventListener("keydown", off);
      return function () { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", off); };
    }, [pin]);
    var label = which === "me" ? "The .me running on this page" : which === "identityHash" ? "identityHash of the .me running on this page" : "prove() of the .me running on this page";
    return h(G.Atoms.Tooltip, { open: open, onOpen: function () { setHover(true); }, onClose: function () { setHover(false); }, disableTouchListener: true, placement: "bottom-start",
        slotProps: cardSlot, title: h(MeCard, { focus: which }) },
      h(G.Atoms.Box, { component: "code", ref: ref, "data-gui-node-id": p["data-gui-node-id"], "data-me-live": which, tabIndex: 0, role: "button", "aria-label": label, "aria-expanded": open,
        onClick: function () { setPin(function (v) { return !v; }); },
        onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPin(function (v) { return !v; }); } },
        sx: function (t) { return { fontFamily: MONO, fontSize: ".86em", px: .5, py: .125, borderRadius: "4px", cursor: "pointer", color: open ? "primary.main" : "text.primary",
          bgcolor: open ? "color-mix(in srgb, " + t.palette.primary.main + " 14%, transparent)" : "action.hover",
          textDecoration: "underline dotted", textUnderlineOffset: "3px", textDecorationColor: t.palette.primary.main,
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "1px" } }; } }, text));
  }

  // ── a symbol in the formula (<code data-live="MeTerm" data-tip="keccak256">H</code>): a tiny tooltip with what it is in code ──
  function MeTerm(p) {
    var st = R.useState(false), hover = st[0], setHover = st[1], pn = R.useState(false), pin = pn[0], setPin = pn[1], ref = R.useRef(null), open = hover || pin;
    R.useEffect(function () {
      if (!pin) return undefined;
      var off = function (e) { if (e.type === "keydown" ? e.key === "Escape" : !(ref.current && ref.current.contains(e.target))) { setPin(false); setHover(false); } };
      document.addEventListener("pointerdown", off); document.addEventListener("keydown", off);
      return function () { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", off); };
    }, [pin]);
    return h(G.Atoms.Tooltip, { open: open, onOpen: function () { setHover(true); }, onClose: function () { setHover(false); }, disableTouchListener: true, placement: "top", arrow: true,
        slotProps: { tooltip: { sx: { bgcolor: "background.paper", color: "text.primary", border: 1, borderColor: "divider", borderRadius: "8px", boxShadow: 4, px: 1, py: .5, fontFamily: MONO, fontSize: ".74rem", fontWeight: 400, maxWidth: 320 } },
          arrow: { sx: { color: "background.paper", "&::before": { border: 1, borderColor: "divider" } } } },
        title: h("span", { "data-me-term-tip": p.text }, p.tip) },
      h(G.Atoms.Box, { component: "span", ref: ref, "data-gui-node-id": p["data-gui-node-id"], "data-me-term": p.text, tabIndex: 0, role: "button", "aria-label": p.text + ": " + p.tip,
        onClick: function () { setPin(function (v) { return !v; }); },
        onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPin(function (v) { return !v; }); } },
        sx: { fontFamily: "inherit", cursor: "help", color: open ? "primary.main" : "inherit", textDecoration: "underline dotted", textUnderlineOffset: "3px", textDecorationColor: "currentColor",
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "1px", borderRadius: "2px" } } }, p.text));
  }

  // ── the inputs: the Cleaker sign-in fields (GUI.Atoms.TextField), debounced into a new ME(…) ──
  function MeSeedInput(p) {
    useTick();
    var compound = p.mode === "compound", which = compound ? "compound" : "seed", TF = G.Atoms.TextField;
    var a = R.useState(""), seed = a[0], setSeed = a[1], b = R.useState(""), user = b[0], setUser = b[1], c = R.useState(""), secret = c[0], setSecret = c[1];
    R.useEffect(function () {
      var t = setTimeout(function () {
        if (compound) setTyped(which, user && secret ? [user, secret] : null);
        else setTyped(which, seed !== "" ? [seed] : null);
      }, 250);
      return function () { clearTimeout(t); };
    }, [seed, user, secret]);
    var fo = R.useState(false), focused = fo[0], setFocused = fo[1];
    var filled = compound ? !!(user && secret) : seed !== "";
    // uncontrolled (no value prop): React never mirrors the typed text into a value="" attribute in the DOM
    var field = function (label, set, masked, id) {
      return h(TF, { label: label, "data-gui-node-id": "Seed." + id, "data-me-input": id, type: masked ? "password" : "text", fullWidth: true, size: "small",
        autoComplete: "off", onChange: function (e) { set(e.target.value); },
        inputProps: { spellCheck: false, autoCapitalize: "off", autoCorrect: "off", "data-lpignore": "true", "data-1p-ignore": "true" } });
    };
    // no copy of the data here: while you type, the one .me card opens beside the fields and shows the .me they built
    return h(G.Atoms.Tooltip, { open: focused && filled, placement: "right-start", disableHoverListener: true, disableFocusListener: true, disableTouchListener: true,
        slotProps: Object.assign({}, cardSlot, { popper: { modifiers: [{ name: "flip", options: { fallbackPlacements: ["bottom-start", "top-start"] } }] } }),
        title: h(MeCard, { focus: compound ? "me" : "identityHash" }) },
      h(G.Atoms.Box, { "data-gui-node-id": p["data-gui-node-id"], "data-me-seed-input": which,
          onFocus: function () { setFocused(true); }, onBlur: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); },
          sx: { maxWidth: 360, display: "flex", flexDirection: "column", gap: 2, mt: .5, mb: 3 } },
        compound ? field("Username", setUser, false, "username") : null,
        compound ? field("Secret", setSecret, true, "secret") : field("Seed", setSeed, true, "seed")));
  }

  window.LandingLive = Object.assign(window.LandingLive || {}, { MeLive: MeLive, MeTerm: MeTerm, MeSeedInput: MeSeedInput });
  window.MeLive = { get state() { var L = current(); return { state: L.state, source: L.source, hash: L.hash, expression: L.expression, reused: L.reused, prove: L.prove && { ok: L.prove.ok, error: L.prove.error, publicKey: L.prove.publicKey, namespace: L.prove.namespace } }; }, start: startAnon };
})();
