/**
 * Minimal GTFS-Madrid → .me synthetic benchmark (cross-branch deps).
 * No external data. Measures k / recomputed / changed / sourcePath / latency.
 */
import ME from "../../../dist/index.js";
import { ROUTE_CODE } from "./adapter.ts";
import {
  createRoute,
  createService,
  createStopTime,
  createTrip,
  deleteRoute,
  runSequence,
  updateServiceActive,
  updateTripRoute,
  type WorkloadStep,
} from "./workload.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  countMutationKinds,
  findMondayUpdates,
  hasScale1Data,
  loadSnapshot,
  loadSnapshotIntoMe,
  BASE_DIR,
  SEED0_DIR,
  pathSafeId,
  stableNumericId,
} from "./load-real.ts";

type CallableMe = InstanceType<typeof ME> & ((expr: string) => unknown);

interface ExplainMeta {
  k?: number;
  recomputed?: string[];
  changed?: string[];
  sourcePath?: string;
  dependsOn?: string[];
}

function explainMeta(me: CallableMe, path: string): ExplainMeta {
  const trace = me.explain(path) as { meta?: ExplainMeta };
  return trace?.meta ?? {};
}

function printExplain(
  label: string,
  me: CallableMe,
  path: string,
  latencyMs: number
) {
  me(path);
  const meta = explainMeta(me, path);
  console.log(`\n--- ${label} ---`);
  console.log(`path:        ${path}`);
  console.log(`value:       ${JSON.stringify(me(path))}`);
  console.log(`latency_ms:  ${latencyMs.toFixed(4)}`);
  console.log(`k:           ${meta.k ?? "(n/a)"}`);
  console.log(`recomputed:  ${JSON.stringify(meta.recomputed ?? [])}`);
  console.log(`changed:     ${JSON.stringify(meta.changed ?? [])}`);
  console.log(`sourcePath:  ${meta.sourcePath ?? "(n/a)"}`);
  console.log(`dependsOn:   ${JSON.stringify(meta.dependsOn ?? [])}`);
}

function seedSynthetic(me: CallableMe) {
  const steps: WorkloadStep[] = [
    { mutation: createService({ serviceId: "S1", monday: true }) },
    {
      mutation: createRoute({
        routeId: "R1",
        code: ROUTE_CODE.R1,
        shortName: "L1",
        active: true,
      }),
    },
    {
      mutation: createRoute({
        routeId: "R2",
        code: ROUTE_CODE.R2,
        shortName: "L2",
        active: true,
      }),
    },
    {
      mutation: createTrip({
        tripId: "T1",
        routeId: "R1",
        routeCode: ROUTE_CODE.R1,
        serviceId: "S1",
      }),
    },
    {
      mutation: createStopTime({
        tripId: "T1",
        stopId: "ST_A",
        stopSequence: 1,
        arrivalTime: "08:00:00",
      }),
    },
    {
      mutation: createStopTime({
        tripId: "T1",
        stopId: "ST_B",
        stopSequence: 2,
        arrivalTime: "08:05:00",
      }),
    },
  ];
  return runSequence(me, steps);
}

function check(
  name: string,
  ok: boolean,
  detail: string
): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
}

const ARGS = new Set(process.argv.slice(2));
const SKIP_SYNTHETIC = ARGS.has("--skip-synthetic") || ARGS.has("--sweep-only");
const SKIP_REAL = ARGS.has("--skip-real");
const RUN_SWEEP = ARGS.has("--sweep") || ARGS.has("--sweep-only");

