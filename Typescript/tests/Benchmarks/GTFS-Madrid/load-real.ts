/**
 * Load Van Assche GTFS-Madrid CSV dumps into .me (scale-1 / scale-10 / scale-100).
 * String GTFS ids → stable deterministic numeric codes (for `=` formulas).
 *
 * Expected layout (gitignored):
 *   data/scale{N}/base/{routes,trips,stop_times,calendar,calendar_dates}.txt
 *   data/scale{N}/seed0/...  (first CHANGE version)
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type MeLike,
  stopTimeId,
  upsertRoute,
  upsertService,
  upsertStopTime,
  upsertTrip,
  wireMetaRouteCount,
  wireMetaServiceCount,
  wireRouteTripCount,
  wireTripStopTimeCount,
} from "./adapter.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export type ScaleFactor = 1 | 10 | 100;

export function scaleDir(scale: ScaleFactor): string {
  return join(HERE, "data", `scale${scale}`);
}

export function baseDir(scale: ScaleFactor): string {
  return join(scaleDir(scale), "base");
}

export function seed0Dir(scale: ScaleFactor): string {
  return join(scaleDir(scale), "seed0");
}

/** @deprecated use baseDir(1) / seed0Dir(1) */
export const SCALE1_DIR = scaleDir(1);
/** @deprecated use baseDir(1) */
export const BASE_DIR = baseDir(1);
/** @deprecated use seed0Dir(1) */
export const SEED0_DIR = seed0Dir(1);

export function hasScaleData(scale: ScaleFactor): boolean {
  const b = baseDir(scale);
  const s = seed0Dir(scale);
  return (
    existsSync(join(b, "routes.txt")) &&
    existsSync(join(b, "trips.txt")) &&
    existsSync(join(b, "stop_times.txt")) &&
    existsSync(join(b, "calendar.txt")) &&
    existsSync(join(s, "calendar.txt"))
  );
}

export function hasScale1Data(): boolean {
  return hasScaleData(1);
}

/**
 * Stable numeric id from GTFS string (NOT row index).
 * Hex-like (incl. zero-padded 20-char Madrid ids) → parseInt(hex);
 * else FNV-1a → 1..2e9.
 */
export function stableNumericId(raw: string): number {
  const s = String(raw ?? "").trim();
  if (!s) return 1;
  if (/^[0-9a-fA-F]+$/.test(s)) {
    const stripped = s.replace(/^0+/, "") || "0";
    // avoid precision loss on huge hex; Madrid bench ids fit in < 2^53
    if (stripped.length <= 13) {
      const n = Number.parseInt(stripped, 16);
      if (Number.isFinite(n) && n >= 0) return n === 0 ? 1 : n;
    }
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 2_000_000_000) + 1;
}

/**
 * Path-safe node key for .me (formulas tokenize pure-digit segments as numbers,
 * which breaks dotted refs like gtfs.services.000…003.active).
 * Always starts with a letter: n<numericId>.
 */
export function pathSafeId(raw: string): string {
  return `n${stableNumericId(raw)}`;
}

/** GTFS date "YYYY-MM-DD" or "YYYYMMDD" → number YYYYMMDD (0 if unparseable). */
export function gtfsDateToNumber(raw: string | undefined): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const digits = s.replace(/-/g, "");
  if (!/^\d{8}$/.test(digits)) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function csvBool(v: string | undefined): boolean {
  return v === "1" || v === "true";
}

export interface CsvRow {
  [key: string]: string;
}

