[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorResult

# Type Alias: OperatorResult

> **OperatorResult** = [`Memory`](../interfaces/Memory.md) \| `any` \| `undefined`

Defined in: [types.ts:215](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L215)

Operators in me.ts can yield:
- a Memory (most writes)
- undefined (kernel-only or removals)
- a returned value for root "=" thunk and root "?" query
