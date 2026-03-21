// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxMediaStreamModule.swift
// Handles getUserMedia (camera + microphone capture) and enumerateDevices.
// Uses Swift 6 concurrency throughout.
// ─────────────────────────────────────────────────────────────────────────────

import AVFoundation
import Foundation
import WebRTC

// MARK: - LynxMediaStreamModule

/// Shared singleton used by both `LynxWebRTCModule` and `getUserMedia`.
actor LynxMediaStreamModule {

    static let shared = LynxMediaStreamModule()

    private var localAudioSource: RTCAudioSource?
    private var localAudioTrack: RTCAudioTrack?
    private var localVideoSource: RTCVideoSource?
    private var localVideoTrack: RTCVideoTrack?
    private var capturer: RTCCameraVideoCapturer?
    private var capturingFacing: AVCaptureDevice.Position = .front

    private init() {}

    // MARK: - getUserMedia

    func getUserMedia(constraintsJson: String) async throws -> String {
        guard let data = constraintsJson.data(using: .utf8),
              let constraints = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw MediaStreamError.invalidConstraints }

        let factory = PCManager.shared.peerConnectionFactory
        let streamId = "local-\(UUID().uuidString)"
        var trackResults: [[String: Any]] = []

        // ── Audio ────────────────────────────────────────────────────────────
        if constraints["audio"] != nil {
            let audioSource = factory.audioSource(
                with: RTCMediaConstraints(
                    mandatoryConstraints: nil,
                    optionalConstraints: nil
                )
            )
            let audioTrack = factory.audioTrack(with: audioSource, trackId: UUID().uuidString)
            localAudioSource = audioSource
            localAudioTrack = audioTrack

            await TrackRegistry.shared.registerTrack(audioTrack, pcId: -1, streamIds: [streamId])
            trackResults.append([
                "id": audioTrack.trackId,
                "kind": "audio",
                "label": "microphone",
                "settings": [:],
            ])
        }

        // ── Video ─────────────────────────────────────────────────────────────
        if let videoConstraints = constraints["video"] {
            let facingMode = extractFacingMode(videoConstraints)
            let position: AVCaptureDevice.Position = facingMode == "environment" ? .back : .front
            let (width, height, fps) = extractVideoDimensions(videoConstraints)

            let videoSource = factory.videoSource()
            let videoTrack = factory.videoTrack(with: videoSource, trackId: UUID().uuidString)
            localVideoSource = videoSource
            localVideoTrack = videoTrack
            capturingFacing = position

            let videoCapturer = RTCCameraVideoCapturer(delegate: videoSource)
            capturer = videoCapturer

            try await startCapture(
                capturer: videoCapturer,
                position: position,
                width: width,
                height: height,
                fps: fps
            )

            await TrackRegistry.shared.registerTrack(videoTrack, pcId: -1, streamIds: [streamId])
            trackResults.append([
                "id": videoTrack.trackId,
                "kind": "video",
                "label": "camera",
                "settings": [
                    "width": width,
                    "height": height,
                    "frameRate": fps,
                    "facingMode": facingMode,
                ],
            ])
        }

        let result: [String: Any] = [
            "streamId": streamId,
            "tracks": trackResults,
        ]
        guard let resultData = try? JSONSerialization.data(withJSONObject: result),
              let resultStr = String(data: resultData, encoding: .utf8)
        else { throw MediaStreamError.serializationFailed }

        return resultStr
    }

    // MARK: - enumerateDevices

    func enumerateDevices() async -> String {
        var devices: [[String: Any]] = []

        // Audio inputs
        let audioSession = AVAudioSession.sharedInstance()
        for input in audioSession.availableInputs ?? [] {
            devices.append([
                "deviceId": input.uid,
                "groupId": input.portType.rawValue,
                "kind": "audioinput",
                "label": input.portName,
            ])
        }

        // Video inputs
        for device in AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInTelephotoCamera],
            mediaType: .video,
            position: .unspecified
        ).devices {
            devices.append([
                "deviceId": device.uniqueID,
                "groupId": device.modelID,
                "kind": "videoinput",
                "label": device.localizedName,
            ])
        }

        // Audio outputs — iOS only provides default + speaker
        devices.append(["deviceId": "default", "groupId": "output", "kind": "audiooutput", "label": "Default"])
        devices.append(["deviceId": "force_speaker", "groupId": "output", "kind": "audiooutput", "label": "Speaker"])

        guard let data = try? JSONSerialization.data(withJSONObject: devices),
              let str = String(data: data, encoding: .utf8)
        else { return "[]" }
        return str
    }

    // MARK: - Camera helpers

    func switchCamera() async throws {
        guard let videoCapturer = capturer else { return }
        let newPosition: AVCaptureDevice.Position = capturingFacing == .front ? .back : .front
        capturingFacing = newPosition

        guard let device = bestDevice(for: newPosition) else {
            throw MediaStreamError.cameraNotFound
        }
        let format = bestFormat(for: device, width: 1280, height: 720)
        let fps = bestFPS(for: format, desired: 30)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            videoCapturer.startCapture(with: device, format: format, fps: fps) { err in
                if let err { cont.resume(throwing: err) }
                else { cont.resume() }
            }
        }
    }

    // MARK: - Private

    private func startCapture(
        capturer: RTCCameraVideoCapturer,
        position: AVCaptureDevice.Position,
        width: Int,
        height: Int,
        fps: Int
    ) async throws {
        guard let device = bestDevice(for: position) else {
            throw MediaStreamError.cameraNotFound
        }
        let format = bestFormat(for: device, width: width, height: height)
        let actualFps = bestFPS(for: format, desired: fps)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            capturer.startCapture(with: device, format: format, fps: actualFps) { err in
                if let err { cont.resume(throwing: err) }
                else { cont.resume() }
            }
        }
    }

    private func bestDevice(for position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        RTCCameraVideoCapturer.captureDevices().first { $0.position == position }
    }

    private func bestFormat(
        for device: AVCaptureDevice,
        width: Int,
        height: Int
    ) -> AVCaptureDevice.Format {
        var bestFormat = device.activeFormat
        var bestDiff = Int.max

        for format in RTCCameraVideoCapturer.supportedFormats(for: device) {
            let dims = CMVideoFormatDescriptionGetDimensions(
                format.formatDescription
            )
            let diff = abs(Int(dims.width) - width) + abs(Int(dims.height) - height)
            if diff < bestDiff {
                bestDiff = diff
                bestFormat = format
            }
        }
        return bestFormat
    }

    private func bestFPS(
        for format: AVCaptureDevice.Format,
        desired: Int
    ) -> Int {
        let ranges = format.videoSupportedFrameRateRanges
        let maxFPS = ranges.map { Int($0.maxFrameRate) }.max() ?? 30
        return min(desired, maxFPS)
    }

    private func extractFacingMode(_ constraint: Any) -> String {
        if let dict = constraint as? [String: Any] {
            if let fm = dict["facingMode"] as? String { return fm }
            if let exact = (dict["facingMode"] as? [String: Any])?["exact"] as? String { return exact }
            if let ideal = (dict["facingMode"] as? [String: Any])?["ideal"] as? String { return ideal }
        }
        return "user"
    }

    private func extractVideoDimensions(_ constraint: Any) -> (width: Int, height: Int, fps: Int) {
        guard let dict = constraint as? [String: Any] else {
            return (1280, 720, 30)
        }
        func intValue(_ key: String) -> Int? {
            if let n = dict[key] as? Int { return n }
            if let d = (dict[key] as? [String: Any])?["ideal"] as? Int { return d }
            if let d = (dict[key] as? [String: Any])?["exact"] as? Int { return d }
            return nil
        }
        return (
            intValue("width") ?? 1280,
            intValue("height") ?? 720,
            intValue("frameRate") ?? 30
        )
    }
}

// MARK: - MediaStreamError

enum MediaStreamError: LocalizedError {
    case invalidConstraints
    case cameraNotFound
    case serializationFailed

    var errorDescription: String? {
        switch self {
        case .invalidConstraints:  return "Invalid getUserMedia constraints"
        case .cameraNotFound:      return "Camera device not found for requested position"
        case .serializationFailed: return "Failed to serialize getUserMedia result"
        }
    }
}
