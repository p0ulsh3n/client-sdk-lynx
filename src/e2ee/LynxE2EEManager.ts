// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/e2ee/LynxE2EEManager.ts
// Port of RNE2EEManager.ts — same logic, imports from local package.
// ─────────────────────────────────────────────────────────────────────────────

import {
  RTCFrameCryptorFactory,
  RTCDataPacketCryptorFactory,
  RTCFrameCryptorAlgorithm,
  type RTCFrameCryptor,
  type RTCEncryptedPacket,
  type RTCRtpSenderHandle,
  type RTCRtpReceiverHandle,
} from './RTCFrameCryptorFactory';

import {
  LocalParticipant,
  LocalTrackPublication,
  ParticipantEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RoomEvent,
  type Room,
  type BaseE2EEManager,
  type E2EEManagerCallbacks,
  EncryptionEvent,
  type DecryptDataResponseMessage,
  type EncryptDataResponseMessage,
  Mutex,
} from 'livekit-client';

import type RNKeyProvider from './RNKeyProvider';
import type RTCEngine from 'livekit-client/dist/src/room/RTCEngine';
import EventEmitter from 'events';
import type TypedEventEmitter from 'typed-emitter';

export default class LynxE2EEManager
  extends (EventEmitter as new () => TypedEventEmitter<E2EEManagerCallbacks>)
  implements BaseE2EEManager
{
  private room?: Room;
  private frameCryptors = new Map<string, RTCFrameCryptor>();
  private keyProvider: RNKeyProvider;
  private algorithm = RTCFrameCryptorAlgorithm.kAesGcm;
  private encryptionEnabled = false;
  private dataChannelEncryptionEnabled: boolean;
  private readonly dcCryptorLock = new Mutex();
  private dcCryptor: Awaited<ReturnType<typeof RTCDataPacketCryptorFactory.createDataPacketCryptor>> | undefined;

  constructor(keyProvider: RNKeyProvider, dcEncryptionEnabled = false) {
    super();
    this.keyProvider = keyProvider;
    this.dataChannelEncryptionEnabled = dcEncryptionEnabled;
  }

  get isEnabled(): boolean { return this.encryptionEnabled; }
  get isDataChannelEncryptionEnabled(): boolean { return this.isEnabled && this.dataChannelEncryptionEnabled; }
  set isDataChannelEncryptionEnabled(v: boolean) { this.dataChannelEncryptionEnabled = v; }

  setup(room: Room): void {
    if (this.room !== room) { this.room = room; this._setupEventListeners(room); }
  }

  private _setupEventListeners(room: Room): void {
    room.localParticipant
      .on(ParticipantEvent.LocalTrackPublished, async (pub) => { await this._setupSender(pub, room.localParticipant); })
      .on(ParticipantEvent.LocalTrackUnpublished, async (pub) => {
        const c = this.frameCryptors.get(pub.trackSid);
        if (c) { this.frameCryptors.delete(pub.trackSid); await c.setEnabled(false); await c.dispose(); }
      });

    room
      .on(RoomEvent.TrackSubscribed, (_track, pub, participant) => { this._setupReceiver(pub, participant); })
      .on(RoomEvent.TrackUnsubscribed, async (_track, pub) => {
        const c = this.frameCryptors.get(pub.trackSid);
        if (c) { this.frameCryptors.delete(pub.trackSid); await c.setEnabled(false); await c.dispose(); }
      })
      .on(RoomEvent.SignalConnected, () => {
        if (!this.room) throw new TypeError('room missing on signal connect');
        this.setParticipantCryptorEnabled(this.room.localParticipant.isE2EEEnabled, this.room.localParticipant.identity);
      });
  }

  private async _setupSender(publication: LocalTrackPublication, participant: LocalParticipant): Promise<void> {
    if (!publication.isEncrypted || this.frameCryptors.has(publication.trackSid)) return;
    const sender = publication.track?.sender as RTCRtpSenderHandle | undefined;
    if (!sender) return;
    const cryptor = await RTCFrameCryptorFactory.createFrameCryptorForRtpSender(participant.identity, sender, this.algorithm, this.keyProvider.rtcKeyProvider);
    this.frameCryptors.set(publication.trackSid, cryptor);
    await cryptor.setEnabled(true);
    await cryptor.setKeyIndex(this.keyProvider.getLatestKeyIndex(participant.identity));
  }

  private async _setupReceiver(publication: RemoteTrackPublication, participant: RemoteParticipant): Promise<void> {
    if (!publication.isEncrypted || this.frameCryptors.has(publication.trackSid)) return;
    const receiver = publication.track?.receiver as RTCRtpReceiverHandle | undefined;
    if (!receiver) return;
    const cryptor = await RTCFrameCryptorFactory.createFrameCryptorForRtpReceiver(participant.identity, receiver, this.algorithm, this.keyProvider.rtcKeyProvider);
    this.frameCryptors.set(publication.trackSid, cryptor);
    await cryptor.setEnabled(true);
    await cryptor.setKeyIndex(this.keyProvider.getLatestKeyIndex(participant.identity));
  }

  setSifTrailer(trailer: Uint8Array): void { this.keyProvider.setSifTrailer(trailer); }

  private async _getDCCryptor() {
    if (this.dcCryptor) return this.dcCryptor;
    const unlock = await this.dcCryptorLock.lock();
    try {
      if (this.dcCryptor) return this.dcCryptor;
      this.dcCryptor = await RTCDataPacketCryptorFactory.createDataPacketCryptor(this.algorithm, this.keyProvider.rtcKeyProvider);
      return this.dcCryptor;
    } finally { unlock(); }
  }

  async encryptData(data: Uint8Array): Promise<EncryptDataResponseMessage['data']> {
    if (!this.room) throw new Error("E2EE manager isn't set up with a room");
    const identity = this.room.localParticipant.identity;
    const cryptor = await this._getDCCryptor();
    const packet = await cryptor.encrypt(identity, this.keyProvider.getLatestKeyIndex(identity), data);
    if (!packet) throw new Error('Encryption failed');
    return { uuid: '', payload: packet.payload, iv: packet.iv, keyIndex: packet.keyIndex };
  }

  async handleEncryptedData(payload: Uint8Array, iv: Uint8Array, participantIdentity: string, keyIndex: number): Promise<DecryptDataResponseMessage['data']> {
    const packet: RTCEncryptedPacket = { payload, iv, keyIndex };
    const cryptor = await this._getDCCryptor();
    const decrypted = await cryptor.decrypt(participantIdentity, packet);
    if (!decrypted) throw new Error('Decryption failed');
    return { uuid: '', payload: decrypted };
  }

  setupEngine(_engine: RTCEngine): void {}

  setParticipantCryptorEnabled(enabled: boolean, participantIdentity: string): void {
    if (this.encryptionEnabled !== enabled && participantIdentity === this.room?.localParticipant.identity) {
      this.encryptionEnabled = enabled;
      this.emit(EncryptionEvent.ParticipantEncryptionStatusChanged, enabled, this.room!.localParticipant);
    } else {
      const participant = this.room?.getParticipantByIdentity(participantIdentity);
      if (!participant) throw new TypeError(`Participant not found: ${participantIdentity}`);
      this.emit(EncryptionEvent.ParticipantEncryptionStatusChanged, enabled, participant);
    }
  }
}
