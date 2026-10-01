# GTFS-Madrid → .me (experimental)

Measure **dependency propagation** in `.me` (k, recomputed, changed, sourcePath, latency) under GTFS-like CREATE / UPDATE / DELETE mutations.

**Not** an RML/RDF materialization benchmark. We reuse Van Assche’s mutation *types* and GTFS Madrid data shape; an adapter maps entities into `.me` paths + derived expressions.

## Citation

Dylan Van Assche et al., *Incremental Knowledge Graph Construction from Heterogeneous Data Sources* (IncRML / Semantic Web Journal).  
Uses a change-aware extension of **GTFS-Madrid-Bench** (Chaves-Fraga et al., 2020). Mutation classes: **CREATE** (additions), **UPDATE** (modifications), **DELETE** (deletions).

- Paper: https://dylanvanassche.be/assets/pdf/swj2025-incremental-knowledge-graph-construction-from-heterogeneous-data-sources.pdf  
- Resources: https://zenodo.org/records/14038823  
- GTFS-Madrid-Bench: https://github.com/oeg-upm/gtfs-bench

## Cross-branch dependencies (what worked)

`.me` resolves each formula identifier **relative to the derived node’s scope first, then from the root** (`refCandidatePaths` / `tryResolveEvalTokenValue`).

So from `gtfs.trips.T1`, the expression `gtfs.services.S1.active`:

1. tries `gtfs.trips.T1.gtfs.services.S1.active` (miss)
2. falls back to root `gtfs.services.S1.active` (hit)

That absolute dotted form is the supported cross-branch edge. `explain().meta.sourcePath` then names the **original mutation path**.

Synthetic edges in this mini:

| Derived | Formula | Mutation source |
|---------|---------|-----------------|
| `gtfs.services.S1.active` | `(mon\|\|…\|\|sun) && startDate>0 && endDate>=startDate` | UPDATE day/date fields |
| `gtfs.trips.T1.live` | `gtfs.services.S1.active` | UPDATE day/date → active |
| `gtfs.stopTimes.T1_*_<stopId>.routeId` | `gtfs.trips.T1.routeId` | UPDATE trip.routeId |
| `gtfs.trips.T1.validRoute` | `gtfs.routes.R1.active` | DELETE route via `me["-"]` → ABSENCE |
| `gtfs.idx.routes.R.tripCount` | sum(`tripMember.*`) | CREATE trip flips membership 0→1 |
| `gtfs.idx.trips.T.stopTimeCount` | sum(`stopTimeMember.*`) | CREATE stopTime flips membership 0→1 |
| `gtfs.idx.routeCount` / `serviceCount` | sum(members) | CREATE route/service |


### CREATE honesty (idx membership, not natural GTFS CREATE)

**CREATE has no prior dependency edge** in a plain GTFS entity graph: a brand-new route/trip/stopTime is not yet referenced by any derived formula, so a naïve insert would show **k = 0**. This benchmark therefore **models creation via explicit membership / index slots** under `gtfs.idx` (pre-seeded `0` for seed-only ids, `1` for base members) with parent `*Count` sum aggregates. Flipping a slot `0→1` when a member enters the set produces a **measurable invalidation wave**. Report CREATE k as that membership/aggregate wave — **not** as “natural GTFS CREATE k=1”. Semantics are intentional and documented; they are not a claim that IncRML/GTFS CREATE inherently has k=1.

### DELETE: ABSENCE vs `false`

- `active=false` (tombstone): formula still resolves → derived value is **`false`**; `sourcePath` = `gtfs.routes.R1.active`.
- Real `me["-"]("gtfs.routes.R1")`: subtree removed → formula input missing → derived value is **`undefined`** with `explain().meta.unresolved = { reason: "missing-input", inputs: [...] }`. Wave `sourcePath` names a removed route key (e.g. `gtfs.routes.R1.active`).

**stopTime keys:** `stopTimeId(trip, seq, stopId)` includes stopId so omitted/duplicate `stop_sequence` in CHANGE dumps do not collapse rows (would undercount k).

**Limitation:** `=` formulas only yield `number | boolean` (not strings). Synthetic `routeId` uses numeric codes (`1` = R1, `2` = R2). String GTFS ids stay on label fields (`routeLabel`, `label`).

No mirror/copy fields (`serviceActive`, `tripRouteId`) — dependents subscribe to the real source paths.

## Data

Put dumps under `data/` (gitignored). **Do not download multi-GB sets until needed.**

Packages from Van Assche Zenodo `10.5281/zenodo.14038823` (prefer CHANGE, not ALL):

| package | compressed | extract layout |
|---------|------------|----------------|
| `GTFS-Scale-1-CHANGE.tar.xz` | ~3.4 MB | `data/scale1/{base,seed0}/…` |
| `GTFS-Scale-10-CHANGE.tar.xz` | ~96 MB | `data/scale10/{base,seed0}/…` |
| `GTFS-Scale-100-CHANGE.tar.xz` | ~1.14 GB | `data/scale100/{base,seed0}/…` (extract ONLY base+seed0 needed tables; skip SHAPES) |

Extract only needed CSVs (`base-N-*`, `seed0-N-*` for ROUTES/TRIPS/STOP_TIMES/CALENDAR/CALENDAR_DATES) → rename to GTFS names under:

- `data/scale{N}/base/{routes,trips,stop_times,calendar,calendar_dates}.txt`
- `data/scale{N}/seed0/...`

- Loader: `load-real.ts` maps string GTFS ids → stable numeric codes (`stableNumericId`, not row index).
- Path keys use `pathSafeId` → `n<numeric>` because pure-digit / zero-padded hex segments are tokenized as numbers inside `=` formulas and break dotted cross-branch refs. Original GTFS id is kept on `.gtfsId`.

- Real smoke (auto if present): one calendar `monday` UPDATE base→seed0, measures `explain` wave; writes `results/scale1-smoke-summary.json`.

## Sweep base→seed0 (all honest mutations)

```bash
# from Typescript/
node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=1
node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=10
node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=100
# or via benchmark (scale-1):
node tests/Benchmarks/GTFS-Madrid/benchmark.ts --sweep-only
```

Diffs `data/scale{N}/base` vs `seed0`, measures mutations that map to derived edges:
day/date → `service.active` → `trip.live`, `trip.routeId` → `stopTime.routeId`,
route/trip `me["-"]` → ABSENCE, and CREATE via `gtfs.idx` membership + `*Count` aggregates
(pre-seeded 0 for seed-only ids; CREATE flips 0→1 — real wave; see CREATE honesty above).
Writes `results/scale{N}-base-seed0-sweep.{json,md,tsv}`. Timing: `loadMs` | `mutationApplyMs` | `recomputeMs`.

## Run (synthetic, no data)

From `Typescript/`:

```bash
node tests/Benchmarks/GTFS-Madrid/benchmark.ts
```

Requires `dist/` built (`npm run build`).
