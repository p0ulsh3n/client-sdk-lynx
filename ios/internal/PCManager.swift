// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/internal/PCManager.swift
// Swift 6 actor managing all RTCPeerConnection instances.
// Thread-safe via actor isolation — no locks needed.
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import WebRTC

// MARK: - PCEntry

/// Container bundling a native peer connection with its Lynx pc-id.
struct PCEntry: @unchecked Sendable {
    let pcId: Int
    let peerConnection: RTCPeerConnection
    weak var delegate: RTCPeerConnectionDelegate?
}

// MARK: - PCManager

/// Actor-isolated registry of all active peer connections.
/// All mutations and reads are serialised on the actor's executor.
actor PCManager {

    // Singleton used by both LynxWebRTCModule and LynxAudioModule.
    static let shared = PCManager()

    private var entries: [Int: PCEntry] = [:]
    // nonisolated(unsafe) allows access from non-actor contexts (ObjC/Swift interop).
    // Safe because factory is set once in init and never mutated.
    nonisolated(unsafe) let peerConnectionFactory: RTCPeerConnectionFactory

    private init() {
        RTCInitializeSSL()
        peerConnectionFactory = RTCPeerConnectionFactory(
            encoderFactory: nil,
            decoderFactory: nil
        )
    }

    // MARK: - Factory access

    // MARK: - CRUD

    func create(
        pcId: Int,
        config: RTCConfiguration,
        constraints: RTCMediaConstraints,
        delegate: RTCPeerConnectionDelegate
    ) throws -> RTCPeerConnection {
        guard entries[pcId] == nil else {
            throw PCManagerError.duplicatePcId(pcId)
        }
        guard let pc = peerConnectionFactory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: delegate
        ) else {
            throw PCManagerError.creationFailed
        }
        entries[pcId] = PCEntry(pcId: pcId, peerConnection: pc, delegate: delegate)
        return pc
    }

    func get(_ pcId: Int) throws -> RTCPeerConnection {
        guard let entry = entries[pcId] else {
            throw PCManagerError.notFound(pcId)
        }
        return entry.peerConnection
    }

    func close(_ pcId: Int) {
        guard let entry = entries.removeValue(forKey: pcId) else { return }
        entry.peerConnection.close()
    }

    func dispose(_ pcId: Int) {
        entries.removeValue(forKey: pcId)
    }

    func allPcIds() -> [Int] {
        Array(entries.keys)
    }
}

// MARK: - PCManagerError

enum PCManagerError: LocalizedError {
    case duplicatePcId(Int)
    case creationFailed
    case notFound(Int)
    case invalidSDP
    case invalidCandidate

    var errorDescription: String? {
        switch self {
        case .duplicatePcId(let id): return "PeerConnection with pcId \(id) already exists"
        case .creationFailed:        return "Failed to create RTCPeerConnection"
        case .notFound(let id):      return "PeerConnection pcId \(id) not found"
        case .invalidSDP:            return "Invalid SDP format"
        case .invalidCandidate:      return "Invalid ICE candidate"
        }
    }
}
