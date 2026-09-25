import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('./parity.json', import.meta.url)));
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(resolve(dir,e.name)) : [resolve(dir,e.name)]);
const files = [resolve(root,'Typescript/index.ts'), resolve(root,'Typescript/package.json'), ...walk(resolve(root,'Typescript/src'))].sort();
const hash = createHash('sha256');
for (const file of files) hash.update(relative(root,file)).update('\0').update(readFileSync(file)).update('\0');
const fingerprint = hash.digest('hex');
const ts = JSON.parse(readFileSync(resolve(root,'Typescript/package.json'))).version;
const rust = readFileSync(resolve(root,'Rust/Cargo.toml'),'utf8').match(/^version = "([^"]+)"/m)[1];
if (process.argv.includes('--fingerprint')) { console.log(fingerprint); process.exit(0); }
const statuses = ['contract-covered','partial','pending'];
const ids = new Set();
for (const c of manifest.contracts) {
  if (ids.has(c.id) || !statuses.includes(c.status)) throw new Error(`Invalid contract: ${c.id}`);
  ids.add(c.id);
  if (c.status === 'contract-covered' && !c.tests?.length) throw new Error(`Missing tests: ${c.id}`);
  for (const test of c.tests ?? []) if (!existsSync(resolve(root,`Rust/tests/${test}.rs`))) throw new Error(`Missing test: ${test}`);
}
const stale = ts !== manifest.reference.version || fingerprint !== manifest.reference.sourceSha256;
console.log(`.me reference: TypeScript ${ts}; Rust ${rust}; contract revision ${manifest.contractRevision}`);
console.log(`Reference source: ${stale ? 'CHANGED — audit baseline needs review' : 'matches audited baseline'}`);
for (const status of statuses) console.log(`${status}: ${manifest.contracts.filter(c=>c.status===status).length}`);
console.log(`Known open contracts: ${manifest.contracts.filter(c=>c.status!=='contract-covered').length} (not a percentage of total semantic parity)`);
for (const c of manifest.contracts.filter(c=>c.status!=='contract-covered')) console.log(`  ${c.id}: ${c.note}`);
console.log('Package versions are independent; no numeric semver subtraction. Status is declared coverage, not proof of a fresh test run.');
if ((process.argv.includes('--check') || process.argv.includes('--test')) && stale) process.exitCode=1;
if (process.argv.includes('--test') && !stale) {
  const commands = [
    [process.execPath, ['compatibility/generate-v4-vectors.ts','--check'], root],
    ['cargo', ['test', ...[...new Set(manifest.contracts.flatMap(c=>c.tests??[]))].flatMap(t=>['--test',t])], resolve(root,'Rust')],
  ];
  for (const [cmd,args,cwd] of commands) {
    const r=spawnSync(cmd,args,{cwd,stdio:'inherit'});
    if(r.error) console.error(r.error.message);
    if(r.status!==0) { process.exitCode=r.status || 1; break; }
  }
}
