import { MediaRecorder } from './MediaRecorder';

(function shimMediaRecorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).MediaRecorder) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MediaRecorder = MediaRecorder;
  }
})();
