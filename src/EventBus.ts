export const NATIVE_EVENTS = [
  'LK_PC_EVENT',
  'LK_VOLUME_PROCESSED',
  'LK_MULTIBAND_PROCESSED',
  'LK_AUDIO_DATA',
  'LK_E2EE_EVENT',
] as const;

export type NativeEventName = (typeof NATIVE_EVENTS)[number];

type Handler = (data: unknown) => void;

/** Per-listener subscriptions keyed by opaque token. */
const _subs = new Map<object, Array<{ event: string; wrapped: (raw: string) => void }>>();

/** Parsed handler sets per event name. */
const _handlers = new Map<string, Set<Handler>>();

/** Raw handlers registered on GlobalEventEmitter per event. */
const _rawHandlers = new Map<string, (raw: string) => void>();

function getEmitter() {
  // Official Lynx API — only available on the background thread
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (lynx as any).getJSModule('GlobalEventEmitter') as {
    addListener(event: string, handler: (data: string) => void): void;
    removeListener(event: string, handler: (data: string) => void): void;
  };
}

function ensureAttached(event: string): void {
  if (_rawHandlers.has(event)) return;

  const raw = (data: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { parsed = data; }
    _handlers.get(event)?.forEach((fn) => fn(parsed));
  };
  _rawHandlers.set(event, raw);
  getEmitter().addListener(event, raw);
}

export function addListener(token: object, event: string, handler: Handler): void {
  ensureAttached(event);
  if (!_handlers.has(event)) _handlers.set(event, new Set());
  _handlers.get(event)!.add(handler);
  if (!_subs.has(token)) _subs.set(token, []);
  _subs.get(token)!.push({ event, wrapped: handler as (raw: string) => void });
}

export function removeListener(token: object): void {
  const entries = _subs.get(token);
  if (!entries) return;
  for (const { event, wrapped } of entries) {
    _handlers.get(event)?.delete(wrapped as Handler);
  }
  _subs.delete(token);
}
