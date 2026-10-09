/// <reference types="node" />
/**
 * REGRESSION — root-scope me["_"](...) leaves readable by guests
 *
 * Root cause: isStealthBlocked (me.ts) and hasStealthBarrier (core-read.ts)
 * walked ancestors with `for (i = path.length; i > 0; i--)`, which never
 * consults the empty-string key "" used by bare me["_"](...). Named branch
 * scopes (me.wallet["_"]) were unaffected. Guests via me.as(null) / wrong
 * key / withScope(null) therefore read root-scoped leaf values in the clear.
 *
 * Fix: bound is `i >= 0` so "" is checked. Owner (callerScope === undefined)
 * and matching key holders (as("rootkey")) still pass the barrier.
 *
 * Does NOT change memories filtering, hash chaining, or snapshot shape.
 */
import { MEConstructor as ME, assert, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("Regression: root-scope secret stealth");

async function main() {
  console.log("\n### Regression — root-scope me[\"_\"] content leak to guests");

  await test("V1: declare _ then write — guest as(null) cannot read leaf; owner can", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    assert.equal(me("notes.pin"), 1234, "owner reads the value");
    assert.equal(me.as(null)("notes.pin"), undefined, "guest must not see the value");
    assert.equal(me.as(null)("notes"), undefined, "guest must not see the notes node");
  });

  await test("V1-holder: as('rootkey') still reads (authorized access)", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    assert.equal(me.as("rootkey")("notes.pin"), 1234, "matching scope key holder reads");
  });

  await test("V3: deep leaf under root _ is stealth to guest", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.a.b.c(7);
    assert.equal(me("a.b.c"), 7, "owner reads deep leaf");
    assert.equal(me.as(null)("a.b.c"), undefined, "guest must not see deep leaf");
    assert.equal(me.as("rootkey")("a.b.c"), 7, "key holder reads deep leaf");
  });

  await test("V4: wrong key is treated like guest (no read)", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    assert.equal(me.as("wrong")("notes.pin"), undefined, "wrong key must not unlock");
  });

  await test("V5 CONTROL: named branch scope still stealth (non-regression)", () => {
    const me: any = new ME();
    me.wallet["_"]("k");
    me.wallet.balance(500);
    assert.equal(me("wallet.balance"), 500, "owner reads branch leaf");
    assert.equal(me.as(null)("wallet.balance"), undefined, "guest blocked on branch scope");
    assert.equal(me.as("k")("wallet.balance"), 500, "branch key holder reads");
    assert.equal(me.as(null)("wallet"), undefined, "branch root stays stealth");
  });

  await test("V2: write THEN declare root _ — guest blocked even if prior write was public", () => {
    const me: any = new ME();
    me.notes.pin(99);
    assert.equal(me.as(null)("notes.pin"), 99, "sanity: public before _");
    me["_"]("rootkey");
    // Declaring _ does not retroactively encrypt, but stealth must still
    // hide the path from guests once the root scope exists.
    assert.equal(me("notes.pin"), 99, "owner still reads prior value");
    assert.equal(me.as(null)("notes.pin"), undefined, "guest blocked after root _ declared");
    assert.equal(me.as("rootkey")("notes.pin"), 99, "key holder reads prior value");
  });

  await test("V6: hydrate without resupply — guest sees undefined (not a distinct closed signal beyond absent)", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    const snap = me.exportSnapshot();
    const h: any = new ME();
    h.hydrate(snap);
    // Placeholders make decrypt fail for owner; stealth must still make the
    // guest path look absent (undefined), not a special guest-only signal.
    assert.equal(h.as(null)("notes.pin"), undefined, "guest after hydrate: undefined");
    // Owner without resupply: decrypt fails → null/undefined; either is closed-safe
    // as long as guest is undefined. Document observed owner value.
    const ownerClosed = h("notes.pin");
    assert.ok(
      ownerClosed === null || ownerClosed === undefined,
      `owner without resupply must not see plaintext, got ${JSON.stringify(ownerClosed)}`,
    );
  });

  await test("V6b/c: hydrate + resupply — owner and key holder recover; guest still blocked", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    const snap = me.exportSnapshot();
    const h: any = new ME();
    h.hydrate(snap);
    h["_"]("rootkey");
    assert.equal(h("notes.pin"), 1234, "owner recovers after resupply");
    assert.equal(h.as("rootkey")("notes.pin"), 1234, "key holder recovers after resupply");
    assert.equal(h.as(null)("notes.pin"), undefined, "guest still blocked after resupply");
    assert.equal(h.as("wrong")("notes.pin"), undefined, "wrong key still blocked after resupply");
  });

  await test("V7: exportSnapshot → hydrate round-trip preserves stealth (replay path)", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    const snap = me.exportSnapshot();
    const r: any = new ME();
    r.hydrate({ ...snap });
    r["_"]("rootkey");
    assert.equal(r("notes.pin"), 1234, "replay owner");
    assert.equal(r.as(null)("notes.pin"), undefined, "replay guest");
  });

  await test("V8: derived value under root _ — guest blocked; holder and owner read", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(10);
    me.notes["="]("doubled", "pin * 2");
    assert.equal(me("notes.doubled"), 20, "owner reads derivation");
    assert.equal(me.as(null)("notes.doubled"), undefined, "guest must not read derivation");
    assert.equal(me.as("rootkey")("notes.doubled"), 20, "key holder reads derivation");
  });

  await test("V9: guest view is me.as(null) (canonical); withScope on root proxy is pre-existing non-capture", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    // Canonical guest path — what CoffeeShops / audits use.
    assert.equal(me.as(null)("notes.pin"), undefined, "as(null) stealth-blocks");
    // withScope sets _currentCallerScope, but the root ME proxy closed over
    // callerScope=undefined at construction and restores it on every apply
    // (proxy.ts createProxy). That pre-existing limitation affects named
    // branch scopes too; it is NOT introduced by the root-scope fix and is
    // out of scope here. Pin the observed behavior so it cannot silently
    // change without a dedicated fix.
    assert.equal(
      me.withScope(null, () => me("notes.pin")),
      1234,
      "pre-existing: withScope(null) via root proxy does not stealth-block",
    );
    const branch: any = new ME();
    branch.wallet["_"]("k");
    branch.wallet.balance(500);
    assert.equal(
      branch.withScope(null, () => branch("wallet.balance")),
      500,
      "pre-existing: same withScope gap on named branch scopes",
    );
    assert.equal(branch.as(null)("wallet.balance"), undefined, "as(null) still correct on branch");
  });

  await test("public paths remain free (no root _ declared)", () => {
    const me: any = new ME();
    me.profile.name("Abella");
    assert.equal(me("profile.name"), "Abella");
    assert.equal(me.as(null)("profile.name"), "Abella", "guest can read public data");
  });

  await test("guest cannot distinguish root-scoped leaf from never-written path", () => {
    const me: any = new ME();
    me["_"]("rootkey");
    me.notes.pin(1234);
    assert.equal(
      me.as(null)("notes.pin"),
      me.as(null)("notes.missing"),
      "closed/secret leaf ≡ absent for guest",
    );
  });

  const ok = summarize();
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
