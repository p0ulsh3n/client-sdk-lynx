// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/e2ee/RNKeyProvider.ts
// Port of RNKeyProvider.ts — imports from local package.
// ─────────────────────────────────────────────────────────────────────────────

import { BaseKeyProvider, type KeyProviderOptions } from 'livekit-client';
import { RTCFrameCryptorFactory, type RTCKeyProvider, type RTCKeyProviderOptions } from './RTCFrameCryptorFactory';

export type RNKeyProviderOptions = KeyProviderOptions & {
  uncryptedMagicBytes?: string | Uint8Array;
};

export default class RNKeyProvider extends BaseKeyProvider {
  private readonly _latestKeyIndex = new Map<string, number>();
  private readonly _nativeProvider: RTCKeyProvider;
  private readonly _ready: Promise<void>;

  constructor(options: Partial<RNKeyProviderOptions>) {
    const opts: RTCKeyProviderOptions & KeyProviderOptions = {
      sharedKey: options.sharedKey ?? true,
      ratchetSalt: options.ratchetSalt ?? 'LKFrameEncryptionKey',
      ratchetWindowSize: options.ratchetWindowSize ?? 16,
      failureTolerance: options.failureTolerance ?? -1,
      keyRingSize: options.keyringSize ?? 16,
      keyringSize: options.keyringSize ?? 16,
      discardFrameWhenCryptorNotReady: false,
    };

    let magicBytes = options.uncryptedMagicBytes ?? 'LK-ROCKS';
    if (typeof magicBytes === 'string') magicBytes = new TextEncoder().encode(magicBytes);
    opts.uncryptedMagicBytes = magicBytes as Uint8Array;

    super(opts);
    this._nativeProvider = null as unknown as RTCKeyProvider;

    let resolveReady!: () => void;
    this._ready = new Promise<void>((r) => (resolveReady = r));

    RTCFrameCryptorFactory.createDefaultKeyProvider(opts).then((kp) => {
      (this as unknown as { _nativeProvider: RTCKeyProvider })._nativeProvider = kp;
      resolveReady();
    });
  }

  get ready(): Promise<void> { return this._ready; }
  getLatestKeyIndex(participantId: string): number { return this._latestKeyIndex.get(participantId) ?? 0; }

  async setSharedKey(key: string | Uint8Array, keyIndex?: number): Promise<void> {
    await this._ready; return this._nativeProvider.setSharedKey(key, keyIndex);
  }
  async ratchetSharedKey(keyIndex?: number): Promise<void> {
    await this._ready; return this._nativeProvider.ratchetSharedKey(keyIndex);
  }
  async setKey(participantId: string, key: string | Uint8Array, keyIndex?: number): Promise<void> {
    await this._ready;
    if (this.getOptions().sharedKey) return this.setSharedKey(key, keyIndex);
    this._latestKeyIndex.set(participantId, keyIndex ?? 0);
    return this._nativeProvider.setKey(participantId, key, keyIndex);
  }
  override async ratchetKey(participantIdentity?: string, keyIndex?: number): Promise<void> {
    await this._ready;
    if (!this.getOptions().sharedKey && participantIdentity)
      return this._nativeProvider.ratchetKey(participantIdentity, keyIndex);
    return this.ratchetSharedKey(keyIndex);
  }
  async setSifTrailer(trailer: Uint8Array): Promise<void> {
    await this._ready; return this._nativeProvider.setSifTrailer(trailer);
  }
  get rtcKeyProvider(): RTCKeyProvider { return this._nativeProvider; }
  dispose(): void { this._nativeProvider?.dispose(); }
}
