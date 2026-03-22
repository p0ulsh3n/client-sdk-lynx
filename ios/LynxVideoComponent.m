// ─────────────────────────────────────────────────────────────────────────────
// LynxVideoComponent.m – Companion ObjC pour enregistrer les props Lynx
// (Swift logic dans LynxVideoComponent.swift)
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/LynxPropsProcessor.h>     // LYNX_PROP_SETTER + LYNX_LAZY_REGISTER_UI

// Import Swift classes via modular import (pas de C++ transitif)
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
