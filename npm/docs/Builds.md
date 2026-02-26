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
import Me from "this.me";
const me = new Me();
```

### 2) CommonJS (legacy Node)

```js
const Me = require("this.me");
const me = new Me();
```

### 3) Browser with bundler (Vite/Webpack/Rollup)

```ts
import Me from "this.me";
const me = new Me();
```

### 4) Browser without bundler (CDN + UMD)

```html
<script src="https://unpkg.com/this.me/dist/me.umd.js"></script>
<script>
  const me = new Me();
</script>
```

## TypeScript

No extra configuration is required. Types are resolved automatically from:

`dist/index.d.ts`

#### Quick check:

```bash
npm run build
npm pack --json
```
