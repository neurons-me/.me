# .me Rust

Clean Rust boilerplate for the `.me` kernel.

No external runtime dependencies yet.

```bash
cargo fmt --check
cargo check
cargo test
cargo clippy --all-targets --all-features -- -D warnings
```

Run the first O(k) recompute benchmark:

```bash
cargo run --release --bin bench-ok
```

Run the sustained mutation benchmark:

```bash
cargo run --release --bin bench-sustained
```
