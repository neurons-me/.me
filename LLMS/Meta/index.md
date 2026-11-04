---
layout: gui-doc
title: ".me — LLMS · Meta demo"
description: "Type a sentence; Meta Muse Spark proposes .me ops; they are validated, dry-run on a throwaway this.me, and applied only when you confirm."
image: https://neurons-me.github.io/.me/LLMS/assets/llms-og.png
canonical: https://neurons-me.github.io/.me/LLMS/Meta/
mepath:
  - text: LLMS
    url: /.me/LLMS/
crumb: Meta
github_url: https://github.com/neurons-me/.me/tree/main/LLMS/Meta
scripts:
  - https://cdn.jsdelivr.net/npm/this.me@4.2.1/dist/me.umd.js
  - /LLMS/Meta/demo-data.js?v=2
  - /LLMS/Meta/meta-demo.js?v=5
---

# Meta demo

Chat with Meta Muse Spark. When a message holds something worth keeping (a fact, a value, a rule), it proposes the change; you see it checked and dry-run, and nothing is written until you confirm. Values are computed by this.me, not by the model.

<div data-live="MetaDemo"><p>This demo needs JavaScript.</p></div>

The examples replay real responses from `muse-spark-1.3`, recorded in the eval run of 2026-10-29 ([results](https://github.com/neurons-me/.me/blob/main/LLMS/eval/results/meta-muse-spark-1.3-2026-10-29.json): 30/30 valid, 24/30 same final state), with no call to Meta. **Live** uses your own key, from your browser.

## How it works / docs

Install, `META_API_KEY`, `metaModel()` options, `parse()` and what it returns: [Meta adapter docs](docs.html). Validator: [validate.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/validate.ts). Dry-run and apply: [kernel.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/kernel.ts). The browser port of both is [meta-demo.js](https://github.com/neurons-me/.me/blob/main/LLMS/Meta/meta-demo.js).
