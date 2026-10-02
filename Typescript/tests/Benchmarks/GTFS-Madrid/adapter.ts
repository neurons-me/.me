/**
 * Stub: map conceptual GTFS entities → .me paths + cross-branch derivations.
 * No mirror/copy fields — dependents read the ORIGINAL mutation path.
 *
 * Expression resolution (kernel): relative-to-evalScope first, then root.
 * Absolute dotted refs like `gtfs.services.S1.active` from a trip scope
 * miss relatively and fall back to the root path — that is the cross-branch edge.
 *
 * Limitation: `=` formulas only evaluate to number | boolean (not strings).
 * Synthetic routeId uses numeric codes (1 = R1, 2 = R2); keep string labels aside.
 *
 * CREATE measurability (honest, kernel-verified):
 *   Parent membership index under gtfs.idx.* with pre-seeded 0/1 slots + sum
 *   aggregate (tripCount / stopTimeCount / routeCount / serviceCount). CREATE
 *   flips a slot 0→1; the aggregate recomputes (real wave / k). Cross-branch
 *   sums over missing child paths fail as missing-input until all exist —
 *   index slots avoid that without fake k.
 *
 * Calendar: service.active is derived from mon–sun + numeric start/end dates
 * so day/date UPDATEs invalidate active → trips.*.live.
 */

export type GtfsEntityKind = "route" | "trip" | "stopTime" | "service";

/** Numeric route codes (string GTFS ids are not valid `=` results). */
export const ROUTE_CODE = { R1: 1, R2: 2 } as const;

export interface GtfsRoute {
  routeId: string;
  /** Numeric code written to .me for derivable edges */
  code: number;
  shortName?: string;
  active?: boolean;
}

export interface GtfsService {
  serviceId: string;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  /** YYYYMMDD numeric (formulas are number|boolean only). */
  startDate?: number;
  endDate?: number;
  /** @deprecated active is derived; kept for call-site compat only */
  active?: boolean;
}

export interface GtfsTrip {
  tripId: string;
  routeId: string;
  routeCode: number;
  serviceId: string;
}

export interface GtfsStopTime {
  tripId: string;
  stopId: string;
  stopSequence: number;
  arrivalTime?: string;
  departureTime?: string;
}

/** Canonical .me path for a GTFS entity field. */
export function pathFor(
  kind: GtfsEntityKind,
  id: string,
  field?: string
): string {
  const root =
    kind === "route"
      ? `gtfs.routes.${id}`
      : kind === "trip"
        ? `gtfs.trips.${id}`
        : kind === "stopTime"
          ? `gtfs.stopTimes.${id}`
          : `gtfs.services.${id}`;
  return field ? `${root}.${field}` : root;
}

/**
 * Unique stopTime path key. Include stopId because GTFS-Madrid CHANGE dumps
 * sometimes omit/duplicate stop_sequence (collapsing rows undercounts k).
 * Hex/numeric stop ids are prefixed so formula tokenization keeps a string segment.
 */
export function stopTimeId(
  tripId: string,
  stopSequence: number,
  stopId?: string
): string {
  const base = `${tripId}_${stopSequence}`;
  if (stopId == null || String(stopId).trim() === "") return base;
  const raw = String(stopId).trim();
  const seg = /^[0-9a-fA-F]+$/.test(raw)
    ? `s${raw}`
    : raw.replace(/[^A-Za-z0-9_]/g, "_");
  return `${base}_${seg}`;
}

/**
 * Cross-branch derived expressions (absolute dotted → root fallback).
 * Wired per concrete id in upsert* for the synthetic mini; [i] broadcast
 * would need per-child serviceId/routeId binding (future adapter work).
 */
export const derivedExpressions = {
  tripLive: (serviceId: string) => `gtfs.services.${serviceId}.active`,
  stopTimeRouteId: (tripId: string) => `gtfs.trips.${tripId}.routeId`,
  tripValidRoute: (routeId: string) => `gtfs.routes.${routeId}.active`,
  /** Relative to gtfs.services.<id> — day flags + date window. */
  serviceActive:
    "(monday || tuesday || wednesday || thursday || friday || saturday || sunday) && startDate > 0 && endDate >= startDate",
} as const;

export interface MeLike {
  [key: string]: unknown;
}

export function upsertRoute(me: MeLike, route: GtfsRoute): void {
  const r = (me as any).gtfs.routes[route.routeId];
  r.label(route.routeId);
  r.shortName(route.shortName ?? route.routeId);
  r.code(route.code);
  r.active(route.active !== false);
}

export function upsertService(me: MeLike, service: GtfsService): void {
  const s = (me as any).gtfs.services[service.serviceId];
  s.serviceId(service.serviceId);
  s.monday(service.monday === true);
  s.tuesday(service.tuesday === true);
  s.wednesday(service.wednesday === true);
  s.thursday(service.thursday === true);
  s.friday(service.friday === true);
  s.saturday(service.saturday === true);
  s.sunday(service.sunday === true);
  // Defaults 1/1 keep synthetic (no dates) active when any day is on.
  s.startDate(
    service.startDate != null && service.startDate > 0 ? service.startDate : 1
  );
  s.endDate(
    service.endDate != null && service.endDate > 0 ? service.endDate : 1
  );
  // Derived — day/date UPDATEs invalidate this → trips.*.live
  s["="]("active", derivedExpressions.serviceActive);
}

