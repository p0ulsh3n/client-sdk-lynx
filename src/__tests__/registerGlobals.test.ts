import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the native module bridge — not available in Node
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

// Simulate Lynx's SystemInfo global
(globalThis as Record<string, unknown>).SystemInfo = { platform: 'ios', pixelRatio: 3 };
(globalThis as Record<string, unknown>).NativeModules = {
  LivekitLynxModule: {
    setAppleAudioConfiguration: vi.fn((_cfg: string, cb: (err: null) => void) => cb(null)),
  },
};

import { registerGlobals } from '../index';

describe('registerGlobals()', () => {
  beforeEach(() => {
    // Reset any globals that were previously injected
    const g = globalThis as Record<string, unknown>;
    delete g.RTCPeerConnection;
    delete g.RTCSessionDescription;
    delete g.RTCIceCandidate;
    delete g.MediaStream;
    delete g.MediaStreamTrack;
    delete g.RTCDataChannel;
    delete g.LiveKitReactNativeGlobal;
    if (g.navigator) delete (g.navigator as Record<string, unknown>).mediaDevices;
  });

  it('injects RTCPeerConnection global', () => {
    registerGlobals();
    expect((globalThis as Record<string, unknown>).RTCPeerConnection).toBeDefined();
  });

  it('injects RTCSessionDescription global', () => {
    registerGlobals();
    expect((globalThis as Record<string, unknown>).RTCSessionDescription).toBeDefined();
  });

  it('injects RTCIceCandidate global', () => {
    registerGlobals();
    expect((globalThis as Record<string, unknown>).RTCIceCandidate).toBeDefined();
  });

  it('injects MediaStream global', () => {
    registerGlobals();
    expect((globalThis as Record<string, unknown>).MediaStream).toBeDefined();
  });

  it('injects navigator.mediaDevices', () => {
    registerGlobals();
    const nav = (globalThis as Record<string, unknown>).navigator as { mediaDevices: unknown };
    expect(nav?.mediaDevices).toBeDefined();
  });

  it('injects navigator.mediaDevices.getUserMedia function', () => {
    registerGlobals();
    const nav = (globalThis as Record<string, unknown>).navigator as {
      mediaDevices: { getUserMedia: unknown };
    };
    expect(typeof nav?.mediaDevices?.getUserMedia).toBe('function');
  });

  it('injects LiveKitReactNativeGlobal with platform', () => {
    registerGlobals();
    const info = (globalThis as Record<string, unknown>).LiveKitReactNativeGlobal as {
      platform: string;
      devicePixelRatio: number;
    };
    expect(info.platform).toBe('ios');
    expect(typeof info.devicePixelRatio).toBe('number');
  });

  it('injects crypto.randomUUID when missing', () => {
    const g = globalThis as Record<string, unknown>;
    const original = g.crypto;
    g.crypto = undefined as unknown as typeof crypto;
    registerGlobals();
    expect(typeof (g.crypto as Crypto)?.randomUUID).toBe('function');
    const uuid = (g.crypto as Crypto).randomUUID();
    expect(uuid).toMatch(/^[0-9a-f-]{36}$/);
    g.crypto = original;
  });

  it('does not overwrite existing globals (??= behaviour)', () => {
    const sentinel = class SentinelClass {};
    (globalThis as Record<string, unknown>).RTCPeerConnection = sentinel;
    registerGlobals();
    expect((globalThis as Record<string, unknown>).RTCPeerConnection).toBe(sentinel);
  });
});
