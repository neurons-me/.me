[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorMatch

# Type Alias: OperatorMatch

> **OperatorMatch** = \{ `matched`: `false`; \} \| \{ `kind`: [`OperatorKind`](OperatorKind.md); `matched`: `true`; `memoryOperator?`: `string`; `returnsValueAtRoot?`: `boolean`; `rewrittenExpression?`: `any`; `targetPath`: [`SemanticPath`](SemanticPath.md); `token`: [`OperatorToken`](OperatorToken.md); \}

Defined in: [types.ts:100](https://github.com/neurons-me/.me/blob/eb91d161f4c6660821f8b6426d70a5c8c15adb16/npm/src/types.ts#L100)

Operator recognition can either match (and then execute) or pass.

## Type Declaration

\{ `matched`: `false`; \}

### matched

> **matched**: `false`

\{ `kind`: [`OperatorKind`](OperatorKind.md); `matched`: `true`; `memoryOperator?`: `string`; `returnsValueAtRoot?`: `boolean`; `rewrittenExpression?`: `any`; `targetPath`: [`SemanticPath`](SemanticPath.md); `token`: [`OperatorToken`](OperatorToken.md); \}

### kind

> **kind**: [`OperatorKind`](OperatorKind.md)

The operator kind from the registry

### matched

> **matched**: `true`

### memoryOperator?

> `optional` **memoryOperator**: `string`

If operator is producing a semantic memory, what should be recorded as `operator`.
(me.ts uses "__" for both "__" and "->" pointer calls).

### returnsValueAtRoot?

> `optional` **returnsValueAtRoot**: `boolean`

Some operators return a value instead of writing when invoked at root.
- root "=" thunk returns computed value
- root "?" returns collected/transformed output

### rewrittenExpression?

> `optional` **rewrittenExpression**: `any`

The expression to write after the operator transforms it.
e.g. pointer operator turns expression:string into {__ptr:string}

### targetPath

> **targetPath**: [`SemanticPath`](SemanticPath.md)

The destination path that should receive the semantic write (operator leaf removed
or otherwise transformed). In me.ts this is typically `scope`.

### token

> **token**: [`OperatorToken`](OperatorToken.md)

The operator token that matched (e.g. "_", "=")
