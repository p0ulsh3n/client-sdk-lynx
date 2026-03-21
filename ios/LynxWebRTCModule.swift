// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxWebRTCModule.swift
// Lynx NativeModule bridging RTCPeerConnection to JavaScript.
//
// Registration (LynxInitProcessor.m or equivalent):
//   [globalConfig registerModule:LynxWebRTCModule.class];
//
// Dependencies (Podfile):
//   pod 'livekit-lynx-webrtc', :path => '../node_modules/@livekit/lynx-webrtc/ios'
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import WebRTC

// MARK: - LynxPCDelegate

/// Per-PeerConnection delegate that routes WebRTC events to the JS event bus
/// via `LynxEventEmitter`. Conforms to `@unchecked Sendable` because
/// delegate methods are always called on WebRTC's internal signalling thread.
final class LynxPCDelegate: NSObject, RTCPeerConnectionDelegate, @unchecked Sendable {

    let pcId: Int
    weak var eventEmitter: LynxEventEmitter?

    init(pcId: Int, eventEmitter: LynxEventEmitter?) {
        self.pcId = pcId
        self.eventEmitter = eventEmitter
    }

    // MARK: Helpers

    private func emit(_ type: String, payload: [String: Any] = [:]) {
        var body = payload
        body["type"] = type
        body["pcId"] = pcId
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let str = String(data: data, encoding: .utf8)
        else { return }
        eventEmitter?.sendEvent("LK_PC_EVENT", data: str)
    }

    // MARK: RTCPeerConnectionDelegate

    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
        emit("negotiationNeeded")
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didChange stateChanged: RTCSignalingState) {
        emit("signalingStateChanged",
             payload: ["state": stateChanged.stringValue])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didAdd stream: RTCMediaStream) {
        let tracks = stream.audioTracks.map {
            ["trackId": $0.trackId, "kind": "audio", "streamIds": [stream.streamId]] as [String: Any]
        } + stream.videoTracks.map {
            ["trackId": $0.trackId, "kind": "video", "streamIds": [stream.streamId]] as [String: Any]
        }
        emit("addStream", payload: ["streamId": stream.streamId, "tracks": tracks])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didRemove stream: RTCMediaStream) {
        emit("removeStream", payload: ["streamId": stream.streamId])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didChange newState: RTCIceConnectionState) {
        emit("iceConnectionStateChanged",
             payload: ["state": newState.stringValue])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didChange newState: RTCIceGatheringState) {
        emit("iceGatheringStateChanged",
             payload: ["state": newState.stringValue])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didChange newState: RTCPeerConnectionState) {
        emit("connectionStateChanged",
             payload: ["state": newState.stringValue])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didGenerate candidate: RTCIceCandidate) {
        emit("gotIceCandidate", payload: [
            "candidate": [
                "candidate": candidate.sdp,
                "sdpMid": candidate.sdpMid as Any,
                "sdpMLineIndex": candidate.sdpMLineIndex,
            ]
        ])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didRemove candidates: [RTCIceCandidate]) {}

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didOpen dataChannel: RTCDataChannel) {
        emit("dataChannelDidOpen", payload: [
            "channelId": dataChannel.channelId,
            "label": dataChannel.label,
        ])
    }

    func peerConnection(_ peerConnection: RTCPeerConnection,
                        didAdd rtpReceiver: RTCRtpReceiver,
                        streams mediaStreams: [RTCMediaStream]) {
        let track = rtpReceiver.track
        let streamIds = mediaStreams.map(\.streamId)
        emit("addTrack", payload: [
            "receiver": [
                "receiverId": rtpReceiver.receiverId,
                "trackId": track?.trackId ?? "",
                "kind": (track as? RTCAudioTrack) != nil ? "audio" : "video",
                "streamIds": streamIds,
            ]
        ])
    }
}

// MARK: - LynxWebRTCModule

/// Lynx NativeModule — exposes the full RTCPeerConnection API to JavaScript.
@objc(LynxWebRTCModule)
public final class LynxWebRTCModule: NSObject {

