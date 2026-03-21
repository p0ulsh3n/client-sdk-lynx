// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — e2ee/RTCFrameCryptorFactory.ts
// JS implementations of RTCFrameCryptor, RTCKeyProvider, RTCDataPacketCryptor.
// All heavy lifting is delegated to LynxE2EEModule.
// ─────────────────────────────────────────────────────────────────────────────

import { LynxE2EEModule, promisify } from '../NativeModule';
import type {
  RTCEncryptedPacket,
  RTCFrameCryptor,
  RTCFrameCryptorAlgorithm,
  RTCKeyProvider,
  RTCKeyProviderOptions,
  RTCRtpReceiverHandle,
  RTCRtpSenderHandle,
  RTCDataPacketCryptor,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// LynxFrameCryptor
// ─────────────────────────────────────────────────────────────────────────────

class LynxFrameCryptor implements RTCFrameCryptor {
  readonly cryptorId: string;

  constructor(cryptorId: string) {
    this.cryptorId = cryptorId;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await promisify<null>((cb) =>
      LynxE2EEModule.frameCryptorSetEnabled(this.cryptorId, enabled, cb),
    );
  }

  async setKeyIndex(index: number): Promise<void> {
    await promisify<null>((cb) =>
      LynxE2EEModule.frameCryptorSetKeyIndex(this.cryptorId, index, cb),
    );
  }

  async dispose(): Promise<void> {
    await promisify<null>((cb) =>
      LynxE2EEModule.frameCryptorDispose(this.cryptorId, cb),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxKeyProvider
// ─────────────────────────────────────────────────────────────────────────────

class LynxKeyProvider implements RTCKeyProvider {
  readonly providerTag: string;

  constructor(tag: string) {
    this.providerTag = tag;
  }

  async setSharedKey(
    key: string | Uint8Array,
    keyIndex: number = 0,
  ): Promise<void> {
    const keyBase64 = encodeKey(key);
    await promisify<null>((cb) =>
      LynxE2EEModule.keyProviderSetSharedKey(
        this.providerTag,
        keyBase64,
        keyIndex,
        cb,
      ),
    );
  }

  async setKey(
    participantId: string,
    key: string | Uint8Array,
    keyIndex: number = 0,
  ): Promise<void> {
    const keyBase64 = encodeKey(key);
    await promisify<null>((cb) =>
      LynxE2EEModule.keyProviderSetKey(
        this.providerTag,
        participantId,
        keyBase64,
        keyIndex,
        cb,
      ),
    );
  }

  async ratchetSharedKey(keyIndex: number = 0): Promise<void> {
    await promisify<null>((cb) =>
      LynxE2EEModule.keyProviderRatchetSharedKey(
        this.providerTag,
        keyIndex,
        cb,
      ),
    );
  }

  async ratchetKey(
    participantId: string,
    keyIndex: number = 0,
  ): Promise<void> {
    await promisify<null>((cb) =>
      LynxE2EEModule.keyProviderRatchetKey(
        this.providerTag,
        participantId,
        keyIndex,
        cb,
      ),
    );
  }

  async setSifTrailer(trailer: Uint8Array): Promise<void> {
    const trailerBase64 = btoa(String.fromCharCode(...trailer));
    await promisify<null>((cb) =>
      LynxE2EEModule.keyProviderSetSifTrailer(
        this.providerTag,
        trailerBase64,
        cb,
      ),
    );
  }

  dispose(): void {
    LynxE2EEModule.keyProviderDispose(this.providerTag, () => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxDataPacketCryptor
// ─────────────────────────────────────────────────────────────────────────────

class LynxDataPacketCryptor implements RTCDataPacketCryptor {
  private readonly _cryptorTag: string;

  constructor(cryptorTag: string) {
    this._cryptorTag = cryptorTag;
  }

  async encrypt(
    participantId: string,
    keyIndex: number,
    data: Uint8Array,
  ): Promise<RTCEncryptedPacket | null> {
    const dataBase64 = btoa(String.fromCharCode(...data));
    const resultJson = await promisify<string>((cb) =>
      LynxE2EEModule.dataPacketCryptorEncrypt(
        this._cryptorTag,
        participantId,
        keyIndex,
        dataBase64,
        cb,
      ),
    );
    if (!resultJson) return null;
    const r = JSON.parse(resultJson) as {
      payload: string;
      iv: string;
      keyIndex: number;
    };
    return {
      payload: base64ToUint8Array(r.payload),
      iv: base64ToUint8Array(r.iv),
      keyIndex: r.keyIndex,
    };
  }

  async decrypt(
    participantId: string,
    packet: RTCEncryptedPacket,
  ): Promise<Uint8Array | null> {
    const packetJson = JSON.stringify({
      payload: btoa(String.fromCharCode(...packet.payload)),
      iv: btoa(String.fromCharCode(...packet.iv)),
      keyIndex: packet.keyIndex,
    });
    const resultJson = await promisify<string>((cb) =>
      LynxE2EEModule.dataPacketCryptorDecrypt(
        this._cryptorTag,
        participantId,
        packetJson,
        cb,
      ),
    );
    if (!resultJson) return null;
    return base64ToUint8Array(resultJson);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RTCFrameCryptorFactory — public API (matches react-native-webrtc)
// ─────────────────────────────────────────────────────────────────────────────

export const RTCFrameCryptorFactory = {
  /**
   * Create a frame cryptor for an RTP sender.
   */
  async createFrameCryptorForRtpSender(
    participantId: string,
    sender: RTCRtpSenderHandle,
    algorithm: RTCFrameCryptorAlgorithm,
    keyProvider: RTCKeyProvider,
  ): Promise<RTCFrameCryptor> {
    const cryptorId = await promisify<string>((cb) =>
      LynxE2EEModule.frameCryptorCreateForSender(
        sender.pcId,
        sender.senderId,
        participantId,
        algorithm as string,
        keyProvider.providerTag,
        cb,
      ),
    );
    return new LynxFrameCryptor(cryptorId);
  },

  /**
   * Create a frame cryptor for an RTP receiver.
   */
  async createFrameCryptorForRtpReceiver(
    participantId: string,
    receiver: RTCRtpReceiverHandle,
    algorithm: RTCFrameCryptorAlgorithm,
    keyProvider: RTCKeyProvider,
  ): Promise<RTCFrameCryptor> {
    const cryptorId = await promisify<string>((cb) =>
      LynxE2EEModule.frameCryptorCreateForReceiver(
        receiver.pcId,
        receiver.receiverId,
        participantId,
        algorithm as string,
        keyProvider.providerTag,
        cb,
      ),
    );
    return new LynxFrameCryptor(cryptorId);
  },

  /**
   * Create a default key provider with the given options.
   */
  async createDefaultKeyProvider(
    options: RTCKeyProviderOptions,
  ): Promise<RTCKeyProvider> {
    const optsToSend = {
      ...options,
      ratchetSalt:
        options.ratchetSalt instanceof Uint8Array
          ? btoa(String.fromCharCode(...options.ratchetSalt))
          : options.ratchetSalt,
      uncryptedMagicBytes:
        options.uncryptedMagicBytes instanceof Uint8Array
          ? btoa(String.fromCharCode(...options.uncryptedMagicBytes))
          : undefined,
    };
    const tag = await promisify<string>((cb) =>
      LynxE2EEModule.keyProviderCreate(JSON.stringify(optsToSend), cb),
    );
    return new LynxKeyProvider(tag);
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RTCDataPacketCryptorFactory — public API
// ─────────────────────────────────────────────────────────────────────────────

export const RTCDataPacketCryptorFactory = {
  async createDataPacketCryptor(
    algorithm: RTCFrameCryptorAlgorithm,
    keyProvider: RTCKeyProvider,
  ): Promise<RTCDataPacketCryptor> {
    const tag = await promisify<string>((cb) =>
      LynxE2EEModule.dataPacketCryptorCreate(
        algorithm as string,
        keyProvider.providerTag,
        cb,
      ),
    );
    return new LynxDataPacketCryptor(tag);
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function encodeKey(key: string | Uint8Array): string {
  if (typeof key === 'string') {
    return btoa(key);
  }
  return btoa(String.fromCharCode(...key));
}

function base64ToUint8Array(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
