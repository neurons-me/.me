// .GUI (this.gui@4.1.0) for hand-written .me landings. Copy of neurons-me.github.io docs/assets/landing-gui.js
// (the /robots/ and /smart-cities/ landings), kept here so .me pages don't depend on the site repo's paths, plus
// the /.me/Demos/ index layout (kicker, h1, one line, image-left demo cards).
// The page's own static markup (#static-landing) is the single source of text, links and images: this script
// reads it, renders the same content through GUI.mount (registry Card/Box/Typography/Link/Chip + a page-local
// topbar: me:// path, Docs, GitHub, theme picker, light/dark, gear with Inspector + Grid Layout), then removes
// the static copy. Without JS or if the CDN fails, the static page stays as it is.
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

  // ── read the static page ──
  const path = [...SRC.querySelectorAll(".mepath > a, .mepath > .here")].map((e) => ({ text: txt(e), href: e.getAttribute("href"), title: e.getAttribute("title") || txt(e) }));
  const DOCS = "https://neurons-me.github.io/.me/docs/";
  const inline = (el) => [...el.childNodes].map((n) => n.nodeType === 1 && n.tagName === "A" ? N("Link", { href: n.getAttribute("href"), title: n.getAttribute("title") || undefined, underline: "hover", sx: { color: "primary.main" } }, [n.textContent]) : n.textContent);
  const demosIndex = !!SRC.querySelector(".page .grid .card");
  const header = SRC.querySelector("header");
  const page = demosIndex ? {
    path: [...[...SRC.querySelectorAll(".kicker a")].map((a) => ({ text: txt(a), href: a.getAttribute("href"), title: a.getAttribute("title") || txt(a) })),
      { text: [...SRC.querySelector(".kicker").childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim(), href: null }],
    docs: DOCS, github: SRC.querySelector(".topnav a[href*='github.com']")?.getAttribute("href"),
    kicker: inline(SRC.querySelector(".kicker")), h1: txt(SRC.querySelector(".page-title")), subtitle: inline(SRC.querySelector(".page-subtitle")),
    cards: [...SRC.querySelectorAll(".grid > a.card")].map((a) => {
      const img = a.querySelector(".card-icon img"), emoji = a.querySelector(".card-emoji");
      return { href: a.getAttribute("href"), title: txt(a.querySelector(".card-title")), desc: txt(a.querySelector(".card-desc")), path: txt(a.querySelector(".card-path")),
        img: img && { src: img.getAttribute("src"), alt: img.getAttribute("alt") || "" }, emoji: emoji && txt(emoji) };
    }),
  } : {
    path, docs: SRC.querySelector(".topnav .act")?.getAttribute("href"), github: SRC.querySelector(".topnav .gh")?.getAttribute("href"),
    h1: txt(header.querySelector("h1")),
    mls: [...header.querySelectorAll(".mls-card")].map((c) => {
      const t = c.querySelector(".mls-title");
      return { title: txt(t), href: t.getAttribute("href"), desc: txt(c.querySelector(".item-desc")), links: [...c.querySelectorAll(".mls-links a")].map((a) => ({ text: txt(a), href: a.getAttribute("href") })) };
    }),
    sections: [...SRC.querySelectorAll(".wrap > section")].map((s) => {
      const grid = s.querySelector(".links");
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
  function LandingTopBar(p) {
    const seg = (s, i) => [i > 0 && !page.path[i - 1].text.endsWith("://") ? h(Box, { component: "span", key: `sep${i}`, sx: { color: "text.disabled", mx: .15 } }, "/") : null,
      s.href ? h(Link, { key: s.text, href: s.href, underline: "hover", title: s.title, sx: { color: "primary.main", fontFamily: MONO, fontSize: { xs: 12, sm: 13 } } }, s.text)
        : h(Box, { component: "span", key: s.text, "aria-current": "page", sx: { color: "text.primary", fontFamily: MONO, fontSize: { xs: 12, sm: 13 }, fontWeight: 600 } }, s.text)];
    return h(Box, { component: "nav", "aria-label": "me path", "data-gui-node-id": p["data-gui-node-id"], sx: { position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: { xs: .5, sm: 1.25 }, px: { xs: .75, sm: 2.5 }, minHeight: 48, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" } },
      h(Link, { href: "https://neurons-me.github.io/", title: "neurons.me", underline: "none", sx: { display: "inline-flex", lineHeight: 0, flexShrink: 0 } }, h("img", { src: LOGO, alt: "neurons.me", width: 28, height: 28, style: { display: "block", objectFit: "contain" } })),
      h(Box, { sx: { display: "inline-flex", alignItems: "center", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } } }, ...page.path.flatMap(seg)),
      h(Box, { sx: { ml: "auto", display: "inline-flex", alignItems: "center", gap: { xs: .25, sm: 1.25 }, flexShrink: 0 } },
        h(TopSearch),
        page.docs && h(Link, { href: page.docs, underline: "hover", sx: { fontFamily: MONO, fontSize: 12, color: "text.secondary" } }, "Docs"),
        page.github && h(Link, { href: page.github, underline: "none", target: "_blank", rel: "noopener", title: "GitHub · neurons-me/.me", "aria-label": "GitHub", sx: { display: "inline-flex", lineHeight: 0, color: "text.secondary", "&:hover": { color: "text.primary" } } }, h(Ico, { kind: "github", size: 18 })),
        h(Box, { "data-gui-inspector-control": "true", sx: { display: "inline-flex", alignItems: "center", gap: .25 } }, h(ThemePicker), h(ModeToggle), h(SettingsMenu))));
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
    N("Link", { href: m.href, underline: "hover", sx: { fontWeight: 600, fontSize: "1.02rem", color: "text.primary" } }, [m.title]),
    m.desc && desc(m.desc),
    N("Box", { sx: { display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 } }, m.links.map((l) => N("Chip", { label: l.text, component: "a", href: l.href, clickable: true, variant: "outlined", size: "small",
      sx: { fontSize: ".82rem", color: "primary.main", borderColor: "divider", "&:hover": { borderColor: "primary.main" } } }))),
  ].filter(Boolean));
  const gridSx = (kind) => kind === "list" ? { display: "flex", flexDirection: "column", gap: "10px" }
    : { display: "grid", gridTemplateColumns: "1fr", gap: kind === "demo" ? "14px" : "10px", [WIDE]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } };
  const section = (s) => N("Box", { component: "section", sx: { py: 4, borderTop: 1, borderColor: "divider" } }, [
    s.title ? T(s.title, { fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.1, letterSpacing: "-.02em", fontWeight: 800, m: 0, mb: "18px" }, { component: "h2" })
      : T(s.label, { fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".08em", color: "text.secondary", m: 0, mb: "18px" }, { component: "p" }),
    N("Box", { sx: gridSx(s.kind) }, s.items.map(s.kind === "demo" ? demoCard : docCard(s.kind))),
  ]);
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
  const indexSpec = () => N("Box", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary" } }, [
    N("LandingTopBar", {}),
    N("Box", { component: "main", sx: { maxWidth: 960, mx: "auto", px: 4, pt: 6, pb: 10, "@media (max-width:480px)": { px: 2.5, pt: 4 } } }, [
      T(page.kicker, { fontSize: ".75rem", fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: "text.secondary", mb: 1.5 }, { component: "p" }),
      T(page.h1, { fontSize: "2.75rem", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, mb: 1.5 }, { component: "h1" }),
      T(page.subtitle, { fontSize: "1.05rem", color: "text.secondary", mb: 6, maxWidth: 560 }, { component: "p" }),
      N("Box", { sx: { display: "grid", gridTemplateColumns: "1fr", gap: 2, "@media (min-width:720px)": { gridTemplateColumns: "1fr 1fr" } } }, page.cards.map(indexCard)),
    ]),
  ]);
  const spec = demosIndex ? indexSpec() : N("Box", { sx: { minHeight: "100vh", bgcolor: "background.default", color: "text.primary", lineHeight: 1.6 } }, [
    N("LandingTopBar", {}),
    N("Box", { component: "main", sx: { width: "min(760px, calc(100% - 40px))", mx: "auto", pt: 1.5 } }, [
      N("Box", { component: "header", sx: { pt: 3.5, pb: 5 } }, [
        T(page.h1, { fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 800, m: 0, mb: 1.75 }, { component: "h1" }),
        ...page.mls.map(mlsCard),
      ]),
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
  G.mount(spec, ROOT, {
    gui: { ...G, Theme: PageTheme, registry: { ...(G.Registry || G.registry), LandingTopBar } },
    devtools: { enabled: true, inspector: INSPECTOR_ON, adminView: false, inspectorToggleVisible: false },
  });
  html.classList.add("gui-on");
  SRC.remove();
  }
})();
