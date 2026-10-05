# Port of Veracruz — live operations (build notes)

Live page: [veracruz-port.html](../veracruz-port.html) · <https://neurons-me.github.io/.me/docs/Tests/veracruz-port.html>

Self-contained HTML (inline CSS/JS, basemap SVG embedded inline). Port of Veracruz as a `.me` semantic nervous system: 3 ships unloading (import), 1 train loading (export), truck queues. Facts → rules → mutation (one truck cycle) → wave (affected set k) → `explain()`.

## Basemap

- Source: OpenStreetMap via Overpass API (`overpass_query.txt`).
- Crop bbox: `south=19.192, west=-96.142, north=19.205, east=-96.122` (port docks / Malecón).
- Projection: equirectangular into a 1200×800 SVG (`basemap.svg`, static, dark, no live tiles).
- `build_basemap.py` converts the raw Overpass JSON into GeoJSON + SVG. The raw response (`overpass_raw.json`, ~1.2 MB) is not committed; re-fetch it with the query file:

```bash
curl -X POST https://overpass-api.de/api/interpreter --data-urlencode data@overpass_query.txt -o overpass_raw.json
python3 build_basemap.py
```

## Simulation model

| Path | Kind |
|------|------|
| `me.cargo.coffee / sugar / containers` | fact (100,000 t / 200,000 t / 5,000) |
| `me.trucks.fleet / available` | fact (500) |
| `me.ships[1..3].remaining` | fact |
| `me.train[1].remainingToLoad` | fact |
| `me.queues.import / export` | queues (length = rule) |
| `me.flows.importRemaining` | rule: Σ ships[i].remaining |
| `me.flows.exportRemaining` | rule: train.remainingToLoad |

Mutation: `me.queues.import.nextTruck().complete()` (or `export`) subtracts one haul, decrements the queue, frees the truck, lights only the affected paths, and updates `me.flows.importRemaining.explain()`.

© OpenStreetMap contributors
