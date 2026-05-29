## Module Formats and Runtime Targets

`this.me` is built from a single source entry: `index.ts`.

Published outputs:

- ESM (`import`) -> `dist/me.es.js`
- CommonJS (`require`) -> `dist/me.cjs`
- UMD (`<script>`) -> `dist/me.umd.js`
- TypeScript declarations -> `dist/index.d.ts`

`package.json` routes them through conditional exports:

- `import` -> `./dist/me.es.js`
- `require` -> `./dist/me.cjs`
- `browser` -> `./dist/me.es.js`
- `types` -> `./dist/index.d.ts`

## Usage by Environment

### 1) Node.js / Bundlers (recommended)

```ts
import ME from "this.me";
const me = new ME();
const db = ME.createMe();
```

### 2) CommonJS (legacy Node)

```js
const ME = require("this.me");
const me = new ME();
const db = ME.createMe();
```

In CommonJS, `require("this.me")` returns the constructor directly. Any runtime helpers exposed by the package are attached as static properties on that same function export.

### 3) Browser with bundler (Vite/Webpack/Rollup)

```ts
import ME from "this.me";
const me = new ME();
```

### 4) Browser without bundler (CDN + UMD)

The UMD global is still `Me`.

```html
<script src="https://unpkg.com/this.me/dist/me.umd.js"></script>
<script>
  const me = new Me();
  const db = Me.createMe();
</script>
```

The UMD global is the constructor itself (`Me`), with the same helper statics attached.

## TypeScript

No extra configuration is required. Types are resolved automatically from:

`dist/index.d.ts`

## Compatibility Gate

The release gate validates all published artifact shapes before publish:

```bash
node tests/Builds/cjs.test.cjs
node tests/Builds/esm.test.mjs
node tests/Builds/umd.test.cjs
node tests/pre-build.test.mjs
```

#### Quick check:

```bash
npm run build
npm pack --json
```
