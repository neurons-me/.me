[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorKernel

# Interface: OperatorKernel

Defined in: [types.ts:139](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L139)

A minimal “kernel facade” for operator modules.
These are *capabilities* the ME kernel must expose so ops can behave exactly like me.ts.

## Properties

### encryptedBranches?

> `optional` **encryptedBranches**: `Record`\<`string`, `` `0x${string}` ``\>

Defined in: [types.ts:150](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L150)

***

### localNoises?

> `optional` **localNoises**: `Record`\<`string`, `string`\>

Defined in: [types.ts:149](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L149)

***

### localSecrets?

> `optional` **localSecrets**: `Record`\<`string`, `string`\>

Defined in: [types.ts:148](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L148)

***

### memories?

> `optional` **memories**: [`Memory`](Memory.md)[]

Defined in: [types.ts:153](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L153)

***

### operators?

> `optional` **operators**: [`OperatorRegistry`](../type-aliases/OperatorRegistry.md)

Defined in: [types.ts:142](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L142)

## Methods

### commitMemory()?

> `optional` **commitMemory**(`t`): `void`

Defined in: [types.ts:182](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L182)

Append an event to memories and rebuild index.
Operators that are “kernel-only” should avoid emitting memories.

#### Parameters

##### t

[`Memory`](Memory.md)

#### Returns

`void`

***

### computeEffectiveSecret()

> **computeEffectiveSecret**(`path`): `string`

Defined in: [types.ts:157](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L157)

#### Parameters

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`string`

***

### hashFn()

> **hashFn**(`input`): `string`

Defined in: [types.ts:197](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L197)

Portable hash function used to populate Memory.hash

#### Parameters

##### input

`string`

#### Returns

`string`

***

### isEncryptedBlob()

> **isEncryptedBlob**(`v`): `` v is `0x${string}` ``

Defined in: [types.ts:160](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L160)

#### Parameters

##### v

`any`

#### Returns

`` v is `0x${string}` ``

***

### isIdentityRef()

> **isIdentityRef**(`v`): `v is MeIdentityRef`

Defined in: [types.ts:167](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L167)

#### Parameters

##### v

`any`

#### Returns

`v is MeIdentityRef`

***

### isPointer()

> **isPointer**(`v`): `v is MePointer`

Defined in: [types.ts:164](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L164)

#### Parameters

##### v

`any`

#### Returns

`v is MePointer`

***

### makeIdentityRef()

> **makeIdentityRef**(`id`): `MeIdentityRef`

Defined in: [types.ts:166](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L166)

#### Parameters

##### id

`string`

#### Returns

`MeIdentityRef`

***

### makePointer()

> **makePointer**(`targetPath`): `MePointer`

Defined in: [types.ts:163](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L163)

#### Parameters

##### targetPath

`string`

#### Returns

`MePointer`

***

### normalizeAndValidateUsername()

> **normalizeAndValidateUsername**(`input`): `string`

Defined in: [types.ts:192](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L192)

For ops that need username normalization.

#### Parameters

##### input

`string`

#### Returns

`string`

***

### now()

> **now**(): `number`

Defined in: [types.ts:202](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L202)

Current time. me.ts uses Date.now().

#### Returns

`number`

***

### opKind()

> **opKind**(`op`): [`OperatorKind`](../type-aliases/OperatorKind.md) \| `null`

Defined in: [types.ts:141](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L141)

#### Parameters

##### op

`string`

#### Returns

[`OperatorKind`](../type-aliases/OperatorKind.md) \| `null`

***

### readPath()

> **readPath**(`path`): `any`

Defined in: [types.ts:176](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L176)

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

Defined in: [types.ts:154](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L154)

#### Returns

`void`

***

### removeSubtree()

> **removeSubtree**(`targetPath`): `void`

Defined in: [types.ts:187](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L187)

Remove a subtree: deletes matching localSecrets/localNoises/encryptedBranches and emits a "-" memory.

#### Parameters

##### targetPath

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`void`

***

### splitPath()

> **splitPath**(`path`): `object`

Defined in: [types.ts:145](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L145)

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

Defined in: [types.ts:159](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L159)

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

Defined in: [types.ts:158](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L158)

#### Parameters

##### value

`any`

##### secret

`string`

##### path

[`SemanticPath`](../type-aliases/SemanticPath.md)

#### Returns

`` `0x${string}` ``
