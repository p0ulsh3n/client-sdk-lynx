import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the native module bridge
vi.mock('../NativeModule', () => ({
  LynxWebRTCModule: {},
  LynxAudioModule: {},
  LynxE2EEModule: {},
  LivekitLynxModule: {
    setAppleAudioConfiguration: vi.fn((_cfg: string, cb: (err: null) => void) => cb(null)),
  },
  promisify: vi.fn(),
}));

vi.mock('../getUserMedia', () => ({
  getUserMedia: vi.fn(),
  enumerateDevices: vi.fn(),
}));

vi.mock('../polyfills/MediaRecorderShim', () => ({}));

import { registerGlobals } from '../index';

// Helpers — read via Object.getOwnPropertyDescriptor so we don't trigger the getter
function getGlobal(key: string): unknown {
  return (globalThis as Record<string, unknown>)[key];
}

describe('registerGlobals()', () => {
  beforeEach(() => {
    // Reset only plain-writable properties (not getter-only ones like navigator/crypto)
    const g = globalThis as Record<string, unknown>;
    delete g.RTCPeerConnection;
    delete g.RTCSessionDescription;
    delete g.RTCIceCandidate;
    delete g.MediaStream;
    delete g.MediaStreamTrack;
    delete g.RTCDataChannel;
    delete g.LiveKitReactNativeGlobal;
    // Reset navigator.mediaDevices (the nav object itself was made writable in setup)
    if (g.navigator) {
      delete (g.navigator as Record<string, unknown>).mediaDevices;
    }
  });

  it('injects RTCPeerConnection global', () => {
    registerGlobals();
    expect(getGlobal('RTCPeerConnection')).toBeDefined();
  });

  it('injects RTCSessionDescription global', () => {
    registerGlobals();
    expect(getGlobal('RTCSessionDescription')).toBeDefined();
  });

  it('injects RTCIceCandidate global', () => {
    registerGlobals();
    expect(getGlobal('RTCIceCandidate')).toBeDefined();
  });

  it('injects MediaStream global', () => {
    registerGlobals();
    expect(getGlobal('MediaStream')).toBeDefined();
  });

  it('injects navigator.mediaDevices', () => {
    registerGlobals();
    const nav = (globalThis as Record<string, unknown>).navigator as Record<string, unknown>;
    expect(nav?.mediaDevices).toBeDefined();
  });

  it('injects navigator.mediaDevices.getUserMedia function', () => {
    registerGlobals();
    const nav = (globalThis as Record<string, unknown>).navigator as Record<string, unknown>;
    const md = nav?.mediaDevices as Record<string, unknown>;
    expect(typeof md?.getUserMedia).toBe('function');
  });

  it('injects LiveKitReactNativeGlobal with platform', () => {
    registerGlobals();
    const info = getGlobal('LiveKitReactNativeGlobal') as {
      platform: string;
      devicePixelRatio: number;
    };
    expect(info?.platform).toBe('ios');
    expect(typeof info?.devicePixelRatio).toBe('number');
  });

  it('crypto.randomUUID is available after registerGlobals()', () => {
    registerGlobals();
    // crypto is a getter on globalThis in Node v18+ — we just verify it's functional
    expect(typeof globalThis.crypto?.randomUUID).toBe('function');
    const uuid = globalThis.crypto.randomUUID();
    expect(uuid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not overwrite existing globals (??= behaviour)', () => {
    const sentinel = class SentinelClass {};
    (globalThis as Record<string, unknown>).RTCPeerConnection = sentinel;
    registerGlobals();
    expect(getGlobal('RTCPeerConnection')).toBe(sentinel);
  });
});
