export declare enum ChunkEncoding {
    TREE = "tree",
    COLUMNAR = "columnar"
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
export declare function shouldUseColumnarEncoding(value: unknown): boolean;
export declare function isColumnarChunkEnvelope(value: unknown): value is ColumnarChunkEnvelope;
export declare function materializeColumnarData(items: any[]): ColumnarChunkEnvelope;
export declare function getColumnarItem(data: ColumnarChunkPayload, index: number): any;
export declare function materializeColumnarRange(data: ColumnarChunkPayload, start: number, end: number): any[];
export declare function dematerializeColumnarData(data: ColumnarChunkPayload): any[];
export declare function prepareColumnarChunkForEncryption(envelope: ColumnarChunkEnvelope): {
    __columnar: true;
    payload: PreparedColumnarChunkPayload;
};
export declare function reconstructColumnarChunkPayload(value: unknown): ColumnarChunkPayload;
export {};
