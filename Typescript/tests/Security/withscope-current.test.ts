/// <reference types="node" />
/**
 * DIAGNOSIS — deprecated `withScope` vs `as()` (not a permanent contract)
 *
 * These tests pin the **deprecated** behaviour of `ME#withScope` for diagnosis
 * and regression visibility. They may change or be removed once callers have
 * migrated to `me.as(key|null)`. See CHANGELOG Unreleased, TypeDoc on
 * `withScope`, and /workspace/research/withscope/CONTRACT.md (option D).
 *
 * Framing: `withScope(null)` fails open as a restriction on the OWNER handle
 * (proxy re-applies the scope captured at handle creation). Guests / wrong-key
 * handles do NOT gain privilege inside `withScope`. That is an ineffective
 * demotion, not privilege escalation — which is why the API is deprecated in
 * favour of reading through `me.as(...)`.
 *
 * Labels below still say CURRENT BEHAVIOR so failures stay searchable; treat
 * them as diagnosis pins, not a promise to keep forever.
 */
import { MEConstructor as ME, assert, makeSuite } from "./helpers.ts";

const { test, summarize } = makeSuite("DIAGNOSIS (deprecated withScope)");

function seedRoot(me: any) {
  me["_"]("rk");
  me.notes.pin(1234);
  me.notes.other(77);
  me["="]("dbl", "notes.pin * 2");
}

function seedBranch(me: any) {
  me.notes["_"]("rk");
  me.notes.pin(1234);
  me.notes.other(77);
  me.notes["="]("dbl", "pin * 2");
}

