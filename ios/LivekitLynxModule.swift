// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — ios/LivekitLynxModule.swift
// Lynx NativeModule — AudioSession management + volume processor setup.
// Port of LivekitReactNativeModule.swift from @livekit/react-native.
//
// Registration (LynxInitProcessor.m):
//   [globalConfig registerModule:LivekitLynxModule.class];
// ─────────────────────────────────────────────────────────────────────────────

import AVFoundation
import Foundation
import WebRTC

// MARK: - AudioUtils  (port of AudioUtils.swift from RN SDK)

enum AudioUtils {

    static func audioSessionCategoryFromString(_ s: String) -> AVAudioSession.Category {
        switch s {
        case "soloAmbient":  return .soloAmbient
        case "playback":     return .playback
        case "record":       return .record
        case "playAndRecord": return .playAndRecord
        case "multiRoute":   return .multiRoute
        default:             return .playAndRecord
        }
    }

    static func audioSessionCategoryOptionsFromStrings(
        _ strings: [String]
    ) -> AVAudioSession.CategoryOptions {
        var opts: AVAudioSession.CategoryOptions = []
        for s in strings {
            switch s {
            case "mixWithOthers":                           opts.insert(.mixWithOthers)
            case "duckOthers":                              opts.insert(.duckOthers)
            case "interruptSpokenAudioAndMixWithOthers":    opts.insert(.interruptSpokenAudioAndMixWithOthers)
            case "allowBluetooth":                          opts.insert(.allowBluetooth)
            case "allowBluetoothA2DP":                      opts.insert(.allowBluetoothA2DP)
            case "allowAirPlay":                            opts.insert(.allowAirPlay)
            case "defaultToSpeaker":                        opts.insert(.defaultToSpeaker)
            default: break
            }
        }
        return opts
    }

    static func audioSessionModeFromString(_ s: String) -> AVAudioSession.Mode {
        switch s {
        case "default":          return .default
        case "gameChat":         return .gameChat
        case "measurement":      return .measurement
        case "moviePlayback":    return .moviePlayback
        case "spokenAudio":      return .spokenAudio
        case "videoChat":        return .videoChat
        case "videoRecording":   return .videoRecording
        case "voiceChat":        return .voiceChat
        case "voicePrompt":      return .voicePrompt
        default:                 return .default
        }
    }
}

// MARK: - LivekitLynxModule

@objc(LivekitLynxModule)
public final class LivekitLynxModule: NSObject {

    @objc public static func name() -> String { "LivekitLynxModule" }

