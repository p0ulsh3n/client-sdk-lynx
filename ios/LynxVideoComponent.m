#import "LynxVideoComponent.h"
#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxPropsProcessor.h>

#if __has_include("livekit_lynx-Swift.h")
  #import "livekit_lynx-Swift.h"
#elif __has_include(<livekit_lynx/livekit_lynx-Swift.h>)
  #import <livekit_lynx/livekit_lynx-Swift.h>
#else
  @interface LynxVideoTrackBridge : NSObject
  + (void)findVideoTrackForStreamId:(NSString * _Nonnull)streamId
                         completion:(void (^ _Nonnull)(RTCVideoTrack * _Nullable))completion;
  @end
#endif

#pragma mark - LynxVideoShadowNode

@implementation LynxVideoShadowNode
@end

#pragma mark - LynxVideoComponentUI

@implementation LynxVideoComponentUI

LYNX_LAZY_REGISTER_UI("livekit-webrtc-view")

- (RTCMTLVideoView *)createView {
    RTCMTLVideoView *videoView = [[RTCMTLVideoView alloc] initWithFrame:CGRectZero];
    videoView.videoContentMode = UIViewContentModeScaleAspectFill;
    return videoView;
}

LYNX_PROP_SETTER("streamURL", setStreamURLProp, NSString *) {
    if ([value isEqualToString:_streamURL]) {
        return;
    }
    _streamURL = [value copy];

    RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
    if (_currentTrack) {
        [_currentTrack removeRenderer:videoView];
        _currentTrack = nil;
    }

    NSString *streamId = [value stringByReplacingOccurrencesOfString:@"livekit-stream://"
                                                          withString:@""];
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

- (void)dealloc {
    if (_currentTrack) {
        RTCMTLVideoView *videoView = (RTCMTLVideoView *)self.view;
        [_currentTrack removeRenderer:videoView];
        _currentTrack = nil;
    }
}

@end