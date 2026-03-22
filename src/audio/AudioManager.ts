// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/audio/AudioManager.ts
// Port of @livekit/react-native src/audio/AudioManager.ts
// Only change: `react-native` Platform → SystemInfo (Lynx global)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from '@lynx-js/react';
import {
  RoomEvent,
  type Room,
  type LocalTrackPublication,
  type RemoteTrackPublication,
} from 'livekit-client';
import AudioSession, {
  getDefaultAppleAudioConfigurationForMode,
  type AppleAudioConfiguration,
  type AudioTrackState,
} from './AudioSession';
import { log } from '../logger';

/**
 * Automatically configures the iOS AVAudioSession based on the audio
 * track states of a Room (local only / remote only / both / none).
 *
 * Mirrors `useIOSAudioManagement` from the React Native SDK.
 * Has no effect on Android.
 *
 * @param room                  The LiveKit Room instance to observe.
 * @param preferSpeakerOutput   Use speaker output when available. Default: true.
 * @param onConfigureNativeAudio Optional override — receives the current
 *                               AudioTrackState and returns an
 *                               AppleAudioConfiguration to apply.
 */
export function useIOSAudioManagement(
  room: Room,
  preferSpeakerOutput = true,
  onConfigureNativeAudio?: (
    trackState: AudioTrackState,
    preferSpeakerOutput: boolean,
  ) => AppleAudioConfiguration,
): void {
  const [localTrackCount,  setLocalTrackCount]  = useState(0);
  const [remoteTrackCount, setRemoteTrackCount] = useState(0);

  const trackState = useMemo<AudioTrackState>(
    () => computeAudioTrackState(localTrackCount, remoteTrackCount),
    [localTrackCount, remoteTrackCount],
  );

  // ── Initialise counts on connect ─────────────────────────────────────────
  useEffect(() => {
    const recalculate = () => {
      setLocalTrackCount(getLocalAudioTrackCount(room));
      setRemoteTrackCount(getRemoteAudioTrackCount(room));
    };
    recalculate();
    room.on(RoomEvent.Connected, recalculate);
    return () => { room.off(RoomEvent.Connected, recalculate); };
  }, [room]);

  // ── Track publish / unpublish listeners ──────────────────────────────────
  useEffect(() => {
    if (SystemInfo?.platform !== 'ios') return;

    const onLocalPublished = (pub: LocalTrackPublication) => {
      if (pub.kind === 'audio') setLocalTrackCount((c: number) => c + 1);
    };
    const onLocalUnpublished = (pub: LocalTrackPublication) => {
      if (pub.kind === 'audio') {
        setLocalTrackCount((c: number) => {
          if (c - 1 < 0) {
            log.warn('[@livekit/lynx] local audio track count below zero');
          }
          return Math.max(c - 1, 0);
        });
      }
    };
    const onRemotePublished = (pub: RemoteTrackPublication) => {
      if (pub.kind === 'audio') setRemoteTrackCount((c: number) => c + 1);
    };
    const onRemoteUnpublished = (pub: RemoteTrackPublication) => {
      if (pub.kind === 'audio') {
        setRemoteTrackCount((c: number) => {
          if (c - 1 < 0) {
            log.warn('[@livekit/lynx] remote audio track count below zero');
          }
          return Math.max(c - 1, 0);
        });
      }
    };

    room
      .on(RoomEvent.LocalTrackPublished,   onLocalPublished)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      .on(RoomEvent.TrackPublished,        onRemotePublished)
      .on(RoomEvent.TrackUnpublished,      onRemoteUnpublished);

    return () => {
      room
        .off(RoomEvent.LocalTrackPublished,   onLocalPublished)
        .off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
        .off(RoomEvent.TrackPublished,        onRemotePublished)
        .off(RoomEvent.TrackUnpublished,      onRemoteUnpublished);
    };
  }, [room]);

  // ── Apply audio session configuration when track state changes ────────────
  useEffect(() => {
    if (SystemInfo?.platform !== 'ios') return;

    const configFn = onConfigureNativeAudio ?? getDefaultAppleAudioConfigurationForMode;
    const config   = configFn(trackState, preferSpeakerOutput);
    AudioSession.setAppleAudioConfiguration(config);
  }, [trackState, onConfigureNativeAudio, preferSpeakerOutput]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeAudioTrackState(
  local: number,
  remote: number,
): AudioTrackState {
  if (local > 0 && remote > 0) return 'localAndRemote';
  if (local > 0 && remote === 0) return 'localOnly';
  if (local === 0 && remote > 0) return 'remoteOnly';
  return 'none';
}

function getLocalAudioTrackCount(room: Room): number {
  return room.localParticipant.audioTrackPublications.size;
}

function getRemoteAudioTrackCount(room: Room): number {
  let count = 0;
  room.remoteParticipants.forEach((p) => {
    count += p.audioTrackPublications.size;
  });
  return count;
}
