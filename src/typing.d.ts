// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — typing.d.ts
// Global NativeModules declarations for the Lynx runtime.
// Drop this file into src/ of your Lynx project.
// ─────────────────────────────────────────────────────────────────────────────

/// <reference types="@lynx-js/types" />

declare global {
  /**
   * Lynx injects `NativeModules` as a global object in the background thread.
   * Each key is a registered native module name.
   */
  // eslint-disable-next-line no-var
  var NativeModules: {
    LynxWebRTCModule: LynxWebRTCModuleSpec;
    LynxAudioModule: LynxAudioModuleSpec;
    LynxE2EEModule: LynxE2EEModuleSpec;
    LivekitLynxModule: LivekitLynxModuleSpec;
  };

  /**
   * Lynx GlobalEventEmitter — the official Lynx global for receiving events
   * sent by native modules via `LynxContext.sendGlobalEvent(name, data)`.
   *
   * Source: https://lynxjs.org/api/lynx-native-api/lynx-context/send-global-event
   *
   * Usage in ReactLynx JS:
   *   GlobalEventEmitter.addListener('MY_EVENT', handler);
   *   GlobalEventEmitter.removeListener('MY_EVENT', handler);
   */
  // eslint-disable-next-line no-var
  var GlobalEventEmitter: {
    addListener(event: string, handler: (data: string) => void): void;
    removeListener(event: string, handler: (data: string) => void): void;
  };

  /** Lynx system information injected by the runtime. */
  // eslint-disable-next-line no-var
  var SystemInfo: {
    readonly platform: 'ios' | 'android';
    readonly pixelRatio: number;
    readonly osVersion: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxWebRTCModule — RTCPeerConnection, MediaStream, getUserMedia bridge
// ─────────────────────────────────────────────────────────────────────────────

type Callback<E = string | null, R = string | null> = (
  error: E,
  result: R,
) => void;

interface LynxWebRTCModuleSpec {
  // ── PeerConnection lifecycle ──────────────────────────────────────────────
  peerConnectionInit(
    configJson: string,
    pcId: number,
    callback: Callback,
  ): void;
  peerConnectionClose(pcId: number, callback: Callback): void;
  peerConnectionDispose(pcId: number, callback: Callback): void;

  // ── SDP ───────────────────────────────────────────────────────────────────
  peerConnectionCreateOffer(
    pcId: number,
    constraintsJson: string,
    callback: Callback,
  ): void;
  peerConnectionCreateAnswer(
    pcId: number,
    constraintsJson: string,
    callback: Callback,
  ): void;
  peerConnectionSetLocalDescription(
    pcId: number,
    sdpJson: string,
    callback: Callback,
  ): void;
  peerConnectionSetRemoteDescription(
    pcId: number,
    sdpJson: string,
    callback: Callback,
  ): void;

  // ── ICE ───────────────────────────────────────────────────────────────────
  peerConnectionAddICECandidate(
    pcId: number,
    candidateJson: string,
    callback: Callback,
  ): void;

  // ── Tracks / Senders ──────────────────────────────────────────────────────
  peerConnectionAddTrack(
    pcId: number,
    trackId: string,
    streamIdsJson: string,
    callback: Callback<string | null, string | null>,
  ): void;
  peerConnectionRemoveTrack(
    pcId: number,
    senderId: string,
    callback: Callback,
  ): void;
  peerConnectionGetSenders(
    pcId: number,
    callback: Callback<string | null, string | null>,
  ): void;
  peerConnectionGetReceivers(
    pcId: number,
    callback: Callback<string | null, string | null>,
  ): void;
  peerConnectionGetTransceivers(
    pcId: number,
    callback: Callback<string | null, string | null>,
  ): void;

  // ── DataChannel ───────────────────────────────────────────────────────────
  createDataChannel(
    pcId: number,
    label: string,
    configJson: string,
    callback: Callback,
  ): void;
  dataChannelSend(
    pcId: number,
    channelId: number,
    data: string,
    isBinary: boolean,
    callback: Callback,
  ): void;
  dataChannelClose(
    pcId: number,
    channelId: number,
    callback: Callback,
  ): void;

  // ── Stats ─────────────────────────────────────────────────────────────────
  peerConnectionGetStats(
    pcId: number,
    trackId: string | null,
    callback: Callback<string | null, string | null>,
  ): void;

  // ── MediaStream ───────────────────────────────────────────────────────────
  mediaStreamCreate(
    streamId: string,
    callback: Callback,
  ): void;
  mediaStreamRelease(streamId: string, callback: Callback): void;
  mediaStreamAddTrack(
    streamId: string,
    trackId: string,
    callback: Callback,
  ): void;
  mediaStreamRemoveTrack(
    streamId: string,
    trackId: string,
    callback: Callback,
  ): void;
  mediaStreamToURL(
    streamId: string,
    callback: Callback<string | null, string | null>,
  ): void;

  // ── MediaStreamTrack ──────────────────────────────────────────────────────
  mediaStreamTrackSetEnabled(
    trackId: string,
    enabled: boolean,
    callback: Callback,
  ): void;
  mediaStreamTrackStop(trackId: string, callback: Callback): void;
  mediaStreamTrackRelease(trackId: string, callback: Callback): void;

  // ── getUserMedia / enumerateDevices ───────────────────────────────────────
  getUserMedia(
    constraintsJson: string,
    callback: Callback<string | null, string | null>,
  ): void;
  enumerateDevices(
    callback: Callback<string | null, string | null>,
  ): void;

  // ── Sender parameters ─────────────────────────────────────────────────────
  senderGetParameters(
    pcId: number,
    senderId: string,
    callback: Callback<string | null, string | null>,
  ): void;
  senderSetParameters(
    pcId: number,
    senderId: string,
    parametersJson: string,
    callback: Callback,
  ): void;
  senderReplaceTrack(
    pcId: number,
    senderId: string,
    trackId: string | null,
    callback: Callback,
  ): void;

  // ── Transceiver ───────────────────────────────────────────────────────────
  transceiverSetDirection(
    pcId: number,
    transceiverId: string,
    direction: string,
    callback: Callback,
  ): void;
  transceiverStop(
    pcId: number,
    transceiverId: string,
    callback: Callback,
  ): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxAudioModule — Audio rendering / volume processing bridge
// ─────────────────────────────────────────────────────────────────────────────

interface LynxAudioModuleSpec {
  createVolumeProcessor(
    pcId: number,
    trackId: string,
    callback: Callback<string | null, string | null>,
  ): void;
  deleteVolumeProcessor(
    reactTag: string,
    pcId: number,
    trackId: string,
    callback: Callback,
  ): void;

  createMultibandVolumeProcessor(
    optionsJson: string,
    pcId: number,
    trackId: string,
    callback: Callback<string | null, string | null>,
  ): void;
  deleteMultibandVolumeProcessor(
    reactTag: string,
    pcId: number,
    trackId: string,
    callback: Callback,
  ): void;

  createAudioSinkListener(
    pcId: number,
    trackId: string,
    callback: Callback<string | null, string | null>,
  ): void;
  deleteAudioSinkListener(
    reactTag: string,
    pcId: number,
    trackId: string,
    callback: Callback,
  ): void;

  setDefaultAudioTrackVolume(volume: number, callback: Callback): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxE2EEModule — Frame cryptors / key providers
// ─────────────────────────────────────────────────────────────────────────────

interface LynxE2EEModuleSpec {
  frameCryptorCreateForSender(
    pcId: number,
    senderId: string,
    participantId: string,
    algorithm: string,
    keyProviderTag: string,
    callback: Callback<string | null, string | null>,
  ): void;
  frameCryptorCreateForReceiver(
    pcId: number,
    receiverId: string,
    participantId: string,
    algorithm: string,
    keyProviderTag: string,
    callback: Callback<string | null, string | null>,
  ): void;
  frameCryptorSetEnabled(
    cryptorTag: string,
    enabled: boolean,
    callback: Callback,
  ): void;
  frameCryptorSetKeyIndex(
    cryptorTag: string,
    keyIndex: number,
    callback: Callback,
  ): void;
  frameCryptorDispose(cryptorTag: string, callback: Callback): void;

  keyProviderCreate(
    optionsJson: string,
    callback: Callback<string | null, string | null>,
  ): void;
  keyProviderSetSharedKey(
    tag: string,
    keyBase64: string,
    keyIndex: number,
    callback: Callback,
  ): void;
  keyProviderSetKey(
    tag: string,
    participantId: string,
    keyBase64: string,
    keyIndex: number,
    callback: Callback,
  ): void;
  keyProviderRatchetSharedKey(
    tag: string,
    keyIndex: number,
    callback: Callback,
  ): void;
  keyProviderRatchetKey(
    tag: string,
    participantId: string,
    keyIndex: number,
    callback: Callback,
  ): void;
  keyProviderSetSifTrailer(
    tag: string,
    trailerBase64: string,
    callback: Callback,
  ): void;
  keyProviderDispose(tag: string, callback: Callback): void;

  dataPacketCryptorCreate(
    algorithm: string,
    keyProviderTag: string,
    callback: Callback<string | null, string | null>,
  ): void;
  dataPacketCryptorEncrypt(
    cryptorTag: string,
    participantId: string,
    keyIndex: number,
    dataBase64: string,
    callback: Callback<string | null, string | null>,
  ): void;
  dataPacketCryptorDecrypt(
    cryptorTag: string,
    participantId: string,
    packetJson: string,
    callback: Callback<string | null, string | null>,
  ): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// LivekitLynxModule — AudioSession + livekit setup
// ─────────────────────────────────────────────────────────────────────────────

interface LivekitLynxModuleSpec {
  configureAudio(configJson: string, callback: Callback): void;
  startAudioSession(callback: Callback): void;
  stopAudioSession(callback: Callback): void;
  getAudioOutputs(
    callback: Callback<string | null, string | null>,
  ): void;
  selectAudioOutput(deviceId: string, callback: Callback): void;
  showAudioRoutePicker(callback: Callback): void;
  setAppleAudioConfiguration(configJson: string, callback: Callback): void;
  setDefaultAudioTrackVolume(volume: number, callback: Callback): void;
}

export {};