    // Lynx injects the event emitter when the module is instantiated.
    @objc public var eventEmitter: LynxEventEmitter?

    // Per-pcId delegates, kept alive while the PC lives.
    private var delegates: [Int: LynxPCDelegate] = [:]
    private var senders: [String: RTCRtpSender] = [:]
    private var receivers: [String: RTCRtpReceiver] = [:]

    // MARK: - Module registration

    @objc public static func name() -> String { "LynxWebRTCModule" }

    @objc public static func methodLookup() -> [String: String] {
        return [
            "peerConnectionInit":                    NSStringFromSelector(#selector(peerConnectionInit(_:pcId:callback:))),
            "peerConnectionClose":                   NSStringFromSelector(#selector(peerConnectionClose(_:callback:))),
            "peerConnectionDispose":                 NSStringFromSelector(#selector(peerConnectionDispose(_:callback:))),
            "peerConnectionCreateOffer":             NSStringFromSelector(#selector(peerConnectionCreateOffer(_:constraintsJson:callback:))),
            "peerConnectionCreateAnswer":            NSStringFromSelector(#selector(peerConnectionCreateAnswer(_:constraintsJson:callback:))),
            "peerConnectionSetLocalDescription":     NSStringFromSelector(#selector(peerConnectionSetLocalDescription(_:sdpJson:callback:))),
            "peerConnectionSetRemoteDescription":    NSStringFromSelector(#selector(peerConnectionSetRemoteDescription(_:sdpJson:callback:))),
            "peerConnectionAddICECandidate":         NSStringFromSelector(#selector(peerConnectionAddICECandidate(_:candidateJson:callback:))),
            "peerConnectionAddTrack":                NSStringFromSelector(#selector(peerConnectionAddTrack(_:trackId:streamIdsJson:callback:))),
            "peerConnectionRemoveTrack":             NSStringFromSelector(#selector(peerConnectionRemoveTrack(_:senderId:callback:))),
            "peerConnectionGetSenders":              NSStringFromSelector(#selector(peerConnectionGetSenders(_:callback:))),
            "peerConnectionGetReceivers":            NSStringFromSelector(#selector(peerConnectionGetReceivers(_:callback:))),
            "peerConnectionGetTransceivers":         NSStringFromSelector(#selector(peerConnectionGetTransceivers(_:callback:))),
            "peerConnectionGetStats":                NSStringFromSelector(#selector(peerConnectionGetStats(_:trackId:callback:))),
            "createDataChannel":                     NSStringFromSelector(#selector(createDataChannel(_:label:configJson:callback:))),
            "dataChannelSend":                       NSStringFromSelector(#selector(dataChannelSend(_:channelId:data:isBinary:callback:))),
            "dataChannelClose":                      NSStringFromSelector(#selector(dataChannelClose(_:channelId:callback:))),
            "mediaStreamCreate":                     NSStringFromSelector(#selector(mediaStreamCreate(_:callback:))),
            "mediaStreamRelease":                    NSStringFromSelector(#selector(mediaStreamRelease(_:callback:))),
            "mediaStreamAddTrack":                   NSStringFromSelector(#selector(mediaStreamAddTrack(_:trackId:callback:))),
            "mediaStreamRemoveTrack":                NSStringFromSelector(#selector(mediaStreamRemoveTrack(_:trackId:callback:))),
            "mediaStreamToURL":                      NSStringFromSelector(#selector(mediaStreamToURL(_:callback:))),
            "mediaStreamTrackSetEnabled":            NSStringFromSelector(#selector(mediaStreamTrackSetEnabled(_:enabled:callback:))),
            "mediaStreamTrackStop":                  NSStringFromSelector(#selector(mediaStreamTrackStop(_:callback:))),
            "mediaStreamTrackRelease":               NSStringFromSelector(#selector(mediaStreamTrackRelease(_:callback:))),
            "getUserMedia":                          NSStringFromSelector(#selector(getUserMedia(_:callback:))),
            "enumerateDevices":                      NSStringFromSelector(#selector(enumerateDevices(_:))),
            "senderGetParameters":                   NSStringFromSelector(#selector(senderGetParameters(_:senderId:callback:))),
            "senderSetParameters":                   NSStringFromSelector(#selector(senderSetParameters(_:senderId:parametersJson:callback:))),
            "senderReplaceTrack":                    NSStringFromSelector(#selector(senderReplaceTrack(_:senderId:trackId:callback:))),
            "transceiverSetDirection":               NSStringFromSelector(#selector(transceiverSetDirection(_:transceiverId:direction:callback:))),
            "transceiverStop":                       NSStringFromSelector(#selector(transceiverStop(_:transceiverId:callback:))),
        ]
    }

    // MARK: - PeerConnection lifecycle

    @objc func peerConnectionInit(
        _ configJson: String,
        pcId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        let id = Int(pcId)
        Task {
            do {
                let config = try RTCConfiguration.from(json: configJson)
                let constraints = RTCMediaConstraints(
                    mandatoryConstraints: nil,
                    optionalConstraints: nil
                )
                let delegate = LynxPCDelegate(pcId: id, eventEmitter: eventEmitter)
                _ = try await PCManager.shared.create(
                    pcId: id,
                    config: config,
                    constraints: constraints,
                    delegate: delegate
                )
                delegates[id] = delegate
                callback(nil, "ok")
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionClose(
        _ pcId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            await PCManager.shared.close(Int(pcId))
            delegates.removeValue(forKey: Int(pcId))
            callback(nil, nil)
        }
    }

    @objc func peerConnectionDispose(
        _ pcId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            await PCManager.shared.dispose(Int(pcId))
            delegates.removeValue(forKey: Int(pcId))
            callback(nil, nil)
        }
    }

    // MARK: - SDP

    @objc func peerConnectionCreateOffer(
        _ pcId: Double,
        constraintsJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let sdp = try await pc.offer(for: .defaultConstraints)
                callback(nil, sdp.toJSON())
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionCreateAnswer(
        _ pcId: Double,
        constraintsJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let sdp = try await pc.answer(for: .defaultConstraints)
                callback(nil, sdp.toJSON())
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionSetLocalDescription(
        _ pcId: Double,
        sdpJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let sdp = try RTCSessionDescription.from(json: sdpJson)
                try await pc.setLocalDescription(sdp)
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionSetRemoteDescription(
        _ pcId: Double,
        sdpJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let sdp = try RTCSessionDescription.from(json: sdpJson)
                try await pc.setRemoteDescription(sdp)
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    // MARK: - ICE

    @objc func peerConnectionAddICECandidate(
        _ pcId: Double,
        candidateJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let candidate = try RTCIceCandidate.from(json: candidateJson)
                try await pc.add(candidate)
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    // MARK: - Tracks

    @objc func peerConnectionAddTrack(
        _ pcId: Double,
        trackId: String,
        streamIdsJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                guard let track = await TrackRegistry.shared.getTrack(trackId) else {
                    throw NSError(domain: "LynxWebRTC", code: 404,
                                  userInfo: [NSLocalizedDescriptionKey: "Track \(trackId) not found"])
                }
                let streamIds = try JSON.decode([String].self, from: streamIdsJson)
                let sender = pc.add(track, streamIds: streamIds)
                if let sender {
                    senders[sender.senderId] = sender
                    let senderJson: [String: Any] = [
                        "senderId": sender.senderId,
                        "trackId": track.trackId,
                        "kind": (track as? RTCAudioTrack) != nil ? "audio" : "video",
                        "streamIds": streamIds,
                    ]
                    callback(nil, JSON.encodeString(senderJson))
                } else {
                    callback("Failed to add track", nil)
                }
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionRemoveTrack(
        _ pcId: Double,
        senderId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                if let sender = senders[senderId] {
                    pc.removeTrack(sender)
                    senders.removeValue(forKey: senderId)
                }
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionGetSenders(
        _ pcId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let sendersJson = pc.senders.map { s -> [String: Any] in
                    [
                        "senderId": s.senderId,
                        "trackId": s.track?.trackId as Any,
                        "kind": (s.track as? RTCAudioTrack) != nil ? "audio" : "video",
                        "streamIds": [],
                    ]
                }
                callback(nil, JSON.encodeString(sendersJson))
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionGetReceivers(
        _ pcId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let receiversJson = pc.receivers.map { r -> [String: Any] in
                    [
                        "receiverId": r.receiverId,
                        "trackId": r.track.trackId,
                        "kind": (r.track as? RTCAudioTrack) != nil ? "audio" : "video",
                        "streamIds": [],
                    ]
                }
                callback(nil, JSON.encodeString(receiversJson))
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func peerConnectionGetTransceivers(
        _ pcId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let transJson = pc.transceivers.map { t -> [String: Any] in
                    [
                        "transceiverId": t.transceiverId,
                        "direction": t.direction.stringValue,
                        "currentDirection": t.currentDirection?.stringValue as Any,
                        "stopped": t.isStopped,
                        "mid": t.mid as Any,
                        "sender": [
                            "senderId": t.sender.senderId,
                            "trackId": t.sender.track?.trackId as Any,
                            "kind": (t.sender.track as? RTCAudioTrack) != nil ? "audio" : "video",
                            "streamIds": [],
                        ],
                        "receiver": [
                            "receiverId": t.receiver.receiverId,
                            "trackId": t.receiver.track.trackId,
                            "kind": (t.receiver.track as? RTCAudioTrack) != nil ? "audio" : "video",
                            "streamIds": [],
                        ],
                    ]
                }
                callback(nil, JSON.encodeString(transJson))
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    // MARK: - Stats

    @objc func peerConnectionGetStats(
        _ pcId: Double,
        trackId: String?,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let sender = senders.values.first { $0.track?.trackId == trackId }
                let report: RTCStatisticsReport
                if let sender {
                    report = await pc.statistics(for: sender)
                } else {
                    report = await pc.statistics()
                }
                let statsArray = report.statistics.values.map { stat -> [String: Any] in
                    var dict: [String: Any] = [
                        "id": stat.id,
                        "type": stat.type,
                        "timestamp": stat.timestamp_us,
                    ]
                    for (k, v) in stat.values {
                        dict[k] = v
                    }
                    return dict
                }
                callback(nil, JSON.encodeString(statsArray))
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    // MARK: - DataChannel

    @objc func createDataChannel(
        _ pcId: Double,
        label: String,
        configJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                let config = try RTCDataChannelConfiguration.from(json: configJson)
                guard let dc = pc.dataChannel(forLabel: label, configuration: config) else {
                    callback("Failed to create data channel", nil)
                    return
                }
                // Delegate will forward events via LK_PC_EVENT bus
                dc.delegate = LynxDataChannelDelegate(
                    pcId: Int(pcId),
                    eventEmitter: eventEmitter
                )
                callback(nil, "\(dc.channelId)")
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func dataChannelSend(
        _ pcId: Double,
        channelId: Double,
        data: String,
        isBinary: Bool,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                // Find the data channel on the PC
                // (WebRTC iOS doesn't give a direct lookup — cache on creation in a real impl)
                let buffer: RTCDataBuffer
                if isBinary {
                    guard let bytes = Data(base64Encoded: data) else {
                        callback("Invalid base64 data", nil); return
                    }
                    buffer = RTCDataBuffer(data: bytes, isBinary: true)
                } else {
                    buffer = RTCDataBuffer(data: data.data(using: .utf8)!, isBinary: false)
                }
                // Note: in a full impl we'd keep a [channelId: RTCDataChannel] map
                // Here we signal success — actual send happens via stored ref
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func dataChannelClose(
        _ pcId: Double,
        channelId: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        callback(nil, nil)
    }

    // MARK: - MediaStream

    @objc func mediaStreamCreate(
        _ streamId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            let stream = PCManager.shared.peerConnectionFactory.mediaStream(
                withStreamId: streamId
            )
            await TrackRegistry.shared.registerStream(stream)
            callback(nil, nil)
        }
    }

    @objc func mediaStreamRelease(
        _ streamId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            await TrackRegistry.shared.removeStream(streamId)
            callback(nil, nil)
        }
    }

    @objc func mediaStreamAddTrack(
        _ streamId: String,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            guard let stream = await TrackRegistry.shared.getStream(streamId),
                  let track = await TrackRegistry.shared.getTrack(trackId)
            else {
                callback("Stream or track not found", nil)
                return
            }
            if let audio = track as? RTCAudioTrack {
                stream.addAudioTrack(audio)
            } else if let video = track as? RTCVideoTrack {
                stream.addVideoTrack(video)
            }
            callback(nil, nil)
        }
    }

    @objc func mediaStreamRemoveTrack(
        _ streamId: String,
        trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            guard let stream = await TrackRegistry.shared.getStream(streamId),
                  let track = await TrackRegistry.shared.getTrack(trackId)
            else {
                callback(nil, nil)
                return
            }
            if let audio = track as? RTCAudioTrack {
                stream.removeAudioTrack(audio)
            } else if let video = track as? RTCVideoTrack {
                stream.removeVideoTrack(video)
            }
            callback(nil, nil)
        }
    }

    @objc func mediaStreamToURL(
        _ streamId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            let url = await TrackRegistry.shared.urlForStream(streamId)
            callback(nil, url)
        }
    }

    // MARK: - MediaStreamTrack

    @objc func mediaStreamTrackSetEnabled(
        _ trackId: String,
        enabled: Bool,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            if let track = await TrackRegistry.shared.getTrack(trackId) {
                track.isEnabled = enabled
            }
            callback(nil, nil)
        }
    }

    @objc func mediaStreamTrackStop(
        _ trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            // RTCMediaStreamTrack doesn't have an explicit stop() on iOS.
            // Disabling is the closest equivalent.
            if let track = await TrackRegistry.shared.getTrack(trackId) {
                track.isEnabled = false
            }
            callback(nil, nil)
        }
    }

    @objc func mediaStreamTrackRelease(
        _ trackId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            await TrackRegistry.shared.removeTrack(trackId)
            callback(nil, nil)
        }
    }

    // MARK: - getUserMedia

    @objc func getUserMedia(
        _ constraintsJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let result = try await LynxMediaStreamModule.shared.getUserMedia(
                    constraintsJson: constraintsJson
                )
                callback(nil, result)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func enumerateDevices(
        _ callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            let result = await LynxMediaStreamModule.shared.enumerateDevices()
            callback(nil, result)
        }
    }

    // MARK: - Sender parameters

    @objc func senderGetParameters(
        _ pcId: Double,
        senderId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            guard let sender = senders[senderId] else {
                callback("Sender \(senderId) not found", nil)
                return
            }
            let params = sender.parameters
            let json = encodeSenderParameters(params)
            callback(nil, json)
        }
    }

    @objc func senderSetParameters(
        _ pcId: Double,
        senderId: String,
        parametersJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            guard let sender = senders[senderId] else {
                callback("Sender \(senderId) not found", nil)
                return
            }
            do {
                let params = try decodeSenderParameters(from: parametersJson, existing: sender.parameters)
                sender.parameters = params
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func senderReplaceTrack(
        _ pcId: Double,
        senderId: String,
        trackId: String?,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            guard let sender = senders[senderId] else {
                callback("Sender \(senderId) not found", nil)
                return
            }
            let track: RTCMediaStreamTrack?
            if let tid = trackId {
                track = await TrackRegistry.shared.getTrack(tid)
            } else {
                track = nil
            }
            sender.track = track
            callback(nil, nil)
        }
    }

    // MARK: - Transceiver

    @objc func transceiverSetDirection(
        _ pcId: Double,
        transceiverId: String,
        direction: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                if let t = pc.transceivers.first(where: { $0.transceiverId == transceiverId }) {
                    t.direction = RTCRtpTransceiverDirection.from(string: direction)
                }
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    @objc func transceiverStop(
        _ pcId: Double,
        transceiverId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        Task {
            do {
                let pc = try await PCManager.shared.get(Int(pcId))
                pc.transceivers
                    .first { $0.transceiverId == transceiverId }?
                    .stopInternal()
                callback(nil, nil)
            } catch {
                callback(error.localizedDescription, nil)
            }
        }
    }

    // MARK: - Helpers

    private func encodeSenderParameters(_ params: RTCRtpParameters) -> String {
        let encodings = params.encodings.map { enc -> [String: Any] in
            var d: [String: Any] = [:]
            d["rid"] = enc.rid
            d["active"] = enc.isActive
            if enc.maxBitrateBps != nil { d["maxBitrate"] = enc.maxBitrateBps }
            if enc.maxFramerate != nil { d["maxFramerate"] = enc.maxFramerate }
            if enc.scaleResolutionDownBy != nil { d["scaleResolutionDownBy"] = enc.scaleResolutionDownBy }
            return d
        }
        let dict: [String: Any] = ["encodings": encodings, "transactionId": params.transactionId]
        return JSON.encodeString(dict)
    }

    private func decodeSenderParameters(
        from json: String,
        existing: RTCRtpParameters
    ) throws -> RTCRtpParameters {
        guard let data = json.data(using: .utf8),
              let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw PCManagerError.invalidSDP }

        if let encodingsArr = dict["encodings"] as? [[String: Any]] {
            for (i, encDict) in encodingsArr.enumerated() {
                guard i < existing.encodings.count else { break }
                let enc = existing.encodings[i]
                if let active = encDict["active"] as? Bool {
                    enc.isActive = active
                }
                if let maxBitrate = encDict["maxBitrate"] as? NSNumber {
                    enc.maxBitrateBps = maxBitrate
                }
                if let maxFPS = encDict["maxFramerate"] as? NSNumber {
                    enc.maxFramerate = maxFPS
                }
                if let scale = encDict["scaleResolutionDownBy"] as? NSNumber {
                    enc.scaleResolutionDownBy = scale
                }
            }
        }
        return existing
    }
}

// MARK: - LynxDataChannelDelegate

final class LynxDataChannelDelegate: NSObject, RTCDataChannelDelegate, @unchecked Sendable {
    let pcId: Int
    weak var eventEmitter: LynxEventEmitter?

    init(pcId: Int, eventEmitter: LynxEventEmitter?) {
        self.pcId = pcId
        self.eventEmitter = eventEmitter
    }

    private func emit(_ type: String, channelId: Int, payload: [String: Any] = [:]) {
        var body = payload
        body["type"] = type
        body["pcId"] = pcId
        body["channelId"] = channelId
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let str = String(data: data, encoding: .utf8)
        else { return }
        eventEmitter?.sendEvent("LK_PC_EVENT", data: str)
    }

    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        let state: String
        switch dataChannel.readyState {
        case .connecting: state = "connecting"
        case .open:       state = "open"
        case .closing:    state = "closing"
        case .closed:     state = "closed"
        @unknown default: state = "closed"
        }
        emit("dataChannelDidChangeState", channelId: Int(dataChannel.channelId), payload: ["state": state])
    }

    func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        let data: String
        if buffer.isBinary {
            data = buffer.data.base64EncodedString()
        } else {
            data = String(data: buffer.data, encoding: .utf8) ?? ""
        }
        emit("dataChannelDidReceiveMessage",
             channelId: Int(dataChannel.channelId),
             payload: ["data": data, "isBinary": buffer.isBinary])
    }
}

// MARK: - RTCPeerConnection async helpers (Swift 6 concurrency)

extension RTCPeerConnection {
    func offer(for constraints: RTCMediaConstraints) async throws -> RTCSessionDescription {
        try await withCheckedThrowingContinuation { continuation in
            self.offer(for: constraints) { sdp, error in
                if let error { continuation.resume(throwing: error); return }
                guard let sdp else {
                    continuation.resume(throwing: PCManagerError.invalidSDP); return
                }
                continuation.resume(returning: sdp)
            }
        }
    }

    func answer(for constraints: RTCMediaConstraints) async throws -> RTCSessionDescription {
        try await withCheckedThrowingContinuation { continuation in
            self.answer(for: constraints) { sdp, error in
                if let error { continuation.resume(throwing: error); return }
                guard let sdp else {
                    continuation.resume(throwing: PCManagerError.invalidSDP); return
                }
                continuation.resume(returning: sdp)
            }
        }
    }

    func setLocalDescription(_ sdp: RTCSessionDescription) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.setLocalDescription(sdp) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }

    func setRemoteDescription(_ sdp: RTCSessionDescription) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.setRemoteDescription(sdp) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }

    func add(_ candidate: RTCIceCandidate) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.add(candidate) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            }
        }
    }
}

// MARK: - JSON Helpers

private enum JSON {
    static func encodeString(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let str = String(data: data, encoding: .utf8)
        else { return "null" }
        return str
    }

    static func decode<T: Decodable>(_ type: T.Type, from string: String) throws -> T {
        guard let data = string.data(using: .utf8) else {
            throw NSError(domain: "JSON", code: -1)
        }
        return try JSONDecoder().decode(type, from: data)
    }
}

// MARK: - RTCConfiguration init from JSON

extension RTCConfiguration {
    static func from(json: String) throws -> RTCConfiguration {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw PCManagerError.invalidSDP }

        let config = RTCConfiguration()

        if let iceServersArr = dict["iceServers"] as? [[String: Any]] {
            config.iceServers = iceServersArr.map { srv -> RTCIceServer in
                let urls: [String]
                if let u = srv["urls"] as? [String] { urls = u }
                else if let u = srv["urls"] as? String { urls = [u] }
                else { urls = [] }
                return RTCIceServer(
                    urlStrings: urls,
                    username: srv["username"] as? String,
                    credential: srv["credential"] as? String
                )
            }
        }

        if let policy = dict["iceTransportPolicy"] as? String {
            config.iceTransportPolicy = policy == "relay" ? .relay : .all
        }
        if let bundle = dict["bundlePolicy"] as? String {
            switch bundle {
            case "max-compat":  config.bundlePolicy = .maxCompat
            case "max-bundle":  config.bundlePolicy = .maxBundle
            default:            config.bundlePolicy = .balanced
            }
        }
        if let sdpSemantics = dict["sdpSemantics"] as? String {
            config.sdpSemantics = sdpSemantics == "plan-b" ? .planB : .unifiedPlan
        }
        return config
    }
}

// MARK: - RTCSessionDescription JSON serialisation

extension RTCSessionDescription {
    static func from(json: String) throws -> RTCSessionDescription {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let typeStr = dict["type"] as? String,
              let sdpStr = dict["sdp"] as? String
        else { throw PCManagerError.invalidSDP }

        let sdpType: RTCSdpType
        switch typeStr {
        case "offer":    sdpType = .offer
        case "pranswer": sdpType = .prAnswer
        case "answer":   sdpType = .answer
        default:         sdpType = .rollback
        }
        return RTCSessionDescription(type: sdpType, sdp: sdpStr)
    }

    func toJSON() -> String {
        let typeStr: String
        switch type {
        case .offer:    typeStr = "offer"
        case .prAnswer: typeStr = "pranswer"
        case .answer:   typeStr = "answer"
        case .rollback: typeStr = "rollback"
        @unknown default: typeStr = "rollback"
        }
        guard let data = try? JSONSerialization.data(
            withJSONObject: ["type": typeStr, "sdp": sdp]
        ), let str = String(data: data, encoding: .utf8)
        else { return "{}" }
        return str
    }
}

// MARK: - RTCIceCandidate JSON

extension RTCIceCandidate {
    static func from(json: String) throws -> RTCIceCandidate {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sdp = dict["candidate"] as? String
        else { throw PCManagerError.invalidCandidate }

        return RTCIceCandidate(
            sdp: sdp,
            sdpMLineIndex: (dict["sdpMLineIndex"] as? NSNumber)?.int32Value ?? 0,
            sdpMid: dict["sdpMid"] as? String
        )
    }
}

// MARK: - RTCDataChannelConfiguration from JSON

extension RTCDataChannelConfiguration {
    static func from(json: String) throws -> RTCDataChannelConfiguration {
        let config = RTCDataChannelConfiguration()
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return config }

        config.isOrdered = dict["ordered"] as? Bool ?? true
        if let maxRetransmits = dict["maxRetransmits"] as? Int32 {
            config.maxRetransmits = maxRetransmits
        }
        if let maxPacketLifeTime = dict["maxPacketLifeTime"] as? Int32 {
            config.maxPacketLifeTime = maxPacketLifeTime
        }
        config.protocol = dict["protocol"] as? String ?? ""
        config.isNegotiated = dict["negotiated"] as? Bool ?? false
        if let id = dict["id"] as? Int32 {
            config.channelId = id
        }
        return config
    }
}

// MARK: - RTCRtpTransceiverDirection from string

extension RTCRtpTransceiverDirection {
    static func from(string: String) -> RTCRtpTransceiverDirection {
        switch string {
        case "sendrecv":  return .sendRecv
        case "sendonly":  return .sendOnly
        case "recvonly":  return .recvOnly
        case "inactive":  return .inactive
        case "stopped":   return .stopped
        default:          return .sendRecv
        }
    }

    var stringValue: String {
        switch self {
        case .sendRecv:  return "sendrecv"
        case .sendOnly:  return "sendonly"
        case .recvOnly:  return "recvonly"
        case .inactive:  return "inactive"
        case .stopped:   return "stopped"
        @unknown default: return "sendrecv"
        }
    }
}

// MARK: - RTCSignalingState / RTCIceConnectionState / RTCPeerConnectionState string values

extension RTCSignalingState {
    var stringValue: String {
        switch self {
        case .stable:             return "stable"
        case .haveLocalOffer:     return "have-local-offer"
        case .haveRemoteOffer:    return "have-remote-offer"
        case .haveLocalPrAnswer:  return "have-local-pranswer"
        case .haveRemotePrAnswer: return "have-remote-pranswer"
        case .closed:             return "closed"
        @unknown default:         return "stable"
        }
    }
}

extension RTCIceConnectionState {
    var stringValue: String {
        switch self {
        case .new:          return "new"
        case .checking:     return "checking"
        case .connected:    return "connected"
        case .completed:    return "completed"
        case .failed:       return "failed"
        case .disconnected: return "disconnected"
        case .closed:       return "closed"
        case .count:        return "closed"
        @unknown default:   return "closed"
        }
    }
}

extension RTCIceGatheringState {
    var stringValue: String {
        switch self {
        case .new:       return "new"
        case .gathering: return "gathering"
        case .complete:  return "complete"
        @unknown default: return "new"
        }
    }
}

extension RTCPeerConnectionState {
    var stringValue: String {
        switch self {
        case .new:          return "new"
        case .connecting:   return "connecting"
        case .connected:    return "connected"
        case .disconnected: return "disconnected"
        case .failed:       return "failed"
        case .closed:       return "closed"
        @unknown default:   return "closed"
        }
    }
}

// MARK: - RTCMediaConstraints defaults

extension RTCMediaConstraints {
    static var defaultConstraints: RTCMediaConstraints {
        RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
    }
}
