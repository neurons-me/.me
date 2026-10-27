---
layout: gui-doc
title: ".me — GTFS-Madrid benchmark"
description: "GTFS-Madrid-Bench on this.me 4.2.1: how many values one write recomputes (k) as the data grows, fan-out skew, DELETE cost and the [] aggregate, with 4.2.0 and 4.1.0 kept as history. Script, command and results for every run."
image: https://suign.github.io/assets/imgs/MADRID-GRAPH-ME.jpg
mepath:
  - text: Benchmarks
    url: https://neurons-me.github.io/.me/docs/Benchmarks/
  - text: GTFS
    url: https://neurons-me.github.io/.me/docs/Benchmarks/GTFS/
crumb: Madrid
scripts:
  - /assets/kernel-timeline/kernel-timeline.js?v=4
---

# GTFS-Madrid

> **Question:** when one row of Madrid's transit feed changes, how many values does .me recompute, and does that grow with the city?
>
> **Answer (measured, [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1)):** no. A write recomputed k = 1 value at the median, 18 at p95 and 27 at most, at scale 1 (2,364 stop_times) and at scale 10 (23,640); the scale-100 run on [this.me 4.1.0](https://www.npmjs.com/package/this.me/v/4.1.0) (236,400) gave the same 1 / 18 / 27. What grows with the data is a delete: 8.9 ms p50 at scale 1, 119 ms at scale 10.

The feed is [GTFS-Madrid-Bench](https://github.com/oeg-upm/gtfs-bench), changed with the benchmark's own update packages. **k** is `explain(probe).meta.k` ([me.explain(path)](https://neurons-me.github.io/.me/docs/Explain.html)), the number of derived values one write recomputes; [Extreme Fan-Out](../../../Extreme-Fan-Out.html) explains the wave it counts.

**Live:** [AI decides, .me computes →](https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/) runs on the same scale-1 / scale-10 feed in your browser, also on [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1). Its k is much larger, and that is expected: there one write changes `policy.factor`, a value every headway reads, so the wave is the whole headway subtree (every window, trip and route), the fan-out case of [Extreme Fan-Out](../../../Extreme-Fan-Out.html). Here each write is one feed row, so the wave is that row's foreign-key neighbourhood. Its timings come from a browser Web Worker, these from Node.

**Run:** [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) from npm (`dist/me.es.js` sha256 `0bd2cc60d15dfc9ff8942d390c075bbc22b4ae3a24d3cbfe581511ea84478757`), Node v22.23.3, shared KVM VM (Intel Xeon, 8 vCPU, 16 GiB), Linux 6.12, 2026-10-13 (UTC). History rows: [this.me 4.2.0](https://www.npmjs.com/package/this.me/v/4.2.0) (sha256 `8cc94d5273b05728713e7c06bcba6ab0d88c85d2a748dc885e7bca745605a61a`, same VM, 2026-10-10) and [this.me 4.1.0](https://www.npmjs.com/package/this.me/v/4.1.0). Every results file records its own run line.

## Data and workload {#data}

The Van Assche et al. CHANGE packages ([Zenodo 10.5281/zenodo.14038823](https://zenodo.org/records/14038823)): [GTFS-Scale-1-CHANGE.tar.xz](https://zenodo.org/records/14038823/files/GTFS-Scale-1-CHANGE.tar.xz), [GTFS-Scale-10-CHANGE.tar.xz](https://zenodo.org/records/14038823/files/GTFS-Scale-10-CHANGE.tar.xz), [GTFS-Scale-100-CHANGE.tar.xz](https://zenodo.org/records/14038823/files/GTFS-Scale-100-CHANGE.tar.xz), generated with VIG from GTFS-Madrid-Bench (sizes and what to extract: [Madrid GTFS dataset](https://neurons-me.github.io/mlearning.studio/datasets/madrid-gtfs/)). Each run loads `base`, then applies every CREATE / UPDATE / DELETE from `seed0` and measures each write. Write time is the write itself, including its propagation wave.

## How GTFS maps onto .me {#mapping}

Rows become paths (`gtfs.trips.T1.serviceId`, written as `me.gtfs.trips.T1.serviceId(value)`, see [me.whatever(what)](https://neurons-me.github.io/.me/docs/me-whatever-what.html)) and foreign keys become dependencies:

<div class="doc-svg" data-min="520px" markdown="0"><figure><svg viewBox="0 0 600 236" role="img" aria-label="GTFS foreign keys become .me dependencies" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Menlo,monospace" font-size="11.5"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="currentColor" fill-opacity=".55"/></marker></defs><rect x="4" y="8" width="170" height="40" rx="8" fill="#2e9d6e" fill-opacity=".12" stroke="#2e9d6e"/><text x="89.0" y="25" text-anchor="middle" fill="currentColor" font-weight="700">calendar.txt</text><text x="89.0" y="40" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">days, start/end dates</text><rect x="214" y="8" width="170" height="40" rx="8" fill="#58a6ff" fill-opacity=".12" stroke="#58a6ff"/><text x="299.0" y="25" text-anchor="middle" fill="currentColor" font-weight="700">services.S.active</text><text x="299.0" y="40" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">= days &amp;&amp; dates</text><rect x="424" y="8" width="172" height="40" rx="8" fill="#58a6ff" fill-opacity=".12" stroke="#58a6ff"/><text x="510.0" y="25" text-anchor="middle" fill="currentColor" font-weight="700">trips.T.live</text><text x="510.0" y="40" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">= services.S.active</text><line x1="174" y1="28" x2="212" y2="28" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><line x1="384" y1="28" x2="422" y2="28" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><rect x="4" y="68" width="170" height="40" rx="8" fill="#2e9d6e" fill-opacity=".12" stroke="#2e9d6e"/><text x="89.0" y="85" text-anchor="middle" fill="currentColor" font-weight="700">routes.txt</text><text x="89.0" y="100" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">route row</text><rect x="214" y="68" width="170" height="40" rx="8" fill="#58a6ff" fill-opacity=".12" stroke="#58a6ff"/><text x="299.0" y="85" text-anchor="middle" fill="currentColor" font-weight="700">routes.R.active</text><text x="299.0" y="100" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">DELETE → absent</text><rect x="424" y="68" width="172" height="40" rx="8" fill="#58a6ff" fill-opacity=".12" stroke="#58a6ff"/><text x="510.0" y="85" text-anchor="middle" fill="currentColor" font-weight="700">trips.T.validRoute</text><text x="510.0" y="100" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">= routes.R.active</text><line x1="174" y1="88" x2="212" y2="88" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><line x1="384" y1="88" x2="422" y2="88" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><rect x="4" y="128" width="170" height="40" rx="8" fill="#2e9d6e" fill-opacity=".12" stroke="#2e9d6e"/><text x="89.0" y="145" text-anchor="middle" fill="currentColor" font-weight="700">trips.txt</text><text x="89.0" y="160" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">route_id, service_id</text><rect x="214" y="128" width="170" height="40" rx="8" fill="#58a6ff" fill-opacity=".12" stroke="#58a6ff"/><text x="299.0" y="145" text-anchor="middle" fill="currentColor" font-weight="700">trips.T.routeId</text><text x="299.0" y="160" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">route code</text><rect x="424" y="128" width="172" height="40" rx="8" fill="#58a6ff" fill-opacity=".12" stroke="#58a6ff"/><text x="510.0" y="145" text-anchor="middle" fill="currentColor" font-weight="700">stopTimes.*.routeId</text><text x="510.0" y="160" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">= trips.T.routeId</text><line x1="174" y1="148" x2="212" y2="148" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><line x1="384" y1="148" x2="422" y2="148" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><rect x="4" y="188" width="170" height="40" rx="8" fill="#2e9d6e" fill-opacity=".12" stroke="#2e9d6e"/><text x="89.0" y="205" text-anchor="middle" fill="currentColor" font-weight="700">stop_times.txt</text><text x="89.0" y="220" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">one row per stop</text><rect x="214" y="188" width="170" height="40" rx="8" fill="#f0b429" fill-opacity=".12" stroke="#f0b429"/><text x="299.0" y="205" text-anchor="middle" fill="currentColor" font-weight="700">idx…Member.&lt;slot></text><text x="299.0" y="220" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">0 → 1 on CREATE</text><rect x="424" y="188" width="172" height="40" rx="8" fill="#f0b429" fill-opacity=".12" stroke="#f0b429"/><text x="510.0" y="205" text-anchor="middle" fill="currentColor" font-weight="700">tripCount, stopTimeCount</text><text x="510.0" y="220" text-anchor="middle" fill="currentColor" fill-opacity=".6" font-size="10">= sum of slots</text><line x1="174" y1="208" x2="212" y2="208" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/><line x1="384" y1="208" x2="422" y2="208" stroke="currentColor" stroke-opacity=".55" stroke-width="1.5" marker-end="url(#ah)"/></svg><figcaption>Green: feed files. Blue: derived values a feed write reaches. Amber: CREATE membership slots and the counts that sum them. A write recomputes only what is downstream of it.</figcaption></figure></div>

- `services.S.active` ← [calendar.txt](https://neurons-me.github.io/mlearning.studio/datasets/madrid-gtfs/) days and dates ([adapter.ts L149](https://github.com/neurons-me/.me/blob/15a5509/Typescript/tests/Benchmarks/GTFS-Madrid/adapter.ts#L149))
- `trips.T.live ← services.S.active`, through `service_id` in [trips.txt](https://neurons-me.github.io/mlearning.studio/datasets/madrid-gtfs/) ([L160](https://github.com/neurons-me/.me/blob/15a5509/Typescript/tests/Benchmarks/GTFS-Madrid/adapter.ts#L160))
- `trips.T.validRoute ← routes.R.active`, through `route_id` in [routes.txt](https://neurons-me.github.io/mlearning.studio/datasets/madrid-gtfs/) ([L162](https://github.com/neurons-me/.me/blob/15a5509/Typescript/tests/Benchmarks/GTFS-Madrid/adapter.ts#L162))
- `stopTimes.*.routeId ← trips.T.routeId`, through `trip_id` in [stop_times.txt](https://neurons-me.github.io/mlearning.studio/datasets/madrid-gtfs/) ([L174](https://github.com/neurons-me/.me/blob/15a5509/Typescript/tests/Benchmarks/GTFS-Madrid/adapter.ts#L174))
- one count per parent (`tripCount`, `stopTimeCount`), a sum over membership slots ([L270–294](https://github.com/neurons-me/.me/blob/15a5509/Typescript/tests/Benchmarks/GTFS-Madrid/adapter.ts#L270-L294))

k counts the derived values reached from the written row through those edges. This is **not** an RML/RDF materializer: it measures how a change propagates after the graph exists, not how a knowledge graph is built.

## Setup {#setup}

Node ≥ 22.6 (it runs the `.ts` files directly). All commands run from `Typescript/`. Full details in the [GTFS-Madrid README](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/README.md).

```bash
git clone https://github.com/neurons-me/.me.git && cd .me/Typescript
npm install
npm pack this.me@4.2.1 && tar xzf this.me-4.2.1.tgz
rm -rf dist && mv package/dist dist
sha256sum dist/me.es.js
```

`sha256sum` should print `0bd2cc60…8478757` (full value above). Put the Zenodo CHANGE CSVs in `tests/Benchmarks/GTFS-Madrid/data/scale{1,10}/{base,seed0}/`. The scale-10 sweep takes about 1 minute, the skew sweep about 16 minutes.

## 1. How many values a write touches as the data grows {#k-vs-n}

<div class="doc-svg" data-max="560px" markdown="0"><figure><svg viewBox="0 0 560 200" role="img" aria-label="k per write versus data size" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Menlo,monospace" font-size="11"><line x1="52" x2="450" y1="160.0" y2="160.0" stroke="currentColor" stroke-opacity=".12"/><text x="44" y="164.0" text-anchor="end" fill="currentColor" fill-opacity=".6">0</text><line x1="52" x2="450" y1="112.66666666666667" y2="112.66666666666667" stroke="currentColor" stroke-opacity=".12"/><text x="44" y="116.66666666666667" text-anchor="end" fill="currentColor" fill-opacity=".6">10</text><line x1="52" x2="450" y1="65.33333333333334" y2="65.33333333333334" stroke="currentColor" stroke-opacity=".12"/><text x="44" y="69.33333333333334" text-anchor="end" fill="currentColor" fill-opacity=".6">20</text><line x1="52" x2="450" y1="18.0" y2="18.0" stroke="currentColor" stroke-opacity=".12"/><text x="44" y="22.0" text-anchor="end" fill="currentColor" fill-opacity=".6">30</text><text x="52" y="178" text-anchor="middle" fill="currentColor" fill-opacity=".75">scale 1</text><text x="52" y="191" text-anchor="middle" fill="currentColor" fill-opacity=".5">2,364 stop_times</text><text x="251.0" y="178" text-anchor="middle" fill="currentColor" fill-opacity=".75">scale 10</text><text x="251.0" y="191" text-anchor="middle" fill="currentColor" fill-opacity=".5">23,640 stop_times</text><text x="450" y="178" text-anchor="middle" fill="currentColor" fill-opacity=".75">scale 100</text><text x="450" y="191" text-anchor="middle" fill="currentColor" fill-opacity=".5">236,400 stop_times · 4.1.0</text><polyline points="52.0,32.2 251.0,32.2 450.0,32.2" fill="none" stroke="#e5534b" stroke-width="2.5"/><circle cx="52.0" cy="32.2" r="4" stroke="#e5534b" stroke-width="1.5" fill="#e5534b"/><circle cx="251.0" cy="32.2" r="4" stroke="#e5534b" stroke-width="1.5" fill="#e5534b"/><circle cx="450.0" cy="32.2" r="4" stroke="#e5534b" stroke-width="1.5" stroke-dasharray="3 2" fill="none"/><text x="460" y="36.2" fill="#e5534b" font-weight="700">k max 27</text><polyline points="52.0,72.4 251.0,74.8 450.0,74.8" fill="none" stroke="#f0b429" stroke-width="2.5"/><circle cx="52.0" cy="72.4" r="4" stroke="#f0b429" stroke-width="1.5" fill="#f0b429"/><circle cx="251.0" cy="74.8" r="4" stroke="#f0b429" stroke-width="1.5" fill="#f0b429"/><circle cx="450.0" cy="74.8" r="4" stroke="#f0b429" stroke-width="1.5" stroke-dasharray="3 2" fill="none"/><text x="460" y="78.8" fill="#f0b429" font-weight="700">k p95 18</text><polyline points="52.0,155.3 251.0,155.3 450.0,155.3" fill="none" stroke="#58a6ff" stroke-width="2.5"/><circle cx="52.0" cy="155.3" r="4" stroke="#58a6ff" stroke-width="1.5" fill="#58a6ff"/><circle cx="251.0" cy="155.3" r="4" stroke="#58a6ff" stroke-width="1.5" fill="#58a6ff"/><circle cx="450.0" cy="155.3" r="4" stroke="#58a6ff" stroke-width="1.5" stroke-dasharray="3 2" fill="none"/><text x="460" y="159.3" fill="#58a6ff" font-weight="700">k p50 1</text></svg><figcaption>k per write (p50, p95, max) at three VIG scales. Filled: this.me 4.2.1. Hollow: scale 100, this.me 4.1.0 (not re-run). The data grows 100×; the lines stay flat.</figcaption></figure></div>

| kernel | scale | stop_times | writes | k p50 / p95 / max | write p50 / p95 (ms) | CREATE p50 | DELETE p50 | load (ms) |
|---|---:|---:|---:|---|---|---:|---:|---:|
| [4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) | 1 | 2,364 | 151 | 1 / 18.5 / 27 | 0.23 / 9.4 | 0.20 | 8.9 | 494 |
| [4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) | 10 | 23,640 | 1,304 | 1 / 18 / 27 | 0.21 / 122 | 0.20 | 119 | 4,244 |
| [4.2.0](https://www.npmjs.com/package/this.me/v/4.2.0) (history) | 1 | 2,364 | 151 | 1 / 18.5 / 27 | 0.29 / 9.4 | 0.24 | 9.2 | 476 |
| [4.2.0](https://www.npmjs.com/package/this.me/v/4.2.0) (history) | 10 | 23,640 | 1,304 | 1 / 18 / 27 | 0.22 / 165 | 0.21 | 144 | 4,730 |
| [4.1.0](https://www.npmjs.com/package/this.me/v/4.1.0) (history) | 100 | 236,400 | 13,401 | 1 / 18 / 27 | not re-run | — | — | — |

k is identical on 4.1.0, 4.2.0 and 4.2.1 for every write. The write p95 at scale 10 is the deletes (run 3). Scale 100 was not re-run on 4.2.1: the archive is 1.2 GB and, with each delete scanning the store (run 3), the sweep's roughly 2,400 deletes would take on the order of an hour on this VM. It stays as 4.1.0 history.

- Script: [sweep-seed0.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts)
- Results: [results/v4.2.1/explicit/](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/v4.2.1/explicit) · history: [v4.2.0](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/v4.2.0/explicit), [4.1.0 scale 100](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/scale1-vs-scale10-vs-scale100-summary.md)

```bash
ME_VERSION=4.2.1 node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=1
ME_VERSION=4.2.1 node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=10
```

## 2. What a write costs when one parent is huge {#skew}

VIG grows the data uniformly (every trip keeps about 18 stop_times), while real feeds are uneven. So the skew run reassigns `trips.service_id` and `stop_times.trip_id` with Zipf (a = 0 … 2) and hub profiles at scale 10, same row counts, 3 seeds each (22 runs), and replays the same workload plus a census of the widest parents.

<div class="doc-svg" data-max="560px" markdown="0"><figure><svg viewBox="0 0 560 230" role="img" aria-label="write time versus k" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Menlo,monospace" font-size="11"><line x1="52" x2="540" y1="186.0" y2="186.0" stroke="currentColor" stroke-opacity=".12"/><text x="46" y="190.0" text-anchor="end" fill="currentColor" fill-opacity=".6">0.1</text><line x1="52" x2="540" y1="144.0" y2="144.0" stroke="currentColor" stroke-opacity=".12"/><text x="46" y="148.0" text-anchor="end" fill="currentColor" fill-opacity=".6">1</text><line x1="52" x2="540" y1="102.0" y2="102.0" stroke="currentColor" stroke-opacity=".12"/><text x="46" y="106.0" text-anchor="end" fill="currentColor" fill-opacity=".6">10</text><line x1="52" x2="540" y1="60.0" y2="60.0" stroke="currentColor" stroke-opacity=".12"/><text x="46" y="64.0" text-anchor="end" fill="currentColor" fill-opacity=".6">100</text><line x1="52" x2="540" y1="18.0" y2="18.0" stroke="currentColor" stroke-opacity=".12"/><text x="46" y="22.0" text-anchor="end" fill="currentColor" fill-opacity=".6">1000 ms</text><text x="52.0" y="204" text-anchor="middle" fill="currentColor" fill-opacity=".6">1</text><text x="161.0" y="204" text-anchor="middle" fill="currentColor" fill-opacity=".6">10</text><text x="270.0" y="204" text-anchor="middle" fill="currentColor" fill-opacity=".6">100</text><text x="379.0" y="204" text-anchor="middle" fill="currentColor" fill-opacity=".6">1,000</text><text x="488.0" y="204" text-anchor="middle" fill="currentColor" fill-opacity=".6">10,000</text><text x="296.0" y="222" text-anchor="middle" fill="currentColor" fill-opacity=".75">k = values the write recomputes (log)</text><polyline points="132.5,158.2 242.3,135.7 296.2,112.6 350.6,93.1" fill="none" stroke="#58a6ff" stroke-width="2.5"/><circle cx="132.5" cy="158.2" r="3.5" fill="#58a6ff"/><circle cx="242.3" cy="135.7" r="3.5" fill="#58a6ff"/><circle cx="296.2" cy="112.6" r="3.5" fill="#58a6ff"/><circle cx="350.6" cy="93.1" r="3.5" fill="#58a6ff"/><polyline points="132.5,58.3 242.3,58.3 296.2,56.7 350.6,53.8 405.0,48.4 459.5,34.8 496.6,23.0" fill="none" stroke="#e5534b" stroke-width="2.5"/><circle cx="132.5" cy="58.3" r="3.5" fill="#e5534b"/><circle cx="242.3" cy="58.3" r="3.5" fill="#e5534b"/><circle cx="296.2" cy="56.7" r="3.5" fill="#e5534b"/><circle cx="350.6" cy="53.8" r="3.5" fill="#e5534b"/><circle cx="405.0" cy="48.4" r="3.5" fill="#e5534b"/><circle cx="459.5" cy="34.8" r="3.5" fill="#e5534b"/><circle cx="496.6" cy="23.0" r="3.5" fill="#e5534b"/><text x="60" y="28" fill="#e5534b" font-weight="700">DELETE ≈ 111 ms + 49 µs·k</text><text x="60" y="44" fill="#58a6ff" font-weight="700">UPDATE ≈ 0.045 ms + 35 µs·k</text></svg><figcaption>Median write time by k bucket, all 22 runs pooled, this.me 4.2.1. An UPDATE costs in proportion to k. A DELETE starts at about 110 ms whatever k is (it scans the store, run 3) and only then grows with k.</figcaption></figure></div>

| profile | k max (widest parent) | UPDATE p50 (ms) | DELETE p50 (ms) | rebuild (ms) | rebuild ÷ UPDATE |
|---|---:|---:|---:|---:|---:|
| VIG | 27 | 0.45 (4.2.0: 0.53) | 117 (140) | 3,604 (5,784) | 7,932× (10,932×) |
| Zipf 1 | 3,051 | 0.30 (0.48) | 112 (140) | 3,654 (5,163) | 12,059× (10,849×) |
| Zipf 2 | 14,378 | 0.14 (0.20) | 117 (146) | 3,875 (4,974) | 27,942× (24,578×) |
| hub 50% | 11,820 | 0.23 (0.32) | 117 (137) | 3,789 (4,759) | 16,220× (14,713×) |

All values [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1); in brackets [this.me 4.2.0](https://www.npmjs.com/package/this.me/v/4.2.0). Zipf 1 / 2: exponent a = 1 / 2; hub 50%: one service and one trip own half of their children. k is identical on both kernels.

- **k follows the parent you touch.** The median write is still k = 1; the tail is the widest parent (k max = its stop_times).
- **UPDATE cost is linear in k:** about 0.045 ms + 35 µs per recomputed value (r = 0.99, 1,100 writes; 4.2.0: 52 µs). 4.2.1 compiles each formula once per kernel instead of on every recompute ([CHANGELOG](https://github.com/neurons-me/.me/blob/main/Typescript/CHANGELOG.md)). The largest wave (a service with 801 trips, k = 801) took 30 ms at worst (4.2.0: 52 ms), about **120× under a ~3.7 s rebuild**. That is the worst case; for the ordinary seed0 UPDATEs, rebuild ÷ apply p50 is 7,900–28,000×.
- **A CREATE on a giant parent costs more than k = 1 suggests.** k is 1 (the parent's count), but the count is a sum with one term per member, so re-evaluating it costs the parent's width: 0.02 ms at the median trip, 95 ms at 14,378 members (4.2.0: 151 ms).

- Scripts: [generate-skew.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/skew/generate-skew.ts) (makes the data), [sweep-skew.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/skew/sweep-skew.ts) (runs it), [report-skew.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/skew/report-skew.ts) (writes the tables)
- Results: [results/skew/v4.2.1/](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/skew/v4.2.1) · history: [v4.2.0](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/skew/v4.2.0)

```bash
node tests/Benchmarks/GTFS-Madrid/skew/generate-skew.ts --scale=10
ME_VERSION=4.2.1 node --expose-gc tests/Benchmarks/GTFS-Madrid/skew/sweep-skew.ts --scale=10
node tests/Benchmarks/GTFS-Madrid/skew/report-skew.ts --scale=10
```

## 3. What a delete costs (known weakness) {#delete}

**UPDATE cost follows k; DELETE cost does not.** Each delete, `me["-"]`, scans the store: about 110–117 ms p50 at scale 10 whatever k is (run 2's table: the same from k max 27 to 14,378), against 8.9 ms at scale 1. So a delete's cost depends on **n**, the size of the data, not on **k**. On top of that it adds about 49 µs per k (4.2.0: 67 µs). Worst measured on 4.2.1: 842 ms to delete the 14,378-stop_time hub trip (4.2.0: 1.2 s), still under the rebuild.

**Not fixed.** The scan is still there on 4.2.1; deletes are about 20% faster than on 4.2.0 because each recomputed formula is cheaper, not because the scan changed. The likely cause: since 4.1.0, removing a subtree scans every subscribed path (`Object.keys(refSubscribers)`) to find what read the removed paths, and the same removal also walks every derivation and index key. Each of those is a full pass over the store, once per delete.

Deletes are a phase of the same skew run, no separate command.

- Scripts and command: the same as run 2
- Results: [results/skew/v4.2.1/](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/skew/v4.2.1)

## 4. The `[]` aggregate as the count {#bracket-aggregate}

[this.me 4.2.0](https://www.npmjs.com/package/this.me/v/4.2.0) added collection aggregates (`stopTimeMember[].on`). Used for the counts on [this.me 4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1), k is the same, but every CREATE re-scans the collection: 3.3 ms p50 at scale 1 and 42 ms at scale 10 (4.2.0: 3.5 and 50), instead of 0.20 ms with explicit sums, and loading scale 10 takes 63 s (4.2.0: 71 s) instead of 4.2 s. So it does not fix the giant-parent CREATE (run 2) yet, and the benchmark keeps explicit sums.

- Script: [sweep-seed0.ts](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts) with `GTFS_AGG=bracket`
- Results: [results/v4.2.1/bracket/](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/v4.2.1/bracket) · history: [v4.2.0](https://github.com/neurons-me/.me/tree/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/v4.2.0/bracket)

```bash
GTFS_AGG=bracket ME_VERSION=4.2.1 node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=1
GTFS_AGG=bracket ME_VERSION=4.2.1 node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=10
```

## Across versions {#versions}

<div class="kernel-timeline" data-src="{{ '/docs/Benchmarks/data/madrid-versions.json' | relative_url }}" markdown="1">

The interactive chart needs JavaScript. The same numbers, each with the results file it comes from: [madrid-versions.json]({{ '/docs/Benchmarks/data/madrid-versions.json' | relative_url }}).

</div>

| version | what changed (CHANGELOG) | UPDATE per k | trip DELETE p50 (scale 10) | scale-10 load | `[]` CREATE p50 |
|---|---|---:|---:|---:|---:|
| [4.1.0](https://www.npmjs.com/package/this.me/v/4.1.0) | Correctness release for derived values: topological wave, early cutoff, removals, cycles | 58 µs (2026-10-07) | 171 ms | 4,414 ms | not measured (no `[]` yet) |
| [4.2.0](https://www.npmjs.com/package/this.me/v/4.2.0) | Adds the `[]` collection aggregate; formulas through pointers recompute (#4); root `_` stealth for guests | 52 µs | 144 ms | 4,730 ms | 50 ms |
| [4.2.1](https://www.npmjs.com/package/this.me/v/4.2.1) | Performance only, no behavior change: each formula is compiled once per kernel instead of on every recompute | 35 µs | 119 ms | 4,244 ms | 42 ms |

One run per version on the same shared VM, on different days (4.1.0 skew 2026-10-07; 4.1.0 and 4.2.0 sweeps 2026-10-10; 4.2.1 2026-10-13): differences under ~10% (the load column) are within noise. k is the same on all three. Changelog: [CHANGELOG.md](https://github.com/neurons-me/.me/blob/main/Typescript/CHANGELOG.md).

## Reproduce {#reproduce}

A manual GitHub Actions workflow, [Bench Madrid (k check)](https://github.com/neurons-me/.me/actions/workflows/bench-madrid.yml), regenerates the scale-1 base→seed0 sweep and compares it with the committed [scale1-base-seed0-sweep.tsv](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/results/scale1-base-seed0-sweep.tsv).

- **What it checks:** k, recomputed, changed, unchanged, sourcePath and probePath are identical to the golden file for every row (151 rows, from the first run on this repo's `main`). Timings (`mutationApplyMs`, `recomputeMs`, `latency_ms`) are not compared; both TSVs are uploaded as the `madrid-s1-sweep` artifact.
- **What it builds:** the `dist/` of the checked-out source with Node 22, not the npm tarball used for the published runs above.
- **Data:** `GTFS-Scale-1-CHANGE.tar.xz` is downloaded from Zenodo at run time. It is not in the repository.
- **Run it:** open the workflow link, then Actions → Bench Madrid (k check) → Run workflow. It is manual only and takes about 30 seconds.

The same check locally, from `Typescript/`:

```bash
npm install && npx vite build --config vite.config.ts
D=tests/Benchmarks/GTFS-Madrid/data/scale1
curl -fsSL -o /tmp/s1.tar.xz "https://zenodo.org/records/14038823/files/GTFS-Scale-1-CHANGE.tar.xz?download=1"
mkdir /tmp/s1 && tar -xJf /tmp/s1.tar.xz -C /tmp/s1
S=$(dirname "$(find /tmp/s1 -name base-1-ROUTES.csv | head -n 1)")
for v in base seed0; do mkdir -p $D/$v; for t in routes trips stop_times calendar calendar_dates; do
  cp "$S/$v-1-$(echo $t | tr a-z A-Z).csv" $D/$v/$t.txt; done; done
R=tests/Benchmarks/GTFS-Madrid/results/scale1-base-seed0-sweep.tsv
cp $R /tmp/golden.tsv                    # the sweep overwrites $R
node --expose-gc tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=1
diff <(cut -f1-8,12,13 /tmp/golden.tsv) <(cut -f1-8,12,13 $R) && echo "k identical"
git checkout -- $R                       # restore the committed golden file
```

## Known limits {#known-limits}

- **[`explain()`](https://neurons-me.github.io/.me/docs/Explain.html) grows with k:** about 1.9 KB + 56 bytes per recomputed value (unchanged in 4.2.1). On the trip with 14,378 `stop_times` (Zipf 2) it returns about 1.6 MB. There is no pagination or summary mode yet; it is an open item.
- **Deletes scan the store** (run 3): they depend on n, not k. Open.
- **Max columns are noisy** (GC pauses); p50 and bucket medians are the robust numbers.
- **4.2.0 and 4.2.1 ran on different days** on the same shared VM; the speedups above are measured, but small ones (under ~10%) are within day-to-day noise.

## More

<div class="doc-cards" markdown="0">
<a class="card" href="https://neurons-me.github.io/.me/docs/me-whatever-what.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-paths.webp" alt="me.whatever(what)"><span class="card-kind">Docs</span><span class="card-title">me.whatever(what)</span><span class="card-desc">How to read and write a path: me.a.b(value) and me("a.b").</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Explain.html"><img src="https://neurons-me.github.io/.me/docs/assets/card-explain.webp" alt="me.explain(path)"><span class="card-kind">Docs</span><span class="card-title">me.explain(path)</span><span class="card-desc">Why a value is what it is: inputs and the last wave, where k comes from.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Extreme-Fan-Out.html"><img src="https://suign.github.io/assets/imgs/EXTREME-FAN-OUT.jpg" alt="Extreme Fan-Out"><span class="card-kind">Docs</span><span class="card-title">Extreme Fan-Out</span><span class="card-desc">The concept behind k: one write, 100,000 dependents, every wave traceable with explain().</span></a>
<a class="card" href="https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/"><img src="https://neurons-me.github.io/.me/Demos/SmartCities/AI-Decides/assets/ai-decides-og.png" alt="AI decides, .me computes"><span class="card-kind">Demo</span><span class="card-title">AI decides, .me computes</span><span class="card-desc">A policy decides headways on this data; one write, the wave replayed, explain() back to the decision.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/Tests/gtfs-madrid-universe.html"><img src="https://suign.github.io/assets/imgs/MADRID-GTFS-DATA-me.jpg" alt="GTFS Madrid live universe"><span class="card-kind">Demo</span><span class="card-title">GTFS Madrid universe</span><span class="card-desc">A small subset live in the browser: click a node for explain(), mutate to see k.</span></a>
<a class="card" href="https://neurons-me.github.io/.me/docs/Tests/madrid-knowledge.html"><img src="https://suign.github.io/assets/imgs/SMARTCITY.jpg" alt="Madrid fares"><span class="card-kind">Demo</span><span class="card-title">Madrid fares</span><span class="card-desc">The same city as a human story: fares, abono, Sol → Atocha.</span></a>
<a class="card" href="https://neurons-me.github.io/mlearning.studio/GTFS/"><img src="https://neurons-me.github.io/mlearning.studio/GTFS/og.jpg" alt="GTFS on mlearning.studio"><span class="card-kind">Dataset</span><span class="card-title">GTFS on mlearning.studio</span><span class="card-desc">The feed format, the Madrid dataset, GTFS-Madrid-Bench links.</span></a>
<a class="card" href="https://github.com/neurons-me/.me/blob/main/Typescript/tests/Benchmarks/GTFS-Madrid/README.md"><img src="https://suign.github.io/assets/imgs/me.png" alt="GTFS-Madrid README"><span class="card-kind">Source</span><span class="card-title">GTFS-Madrid README</span><span class="card-desc">Adapter, workload, every table and results file, 4.2.1 with 4.2.0 and 4.1.0 history.</span></a>
<a class="card" href="https://neurons-me.github.io/mlearning.studio/datasets/madrid-gtfs/"><img src="https://suign.github.io/assets/imgs/MADRID-GRAPH-ME.jpg" alt="Madrid GTFS dataset"><span class="card-kind">Dataset</span><span class="card-title">Madrid GTFS</span><span class="card-desc">Zenodo CHANGE archives and sizes, what to extract, citations.</span></a>
</div>
