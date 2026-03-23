import { describe, it, expect, vi } from 'vitest';

// Mock the native module bridge — unavailable in Node environment
vi.mock('../NativeModule', () => ({
  LynxWebRTCModule: {
    mediaStreamCreate: vi.fn((_id: string, cb: (err: null) => void) => cb(null)),
    mediaStreamAddTrack: vi.fn((_sid: string, _tid: string, cb: () => void) => cb()),
    mediaStreamRemoveTrack: vi.fn((_sid: string, _tid: string, cb: () => void) => cb()),
    mediaStreamRelease: vi.fn((_id: string, cb: () => void) => cb()),
    mediaStreamToURL: vi.fn((_id: string, cb: (err: null, url: string) => void) =>
      cb(null, `livekit-stream://${_id}`),
    ),
    mediaStreamTrackSetEnabled: vi.fn(),
    mediaStreamTrackStop: vi.fn(),
    mediaStreamTrackRelease: vi.fn(),
  },
  promisify: <T>(fn: (cb: (err: unknown, result: T) => void) => void): Promise<T> =>
    new Promise((resolve, reject) =>
      fn((err, result) => (err ? reject(err) : resolve(result))),
    ),
}));

import { MediaStream } from '../MediaStream';
import { MediaStreamTrack } from '../MediaStreamTrack';

function makeTrack(kind: 'audio' | 'video'): MediaStreamTrack {
  return new MediaStreamTrack({ id: crypto.randomUUID(), kind });
}

describe('MediaStream', () => {
  it('creates with a unique id when none is provided', () => {
    const a = new MediaStream();
    const b = new MediaStream();
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('creates with a specific id', () => {
    const stream = new MediaStream('abc-123');
    expect(stream.id).toBe('abc-123');
  });

  it('is active when it has tracks', () => {
    const stream = new MediaStream('s1', [makeTrack('video')]);
    expect(stream.active).toBe(true);
  });

  it('is inactive when empty', () => {
    const stream = new MediaStream('s2');
    expect(stream.active).toBe(false);
  });

  it('addTrack adds a track', () => {
    const stream = new MediaStream('s3');
    stream.addTrack(makeTrack('video'));
    expect(stream.getTracks()).toHaveLength(1);
    expect(stream.getVideoTracks()).toHaveLength(1);
    expect(stream.getAudioTracks()).toHaveLength(0);
  });

  it('does not add the same track twice', () => {
    const stream = new MediaStream('s4');
    const track = makeTrack('video');
    stream.addTrack(track);
    stream.addTrack(track);
    expect(stream.getTracks()).toHaveLength(1);
  });

  it('removeTrack removes a track', () => {
    const track = makeTrack('audio');
    const stream = new MediaStream('s5', [track]);
    stream.removeTrack(track);
    expect(stream.getTracks()).toHaveLength(0);
    expect(stream.active).toBe(false);
  });

  it('getAudioTracks and getVideoTracks filter by kind', () => {
    const stream = new MediaStream('s6', [makeTrack('video'), makeTrack('audio')]);
    expect(stream.getVideoTracks()).toHaveLength(1);
    expect(stream.getAudioTracks()).toHaveLength(1);
  });

  it('getTrackById finds the correct track', () => {
    const track = makeTrack('video');
    const stream = new MediaStream('s7', [track]);
    expect(stream.getTrackById(track.id)).toBe(track);
    expect(stream.getTrackById('not-there')).toBeUndefined();
  });

  it('toURL returns a livekit-stream:// URI', () => {
    const stream = new MediaStream('my-stream-id');
    expect(stream.toURL()).toBe('livekit-stream://my-stream-id');
  });

  it('toURL is stable (cached)', () => {
    const stream = new MediaStream('stable-id');
    expect(stream.toURL()).toBe(stream.toURL());
  });

  it('clone returns a new stream with the same track count', () => {
    const stream = new MediaStream('orig', [makeTrack('video'), makeTrack('audio')]);
    const clone = stream.clone();
    expect(clone.id).not.toBe(stream.id);
    expect(clone.getTracks()).toHaveLength(2);
  });

  it('toJSON serialises id and tracks', () => {
    const video = makeTrack('video');
    const stream = new MediaStream('s8', [video]);
    const json = stream.toJSON() as { id: string; tracks: unknown[] };
    expect(json.id).toBe('s8');
    expect(json.tracks).toHaveLength(1);
  });

  it('fires addtrack event when track is added', () => {
    const stream = new MediaStream('s9');
    let fired = false;
    stream.addEventListener('addtrack', () => { fired = true; });
    stream.addTrack(makeTrack('video'));
    expect(fired).toBe(true);
  });

  it('fires removetrack event when track is removed', () => {
    const track = makeTrack('audio');
    const stream = new MediaStream('s10', [track]);
    let fired = false;
    stream.addEventListener('removetrack', () => { fired = true; });
    stream.removeTrack(track);
    expect(fired).toBe(true);
  });
});
