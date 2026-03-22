// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.swift
// Custom Native Component — renders a WebRTC video stream.
//
// Tag name: "livekit-webrtc-view"
//
// Registration (LynxInitProcessor.m):
//   [globalConfig registerUI:@"livekit-webrtc-view"
//              withClass:LynxVideoComponentUI.class];
//
// Usage in ReactLynx:
//   <livekit-webrtc-view
//     streamURL="livekit-stream://..."
//     objectFit="cover"
//     mirror={true}
//     zOrder={1}
//   />
//
// NOTE: Prop setters are registered via LYNX_PROP_SETTER macros in
//       LynxVideoComponent.m (Obj-C). Swift methods are called through @objc.
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import UIKit
import WebRTC
import Lynx

// MARK: - LynxVideoShadowNode

@objc(LynxVideoShadowNode)
public final class LynxVideoShadowNode: LynxShadowNode {}

// MARK: - LynxVideoComponentUI (Swift logic, Lynx wiring via Obj-C companion)

/// LynxUI requires its generic parameter to be a UIView subclass.
/// We use RTCMTLVideoView directly as the view type.
@objc(LynxVideoComponentUI)
public final class LynxVideoComponentUI: LynxUI<RTCMTLVideoView> {

    private var currentTrack: RTCVideoTrack?
    private var streamURL: String?

    // MARK: - Prop setters (called by LYNX_PROP_SETTER macros in .m companion)

    /// The opaque stream URL produced by `MediaStream.toURL()`.
    @objc public func setStreamURL(_ urlString: String) {
        guard urlString != streamURL else { return }
        streamURL = urlString

        let videoView: RTCMTLVideoView = self.view()
        currentTrack?.remove(videoView)
        currentTrack = nil

        let streamId = urlString.replacingOccurrences(of: "livekit-stream://", with: "")
        Task { @MainActor in
            guard let track = await self.findVideoTrack(forStreamId: streamId) else { return }
            self.currentTrack = track
            let v: RTCMTLVideoView = self.view()
            track.add(v)
        }
    }

    /// "cover" (default) → scaleAspectFill  |  "contain" → scaleAspectFit
    @objc public func setObjectFit(_ fit: String) {
        let videoView: RTCMTLVideoView = self.view()
        videoView.videoContentMode = fit == "contain"
            ? .scaleAspectFit
            : .scaleAspectFill
    }

    /// Mirror horizontally (front-facing camera self-view).
    @objc public func setMirror(_ mirror: Bool) {
        let v: RTCMTLVideoView = self.view()
        v.transform = mirror
            ? CGAffineTransform(scaleX: -1, y: 1)
            : .identity
    }

    /// Z-stacking within the Lynx view hierarchy.
    @objc public func setZOrder(_ z: NSNumber) {
        let v: RTCMTLVideoView = self.view()
        v.layer.zPosition = CGFloat(z.floatValue)
    }

    // MARK: - Private

    private func findVideoTrack(forStreamId id: String) async -> RTCVideoTrack? {
        guard let stream = await TrackRegistry.shared.getStream(id) else { return nil }
        return stream.videoTracks.first
    }

    deinit {
        let videoView: RTCMTLVideoView = self.view()
        currentTrack?.remove(videoView)
        currentTrack = nil
    }
}
