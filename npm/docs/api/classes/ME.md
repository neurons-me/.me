[**this.me**](../README.md)

***

[this.me](../README.md) / ME

# Class: ME

Defined in: [me.ts:87](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L87)

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

Defined in: [me.ts:142](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L142)

#### Parameters

##### expression?

`any`

#### Returns

`ME`

## Properties

### exportP256PublicKey()

> `static` **exportP256PublicKey**: (`key`) => `Promise`\<`P256PublicKeyCoordinates`\>

Defined in: [me.ts:92](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L92)

#### Parameters

##### key

`CryptoKey`

#### Returns

`Promise`\<`P256PublicKeyCoordinates`\>

***

### generateP256KeyPair()

> `static` **generateP256KeyPair**: (`extractable`, `usages`) => `Promise`\<`CryptoKeyPair`\>

Defined in: [me.ts:91](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L91)

#### Parameters

##### extractable?

`boolean` = `true`

##### usages?

`KeyUsage`[] = `...`

#### Returns

`Promise`\<`CryptoKeyPair`\>

***

### importP256PublicKey()

> `static` **importP256PublicKey**: (`publicKey`) => `Promise`\<`CryptoKey`\>

Defined in: [me.ts:93](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L93)

#### Parameters

##### publicKey

`P256PublicKeyCoordinates`

#### Returns

`Promise`\<`CryptoKey`\>

## Accessors

### memories

#### Get Signature

> **get** **memories**(): [`Memory`](../interfaces/Memory.md)[]

Defined in: [me.ts:138](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L138)

Public redacted memory log.
This never exposes internal forensic fields such as `effectiveSecret`.

##### Returns

[`Memory`](../interfaces/Memory.md)[]

## Methods

### execute()

> **execute**(`rawTarget`, `body?`): `any`

Defined in: [me.ts:183](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L183)

#### Parameters

##### rawTarget

`string` | [`MeTargetAst`](../interfaces/MeTargetAst.md)

##### body?

`any`

#### Returns

`any`

***

### explain()

> **explain**(`path`): `MEExplainResult`

Defined in: [me.ts:191](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L191)

#### Parameters

##### path

`string`

#### Returns

`MEExplainResult`

***

### exportSnapshot()

> **exportSnapshot**(): `MESnapshot`

Defined in: [me.ts:289](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L289)

Export a portable public snapshot.
Snapshot memories are redacted and omit internal forensic fields.

#### Returns

`MESnapshot`

***

### getRecomputeMode()

> **getRecomputeMode**(): `"eager"` \| `"lazy"`

Defined in: [me.ts:167](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L167)

#### Returns

`"eager"` \| `"lazy"`

***

### importSnapshot()

> **importSnapshot**(`snapshot`): `void`

Defined in: [me.ts:297](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L297)

Import a snapshot into the current runtime.
Accepts both redacted public snapshots and legacy/internal payloads.

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### inspect()

> **inspect**(`opts?`): `MEInspectResult`

Defined in: [me.ts:159](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L159)

Inspect the current runtime state.
Returned memories are always public/redacted.

#### Parameters

##### opts?

###### last?

`number`

#### Returns

`MEInspectResult`

***

### installRecipientKey()

> **installRecipientKey**(`recipientKeyId`, `privateKey`): `this`

Defined in: [me.ts:171](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L171)

#### Parameters

##### recipientKeyId

`string`

##### privateKey

`CryptoKey`

#### Returns

`this`

***

### learn()

> **learn**(`memory`): `void`

Defined in: [me.ts:305](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L305)

#### Parameters

##### memory

`unknown`

#### Returns

`void`

***

### rehydrate()

> **rehydrate**(`snapshot`): `void`

Defined in: [me.ts:301](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L301)

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### replayMemories()

> **replayMemories**(`memories`): `void`

Defined in: [me.ts:313](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L313)

Replay a memory log into the current runtime.
Accepts both public `Memory[]` and legacy/internal memory payloads.

#### Parameters

##### memories

`ReplayMemoryInput`[]

#### Returns

`void`

***

### setRecomputeMode()

> **setRecomputeMode**(`mode`): `this`

Defined in: [me.ts:163](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L163)

#### Parameters

##### mode

`"eager"` | `"lazy"`

#### Returns

`this`

***

### storeWrappedKey()

> **storeWrappedKey**(`keyId`, `envelope`, `options?`): `this`

Defined in: [me.ts:179](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L179)

#### Parameters

##### keyId

`string`

##### envelope

`WrappedSecretV1`

##### options?

###### recipientKeyId?

`string`

#### Returns

`this`

***

### uninstallRecipientKey()

> **uninstallRecipientKey**(`recipientKeyId`): `this`

Defined in: [me.ts:175](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L175)

#### Parameters

##### recipientKeyId

`string`

#### Returns

`this`

***

### unwrapSecretV1()

> `static` **unwrapSecretV1**(`envelope`, `recipientPrivateKey`, `output?`): `Promise`\<`string` \| `Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [me.ts:104](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L104)

#### Parameters

##### envelope

`WrappedSecretV1`

##### recipientPrivateKey

`CryptoKey`

##### output?

`"bytes"` | `"utf8"`

#### Returns

`Promise`\<`string` \| `Uint8Array`\<`ArrayBufferLike`\>\>

***

### wrapSecretV1()

> `static` **wrapSecretV1**(`input`): `Promise`\<`WrappedSecretV1`\>

Defined in: [me.ts:94](https://github.com/neurons-me/.me/blob/be0fcc0288ad977c5c48673c15dee62b435195d3/npm/src/me.ts#L94)

#### Parameters

##### input

###### class

`WrappedSecretClass`

###### kid

`string`

###### policy?

`WrappedSecretPolicy`

###### publicKey?

`P256PublicKeyCoordinates`

###### recipientPublicKey

`P256PublicKeyCoordinates` \| `CryptoKey`

###### secret

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`Promise`\<`WrappedSecretV1`\>
