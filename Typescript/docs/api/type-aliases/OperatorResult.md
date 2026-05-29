[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorResult

# Type Alias: OperatorResult

> **OperatorResult** = `KernelMemory` \| `any` \| `undefined`

Defined in: [types.ts:391](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L391)

Operators in me.ts can yield:
- a Memory (most writes)
- undefined (kernel-only or removals)
- a returned value for root "=" thunk and root "?" query
