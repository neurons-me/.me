# scale-1 vs scale-10 side-by-side (base→seed0 sweep)

Claim: dependency propagation — NOT RML materialization.

CREATE honesty: CREATE has no prior dependency edge; benchmark models creation via explicit `gtfs.idx` membership/index slots → measurable wave when a member enters the set. **Not** natural GTFS CREATE k=1.

## n vs k locality

Graph size **n** scales ~10×; mutation count ~8.6×; **k stays flat** (p50=1, p95≈18, max=27 both scales). Locality preserved under scale-up.

| metric | scale-1 | scale-10 | ratio |
|---|---:|---:|---:|
| mutations N | 151 | 1304 | 8.64× |
| creates | 111 | 1020 | 9.19× |
| updates | 7 | 42 | 6.00× |
| deletes | 33 | 242 | 7.33× |
| graph routes (base) | 13 | 130 | 10.00× |
| graph trips (base) | 130 | 1300 | 10.00× |
| graph stopTimes wired | 2364 | 23640 | 10.00× |
| graph services | 5 | 50 | 10.00× |
| idx tripSlots | 151 | 1459 | 9.66× |
| idx stopTimeSlots | 2448 | 24457 | 9.99× |
| idx routeMembers | 16 | 152 | 9.50× |
| idx serviceMembers | 8 | 72 | 9.00× |
| k mean | 5.106 | 4.330 | 0.85× |
| k p50 | 1 | 1 | 1.00× |
| k p95 | 18.500 | 18 | 0.97× |
| k max | 27 | 27 | 1.00× |
| k CREATE mean (n=111→1020) | 1 | 1 | 1.00× |
| k CREATE p50 | 1 | 1 | 1.00× |
| k CREATE p95 | 1 | 1 | 1.00× |
| k CREATE max | 1 | 1 | 1.00× |
| k UPDATE mean (n=7→42) | 12.143 | 9.667 | 0.80× |
| k UPDATE p50 | 1 | 1 | 1.00× |
| k UPDATE p95 | 27 | 27 | 1.00× |
| k UPDATE max | 27 | 27 | 1.00× |
| k DELETE mean (n=33→242) | 17.424 | 17.438 | 1.00× |
| k DELETE p50 | 18 | 18 | 1.00× |
| k DELETE p95 | 19 | 19 | 1.00× |
| k DELETE max | 19 | 19 | 1.00× |
| recomputeMs p50 | 0.0037 | 0.0033 | 0.89× |
| recomputeMs p95 | 0.0730 | 0.0857 | 1.17× |
| early-cutoff | 0.0052 | 0.0050 | 0.96× |
| loadMs (separate) | 332.3 | 2439.7 | 7.34× |

## Files

- `results/scale1-base-seed0-sweep.{json,md,tsv}`
- `results/scale10-base-seed0-sweep.{json,md,tsv}`
- Data: `data/scale1/{base,seed0}/`, `data/scale10/{base,seed0}/` (gitignored)
- Run: `node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts --scale=10` (from `Typescript/`)

