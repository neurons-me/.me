// .GUI (this.gui@4.2.0) for hand-written .me landings. Copy of neurons-me.github.io docs/assets/landing-gui.js
// (the /robots/ and /smart-cities/ landings), kept here so .me pages don't depend on the site repo's paths, plus
// the /.me/Demos/ index layout (kicker, h1, one line, image-left demo cards) and the /.me/docs/ index layout
// (#static-landing[data-layout=docs-index]: kicker, h1 with the .me mark, language chips, cover-top cards, footer).
// The page's own static markup (#static-landing) is the single source of text, links and images: this script
// reads it, renders the same content through GUI.mount (registry Card/Box/Typography/Link/Chip + a page-local
// topbar: me:// path, search, [Docs], [GitHub], theme picker, light/dark, gear with Inspector + Grid Layout), then
// removes the static copy. Without JS or if the CDN fails, the static page stays as it is.
// Docs and GitHub are per page, from the static .topnav: a link there with [data-topbar=docs] / to github.com shows
// them; without one they are left out (/.me/Demos/ has neither).
// Doc pages written in Markdown (_layouts/gui-doc.html: #static-landing[data-layout=doc]) render through the same
// topbar; their rendered Markdown (headings, paragraphs, lists, tables, quotes, code, .doc-cards) becomes registry
// nodes, and code blocks go through the .me highlighter (window.MeSyntax, assets/me-syntax) with theme colours.
// A <div class="kernel-timeline" data-src="…json"> becomes the KernelTimeline chart when the page loads
// assets/kernel-timeline/kernel-timeline.js (front matter `scripts`); without it the div's own Markdown stays.
// Same for <div class="fanout-viz" data-n="100000" data-caption="…"> with assets/fanout-viz/fanout-viz.js (FanoutViz).
(function () {
  const html = document.documentElement, SRC = document.getElementById("static-landing"), ROOT = document.getElementById("root");
  const G = window.GUI;
  if (!G || !window.React || !window.ReactDOM || typeof G.mount !== "function" || !SRC || !ROOT) { html.classList.remove("gui-boot"); return; }
  try { render(); } catch (e) { html.classList.remove("gui-on", "gui-boot"); ROOT.innerHTML = ""; console.error(e); }
  function render() {
  const h = React.createElement, params = new URLSearchParams(location.search);
  const { Box, Button, Link, IconButton } = G.Atoms;
  const { Menu, MenuItem, ListItemIcon, ListItemText } = G.Molecules;
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const WIDE = "@media (min-width:640px)";
  const N = (type, props, children) => ({ type, props: props || {}, ...(children ? { children } : {}) });
  const txt = (el) => (el ? el.textContent.trim() : "");
  // inline code that is .me: starts with me. / me( / me[, or is a relative path with a .me operator call
  // (users["[i]"]["="](…), friends.ana["->"](…), contacts.ana["_"](key)); both go through window.MeSyntax
  const isMeCode = (tx) => /^me[.(\[]/.test(tx) || /^\["(?:@|_|__|->|=|\[i\]|~|\?|-|!)"\]$/.test(tx) || /^[\p{L}_$][\p{L}\p{N}_$]*(\.[\p{L}\p{N}_$]+|\[\d+\])*\["(?:@|_|__|->|=|\[i\]|~|\?|-|!)"\]/u.test(tx);

  // ── read the static page ──
  const path = [...SRC.querySelectorAll(".mepath > a, .mepath > .here")].map((e) => ({ text: txt(e), href: e.getAttribute("href"), title: e.getAttribute("title") || txt(e) }));
  // an <a class="strong"> reads as part of the sentence, only stronger: theme text.primary, bold
  const inline = (el) => [...el.childNodes].map((n) => n.nodeType === 1 && n.tagName === "A" ? N("Link", { href: n.getAttribute("href"), title: n.getAttribute("title") || undefined, underline: "hover",
      sx: n.classList.contains("strong") ? { color: "text.primary", fontWeight: 700 } : { color: "primary.main" } }, [n.textContent])
    // inline code that is a .me expression (me. / me( / me[) goes through the .me highlighter (window.MeSyntax), like on doc pages
    : n.nodeType === 1 && n.tagName === "CODE" ? ((tx, isMe) => N("Box", { component: "code", className: isMe ? "me-code" : undefined, sx: { fontFamily: MONO, fontSize: ".85em", px: .5, py: .125, borderRadius: "4px", bgcolor: "action.hover", color: "text.primary", ...(isMe ? { whiteSpace: "nowrap" } : {}) } }, isMe ? window.MeSyntax.render(h, tx) : [tx]))(n.textContent, !!window.MeSyntax && isMeCode(n.textContent))
    : n.textContent);
  const attrs = (img, names) => Object.fromEntries(names.map((k) => [k, img.getAttribute(k)]).filter(([, v]) => v != null));
  const docsIndex = SRC.dataset.layout === "docs-index", docPage = SRC.dataset.layout === "doc";
  const demosIndex = !docsIndex && !docPage && !!SRC.querySelector(".page .grid .card");
  const header = SRC.querySelector("header");
  const page = docPage ? { path, docs: SRC.querySelector(".topnav a[data-topbar=docs]")?.getAttribute("href"), github: SRC.querySelector(".topnav a[href*='github.com']")?.getAttribute("href"), body: SRC.querySelector("main.doc") } : docsIndex ? (() => {
    const t = SRC.querySelector(".page-title"), mark = t.querySelector("img"), foot = SRC.querySelector("footer a");
    return {
      path, docs: null, github: SRC.querySelector(".topnav a[href*='github.com']")?.getAttribute("href"),
      kicker: inline(SRC.querySelector(".kicker")), subtitle: inline(SRC.querySelector(".page-subtitle")),
      h1: [...t.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim(),
      mark: mark && attrs(mark, ["src", "alt"]),
      langs: [...SRC.querySelectorAll(".lang-nav a")].map((a) => ({ text: txt(a), href: a.getAttribute("href") })),
      cards: [...SRC.querySelectorAll(".grid > a.card")].map((a) => {
        const img = a.querySelector("img.card-media"), svg = a.querySelector("svg.card-media");
        return { svg: svg && svg.outerHTML, href: a.getAttribute("href"), title: txt(a.querySelector(".card-title")), desc: inline(a.querySelector(".card-desc")),
          sources: [...a.querySelectorAll("picture > source")].map((s) => attrs(s, ["srcset", "type"])),
          img: img && attrs(img, ["src", "width", "height", "alt"]) };
      }),
      footer: foot && { href: foot.getAttribute("href"), img: attrs(foot.querySelector("img"), ["src", "alt"]) },
    };
  })() : demosIndex ? {
    // the topbar path comes from the .kicker, or from data-path on the .topnav when the page shows no kicker
    path: SRC.querySelector(".kicker") ? [...[...SRC.querySelectorAll(".kicker a")].map((a) => ({ text: txt(a), href: a.getAttribute("href"), title: a.getAttribute("title") || txt(a) })),
      { text: [...SRC.querySelector(".kicker").childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim(), href: null }]
      : [{ text: "me://", href: "https://neurons-me.github.io/.me/", title: ".me" }, { text: SRC.querySelector(".topnav")?.dataset.path || "", href: null }],
    docs: SRC.querySelector(".topnav a[data-topbar=docs]")?.getAttribute("href"), github: SRC.querySelector(".topnav a[href*='github.com']")?.getAttribute("href"),
    kicker: SRC.querySelector(".kicker") && inline(SRC.querySelector(".kicker")), h1: txt(SRC.querySelector(".page-title")), h1Hidden: !!SRC.querySelector(".page-title.visually-hidden"),
    subtitle: SRC.querySelector(".page-subtitle") && inline(SRC.querySelector(".page-subtitle")),
    // optional hero (.page-hero img + .page-hero-caption) and several titled grids (.section-title before a .grid); a page with one plain grid renders as before
    hero: (() => { const f = SRC.querySelector(".page-hero"), lv = f && f.dataset.live; if (lv && window.LandingLive && window.LandingLive[lv]) return { live: lv, props: { ...f.dataset } }; const im = SRC.querySelector(".page-hero img"); return im && { src: im.getAttribute("src"), alt: im.getAttribute("alt") || "", caption: txt(SRC.querySelector(".page-hero-caption")) }; })(),
    groups: [...SRC.querySelectorAll(".page .grid")].map((g) => {
      const prev = g.previousElementSibling;
      return { title: prev && prev.classList.contains("section-title") ? txt(prev) : null, cards: [...g.querySelectorAll(":scope > .card")].map((a) => {
        const img = a.querySelector(".card-icon img"), emoji = a.querySelector(".card-emoji");
        return { href: a.getAttribute("href"), plain: a.classList.contains("card-plain"), title: txt(a.querySelector(".card-title")), desc: txt(a.querySelector(".card-desc")), path: txt(a.querySelector(".card-path")),
          img: img && { src: img.getAttribute("src"), alt: img.getAttribute("alt") || "" }, emoji: emoji && txt(emoji) };
      }), plain: g.classList.contains("grid-plain") };
    }),
  } : {
    path, docs: SRC.querySelector(".topnav .act")?.getAttribute("href"), github: SRC.querySelector(".topnav .gh")?.getAttribute("href"),
    h1: txt(header.querySelector("h1")), lede: header.querySelector(".lede") && inline(header.querySelector(".lede")), ledes2: [...header.querySelectorAll(".lede")].slice(1).map(inline),
    mls: [...header.querySelectorAll(".mls-card")].map((c) => {
      const t = c.querySelector(".mls-title");
      return { title: txt(t), href: t.getAttribute("href"), meta: txt(c.querySelector(".mls-meta")), desc: txt(c.querySelector(".item-desc")), links: [...c.querySelectorAll(".mls-links a")].map((a) => ({ text: txt(a), href: a.getAttribute("href") })) };
    }),
    sections: [...SRC.querySelectorAll(".wrap > section")].map((s) => {
      const grid = s.querySelector(".links");
      // a live widget section (<section data-live="Name">): a component a page script put on window.LandingLive
      if (s.dataset.live && window.LandingLive && window.LandingLive[s.dataset.live]) return { title: txt(s.querySelector(".section-title")), label: txt(s.querySelector(".section-label")), lede: s.querySelector(".section-lede") && inline(s.querySelector(".section-lede")), live: s.dataset.live, props: Object.fromEntries(Object.entries(s.dataset).filter(([k]) => k !== "live")) };
      // a section of .mls-card blocks (title link, line, chip links) instead of an item grid
      if (!grid) return { title: txt(s.querySelector(".section-title")), label: txt(s.querySelector(".section-label")), lede: s.querySelector(".section-lede") && inline(s.querySelector(".section-lede")),
        mls: [...s.querySelectorAll(".mls-card")].map((c) => { const t = c.querySelector(".mls-title");
          return { title: txt(t), href: t.getAttribute("href"), meta: txt(c.querySelector(".mls-meta")), desc: txt(c.querySelector(".item-desc")), links: [...c.querySelectorAll(".mls-links a")].map((a) => ({ text: txt(a), href: a.getAttribute("href") })) }; }) };
      return {
        title: txt(s.querySelector(".section-title")), label: txt(s.querySelector(".section-label")),
        kind: grid.classList.contains("demo-grid") ? "demo" : grid.classList.contains("docs-grid") ? "docs" : "list",
        items: [...grid.querySelectorAll("a.item")].map((a) => {
          const img = a.querySelector("img");
          return { href: a.getAttribute("href"), title: txt(a.querySelector(".item-title")), desc: txt(a.querySelector(".item-desc")),
            code: a.querySelector(".item-code") ? a.querySelector(".item-code").textContent : "", tag: txt(a.querySelector(".item-tag")),
            img: img && { src: img.getAttribute("src"), width: img.getAttribute("width"), height: img.getAttribute("height"), alt: img.getAttribute("alt") || "" } };
        }),
      };
    }),
    footer: txt(SRC.querySelector("footer")),
  };

  // ── icons: inline SVG (no icon font) ──
  const ICONS = {
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
    grid: "M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z",
    palette: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    moon: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z",
    sun: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    down: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
    github: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z",
  };
  const Ico = ({ kind, size = 18, off }) => h("svg", { viewBox: kind === "github" ? "0 0 16 16" : "0 0 24 24", width: size, height: size, fill: "currentColor", "aria-hidden": "true", focusable: "false", style: { display: "block", flex: "none" } },
    h("path", { d: ICONS[kind] }), off ? h("path", { d: "M3 3 21 21", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }) : null);

  // ── search: the .GUI SearchBar (GUI.Components.SearchBar, the one on the neurons.me index / All.This) over the site
  //    index (absolute URLs, so it works from either repo). A magnifier until opened ("/" opens it too); Escape closes it,
  //    and so does leaving it while empty. On phones the open bar overlays the topbar, full width. ──
  const SEARCH_SRC = "https://neurons-me.github.io/index.json";
  // The SearchBar paints itself with fixed inline colours; re-skin it from the active theme (same rules as the index).
  const searchSkin = (t) => {
    const P = t.palette, I = (v) => `${v} !important`, shadow = (t.shadows && t.shadows[8]) || "none";
    return {
      "& > div > div:first-of-type": { background: I(P.background.paper), borderColor: I(P.divider), color: I(P.text.primary), padding: I("6px 12px"), transition: "border-color 120ms ease" },
      "& > div > div:first-of-type:focus-within": { borderColor: I(P.primary.main) },
      "& input": { color: I(P.text.primary), caretColor: P.primary.main },
      "& input::placeholder": { color: P.text.secondary, opacity: 1 },
      "& [role=listbox]": { background: I(P.background.paper), borderColor: I(P.divider), boxShadow: I(shadow), color: P.text.primary },
      "& [role=listbox] > div": { color: I(P.text.secondary) },
      "& [role=option]": { color: I(P.text.primary), borderColor: I(P.divider) },
      "& [role=option]:hover, & [role=option][aria-selected=true]": { background: I(P.action.hover) },
      "& [role=option] > span:nth-of-type(2) > span:nth-of-type(2), & [role=option] > span:nth-of-type(3)": { color: I(P.text.secondary) },
    };
  };
  function TopSearch() {
    const SB = G.Components && G.Components.SearchBar;
    const [open, setOpen] = React.useState(false), box = React.useRef(null), btn = React.useRef(null);
    React.useEffect(() => { if (open) { const i = box.current && box.current.querySelector("input"); if (i) i.focus(); } }, [open]);
    React.useEffect(() => {
      if (open) return undefined;
      const k = (e) => { const t = e.target; if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) { e.preventDefault(); setOpen(true); } };
      window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
    }, [open]);
    if (!SB) return null;
    const close = (refocus) => { setOpen(false); if (refocus) setTimeout(() => btn.current && btn.current.focus(), 0); };
    if (!open) return h(G.Atoms.IconButton, { ref: btn, id: "site-search-open", size: "small", "aria-label": "Search", title: "Search (/)", onClick: () => setOpen(true), sx: { color: "text.secondary", p: { xs: .25, sm: .625 } } }, h(Ico, { kind: "search", size: 18 }));
    return h(G.Atoms.Box, { ref: box, id: "site-search", role: "search",
      onKeyDown: (e) => { if (e.key === "Escape") { e.preventDefault(); close(true); } },
      onBlur: (e) => { const nx = e.relatedTarget; if (nx && box.current && box.current.contains(nx)) return; const i = box.current && box.current.querySelector("input"); if (!i || !i.value.trim()) close(false); },
      sx: (t) => ({ zIndex: 1200, width: 300, minWidth: 0, flexShrink: 1, [t.breakpoints.down("sm")]: { position: "absolute", left: 8, right: 8, top: "50%", transform: "translateY(-50%)", width: "auto" },
        "& > div": { maxWidth: "none !important" }, ...searchSkin(t) }) },
      h(SB, { src: SEARCH_SRC, placeholder: "Search in All.This", themeMode: "auto", enableSlashShortcut: false }));
  }
  // ── topbar (same as ContextLab): logo, me:// path, Docs, GitHub, theme picker, light/dark, gear ──
  const LOGO = "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760629064/neurons.me_b50f6a.png";
  function ThemePicker() {
    const [anchor, setAnchor] = React.useState(null), { themeId } = G.useThemeContext(), close = () => setAnchor(null);
    return h(React.Fragment, null,
      h(Button, { id: "theme-picker", size: "small", variant: "outlined", "aria-label": `Theme: ${themeId}`, "aria-haspopup": "true", "aria-expanded": anchor ? "true" : "false", onClick: (e) => setAnchor(e.currentTarget),
        sx: { minWidth: 0, py: { xs: .5, sm: .25 }, px: { xs: .5, sm: .75 }, gap: .5, fontFamily: MONO, fontSize: 11, textTransform: "none", color: "text.secondary", borderColor: { xs: "transparent", sm: "divider" }, whiteSpace: "nowrap", "& .lbl": { display: { xs: "none", sm: "inline" } } } },
        h(Ico, { kind: "palette", size: 15 }), h(Box, { component: "span", className: "lbl" }, themeId), h(Box, { component: "span", className: "lbl" }, h(Ico, { kind: "down", size: 14 }))),
      h(Menu, { id: "theme-menu", anchorEl: anchor, open: !!anchor, onClose: close, anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" }, "data-gui-inspector-control": "true",
        slotProps: { list: { "aria-label": "Themes", dense: true }, paper: { sx: { width: 220, p: .5, mt: .5 } } } },
        h(G.ThemesCatalog, { sidebarView: "expanded", onThemeSelect: close })));
  }
  function ModeToggle() {
    const { mode, toggleMode } = G.useThemeContext(), dark = mode === "dark";
    return h(IconButton, { id: "theme-mode-toggle", size: "small", onClick: () => toggleMode(), "aria-label": dark ? "Switch to light mode" : "Switch to dark mode", title: dark ? "Light mode" : "Dark mode", sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: dark ? "moon" : "sun", size: 18 }));
  }
  function SettingsMenu() {
    const sel = G.useOptionalSelection ? G.useOptionalSelection() : null;
    const [anchor, setAnchor] = React.useState(null), close = () => setAnchor(null);
    React.useEffect(() => { if (sel && params.get("grid") === "1" && !sel.gridEnabled) sel.setGridEnabled(true); }, []);
    const insp = Boolean(G.getInspectorEnabled()), grid = Boolean(sel && sel.gridEnabled);
    const items = [
      { key: "inspector", label: insp ? "Inspector · ON" : "Inspector · OFF", icon: h(Ico, { kind: "code", off: !insp }), onClick: () => G.toggleInspector() },
      sel && { key: "grid", label: grid ? "Grid Layout · ON" : "Grid Layout · OFF", icon: h(Ico, { kind: "grid", off: !grid }), onClick: () => sel.setGridEnabled(!grid) },
    ].filter(Boolean);
    return h(React.Fragment, null,
      h(IconButton, { id: "gui-settings", "aria-label": "GUI settings", title: "GUI settings", size: "small", onClick: (e) => setAnchor(e.currentTarget), sx: { color: "text.secondary", p: { xs: .5, sm: .625 } } }, h(Ico, { kind: "settings", size: 18 })),
      h(Menu, { id: "settings-menu", anchorEl: anchor, open: !!anchor, onClose: close, "data-gui-inspector-control": "true", anchorOrigin: { vertical: "bottom", horizontal: "right" }, transformOrigin: { vertical: "top", horizontal: "right" } },
        ...items.map((it) => h(MenuItem, { key: it.key, "data-settings-item": it.key, onClick: () => { close(); it.onClick(); } }, h(ListItemIcon, null, it.icon), h(ListItemText, null, it.label)))));
  }
  // me:// sibling switcher: ▾ after a path segment lists the pages at the same level (shared map + menu: /assets/me-siblings.js, loaded on demand)
  function SibSlot(p) { var f = React.useState(0)[1]; React.useEffect(function () { if (window.MeSiblings) return; var on = function () { f(1); }; addEventListener("me-siblings", on); if (!document.getElementById("me-siblings")) { var s = document.createElement("script"); s.id = "me-siblings"; s.src = "/assets/me-siblings.js?v=4"; document.head.appendChild(s); } return function () { removeEventListener("me-siblings", on); }; }, []); return window.MeSiblings ? window.MeSiblings.node(p.path, p.i) : null; }
  function LandingTopBar(p) {
    // when the path doesn't fit (deep pages on phones), the middle segments collapse to "…" (a link to the parent), so the last one shows in full
    const P = page.path, last = P.length - 1, [mode, setMode] = React.useState("measure"), col = mode === "col", pathRef = React.useRef(null);
    React.useEffect(() => { const re = () => setMode("measure"); window.addEventListener("resize", re); if (document.fonts && document.fonts.ready) document.fonts.ready.then(re); return () => window.removeEventListener("resize", re); }, []);
    React.useEffect(() => { const b = pathRef.current; if (mode === "measure" && b) setMode(b.scrollWidth > b.clientWidth + 1 ? "col" : "full"); }, [mode]);
    const mids = P.slice(1, last).map((x) => x.text).join(" / ");
    const seg = (s, i) => { const hide = col && i > 0 && i < last, ell = col && i === last && last > 1;
      return [i > 0 && !P[i - 1].text.endsWith("://") && !hide && !ell ? h(Box, { component: "span", key: `sep${i}`, sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      ell ? h(Link, { key: "ell", href: P[last - 1].href, underline: "hover", title: mids, "aria-label": mids, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, "…") : null,
      ell ? h(Box, { component: "span", key: "ellsep", sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      hide ? null : s.href ? h(Link, { key: s.text, href: s.href, underline: "hover", title: s.title, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, s.text)
        : h(Box, { component: "span", key: s.text, "aria-current": "page", sx: { color: "text.primary", fontFamily: MONO, fontSize: { xs: 12, sm: 13 }, fontWeight: 600, flexShrink: 0 } }, s.text),
      hide ? null : h(SibSlot, { key: "sib" + i, path: P, i: i })]; };
    return h(Box, { component: "nav", "aria-label": "me path", "data-gui-node-id": p["data-gui-node-id"], sx: { position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: { xs: .5, sm: 1.25 }, px: { xs: .75, sm: 2.5 }, minHeight: 48, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" } },
      h(Link, { href: "https://neurons-me.github.io/", title: "neurons.me", underline: "none", sx: { display: "inline-flex", lineHeight: 0, flexShrink: 0 } }, h("img", { src: LOGO, alt: "neurons.me", width: 28, height: 28, style: { display: "block", objectFit: "contain" } })),
      h(Box, { ref: pathRef, sx: { display: "inline-flex", alignItems: "center", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } } }, ...page.path.flatMap(seg)),
      h(Box, { sx: { ml: "auto", display: "inline-flex", alignItems: "center", gap: { xs: .25, sm: 1.25 }, flexShrink: 0 } },
        h(TopSearch),
        page.docs && h(Link, { href: page.docs, underline: "hover", sx: { fontFamily: MONO, fontSize: 12, color: "text.secondary", mx: { xs: 1, sm: 0 } } }, "Docs"),
        page.github && h(Link, { href: page.github, underline: "none", target: "_blank", rel: "noopener", title: "GitHub · " + page.github.replace(/^https?:\/\/github\.com\//, ""), "aria-label": "GitHub", sx: { display: "inline-flex", lineHeight: 0, color: "text.secondary", "&:hover": { color: "text.primary" } } }, h(Ico, { kind: "github", size: 18 })),
        h(Box, { "data-gui-inspector-control": "true", sx: { display: "inline-flex", alignItems: "center", gap: .25 } }, h(ThemePicker), h(ModeToggle), h(SettingsMenu))));
  }

  // /.me/docs/ card cover: <picture> with the page's own <source>s (AVIF first) and the <img> with its width/height,
  // exactly as the static card (registry Box drops srcSet/width/height).
  // The h1 mark of /.me/docs/: the real .GUI identity orb (GUI.Widgets.Monad, Storybook All.This/monad.ai/monad.ai →
  // Identity: variant "identity", kind "me", seed "jabellae") tuned as on the neurons.me index .me card: full opacity,
  // faint halo, gentle float, ring at 80% of the orb and morphing with it, dot at 22% of the ring. It keeps the old
  // image's 5em box and margin; the orb is 44% of the box (its ring ≈ the drawn ring of assets/me.png) and is drawn at
  // its real pixel size (no CSS scaling), so it stays crisp. Without the widget the image stays.
  function MeOrbMark({ src, alt, big }) {
    const Monad = (G.Widgets && G.Widgets.Monad) || G.Monad;
    const ref = React.useRef(null), [px, setPx] = React.useState(0);
    React.useEffect(() => {
      const el = ref.current; if (!el) return undefined;
      const set = () => setPx(Math.round(el.getBoundingClientRect().width)); set();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null; if (ro) ro.observe(el);
      return () => ro && ro.disconnect();
    }, []);
    const boxSx = big ? { display: "flex", alignItems: "center", justifyContent: "center", width: big, height: big, mx: "auto" }
      : { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "5em", height: "5em", verticalAlign: "middle", mr: "-1.5em" };
    if (!Monad) return h(Box, { component: "img", src, alt, sx: { ...boxSx, display: "inline-block", width: "auto" } });
    const orb = Math.max(24, Math.round(px * (big ? 0.8 : 0.44))), f = orb / 48;   // f: scale against the index's 48px orb
    const blob = { "0%,100%": "50%", "25%": "55% 45% 60% 40% / 60% 55% 45% 40%", "50%": "50% 60% 40% 55% / 55% 40% 60% 45%", "75%": "45% 55% 40% 60% / 40% 60% 55% 50%" };
    const lift = { "0%,100%": [0, 1], "25%": [-2, 1.02], "50%": [-3, 1.04], "75%": [-2, 1.02] };
    const px1 = (v) => `${Math.round(v * f * 10) / 10}px`;
    return h(Box, { ref, "data-me-orb": "", role: "img", "aria-label": alt, sx: (t) => {
        const dark = t.palette.mode === "dark", halo = dark ? "255,255,255" : "0,90,122";
        return { ...boxSx, position: "relative", zIndex: 0, isolation: "isolate",
          "@keyframes meOrbFloat": Object.fromEntries(Object.keys(blob).map((k) => [k, { transform: `translateY(${px1(lift[k][0])}) scale(${lift[k][1]})`, borderRadius: blob[k] }])),
          "@keyframes meOrbHalo": { "0%,100%": { boxShadow: `0 0 ${px1(2)} rgba(${halo},0.10)` }, "50%": { boxShadow: `0 0 ${px1(4)} rgba(${halo},0.16)` } },
          "& > div": { width: `${orb}px`, height: `${orb}px`, flex: "none", display: "flex" },
          "& .monad-tooltip": { display: "none" }, "& div": { opacity: "1 !important" },
          "& div:has(> div[aria-hidden=true])": { animation: "meOrbFloat 6s ease-in-out infinite, meOrbHalo 4.5s ease-in-out infinite !important", "&:hover": { transform: "none" } },
          "& div[aria-hidden=true]": { width: "80% !important", height: "80% !important", borderRadius: "inherit" },
          "& div[aria-hidden=true] > div:first-of-type": { borderRadius: "inherit !important", borderWidth: `${px1(2.5)} !important`,
            boxShadow: dark ? `0 0 ${px1(3)} rgba(180,230,230,0.22) !important` : `0 0 ${px1(3)} rgba(0,90,122,0.18) !important` },
          "& div[aria-hidden=true] > div:last-of-type": { width: "22% !important", height: "22% !important", boxShadow: dark ? `0 0 ${px1(3)} rgba(234,252,250,0.35) !important` : `0 0 ${px1(3)} rgba(0,90,122,0.3) !important` } };
      } },
      px ? h(Box, null, h(Monad, { variant: "identity", kind: "me", seed: "jabellae", mode: "contained", size: Math.round(orb * 34 / 60) })) : null);
  }
  // The .me landing hero (index.md: <div class="me-landing-hero"> around _includes/interactive-hero.html): the same
  // live keccak-256 identity demo as the static include, with the Docs-card orb (MeOrbMark) drawn large, centered and
  // floating in place of the old image. Mirrors me.ts: compoundSeed = keccak256("me.seed/compound:v1::" + who + "::" + secret),
  // identityHash = keccak256("this.me/identity:v1::" + seed); no namespace is needed; secret never leaves the input.
  function MeLandingHero({ tag, seedHref, seedTitle, cards }) {
    const [who, setWho] = React.useState(""), [secret, setSecret] = React.useState("");
    const k = window.keccak256, name = who || ".me";
    const hash = k ? k("this.me/identity:v1::" + (secret ? k("me.seed/compound:v1::" + name + "::" + secret) : name)) : "";
    const field = (value, set, ph, label, type, sx) => h(Box, { component: "input", type, value, placeholder: ph, "aria-label": label, spellCheck: false, autoComplete: "off",
      onChange: (e) => set(e.target.value), sx: { font: "inherit", fontFamily: MONO, color: "inherit", bgcolor: "transparent", border: 0, borderBottom: "2px solid", borderColor: "divider",
        outline: "none", px: .25, width: `${(value || ph).length + 1}ch`, maxWidth: "100%", textAlign: "center", "&:focus": { borderColor: "primary.main" }, ...sx } });
    const mono = { fontFamily: MONO, letterSpacing: ".02em" };
    return h(Box, { component: "section", sx: { textAlign: "center", pt: { xs: 1, sm: 2 }, pb: { xs: 4, sm: 6 }, mb: 2, borderBottom: 1, borderColor: "divider" } },
      h(MeOrbMark, { alt: ".me as a coordinate", big: "clamp(180px, 42vw, 280px)" }),
      h(Box, { title: hash ? "ID Hash: " + hash : "ID Hash", sx: { ...mono, mt: 2, fontSize: ".78rem", color: "text.secondary" } }, hash ? hash.slice(0, 8) + "…" + hash.slice(-6) : "…"),
      h(Link, { href: seedHref, title: seedTitle, underline: "always", sx: { ...mono, display: "inline-block", mt: .25, fontSize: ".72rem", color: "primary.main" } }, "keccak-256"),
      h(Box, { component: "h1", sx: { fontSize: "clamp(2rem, 6vw, 2.8rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.15, mt: 3, mb: 1 } },
        "Hello, I am ", field(who, setWho, ".me", "Type your own name", "text", { fontWeight: 800, borderColor: "text.primary" })),
      h(Box, { sx: { fontSize: "1.15rem", color: "text.secondary", display: "flex", flexDirection: "column", alignItems: "center", gap: .75 } },
        field(secret, setSecret, "<secret>", "Secret — feeds the hash, stays local, never a URL", "password", {})),
      tag ? h(Box, { sx: { ...mono, mt: 2.5, fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".08em", color: "text.secondary" } }, tag) : null,
      cards && cards.length ? h(Box, { sx: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: { xs: 1, sm: 2 }, mt: 3, maxWidth: 560, mx: "auto" } }, cards.map((c) => h(GlyphCard, c))) : null);
  }
  // .me landing cards: a monochrome line glyph (inline SVG, currentColor, so it follows the theme and never shows tofu) + title
  function GlyphCard(p) {
    return h(Box, { "data-gui-node-id": p["data-gui-node-id"], component: "a", href: p.href, sx: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, py: 3, px: { xs: .5, sm: 2 },
        border: 1, borderColor: "divider", borderRadius: "12px", bgcolor: "background.paper", color: "text.primary", textDecoration: "none", transition: "border-color .14s, transform .14s",
        "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)", "& svg": { color: "primary.main" } } } },
      h("svg", { viewBox: "0 0 24 24", width: 40, height: 40, "aria-hidden": "true", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" },
        dangerouslySetInnerHTML: { __html: p.glyph } }),
      h("span", { style: { fontWeight: 700, fontSize: "clamp(.85rem, 3.6vw, 1.05rem)" } }, p.title));
  }
  function DocsCover(p) {
    const c = page.cards[p.card], im = c.img;
    // an inline <svg class="card-media"> cover (theme-following, currentColor) is kept as is, in the same 140px band
    if (c.svg) return h(Box, { "data-gui-node-id": p["data-gui-node-id"], sx: { display: "block", flexShrink: 0, lineHeight: 0, height: 140, color: "text.primary", "& svg": { display: "block", width: "100%", height: "100%" } }, dangerouslySetInnerHTML: { __html: c.svg } });
    return h(Box, { component: "picture", "data-gui-node-id": p["data-gui-node-id"], sx: { display: "block", flexShrink: 0, lineHeight: 0 } },
      ...c.sources.map((s, k) => h("source", { key: k, srcSet: s.srcset, type: s.type })),
      h("img", { key: "img", src: im.src, width: im.width, height: im.height, alt: im.alt, style: { display: "block", width: "100%", height: 140, objectFit: "cover" } }));
  }
  // ── content spec (registry types), same layout as the static page ──
  const cardSx = { display: "block", textDecoration: "none", color: "inherit", borderRadius: "14px", bgcolor: "background.paper", transition: "border-color .15s, box-shadow .15s",
    "&:hover": { borderColor: "primary.main", textDecoration: "none" } };
  const T = (text, sx, props) => N("Typography", { ...(props || {}), sx }, [].concat(text));
  const title = (t) => T(t, { fontWeight: 600, fontSize: "1.02rem", lineHeight: 1.6, color: "text.primary" });
  const desc = (t) => T(t, { color: "text.secondary", fontSize: ".9rem", lineHeight: 1.6, mt: .5 });
  const media = (img) => N("Box", { component: "img", src: img.src, width: img.width, height: img.height, alt: img.alt,
    sx: { display: "block", width: "100%", height: "auto", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: "10px", mb: 1.5, border: 1, borderColor: "divider" } });
  const listMedia = (img) => N("Box", { component: "img", src: img.src, width: img.width, height: img.height, alt: img.alt,
    sx: { display: "block", width: "100%", height: "auto", maxHeight: 160, objectFit: "cover", borderRadius: "10px", mb: 1.5, border: 1, borderColor: "divider" } });
  const code = (c) => N("Box", { component: "code", sx: (t) => ({ display: "block", mt: 1.25, px: 1.25, py: 1, borderRadius: "8px", fontFamily: MONO, fontSize: ".68rem", lineHeight: 1.6,
    color: "primary.main", bgcolor: `color-mix(in srgb, ${t.palette.primary.main} 7%, transparent)`, border: 1, borderColor: `color-mix(in srgb, ${t.palette.primary.main} 20%, transparent)`, whiteSpace: "pre", overflowX: "auto" }) }, [c]);
  const tag = (t) => T(t, { display: "inline-block", mt: "auto", pt: 1.25, fontSize: ".72rem", letterSpacing: ".06em", textTransform: "uppercase", color: "primary.main", lineHeight: 1.6 }, { component: "span" });

  const demoCard = (it) => N("Card", { component: "a", href: it.href, variant: "outlined", sx: { ...cardSx, display: "flex", flexDirection: "column", p: "12px 12px 16px" } }, [
    it.img && media(it.img), title(it.title), it.desc && desc(it.desc), it.code && code(it.code), it.tag && tag(it.tag)].filter(Boolean));
  const docCard = (kind) => (it) => N("Card", { component: "a", href: it.href, variant: "outlined", sx: { ...cardSx, p: "16px 20px" } }, [
    it.img && (kind === "docs" ? media(it.img) : listMedia(it.img)), title(it.title), it.desc && desc(it.desc)].filter(Boolean));
  const mlsCard = (m) => N("Card", { variant: "outlined", sx: { borderRadius: "14px", bgcolor: "background.paper", p: "16px 20px", mt: "18px" } }, [
    N("Box", { sx: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 } }, [
      N("Link", { href: m.href, underline: "hover", sx: { fontWeight: 600, fontSize: "1.02rem", color: "text.primary" } }, [m.title]),
      m.meta && T(m.meta, { color: "text.secondary", fontSize: ".82rem", whiteSpace: "nowrap" }, { component: "span" })].filter(Boolean)),
    m.desc && desc(m.desc),
    m.links.length ? N("Box", { sx: { display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 } }, m.links.map((l) => N("Chip", { label: l.text, component: "a", href: l.href, clickable: true, variant: "outlined", size: "small",
      sx: { fontSize: ".82rem", color: "primary.main", borderColor: "divider", "&:hover": { borderColor: "primary.main" } } }))) : null,
  ].filter(Boolean));
  const gridSx = (kind) => kind === "list" ? { display: "flex", flexDirection: "column", gap: "10px" }
    : { display: "grid", gridTemplateColumns: "1fr", gap: kind === "demo" ? "14px" : "10px", [WIDE]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } };
  const section = (s) => N("Box", { component: "section", sx: { py: 4, borderTop: 1, borderColor: "divider" } }, [
    s.title ? T(s.title, { fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.1, letterSpacing: "-.02em", fontWeight: 800, m: 0, mb: "18px" }, { component: "h2" })
      : T(s.label, { fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".08em", color: "text.secondary", m: 0, mb: "18px" }, { component: "p" }),
    s.lede && T(s.lede, { color: "text.secondary", fontSize: ".95rem", lineHeight: 1.6, m: 0, mb: "6px" }, { component: "p" }),
    s.live ? N(s.live, s.props || {}) : s.mls ? N("Box", {}, s.mls.map(mlsCard)) : N("Box", { sx: gridSx(s.kind) }, s.items.map(s.kind === "demo" ? demoCard : docCard(s.kind))),
  ].filter(Boolean));
  // /.me/Demos/ index: kicker, h1, one line, then image-left cards in 2 columns from 720px (as the static page)
  const indexCard = (c) => N("Card", { component: "a", href: c.href, variant: "outlined", sx: { ...cardSx, display: "flex", flexDirection: "row", alignItems: "stretch", minHeight: 140, overflow: "hidden", borderRadius: "12px",
      "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-1px)", textDecoration: "none" } } }, [
    N("Box", { sx: { width: "clamp(140px, 45%, 240px)", minHeight: 140, flexShrink: 0, display: "flex" } }, [
      c.img ? N("Box", { component: "img", src: c.img.src, alt: c.img.alt, sx: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
        : N("Box", { component: "span", "aria-hidden": "true", sx: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 140, fontSize: "3.5rem", bgcolor: "action.hover" } }, [c.emoji || ""]),
    ]),
    N("Box", { sx: { display: "flex", flexDirection: "column", justifyContent: "center", gap: .75, px: 2.5, py: 2, flex: 1, minWidth: 0 } }, [
      T(c.title, { fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.2, color: "text.primary" }),
      c.desc && T(c.desc, { fontSize: ".875rem", color: "text.secondary", lineHeight: 1.5 }),
      c.path && T(c.path, { fontFamily: MONO, fontSize: ".75rem", color: "primary.main", overflowWrap: "anywhere" }),
    ].filter(Boolean)),
  ]);
  const plainCard = (c) => N("Card", { variant: "outlined", sx: { ...cardSx, borderRadius: "12px", p: 2.25, display: "flex", flexDirection: "column", gap: .75 } }, [
    T(c.title, { fontSize: "1rem", fontWeight: 800, color: "text.primary" }),
    c.desc && T(c.desc, { fontSize: ".85rem", color: "text.secondary", lineHeight: 1.5 }),
  ].filter(Boolean));
  const indexSpec = () => N("Box", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary" } }, [
    N("LandingTopBar", {}),
    N("Box", { component: "main", sx: { maxWidth: 960, mx: "auto", px: 4, pt: 6, pb: 10, "@media (max-width:480px)": { px: 2.5, pt: 4 } } }, [
      page.kicker && T(page.kicker, { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1.5 }, { component: "p" }),
      T(page.h1, page.h1Hidden ? { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } : { fontSize: "2.75rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1.5 }, { component: "h1" }),
      page.subtitle && T(page.subtitle, { fontSize: "1.05rem", color: "text.secondary", mb: 6, maxWidth: 560 }, { component: "p" }),
      page.hero && page.hero.live && N("Box", { sx: { mb: 6 } }, N(page.hero.live, page.hero.props)),
      page.hero && !page.hero.live && N("Box", { component: "figure", sx: { m: 0, mb: 6 } }, [
        N("Box", { component: "img", src: page.hero.src, alt: page.hero.alt, sx: { width: "100%", height: "auto", display: "block", borderRadius: "12px", border: 1, borderColor: "divider" } }),
        page.hero.caption && T(page.hero.caption, { fontFamily: MONO, fontSize: ".85rem", color: "text.secondary", mt: 1.5 }, { component: "figcaption" }),
      ].filter(Boolean)),
      ...page.groups.flatMap((g) => [
        g.title && T(g.title, { fontSize: "1.25rem", fontWeight: 800, mb: 2 }, { component: "h2" }),
        N("Box", { sx: g.plain ? { display: "grid", gap: 2, mb: 6, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" } : { display: "grid", gridTemplateColumns: "1fr", gap: 2, mb: 6, "@media (min-width:720px)": { gridTemplateColumns: "1fr 1fr" } } }, g.cards.map((c) => c.plain ? plainCard(c) : indexCard(c))),
      ].filter(Boolean)),
    ].filter(Boolean)),
  ]);
  // /.me/docs/ index: cover image on top of every card (140px, cropped), title, text; 3 / 2 / 1 columns as the static page
  const docsCard = (c, i) => N("Card", { component: "a", href: c.href, variant: "outlined", sx: { ...cardSx, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "12px",
      transition: "border-color .14s, box-shadow .14s, transform .14s", "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-1px)", textDecoration: "none" } } }, [
    (c.img || c.svg) && N("DocsCover", { card: i }),
    N("Box", { sx: { display: "flex", flexDirection: "column", gap: 1.25, p: 2.5 } }, [
      T(c.title, { fontSize: "1rem", fontWeight: 700, lineHeight: 1.3, color: "text.primary" }),
      T(c.desc, { fontSize: ".875rem", color: "text.secondary", lineHeight: 1.55 }),
    ]),
  ].filter(Boolean));
  const docsSpec = () => N("Box", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary" } }, [
    N("LandingTopBar", {}),
    N("Box", { component: "main", sx: { maxWidth: 960, mx: "auto", px: 4, pt: 6, pb: 4, "@media (max-width:480px)": { px: 2.5, pt: 4 } } }, [
      T(page.kicker, { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1.5 }, { component: "p" }),
      T([page.mark && N("MeOrbMark", { src: page.mark.src, alt: page.mark.alt }), " " + page.h1].filter(Boolean),
        { fontSize: "2.75rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1.5, "@media (max-width:480px)": { fontSize: "2.2rem" } }, { component: "h1" }),
      T(page.subtitle, { fontSize: "1.05rem", color: "text.secondary", mb: 6, maxWidth: 560 }, { component: "p" }),
      page.langs.length && N("Box", { component: "nav", "aria-label": "Languages", sx: { display: "flex", flexWrap: "wrap", gap: 1, mb: 5 } }, page.langs.map((l) => N("Chip", { label: l.text, component: "a", href: l.href, clickable: true, variant: "outlined",
        sx: { fontSize: ".8rem", fontWeight: 600, borderColor: "divider", "&:hover": { borderColor: "primary.main" } } }))),
      N("Box", { sx: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px", "@media (max-width:720px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (max-width:480px)": { gridTemplateColumns: "minmax(0, 1fr)" } } }, page.cards.map(docsCard)),
    ].filter(Boolean)),
    page.footer && N("Box", { component: "footer", sx: { mt: 8, py: 5, textAlign: "center", borderTop: 1, borderColor: "divider" } }, [
      N("Link", { href: page.footer.href, title: page.footer.img.alt, underline: "none", sx: { display: "inline-flex", lineHeight: 0 } }, [
        N("Box", { component: "img", src: page.footer.img.src, alt: page.footer.img.alt, width: 36, height: 36, sx: { width: 36, height: 36, objectFit: "contain", opacity: .5, transition: "opacity .14s", "&:hover": { opacity: 1 } } })]),
    ]),
  ].filter(Boolean));
  // ── Markdown doc page (layout gui-doc): the rendered Markdown, element by element, as registry nodes ──
  const SYN = window.MeSyntax;
  function MeCodeBlock({ code, lang, "data-gui-node-id": id }) {
    const me = SYN && /^(ts|js|javascript|typescript|me)$/.test(lang || "");
    return h(Box, { component: "pre", "data-gui-node-id": id, className: me ? "me-code" : undefined, sx: (t) => ({ m: 0, mb: 2.5, px: 2, py: 1.5, borderRadius: "10px", overflowX: "auto", fontFamily: MONO, fontSize: { xs: 12, sm: 13 }, lineHeight: me ? 1.6 : 1.25,
        bgcolor: `color-mix(in srgb, ${t.palette.text.primary} 4%, ${t.palette.background.paper})`, border: 1, borderColor: "divider", color: "text.primary" }) },
      h("code", { style: { fontFamily: "inherit", whiteSpace: "pre" } }, ...(me ? SYN.render(h, code) : [code])));
  }
  // Raw image markup that follows the GUI light/dark mode: each <picture> becomes its <img>, with the
  // prefers-color-scheme: dark <source> used in dark mode (the OS setting is not the page's mode).
  function ModeHtml({ html, inline, sx, "data-gui-node-id": id }) {
    const { mode } = G.useThemeContext(), dark = mode === "dark";
    const out = React.useMemo(() => {
      const box = document.createElement("div"); box.innerHTML = html;
      box.querySelectorAll("picture").forEach((pic) => {
        const img = pic.querySelector("img"); if (!img) { pic.remove(); return; }
        const ds = pic.querySelector('source[media*="prefers-color-scheme: dark"]');
        const im = img.cloneNode(true); if (dark && ds) im.setAttribute("src", ds.getAttribute("srcset").split(/\s+/)[0]);
        pic.replaceWith(im);
      });
      return box.innerHTML;
    }, [html, dark]);
    return h(Box, { component: inline ? "span" : "div", "data-gui-node-id": id, sx, dangerouslySetInnerHTML: { __html: out } });
  }
  // "See also" / "Related" at the end of a doc page: the links that have a docs-index card (window data from
  // _data/doc_cards.json, written by the gui-doc layout) become compact cards with that card's image / SVG; the
  // other links stay as a line of links under them. Without JS the page keeps its plain list.
  function relatedCards(body) {
    let idx = {}; try { idx = JSON.parse((document.getElementById("doc-card-index") || {}).textContent || "{}"); } catch (e) {}
    const keyOf = (href) => { try { const u = new URL(href, location.href); if (u.host !== location.host && u.host !== "neurons-me.github.io") return u.href.replace(/#.*$/, "");
      return u.pathname.replace(/index\.html$/, ""); } catch (e) { return ""; } };
    const here = keyOf(location.href);
    body.querySelectorAll(":scope > h2, :scope > h3").forEach((hd) => {
      if (!/^(see also|related)$/i.test(txt(hd))) return;
      const list = hd.nextElementSibling; if (!list || !/^(UL|P)$/.test(list.tagName)) return;
      const links = [...list.querySelectorAll("a")], seen = new Set(), cards = [], rest = [];
      links.forEach((a) => { const k = keyOf(a.getAttribute("href")), c = idx[k];
        if (c && k !== here && !seen.has(k)) { seen.add(k); cards.push({ a, c }); } else if (!c) rest.push(a); });
      if (!cards.length) return;
      const box = document.createElement("div"); box.className = "doc-cards doc-related";
      cards.forEach(({ a, c }) => { const el = document.createElement("a"); el.className = "card"; el.setAttribute("href", a.getAttribute("href"));
        if (c.svg) { const f = document.createElement("span"); f.className = "card-svg"; f.innerHTML = c.svg; el.appendChild(f); }
        else if (c.img) { const im = document.createElement("img"); im.setAttribute("src", c.img); im.setAttribute("alt", ""); el.appendChild(im); }
        const t = document.createElement("span"); t.className = "card-title"; t.textContent = c.title; el.appendChild(t);
        const d = document.createElement("span"); d.className = "card-desc"; d.textContent = c.desc; el.appendChild(d);
        box.appendChild(el); });
      list.replaceWith(box);
      if (rest.length) { const p = document.createElement("p"); rest.forEach((a, i) => { if (i) p.appendChild(document.createTextNode(" · ")); p.appendChild(a); }); box.after(p); }
    });
    return body;
  }
  // Axiom-style blocks: a heading marked {: .doc-axiom} ("A1 | Title") and everything up to the next h2 / h3 / hr become
  // one <section class="doc-axiom-block">, drawn as a compact block with a left accent, a small "Axiom A1" label and the title.
  function axiomBlocks(body) {
    body.querySelectorAll(":scope > .doc-axiom").forEach((hd) => {
      const sec = document.createElement("section"); sec.className = "doc-axiom-block";
      hd.before(sec);
      let n = hd; while (n) { const next = n.nextElementSibling; sec.appendChild(n); n = next; if (!n || /^(H1|H2|H3|HR)$/.test(n.tagName)) break; }
    });
    return body;
  }
  // Kernel note: a paragraph marked {: .doc-kernel} ("Kernel: **this.me 4.2.1** ([npm](…)) ⓘ") stays visible as one short line
  // with an ⓘ button; the paragraph right after it, marked {: .doc-kernel-more} (how the examples ran, source links), moves
  // into the tooltip, shown on hover, focus or tap (Escape / outside tap closes). Without JS both paragraphs show.
  function KernelBadge({ html, tip, "data-gui-node-id": id }) {
    const [open, setOpen] = React.useState(false), [pin, setPin] = React.useState(false), ref = React.useRef(null);
    React.useEffect(() => {
      if (!pin) return undefined;
      const off = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !ref.current.contains(e.target)) { setPin(false); setOpen(false); } };
      document.addEventListener("pointerdown", off); document.addEventListener("keydown", off);
      return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", off); };
    }, [pin]);
    const tipRef = React.useRef(null), [dx, setDx] = React.useState(0);
    const show = !!tip && (open || pin), linkSx = { "& a": { color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } } };
    // keep the tooltip inside the viewport (16px margin): measured when it opens
    React.useLayoutEffect(() => {
      if (!show || !tipRef.current) { if (dx) setDx(0); return; }
      const r = tipRef.current.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      const over = r.right - (vw - 16), under = 16 - r.left;
      if (over > 0) setDx((d) => d - over); else if (under > 0) setDx((d) => d + under);
    }, [show]);
    return h(Box, { component: "p", ref, "data-gui-node-id": id, className: "doc-kernel-badge", sx: { position: "relative", m: 0, mb: 2, fontSize: ".95rem", lineHeight: 1.7, color: "text.secondary", "& strong": { color: "text.primary" }, ...linkSx } },
      h(Box, { component: "span", dangerouslySetInnerHTML: { __html: html } }),
      tip && h(Box, { component: "span", sx: { display: "inline-block", position: "relative" }, onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) },
        h(Box, { component: "button", type: "button", "aria-label": "About this kernel", "aria-expanded": show, "aria-describedby": show ? "doc-kernel-tip" : undefined,
          onClick: () => setPin((v) => !v), onFocus: () => setOpen(true), onBlur: () => { setOpen(false); },
          sx: { ml: .75, p: "0 2px", border: 0, background: "none", cursor: "pointer", color: "primary.main", fontSize: "1rem", lineHeight: 1, verticalAlign: "baseline", borderRadius: "4px", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" } } }, "ⓘ"),
        show && h(Box, { ref: tipRef, id: "doc-kernel-tip", role: "tooltip", style: { transform: `translateX(${dx}px)` }, sx: { position: "absolute", zIndex: 20, top: "calc(100% + 6px)", left: "-12px", width: "max-content", maxWidth: "min(520px, calc(100vw - 32px))",
            p: 1.5, borderRadius: "10px", border: 1, borderColor: "divider", bgcolor: "background.paper", boxShadow: 6, fontSize: ".84rem", lineHeight: 1.6, color: "text.secondary", whiteSpace: "normal",
            "& code": { fontFamily: MONO, fontSize: ".9em" }, "& p": { m: 0 }, ...linkSx },
          dangerouslySetInnerHTML: { __html: tip } })));
  }
  function DocCardCover({ src, svg, compact, alt, "data-gui-node-id": id }) {
    const hh = compact ? 96 : 140;
    if (svg) return h(Box, { "data-gui-node-id": id, role: "img", "aria-label": alt || undefined, sx: { display: "block", lineHeight: 0, height: hh, color: "text.primary", "& svg": { display: "block", width: "100%", height: "100%" } }, dangerouslySetInnerHTML: { __html: svg } });
    if (compact) return h("img", { src, alt: alt || "", loading: "lazy", "data-gui-node-id": id, style: { display: "block", width: "100%", height: hh, objectFit: "cover" } });
    return h("img", { src, alt: alt || "", loading: "lazy", "data-gui-node-id": id, style: { display: "block", width: "100%", height: 140, objectFit: "cover" } });
  }
  const tagOf = (el) => el.tagName.toLowerCase();
  const inl = (el) => [...el.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return null;
    const t = tagOf(n);
    if (t === "a") return N("Link", { href: n.getAttribute("href"), underline: "hover", sx: { color: "primary.main", fontWeight: "inherit" } }, inl(n));
    // Inline code that is .me code (starts with me. / me( / me[) goes through the .me highlighter too.
    if (t === "code") { const tx = n.textContent, isMe = SYN && (isMeCode(tx) || (meTable && /^[\p{L}_$][\p{L}\p{N}_$]*(\.[\p{L}\p{N}_$]+|\[\d+\])+$/u.test(tx)));
      return N("Box", { component: "code", className: isMe ? "me-code" : undefined, sx: { fontFamily: MONO, fontSize: ".86em", px: .5, py: .125, borderRadius: "4px", bgcolor: "action.hover", color: "text.primary", overflowWrap: "anywhere" } }, isMe ? SYN.render(h, tx) : [tx]); }
    if (t === "strong" || t === "b") return N("Box", { component: "strong", sx: { fontWeight: 700, color: "text.primary" } }, inl(n));
    if (t === "em" || t === "i") return N("Box", { component: "em" }, inl(n));
    if (t === "br") return N("Box", { component: "br" });
    // Images (and <picture> with its dark/light sources) keep their own markup.
    if (t === "img" || t === "picture") return N("ModeHtml", { inline: true, html: n.outerHTML, sx: { display: "inline-block", maxWidth: "100%", "& img": { maxWidth: "100%", height: "auto", verticalAlign: "middle" } } });
    return N("Box", { component: "span" }, inl(n));
  }).filter((x) => x != null && x !== "");
  const cellSx = { textAlign: "left", verticalAlign: "top", px: 1.25, py: .75, borderBottom: 1, borderColor: "divider", fontSize: ".9rem", lineHeight: 1.5 };
  // in a table that already shows .me code, bare paths in code cells (profile.name, users.ana) are .me paths too
  let meTable = false;
  const tableNode = (el) => { meTable = !!SYN && [...el.querySelectorAll("code")].some((c) => isMeCode(c.textContent)); try { return tableNode0(el); } finally { meTable = false; } };
  const tableNode0 = (el) => N("Box", { sx: { overflowX: "auto", mb: 2.5, border: 1, borderColor: "divider", borderRadius: "10px" } }, [
    N("Box", { component: "table", sx: { width: "100%", borderCollapse: "collapse", "& tr:last-of-type > td": { borderBottom: 0 } } },
      [...el.children].map((sec) => N("Box", { component: tagOf(sec) }, [...sec.children].map((tr) => N("Box", { component: "tr" }, [...tr.children].map((c) => {
        const al = c.getAttribute("style") && /right/.test(c.getAttribute("style")) ? "right" : "left";
        return N("Box", { component: tagOf(c), sx: { ...cellSx, textAlign: al, ...(tagOf(c) === "th" ? { fontWeight: 700, color: "text.secondary", fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", bgcolor: "action.hover" } : {}) } }, inl(c));
      })))))),
  ]);
  const docCards = (el, compact = el.classList.contains("doc-related")) => N("Box", { sx: { display: "grid", gridTemplateColumns: compact ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: compact ? "12px" : "16px", mb: 3, "@media (max-width:860px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (max-width:520px)": { gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" } } },
    [...el.querySelectorAll("a.card")].map((a) => {
      const img = a.querySelector("img"), svg = a.querySelector(".card-svg svg"), kind = a.querySelector(".card-kind");
      return N("Card", { component: "a", href: a.getAttribute("href"), variant: "outlined", sx: { ...cardSx, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "12px",
          transition: "border-color .14s, box-shadow .14s, transform .14s", "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-1px)", textDecoration: "none" } } }, [
        svg ? N("DocCardCover", { svg: svg.outerHTML, compact, alt: svg.getAttribute("aria-label") }) : img && N("DocCardCover", { src: img.getAttribute("src"), alt: img.getAttribute("alt"), compact }),
        N("Box", { sx: { display: "flex", flexDirection: "column", gap: compact ? .5 : .75, p: compact ? 1.5 : 2 } }, [
          kind && T(txt(kind), { fontSize: ".7rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "primary.main" }),
          T(txt(a.querySelector(".card-title")), { fontSize: compact ? ".92rem" : "1rem", fontWeight: 700, lineHeight: 1.3, color: "text.primary" }),
          a.querySelector(".card-desc") && T(inl(a.querySelector(".card-desc")), { fontSize: compact ? ".8rem" : ".86rem", color: "text.secondary", lineHeight: 1.5 }),
        ].filter(Boolean)),
      ].filter(Boolean));
    }));
  const H = { h1: { fontSize: "clamp(2.2rem, 6vw, 3rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mt: 0, mb: 2 },
    h2: { fontSize: "clamp(1.4rem, 3.6vw, 1.75rem)", fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.2, mt: 5, mb: 1.5 },
    h3: { fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.3, mt: 3.5, mb: 1 }, h4: { fontSize: "1rem", fontWeight: 700, mt: 3, mb: 1 } };
  let runN = 0;
  const landing = docPage && page.body && page.body.querySelector(".me-landing-hero");
  const blocks = (el) => [...el.children].map((b) => {
    const t = tagOf(b);
    if (t === "script" || t === "style") return null;
    if (landing && b === landing) { const a = b.querySelector("a[href*='Seed']"), cards = [...b.querySelectorAll(".root-cards > a.card")].map((c) => ({ href: c.getAttribute("href"), title: txt(c.querySelector(".card-title")), glyph: c.querySelector("svg.card-glyph")?.innerHTML || "" }));
      return N("MeLandingHero", { tag: txt(b.querySelector(".me-hero-tag")), seedHref: a && a.getAttribute("href"), seedTitle: a && a.getAttribute("title"), cards }); }
    if (landing && (b.classList.contains("static-hero") || b.classList.contains("readme-intro") || b.classList.contains("readme-demos"))) return null;
    // the landing's demo grid (index.md): emoji title, one line, a 1-2 line .me example (.me highlighter), whole card links
    if (b.classList.contains("me-demo-cards")) return N("Box", { sx: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "14px", mt: 1, mb: 2 } },
      [...b.querySelectorAll("a.card")].map((a) => { const c = txt(a.querySelector(".card-code"));
        // last slot: the Demos mosaic (same cover as the docs index) over one line; the image fills whatever height the row gives
        if (a.classList.contains("card-all")) return N("Card", { component: "a", href: a.getAttribute("href"), variant: "outlined", "aria-label": "View all demos", sx: { display: "flex", flexDirection: "column", p: 0, overflow: "hidden", borderRadius: "12px", textDecoration: "none",
            transition: "border-color .14s, box-shadow .14s, transform .14s", "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-1px)", textDecoration: "none" } } }, [
          N("Box", { sx: { position: "relative", flex: 1, minHeight: "150px" } }, [N("Box", { component: "img", src: a.querySelector("img").getAttribute("src"), alt: "", loading: "lazy", sx: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" } })]),
          T(txt(a.querySelector(".card-title")), { fontSize: "1rem", fontWeight: 700, lineHeight: 1.3, color: "text.primary", textAlign: "center", py: 1.5, px: 2 }),
        ]);
        return N("Card", { component: "a", href: a.getAttribute("href"), variant: "outlined", sx: { display: "flex", flexDirection: "column", gap: .75, p: 2, borderRadius: "12px", textDecoration: "none",
            transition: "border-color .14s, box-shadow .14s, transform .14s", "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-1px)", textDecoration: "none" } } }, [
          T(txt(a.querySelector(".card-title")), { fontSize: "1rem", fontWeight: 700, lineHeight: 1.3, color: "text.primary" }),
          T(txt(a.querySelector(".card-desc")), { fontSize: ".86rem", color: "text.secondary", lineHeight: 1.5 }),
          N("Box", { component: "code", className: "me-code", sx: { mt: "auto", display: "block", fontFamily: MONO, fontSize: ".76rem", lineHeight: 1.55, p: 1, borderRadius: "8px", bgcolor: "action.hover", color: "text.primary", overflowX: "auto", whiteSpace: "pre" } },
            window.MeSyntax ? window.MeSyntax.render(h, c) : [c]),
        ]); }));
    if (b.classList.contains("me-demo-all")) return T(inl(b), { fontSize: ".9rem", mb: 4, textAlign: "center", "& a": { fontWeight: 700 } }, { component: "p" });
    if (t === "p" && b.classList.contains("doc-kernel")) { const more = b.nextElementSibling && b.nextElementSibling.classList.contains("doc-kernel-more") ? b.nextElementSibling : null;
      return N("KernelBadge", { html: b.innerHTML.replace(/\s*ⓘ\s*$/, ""), tip: more ? more.innerHTML : "" }); }
    if (b.classList.contains("doc-kernel-more") && b.previousElementSibling && b.previousElementSibling.classList.contains("doc-kernel")) return null;
    if (H[t]) return T(inl(b), { ...H[t], scrollMarginTop: "64px" }, { component: t, id: b.id || undefined });
    if (t === "p") return T(inl(b), { fontSize: "1rem", lineHeight: 1.7, color: "text.primary", mb: 2 }, { component: "p" });
    if (t === "blockquote") return N("Box", { component: "blockquote", sx: { m: 0, mb: 2.5, pl: 2, py: .25, borderLeft: 3, borderColor: "primary.main", color: "text.secondary", "& p": { mb: 0, color: "text.secondary" } } }, blocks(b));
    if (t === "ul" || t === "ol") return N("Box", { component: t, sx: { pl: 3, mt: 0, mb: 2.5, "& > li": { mb: .75, lineHeight: 1.65 }, "& > li p": { mb: .5 } } },
      [...b.children].map((li) => N("Box", { component: "li" }, li.querySelector(":scope > p, :scope > ul, :scope > ol, :scope > div") ? blocks(li) : inl(li))));
    // a layout table that carries images (README-style hero) keeps its markup; data tables get the .GUI table
    if (t === "table") return b.querySelector("img, picture") ? N("ModeHtml", { sx: { mb: 2.5, overflowX: "auto", "& table": { border: 0, borderCollapse: "collapse" }, "& td, & th": { border: 0, p: 1, verticalAlign: "middle" }, "& img": { maxWidth: "100%", height: "auto" }, "& h2": { fontSize: "1.4rem", fontWeight: 800, m: 0 } }, html: b.outerHTML }) : tableNode(b);
    if (t === "picture" || t === "img") return N("ModeHtml", { html: b.outerHTML, sx: { mb: 2, "& img": { maxWidth: "100%", height: "auto", display: "block" } } });
    if (t === "hr") return N("Box", { component: "hr", sx: { border: 0, borderTop: 1, borderColor: "divider", my: 4 } });
    // a fenced block marked {: .me-run} gets a Run button (assets/me-run, loaded by the page); numbered in page order
    if (b.classList.contains("me-run") && window.MeRun) return N("MeRunBlock", { idx: runN++, solo: b.classList.contains("me-solo"), compact: !!b.closest(".me-intro"), code: (b.querySelector("code") || b).textContent.replace(/\n$/, "") });
    if (t === "pre" || b.classList.contains("highlighter-rouge")) {
      const lang = ((b.className.match(/language-(\w+)/) || [])[1]) || "", code = (b.querySelector("code") || b).textContent.replace(/\n$/, "");
      return N("MeCodeBlock", { code, lang });
    }
    if (b.classList.contains("doc-cards")) return docCards(b);
    if (b.classList.contains("doc-svg")) return N("Box", { component: "figure", className: "doc-svg", sx: { m: 0, mb: 2.5, color: "text.primary", overflowX: b.getAttribute("data-min") ? "auto" : undefined, "& svg": { display: "block", width: "100%", height: "auto", maxWidth: b.getAttribute("data-max") || "100%", minWidth: b.getAttribute("data-min") || 0 }, "& figure": { m: 0 }, "& figcaption": { fontSize: ".82rem", color: "text.secondary", mt: .75, lineHeight: 1.5 } }, dangerouslySetInnerHTML: { __html: b.innerHTML } });
    if (b.classList.contains("kernel-timeline") && window.KernelTimeline) return N("KernelTimeline", { src: b.getAttribute("data-src") });
    if (b.classList.contains("audience-venn") && window.AudienceVenn) return N("AudienceVenn", { compact: b.classList.contains("compact") });
    // the .me landing's intro views (index.md: <section class="me-intro">): a compact card per README section, heading,
    // one or two lines, a live embed (Run block / AudienceVenn) and a "Read more →" link (p.me-intro-more) to its full page
    if (b.classList.contains("me-intro-grid")) return N("Box", { component: "div", sx: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px", mt: 2, mb: 3, "@media (max-width:860px)": { gridTemplateColumns: "minmax(0, 1fr)" } } }, blocks(b));
    if (b.classList.contains("me-intro")) return N("Card", { component: "section", variant: "outlined", sx: { ...cardSx, p: 2, pb: 1.25, borderRadius: "12px", minWidth: 0, display: "flex", flexDirection: "column", gridColumn: b.classList.contains("wide") ? "1 / -1" : undefined,
        "& h2, & h3": { mt: 0, mb: .75, fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.3 }, "& p": { fontSize: ".9rem", lineHeight: 1.6, mb: 1.25, color: "text.secondary" } } },
      [...b.children].map((c) => c.classList.contains("me-intro-more")
        ? N("Box", { sx: { mt: "auto", pt: .25, textAlign: "right", fontSize: ".86rem", fontWeight: 700, "& a": { fontWeight: 700 } } }, inl(c))
        : blocks({ children: [c] })[0]).filter(Boolean));
    if (b.classList.contains("social-graph-live") && window.SocialGraphLive) return N("SocialGraphLive", {});
    if (b.classList.contains("fanout-viz") && window.FanoutViz) return N("FanoutViz", { n: b.getAttribute("data-n"), caption: b.getAttribute("data-caption") });
    // live demonstrations (assets/axioms-live, loaded by the page): the snippet is the placeholder's own code text
    if (b.classList.contains("axiom-proof") && window.AxiomsLive) return N("AxiomProof", { axiom: b.getAttribute("data-axiom"), code: b.textContent.replace(/^\n+|\s+$/g, "") });
    if (b.classList.contains("axiom-kernel") && window.AxiomsLive) return N("AxiomKernel", { items: [...page.body.querySelectorAll(".doc-axiom")].map((hd) => {
      const m = /^\s*(\S+)\s*\|\s*(.+)$/.exec(txt(hd)) || [null, txt(hd), ""]; return { id: m[1], title: m[2], anchor: hd.id }; }) });
    if (b.classList.contains("doc-axiom-block")) {
      const hd = b.querySelector(":scope > .doc-axiom"), m = /^\s*(\S+)\s*\|\s*(.+)$/.exec(txt(hd)) || [null, "", txt(hd)];
      return N("Box", { component: "section", sx: (th) => ({ mt: 4, mb: 3, pl: { xs: 2, sm: 2.5 }, pr: { xs: 1.5, sm: 2 }, pt: 1.75, pb: .5, borderLeft: "3px solid", borderColor: "primary.main", borderRadius: "0 10px 10px 0",
          bgcolor: `color-mix(in srgb, ${th.palette.primary.main} 5%, transparent)`, "& > p:last-child": { mb: 1.5 } }) }, [
        N("Box", { component: hd.tagName.toLowerCase(), id: hd.id || undefined, sx: { m: 0, mb: 1.5, scrollMarginTop: "64px" } }, [
          m[1] && N("Box", { component: "span", sx: { display: "block", fontFamily: MONO, fontSize: ".72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "primary.main", mb: .25 } }, ["Axiom " + m[1]]),
          N("Box", { component: "span", sx: { display: "block", fontSize: "clamp(1.3rem, 3.2vw, 1.6rem)", fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.2, color: "text.primary" } }, [m[2]]),
        ].filter(Boolean)),
        ...[...b.children].filter((c) => c !== hd).map((c) => c.classList.contains("doc-axiom-test")
          ? T(inl(c), { fontSize: ".82rem", color: "text.secondary", lineHeight: 1.6, mt: -.5, mb: 1.5 }, { component: "p" })
          : c.classList.contains("doc-axiom-statement") ? T(inl(c), { fontSize: "1.05rem", lineHeight: 1.65, color: "text.primary", mb: 1.5, "& strong": { fontVariant: "small-caps", letterSpacing: ".04em" } }, { component: "p" })
          : blocks({ children: [c] })[0]),
      ]);
    }
    // <div class="doc-sidebar">: a sticky right-hand panel beside the page (docSpec widens the page into two columns)
    if (b.classList.contains("doc-sidebar")) return N("Box", { component: "div", "data-doc-sidebar": "1" }, blocks(b));
    if (t === "div" || t === "section") return N("Box", { component: t }, blocks(b));
    return N("Box", { component: t, sx: { mb: 2 } }, inl(b));
  }).filter(Boolean);
  const docSpec = () => N("Box", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary" } }, [
    N("LandingTopBar", {}),
    // a page with a top-level .doc-sidebar (e.g. Social-Graph's live figure): steps on the left, the panel sticky on the
    // right from 1000px, as on the Smart Cities demos; narrower, one column and the panel stays where it is in the text
    page.body.querySelector(":scope > .doc-sidebar")
      ? N("Box", { component: "main", sx: { width: "min(1240px, calc(100% - 40px))", mx: "auto", pt: 5, pb: 10, "@media (max-width:480px)": { pt: 3.5, width: "calc(100% - 32px)" },
          "@media (min-width:1000px)": { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", columnGap: "28px", alignItems: "start", "& > *": { gridColumn: 1, minWidth: 0 },
            "& > [data-doc-sidebar]": { gridColumn: 2, gridRow: "1 / span 400", alignSelf: "stretch" },
            "& > [data-doc-sidebar] > *": { position: "sticky", top: "60px", maxHeight: "calc(100vh - 72px)", overflowY: "auto", overscrollBehavior: "contain" } } } }, blocks(axiomBlocks(relatedCards(page.body))))
      : N("Box", { component: "main", sx: { width: "min(860px, calc(100% - 40px))", mx: "auto", pt: 5, pb: 10, "@media (max-width:480px)": { pt: 3.5, width: "calc(100% - 32px)" } } }, blocks(axiomBlocks(relatedCards(page.body)))),
  ]);
  const spec = docPage ? docSpec() : docsIndex ? docsSpec() : demosIndex ? indexSpec() : N("Box", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary", lineHeight: 1.6 } }, [
    N("LandingTopBar", {}),
    N("Box", { component: "main", sx: { width: "min(760px, calc(100% - 40px))", mx: "auto", pt: 1.5 } }, [
      N("Box", { component: "header", sx: { pt: 3.5, pb: 5 } }, [
        T(page.h1, { fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 800, m: 0, mb: 1.75 }, { component: "h1" }),
        page.lede && T(page.lede, { fontSize: "1.05rem", color: "text.secondary", lineHeight: 1.6, m: 0, mb: 1 }, { component: "p" }),
        ...(page.ledes2 || []).map((l) => T(l, { fontSize: ".9rem", color: "text.secondary", lineHeight: 1.6, m: 0, mb: 1 }, { component: "p" })),
        ...page.mls.map(mlsCard),
      ].filter(Boolean)),
      ...page.sections.map(section),
      page.footer && T(page.footer, { pt: 3.75, pb: 7.5, color: "text.secondary", fontSize: ".85rem", borderTop: 1, borderColor: "divider", mt: 2.5 }, { component: "footer" }),
    ].filter(Boolean)),
  ]);

  // ── theme (page-scoped keys from window.__thisGuiThemeScope; neurons.me, dark by default) + mount ──
  const scope = window.__thisGuiThemeScope || {};
  let mode = "dark"; try { mode = params.get("mode") || localStorage.getItem(scope.themeModeKey) || "dark"; if (params.get("mode")) localStorage.setItem(scope.themeModeKey, mode); } catch (e) {}
  const PageTheme = ({ children }) => h(G.Theme, { initialThemeId: "neurons.me", initialMode: mode }, children);
  const INSPECTOR_ON = params.get("inspector") === "1";
  if (G.getInspectorEnabled() !== INSPECTOR_ON) G.setInspectorEnabled(INSPECTOR_ON);
  // Pages with the fan-out viz attach its live kernel facade (window.FanoutKernel: explain() + self:inspect, answered by a
  // this.me in a Web Worker) so the Inspector's Explain reads real kernel truth for its slices. render/RunMe are left
  // out there so mount() does not wrap that facade in a full runtime (these pages never had one).
  const FK = docPage && window.FanoutKernel && document.querySelector(".fanout-viz") ? window.FanoutKernel : null;
  G.mount(spec, ROOT, {
    ...(FK ? { me: FK } : {}),
    gui: { ...G, ...(FK ? { render: undefined, RunMe: undefined } : {}), Theme: PageTheme, registry: { ...(G.Registry || G.registry), ...(window.LandingLive || {}), LandingTopBar, GlyphCard, DocsCover, MeOrbMark, MeLandingHero, MeCodeBlock, DocCardCover, ModeHtml, ...(window.KernelTimeline ? { KernelTimeline: window.KernelTimeline } : {}), KernelBadge, ...(window.MeRun ? { MeRunBlock: window.MeRun.MeRunBlock } : {}), ...(window.AxiomsLive ? { AxiomProof: window.AxiomsLive.AxiomProof, AxiomKernel: window.AxiomsLive.AxiomKernel } : {}), ...(window.FanoutViz ? { FanoutViz: window.FanoutViz } : {}), ...(window.AudienceVenn ? { AudienceVenn: window.AudienceVenn } : {}), ...(window.SocialGraphLive ? { SocialGraphLive: window.SocialGraphLive } : {}) } },
    devtools: { enabled: true, inspector: INSPECTOR_ON, adminView: false, inspectorToggleVisible: false },
  });
  html.classList.add("gui-on");
  document.querySelectorAll("link[data-static-only]").forEach((l) => { l.disabled = true; });
  if (SYN && SYN.watchTheme) SYN.watchTheme(); // re-measures the code colours whenever .GUI writes a new theme / mode
  SRC.remove();
  }
})();
