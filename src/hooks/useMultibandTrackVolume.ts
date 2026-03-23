import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track, type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import { useEffect, useMemo, useState } from '@lynx-js/react';
import { addListener, removeListener } from '../EventBus';
import { LynxAudioModule } from '../NativeModule';
import type { MediaStreamTrack } from '../MediaStreamTrack';

export interface MultiBandTrackVolumeOptions {
  bands?: number;
  minFrequency?: number;
  maxFrequency?: number;
  updateInterval?: number;
}

const defaults = { bands: 5, minFrequency: 1000, maxFrequency: 8000, updateInterval: 40 } as const;

export function useMultibandTrackVolume(
  trackOrRef?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder,
  options?: MultiBandTrackVolumeOptions,
): number[] {
  const track = trackOrRef instanceof Track
    ? trackOrRef
    : (trackOrRef?.publication?.track as LocalAudioTrack | RemoteAudioTrack | undefined);

  const opts = useMemo(() => ({ ...defaults, ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(options)]);

  const mediaStreamTrack = track?.mediaStreamTrack as MediaStreamTrack | undefined;
  const hasTrack = mediaStreamTrack != null;
  const pcId = mediaStreamTrack?._peerConnectionId ?? -1;
  const trackId = mediaStreamTrack?.id;

  const [magnitudes, setMagnitudes] = useState<number[]>([]);

  useEffect(() => {
    const token = Object.create(null) as object;
    let reactTag: string | null = null;

    if (hasTrack && trackId) {
      LynxAudioModule.createMultibandVolumeProcessor(JSON.stringify(opts), pcId, trackId, (err, tag) => {
        if (err || !tag) return;
        reactTag = tag;
        addListener(token, 'LK_MULTIBAND_PROCESSED', (event: unknown) => {
          const e = event as { magnitudes?: number[]; id?: string };
          if (e.magnitudes && e.id === reactTag) setMagnitudes(e.magnitudes);
        });
      });
    }

    return () => {
      removeListener(token);
      if (reactTag && trackId)
        LynxAudioModule.deleteMultibandVolumeProcessor(reactTag, pcId, trackId, () => {});
    };
  }, [hasTrack, pcId, trackId, opts]);

  return magnitudes;
}
