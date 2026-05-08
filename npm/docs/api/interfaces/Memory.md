[**this.me**](../README.md)

***

[this.me](../README.md) / Memory

# Interface: Memory

Defined in: [types.ts:37](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L37)

Public semantic log item exposed by `.me` surfaces such as inspect(),
`me.memories`, and exported snapshots.

## Properties

### path

> **path**: `string`

Defined in: [types.ts:39](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L39)

semantic destination path (where the write/claim lands). root is ""

***

### operator

> **operator**: `string` \| `null`

Defined in: [types.ts:41](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L41)

operator used to produce this memory (null for normal writes)

***

### expression?

> `optional` **expression?**: `any`

Defined in: [types.ts:43](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L43)

expression as provided by the user (pre-eval / pre-resolve).

***

### value

> **value**: `any`

Defined in: [types.ts:45](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L45)

value that was actually committed at `path` (post-eval / post-collect; may be encrypted)

***

### hash

> **hash**: `string`

Defined in: [types.ts:47](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L47)

portable hash (FNV-1a 32-bit in me.ts)

***

### prevHash?

> `optional` **prevHash?**: `string`

Defined in: [types.ts:49](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L49)

previous memory hash for chain integrity (genesis = "")

***

### timestamp

> **timestamp**: `number`

Defined in: [types.ts:50](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L50)
