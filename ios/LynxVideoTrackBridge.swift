import Foundation
import WebRTC

@objc(LynxVideoTrackBridge)
public final class LynxVideoTrackBridge: NSObject {

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
