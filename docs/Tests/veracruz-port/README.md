# Port of Veracruz — live operations (build notes)

Live page: [veracruz-port.html](../veracruz-port.html) · <https://neurons-me.github.io/.me/docs/Tests/veracruz-port.html>

The page runs on the **real, unmodified** kernel `this.me@4.1.0`, loaded as an ES module from npm via jsDelivr (unpkg fallback) and hash-checked in the browser before import:

```
dist/me.es.js  sha256 47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa
```

If the hash does not match, the page refuses to run.

## Kernel vs adapter

| Kernel (this.me@4.1.0) | Adapter (plain JS, dashed panel in the UI) |
|---|---|
| Every fact: ships, train, queue counters, trucks, cargo stocks | Scheduler: alternate import/export, pick the ship with most `remainingTons` |
| Every derived value (`=` formulas below) | Next write value: current − haul, queue length ± 1 |
| The wave: `k`, `recomputed`, `changed` per write, read from `me.explain(path).meta` | Truck returns: rejoin the queue if work remains, else back to `trucks.available` |
| The WHY panel: raw `me.explain(path)` output | Animation, Auto timer, cycle counter |

The `me.…` lines shown per cycle are the exact calls executed (`port-sim.js` → `write()` builds the call text from the same segments it executes).

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
me.cargo["="]("bulkTons", "coffee + sugar")
me.port["="]("busy", "flows.importRemaining + flows.exportRemaining > 0")
```

Queues are counter facts (`queues.import.length`), mutated per truck. There is no dynamic count.

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

How the page gets k for a write: the kernel stores the last recompute wave on every target it touched. Right after writing S, any derived path whose kernel `dependsOn` contains S holds S's wave. If no derived path depends on S (e.g. `trucks.available`), k = 0.

## Correctness check

"Verify" (UI) / `verifyFromScratch()` rebuilds a fresh kernel from the current facts plus the same formulas and compares all 22 derived paths, plus a plain-arithmetic cross-check of `importRemaining` and `exportRemaining`. A headless Chrome run of 960 cycles (until the port drains) passed every check with no console errors.

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
| `port-sim.js` | Kernel wiring: seed facts, formulas, write/wave helper, adapter scheduler, verify |
| `basemap.svg`, `build_basemap.py`, `overpass_query.txt` | OSM basemap build |

© OpenStreetMap contributors
