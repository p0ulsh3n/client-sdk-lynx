import Foundation
import WebRTC

// MARK: - TrackEntry

struct TrackEntry: @unchecked Sendable {
    let trackId: String
    let track: RTCMediaStreamTrack
    /// The pcId owning this track; -1 for local capture tracks.
    let pcId: Int
    let streamIds: [String]
}

// MARK: - TrackRegistry

actor TrackRegistry {

    static let shared = TrackRegistry()

    private var tracks: [String: TrackEntry] = [:]
    private var streams: [String: RTCMediaStream] = [:]

    private init() {}

    // MARK: - Track management

    func registerTrack(_ track: RTCMediaStreamTrack, pcId: Int, streamIds: [String]) {
        tracks[track.trackId] = TrackEntry(
            trackId: track.trackId,
            track: track,
            pcId: pcId,
            streamIds: streamIds
        )
    }

    func getTrack(_ trackId: String) -> RTCMediaStreamTrack? {
        tracks[trackId]?.track
    }

    func getEntry(_ trackId: String) -> TrackEntry? {
        tracks[trackId]
    }

    func removeTrack(_ trackId: String) {
        tracks.removeValue(forKey: trackId)
    }

    func getAudioTrack(pcId: Int, trackId: String) -> RTCAudioTrack? {
        guard let entry = tracks[trackId], entry.pcId == pcId else { return nil }
        return entry.track as? RTCAudioTrack
    }

    func getAllTracks(forPcId pcId: Int) -> [TrackEntry] {
        tracks.values.filter { $0.pcId == pcId }
    }

    // MARK: - Stream management

    func registerStream(_ stream: RTCMediaStream) {
        streams[stream.streamId] = stream
    }

    func getStream(_ streamId: String) -> RTCMediaStream? {
        streams[streamId]
    }

    func removeStream(_ streamId: String) {
        streams.removeValue(forKey: streamId)
    }

    // MARK: - URL helper (for <livekit-webrtc-view>)

    /// Returns an opaque URL identifying the stream, used by the video view.
    func urlForStream(_ streamId: String) -> String {
        "livekit-stream://\(streamId)"
    }
}
