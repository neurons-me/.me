# this-me

Rust implementation ground for the `.me` semantic kernel.

The crate exposes a hash-chained semantic memory core, `.me` operators, path
selectors, derivations, secret/noise scopes, key wrapping, identity proofs,
snapshots, runtime events, and a host wrapper for embedding.

## Main Modules

- [`kernel`] - semantic memory, operators, values, paths, proofs, key wrapping,
  and `me://` execution.
- [`runtime`] - `KernelRuntime`, write-through persistence, receipts, and
  host-facing event output.
- [`storage`] - `MemoryStore` and `JsonFileStore`.
- [`me_uri`] - canonical `.me` URI parsing and DNS projection helpers.

## Basic Kernel

```rust
use this_me::kernel::{Kernel, Value};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut me = Kernel::new();

    me.postulate("wallet.income", 100_u64)?;
    me.postulate("wallet.expenses", 40_u64)?;
    me.derive("", "wallet.total", "wallet.income - wallet.expenses")?;

    assert_eq!(me.read("wallet.total"), Some(&Value::from(60_u64)));
    Ok(())
}
```

## Runtime Host

```rust,no_run
use this_me::runtime::{runtime_receipt_to_json, KernelRuntime};
use this_me::storage::JsonFileStore;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let store = JsonFileStore::new("/tmp/me-state.json");
    let mut runtime = KernelRuntime::load(store)?;

    let receipt = runtime.write_with_receipt(
        "apps.fulltrailer.home.count",
        3_u64,
    )?;

    println!("{}", runtime_receipt_to_json(&receipt));
    Ok(())
}
```

## Documentation

Manual Rust implementation docs live in the repository under `Rust/docs/`.
The generated API reference is built by rustdoc and published by docs.rs.
