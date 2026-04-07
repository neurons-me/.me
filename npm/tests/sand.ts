// <reference types="node" />
import assert from "node:assert/strict";
import ME from "this.me";

type MEProxy = any;

type Memory = {
  path: string;
  operator: string | null;
  expression: any;
  value: any;
  effectiveSecret: string;
  hash: string;
  prevHash?: string;
  timestamp: number;
};

function getSTM(me: MEProxy): Memory[] {
  const v = (me as any)._memories ?? (me as any).memories;
  return Array.isArray(v) ? v : [];
}

// Same hash as your original (FNV-1a 32-bit-ish)
function hashFn(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

function runAxiom8() {
  const me = new (ME as any)() as MEProxy;

  // Minimal setup to generate a few memories
  me["@"]("jabellae");
  me.ledger.host("localhost:8161");
  me.ledger.protocol("http");
  me.wallet["_"]("secret");
  me.wallet.balance(1000);

  const stm = getSTM(me);
  assert.ok(stm.length >= 5, `expected >= 5 memories, got ${stm.length}`);

  for (let i = 0; i < stm.length; i++) {
    const t = stm[i];

    // prevHash must link to previous memory hash
    const expectedPrev = i === 0 ? "" : stm[i - 1].hash;
    assert.equal(t.prevHash ?? "", expectedPrev, `prevHash mismatch at memory #${i}`);

    // recompute hash and compare
    const expectedHash = hashFn(
      JSON.stringify({
        path: t.path,
        operator: t.operator,
        expression: t.expression,
        value: t.value,
        effectiveSecret: t.effectiveSecret,
        prevHash: t.prevHash ?? "",
      })
    );

    assert.equal(t.hash, expectedHash, `hash mismatch at memory #${i}`);
  }

  console.log("✅ A8 PASS (Hash-chain tamper evidence)");
}

runAxiom8();

export {};
