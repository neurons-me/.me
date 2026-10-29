# .me grammar for language models (this.me 4.2.x)

Taken from [docs/Operators.md](../docs/Operators.md) and [docs/Syntax.md](../docs/Syntax.md). A model never writes code; it writes a list of **ops** (see `ops.schema.json`). Each op maps to exactly one kernel call.

## Paths
- A path is dot-separated segments: `user.name`, `shop.items[1].price`, `tienda.articulos.2.precio`.
- A segment is a name (letters in any language, digits, `_`, `-`; must not start with a digit or an operator symbol) optionally followed by `[n]` (fixed index) or `[i]` (broadcast, only in a `define` path). A bare number is also a valid index segment.
- Operator symbols `_ ~ @ __ -> = ? -` are never path segments; they are op types.
- Reuse existing paths from the given state/schema instead of inventing new ones.

## Ops
| op | fields | kernel call | operator |
|---|---|---|---|
| `set` | `path`, `value` (JSON) | `me.a.b(value)` | write |
| `define` | `path`, `name`, `expr` | `me.a["="](name, expr)` | `=` derivation |
| `pointer` | `path`, `target` | `me.a["->"](target)` | `->` / `__` |
| `remove` | `path`, `key` | `me.a["-"](key)` | `-` tombstone |
| `secret` | `path` | `me.a["_"](<key typed by the user>)` | `_` secret scope |
| `noise` | `path` | `me.a["~"](<seed typed by the user>)` | `~` noise reset |
| `identity` | `handle` | `me["@"](handle)` | `@` identity |
| `query` | `paths` | read only | `?` query |

## Rules
- `define.expr` uses names relative to `path` (siblings) or absolute dotted paths, numbers, `+ - * / % ( )` and comparisons. Example: path `order`, name `total`, expr `subtotal + tax`.
- **Secret values are never written by the model.** `secret` and `noise` have no key field; the user types the key at apply time. Values written *under* a secret path (e.g. `wallet.balance`) are normal `set` ops.
- `secret`, `noise`, `identity` and `remove` always require user confirmation before apply.
- Amounts are numbers (`300`, not `"300"`). Names of people are strings.
