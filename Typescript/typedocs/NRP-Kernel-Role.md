# .me Kernel — Role in NRP

The `.me` kernel is the **semantic authority** of the stack.

`me://` addresses, NRP expressions, and Beatle channels are all ways of pointing *toward* meaning. The meaning itself lives in the kernel.

---

## The Stack

```txt
Beatle         — input/control surface (writes NRP expressions)
NRP            — resolves me:// expressions to endpoints
netget         — HTTP/WebSocket gateway
monad          — runtime that owns a kernel instance
.me kernel     — where meaning actually lives
```

Beatle opens a channel. NRP traces the route. `.me` decides what is there.

---

## What the Kernel Owns

| Thing | Where it lives |
|---|---|
| Identity | `me[ME_RESEED](username, password)` → compound seed |
| Memory paths | `me.profile.name`, `me.wallet.hidden.*` |
| Secret scopes | `me.path["_"]("key")` — stealth by default |
| Audience rules | Who can read a path |
| Capabilities | What operations are allowed |
| Hash-chain | Integrity across all writes (A8 axiom) |

---

## Axioms That Affect NRP

**A0/A2 — Stealth**: a secret scope root returns `undefined`, not a "not found" error. The existence of the secret is not revealed. NRP maps this to disclosure level `stealth`.

**A3 — Nested secrets**: secrets inherit scope chain. A path near a secret scope does not accidentally leak.

**A8 — Hash-chain integrity**: every write is chained. NRP can verify freshness without trusting the transport.

**A9 — LWW conflict resolution**: if two monads write the same path concurrently, the last-write-wins rule is deterministic.

---

## Kernel vs Address

```txt
me://jabellae          ← address form (NRP expression)
↓
NRP resolves →         monad running jabellae's kernel
↓
kernel.users.jabellae  ← actual memory location
```

The address `me://jabellae` is not the meaning. It is a pointer that NRP resolves to a kernel path on a specific monad.

---

## Why NRP Does Not Trust the Client

The Beatle client sends `{ raw, canonical, ast }` as hint/intent. The NRP server:

1. Re-parses `canonical` with its own parser.
2. Resolves each leaf namespace against a real kernel instance.
3. Checks audience rules before returning endpoints.
4. Assigns `disclosure` level based on what the kernel reveals.

The kernel is the oracle. The client is a user interface.

---

## See Also

- [Algebra of Contexts](./Algebra-of-Contexts.md)
- [NRP — Namespace Protocol Resolution](../../../neurons-me.github.io/docs/NRP/Namespace-Protocol-Resolution.md)
- [Disclosure Levels](../../../neurons-me.github.io/docs/NRP/Disclosure-Levels.md)
