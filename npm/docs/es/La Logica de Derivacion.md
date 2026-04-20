# La lógica de Derivación del Código

```text
CASO:
root["_"]("A")
root.child["_"]("B")
root.child["~"]("N")
root.child.leaf("x")


root                   scope=root(A)         effective=A
  child [_ B]         scope=child(B)        effective=A+B
                       cambia el dueño estructural aquí

  child [~ N]         scope=child(B)        effective=N+B
                       corta A
                       conserva B porque B vive en el mismo noise boundary

    leaf="x"          scope=child(B)        effective=N+B
                       hereda N+B
                       no hereda A
```

Y el caso 4, al lado, para comparar:

```text
CASO 4:
wallet["_"]("A")
wallet.hidden.notes("alpha-note")
wallet["~"]("N")
wallet["_"]("B")
wallet.hidden.seed("beta-seed")


wallet                 scope=wallet(A)       effective=A
  hidden.notes         scope=wallet(A)       effective=A
                       escrito en la generación vieja

wallet [~ N] [_ B]     scope=wallet(B)       effective=N+B
                       mismo nodo, nuevo lineage efectivo

  hidden.seed          scope=wallet(B)       effective=N+B
                       escrito en la generación nueva

  hidden.notes         old blob @ A
                       lectura actual intenta N+B
                       => queda fuera / fail closed
```

La diferencia conceptual entre ambos es:

- `child` ya era el dueño estructural por `["_"]("B")`; luego `~` no le quita ese ownership. Solo le cambia la cadena efectiva de `A+B` a `N+B`.
- En el caso 4, pasa algo parecido en el mismo nodo `wallet`, pero además ves muy claro el corte temporal entre “datos escritos antes del reset” y “datos escritos después”.

Sobre el orden `_` y `~` en el mismo nodo: el estado final no cambia.

Estas dos secuencias terminan con el mismo mapa final de secretos/noises y el mismo lineage efectivo:

```ts
root["_"]("A");
root.child["_"]("B");
root.child["~"]("N");
```

```ts
root["_"]("A");
root.child["~"]("N");
root.child["_"]("B");
```

Eso es porque el cálculo final lee los mapas actuales `localSecrets` y `localNoises`, no el orden histórico de memorias: `registerStealthScope(...)` y el manejo del operador `~` en `src/core-write.ts`, junto con `computeEffectiveSecret(...)` en `src/secret-context.ts`.

Lo que sí cambia con el orden es qué escrituras históricas quedaron cifradas con el linaje viejo y cuáles con el nuevo.

#### La regla mental se actualiza a:

```
~ corta todo lo que está SOBRE ese nodo
~ conserva el _ que está EN ese mismo nodo
~ no toca nada de abajo
```

| Caso              | Scope estructural    | Effective Lineage                                         | Read owner                 | Read guest |
| :---------------- | :------------------- | :-------------------------------------------------------- | :------------------------- | :--------- |
| ~ arriba, _ abajo | manda el _ de abajo  | noise + secret_abajo                                      | sí                         | no         |
| _ arriba, ~ abajo | manda el _ de arriba | noise + cualquier _ en el boundary o debajo               | sí                         | no         |
| _ y ~ mismo nodo  | manda ese mismo nodo | noise + secret_de_ese_mismo_nodo                          | sí                         | no         |
| ~ sin _           | no hay scope secreto | puede calcular noise, pero no hay contexto secreto válido | write inválido / edge case | no aplica  |

1. #### Operators:

   `["~"] sin ["_"] ancestro es write inválido. Define un scope secreto primero.`

2. #### Security:

   `["~"] reutilizado en ramas distintas comparte linaje criptográfico. Usa noises únicos si necesitas aislamiento total.`

   Sí puedes poner `["~"]` después de paths públicos. Lo que no puedes es escribir data secreta si no hay ningún `["_"]` ancestro.

   `["~"]` no crea privacidad. Solo corta la herencia criptográfica. `["_"]` crea el cuarto secreto.

   ### La regla exacta:

   ```ts
   // Caso 1: VÁLIDO ✅me.public["_"]("A");     // ← crea scope secreto en publicme.public.child["~"]("N"); // ← corta A, resembra en Nme.public.child.secret("x"); // ← escribe bajo scope=public(A), effective=N
   // Caso 2: INVÁLIDO ❌  me.public["~"]("N");     // ← intenta cortar herencia... pero no hay herenciame.public.secret("x");   // ← Error: No secret context active
   ```

   ### Por qué:

   `["_"]` hace 2 cosas:

   1. Marca el nodo como `stealth` = invisible en lecturas públicas
   2. Registra `secret` en `localSecrets[path]`

   `["~"]` hace 1 cosa:

   1. Registra `noise` en `localNoises[path]` y dice “desde aquí abajo, ignora secrets de arriba”

   Si escribes `me.node("valor")` y `node` no vive bajo ningún `["_"]`, el kernel no sabe dónde guardar el secreto. Por eso tira `No secret context active`.

   ### Cómo pensar `~` sin `_`:

   Es como decir “a partir de aquí, olvida la historia familiar”... pero si nunca hubo familia = `["_"]`, no hay nada que olvidar. Es un no-op que confunde.

   ```ts
   me.root["~"]("N");        // noise registrado, pero sin efectome.root.child("x");       // x es público. N no se usó para nadame.root.child("_")        // Error: no hay scope donde guardar
   ```

   ### Cómo usarlo bien:

   `["~"]` solo tiene sentido en 3 situaciones:

   1. Entre dos `["_"]` para cortar herencia:

   ```ts
   me.wallet["_"]("A");      // dueño viejome.wallet.box["~"]("N");  // caja nueva, olvida Ame.wallet.box["_"]("B");  // dueño nuevome.wallet.box.note("x");  // effective = N+B, no A
   ```

   2. Debajo de un `["_"]` para resetear ramas:

   ```ts
   me.app["_"]("root-key");me.app.user1["~"]("N1");  // user1 no hereda root-keyme.app.user2["~"]("N2");  // user2 tampoco, y N1 ≠ N2
   ```

   3. En el mismo nodo que `["_"]` para rekey:

   ```ts
   me.vault["_"]("old");me.vault["~"]("N");       // corta oldme.vault["_"]("new");     // nuevo dueñome.vault.doc("x");        // effective = N+new
   ```

   ### Respuesta directa:

   ¿Puedes poner `~` después de paths públicos? **Sí.**
   ¿Puedes escribir secretos ahí? No, hasta que algún ancestro tenga `["_"]`.

   Si quieres que `me.public.child` sea secreto pero con linaje cortado, haz:

   ```ts
   me.public["_"]("key");      // abre el cuarto secretome.public.child["~"]("N");  // corta key para child y descendientes  me.public.child.data("x");  // x vive bajo scope=public, effective=N
   ```

   **¿Queda claro?** `~` es tijeras. `_` es la caja fuerte. Necesitas la caja antes de usar tijeras.
