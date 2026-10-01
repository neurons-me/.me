/**
 * Sweep ALL honestly measurable base→seed0 mutations.
 * Measures dependency propagation — NOT RML materialization.
 *
 * Timing split (never mix load into mutation claim):
 *   loadMs | mutationApplyMs | recomputeMs
 *
 * Usage (from Typescript/):
 *   node tests/Benchmarks/GTFS-Madrid/sweep-seed0.ts [--scale=1|10|100]
 */
import ME from "../../../dist/index.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  idxRouteCountPath,
  idxRouteTripCountPath,
  idxServiceCountPath,
  idxTripStopTimeCountPath,
  stopTimeId,
} from "./adapter.ts";
import {
  createRoute,
  createService,
  createStopTime,
  createTrip,
  deleteRoute,
  deleteTrip,
  updateServiceField,
  updateTripRoute,
  type Mutation,
  type MutationType,
} from "./workload.ts";
import {
  baseDir,
  csvBool,
  gtfsDateToNumber,
  hasScaleData,
  inventoryDeltas,
  loadSnapshot,
  loadSnapshotIntoMe,
  pathSafeId,
  seed0Dir,
  stableNumericId,
  wireCreateAggregates,
  type DeltaEntry,
  type GtfsSnapshot,
  type ScaleFactor,
} from "./load-real.ts";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

interface ExplainMeta {
  k?: number;
  recomputed?: string[];
  changed?: string[];
  sourcePath?: string;
  dependsOn?: string[];
}

export interface MeasuredMutation {
  type: MutationType;
  label: string;
  id: string;
  kind: string;
  field?: string;
  k: number | null;
  recomputed: number;
  changed: number;
  unchanged: number;
  latency_ms: number;
  mutationApplyMs: number;
  recomputeMs: number;
  sourcePath: string | null;
  probePath: string | null;
  probeCount: number;
}

