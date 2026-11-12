// The .me running on this page, shown where the text names it, and built from the page's own inputs.
// - <code data-live="MeLive" data-me="me|identityHash|prove"> (inline, rendered by landing-gui.js through window.LandingLive)
//   opens a small card on hover, focus or tap with that .me's public data.
// - <div data-live="MeSeedInput" data-mode="seed|compound"> draws the Seed field (new ME(seed)) or the Username + Secret
// - <div data-live="MeCtorRecap"> is the three-constructor recap: hover, focus or tap a token to light matching
//   fields and QR cards on the page (same bind/pin/hover and primary outline as LlmsHero in .me/LLMS/assets/llms-hero.js).
//   fields (new ME(username, secret)) with the same .GUI TextField the Cleaker sign-in form uses (GUI.Atoms.TextField).
//   The identityHash card is rendered in flow, directly below the fields (same width), never as a floating tooltip.
// The identityHash shown while typing is keccak256 of the same domains this.me 4.2.1 uses
//   (IDENTITY_HASH_DOMAIN "this.me/identity:v1::" + seed; compound seed = keccak256("me.seed/compound:v1::"+who+"::"+secret)),
//   computed with the same js-sha3 keccak256 primitive, so the input never waits on a full kernel. prove() is filled in
//   afterwards from a real kernel instance, debounced, and only when an active name exists.
// The kernel is the unmodified this.me 4.2.1 through window.MeKernel (assets/me-kernel, sha256 checked); identity is read
// from me[Symbol.for("me.identity")] → { hash, expression }.
// Which .me is "running here": the last input typed into that is not empty; with none, the anonymous .me of this browser.
// Anonymous: same path as the kernel's `new ME()` — reuse localStorage["this.me.seed:v1"] if present, otherwise
// generate 32 random bytes, persist that key once, and derive identityHash from it. The intro QR/Hash shows this
// anonymous identity on load and when the Seed field is cleared. Typing an explicit seed updates the Hash/QR live
// and never writes localStorage. The anonymous seed itself is never displayed — only the public identityHash and QR.
// Explicit and compound seeds are never persisted by the kernel. Typed values stay in the masked fields only: they
// are never shown, logged or stored. Only public data is kept: identityHash, the expression (username), and for a
// held name the public key and namespace returned by a real prove() call.
(function () {
  "use strict";
  var G = window.GUI, R = window.React;
  if (!G || !R) return;
  var h = R.createElement, MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var SEED_KEY = "this.me.seed:v1", ID = Symbol.for("me.identity");
  var ROOT_NS = (location.hostname || "neurons-me.github.io").replace(/^www\./, "");
  var IDENTITY_HASH_DOMAIN = "this.me/identity:v1::";
  var COMPOUND_SEED_DOMAIN = "me.seed/compound:v1::";

  // keccak-256 with original keccak padding (0x01), same as js-sha3 keccak256 used by this.me 4.2.1
  var KECCAK_RC = [
    0x00000001, 0x00000000, 0x00008082, 0x00000000, 0x0000808a, 0x80000000, 0x80008000, 0x80000000,
    0x0000808b, 0x00000000, 0x80000001, 0x00000000, 0x80008081, 0x80000000, 0x00008009, 0x80000000,
    0x0000008a, 0x00000000, 0x00000088, 0x00000000, 0x80008009, 0x00000000, 0x8000000a, 0x00000000,
    0x8000808b, 0x00000000, 0x0000008b, 0x80000000, 0x00008089, 0x80000000, 0x00008003, 0x80000000,
    0x00008002, 0x80000000, 0x00000080, 0x80000000, 0x0000800a, 0x00000000, 0x8000000a, 0x80000000,
    0x80008081, 0x80000000, 0x00008080, 0x80000000, 0x80000001, 0x00000000, 0x80008008, 0x80000000
  ];
  var KECCAK_ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
  var KECCAK_PI = [0, 10, 20, 5, 15, 16, 1, 11, 21, 6, 7, 17, 2, 12, 22, 23, 8, 18, 3, 13, 14, 24, 9, 19, 4];
  function keccakF(s) {
    var C = new Uint32Array(10), B = new Uint32Array(50), round, x, y, i, a, b, lo, hi, n, n2, nlo, nhi, i1, i2, dest;
    for (round = 0; round < 24; round++) {
      for (x = 0; x < 5; x++) {
        C[2 * x] = s[2 * x] ^ s[2 * x + 10] ^ s[2 * x + 20] ^ s[2 * x + 30] ^ s[2 * x + 40];
        C[2 * x + 1] = s[2 * x + 1] ^ s[2 * x + 11] ^ s[2 * x + 21] ^ s[2 * x + 31] ^ s[2 * x + 41];
      }
      var D = new Uint32Array(10);
      for (x = 0; x < 5; x++) {
        a = 2 * ((x + 4) % 5); b = 2 * ((x + 1) % 5);
        lo = C[b]; hi = C[b + 1];
        D[2 * x] = C[a] ^ ((lo << 1) | (hi >>> 31));
        D[2 * x + 1] = C[a + 1] ^ ((hi << 1) | (lo >>> 31));
      }
      for (x = 0; x < 5; x++) {
        for (y = 0; y < 5; y++) {
          s[2 * (x + 5 * y)] ^= D[2 * x];
          s[2 * (x + 5 * y) + 1] ^= D[2 * x + 1];
        }
      }
      for (i = 0; i < 25; i++) {
        lo = s[2 * i]; hi = s[2 * i + 1]; n = KECCAK_ROT[i];
        if (n === 0) { nlo = lo; nhi = hi; }
        else if (n === 32) { nlo = hi; nhi = lo; }
        else if (n > 32) { n2 = n - 32; nlo = (hi << n2) | (lo >>> (32 - n2)); nhi = (lo << n2) | (hi >>> (32 - n2)); }
        else { nlo = (lo << n) | (hi >>> (32 - n)); nhi = (hi << n) | (lo >>> (32 - n)); }
        dest = KECCAK_PI[i];
        B[2 * dest] = nlo; B[2 * dest + 1] = nhi;
      }
      for (y = 0; y < 5; y++) {
        for (x = 0; x < 5; x++) {
          i = 2 * (x + 5 * y);
          i1 = 2 * ((x + 1) % 5 + 5 * y);
          i2 = 2 * ((x + 2) % 5 + 5 * y);
          s[i] = B[i] ^ (~B[i1] & B[i2]);
          s[i + 1] = B[i + 1] ^ (~B[i1 + 1] & B[i2 + 1]);
        }
      }
      s[0] ^= KECCAK_RC[2 * round];
      s[1] ^= KECCAK_RC[2 * round + 1];
    }
  }
  function keccak256(input) {
    var bytes, i, u, s, rate, off, rem, block, lo, hi, li, hex, v, parts;
    if (typeof input === "string") {
      u = unescape(encodeURIComponent(input));
      bytes = new Uint8Array(u.length);
      for (i = 0; i < u.length; i++) bytes[i] = u.charCodeAt(i);
    } else bytes = input;
    s = new Uint32Array(50);
    rate = 136;
    off = 0;
    while (off + rate <= bytes.length) {
      for (i = 0; i < rate; i += 8) {
        lo = bytes[off + i] | (bytes[off + i + 1] << 8) | (bytes[off + i + 2] << 16) | (bytes[off + i + 3] << 24);
        hi = bytes[off + i + 4] | (bytes[off + i + 5] << 8) | (bytes[off + i + 6] << 16) | (bytes[off + i + 7] << 24);
        li = i >> 2;
        s[li] ^= lo; s[li + 1] ^= hi;
      }
      keccakF(s);
      off += rate;
    }
    block = new Uint8Array(rate);
    rem = bytes.length - off;
    for (i = 0; i < rem; i++) block[i] = bytes[off + i];
    block[rem] ^= 0x01;
    block[rate - 1] ^= 0x80;
    for (i = 0; i < rate; i += 8) {
      lo = block[i] | (block[i + 1] << 8) | (block[i + 2] << 16) | (block[i + 3] << 24);
      hi = block[i + 4] | (block[i + 5] << 8) | (block[i + 6] << 16) | (block[i + 7] << 24);
      li = i >> 2;
      s[li] ^= lo; s[li + 1] ^= hi;
    }
    keccakF(s);
    hex = "";
    for (i = 0; i < 32; i += 4) {
      v = s[i >> 2] >>> 0;
      parts = ("00000000" + v.toString(16)).slice(-8).match(/../g);
      hex += parts[3] + parts[2] + parts[1] + parts[0];
    }
    return hex;
  }
  function identityHashOf(seed) { return keccak256(IDENTITY_HASH_DOMAIN + seed); }
  function compoundSeedOf(who, secret) { return keccak256(COMPOUND_SEED_DOMAIN + who + "::" + secret); }
  function cheapFacts(which, args) {
    var expression = null, seed, hash;
    if (which === "seed") seed = String(args[0]);
    else { expression = String(args[0]); seed = compoundSeedOf(args[0], args[1]); }
    hash = identityHashOf(seed);
    return {
      state: "ok", source: which, hash: hash, expression: expression,
      kernel: window.MeKernel && window.MeKernel.KERNEL,
      prove: expression ? { ok: false, pending: true } : { ok: false, error: "ACTIVE_EXPRESSION_REQUIRED" }
    };
  }

  // ── the page's .me: anonymous by default, or the last non-empty input ──
  var anon = { state: "idle" }, typed = { seed: null, compound: null }, order = [], subs = new Set(), anonStarted = false;
  function emit() { subs.forEach(function (f) { f(); }); }
  function current() {
    for (var i = order.length - 1; i >= 0; i--) if (typed[order[i]]) return typed[order[i]];
    return anon;
  }
  function hasStoredAnon() { try { return !!window.localStorage && Object.prototype.hasOwnProperty.call(window.localStorage, SEED_KEY); } catch (e) { return false; } }
  function freshHex() { var b = new Uint8Array(32); crypto.getRandomValues(b); var s = ""; for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0"); return s; }
  function readStoredAnonSeed() {
    try {
      if (!window.localStorage) return null;
      var stored = window.localStorage.getItem(SEED_KEY);
      return stored === null ? null : stored;
    } catch (e) { return null; }
  }
  // Kernel path for anonymous new ME(): readStoredSeed() ?? generateSeed(), then persistSeed once.
  // The raw seed stays in this closure and in localStorage under SEED_KEY. It is never put on a
  // live object, in the DOM, or on window.MeLive — only the identityHash is public.
  var anonIdentity = null;
  function ensureAnonIdentity() {
    if (anonIdentity && anonIdentity.hash) return anonIdentity;
    var seed = readStoredAnonSeed();
    if (seed === null) {
      seed = freshHex();
      try { window.localStorage.setItem(SEED_KEY, seed); } catch (e) {}
    }
    anonIdentity = { state: "ok", source: "anonymous", hash: identityHashOf(seed), expression: null,
      prove: { ok: false, error: "ACTIVE_EXPRESSION_REQUIRED" }, reused: hasStoredAnon() };
    return anonIdentity;
  }
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
    var local = ensureAnonIdentity();
    anon = local; emit();
    kernel().then(function (ME) { return facts(new ME(), "anonymous", { reused: hasStoredAnon() }); })
      .then(function (f) {
        if (f && local && f.hash && local.hash && f.hash !== local.hash) f = Object.assign({}, f, { hash: local.hash });
        if (f) { anon = f; emit(); }
      }, function () { /* keep the sync anonymous identity already shown */ });
  }
  // Last call wins. identityHash is set immediately from the cheap keccak path.
  // A full kernel is only constructed (debounced by the input) when prove() needs it — never to compute the hash, and never in a way that blocks typing.
  var gen = { seed: 0, compound: 0 };
  function setTyped(which, args) {
    var g = ++gen[which], f;
    order = order.filter(function (x) { return x !== which; });
    if (!args) { typed[which] = null; if (!current().state || current() === anon) startAnon(); emit(); return; }
    order.push(which);
    f = cheapFacts(which, args);
    typed[which] = f; emit();
    if (!f.expression) { args = null; return; }
    kernel().then(function (ME) {
      if (g !== gen[which]) return null;
      var me = new ME(args[0], args[1]);
      args = null;
      var id = me[ID] || {};
      if (id.hash && id.hash !== f.hash) { f = Object.assign({}, f, { hash: String(id.hash) }); typed[which] = f; emit(); }
      return facts(me, which);
    }).then(function (k) { if (k && g === gen[which]) { typed[which] = k; emit(); } },
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
    if (p.pending) return "computing…";
    if (p.ok) return "can sign as " + p.namespace + " · public key " + short(p.publicKey, 8, 4) + " (private key derived locally, not shown)";
    if (p.error === "ACTIVE_EXPRESSION_REQUIRED") return "no active name yet — can't sign";
    return "can't sign here: " + (p.error || "unknown");
  }

  // ── the card: in-flow under the inputs; real G.QRme (namespace lives on the QR via perimeterLabel) and identityHash beside it ──
  var CAP = { color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.68rem" };
  function shortHashOf(hash, compact) {
    if (!hash) return "…";
    return compact ? hash.slice(0, 8) + "…" + hash.slice(-6) : hash.slice(0, 10) + "…" + hash.slice(-8);
  }
  function ExpandableHash(p) {
    var hash = p.hash || "", compact = !!p.compact, fit = !!p.fit;
    var st = R.useState(false), expanded = st[0], setExpanded = st[1];
    if (!hash) return null;
    return h(G.Atoms.Box, {
      component: "button", type: "button",
      "data-me-hash-short": expanded ? undefined : "",
      "data-me-hash": expanded ? "" : undefined,
      "data-me-hash-expand": expanded ? "open" : "closed",
      "aria-expanded": expanded,
      "aria-label": expanded ? "Collapse hash" : "Expand hash",
      onClick: function (e) { e.preventDefault(); e.stopPropagation(); setExpanded(function (v) { return !v; }); },
      sx: {
        display: "block", width: (fit && !expanded) ? "auto" : "100%", boxSizing: "border-box", textAlign: "left",
        border: 0, background: "none", cursor: "pointer", p: 0, m: 0,
        fontFamily: MONO, fontWeight: expanded ? 600 : 700,
        fontSize: expanded ? (compact ? "0.52rem" : "0.62rem") : (compact ? "0.78rem" : "0.95rem"),
        color: "primary.main", letterSpacing: "0.02em", lineHeight: expanded ? 1.45 : 1.3,
        whiteSpace: expanded ? "normal" : "nowrap",
        overflow: expanded ? "visible" : "hidden",
        textOverflow: expanded ? "clip" : "ellipsis",
        wordBreak: expanded ? "break-all" : "normal",
        overflowWrap: expanded ? "anywhere" : "normal",
        maxWidth: "100%", userSelect: expanded ? "all" : "none",
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "1px", borderRadius: "2px" }
      }
    }, expanded ? hash : shortHashOf(hash, compact));
  }
  function CopyHashBtn(p) {
    var st = R.useState(false), copied = st[0], setCopied = st[1], timer = R.useRef(null);
    R.useEffect(function () { return function () { if (timer.current) clearTimeout(timer.current); }; }, []);
    function copy(e) {
      e.preventDefault(); e.stopPropagation();
      var text = p.hash || "";
      if (!text) return;
      function ok() {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(function () { setCopied(false); }, 1400);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, function () {});
      } else {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select();
        try { if (document.execCommand("copy")) ok(); } catch (err) {}
        document.body.removeChild(ta);
      }
    }
    return h(G.Atoms.Box, {
      component: "button", type: "button",
      "data-me-hash-copy": copied ? "copied" : "",
      "aria-label": copied ? "Copied" : "Copy hash",
      title: copied ? "Copied" : "Copy hash",
      onClick: copy,
      sx: {
        position: "absolute", top: 4, right: 4, zIndex: 2,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.4,
        minWidth: 22, height: 22, p: 0, px: copied ? 0.5 : 0, border: 0, borderRadius: "4px",
        bgcolor: "background.paper",
        boxShadow: 1,
        cursor: "pointer", color: copied ? "primary.main" : "text.secondary",
        "&:hover": { color: "primary.main", bgcolor: "action.hover" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "1px" }
      }
    }, copied
      ? h(G.Atoms.Box, { component: "span", sx: { fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1, px: 0.25 } }, "Copied")
      : h("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
          h("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }),
          h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })));
  }
  function MeCard(p) {
    useTick();
    var L = p.live || current(), Monad = (G.Widgets && G.Widgets.Monad) || G.Monad, QRme = G.QRme, ok = L.state === "ok";
    var hug = !!p.hug, compact = !!p.compact, keepCard = !!p.keepCard, shortOnly = !!p.shortOnly;
    var shortHash = L.hash ? L.hash.slice(0, (compact || keepCard) ? 8 : 10) + "…" + L.hash.slice(-((compact || keepCard) ? 6 : 8)) : "…";
    // The QR is the real G.QRme (same component as the left-bar / root Cleaker QR).
    // perimeterLabel is omitted: this page has no claimed namespace, and we do not invent one.
    // value is the public identityHash only — never a seed, secret, or fabricated cleaker URL.
    var cardSx = hug ? {
        width: "fit-content", maxWidth: "100%", boxSizing: "border-box",
        p: compact ? 1 : 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover",
        display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 0.75 : 1.25,
        ...(keepCard ? {} : {
          "@media (max-width: 639px)": {
            display: "contents", p: 0, border: "none", bgcolor: "transparent", width: "auto", maxWidth: "none", gap: 0
          }
        })
      } : {
        width: p.inline ? "100%" : "min(520px, calc(100vw - 32px))", boxSizing: "border-box",
        p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover",
        display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap"
      };
    var qrSx = {
      flexShrink: 0, width: "fit-content", lineHeight: 0, "& .monad-tooltip": { display: "none" },
      ...(hug ? {
        ...(compact || keepCard ? { "& > *": { zoom: 130 / 192 } } : {}),
        ...(keepCard ? {
          "@media (max-width: 360px)": { "& > *": { zoom: 112 / 192 } }
        } : {
          "@media (max-width: 639px)": {
            gridArea: "card", boxSizing: "border-box", alignSelf: "start", width: "fit-content",
            p: 1, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover",
            "& > *": { zoom: 130 / 192 }
          },
          "@media (max-width: 360px)": {
            "& > *": { zoom: 112 / 192 }
          }
        })
      } : {})
    };
    var hashColSx = hug ? {
        width: 0, minWidth: "100%", maxWidth: "100%", boxSizing: "border-box",
        display: "flex", flexDirection: "column", gap: 0.5,
        ...(keepCard ? {} : { "@media (max-width: 639px)": { gridArea: "hash", width: "100%", minWidth: 0, maxWidth: "100%" } })
      } : { flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 0.75 };
    return h(G.Atoms.Box, { "data-me-card": p.inline ? "inline" : "tip", "data-me-hug": hug ? "" : undefined, "data-me-row": ok ? "identityHash" : undefined, sx: p.copyable ? { ...cardSx, position: "relative" } : cardSx },
      L.state === "error" ? h(G.Atoms.Box, { sx: { fontSize: ".78rem", color: "text.secondary", overflowWrap: "anywhere" } }, L.text) : null,
      ok ? h(G.Atoms.Box, { "data-me-qr": "", sx: qrSx },
        QRme ? h(QRme, { value: L.hash, username: L.expression || undefined, variant: p.inline ? "lg" : "md", hoverFlip: true, clickFlip: true, showAvatarLabel: true })
             : (Monad ? h(Monad, { key: L.hash, variant: "identity", kind: "me", seed: L.hash, mode: "contained", size: p.inline ? 96 : 72, tooltip: false, solid: true }) : null)) : null,
      (ok && p.copyable && L.hash) ? h(CopyHashBtn, { hash: L.hash }) : null,
      (ok && !p.hideHash) ? h(G.Atoms.Box, { "data-me-hash-block": "", sx: hashColSx },
        p.noHashLabel ? null : h(G.Atoms.Box, { sx: { color: "text.disabled", letterSpacing: "0.06em", fontSize: "0.68rem" } }, "Hash"),
        p.expandable
          ? h(ExpandableHash, { hash: L.hash, compact: compact || keepCard })
          : [
              h(G.Atoms.Box, { "data-me-hash-short": "", sx: { fontFamily: MONO, fontWeight: 700, fontSize: (compact || keepCard) ? "0.78rem" : (hug ? "0.85rem" : "1rem"), color: "primary.main", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, shortHash),
              (shortOnly || !L.hash) ? null : h(G.Atoms.Box, { "data-me-hash": "", sx: { fontFamily: MONO, fontSize: compact ? "0.5rem" : (hug ? "0.55rem" : "0.62rem"), color: "text.disabled", wordBreak: "break-all", overflowWrap: "anywhere", lineHeight: 1.5, userSelect: "all", maxWidth: "100%", "@media (max-width: 639px)": { fontSize: "0.62rem" } } }, L.hash)
            ]) : null);
  }

  // the one card, as a themed tooltip anchored to a marked word in the text (MeLive). Inputs no longer use this.
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

  // ── the inputs: Cleaker sign-in fields; identityHash is computed immediately and shown in flow below ──
  // Intro seed field and QR card are siblings in two columns; share the live hash in this page-only store.
  var introLive = { live: ensureAnonIdentity() };
  var introSubs = new Set();
  function publishIntroLive(live) {
    var a = introLive.live, b = live || null;
    if ((a && a.hash) === (b && b.hash) && !a === !b) return;
    introLive = { live: b };
    introSubs.forEach(function (f) { f(); });
  }
  function useIntroLive() {
    var tick = R.useState(0)[1];
    R.useEffect(function () {
      var on = function () { tick(function (n) { return n + 1; }); };
      introSubs.add(on);
      return function () { introSubs.delete(on); };
    }, []);
    return introLive.live;
  }

  function MeSeedInput(p) {
    useTick();
    var intro = useIntroLive();
    var compound = p.mode === "compound", which = compound ? "compound" : "seed", part = p.part || "all", TF = G.Atoms.TextField;
    var a = R.useState(""), seed = a[0], setSeed = a[1], b = R.useState(""), user = b[0], setUser = b[1], c = R.useState(""), secret = c[0], setSecret = c[1];
    var live = null, cur, hash, cseed;
    if (compound) {
      if (user && secret) {
        cseed = compoundSeedOf(user, secret);
        hash = identityHashOf(cseed);
        cur = current();
        live = { state: "ok", source: "compound", hash: hash, expression: user,
          prove: (cur.source === "compound" && cur.hash === hash && cur.prove) ? cur.prove : { ok: false, pending: true } };
      }
    } else if (seed !== "") {
      live = { state: "ok", source: "seed", hash: identityHashOf(seed), expression: null, prove: { ok: false, error: "ACTIVE_EXPRESSION_REQUIRED" } };
    } else {
      live = ensureAnonIdentity();
    }
    // Debounce only the kernel/prove path and the shared "running here" state — the card above already has the hash.
    R.useEffect(function () {
      var t = setTimeout(function () {
        if (compound) setTyped(which, user && secret ? [user, secret] : null);
        else setTyped(which, seed !== "" ? [seed] : null);
      }, 250);
      return function () { clearTimeout(t); };
    }, [seed, user, secret]);
    var field = function (label, set, masked, id) {
      return h(TF, { label: label, "data-gui-node-id": "Seed." + id, "data-me-input": id, type: masked ? "password" : "text", fullWidth: true, size: "small",
        autoComplete: "off", onChange: function (e) { set(e.target.value); },
        inputProps: { spellCheck: false, autoCapitalize: "off", autoCorrect: "off", "data-lpignore": "true", "data-1p-ignore": "true" } });
    };
    R.useEffect(function () {
      if (compound || part === "card") return undefined;
      publishIntroLive(live);
    }, [compound, part, seed]);
    if (!compound && part === "card") {
      return h(MeCard, { live: intro || ensureAnonIdentity(), focus: "identityHash", inline: true, hug: true, noHashLabel: true });
    }
    var seedFieldOnly = !compound && part === "field";
    if (compound) {
      var fullHashEl = (live && live.hash) ? h(G.Atoms.Box, { "data-me-hash": "", "data-me-compound-full": "", sx: {
          fontFamily: MONO, fontSize: "0.62rem", color: "text.disabled",
          wordBreak: "break-all", overflowWrap: "anywhere", lineHeight: 1.6,
          userSelect: "all", minWidth: 0, maxWidth: "100%"
        } }, live.hash) : null;
      var srOnly = { position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0, scrollMarginTop: "64px" };
      return h(G.Atoms.Box, { "data-gui-node-id": p["data-gui-node-id"], "data-me-seed-input": which, "data-me-compound-sbs": "",
          sx: {
            position: "relative",
            width: "100%", maxWidth: "100%", minWidth: 0, overflow: "visible",
            display: "grid",
            gridTemplateColumns: live ? "auto minmax(0, 1fr) minmax(0, 1.15fr)" : "minmax(0, 1fr) minmax(0, 1.15fr)",
            gridTemplateAreas: live ? '"card fields ctors"' : '"fields ctors"',
            columnGap: 1.5, rowGap: 1.5, alignItems: "start", mt: 0, mb: 1, pt: 0,
            "@media (max-width: 719px)": {
              gridTemplateColumns: "minmax(0, 1fr)",
              gridTemplateAreas: live ? '"card" "fields" "ctors"' : '"fields" "ctors"'
            }
          } },
        h(G.Atoms.Box, { component: "h3", id: "compound", sx: srOnly }, "Compound"),
        h(G.Atoms.Box, { component: "h3", id: "the-three-constructors", sx: srOnly }, "The three constructors"),
        live ? h(G.Atoms.Box, { "data-me-compound-qr": "", sx: { gridArea: "card", alignSelf: "start", width: "fit-content" } },
          h(MeCard, { live: live, focus: "me", inline: true, hug: true, compact: true, keepCard: true, expandable: true, copyable: true, noHashLabel: true })) : null,
        h(G.Atoms.Box, { "data-me-compound-fields": "", sx: {
          gridArea: "fields", display: "flex", flexDirection: "column",
          justifyContent: "flex-start",
          gap: 1.5, minWidth: 0, width: "100%",
          overflow: "visible", pt: 0, alignSelf: "start"
        } },
          field("Username", setUser, false, "username"),
          field("Secret", setSecret, true, "secret"),
          fullHashEl),
        h(G.Atoms.Box, { "data-me-compound-ctors": "", sx: { gridArea: "ctors", minWidth: 0, alignSelf: "start" } },
          h(MeCtorRecap)));
    }
    return h(G.Atoms.Box, { "data-gui-node-id": p["data-gui-node-id"], "data-me-seed-input": which,
        sx: { maxWidth: seedFieldOnly ? "100%" : 520, width: "100%", display: "flex", flexDirection: "column", gap: 2, mt: seedFieldOnly ? 0 : .5, mb: seedFieldOnly ? 0 : 3, pt: seedFieldOnly ? 0 : 1, overflow: "visible" } },
      field("Seed", setSeed, true, "seed"),
      (!seedFieldOnly && live) ? h(MeCard, { live: live, focus: "identityHash", inline: true }) : null);
  }


  // ── live demonstrations of seed properties (determinism, sensitivity, one-way, compound, local) ──
  // Pure keccak on this page: these widgets never call the kernel, never persist, and never send the seed.
  function hexDiffer(a, b) {
    if (!a || !b) return null;
    var n = 0, i, len = Math.max(a.length, b.length);
    for (i = 0; i < len; i++) if (a[i] !== b[i]) n++;
    return n;
  }
  function hashLabel() {
    return h(G.Atoms.Box, { sx: { color: "text.disabled", letterSpacing: "0.06em", fontSize: "0.68rem", flexShrink: 0 } }, "Hash");
  }
  function HashCol(hash, note) {
    var shortH = hash ? hash.slice(0, 10) + "…" + hash.slice(-8) : "…";
    return h(G.Atoms.Box, { sx: { display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, maxWidth: "100%", overflow: "hidden" } },
      h(G.Atoms.Box, { sx: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, minWidth: 0, width: "100%" } },
        hashLabel(),
        note || null),
      h(G.Atoms.Box, { "data-me-hash-short": "", sx: { fontFamily: MONO, fontWeight: 700, fontSize: "0.95rem", color: hash ? "primary.main" : "text.disabled", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, shortH),
      hash ? h(G.Atoms.Box, { "data-me-hash": "", sx: { fontFamily: MONO, fontSize: "0.62rem", color: "text.disabled", wordBreak: "break-all", overflowWrap: "anywhere", lineHeight: 1.6, userSelect: "all", maxWidth: "100%" } }, hash) : null);
  }
  function demoField(label, value, set, id, masked, opts) {
    opts = opts || {};
    var inputProps = Object.assign({ spellCheck: false, autoCapitalize: "off", autoCorrect: "off", "data-lpignore": "true", "data-1p-ignore": "true" }, opts.inputProps || {});
    var InputProps = Object.assign({}, opts.readOnly ? { readOnly: true } : {}, opts.InputProps || {});
    if (opts.readOnly) { inputProps.readOnly = true; inputProps["aria-readonly"] = "true"; }
    var props = {
      label: label, value: value, "data-gui-node-id": "SeedDemo." + id, "data-me-input": id,
      type: masked ? "password" : "text", fullWidth: true, size: "small", autoComplete: "off",
      onChange: set ? function (e) { set(e.target.value); } : function () {},
      inputProps: inputProps, InputProps: InputProps
    };
    if (opts.sx) props.sx = opts.sx;
    if (opts.attrs) Object.assign(props, opts.attrs);
    return h(G.Atoms.TextField, props);
  }
  function demoBox(kind, children, wide) {
    var sx = { maxWidth: wide === true ? "100%" : 520, width: "100%", display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5, mb: 3, pt: 1, minWidth: 0, overflow: "visible" };
    if (wide === "half") {
      sx.maxWidth = "100%";
      sx["@media (min-width: 640px)"] = { maxWidth: "calc((100% - 16px) / 2)" };
    }
    return h(G.Atoms.Box, { "data-me-demo": kind, sx: sx }, children);
  }
  function pairCol(children, attrs) {
    return h(G.Atoms.Box, Object.assign({ sx: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0, overflow: "visible", pt: 1 } }, attrs || {}), children);
  }
  function pairRow(left, right, align) {
    return h(G.Atoms.Box, { "data-me-pair": "", sx: {
      display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 2, rowGap: 1.5, alignItems: align || "start", minWidth: 0,
      "@media (max-width: 639px)": { gridTemplateColumns: "minmax(0, 1fr)" }
    } }, left, right);
  }
  function matchLine(same) {
    return h(G.Atoms.Box, { "data-me-match": same ? "same" : "different", sx: { fontSize: "0.86rem", fontWeight: 700, color: same ? "primary.main" : "text.secondary" } }, same ? "same Hash" : "different Hash");
  }

  // Watch that typing never writes localStorage and that no request carries a seed or secret.
  var netWatch = { hooked: false, leaked: false };
  function installNetWatch() {
    if (netWatch.hooked) return;
    netWatch.hooked = true;
    function secrets() {
      var out = [], nodes = document.querySelectorAll("[data-me-input] input"), i, el, v, id;
      for (i = 0; i < nodes.length; i++) {
        el = nodes[i];
        v = el.value || "";
        if (v.length < 3) continue;
        id = (el.closest("[data-me-input]") || el).getAttribute("data-me-input") || "";
        if (id === "username") continue;
        out.push(v);
      }
      return out;
    }
    function inspect(url, body) {
      var s = "", list, i;
      try { s += String(url || ""); } catch (e) {}
      try { if (body && typeof body === "string") s += body; else if (body) s += String(body); } catch (e2) {}
      list = secrets();
      for (i = 0; i < list.length; i++) if (list[i] && s.indexOf(list[i]) !== -1) { netWatch.leaked = true; return; }
    }
    if (window.fetch) {
      var ofetch = window.fetch;
      window.fetch = function (input, init) {
        try { inspect(typeof input === "string" ? input : (input && input.url), init && init.body); } catch (e) {}
        return ofetch.apply(this, arguments);
      };
    }
    if (window.XMLHttpRequest) {
      var open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) { this.__meUrl = url; return open.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function (body) { try { inspect(this.__meUrl, body); } catch (e) {} return send.apply(this, arguments); };
    }
    if (navigator.sendBeacon) {
      var beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) { try { inspect(url, data); } catch (e) {} return beacon(url, data); };
    }
  }
  function storageSnapshot() {
    try {
      var o = {}, i, k;
      for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); o[k] = localStorage.getItem(k); }
      return JSON.stringify(o);
    } catch (e) { return null; }
  }
  installNetWatch();

  // Sensitivity compares against Determinism's seed A; keep the hash in a small shared store.
  var detA = { hash: identityHashOf("suign"), seed: "suign" };
  var detASubs = new Set();
  function publishDetA(hash, seed) {
    if (seed === undefined) seed = detA.seed;
    if (detA.hash === hash && detA.seed === seed) return;
    detA = { hash: hash, seed: seed };
    detASubs.forEach(function (f) { f(); });
  }
  function useDetA() {
    var tick = R.useState(0)[1];
    R.useEffect(function () {
      var on = function () { tick(function (n) { return n + 1; }); };
      detASubs.add(on);
      return function () { detASubs.delete(on); };
    }, []);
    return detA;
  }
  function useDetAHash() {
    return useDetA().hash;
  }

  function eqSign(same) {
    return h(G.Atoms.Box, {
      "data-me-match": same ? "same" : "different",
      "aria-label": same ? "same Hash" : "different Hash",
      sx: function (theme) {
        var pal = theme.palette || {};
        var ok = (pal.success && pal.success.main) || "#2e7d32";
        var bad = (pal.error && pal.error.main) || "#c62828";
        return {
          display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center",
          fontSize: { xs: "1.75rem", sm: "2.15rem" }, fontWeight: 600, lineHeight: 1,
          color: same ? ok : bad, userSelect: "none", px: 0.25
        };
      }
    }, same ? "=" : "≠");
  }
  function compareRow(left, mid, right) {
    return h(G.Atoms.Box, { "data-me-pair": "", sx: {
      display: "grid", gridTemplateColumns: "minmax(0, 1fr) 3rem minmax(0, 1fr)", columnGap: 1.5, rowGap: 1,
      alignItems: "center", minWidth: 0,
      "@media (max-width: 639px)": { gridTemplateColumns: "minmax(0, 1fr)", "& > [data-me-match]": { justifySelf: "center", py: 0.5 } }
    } }, left, mid, right);
  }
  function DemoDeterminism() {
    var a = R.useState("suign"), left = a[0], setLeft = a[1], b = R.useState("suign"), right = b[0], setRight = b[1];
    var h1 = left !== "" ? identityHashOf(left) : "", h2 = right !== "" ? identityHashOf(right) : "";
    var ready = !!(h1 && h2);
    R.useEffect(function () { publishDetA(h1, left); }, [h1, left]);
    return demoBox("determinism", [
      compareRow(
        pairCol([demoField("Seed", left, setLeft, "determinism-a", false), HashCol(h1)]),
        ready ? eqSign(h1 === h2) : h(G.Atoms.Box, { sx: { width: "1em" } }),
        pairCol([demoField("Seed", right, setRight, "determinism-b", false), HashCol(h2)])
      )
    ], true);
  }
  function diffNote(n, len) {
    if (!n) return null;
    return h(G.Atoms.Box, {
      "data-me-diff": String(n),
      sx: function (theme) {
        var pal = theme.palette || {};
        var warn = (pal.warning && pal.warning.main) || "#f5a623";
        return {
          color: warn, fontSize: "0.68rem", letterSpacing: "0.02em", fontWeight: 600,
          lineHeight: 1.3, textAlign: "right", minWidth: 0, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap"
        };
      }
    }, "! " + n + " of " + len + " hex characters differ");
  }
  function onewayLede() {
    return h(G.Atoms.Box, {
      "data-me-oneway-lede": "",
      sx: {
        fontSize: "0.75rem", lineHeight: 1.5, minWidth: 0, maxWidth: "100%",
        "@media (min-width: 640px)": { maxWidth: "calc((100% - 3rem - 12px) / 2)" }
      }
    },
      h(G.Atoms.Box, { component: "span", sx: { fontWeight: 600, color: "text.primary" } }, "One-way"),
      h(G.Atoms.Box, { component: "span", sx: { color: "text.secondary" } }, " From the Hash you cannot get the seed back.")
    );
  }
  function DemoSensitivity() {
    var a = R.useState("suign."), seed = a[0], setSeed = a[1];
    var base = useDetAHash();
    var hash = seed !== "" ? identityHashOf(seed) : "";
    var ready = !!(hash && base), n = ready ? hexDiffer(base, hash) : null;
    var note = ready ? diffNote(n, Math.max(base.length, hash.length)) : null;
    var full = hashFull(hash);
    return demoBox("sensitivity", [
      h(G.Atoms.Box, { sx: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 } }, [
        flowRow("forward",
          demoField("Seed", seed, setSeed, "sensitivity", false),
          ready ? sensSign(n === 0, true) : h(G.Atoms.Box, { sx: { gridArea: "mid", width: "1em" } }),
          hashField(hash, "sensitivity-hash-fwd"),
          full, "right", note),
        onewayLede(),
        flowRow("reverse",
          hashField(hash, "sensitivity-hash-rev"),
          flowArrow(false),
          emptySeedField(),
          full, "left")
      ])
    ], true);
  }
  function sensSign(same, flow) {
    return h(G.Atoms.Box, {
      "data-me-match": same ? "same" : "different",
      "data-me-sens-sign": same ? "same" : "neq",
      "aria-label": same ? "same Hash" : "different Hash",
      sx: function (theme) {
        var pal = theme.palette || {};
        var ok = (pal.success && pal.success.main) || "#2e7d32";
        var warn = (pal.warning && pal.warning.main) || "#f5a623";
        var sx = {
          display: "flex", alignItems: "center", justifyContent: "center",
          alignSelf: "center", justifySelf: "center",
          fontSize: { xs: "1.75rem", sm: "2.15rem" }, fontWeight: 600, lineHeight: 1,
          color: same ? ok : warn, userSelect: "none", px: 0.25
        };
        if (flow) sx.gridArea = "mid";
        return sx;
      }
    }, same ? "=" : "≠");
  }
  function flowArrow(ok) {
    var label = ok
      ? "The Hash is derived from the seed"
      : "From the Hash you cannot get the seed back.";
    var stroke = { fill: "none", stroke: "currentColor", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" };
    return h(G.Atoms.Box, {
      "data-me-arrow": ok ? "forward" : "blocked",
      "aria-label": label,
      title: label,
      sx: function (theme) {
        var pal = theme.palette || {};
        var okC = (pal.success && pal.success.main) || "#4fd1c5";
        var badC = (pal.error && pal.error.main) || "#ff6b6b";
        return {
          display: "flex", alignItems: "center", justifyContent: "center",
          alignSelf: "center", justifySelf: "center", gridArea: "mid",
          fontSize: { xs: "1.75rem", sm: "2.15rem" }, width: "1.35em", height: "1em",
          color: ok ? okC : badC, userSelect: "none", lineHeight: 0,
          "@media (max-width: 639px)": { transform: "rotate(90deg)", my: 0.5 }
        };
      }
    },
      h("svg", { width: "100%", height: "100%", viewBox: "0 0 48 32", "aria-hidden": "true", focusable: "false", style: { display: "block", overflow: "visible" } },
        h("path", Object.assign({ d: "M4 16h28" }, stroke)),
        h("path", Object.assign({ d: "M26 7l14 9-14 9" }, stroke)),
        ok ? null : h("path", Object.assign({ d: "M10 26l28-20" }, stroke))
      )
    );
  }
  function hashField(hash, id) {
    var shortH = hash ? hash.slice(0, 10) + "…" + hash.slice(-8) : "…";
    return demoField("Hash", shortH, null, id, false, {
      readOnly: true,
      sx: {
        "& input": {
          fontFamily: MONO, fontWeight: 700, letterSpacing: "0.02em",
          color: hash ? "primary.main" : "text.disabled",
          WebkitTextFillColor: "currentColor"
        }
      },
      inputProps: { "data-me-hash-short": "" }
    });
  }
  function hashFull(hash) {
    if (!hash) return null;
    return h(G.Atoms.Box, { "data-me-hash": "", sx: { fontFamily: MONO, fontSize: "0.62rem", color: "text.disabled", wordBreak: "break-all", overflowWrap: "anywhere", lineHeight: 1.6, userSelect: "all", maxWidth: "100%" } }, hash);
  }
  function emptySeedField() {
    return demoField("Seed", "—", null, "oneway-empty", false, {
      readOnly: true,
      attrs: { "data-me-oneway-empty": "" },
      sx: {
        "& .MuiOutlinedInput-notchedOutline, & fieldset, & [class*='NotchedOutline']": { borderStyle: "dashed" },
        "& input": { color: "text.disabled", WebkitTextFillColor: "currentColor", cursor: "default" }
      }
    });
  }
  function flowRow(kind, left, mid, right, under, hashSide, over) {
    var areas, areasMobile;
    if (hashSide === "left") {
      areas = over ? '"over mid ." "left mid right" "under . ."' : '"left mid right" "under . ."';
      areasMobile = over ? '"over" "left" "under" "mid" "right"' : '"left" "under" "mid" "right"';
    } else {
      areas = over ? '". . over" "left mid right" ". . under"' : '"left mid right" ". . under"';
      areasMobile = over ? '"left" "mid" "over" "right" "under"' : '"left" "mid" "right" "under"';
    }
    // For the left-side over (unused today), don't stretch the arrow into the caption row.
    if (hashSide === "left" && over) {
      areas = '"over . ." "left mid right" "under . ."';
    }
    return h(G.Atoms.Box, { "data-me-pair": "", "data-me-flow": kind, sx: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 3rem minmax(0, 1fr)",
      gridTemplateAreas: areas,
      columnGap: 1.5, rowGap: 0.5, alignItems: "center", minWidth: 0,
      "@media (max-width: 639px)": {
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateAreas: areasMobile,
        columnGap: 0, rowGap: 1
      }
    } },
      over ? h(G.Atoms.Box, { "data-me-flow-side": "over", sx: { gridArea: "over", minWidth: 0, display: "flex", justifyContent: "flex-end", alignItems: "baseline", pb: 0.75, boxSizing: "content-box" } }, over) : null,
      h(G.Atoms.Box, { "data-me-flow-side": "left", sx: { gridArea: "left", minWidth: 0 } }, left),
      mid,
      h(G.Atoms.Box, { "data-me-flow-side": "right", sx: { gridArea: "right", minWidth: 0 } }, right),
      under ? h(G.Atoms.Box, { "data-me-flow-side": "under", sx: { gridArea: "under", minWidth: 0 } }, under) : null
    );
  }
  function DemoCompound() {
    var h1 = identityHashOf(compoundSeedOf("aa", "b"));
    var h2 = identityHashOf(compoundSeedOf("a", "ab"));
    return demoBox("compound", [
      compareRow(
        pairCol([
          h(G.Atoms.Box, { sx: { fontFamily: MONO, fontSize: "0.86rem", color: "text.secondary" } }, "aa + b"),
          HashCol(h1)
        ], { "data-me-compound-row": "aa-b" }),
        sensSign(h1 === h2),
        pairCol([
          h(G.Atoms.Box, { sx: { fontFamily: MONO, fontSize: "0.86rem", color: "text.secondary" } }, "a + ab"),
          HashCol(h2)
        ], { "data-me-compound-row": "a-ab" })
      )
    ], true);
  }
  function DemoLocal() {
    var st = R.useState({ ready: false, storage: true, leaked: false }), s = st[0], setS = st[1];
    R.useEffect(function () {
      var base = storageSnapshot();
      function check() {
        setS({ ready: true, storage: storageSnapshot() === base, leaked: netWatch.leaked });
      }
      check();
      document.addEventListener("input", check, true);
      return function () { document.removeEventListener("input", check, true); };
    }, []);
    var ok = s.storage && !s.leaked;
    var line = !s.storage ? "localStorage changed while typing" : (s.leaked ? "a request carried a seed" : "localStorage unchanged · seed not sent");
    return demoBox("local", [
      h(G.Atoms.Box, {
        "data-me-local": ok ? "ok" : "fail",
        "data-me-local-storage": s.storage ? "ok" : "fail",
        "data-me-local-net": s.leaked ? "fail" : "ok",
        sx: { fontSize: "0.86rem", fontWeight: 700, color: ok ? "primary.main" : "text.secondary" }
      }, line)
    ]);
  }
  function MeSeedDemo(p) {
    var kind = p.demo || "determinism";
    if (kind === "determinism") return h(DemoDeterminism);
    if (kind === "sensitivity") return h(DemoSensitivity);
    if (kind === "compound") return h(DemoCompound);
    if (kind === "local") return h(DemoLocal);
    return null;
  }

  
  // Three-constructor recap: tokens use the same hover / focus / tap-to-pin pattern as LlmsHero
  // on the .me/LLMS page (assets/llms-hero.js): bind() sets hover on enter/focus, pin on click
  // or Enter/Space, Escape or pointerdown outside [data-k] clears the pin. Matching page
  // targets get data-me-ctor-hit. Highlight is a theme-primary fill + 1px outline (color-mix
  // and box-shadow: 0 0 0 1px, same as .lh-t.on).
  var CTOR_CSS = (function () {
    var acc = "var(--mui-palette-primary-main, #4fd1c5)";
    var fg2 = "var(--mui-palette-text-secondary, #8b949e)";
    var paper = "var(--mui-palette-background-paper, transparent)";
    var text = "var(--mui-palette-text-primary, currentColor)";
    var div = "var(--mui-palette-divider, rgba(127,127,127,.25))";
    var root = "var(--me-syn-root, var(--mui-palette-primary-main, #58a6ff))";
    var str = "var(--me-syn-string, #d29922)";
    var cm = "var(--me-syn-comment, " + fg2 + ")";
    var kw = "var(--me-syn-keyword, var(--me-syn-path, " + text + "))";
    var punct = "var(--me-syn-punct, " + fg2 + ")";
    var mix = function (p) { return "color-mix(in srgb, " + acc + " " + p + "%, transparent)"; };
    var smix = function (p) { return "color-mix(in srgb, " + str + " " + p + "%, transparent)"; };
    return ".me-ctor{font-family:" + MONO + ";font-size:13px;line-height:1.7;margin:0;padding:12px 16px;border:1px solid " + div + ";border-radius:12px;background:" + paper + ";color:" + text + ";white-space:pre;overflow-x:auto;max-width:100%;width:100%;box-sizing:border-box}" +
      ".me-ctor .me-ctor-ln{display:block}.me-ctor .me-ctor-ln+.me-ctor-ln{margin-top:2px}" +
      ".me-ctor .mes-kw{color:" + kw + "}" +
      ".me-ctor .mes-punct,.me-ctor .mes-paren{color:" + punct + "}" +
      ".me-ctor .mes-root{color:" + root + ";font-weight:700}" +
      ".me-ctor .mes-str,.me-ctor .mes-quote{color:" + str + ";background:" + smix(16) + ";box-shadow:0 0 0 1px " + smix(40) + ";border-radius:3px;padding:0 3px;margin:0 1px}" +
      ".me-ctor-cm,.me-ctor .mes-comment{color:" + cm + ";font-style:italic}" +
      ".me-ctor-t[data-me-ctor-k]{cursor:pointer;border-radius:3px;transition:background .12s,box-shadow .12s}" +
      ".me-ctor-t.on{background:" + mix(25) + ";box-shadow:0 0 0 1px " + acc + "}" +
      ".me-ctor-t.rel{background:" + mix(10) + "}" +
      ".me-ctor :focus-visible{outline:2px solid " + acc + ";outline-offset:2px}" +
      "[data-me-ctor-hit]{border-radius:6px;background:" + mix(18) + ";box-shadow:0 0 0 2px " + acc + ", 0 0 10px " + mix(40) + ";transition:background .12s,box-shadow .12s}" +
      "[data-me-ctor-hit].MuiOutlinedInput-root,[data-me-ctor-hit] .MuiOutlinedInput-root{box-shadow:0 0 0 2px " + acc + ", 0 0 10px " + mix(40) + ";background:" + mix(14) + "}" +
      "[data-me-compound-ctors] .me-ctor{white-space:pre-wrap}[data-me-compound-ctors] .me-ctor-pad{display:none}[data-me-compound-ctors] .me-ctor-cm{display:block;margin-top:0;padding-left:0;white-space:pre-wrap}@media (max-width:719px){.me-ctor{white-space:pre-wrap}.me-ctor-pad{display:none}.me-ctor-cm{display:block;margin-top:0;padding-left:0;white-space:pre-wrap}}" +
      "@media (prefers-reduced-motion:reduce){.me-ctor-t[data-me-ctor-k],[data-me-ctor-hit]{transition:none}}";
  })();
  var CTOR_SEL = {
    anon: ".doc-intro-card [data-me-card], .doc-intro-card [data-me-qr], .doc-intro-card [data-me-hash-block]",
    seed: "[data-me-input=seed], [data-me-input=determinism-a], [data-me-input=determinism-b], [data-me-input=sensitivity], .doc-intro-card [data-me-card], .doc-intro-card [data-me-qr], .doc-intro-card [data-me-hash-block], [data-me-demo=determinism] [data-me-hash], [data-me-demo=determinism] [data-me-hash-short], [data-me-demo=sensitivity] [data-me-flow=forward] [data-me-hash], [data-me-demo=sensitivity] [data-me-flow=forward] [data-me-hash-short], [data-me-input=sensitivity-hash-fwd], [data-me-compound-sbs] [data-me-card], [data-me-compound-sbs] [data-me-qr], [data-me-compound-sbs] [data-me-hash-block], [data-me-compound-sbs] [data-me-hash-short]",
    username: "[data-me-input=username]",
    secret: "[data-me-input=secret]",
    me: "[data-me-card], [data-me-qr]"
  };
  function applyCtorHighlight(k) {
    var prev = document.querySelectorAll("[data-me-ctor-hit]"), i;
    for (i = 0; i < prev.length; i++) prev[i].removeAttribute("data-me-ctor-hit");
    if (!k || !CTOR_SEL[k]) { document.documentElement.removeAttribute("data-me-ctor-hl"); return; }
    document.documentElement.setAttribute("data-me-ctor-hl", k);
    var nodes = document.querySelectorAll(CTOR_SEL[k]);
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("data-me-ctor-hit", k);
      if (nodes[i].getAttribute("data-me-input")) {
        var inner = nodes[i].querySelector(".MuiOutlinedInput-root, .MuiInputBase-root");
        if (inner && inner !== nodes[i]) inner.setAttribute("data-me-ctor-hit", k);
      }
    }
  }
  function MeCtorRecap() {
    var hs = R.useState(null), hov = hs[0], setHov = hs[1];
    var ps = R.useState(null), pin = ps[0], setPin = ps[1];
    var a = hov || pin;
    R.useEffect(function () {
      if (!document.getElementById("me-ctor-css")) {
        var s = document.createElement("style");
        s.id = "me-ctor-css";
        s.textContent = CTOR_CSS;
        document.head.appendChild(s);
      }
      var off = function (e) { if (!e.target.closest || !e.target.closest("[data-me-ctor-k]")) setPin(null); };
      document.addEventListener("pointerdown", off);
      return function () { document.removeEventListener("pointerdown", off); };
    }, []);
    R.useEffect(function () { applyCtorHighlight(a); return function () { applyCtorHighlight(null); }; }, [a]);
    var bind = function (k, label) {
      return {
        "data-me-ctor-k": k,
        className: ("me-ctor-t " + (arguments[2] || "")).trim() + (a === k ? " on" : (a === "me" && k === "anon") || (a === "anon" && k === "me") ? " rel" : ""),
        tabIndex: 0,
        role: "button",
        "aria-label": label,
        "aria-pressed": pin === k,
        onMouseEnter: function () { setHov(k); },
        onMouseLeave: function () { setHov(null); },
        onFocus: function () { setHov(k); },
        onBlur: function () { setHov(null); },
        onClick: function () { setPin(pin === k ? null : k); },
        onKeyDown: function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPin(pin === k ? null : k); }
          if (e.key === "Escape") setPin(null);
        }
      };
    };
    var lines = [
      { comment: "// anonymous seed, reused or generated", parts: [
        { t: "new ", cls: "mes-kw" },
        { t: "ME()", k: "anon", cls: "mes-root", label: "new ME() — the anonymous root QR" }
      ] },
      { comment: "// literal seed", parts: [
        { t: "new ", cls: "mes-kw" },
        { t: "ME", k: "me", cls: "mes-root", label: "ME — every QR on this page" },
        { t: "(", cls: "mes-punct" },
        { t: "\"seed\"", k: "seed", cls: "mes-str mes-quote", label: "\"seed\" — Seed inputs and their Hash" },
        { t: ")", cls: "mes-punct" }
      ] },
      { comment: "// compound seed, derived", parts: [
        { t: "new ", cls: "mes-kw" },
        { t: "ME", k: "me", cls: "mes-root", label: "ME — every QR on this page" },
        { t: "(", cls: "mes-punct" },
        { t: "username", k: "username", cls: "mes-str", label: "username — Username inputs" },
        { t: ", ", cls: "mes-punct" },
        { t: "secret", k: "secret", cls: "mes-str", label: "secret — Secret inputs" },
        { t: ")", cls: "mes-punct" }
      ] }
    ];
    var width = 0, i, code;
    for (i = 0; i < lines.length; i++) {
      code = lines[i].parts.map(function (p) { return p.t; }).join("");
      if (code.length > width) width = code.length;
    }
    return h("pre", { "data-me-ctor-recap": "", "data-gui-node-id": "Seed.ctors", className: "me-ctor me-code", "aria-label": "The three constructors. Hover, focus or tap a token to highlight matching fields on the page." },
      lines.map(function (ln, i) {
        code = ln.parts.map(function (p) { return p.t; }).join("");
        var pad = "  " + " ".repeat(Math.max(0, width - code.length));
        return h("span", { key: i, className: "me-ctor-ln" },
          ln.parts.map(function (p, j) {
            return p.k ? h("span", Object.assign({ key: j }, bind(p.k, p.label, p.cls)), p.t)
                       : h("span", { key: j, className: p.cls || undefined }, p.t);
          }),
          h("span", { className: "me-ctor-pad" }, pad),
          h("span", { className: "me-ctor-cm mes-comment" }, ln.comment));
      }));
  }

  window.LandingLive = Object.assign(window.LandingLive || {}, { MeLive: MeLive, MeTerm: MeTerm, MeSeedInput: MeSeedInput, MeSeedDemo: MeSeedDemo, MeCtorRecap: MeCtorRecap });
  window.MeLive = { get state() { var L = current(); return { state: L.state, source: L.source, hash: L.hash, expression: L.expression, reused: L.reused, prove: L.prove && { ok: L.prove.ok, pending: L.prove.pending, error: L.prove.error, publicKey: L.prove.publicKey, namespace: L.prove.namespace } }; }, start: startAnon, identityHashOf: identityHashOf, compoundSeedOf: compoundSeedOf };
})();
