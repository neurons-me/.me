[**this.me**](../README.md)

***

[this.me](../README.md) / ME

# Class: ME

Defined in: [me.ts:192](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L192)

The `.me` Semantic Kernel.

This is the core class of `.me`. When you do `new ME(seed?)`, you get much more than
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

> \[`key`: `string`\]: `any`

## Constructors

### Constructor

> **new ME**(`seed?`, `options?`): `ME`

Defined in: [me.ts:272](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L272)

#### Parameters

##### seed?

`string`

##### options?

`MEOptions` = `{}`

#### Returns

`ME`

## Properties

### \_ownerScope

> **\_ownerScope**: `string` \| `null` = `null`

Defined in: [me.ts:253](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L253)

***

### \_currentCallerScope

> **\_currentCallerScope**: `string` \| `null` \| `undefined` = `undefined`

Defined in: [me.ts:254](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L254)

## Accessors

### memories

#### Get Signature

> **get** **memories**(): [`Memory`](../interfaces/Memory.md)[]

Defined in: [me.ts:260](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L260)

Public redacted memory log.
This never exposes internal forensic fields such as `effectiveSecret`.

##### Returns

[`Memory`](../interfaces/Memory.md)[]

***

### encryptedBranches

#### Get Signature

> **get** **encryptedBranches**(): `EncryptedBranchPlane`

Defined in: [me.ts:264](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L264)

##### Returns

`EncryptedBranchPlane`

#### Set Signature

> **set** **encryptedBranches**(`value`): `void`

Defined in: [me.ts:268](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L268)

##### Parameters

###### value

`EncryptedBranchPlane`

##### Returns

`void`

## Methods

### inspect()

> **inspect**(`opts?`): `MEInspectResult`

Defined in: [me.ts:366](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L366)

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

Defined in: [me.ts:374](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L374)

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

Defined in: [me.ts:382](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L382)

Execute a raw target string or parsed target AST without going through proxy property access.
Useful for tooling, explicit runtime dispatch, and tests.

#### Parameters

##### rawTarget

`string` \| [`MeTargetAst`](../interfaces/MeTargetAst.md)

##### body?

`any`

#### Returns

`any`

***

### searchExact()

> **searchExact**(`scopePath`, `query`, `options?`): `MESearchExactResult`

Defined in: [me.ts:390](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L390)

Exact vector search over a collection-scoped secret branch backed by chunked columnar storage.
This is the correctness baseline used before approximate indexes such as IVF.

#### Parameters

##### scopePath

`string` \| [`SemanticPath`](../type-aliases/SemanticPath.md)

##### query

`ArrayLike`\<`number`\>

##### options?

`MESearchExactOptions` = `{}`

#### Returns

`MESearchExactResult`

***

### buildVectorIndex()

> **buildVectorIndex**(`scopePath`, `options?`): `MEVectorIndexBuildResult`

Defined in: [me.ts:402](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L402)

Build an approximate IVF sidecar for a collection-scoped secret vector corpus.
The sidecar lives outside the kernel log and is intended to reduce chunk decrypts during search.

#### Parameters

##### scopePath

`string` \| [`SemanticPath`](../type-aliases/SemanticPath.md)

##### options?

`MEVectorIndexBuildOptions` = `{}`

#### Returns

`MEVectorIndexBuildResult`

***

### searchVector()

> **searchVector**(`scopePath`, `query`, `options?`): `MEVectorSearchResult`

Defined in: [me.ts:413](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L413)

Approximate vector search backed by the IVF sidecar.
Uses centroids for coarse routing and exact scan only on the selected candidate chunks.

#### Parameters

##### scopePath

`string` \| [`SemanticPath`](../type-aliases/SemanticPath.md)

##### query

`ArrayLike`\<`number`\>

##### options?

`MEVectorSearchOptions` = `{}`

#### Returns

`MEVectorSearchResult`

***

### exportSnapshot()

> **exportSnapshot**(): `MESnapshot`

Defined in: [me.ts:515](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L515)

Export a portable public snapshot.
Snapshot memories are redacted and omit internal forensic fields.

#### Returns

`MESnapshot`

***

### hydrate()

> **hydrate**(`snapshot`): `void`

Defined in: [me.ts:523](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L523)

Hydrate the runtime from a snapshot payload.
This is the primary restore API for bringing a saved kernel back to life in memory.

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### importSnapshot()

> **importSnapshot**(`snapshot`): `void`

Defined in: [me.ts:532](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L532)

Import a snapshot into the current runtime.
Accepts both redacted public snapshots and legacy/internal payloads.
Prefer `hydrate()` in user-facing code.

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### rehydrate()

> **rehydrate**(`snapshot`): `void`

Defined in: [me.ts:540](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L540)

Rehydrate the runtime from a snapshot payload.
Backward-compatible alias for `hydrate()`.

#### Parameters

##### snapshot

`MESnapshotInput`

#### Returns

`void`

***

### replayMemories()

> **replayMemories**(`memories`): `void`

Defined in: [me.ts:548](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L548)

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

Defined in: [me.ts:556](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L556)

Ingest a single memory-like payload into the runtime.
Useful for tools that already operate at the memory-log layer.

#### Parameters

##### memory

`unknown`

#### Returns

`void`

***

### prove()

> **prove**(`input`): `Promise`\<`MEProofResult`\>

Defined in: [me.ts:565](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L565)

Derive a branch-scoped proof for the current active expression.
This signs a canonical payload with an Ed25519 key deterministically derived
from the root seed and active branch expression.

#### Parameters

##### input

`MEProofInput`

#### Returns

`Promise`\<`MEProofResult`\>

***

### setRecomputeMode()

> **setRecomputeMode**(`mode`): `this`

Defined in: [me.ts:604](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L604)

Control whether derivations recompute eagerly or lazily.

#### Parameters

##### mode

`"eager"` \| `"lazy"`

#### Returns

`this`

***

### getRecomputeMode()

> **getRecomputeMode**(): `"eager"` \| `"lazy"`

Defined in: [me.ts:611](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L611)

Read the current derivation recompute mode.

#### Returns

`"eager"` \| `"lazy"`

***

### as()

> **as**(`scope`): `ME`

Defined in: [me.ts:1314](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L1314)

#### Parameters

##### scope

`string` \| `null`

#### Returns

`ME`

***

### withScope()

> **withScope**\<`T`\>(`scope`, `fn`): `T`

Defined in: [me.ts:1324](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/me.ts#L1324)

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

`string` \| `null`

##### fn

() => `T`

#### Returns

`T`
