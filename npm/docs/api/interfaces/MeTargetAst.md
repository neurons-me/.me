[**this.me**](../README.md)

***

[this.me](../README.md) / MeTargetAst

# Interface: MeTargetAst

Defined in: [types.ts:125](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L125)

## Properties

### scheme

> **scheme**: `"me"`

Defined in: [types.ts:126](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L126)

***

### namespace

> **namespace**: `string`

Defined in: [types.ts:127](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L127)

***

### operation

> **operation**: `string`

Defined in: [types.ts:128](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L128)

***

### path

> **path**: `string`

Defined in: [types.ts:129](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L129)

***

### raw?

> `optional` **raw**: `string`

Defined in: [types.ts:130](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L130)

***

### contextRaw?

> `optional` **contextRaw**: `string` \| `null`

Defined in: [types.ts:135](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L135)

Optional raw context segment preserved for higher layers such as cleaker
and monad.ai. The `.me` kernel does not interpret transport context.
