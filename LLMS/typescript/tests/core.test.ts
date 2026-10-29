import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, validateOps, pathError, newME, applyOps, sameFinalState, buildMessages, type ChatModel } from "../src/index.ts";
import { metaModel } from "../src/adapters/meta.ts";
import { openaiModel } from "../src/adapters/openai.ts";

const scripted = (...replies: string[]) => { const calls: any[] = []; const m: ChatModel = async (msgs) => { calls.push([...msgs]); const r = replies.shift(); if (r === undefined) throw new Error("no more replies"); return r; }; return { m, calls }; };
const J = (ops: any[]) => JSON.stringify({ ops });

test("set + define: validated, dry-run diff, nothing to confirm", async () => {
  const { m } = scripted(J([{ op: "set", path: "order.subtotal", value: 100 }, { op: "set", path: "order.tax", value: 16 }, { op: "define", path: "order", name: "total", expr: "subtotal + tax" }]));
  const r = await parse({ text: "subtotal 100, tax 16, total is the sum" }, { model: m });
  assert.equal(r.ok, true); assert.equal(r.attempts, 1); assert.deepEqual(r.needsConfirm, []);
  assert.deepEqual(r.diff.find((d) => d.path === "order.total"), { path: "order.total", before: undefined, after: 116 });
});

test("fenced JSON is accepted", async () => {
  const { m } = scripted("```json\n" + J([{ op: "set", path: "a.b", value: 1 }]) + "\n```");
  assert.equal((await parse({ text: "a.b is 1" }, { model: m })).ok, true);
});

test("secret, noise, identity, remove go to needsConfirm", async () => {
  const ops = [{ op: "secret", path: "wallet" }, { op: "set", path: "wallet.balance", value: 500 }, { op: "noise", path: "wallet" }, { op: "identity", handle: "@Sui" }, { op: "remove", path: "wallet", key: "balance" }];
  const r = await parse({ text: "x" }, { model: scripted(J(ops)).m });
  assert.equal(r.ok, true);
  assert.deepEqual(r.needsConfirm.map((o) => o.op), ["secret", "noise", "identity", "remove"]);
  assert.equal((r.ops[3] as any).handle, "sui");
});

test("model may not write secret values: key on secret op and password-like set are rejected, then repaired", async () => {
  const { m, calls } = scripted(
    J([{ op: "secret", path: "wallet", key: "hunter2" }]),
    J([{ op: "secret", path: "wallet" }, { op: "set", path: "wallet.password", value: "hunter2" }]),
    J([{ op: "secret", path: "wallet" }]),
  );
  const r = await parse({ text: "my wallet is private, password hunter2" }, { model: m });
  assert.equal(r.ok, true); assert.equal(r.attempts, 3); assert.equal(calls.length, 3);
  const repair = calls[1].at(-1).content as string;
  assert.match(repair, /unknown key "key"/);
  assert.match(calls[2].at(-1).content, /looks like a secret value/);
});

test("repair loop stops after 2 repairs (3 calls) and reports errors", async () => {
  const { m, calls } = scripted("nope", "still not json", J([{ op: "explode" }]), J([]));
  const r = await parse({ text: "x" }, { model: m });
  assert.equal(r.ok, false); assert.equal(calls.length, 3); assert.match(r.errors[0], /not one of/);
});

test("maxRepairs 0 means one call", async () => {
  const { calls, m } = scripted("bad", J([]));
  assert.equal((await parse({ text: "x" }, { model: m, maxRepairs: 0 })).ok, false); assert.equal(calls.length, 1);
});

test("define over unknown names fails the dry-run and is sent back", async () => {
  const { m, calls } = scripted(J([{ op: "define", path: "order", name: "total", expr: "subtotl + tax" }]), J([{ op: "define", path: "order", name: "total", expr: "subtotal + tax" }]));
  const r = await parse({ text: "total", state: { order: { subtotal: 1, tax: 2 } } }, { model: m });
  assert.equal(r.ok, true); assert.equal(r.attempts, 2); assert.match(calls[1].at(-1).content, /evaluates to undefined/);
  assert.equal(r.diff[0].after, 3);
});