    @objc public static func methodLookup() -> [String: String] {
        return [
            "configureAudio":             NSStringFromSelector(#selector(configureAudio(_:callback:))),
            "startAudioSession":          NSStringFromSelector(#selector(startAudioSession(_:))),
            "stopAudioSession":           NSStringFromSelector(#selector(stopAudioSession(_:))),
            "getAudioOutputs":            NSStringFromSelector(#selector(getAudioOutputs(_:))),
            "selectAudioOutput":          NSStringFromSelector(#selector(selectAudioOutput(_:callback:))),
            "showAudioRoutePicker":       NSStringFromSelector(#selector(showAudioRoutePicker(_:))),
            "setAppleAudioConfiguration": NSStringFromSelector(#selector(setAppleAudioConfiguration(_:callback:))),
            "setDefaultAudioTrackVolume": NSStringFromSelector(#selector(setDefaultAudioTrackVolume(_:callback:))),
        ]
    }

    // MARK: - configureAudio  (port of LivekitReactNativeModule.configureAudio)

    @objc func configureAudio(
        _ configJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        guard let data = configJson.data(using: .utf8),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let iOSConfig = config["ios"] as? [String: Any]
        else {
            callback(nil, nil)
            return
        }

        let defaultOutput = iOSConfig["defaultOutput"] as? String ?? "speaker"
        let rtcConfig = RTCAudioSessionConfiguration()
        rtcConfig.category = AVAudioSession.Category.playAndRecord.rawValue

        if defaultOutput == "earpiece" {
            rtcConfig.categoryOptions = [.allowAirPlay, .allowBluetooth, .allowBluetoothA2DP]
            rtcConfig.mode = AVAudioSession.Mode.voiceChat.rawValue
        } else {
            rtcConfig.categoryOptions = [
                .allowAirPlay, .allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker,
            ]
            rtcConfig.mode = AVAudioSession.Mode.videoChat.rawValue
        }
        RTCAudioSessionConfiguration.setWebRTC(rtcConfig)
        callback(nil, nil)
    }

    // MARK: - startAudioSession  (port of LivekitReactNativeModule.startAudioSession)

    @objc func startAudioSession(
        _ callback: @escaping (String?, String?) -> Void
    ) {
        let session = RTCAudioSession.sharedInstance()
        session.lockForConfiguration()
        defer { session.unlockForConfiguration() }
        do {
            try session.setActive(true)
            callback(nil, nil)
        } catch {
            callback(error.localizedDescription, nil)
        }
    }

    // MARK: - stopAudioSession

    @objc func stopAudioSession(
        _ callback: @escaping (String?, String?) -> Void
    ) {
        let session = RTCAudioSession.sharedInstance()
        session.lockForConfiguration()
        defer { session.unlockForConfiguration() }
        do {
            try session.setActive(false)
            callback(nil, nil)
        } catch {
            callback(error.localizedDescription, nil)
        }
    }

    // MARK: - getAudioOutputs  (iOS: fixed list — matches RN SDK)

    @objc func getAudioOutputs(
        _ callback: @escaping (String?, String?) -> Void
    ) {
        let outputs = ["default", "force_speaker"]
        guard let data = try? JSONSerialization.data(withJSONObject: outputs),
              let str = String(data: data, encoding: .utf8)
        else {
            callback(nil, "[]")
            return
        }
        callback(nil, str)
    }

    // MARK: - selectAudioOutput

    @objc func selectAudioOutput(
        _ deviceId: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        let avSession = AVAudioSession.sharedInstance()
        do {
            if deviceId == "default" {
                try avSession.overrideOutputAudioPort(.none)
            } else if deviceId == "force_speaker" {
                try avSession.overrideOutputAudioPort(.speaker)
            }
            callback(nil, nil)
        } catch {
            callback(error.localizedDescription, nil)
        }
    }

    // MARK: - showAudioRoutePicker  (iOS 11+)

    @objc func showAudioRoutePicker(
        _ callback: @escaping (String?, String?) -> Void
    ) {
        if #available(iOS 11.0, *) {
            DispatchQueue.main.async {
                let picker = AVRoutePickerView()
                for subview in picker.subviews {
                    if let button = subview as? UIButton {
                        button.sendActions(for: .touchUpInside)
                        break
                    }
                }
            }
        }
        callback(nil, nil)
    }

    // MARK: - setAppleAudioConfiguration

    @objc func setAppleAudioConfiguration(
        _ configJson: String,
        callback: @escaping (String?, String?) -> Void
    ) {
        guard let data = configJson.data(using: .utf8),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            callback("Invalid config JSON", nil)
            return
        }

        let session = RTCAudioSession.sharedInstance()
        let rtcConfig = RTCAudioSessionConfiguration.webRTC()

        if let cat = config["audioCategory"] as? String {
            rtcConfig.category = AudioUtils.audioSessionCategoryFromString(cat).rawValue
        }
        if let opts = config["audioCategoryOptions"] as? [String] {
            rtcConfig.categoryOptions = AudioUtils.audioSessionCategoryOptionsFromStrings(opts)
        }
        if let mode = config["audioMode"] as? String {
            rtcConfig.mode = AudioUtils.audioSessionModeFromString(mode).rawValue
        }

        session.lockForConfiguration()
        defer { session.unlockForConfiguration() }
        do {
            try session.setConfiguration(rtcConfig)
            callback(nil, nil)
        } catch {
            callback(error.localizedDescription, nil)
        }
    }

    // MARK: - setDefaultAudioTrackVolume

    @objc func setDefaultAudioTrackVolume(
        _ volume: Double,
        callback: @escaping (String?, String?) -> Void
    ) {
        LynxWebRTCModuleOptions.sharedInstance().defaultTrackVolume = volume
        callback(nil, nil)
    }
}
