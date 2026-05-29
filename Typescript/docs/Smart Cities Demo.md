Core Concepts
const me = new ME() as any;
me is the root kernel. You interact with it using:
- me.path.to.thing = value → set data
- me("query.path") → read (with support for wildcards and filters)
- me.node["="]("prop", "expression") → define derived fields
- me.node["_"]("name") → make stealth/private
- me.node["->"]("other.path") → create live pointers
Section-by-Section Breakdown
City Identity
Basic hierarchical data setting:
me["@"]("veracruz-smart-city"); // names the root
me.city.name("Veracruz");
me.city.population(700000);
me("city.name") just reads the value.
2. Districts - Derived Fields + Queries
This is where it gets interesting:
me.districts["[i]"]["="]("loadPercent", "currentLoad / capacity * 100");
me.districts["[i]"]["="]("overCapacity", "currentLoad > capacity");
me.districts["[i]"]["="]("needsRedirection", "loadPercent > 85");
The `"[i]"` means apply this derived rule to every item in the `districts` array/object.
Then you can query with filters:
me("districts[overCapacity == true].name") // returns only matching ones
me("districts[needsRedirection == true].name")
This is declarative reactivity- when you change `currentLoad`, `overCapacity` and `needsRedirection` update instantly everywhere.
3. Traffic Signals
Same pattern: derived properties (`saturated`, `recommendedGreenSec`).
4. Public Services - Time Reactivity
me.services.hospital["="]("isOpen", "currentHour >= opensAt && currentHour < closesAt");
When you do me.services.cityHall.currentHour(16), `isOpen` automatically becomes false. No event listeners needed.
5. Reactive Event
Demonstrates automatic propagation:
- You increase load on district 3 → `overCapacity`, `loadPercent`, `needsRedirection` all update instantly
- Queries reflect the new reality without extra code
6. Stealth (Privacy) - The Most Unique Feature
me.security["_"]("city-security-ops-2026"); // '_' makes it stealth
- Owner (`me(…)`) can read everything, including derived fields
- Guest/Public (`me.as(null)(…)`) sees `undefined` for stealth nodes - not an error, just honest absence
- `explain()` shows the derivation logic but masks the sensitive input values.
This is very powerful for systems where the same kernel serves both internal logic and public APIs.
explain("security.alertLevel") 
// → shows expression + masked inputs
7. Cross-Node Pointers
me.districts[3].trafficNode["->"]("traffic.junctions[3]");
Now `me("districts[3].trafficNode.location")` transparently resolves to the live value in the traffic node. It's a **live link**, not a copy.
8. Public Summary
Shows what an external observer would see (stealth nodes disappear cleanly).