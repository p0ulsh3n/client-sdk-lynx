// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — ios/LivekitLynx.swift
// App-level setup. Mirrors LivekitReactNative.m from the RN SDK.
//
// Call once in your LynxInitProcessor (or equivalent):
//   LivekitLynx.setup()
//   [globalConfig registerModule:LivekitLynxModule.class]
//   // Also register from @livekit/lynx-webrtc:
//   [globalConfig registerModule:LynxWebRTCModule.class]
//   [globalConfig registerModule:LynxAudioModule.class]
//   [globalConfig registerModule:LynxE2EEModule.class]
//   [globalConfig registerUI:@"livekit-webrtc-view" withClass:LynxVideoComponentUI.class]
// ─────────────────────────────────────────────────────────────────────────────

import Foundation
import WebRTC

@objc public final class LivekitLynx: NSObject {

    private init() {}

    /**
     * Configures the WebRTC video encoder factory with simulcast support
     * and wires up the custom audio processing module.
     *
     * Must be called before the Lynx engine initialises WebRTC.
     * Mirrors `LivekitReactNative.setup()` from the React Native SDK.
     */
    @objc public static func setup() {
        let defaultFactory   = RTCDefaultVideoEncoderFactory()
        let simulcastFactory = RTCVideoEncoderFactorySimulcast(
            primary:  defaultFactory,
            fallback: defaultFactory
        )

        let options = LynxWebRTCModuleOptions.sharedInstance()
        options.videoEncoderFactory = simulcastFactory
        options.audioProcessingModule =
            LynxAudioProcessingManager.shared.audioProcessingModule
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxWebRTCModuleOptions
// Mirrors WebRTCModuleOptions from @livekit/react-native-webrtc.
// In a real integration this would reference the actual Lynx WebRTC options class.
// ─────────────────────────────────────────────────────────────────────────────

/// Placeholder — replace with your actual Lynx WebRTC module options class.
@objc public final class LynxWebRTCModuleOptions: NSObject {
    @objc public static func sharedInstance() -> LynxWebRTCModuleOptions {
        return _shared
    }
    private static let _shared = LynxWebRTCModuleOptions()

    @objc public var videoEncoderFactory: RTCVideoEncoderFactory?
    @objc public var videoDecoderFactory: RTCVideoDecoderFactory?
    @objc public var audioProcessingModule: RTCAudioProcessingModule?
    @objc public var defaultTrackVolume: Double = 1.0
}
