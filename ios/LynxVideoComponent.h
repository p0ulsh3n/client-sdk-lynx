// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — ios/LynxVideoComponent.h
// Objective-C header for the LynxUI<RTCMTLVideoView> video component.
// ─────────────────────────────────────────────────────────────────────────────

#import <Lynx/LynxUI.h>
#import <Lynx/LynxShadowNode.h>
#import <WebRTC/RTCMTLVideoView.h>
#import <WebRTC/RTCVideoTrack.h>

NS_ASSUME_NONNULL_BEGIN

@interface LynxVideoShadowNode : LynxShadowNode
@end

@interface LynxVideoComponentUI : LynxUI<RTCMTLVideoView *>

@property (nonatomic, strong, nullable) RTCVideoTrack *currentTrack;
@property (nonatomic, copy, nullable)   NSString      *streamURL;

@end

NS_ASSUME_NONNULL_END
