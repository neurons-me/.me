# me-syntax

A small highlighter for .me code: one script, one stylesheet, no dependencies. It colours the parts of a .me line
(the root `me`, paths, operators such as `["="]`, the derived name, the formula inside it, values, results) with
colours taken from the active .GUI theme, light or dark.

```html
<link rel="stylesheet" href="https://neurons-me.github.io/.me/assets/me-syntax/me-syntax.css">
<script src="https://neurons-me.github.io/.me/assets/me-syntax/me-syntax.js"></script>
<pre class="me-code"><code>me.robots["[i]"]["="]("iceIsFuel", "mines && objects.ice.seen")</code></pre>
<script>MeSyntax.highlightAll(); MeSyntax.watchTheme();</script>
```

Only the colour changes. The text is never rewritten, so copy / paste gives the code exactly as written. Break hints
(`<wbr>`, after `.` and `,`, before `&&` / `||`) carry no text and let long lines wrap without sideways scroll.

## API (`window.MeSyntax`, or `require()` in Node)

| | |
|---|---|
| `tokenize(code)` | `[{ c: classes or null, v: text }]`; joining every `v` gives `code` back |
| `toHTML(code)` | escaped HTML (`& < > " '`) with `<span class="mes-…">` and `<wbr>` |
| `render(h, code)` | React children (for `React.createElement`), no innerHTML |
| `highlight(el)` | highlights one element in place (DOM nodes, no innerHTML) |
| `highlightAll(root?)` | `code.language-me`, `[data-me-code]`, `pre.me-code > code`, `code.me-code` |
| `render / highlight / toHTML(code, opts)` | with `opts.resolve`, code that names an instance becomes a button (see below) |
| `bindRefs(root, onSelect)` / `markSelected(root, selected)` | wire and mark references on pages that are not React |
| `valueClass(v)` | `mes-true` / `mes-false` / `mes-num` / `mes-str` / `mes-null` for a result value |
| `watchTheme()` / `syncTheme()` / `themeColors()` | measure the active theme and write `--me-syn-*` on `<html>` |

## Tokens

| class | what | colour variable |
|---|---|---|
| `mes-root` | `me` | `--me-syn-root` (bold) |
| `mes-key`, `mes-dot` / `mes-punct` | path segments, dots, brackets, commas | `--me-syn-path`, `--me-syn-punct` |
| `mes-index` | `[1]` | `--me-syn-index` |
| `mes-op` | `["[i]"]` `["="]` `["->"]` `["@"]` `["_"]` `["~"]`, one token each | `--me-syn-operator` (bold) |
| `mes-paren` | call parentheses | `--me-syn-punct` |
| `mes-str`, `mes-quote` | strings | `--me-syn-string` |
| `mes-def` | the derived name (first argument of `["="]`) | `--me-syn-derived` (bold italic) |
| `mes-in-fx`, `mes-fx-id`, `mes-fx-op` | the formula string, its names and paths, its `&& \|\| ! == <=` … | `--me-syn-formula-bg`, `--me-syn-formula`, `--me-syn-logic` (bold) |
| `mes-num`, `mes-true`, `mes-false`, `mes-null` | values | `--me-syn-number`, `--me-syn-true`, `--me-syn-false` (bold), `--me-syn-null` |
| `mes-arrow` | `→` `->` `=>` before a result | `--me-syn-arrow` |
| `mes-comment` | `// …` | `--me-syn-comment` (italic) |
| `mes-kw`, `mes-id` | JS keywords, other names | `--me-syn-keyword`, `--me-syn-path` |

## Where the colours come from

One mapping layer, in this order:

1. a theme syntax token, if the theme defines one: `--mui-palette-syntax-<role>` or `--gui-syntax-<role>`;
2. derived from the theme's existing tokens (`primary`, `info`, `success`, `error`, `warning`, `secondary`, `text`):
   `watchTheme()` picks, per role, the first hue that reaches 4.5:1 on the theme's background and paper with the least
   mixing toward the text colour, and that stays distinct from the roles next to it (operator ≠ false, string ≠ true …);
3. without JS, the stylesheet's static mix (the most saturated fixed ratio that passes 4.5:1 in all 8 .GUI themes),
   and plain light / dark colours by `prefers-color-scheme` on pages without .GUI.

## Code → object (references)

Pass a resolver and every path in the code that names an instance becomes a button: a click, Enter or Space calls
`onSelect(id)`, and the instance that is `selected` is marked in every line. The text is not changed (the button is a
wrapper span), so copy / paste still gives the code exactly; a click while text is selected does not select anything.

```js
const opts = {
  resolve: (path, ctx) => /^robots\.(\d+)$/.test(path) ? "robot:" + path.split(".")[1] : null,   // path → id, or null
  ctx: 1,                                    // optional: passed to resolve (e.g. the kernel the line runs in)
  selected: "robot:1",                       // id, ids, or (id) => boolean
  onSelect: (id, event) => select(id),
  title: (id, text) => "select " + text,     // optional tooltip / accessible name
};
MeSyntax.render(React.createElement, 'me.robots[1].home["->"]("rocks.b612")', opts);
```

`resolve` is called with the dotted path up to each segment: `robots`, `robots.1`, `robots.1.home` for
`me.robots[1].home`, the same inside path strings (`"rocks.b612"`) and formulas (`"objects.ice.seen"`). The first prefix
that resolves becomes the button (`robots[1]`), and the chain goes on (`home` can resolve to the rock it points to).
Classes: `mes-ref` (dotted underline, pointer), `mes-ref-on` (selected), focus ring on `:focus-visible`.
