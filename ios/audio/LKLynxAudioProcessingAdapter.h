#import <Foundation/Foundation.h>
#import <WebRTC/WebRTC.h>

NS_ASSUME_NONNULL_BEGIN

@protocol LKLynxExternalAudioProcessingDelegate

- (void)audioProcessingInitializeWithSampleRate:(size_t)sampleRateHz
                                       channels:(size_t)channels;

- (void)audioProcessingProcess:(RTC_OBJC_TYPE(RTCAudioBuffer) * _Nonnull)audioBuffer;

- (void)audioProcessingRelease;

@end

/**
 * Adapter that forwards WebRTC audio processing callbacks to registered
 * `RTCAudioRenderer` instances and external processors.
 *
 * Thread-safe using os_unfair_lock.
 */
@interface LKLynxAudioProcessingAdapter : NSObject <RTCAudioCustomProcessingDelegate>

- (nonnull instancetype)init;

- (void)addProcessing:(id<LKLynxExternalAudioProcessingDelegate> _Nonnull)processor;
- (void)removeProcessing:(id<LKLynxExternalAudioProcessingDelegate> _Nonnull)processor;

- (void)addAudioRenderer:(nonnull id<RTCAudioRenderer>)renderer;
- (void)removeAudioRenderer:(nonnull id<RTCAudioRenderer>)renderer;

@end

NS_ASSUME_NONNULL_END
