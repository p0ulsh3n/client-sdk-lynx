import {
  type ElementInfo,
  LocalVideoTrack,
  Track,
  TrackEvent,
} from 'livekit-client';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from '@lynx-js/react';
import * as React from '@lynx-js/react';
import { RemoteVideoTrack } from 'livekit-client';
import type { TrackReference } from '@livekit/components-react';
import LynxViewPortDetector from './LynxViewPortDetector';

export type VideoTrackProps = {
  /** The track reference to display. */
  trackRef: TrackReference | undefined;
  /** CSS-style object applied to the video container. */
  style?: Record<string, unknown>;
  /**
   * How video content is resized to fit its container.
   * `'cover'` (default): fills container, may crop.
   * `'contain'`: shows full video, may letterbox.
   */
  objectFit?: 'cover' | 'contain';
  /**
   * Mirror the video horizontally.
   * Useful for front-facing camera self-view.
   */
  mirror?: boolean;
  /**
   * Z-stacking order within the video view hierarchy.
   * Higher values appear on top.
   */
  zOrder?: number;
};

export const VideoTrack = forwardRef<unknown, VideoTrackProps>(
  (
    {
      style = {},
      trackRef,
      objectFit = 'cover',
      zOrder,
      mirror,
    }: VideoTrackProps,
    ref: React.ForwardedRef<unknown>,
  ) => {
    // ── ElementInfo for adaptive stream ─────────────────────────────────────
    const [elementInfo] = useState(() => {
      const info = new VideoTrackElementInfo();
      info.id = trackRef?.publication?.trackSid ?? undefined;
      return info;
    });

    // ── Layout change → update element dimensions ────────────────────────────
    const onLayout = useCallback(
      (event: { detail?: { width?: number; height?: number } }) => {
        const w = event.detail?.width ?? 0;
        const h = event.detail?.height ?? 0;
        elementInfo.onLayout(w, h);
      },
      [elementInfo],
    );

    // ── Viewport visibility → adaptive stream ───────────────────────────────
    const onVisibilityChange = useCallback(
      (isVisible: boolean) => elementInfo.onVisibility(isVisible),
      [elementInfo],
    );

    const videoTrack = trackRef?.publication.track;

    // Only observe visibility for remote adaptive-stream tracks
    const shouldObserveVisibility = useMemo(
      () =>
        videoTrack instanceof RemoteVideoTrack &&
        videoTrack.isAdaptiveStream,
      [videoTrack],
    );

    // ── Sync MediaStream URL ────────────────────────────────────────────────
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

    // ── Adaptive stream lifecycle ───────────────────────────────────────────
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

    // ── Render ──────────────────────────────────────────────────────────────
    return (
      <view
        style={{ ...style, position: 'relative', overflow: 'hidden' } as Record<string, unknown>}
        bindlayout={onLayout}
      >
        <LynxViewPortDetector
          onChange={onVisibilityChange}
          style={containerStyle}
          disabled={!shouldObserveVisibility}
          propKey={videoTrack}
        >
          {/* <livekit-webrtc-view> is the Custom Native Component
              registered as "livekit-webrtc-view" in the Lynx app setup. */}
          <livekit-webrtc-view
            ref={ref}
            streamURL={streamURL}
            objectFit={objectFit}
            mirror={mirror}
            zOrder={zOrder}
            style={videoStyle}
          />
        </LynxViewPortDetector>
      </view>
    );
  },
);

VideoTrack.displayName = 'VideoTrack';

const containerStyle: Record<string, unknown> = {
  flex: 1,
  width: '100%',
};

const videoStyle: Record<string, unknown> = {
  flex: 1,
  width: '100%',
};

class VideoTrackElementInfo implements ElementInfo {
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

  observe(): void   { this._observing = true; }
  stopObserving(): void { this._observing = false; }

  /** Called by the `bindlayout` handler with the element's dimensions. */
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
