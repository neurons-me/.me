[**this.me**](../README.md)

***

[this.me](../README.md) / ME

# Class: ME

Defined in: [me.ts:90](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L90)

The `.me` Semantic Kernel.

This is the core class of `.me`. When you do `new ME()`, you get much more than
a normal class instance:

- a stateful semantic kernel that manages memories, indexes, secrets, and derivations
- a callable proxy that lets you interact with infinite semantic paths like
  `me.profile.name("Jose")`, `me("profile.name")`, or `me.wallet["_"]("key")`

Important:

- this generated page only shows the explicit class API documented below
- the main user experience is the callable proxy / DSL, documented in
  [Runtime Surface](/Runtime-Surface),
  [Proxy Calls](/Proxy-Calls),
  [Operators](/Operators), and
  [Syntax](/Syntax)

## Indexable

\[`key`: `string`\]: `any`

## Constructors

### Constructor

> **new ME**(`expression?`): `ME`

Defined in: [me.ts:153](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L153)

#### Parameters

##### expression?

`any`

#### Returns

`ME`

## Accessors

### memories

#### Get Signature

> **get** **memories**(): [`Memory`](../interfaces/Memory.md)[]

Defined in: [me.ts:149](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L149)

Public redacted memory log.
This never exposes internal forensic fields such as `effectiveSecret`.

##### Returns

[`Memory`](../interfaces/Memory.md)[]

## Methods

### inspect()

> **inspect**(`opts?`): `MEInspectResult`

Defined in: [me.ts:170](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L170)

Inspect the current runtime state.
Returned memories are always public/redacted.

#### Parameters

##### opts?

###### last?

`number`

#### Returns

`MEInspectResult`

***

### explain()

> **explain**(`path`): `MEExplainResult`

Defined in: [me.ts:178](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L178)

Explain how a semantic path is derived.
Useful for debugging pointers, operators, and derived values.

#### Parameters

##### path

`string`

#### Returns

`MEExplainResult`

***

### execute()

> **execute**(`rawTarget`, `body?`): `any`

Defined in: [me.ts:186](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L186)

Execute a raw target string or parsed target AST without going through proxy property access.
Useful for tooling, explicit runtime dispatch, and tests.

#### Parameters

##### rawTarget

`string` | [`MeTargetAst`](../interfaces/MeTargetAst.md)

##### body?

`any`

#### Returns

`any`

***

### exportSnapshot()

> **exportSnapshot**(): `MESnapshot`

Defined in: [me.ts:284](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L284)

Export a portable public snapshot.
Snapshot memories are redacted and omit internal forensic fields.

#### Returns

`MESnapshot`

***

### importSnapshot()

> **importSnapshot**(`snapshot`): `void`

Defined in: [me.ts:292](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L292)

Import a snapshot into the current runtime.
Accepts both redacted public snapshots and legacy/internal payloads.

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### rehydrate()

> **rehydrate**(`snapshot`): `void`

Defined in: [me.ts:300](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L300)

Rehydrate the runtime from a snapshot payload.
This is a hydration-oriented alias over the import flow.

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### replayMemories()

> **replayMemories**(`memories`): `void`

Defined in: [me.ts:308](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L308)

Replay a memory log into the current runtime.
Accepts both public `Memory[]` and legacy/internal memory payloads.

#### Parameters

##### memories

`ReplayMemoryInput`[]

#### Returns

`void`

***

### learn()

> **learn**(`memory`): `void`

Defined in: [me.ts:316](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L316)

Ingest a single memory-like payload into the runtime.
Useful for tools that already operate at the memory-log layer.

#### Parameters

##### memory

`unknown`

#### Returns

`void`

***

### setRecomputeMode()

> **setRecomputeMode**(`mode`): `this`

Defined in: [me.ts:323](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L323)

Control whether derivations recompute eagerly or lazily.

#### Parameters

##### mode

`"eager"` | `"lazy"`

#### Returns

`this`

***

### getRecomputeMode()

> **getRecomputeMode**(): `"eager"` \| `"lazy"`

Defined in: [me.ts:330](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/me.ts#L330)

Read the current derivation recompute mode.

#### Returns

`"eager"` \| `"lazy"`
