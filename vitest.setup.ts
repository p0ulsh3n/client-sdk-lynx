// Stub the Lynx runtime globals that @lynx-js/react expects at import time.

(globalThis as Record<string, unknown>).lynx = {
  getJSModule: () => ({}),
  callNativeModule: () => undefined,
  requireModuleHelper: () => undefined,
  performance: { now: () => Date.now() },
};

(globalThis as Record<string, unknown>).SystemInfo = {
  platform: 'ios',
  pixelRatio: 3,
};

(globalThis as Record<string, unknown>).NativeModules = {
  LivekitLynxModule: {
    setAppleAudioConfiguration: () => {},
  },
};

// In Node v18+, `globalThis.navigator` and `globalThis.crypto` are exposed
// as non-configurable getters. We need to make them configurable so that
// registerGlobals() can assign to them (and so tests can reset them).

function makeWritable(obj: object, key: string, value: unknown) {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (desc && !desc.writable && !desc.set) {
    Object.defineProperty(obj, key, {
      configurable: true,
      writable: true,
      value: desc.value ?? value,
    });
  }
}

makeWritable(globalThis, 'navigator', {});
makeWritable(globalThis, 'crypto', {
  randomUUID: () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }),
});
