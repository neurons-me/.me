# .me FIRETEST — Full Run Output

Run with: `node tests/fire.test.ts`

---

## Phases (0–8)

```
========================================================
.me KERNEL FIRE TEST (PHASES 0-8)
========================================================

--- Phase 0 - Identity + Secret Scope ---
   • Root identity claim (@) is accepted
   • Secret scope root stays stealth (undefined)
   • Secret leaf data remains readable by path
✅ Phase 0 - Identity + Secret Scope

--- Phase 1 - Structural [] Selectors ---
   • Bracket selector writes create indexed nodes
   • Bracket selector reads resolve exact indexed leaves
✅ Phase 1 - Structural [] Selectors

--- Phase 2 - [i] Broadcast with '=' ---
   • One rule is broadcast to all collection members
   • Each member gets an evaluated contextual result
✅ Phase 2 - [i] Broadcast with '='

--- Phase 3 - Logical Filters ---
   • Single and compound filters return only matching nodes
   • Filter evaluation works on derived fields
✅ Phase 3 - Logical Filters

--- Phase 3.1 - Filtered Broadcast ---
   • Broadcast assignment runs only on nodes matching filter
   • Non-matching nodes remain unchanged
✅ Phase 3.1 - Filtered Broadcast

--- Phase 4 - Range + Multi-Select ---
   • Range selectors [a..b] slice contiguous subsets
   • Multi-select selectors [[a,b,c]] slice sparse subsets
✅ Phase 4 - Range + Multi-Select

--- Phase 5 - Transform Projection ---
   • Read-only projection computes transformed values
   • Projection output is numeric per selected member
✅ Phase 5 - Transform Projection

--- Phase 6 - Contract Integrity ---
   • Cross-scope formula (public + secret leaf) computes deterministically
   • Final invariant equals expected numeric result
✅ Phase 6 - Contract Integrity

--- Phase 7A - Temporal Rehydration (Replay) ---
   • Memory log can be exported from the current runtime
   • A new empty instance can replay that memory
   • Replay reconstructs equivalent semantic results
✅ Phase 7A - Temporal Rehydration (Replay)

--- Phase 7B - Atomic Snapshot Rehydration ---
   • Snapshot exports full kernel state (memory + secrets + noises + encrypted branches)
   • A fresh runtime can import snapshot atomically
   • Imported runtime preserves exact encrypted structures and semantic outputs
✅ Phase 7B - Atomic Snapshot Rehydration

--- Phase 8 - Incremental Recompute + Explain ---
   • Derivation dependencies are tracked from '=' expressions
   • Changing a referenced leaf triggers targeted recompute
   • explain(path) exposes expression inputs with public/stealth origin
   • Stealth inputs are masked in explain() while still auditable
   • Invalid code tokens are rejected and remain declarative strings
   ⏳ Phase 8 loading dataset and derivations...
   ⏱️ setup completed in 92ms
   ⏱️ global dependency recompute in 26ms
   ⏱️ local dependency recompute in 0ms
   ✅ Phase 8 total runtime: 118ms
✅ Phase 8 - Incremental Recompute + Explain

========================================================
FIRE TEST SUMMARY: 11/11 phases passed
STATUS: ALL PHASES PASSED
========================================================

✅ FIRETEST :: phases completed in 184.98ms
```

---

## Reconstruction (32/32)

```
════════════════════════════════════════════
 SECTION 1 — Basic Determinism
 Same seed → same identity. Always.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 2 — Isolation
 Different seeds → different identities.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 3 — Reconstruction
 Wipe. Reconstruct. Prove identical.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 4 — Seed Privacy
 Seed never appears in memory, snapshot, or paths.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 5 — Symbol Access
 Kernel internals accessible only via Symbols.
════════════════════════════════════════════

════════════════════════════════════════════
 SECTION 6 — Cross-Instance Mathematical Proof
 identity = f(seed). Nothing else matters.
════════════════════════════════════════════

  ✅ simple string seed produces stable identity
  ✅ 12-word phrase seed produces stable identity
  ✅ hex string seed produces stable identity
  ✅ sentence as seed produces stable identity
  ✅ unicode seed produces stable identity
  ✅ single character seed produces stable identity
  ✅ very long seed produces stable identity
  ✅ 256-bit random seed produces stable identity
  ✅ 'luna' and 'luna2' produce different identities
  ✅ 'jose' and 'JOSE' produce different identities
  ✅ 'abc' and 'abc ' (trailing space) produce different identities
  ✅ ten different seeds all produce distinct identities
  ✅ anagram seeds produce different identities
  ✅ reconstruction from seed produces identical identity hash
  ✅ reconstruction produces same namespace key material
  ✅ reconstruction works after writing secret scope data
  ✅ three independent reconstructions all produce same hash
  ✅ seed does not appear in memory log
  ✅ seed does not appear in snapshot export
  ✅ seed not readable through proxy path
  ✅ seed not enumerable on proxy surface
  ✅ me[Symbol.for('me.seed')] returns the seed
  ✅ me[Symbol.for('me.identity')] returns hash and expression
  ✅ identity hash is a valid hex string
  ✅ identity hash has fixed 64-hex length
  ✅ me[Symbol.for('me.expression')] returns null before @ is called
  ✅ root @ sets active expression and escape plane mirrors it
  ✅ scoped @ keeps claim behavior without replacing the kernel active expression
  ✅ identity hash is independent of write history
  ✅ identity hash is independent of creation time
  ✅ identity hash is independent of process state
  ✅ web3 analogy — same mnemonic always derives same address

32/32 tests passed

✅ RECONSTRUCTION PROOF COMPLETE
   same seed → same identity
   always. deterministically. on any device.
   the seed is the self.

✅ FIRETEST :: reconstruction completed in 125.39ms
```

