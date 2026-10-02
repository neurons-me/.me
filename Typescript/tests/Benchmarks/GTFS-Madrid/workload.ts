/**
 * CREATE / UPDATE / DELETE sequence API (Van Assche mutation types).
 * Mutations write the ORIGINAL paths only — dependents recompute via formulas.
 */
import type { MeLike } from "./adapter.ts";
import {
  deleteEntity,
  setIdxRouteMember,
  setIdxServiceMember,
  setIdxStopTimeMember,
  setIdxTripMember,
  stopTimeId,
  type GtfsRoute,
  type GtfsService,
  type GtfsStopTime,
  type GtfsTrip,
  upsertRoute,
  upsertService,
  upsertStopTime,
  upsertTrip,
} from "./adapter.ts";

export type MutationType = "CREATE" | "UPDATE" | "DELETE";

export interface Mutation {
  type: MutationType;
  label: string;
  apply: (me: MeLike) => void;
}

export interface WorkloadStep {
  mutation: Mutation;
}

export function createRoute(route: GtfsRoute): Mutation {
  return {
    type: "CREATE",
    label: `CREATE route ${route.routeId}`,
    apply: (me) => {
      upsertRoute(me, route);
      setIdxRouteMember(me, route.routeId, 1);
    },
  };
}

export function createService(service: GtfsService): Mutation {
  return {
    type: "CREATE",
    label: `CREATE service ${service.serviceId}`,
    apply: (me) => {
      upsertService(me, service);
      setIdxServiceMember(me, service.serviceId, 1);
    },
  };
}

export function createTrip(trip: GtfsTrip): Mutation {
  return {
    type: "CREATE",
    label: `CREATE trip ${trip.tripId}`,
    apply: (me) => {
      upsertTrip(me, trip);
      setIdxTripMember(me, trip.routeId, trip.tripId, 1);
    },
  };
}

export function createStopTime(st: GtfsStopTime): Mutation {
  return {
    type: "CREATE",
    label: `CREATE stopTime ${st.tripId}#${st.stopSequence}`,
    apply: (me) => {
      upsertStopTime(me, st);
      const stId = stopTimeId(st.tripId, st.stopSequence, st.stopId);
      setIdxStopTimeMember(me, st.tripId, stId, 1);
    },
  };
}

/**
 * UPDATE a calendar day/date source field (active is derived).
 * Dependents: services.<id>.active → trips.*.live
 */
export function updateServiceField(
  serviceId: string,
  field:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"
    | "startDate"
    | "endDate",
  value: boolean | number
): Mutation {
  return {
    type: "UPDATE",
    label: `UPDATE service ${serviceId}.${field}=${value}`,
    apply: (me) => {
      (me as any).gtfs.services[serviceId][field](value);
    },
  };
}

/**
 * UPDATE services.<id> schedule via monday (active is derived from days/dates).
 * Prefer updateServiceField for non-monday calendar deltas.
 */
export function updateServiceActive(
  serviceId: string,
  active: boolean
): Mutation {
  return updateServiceField(serviceId, "monday", active);
}

/**
 * UPDATE trips.<id>.routeId (numeric code).
 * Dependents: stopTimes.*_.routeId via cross-branch formula.
 */
export function updateTripRoute(tripId: string, routeCode: number): Mutation {
  return {
    type: "UPDATE",
    label: `UPDATE trip ${tripId}.routeId=${routeCode}`,
    apply: (me) => {
      (me as any).gtfs.trips[tripId].routeId(routeCode);
    },
  };
}

/** Real REMOVE route via me["-"] — dependents: trips.*.validRoute → ABSENCE */
export function deleteRoute(routeId: string): Mutation {
  return {
    type: "DELETE",
    label: `DELETE route ${routeId} (me["-"])`,
    apply: (me) => deleteEntity(me, "route", routeId),
  };
}

export function deleteTrip(tripId: string): Mutation {
  return {
    type: "DELETE",
    label: `DELETE trip ${tripId}`,
    apply: (me) => deleteEntity(me, "trip", tripId),
  };
}

export function runSequence(
  me: MeLike,
  steps: WorkloadStep[]
): Array<{ label: string; type: MutationType; latencyMs: number }> {
  const out: Array<{ label: string; type: MutationType; latencyMs: number }> =
    [];
  for (const { mutation } of steps) {
    const t0 = performance.now();
    mutation.apply(me);
    out.push({
      label: mutation.label,
      type: mutation.type,
      latencyMs: performance.now() - t0,
    });
  }
  return out;
}
