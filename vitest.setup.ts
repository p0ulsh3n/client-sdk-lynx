// Stub the Lynx runtime global that @lynx-js/react expects at import time.
// Without this, importing any module that transitively imports @lynx-js/react
// crashes with "ReferenceError: lynx is not defined" in Node/vitest.

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

// Provide crypto.randomUUID in Node if absent
if (typeof (globalThis as Record<string, unknown>).crypto === 'undefined') {
  (globalThis as Record<string, unknown>).crypto = {
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }),
  };
}
