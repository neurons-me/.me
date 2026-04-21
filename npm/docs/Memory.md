# Memory

In `.me`, **Memory** is the public, redacted event log exposed by the runtime.

You can access it through:

- `me.memories`
- `me.inspect().memories`
- `me.exportSnapshot().memories`

This public `Memory` shape is **intentionally redacted** — it never exposes internal forensic fields such as `effectiveSecret`.

If you need the full internal log (for kernel debugging), you can access `me._memories`. Note that this is **not** part of the public API.

### Preferred APIs
- Read public memories: `me.memories` or `me.inspect().memories`
- Export safe state: `me.exportSnapshot()`
- Restore / replay: `me.replayMemories(memories)`

## Public `Memory` vs Internal `KernelMemory`

| Type           | Purpose               | Contains `effectiveSecret` | Recommended Use         |
| -------------- | --------------------- | -------------------------- | ----------------------- |
| `Memory`       | Public safe event log | No                         | Most users & normal use |
| `KernelMemory` | Internal forensic log | Yes                        | Kernel debugging only   |

### Important Notes

- `replayMemories()` **does not append** memories. It **resets** the current runtime and rebuilds the entire state from the provided log.
- Both `importSnapshot()` and `replayMemories()` accept public `Memory[]` as well as legacy/internal payloads.

### Quick Example

```ts
import ME from "this.me";

const me = new ME();

// Get public redacted memories
const state = me.inspect();
console.log(state.memories.length);
console.log(Object.hasOwn(state.memories[0] ?? {}, "effectiveSecret")); // → false

// Export and restore
const snapshot = me.exportSnapshot();

const me2 = new ME();
me2.replayMemories(snapshot.memories); // Resets + rebuilds the full runtime
```

### When to Use Each

- me.memories or me.inspect().memories — Normal debugging and inspection
- me.exportSnapshot() — Portable, redacted state sharing
- me.replayMemories() — Full restore, cloning, or test setup
- me._memories — Only when debugging the internal kernel

Summary Table
README Claim	API/Code Status
me.memories	Present, redacted, public
me.inspect()	Exposes memories, safe
me.exportSnapshot().memories	Redacted/safe
me._memories	Present, internal only
Internal field hidden	Yes, effectiveSecret removed
replayMemories()/importSnapshot()	Supported and resets from log

------

**MIT License** © 2025 [neurons.me](https://neurons.me)
