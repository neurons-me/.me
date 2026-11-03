// Local version of the /LLMS/Meta/ demo: sentence -> metaModel() -> parse() (validate + dry-run) -> prints ops and diff.
// The key comes from META_API_KEY in your environment; nothing is applied. Each run is a billed Meta Model API call (1-3 requests).
//   META_API_KEY=... node demo-cli.ts "Luis is 30 years old" ['{"luis":{"name":"Luis"}}']
import { parse } from "./src/parse.ts";
import { metaModel } from "./src/adapters/meta.ts";
const [text, state] = process.argv.slice(2);
if (!text) { console.error('usage: node demo-cli.ts "<sentence>" [state-json]'); process.exit(2); }
const r = await parse({ text, state: state ? JSON.parse(state) : {} }, { model: metaModel() });
console.log(JSON.stringify({ ok: r.ok, attempts: r.attempts, ops: r.ops, needsConfirm: r.needsConfirm, diff: r.diff, reads: r.reads, errors: r.errors }, null, 2));
process.exit(r.ok ? 0 : 1);
