import { LynxWebRTCModule, promisify } from './NativeModule';
import { MediaStream } from './MediaStream';
import { MediaStreamTrack } from './MediaStreamTrack';
import { RTCSessionDescription, RTCSdpType } from './RTCSessionDescription';
import { RTCIceCandidate } from './RTCSessionDescription';
import {
  RTCDataChannel,
  RTCDataChannelInit,
} from './RTCDataChannel';
import { addListener, removeListener } from './EventBus';

// ── Global PC id counter (thread-local in Lynx background thread) ─────────
let _nextPcId = 1;
function allocPcId(): number {
  return _nextPcId++;
}

// ── Types ─────────────────────────────────────────────────────────────────

export type RTCSignalingState =
  | 'stable'
  | 'have-local-offer'
  | 'have-remote-offer'
  | 'have-local-pranswer'
  | 'have-remote-pranswer'
  | 'closed';

export type RTCIceConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'disconnected'
  | 'closed';

export type RTCIceGatheringState = 'new' | 'gathering' | 'complete';

export type RTCPeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface RTCConfiguration {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: 'relay' | 'all';
  bundlePolicy?: 'balanced' | 'max-compat' | 'max-bundle';
  rtcpMuxPolicy?: 'require';
  iceCandidatePoolSize?: number;
  sdpSemantics?: 'unified-plan' | 'plan-b';
  encodedInsertableStreams?: boolean;
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RTCOfferOptions {
  iceRestart?: boolean;
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  voiceActivityDetection?: boolean;
}

export interface RTCAnswerOptions {
  voiceActivityDetection?: boolean;
}

export interface RTCRtpSender {
  readonly track: MediaStreamTrack | null;
  readonly senderId: string;
  getParameters(): Promise<RTCRtpSendParameters>;
  setParameters(params: RTCRtpSendParameters): Promise<void>;
  replaceTrack(track: MediaStreamTrack | null): Promise<void>;
  getStats(): Promise<RTCStatsReport>;
}

// ── Full compatibility lib.dom.d.ts (TS 5.5+ WebRTC 2025) ─────────────────────
export interface RTCRtpReceiver {
  readonly track: MediaStreamTrack;
  readonly receiverId: string;
  jitterBufferTarget: number | null;
  transform: RTCRtpTransform | null;
  transport: RTCDtlsTransport | null;
  getParameters(): RTCRtpReceiveParameters;
  getStats(): Promise<RTCStatsReport>;
  getContributingSources(): RTCRtpContributingSource[];
  getSynchronizationSources(): RTCRtpSynchronizationSource[];
}

export interface RTCRtpTransceiver {
  readonly transceiverId: string;
  readonly sender: RTCRtpSender;
  readonly receiver: RTCRtpReceiver;
  direction: RTCRtpTransceiverDirection;
  readonly currentDirection: RTCRtpTransceiverDirection | null;
  readonly stopped: boolean;
  readonly mid: string | null;
  stop(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCodecPreferences(codecs: any[]): void;
}

export type RTCRtpTransceiverDirection =
  | 'sendrecv'
  | 'sendonly'
  | 'recvonly'
  | 'inactive'
  | 'stopped';

export interface RTCRtpSendParameters {
  encodings?: RTCRtpEncodingParameters[];
  headerExtensions?: RTCRtpHeaderExtensionParameters[];
  rtcp?: RTCRtcpParameters;
  codecs?: RTCRtpCodecParameters[];
  transactionId?: string;
  degradationPreference?: string;
}

export interface RTCRtpReceiveParameters {
  headerExtensions?: RTCRtpHeaderExtensionParameters[];
  rtcp?: RTCRtcpParameters;
  codecs?: RTCRtpCodecParameters[];
}

export interface RTCRtpEncodingParameters {
  rid?: string;
  active?: boolean;
  maxBitrate?: number;
  minBitrate?: number;
  maxFramerate?: number;
  scaleResolutionDownBy?: number;
  scalabilityMode?: string;
  networkPriority?: 'very-low' | 'low' | 'medium' | 'high';
  priority?: 'very-low' | 'low' | 'medium' | 'high';
}

export interface RTCRtpHeaderExtensionParameters {
  uri: string;
  id: number;
  encrypted?: boolean;
}

export interface RTCRtcpParameters {
  cname?: string;
  reducedSize?: boolean;
}

export interface RTCRtpCodecParameters {
  payloadType: number;
  mimeType: string;
  clockRate: number;
  channels?: number;
  sdpFmtpLine?: string;
}

export type RTCStatsReport = Map<string, RTCStats>;

export interface RTCStats {
  id: string;
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

// ── Internal serialized shapes coming from native ─────────────────────────

interface NativeSenderJson {
  senderId: string;
  trackId: string | null;
  kind: 'audio' | 'video';
  streamIds: string[];
}

interface NativeReceiverJson {
  receiverId: string;
  trackId: string;
  kind: 'audio' | 'video';
  streamIds: string[];
}

interface NativeTransceiverJson {
  transceiverId: string;
  sender: NativeSenderJson;
  receiver: NativeReceiverJson;
  direction: RTCRtpTransceiverDirection;
  currentDirection: RTCRtpTransceiverDirection | null;
  stopped: boolean;
  mid: string | null;
}

// ── RTCRtpSender implementation ───────────────────────────────────────────

class LynxRtpSender implements RTCRtpSender {
  readonly senderId: string;
  track: MediaStreamTrack | null;
  private readonly _pcId: number;

  constructor(pcId: number, json: NativeSenderJson, track: MediaStreamTrack | null) {
    this._pcId = pcId;
    this.senderId = json.senderId;
    this.track = track;
  }

  async getParameters(): Promise<RTCRtpSendParameters> {
    const json = await promisify<string>((cb) =>
      LynxWebRTCModule.senderGetParameters(this._pcId, this.senderId, cb),
    );
    return JSON.parse(json) as RTCRtpSendParameters;
  }

  async setParameters(params: RTCRtpSendParameters): Promise<void> {
    await promisify<null>((cb) =>
      LynxWebRTCModule.senderSetParameters(
        this._pcId,
        this.senderId,
        JSON.stringify(params),
        cb,
      ),
    );
  }

  async replaceTrack(track: MediaStreamTrack | null): Promise<void> {
    await promisify<null>((cb) =>
      LynxWebRTCModule.senderReplaceTrack(
        this._pcId,
        this.senderId,
        track?.id ?? null,
        cb,
      ),
    );
    this.track = track;
  }

  async getStats(): Promise<RTCStatsReport> {
    const json = await promisify<string>((cb) =>
      LynxWebRTCModule.peerConnectionGetStats(
        this._pcId,
        cb,
      ),
    );
    return parseStatsReport(JSON.parse(json) as object[]);
  }
}

// ── RTCRtpReceiver implementation ─────────────────────────────────────────

class LynxRtpReceiver implements RTCRtpReceiver {
  readonly receiverId: string;
  readonly track: MediaStreamTrack;
  private readonly _pcId: number;
  // ── RTCRtpReceiver stubs required by lib.dom.d.ts (TS 5.5+) ─────────────
  jitterBufferTarget: number | null = null;
  transform: RTCRtpTransform | null = null;
  transport: RTCDtlsTransport | null = null;
  getContributingSources(): RTCRtpContributingSource[] { return []; }
  getSynchronizationSources(): RTCRtpSynchronizationSource[] { return []; }

  constructor(pcId: number, json: NativeReceiverJson, track: MediaStreamTrack) {
    this._pcId = pcId;
    this.receiverId = json.receiverId;
    this.track = track;
  }

  getParameters(): RTCRtpReceiveParameters {
    return {};
  }

  async getStats(): Promise<RTCStatsReport> {
    const json = await promisify<string>((cb) =>
      LynxWebRTCModule.peerConnectionGetStats(
        this._pcId,
        cb,
      ),
    );
    return parseStatsReport(JSON.parse(json) as object[]);
  }
}

// ── RTCRtpTransceiver implementation ─────────────────────────────────────

class LynxRtpTransceiver implements RTCRtpTransceiver {
  readonly transceiverId: string;
  readonly sender: LynxRtpSender;
  readonly receiver: LynxRtpReceiver;
  readonly stopped: boolean;
  readonly mid: string | null;
  private _direction: RTCRtpTransceiverDirection;
  readonly currentDirection: RTCRtpTransceiverDirection | null;
  private readonly _pcId: number;

  constructor(
    pcId: number,
    json: NativeTransceiverJson,
    sender: LynxRtpSender,
    receiver: LynxRtpReceiver,
  ) {
    this._pcId = pcId;
    this.transceiverId = json.transceiverId;
    this.sender = sender;
    this.receiver = receiver;
    this._direction = json.direction;
    this.currentDirection = json.currentDirection;
    this.stopped = json.stopped;
    this.mid = json.mid;
  }

  get direction(): RTCRtpTransceiverDirection {
    return this._direction;
  }

  set direction(value: RTCRtpTransceiverDirection) {
    this._direction = value;
    LynxWebRTCModule.transceiverSetDirection(
      this._pcId,
      this.transceiverId,
      value,
      () => {},
    );
  }

  stop(): void {
    LynxWebRTCModule.transceiverStop(
      this._pcId,
      this.transceiverId,
      () => {},
    );
  }
  // Required by RTCRtpTransceiver (lib.dom.d.ts TS 5.5+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCodecPreferences(_codecs: any[]): void { /* noop */ }
}

// ── RTCPeerConnection ─────────────────────────────────────────────────────

/**
 * Full polyfill for `RTCPeerConnection`.
 *
 * Bridges every W3C method and event to `LynxWebRTCModule` native calls.
 * All event callbacks are routed through the `LK_PC_EVENT` event bus channel,
 * keyed by `pcId`.
 */
export class RTCPeerConnection extends EventTarget {
  /** Numeric ID used to identify this connection in native calls. */
  readonly _pcId: number;

  private _signalingState: RTCSignalingState = 'stable';
  private _iceConnectionState: RTCIceConnectionState = 'new';
  private _iceGatheringState: RTCIceGatheringState = 'new';
  private _connectionState: RTCPeerConnectionState = 'new';
  private _localDescription: RTCSessionDescription | null = null;
  private _remoteDescription: RTCSessionDescription | null = null;
  private _closed = false;

  private readonly _senders = new Map<string, LynxRtpSender>();
  private readonly _receivers = new Map<string, LynxRtpReceiver>();
  private readonly _transceivers = new Map<string, LynxRtpTransceiver>();
  private readonly _remoteStreams = new Map<string, MediaStream>();
  private readonly _dataChannels = new Map<number, RTCDataChannel>();
  private readonly _tracks = new Map<string, MediaStreamTrack>();

  private readonly _listenerToken = Object.create(null) as object;
  private _initPromise: Promise<void>;

  // ── W3C event handlers ───────────────────────────────────────────────────
  onnegotiationneeded:
    | ((this: RTCPeerConnection, ev: Event) => void)
    | null = null;
  onicecandidate:
    | ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => void)
    | null = null;
  onicecandidateerror:
    | ((this: RTCPeerConnection, ev: Event) => void)
    | null = null;
  onsignalingstatechange:
    | ((this: RTCPeerConnection, ev: Event) => void)
    | null = null;
  oniceconnectionstatechange:
    | ((this: RTCPeerConnection, ev: Event) => void)
    | null = null;
  onicegatheringstatechange:
    | ((this: RTCPeerConnection, ev: Event) => void)
    | null = null;
  onconnectionstatechange:
    | ((this: RTCPeerConnection, ev: Event) => void)
    | null = null;
  ontrack:
    | ((this: RTCPeerConnection, ev: RTCTrackEvent) => void)
    | null = null;
  ondatachannel:
    | ((this: RTCPeerConnection, ev: RTCDataChannelEvent) => void)
    | null = null;

  constructor(config?: RTCConfiguration) {
    super();
    this._pcId = allocPcId();
    this._initPromise = this._init(config ?? {});
  }

  // ── Async init ────────────────────────────────────────────────────────────

  private async _init(config: RTCConfiguration): Promise<void> {
    await promisify<null>((cb) =>
      LynxWebRTCModule.peerConnectionInit(
        JSON.stringify(config),
        this._pcId,
        cb,
      ),
    );
    this._subscribeToEvents();
  }

  /** Wait for the native peer connection to be ready. */
  get ready(): Promise<void> {
    return this._initPromise;
  }

  // ── W3C state getters ─────────────────────────────────────────────────────

  get signalingState(): RTCSignalingState {
    return this._signalingState;
  }

  get iceConnectionState(): RTCIceConnectionState {
    return this._iceConnectionState;
  }

  get iceGatheringState(): RTCIceGatheringState {
    return this._iceGatheringState;
  }

  get connectionState(): RTCPeerConnectionState {
    return this._connectionState;
  }

  get localDescription(): RTCSessionDescription | null {
    return this._localDescription;
  }

  get remoteDescription(): RTCSessionDescription | null {
    return this._remoteDescription;
  }

  // ── SDP ───────────────────────────────────────────────────────────────────

  async createOffer(
    options?: RTCOfferOptions,
  ): Promise<RTCSessionDescription> {
    await this._initPromise;
    const sdpJson = await promisify<string>((cb) =>
      LynxWebRTCModule.peerConnectionCreateOffer(
        this._pcId,
        JSON.stringify(options ?? {}),
        cb,
      ),
    );
    return new RTCSessionDescription(
      JSON.parse(sdpJson) as { type: RTCSdpType; sdp: string },
    );
  }

  async createAnswer(
    options?: RTCAnswerOptions,
  ): Promise<RTCSessionDescription> {
    await this._initPromise;
    const sdpJson = await promisify<string>((cb) =>
      LynxWebRTCModule.peerConnectionCreateAnswer(
        this._pcId,
        JSON.stringify(options ?? {}),
        cb,
      ),
    );
    return new RTCSessionDescription(
      JSON.parse(sdpJson) as { type: RTCSdpType; sdp: string },
    );
  }

  async setLocalDescription(
    desc?: RTCSessionDescription | RTCSessionDescriptionInit,
  ): Promise<void> {
    await this._initPromise;
    const init = desc ?? { type: 'offer' };
    await promisify<null>((cb) =>
      LynxWebRTCModule.peerConnectionSetLocalDescription(
        this._pcId,
        JSON.stringify(
          init instanceof RTCSessionDescription
            ? init.toJSON()
            : init,
        ),
        cb,
      ),
    );
  }

  async setRemoteDescription(
    desc: RTCSessionDescription | RTCSessionDescriptionInit,
  ): Promise<void> {
    await this._initPromise;
    await promisify<null>((cb) =>
      LynxWebRTCModule.peerConnectionSetRemoteDescription(
        this._pcId,
        JSON.stringify(
          desc instanceof RTCSessionDescription ? desc.toJSON() : desc,
        ),
        cb,
      ),
    );
  }

  // ── ICE ───────────────────────────────────────────────────────────────────

  async addIceCandidate(
    candidate?: RTCIceCandidate | RTCIceCandidateInit | null,
  ): Promise<void> {
    await this._initPromise;
    if (!candidate) return;
    await promisify<null>((cb) =>
      LynxWebRTCModule.peerConnectionAddICECandidate(
        this._pcId,
        JSON.stringify(
          candidate instanceof RTCIceCandidate
            ? candidate.toJSON()
            : candidate,
        ),
        cb,
      ),
    );
  }

  // ── Tracks ────────────────────────────────────────────────────────────────

  addTrack(
    track: MediaStreamTrack,
    ...streams: MediaStream[]
  ): RTCRtpSender {
    const streamIds = streams.map((s) => s.id);
    // Fire-and-forget — result processed via event bus
    LynxWebRTCModule.peerConnectionAddTrack(
      this._pcId,
      track.id,
      streamIds,
      (err, senderJson) => {
        if (err || !senderJson) return;
        const json = JSON.parse(senderJson) as NativeSenderJson;
        const sender = new LynxRtpSender(this._pcId, json, track);
        this._senders.set(json.senderId, sender);
      },
    );

    // Return a placeholder sender that gets populated by the callback
    const sender = new LynxRtpSender(
      this._pcId,
      { senderId: `pending-${track.id}`, trackId: track.id, kind: track.kind as 'audio' | 'video', streamIds },
      track,
    );
    return sender;
  }

  removeTrack(sender: RTCRtpSender): void {
    LynxWebRTCModule.peerConnectionRemoveTrack(
      this._pcId,
      sender.senderId,
      () => {},
    );
    this._senders.delete(sender.senderId);
  }

  getSenders(): RTCRtpSender[] {
    return Array.from(this._senders.values());
  }

  getReceivers(): RTCRtpReceiver[] {
    return Array.from(this._receivers.values());
  }

  getTransceivers(): RTCRtpTransceiver[] {
    return Array.from(this._transceivers.values());
  }

  // ── Stream helpers (legacy plan-B compatibility) ──────────────────────────

  getLocalStreams(): MediaStream[] {
    const streamMap = new Map<string, MediaStream>();
    for (const sender of this._senders.values()) {
      if (!sender.track) continue;
      // Group senders by stream — create a local MediaStream per unique group
      const stream = new MediaStream(
        `local-${sender.senderId}`,
        sender.track ? [sender.track] : [],
      );
      streamMap.set(stream.id, stream);
    }
    return Array.from(streamMap.values());
  }

  getRemoteStreams(): MediaStream[] {
    return Array.from(this._remoteStreams.values());
  }

  // ── DataChannel ───────────────────────────────────────────────────────────

  createDataChannel(
    label: string,
    init?: RTCDataChannelInit,
  ): RTCDataChannel {
    // Allocate a channel ID client-side; native confirms it via event
    const channelId = Math.floor(Math.random() * 0x7fff);
    const dc = new RTCDataChannel({
      pcId: this._pcId,
      channelId,
      label,
      ...(init !== undefined ? { init } : {}),
    });
    this._dataChannels.set(channelId, dc);

    LynxWebRTCModule.createDataChannel(
      this._pcId,
      label,
      JSON.stringify(init ?? {}),
      () => {},
    );

    return dc;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(
    selector?: MediaStreamTrack | null,
  ): Promise<RTCStatsReport> {
    await this._initPromise;
    const json = await promisify<string>((cb) =>
      LynxWebRTCModule.peerConnectionGetStats(
        this._pcId,
        cb,
      ),
    );
    return parseStatsReport(JSON.parse(json) as object[]);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this._connectionState = 'closed';
    LynxWebRTCModule.peerConnectionClose(this._pcId, () => {});
    removeListener(this._listenerToken);
    this._senders.clear();
    this._receivers.clear();
    this._transceivers.clear();
    this._remoteStreams.clear();
    this._dataChannels.clear();
    this._tracks.clear();

    const ev = new Event('connectionstatechange');
    this.dispatchEvent(ev);
    this.onconnectionstatechange?.(ev);
  }

  dispose(): void {
    if (!this._closed) this.close();
    LynxWebRTCModule.peerConnectionDispose(this._pcId, () => {});
  }

  // ── Native event routing ──────────────────────────────────────────────────

  private _subscribeToEvents(): void {
    addListener(
      this._listenerToken,
      'LK_PC_EVENT',
      (raw: unknown) => {
        const event = raw as { type: string; pcId: number; [k: string]: unknown };
        if (event.pcId !== this._pcId) return;
        this._handleNativeEvent(event);
      },
    );
  }

  private _handleNativeEvent(
    event: { type: string; [k: string]: unknown },
  ): void {
    switch (event.type) {
      case 'signalingStateChanged':
        this._handleSignalingStateChange(event.state as RTCSignalingState);
        break;

      case 'iceConnectionStateChanged':
        this._handleIceConnectionStateChange(
          event.state as RTCIceConnectionState,
        );
        break;

      case 'iceGatheringStateChanged':
        this._handleIceGatheringStateChange(
          event.state as RTCIceGatheringState,
        );
        break;

      case 'connectionStateChanged':
        this._handleConnectionStateChange(
          event.state as RTCPeerConnectionState,
        );
        break;

      case 'gotIceCandidate':
        this._handleIceCandidate(
          event.candidate as RTCIceCandidateInit | null,
        );
        break;

      case 'negotiationNeeded':
        this._handleNegotiationNeeded();
        break;

      case 'addTrack':
        this._handleAddTrack(
          event.receiver as NativeReceiverJson,
          event.streams as string[],
        );
        break;

      case 'removeTrack':
        this._handleRemoveTrack(event.receiverId as string);
        break;

      case 'addStream':
        this._handleAddStream(
          event.streamId as string,
          event.tracks as NativeReceiverJson[],
        );
        break;

      case 'dataChannelDidOpen':
      case 'dataChannelDidClose':
      case 'dataChannelDidReceiveMessage':
      case 'dataChannelBufferedAmountChanged':
        // Delegated to RTCDataChannel via its own listener
        break;

      case 'localDescriptionChanged':
        this._localDescription = new RTCSessionDescription(
          event.sdp as { type: RTCSdpType; sdp: string },
        );
        break;

      case 'remoteDescriptionChanged':
        this._remoteDescription = new RTCSessionDescription(
          event.sdp as { type: RTCSdpType; sdp: string },
        );
        break;
    }
  }

  private _handleSignalingStateChange(state: RTCSignalingState): void {
    this._signalingState = state;
    const ev = new Event('signalingstatechange');
    this.dispatchEvent(ev);
    this.onsignalingstatechange?.(ev);
  }

  private _handleIceConnectionStateChange(
    state: RTCIceConnectionState,
  ): void {
    this._iceConnectionState = state;
    const ev = new Event('iceconnectionstatechange');
    this.dispatchEvent(ev);
    this.oniceconnectionstatechange?.(ev);
  }

  private _handleIceGatheringStateChange(
    state: RTCIceGatheringState,
  ): void {
    this._iceGatheringState = state;
    const ev = new Event('icegatheringstatechange');
    this.dispatchEvent(ev);
    this.onicegatheringstatechange?.(ev);
  }

  private _handleConnectionStateChange(
    state: RTCPeerConnectionState,
  ): void {
    this._connectionState = state;
    const ev = new Event('connectionstatechange');
    this.dispatchEvent(ev);
    this.onconnectionstatechange?.(ev);
  }

  private _handleIceCandidate(
    candidateInit: RTCIceCandidateInit | null,
  ): void {
    const candidate = candidateInit
      ? new RTCIceCandidate(candidateInit)
      : null;
    const ev = new RTCPeerConnectionIceEvent('icecandidate', {
      candidate,
    });
    this.dispatchEvent(ev);
    this.onicecandidate?.(ev);
  }

  private _handleNegotiationNeeded(): void {
    const ev = new Event('negotiationneeded');
    this.dispatchEvent(ev);
    this.onnegotiationneeded?.(ev);
  }

  private _handleAddTrack(
    receiverJson: NativeReceiverJson,
    streamIds: string[],
  ): void {
    const track = new MediaStreamTrack({
      id: receiverJson.trackId,
      kind: receiverJson.kind,
      peerConnectionId: this._pcId,
    });
    this._tracks.set(track.id, track);

    const receiver = new LynxRtpReceiver(this._pcId, receiverJson, track);
    this._receivers.set(receiverJson.receiverId, receiver);

    // Collect or create remote streams
    const streams = streamIds.map((id) => {
      let stream = this._remoteStreams.get(id);
      if (!stream) {
        stream = new MediaStream(id);
        this._remoteStreams.set(id, stream);
      }
      stream.addTrack(track);
      return stream;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = new (RTCTrackEvent as any)('track', {
      receiver,
      track,
      streams,
      transceiver: undefined,
    }) as RTCTrackEvent;
    this.dispatchEvent(ev);
    this.ontrack?.(ev);
  }

  private _handleRemoveTrack(receiverId: string): void {
    const receiver = this._receivers.get(receiverId);
    if (!receiver) return;
    this._receivers.delete(receiverId);
    this._tracks.delete(receiver.track.id);
    receiver.track._setMuted(true);
  }

  private _handleAddStream(
    streamId: string,
    tracks: NativeReceiverJson[],
  ): void {
    // Legacy plan-B helper — fires after addTrack for each stream
    if (!this._remoteStreams.has(streamId)) {
      this._remoteStreams.set(streamId, new MediaStream(streamId));
    }
    for (const t of tracks) {
      const track = this._tracks.get(t.trackId);
      if (track) {
        this._remoteStreams.get(streamId)!.addTrack(track);
      }
    }
  }
}

// ─── Helper: parse a flat stats array into an RTCStatsReport Map ────────────

function parseStatsReport(rawArray: object[]): RTCStatsReport {
  const report: RTCStatsReport = new Map();
  for (const item of rawArray) {
    const stat = item as RTCStats;
    report.set(stat.id, stat);
  }
  return report;
}

// ─── W3C event shims (minimal — for environments that don't have them) ────────

if (typeof RTCPeerConnectionIceEvent === 'undefined') {
  // @ts-expect-error: global augmentation
  globalThis.RTCPeerConnectionIceEvent = class RTCPeerConnectionIceEventShim extends Event {
    readonly candidate: RTCIceCandidate | null;
    constructor(
      type: string,
      init: { candidate: RTCIceCandidate | null },
    ) {
      super(type);
      this.candidate = init.candidate;
    }
  };
}

if (typeof RTCTrackEvent === 'undefined') {
  // @ts-expect-error: global augmentation
  globalThis.RTCTrackEvent = class RTCTrackEventShim extends Event {
    readonly receiver: RTCRtpReceiver;
    readonly track: MediaStreamTrack;
    readonly streams: readonly MediaStream[];
    readonly transceiver: RTCRtpTransceiver | undefined;
    constructor(
      type: string,
      init: {
        receiver: RTCRtpReceiver;
        track: MediaStreamTrack;
        streams: MediaStream[];
        transceiver: RTCRtpTransceiver | undefined;
      },
    ) {
      super(type);
      this.receiver = init.receiver;
      this.track = init.track;
      this.streams = init.streams;
      this.transceiver = init.transceiver;
    }
  };
}

if (typeof RTCDataChannelEvent === 'undefined') {
  // @ts-expect-error: global augmentation
  globalThis.RTCDataChannelEvent = class RTCDataChannelEventShim extends Event {
    readonly channel: RTCDataChannel;
    constructor(type: string, init: { channel: RTCDataChannel }) {
      super(type);
      this.channel = init.channel;
    }
  };
}
