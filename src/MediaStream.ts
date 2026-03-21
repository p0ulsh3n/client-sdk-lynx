// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — MediaStream.ts
// Polyfill for the W3C MediaStream API over Lynx NativeModules.
// ─────────────────────────────────────────────────────────────────────────────

import { LynxWebRTCModule, promisify } from './NativeModule';
import { MediaStreamTrack } from './MediaStreamTrack';

/**
 * Polyfill for the W3C `MediaStream` interface.
 *
 * Wraps native stream primitives via `LynxWebRTCModule`.
 * The `toURL()` method returns a native opaque URI used by the
 * `<livekit-webrtc-view>` Custom Native Component for rendering.
 */
export class MediaStream extends EventTarget {
  readonly id: string;

  private _tracks = new Map<string, MediaStreamTrack>();
  private _url: string | null = null;

  onaddtrack:
    | ((this: MediaStream, ev: MediaStreamTrackEvent) => void)
    | null = null;
  onremovetrack:
    | ((this: MediaStream, ev: MediaStreamTrackEvent) => void)
    | null = null;

  constructor(id?: string, tracks?: MediaStreamTrack[]) {
    super();
    this.id = id ?? crypto.randomUUID();
    if (tracks) {
      for (const t of tracks) {
        this._tracks.set(t.id, t);
      }
    }
  }

  // ── W3C API ──────────────────────────────────────────────────────────────

  get active(): boolean {
    return this._tracks.size > 0;
  }

  getTracks(): MediaStreamTrack[] {
    return Array.from(this._tracks.values());
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.getTracks().filter((t) => t.kind === 'audio');
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.getTracks().filter((t) => t.kind === 'video');
  }

  getTrackById(id: string): MediaStreamTrack | undefined {
    return this._tracks.get(id);
  }

  addTrack(track: MediaStreamTrack): void {
    if (this._tracks.has(track.id)) return;
    this._tracks.set(track.id, track);
    this._url = null; // invalidate cached URL

    LynxWebRTCModule.mediaStreamAddTrack(this.id, track.id, () => {});

    const ev = new MediaStreamTrackEvent('addtrack', { track });
    this.dispatchEvent(ev);
    this.onaddtrack?.(ev);
  }

  removeTrack(track: MediaStreamTrack): void {
    if (!this._tracks.delete(track.id)) return;
    this._url = null;

    LynxWebRTCModule.mediaStreamRemoveTrack(this.id, track.id, () => {});

    const ev = new MediaStreamTrackEvent('removetrack', { track });
    this.dispatchEvent(ev);
    this.onremovetrack?.(ev);
  }

  clone(): MediaStream {
    return new MediaStream(
      crypto.randomUUID(),
      this.getTracks().map((t) => t.clone()),
    );
  }

  // ── Lynx-specific ─────────────────────────────────────────────────────────

  /**
   * Returns a native opaque URI that can be passed to
   * `<livekit-webrtc-view streamURL={...} />` for video rendering.
   *
   * The URL is stable for a given stream — cached after the first call.
   */
  toURL(): string {
    if (this._url) return this._url;
    // Synchronous fallback — native module caches this on first render.
    // For async init, use `toURLAsync()`.
    this._url = `livekit-stream://${this.id}`;
    return this._url;
  }

  async toURLAsync(): Promise<string> {
    if (this._url) return this._url;
    const url = await promisify<string>((cb) =>
      LynxWebRTCModule.mediaStreamToURL(this.id, cb),
    );
    this._url = url;
    return url;
  }

  /** @internal Register the stream in the native layer. */
  async _init(): Promise<void> {
    await promisify<null>((cb) =>
      LynxWebRTCModule.mediaStreamCreate(this.id, cb),
    );
  }

  /** @internal Release the stream in the native layer. */
  release(): void {
    LynxWebRTCModule.mediaStreamRelease(this.id, () => {});
    for (const track of this._tracks.values()) {
      track._release();
    }
    this._tracks.clear();
  }

  toJSON(): object {
    return {
      id: this.id,
      tracks: this.getTracks().map((t) => t.toJSON()),
    };
  }
}

// ─── MediaStreamTrackEvent shim (not in all Lynx JS envs) ────────────────────
if (typeof MediaStreamTrackEvent === 'undefined') {
  // Minimal shim so the constructor above compiles.
  // @ts-expect-error: global augmentation
  globalThis.MediaStreamTrackEvent = class MediaStreamTrackEventShim extends Event {
    readonly track: MediaStreamTrack;
    constructor(type: string, init: { track: MediaStreamTrack }) {
      super(type);
      this.track = init.track;
    }
  };
}
