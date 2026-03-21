// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — getUserMedia.ts
// Polyfill for navigator.mediaDevices.getUserMedia and enumerateDevices.
// ─────────────────────────────────────────────────────────────────────────────

import { LynxWebRTCModule, promisify } from './NativeModule';
import { MediaStream } from './MediaStream';
import { MediaStreamTrack } from './MediaStreamTrack';

export interface MediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

export interface MediaTrackConstraints {
  deviceId?: ConstrainDOMString;
  facingMode?: ConstrainDOMString;
  width?: ConstrainULong;
  height?: ConstrainULong;
  frameRate?: ConstrainDouble;
  aspectRatio?: ConstrainDouble;
  channelCount?: ConstrainULong;
  sampleRate?: ConstrainULong;
  sampleSize?: ConstrainULong;
  echoCancellation?: ConstrainBoolean;
  noiseSuppression?: ConstrainBoolean;
  autoGainControl?: ConstrainBoolean;
}

type ConstrainDOMString = string | ConstrainDOMStringParameters;
type ConstrainULong = number | ConstrainULongRange;
type ConstrainDouble = number | ConstrainDoubleRange;
type ConstrainBoolean = boolean | ConstrainBooleanParameters;

interface ConstrainDOMStringParameters {
  exact?: string;
  ideal?: string;
}

interface ConstrainULongRange {
  min?: number;
  max?: number;
  exact?: number;
  ideal?: number;
}

interface ConstrainDoubleRange {
  min?: number;
  max?: number;
  exact?: number;
  ideal?: number;
}

interface ConstrainBooleanParameters {
  exact?: boolean;
  ideal?: boolean;
}

export interface MediaDeviceInfo {
  deviceId: string;
  groupId: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
  label: string;
}

interface NativeGetUserMediaResult {
  streamId: string;
  tracks: Array<{
    id: string;
    kind: 'audio' | 'video';
    label: string;
    settings: Record<string, unknown>;
  }>;
}

/**
 * Polyfill for `navigator.mediaDevices.getUserMedia()`.
 *
 * Returns a `MediaStream` populated with the requested tracks.
 */
export async function getUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  const resultJson = await promisify<string>((cb) =>
    LynxWebRTCModule.getUserMedia(JSON.stringify(constraints), cb),
  );

  const result = JSON.parse(resultJson) as NativeGetUserMediaResult;
  const stream = new MediaStream(result.streamId);

  for (const t of result.tracks) {
    stream.addTrack(
      new MediaStreamTrack({
        id: t.id,
        kind: t.kind,
        label: t.label,
        peerConnectionId: -1, // local / capture track
        settings: t.settings as Record<string, number | string | boolean>,
      }),
    );
  }

  return stream;
}

/**
 * Polyfill for `navigator.mediaDevices.enumerateDevices()`.
 */
export async function enumerateDevices(): Promise<MediaDeviceInfo[]> {
  const json = await promisify<string>((cb) =>
    LynxWebRTCModule.enumerateDevices(cb),
  );
  return JSON.parse(json) as MediaDeviceInfo[];
}

/**
 * Inject the standard `navigator.mediaDevices` API into the global scope.
 * Must be called once by `registerGlobals()`.
 */
export function injectMediaDevices(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = (globalThis as any).navigator ?? {};
  nav.mediaDevices = {
    getUserMedia: (constraints: MediaStreamConstraints) =>
      getUserMedia(constraints),
    enumerateDevices: () => enumerateDevices(),
    // Minimal shim for getSupportedConstraints
    getSupportedConstraints: () => ({
      deviceId: true,
      facingMode: true,
      width: true,
      height: true,
      frameRate: true,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).navigator = nav;
}
