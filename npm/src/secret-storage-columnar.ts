export enum ChunkEncoding {
  TREE = "tree",
  COLUMNAR = "columnar",
}

export interface ColumnarChunkMeta {
  encoding: ChunkEncoding.COLUMNAR;
  version: 1;
  count: number;
  dims: number;
}

export interface ColumnarChunkPayload {
  meta: ColumnarChunkMeta;
  ids?: Uint32Array;
  embeddings?: Float32Array;
  timestamps?: Float64Array;
  texts?: string[];
  metadata?: Record<string, Record<string, unknown>>;
}

export interface ColumnarChunkEnvelope {
  __columnar: true;
  payload: ColumnarChunkPayload;
}

type PreparedTypedArray = {
  __typedArray: true;
  kind: "Uint32Array" | "Float32Array" | "Float64Array";
  base64: string;
};

type PreparedColumnarChunkPayload = {
  meta: ColumnarChunkMeta;
  ids?: PreparedTypedArray;
  embeddings?: PreparedTypedArray;
  timestamps?: PreparedTypedArray;
  texts?: string[];
  metadata?: Record<string, Record<string, unknown>>;
};

export function shouldUseColumnarEncoding(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length < 1000) return false;

  const sample = value.slice(0, Math.min(8, value.length));
  if (sample.length === 0) return false;

  return sample.every((item) => {
    if (!item || typeof item !== "object") return false;
    const embedding = (item as Record<string, unknown>).embedding;
    return (
      Array.isArray(embedding) &&
      embedding.length >= 128 &&
      embedding.every((n) => typeof n === "number" && Number.isFinite(n))
    );
  });
}

export function isColumnarChunkEnvelope(value: unknown): value is ColumnarChunkEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { __columnar?: unknown; payload?: unknown };
  if (candidate.__columnar !== true) return false;
  if (!candidate.payload || typeof candidate.payload !== "object") return false;
  const payload = candidate.payload as { meta?: Partial<ColumnarChunkMeta> };
  return payload.meta?.encoding === ChunkEncoding.COLUMNAR;
}

export function materializeColumnarData(items: any[]): ColumnarChunkEnvelope {
  const count = items.length;
  const dims = inferEmbeddingDims(items);

  const ids = new Uint32Array(count);
  const embeddings = new Float32Array(count * dims);
  const timestamps = new Float64Array(count);
  const texts = new Array<string>(count);
  const metadata: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < count; i++) {
    const item = items[i] ?? {};
    ids[i] = normalizeUint32(item.id, i);
    timestamps[i] = normalizeTimestamp(item.timestamp);
    texts[i] = typeof item.text === "string" ? item.text : "";

    const embedding = Array.isArray(item.embedding) ? item.embedding : [];
    for (let j = 0; j < dims; j++) {
      const value = embedding[j];
      embeddings[i * dims + j] = typeof value === "number" && Number.isFinite(value) ? value : 0;
    }

    const extra: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      if (key === "id" || key === "embedding" || key === "timestamp" || key === "text") continue;
      extra[key] = val;
    }
    if (Object.keys(extra).length > 0) metadata[String(i)] = extra;
  }

  return {
    __columnar: true,
    payload: {
      meta: {
        encoding: ChunkEncoding.COLUMNAR,
        version: 1,
        count,
        dims,
      },
      ids,
      embeddings,
      timestamps,
      texts,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
  };
}

export function getColumnarItem(data: ColumnarChunkPayload, index: number): any {
  if (index < 0 || index >= data.meta.count) return undefined;

  const item: Record<string, unknown> = {
    id: data.ids?.[index] ?? index,
    timestamp: data.timestamps?.[index] ?? 0,
    text: data.texts?.[index] ?? "",
  };

  if (data.embeddings && data.meta.dims > 0) {
    const start = index * data.meta.dims;
    const end = start + data.meta.dims;
    item.embedding = Array.from(data.embeddings.subarray(start, end));
  } else {
    item.embedding = [];
  }

  const extra = data.metadata?.[String(index)];
  if (extra) Object.assign(item, extra);
  return item;
}

export function materializeColumnarRange(
  data: ColumnarChunkPayload,
  start: number,
  end: number,
): any[] {
  const safeStart = clamp(start, 0, data.meta.count);
  const safeEnd = clamp(end, safeStart, data.meta.count);
  const out: any[] = [];
  for (let i = safeStart; i < safeEnd; i++) out.push(getColumnarItem(data, i));
  return out;
}

export function dematerializeColumnarData(data: ColumnarChunkPayload): any[] {
  return materializeColumnarRange(data, 0, data.meta.count);
}

export function prepareColumnarChunkForEncryption(
  envelope: ColumnarChunkEnvelope,
): { __columnar: true; payload: PreparedColumnarChunkPayload } {
  return {
    __columnar: true,
    payload: {
      meta: envelope.payload.meta,
      ids: envelope.payload.ids ? encodeTypedArray(envelope.payload.ids, "Uint32Array") : undefined,
      embeddings: envelope.payload.embeddings
        ? encodeTypedArray(envelope.payload.embeddings, "Float32Array")
        : undefined,
      timestamps: envelope.payload.timestamps
        ? encodeTypedArray(envelope.payload.timestamps, "Float64Array")
        : undefined,
      texts: envelope.payload.texts,
      metadata: envelope.payload.metadata,
    },
  };
}

export function reconstructColumnarChunkPayload(value: unknown): ColumnarChunkPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid columnar payload");
  }

  const raw = value as Partial<PreparedColumnarChunkPayload>;
  const meta = raw.meta;
  if (!meta || meta.encoding !== ChunkEncoding.COLUMNAR || meta.version !== 1) {
    throw new Error("Invalid columnar payload metadata");
  }

  return {
    meta: {
      encoding: ChunkEncoding.COLUMNAR,
      version: 1,
      count: toSafeInteger(meta.count),
      dims: toSafeInteger(meta.dims),
    },
    ids: raw.ids ? decodeTypedArray(raw.ids, Uint32Array, "Uint32Array") : undefined,
    embeddings: raw.embeddings
      ? decodeTypedArray(raw.embeddings, Float32Array, "Float32Array")
      : undefined,
    timestamps: raw.timestamps
      ? decodeTypedArray(raw.timestamps, Float64Array, "Float64Array")
      : undefined,
    texts: Array.isArray(raw.texts) ? raw.texts.map((x) => (typeof x === "string" ? x : "")) : undefined,
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : undefined,
  };
}

function inferEmbeddingDims(items: any[]): number {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item.embedding) && item.embedding.length > 0) return item.embedding.length;
  }
  return 0;
}

function normalizeUint32(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : fallback;
  if (!Number.isFinite(n) || n < 0) return fallback >>> 0;
  return Math.floor(n) >>> 0;
}

function normalizeTimestamp(value: unknown): number {
  const n = typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSafeInteger(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function encodeTypedArray(
  value: Uint32Array | Float32Array | Float64Array,
  kind: PreparedTypedArray["kind"],
): PreparedTypedArray {
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return {
    __typedArray: true,
    kind,
    base64: bytesToBase64(bytes),
  };
}

function decodeTypedArray<T extends Uint32Array | Float32Array | Float64Array>(
  value: PreparedTypedArray,
  Ctor: new (buffer: ArrayBufferLike) => T,
  expectedKind: PreparedTypedArray["kind"],
): T {
  if (!value || value.__typedArray !== true || value.kind !== expectedKind) {
    throw new Error(`Invalid typed array payload for ${expectedKind}`);
  }
  const bytes = base64ToBytes(value.base64);
  const sliced = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Ctor(sliced);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}