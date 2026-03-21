// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/LKNativeLynxModule.ts
// ─────────────────────────────────────────────────────────────────────────────

const LINKING_ERROR =
  `[@livekit/lynx] Native module "LivekitLynxModule" is not linked.\n` +
  `Ensure you registered LivekitLynxModule in your Lynx app setup:\n` +
  `  iOS:     [globalConfig registerModule:LivekitLynxModule.class]\n` +
  `  Android: LynxEnv.inst().registerModule("LivekitLynxModule", LivekitLynxModule::class.java)`;

export const LivekitLynxModule: typeof NativeModules['LivekitLynxModule'] = new Proxy(
  {} as typeof NativeModules['LivekitLynxModule'],
  {
    get(_target, prop: string) {
      if (typeof NativeModules === 'undefined' || !NativeModules.LivekitLynxModule) {
        throw new Error(LINKING_ERROR);
      }
      return (NativeModules.LivekitLynxModule as Record<string, unknown>)[prop];
    },
  },
);
