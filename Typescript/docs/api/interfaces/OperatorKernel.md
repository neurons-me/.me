[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorKernel

# Interface: OperatorKernel

Defined in: [types.ts:315](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L315)

A minimal “kernel facade” for operator modules.
These are *capabilities* the ME kernel must expose so ops can behave exactly like me.ts.

## Properties

### operators?

> `optional` **operators?**: [`OperatorRegistry`](../type-aliases/OperatorRegistry.md)

Defined in: [types.ts:318](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L318)

***

### localSecrets?

> `optional` **localSecrets?**: `Record`\<`string`, `string`\>

Defined in: [types.ts:324](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L324)

***

### localNoises?

> `optional` **localNoises?**: `Record`\<`string`, `string`\>

Defined in: [types.ts:325](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L325)

***

### encryptedBranches?

> `optional` **encryptedBranches?**: `EncryptedBranchPlane`

Defined in: [types.ts:326](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L326)

***

### memories?

> `optional` **memories?**: `KernelMemory`[]

Defined in: [types.ts:329](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L329)

## Methods

### opKind()

> **opKind**(`op`): [`OperatorKind`](../type-aliases/OperatorKind.md) \| `null`

Defined in: [types.ts:317](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L317)

#### Parameters

##### op

`string`

#### Returns

[`OperatorKind`](../type-aliases/OperatorKind.md) \| `null`

***

### splitPath()

> **splitPath**(`path`): `object`

Defined in: [types.ts:321](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L321)

#### Parameters

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`object`

##### scope

> **scope**: [`SemanticPath`](../type-aliases/SemanticPath.md)

##### leaf

> **leaf**: `string` \| `null`

***

### rebuildIndex()

> **rebuildIndex**(): `void`

Defined in: [types.ts:330](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L330)

#### Returns

`void`

***

### computeEffectiveSecret()

> **computeEffectiveSecret**(`path`): `string`

Defined in: [types.ts:333](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L333)

#### Parameters

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`string`

***

### xorEncrypt()

> **xorEncrypt**(`value`, `secret`, `path`): `string`

Defined in: [types.ts:334](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L334)

#### Parameters

##### value

`any`

##### secret

`string`

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`string`

***

### xorDecrypt()

> **xorDecrypt**(`blob`, `secret`, `path`): `any`

Defined in: [types.ts:335](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L335)

#### Parameters

##### blob

`string`

##### secret

`string`

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`any`

***

### isEncryptedBlob()

> **isEncryptedBlob**(`v`): `v is string`

Defined in: [types.ts:336](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L336)

#### Parameters

##### v

`any`

#### Returns

`v is string`

***

### makePointer()

> **makePointer**(`targetPath`): `MePointer`

Defined in: [types.ts:339](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L339)

#### Parameters

##### targetPath

`string`

#### Returns

`MePointer`

***

### isPointer()

> **isPointer**(`v`): `v is MePointer`

Defined in: [types.ts:340](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L340)

#### Parameters

##### v

`any`

#### Returns

`v is MePointer`

***

### makeIdentityRef()

> **makeIdentityRef**(`id`): `MeIdentityRef`

Defined in: [types.ts:342](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L342)

#### Parameters

##### id

`string`

#### Returns

`MeIdentityRef`

***

### isIdentityRef()

> **isIdentityRef**(`v`): `v is MeIdentityRef`

Defined in: [types.ts:343](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L343)

#### Parameters

##### v

`any`

#### Returns

`v is MeIdentityRef`

***

### readPath()

> **readPath**(`path`): `any`

Defined in: [types.ts:352](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L352)

Read semantic data using the same rules as me.ts:
- Secret scope roots return undefined (stealth)
- Secret interior reads decrypt from encryptedBranches
- Public reads come from index and decrypt value-level blobs

#### Parameters

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`any`

***

### commitMemory()?

> `optional` **commitMemory**(`t`): `void`

Defined in: [types.ts:358](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L358)

Append an event to memories and rebuild index.
Operators that are “kernel-only” should avoid emitting memories.

#### Parameters

##### t

`KernelMemory`

#### Returns

`void`

***

### removeSubtree()

> **removeSubtree**(`targetPath`): `void`

Defined in: [types.ts:363](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L363)

Remove a subtree: deletes matching localSecrets/localNoises/encryptedBranches and emits a "-" memory.

#### Parameters

##### targetPath

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`void`

***

### normalizeAndValidateUsername()

> **normalizeAndValidateUsername**(`input`): `string`

Defined in: [types.ts:368](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L368)

For ops that need username normalization.

#### Parameters

##### input

`string`

#### Returns

`string`

***

### hashFn()

> **hashFn**(`input`): `string`

Defined in: [types.ts:373](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L373)

Portable hash function used to populate Memory.hash

#### Parameters

##### input

`string`

#### Returns

`string`

***

### now()

> **now**(): `number`

Defined in: [types.ts:378](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L378)

Current time. me.ts uses Date.now().

#### Returns

`number`
