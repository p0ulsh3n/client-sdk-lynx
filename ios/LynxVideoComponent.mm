// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.m
// Obj-C companion for LynxVideoComponentUI.
//
// Uses LYNX_PROP_SETTER macros (official Lynx API) to wire JSX props to
// the Swift @objc setter methods defined in LynxVideoComponent.swift.
//
// Official pattern: https://lynxjs.org/guide/custom-native-component
// Example reference: LynxExplorerInput.m in the Lynx Explorer project.
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/Lynx.h>
// Import the Swift-generated header for the module (framework target)
#import <livekit_lynx/livekit_lynx-Swift.h>

// Register the Custom Native Component with Lynx.
// The tag "livekit-webrtc-view" must match exactly what is used in JSX.
LYNX_COMPONENT(LynxVideoComponentUI, "livekit-webrtc-view", LynxShadowNode)

// ── Prop setters ─────────────────────────────────────────────────────────────
// Each LYNX_PROP_SETTER(jsName, setterName, type) macro:
//   1. Registers the prop name visible from JSX
//   2. Calls the corresponding @objc method on the Swift LynxUI instance

/// <livekit-webrtc-view streamURL="livekit-stream://..." />
LYNX_PROP_SETTER("streamURL", setStreamURL, NSString *) {
    [self setStreamURL:value];
}

/// <livekit-webrtc-view objectFit="cover" /> or "contain"
LYNX_PROP_SETTER("objectFit", setObjectFit, NSString *) {
    [self setObjectFit:value];
}

/// <livekit-webrtc-view mirror={true} />
LYNX_PROP_SETTER("mirror", setMirror, BOOL) {
    [self setMirror:value];
}

/// <livekit-webrtc-view zOrder={1} />
LYNX_PROP_SETTER("zOrder", setZOrder, NSNumber *) {
    [self setZOrder:value];
}
