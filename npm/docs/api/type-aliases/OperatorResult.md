[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorResult

# Type Alias: OperatorResult

> **OperatorResult** = `KernelMemory` \| `any` \| `undefined`

Defined in: [types.ts:293](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L293)

Operators in me.ts can yield:
- a Memory (most writes)
- undefined (kernel-only or removals)
- a returned value for root "=" thunk and root "?" query
