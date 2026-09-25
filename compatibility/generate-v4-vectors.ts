// Run with node compatibility/generate-v4-vectors.ts
// Public test material only. Read the reference SOURCE, never a stale dist bundle.
import { deriveBlobV4Keys } from '../Typescript/src/crypto.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hex = (v: Uint8Array) => Buffer.from(v).toString('hex');
const enc = new TextEncoder();
const vectors = [];
for (const mode of ['branch', 'value'] as const) {
  for (const variant of ['base', 'other-root', 'nested', 'unicode', 'noise']) {
    const path = variant === 'unicode' ? ['notas', '日本語'] : ['wallet', 'balance'];
    const segments = ['this.me/blob/v4', mode, 'wallet', path.join('.'),
      variant === 'noise' ? 'noise\0wallet\0boundary' : 'this.me/blob/v4/no-noise',
      'secret\0wallet\0fixture-secret'];
    if (variant === 'nested') segments.push('secret\0wallet.balance\0nested-secret');
    const chain = segments.map(s => enc.encode(s));
    const root = Uint8Array.from({length: 32}, (_, i) => i + (variant === 'other-root' ? 1 : 0));
    const keys = deriveBlobV4Keys(chain, mode, path, root);
    vectors.push({ name: `${mode}-${variant}`, mode, path, chain: chain.map(hex), root: hex(root),
      encKey: hex(keys.encKey), macKey: hex(keys.macKey), pathContext: hex(keys.pathContext) });
  }
}
const reference = readFileSync(new URL('../Typescript/src/crypto.ts', import.meta.url));
const data = JSON.stringify({source: 'Typescript/src/crypto.ts', sha256: createHash('sha256').update(reference).digest('hex'), vectors}, null, 2) + '\n';
const target = new URL('../Rust/tests/fixtures/typescript-v4-kdf.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== data) throw new Error('v4 vectors are stale; regenerate and review');
} else writeFileSync(target, data);
