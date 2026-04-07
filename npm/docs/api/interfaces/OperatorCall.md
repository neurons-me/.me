[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorCall

# Interface: OperatorCall

Defined in: [types.ts:156](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L156)

What ME routing produces when a Proxy chain is invoked.

## Properties

### expression

> **expression**: `any`

Defined in: [types.ts:166](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L166)

The normalized expression passed into postulate.
- 0 args -> undefined
- 1 arg  -> that arg
- 2+ args -> packed array

***

### isRoot

> **isRoot**: `boolean`

Defined in: [types.ts:172](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L172)

When called at root path.length===0 and expression is a string that looks like a path,
ME biases to GET. Operators should not override that routing.

***

### path

> **path**: [`SemanticPath`](../type-aliases/SemanticPath.md)

Defined in: [types.ts:158](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L158)

Raw path array for the call site, including operator leaf if present.
