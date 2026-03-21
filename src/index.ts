// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/index.ts
// Single entry point. Call registerGlobals() ONCE before any LiveKit code.
// ─────────────────────────────────────────────────────────────────────────────

import 'well-known-symbols/Symbol.asyncIterator/auto';
import 'well-known-symbols/Symbol.iterator/auto';
import './polyfills/MediaRecorderShim';

import type { LiveKitReactNativeInfo } from 'livekit-client';
import { RTCPeerConnection } from './RTCPeerConnection';
import { RTCSessionDescription, RTCIceCandidate } from './RTCSessionDescription';
import { MediaStream } from './MediaStream';
import { MediaStreamTrack } from './MediaStreamTrack';
import { RTCDataChannel } from './RTCDataChannel';
import { getUserMedia, enumerateDevices, type MediaStreamConstraints } from './getUserMedia';

// ─────────────────────────────────────────────────────────────────────────────
// registerGlobals
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterGlobalsOptions {
  autoConfigureAudioSession?: boolean;
}

export function registerGlobals(options: RegisterGlobalsOptions = {}): void {
  const { autoConfigureAudioSession = true } = options;

  _injectWebRTCGlobals();
  _injectMediaDevices(autoConfigureAudioSession);
  _injectLiveKitPlatformGlobal();
  _shimCryptoUUID();
  _shimWebStreams();
  _shimPromiseAllSettled();
  _shimArrayAt();
}

function _injectWebRTCGlobals(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  g.RTCPeerConnection     ??= RTCPeerConnection;
  g.RTCSessionDescription ??= RTCSessionDescription;
  g.RTCIceCandidate       ??= RTCIceCandidate;
  g.MediaStream           ??= MediaStream;
  g.MediaStreamTrack      ??= MediaStreamTrack;
  g.RTCDataChannel        ??= RTCDataChannel;
}

function _injectMediaDevices(autoConfigureAudio: boolean): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = (globalThis as any).navigator ?? {};
  nav.mediaDevices = {
    getUserMedia: async (constraints: MediaStreamConstraints) => {
      if (autoConfigureAudio && constraints.audio && SystemInfo?.platform === 'ios') {
        try {
          await new Promise<void>((resolve, reject) =>
            NativeModules.LivekitLynxModule.setAppleAudioConfiguration(
              JSON.stringify({ audioCategory: 'playAndRecord' }),
              (err: string | null) => { if (err) reject(new Error(err)); else resolve(); },
            ),
          );
        } catch { /* non-fatal */ }
      }
      return getUserMedia(constraints);
    },
    enumerateDevices,
    getSupportedConstraints: () => ({
      deviceId: true, facingMode: true, width: true, height: true,
      frameRate: true, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).navigator = nav;
}

function _injectLiveKitPlatformGlobal(): void {
  const info: LiveKitReactNativeInfo = {
    platform: SystemInfo?.platform ?? 'unknown',
    devicePixelRatio: SystemInfo?.pixelRatio ?? 2,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).LiveKitReactNativeGlobal = info;
}

function _shimCryptoUUID(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (typeof g.crypto === 'undefined') g.crypto = {} as Crypto;
  if (typeof g.crypto.randomUUID !== 'function') {
    g.crypto.randomUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
  }
}

function _shimWebStreams(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (typeof g.WritableStream === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { WritableStream, ReadableStream } = require('web-streams-polyfill') as typeof import('web-streams-polyfill');
      g.WritableStream ??= WritableStream;
      g.ReadableStream ??= ReadableStream;
    } catch { /* optional */ }
  }
}

function _shimPromiseAllSettled(): void {
  if (typeof Promise.allSettled === 'function') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('promise.allsettled') as { shim: () => void }).shim();
}

function _shimArrayAt(): void {
  if (typeof Array.prototype.at === 'function') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('array.prototype.at') as { shim: () => void }).shim();
}

// ─────────────────────────────────────────────────────────────────────────────
// WebRTC polyfill exports
// ─────────────────────────────────────────────────────────────────────────────

export { RTCPeerConnection }                   from './RTCPeerConnection';
export { RTCSessionDescription, RTCIceCandidate } from './RTCSessionDescription';
export { MediaStream }                         from './MediaStream';
export { MediaStreamTrack }                    from './MediaStreamTrack';
export { RTCDataChannel }                      from './RTCDataChannel';
export { getUserMedia, enumerateDevices }      from './getUserMedia';
export { RTCFrameCryptorFactory, RTCDataPacketCryptorFactory } from './e2ee/RTCFrameCryptorFactory';
export { RTCFrameCryptorAlgorithm }            from './e2ee/types';
export { addListener, removeListener }         from './EventBus';
export { LynxWebRTCModule, LynxAudioModule, LynxE2EEModule, LivekitLynxModule } from './NativeModule';

export type {
  RTCConfiguration, RTCIceServer, RTCOfferOptions, RTCAnswerOptions,
  RTCRtpSender, RTCRtpReceiver, RTCRtpTransceiver, RTCStatsReport,
} from './RTCPeerConnection';
export type { TrackKind, MediaStreamTrackSettings } from './MediaStreamTrack';
export type { MediaStreamConstraints, MediaDeviceInfo } from './getUserMedia';
export type { RTCFrameCryptor, RTCKeyProvider, RTCKeyProviderOptions, RTCEncryptedPacket } from './e2ee/types';

// ─────────────────────────────────────────────────────────────────────────────
// SDK high-level exports
// ─────────────────────────────────────────────────────────────────────────────

export * from './hooks';
export * from './components/BarVisualizer';
export * from './components/LiveKitRoom';
export * from './components/VideoTrack';
export * from './components/VideoView';
export * from './useParticipant';
export * from './useRoom';
export * from './logger';
export * from './audio/AudioManager';

export {
  default as AudioSession,
  AndroidAudioTypePresets,
  getDefaultAppleAudioConfigurationForMode,
} from './audio/AudioSession';

export { default as LynxE2EEManager } from './e2ee/LynxE2EEManager';
export { default as RNKeyProvider }   from './e2ee/RNKeyProvider';

export type {
  AudioConfiguration, AppleAudioCategory, AppleAudioCategoryOption,
  AppleAudioConfiguration, AppleAudioMode, AudioTrackState, AndroidAudioTypeOptions,
} from './audio/AudioSession';
export type { LogLevel, SetLogLevelOptions }   from './logger';
export type { RNKeyProviderOptions }           from './e2ee/RNKeyProvider';
