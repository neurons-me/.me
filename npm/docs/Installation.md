# Installation

Get started with `.me` in seconds.

### Quick Install

```bash
npm install this.me
```

### Basic Usage

```ts
import ME from "this.me";

const me = new ME();

me["@"]("jabellae");

me.profile.name("Jose Abella");
me.profile.bio("Building the semantic web.");

console.log(me("profile.name")); // "Jose Abella"
```

## Supported Environments

.me works out of the box in:

- **Node.js** (v18+ recommended)
- Modern bundlers (Vite, Webpack, Rollup, esbuild)
- Browsers (via bundler or UMD)
- TypeScript (full types included)

## Installation Methods

### 1. npm (Recommended)

```bash
npm install this.me
```

### 2. yarn / pnpm

```Bash
yarn add this.me
# or
pnpm add this.me
```

### 3. CDN (UMD) – For quick prototyping

```html
<script src="https://unpkg.com/this.me@latest/dist/me.umd.js"></script>
<script>
  const me = new Me();
</script>
```

> **Note**: The CDN is convenient for demos and experiments, but we recommend using a bundler for production applications.

## Next Steps

- [Runtime Surface](./Runtime-Surface)
- [Operators](./Operators)
- [Quick Start](./QuickStart)

**MIT License** © 2025 [neurons.me](https://neurons.me)
