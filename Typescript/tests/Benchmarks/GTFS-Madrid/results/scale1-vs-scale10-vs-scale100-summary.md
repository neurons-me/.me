# scale-1 vs scale-10 vs scale-100 side-by-side (base→seed0 sweep)

Claim: dependency propagation — NOT RML materialization.

CREATE honesty: CREATE has no prior dependency edge; benchmark models creation via explicit `gtfs.idx` membership/index slots → measurable wave when a member enters the set. **Not** natural GTFS CREATE k=1.

## Download / extract (scale-100)

- Zenodo `10.5281/zenodo.14038823` → `GTFS-Scale-100-CHANGE.tar.xz` = **1.116 GiB** compressed (1198398288 bytes).
- Selective extract base+seed0 needed tables only: **59.35 MiB** (62229113 bytes). Skipped SHAPES (~300 MB each) and unused tables.
- Sweep wall: **5114s** (~85.2 min); peak RSS **2.29 GiB**.

## n vs k locality

Graph size **n** scales ~10× per step; mutation count ~8.6× (1→10) then ~10.3× (10→100); **k stays flat** (p50=1, p95≈18–19, max=27 across all three). Locality preserved under scale-up.

| metric | scale-1 | scale-10 | scale-100 | 10/1 | 100/10 | 100/1 |
|---|---:|---:|---:|---:|---:|---:|
| mutations N | 151 | 1304 | 13401 | 8.64× | 10.28× | 88.75× |
| creates | 111 | 1020 | 10560 | 9.19× | 10.35× | 95.14× |
| updates | 7 | 42 | 454 | 6.00× | 10.81× | 64.86× |
| deletes | 33 | 242 | 2387 | 7.33× | 9.86× | 72.33× |
| graph routes (base) | 13 | 130 | 1300 | 10.00× | 10.00× | 100.00× |
| graph trips (base) | 130 | 1300 | 13000 | 10.00× | 10.00× | 100.00× |
| graph stopTimes wired | 2364 | 23640 | 236400 | 10.00× | 10.00× | 100.00× |
| graph services | 5 | 50 | 500 | 10.00× | 10.00× | 100.00× |
| idx tripSlots | 151 | 1459 | 14708 | 9.66× | 10.08× | 97.40× |
| idx stopTimeSlots | 2448 | 24457 | 244818 | 9.99× | 10.01× | 100.01× |
| idx routeMembers | 16 | 152 | 1517 | 9.50× | 9.98× | 94.81× |
| idx serviceMembers | 8 | 72 | 717 | 9.00× | 9.96× | 89.62× |
| k mean | 5.106 | 4.330 | 4.265 | 0.85× | 0.99× | 0.84× |
| k p50 | 1 | 1 | 1 | 1.00× | 1.00× | 1.00× |
| k p95 | 18.500 | 18 | 18 | 0.97× | 1.00× | 0.97× |
| k max | 27 | 27 | 27 | 1.00× | 1.00× | 1.00× |
| k CREATE mean | 1 | 1 | 1 | 1.00× | 1.00× | 1.00× |
| k CREATE p50 | 1 | 1 | 1 | 1.00× | 1.00× | 1.00× |
| k CREATE p95 | 1 | 1 | 1 | 1.00× | 1.00× | 1.00× |
| k CREATE max | 1 | 1 | 1 | 1.00× | 1.00× | 1.00× |
| k UPDATE mean | 12.143 | 9.667 | 10.965 | 0.80× | 1.13× | 0.90× |
| k UPDATE p50 | 1 | 1 | 1 | 1.00× | 1.00× | 1.00× |
| k UPDATE p95 | 27 | 27 | 27 | 1.00× | 1.00× | 1.00× |
| k UPDATE max | 27 | 27 | 27 | 1.00× | 1.00× | 1.00× |
| k DELETE mean | 17.424 | 17.438 | 17.437 | 1.00× | 1.00× | 1.00× |
| k DELETE p50 | 18 | 18 | 18 | 1.00× | 1.00× | 1.00× |
| k DELETE p95 | 19 | 19 | 19 | 1.00× | 1.00× | 1.00× |
| k DELETE max | 19 | 19 | 19 | 1.00× | 1.00× | 1.00× |
| recomputeMs p50 | 0.0037 | 0.0038 | 0.0031 | 1.03× | 0.82× | 0.84× |
| recomputeMs p95 | 0.0730 | 0.0967 | 0.1307 | 1.32× | 1.35× | 1.79× |
| early-cutoff | 0.0052 | 0.0050 | 0.0049 | 0.96× | 0.99× | 0.94× |
| loadMs (separate) | 332.3 | 2855.5 | 32541.2 | 8.59× | 11.40× | 97.94× |

CREATE n: 111 → 1020 → 10560; UPDATE n: 7 → 42 → 454; DELETE n: 33 → 242 → 2387.

## scale-100 measurable by kind

- 8418× `CREATE/stopTime`
- 2170× `DELETE/trip`
- 1708× `CREATE/trip`
- 217× `CREATE/route`
- 217× `DELETE/route`
- 217× `CREATE/service`
- 84× `UPDATE/service.startDate`
- 84× `UPDATE/service.endDate`
- 47× `UPDATE/service.sunday`
- 45× `UPDATE/service.tuesday`
- 42× `UPDATE/service.monday`
- 41× `UPDATE/service.friday`
- 40× `UPDATE/service.thursday`
- 38× `UPDATE/service.wednesday`
- 33× `UPDATE/service.saturday`

## Files

- `results/scale1-base-seed0-sweep.{json,md,tsv}`
- `results/scale10-base-seed0-sweep.{json,md,tsv}`
- `results/scale100-base-seed0-sweep.{json,md,tsv}`
- `results/scale1-vs-scale10-vs-scale100-summary.{json,md}`
- Data: `data/scale{1,10,100}/{base,seed0}/` (gitignored)
- Run: `node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=100` (from `Typescript/`)
