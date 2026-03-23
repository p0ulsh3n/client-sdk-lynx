import type {
  LynxWebRTCModuleSpec,
  LynxAudioModuleSpec,
  LynxE2EEModuleSpec,
  LivekitLynxModuleSpec,
} from './typing';

const LINK_ERROR = (name: string): string =>
  `[@livekit/lynx] Native module "${name}" is not linked.\n` +
  'Register it in your Lynx app setup (iOS: LynxInitProcessor, Android: LynxModuleAdapter).';

function requireModule<K extends keyof typeof NativeModules>(
  key: K,
): (typeof NativeModules)[K] {
  if (typeof NativeModules === 'undefined') {
    throw new Error('[@livekit/lynx] NativeModules global not available. Call registerGlobals() first.');
  }
  const mod = NativeModules[key];
  if (!mod) throw new Error(LINK_ERROR(key));
  return mod;
}

export const LynxWebRTCModule: LynxWebRTCModuleSpec = new Proxy(
  {} as LynxWebRTCModuleSpec,
  { get(_t, prop: string) { return (requireModule('LynxWebRTCModule') as Record<string, unknown>)[prop]; } },
);

export const LynxAudioModule: LynxAudioModuleSpec = new Proxy(
  {} as LynxAudioModuleSpec,
  { get(_t, prop: string) { return (requireModule('LynxAudioModule') as Record<string, unknown>)[prop]; } },
);

export const LynxE2EEModule: LynxE2EEModuleSpec = new Proxy(
  {} as LynxE2EEModuleSpec,
  { get(_t, prop: string) { return (requireModule('LynxE2EEModule') as Record<string, unknown>)[prop]; } },
);

export const LivekitLynxModule: LivekitLynxModuleSpec = new Proxy(
  {} as LivekitLynxModuleSpec,
  { get(_t, prop: string) { return (requireModule('LivekitLynxModule') as Record<string, unknown>)[prop]; } },
);

export function promisify<T>(
  fn: (cb: (err: string | null, result: T | null) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn((err, result) => {
      if (err) reject(new Error(err));
      else resolve(result as T);
    });
  });
}
