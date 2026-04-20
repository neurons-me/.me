import assert from "node:assert/strict";
import ME from "this.me";

const me = new ME() as any;

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function section(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

function note(text: string) {
  console.log(`\n  ▸ ${text}`);
}

function show(label: string, value: unknown) {
  const formatted =
    value === undefined
      ? "undefined (stealth or not declared)"
      : JSON.stringify(value, null, 2)
          .split("\n")
          .map((l, i) => (i === 0 ? l : "    " + l))
          .join("\n");
  console.log(`\n  ${label}\n    → ${formatted}`);
}

function showExplain(path: string) {
  const trace = me.explain(path);
  const out = {
    value: trace.value,
    expression: trace.derivation?.expression ?? null,
    inputs: (trace.derivation?.inputs ?? []).map((i: any) => ({
      label: i.label,
      value: i.masked ? "●●●● (stealth — not visible to outsiders)" : i.value,
      origin: i.origin,
    })),
    dependsOn: trace.meta?.dependsOn ?? [],
  };
  console.log(`\n  explain("${path}")`);
  console.log(
    "    → " +
      JSON.stringify(out, null, 2)
        .split("\n")
        .map((l, i) => (i === 0 ? l : "    " + l))
        .join("\n"),
  );
  return trace;
}

// ─────────────────────────────────────────────
// SMART CITY DEMO
// ─────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           .me — Smart City Interconnected Nodes              ║
║                                                              ║
║  This demo shows a city managed as a reactive semantic tree. ║
║  Each institution is a node. Data flows automatically.       ║
║  Private operations stay stealth. Public data stays legible. ║
╚══════════════════════════════════════════════════════════════╝
`);

// ─────────────────────────────────────────────
// SECTION 1 — CITY IDENTITY
// ─────────────────────────────────────────────

section("1 · CITY IDENTITY");

note("We declare the city itself as a named entity.");
note("Every node below belongs to this semantic tree.");

me["@"]("veracruz-smart-city");
me.city.name("Veracruz");
me.city.country("Mexico");
me.city.population(700000);
me.city.timezone("America/Mexico_City");

show("city.name", me("city.name"));
show("city.population", me("city.population"));
show("city.timezone", me("city.timezone"));

// ─────────────────────────────────────────────
// SECTION 2 — DISTRICTS
// ─────────────────────────────────────────────

section("2 · DISTRICTS — Each zone of the city as a node");

note("Districts have a name, current population load, and a capacity limit.");
note("The kernel derives 'overCapacity' automatically for each district.");

me.districts[1].name("Centro Histórico");
me.districts[1].capacity(15000);
me.districts[1].currentLoad(14200);

me.districts[2].name("Boca del Río");
me.districts[2].capacity(20000);
me.districts[2].currentLoad(11000);

me.districts[3].name("Veracruz Puerto");
me.districts[3].capacity(8000);
me.districts[3].currentLoad(8500); // over capacity

me.districts[4].name("Mocambo");
me.districts[4].capacity(12000);
me.districts[4].currentLoad(6000);

// Derived fields broadcast to all districts
me.districts["[i]"]["="]("loadPercent", "currentLoad / capacity * 100");
me.districts["[i]"]["="]("overCapacity", "currentLoad > capacity");
me.districts["[i]"]["="]("needsRedirection", "loadPercent > 85");

show(
  "All districts — load percent",
  me("districts[1..4].loadPercent"),
);
show(
  "Districts OVER capacity (alert)",
  me("districts[overCapacity == true].name"),
);
show(
  "Districts needing traffic redirection (>85% load)",
  me("districts[needsRedirection == true].name"),
);

assert.deepEqual(me("districts[overCapacity == true].name"), {
  3: "Veracruz Puerto",
});
assert.ok(me("districts[1].loadPercent") > 90);

// ─────────────────────────────────────────────
// SECTION 3 — TRAFFIC SIGNALS
// ─────────────────────────────────────────────

section("3 · TRAFFIC SIGNALS — Reactive flow control");

note("Traffic nodes monitor vehicle count and derive their own phase.");
note("When a junction is saturated, the system flags it automatically, and a recommended green phase is derived directly from base traffic flow.");

me.traffic.junctions[1].location("Independencia × Lerdo");
me.traffic.junctions[1].vehiclesPerMinute(42);
me.traffic.junctions[1].greenPhaseSec(45);

me.traffic.junctions[2].location("Boulevard Camacho × 5 de Mayo");
me.traffic.junctions[2].vehiclesPerMinute(18);
me.traffic.junctions[2].greenPhaseSec(30);

me.traffic.junctions[3].location("Malecón × Arista");
me.traffic.junctions[3].vehiclesPerMinute(67);
me.traffic.junctions[3].greenPhaseSec(45);

me.traffic.junctions["[i]"]["="]("saturated", "vehiclesPerMinute > 50");
me.traffic.junctions["[i]"]["="]("recommendedGreenSec", "greenPhaseSec + vehiclesPerMinute / 2");

show(
  "Saturated junctions (vehiclesPerMinute > 50)",
  me("traffic.junctions[saturated == true].location"),
);
show(
  "Recommended green phase per junction (sec)",
  me("traffic.junctions[1..3].recommendedGreenSec"),
);

assert.deepEqual(me("traffic.junctions[saturated == true].location"), {
  3: "Malecón × Arista",
});

// ─────────────────────────────────────────────
// SECTION 4 — PUBLIC SERVICES SCHEDULE
// ─────────────────────────────────────────────

section("4 · PUBLIC SERVICES — Operating hours and status");

note("Each service declares its open/close hours.");
note("'isOpen' is derived from the current hour — reactive to time updates.");

me.services.hospital.name("Hospital Civil");
me.services.hospital.opensAt(0);   // 24h
me.services.hospital.closesAt(24);
me.services.hospital.currentHour(14);

me.services.market.name("Mercado Hidalgo");
me.services.market.opensAt(6);
me.services.market.closesAt(20);
me.services.market.currentHour(14);

me.services.library.name("Biblioteca del Puerto");
me.services.library.opensAt(9);
me.services.library.closesAt(18);
me.services.library.currentHour(14);

me.services.cityHall.name("Palacio Municipal");
me.services.cityHall.opensAt(8);
me.services.cityHall.closesAt(15);
me.services.cityHall.currentHour(14);

// Broadcast derived status to all services
["hospital", "market", "library", "cityHall"].forEach((svc) => {
  me.services[svc]["="]("isOpen", "currentHour >= opensAt && currentHour < closesAt");
});

show("Hospital — is open at 14:00?", me("services.hospital.isOpen"));
show("Market — is open at 14:00?", me("services.market.isOpen"));
show("Library — is open at 14:00?", me("services.library.isOpen"));
show("City Hall — is open at 14:00?", me("services.cityHall.isOpen"));

assert.equal(me("services.hospital.isOpen"), true);
assert.equal(me("services.market.isOpen"), true);
assert.equal(me("services.library.isOpen"), true);
assert.equal(me("services.cityHall.isOpen"), true);

note("Simulating time advance to 16:00 — City Hall closes at 15:00.");
me.services.cityHall.currentHour(16);
show("City Hall — is open at 16:00?", me("services.cityHall.isOpen"));
assert.equal(me("services.cityHall.isOpen"), false);

// ─────────────────────────────────────────────
// SECTION 5 — REACTIVE CITY EVENT
// ─────────────────────────────────────────────

section("5 · REACTIVE EVENT — Port district exceeds capacity, city responds");

note("An event at the port drives up currentLoad.");
note("The kernel recomputes overCapacity and needsRedirection automatically.");
note("No manual update to derived fields — they just react.");

show("Veracruz Puerto — load before event", me("districts[3].currentLoad"));
show("Veracruz Puerto — overCapacity before event", me("districts[3].overCapacity"));

me.districts[3].currentLoad(9800); // surge during port event

show("Veracruz Puerto — load AFTER event surge", me("districts[3].currentLoad"));
show("Veracruz Puerto — loadPercent AFTER surge", me("districts[3].loadPercent"));
show("Veracruz Puerto — overCapacity AFTER surge", me("districts[3].overCapacity"));
show("Veracruz Puerto — needsRedirection AFTER surge", me("districts[3].needsRedirection"));

note("Traffic junction near port also responds to redirection flag.");
show(
  "Districts needing redirection NOW",
  me("districts[needsRedirection == true].name"),
);

assert.equal(me("districts[3].overCapacity"), true);
assert.equal(me("districts[3].needsRedirection"), true);

// ─────────────────────────────────────────────
// SECTION 6 — STEALTH: INTERNAL SECURITY OPS
// ─────────────────────────────────────────────

section("6 · STEALTH NODE — Internal security operations (not public)");

note("The security ops node is declared with ['_'] — it becomes structurally private.");
note("Public observers (guests) see undefined — not an error, just honest absence.");
note("The city kernel (owner) can still read and derive directly from its private base fields.");
note("explain() shows the expression and dependencies, but masks the values.");

me.security["_"]("city-security-ops-2026");
me.security.activePatrols(12);
me.security.incidentsToday(3);
me.security.maxIncidentThreshold(5);
me.security["="]("alertLevel", "incidentsToday > 2");
me.security["="]("needsReinforcement", "incidentsToday > 2");

show(
  "security (root — stealth, owner sees undefined for root)",
  me("security"),
);
show(
  "security.alertLevel (owner can read leaf values)",
  me("security.alertLevel"),
);
show(
  "security.needsReinforcement (owner)",
  me("security.needsReinforcement"),
);
show(
  "security.alertLevel as GUEST (public observer — sees undefined)",
  me.as(null)("security.alertLevel"),
);
show(
  "security.activePatrols as GUEST (public observer — sees undefined)",
  me.as(null)("security.activePatrols"),
);

assert.equal(me("security"), undefined);
assert.equal(me("security.alertLevel"), true);
assert.equal(me("security.needsReinforcement"), true);
assert.equal(me.as(null)("security.alertLevel"), undefined);
assert.equal(me.as(null)("security.activePatrols"), undefined);

note("explain() on a stealth derivation: expression visible, inputs masked.");
const secTrace = showExplain("security.alertLevel");
assert.equal(secTrace.value, true);
assert.equal(secTrace.derivation?.inputs?.[0]?.masked, true);
assert.equal(secTrace.derivation?.inputs?.[0]?.value, "●●●●");

// ─────────────────────────────────────────────
// SECTION 7 — CROSS-NODE POINTER
// ─────────────────────────────────────────────

section("7 · CROSS-NODE POINTER — District linked to its traffic junction");

note("District 3 (Veracruz Puerto) links to traffic junction 3 via a pointer.");
note("Reading through the pointer resolves the live value at the target.");

me.districts[3].trafficNode["->"]("traffic.junctions[3]");

show(
  "districts[3].trafficNode.location (resolved via pointer)",
  me("districts[3].trafficNode.location"),
);
show(
  "districts[3].trafficNode.saturated (resolved via pointer)",
  me("districts[3].trafficNode.saturated"),
);

assert.equal(me("districts[3].trafficNode.location"), "Malecón × Arista");
assert.equal(me("districts[3].trafficNode.saturated"), true);

// ─────────────────────────────────────────────
// SECTION 8 — CITY SUMMARY READ
// ─────────────────────────────────────────────

section("8 · CITY SUMMARY — Reading the full public surface");

note("A final snapshot of what any public observer can read from the city kernel.");
note("Stealth nodes (security) are absent — not errors, just honest absence.");

show("City name", me("city.name"));
show("City population", me("city.population"));
show("Districts over capacity", me("districts[overCapacity == true].name"));
show("Districts needing redirection", me("districts[needsRedirection == true].name"));
show("Saturated traffic junctions", me("traffic.junctions[saturated == true].location"));
show("Services open right now (hour=16)", {
  hospital: me("services.hospital.isOpen"),
  market: me("services.market.isOpen"),
  library: me("services.library.isOpen"),
  cityHall: me("services.cityHall.isOpen"),
});
show(
  "security node (public observer sees nothing — stealth is honest absence)",
  me.as(null)("security"),
);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    PASS: Smart City Demo                     ║
║                                                              ║
║  What this demo showed:                                      ║
║  • City as a reactive semantic tree — no polling needed      ║
║  • Districts, traffic, services as interconnected nodes      ║
║  • Derived fields recompute automatically on data change     ║
║  • Stealth nodes (security ops) invisible to public          ║
║  • explain() gives auditable traces without leaking values   ║
║  • Cross-node pointers resolve live across the graph         ║
╚══════════════════════════════════════════════════════════════╝
`);