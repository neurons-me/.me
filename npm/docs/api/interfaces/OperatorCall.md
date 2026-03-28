[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorCall

# Interface: OperatorCall

Defined in: [types.ts:78](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L78)

What ME routing produces when a Proxy chain is invoked.

## Properties

### expression

> **expression**: `any`

Defined in: [types.ts:88](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L88)

The normalized expression passed into postulate.
- 0 args -> undefined
- 1 arg  -> that arg
- 2+ args -> packed array

***

### isRoot

> **isRoot**: `boolean`

Defined in: [types.ts:94](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L94)

When called at root path.length===0 and expression is a string that looks like a path,
ME biases to GET. Operators should not override that routing.

***

### path

> **path**: [`SemanticPath`](../type-aliases/SemanticPath.md)

Defined in: [types.ts:80](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L80)

Raw path array for the call site, including operator leaf if present.