export function readCsv(path: string): CsvRow[] {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = cols[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  // GTFS Madrid dumps are simple (no embedded commas/quotes in practice)
  return line.split(",").map((s) => s.trim());
}

export interface GtfsSnapshot {
  routes: CsvRow[];
  trips: CsvRow[];
  stopTimes: CsvRow[];
  calendar: CsvRow[];
  calendarDates: CsvRow[];
}

export function loadSnapshot(dir: string): GtfsSnapshot {
  return {
    routes: readCsv(join(dir, "routes.txt")),
    trips: readCsv(join(dir, "trips.txt")),
    stopTimes: readCsv(join(dir, "stop_times.txt")),
    calendar: readCsv(join(dir, "calendar.txt")),
    calendarDates: existsSync(join(dir, "calendar_dates.txt"))
      ? readCsv(join(dir, "calendar_dates.txt"))
      : [],
  };
}

export interface LoadStats {
  routes: number;
  trips: number;
  stopTimes: number;
  services: number;
  stopTimesWired: number;
}

/**
 * Load a snapshot into me. Optionally limit stopTime formula wiring
 * to trips in `wireStopTimesFor` (smoke); omit to wire all.
 */
export function loadSnapshotIntoMe(
  me: MeLike,
  snap: GtfsSnapshot,
  opts?: { wireStopTimesFor?: Set<string> }
): LoadStats {
  // Map GTFS string ids → path-safe keys (n<num>) so `=` formulas keep dotted paths intact.
  for (const r of snap.routes) {
    const routeId = pathSafeId(r.route_id);
    upsertRoute(me, {
      routeId,
      code: stableNumericId(r.route_id),
      shortName: r.route_short_name || r.route_id,
      active: true,
    });
    (me as any).gtfs.routes[routeId].gtfsId(r.route_id);
  }

  for (const s of snap.calendar) {
    const serviceId = pathSafeId(s.service_id);
    upsertService(me, {
      serviceId,
      monday: csvBool(s.monday),
      tuesday: csvBool(s.tuesday),
      wednesday: csvBool(s.wednesday),
      thursday: csvBool(s.thursday),
      friday: csvBool(s.friday),
      saturday: csvBool(s.saturday),
      sunday: csvBool(s.sunday),
      startDate: gtfsDateToNumber(s.start_date),
      endDate: gtfsDateToNumber(s.end_date),
    });
    (me as any).gtfs.services[serviceId].gtfsId(s.service_id);
  }

  for (const t of snap.trips) {
    const tripId = pathSafeId(t.trip_id);
    upsertTrip(me, {
      tripId,
      routeId: pathSafeId(t.route_id),
      routeCode: stableNumericId(t.route_id),
      serviceId: pathSafeId(t.service_id),
    });
    (me as any).gtfs.trips[tripId].gtfsId(t.trip_id);
  }

  let stopTimesWired = 0;
  const filter = opts?.wireStopTimesFor;
  for (const st of snap.stopTimes) {
    if (filter && !filter.has(st.trip_id)) continue;
    upsertStopTime(me, {
      tripId: pathSafeId(st.trip_id),
      stopId: st.stop_id,
      stopSequence: Number(st.stop_sequence) || 0,
      arrivalTime: st.arrival_time,
      departureTime: st.departure_time,
    });
    stopTimesWired++;
  }

  return {
    routes: snap.routes.length,
    trips: snap.trips.length,
    stopTimes: snap.stopTimes.length,
    services: snap.calendar.length,
    stopTimesWired,
  };
}

/**
 * Pre-seed gtfs.idx membership (base=1, seed-only CREATE=0) and wire sum
 * aggregates so CREATE flips produce a real invalidation wave / k.
 */
export function wireCreateAggregates(
  me: MeLike,
  base: GtfsSnapshot,
  seed: GtfsSnapshot
): {
  routesIndexed: number;
  tripsIndexed: number;
  stopTimeSlots: number;
  routeMembers: number;
  serviceMembers: number;
} {
  const bRoutes = new Set(base.routes.map((r) => r.route_id));
  const sRoutes = new Set(seed.routes.map((r) => r.route_id));
  const allRouteGtfs = new Set([...bRoutes, ...sRoutes]);

  const bTrips = new Map(base.trips.map((t) => [t.trip_id, t]));
  const sTrips = new Map(seed.trips.map((t) => [t.trip_id, t]));
  const allTripGtfs = new Set([...bTrips.keys(), ...sTrips.keys()]);

  const bSt = new Set(
    base.stopTimes.map(
      (r) => `${r.trip_id}|${r.stop_sequence}|${r.stop_id}`
    )
  );
  const allStopTimes = new Map<string, CsvRow>();
  for (const r of base.stopTimes) {
    allStopTimes.set(`${r.trip_id}|${r.stop_sequence}|${r.stop_id}`, r);
  }
  for (const r of seed.stopTimes) {
    allStopTimes.set(`${r.trip_id}|${r.stop_sequence}|${r.stop_id}`, r);
  }

  // route → trips (union; present iff in base)
  const tripsByRoute = new Map<string, Array<{ tripId: string; present: 0 | 1 }>>();
  for (const gtfsRoute of allRouteGtfs) {
    tripsByRoute.set(pathSafeId(gtfsRoute), []);
  }
  for (const gtfsTrip of allTripGtfs) {
    const row = sTrips.get(gtfsTrip) ?? bTrips.get(gtfsTrip)!;
    const routePath = pathSafeId(row.route_id);
    const list = tripsByRoute.get(routePath) ?? [];
    list.push({
      tripId: pathSafeId(gtfsTrip),
      present: bTrips.has(gtfsTrip) ? 1 : 0,
    });
    tripsByRoute.set(routePath, list);
  }
  let tripsIndexed = 0;
  for (const [routePath, members] of tripsByRoute) {
    if (members.length === 0) {
      // still allow empty routeCount parent; tripCount = 0 leaf
      (me as any).gtfs.idx.routes[routePath].tripCount(0);
      continue;
    }
    wireRouteTripCount(me, routePath, members);
    tripsIndexed += members.length;
  }

  // trip → stopTimes
  const stByTrip = new Map<string, Array<{ stId: string; present: 0 | 1 }>>();
  for (const [key, row] of allStopTimes) {
    const tripPath = pathSafeId(row.trip_id);
    const stPath = stopTimeId(
      tripPath,
      Number(row.stop_sequence) || 0,
      row.stop_id
    );
    const list = stByTrip.get(tripPath) ?? [];
    list.push({ stId: stPath, present: bSt.has(key) ? 1 : 0 });
    stByTrip.set(tripPath, list);
  }
  let stopTimeSlots = 0;
  for (const [tripPath, members] of stByTrip) {
    wireTripStopTimeCount(me, tripPath, members);
    stopTimeSlots += members.length;
  }

  const routeMembers = [...allRouteGtfs].map((id) => ({
    routeId: pathSafeId(id),
    present: (bRoutes.has(id) ? 1 : 0) as 0 | 1,
  }));
  wireMetaRouteCount(me, routeMembers);

  const bSvc = new Set(base.calendar.map((r) => r.service_id));
  const sSvc = new Set(seed.calendar.map((r) => r.service_id));
  const serviceMembers = [...new Set([...bSvc, ...sSvc])].map((id) => ({
    serviceId: pathSafeId(id),
    present: (bSvc.has(id) ? 1 : 0) as 0 | 1,
  }));
  wireMetaServiceCount(me, serviceMembers);

  return {
    routesIndexed: tripsByRoute.size,
    tripsIndexed,
    stopTimeSlots,
    routeMembers: routeMembers.length,
    serviceMembers: serviceMembers.length,
  };
}

/** Find calendar services whose monday flag differs between base and seed. */
export function findMondayUpdates(
  base: GtfsSnapshot,
  seed: GtfsSnapshot
): Array<{ serviceId: string; from: boolean; to: boolean }> {
  const b = new Map(
    base.calendar.map((r) => [r.service_id, csvBool(r.monday)])
  );
  const out: Array<{ serviceId: string; from: boolean; to: boolean }> = [];
  for (const r of seed.calendar) {
    if (!b.has(r.service_id)) continue;
    const to = csvBool(r.monday);
    const from = b.get(r.service_id)!;
    if (from !== to) out.push({ serviceId: r.service_id, from, to });
  }
  return out;
}

export function countMutationKinds(base: GtfsSnapshot, seed: GtfsSnapshot) {
  const bTrips = new Set(base.trips.map((t) => t.trip_id));
  const sTrips = new Set(seed.trips.map((t) => t.trip_id));
  const bRoutes = new Set(base.routes.map((r) => r.route_id));
  const sRoutes = new Set(seed.routes.map((r) => r.route_id));
  let tripUpdates = 0;
  for (const t of seed.trips) {
    if (!bTrips.has(t.trip_id)) continue;
    const prev = base.trips.find((x) => x.trip_id === t.trip_id)!;
    if (prev.route_id !== t.route_id || prev.service_id !== t.service_id) {
      tripUpdates++;
    }
  }
  return {
    creates: [...sTrips].filter((id) => !bTrips.has(id)).length,
    deletes: [...bTrips].filter((id) => !sTrips.has(id)).length,
    updates: tripUpdates + findMondayUpdates(base, seed).length,
    routeCreates: [...sRoutes].filter((id) => !bRoutes.has(id)).length,
    routeDeletes: [...bRoutes].filter((id) => !sRoutes.has(id)).length,
  };
}

/** Inventory entry for a base→seed delta (measured or skipped). */
export type DeltaKind =
  | "route"
  | "trip"
  | "stopTime"
  | "service"
  | "calendar_dates";

export interface DeltaEntry {
  type: "CREATE" | "UPDATE" | "DELETE";
  kind: DeltaKind;
  id: string;
  /** Extra field for UPDATEs (e.g. monday, route_id). */
  field?: string;
  from?: string | boolean | number;
  to?: string | boolean | number;
  /** Whether this maps to a measurable propagation mutation. */
  measurable: boolean;
  skipReason?: string;
}

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DATE_FIELDS = ["start_date", "end_date"] as const;

const CREATE_MEASURABLE_NOTE =
  "CREATE flips gtfs.idx membership 0→1; parent *Count aggregate recomputes (real wave)";

/**
 * Full base→seed0 inventory with honest measurability flags.
 * Measurable:
 *   - UPDATE calendar day/date → service.active → trips.*.live
 *   - UPDATE trip.route_id → stopTimes.*.routeId
 *   - DELETE route → trips.*.validRoute (ABSENCE)
 *   - DELETE trip → stopTimes.*.routeId (ABSENCE)
 *   - CREATE route/service/trip/stopTime → gtfs.idx.*Count aggregates
 */
export function inventoryDeltas(
  base: GtfsSnapshot,
  seed: GtfsSnapshot
): DeltaEntry[] {
  const out: DeltaEntry[] = [];

  // --- routes ---
  const bRoutes = new Map(base.routes.map((r) => [r.route_id, r]));
  const sRoutes = new Map(seed.routes.map((r) => [r.route_id, r]));
  for (const id of sRoutes.keys()) {
    if (!bRoutes.has(id)) {
      out.push({
        type: "CREATE",
        kind: "route",
        id,
        measurable: true,
      });
    }
  }
  for (const id of bRoutes.keys()) {
    if (!sRoutes.has(id)) {
      out.push({
        type: "DELETE",
        kind: "route",
        id,
        measurable: true,
      });
    }
  }
  for (const [id, row] of sRoutes) {
    const prev = bRoutes.get(id);
    if (!prev) continue;
    for (const k of Object.keys(row)) {
      if (k === "route_id") continue;
      if ((prev[k] ?? "") !== (row[k] ?? "")) {
        out.push({
          type: "UPDATE",
          kind: "route",
          id,
          field: k,
          from: prev[k],
          to: row[k],
          measurable: false,
          skipReason:
            "route field UPDATEs are not wired to derived edges (only route.active via DELETE ABSENCE)",
        });
      }
    }
  }

  // --- calendar / services ---
  const bCal = new Map(base.calendar.map((r) => [r.service_id, r]));
  const sCal = new Map(seed.calendar.map((r) => [r.service_id, r]));
  for (const id of sCal.keys()) {
    if (!bCal.has(id)) {
      out.push({
        type: "CREATE",
        kind: "service",
        id,
        measurable: true,
      });
    }
  }
  for (const id of bCal.keys()) {
    if (!sCal.has(id)) {
      out.push({
        type: "DELETE",
        kind: "service",
        id,
        measurable: false,
        skipReason:
          "service DELETE not wired as a measured edge yet (trips.live would ABSENCE; prefer explicit me[\"-\"] sweep later)",
      });
    }
  }
  for (const [id, row] of sCal) {
    const prev = bCal.get(id);
    if (!prev) continue;
    for (const f of DAY_FIELDS) {
      if ((prev[f] ?? "") === (row[f] ?? "")) continue;
      out.push({
        type: "UPDATE",
        kind: "service",
        id,
        field: f,
        from: csvBool(prev[f]),
        to: csvBool(row[f]),
        measurable: true, // → service.active → trips.*.live
      });
    }
    for (const f of DATE_FIELDS) {
      if ((prev[f] ?? "") === (row[f] ?? "")) continue;
      const meField = f === "start_date" ? "startDate" : "endDate";
      out.push({
        type: "UPDATE",
        kind: "service",
        id,
        field: meField,
        from: gtfsDateToNumber(prev[f]),
        to: gtfsDateToNumber(row[f]),
        measurable: true, // → service.active → trips.*.live
      });
    }
  }

  // --- trips ---
  const bTrips = new Map(base.trips.map((r) => [r.trip_id, r]));
  const sTrips = new Map(seed.trips.map((r) => [r.trip_id, r]));
  for (const id of sTrips.keys()) {
    if (!bTrips.has(id)) {
      out.push({
        type: "CREATE",
        kind: "trip",
        id,
        measurable: true,
      });
    }
  }
  for (const id of bTrips.keys()) {
    if (!sTrips.has(id)) {
      out.push({
        type: "DELETE",
        kind: "trip",
        id,
        measurable: true, // → stopTimes.*.routeId ABSENCE
      });
    }
  }
  for (const [id, row] of sTrips) {
    const prev = bTrips.get(id);
    if (!prev) continue;
    if (prev.route_id !== row.route_id) {
      out.push({
        type: "UPDATE",
        kind: "trip",
        id,
        field: "route_id",
        from: prev.route_id,
        to: row.route_id,
        measurable: true, // → stopTimes.*.routeId
      });
    }
    if (prev.service_id !== row.service_id) {
      out.push({
        type: "UPDATE",
        kind: "trip",
        id,
        field: "service_id",
        from: prev.service_id,
        to: row.service_id,
        measurable: false,
        skipReason:
          "trip.service_id UPDATE would require rebinding live formula; adapter wires serviceId at CREATE only",
      });
    }
    for (const k of Object.keys(row)) {
      if (
        k === "trip_id" ||
        k === "route_id" ||
        k === "service_id"
      )
        continue;
      if ((prev[k] ?? "") !== (row[k] ?? "")) {
        out.push({
          type: "UPDATE",
          kind: "trip",
          id,
          field: k,
          from: prev[k],
          to: row[k],
          measurable: false,
          skipReason: "trip metadata fields have no derived dependents in adapter",
        });
      }
    }
  }

  // --- stop_times ---
  const stKey = (r: CsvRow) =>
    `${r.trip_id}|${r.stop_sequence}|${r.stop_id}`;
  const bSt = new Map(base.stopTimes.map((r) => [stKey(r), r]));
  const sSt = new Map(seed.stopTimes.map((r) => [stKey(r), r]));
  for (const [key, row] of sSt) {
    if (!bSt.has(key)) {
      out.push({
        type: "CREATE",
        kind: "stopTime",
        id: key,
        measurable: true,
      });
    } else {
      const prev = bSt.get(key)!;
      for (const k of Object.keys(row)) {
        if ((prev[k] ?? "") !== (row[k] ?? "")) {
          out.push({
            type: "UPDATE",
            kind: "stopTime",
            id: key,
            field: k,
            from: prev[k],
            to: row[k],
            measurable: false,
            skipReason:
              "stop_time field UPDATEs are leaves in the adapter (routeId is derived FROM trip)",
          });
        }
      }
    }
  }
  for (const key of bSt.keys()) {
    if (!sSt.has(key)) {
      out.push({
        type: "DELETE",
        kind: "stopTime",
        id: key,
        measurable: false,
        skipReason:
          "stopTime DELETE has no downstream derived edge in current model",
      });
    }
  }

  // --- calendar_dates ---
  const cdKey = (r: CsvRow) =>
    `${r.service_id}|${r.date}|${r.exception_type}`;
  const bCd = new Set(base.calendarDates.map(cdKey));
  const sCd = new Set(seed.calendarDates.map(cdKey));
  for (const id of sCd) {
    if (!bCd.has(id)) {
      out.push({
        type: "CREATE",
        kind: "calendar_dates",
        id,
        measurable: false,
        skipReason:
          "calendar_dates not mapped into .me derived model",
      });
    }
  }
  for (const id of bCd) {
    if (!sCd.has(id)) {
      out.push({
        type: "DELETE",
        kind: "calendar_dates",
        id,
        measurable: false,
        skipReason:
          "calendar_dates not mapped into .me derived model",
      });
    }
  }

  // Annotate measurable CREATEs with semantics (for reports)
  for (const e of out) {
    if (e.type === "CREATE" && e.measurable && !e.skipReason) {
      e.skipReason = undefined;
      // stash note on a non-skip field via comment in reports — keep clean
      void CREATE_MEASURABLE_NOTE;
    }
  }

  return out;
}
