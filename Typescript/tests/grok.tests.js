// tests/stealth-test.js
import ME from "../dist/me.es.js";

console.log("=== STEALTH SCOPE TEST ===");

const me = new ME();

me.finance["_"]("k-2026");
me.finance.fuel_price(99);
me.finance.public_note("esto debería ser visible?");

console.log("ownerScope:", me._ownerScope ?? "null");
console.log("owner     fuel_price   :", me("finance.fuel_price"));
console.log("guest     fuel_price   :", me.as ? me.as(null)("finance.fuel_price") : "me.as no existe");
console.log("owner     public_note  :", me("finance.public_note"));
console.log("guest     public_note  :", me.as ? me.as(null)("finance.public_note") : "me.as no existe");

console.log("\n=== FIN DEL TEST ===");