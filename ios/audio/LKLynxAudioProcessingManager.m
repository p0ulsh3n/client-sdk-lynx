#import "LKLynxAudioProcessingManager.h"

@implementation LKLynxAudioProcessingManager

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    static LKLynxAudioProcessingManager *shared = nil;
    dispatch_once(&onceToken, ^{
        shared = [[self alloc] init];
    });
    return shared;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _audioProcessingModule         = [[RTCDefaultAudioProcessingModule alloc] init];
        _capturePostProcessingAdapter  = [[LKLynxAudioProcessingAdapter alloc] init];
        _renderPreProcessingAdapter    = [[LKLynxAudioProcessingAdapter alloc] init];
        _audioProcessingModule.capturePostProcessingDelegate = _capturePostProcessingAdapter;
        _audioProcessingModule.renderPreProcessingDelegate   = _renderPreProcessingAdapter;
    }
    return self;
}

// MARK: - Local mic (capture post-processing)

- (void)addLocalAudioRenderer:(id<RTCAudioRenderer>)renderer {
    [_capturePostProcessingAdapter addAudioRenderer:renderer];
}

- (void)removeLocalAudioRenderer:(id<RTCAudioRenderer>)renderer {
    [_capturePostProcessingAdapter removeAudioRenderer:renderer];
}

// MARK: - Remote audio (render pre-processing)

- (void)addRemoteAudioRenderer:(id<RTCAudioRenderer>)renderer {
    [_renderPreProcessingAdapter addAudioRenderer:renderer];
}

- (void)removeRemoteAudioRenderer:(id<RTCAudioRenderer>)renderer {
    [_renderPreProcessingAdapter removeAudioRenderer:renderer];
}

// MARK: - External processors

- (void)addCapturePostProcessor:(id<LKLynxExternalAudioProcessingDelegate>)processor {
    [_capturePostProcessingAdapter addProcessing:processor];
}

- (void)removeCapturePostProcessor:(id<LKLynxExternalAudioProcessingDelegate>)processor {
    [_capturePostProcessingAdapter removeProcessing:processor];
}

- (void)addRenderPreProcessor:(id<LKLynxExternalAudioProcessingDelegate>)processor {
    [_renderPreProcessingAdapter addProcessing:processor];
}

- (void)removeRenderPreProcessor:(id<LKLynxExternalAudioProcessingDelegate>)processor {
    [_renderPreProcessingAdapter removeProcessing:processor];
}

@end
