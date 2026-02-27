# Memory

In `.me`, **Memory** is the canonical event log of the runtime.

- Preferred API: `me.memory`
- Preferred inspect field: `me.inspect().memory`
- Preferred replay API: `me.replayMemory(memory)`

Legacy aliases remain for compatibility:

- `shortTermMemory` (legacy alias of `memory`)
- `inspect().thoughts` (legacy alias of `inspect().memory`)
- `replayThoughts(...)` (legacy alias of `replayMemory(...)`)

### Quick example

```ts
const state = me.inspect();
console.log(state.memory.length);

const snapshot = me.exportSnapshot();
const me2 = new Me();
me2.replayMemory(snapshot.memory);
```
