/// <reference types="@lynx-js/types" />

// ── Permissive Callback type ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callback<E = string | null, R = any> = (error: E, result: R) => void;

// ── Lynx JSX elements ─────────────────────────────────────────────────────────
// Declared in global scope so tsc finds it regardless of jsxImportSource.
declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface IntrinsicElements { view: any; 'livekit-webrtc-view': any; [name: string]: any; }
  }

  // eslint-disable-next-line no-var
  var NativeModules: {
    LynxWebRTCModule: LynxWebRTCModuleSpec;
    LynxAudioModule: LynxAudioModuleSpec;
    LynxE2EEModule: LynxE2EEModuleSpec;
    LivekitLynxModule: LivekitLynxModuleSpec;
  };

  // eslint-disable-next-line no-var
  var SystemInfo: {
    readonly platform: 'ios' | 'android';
    readonly pixelRatio: number;
    readonly osVersion: string;
  };

  // lynx global object — available on the Lynx background thread
  // eslint-disable-next-line no-var
  var lynx: {
    getJSModule(name: 'GlobalEventEmitter'): {
      addListener(event: string, handler: (data: string) => void): void;
      removeListener(event: string, handler: (data: string) => void): void;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getJSModule(name: string): any;
    reload(): void;
  };
}

// ── Module specs — all have index signature so cast to Record<string,unknown> works ──

export interface LynxWebRTCModuleSpec {
  // Index signature required for Proxy pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  peerConnectionInit(configJson: string, pcId: number, callback: Callback): void;
  peerConnectionClose(pcId: number, callback: Callback): void;
  peerConnectionDispose(pcId: number, callback: Callback): void;
  peerConnectionCreateOffer(pcId: number, constraintsJson: string, callback: Callback): void;
  peerConnectionCreateAnswer(pcId: number, constraintsJson: string, callback: Callback): void;
  peerConnectionSetLocalDescription(pcId: number, sdpJson: string, callback: Callback): void;
  peerConnectionSetRemoteDescription(pcId: number, sdpJson: string, callback: Callback): void;
  peerConnectionAddICECandidate(pcId: number, candidateJson: string, callback: Callback): void;
  peerConnectionGetStats(pcId: number, callback: Callback): void;
  peerConnectionAddTrack(pcId: number, trackId: string, streamIds: string[], callback: Callback): void;
  peerConnectionRemoveTrack(pcId: number, senderId: string, callback: Callback): void;
  peerConnectionGetSenders(pcId: number, callback: Callback): void;
  peerConnectionGetReceivers(pcId: number, callback: Callback): void;
  peerConnectionGetTransceivers(pcId: number, callback: Callback): void;
  senderGetParameters(pcId: number, senderId: string, callback: Callback): void;
  senderSetParameters(pcId: number, senderId: string, paramsJson: string, callback: Callback): void;
  senderReplaceTrack(pcId: number, senderId: string, trackId: string | null, callback: Callback): void;
  transceiverSetDirection(pcId: number, transceiverId: string, direction: string, callback: Callback): void;
  transceiverStop(pcId: number, transceiverId: string, callback: Callback): void;
  createDataChannel(pcId: number, label: string, initJson: string, callback: Callback): void;
  dataChannelSend(pcId: number, channelId: number, data: string, isBinary: boolean, callback: Callback): void;
  dataChannelClose(pcId: number, channelId: number, callback: Callback): void;
  mediaStreamCreate(streamId: string, callback: Callback): void;
  mediaStreamRelease(streamId: string, callback: Callback): void;
  mediaStreamAddTrack(streamId: string, trackId: string, callback: Callback): void;
  mediaStreamRemoveTrack(streamId: string, trackId: string, callback: Callback): void;
  mediaStreamToURL(streamId: string, callback: Callback): void;
  getUserMedia(constraintsJson: string, callback: Callback): void;
  enumerateDevices(callback: Callback): void;
  switchCamera(trackId: string, callback: Callback): void;
  mediaTrackStop(trackId: string, callback: Callback): void;
  mediaTrackRelease(trackId: string, callback: Callback): void;
  mediaTrackSetEnabled(trackId: string, enabled: boolean, callback: Callback): void;
  // Aliases used in MediaStreamTrack.ts
  mediaStreamTrackSetEnabled(trackId: string, enabled: boolean, callback: Callback): void;
  mediaStreamTrackStop(trackId: string, callback: Callback): void;
  mediaStreamTrackRelease(trackId: string, callback: Callback): void;
}

