---
layout: readme
title: Rust .me CLI
image: https://neurons-me.github.io/docs/assets/img/me.png
---

# CLI

The `me` binary is a small local tool for exercising the Rust kernel.

Run without state for an ephemeral kernel:

```bash
cargo run -- write profile.name '"Jabellae"'
```

Run with a JSON snapshot file:

```bash
cargo run -- --state /tmp/me-state.json write profile.name '"Jabellae"'
cargo run -- --state /tmp/me-state.json read profile.name
cargo run -- --state /tmp/me-state.json snapshot
```

Execute canonical `me://` targets:

```bash
cargo run -- --state /tmp/me-state.json exec me://self:write/wallet.income 1000
cargo run -- --state /tmp/me-state.json exec me://self:read/wallet.income
cargo run -- --state /tmp/me-state.json exec me://kernel:read/events
```

Inspect and explain:

```bash
cargo run -- --state /tmp/me-state.json inspect profile
cargo run -- --state /tmp/me-state.json explain wallet.total
```

Produce a branch-scoped proof:

```bash
cargo run -- --who jabellae --secret 'correct horse battery staple' prove local.netget '{"nonce":"n-1"}'
```

Equivalent seed mode:

```bash
cargo run -- --seed '<seed>' --expression jabellae prove local.netget '{"nonce":"n-1"}'
```

Bind an expression with `about`:

```bash
cargo run -- --who jabellae --secret 'correct horse battery staple' about 'x > 10'
cargo run -- --who jabellae --secret 'correct horse battery staple' about 'x > 10' prove local.netget '{"nonce":"n-1"}'
```

`about <expression>` by itself prints the active context. With another command
after it, `about` applies that expression to the command. Expressions containing
shell operators such as `>` must be quoted.

The CLI is backed by `KernelRuntime`, so the command path exercises the same
load/execute/save lifecycle that embedders use.
