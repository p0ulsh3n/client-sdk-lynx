import {
  type FeatureFlags,
  LKFeatureContext,
  RoomContext,
  useLiveKitRoom,
} from '@livekit/components-react';
import type {
  AudioCaptureOptions,
  RoomConnectOptions,
  RoomOptions,
  ScreenShareCaptureOptions,
  VideoCaptureOptions,
} from 'livekit-client';
import type { MediaDeviceFailure, Room } from 'livekit-client';
import { type ReactNode } from '@lynx-js/react';
import * as React from '@lynx-js/react';

/** @public */
export interface LiveKitRoomProps {
  /**
   * URL to the LiveKit server.
   * Example: `wss://<domain>.livekit.cloud`
   */
  serverUrl: string | undefined;

  /**
   * User-specific JWT access token.
   */
  token: string | undefined;

  /**
   * Publish audio immediately after connecting.
   * @defaultValue false
   */
  audio?: AudioCaptureOptions | boolean;

  /**
   * Publish video immediately after connecting.
   * @defaultValue false
   */
  video?: VideoCaptureOptions | boolean;

  /**
   * Publish screen share immediately after connecting.
   * @defaultValue false
   */
  screen?: ScreenShareCaptureOptions | boolean;

  /**
   * If `true`, initiate the connection immediately.
   * @defaultValue true
   */
  connect?: boolean;

  /**
   * Room creation options (ignored when you pass your own `room` instance).
   */
  options?: RoomOptions;

  /**
   * Options passed to `Room.connect()`.
   */
  connectOptions?: RoomConnectOptions;

  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onMediaDeviceFailure?: (failure?: MediaDeviceFailure) => void;
  onEncryptionError?: (error: Error) => void;

  /**
   * Pass your own Room instance to bypass the internal one.
   * When provided, `options` is ignored.
   */
  room?: Room;

  simulateParticipants?: number | undefined;

  /** @experimental */
  featureFlags?: FeatureFlags | undefined;

  children?: ReactNode;
}

/**
 * The `LiveKitRoom` component provides the Room context to all child components.
 *
 * It is the root of the LiveKit component tree. Wrap your UI in it and use
 * the provided hooks (`useTracks`, `useParticipants`, etc.) in any descendant.
 *
 * @example
 * ```tsx
 * <LiveKitRoom
 *   token={token}
 *   serverUrl="wss://my-server.livekit.cloud"
 *   connect={true}
 *   audio={true}
 *   video={true}
 * >
 *   <MyRoomUI />
 * </LiveKitRoom>
 * ```
 *
 * @public
 */
export function LiveKitRoom(
  props: LiveKitRoomProps,
): React.ReactElement {
  const { room } = useLiveKitRoom(props as Parameters<typeof useLiveKitRoom>[0]);

  // @livekit/components-react uses React.Fragment and Context providers.
  // These are JS-pure and work identically in @lynx-js/react.
  if (!room) return <></>;

  return (
    <RoomContext.Provider value={room}>
      <LKFeatureContext.Provider value={props.featureFlags}>
        {props.children}
      </LKFeatureContext.Provider>
    </RoomContext.Provider>
  );
}