export interface LynxAudioModuleSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  createVolumeProcessor(pcId: number, trackId: string, callback: Callback): void;
  deleteVolumeProcessor(processorId: string, pcId: number, trackId: string, callback: Callback): void;
  createMultibandVolumeProcessor(optsJson: string, pcId: number, trackId: string, callback: Callback): void;
  deleteMultibandVolumeProcessor(processorId: string, pcId: number, trackId: string, callback: Callback): void;
  createAudioSinkListener(pcId: number, trackId: string, callback: Callback): void;
  deleteAudioSinkListener(listenerId: string, pcId: number, trackId: string, callback: Callback): void;
  setDefaultAudioTrackVolume(volume: number, callback: Callback): void;
}

export interface LynxE2EEModuleSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  frameCryptorCreateForSender(pcId: number, senderId: string, participantId: string, algorithm: string, keyProviderTag: string, callback: Callback): void;
  frameCryptorCreateForReceiver(pcId: number, receiverId: string, participantId: string, algorithm: string, keyProviderTag: string, callback: Callback): void;
  frameCryptorSetEnabled(cryptorTag: string, enabled: boolean, callback: Callback): void;
  frameCryptorSetKeyIndex(cryptorTag: string, keyIndex: number, callback: Callback): void;
  frameCryptorDispose(cryptorTag: string, callback: Callback): void;
  keyProviderCreate(optionsJson: string, callback: Callback): void;
  keyProviderSetSharedKey(tag: string, keyBase64: string, keyIndex: number, callback: Callback): void;
  keyProviderSetKey(tag: string, participantId: string, keyBase64: string, keyIndex: number, callback: Callback): void;
  keyProviderRatchetSharedKey(tag: string, keyIndex: number, callback: Callback): void;
  keyProviderRatchetKey(tag: string, participantId: string, keyIndex: number, callback: Callback): void;
  keyProviderSetSifTrailer(tag: string, trailerBase64: string, callback: Callback): void;
  keyProviderDispose(tag: string, callback: Callback): void;
  dataPacketCryptorCreate(algorithm: string, keyProviderTag: string, callback: Callback): void;
  dataPacketCryptorEncrypt(cryptorTag: string, participantId: string, keyIndex: number, dataBase64: string, callback: Callback): void;
  dataPacketCryptorDecrypt(cryptorTag: string, participantId: string, packetJson: string, callback: Callback): void;
}

export interface LivekitLynxModuleSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  configureAudio(configJson: string, callback: Callback): void;
  startAudioSession(callback: Callback): void;
  stopAudioSession(callback: Callback): void;
  getAudioOutputs(callback: Callback): void;
  selectAudioOutput(deviceId: string, callback: Callback): void;
  showAudioRoutePicker(callback: Callback): void;
  setAppleAudioConfiguration(configJson: string, callback: Callback): void;
  setDefaultAudioTrackVolume(volume: number, callback: Callback): void;
}

// ── JSX module augmentation for @lynx-js/react + jsxImportSource ──────────────
// With jsx: "react-jsx" + jsxImportSource: "@lynx-js/react", TypeScript resolves
// IntrinsicElements from "@lynx-js/react/jsx-runtime" not from global namespace.
// Source: https://www.typescriptlang.org/docs/handbook/jsx.html
declare module '@lynx-js/react/jsx-runtime' {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface IntrinsicElements { view: any; 'livekit-webrtc-view': any; [name: string]: any; }
  }
}

declare module '@lynx-js/react/jsx-dev-runtime' {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface IntrinsicElements { view: any; 'livekit-webrtc-view': any; [name: string]: any; }
  }
}
