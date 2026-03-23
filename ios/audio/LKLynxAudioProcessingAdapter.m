#import "LKLynxAudioProcessingAdapter.h"
#import <WebRTC/RTCAudioRenderer.h>
#import <os/lock.h>

@implementation LKLynxAudioProcessingAdapter {
    NSMutableArray<id<RTCAudioRenderer>> *_renderers;
    NSMutableArray<id<LKLynxExternalAudioProcessingDelegate>> *_processors;
    os_unfair_lock _lock;
    BOOL _isInitialized;
    size_t _sampleRateHz;
    size_t _channels;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _isInitialized = NO;
        _lock = OS_UNFAIR_LOCK_INIT;
        _renderers  = [[NSMutableArray<id<RTCAudioRenderer>> alloc] init];
        _processors = [[NSMutableArray<id<LKLynxExternalAudioProcessingDelegate>> alloc] init];
    }
    return self;
}

- (void)addProcessing:(id<LKLynxExternalAudioProcessingDelegate>)processor {
    os_unfair_lock_lock(&_lock);
    [_processors addObject:processor];
    if (_isInitialized) {
        [processor audioProcessingInitializeWithSampleRate:_sampleRateHz channels:_channels];
    }
    os_unfair_lock_unlock(&_lock);
}

- (void)removeProcessing:(id<LKLynxExternalAudioProcessingDelegate>)processor {
    os_unfair_lock_lock(&_lock);
    NSPredicate *pred = [NSPredicate predicateWithBlock:^BOOL(id obj, NSDictionary *_) {
        return obj != processor;
    }];
    _processors = [[_processors filteredArrayUsingPredicate:pred] mutableCopy];
    os_unfair_lock_unlock(&_lock);
}

- (void)addAudioRenderer:(id<RTCAudioRenderer>)renderer {
    os_unfair_lock_lock(&_lock);
    [_renderers addObject:renderer];
    os_unfair_lock_unlock(&_lock);
}

- (void)removeAudioRenderer:(id<RTCAudioRenderer>)renderer {
    os_unfair_lock_lock(&_lock);
    NSPredicate *pred = [NSPredicate predicateWithBlock:^BOOL(id obj, NSDictionary *_) {
        return obj != renderer;
    }];
    _renderers = [[_renderers filteredArrayUsingPredicate:pred] mutableCopy];
    os_unfair_lock_unlock(&_lock);
}

// MARK: - RTCAudioCustomProcessingDelegate

- (void)audioProcessingInitializeWithSampleRate:(size_t)sampleRateHz
                                       channels:(size_t)channels {
    os_unfair_lock_lock(&_lock);
    _isInitialized = YES;
    _sampleRateHz  = sampleRateHz;
    _channels      = channels;
    for (id<LKLynxExternalAudioProcessingDelegate> p in _processors) {
        [p audioProcessingInitializeWithSampleRate:sampleRateHz channels:channels];
    }
    os_unfair_lock_unlock(&_lock);
}

- (void)audioProcessingProcess:(RTC_OBJC_TYPE(RTCAudioBuffer) *)audioBuffer {
    os_unfair_lock_lock(&_lock);
    for (id<LKLynxExternalAudioProcessingDelegate> p in _processors) {
        [p audioProcessingProcess:audioBuffer];
    }
    AVAudioPCMBuffer *pcmBuffer = [self toPCMBuffer:audioBuffer];
    if (pcmBuffer) {
        for (id<RTCAudioRenderer> r in _renderers) {
            [r renderPCMBuffer:pcmBuffer];
        }
    }
    os_unfair_lock_unlock(&_lock);
}

- (void)audioProcessingRelease {
    os_unfair_lock_lock(&_lock);
    for (id<LKLynxExternalAudioProcessingDelegate> p in _processors) {
        [p audioProcessingRelease];
    }
    _isInitialized = NO;
    os_unfair_lock_unlock(&_lock);
}

// MARK: - Private

- (nullable AVAudioPCMBuffer *)toPCMBuffer:(RTC_OBJC_TYPE(RTCAudioBuffer) *)audioBuffer {
    AVAudioFormat *format = [[AVAudioFormat alloc]
        initWithCommonFormat:AVAudioPCMFormatInt16
                  sampleRate:audioBuffer.frames * 100.0
                    channels:(AVAudioChannelCount)audioBuffer.channels
                 interleaved:NO];
    AVAudioPCMBuffer *pcm = [[AVAudioPCMBuffer alloc]
        initWithPCMFormat:format
            frameCapacity:(AVAudioFrameCount)audioBuffer.frames];
    if (!pcm) return nil;
    pcm.frameLength = (AVAudioFrameCount)audioBuffer.frames;
    for (NSUInteger i = 0; i < (NSUInteger)audioBuffer.channels; i++) {
        float    *src = [audioBuffer rawBufferForChannel:(int)i];
        int16_t  *dst = (int16_t *)pcm.int16ChannelData[i];
        for (NSUInteger f = 0; f < (NSUInteger)audioBuffer.frames; f++) {
            dst[f] = (int16_t)src[f];
        }
    }
    return pcm;
}

@end
