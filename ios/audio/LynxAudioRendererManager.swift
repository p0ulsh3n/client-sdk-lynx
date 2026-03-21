// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/audio/LynxAudioRendererManager.swift
// Port of AudioRendererManager.swift from @livekit/react-native.
//
// Key changes vs RN original:
//   - RCTBridge + WebRTCModule.track(forId:pcId:) → TrackRegistry actor
//   - LKAudioProcessingManager → LKLynxAudioProcessingManager (ObjC)
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import WebRTC

// MARK: - LynxAudioRendererManager

/// Manages the lifecycle of `RTCAudioRenderer` instances attached to tracks.
/// Replaces `AudioRendererManager` from the React Native SDK.
public final class LynxAudioRendererManager: @unchecked Sendable {

    private let lock = NSLock()
    private var renderers: [String: RTCAudioRenderer] = [:]

    public init() {}

    // MARK: - Registration

    /// Registers a renderer and returns its unique tag.
    public func register(_ renderer: RTCAudioRenderer) -> String {
        let tag = UUID().uuidString
        lock.withLock { renderers[tag] = renderer }
        return tag
    }

    public func unregister(forTag tag: String) {
        lock.withLock { _ = renderers.removeValue(forKey: tag) }
    }

    public func renderer(forTag tag: String) -> RTCAudioRenderer? {
        lock.withLock { renderers[tag] }
    }

    // MARK: - Attach / Detach

    /// Attaches a renderer to an audio track.
    ///
    /// - If `pcId == -1`, the renderer receives local mic PCM data via
    ///   `LKLynxAudioProcessingManager` (capture post-processing pipeline).
    /// - Otherwise, looks up the remote `RTCAudioTrack` in `TrackRegistry`
    ///   and calls `track.add(renderer)`.
    public func attach(
        renderer: RTCAudioRenderer,
        pcId: Int,
        trackId: String
    ) {
        if pcId == -1 {
            LKLynxAudioProcessingManager.sharedInstance()
                .addLocalAudioRenderer(renderer)
        } else {
            Task {
                guard let track = await TrackRegistry.shared.getAudioTrack(
                    pcId: pcId,
                    trackId: trackId
                ) else {
                    lkLynxLog("LynxAudioRendererManager: audio track not found pcId=\(pcId) trackId=\(trackId)")
                    return
                }
                track.add(renderer)
            }
        }
    }

    public func detach(
        rendererTag: String,
        pcId: Int,
        trackId: String
    ) {
        guard let renderer = renderer(forTag: rendererTag) else {
            lkLynxLog("LynxAudioRendererManager: renderer not found for tag \(rendererTag)")
            return
        }
        detach(renderer: renderer, pcId: pcId, trackId: trackId)
    }

    public func detach(
        renderer: RTCAudioRenderer,
        pcId: Int,
        trackId: String
    ) {
        if pcId == -1 {
            LKLynxAudioProcessingManager.sharedInstance()
                .removeLocalAudioRenderer(renderer)
        } else {
            Task {
                guard let track = await TrackRegistry.shared.getAudioTrack(
                    pcId: pcId,
                    trackId: trackId
                ) else { return }
                track.remove(renderer)
            }
        }
    }
}

// MARK: - Logging helper

/// Port of `lklog` from Logging.swift in the RN SDK.
public func lkLynxLog(
    _ message: Any,
    function: String = #function,
    file: String = #file,
    line: Int = #line
) {
    let fileName = (file as NSString).lastPathComponent
    print("[livekit-lynx] \(fileName).\(function):\(line) — \(message)")
}
