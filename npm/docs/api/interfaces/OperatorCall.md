[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorCall

# Interface: OperatorCall

Defined in: [types.ts:254](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L254)

What ME routing produces when a Proxy chain is invoked.

## Properties

### path

> **path**: [`SemanticPath`](../type-aliases/SemanticPath.md)

Defined in: [types.ts:256](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L256)

Raw path array for the call site, including operator leaf if present.

***

### expression

> **expression**: `any`

Defined in: [types.ts:264](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L264)

The normalized expression passed into postulate.
- 0 args -> undefined
- 1 arg  -> that arg
- 2+ args -> packed array

***

### isRoot

> **isRoot**: `boolean`

Defined in: [types.ts:270](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L270)

When called at root path.length===0 and expression is a string that looks like a path,
ME biases to GET. Operators should not override that routing.
