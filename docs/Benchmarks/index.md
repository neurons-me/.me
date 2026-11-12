---
layout: gui-doc
title: ".me — Benchmarks"
description: "Benchmarks of the .me kernel: kernel benchmarks (1–11 and the fire test), real-data benchmarks on GTFS transit feeds, the performance phases (disk, write pressure, vector search) and the cost of secret scopes."
image: https://neurons-me.github.io/.me/docs/assets/kernel-timeline-og.jpg
mepath: []
crumb: Benchmarks
view_content_name: "Doc - .me — Benchmarks"
view_content_category: "Docs"
---

# Benchmarks

**Kernel** benchmarks exercise the engine on synthetic graphs. **GTFS** benchmarks run it on real public-transport data. **Phases** cover disk persistence, write pressure and vector search. **Secret scope** measures what sealing a branch costs. Each card says the kernel version its numbers were measured on.

<div class="doc-cards" markdown="0">
<a class="card" href="benchmarks.html"><img src="https://suign.github.io/assets/imgs/me.png" alt=".me kernel benchmarks"><span class="card-kind">Kernel · 4.2.1</span><span class="card-title">Kernel benchmarks</span><span class="card-desc">Benchmarks 1–11 and the fire test: scaling, fan-out, throughput, explain, secret scopes. Re-run on 4.2.0 (2026-10-10) next to the earlier builds on the same machine; cost timeline from 3.9.1 to 4.2.1 (on npm).</span></a>
<a class="card" href="GTFS/"><img src="https://suign.github.io/assets/imgs/MADRID-GTFS-DATA-me.jpg" alt="GTFS benchmarks"><span class="card-kind">GTFS · 4.2.0</span><span class="card-title">GTFS</span><span class="card-desc">Real transit feeds. Madrid (GTFS-Madrid-Bench), re-run on this.me 4.2.0.</span></a>
<a class="card" href="Phases/"><img src="https://neurons-me.github.io/.me/docs/assets/card-benchmarks.webp" alt="Phase benchmarks"><span class="card-kind">Phases · 3.6.4</span><span class="card-title">Phases</span><span class="card-desc">Phase 2: disk persistence and write pressure. Phase 3: exact vs IVF vector search (23.2× at 100k). Measured on 3.6.4 / 3.7.0, not re-run on 4.x.</span></a>
<a class="card" href="Secret-Scope/"><img src="https://neurons-me.github.io/.me/docs/assets/card-seed.webp" alt="Secret scope benchmarks"><span class="card-kind">Secret scope · 4.2.0</span><span class="card-title">Secret scope &amp; scaling</span><span class="card-desc">Secret vs public branches: write and first-read cost across node counts, push vs pull, and the branch-scale run.</span></a>
</div>
