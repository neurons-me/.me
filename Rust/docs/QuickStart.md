# Quick Start

Install the crate:

```bash
cargo add this-me
```

Create a kernel and write semantic memory:

```rust
use this_me::kernel::{Kernel, Value};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut me = Kernel::new();

    me.postulate("profile.name", "Jabellae")?;
    me.postulate("wallet.income", 100_u64)?;
    me.postulate("wallet.expenses", 40_u64)?;
    me.derive("", "wallet.total", "wallet.income - wallet.expenses")?;

    assert_eq!(me.read("wallet.total"), Some(&Value::from(60_u64)));
    Ok(())
}
```

Run the local repository gate:

```bash
cargo fmt --check
cargo check
cargo test
cargo clippy --all-targets --all-features -- -D warnings
```

The important distinction:

- `Kernel` is the semantic core.
- `KernelRuntime` is the host wrapper for loading, saving, executing, and
  returning events.
- `JsonFileStore` is the current file-backed snapshot store.

For HTTP/WS hosts, start with [Runtime Host](RuntimeHost.html), not raw `Kernel`.
