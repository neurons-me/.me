import ME from "../../src/me.js";

const me = new ME();

// --- Identities ---
me.users.jabellae.name("Jabellae");
me.users.ana.name("Ana");
me.users.pedro.name("Pedro");

// --- Shared wallet: Vancouver trip ---
me.wallets.vancouver.description("Vancouver trip — 3 people");
me.wallets.vancouver.members.count(3);
me.wallets.vancouver.total(0);

// --- Derive split per person ---
me.wallets.vancouver["="]("per_person", "total / members.count");

// --- Each person's balance: what they owe vs what they paid ---
me.wallets.vancouver.paid.jabellae(0);
me.wallets.vancouver.paid.ana(0);
me.wallets.vancouver.paid.pedro(0);

me.wallets.vancouver["="]("balance_jabellae", "paid.jabellae - per_person");
me.wallets.vancouver["="]("balance_ana",      "paid.ana      - per_person");
me.wallets.vancouver["="]("balance_pedro",    "paid.pedro    - per_person");

// --- Jabellae pays the hotel: $300 ---
me.wallets.vancouver.paid.jabellae(300);
me.wallets.vancouver.total(300);

console.log("\n=== After hotel payment ($300 by Jabellae) ===");
console.log("per_person       →", me("wallets.vancouver.per_person"));       // 100
console.log("balance_jabellae →", me("wallets.vancouver.balance_jabellae")); // +200
console.log("balance_ana      →", me("wallets.vancouver.balance_ana"));      // -100
console.log("balance_pedro    →", me("wallets.vancouver.balance_pedro"));    // -100

// --- Ana pays for dinner: $90 ---
me.wallets.vancouver.paid.ana(90);
me.wallets.vancouver.total(390);

console.log("\n=== After dinner ($90 by Ana) ===");
console.log("per_person       →", me("wallets.vancouver.per_person"));       // 130
console.log("balance_jabellae →", me("wallets.vancouver.balance_jabellae")); // +170
console.log("balance_ana      →", me("wallets.vancouver.balance_ana"));      // -40
console.log("balance_pedro    →", me("wallets.vancouver.balance_pedro"));    // -130

// --- Explainability ---
console.log("\n=== Explain balance_jabellae ===");
console.log(me.explain("wallets.vancouver.balance_jabellae"));
