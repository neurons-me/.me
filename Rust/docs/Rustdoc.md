# rustdoc and docs.rs

Rust documentation has two layers:

1. manual Markdown files in `Rust/docs/`,
2. generated API reference from `rustdoc`.

`docs.rs` builds the second layer.

It does not automatically publish every Markdown file in `Rust/docs/`. It builds
the crate and renders documentation from:

- crate-level docs,
- module docs,
- public item doc comments,
- explicitly included Markdown.

This crate wires its docs.rs front page through `src/lib.rs`:

```rust
#![doc = include_str!("../docs/API.md")]
```

That file is [`API.md`](API.md).

To preview locally:

```bash
cargo doc --no-deps --open
```

The generated HTML lives under:

```txt
target/doc/this_me/
```

The public API reference for the published crate lives at:

```txt
https://docs.rs/this-me
```
