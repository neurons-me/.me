[**this.me**](../README.md)

***

[this.me](../README.md) / default

# Class: default

Defined in: [me.ts:49](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L49)

## Indexable

\[`key`: `string`\]: `any`

## Constructors

### Constructor

> **new default**(`expression?`): `ME`

Defined in: [me.ts:377](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L377)

Constructor base:
 me = new ME(expression?)

Esto es equivalente a llamar:
  me(expression) en la raíz.

#### Parameters

##### expression?

`any`

#### Returns

`ME`

## Accessors

### memories

#### Get Signature

> **get** **memories**(): `Memory`[]

Defined in: [me.ts:89](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L89)

##### Returns

`Memory`[]

## Methods

### explain()

> **explain**(`path`): `object`

Defined in: [me.ts:135](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L135)

#### Parameters

##### path

`string`

#### Returns

`object`

##### derivation

> **derivation**: \{ `expression`: `string`; `inputs`: `object`[]; \} \| `null`

##### meta

> **meta**: `object`

###### meta.dependsOn

> **dependsOn**: `string`[]

###### meta.lastComputedAt?

> `optional` **lastComputedAt**: `number`

##### path

> **path**: `string`

##### value

> **value**: `any`

***

### exportSnapshot()

> **exportSnapshot**(): `object`

Defined in: [me.ts:195](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L195)

#### Returns

`object`

##### encryptedBranches

> **encryptedBranches**: `Record`\<`string`, `EncryptedBlob` \| `Record`\<`string`, `EncryptedBlob`\>\>

##### localNoises

> **localNoises**: `Record`\<`string`, `string`\>

##### localSecrets

> **localSecrets**: `Record`\<`string`, `string`\>

##### memories

> **memories**: `Memory`[]

##### operators

> **operators**: `Record`\<`string`, \{ `kind`: `string`; \}\>

***

### getRecomputeMode()

> **getRecomputeMode**(): `"eager"` \| `"lazy"`

Defined in: [me.ts:124](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L124)

#### Returns

`"eager"` \| `"lazy"`

***

### importSnapshot()

> **importSnapshot**(`snapshot`): `void`

Defined in: [me.ts:211](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L211)

#### Parameters

##### snapshot

###### encryptedBranches?

`Record`\<`string`, `` `0x${string}` `` \| `Record`\<`string`, `` `0x${string}` ``\>\>

###### localNoises?

`Record`\<`string`, `string`\>

###### localSecrets?

`Record`\<`string`, `string`\>

###### memories?

`Memory`[]

###### operators?

`Record`\<`string`, \{ `kind`: `string`; \}\>

#### Returns

`void`

***

### inspect()

> **inspect**(`opts?`): `object`

Defined in: [me.ts:94](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L94)

#### Parameters

##### opts?

###### last?

`number`

#### Returns

`object`

##### encryptedScopes

> **encryptedScopes**: `string`[]

##### index

> **index**: `Record`\<`string`, `any`\>

##### memories

> **memories**: `Memory`[]

##### noiseScopes

> **noiseScopes**: `string`[]

##### recomputeMode

> **recomputeMode**: `"eager"` \| `"lazy"`

##### secretScopes

> **secretScopes**: `string`[]

##### staleDerivations

> **staleDerivations**: `number`

***

### learn()

> **learn**(`memory`): `void`

Defined in: [me.ts:261](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L261)

#### Parameters

##### memory

`unknown`

#### Returns

`void`

***

### rehydrate()

> **rehydrate**(`snapshot`): `void`

Defined in: [me.ts:251](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L251)

#### Parameters

##### snapshot

###### encryptedBranches?

`Record`\<`string`, `` `0x${string}` `` \| `Record`\<`string`, `` `0x${string}` ``\>\>

###### localNoises?

`Record`\<`string`, `string`\>

###### localSecrets?

`Record`\<`string`, `string`\>

###### memories?

`Memory`[]

###### operators?

`Record`\<`string`, \{ `kind`: `string`; \}\>

#### Returns

`void`

***

### replayMemories()

> **replayMemories**(`memories`): `void`

Defined in: [me.ts:303](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L303)

#### Parameters

##### memories

`Memory`[]

#### Returns

`void`

***

### setRecomputeMode()

> **setRecomputeMode**(`mode`): `this`

Defined in: [me.ts:119](https://github.com/neurons-me/.me/blob/40be0272a181ea4e788bfce1d6ec1ba6e4d53f45/npm/src/me.ts#L119)

#### Parameters

##### mode

`"eager"` | `"lazy"`

#### Returns

`this`
