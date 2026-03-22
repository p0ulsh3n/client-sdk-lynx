// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.m
// Obj-C companion pour enregistrer les props Lynx
// (Swift logic dans LynxVideoComponent.swift)
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxPropsProcessor.h>

// Import Swift-generated header for LynxVideoComponentUI @objc methods.
// Using angle brackets for framework target (CocoaPods use_frameworks!).
// In a .m file (not .mm), the #ifdef __cplusplus C++ sections are skipped.
#import <livekit_lynx/livekit_lynx-Swift.h>

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