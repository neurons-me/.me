[**this.me**](../README.md)

***

[this.me](../README.md) / OperatorMatch

# Type Alias: OperatorMatch

> **OperatorMatch** = \{ `matched`: `false`; \} \| \{ `matched`: `true`; `token`: [`OperatorToken`](OperatorToken.md); `kind`: [`OperatorKind`](OperatorKind.md); `targetPath`: [`SemanticPath`](SemanticPath.md); `rewrittenExpression?`: `any`; `memoryOperator?`: `string`; `returnsValueAtRoot?`: `boolean`; \}

Defined in: [types.ts:178](https://github.com/neurons-me/.me/blob/c571ec78a420eef7f7b8151238de06919c99b3b5/npm/src/types.ts#L178)

Operator recognition can either match (and then execute) or pass.

## Type Declaration

\{ `matched`: `false`; \}

### matched

> **matched**: `false`

\{ `matched`: `true`; `token`: [`OperatorToken`](OperatorToken.md); `kind`: [`OperatorKind`](OperatorKind.md); `targetPath`: [`SemanticPath`](SemanticPath.md); `rewrittenExpression?`: `any`; `memoryOperator?`: `string`; `returnsValueAtRoot?`: `boolean`; \}

### matched

> **matched**: `true`

### token

> **token**: [`OperatorToken`](OperatorToken.md)

The operator token that matched (e.g. "_", "=")

### kind

> **kind**: [`OperatorKind`](OperatorKind.md)

The operator kind from the registry

### targetPath

> **targetPath**: [`SemanticPath`](SemanticPath.md)

The destination path that should receive the semantic write (operator leaf removed
or otherwise transformed). In me.ts this is typically `scope`.

### rewrittenExpression?

> `optional` **rewrittenExpression**: `any`

The expression to write after the operator transforms it.
e.g. pointer operator turns expression:string into {__ptr:string}

### memoryOperator?

> `optional` **memoryOperator**: `string`

If operator is producing a semantic memory, what should be recorded as `operator`.
(me.ts uses "__" for both "__" and "->" pointer calls).

### returnsValueAtRoot?

> `optional` **returnsValueAtRoot**: `boolean`

Some operators return a value instead of writing when invoked at root.
- root "=" thunk returns computed value
- root "?" returns collected/transformed output
