[**this.me**](../README.md)

***

[this.me](../README.md) / Memory

# Interface: Memory

Defined in: [types.ts:35](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L35)

Canonical semantic log item in ME.
This mirrors the shape in `me.ts` exactly.

## Properties

### effectiveSecret

> **effectiveSecret**: `string`

Defined in: [types.ts:45](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L45)

computed by ME kernel (fractal secret chaining + noise override)

***

### expression

> **expression**: `any`

Defined in: [types.ts:41](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L41)

expression as provided by the user (pre-eval / pre-resolve).

***

### hash

> **hash**: `string`

Defined in: [types.ts:47](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L47)

portable hash (FNV-1a 32-bit in me.ts)

***

### operator

> **operator**: `string` \| `null`

Defined in: [types.ts:39](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L39)

operator used to produce this memory (null for normal writes)

***

### path

> **path**: `string`

Defined in: [types.ts:37](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L37)

semantic destination path (where the write/claim lands). root is ""

***

### prevHash?

> `optional` **prevHash**: `string`

Defined in: [types.ts:49](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L49)

previous memory hash for chain integrity (genesis = "")

***

### timestamp

> **timestamp**: `number`

Defined in: [types.ts:50](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L50)

***

### value

> **value**: `any`

Defined in: [types.ts:43](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L43)

value that was actually committed at `path` (post-eval / post-collect; may be encrypted)
