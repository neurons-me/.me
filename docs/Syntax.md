# `me://` URI Scheme — Grammar Specification

**neurons.me / suiGn** **Status:** Draft v0.1 **License:** CC0 1.0 Universal — Public Domain

------

## 1. Primitives

```abnf
me-uri     = "me://" namespace [ selector ] [ "/" path ]

namespace  = handle "." space
handle     = 1*( ALPHA / DIGIT / "-" / "_" )
             ; handles MUST NOT contain "."
             ; "." is reserved as a structural operator
space      = label *( "." label )
label      = 1*( ALPHA / DIGIT / "-" )

selector   = "[" selector-value "]"
selector-value = ""                        ; explicit fanout
             / "current"                   ; local surface only
             / "surface:" surface-name     ; named surface
             / "claim:" claim-token        ; pairing handshake
surface-name = 1*( ALPHA / DIGIT / "-" / "_" )
claim-token  = 1*( ALPHA / DIGIT / "-" / "_" )

path       = segment *( "." segment )
segment    = 1*( ALPHA / DIGIT / "-" / "_" )
```

------

## 2. The `.` Operator

`.` is not a character. It is a structural operator with exactly one meaning:

> **descend into the next level**

This rule applies uniformly across the entire system:

| Context   | Example                  | Meaning             |
| --------- | ------------------------ | ------------------- |
| Space     | `neurons.me`             | root space          |
| Sub-space | `dev.neurons.me`         | refinement of space |
| Namespace | `suign.neurons.me`       | handle inside space |
| Path      | `profile.name`           | descent into tree   |
| Deep path | `wallet.primary.balance` | chained descent     |

Because `.` has exactly one meaning, the parser is deterministic. No regex heuristics, no edge cases.

**Handles must not contain `.`** — this is not a validation rule, it is a semantic invariant. Allowing `.` in handles would make the system interpretive rather than structural.

------

## 3. Identity vs Transport

These are not the same thing, even when they share the same string.

| Scheme     | Domain            | Parsed as         |
| ---------- | ----------------- | ----------------- |
| `me://`    | semantic parsing  | namespace grammar |
| `https://` | transport parsing | DNS / HTTP host   |

**Rule:** `me://` defines meaning. `https://` only reaches it.

```
me://suign.neurons.me[macbook]/profile.name
     ─────────────────────────
     semantic identity namespace
     parsed by me:// grammar

https://suign.neurons.me/profile.name
        ─────────────────
        DNS host
        parsed by HTTP/DNS
        may project to me:// via resolver — but is not me:// by itself
```

DNS never shapes identity directly. Only explicit resolver rules may project a DNS host into a namespace.

------

## 4. Namespace vs Surface vs Host

These three terms are distinct and must not be conflated:

| Term          | Definition                                   | Example                     |
| ------------- | -------------------------------------------- | --------------------------- |
| **space**     | root semantic world                          | `neurons.me`                |
| **namespace** | derived identity space                       | `suign.neurons.me`          |
| **surface**   | runtime execution context within a namespace | `[macbook]`, `[iphone]`     |
| **host**      | HTTP/DNS transport address                   | `suign.neurons.me` (as DNS) |

A surface is not a namespace. An iPhone, a MacBook, and a server process are all surfaces of the same namespace — not separate namespaces.

------

## 5. Resolver Rules for DNS → Namespace Projection

| Input                        | Projection rule                                              |
| ---------------------------- | ------------------------------------------------------------ |
| `me://suign.neurons.me`      | canonical — always semantic namespace                        |
| `https://suign.neurons.me`   | transport host; resolver may project to `suign.neurons.me` namespace |
| `https://foo.bar.neurons.me` | not auto-projected as username; treated as raw namespace string or rejected |
| `hostname.local`             | surface-local transport; no semantic namespace auto-inferred |
| `localhost`                  | loopback transport alias only; not a semantic namespace      |

**Single-label projection rule:** exactly one extra label over a known root space = user namespace projection is permitted.

```
suign.neurons.me    →  handle=suign, space=neurons.me  ✓
foo.bar.neurons.me  →  NOT handle=foo.bar — reject or treat as raw namespace
```

Multi-label subdomains are either a raw namespace string or invalid unless explicitly declared projectable.

------

## 6. Human Layer vs System Layer

The system supports two surface forms for the same identity:

```
Human layer:    suign@neurons.me          (familiar, email-like)
Semantic layer: me://suign.neurons.me     (canonical)
Web surface:    https://suign.neurons.me  (transport ingress only)
```

`suign@neurons.me` resolves to `suign.neurons.me` as a canonical step, not a parsing rule.

`@` = human-friendly binding operator `.` = system-level structural operator

Both coexist. Neither overrides the other.

------

## 7. Canonical Examples

```
me://suign.neurons.me/profile.name
me://suign.neurons.me[macbook]/wallet.primary.balance
me://suign.neurons.me[surface:iphone]/runtime.battery
me://suign.neurons.me[current]/session.active
me://suign.neurons.me[]/chat.general
me://suign.neurons.me[claim:xyz123]/new-surface
```

------

## 8. Invalid Forms

```
me://john.dev.neurons.me     ; ambiguous if john.dev could be a handle
                             ; INVALID — handles must not contain "."
me://suign@neurons.me        ; @ is human layer only, not me:// grammar
me://localhost/profile       ; localhost is transport, not namespace
                             ; INVALID as canonical me:// identity
```

------

## 9. The Invariant

> A symbol must fulfill its meaning by definition.

`.` means descent. Always. At every level. In every context.

This is not enforced by validation logic. It is enforced by the grammar itself. A system where symbols cannot lie does not need rules to be consistent — consistency is structural.

------

**∴ suiGn / neurons.me — Draft v0.1**