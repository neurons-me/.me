[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorKernel

# Interface: OperatorKernel

Defined in: [types.ts:217](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L217)

A minimal “kernel facade” for operator modules.
These are *capabilities* the ME kernel must expose so ops can behave exactly like me.ts.

## Properties

### encryptedBranches?

> `optional` **encryptedBranches**: `Record`\<`string`, `` `0x${string}` ``\>

Defined in: [types.ts:228](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L228)

***

### localNoises?

> `optional` **localNoises**: `Record`\<`string`, `string`\>

Defined in: [types.ts:227](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L227)

***

### localSecrets?

> `optional` **localSecrets**: `Record`\<`string`, `string`\>

Defined in: [types.ts:226](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L226)

***

### memories?

> `optional` **memories**: `KernelMemory`[]

Defined in: [types.ts:231](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L231)

***

### operators?

> `optional` **operators**: [`OperatorRegistry`](../type-aliases/OperatorRegistry.md)

Defined in: [types.ts:220](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L220)

## Methods

### commitMemory()?

> `optional` **commitMemory**(`t`): `void`

Defined in: [types.ts:260](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L260)

Append an event to memories and rebuild index.
Operators that are “kernel-only” should avoid emitting memories.

#### Parameters

##### t

`KernelMemory`

#### Returns

`void`

***

### computeEffectiveSecret()

> **computeEffectiveSecret**(`path`): `string`

Defined in: [types.ts:235](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L235)

#### Parameters

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`string`

***

### hashFn()

> **hashFn**(`input`): `string`

Defined in: [types.ts:275](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L275)

Portable hash function used to populate Memory.hash

#### Parameters

##### input

`string`

#### Returns

`string`

***

### isEncryptedBlob()

> **isEncryptedBlob**(`v`): `` v is `0x${string}` ``

Defined in: [types.ts:238](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L238)

#### Parameters

##### v

`any`

#### Returns

`` v is `0x${string}` ``

***

### isIdentityRef()

> **isIdentityRef**(`v`): `v is MeIdentityRef`

Defined in: [types.ts:245](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L245)

#### Parameters

##### v

`any`

#### Returns

`v is MeIdentityRef`

***

### isPointer()

> **isPointer**(`v`): `v is MePointer`

Defined in: [types.ts:242](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L242)

#### Parameters

##### v

`any`

#### Returns

`v is MePointer`

***

### makeIdentityRef()

> **makeIdentityRef**(`id`): `MeIdentityRef`

Defined in: [types.ts:244](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L244)

#### Parameters

##### id

`string`

#### Returns

`MeIdentityRef`

***

### makePointer()

> **makePointer**(`targetPath`): `MePointer`

Defined in: [types.ts:241](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L241)

#### Parameters

##### targetPath

`string`

#### Returns

`MePointer`

***

### normalizeAndValidateUsername()

> **normalizeAndValidateUsername**(`input`): `string`

Defined in: [types.ts:270](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L270)

For ops that need username normalization.

#### Parameters

##### input

`string`

#### Returns

`string`

***

### now()

> **now**(): `number`

Defined in: [types.ts:280](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L280)

Current time. me.ts uses Date.now().

#### Returns

`number`

***

### opKind()

> **opKind**(`op`): [`OperatorKind`](../type-aliases/OperatorKind.md) \| `null`

Defined in: [types.ts:219](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L219)

#### Parameters

##### op

`string`

#### Returns

[`OperatorKind`](../type-aliases/OperatorKind.md) \| `null`

***

### readPath()

> **readPath**(`path`): `any`

Defined in: [types.ts:254](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L254)

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

### rebuildIndex()

> **rebuildIndex**(): `void`

Defined in: [types.ts:232](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L232)

#### Returns

`void`

***

### removeSubtree()

> **removeSubtree**(`targetPath`): `void`

Defined in: [types.ts:265](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L265)

Remove a subtree: deletes matching localSecrets/localNoises/encryptedBranches and emits a "-" memory.

#### Parameters

##### targetPath

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`void`

***

### splitPath()

> **splitPath**(`path`): `object`

Defined in: [types.ts:223](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L223)

#### Parameters

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`object`

##### leaf

> **leaf**: `string` \| `null`

##### scope

> **scope**: [`SemanticPath`](../type-aliases/SemanticPath.md)

***

### xorDecrypt()

> **xorDecrypt**(`blob`, `secret`, `path`): `any`

Defined in: [types.ts:237](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L237)

#### Parameters

##### blob

`` `0x${string}` ``

##### secret

`string`

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`any`

***

### xorEncrypt()

> **xorEncrypt**(`value`, `secret`, `path`): `` `0x${string}` ``

Defined in: [types.ts:236](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/types.ts#L236)

#### Parameters

##### value

`any`

##### secret

`string`

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`` `0x${string}` ``
