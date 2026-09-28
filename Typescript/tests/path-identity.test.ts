/// <reference types="node" />
// Path identity: a path is a list of logical segments. Two different lists
// must be two different places — in the index, in the memory log, in secret
// scopes and in key derivation. Today the kernel joins segments with "." and
// loses the boundaries, so a segment containing "." collides with nesting
// (bug #6). These cases state the desired separation without assuming how a
// literal "." will be escaped; they run as KNOWN FAIL until the path encoding
// is decided (NRP v0.4 D5) and fail the suite if they start passing.
//
// These are reproductions of an expected failure, not satisfied acceptance
// tests: `npm test` passing means the bug is still there, unchanged. When the
// kernel is fixed, each case becomes a normal assertion outside knownFailing.
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
      // Control: without any scope, x → y → t is public and survives a
      // snapshot into a fresh instance.
      const control: any = new (ME as any)();
      control.x.y.t(6);
      const controlCopy: any = new (ME as any)();
      controlCopy.importSnapshot(control.exportSnapshot());
      assert.equal(controlCopy("x.y.t"), 6, "control precondition");

      // A scope on the single segment "x.y" must not change that.
      const me: any = new (ME as any)();
      me["x.y"]["_"]("scope-key");
      me.x.y.t(6); // path ["x","y","t"], not under the segment ["x.y"]
      // Storage plane: the nested value is readable from a fresh instance
      // that never received the scope key.
      const copy: any = new (ME as any)();
      copy.importSnapshot(me.exportSnapshot());
      assert.equal(copy("x.y.t"), 6, "the nested value was stored inside the literal segment's sealed branch");
      // Log plane: the write is not redacted as a sealed one.
      const t = me.inspect().memories.find((m: any) => m.path.endsWith("t"));
      assert.equal(t?.value, 6, "the nested write was logged as sealed");
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
