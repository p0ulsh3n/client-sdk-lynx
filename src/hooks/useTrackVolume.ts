import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track, type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import { useEffect, useState } from '@lynx-js/react';
import { addListener, removeListener } from '../EventBus';
import { LynxAudioModule } from '../NativeModule';
import type { MediaStreamTrack } from '../MediaStreamTrack';

export function useTrackVolume(
  trackOrRef?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder,
): number {
  const track = trackOrRef instanceof Track
    ? trackOrRef
    : (trackOrRef?.publication?.track as LocalAudioTrack | RemoteAudioTrack | undefined);

  const mediaStreamTrack = track?.mediaStreamTrack as MediaStreamTrack | undefined;
  const hasTrack = mediaStreamTrack != null;
  const pcId = mediaStreamTrack?._peerConnectionId ?? -1;
  const trackId = mediaStreamTrack?.id;

  const [volume, setVolume] = useState(0.0);

  useEffect(() => {
    const token = Object.create(null) as object;
    let reactTag: string | null = null;

    if (hasTrack && trackId) {
      LynxAudioModule.createVolumeProcessor(pcId, trackId, (err, tag) => {
        if (err || !tag) return;
        reactTag = tag;
        addListener(token, 'LK_VOLUME_PROCESSED', (event: unknown) => {
          const e = event as { volume?: number; id?: string };
          if (e.volume !== undefined && e.id === reactTag) setVolume(e.volume);
        });
      });
    }

    return () => {
      removeListener(token);
      if (reactTag && trackId)
        LynxAudioModule.deleteVolumeProcessor(reactTag, pcId, trackId, () => {});
    };
  }, [hasTrack, pcId, trackId]);

  return volume;
}
