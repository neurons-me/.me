// The .me running on this page, shown where the text names it, and built from the page's own inputs.
// - <code data-live="MeLive" data-me="me|identityHash|prove"> (inline, rendered by landing-gui.js through window.LandingLive)
//   opens a small card on hover, focus or tap with that .me's public data.
// - <div data-live="MeSeedInput" data-mode="seed|compound"> draws the Seed field (new ME(seed)) or the Username + Secret
//   fields (new ME(username, secret)) with the same .GUI TextField the Cleaker sign-in form uses (GUI.Atoms.TextField).
//   The identityHash card is rendered in flow, directly below the fields (same width), never as a floating tooltip.
// The identityHash shown while typing is keccak256 of the same domains this.me 4.2.1 uses
//   (IDENTITY_HASH_DOMAIN "this.me/identity:v1::" + seed; compound seed = keccak256("me.seed/compound:v1::"+who+"::"+secret)),
//   computed with the same js-sha3 keccak256 primitive, so the input never waits on a full kernel. prove() is filled in
//   afterwards from a real kernel instance, debounced, and only when an active name exists.
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
  function MeCard(p) {
    useTick();
    var L = p.live || current(), Monad = (G.Widgets && G.Widgets.Monad) || G.Monad, QRme = G.QRme, ok = L.state === "ok";
    var shortHash = L.hash ? L.hash.slice(0, 10) + "…" + L.hash.slice(-8) : "…";
    // The QR is the real G.QRme (same component as the left-bar / root Cleaker QR).
    // perimeterLabel is omitted: this page has no claimed namespace, and we do not invent one.
    // value is the public identityHash only — never a seed, secret, or fabricated cleaker URL.
    return h(G.Atoms.Box, { "data-me-card": p.inline ? "inline" : "tip", "data-me-row": ok ? "identityHash" : undefined, sx: {
        width: p.inline ? "100%" : "min(520px, calc(100vw - 32px))", boxSizing: "border-box",
        p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover",
        display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap"
      } },
      L.state === "error" ? h(G.Atoms.Box, { sx: { fontSize: ".78rem", color: "text.secondary", overflowWrap: "anywhere" } }, L.text) : null,
      ok ? h(G.Atoms.Box, { sx: { flexShrink: 0, "& .monad-tooltip": { display: "none" } } },
        QRme ? h(QRme, { value: L.hash, username: L.expression || undefined, variant: p.inline ? "lg" : "md", hoverFlip: true, clickFlip: true, showAvatarLabel: true })
             : (Monad ? h(Monad, { key: L.hash, variant: "identity", kind: "me", seed: L.hash, mode: "contained", size: p.inline ? 96 : 72, tooltip: false, solid: true }) : null)) : null,
      ok ? h(G.Atoms.Box, { sx: { flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 0.75 } },
        h(G.Atoms.Box, { sx: { color: "text.disabled", letterSpacing: "0.06em", fontSize: "0.68rem" } }, "Hash"),
        h(G.Atoms.Box, { "data-me-hash-short": "", sx: { fontFamily: MONO, fontWeight: 700, fontSize: "1rem", color: "primary.main", letterSpacing: "0.02em", whiteSpace: "nowrap" } }, shortHash),
        h(G.Atoms.Box, { "data-me-hash": "", sx: { fontFamily: MONO, fontSize: "0.62rem", color: "text.disabled", wordBreak: "break-all", lineHeight: 1.6, userSelect: "all" } }, L.hash)) : null);
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
  function MeSeedInput(p) {
    useTick();
    var compound = p.mode === "compound", which = compound ? "compound" : "seed", TF = G.Atoms.TextField;
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
    return h(G.Atoms.Box, { "data-gui-node-id": p["data-gui-node-id"], "data-me-seed-input": which,
        sx: { maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 2, mt: .5, mb: 3 } },
      compound ? field("Username", setUser, false, "username") : null,
      compound ? field("Secret", setSecret, true, "secret") : field("Seed", setSeed, true, "seed"),
      live ? h(MeCard, { live: live, focus: compound ? "me" : "identityHash", inline: true }) : null);
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
    var sx = { maxWidth: wide === true ? "100%" : 520, width: "100%", display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5, mb: 3, minWidth: 0 };
    if (wide === "half") {
      sx.maxWidth = "100%";
      sx["@media (min-width: 640px)"] = { maxWidth: "calc((100% - 16px) / 2)" };
    }
    return h(G.Atoms.Box, { "data-me-demo": kind, sx: sx }, children);
  }
  function pairCol(children, attrs) {
    return h(G.Atoms.Box, Object.assign({ sx: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0, overflow: "hidden" } }, attrs || {}), children);
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
  var detA = { hash: identityHashOf("jabellae"), seed: "jabellae" };
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
    var a = R.useState("jabellae"), left = a[0], setLeft = a[1], b = R.useState("jabellae"), right = b[0], setRight = b[1];
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
    var a = R.useState("jabellae."), seed = a[0], setSeed = a[1];
    var base = useDetAHash();
    var hash = seed !== "" ? identityHashOf(seed) : "";
    var ready = !!(hash && base), n = ready ? hexDiffer(base, hash) : null;
    var note = ready ? diffNote(n, Math.max(base.length, hash.length)) : null;
    var full = hashFull(hash);
    return demoBox("sensitivity", [
      h(G.Atoms.Box, { sx: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 } }, [
        flowRow("forward",
          demoField("Seed", seed, setSeed, "sensitivity", false),
          flowArrow(true),
          hashField(hash, "sensitivity-hash-fwd", note),
          full, "right"),
        onewayLede(),
        flowRow("reverse",
          hashField(hash, "sensitivity-hash-rev"),
          flowArrow(false),
          emptySeedField(),
          full, "left")
      ])
    ], true);
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
  function hashField(hash, id, note) {
    var shortH = hash ? hash.slice(0, 10) + "…" + hash.slice(-8) : "…";
    return h(G.Atoms.Box, { sx: { position: "relative", minWidth: 0 } },
      demoField("Hash", shortH, null, id, false, {
        readOnly: true,
        sx: {
          "& input": {
            fontFamily: MONO, fontWeight: 700, letterSpacing: "0.02em",
            color: hash ? "primary.main" : "text.disabled",
            WebkitTextFillColor: "currentColor"
          }
        },
        inputProps: { "data-me-hash-short": "" }
      }),
      note ? h(G.Atoms.Box, { sx: { position: "absolute", top: "-0.45em", right: 0, maxWidth: "72%", zIndex: 1, pointerEvents: "none" } }, note) : null
    );
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
  function flowRow(kind, left, mid, right, under, hashSide) {
    var areas = hashSide === "left"
      ? '"left mid right" "under . ."'
      : '"left mid right" ". . under"';
    var areasMobile = hashSide === "left"
      ? '"left" "under" "mid" "right"'
      : '"left" "mid" "right" "under"';
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
      h(G.Atoms.Box, { "data-me-flow-side": "left", sx: { gridArea: "left", minWidth: 0 } }, left),
      mid,
      h(G.Atoms.Box, { "data-me-flow-side": "right", sx: { gridArea: "right", minWidth: 0 } }, right),
      under ? h(G.Atoms.Box, { "data-me-flow-side": "under", sx: { gridArea: "under", minWidth: 0 } }, under) : null
    );
  }
  function DemoCompound() {
    var rows = [
      { who: "aa", secret: "b", id: "aa-b" },
      { who: "a", secret: "ab", id: "a-ab" }
    ];
    var hashes = rows.map(function (r) { return identityHashOf(compoundSeedOf(r.who, r.secret)); });
    var sameSeed = compoundSeedOf("aa", "b") === compoundSeedOf("a", "ab");
    return demoBox("compound", [
      pairRow(
        pairCol([
          h(G.Atoms.Box, { sx: { fontFamily: MONO, fontSize: "0.86rem", color: "text.secondary" } }, "aa + b"),
          HashCol(hashes[0])
        ], { "data-me-compound-row": "aa-b" }),
        pairCol([
          h(G.Atoms.Box, { sx: { fontFamily: MONO, fontSize: "0.86rem", color: "text.secondary" } }, "a + ab"),
          HashCol(hashes[1])
        ], { "data-me-compound-row": "a-ab" })
      ),
      matchLine(hashes[0] === hashes[1] || sameSeed)
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

  window.LandingLive = Object.assign(window.LandingLive || {}, { MeLive: MeLive, MeTerm: MeTerm, MeSeedInput: MeSeedInput, MeSeedDemo: MeSeedDemo });
  window.MeLive = { get state() { var L = current(); return { state: L.state, source: L.source, hash: L.hash, expression: L.expression, reused: L.reused, prove: L.prove && { ok: L.prove.ok, pending: L.prove.pending, error: L.prove.error, publicKey: L.prove.publicKey, namespace: L.prove.namespace } }; }, start: startAnon, identityHashOf: identityHashOf, compoundSeedOf: compoundSeedOf };
})();