export function upsertTrip(me: MeLike, trip: GtfsTrip): void {
  const t = (me as any).gtfs.trips[trip.tripId];
  t.tripId(trip.tripId);
  t.serviceId(trip.serviceId);
  t.routeLabel(trip.routeId);
  // Numeric routeId — derivable by stopTimes (string ids fail `=` evaluator)
  t.routeId(trip.routeCode);
  // Cross-branch: live ← services.<id>.active
  t["="]("live", derivedExpressions.tripLive(trip.serviceId));
  // Cross-branch: validRoute ← routes.<label>.active (real DELETE → ABSENCE)
  t["="]("validRoute", derivedExpressions.tripValidRoute(trip.routeId));
}

export function upsertStopTime(me: MeLike, st: GtfsStopTime): void {
  const id = stopTimeId(st.tripId, st.stopSequence, st.stopId);
  const n = (me as any).gtfs.stopTimes[id];
  n.tripId(st.tripId);
  n.stopId(st.stopId);
  n.stopSequence(st.stopSequence);
  n.arrivalTime(st.arrivalTime ?? "00:00:00");
  n.departureTime(st.departureTime ?? st.arrivalTime ?? "00:00:00");
  // Cross-branch: routeId ← trips.<id>.routeId
  n["="]("routeId", derivedExpressions.stopTimeRouteId(st.tripId));
}

/**
 * Real subtree remove via me["-"] (operator kind "remove").
 * Prefer this over active=false/tombstone so dependents see ABSENCE
 * (undefined + unresolved.missing-input), not a false boolean.
 *
 * Forms (see src/operators.ts isRemoveCall):
 *   me["-"]("gtfs.routes.R1")
 *   me.gtfs.routes.R1["-"]()
 */
export function deleteEntity(
  me: MeLike,
  kind: GtfsEntityKind,
  id: string
): void {
  const bucket =
    kind === "route"
      ? "routes"
      : kind === "trip"
        ? "trips"
        : kind === "stopTime"
          ? "stopTimes"
          : "services";
  const path = `gtfs.${bucket}.${id}`;
  (me as any)["-"](path);
}

// ─── CREATE aggregates (gtfs.idx membership + sum) ───────────────────────────

function sumExpr(terms: string[]): string {
  if (terms.length === 0) return "0";
  return terms.join(" + ");
}

/** Path: gtfs.idx.routes.<routeId>.tripCount */
export function idxRouteTripCountPath(routeId: string): string {
  return `gtfs.idx.routes.${routeId}.tripCount`;
}

/** Path: gtfs.idx.trips.<tripId>.stopTimeCount */
export function idxTripStopTimeCountPath(tripId: string): string {
  return `gtfs.idx.trips.${tripId}.stopTimeCount`;
}

export function idxRouteCountPath(): string {
  return "gtfs.idx.routeCount";
}

export function idxServiceCountPath(): string {
  return "gtfs.idx.serviceCount";
}

export function setIdxTripMember(
  me: MeLike,
  routeId: string,
  tripId: string,
  bit: 0 | 1
): void {
  (me as any).gtfs.idx.routes[routeId].tripMember[tripId](bit);
}

export function setIdxStopTimeMember(
  me: MeLike,
  tripId: string,
  stId: string,
  bit: 0 | 1
): void {
  (me as any).gtfs.idx.trips[tripId].stopTimeMember[stId](bit);
}

export function setIdxRouteMember(
  me: MeLike,
  routeId: string,
  bit: 0 | 1
): void {
  (me as any).gtfs.idx.routeMember[routeId](bit);
}

export function setIdxServiceMember(
  me: MeLike,
  serviceId: string,
  bit: 0 | 1
): void {
  (me as any).gtfs.idx.serviceMember[serviceId](bit);
}

/**
 * Seed tripMember slots (0|1) and wire tripCount = sum(tripMember.*).
 * Call once after base load with base∪seed create slots (creates as 0).
 */
export function wireRouteTripCount(
  me: MeLike,
  routeId: string,
  members: Array<{ tripId: string; present: 0 | 1 }>
): void {
  for (const m of members) {
    setIdxTripMember(me, routeId, m.tripId, m.present);
  }
  const expr = sumExpr(members.map((m) => `tripMember.${m.tripId}`));
  (me as any).gtfs.idx.routes[routeId]["="]("tripCount", expr);
}

export function wireTripStopTimeCount(
  me: MeLike,
  tripId: string,
  members: Array<{ stId: string; present: 0 | 1 }>
): void {
  for (const m of members) {
    setIdxStopTimeMember(me, tripId, m.stId, m.present);
  }
  const expr = sumExpr(members.map((m) => `stopTimeMember.${m.stId}`));
  (me as any).gtfs.idx.trips[tripId]["="]("stopTimeCount", expr);
}

export function wireMetaRouteCount(
  me: MeLike,
  members: Array<{ routeId: string; present: 0 | 1 }>
): void {
  for (const m of members) {
    setIdxRouteMember(me, m.routeId, m.present);
  }
  const expr = sumExpr(members.map((m) => `routeMember.${m.routeId}`));
  (me as any).gtfs.idx["="]("routeCount", expr);
}

export function wireMetaServiceCount(
  me: MeLike,
  members: Array<{ serviceId: string; present: 0 | 1 }>
): void {
  for (const m of members) {
    setIdxServiceMember(me, m.serviceId, m.present);
  }
  const expr = sumExpr(members.map((m) => `serviceMember.${m.serviceId}`));
  (me as any).gtfs.idx["="]("serviceCount", expr);
}
