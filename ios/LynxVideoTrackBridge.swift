// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoTrackBridge.swift
// Bridges Swift actor `TrackRegistry` to Obj-C via a callback-based API.
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import WebRTC

/// Obj-C callable bridge for looking up video tracks from the Swift `TrackRegistry` actor.
@objc(LynxVideoTrackBridge)
public final class LynxVideoTrackBridge: NSObject {

    /// Asynchronously fetches the first video track for a given stream ID.
    /// - Parameters:
    ///   - streamId: The identifier of the stream (without the `livekit-stream://` prefix).
    ///   - completion: Called on the main thread with the video track, or `nil` if not found.
    @objc public static func findVideoTrack(
        forStreamId streamId: String,
        completion: @escaping (RTCVideoTrack?) -> Void
    ) {
        Task { @MainActor in
            let stream = await TrackRegistry.shared.getStream(streamId)
            completion(stream?.videoTracks.first)
        }
    }
}
