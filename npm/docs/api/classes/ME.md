[**this.me**](../README.md)

***

[this.me](../README.md) / ME

# Class: ME

Defined in: [me.ts:70](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L70)

The `.me` semantic kernel.

`ME` is both:

- a stateful kernel that stores semantic memories, indexes, secrets, and derivations
- a callable proxy runtime that lets you navigate and execute semantic paths like `me.profile.name("Ana")`

Practical mental model:

- property access builds a semantic path
- calling `()` writes, reads, or invokes an operator at that path
- explicit class methods such as `inspect()`, `explain()`, `exportSnapshot()`, and `replayMemories()`
  are the debugging, replay, and hydration surface around that runtime

If you are reading the generated API docs:

- this class page shows the explicit TypeScript class members
- the full language surface also includes the proxy/DSL behavior documented in
  `Runtime Surface`, `Proxy Calls`, `Operators`, and `Syntax`

## Indexable

\[`key`: `string`\]: `any`

## Constructors

### Constructor

> **new ME**(`expression?`): `ME`

Defined in: [me.ts:399](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L399)

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

> **get** **memories**(): [`Memory`](../interfaces/Memory.md)[]

Defined in: [me.ts:111](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L111)

##### Returns

[`Memory`](../interfaces/Memory.md)[]

## Methods

### explain()

> **explain**(`path`): `object`

Defined in: [me.ts:157](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L157)

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

Defined in: [me.ts:217](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L217)

#### Returns

`object`

##### encryptedBranches

> **encryptedBranches**: `Record`\<`string`, [`EncryptedBlob`](../type-aliases/EncryptedBlob.md) \| `Record`\<`string`, [`EncryptedBlob`](../type-aliases/EncryptedBlob.md)\>\>

##### localNoises

> **localNoises**: `Record`\<`string`, `string`\>

##### localSecrets

> **localSecrets**: `Record`\<`string`, `string`\>

##### memories

> **memories**: [`Memory`](../interfaces/Memory.md)[]

##### operators

> **operators**: `Record`\<`string`, \{ `kind`: `string`; \}\>

***

### getRecomputeMode()

> **getRecomputeMode**(): `"eager"` \| `"lazy"`

Defined in: [me.ts:146](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L146)

#### Returns

`"eager"` \| `"lazy"`

***

### importSnapshot()

> **importSnapshot**(`snapshot`): `void`

Defined in: [me.ts:233](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L233)

#### Parameters

##### snapshot

###### encryptedBranches?

`Record`\<`string`, `` `0x${string}` `` \| `Record`\<`string`, `` `0x${string}` ``\>\>

###### localNoises?

`Record`\<`string`, `string`\>

###### localSecrets?

`Record`\<`string`, `string`\>

###### memories?

[`Memory`](../interfaces/Memory.md)[]

###### operators?

`Record`\<`string`, \{ `kind`: `string`; \}\>

#### Returns

`void`

***

### inspect()

> **inspect**(`opts?`): `object`

Defined in: [me.ts:116](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L116)

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

> **memories**: [`Memory`](../interfaces/Memory.md)[]

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

Defined in: [me.ts:283](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L283)

#### Parameters

##### memory

`unknown`

#### Returns

`void`

***

### rehydrate()

> **rehydrate**(`snapshot`): `void`

Defined in: [me.ts:273](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L273)

#### Parameters

##### snapshot

###### encryptedBranches?

`Record`\<`string`, `` `0x${string}` `` \| `Record`\<`string`, `` `0x${string}` ``\>\>

###### localNoises?

`Record`\<`string`, `string`\>

###### localSecrets?

`Record`\<`string`, `string`\>

###### memories?

[`Memory`](../interfaces/Memory.md)[]

###### operators?

`Record`\<`string`, \{ `kind`: `string`; \}\>

#### Returns

`void`

***

### replayMemories()

> **replayMemories**(`memories`): `void`

Defined in: [me.ts:325](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L325)

#### Parameters

##### memories

[`Memory`](../interfaces/Memory.md)[]

#### Returns

`void`

***

### setRecomputeMode()

> **setRecomputeMode**(`mode`): `this`

Defined in: [me.ts:141](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/me.ts#L141)

#### Parameters

##### mode

`"eager"` | `"lazy"`

#### Returns

`this`
