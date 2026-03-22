// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.m
// Obj-C companion pour enregistrer les props + UI (Swift logic dans .swift)
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxPropsProcessor.h>     // ← OBLIGATOIRE pour LYNX_PROP_SETTER + LYNX_LAZY_REGISTER_UI

// Import Swift classes via modular import (aucun C++)
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