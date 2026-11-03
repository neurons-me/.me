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
  - /LLMS/Meta/demo-data.js
  - /LLMS/Meta/meta-demo.js
---

# Meta demo

A sentence goes in. Meta Muse Spark proposes .me ops. The ops are validated, dry-run on a throwaway this.me, and applied only when you confirm. The model never computes values; the kernel does.

<div data-live="MetaDemo"><p>This demo needs JavaScript.</p></div>

**Recorded** (default) replays real responses from `muse-spark-1.3`, captured in the eval run of 2026-10-29 ([results file](https://github.com/neurons-me/.me/blob/main/LLMS/eval/results/meta-muse-spark-1.3-2026-10-29.json): 30/30 valid, 24/30 same final state). No network call to Meta. **Live** sends your sentence to the Meta Model API with your own key, from your browser.

Run it locally instead (key from your environment, never in the page):

```sh
cd .me/LLMS/typescript && npm install
META_API_KEY=... node demo-cli.ts "Luis is 30 years old"
```

## How it works / docs

Install, `META_API_KEY`, `metaModel()` options, `parse()` and what it returns: [Meta adapter docs](docs.html). Validator: [validate.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/validate.ts). Dry-run and apply: [kernel.ts](https://github.com/neurons-me/.me/blob/main/LLMS/typescript/src/kernel.ts). The browser port of both is [meta-demo.js](https://github.com/neurons-me/.me/blob/main/LLMS/Meta/meta-demo.js).
