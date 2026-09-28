/// <reference types="node" />
/**
 * Audience algebra — test contract for https://suign.github.io/AudienceAlgebra.html
 *
 * One case per law (L1–L9), then the concrete OR / AND / nesting / tamper /
 * revocation cases. `src/audience.ts` is not exposed on the built artifact,
 * so this file targets the source module directly (as crypto-tamper.test.ts
 * does for pure crypto functions). Every identity here is synthetic.
 */
import { createHash } from "node:crypto";
import { assert, clone, makeSuite, tamperB64uAt } from "./helpers.ts";
import {
  audienceId,
  canonicalize,
  group,
  minus,
  openAudience,
  sealAudience,
  type AudienceEnvelopeV1,
  type AudienceFormula,
  type AudienceIdentity,
  type AudienceKey,
  type AudienceNodeV1,
} from "../../src/audience.ts";
import { exportP256PublicKey, generateP256KeyPair, unwrapSecretV1 } from "../../src/crypto.ts";

const { test, summarize } = makeSuite("Audience algebra (L1–L9)");

type Party = { name: string; id: AudienceIdentity; key: AudienceKey };

async function party(name: string): Promise<Party> {
  const pair = await generateP256KeyPair();
  const identityHash = createHash("sha256").update(`this.me/identity:v1::test-${name}`).digest("hex");
  return {
    name,
    id: { identityHash, publicKey: await exportP256PublicKey(pair.publicKey) },
    key: { identityHash, privateKey: pair.privateKey },
  };
}

const and = (...parts: AudienceFormula[]): AudienceFormula => ({ and: parts });

async function opens(envelope: AudienceEnvelopeV1, ...holders: Party[]): Promise<boolean> {
  try {
    await openAudience(envelope, holders.map((p) => p.key));
    return true;
  } catch {
    return false;
  }
}

function subsets<T>(items: T[]): T[][] {
  return Array.from({ length: 1 << items.length }, (_, mask) => items.filter((_, i) => mask & (1 << i)));
}

/** Canonical form rendered with party names, for readable assertions. */
function named(formula: AudienceFormula, parties: Party[]): string[] {
  const byHash = new Map(parties.map((p) => [p.id.identityHash, p.name]));
  return canonicalize(formula).coalitions.map((c) => c.map((h) => byHash.get(h)!).sort().join("+")).sort();
}

function leaves(node: AudienceNodeV1): Array<{ leaf: string; wrapped: any }> {
  if ("or" in node) return node.or.flatMap(leaves);
  if ("and" in node) return node.and.flatMap(leaves);
  return [node];
}