async function start() {
  console.log("\n========================================================");
  console.log(".me BENCHMARK: GTFS-Madrid (synthetic, cross-branch)");
  console.log("Measures dependency propagation — NOT RML materialization");
  console.log("========================================================\n");

  if (RUN_SWEEP) {
    console.log("Flag --sweep: delegating to sweep-seed0.ts (full base→seed0 inventory).\n");
    await import("./sweep-seed0.ts");
    return;
  }

  if (SKIP_SYNTHETIC) {
    console.log("Skipping synthetic (--skip-synthetic).\n");
  } else {
  const me = new ME() as CallableMe;

  console.log("Seeding synthetic GTFS-like tree...");
  const seed = seedSynthetic(me);
  console.table(
    seed.map((s) => ({
      type: s.type,
      label: s.label,
      latency_ms: s.latencyMs.toFixed(4),
    }))
  );

  // Warm derived reads so later waves report against known baselines
  console.log("\nWarm values:");
  console.log(`  trips.T1.live              = ${me("gtfs.trips.T1.live")}`);
  console.log(`  stopTimes.T1_1.routeId     = ${me("gtfs.stopTimes.T1_1_ST_A.routeId")}`);
  console.log(`  stopTimes.T1_2.routeId     = ${me("gtfs.stopTimes.T1_2_ST_B.routeId")}`);
  console.log(`  trips.T1.validRoute        = ${me("gtfs.trips.T1.validRoute")}`);

  // --- 1) UPDATE services.S1.active=false ---
  {
    const mut = updateServiceActive("S1", false);
    const t0 = performance.now();
    mut.apply(me);
    me("gtfs.trips.T1.live");
    const dt = performance.now() - t0;
    printExplain(mut.label, me, "gtfs.trips.T1.live", dt);
    const meta = explainMeta(me, "gtfs.trips.T1.live");
    check(
      "1 sourcePath",
      meta.sourcePath === "gtfs.services.S1.monday",
      `got ${meta.sourcePath} (active is derived; write hits monday)`
    );
    check(
      "1 recomputed live",
      (meta.recomputed ?? []).includes("gtfs.trips.T1.live"),
      `recomputed=${JSON.stringify(meta.recomputed)}`
    );
    check("1 k>=1", (meta.k ?? 0) >= 1, `k=${meta.k}`);
    check("1 value false", me("gtfs.trips.T1.live") === false, `value=${me("gtfs.trips.T1.live")}`);
  }

  // --- 2) UPDATE trips.T1.routeId = R2 (numeric 2) ---
  {
    const mut = updateTripRoute("T1", ROUTE_CODE.R2);
    const t0 = performance.now();
    mut.apply(me);
    me("gtfs.stopTimes.T1_1_ST_A.routeId");
    me("gtfs.stopTimes.T1_2_ST_B.routeId");
    const dt = performance.now() - t0;
    printExplain(mut.label, me, "gtfs.stopTimes.T1_1_ST_A.routeId", dt);
    printExplain("(same wave) T1_2", me, "gtfs.stopTimes.T1_2_ST_B.routeId", dt);
    const meta = explainMeta(me, "gtfs.stopTimes.T1_1_ST_A.routeId");
    check(
      "2 sourcePath",
      meta.sourcePath === "gtfs.trips.T1.routeId",
      `got ${meta.sourcePath}`
    );
    check("2 k==2", meta.k === 2, `k=${meta.k}`);
    check(
      "2 recomputed both",
      (meta.recomputed ?? []).includes("gtfs.stopTimes.T1_1_ST_A.routeId") &&
        (meta.recomputed ?? []).includes("gtfs.stopTimes.T1_2_ST_B.routeId"),
      `recomputed=${JSON.stringify(meta.recomputed)}`
    );
    check(
      "2 changed both",
      (meta.changed ?? []).includes("gtfs.stopTimes.T1_1_ST_A.routeId") &&
        (meta.changed ?? []).includes("gtfs.stopTimes.T1_2_ST_B.routeId"),
      `changed=${JSON.stringify(meta.changed)}`
    );
    check(
      "2 values R2",
      me("gtfs.stopTimes.T1_1_ST_A.routeId") === ROUTE_CODE.R2 &&
        me("gtfs.stopTimes.T1_2_ST_B.routeId") === ROUTE_CODE.R2,
      `T1_1=${me("gtfs.stopTimes.T1_1_ST_A.routeId")} T1_2=${me("gtfs.stopTimes.T1_2_ST_B.routeId")}`
    );
  }

  // --- 3) Real DELETE routes.R1 via me["-"] (ABSENCE, not active=false) ---
  {
    const mut = deleteRoute("R1");
    const t0 = performance.now();
    mut.apply(me);
    me("gtfs.trips.T1.validRoute");
    const dt = performance.now() - t0;
    printExplain(mut.label, me, "gtfs.trips.T1.validRoute", dt);
    const meta = explainMeta(me, "gtfs.trips.T1.validRoute");
    const full = me.explain("gtfs.trips.T1.validRoute") as {
      meta?: { unresolved?: { reason?: string; inputs?: string[] } };
    };
    const unresolved = full?.meta?.unresolved;
    console.log(`unresolved:  ${JSON.stringify(unresolved ?? null)}`);
    console.log(
      `note:        false (tombstone) vs undefined (ABSENCE / missing-input)`
    );
    const sp = meta.sourcePath ?? "";
    check(
      "3 sourcePath about removed route",
      sp === "gtfs.routes.R1.active" ||
        sp === "gtfs.routes.R1" ||
        sp.startsWith("gtfs.routes.R1."),
      `got ${meta.sourcePath}`
    );
    check("3 k>0", (meta.k ?? 0) > 0, `k=${meta.k}`);
    check(
      "3 recomputed validRoute",
      (meta.recomputed ?? []).includes("gtfs.trips.T1.validRoute"),
      `recomputed=${JSON.stringify(meta.recomputed)}`
    );
    const vr = me("gtfs.trips.T1.validRoute");
    check(
      "3 value ABSENCE (undefined, not false)",
      vr === undefined,
      `value=${JSON.stringify(vr)} (false would be tombstone semantics)`
    );
    check(
      "3 unresolved missing-input",
      unresolved?.reason === "missing-input",
      `unresolved=${JSON.stringify(unresolved)}`
    );
    check(
      "3 route node removed",
      me("gtfs.routes.R1.active") === undefined,
      `routes.R1.active=${JSON.stringify(me("gtfs.routes.R1.active"))}`
    );
  }

  console.log("\nSynthetic cases done.\n");
  } // end !SKIP_SYNTHETIC

  // --- Real scale-1 smoke (if data/scale1 present) ---
  if (SKIP_REAL) {
    console.log("Skipping real scale-1 smoke (--skip-real).\n");
  } else {
    await runRealScale1Smoke();
  }
}

