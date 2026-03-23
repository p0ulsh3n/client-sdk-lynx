import { LynxWebRTCModule, promisify } from './NativeModule';

export type TrackKind = 'audio' | 'video';

export interface MediaStreamTrackSettings {
  deviceId?: string;
  groupId?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: string;
  aspectRatio?: number;
  channelCount?: number;
  sampleRate?: number;
  sampleSize?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface MediaStreamTrackConstraints {
  deviceId?: string;
  facingMode?: 'user' | 'environment';
  width?: number | { min?: number; max?: number; ideal?: number };
  height?: number | { min?: number; max?: number; ideal?: number };
  frameRate?: number | { min?: number; max?: number; ideal?: number };
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

/**
 * Polyfill for the W3C `MediaStreamTrack` interface.
 *
 * Wraps native WebRTC track primitives via `LynxWebRTCModule`.
 *
 * Extra properties added for Lynx audio processing:
 * - `_peerConnectionId`  — the pcId of the peer connection owning this track
 *                          (-1 for local/capture tracks)
 */
export class MediaStreamTrack extends EventTarget {
  readonly id: string;
  readonly kind: TrackKind;
  readonly label: string;

  /**
   * The pcId of the PeerConnection that owns this track.
   * -1 for local (capture) tracks.
   * Used by `useTrackVolume` / `useMultibandTrackVolume` to attach audio sinks.
   */
  readonly _peerConnectionId: number;

  private _enabled: boolean;
  private _muted: boolean;
  private _readyState: 'live' | 'ended';
  private _settings: MediaStreamTrackSettings;

  // ── Event handler shorthands (W3C) ───────────────────────────────────────
  onmute: ((this: MediaStreamTrack, ev: Event) => void) | null = null;
  onunmute: ((this: MediaStreamTrack, ev: Event) => void) | null = null;
  onended: ((this: MediaStreamTrack, ev: Event) => void) | null = null;

  // ── lib.dom.d.ts stubs (TS 5.5+ WebRTC 2025) ──────────────────────────────
  contentHint = '';
  getCapabilities(): MediaTrackCapabilities { return {}; }

  constructor(opts: {
    id: string;
    kind: TrackKind;
    label?: string;
    peerConnectionId?: number;
    enabled?: boolean;
    muted?: boolean;
    settings?: MediaStreamTrackSettings;
  }) {
    super();
    this.id = opts.id;
    this.kind = opts.kind;
    this.label = opts.label ?? opts.id;
    this._peerConnectionId = opts.peerConnectionId ?? -1;
    this._enabled = opts.enabled ?? true;
    this._muted = opts.muted ?? false;
    this._readyState = 'live';
    this._settings = opts.settings ?? {};
  }

  // ── W3C getters ──────────────────────────────────────────────────────────

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._readyState === 'ended') return;
    this._enabled = value;
    LynxWebRTCModule.mediaStreamTrackSetEnabled(
      this.id,
      value,
      () => {},
    );
  }

  get muted(): boolean {
    return this._muted;
  }

  get readyState(): 'live' | 'ended' {
    return this._readyState;
  }

  // ── W3C methods ──────────────────────────────────────────────────────────

  getSettings(): MediaStreamTrackSettings {
    return { ...this._settings };
  }

  getConstraints(): MediaStreamTrackConstraints {
    return {};
  }

  async applyConstraints(
    _constraints?: MediaStreamTrackConstraints,
  ): Promise<void> {
    // Not implemented in native — no-op.
  }

  clone(): MediaStreamTrack {
    return new MediaStreamTrack({
      id: this.id,
      kind: this.kind,
      label: this.label,
      peerConnectionId: this._peerConnectionId,
      enabled: this._enabled,
      muted: this._muted,
      settings: this._settings,
    });
  }

  stop(): void {
    if (this._readyState === 'ended') return;
    this._readyState = 'ended';
    LynxWebRTCModule.mediaStreamTrackStop(this.id, () => {});
    this.dispatchEvent(new Event('ended'));
    this.onended?.(new Event('ended'));
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /** @internal Called by the event bus when the native track mutes/unmutes. */
  _setMuted(muted: boolean): void {
    if (this._muted === muted) return;
    this._muted = muted;
    const type = muted ? 'mute' : 'unmute';
    const ev = new Event(type);
    this.dispatchEvent(ev);
    if (muted) this.onmute?.(ev);
    else this.onunmute?.(ev);
  }

  /** @internal Release native resources without calling stop(). */
  _release(): void {
    this._readyState = 'ended';
    LynxWebRTCModule.mediaStreamTrackRelease(this.id, () => {});
  }

  toJSON(): object {
    return {
      id: this.id,
      kind: this.kind,
      label: this.label,
      enabled: this._enabled,
      muted: this._muted,
      readyState: this._readyState,
    };
  }
}