async function main() {
  console.log("\n### Audience algebra — monotone OR/AND audiences over wrapSecretV1");
  const [alice, bob, carol, dave] = await Promise.all(["alice", "bob", "carol", "dave"].map(party));
  const everyone = [alice, bob, carol, dave];
  const [a, b, c, d] = everyone.map((p) => p.id);
  const aliceAndBobOrCarol = [and(a, b), c];

  // --- laws ------------------------------------------------------------------

  await test("L1 opens(S, A) iff S contains a coalition of min(A) — every subset of {alice, bob, carol}", async () => {
    assert.deepEqual(named(aliceAndBobOrCarol, everyone), ["alice+bob", "carol"]);
    const sealed = await sealAudience("L1", aliceAndBobOrCarol);
    const min = canonicalize(aliceAndBobOrCarol).coalitions;
    for (const s of subsets([alice, bob, carol])) {
      const held = new Set(s.map((p) => p.id.identityHash));
      const expected = min.some((coalition) => coalition.every((h) => held.has(h)));
      assert.equal(await opens(sealed, ...s), expected, `S = {${s.map((p) => p.name).join(", ")}}`);
    }
  });

  await test("L2 monotonicity — adding keys to an opening set never closes it", async () => {
    const sealed = await sealAudience("L2", [and(a, b), and(c, d)]);
    for (const s of subsets(everyone)) {
      if (!(await opens(sealed, ...s))) continue;
      for (const extra of everyone) assert.ok(await opens(sealed, ...s, extra), `S ∪ {${extra.name}}`);
    }
  });

  await test("L3 a set with no coalition of min(A) opens nothing — lone AND member, duplicated key, outsiders", async () => {
    const sealed = await sealAudience("L3", and(a, b, c));
    assert.equal(await opens(sealed, alice), false);
    assert.equal(await opens(sealed, alice, alice, alice), false, "one share, however repeated, is one share");
    assert.equal(await opens(sealed, alice, dave), false, "an outsider's key is not bob's or carol's");
    // alice can recover her own share, but a share alone is not the content key.
    const aliceLeaf = leaves(sealed.tree).find((l) => l.leaf === a.identityHash)!;
    const share = (await unwrapSecretV1(aliceLeaf.wrapped, alice.key.privateKey)) as Uint8Array;
    assert.equal(share.length, 32);
    const forged: AudienceEnvelopeV1 = { ...clone(sealed), audience: audienceId(a), tree: clone(aliceLeaf) };
    await assert.rejects(openAudience(forged, [alice.key]), "re-labelling her share as a one-member audience fails closed");
  });

  await test("L4 commutativity, associativity, idempotence, absorption, distributivity — equal canonical form, equal id", async () => {
    const A: AudienceFormula = a;
    const B: AudienceFormula = [b, c];
    const C: AudienceFormula = and(c, d);
    const pairs: Array<[string, AudienceFormula, AudienceFormula]> = [
      ["A ∨ B = B ∨ A", [A, B], [B, A]],
      ["A ∧ B = B ∧ A", and(A, B), and(B, A)],
      ["(A ∨ B) ∨ C = A ∨ (B ∨ C)", [[A, B], C], [A, [B, C]]],
      ["(A ∧ B) ∧ C = A ∧ (B ∧ C)", and(and(A, B), C), and(A, and(B, C))],
      ["A ∨ A = A", [A, A], A],
      ["A ∧ A = A", and(A, A), A],
      ["A ∨ (A ∧ B) = A", [A, and(A, B)], A],
      ["A ∧ (A ∨ B) = A", and(A, [A, B]), A],
      ["A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)", and(A, [B, C]), [and(A, B), and(A, C)]],
      ["A ∨ (B ∧ C) = (A ∨ B) ∧ (A ∨ C)", [A, and(B, C)], and([A, B], [A, C])],
    ];
    for (const [law, left, right] of pairs) {
      assert.deepEqual(canonicalize(left).coalitions, canonicalize(right).coalitions, law);
      assert.equal(audienceId(left), audienceId(right), law);
    }
  });

  await test("L5 every seal is a version with a fresh key — shares never compose across seals", async () => {
    const first = await sealAudience("same value", and(a, b));
    const second = await sealAudience("same value", and(a, b));
    assert.equal(first.audience, second.audience);
    assert.notEqual(first.ciphertext, second.ciphertext);
    assert.equal(await opens(first, alice, bob), true);
    assert.equal(await opens(second, alice, bob), true);
    const mixed = clone(first) as any;
    mixed.tree.and[1] = clone(second.tree as any).and[1];
    assert.equal(await opens(mixed, alice, bob), false, "alice's share of seal 1 + bob's share of seal 2");
  });

  await test("L6 difference A \\ x drops every coalition containing x, at seal time; x cannot open that version", async () => {
    const A: AudienceFormula = [and(a, b), c, and(c, d)];
    const withoutCarol = minus(A, c);
    assert.deepEqual(named(withoutCarol, everyone), ["alice+bob"]);
    const sealed = await sealAudience("L6", withoutCarol);
    assert.equal(await opens(sealed, carol), false);
    assert.equal(await opens(sealed, carol, dave), false);
    assert.equal(await opens(sealed, alice, bob), true);
    assert.deepEqual(minus(and(a, d), d).coalitions, [], "alice ∧ x minus x is empty");
  });

  await test("L7 revocation — reseal a new epoch excluding the revoked member; the earlier version is unchanged", async () => {
    const team = group([a, b, c]);
    const v1 = await sealAudience("budget: 120k", team, { epoch: 1 });
    const v1Before = JSON.stringify(v1);
    const v2 = await sealAudience("budget: 150k", minus(team, c), { epoch: 2 });
    assert.equal(await openAudience(v2, [alice.key]), "budget: 150k");
    assert.equal(await openAudience(v2, [bob.key]), "budget: 150k");
    assert.equal(await opens(v2, carol), false, "revoked member cannot open the new version");
    assert.equal(JSON.stringify(v1), v1Before);
    assert.equal(await openAudience(v1, [carol.key]), "budget: 120k", "what was opened stays opened");
  });

  await test("L8 changing a decoded byte of ciphertext, header, or share fails closed", async () => {
    const sealed = await sealAudience({ secret: "L8" }, and(a, b));
    assert.deepEqual(await openAudience(sealed, [alice.key, bob.key]), { secret: "L8" });
    const bothKeys = [alice, bob];

    for (const offset of [0, 4, 20, 40]) {
      const t = { ...clone(sealed), ciphertext: tamperB64uAt(sealed.ciphertext, offset) };
      assert.equal(await opens(t, ...bothKeys), false, `ciphertext byte ${offset}`);
    }
    assert.equal(await opens({ ...clone(sealed), epoch: sealed.epoch + 1 }, ...bothKeys), false, "header epoch");
    const flippedId = (sealed.audience[0] === "0" ? "1" : "0") + sealed.audience.slice(1);
    assert.equal(await opens({ ...clone(sealed), audience: flippedId }, ...bothKeys), false, "header audience id");

    for (const field of ["ciphertext", "tag", "iv", "salt"] as const) {
      const t = clone(sealed) as any;
      const enc = t.tree.and[0].wrapped.encryption;
      enc[field] = tamperB64uAt(enc[field], 3);
      assert.equal(await opens(t, ...bothKeys), false, `share wrap ${field}`);
    }
    const dropped = clone(sealed) as any;
    dropped.tree = dropped.tree.and[0];
    assert.equal(await opens(dropped, ...bothKeys), false, "dropping an AND child");
  });

  await test("L9 publishing a derivation needs an opening coalition — OR: any member; AND: only the full coalition", async () => {
    const sealed = await sealAudience("L9", aliceAndBobOrCarol);
    const derive = async (...holders: Party[]) => sealAudience(await openAudience(sealed, holders.map((p) => p.key)), d);
    assert.equal(await openAudience(await derive(carol), [dave.key]), "L9", "OR member publishes");
    assert.equal(await openAudience(await derive(alice, bob), [dave.key]), "L9", "full AND coalition publishes");
    await assert.rejects(derive(alice), "a lone AND member has nothing to publish");
  });

  // --- concrete cases ----------------------------------------------------------

  await test("alice ∧ bob: alice alone ✗, bob alone ✗, together ✓", async () => {
    const sealed = await sealAudience("both of us", and(a, b));
    assert.equal(await opens(sealed, alice), false);
    assert.equal(await opens(sealed, bob), false);
    assert.equal(await openAudience(sealed, [bob.key, alice.key]), "both of us");
  });

  await test("(alice ∧ bob) ∨ carol: carol alone ✓, alice + bob ✓, alice alone ✗", async () => {
    const sealed = await sealAudience("nested", aliceAndBobOrCarol);
    assert.equal(await openAudience(sealed, [carol.key]), "nested");
    assert.equal(await openAudience(sealed, [alice.key, bob.key]), "nested");
    assert.equal(await opens(sealed, alice), false);
  });

  await test("3-of-3 AND: all three ✓, every 2-of-3 ✗", async () => {
    const sealed = await sealAudience("n-of-n", and(a, b, c));
    assert.equal(await openAudience(sealed, [alice.key, bob.key, carol.key]), "n-of-n");
    for (const pair of [[alice, bob], [alice, carol], [bob, carol]]) {
      assert.equal(await opens(sealed, ...pair), false, pair.map((p) => p.name).join("+"));
    }
  });

  await test("canonical id is identical for equivalent formulas (spec example)", async () => {
    const left: AudienceFormula = [c, and(b, a)];
    const right: AudienceFormula = [and(a, b), c, and(c, b)];
    assert.equal(audienceId(left), audienceId(right));
    assert.equal((await sealAudience("x", left)).audience, (await sealAudience("x", right)).audience);
    assert.notEqual(audienceId(left), audienceId(and(a, b, c)));
  });

  await test("minus producing an empty audience makes seal refuse", async () => {
    const empty = minus(and(a, b), b);
    assert.deepEqual(empty.coalitions, []);
    await assert.rejects(sealAudience("nobody", empty), /Empty audience/);
    await assert.rejects(sealAudience("nobody", []), /Empty audience/);
  });

  await test("groups: identified by their member set; a group member is just nesting", async () => {
    const g1 = group([a, b]);
    assert.equal(g1.id, group([b, a, b]).id, "same members in any order, same group");
    const g2 = group([g1, c]);
    assert.notEqual(g2.id, g1.id, "adding a member is a new group");
    assert.ok(Object.isFrozen(g1) && Object.isFrozen(g1.coalitions), "group values are immutable");
    const sealed = await sealAudience("to team and dave", and(g1, d));
    assert.equal(await openAudience(sealed, [bob.key, dave.key]), "to team and dave");
    assert.equal(await opens(sealed, alice, bob), false);
    assert.equal(await opens(sealed, dave), false);
  });

  await test("malformed audiences are rejected: empty AND, one identityHash with two public keys", async () => {
    assert.throws(() => canonicalize({ and: [] }), /AND of nothing/);
    assert.throws(() => canonicalize([a, { identityHash: a.identityHash, publicKey: b.publicKey }]), /two different public keys/);
  });
}

main()
  .then(() => {
    const ok = summarize();
    process.exitCode = ok ? 0 : 1;
  })
  .catch((error) => {
    console.error("Fatal error running audience-algebra.test.ts:", error);
    process.exitCode = 1;
  });
