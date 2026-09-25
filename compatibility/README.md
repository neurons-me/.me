# One .me, two implementations

TypeScript is the semantic reference. Rust is the compatible kernel implementation
where internals can be optimized. Optimizations must preserve observable contracts;
being Rust does not by itself establish a performance improvement.

## Version counter

- Package versions are independent (`this.me` and `this-me`). Subtracting 0.3.3
  from 4.0.1 does not measure compatibility.
- `contractRevision` counts reviewed revisions of this contract inventory.
- `reference.version` and `reference.sourceSha256` pin the TypeScript reference.
  The hash covers index.ts, package.json and all src files, including uncommitted
  changes. It identifies an exact working-tree baseline, not a release certification.
- Open contracts are counted from `partial` and `pending` entries. This is an
  explicit, evolving inventory, not a claim that every TypeScript feature is listed.
- `contract-covered` means the listed scope has tests. It is not blanket semantic
  equivalence. `--test` executes the evidence; plain status does not.

From the me repository root (Node 24 with native TypeScript stripping):

```sh
node compatibility/check.mjs
node compatibility/check.mjs --check
node compatibility/check.mjs --test
```

`--check` fails if the TypeScript source or package version differs from the audited
baseline. Missing tests, duplicate contracts and invalid statuses also fail.
Known pending contracts remain visible but do not make that baseline check fail.

When TypeScript changes, inspect the diff, extend contracts and tests, increment
`contractRevision`, and update the reference fingerprint only after review:

```sh
node compatibility/check.mjs --fingerprint
node compatibility/generate-v4-vectors.ts
node compatibility/check.mjs --test
```

Record the printed fingerprint in parity.json. Do not automatically accept source
drift in CI. The fixture generator reads TypeScript crypto.ts directly, not dist.
The v4 fixtures contain public, deterministic test secrets only.

## Current port boundary

The v4 KDF is now ported, with source-generated cross-language vectors. Rust's
Kernel still uses its existing v3 encryption. Identity-root lifecycle, v4 blob
codec, scope integration and snapshot migration are NOT enabled by this change.
Do not treat a successful KDF test as support for importing v4 identity snapshots.

Port order: blob codec → root lifecycle → scopes/cache → snapshot migration →
monad host integration. For each step, add TypeScript-generated positive and
negative fixtures before claiming compatibility. Audience composition not proven
in TypeScript must not be invented in Rust as if it were reference behavior.
