# Build Compatibility Tests

These tests verify that published artifacts work across module systems.

## Files

| File | Target |
|---|---|
| `tests/Builds/cjs.test.cjs` | CommonJS runtime |
| `tests/Builds/esm.test.mjs` | ES Module runtime |
| `tests/Builds/umd.test.cjs` | UMD/global runtime |
| `tests/Builds/umd.html` | Manual browser UMD smoke page |
| `tests/Builds/ts.test.ts` | Type-level import usage check |

## What They Validate

- `new ME()` remains callable as proxy function.
- basic semantic write/read works after build.
- exports are correctly wired in each module format.
- UMD global export exists and is executable in a sandbox.
- helper statics remain attached to the runtime export across ESM, CJS, and UMD.

## Run

```bash
node tests/Builds/cjs.test.cjs
node tests/Builds/esm.test.mjs
node tests/Builds/umd.test.cjs
```

or via gate:

```bash
npm run test:prebuild
```

Current expected export shape:

- ESM: default export is the `ME` constructor
- CommonJS: `require("this.me")` returns the `ME` constructor directly
- UMD: global `Me` is the constructor
- helper statics such as `createMe`, `write`, `define`, and `subscribe` are attached to that constructor object

## Release Relevance

These tests protect the npm consumer surface:

- `import` consumers (modern tooling),
- `require` consumers (legacy Node),
- browser consumers (UMD script usage).
