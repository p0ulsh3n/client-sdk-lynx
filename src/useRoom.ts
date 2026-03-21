// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/useRoom.ts
// Port of @livekit/react-native src/useRoom.ts
// Only change: `react` → `@lynx-js/react`
// ─────────────────────────────────────────────────────────────────────────────

import {
  type AudioTrack,
  ConnectionState,
  type LocalParticipant,
  type Participant,
  type RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useEffect, useState } from '@lynx-js/react';

export interface RoomState {
  room?: Room;
  /** All participants in the room, including the local participant. */
  participants: Participant[];
  /** All subscribed audio tracks in the room, not including local participant. */
  audioTracks: AudioTrack[];
  error?: Error;
}

export interface RoomOptions {
  sortParticipants?: (
    participants: Participant[],
    localParticipant?: LocalParticipant,
  ) => void;
}

/**
 * @deprecated Wrap your components in a `<LiveKitRoom>` component instead
 * and use more granular hooks to track the state you're interested in.
 */
export function useRoom(room: Room, options?: RoomOptions): RoomState {
  const [error] = useState<Error | undefined>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

  const sortFunc = options?.sortParticipants ?? sortParticipants;

  useEffect(() => {
    const onParticipantsChanged = () => {
      const remotes = Array.from(room.remoteParticipants.values());
      const next: Participant[] = [room.localParticipant, ...remotes];
      sortFunc(next, room.localParticipant);
      setParticipants(next);
    };

    const onSubscribedTrackChanged = (track?: RemoteTrack) => {
      onParticipantsChanged();
      if (track && track.kind !== Track.Kind.Audio) return;

      const tracks: AudioTrack[] = [];
      room.remoteParticipants.forEach((p) => {
        p.audioTrackPublications.forEach((pub) => {
          if (pub.audioTrack) tracks.push(pub.audioTrack);
        });
      });
      setAudioTracks(tracks);
    };

    const onConnectionStateChanged = (state: ConnectionState) => {
      if (state === ConnectionState.Connected) onParticipantsChanged();
    };

    room.once(RoomEvent.Disconnected, () => {
      room
        .off(RoomEvent.ParticipantConnected, onParticipantsChanged)
        .off(RoomEvent.ParticipantDisconnected, onParticipantsChanged)
        .off(RoomEvent.ActiveSpeakersChanged, onParticipantsChanged)
        .off(RoomEvent.TrackSubscribed, onSubscribedTrackChanged)
        .off(RoomEvent.TrackUnsubscribed, onSubscribedTrackChanged)
        .off(RoomEvent.LocalTrackPublished, onParticipantsChanged)
        .off(RoomEvent.LocalTrackUnpublished, onParticipantsChanged)
        .off(RoomEvent.AudioPlaybackStatusChanged, onParticipantsChanged)
        .off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    });

    room
      .on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
      .on(RoomEvent.Reconnected, onParticipantsChanged)
      .on(RoomEvent.ParticipantConnected, onParticipantsChanged)
      .on(RoomEvent.ParticipantDisconnected, onParticipantsChanged)
      .on(RoomEvent.ActiveSpeakersChanged, onParticipantsChanged)
      .on(RoomEvent.TrackSubscribed, onSubscribedTrackChanged)
      .on(RoomEvent.TrackUnsubscribed, onSubscribedTrackChanged)
      .on(RoomEvent.LocalTrackPublished, onParticipantsChanged)
      .on(RoomEvent.LocalTrackUnpublished, onParticipantsChanged)
      .on(RoomEvent.AudioPlaybackStatusChanged, onParticipantsChanged);

    onSubscribedTrackChanged();

    return () => {
      room.disconnect();
    };
  }, [room, sortFunc]);

  return { error, participants, audioTracks };
}

/**
 * Default participant sort order:
 * 1. Dominant speaker (loudest audio level)
 * 2. Local participant
 * 3. Other recently active speakers
 * 4. Participants with video on
 * 5. By joinedAt
 */
export function sortParticipants(
  participants: Participant[],
  localParticipant?: LocalParticipant,
): void {
  participants.sort((a, b) => {
    if (a.isSpeaking && b.isSpeaking) return b.audioLevel - a.audioLevel;
    if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;

    const aLast = a.lastSpokeAt?.getTime() ?? 0;
    const bLast = b.lastSpokeAt?.getTime() ?? 0;
    if (aLast !== bLast) return bLast - aLast;

    const aVideo = a.videoTrackPublications.size > 0;
    const bVideo = b.videoTrackPublications.size > 0;
    if (aVideo !== bVideo) return aVideo ? -1 : 1;

    return (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0);
  });

  if (localParticipant) {
    const idx = participants.indexOf(localParticipant);
    if (idx >= 0) {
      participants.splice(idx, 1);
      participants.splice(participants.length > 0 ? 1 : 0, 0, localParticipant);
    }
  }
}
