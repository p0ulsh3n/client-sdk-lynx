import type { LivekitLynxModuleSpec } from './typing';

const LINKING_ERROR =
  `[@livekit/lynx] Native module "LivekitLynxModule" is not linked.\n` +
  `Register LivekitLynxModule in your Lynx app setup.`;

export const LivekitLynxModule: LivekitLynxModuleSpec = new Proxy(
  {} as LivekitLynxModuleSpec,
  {
    get(_target, prop: string) {
      if (typeof NativeModules === 'undefined' || !NativeModules.LivekitLynxModule) {
        throw new Error(LINKING_ERROR);
      }
      return (NativeModules.LivekitLynxModule as unknown as Record<string, unknown>)[prop];
    },
  },
);
