# Memory

In `.me`, **Memory** is the public event shape exposed by the runtime.

It is the format you get from:

- `me.memories`
- `me.inspect().memories`
- `me.exportSnapshot().memories`

This public shape is intentionally **redacted**.
It does **not** expose internal forensic fields such as `effectiveSecret`.

If you are debugging the kernel itself, there is still an internal log
(`_memories`) that keeps the full `KernelMemory` records.
That internal shape is not part of the public API surface.

- Preferred API: `me.memories`
- Preferred inspect field: `me.inspect().memories`
- Preferred replay API: `me.replayMemories(memories)`

## Public vs internal

- `Memory` = safe public log item
- `KernelMemory` = internal kernel log item

`replayMemories()` and `importSnapshot()` accept both:

- public `Memory[]`
- legacy/internal payloads that still contain `effectiveSecret`

### Quick example

```ts
const state = me.inspect();
console.log(state.memories.length);
console.log(Object.hasOwn(state.memories[0] ?? {}, "effectiveSecret")); // false

const snapshot = me.exportSnapshot();
const me2 = new Me();
me2.replayMemories(snapshot.memories);
```
