import { describe, it, expect } from 'vitest';
import { RTCSessionDescription, RTCIceCandidate } from '../RTCSessionDescription';

describe('RTCSessionDescription', () => {
  it('stores type and sdp', () => {
    const desc = new RTCSessionDescription({ type: 'offer', sdp: 'v=0\r\n' });
    expect(desc.type).toBe('offer');
    expect(desc.sdp).toBe('v=0\r\n');
  });

  it('defaults sdp to empty string when omitted', () => {
    const desc = new RTCSessionDescription({ type: 'answer' });
    expect(desc.sdp).toBe('');
  });

  it('toJSON round-trips correctly', () => {
    const init = { type: 'offer' as const, sdp: 'v=0\r\n' };
    const desc = new RTCSessionDescription(init);
    expect(desc.toJSON()).toEqual(init);
  });

  it('supports all SDP types', () => {
    const types = ['offer', 'pranswer', 'answer', 'rollback'] as const;
    for (const type of types) {
      const desc = new RTCSessionDescription({ type });
      expect(desc.type).toBe(type);
    }
  });
});

describe('RTCIceCandidate', () => {
  it('stores candidate string', () => {
    const candidate = 'candidate:1 1 udp 2122260223 192.168.1.1 12345 typ host';
    const ice = new RTCIceCandidate({ candidate });
    expect(ice.candidate).toBe(candidate);
  });

  it('defaults candidate to empty string when omitted', () => {
    const ice = new RTCIceCandidate({});
    expect(ice.candidate).toBe('');
  });

  it('stores sdpMid and sdpMLineIndex', () => {
    const ice = new RTCIceCandidate({ candidate: 'x', sdpMid: 'audio', sdpMLineIndex: 0 });
    expect(ice.sdpMid).toBe('audio');
    expect(ice.sdpMLineIndex).toBe(0);
  });

  it('defaults nulls correctly', () => {
    const ice = new RTCIceCandidate({ candidate: 'x' });
    expect(ice.sdpMid).toBeNull();
    expect(ice.sdpMLineIndex).toBeNull();
    expect(ice.usernameFragment).toBeNull();
  });

  it('toJSON round-trips correctly', () => {
    const init = { candidate: 'c', sdpMid: 'm', sdpMLineIndex: 1, usernameFragment: 'uf' };
    const ice = new RTCIceCandidate(init);
    expect(ice.toJSON()).toEqual(init);
  });
});