---

## Secret Material V3

```
### Secret Material V3
✅ same input yields the same chain and the same 32-byte material
✅ branch and value diverge for the same secret path
✅ sibling leaves share branch material but diverge at value level
✅ changing the active noise boundary changes derived material
✅ changing a relevant nested secret changes derived material
✅ branch mode rejects the root secret scope
✅ legacy effective secret behavior remains unchanged
✅ Secret material v3 suite passed

✅ FIRETEST :: secret-material-v3 completed in 86.58ms
```

---

## Secret Blob V3 — Read

```
### Secret Blob V3 Read
✅ v3 branch blob reads through normal secret path
✅ v3 value-level blob reads through normal path
✅ value-level cache does not leak mutable object references
✅ value-level cache invalidates when secret epoch changes
✅ branch write preloads v3 keys cache for immediate cold read
✅ branch cache priming is scoped to the written chunk
✅ branch cache priming invalidates when secret epoch changes
✅ tampered branch blob bypasses primed cache and fails closed
✅ v2 and legacy blobs remain readable
✅ tampered v3 branch blob fails closed
✅ wrong secret for v3 branch blob fails closed
✅ wrong path for v3 value-level blob fails closed
✅ wrong noise for v3 branch blob fails closed
✅ Secret blob v3 read suite passed

✅ FIRETEST :: secret-blob-v3.read completed in 92.76ms
```

---

## Secret Blob V3 — Write

```
### Secret Blob V3 Write
✅ default write now emits v3 branch blobs
✅ default write now emits v3 value-level blobs
✅ forcing v2 still emits v2 branch blobs and remains readable
✅ forcing v2 still emits v2 value-level blobs and remains readable
✅ migrateEncryptedBranchesToV3 migrates v2 chunks and preserves history
✅ migrateEncryptedBranchesToV3 skips already-v3 chunks
✅ tampering after migration still fails closed
✅ Secret blob v3 write suite passed

✅ FIRETEST :: secret-blob-v3.write completed in 77.86ms
```

---

## Contracts Summary

```
### DSL Contract Tests (Phase 6)
✅ boot + basic set/get
✅ constructor bootstrap preserves callable proxy after hydrate
✅ execute dispatch keeps kernel and keyspace routes stable
✅ mutation helpers preserve learn + replay semantics
✅ public memory surfaces redact effectiveSecret and stay replayable
✅ snapshot import accepts both public and legacy memory payloads
✅ phase1 selector [] fixed id
✅ phase2 iterator broadcast [i] with '='
✅ phase3 filter read + phase3.1 logical filters
✅ phase3.1 filtered broadcast for '='
✅ phase4 multi-select and range
✅ phase5 transform projection
✅ runtime escape plane exposes reflective kernel helpers
✅ explicit guest scope does not collapse back to owner scope
✅ explain() masks stealth inputs while keeping public inputs visible
✅ explain() exposes expr plus recompute wave metadata for the selected target
✅ secret branch blobs are non-deterministic across identical writes
✅ tampered v2 secret blobs fail closed
✅ legacy xor secret snapshots still decrypt after v2 hardening
✅ secret caches stay bounded under broad secret traversal
✅ Phase 6 contract suite passed

### Secret Blob Hardening Contracts (4B.0)
✅ legacy secret snapshot still decrypts correctly
✅ v2 secret branch snapshot still decrypts correctly
✅ mixed public+secret snapshot rehydrates without leaking
✅ secret root stays stealth after rehydrate
✅ pointer into secret branch still resolves correctly
✅ tampered branch blob fails closed
✅ tampered value-level encrypted leaf fails closed
✅ wrong secret key fails closed
✅ wrong noise boundary fails closed
✅ blob copied to sibling scope path does not decrypt
✅ replay from public memories preserves secret semantics
✅ Secret blob hardening contract suite passed

✅ FIRETEST :: contracts-summary completed in 262.07ms
```

---

## Full Summary

| Suite                  | Status | Time      |
|------------------------|--------|-----------|
| phases                 | ✅     | 184.98ms  |
| reconstruction         | ✅     | 125.39ms  |
| secret-material-v3     | ✅     | 86.58ms   |
| secret-blob-v3.read    | ✅     | 92.76ms   |
| secret-blob-v3.write   | ✅     | 77.86ms   |
| contracts-summary      | ✅     | 262.07ms  |

**STATUS: ALL FIRETEST TASKS PASSED**
