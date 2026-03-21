// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxAudioModule.swift
// Lynx NativeModule — audio volume/multiband processors and audio sink.
// Port of LivekitReactNativeModule audio methods.
//
// Registration (LynxInitProcessor.m):
//   [globalConfig registerModule:LynxAudioModule.class];
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import WebRTC

// MARK: - LynxAudioModule

@objc(LynxAudioModule)
public final class LynxAudioModule: NSObject {

    @objc public var eventEmitter: LynxEventEmitter?

    private let rendererManager = LynxAudioRendererManager()

    // MARK: - Module registration

    @objc public static func name() -> String { "LynxAudioModule" }

    @objc public static func methodLookup() -> [String: String] {
        return [
            "createVolumeProcessor":          NSStringFromSelector(#selector(createVolumeProcessor(_:trackId:callback:))),
            "deleteVolumeProcessor":          NSStringFromSelector(#selector(deleteVolumeProcessor(_:pcId:trackId:callback:))),
            "createMultibandVolumeProcessor": NSStringFromSelector(#selector(createMultibandVolumeProcessor(_:pcId:trackId:callback:))),
            "deleteMultibandVolumeProcessor": NSStringFromSelector(#selector(deleteMultibandVolumeProcessor(_:pcId:trackId:callback:))),
            "createAudioSinkListener":        NSStringFromSelector(#selector(createAudioSinkListener(_:trackId:callback:))),
            "deleteAudioSinkListener":        NSStringFromSelector(#selector(deleteAudioSinkListener(_:pcId:trackId:callback:))),
            "setDefaultAudioTrackVolume":     NSStringFromSelector(#selector(setDefaultAudioTrackVolume(_:callback:))),
        ]
    }

    // MARK: - Volume Processor

    @objc func createVolumeProcessor(
        _ pcId: Double,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        guard let emitter = eventEmitter else {
            callback("eventEmitter not set", nil)
            return
        }
        let renderer = LynxVolumeAudioRenderer(intervalMs: 40.0, eventEmitter: emitter)
        let tag = rendererManager.register(renderer)
        renderer.reactTag = tag
        attach(renderer: renderer, pcId: Int(pcId), trackId: trackId)
        callback(nil, tag)
    }

    @objc func deleteVolumeProcessor(
        _ tag: String,
        pcId: Double,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        detach(rendererTag: tag, pcId: Int(pcId), trackId: trackId)
        rendererManager.unregister(forTag: tag)
        callback(nil, nil)
    }

    // MARK: - Multiband Volume Processor

    @objc func createMultibandVolumeProcessor(
        _ optionsJson: String,
        pcId: Double,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        guard let emitter = eventEmitter else {
            callback("eventEmitter not set", nil)
            return
        }

        let opts = parseJSON(optionsJson) ?? [:]
        let bands = opts["bands"] as? Int ?? 5
        let minFreq = (opts["minFrequency"] as? NSNumber)?.floatValue ?? 1000
        let maxFreq = (opts["maxFrequency"] as? NSNumber)?.floatValue ?? 8000
        let interval = (opts["updateInterval"] as? NSNumber)?.floatValue ?? 40

        let renderer = LynxMultibandVolumeAudioRenderer(
            bands: bands,
            minFrequency: minFreq,
            maxFrequency: maxFreq,
            intervalMs: interval,
            eventEmitter: emitter
        )
        let tag = rendererManager.register(renderer)
        renderer.reactTag = tag
        attach(renderer: renderer, pcId: Int(pcId), trackId: trackId)
        callback(nil, tag)
    }

    @objc func deleteMultibandVolumeProcessor(
        _ tag: String,
        pcId: Double,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        detach(rendererTag: tag, pcId: Int(pcId), trackId: trackId)
        rendererManager.unregister(forTag: tag)
        callback(nil, nil)
    }

    // MARK: - Audio Sink Listener

    @objc func createAudioSinkListener(
        _ pcId: Double,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        guard let emitter = eventEmitter else {
            callback("eventEmitter not set", nil)
            return
        }
        let renderer = LynxAudioSinkRenderer(eventEmitter: emitter)
        let tag = rendererManager.register(renderer)
        renderer.reactTag = tag
        attach(renderer: renderer, pcId: Int(pcId), trackId: trackId)
        callback(nil, tag)
    }

    @objc func deleteAudioSinkListener(
        _ tag: String,
        pcId: Double,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        detach(rendererTag: tag, pcId: Int(pcId), trackId: trackId)
        rendererManager.unregisterAndDetach(forTag: tag)
        callback(nil, nil)
    }

    // MARK: - Default volume

    @objc func setDefaultAudioTrackVolume(
        _ volume: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        // Stored globally — applied when new tracks are subscribed.
        LynxWebRTCDefaults.defaultRemoteAudioVolume = volume
        callback(nil, nil)
    }

    // MARK: - Private attach / detach

    private static let localPcId = -1

    private func attach(
        renderer: RTCAudioRenderer,
        pcId: Int,
        trackId: String
    ) {
        Task {
            if pcId == Self.localPcId {
                // Local mic — route through audio processing pipeline
                LynxAudioProcessingManager.shared.addLocalAudioRenderer(renderer)
            } else {
                guard let track = await TrackRegistry.shared.getAudioTrack(
                    pcId: pcId,
                    trackId: trackId
                ) else {
                    print("[LynxAudioModule] Audio track not found: pcId=\(pcId) trackId=\(trackId)")
                    return
                }
                track.add(renderer)
            }
        }
    }

    private func detach(
        rendererTag: String,
        pcId: Int,
        trackId: String
    ) {
        guard let renderer = rendererManager.renderer(forTag: rendererTag) else { return }
        Task {
            if pcId == Self.localPcId {
                LynxAudioProcessingManager.shared.removeLocalAudioRenderer(renderer)
            } else {
                guard let track = await TrackRegistry.shared.getAudioTrack(
                    pcId: pcId,
                    trackId: trackId
                ) else { return }
                track.remove(renderer)
            }
        }
    }

    // MARK: - JSON helper

    private func parseJSON(_ json: String) -> [String: Any]? {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return obj
    }
}

// MARK: - LynxWebRTCDefaults

/// Simple global defaults shared between modules.
enum LynxWebRTCDefaults {
    static var defaultRemoteAudioVolume: Double = 1.0
}

// MARK: - LynxAudioRendererManager

/// Thread-safe registry of active RTCAudioRenderer instances.
final class LynxAudioRendererManager: @unchecked Sendable {

    private let lock = NSLock()
    private var renderers: [String: RTCAudioRenderer] = [:]

    func register(_ renderer: RTCAudioRenderer) -> String {
        let tag = UUID().uuidString
        lock.withLock { renderers[tag] = renderer }
        return tag
    }

    func unregister(forTag tag: String) {
        lock.withLock { _ = renderers.removeValue(forKey: tag) }
    }

    func unregisterAndDetach(forTag tag: String) {
        lock.withLock { _ = renderers.removeValue(forKey: tag) }
    }

    func renderer(forTag tag: String) -> RTCAudioRenderer? {
        lock.withLock { renderers[tag] }
    }
}
