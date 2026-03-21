// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — NativeModule.ts
// Type-safe accessor for the Lynx NativeModules global.
// ─────────────────────────────────────────────────────────────────────────────

import './typing.d';

const LINK_ERROR = (name: string): string =>
  `[@livekit/lynx] Native module "${name}" is not linked.\n` +
  'Make sure you registered it in your Lynx app setup (LynxInitProcessor on iOS, ' +
  'LynxModuleAdapter on Android) and rebuilt the native app.';

function requireModule<K extends keyof typeof NativeModules>(
  key: K,
): (typeof NativeModules)[K] {
  if (typeof NativeModules === 'undefined') {
    throw new Error(
      '[@livekit/lynx] NativeModules global is not available. ' +
      'registerGlobals() must be called in the Lynx background thread.',
    );
  }
  const mod = NativeModules[key];
  if (!mod) {
    throw new Error(LINK_ERROR(key));
  }
  return mod;
}

/** Lynx WebRTC core module — PeerConnection, MediaStream, getUserMedia. */
export const LynxWebRTCModule = new Proxy(
  {} as (typeof NativeModules)['LynxWebRTCModule'],
  {
    get(_target, prop: string) {
      return requireModule('LynxWebRTCModule')[prop as keyof typeof NativeModules['LynxWebRTCModule']];
    },
  },
);

/** Lynx Audio module — volume/multiband processors, sink listeners. */
export const LynxAudioModule = new Proxy(
  {} as (typeof NativeModules)['LynxAudioModule'],
  {
    get(_target, prop: string) {
      return requireModule('LynxAudioModule')[prop as keyof typeof NativeModules['LynxAudioModule']];
    },
  },
);

/** Lynx E2EE module — frame cryptors, key providers, data packet cryptors. */
export const LynxE2EEModule = new Proxy(
  {} as (typeof NativeModules)['LynxE2EEModule'],
  {
    get(_target, prop: string) {
      return requireModule('LynxE2EEModule')[prop as keyof typeof NativeModules['LynxE2EEModule']];
    },
  },
);

/** LiveKit Lynx main module — AudioSession management. */
export const LivekitLynxModule = new Proxy(
  {} as (typeof NativeModules)['LivekitLynxModule'],
  {
    get(_target, prop: string) {
      return requireModule('LivekitLynxModule')[prop as keyof typeof NativeModules['LivekitLynxModule']];
    },
  },
);

/**
 * Promisify a Lynx NativeModule callback.
 * The callback convention is `(error: string | null, result: T | null) => void`.
 */
export function promisify<T>(
  fn: (cb: (err: string | null, result: T | null) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn((err, result) => {
      if (err) {
        reject(new Error(err));
      } else {
        resolve(result as T);
      }
    });
  });
}
