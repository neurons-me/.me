[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorHandler

# Interface: OperatorHandler

Defined in: [types.ts:397](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L397)

## Methods

### match()

> **match**(`call`, `kernel`): [`OperatorMatch`](../type-aliases/OperatorMatch.md)

Defined in: [types.ts:406](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L406)

Return a match if this operator applies to the call.
IMPORTANT: matching depends on:
- operator token at leaf
- operator registry kind
- argument shape (string / function / array)
- whether called at root vs non-root

#### Parameters

##### call

[`OperatorCall`](OperatorCall.md)

##### kernel

[`OperatorKernel`](OperatorKernel.md)

#### Returns

[`OperatorMatch`](../type-aliases/OperatorMatch.md)

***

### execute()

> **execute**(`match`, `call`, `kernel`): `any`

Defined in: [types.ts:415](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L415)

Execute behavior.
This function may:
- mutate kernel config (define operator)
- write memories / encrypt branches / update secrets/noises
- return a value (root eval/query) or a Memory

#### Parameters

##### match

###### matched

`true`

###### token

`string`

The operator token that matched (e.g. "_", "=")

###### kind

[`OperatorKind`](../type-aliases/OperatorKind.md)

The operator kind from the registry

###### targetPath

[`SemanticPath`](../type-aliases/SemanticPath.md)

The destination path that should receive the semantic write (operator leaf removed
or otherwise transformed). In me.ts this is typically `scope`.

###### rewrittenExpression?

`any`

The expression to write after the operator transforms it.
e.g. pointer operator turns expression:string into {__ptr:string}

###### memoryOperator?

`string`

If operator is producing a semantic memory, what should be recorded as `operator`.
(me.ts uses "__" for both "__" and "->" pointer calls).

###### returnsValueAtRoot?

`boolean`

Some operators return a value instead of writing when invoked at root.
- root "=" thunk returns computed value
- root "?" returns collected/transformed output

##### call

[`OperatorCall`](OperatorCall.md)

##### kernel

[`OperatorKernel`](OperatorKernel.md)

#### Returns

`any`
