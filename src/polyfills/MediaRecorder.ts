import type { MediaStream } from '../MediaStream';
import { addListener, removeListener } from '../EventBus';
import { LynxAudioModule } from '../NativeModule';
import { log } from '../logger';

type MediaRecorderState = 'inactive' | 'recording' | 'paused';

export class MediaRecorder extends EventTarget {
  readonly mimeType = 'audio/pcm';
  audioBitsPerSecond = 0;
  videoBitsPerSecond = 0;
  audioBitrateMode = 'constant';
  state: MediaRecorderState = 'inactive';
  readonly stream: MediaStream;

  private _reactTag: string | undefined;
  private _parts: string[] = [];
  private _listenerToken = Object.create(null) as object;

  ondataavailable: ((ev: DataEvent) => void) | null = null;
  onerror:  ((ev: Event) => void) | null = null;
  onpause:  ((ev: Event) => void) | null = null;
  onresume: ((ev: Event) => void) | null = null;
  onstart:  ((ev: Event) => void) | null = null;
  onstop:   ((ev: Event) => void) | null = null;

  constructor(stream: MediaStream) { super(); this.stream = stream; }

  start(): void {
    this._registerListener();
    this.state = 'recording';
    const ev = new Event('start'); this.dispatchEvent(ev); this.onstart?.(ev);
  }

  stop(): void {
    this._dispatchData();
    this._unregisterListener();
    this.state = 'inactive';
    const ev = new Event('stop'); this.dispatchEvent(ev); this.onstop?.(ev);
  }

  pause(): void {
    this.state = 'paused';
    const ev = new Event('pause'); this.dispatchEvent(ev); this.onpause?.(ev);
  }

  resume(): void {
    this.state = 'recording';
    const ev = new Event('resume'); this.dispatchEvent(ev); this.onresume?.(ev);
  }

  requestData(): void { this._dispatchData(); }

  private _registerListener(): void {
    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length !== 1) return;
    const track = audioTracks[0]!;
    const pcId = track._peerConnectionId ?? -1;
    const trackId = track.id;

    LynxAudioModule.createAudioSinkListener(pcId, trackId, (err, tag) => {
      if (err || !tag) return;
      this._reactTag = tag;
      addListener(this._listenerToken, 'LK_AUDIO_DATA', (event: unknown) => {
        const ev = event as { id?: string; data?: string };
        if (ev.id === this._reactTag && this.state === 'recording' && ev.data)
          this._parts.push(ev.data);
      });
    });
  }

  private _unregisterListener(): void {
    removeListener(this._listenerToken);
    if (!this._reactTag) return;
    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length !== 1) { log.error('[MediaRecorder] no audio track'); return; }
    const track = audioTracks[0]!;
    LynxAudioModule.deleteAudioSinkListener(this._reactTag, track._peerConnectionId ?? -1, track.id, () => {});
    this._reactTag = undefined;
  }

  private _dispatchData(): void {
    const combined = this._parts.join('');
    this._parts = [];
    const bytes = Uint8Array.from(atob(combined), (c) => c.charCodeAt(0));
    const ev = new DataEvent('dataavailable', { data: { byteArray: bytes } });
    this.dispatchEvent(ev); this.ondataavailable?.(ev);
  }
}

export class DataEvent extends Event {
  readonly data: { byteArray: Uint8Array };
  constructor(type: string, init: { data: { byteArray: Uint8Array } }) {
    super(type); this.data = init.data;
  }
}
