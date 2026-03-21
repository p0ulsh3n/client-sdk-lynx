// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — RTCSessionDescription.ts
// ─────────────────────────────────────────────────────────────────────────────

export type RTCSdpType = 'offer' | 'pranswer' | 'answer' | 'rollback';

export interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp?: string;
}

/**
 * Polyfill for `RTCSessionDescription`.
 * Immutable value object — matches the W3C spec.
 */
export class RTCSessionDescription {
  readonly type: RTCSdpType;
  readonly sdp: string;

  constructor(init: RTCSessionDescriptionInit) {
    this.type = init.type;
    this.sdp = init.sdp ?? '';
  }

  toJSON(): RTCSessionDescriptionInit {
    return { type: this.type, sdp: this.sdp };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RTCIceCandidate
// ─────────────────────────────────────────────────────────────────────────────

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

/**
 * Polyfill for `RTCIceCandidate`.
 * Immutable value object — matches the W3C spec.
 */
export class RTCIceCandidate {
  readonly candidate: string;
  readonly sdpMid: string | null;
  readonly sdpMLineIndex: number | null;
  readonly usernameFragment: string | null;

  // Parsed fields (populated lazily)
  readonly foundation: string | null = null;
  readonly component: RTCIceComponent | null = null;
  readonly priority: number | null = null;
  readonly address: string | null = null;
  readonly protocol: RTCIceProtocol | null = null;
  readonly port: number | null = null;
  readonly type: RTCIceCandidateType | null = null;
  readonly tcpType: RTCIceTcpCandidateType | null = null;
  readonly relatedAddress: string | null = null;
  readonly relatedPort: number | null = null;

  constructor(init: RTCIceCandidateInit) {
    this.candidate = init.candidate ?? '';
    this.sdpMid = init.sdpMid ?? null;
    this.sdpMLineIndex = init.sdpMLineIndex ?? null;
    this.usernameFragment = init.usernameFragment ?? null;
  }

  toJSON(): RTCIceCandidateInit {
    return {
      candidate: this.candidate,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex,
      usernameFragment: this.usernameFragment,
    };
  }
}

// W3C enums
export type RTCIceComponent = 'rtp' | 'rtcp';
export type RTCIceProtocol = 'udp' | 'tcp';
export type RTCIceCandidateType = 'host' | 'srflx' | 'prflx' | 'relay';
export type RTCIceTcpCandidateType = 'active' | 'passive' | 'so';
