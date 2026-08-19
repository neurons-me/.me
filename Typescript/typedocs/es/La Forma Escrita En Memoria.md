# La Forma Escrita En Memoria

Si escribes en `.me` algo como:

```txt
jabellae.netget.port[80].request[]
|request[]| <= 128
slot(n) = n mod 128
order = timestamp
```

y luego te vas, eso no desaparece como "config temporal". Queda como memoria semántica del kernel: en `memories`, en el `index`, exportable por snapshot, rehidratable después. Igual que hoy quedan dominios, secretos, derivaciones, identidad, etc.

Pero hay dos niveles.

## 1. Queda la declaración

Eso sí queda hoy, aunque todavía sea solo descripción:

```txt
este espacio plural existe
su cardinalidad declarada es 128
su lógica declarada es seq mod 128
su orden es timestamp
```

Otro runtime puede leerlo después y entender: "ah, este nodo no es una lista cualquiera; es un plural con forma de ring".

## 2. Queda o no queda el enforcement

Eso depende de si el kernel ya implementa pluralidad gobernada.

Hoy, si no hay enforcement nativo, la regla queda como conocimiento. El runtime que vuelva a levantar netget tendría que leer esa forma y obedecerla.

En el diseño futuro, cuando `[]` sea kernel-governed, entonces queda mucho más fuerte:

```txt
la regla vive en .me
el kernel la rehidrata
cuando vuelven requests, el kernel sigue aplicando la misma regla
```

O sea: te vas, vuelve el proceso, carga snapshot/memories, y `.me` recuerda no solo los datos, sino **la forma del espacio**.

Eso es lo bonito.

No queda "código JS corriendo" como un daemon eterno. Queda una **forma declarada** que el kernel sabe interpretar.

## El mismo patrón que ya existe con `=`

Es parecido a una derivación `=` hoy:

```txt
total = price * quantity
```

Tú te vas, pero la derivación queda. Cuando cambian `price` o `quantity`, `.me` sabe recomputar porque la relación vive en memoria.

La idea sería que con pluralidad pase igual:

```txt
request[] has cardinality 128
request[n] maps to n mod 128
```

Tú te vas.
La forma queda.
El kernel despierta después.
Carga memorias.
Sigue sabiendo cómo gobernar `request[]`.

## Respuesta corta

> Queda una memoria ejecutable de forma, no solo un dato.

Hoy todavía sería memoria **descriptiva**.
Con kernel-governed plurality sería memoria **activa**.

---

## Ver también

- [Plurality Is Grammar](../Plurality-Is-Grammar.md) — por qué `[]` es gramática (la forma plural), no un tipo de dato; esta nota aplica esa idea a la dimensión de memoria/persistencia, no solo de sintaxis.
- [Algebra of Contexts](../Algebra-of-Contexts.md) — el modelo de espacios sobre el que `request[]` vive.
