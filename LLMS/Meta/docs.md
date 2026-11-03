---
layout: gui-doc
title: ".me — LLMS · Meta adapter"
description: "How to use the Meta Model API adapter of LLMS: install, META_API_KEY, metaModel() options, parse() and what it returns."
image: https://neurons-me.github.io/.me/LLMS/assets/llms-og.png
canonical: https://neurons-me.github.io/.me/LLMS/Meta/docs.html
mepath:
  - text: LLMS
    url: /.me/LLMS/
  - text: Meta
    url: /.me/LLMS/Meta/
crumb: docs
github_url: https://github.com/neurons-me/.me/tree/main/LLMS/typescript/src/adapters
---

# Meta adapter

Try it first: [the live demo](./).

`metaModel()` turns the Meta Model API into a `ChatModel`: a function from chat messages to reply text. You pass it to `parse()`, which turns a sentence into .me ops, validates them and dry-runs them. The adapter only talks to the API; checking the ops is the core's job.

## Install

The package (`llms-me` 0.1.0) is **not on npm yet** (planned). Use it from the repo. It is TypeScript run directly by Node (`engines: node >=23.6`) and depends on `this.me` ^4.2.1.

```sh
git clone https://github.com/neurons-me/.me.git
cd .me/LLMS/typescript
npm install
npm test        # mocked model, no network
```

## Key and settings

| variable | used for | default |
|---|---|---|
| `META_API_KEY` | API key, required | none |
| `META_BASE_URL` | API base URL | `https://api.meta.ai/v1` |
| `META_MODEL` | model name | `muse-spark-1.3` |

Set the key in your environment. The key only goes into the `Authorization` header; the adapter never logs, throws or returns it. If no key is set, `metaModel()` throws `Meta Model API: META_API_KEY is not set`.

## API

`metaModel(options?) => ChatModel` from `src/adapters/meta.ts`. Every option overrides the matching variable above.

| option | type | default |
|---|---|---|
| `apiKey` | string | `META_API_KEY` |
| `baseUrl` | string | `META_BASE_URL`, then `https://api.meta.ai/v1` |
| `model` | string | `META_MODEL`, then `muse-spark-1.3` |
| `temperature` | number | 0 |
| `fetchImpl` | `typeof fetch` | global `fetch` (pass a mock for tests) |

It sends `POST {baseUrl}/chat/completions` with `{ model, messages, temperature }` and returns `choices[0].message.content`. Requests time out after 60 s. Errors read `Meta Model API <status>: <code>`, `request failed (timeout)` or `reply has no message content`.

`META_DEFAULTS` exports the default base URL and model.

## Usage

```ts
import { parse } from "./src/index.ts";
import { metaModel } from "./src/adapters/meta.ts";

const model = metaModel();               // reads META_API_KEY
const r = await parse(
  { text: "Luis is 30 years old", state: {}, speaker: "luis" },
  { model, maxRepairs: 2 }
);
if (r.ok) console.log(r.ops, r.diff, r.needsConfirm);
else console.log(r.errors);
```

`parse(input, options)`:

- `input`: `text` (required, cut at 4000 characters), optional `state` (current .me as nested JSON), `schema`, `namespace`, `speaker`.
- `options`: `model` (required), `maxRepairs` (0–2, default 2), `secretPaths` (their values are sent to the model only as `<secret>`), `examples`.

## What you get back

`parse()` returns a `ParseResult`:

| field | meaning |
|---|---|
| `ok` | true when the ops passed the schema, the path rules and the dry-run |
| `ops` | validated ops: `set`, `define`, `pointer`, `remove`, `secret`, `noise`, `identity`, `query` |
| `needsConfirm` | the `secret`, `noise`, `identity` and `remove` ops; ask the user before applying them |
| `diff` | `{ path, before, after }` for each path the dry-run changed |
| `reads` | values read by `query` ops |
| `errors` | why it failed, when `ok` is false |
| `attempts`, `raw` | tries used and the raw model replies |

If the reply fails a check, the exact errors go back to the model and it tries again, up to `maxRepairs` times. `parse()` never writes to a real .me. To apply ops, call `applyOps(me, ops, { confirm, secretKeys })`: confirm-ops throw without confirmation, and `secret` / `noise` need a key typed by the user.

## Measured

Eval on our own 30 ES/EN items with `muse-spark-1.3` (2026-10-28): 30/30 valid, 22/30 exact ops, 24/30 same final state, 30/30 correct `needsConfirm`, median latency 2.97 s. Few items, so read it as a smoke test. Run it with `npm run eval -- --adapter meta`.

## Not there yet

- npm package `llms-me` (planned).
- `metaModel()` does not expose `timeoutMs` (fixed at 60 s) or `response_format`; whether api.meta.ai honors `response_format` is unverified.
- Streaming is not supported; the adapter waits for the full reply.

<div class="doc-cards" markdown="0">
<a class="card" href="/.me/LLMS/"><img src="https://neurons-me.github.io/.me/LLMS/assets/llms-hero.png" alt="LLMS hero"><span class="card-kind">Demo</span><span class="card-title">LLMS hero</span><span class="card-desc">Sentences in several languages, the ops muse-spark-1.3 produced for them, computed on the real this.me 4.2.1 kernel in your browser.</span></a>
<a class="card" href="https://github.com/neurons-me/.me/blob/main/LLMS/eval/results/meta-muse-spark-1.3-2026-10-29.json"><img src="https://neurons-me.github.io/.me/LLMS/assets/llms-og.png" alt="Eval results"><span class="card-kind">Eval</span><span class="card-title">Meta eval results</span><span class="card-desc">Every item: text, ops, valid, exact, final state, latency.</span></a>
</div>

Source: [adapters/meta.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/adapters/meta.ts) · [openai-compatible.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/adapters/openai-compatible.ts) · [parse.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/parse.ts)
