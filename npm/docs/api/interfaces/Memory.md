[**this.me**](../README.md)

***

[this.me](../README.md) / Memory

# Interface: Memory

Defined in: [types.ts:35](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L35)

Public semantic log item exposed by `.me` surfaces such as inspect(),
`me.memories`, and exported snapshots.

## Properties

### path

> **path**: `string`

Defined in: [types.ts:37](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L37)

semantic destination path (where the write/claim lands). root is ""

***

### operator

> **operator**: `string` \| `null`

Defined in: [types.ts:39](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L39)

operator used to produce this memory (null for normal writes)

***

### expression?

> `optional` **expression**: `any`

Defined in: [types.ts:41](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L41)

expression as provided by the user (pre-eval / pre-resolve).

***

### value

> **value**: `any`

Defined in: [types.ts:43](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L43)

value that was actually committed at `path` (post-eval / post-collect; may be encrypted)

***

### hash

> **hash**: `string`

Defined in: [types.ts:45](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L45)

portable hash (FNV-1a 32-bit in me.ts)

***

### prevHash?

> `optional` **prevHash**: `string`

Defined in: [types.ts:47](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L47)

previous memory hash for chain integrity (genesis = "")

***

### timestamp

> **timestamp**: `number`

Defined in: [types.ts:48](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L48)
