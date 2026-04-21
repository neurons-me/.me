# Secrets

In `.me`, secrets are structural, not global toggles.

When you declare a secret scope with `["_"]`, everything below that path moves into an encrypted universe.

## Core Behavior

```ts
import ME from "this.me";
const me = new ME();

me.wallet["_"]("vault-key-2026");
me.wallet.balance(500);
me.wallet.note("Private savings");
```

Expected behavior:

```txt
me("wallet")          -> undefined   // stealth root
me("wallet.balance")  -> 500
me("wallet.note")     -> "Private savings"
```

## Why Root Is Hidden

The scope root is intentionally stealth:

- prevents easy enumeration
- reduces metadata leakage
- enforces path-based access semantics

You can read known paths, but listing the private subtree by reading the root is blocked.

## Nested Secret Universes

Secrets can be nested without breaking parent semantics.

```ts
me.wallet["_"]("KEY-A");
me.wallet.hidden["_"]("KEY-B");
me.wallet.hidden.seed("deep-secret");
```

Expected behavior:

```txt
me("wallet")              -> undefined
me("wallet.hidden")       -> undefined
me("wallet.hidden.seed")  -> "deep-secret"
```

## Noise Reset (`~`) and Secret Lineage

Noise creates a new derivation root for effective secret chaining:

```ts
me.wallet["_"]("alpha");
me.wallet.hidden.note("alpha-note");

me.wallet["~"]("beta-noise");
me.wallet.hidden.seed("beta-seed");
```

Expected behavior:

```txt
me("wallet.hidden.note") -> "alpha-note"
me("wallet.hidden.seed") -> "beta-seed"
```

Internally, the cryptographic lineage for post-noise writes diverges from pre-noise lineage.

## Pointers Into Secret Scopes

Pointers remain structural and can traverse into secret leaves:

```ts
me.wallet["_"]("secret");
me.wallet.balance(1000);
me.profile.card["->"]("wallet");
```

Expected behavior:

```txt
me("profile.card")         -> { __ptr: "wallet" }
me("profile.card.balance") -> 1000
me("wallet")               -> undefined
```

## Explainability With Stealth Masking

`explain(path)` stays auditable without leaking secret inputs:

```ts
me.secure["_"]("k");
me.secure.rate(3);
me.pub.base(10);
me.pub["="]("score", "base * secure.rate");

const trace = me.explain("pub.score");
console.log(trace.derivation?.inputs);
```

Expected shape:

```txt
[
  { path: "pub.base", origin: "public",  masked: false, value: 10 },
  { path: "secure.rate", origin: "stealth", masked: true, value: "●●●●" }
]
```

## Export / Replay / Snapshot

Secret scopes remain compatible with state portability:

- `inspect()` shows public index + scope metadata
- `exportSnapshot()` includes encrypted branch storage
- `hydrate()` restores encrypted state deterministically

## Practical Rulebook

- Use `["_"]` to define private universes at exact path boundaries.
- Keep roots stealth by design (`me("scope") -> undefined`).
- Resolve private data by explicit path (`me("scope.leaf")`).
- Use `~` when you need a new secret/noise lineage branch.
- Use `explain()` for auditable derivations with masked secret inputs.
