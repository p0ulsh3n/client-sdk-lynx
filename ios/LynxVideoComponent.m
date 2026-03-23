// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.m
// Obj-C companion pour enregistrer les props Lynx
// (Swift logic dans LynxVideoComponent.swift)
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxPropsProcessor.h>

// Forward-declare the Swift class.
// We cannot reliably #import the -Swift.h header here because:
//   - The generated header references types from WebRTC/Lynx frameworks
//     that may not be in scope at this compilation stage
// Instead, we forward-declare the class and the @objc setter methods.
@class LynxVideoComponentUI;

@interface LynxVideoComponentUI (LynxProps)
- (void)setStreamURL:(NSString * _Nonnull)urlString;
- (void)setObjectFit:(NSString * _Nonnull)fit;
- (void)setMirror:(BOOL)mirror;
- (void)setZOrder:(NSNumber * _Nonnull)z;
@end

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