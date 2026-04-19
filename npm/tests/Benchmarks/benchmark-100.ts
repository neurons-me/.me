// benchmark-100.ts
import ME from "this.me";

const N = 100_000;
const DIM = 1536;
const MB = 1024 * 1024;

function randomVector() {
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) v[i] = Math.random() * 2 - 1;
  return v;
}

const me = new ME();
me["@"]("bench");

console.log(`Ingesting ${N} encrypted vectors (leaf-write microbenchmark)...`);
const t0 = performance.now();

for (let i = 0; i < N; i++) {
  me.vectors[i].embedding(randomVector());
  me.vectors[i].meta({ id: i });
  me.vectors[i]["_"]("vec-key-2026"); // cifrado individual por vector
  if (i % 10000 === 0) process.stdout.write(`${i} `);
}

const dt = (performance.now() - t0) / 1000;
const vps = N / dt;
if (global.gc) global.gc();
const heap = process.memoryUsage().heapUsed / MB;

console.log(`\n\n=== RESULTS ===`);
console.log(`Vectors: ${N}`);
console.log(`Time: ${(dt / 60).toFixed(1)}min`);
console.log(`Throughput: ${vps.toFixed(0)} vps`);
console.log(`Heap post-GC: ${heap.toFixed(1)}MB`);
