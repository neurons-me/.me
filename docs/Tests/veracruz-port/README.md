# Port of Veracruz — live operations (build notes)

Live page: [veracruz-port.html](../veracruz-port.html) · <https://neurons-me.github.io/.me/docs/Tests/veracruz-port.html>

The page runs on the **real, unmodified** kernel `this.me@4.1.0`, loaded as an ES module from npm via jsDelivr (unpkg fallback) and hash-checked in the browser before import:

```
dist/me.es.js  sha256 47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa
```

If the hash does not match, the page refuses to run.

## 500 trucks, one kernel

All 500 trucks circulate at once. Each dot on the canvas overlay is one truck, coloured by its state: en route laden (import blue / export amber), loading or unloading, queued, returning empty, idle in the pool next to the yard. Trucks off the map (delivering inland / picking up export cargo) are not drawn.

- **Import**: pool or exit road → `Q.IMPORT` → one of 16 berth slots per ship (4–7 s loading) → laden over a real OSM route out of the frame (NW: Dr. Rafael Cuervo → Hwy 180 to Cardel; S: Díaz Mirón → Xalapa; S: Ávila Camacho → Boca del Río) → off map → comes back in.
- **Export**: a free truck drives out (or is already outside), picks up sugar, comes **in from the map edge** → `Q.EXPORT` → one of 10 train slots → next job.
- A truck picks the flow with more open work per truck; the pool releases ~6 trucks per sim second, so traffic builds up gradually instead of all at once.

### Writes: what is real

Each animation tick the adapter **flushes** its pending deltas: **one real kernel write per changed fact**, e.g.

```js
me.ships[2].remaining(56350)          // −50 · 1 haul (ship → truck, loading done)
me.cargo.coffee(97200)                // −50 · 1 haul (truck left the map)
me.train[1].remainingToLoad(48400)    // −50 · 1 haul (truck unloaded into the train)
me.queues.import.length(42)           // +1
me.trucks.import.enRoute(156)         // +2
```

The page lists the exact calls of the latest flush, each with the kernel's own `k` and recomputed paths. Totals (`flows.*`, `trucks.working`, `trucks.balanced`, `port.busy`…) are kernel formulas, never written.

Truck counters (facts): `trucks.available`, `queues.import.length`, `trucks.import.loading|enRoute|returning`, `queues.export.length`, `trucks.export.loading|enRoute|returning`. The kernel sums them: `trucks.inQueue`, `trucks.loading`, `trucks.enRoute`, `trucks.returning`, `trucks.working`, `trucks.accounted`, `trucks.balanced = trucks.accounted == trucks.fleet`.

## Kernel vs adapter

| Kernel (this.me@4.1.0) | Adapter (plain JS, `port-traffic.js`, dashed panel in the UI) |
|---|---|
| Every fact: ships, train, cargo stocks, fleet, all truck/queue counters | Each truck's state machine, route, berth/train slot and timers |
| Every derived value (`=` formulas below) | Which flow a free truck joins; queue order; pool release rate |
| The wave: `k`, `recomputed`, `changed` per write, read from `me.explain(path).meta` | Pending deltas, turned into writes at each flush (value = kernel read + delta) |
| The WHY panel: raw `me.explain(path)` output | Dot positions, canvas drawing, speed, fps/writes-per-second stats |

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
me.trucks["="]("inQueue", "queues.import.length + queues.export.length")
me.trucks["="]("loading", "trucks.import.loading + trucks.export.loading")   // same for enRoute, returning
me.trucks["="]("working", "trucks.inQueue + trucks.loading + trucks.enRoute + trucks.returning")
me.trucks["="]("accounted", "trucks.working + trucks.available")
me.trucks["="]("balanced", "trucks.accounted == trucks.fleet")
me.cargo["="]("bulkTons", "coffee + sugar")
me.port["="]("busy", "flows.importRemaining + flows.exportRemaining + trucks.working > 0")
```

Queues and truck states are counter facts, batched per flush. There is no dynamic count.

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

"Verify" (UI) flushes, then `verifyFromScratch()` rebuilds a fresh kernel from the current facts plus the same formulas and runs 39 checks: all 28 derived paths, a plain-arithmetic cross-check of `importRemaining`, Σ counters = 500 with `trucks.balanced`, and the adapter's truck states vs each of the 9 kernel counters.

Headless Chrome (puppeteer, 1600×1000, this box):

| Run | Result |
|---|---|
| Real-time ×4, 20 s | 60 fps, worst frame 16.8 ms, ~120 kernel writes/s, ~42 flushes/s, up to 274 dots moving at once |
| Real-time ×16, 4 s | 60 fps, ~330 writes/s, ~60 flushes/s (one per frame) |
| Full drain (`__port.drain()`, no animation) | 4,000 hauls, ~15k writes, ~7.9k writes/s, k max 7 / avg 4.6, 13 periodic + final verify all pass, no console errors |

## Routes

`build_routes.py` builds `port-routes.js` from the same Overpass data: shortest paths (Dijkstra, faster weights for primary/secondary roads) on the OSM road graph between the berths, queues, train, yard and three exits. Exit routes are cut 140 px beyond the frame so trucks visibly leave the map. Docks and rail sidings have no public OSM road in the data used, so the last few metres to a berth/queue are straight connectors to the nearest road node.

```bash
python3 build_routes.py overpass_raw.json   # wider bbox 19.175..19.215 / -96.165..-96.105
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
| `port-sim.js` | Kernel wiring: seed facts, formulas, write/wave helper, verify |
| `port-traffic.js` | Adapter: 500 truck agents, slots, timers, deltas → flush (real writes) |
| `port-routes.js`, `build_routes.py` | Truck routes on OSM road geometry (generated) |
| `basemap.svg`, `build_basemap.py`, `overpass_query.txt` | OSM basemap build |

© OpenStreetMap contributors
