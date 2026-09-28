/// <reference types="node" />
// Path identity: a path is a list of logical segments. Two different lists
// must be two different places — in the index, in the memory log, in secret
// scopes and in key derivation. Today the kernel joins segments with "." and
// loses the boundaries, so a segment containing "." collides with nesting
// (bug #6). These cases state the desired separation without assuming how a
// literal "." will be escaped; they run as KNOWN FAIL until the path encoding
// is decided (NRP v0.4 D5) and fail the suite if they start passing.
import assert from "node:assert/strict";
import ME from "../dist/index.js";

type Case = { bug: string; name: string; run: () => void };

const knownFailing: Case[] = [
  {
    bug: "#6 path identity",
    name: 'segments ["a.b","c"] and ["a","b.c"] are two places, no value is lost',
    run() {
      const me: any = new (ME as any)();
      me["a.b"].c(1);
      me.a["b.c"](2);
      const paths = me.inspect().memories.map((m: any) => m.path);
      assert.equal(new Set(paths).size, 2, `both writes recorded under one path: ${JSON.stringify(paths)}`);
      const values = Object.values(me.inspect().index);
      assert.ok(values.includes(1) && values.includes(2), "the first value was overwritten");
    },
  },
  {
    bug: "#6 path identity",
    name: 'a secret scope on segment "x.y" does not capture the nested path x → y → t',
    run() {
      const me: any = new (ME as any)();
      me["x.y"]["_"]("scope-key");
      me.x.y.t(6); // not under the literal "x.y" segment
      const t = me.inspect().memories.find((m: any) => m.path.endsWith("t"));
      assert.equal(t?.value, 6, "the nested write was sealed into the literal segment's scope");
    },
  },
];

let unexpectedPass = 0;
for (const c of knownFailing) {
  try {
    c.run();
    unexpectedPass++;
    console.log(`PASS? ${c.bug}: ${c.name} — now passes, move it out of knownFailing`);
  } catch {
    console.log(`KNOWN FAIL ${c.bug}: ${c.name}`);
  }
}
if (unexpectedPass > 0) {
  console.log(`\n${unexpectedPass} known-failing now passing`);
  process.exit(1);
}
console.log("\npath identity: known failures unchanged");
