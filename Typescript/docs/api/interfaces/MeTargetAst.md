[**this.me**](../README.md)

***

[this.me](../README.md) / MeTargetAst

# Interface: MeTargetAst

Defined in: [types.ts:223](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L223)

## Properties

### scheme

> **scheme**: `"me"`

Defined in: [types.ts:224](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L224)

***

### namespace

> **namespace**: `string`

Defined in: [types.ts:225](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L225)

***

### operation

> **operation**: `string`

Defined in: [types.ts:226](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L226)

***

### path

> **path**: `string`

Defined in: [types.ts:227](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L227)

***

### raw?

> `optional` **raw?**: `string`

Defined in: [types.ts:228](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L228)

***

### contextRaw?

> `optional` **contextRaw?**: `string` \| `null`

Defined in: [types.ts:233](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L233)

Optional raw context segment preserved for higher layers such as cleaker
and monad.ai. The `.me` kernel does not interpret transport context.
