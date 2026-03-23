// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.m
// Pure Obj-C LynxUI component that renders a WebRTC video stream.
//
// Tag name: "livekit-webrtc-view"
//
// Props:
//   streamURL  (NSString *)  — opaque URL from MediaStream.toURL()
//   objectFit  (NSString *)  — "cover" (default) or "contain"
//   mirror     (BOOL)        — horizontal flip for self-view
//   zOrder     (NSNumber *)  — z-stacking within the Lynx view hierarchy
// ─────────────────────────────────────────────────────────────────────────────

#import "LynxVideoComponent.h"
#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxPropsProcessor.h>

// Import the auto-generated header for our Swift bridge helper.
// The module name used by CocoaPods equals the pod target name
// with non-alphanumeric characters replaced by underscores.
#if __has_include("livekit_lynx-Swift.h")
  #import "livekit_lynx-Swift.h"
#elif __has_include(<livekit_lynx/livekit_lynx-Swift.h>)
  #import <livekit_lynx/livekit_lynx-Swift.h>
#else
  // Fallback forward declaration so the file always compiles.
  // At link-time the real symbol will be provided by the Swift object file.
  @interface LynxVideoTrackBridge : NSObject
  + (void)findVideoTrackForStreamId:(NSString * _Nonnull)streamId
                         completion:(void (^ _Nonnull)(RTCVideoTrack * _Nullable))completion;
  @end
#endif

// ─────────────────────────────────────────────────────────────────────────────
#pragma mark - LynxVideoShadowNode
// ─────────────────────────────────────────────────────────────────────────────

@implementation LynxVideoShadowNode
@end

// ─────────────────────────────────────────────────────────────────────────────
#pragma mark - LynxVideoComponentUI
// ─────────────────────────────────────────────────────────────────────────────

@implementation LynxVideoComponentUI

LYNX_LAZY_REGISTER_UI("livekit-webrtc-view")

// ── Create the native view ─────────────────────────────────────────────────

- (RTCMTLVideoView *)createView {
    RTCMTLVideoView *videoView = [[RTCMTLVideoView alloc] initWithFrame:CGRectZero];
    videoView.videoContentMode = UIViewContentModeScaleAspectFill;
    return videoView;
}

// ── Prop setters (registered via LYNX_PROP_SETTER macros) ──────────────────

LYNX_PROP_SETTER("streamURL", setStreamURLProp, NSString *) {
    if ([value isEqualToString:_streamURL]) {
        return;
    }
    _streamURL = [value copy];

    // Detach current track
    RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
    if (_currentTrack) {
        [_currentTrack removeRenderer:videoView];
        _currentTrack = nil;
    }

    // Parse stream ID from the opaque URL
    NSString *streamId = [value stringByReplacingOccurrencesOfString:@"livekit-stream://"
                                                          withString:@""];
    // Resolve the track via the Swift bridge (async, calls back on main thread)
    __weak typeof(self) weakSelf = self;
    [LynxVideoTrackBridge findVideoTrackForStreamId:streamId
                                         completion:^(RTCVideoTrack * _Nullable track) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || !track) { return; }
        strongSelf->_currentTrack = track;
        RTCMTLVideoView *v = (RTCMTLVideoView *)strongSelf.view;
        [track addRenderer:v];
    }];
}

LYNX_PROP_SETTER("objectFit", setObjectFitProp, NSString *) {
    RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
    videoView.videoContentMode = [value isEqualToString:@"contain"]
        ? UIViewContentModeScaleAspectFit
        : UIViewContentModeScaleAspectFill;
}

LYNX_PROP_SETTER("mirror", setMirrorProp, BOOL) {
    RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
    videoView.transform = value
        ? CGAffineTransformMakeScale(-1, 1)
        : CGAffineTransformIdentity;
}

LYNX_PROP_SETTER("zOrder", setZOrderProp, NSNumber *) {
    RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
    videoView.layer.zPosition = value.floatValue;
}

// ── Cleanup ────────────────────────────────────────────────────────────────

- (void)dealloc {
    if (_currentTrack) {
        RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
        [_currentTrack removeRenderer:videoView];
        _currentTrack = nil;
    }
}

@end