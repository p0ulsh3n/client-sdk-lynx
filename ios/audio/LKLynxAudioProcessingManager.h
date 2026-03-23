#import <Foundation/Foundation.h>
#import <WebRTC/WebRTC.h>
#import "LKLynxAudioProcessingAdapter.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Singleton that owns the WebRTC audio processing pipeline.
 *
 * Used by `LynxAudioProcessingManager` (Swift) and `LynxWebRTCModule` to
 * route local (capture) and remote (render) audio through registered
 * `RTCAudioRenderer` instances.
 */
@interface LKLynxAudioProcessingManager : NSObject

@property (nonatomic, strong, readonly) RTCDefaultAudioProcessingModule *audioProcessingModule;
@property (nonatomic, strong, readonly) LKLynxAudioProcessingAdapter *capturePostProcessingAdapter;
@property (nonatomic, strong, readonly) LKLynxAudioProcessingAdapter *renderPreProcessingAdapter;

+ (nonnull instancetype)sharedInstance;

// Local mic renderers (capture post-processing)
- (void)addLocalAudioRenderer:(nonnull id<RTCAudioRenderer>)renderer;
- (void)removeLocalAudioRenderer:(nonnull id<RTCAudioRenderer>)renderer;

// Remote audio renderers (render pre-processing)
- (void)addRemoteAudioRenderer:(nonnull id<RTCAudioRenderer>)renderer;
- (void)removeRemoteAudioRenderer:(nonnull id<RTCAudioRenderer>)renderer;

// External processor delegates
- (void)addCapturePostProcessor:(nonnull id<LKLynxExternalAudioProcessingDelegate>)processor;
- (void)removeCapturePostProcessor:(nonnull id<LKLynxExternalAudioProcessingDelegate>)processor;
- (void)addRenderPreProcessor:(nonnull id<LKLynxExternalAudioProcessingDelegate>)processor;
- (void)removeRenderPreProcessor:(nonnull id<LKLynxExternalAudioProcessingDelegate>)processor;

@end

NS_ASSUME_NONNULL_END
