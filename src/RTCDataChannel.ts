// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — RTCDataChannel.ts
// Polyfill for the W3C RTCDataChannel API over Lynx NativeModules.
// ─────────────────────────────────────────────────────────────────────────────

import { LynxWebRTCModule } from './NativeModule';
import { addListener, removeListener } from './EventBus';

export interface RTCDataChannelInit {
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  protocol?: string;
  negotiated?: boolean;
  id?: number;
}

export type RTCDataChannelState =
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed';

export type RTCDataChannelMessageType = 'message';
export type RTCDataChannelBinaryType = 'blob' | 'arraybuffer';

/**
 * Polyfill for `RTCDataChannel`.
 * Bridges `LynxWebRTCModule` data channel operations to the W3C API.
 */
export class RTCDataChannel extends EventTarget {
  readonly label: string;
  readonly ordered: boolean;
  readonly maxRetransmitTime: number | null;
  readonly maxRetransmits: number | null;
  readonly protocol: string;
  readonly negotiated: boolean;
  readonly id: number | null;

  /** @internal pcId of the owning PeerConnection. */
  readonly _pcId: number;
  /** @internal Native channel ID (assigned after open). */
  readonly _channelId: number;

  private _readyState: RTCDataChannelState = 'connecting';
  private _bufferedAmount = 0;
  private _binaryType: RTCDataChannelBinaryType = 'arraybuffer';
  private _listenerToken = Object.create(null) as object;

  // W3C event handlers
  onopen: ((this: RTCDataChannel, ev: Event) => void) | null = null;
  onclose: ((this: RTCDataChannel, ev: Event) => void) | null = null;
  onerror: ((this: RTCDataChannel, ev: Event) => void) | null = null;
  onmessage:
    | ((this: RTCDataChannel, ev: MessageEvent) => void)
    | null = null;
  onbufferedamountlow:
    | ((this: RTCDataChannel, ev: Event) => void)
    | null = null;

  constructor(opts: {
    pcId: number;
    channelId: number;
    label: string;
    init?: RTCDataChannelInit;
  }) {
    super();
    this._pcId = opts.pcId;
    this._channelId = opts.channelId;
    this.label = opts.label;
    this.ordered = opts.init?.ordered ?? true;
    this.maxRetransmitTime = opts.init?.maxPacketLifeTime ?? null;
    this.maxRetransmits = opts.init?.maxRetransmits ?? null;
    this.protocol = opts.init?.protocol ?? '';
    this.negotiated = opts.init?.negotiated ?? false;
    this.id = opts.init?.id ?? null;

    this._subscribeToEvents();
  }

  // ── W3C getters ──────────────────────────────────────────────────────────

  get readyState(): RTCDataChannelState {
    return this._readyState;
  }

  get bufferedAmount(): number {
    return this._bufferedAmount;
  }

  get binaryType(): RTCDataChannelBinaryType {
    return this._binaryType;
  }

  set binaryType(value: RTCDataChannelBinaryType) {
    this._binaryType = value;
  }

  // ── W3C methods ──────────────────────────────────────────────────────────

  send(data: string | ArrayBuffer | ArrayBufferView): void {
    if (this._readyState !== 'open') {
      throw new DOMException(
        'RTCDataChannel.send() called on a non-open channel',
        'InvalidStateError',
      );
    }

    let encoded: string;
    let isBinary: boolean;

    if (typeof data === 'string') {
      encoded = data;
      isBinary = false;
    } else {
      const bytes =
        data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(
          (data as ArrayBufferView).buffer,
          (data as ArrayBufferView).byteOffset,
          (data as ArrayBufferView).byteLength,
        );
      encoded = btoa(String.fromCharCode(...bytes));
      isBinary = true;
    }

    LynxWebRTCModule.dataChannelSend(
      this._pcId,
      this._channelId,
      encoded,
      isBinary,
      (err) => {
        if (err) {
          this._emitError(err);
        }
      },
    );
  }

  close(): void {
    if (
      this._readyState === 'closing' ||
      this._readyState === 'closed'
    ) {
      return;
    }
    this._readyState = 'closing';
    LynxWebRTCModule.dataChannelClose(
      this._pcId,
      this._channelId,
      () => {},
    );
  }

  // ── Internal event handling ───────────────────────────────────────────────

  private _subscribeToEvents(): void {
    addListener(
      this._listenerToken,
      'LK_PC_EVENT',
      (raw: unknown) => {
        const event = raw as {
          type: string;
          pcId: number;
          channelId: number;
          [k: string]: unknown;
        };

        if (
          event.pcId !== this._pcId ||
          event.channelId !== this._channelId
        ) {
          return;
        }

        switch (event.type) {
          case 'dataChannelDidChangeState':
            this._handleStateChange(
              event.state as RTCDataChannelState,
            );
            break;
          case 'dataChannelDidReceiveMessage':
            this._handleMessage(
              event.data as string,
              event.isBinary as boolean,
            );
            break;
          case 'dataChannelBufferedAmountChanged':
            this._bufferedAmount = (event.amount as number) ?? 0;
            break;
        }
      },
    );
  }

  private _handleStateChange(state: RTCDataChannelState): void {
    this._readyState = state;
    if (state === 'open') {
      const ev = new Event('open');
      this.dispatchEvent(ev);
      this.onopen?.(ev);
    } else if (state === 'closed') {
      const ev = new Event('close');
      this.dispatchEvent(ev);
      this.onclose?.(ev);
      removeListener(this._listenerToken);
    }
  }

  private _handleMessage(data: string, isBinary: boolean): void {
    let payload: string | ArrayBuffer;
    if (isBinary) {
      const bytes = Uint8Array.from(atob(data), (c) =>
        c.charCodeAt(0),
      );
      payload = bytes.buffer;
    } else {
      payload = data;
    }
    const ev = new MessageEvent('message', { data: payload });
    this.dispatchEvent(ev);
    this.onmessage?.(ev);
  }

  private _emitError(message: string): void {
    const ev = new ErrorEvent('error', { message });
    this.dispatchEvent(ev);
    this.onerror?.(ev);
  }
}