async function runRealScale1Smoke() {
  console.log("========================================================");
  console.log(".me BENCHMARK: GTFS-Madrid scale-1 (real dump smoke)");
  console.log("========================================================\n");

  if (!hasScale1Data()) {
    console.log("No data/scale1/{base,seed0} — skip real load.");
    console.log("Download Zenodo GTFS-Scale-1-CHANGE and extract CSVs (see README).\n");
    return;
  }

  const base = loadSnapshot(BASE_DIR);
  const seed0 = loadSnapshot(SEED0_DIR);
  const kinds = countMutationKinds(base, seed0);
  const mondayUpdates = findMondayUpdates(base, seed0);
  console.log("Snapshot sizes:");
  console.log(
    `  base:  routes=${base.routes.length} trips=${base.trips.length} stop_times=${base.stopTimes.length} calendar=${base.calendar.length}`
  );
  console.log(
    `  seed0: routes=${seed0.routes.length} trips=${seed0.trips.length} stop_times=${seed0.stopTimes.length} calendar=${seed0.calendar.length}`
  );
  console.log(
    `  delta (trips): creates=${kinds.creates} deletes=${kinds.deletes} fieldUpdates=${kinds.updates}`
  );
  console.log(
    `  monday UPDATEs: ${mondayUpdates.length} ${JSON.stringify(mondayUpdates)}`
  );
  if (mondayUpdates.length === 0) {
    console.log("No monday UPDATE between base→seed0; skip measured smoke.\n");
    return;
  }

  const upd = mondayUpdates[0];
  const svcPathId = pathSafeId(upd.serviceId);
  // Trips on that service (GTFS ids for filter; path-safe for .me probes)
  const tripsOnSvc = base.trips
    .filter((t) => t.service_id === upd.serviceId)
    .map((t) => t.trip_id);
  const wireSet = new Set(tripsOnSvc.slice(0, 3)); // small fan-out for smoke
  console.log(
    `Smoke UPDATE service ${upd.serviceId} (path ${svcPathId}).monday ${upd.from}→${upd.to} (active derived); wire stopTimes for trips: ${[...wireSet].join(", ") || "(none)"}`
  );
  console.log(
    `  id map sample: route ${base.routes[0]?.route_id} → numeric ${stableNumericId(base.routes[0]?.route_id ?? "")} path ${pathSafeId(base.routes[0]?.route_id ?? "")}`
  );

  const me = new ME() as CallableMe;
  const tLoad0 = performance.now();
  const loadStats = loadSnapshotIntoMe(me, base, { wireStopTimesFor: wireSet });
  const loadMs = performance.now() - tLoad0;
  console.log(
    `Loaded into .me in ${loadMs.toFixed(2)}ms (stopTimesWired=${loadStats.stopTimesWired})`
  );

  const probeTripGtfs = tripsOnSvc[0];
  const probeTrip = probeTripGtfs ? pathSafeId(probeTripGtfs) : null;
  const probePath = probeTrip
    ? `gtfs.trips.${probeTrip}.live`
    : `gtfs.services.${svcPathId}.active`;
  console.log(`Warm ${probePath} = ${JSON.stringify(me(probePath))}`);

  const mut = updateServiceActive(svcPathId, upd.to);
  const t0 = performance.now();
  mut.apply(me);
  me(probePath);
  const totalMs = performance.now() - t0;

  const meta = explainMeta(me, probePath);
  printExplain(mut.label + " [real scale-1]", me, probePath, totalMs);
  check(
    "real sourcePath",
    meta.sourcePath === `gtfs.services.${svcPathId}.monday` ||
      meta.sourcePath === `gtfs.services.${svcPathId}.active`,
    `got ${meta.sourcePath} (expect monday write → active → live)`
  );
  check("real k>=1", (meta.k ?? 0) >= 1, `k=${meta.k}`);
  check(
    "real value",
    me(probePath) === upd.to,
    `value=${me(probePath)} expected=${upd.to}`
  );

  const summary = {
    version: "scale-1-CHANGE/base→seed0",
    mutations: 1,
    creates: kinds.creates,
    updates: kinds.updates,
    deletes: kinds.deletes,
    totalMs: Number(totalMs.toFixed(4)),
    loadMs: Number(loadMs.toFixed(4)),
    k: {
      mean: meta.k ?? null,
      p50: meta.k ?? null,
      p95: meta.k ?? null,
      max: meta.k ?? null,
    },
    recomputed: meta.recomputed ?? [],
    changed: meta.changed ?? [],
    sourcePath: meta.sourcePath ?? null,
    smoke: {
      type: "UPDATE",
      serviceId: upd.serviceId,
      servicePathId: svcPathId,
      from: upd.from,
      to: upd.to,
      probePath,
      value: me(probePath),
    },
    loadStats,
    dataPaths: { base: BASE_DIR, seed0: SEED0_DIR },
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "results");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "scale1-smoke-summary.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nDone (synthetic + real scale-1 smoke).\n");
}

start().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
