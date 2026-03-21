// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/polyfills/MediaRecorderShim.ts
// Port of @livekit/react-native src/polyfills/MediaRecorderShim.ts
// Injects our MediaRecorder into the global scope if not already present.
// ─────────────────────────────────────────────────────────────────────────────

import { MediaRecorder } from './MediaRecorder';

(function shimMediaRecorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).MediaRecorder) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MediaRecorder = MediaRecorder;
  }
})();
