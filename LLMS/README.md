# LLMS — natural language → .me operations

> Coherence is a relationship between statements.  
> Correctness is a relationship between a statement and the state it describes.  
> A model can be coherent. Only the state can make it correct.

**Muse proposes, .me decides.** A model answering from probabilistic memory can stay
coherent with itself while the world has moved on. We call this **Contextual Momentum**:
the order was coffee 45 + bread 20 = 65; bread changes to 25; a model extending the old
picture still says "The total is 65" (coherent ✓, not correct ✗, a hallucination). The
`.me` deterministic knowledge graph holds bread 25 and derives total 70. The model only
proposes ops; the kernel validates and computes, so hallucination never becomes state.

Page: https://neurons-me.github.io/.me/LLMS/ (`me://LLMS/`)

## Meta demo (`LLMS/Meta/`): live vs recorded
- **Live:** the first three turns (coffee 45 → bread 25 → total 70) call Meta
  `muse-spark-1.3` at recording time through `api.meta.ai/v1`.
- **Recorded:** the drift question, the rejected `tip` proposal, and tax + split (81.2)
  replay a real `muse-spark-1.3` run saved in `LLMS/Meta/recorded-en.json` (2026-11-04);
  they are not live calls and the page labels them as recorded.
- The opening 65 vs 70 comparison is an illustrative example, not Muse output.
- Pre-existing: the `this.me` kernel and .GUI. Built this week: LLMS chat,
  Muse adapter, validator.

A model turns plain text (ES/EN) into a JSON list of `.me` ops. The ops are then
**parsed → validated (schema + path rules) → dry-run on a throwaway ME → diffed**.
Ops that touch `_` (secret), `~` (noise), `@` (identity) or `-` (remove) come back with
`needsConfirm`. The model never writes secret values: values under secret paths are sent to
it as `<secret>`, and `set` ops on password/key/seed-like paths are rejected. If the output
is invalid, the model gets 1–2 repair tries.

## Layout
- `grammar.md`: path rules and op → kernel call table
- `ops.schema.json`: JSON schema for ops
- `prompt/system.md`, `prompt/examples.json`: system prompt and 10 few-shot examples
- `eval/eval.jsonl`: 30 hand-written ES/EN items. `eval/results/`: measured runs
- `typescript/`: the `llms-me` package (core, adapters `meta`, `openai`, tests, eval runner)

## Run (Node ≥ 22.6, which runs .ts natively)
```sh
cd LLMS/typescript && npm install
npm test                                   # mocked model, no network
META_API_KEY=… npm run eval -- --adapter meta      # muse-spark-1.3 via api.meta.ai/v1
OPENAI_API_KEY=… npm run eval -- --adapter openai
```

## Eval: Meta muse-spark-1.3, 2026-10-28, 30 items
| metric | result |
|---|---|
| valid ops | 30/30 |
| exact ops | 22/30 (73.3%) |
| same final state | 24/30 (80.0%), ES 11/15, EN 13/15 |
| needsConfirm correct | 30/30 |
| repair used | 0 |
| latency | median 2.97 s, max 25.0 s |

These items are our own and few, so read the numbers as a smoke test, not a benchmark.
OpenAI has not been evaluated yet (no key).

## Open issues
- Path naming: in Spanish, the model keeps Spanish keys (`inventario`, `perfil.publico`,
  `contraseñas`), and its names differ from ours (`adult` vs `isAdult`, `current.car` vs
  `me.car`). We need a canonical path policy, or to score against the existing ME's keys.
- Some exact misses are equivalent expressions (`subtotal * 10 / 100` vs `subtotal * 0.1`).
- Whether api.meta.ai honors `response_format` is unverified; output is parsed leniently.
- `this.me@4.2.2` is not on npm, so the dependency is `^4.2.1`.
- No hosted proxy yet: keys must be held server-side, never in the browser.
