// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — EventBus.ts
// Wrapper around Lynx's official GlobalEventEmitter global.
//
// Native modules emit events via:
//   Android: lynxContext.sendGlobalEvent("EVENT_NAME", jsonPayload)
//   iOS:     [self.context sendGlobalEvent:@"EVENT_NAME" withParams:dict]
//
// JS receives via GlobalEventEmitter (official Lynx global):
//   GlobalEventEmitter.addListener('EVENT_NAME', handler)
//   GlobalEventEmitter.removeListener('EVENT_NAME', handler)
//
// Official docs: https://lynxjs.org/api/lynx-native-api/lynx-context/send-global-event
// ─────────────────────────────────────────────────────────────────────────────

/** All native event names emitted by livekit-lynx-webrtc native modules. */
export const NATIVE_EVENTS = [
  // WebRTC PeerConnection events (prefixed with pcId for routing)
  'LK_PC_EVENT',
  // Audio processing events
  'LK_VOLUME_PROCESSED',
  'LK_MULTIBAND_PROCESSED',
  'LK_AUDIO_DATA',
  // E2EE events
  'LK_E2EE_EVENT',
] as const;

export type NativeEventName = (typeof NATIVE_EVENTS)[number];

type Handler = (data: unknown) => void;

/** Per-listener subscriptions, keyed by opaque listener token. */
const _subs = new Map<
  object,
  Array<{ event: string; handler: Handler }>
>();

/**
 * Internal event map — JS-side (deserialized) event handlers.
 * Multiple listeners can subscribe to the same event name.
 */
const _handlers = new Map<string, Set<Handler>>();

/** Whether we've already attached to GlobalEventEmitter for each event. */
const _attached = new Set<string>();

function ensureAttached(event: string): void {
  if (_attached.has(event)) return;
  _attached.add(event);

  // Lynx official GlobalEventEmitter — receives events from sendGlobalEvent()
  const rawHandler = (raw: string) => {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
    _handlers.get(event)?.forEach((fn) => fn(data));
  };

  // Use the official Lynx GlobalEventEmitter API
  GlobalEventEmitter.addListener(event, rawHandler);
}

/**
 * Add an event listener for a native event.
 *
 * @param listenerToken  Opaque token used to remove all listeners at once.
 * @param event          Native event name (must be in NATIVE_EVENTS).
 * @param handler        Called with the deserialized event payload.
 */
export function addListener(
  listenerToken: object,
  event: string,
  handler: Handler,
): void {
  ensureAttached(event);

  if (!_handlers.has(event)) {
    _handlers.set(event, new Set());
  }
  _handlers.get(event)!.add(handler);

  if (!_subs.has(listenerToken)) {
    _subs.set(listenerToken, []);
  }
  _subs.get(listenerToken)!.push({ event, handler });
}

/**
 * Remove all event listeners registered under a given token.
 */
export function removeListener(listenerToken: object): void {
  const entries = _subs.get(listenerToken);
  if (!entries) return;

  for (const { event, handler } of entries) {
    _handlers.get(event)?.delete(handler);
  }
  _subs.delete(listenerToken);
}
