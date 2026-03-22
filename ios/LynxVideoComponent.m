// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.m
// Obj-C companion for LynxVideoComponentUI.
//
// IMPORTANT: We use specific Lynx ObjC headers instead of the umbrella
// <Lynx/Lynx.h> to avoid transitive C++ header includes (<memory>).
// The Swift-generated module import (@import) gives access to Swift classes.
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/LynxUI.h>
#import <Lynx/LynxComponentRegistry.h>

// Import the Swift classes via modular import (no C++ issues)
@import livekit_lynx;

@implementation LynxVideoComponentUI

LYNX_LAZY_REGISTER_UI("livekit-webrtc-view")

LYNX_PROP_SETTER("streamURL", setStreamURL, NSString *) {
    [self setStreamURL:value];
}

LYNX_PROP_SETTER("objectFit", setObjectFit, NSString *) {
    [self setObjectFit:value];
}

LYNX_PROP_SETTER("mirror", setMirror, BOOL) {
    [self setMirror:value];
}

LYNX_PROP_SETTER("zOrder", setZOrder, NSNumber *) {
    [self setZOrder:value];
}

@end
