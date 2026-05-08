[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorMatch

# Type Alias: OperatorMatch

> **OperatorMatch** = \{ `matched`: `false`; \} \| \{ `matched`: `true`; `token`: [`OperatorToken`](OperatorToken.md); `kind`: [`OperatorKind`](OperatorKind.md); `targetPath`: [`SemanticPath`](SemanticPath.md); `rewrittenExpression?`: `any`; `memoryOperator?`: `string`; `returnsValueAtRoot?`: `boolean`; \}

Defined in: [types.ts:276](https://github.com/neurons-me/.me/blob/ec31d2b86e5ca3a8aa2ab013e282fe9e794962ac/npm/src/types.ts#L276)

Operator recognition can either match (and then execute) or pass.

## Union Members

### Type Literal

\{ `matched`: `false`; \}

***

### Type Literal

\{ `matched`: `true`; `token`: [`OperatorToken`](OperatorToken.md); `kind`: [`OperatorKind`](OperatorKind.md); `targetPath`: [`SemanticPath`](SemanticPath.md); `rewrittenExpression?`: `any`; `memoryOperator?`: `string`; `returnsValueAtRoot?`: `boolean`; \}

#### matched

> **matched**: `true`

#### token

> **token**: [`OperatorToken`](OperatorToken.md)

The operator token that matched (e.g. "_", "=")

#### kind

> **kind**: [`OperatorKind`](OperatorKind.md)

The operator kind from the registry

#### targetPath

> **targetPath**: [`SemanticPath`](SemanticPath.md)

The destination path that should receive the semantic write (operator leaf removed
or otherwise transformed). In me.ts this is typically `scope`.

#### rewrittenExpression?

> `optional` **rewrittenExpression?**: `any`

The expression to write after the operator transforms it.
e.g. pointer operator turns expression:string into {__ptr:string}

#### memoryOperator?

> `optional` **memoryOperator?**: `string`

If operator is producing a semantic memory, what should be recorded as `operator`.
(me.ts uses "__" for both "__" and "->" pointer calls).

#### returnsValueAtRoot?

> `optional` **returnsValueAtRoot?**: `boolean`

Some operators return a value instead of writing when invoked at root.
- root "=" thunk returns computed value
- root "?" returns collected/transformed output
