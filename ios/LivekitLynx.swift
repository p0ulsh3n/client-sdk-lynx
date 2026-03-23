import Foundation
import WebRTC
import Lynx

@objc public final class LivekitLynx: NSObject {

    private override init() { super.init() }

    /// Configures WebRTC video encoder and audio processing.
    /// Must be called before the Lynx engine initialises WebRTC.
    @objc public static func setup() {
        let defaultFactory   = RTCDefaultVideoEncoderFactory()
        let simulcastFactory = RTCVideoEncoderFactorySimulcast(
            primary:  defaultFactory,
            fallback: defaultFactory
        )

        let options = LynxWebRTCModuleOptions.sharedInstance()
        options.videoEncoderFactory = simulcastFactory
        options.audioProcessingModule =
            LKLynxAudioProcessingManager.sharedInstance().audioProcessingModule
    }
}


// MARK: - LynxWebRTCModuleOptions

@objc public final class LynxWebRTCModuleOptions: NSObject {
    @objc public static func sharedInstance() -> LynxWebRTCModuleOptions {
        return _shared
    }
    private static let _shared = LynxWebRTCModuleOptions()

    @objc public var videoEncoderFactory: RTCVideoEncoderFactory?
    @objc public var videoDecoderFactory: RTCVideoDecoderFactory?
    @objc public var audioProcessingModule: RTCDefaultAudioProcessingModule?
    @objc public var defaultTrackVolume: Double = 1.0
}
