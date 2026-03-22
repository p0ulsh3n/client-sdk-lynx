// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/audio/LynxAudioRenderers.swift
// Port of VolumeAudioRenderer, MultibandVolumeAudioRenderer, AudioSinkRenderer
// from the React Native SDK to Lynx.
//
// Replaces: RCTEventEmitter → LynxEventEmitter
// All audio processing logic is preserved verbatim.
// ─────────────────────────────────────────────────────────────────────────────

import AVFoundation
import Foundation
import WebRTC

// MARK: - Event name constants (mirrors LKEvents in RN SDK)

private enum LynxAudioEvents {
    static let volumeProcessed = "LK_VOLUME_PROCESSED"
    static let multibandProcessed = "LK_MULTIBAND_PROCESSED"
    static let audioData = "LK_AUDIO_DATA"
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - BaseVolumeAudioRenderer
// ─────────────────────────────────────────────────────────────────────────────

/// Base class for volume tracking. Processes every Nth PCM frame (throttled).
public class BaseVolumeAudioRenderer: NSObject, RTCAudioRenderer {

    private let frameInterval: Int
    private var skippedFrames = 0

    public init(intervalMs: Double = 30) {
        // 10 ms per WebRTC audio frame → intervalMs / 10
        frameInterval = Int((intervalMs / 10.0).rounded())
    }

    public func render(pcmBuffer: AVAudioPCMBuffer) {
        if skippedFrames < frameInterval - 1 {
            skippedFrames += 1
            return
        }
        skippedFrames = 0
        guard let converted = pcmBuffer.convert(toCommonFormat: .pcmFormatFloat32) else {
            return
        }
        let levels = converted.audioLevels()
        onVolumeCalculated(levels)
    }

    // Override in subclasses
    public func onVolumeCalculated(_ audioLevels: [AudioLevel]) {}
}

// MARK: - LynxVolumeAudioRenderer

/// Measures RMS volume and emits `LK_VOLUME_PROCESSED` via Lynx GlobalEventEmitter.
public final class LynxVolumeAudioRenderer: BaseVolumeAudioRenderer {

    public var reactTag: String?
    private weak var eventEmitter: LynxEventEmitter?

    public init(intervalMs: Double, eventEmitter: LynxEventEmitter) {
        self.eventEmitter = eventEmitter
        super.init(intervalMs: intervalMs)
    }

    override public func onVolumeCalculated(_ audioLevels: [AudioLevel]) {
        guard
            let rms = audioLevels.combine()?.average,
            let tag = reactTag
        else { return }

        let payload: [String: Any] = ["volume": rms, "id": tag]
        emitEvent(LynxAudioEvents.volumeProcessed, payload: payload)
    }

    private func emitEvent(_ name: String, payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let str = String(data: data, encoding: .utf8)
        else { return }
        eventEmitter?.sendEvent(name, data: str)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - BaseMultibandVolumeAudioRenderer
// ─────────────────────────────────────────────────────────────────────────────

/// Base class for multiband FFT volume tracking.
public class BaseMultibandVolumeAudioRenderer: NSObject, RTCAudioRenderer {

    private let frameInterval: Int
    private var skippedFrames = 0
    private let audioProcessor: AudioVisualizeProcessor

    public init(
        bands: Int,
        minFrequency: Float,
        maxFrequency: Float,
        intervalMs: Float
    ) {
        frameInterval = Int((intervalMs / 10.0).rounded())
        audioProcessor = AudioVisualizeProcessor(
            minFrequency: minFrequency,
            maxFrequency: maxFrequency,
            bandsCount: bands
        )
    }

    public func render(pcmBuffer: AVAudioPCMBuffer) {
        if skippedFrames < frameInterval - 1 {
            skippedFrames += 1
            return
        }
        skippedFrames = 0
        guard let magnitudes = audioProcessor.process(pcmBuffer: pcmBuffer) else { return }
        onMagnitudesCalculated(magnitudes)
    }

    // Override in subclasses
    public func onMagnitudesCalculated(_ magnitudes: [Float]) {}
}

// MARK: - LynxMultibandVolumeAudioRenderer

/// Computes FFT magnitudes across frequency bands and emits `LK_MULTIBAND_PROCESSED`.
public final class LynxMultibandVolumeAudioRenderer: BaseMultibandVolumeAudioRenderer {

    public var reactTag: String?
    private weak var eventEmitter: LynxEventEmitter?

    public init(
        bands: Int,
        minFrequency: Float,
        maxFrequency: Float,
        intervalMs: Float,
        eventEmitter: LynxEventEmitter
    ) {
        self.eventEmitter = eventEmitter
        super.init(
            bands: bands,
            minFrequency: minFrequency,
            maxFrequency: maxFrequency,
            intervalMs: intervalMs
        )
    }

    override public func onMagnitudesCalculated(_ magnitudes: [Float]) {
        guard !magnitudes.isEmpty, let tag = reactTag else { return }

        let payload: [String: Any] = [
            "magnitudes": magnitudes,
            "id": tag,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let str = String(data: data, encoding: .utf8)
        else { return }
        eventEmitter?.sendEvent(LynxAudioEvents.multibandProcessed, data: str)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - BaseAudioSinkRenderer
// ─────────────────────────────────────────────────────────────────────────────

/// Base class for raw PCM audio sink (delivers raw audio frames to JS).
public class BaseAudioSinkRenderer: NSObject, RTCAudioRenderer {

    public func render(pcmBuffer: AVAudioPCMBuffer) {
        onData(pcmBuffer)
    }

    public func onData(_ pcmBuffer: AVAudioPCMBuffer) {}
}

// MARK: - LynxAudioSinkRenderer

/// Delivers raw PCM data as base64-encoded events via `LK_AUDIO_DATA`.
public final class LynxAudioSinkRenderer: BaseAudioSinkRenderer {

    public var reactTag: String?
    private weak var eventEmitter: LynxEventEmitter?

    public init(eventEmitter: LynxEventEmitter) {
        self.eventEmitter = eventEmitter
    }

    override public func onData(_ pcmBuffer: AVAudioPCMBuffer) {
        guard
            pcmBuffer.format.commonFormat == .pcmFormatInt16,
            let channelData = pcmBuffer.int16ChannelData,
            let tag = reactTag
        else { return }

        let channelCount = Int(pcmBuffer.format.channelCount)
        let channels = UnsafeBufferPointer(start: channelData, count: channelCount)
        let byteLength = Int(pcmBuffer.frameCapacity) *
            Int(pcmBuffer.format.streamDescription.pointee.mBytesPerFrame)
        let rawData = Data(bytes: channels[0], count: byteLength)
        let encoded = rawData.base64EncodedString()

        let payload: [String: Any] = ["data": encoded, "id": tag]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let str = String(data: jsonData, encoding: .utf8)
        else { return }
        eventEmitter?.sendEvent(LynxAudioEvents.audioData, data: str)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Audio Processing Manager
// ─────────────────────────────────────────────────────────────────────────────

// The canonical audio processing manager is LKLynxAudioProcessingManager (Obj-C).
// See ios/audio/LKLynxAudioProcessingManager.h for the full interface.
