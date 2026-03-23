export interface RTCKeyProviderOptions {
  sharedKey?: boolean;
  ratchetSalt?: string | Uint8Array;
  ratchetWindowSize?: number;
  failureTolerance?: number;
  keyRingSize?: number;
  keyringSize?: number;
  discardFrameWhenCryptorNotReady?: boolean;
  uncryptedMagicBytes?: Uint8Array;
}

export interface RTCEncryptedPacket {
  payload: Uint8Array;
  iv: Uint8Array;
  keyIndex: number;
}

export enum RTCFrameCryptorAlgorithm {
  kAesGcm = 'AES-GCM',
  kAesCbc = 'AES-CBC',
}

export interface RTCFrameCryptor {
  readonly cryptorId: string;
  setEnabled(enabled: boolean): Promise<void>;
  setKeyIndex(index: number): Promise<void>;
  dispose(): Promise<void>;
}

export interface RTCKeyProvider {
  readonly providerTag: string;
  setSharedKey(
    key: string | Uint8Array,
    keyIndex?: number,
  ): Promise<void>;
  setKey(
    participantId: string,
    key: string | Uint8Array,
    keyIndex?: number,
  ): Promise<void>;
  ratchetSharedKey(keyIndex?: number): Promise<void>;
  ratchetKey(
    participantId: string,
    keyIndex?: number,
  ): Promise<void>;
  setSifTrailer(trailer: Uint8Array): Promise<void>;
  dispose(): void;
}

export interface RTCDataPacketCryptor {
  encrypt(
    participantId: string,
    keyIndex: number,
    data: Uint8Array,
  ): Promise<RTCEncryptedPacket | null>;
  decrypt(
    participantId: string,
    packet: RTCEncryptedPacket,
  ): Promise<Uint8Array | null>;
}

export type RTCRtpSenderHandle = { senderId: string; pcId: number };
export type RTCRtpReceiverHandle = { receiverId: string; pcId: number };
