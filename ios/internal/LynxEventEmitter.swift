// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — ios/internal/LynxEventEmitter.swift
// Lightweight event emitter bridging native events to Lynx's JS runtime.
// ─────────────────────────────────────────────────────────────────────────────

import Foundation

/// Protocol-style event emitter used by all NativeModules to send events to JS.
/// In a full Lynx integration, replace with the actual Lynx event bridge.
@objc public class LynxEventEmitter: NSObject {

    private var listeners: [String: [(String) -> Void]] = [:]

    @objc public func sendEvent(_ name: String, data: String) {
        // In a real Lynx integration, this would call
        // lynxContext.sendGlobalEvent(name, data) or similar.
        listeners[name]?.forEach { $0(data) }
    }

    @objc public func addListener(_ name: String, handler: @escaping (String) -> Void) {
        var list = listeners[name] ?? []
        list.append(handler)
        listeners[name] = list
    }

    @objc public func removeAllListeners(_ name: String) {
        listeners.removeValue(forKey: name)
    }
}
