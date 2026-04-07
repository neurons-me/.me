[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorResult

# Type Alias: OperatorResult

> **OperatorResult** = `KernelMemory` \| `any` \| `undefined`

Defined in: [types.ts:293](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L293)

Operators in me.ts can yield:
- a Memory (most writes)
- undefined (kernel-only or removals)
- a returned value for root "=" thunk and root "?" query