function explainMeta(me: CallableMe, path: string): ExplainMeta {
  const trace = me.explain(path) as { meta?: ExplainMeta };
  return trace?.meta ?? {};
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const w = rank - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function dist(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return {
    mean: mean(s),
    median: percentile(s, 50),
    p50: percentile(s, 50),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
    max: s.length ? s[s.length - 1] : null,
    n: s.length,
  };
}

function measureOne(
  me: CallableMe,
  mutation: Mutation,
  probePaths: string[],
  extra: { id: string; kind: string; field?: string }
): MeasuredMutation {
  // Warm dependents so they are subscribed before the source mutates.
  for (const p of probePaths) {
    try {
      me(p);
    } catch {
      /* ignore warm errors */
    }
  }

  const tApply0 = performance.now();
  mutation.apply(me);
  const mutationApplyMs = performance.now() - tApply0;

  const tRec0 = performance.now();
  for (const p of probePaths) {
    me(p);
  }
  const recomputeMs = performance.now() - tRec0;

  const probePath = probePaths[0] ?? null;
  const meta = probePath ? explainMeta(me, probePath) : {};
  const recomputedArr = meta.recomputed ?? [];
  const changedArr = meta.changed ?? [];
  const recomputed = recomputedArr.length;
  const changed = changedArr.length;
  const unchanged = Math.max(0, recomputed - changed);

  return {
    type: mutation.type,
    label: mutation.label,
    id: extra.id,
    kind: extra.kind,
    field: extra.field,
    k: meta.k ?? null,
    recomputed,
    changed,
    unchanged,
    latency_ms: mutationApplyMs + recomputeMs,
    mutationApplyMs,
    recomputeMs,
    sourcePath: meta.sourcePath ?? null,
    probePath,
    probeCount: probePaths.length,
  };
}

const SERVICE_DAY_FIELDS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

function buildMeasurablePlan(
  base: GtfsSnapshot,
  seed: GtfsSnapshot,
  inventory: DeltaEntry[]
): Array<{
  delta: DeltaEntry;
  mutation: Mutation;
  probePaths: (me: CallableMe, base: GtfsSnapshot, seed: GtfsSnapshot) => string[];
}> {
  const plan: Array<{
    delta: DeltaEntry;
    mutation: Mutation;
    probePaths: (me: CallableMe, base: GtfsSnapshot, seed: GtfsSnapshot) => string[];
  }> = [];

  const seedCal = new Map(seed.calendar.map((r) => [r.service_id, r]));
  const seedTrips = new Map(seed.trips.map((r) => [r.trip_id, r]));
  const seedRoutes = new Map(seed.routes.map((r) => [r.route_id, r]));

  // 1) UPDATEs first (tree still complete)
  for (const d of inventory) {
    if (!d.measurable) continue;
    if (d.type === "UPDATE" && d.kind === "service") {
      const pathId = pathSafeId(d.id);
      const field = String(d.field ?? "");
      if (SERVICE_DAY_FIELDS.has(field)) {
        const to = Boolean(d.to);
        plan.push({
          delta: d,
          mutation: updateServiceField(
            pathId,
            field as
              | "monday"
              | "tuesday"
              | "wednesday"
              | "thursday"
              | "friday"
              | "saturday"
              | "sunday",
            to
          ),
          // Probe active first so explain().meta reflects THIS write's wave
          // (lives keep the prior wave when early-cutoff skips them).
          probePaths: (_me, snap) => [
            `gtfs.services.${pathId}.active`,
            ...snap.trips
              .filter((t) => t.service_id === d.id)
              .map((t) => `gtfs.trips.${pathSafeId(t.trip_id)}.live`),
          ],
        });
      } else if (field === "startDate" || field === "endDate") {
        const to = Number(d.to);
        plan.push({
          delta: d,
          mutation: updateServiceField(pathId, field, to),
          probePaths: (_me, snap) => [
            `gtfs.services.${pathId}.active`,
            ...snap.trips
              .filter((t) => t.service_id === d.id)
              .map((t) => `gtfs.trips.${pathSafeId(t.trip_id)}.live`),
          ],
        });
      }
    }
    if (d.type === "UPDATE" && d.kind === "trip" && d.field === "route_id") {
      const tripPath = pathSafeId(d.id);
      const code = stableNumericId(String(d.to ?? ""));
      plan.push({
        delta: d,
        mutation: updateTripRoute(tripPath, code),
        probePaths: (_me, snap) =>
          snap.stopTimes
            .filter((st) => st.trip_id === d.id)
            .map(
              (st) =>
                `gtfs.stopTimes.${stopTimeId(pathSafeId(st.trip_id), Number(st.stop_sequence) || 0, st.stop_id)}.routeId`
            ),
      });
    }
  }

  // 2) CREATE service → idx.serviceCount
  for (const d of inventory) {
    if (!d.measurable || d.type !== "CREATE" || d.kind !== "service") continue;
    const row = seedCal.get(d.id);
    if (!row) continue;
    const pathId = pathSafeId(d.id);
    plan.push({
      delta: d,
      mutation: createService({
        serviceId: pathId,
        monday: csvBool(row.monday),
        tuesday: csvBool(row.tuesday),
        wednesday: csvBool(row.wednesday),
        thursday: csvBool(row.thursday),
        friday: csvBool(row.friday),
        saturday: csvBool(row.saturday),
        sunday: csvBool(row.sunday),
        startDate: gtfsDateToNumber(row.start_date),
        endDate: gtfsDateToNumber(row.end_date),
      }),
      probePaths: () => [idxServiceCountPath()],
    });
  }

  // 3) CREATE route → idx.routeCount
  for (const d of inventory) {
    if (!d.measurable || d.type !== "CREATE" || d.kind !== "route") continue;
    const row = seedRoutes.get(d.id);
    if (!row) continue;
    const pathId = pathSafeId(d.id);
    plan.push({
      delta: d,
      mutation: createRoute({
        routeId: pathId,
        code: stableNumericId(d.id),
        shortName: row.route_short_name || d.id,
        active: true,
      }),
      probePaths: () => [idxRouteCountPath()],
    });
  }

  // 4) CREATE trip → idx.routes.<route>.tripCount
  for (const d of inventory) {
    if (!d.measurable || d.type !== "CREATE" || d.kind !== "trip") continue;
    const row = seedTrips.get(d.id);
    if (!row) continue;
    const tripPath = pathSafeId(d.id);
    const routePath = pathSafeId(row.route_id);
    plan.push({
      delta: d,
      mutation: createTrip({
        tripId: tripPath,
        routeId: routePath,
        routeCode: stableNumericId(row.route_id),
        serviceId: pathSafeId(row.service_id),
      }),
      probePaths: () => [idxRouteTripCountPath(routePath)],
    });
  }

  // 5) CREATE stopTime → idx.trips.<trip>.stopTimeCount
  for (const d of inventory) {
    if (!d.measurable || d.type !== "CREATE" || d.kind !== "stopTime") continue;
    const [tripGtfs, seqStr, stopId] = d.id.split("|");
    const tripPath = pathSafeId(tripGtfs);
    const seq = Number(seqStr) || 0;
    const seedRow = seed.stopTimes.find(
      (r) =>
        r.trip_id === tripGtfs &&
        String(r.stop_sequence) === seqStr &&
        r.stop_id === stopId
    );
    plan.push({
      delta: d,
      mutation: createStopTime({
        tripId: tripPath,
        stopId: stopId ?? seedRow?.stop_id ?? "",
        stopSequence: seq,
        arrivalTime: seedRow?.arrival_time,
        departureTime: seedRow?.departure_time,
      }),
      probePaths: () => [idxTripStopTimeCountPath(tripPath)],
    });
  }

  // 6) DELETE routes while trips still exist (validRoute probes)
  for (const d of inventory) {
    if (!d.measurable) continue;
    if (d.type === "DELETE" && d.kind === "route") {
      const pathId = pathSafeId(d.id);
      plan.push({
        delta: d,
        mutation: deleteRoute(pathId),
        probePaths: (_me, snap) =>
          snap.trips
            .filter((t) => t.route_id === d.id)
            .map((t) => `gtfs.trips.${pathSafeId(t.trip_id)}.validRoute`),
      });
    }
  }

  // 7) DELETE trips while stopTimes still exist (routeId ABSENCE)
  for (const d of inventory) {
    if (!d.measurable) continue;
    if (d.type === "DELETE" && d.kind === "trip") {
      const pathId = pathSafeId(d.id);
      plan.push({
        delta: d,
        mutation: deleteTrip(pathId),
        probePaths: (_me, snap) =>
          snap.stopTimes
            .filter((st) => st.trip_id === d.id)
            .map(
              (st) =>
                `gtfs.stopTimes.${stopTimeId(pathSafeId(st.trip_id), Number(st.stop_sequence) || 0, st.stop_id)}.routeId`
            ),
      });
    }
  }

  return plan;
}

function parseScale(argv: string[]): ScaleFactor {
  const arg = argv.find((a) => a.startsWith("--scale="));
  const raw = arg ? arg.slice("--scale=".length) : process.env.GTFS_SCALE ?? "1";
  if (raw === "1" || raw === "10" || raw === "100") return Number(raw) as ScaleFactor;
  console.error(`Unsupported --scale=${raw} (use 1, 10, or 100)`);
  process.exit(1);
  return 1;
}

async function main() {
  const scale = parseScale(process.argv.slice(2));
  const BASE_DIR = baseDir(scale);
  const SEED0_DIR = seed0Dir(scale);
  const tag = `scale${scale}`;

  console.log("\n========================================================");
  console.log(`.me SWEEP: GTFS-Madrid scale-${scale} base→seed0`);
  console.log("Measures dependency propagation — NOT RML materialization");
  console.log("========================================================\n");

  if (!hasScaleData(scale)) {
    console.error(`Missing data/${tag}/{base,seed0}. Abort.`);
    process.exitCode = 1;
    return;
  }

  const base = loadSnapshot(BASE_DIR);
  const seed0 = loadSnapshot(SEED0_DIR);
  const inventory = inventoryDeltas(base, seed0);
  const measurable = inventory.filter((d) => d.measurable);
  const skipped = inventory.filter((d) => !d.measurable);

  console.log("Snapshot sizes:");
  console.log(
    `  base:  routes=${base.routes.length} trips=${base.trips.length} stop_times=${base.stopTimes.length} calendar=${base.calendar.length} calendar_dates=${base.calendarDates.length}`
  );
  console.log(
    `  seed0: routes=${seed0.routes.length} trips=${seed0.trips.length} stop_times=${seed0.stopTimes.length} calendar=${seed0.calendar.length} calendar_dates=${seed0.calendarDates.length}`
  );
  console.log(
    `Inventory: total=${inventory.length} measurable=${measurable.length} skipped=${skipped.length}`
  );
  const skipByReason = new Map<string, number>();
  for (const s of skipped) {
    const r = s.skipReason ?? "(none)";
    skipByReason.set(r, (skipByReason.get(r) ?? 0) + 1);
  }
  console.log("Skipped by reason:");
  for (const [r, n] of [...skipByReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}×  ${r}`);
  }
  const measBy = new Map<string, number>();
  for (const m of measurable) {
    const k = `${m.type}/${m.kind}${m.field ? "." + m.field : ""}`;
    measBy.set(k, (measBy.get(k) ?? 0) + 1);
  }
  console.log("Measurable by kind:");
  for (const [k, n] of [...measBy.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}×  ${k}`);
  }

  const plan = buildMeasurablePlan(base, seed0, inventory);
  console.log(
    `\nPlan: ${plan.length} mutations (order: UPDATE → CREATE service/route/trip/stopTime → DELETE route/trip)\n`
  );

  const me = new ME() as CallableMe;
  console.log("Loading base into .me (all stopTimes wired)...");
  const tLoad0 = performance.now();
  const loadStats = loadSnapshotIntoMe(me, base); // wire all
  const idxStats = wireCreateAggregates(me, base, seed0);
  const loadMs = performance.now() - tLoad0;
  console.log(
    `loadMs=${loadMs.toFixed(2)} routes=${loadStats.routes} trips=${loadStats.trips} stopTimesWired=${loadStats.stopTimesWired} services=${loadStats.services}`
  );
  console.log(
    `idx aggregates: routesIndexed=${idxStats.routesIndexed} tripSlots=${idxStats.tripsIndexed} stopTimeSlots=${idxStats.stopTimeSlots} routeMembers=${idxStats.routeMembers} serviceMembers=${idxStats.serviceMembers}`
  );

  // Warm idx aggregates so CREATE waves have subscribed parents
  try {
    me(idxRouteCountPath());
    me(idxServiceCountPath());
  } catch {
    /* ignore */
  }

  const measured: MeasuredMutation[] = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const probes = step.probePaths(me, base, seed0);
    if (probes.length === 0) {
      console.log(
        `[${i + 1}/${plan.length}] SKIP empty probes ${step.delta.type} ${step.delta.kind} ${step.delta.id}`
      );
      skipped.push({
        ...step.delta,
        measurable: false,
        skipReason: "no probe dependents in base snapshot at apply time",
      });
      continue;
    }
    const row = measureOne(me, step.mutation, probes, {
      id: step.delta.id,
      kind: step.delta.kind,
      field: step.delta.field,
    });
    measured.push(row);
    console.log(
      `[${i + 1}/${plan.length}] ${row.type.padEnd(6)} ${row.kind.padEnd(8)} id=${row.id}${row.field ? "." + row.field : ""} k=${row.k} recomputed=${row.recomputed} changed=${row.changed} unchanged=${row.unchanged} applyMs=${row.mutationApplyMs.toFixed(3)} recomputeMs=${row.recomputeMs.toFixed(3)} probes=${row.probeCount}`
    );
  }

  const kVals = measured.map((m) => m.k).filter((x): x is number => x != null);
  const recomputeLat = measured.map((m) => m.recomputeMs);
  const applyLat = measured.map((m) => m.mutationApplyMs);
  const totalRecomputed = measured.reduce((a, m) => a + m.recomputed, 0);
  const totalChanged = measured.reduce((a, m) => a + m.changed, 0);
  const totalUnchanged = measured.reduce((a, m) => a + m.unchanged, 0);
  const earlyCutoffRatio =
    totalRecomputed > 0 ? totalUnchanged / totalRecomputed : null;

  const creates = measured.filter((m) => m.type === "CREATE").length;
  const updates = measured.filter((m) => m.type === "UPDATE").length;
  const deletes = measured.filter((m) => m.type === "DELETE").length;

  const byTypeKind = (type: MutationType) => {
    const xs = measured.filter((m) => m.type === type);
    const ks = xs.map((m) => m.k).filter((x): x is number => x != null);
    return { n: xs.length, k: dist(ks) };
  };

  const aggregate = {
    mutations: measured.length,
    creates,
    updates,
    deletes,
    skipped: skipped.length,
    k: dist(kVals),
    kByType: {
      CREATE: byTypeKind("CREATE"),
      UPDATE: byTypeKind("UPDATE"),
      DELETE: byTypeKind("DELETE"),
    },
    latency_recompute_ms: dist(recomputeLat),
    latency_apply_ms: dist(applyLat),
    latency_total_mutation_ms: dist(measured.map((m) => m.latency_ms)),
    totalRecomputed,
    totalChanged,
    totalUnchanged,
    earlyCutoffRatio,
    loadMs: Number(loadMs.toFixed(4)),
    mutationApplyMs_sum: Number(
      applyLat.reduce((a, b) => a + b, 0).toFixed(4)
    ),
    recomputeMs_sum: Number(
      recomputeLat.reduce((a, b) => a + b, 0).toFixed(4)
    ),
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "results");
  mkdirSync(outDir, { recursive: true });

  const summary = {
    version: `${tag}-CHANGE/base→seed0-sweep`,
    claim: "dependency propagation (not RML materialization)",
    timingNote:
      "loadMs is separate; per-mutation latency_ms = mutationApplyMs + recomputeMs only",
    createSemantics:
      "gtfs.idx membership slots (0 pre-seeded for seed-only ids, 1 for base) + parent sum aggregates (routeCount/serviceCount/tripCount/stopTimeCount); CREATE flips slot → aggregate wave",
    calendarSemantics:
      "service.active = (mon||…||sun) && startDate>0 && endDate>=startDate; day/date UPDATEs invalidate active → trips.*.live",
    dataPaths: { base: BASE_DIR, seed0: SEED0_DIR },
    loadStats,
    idxStats,
    inventory: {
      total: inventory.length,
      measurablePlanned: measurable.length,
      measured: measured.length,
      skipped: skipped.length,
      skippedByReason: Object.fromEntries(skipByReason),
      measurableByKind: Object.fromEntries(measBy),
    },
    aggregate,
    mutations: measured,
    skipped: skipped.map((s) => ({
      type: s.type,
      kind: s.kind,
      id: s.id,
      field: s.field ?? null,
      reason: s.skipReason ?? null,
    })),
  };

  const jsonPath = join(outDir, `${tag}-base-seed0-sweep.json`);
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  // Short markdown table (top by k + aggregate)
  const byK = [...measured].sort((a, b) => (b.k ?? -1) - (a.k ?? -1));
  const mdLines: string[] = [
    `# base→seed0 sweep (propagation only)`,
    ``,
    `Claim: dependency propagation — NOT RML materialization.`,
    ``,
    `CREATE semantics: \`gtfs.idx\` membership + parent \`*Count\` sum aggregates (slot 0→1).`,
    `Calendar: \`active\` derived from mon–sun + numeric start/end dates.`,
    ``,
    `| metric | value |`,
    `|---|---|`,
    `| measured N | ${aggregate.mutations} |`,
    `| skipped | ${aggregate.skipped} |`,
    `| CREATE/UPDATE/DELETE | ${creates}/${updates}/${deletes} |`,
    `| loadMs | ${aggregate.loadMs.toFixed(2)} |`,
    `| k mean / p50 / p95 / max | ${fmt(aggregate.k.mean)} / ${fmt(aggregate.k.p50)} / ${fmt(aggregate.k.p95)} / ${fmt(aggregate.k.max)} |`,
    `| k CREATE mean/p50/max | ${fmt(aggregate.kByType.CREATE.k.mean)} / ${fmt(aggregate.kByType.CREATE.k.p50)} / ${fmt(aggregate.kByType.CREATE.k.max)} (n=${aggregate.kByType.CREATE.n}) |`,
    `| k UPDATE mean/p50/max | ${fmt(aggregate.kByType.UPDATE.k.mean)} / ${fmt(aggregate.kByType.UPDATE.k.p50)} / ${fmt(aggregate.kByType.UPDATE.k.max)} (n=${aggregate.kByType.UPDATE.n}) |`,
    `| k DELETE mean/p50/max | ${fmt(aggregate.kByType.DELETE.k.mean)} / ${fmt(aggregate.kByType.DELETE.k.p50)} / ${fmt(aggregate.kByType.DELETE.k.max)} (n=${aggregate.kByType.DELETE.n}) |`,
    `| recomputeMs p50 / p95 / p99 | ${fmt(aggregate.latency_recompute_ms.p50)} / ${fmt(aggregate.latency_recompute_ms.p95)} / ${fmt(aggregate.latency_recompute_ms.p99)} |`,
    `| applyMs p50 / p95 / p99 | ${fmt(aggregate.latency_apply_ms.p50)} / ${fmt(aggregate.latency_apply_ms.p95)} / ${fmt(aggregate.latency_apply_ms.p99)} |`,
    `| total recomputed / changed / unchanged | ${totalRecomputed} / ${totalChanged} / ${totalUnchanged} |`,
    `| early-cutoff (unchanged/recomputed) | ${earlyCutoffRatio == null ? "n/a" : earlyCutoffRatio.toFixed(4)} |`,
    ``,
    `## Per-mutation (sorted by k desc)`,
    ``,
    `| type | kind | id | field | k | recomputed | changed | unchanged | applyMs | recomputeMs | sourcePath |`,
    `|---|---|---|---|---:|---:|---:|---:|---:|---:|---|`,
  ];
  for (const m of byK) {
    mdLines.push(
      `| ${m.type} | ${m.kind} | ${m.id} | ${m.field ?? ""} | ${m.k ?? ""} | ${m.recomputed} | ${m.changed} | ${m.unchanged} | ${m.mutationApplyMs.toFixed(3)} | ${m.recomputeMs.toFixed(3)} | ${m.sourcePath ?? ""} |`
    );
  }
  const mdPath = join(outDir, `${tag}-base-seed0-sweep.md`);
  writeFileSync(mdPath, mdLines.join("\n") + "\n");

  // TSV
  const tsvHeader =
    "type\tkind\tid\tfield\tk\trecomputed\tchanged\tunchanged\tmutationApplyMs\trecomputeMs\tlatency_ms\tsourcePath\tprobePath";
  const tsvRows = measured.map(
    (m) =>
      `${m.type}\t${m.kind}\t${m.id}\t${m.field ?? ""}\t${m.k ?? ""}\t${m.recomputed}\t${m.changed}\t${m.unchanged}\t${m.mutationApplyMs.toFixed(4)}\t${m.recomputeMs.toFixed(4)}\t${m.latency_ms.toFixed(4)}\t${m.sourcePath ?? ""}\t${m.probePath ?? ""}`
  );
  const tsvPath = join(outDir, `${tag}-base-seed0-sweep.tsv`);
  writeFileSync(tsvPath, [tsvHeader, ...tsvRows].join("\n") + "\n");

  console.log("\n======== AGGREGATE ========");
  console.log(JSON.stringify(aggregate, null, 2));
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${tsvPath}`);
  console.log("\nDone.\n");
}

function fmt(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return "n/a";
  return Number.isInteger(x) ? String(x) : x.toFixed(3);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
