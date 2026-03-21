// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/logger.ts
// Identical to @livekit/react-native logger.ts
// ─────────────────────────────────────────────────────────────────────────────

import { setLogLevel as setClientSdkLogLevel } from 'livekit-client';
import loglevel from 'loglevel';

export const log = loglevel.getLogger('lk-lynx');
log.setDefaultLevel('WARN');

export type LogLevel = Parameters<typeof setClientSdkLogLevel>[0];
export type SetLogLevelOptions = {
  liveKitClientLogLevel?: LogLevel;
};

/**
 * Set the log level for both `@livekit/lynx` and `livekit-client`.
 */
export function setLogLevel(
  level: LogLevel,
  options: SetLogLevelOptions = {},
): void {
  log.setLevel(level);
  setClientSdkLogLevel(options.liveKitClientLogLevel ?? level);
}
