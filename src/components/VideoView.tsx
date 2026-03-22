// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/components/VideoView.tsx
// Port of @livekit/react-native src/components/VideoView.tsx
// @deprecated  Use `VideoTrack` instead.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type ElementInfo,
  LocalVideoTrack,
  Track,
  TrackEvent,
  type VideoTrack,
} from 'livekit-client';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from '@lynx-js/react';
import type React from '@lynx-js/react';
import { RemoteVideoTrack } from 'livekit-client';
import LynxViewPortDetector from './LynxViewPortDetector';

/** @deprecated Use `VideoTrack` and `VideoTrackProps` instead. */
export type Props = {
  videoTrack?: VideoTrack | undefined;
  style?: Record<string, unknown>;
  objectFit?: 'cover' | 'contain';
  mirror?: boolean;
  zOrder?: number;
};

/**
 * @deprecated Use `VideoTrack` and `VideoTrackProps` instead.
 *
 * Legacy component kept for backward compatibility.
 */
export const VideoView = ({
  style = {},
  videoTrack,
  objectFit = 'cover',
  zOrder,
  mirror,
}: Props): React.ReactElement => {
  const [elementInfo] = useState(() => {
    const info = new VideoViewElementInfo();
    info.id = videoTrack?.sid ?? undefined;
    return info;
  });

  const onLayout = useCallback(
    (event: { detail?: { width?: number; height?: number } }) => {
      const w = event.detail?.width ?? 0;
      const h = event.detail?.height ?? 0;
      elementInfo.onLayout(w, h);
    },
    [elementInfo],
  );

  const onVisibility = useCallback(
    (isVisible: boolean) => elementInfo.onVisibility(isVisible),
    [elementInfo],
  );

  const shouldObserveVisibility = useMemo(
    () =>
      videoTrack instanceof RemoteVideoTrack &&
      videoTrack.isAdaptiveStream,
    [videoTrack],
  );

  const [streamURL, setStreamURL] = useState(
    (videoTrack?.mediaStream as unknown as { toURL?: () => string })?.toURL?.() ?? '',
  );

  useEffect(() => {
    setStreamURL((videoTrack?.mediaStream as unknown as { toURL?: () => string })?.toURL?.() ?? '');
    if (videoTrack instanceof LocalVideoTrack) {
      const onRestarted = (track: Track | null) => {
        setStreamURL((track?.mediaStream as unknown as { toURL?: () => string })?.toURL?.() ?? '');
      };
      videoTrack.on(TrackEvent.Restarted, onRestarted);
      return () => { videoTrack.off(TrackEvent.Restarted, onRestarted); };
    }
    return () => {};
  }, [videoTrack]);

  useEffect(() => {
    if (
      videoTrack instanceof RemoteVideoTrack &&
      videoTrack.isAdaptiveStream
    ) {
      videoTrack.observeElementInfo(elementInfo);
      return () => { videoTrack.stopObservingElementInfo(elementInfo); };
    }
    return () => {};
  }, [videoTrack, elementInfo]);

  return (
    <view
      style={{ ...style, position: 'relative', overflow: 'hidden' } as Record<string, unknown>}
      bindlayout={onLayout}
    >
      <LynxViewPortDetector
        onChange={onVisibility}
        style={containerStyle}
        disabled={!shouldObserveVisibility}
        propKey={videoTrack}
      >
        <livekit-webrtc-view
          streamURL={streamURL}
          objectFit={objectFit}
          mirror={mirror}
          zOrder={zOrder}
          style={containerStyle}
        />
      </LynxViewPortDetector>
    </view>
  );
};

const containerStyle: Record<string, unknown> = { flex: 1, width: '100%' };

// ─────────────────────────────────────────────────────────────────────────────
// VideoViewElementInfo — identical to VideoTrackElementInfo
// ─────────────────────────────────────────────────────────────────────────────

class VideoViewElementInfo implements ElementInfo {
  element: object = {};
  id?: string;
  _width = 0;
  _height = 0;
  _observing = false;
  visible = true;
  visibilityChangedAt: number | undefined;
  pictureInPicture = false;
  handleResize: () => void = () => {};
  handleVisibilityChanged: () => void = () => {};

  width  = (): number => this._width;
  height = (): number => this._height;

  observe(): void       { this._observing = true; }
  stopObserving(): void { this._observing = false; }

  onLayout(width: number, height: number): void {
    this._width  = width;
    this._height = height;
    if (this._observing) this.handleResize();
  }

  onVisibility(isVisible: boolean): void {
    if (this.visible !== isVisible) {
      this.visible = isVisible;
      this.visibilityChangedAt = Date.now();
      if (this._observing) this.handleVisibilityChanged();
    }
  }
}