async function main() {
  console.log("\n### DIAGNOSIS — deprecated withScope (owner demotion fails open; migrate to as())");

  for (const kind of ["root", "branch"] as const) {
    const seed = kind === "root" ? seedRoot : seedBranch;
    const dblPath = kind === "root" ? "dbl" : "notes.dbl";

    await test(`[${kind}] CURRENT BEHAVIOR: as(null) hides secret leaves but still reads public paths`, () => {
      const me: any = new ME();
      me.shop.label("Cafe"); // public (sibling of a branch scope; under root _ it becomes stealth)
      assert.equal(me.as(null)("shop.label"), "Cafe", "with no _ yet, guest reads public paths");
      seed(me);
      const guest = me.as(null);
      if (kind === "branch") {
        assert.equal(guest("shop.label"), "Cafe", "branch _ does not hide sibling public paths");
      } else {
        // bare me["_"] covers the whole tree — former public paths are stealth to guests
        assert.equal(guest("shop.label"), undefined, "root _ : prior public path ≡ absent for guest");
      }
      assert.equal(guest("notes.pin"), undefined, "protected ≡ absent for guest");
      assert.equal(guest("notes.other"), undefined);
      assert.equal(guest(dblPath), undefined);
      assert.equal(guest("notes.noSuchField"), undefined, "missing path also undefined");
    });

    await test(`[${kind}] CURRENT BEHAVIOR: owner reads secrets (baseline)`, () => {
      const me: any = new ME();
      seed(me);
      assert.equal(me("notes.pin"), 1234);
      assert.equal(me("notes.other"), 77);
      assert.equal(me(dblPath), 2468);
    });

    await test(`[${kind}] CURRENT BEHAVIOR: withScope(null) does NOT demote owner — never-read path`, () => {
      const me: any = new ME();
      seed(me);
      const got = me.withScope(null, () => me("notes.other"));
      assert.equal(got, 77, "CURRENT BEHAVIOR: owner proxy ignores withScope(null)");
      assert.equal(me.as(null)("notes.other"), undefined, "guest handle still blocked");
    });

    await test(`[${kind}] CURRENT BEHAVIOR: withScope(null) does NOT demote owner — write-then-read inside`, () => {
      const me: any = new ME();
      seed(me);
      const got = me.withScope(null, () => {
        me.notes.late(5);
        return me("notes.late");
      });
      assert.equal(got, 5, "CURRENT BEHAVIOR: new writes/reads via owner succeed inside withScope(null)");
      assert.equal(me.as(null)("notes.late"), undefined);
    });

    await test(`[${kind}] CURRENT BEHAVIOR: withScope(null) does NOT demote owner — derived value`, () => {
      const me: any = new ME();
      seed(me);
      assert.equal(me.withScope(null, () => me(dblPath)), 2468);
      assert.equal(me.as(null)(dblPath), undefined);
    });

    await test(`[${kind}] CURRENT BEHAVIOR: withScope(null) does NOT demote owner — explain().value`, () => {
      const me: any = new ME();
      seed(me);
      const got = me.withScope(null, () => me.explain("notes.other").value);
      assert.equal(got, 77);
      assert.equal(me.as(null).explain("notes.other").value, undefined);
    });

    await test(`[${kind}] CURRENT BEHAVIOR: child proxy / as(undefined) inside withScope(null) stay owner`, () => {
      const me: any = new ME();
      seed(me);
      const viaChild = me.withScope(null, () => {
        const n = me.notes;
        void n;
        return me("notes.pin");
      });
      const viaAsUndef = me.withScope(null, () => me.as(undefined)("notes.pin"));
      assert.equal(viaChild, 1234);
      assert.equal(viaAsUndef, 1234, "as(undefined) is owner; withScope does not revoke it");
    });

    await test(`[${kind}] CURRENT BEHAVIOR: closure-captured values are ordinary JS (not a kernel read)`, () => {
      const me: any = new ME();
      seed(me);
      const v = me("notes.pin");
      assert.equal(me.withScope(null, () => v), 1234, "CURRENT BEHAVIOR: returning a prior binding is not stealth");
    });

    await test(`[${kind}] CURRENT BEHAVIOR: no guest escalation inside withScope`, () => {
      const me: any = new ME();
      seed(me);
      const g = me.as(null);
      const w = me.as("wrong");
      assert.equal(me.withScope(undefined, () => g("notes.pin")), undefined);
      assert.equal(me.withScope("rk", () => g("notes.pin")), undefined);
      assert.equal(g.withScope(undefined, () => g("notes.pin")), undefined);
      assert.equal(w.withScope("rk", () => w("notes.pin")), undefined);
      assert.equal(g.withScope(undefined, () => g.explain("notes.pin").value), undefined);
    });

    await test(`[${kind}] CURRENT BEHAVIOR: key holder as('rk') still reads; withScope(null) on that handle keeps it`, () => {
      const me: any = new ME();
      seed(me);
      const h = me.as("rk");
      assert.equal(h("notes.pin"), 1234, "holder reads");
      // Handle captured with "rk"; withScope(null) on the kernel does not rewrite the handle's capture.
      assert.equal(
        me.withScope(null, () => h("notes.pin")),
        1234,
        "CURRENT BEHAVIOR: existing holder handle not demoted by withScope(null)",
      );
    });
  }

  await test("CURRENT BEHAVIOR: as(null) reads public paths when only a branch scope is secret", () => {
    const me: any = new ME();
    me.shop.label("Cafe");
    me.ops["_"]("rk");
    me.ops.beansKg(3);
    const guest = me.as(null);
    assert.equal(guest("shop.label"), "Cafe", "public still readable");
    assert.equal(guest("ops.beansKg"), undefined, "protected ≡ absent");
    assert.equal(guest("ops.missing"), undefined, "missing ≡ same undefined");
    assert.equal(me("ops.beansKg"), 3, "owner still reads protected leaf");
  });

    await test("CURRENT BEHAVIOR: nested withScope set/restore of the field does not affect owner proxy reads", () => {
    const me: any = new ME();
    seedRoot(me);
    const got = me.withScope(null, () =>
      me.withScope("rk", () => me.withScope(null, () => me("notes.pin"))),
    );
    assert.equal(got, 1234, "CURRENT BEHAVIOR: nested withScope still fails open on owner proxy");
  });

  await test("CURRENT BEHAVIOR: as(null) handle is stable across outer withScope(undefined) on owner", () => {
    const me: any = new ME();
    seedRoot(me);
    const g = me.as(null);
    assert.equal(g("notes.pin"), undefined);
    assert.equal(
      me.withScope(undefined, () => g("notes.pin")),
      undefined,
      "guest handle does not collapse to owner when withScope(undefined) runs",
    );
  });

  const ok = summarize();
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
