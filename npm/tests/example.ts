// Smoke-test using the built ESM bundle.
// NOTE: This file must be treated as an ES module because we use top-level await.
// We keep `me` as `any` so TS doesn't lose the callable Proxy behavior.
import ME from "this.me";
const me: any = new ME();
function log(title: string) {
  const snap = me.inspect({ last: 8 });
  console.log("\n====================");
  console.log(title);
  console.log("====================");
  console.log("last thoughts:", snap.thoughts);
  console.log("index peek:", {
    root: me(""), // note: ME is a callable Proxy at runtime; TS typing is `any` in this smoke test
    username: me("__id") ?? me("@") ?? me("username"), // depends on your get() semantics
    profileName: me("profile.name"),
    walletIncome: me("wallet.income"),
    walletNet: me("wallet.net"),
    primaryCard: me("profile.cards.primary"),
  });
}

// ------------------------------------------------------------
// 1) Public identity claims (root)
// ------------------------------------------------------------
console.log("\n--- 1) PUBLIC @ CLAIMS ---");
// public username (domain-safe identity claim)
me["@"]("jabellae");              // root claim: username / id
// optional: attach “ledger namespace” (still public), like where you intend to cleak
me.ledger.host("localhost:8161"); // public context
me.ledger.protocol("http");       // public context
log("after @ + public ledger context");
// ------------------------------------------------------------
// 2) Secret scope for private profile + wallet data
// ------------------------------------------------------------
console.log("\n--- 2) SECRET SCOPE ( _ ) ---");
me._("secret123");
// under secret: these get encrypted in payload/index
me.profile.name("Abella");
me.profile.city("Veracruz");
me.wallet.income(1000);
me.wallet.expenses.rent(500);
// also stash a sensitive branch
me.wallet.hidden.notes("private note");
log("after _ secret123 + private writes");
// ------------------------------------------------------------
// 3) Noise reset (~) to “break inheritance” and start a new root secret chain
// ------------------------------------------------------------
console.log("\n--- 3) NOISE (~) RESET ---");
// noise becomes a new “root” for subsequent secrets (doesn't inherit the previous)
me["~"]("identityNoise#A");   // think: identity root seed / noise token
me._("betaSecret");           // now this secret is derived from noise, not old secret
me.wallet.hidden.seed("only beta sees this");
me.keys.eth(["0xabc...", "0xdef..."]);
log("after ~ + betaSecret + beta-only writes");
// ------------------------------------------------------------
// 4) POINTERS (__ / ->) as symbolic links
// ------------------------------------------------------------
console.log("\n--- 4) POINTERS (__ / ->) ---");
// create a public-ish “pointer slot” (still stored in encrypted tree depending on scope)
me.profile.cards.primary.__("wallet"); // "primary card points to wallet" (example)
me.profile.cards.backup["->"]("profile"); // alias pointer operator
log("after pointers");
// ------------------------------------------------------------
// 5) '=' eval + assign (derived values)
// ------------------------------------------------------------
console.log("\n--- 5) '=' EVAL + ASSIGN ---");
// compute wallet.net = income - rent
// (your engine likely parses strings, so we give it an expression string)
me.wallet["="]("net", "wallet.income - wallet.expenses.rent");
// more creative: compute a “badge” label that mixes public and private
me.profile["="]("badge", "`@${__id}` + ' • ' + profile.city"); // assumes template/string support
log("after '=' derived assignments");
// ------------------------------------------------------------
// 6) '=' using POINTERS (compute from a pointer target)
// ------------------------------------------------------------
console.log("\n--- 6) '=' USING POINTERS ---");
// if profile.cards.primary points to "wallet", derive something at the pointer target
// Example: pointerNet = <ptr>.income - <ptr>.expenses.rent
me.profile.cards.primary["="](
  "pointerNet",
  "__ptr.income - __ptr.expenses.rent"
);

log("after '=' from pointer target");
// ------------------------------------------------------------
// 7) '?' collect/query (pick multiple values in one go)
// ------------------------------------------------------------
console.log("\n--- 7) '?' COLLECT ---");
// collect keys from profile (example)
const pickedProfile = me.profile["?"]("name", "city", "badge");
console.log("pickedProfile =", pickedProfile);
// collect wallet summary
const pickedWallet = me.wallet["?"]("income", "expenses.rent", "net");
console.log("pickedWallet =", pickedWallet);
log("after '?' collects");
// ------------------------------------------------------------
// 8) Remove (-) to delete branches (optional)
// ------------------------------------------------------------
console.log("\n--- 8) '-' REMOVE ---");
// remove a sensitive note branch
me.wallet.hidden["-"]("notes");
log("after '-' remove wallet.hidden.notes");
// ------------------------------------------------------------
// 9) Final dump
// ------------------------------------------------------------
console.log("\n--- FINAL inspect().thoughts (full) ---");
console.log(me.inspect().thoughts);
console.log("\n--- Quick gets ---");
console.log("me('profile.name') =", me("profile.name"));
console.log("me('wallet.net')   =", me("wallet.net"));
console.log("me('wallet.hidden.seed') =", me("wallet.hidden.seed"));
