# Port of Veracruz — live operations (build notes)

Live page: [veracruz-port.html](../veracruz-port.html) · <https://neurons-me.github.io/.me/docs/Tests/veracruz-port.html>

The page runs on the **real, unmodified** kernel `this.me@4.1.0`, loaded as an ES module from npm via jsDelivr (unpkg fallback) and hash-checked in the browser before import:

```
dist/me.es.js  sha256 47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa
```

If the hash does not match, the page refuses to run.

## .GUI version (`veracruz-port-gui.html`)

Page: [veracruz-port-gui.html](../veracruz-port-gui.html) · <https://neurons-me.github.io/.me/docs/Tests/veracruz-port-gui.html>. The classic page above is unchanged.

The same kernel (`this.me@4.1.0`, sha256-checked as above), traffic adapter and map, with the chrome and panels rendered by **.GUI** (`this.gui`, neurons.me's Generative User Interface, a React + MUI component library) instead of hand-written HTML/CSS.

**.GUI build: unreleased branch build, self-hosted.** The map uses `GUI.OpenStreetMap`, which is not in a published this.gui release yet. The page therefore loads the UMD built from the PR head commit, `this.gui feat/openstreetmap @ed06869` ([neurons-me/GUI#3](https://github.com/neurons-me/GUI/pull/3), which depends on [#2](https://github.com/neurons-me/GUI/pull/2)). Besides `GUI.OpenStreetMap`, that head adds markers as Semantic Inspector nodes (`nodeId` + `provenance`) and an Explain fix: the derivation's input count and the kernel wave's `k` / recomputed / changed are now separate tiles (the old "Dependencies (k)" tile showed the input count). The file is `vendor/this.gui-ed06869.umd.js`, the output of `npm run build` at commit `ed06869b65a6ee921ce7b51b371e35015886af1f`, and the build is reproducible (same bytes on rebuild). The `<script>` tag carries SRI, and `port-gui.js` re-hashes the file in the browser (sha256) before anything runs, the same way it checks the kernel. If either check fails, the page stops. This build does **not** include #2, so the explicit `subscribe` bridge below stays in place.

| File | sha256 | SRI |
|---|---|---|
| `vendor/this.gui-ed06869.umd.js` (self-hosted, branch build) | `d5b256370f999fcae68f9c6ccef3ad0b09528f0bd8378c6e1bb58966d62e668a` | `sha384-LXkXfVwL5RIcJ3MHsgVViBYklGX0njWyjo6N/jxEQYFDL4Coy8qiWGxKUfCSQmfA` |

**Other pinned dependencies.** Exact versions from jsDelivr, each with Subresource Integrity (the browser refuses a file whose hash differs):

| File | sha256 | SRI |
|---|---|---|
| `this.gui@4.0.0/dist/material-symbols.css` | `717649f90831db7a1447191f0d46c15a5b9bf2bb93d65bd4cd069a785600b53b` | `sha384-dvUfVVY6nb2ef6F+dRTsSozZpefoOvMox4Ay4fQP86bSU+6yHovoYYKaRtwS+mca` |
| `react@18.3.1/umd/react.production.min.js` | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` | `sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z` |
| `react-dom@18.3.1/umd/react-dom.production.min.js` | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` | `sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1` |

The icon font CSS still comes from the this.gui@4.0.0 release (unchanged in the branch). The UMD expects `window.React` and `window.ReactDOM`; React 18.3.1 is the last React release with UMD builds.

**What .GUI renders** (`port-gui.js`): `Theme` (neurons.me, dark), the topbar (`registry.TopBar`: neurons.me logo + `.me` linking to <https://neurons-me.github.io/>), the title strip, the glossary (`Button` + `Collapse`, all collapsed), the kernel/tour strip (collapsible, remembered in `localStorage`; `?step=N` opens it at step N), the 1–8 stepper and Back/Next, every panel (`Paper`, `Typography`, `Chip` tags: kernel tags use the *aurora* accent, adapter tags the *ember* accent), the speed and explain selects (`TextField select` + `MenuItem`), Start/Reset/Verify (`Button`), the progress bars (`Progress`), the map legend + HUD chips, and the map itself (`GUI.OpenStreetMap`, below).

**How the kernel drives re-render.** The whole view is one spec resolved by `GUI.mount(spec, root, { gui, me, runtime, devtools })`. There is **one** runtime per kernel instance, `GUI.createMeRuntime(me, { subscribe: kernelSubscribe })`, built in `resetKernel()` and passed to `GUI.mount` (so nothing builds a second runtime or subscribes twice). Every kernel readout is a spec node whose value prop is `{ read: "me/<path>" }`; .GUI resolves it through that runtime, and its snapshot is the kernel read `me(path)`. The bridge accepts both key forms (`me/ships/1/remaining` from a `{read}` node, `ships.1.remaining` from `useMeValue`) and keys its listeners by the dotted path. After each flush, the adapter collects the paths the kernel itself reported for every write: the written fact plus `explain().meta.recomputed`. On the UI tick (4 Hz) it notifies only those paths' subscribers, and React re-renders only the nodes whose value changed. The explain panel also re-renders when its path shows up in a wave whose value didn't change. While traffic runs, readouts can lag the kernel by up to 250 ms (the 4 Hz tick, same cadence as the classic page). Headless check, pausing and taking one tick each time: all 81 bound readouts (63 distinct paths) match a direct `P.read(path)` at load, mid-run, after fast-forward and at the end (`window.__port.consistency()`).

**Do not let .GUI auto-detect `me.subscribe`.** With no `subscribe` bridge, this.gui (4.0.0, and this branch build) calls `me.subscribe(path, cb)` whenever `typeof me.subscribe === "function"`. On a `this.me@4.1.0` proxy that is always true, and the call **writes a kernel fact** named `subscribe`. The page therefore always passes its own bridge, and gives `GUI.mount` that runtime explicitly (with only `{ me }`, `mount` would build a runtime without the bridge). The headless check confirms `me("subscribe")` stays undefined.

**Semantic Inspector (opt-in, off by default).** The page is mounted with `GUI.mount(spec, root, { gui, me, runtime, devtools: { enabled: true, inspector: false, adminView: false, inspectorToggleVisible: false } })` (re-called after each Reset so the inspector sees the new kernel). It reuses the same kernel, runtime and bridge as above. The page theme is passed as `gui.Theme`, so the inspector panel is themed like the page. Because the view is a resolved spec, the inspector's tree shows the page's real structure: top bar, title strip, glossary, the map (OpenStreetMap root, edges/labels groups, the 9 markers, the truck canvas), the legend/HUD, and the sidebar with all 8 panels and their readouts. Each readout node carries `provenance.semanticPath`, so Explain works on any of them, not only on map markers. Panels and layout boxes have node ids but no semantic path (they are not kernel values).
- **Open it:** the **Inspector · off** button in the top bar (shown on screens wider than 1100 px), or `?inspector=1`. Then click a map node. The panel shows the node (`map.n-ship1`, type `OpenStreetMap.Marker`), its kernel path (`provenance.semanticPath`) and **Explain**. Explain shows the expression, the value, the inputs, and the last wave: `k`, the write it came from (`sourcePath`), and how many paths it recomputed / changed. Explain is a snapshot; press *Refresh Explain* to re-read.
- **Node → path:** VERACRUZ `port.busy`, SHIP[n] `ships.n.hasWork`, TRAIN[1] `train.1.hasWork`, Q.IMPORT / Q.EXPORT `queues.*.busy`, CARGO YARD `cargo.bulkTons`, CEDIS B `trips.pending`. All are derived paths.
- **Side effects while it is on:** clicks inside tagged .GUI nodes (now the whole page, including the sidebar panels) select the node instead of acting. When the panel opens, .GUI narrows `<body>` by the panel width (440 px default, resizable), so the map column shrinks and the map refits. The 380 px sidebar keeps its width and its panel heights, and the footer may wrap to a second line. Closing restores the exact layout. With the inspector off, the page matches the previous version in headless checks: node positions, panel heights and the map, sidebar, top bar and footer boxes at 1600 px; footer, sidebar and document heights at 390, 1000, 1001, 1100 and 1280 px; footer height every 7 px from 1001 to 1900 px.
- **Headless check** (`?inspector` unset): 9 markers registered; selecting SHIP[1] shows `ships.1.hasWork` with expression `remaining > 0`, 1 input, and after hauls `k = 7` from `ships.1.remaining` (7 recomputed / 4 changed), matching `me.explain()`. The simulation and all 81 bound readouts stay in sync with the inspector open and closed. Unmounting drops the bridge callbacks from 103 to 0, and remounting brings them back to 103; Reset keeps 103. `me("subscribe")` is undefined, `exportSnapshot()` works, Verify passes 241/241, there are no console errors, and the classic page is untouched.

**Map = `GUI.OpenStreetMap`.** GUI only presents the map. The data stays in this project: the basemap is the existing `build_basemap.py` output (same geometry as `basemap.svg`, not rebuilt). It sits in a `<template id="basemap-tpl">`, and `port-gui.js` reads its groups into `basemap.layers`.
- **Projection:** the component gets the generator's bbox, the 1200×800 frame and pad 24, and its `project(lat, lon)` uses the same equirectangular formula as `build_basemap.py`. The basemap, the node markers and the canvas layer share that one transform.
- **Attribution and source:** "© OpenStreetMap contributors · ODbL" is rendered on the map (bottom-right; the HUD sits 24 px up so they never overlap). The source (generator, Overpass query, bbox, projection) is in the SVG `<metadata>` and the attribution tooltip.
- **Nodes** are `GUI.OpenStreetMap.Marker`s. Positions are the old pixel centres converted with the map's own `unproject`, so they are identical. Meta lines (`unloading · 31,350 t`, `47 queued`, …) are `GUI.useMeValue` subscriptions through the same bridge.
- **Trucks:** the 500 dots are drawn by `GUI.OpenStreetMap.Canvas`'s per-frame `onFrame({ ctx, … })`, which also drives the adapter loop. Canvas suits this many moving points; SVG overlays or markers are also possible.
- **Check vs the previous hand-written map** (headless, same seed): identical node positions (0 px), Verify 241/241, identical drain totals, and frame time / main-thread time within run-to-run noise (details in GUI#3).

**Page-local leaves (rendered by page registry types inside the spec, opaque to the inspector below their node):** the tour strip, run controls, stats, writes list, explain picker/view, last-mile strip/estimate/feed, seed code, verify output, sim clock, kernel links, glossary item bodies, marker meta lines, and the map's edge/label/spotlight SVG children.

**Still manual (adapter, labeled):** the edge/exit-label overlay data, the node highlight classes, the per-unit last-mile strip canvas, the SVG node labels, page stats (fps, moving dots), the sim clock, the redirect feed, the completion estimate, and the path-notification schedule.

## 500 trucks, one kernel

All 500 trucks circulate at once, split (assumption) into **400 heavy trucks** (ships / train) and **100 small last-mile trucks** (CEDIS → addresses in the city). Each dot on the canvas overlay is one truck; last-mile trucks are smaller pink dots. Trucks off the map (delivering inland / picking up export cargo) are not drawn.

- **Import (heavy)**: pool or exit road → `Q.IMPORT` → one of 20 berth slots per ship → laden over a real OSM route out of the frame (NW: Dr. Rafael Cuervo → Hwy 180 to Cardel; S: Díaz Mirón → Xalapa; S: Ávila Camacho → Boca del Río) → off map → comes back in.
- **Export (heavy)**: a free truck drives out (or is already outside), picks up sugar, comes **in from the map edge** → `Q.EXPORT` → one of 20 train slots → next job.
- **Last-mile**: 1,000 scheduled trips from 2 CEDIS to addresses (below).

### Speeds and durations: assumptions, not sourced statistics

Named constants in `port-traffic.js`:

| Constant | Value | Assumption |
|---|---|---|
| `HEAVY_TRUCK_KMH` | 25 km/h (±15% per truck) | heavy trucks in the urban port area average roughly 20–30 km/h including stops, gates and lights |
| `LAST_MILE_KMH` | 22 km/h (±15% per truck) | small delivery trucks in city traffic roughly 20–25 km/h |
| berth loading / train unloading | 8–15 min / 6–10 min per heavy truck | order of magnitude for a believable rhythm |
| off-map leg | 15–30 min each way | delivery / pickup in the metro area beyond the frame |
| `LM.loadMinAvg` / `LM.dropMin` | ~10 min at the CEDIS / 5–8 min at the address | |
| shift | 08:00–17:00 (9 h) | the simulation clock starts at 08:00 |
| CEDIS loading bays | 12 (A) / 10 (B) | |
| gate release | one heavy truck every 2 s at start | several gate lanes; staggered start |

Travel time comes from the **route length in metres**: each OSM polyline is converted back to lon/lat (inverse of the page's equirectangular projection, `PROJ` in `port-routes.js`) and measured with the haversine formula. Playback is shown in the UI: **×10 by default** (1 s real = 10 s simulated), ×1 real time and ×60 available; the HUD shows the simulated clock.

### Last-mile: 1,000 scheduled trips (example data)

`build_lastmile.py` generates `port-lastmile.js` (seeded, deterministic):

- **CEDIS A** = the cargo yard/warehouse by the port; **CEDIS B** = an *example* second distribution centre on Calle Esteban Morales (hypothetical site, not a real facility).
- **1,000 addresses** sampled on OSM residential / tertiary / secondary street segments inside the visible frame (Centro and nearby neighbourhoods), weighted by segment length. Each trip is served from the CEDIS with the shorter road distance (550 A / 450 B).
- Each trip has a **3 h window** starting on the hour between 08:00 and 14:00 and a load of 150–900 kg (example values), and a **route on real road geometry** (shortest path on the OSM road graph, exported as one shortest-path tree per CEDIS).
- Units: 55 based at CEDIS A, 45 at CEDIS B (≈ share of trips).

**Assignment heuristic (adapter, not a solver):**

1. **Greedy initial plan**: unit by unit, each unit repeatedly takes the pending trip of its CEDIS that it can *finish earliest* (estimated with the averages: load + travel at 22 km/h, waiting if the window is not open yet, + drop), as long as it arrives within the window and is back before 17:00. This maximises trips per unit, so the first units are packed (up to ~31 trips) and later ones are nearly empty. Trips no unit can fit are "can't fit today".
2. **Continuous rebalancing** around the average, every 20 sim seconds, up to 25 redirects per pass:
   - avg trips per unit = `trips.assigned / trucks.lastMile.fleet` (assigned = planned + active + done), **band = avg ± 15%** (`trips.bandHigh`, `trips.bandLow`, kernel formulas).
   - Units **above** the band (amber ring) give pending trips to units **below** it (cyan ring), nearest to the receiver's next stop first, only if the receiver's whole plan still fits its shift and windows. When only one side is out of band, the move goes to / comes from in-band units that stay in band.
   - Units only trade within their CEDIS; done trips never move. It stops when everyone is within the band or no feasible move remains.
   - Each redirect is logged in the UI feed: `08:08 · trip #0314 · LM-71 → LM-84`.
3. **Execution**: an idle unit starts its next planned trip when the window allows and a CEDIS bay is free. Actual times vary around the averages; if a trip no longer fits when its turn comes, it becomes "can't fit today".

Result of the default run (seed fixed): initial plan 36 units above / 1 within / 63 below → after ~590 redirects **100 / 100 within the band** by ~08:10; at the end ~960–965 trips done, ~35–40 can't fit today, ~9.6 trips done per unit (max 11, min 5–7). Exact numbers vary slightly with playback (frame timing changes the random draws).

### Writes: what is real

Each animation tick the adapter **flushes** its pending deltas: **one real kernel write per changed fact**, e.g.

```js
me.ships[2].remaining(56350)          // −50 · 1 haul (ship → truck, loading done)
me.cargo.coffee(97200)                // −50 · 1 haul (truck left the map)
me.train[1].remainingToLoad(48400)    // −50 · 1 haul (truck unloaded into the train)
me.localDelivery.remainingKg(367580)  // −640 · 1 delivery
me.trips.done(304)                    // +1 · 1 delivery
me.lastMile.units[37].done(4)         // +1
me.trucks.import.enRoute(156)         // +2
me.lastMile.unitsWithin(100)          // adapter classification
```

The page lists the exact calls of the latest flush, each with the kernel's own `k` and recomputed paths. Totals, averages, band limits and flags are kernel formulas, never written.

## Kernel vs adapter

| Kernel (this.me@4.1.0) | Adapter (plain JS, `port-traffic.js`, dashed panel / "adapter" tags in the UI) |
|---|---|
| Facts: ships, train, cargo stocks, `localDelivery.totalKg/remainingKg`, fleets (500 = 400 + 100), all truck/queue counters, trip state counters (`trips.unassigned/planned/active/done/unscheduled`), `trips.redirects`, `trips.band` (0.15), per-unit `lastMile.units[i].done` | Each truck's state machine, route, berth/train/bay slot and timers; which flow a heavy truck joins |
| Derived (`=` formulas below): flows, progress, `trucks.*` sums and `balanced` flags, `trips.pending/assigned/accounted/balanced`, `trips.perUnitAvg`, `trips.bandHigh/bandLow`, `lastMile.unitDoneSum` (explicit 100-term sum), `lastMile.unitsCounted/unitsOk` | Last-mile greedy plan, rebalancing redirects, per-unit band classification |
| Adapter-written facts, labelled in the UI: `lastMile.unitsAbove/Within/Below` (classified with the kernel's bandHigh/bandLow), `trips.unitMax/unitMin` ("adapter aggregate": the kernel has no `min()`/`max()`) | Pending deltas → writes at each flush (value = kernel read + delta); completion estimate; redirect log |
| The wave: `k`, `recomputed`, `changed` per write; the WHY panel: raw `me.explain(path)` | Dot/address positions, canvas drawing, playback speed, fps / writes-per-second stats |

`port-sim.js` → `write()` builds the call text from the same segments it executes, so the listed `me.…` lines are the executed calls.

## Formulas (all accepted by the kernel)

```js
me.ships[i]["="]("remainingTons", "remaining * tonsPerUnit")      // i = 1..3
me.ships[i]["="]("progress", "1 - remaining / total")
me.ships[i]["="]("hasWork", "remaining > 0")
me.train[1]["="]("progress", "1 - remainingToLoad / total")
me.train[1]["="]("hasWork", "remainingToLoad > 0")
me.flows["="]("importRemaining", "ships[1].remainingTons + ships[2].remainingTons + ships[3].remainingTons")
me.flows["="]("importTotal", "ships[1].total * ships[1].tonsPerUnit + ships[2].total * ships[2].tonsPerUnit + ships[3].total * ships[3].tonsPerUnit")
me.flows["="]("importProgress", "1 - importRemaining / importTotal")
me.flows["="]("importHasWork", "importRemaining > 0")
me.flows["="]("exportRemaining", "train[1].remainingToLoad")
me.flows["="]("exportHasWork", "exportRemaining > 0")
me.queues.import["="]("busy", "length > 0")                       // same for export
me.localDelivery["="]("deliveredKg", "totalKg - remainingKg")
me.localDelivery["="]("progress", "1 - remainingKg / totalKg")
me.trips["="]("pending", "trips.unassigned + trips.planned + trips.active")
me.trips["="]("assigned", "trips.planned + trips.active + trips.done")
me.trips["="]("accounted", "trips.done + trips.pending + trips.unscheduled")
me.trips["="]("balanced", "trips.accounted == trips.total")
me.trips["="]("doneShare", "trips.done / trips.total")
me.trips["="]("perUnitAvg", "trips.assigned / trucks.lastMile.fleet")
me.trips["="]("perUnitDoneAvg", "trips.done / trucks.lastMile.fleet")
me.trips["="]("bandHigh", "trips.perUnitAvg + trips.perUnitAvg * trips.band")
me.trips["="]("bandLow", "trips.perUnitAvg - trips.perUnitAvg * trips.band")
me.lastMile["="]("unitDoneSum", "lastMile.units[1].done + lastMile.units[2].done + … + lastMile.units[100].done")   // explicit
me.lastMile["="]("unitSumOk", "lastMile.unitDoneSum == trips.done")
me.lastMile["="]("unitsCounted", "lastMile.unitsAbove + lastMile.unitsWithin + lastMile.unitsBelow")
me.lastMile["="]("unitsOk", "lastMile.unitsCounted == trucks.lastMile.fleet")
me.trucks.heavy["="]("working", "queues.import.length + queues.export.length + trucks.import.loading + … + trucks.export.returning")
me.trucks.heavy["="]("balanced", "trucks.heavy.working + trucks.heavy.available == trucks.heavy.fleet")
me.trucks.lastMile["="]("working", "trucks.lastMile.loading + trucks.lastMile.enRoute + trucks.lastMile.returning")
me.trucks.lastMile["="]("balanced", "trucks.lastMile.working + trucks.lastMile.available == trucks.lastMile.fleet")
me.trucks["="]("inQueue", "queues.import.length + queues.export.length")
me.trucks["="]("loading", "trucks.import.loading + trucks.export.loading + trucks.lastMile.loading")   // same for enRoute, returning
me.trucks["="]("available", "trucks.heavy.available + trucks.lastMile.available")
me.trucks["="]("working", "trucks.inQueue + trucks.loading + trucks.enRoute + trucks.returning")
me.trucks["="]("accounted", "trucks.working + trucks.available")
me.trucks["="]("balanced", "trucks.accounted == trucks.fleet")
me.trucks["="]("splitOk", "trucks.heavy.fleet + trucks.lastMile.fleet == trucks.fleet")
me.cargo["="]("bulkTons", "coffee + sugar")
me.port["="]("busy", "flows.importRemaining + flows.exportRemaining + trips.pending + trucks.working > 0")
```

Queues, truck states and trip states are counter facts, batched per flush. There is no dynamic count.

## Kernel probe (Node, this.me@4.1.0), what works and what doesn't

Works:
- Index segments in formulas with brackets: `ships[1].remaining + ships[2].remaining + ships[3].remaining` → `102000`.
- Relative sibling names inside a node: `ships[1]["="]("progress", "1 - remaining / total")`.
- Absolute cross-branch paths: `queues.import.length + queues.export.length`, `flows.importRemaining + flows.exportRemaining > 0`.
- Chains: writing `ships[3].remaining` recomputes `ships.3.remainingTons → flows.importRemaining → flows.importProgress, flows.importHasWork` (k=4 in the probe).
- `me.explain(path)` returns `expr`, `derivation.inputs` (label, path, value), `meta.dependsOn`, and after a write `meta.k`, `meta.recomputed`, `meta.changed`, `meta.sourcePath`.
- `>`, `&&`, `*`, `/`, `+`, `-`; string facts (`me.ships[1].cargo("coffee")`).

Does not work (no error is thrown: the value is silently `undefined`):
- Dot-numeric segments in formulas: `ships.1.remaining` → `undefined` (reading `me("ships.1.remaining")` directly is fine).
- Pointer form `->ships.1.remaining` → `undefined`.
- `min(...)` → `undefined`; ternary `a > 0 ? 1 : 0` → `undefined`.

Gotcha: calling a leaf with no argument, `me.ships[1].remaining()`, **writes `undefined`**. Read with `me("ships.1.remaining")`.

How the page gets k for a write: the kernel stores the last recompute wave on every target it touched. Right after writing S, any derived path whose kernel `dependsOn` contains S holds S's wave. If no derived path depends on S (e.g. `cargo.containers`), k = 0.

## Correctness check and performance

"Verify" (UI) flushes, then `verifyFromScratch()` rebuilds a fresh kernel from the current facts plus the same formulas and runs **241 checks**:

- All 49 derived paths match the fresh rebuild, and none is `undefined`.
- Arithmetic cross-checks: `importRemaining`, `deliveredKg`, and `bandHigh` / `bandLow` = avg × 1.15 / × 0.85.
- Σ counters = 500, Σ heavy = 400, Σ last-mile = 100, with all `balanced` flags and `splitOk`.
- **trips done + pending + unscheduled = 1,000**, and the trip state counters sum to 1,000.
- Σ `units[i].done` = `trips.done`; **unitsAbove + unitsWithin + unitsBelow = 100**.
- The adapter's own states vs every kernel counter (heavy, last-mile, trips, per-unit done), band counts recomputed with the kernel's thresholds, unitMax/unitMin, and redirects.

Headless Chrome (puppeteer, 1600×1000, this box):

| Run | Result |
|---|---|
| Default ×10, first 8 s after load | 60 fps, ~12 kernel writes/s |
| Default ×10, steady state (10:00 sim) | 60 fps (worst frame 16.8 ms), ~14–15 kernel writes/s, ~5 flushes/s |
| ×60 | 60 fps, ~73 writes/s, ~23 flushes/s |
| Full drain (`__port.drain()`, no animation) | 08:00 → ~22:00 sim; 4,000 hauls + ~960 deliveries; ~32k writes at ~3.9k writes/s; k max 9; 10 periodic + final verify all pass; no console errors |

## Routes

`build_lastmile.py` builds `port-lastmile.js` (CEDIS, 1,000 trips, shortest-path trees). `build_routes.py` builds `port-routes.js` from the same Overpass data: shortest paths (Dijkstra, faster weights for primary/secondary roads) on the OSM road graph between the berths, queues, train, yard and three exits. Exit routes are cut 140 px beyond the frame so trucks visibly leave the map. Docks and rail sidings have no public OSM road in the data used, so the last few metres to a berth/queue are straight connectors to the nearest road node.

```bash
python3 build_routes.py overpass_raw.json     # wider bbox 19.175..19.215 / -96.165..-96.105
python3 build_lastmile.py overpass_raw.json   # 2 CEDIS + 1,000 seeded trips
```

## Basemap

- Source: OpenStreetMap via Overpass API (`overpass_query.txt`).
- Crop bbox: `south=19.192, west=-96.142, north=19.205, east=-96.122` (port docks / Malecón).
- Projection: equirectangular into a 1200×800 SVG (`basemap.svg`, embedded inline in the page, static, no live tiles).
- `build_basemap.py` converts the raw Overpass JSON (not committed, ~1.2 MB) into GeoJSON + SVG:

```bash
curl -X POST https://overpass-api.de/api/interpreter --data-urlencode data@overpass_query.txt -o overpass_raw.json
python3 build_basemap.py
```

## Files

| File | Role |
|---|---|
| `../veracruz-port.html` | Page: tutorial, map, UI, kernel loader |
| `../veracruz-port-gui.html`, `port-gui.js` | .GUI version: same kernel/adapter/basemap data; chrome, panels and map (`GUI.OpenStreetMap`) as this.gui components bound to kernel paths |
| `vendor/this.gui-ed06869.umd.js` | Self-hosted unreleased this.gui branch build (feat/openstreetmap @ed06869, GUI#3), SRI + sha256 pinned. Single file: the inspector `mount()` lazy-loads is inlined (no extra chunk) |
| `port-sim.js` | Kernel wiring: seed facts, formulas, write/wave helper, verify |
| `port-traffic.js` | Adapter: 500 truck agents, speeds (assumptions), slots, timers, last-mile plan + rebalancing, deltas → flush (real writes) |
| `port-lastmile.js`, `build_lastmile.py` | Last-mile example data: 2 CEDIS, 1,000 trips, road trees (generated) |
| `port-routes.js`, `build_routes.py` | Truck routes on OSM road geometry (generated) |
| `basemap.svg`, `build_basemap.py`, `overpass_query.txt` | OSM basemap build |

© OpenStreetMap contributors
