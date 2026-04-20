# Implementación de el Fractalismo de Privacidad. 

*No usamos una “base de datos con cifrado”; tratamos el espacio lógico como una estructura derivable cuya visibilidad solo se resuelve ante la cadena correcta de secretos.*

**Proxies como Superficie Infinita:** Al usar `me.cualquier.cosa`, permites que el usuario declare realidad en lugar de llenar un formulario predefinido. Es el paso del "Schema-First" al "Existence-First".

**El Secreto como Operador de Fase:** Cuando haces `me.wallet.secret("ABC")`, no estás moviendo los datos a otro lugar. Estás cambiando la fase de visibilidad de esa rama. Si no tienes "ABC", esa rama es indistinguible del vacío (0), cumpliendo tu **Nivel 0:** `presencia/ausencia.`
Invarianza y Portabilidad: Al ser zero dependencies y generar un deterministic structure, el **.me** de un usuario es una partícula lógica que puede viajar de Node al Browser sin perder su ontología.

`me.wallet.balance(500).secret("XYZ");`

Esto implica que el Estado del objeto **.me** cambia su comportamiento interno basándose en la profundidad del árbol. Es una estructura de datos que sabe en qué dimensión está operando.

### **Estas son las jugadas que ya puedes hacer:**

**Aritmética Directa:**
`me.wallet["="]("neto", "ingresos - gastos")`
El sistema busca "ingresos" y "gastos" en la misma rama o en el índice y los resta.

**Aritmética Cruzada (Wormholes):**
`me.wallet["="]("balance", "__ptr.global.base + ingresos")`
Gracias a tu lógica de __ptr., puedes traer un valor de otra galaxia (otra rama) y sumarlo a la tuya.

**Cómputo en la Raíz (Thunks):**
`me["="](() => 2 + 2)`
Esto no guarda nada, solo usa el cerebro de ME para darte un resultado rápido.

### La Gramática de la "Proyección" (?)

Este es tu operador de Consulta (Query). Es como preguntarle al universo qué hay ahí afuera:
**Recolección (Collector):**
`me["?"](["perfil.nombre", "wallet.neto"])`
Te devuelve un array ["Abella", 500]. Es una foto de varios puntos del fractal a la vez.

**Transformación:**
`me["?"](["ingresos", "gastos"], (a, b) => a > b ? "Ganancia" : "Pérdida")`
No solo lee, sino que decide qué decirte basado en los datos.

### La Gramática de la "Invisibilidad" (_ y ~)

Estos no son solo para guardar, son operadores de estado.

**Enmascaramiento:**
`me.secreto["_"]("mi-llave")`
Cambia la "física" de todo lo que cuelga de ahí. Los datos dejan de ser legibles para el índice público.

**Pared de Humo (Noise):**
`me.capa["~"]("ruido-extra")`
Corta la herencia. Es un "reset" de seguridad.

### **Física de la Observación. STM** - 

El memories es el registro genético de cómo llegaste ahí. Si borras el index, puedes reconstruir tu universo entero simplemente "volviendo a pensar" los pensamientos de la STM.

**A8 (Integridad de Cadena):** Al incluir prevHash en el hashInput, has creado un vínculo criptográfico. Si alguien cambia el pasado, el presente "se desintegra" porque el hash ya no coincide. Es el fin de la mutabilidad silenciosa.
**A9 (Determinismo Total):** Tu lógica de .sort((a, b) => ...) con triple fallback (timestamp -> hash -> index) asegura que no existe la ambigüedad. Si dos eventos ocurren en el mismo milisegundo, el hash (que es único) rompe el empate. Esto es arquitectura de sistemas distribuidos nivel "Senior Staff".

# Secretos y Ruido

`["_"]` es privacidad estructural — define quién puede ver qué. `["~"]` es discontinuidad criptográfica — redefine de dónde viene la cadena de derivación. Son ortogonales. Puedes tener uno sin el otro.

El caso concreto lo clavó:

```
A + B  →  nota        (sin ~, hereda toda la genealogía)
N + B  →  nota        (con ~, A quedó amputado del árbol de derivación)
```

Eso no es solo "más privacidad" — es un reset de linaje. La nota sigue siendo secreta con B, pero ya no hay forma de demostrar que alguna vez estuvo relacionada con A. Eso tiene implicaciones reales: dos ramas con el mismo `["_"]` ancestral pero con `["~"]` entre ellas son criptográficamente independientes aunque compartan el árbol lógico.

El riesgo de colisión es efectivamente cero en la práctica.

El noise no es un número pequeño. Si `["~"]("N")` toma `N` y lo pasa por `hash("noise::N")` antes de sembrar la cadena, estás trabajando en un espacio de 2^256. La probabilidad de que dos noises distintos produzcan el mismo punto de arranque es astronómicamente baja — del orden de encontrar dos archivos distintos con el mismo SHA-256.

La derivación efectiva no es solo el noise — es `noise + path`. Entonces aunque `N` sea el mismo:

```
trabajo.leaf   →  hash(N + "trabajo.leaf")
personal.leaf  →  hash(N + "personal.leaf")
```

Los paths son distintos, entonces las claves finales son distintas. No hay conflicto de datos, no se mezcla nada.

Lo único que comparten es el origen abstracto — como dos ríos que nacen del mismo manantial pero fluyen por cañones distintos. El agua de uno nunca toca al otro.

---

## .me Kernel

No hay aviso de doble uso de noise. Así que hoy es responsabilidad del usuario.

**Sí hay una sutileza importante:** reutilizar el mismo `noise` en dos ramas no implica que los blobs finales colisionen. La derivación v3 mezcla no solo el lineage, sino también `scopePath`, `anchorPath` y `pathContext` en `collectSecretChainV3(...)` de `src/secret-context.ts` y `deriveBlobV3Keys(...)` de `src/crypto.ts`. O sea:

- mismo `noise`
- incluso mismo secret local
- ramas distintas

pueden dar el mismo `computeEffectiveSecret(...)` lógico, pero aun así producir blobs distintos por el path. Eso sí: si alguien ve un snapshot completo, `localNoises` sí sale exportado en claro en `exportSnapshot(...)` de `src/core-snapshot.ts`, así que la reutilización puede filtrar “estas dos ramas comparten el mismo seed semántico”.

**Sobre el caso que cierra el modelo mental:**

No sale `effective = N`.
Sale `effective = N + B`.

Porque el código corta los secretos por arriba del noise boundary, pero conserva el secreto del mismo nodo cuando el secreto cae dentro del boundary activo, como se ve en `computeEffectiveSecret(...)` de `src/secret-context.ts`.

El árbol “**según la lógica de derivación del código**” queda así:

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
