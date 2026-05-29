import { MEKernelLike, MEWrappedKeyOpenOptions, WrappedSecretV1 } from './types.js';
export declare function installRecipientKey(self: MEKernelLike, recipientKeyId: string, privateKey: CryptoKey): MEKernelLike;
export declare function uninstallRecipientKey(self: MEKernelLike, recipientKeyId: string): MEKernelLike;
export declare function storeWrappedKey(self: MEKernelLike, keyId: string, envelope: WrappedSecretV1, options?: {
    recipientKeyId?: string;
}): MEKernelLike;
export declare function handleKeySpaceTarget(self: MEKernelLike, operation: string, keyId: string | null, body?: any): any;
export declare function parseKeySpacePath(rawPath: string): {
    isKeySpace: boolean;
    keyId: string | null;
};
export declare function readWrappedKey(self: MEKernelLike, keyId: string): WrappedSecretV1;
export declare function writeWrappedKey(self: MEKernelLike, keyId: string, body: any): WrappedSecretV1;
export declare function openWrappedKey(self: MEKernelLike, keyId: string, body?: MEWrappedKeyOpenOptions): Promise<Uint8Array | string>;
