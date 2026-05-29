// @ts-expect-error generated dist file has no local declarations during typecheck
import * as ThisMeModule from "../../dist/me.es.js";
const ME = ThisMeModule.default;
const commitIndexedBatchExport = ThisMeModule.commitIndexedBatch;

const TOTAL = 1024;
const BATCH = 256;
const DIMS = 1536;
const MB = 1024 * 1024;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)}MB`;
}

function randomVector(seed: number): Float32Array {
  const out = new Float32Array(DIMS);
  for (let i = 0; i < DIMS; i++) {
    out[i] = (((seed + 1) * 31 + i * 17) % 1000) / 1000;
  }
  return out;
}

function generateBatch(start: number, size: number) {
  const now = Date.now();
  return Array.from({ length: size }, (_, offset) => {
    const id = start + offset;
    return {
      id,
      embedding: randomVector(id),
      timestamp: now - id * 1000,
      text: `vector-${id}`,
      kind: "embedding-record",
      processed: id % 2 === 0,
    };
  });
}

function resolveBatchWriter(me: any) {
  const candidates = [
    typeof commitIndexedBatchExport === "function"
      ? (startIndex: number, items: any[]) => commitIndexedBatchExport(me, ["memory", "episodic"], startIndex, items)
      : null,
    typeof me?._commitIndexedBatch === "function"
      ? (startIndex: number, items: any[]) => me._commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
    typeof me?.commitIndexedBatch === "function"
      ? (startIndex: number, items: any[]) => me.commitIndexedBatch(["memory", "episodic"], startIndex, items)
      : null,
  ].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error("commitIndexedBatch is not reachable from benchmark.vector-corpus.ts");
  }

  return candidates[0] as (startIndex: number, items: any[]) => void;
}

function memorySnapshot() {
  const m = process.memoryUsage();
  return {
    heapUsed: m.heapUsed,
    rss: m.rss,
  };
}

async function main() {
  const me: any = new ME();
  me["@"]("vector-corpus");
  me.memory.episodic["_"]("vector-corpus-secret");
  me._enablePersistSecretBranchDebug?.(true);

  const writeBatch = resolveBatchWriter(me);

  console.log("============================================================");
  console.log(".me VECTOR CORPUS BENCHMARK");
  console.log("============================================================");
  console.log(`Target: ${TOTAL.toLocaleString()} vectors | Batch: ${BATCH} | Dims: ${DIMS}`);
  console.log("Secret scope: memory.episodic");

  const t0 = performance.now();
  for (let start = 0; start < TOTAL; start += BATCH) {
    const size = Math.min(BATCH, TOTAL - start);
    writeBatch(start, generateBatch(start, size));
  }
  const writeMs = performance.now() - t0;

  const persist = me._takePersistSecretBranchDebugWindow?.() ?? {};
  const scope = ["memory", "episodic"];
  const scopeSecret = me.computeEffectiveSecret(scope);
  const chunkId = me.getChunkId([...scope, "0"], scope);

  global.gc?.();
  const beforeChunkRead = memorySnapshot();
  const decrypted = me.getDecryptedChunk(scope, scopeSecret, chunkId);
  global.gc?.();
  const afterChunkRead = memorySnapshot();

  assert(decrypted && typeof decrypted === "object", "decrypted chunk missing");
  assert(decrypted.__columnar === true, "expected columnar chunk envelope");
  assert(decrypted.payload?.embeddings instanceof Float32Array, "expected Float32Array embeddings payload");
  assert(decrypted.payload?.meta?.count > 0, "columnar payload count missing");
  assert(decrypted.payload.meta.dims === DIMS, `dims mismatch: expected ${DIMS}, got ${decrypted.payload.meta.dims}`);

  const first = me("memory.episodic.0");
  assert(first && typeof first === "object", "public read returned nothing");
  assert(Array.isArray(first.embedding), "public read did not materialize embedding array");
  assert(first.embedding.length === DIMS, `public read dims mismatch: expected ${DIMS}, got ${first.embedding.length}`);

  console.log("\n=== RESULTS ===");
  console.log(`Write time: ${(writeMs / 1000).toFixed(2)}s`);
  console.log(`Throughput: ${(TOTAL / (writeMs / 1000)).toFixed(0)} vps`);
  console.log(`Columnar writes: ${persist.columnarWrites ?? 0}`);
  console.log(`Chunk count: ${decrypted.payload.meta.count}`);
  console.log(`Chunk dims: ${decrypted.payload.meta.dims}`);
  console.log(`Chunk embeddings: ${decrypted.payload.embeddings.constructor.name}`);
  console.log(`Chunk read heap delta: ${formatMb(afterChunkRead.heapUsed - beforeChunkRead.heapUsed)}`);
  console.log(`Chunk read rss delta: ${formatMb(afterChunkRead.rss - beforeChunkRead.rss)}`);

  assert((persist.columnarWrites ?? 0) > 0, "expected at least one columnar write");

  console.log("\nPASS: vector corpus is chunked, columnar, and typed-array backed.\n");
}

main().catch((error) => {
  console.error("\nFAIL: benchmark.vector-corpus.ts");
  console.error(error);
  process.exitCode = 1;
});