test("broadcast define expands over existing members", async () => {
  const state = { fleet: { trucks: { 1: { fuel: 100 }, 2: { fuel: 200 } } }, price_per_liter: 2 };
  const r = await parse({ text: "cost", state }, { model: scripted(J([{ op: "define", path: "fleet.trucks[i]", name: "cost", expr: "fuel * price_per_liter" }])).m });
  assert.deepEqual(r.diff.map((d) => [d.path, d.after]), [["fleet.trucks[1].cost", 200], ["fleet.trucks[2].cost", 400]]);
});

test("path rules", () => {
  assert.equal(pathError("shop.items[1].price"), null);
  assert.equal(pathError("tienda.artículos.2.precio"), null);
  assert.equal(pathError("売上.顧客.合計"), null);
  assert.match(pathError("a..b")!, /not a valid name/);
  assert.match(pathError("wallet._")!, /operator/);
  assert.match(pathError("trucks[i].cost")!, /only allowed in a define/);
  assert.match(validateOps({ ops: [], extra: 1 }).errors[0], /exactly one key/);
  assert.match(validateOps({ ops: [{ op: "define", path: "a", name: "b", expr: "x => x" }] }).errors[0], /expr/);
});

test("query is read-only and returns reads", async () => {
  const r = await parse({ text: "age?", state: { ana: { age: 22 } } }, { model: scripted(J([{ op: "query", paths: ["ana.age"] }])).m });
  assert.deepEqual(r.reads, { "ana.age": 22 }); assert.deepEqual(r.diff, []);
});

test("applyOps on a real ME requires confirmation and a user-typed key", () => {
  const me = newME();
  const ops: any[] = [{ op: "secret", path: "wallet" }, { op: "set", path: "wallet.balance", value: 5 }];
  assert.throws(() => applyOps(me, ops), /needs user confirmation/);
  assert.throws(() => applyOps(me, ops, { confirm: true }), /must type the key/);
  applyOps(me, ops, { confirm: true, secretKeys: { wallet: "typed-by-user" } });
  assert.equal(me("wallet"), undefined); assert.equal(me("wallet.balance"), 5);
});

test("secret state values are not sent to the model", () => {
  const msgs = buildMessages({ text: "x", state: { wallet: { balance: 500 }, ana: { age: 22 } } }, { secretPaths: ["wallet"], examples: [] });
  const u = msgs.at(-1)!.content;
  assert.match(u, /wallet.balance = <secret>/); assert.doesNotMatch(u, /500/); assert.match(u, /ana.age = 22/);
});

test("final-state scoring treats items.1 and items[1] the same", () => {
  assert.equal(sameFinalState({}, [{ op: "set", path: "items[1].name", value: "K" }], [{ op: "set", path: "items.1.name", value: "K" }]), true);
  assert.equal(sameFinalState({}, [{ op: "set", path: "a", value: 1 }], [{ op: "set", path: "a", value: "1" }]), false);
});

test("adapters: request shape, key only in the header, errors never contain the key", async () => {
  const seen: any[] = [];
  const fake = (status: number, body: any) => (async (url: any, init: any) => { seen.push({ url, init }); return new Response(JSON.stringify(body), { status }); }) as typeof fetch;
  const meta = metaModel({ apiKey: "sk-test-123", fetchImpl: fake(200, { choices: [{ message: { content: "{\"ops\":[]}" } }] }) });
  assert.equal(await meta([{ role: "user", content: "hi" }]), "{\"ops\":[]}");
  assert.equal(seen[0].url, "https://api.meta.ai/v1/chat/completions");
  const b = JSON.parse(seen[0].init.body); assert.equal(b.model, "muse-spark-1.3"); assert.equal(b.response_format, undefined);
  assert.equal(seen[0].init.headers.Authorization, "Bearer sk-test-123"); assert.doesNotMatch(seen[0].init.body, /sk-test/);
  const oai = openaiModel({ apiKey: "sk-o", fetchImpl: fake(401, { error: { message: "bad key" } }) });
  await assert.rejects(oai([{ role: "user", content: "x" }]), (e: any) => /OpenAI API 401: bad key/.test(e.message) && !/sk-o/.test(e.message));
  assert.equal(seen[1].url, "https://api.openai.com/v1/chat/completions"); assert.deepEqual(JSON.parse(seen[1].init.body).response_format, { type: "json_object" });
  assert.throws(() => openaiModel({ apiKey: "" , fetchImpl: fake(200, {}) }), /OPENAI_API_KEY is not set/);
});
