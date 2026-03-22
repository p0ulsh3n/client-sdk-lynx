// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../video/LynxVideoFactories.kt
// Port of CustomVideoEncoderFactory, CustomVideoDecoderFactory,
// SimulcastVideoEncoderFactoryWrapper.
// Zero logic changes from the React Native SDK.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.video

import android.util.Log
import org.webrtc.*
import java.util.concurrent.Callable
import java.util.concurrent.Executors

// ─────────────────────────────────────────────────────────────────────────────
// LynxCustomVideoEncoderFactory
// ─────────────────────────────────────────────────────────────────────────────

open class LynxCustomVideoEncoderFactory(
    sharedContext: EglBase.Context?,
    enableIntelVp8Encoder: Boolean,
    enableH264HighProfile: Boolean,
    private var forceSWCodec: Boolean = false,
    private var forceSWCodecs: List<String> = listOf("VP9"),
) : VideoEncoderFactory {

    private val softwareFactory = SoftwareVideoEncoderFactory()
    private val simulcastWrapper = LynxSimulcastVideoEncoderFactoryWrapper(
        sharedContext, enableIntelVp8Encoder, enableH264HighProfile
    )

    fun setForceSWCodec(v: Boolean)         { forceSWCodec = v }
    fun setForceSWCodecList(v: List<String>) { forceSWCodecs = v }

    override fun createEncoder(info: VideoCodecInfo): VideoEncoder? {
        if (forceSWCodec) return softwareFactory.createEncoder(info)
        if (forceSWCodecs.isNotEmpty() && forceSWCodecs.contains(info.name))
            return softwareFactory.createEncoder(info)
        return simulcastWrapper.createEncoder(info)
    }

    override fun getSupportedCodecs(): Array<VideoCodecInfo> =
        if (forceSWCodec && forceSWCodecs.isEmpty()) softwareFactory.supportedCodecs
        else simulcastWrapper.supportedCodecs
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxCustomVideoDecoderFactory
// ─────────────────────────────────────────────────────────────────────────────

open class LynxCustomVideoDecoderFactory(
    private var forceSWCodec: Boolean = false,
    private var forceSWCodecs: List<String> = listOf("VP9"),
) : VideoDecoderFactory {

    private val softwareFactory = SoftwareVideoDecoderFactory()
    private val wrappedFactory  = WrappedVideoDecoderFactory()

    fun setForceSWCodec(v: Boolean)          { forceSWCodec = v }
    fun setForceSWCodecList(v: List<String>)  { forceSWCodecs = v }

    override fun createDecoder(info: VideoCodecInfo): VideoDecoder? {
        if (forceSWCodec) return softwareFactory.createDecoder(info)
        if (forceSWCodecs.isNotEmpty() && forceSWCodecs.contains(info.name))
            return softwareFactory.createDecoder(info)
        return wrappedFactory.createDecoder(info)
    }

    override fun getSupportedCodecs(): Array<VideoCodecInfo> =
        if (forceSWCodec && forceSWCodecs.isEmpty()) softwareFactory.supportedCodecs
        else wrappedFactory.supportedCodecs
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxSimulcastVideoEncoderFactoryWrapper  (port of SimulcastVideoEncoderFactoryWrapper)
// ─────────────────────────────────────────────────────────────────────────────

open class LynxSimulcastVideoEncoderFactoryWrapper(
    sharedContext: EglBase.Context?,
    enableIntelVp8Encoder: Boolean,
    enableH264HighProfile: Boolean,
) : VideoEncoderFactory {

    private inner class FallbackFactory(
        private val hw: VideoEncoderFactory,
    ) : VideoEncoderFactory {
        private val sw: VideoEncoderFactory = SoftwareVideoEncoderFactory()

        override fun createEncoder(info: VideoCodecInfo): VideoEncoder? {
            val swEnc = sw.createEncoder(info)
            val hwEnc = hw.createEncoder(info)
            return if (hwEnc != null && swEnc != null) VideoEncoderFallback(hwEnc, swEnc)
                   else swEnc ?: hwEnc
        }

        override fun getSupportedCodecs(): Array<VideoCodecInfo> {
            val list = mutableListOf<VideoCodecInfo>()
            list.addAll(sw.supportedCodecs)
            list.addAll(hw.supportedCodecs)
            return list.toTypedArray()
        }
    }

    private inner class StreamEncoderWrapper(private val encoder: VideoEncoder) : VideoEncoder {
        private val executor = Executors.newSingleThreadExecutor()
        private var streamSettings: VideoEncoder.Settings? = null

        override fun initEncode(settings: VideoEncoder.Settings, cb: VideoEncoder.Callback?): VideoCodecStatus {
            streamSettings = settings
            return executor.submit(Callable { encoder.initEncode(settings, cb) }).get()
        }

        override fun release(): VideoCodecStatus =
            executor.submit(Callable { encoder.release() }).get()

        override fun encode(frame: VideoFrame, info: VideoEncoder.EncodeInfo?): VideoCodecStatus {
            return executor.submit(Callable {
                val ss = streamSettings
                if (ss == null || frame.buffer.width == ss.width) {
                    encoder.encode(frame, info)
                } else {
                    val orig = frame.buffer
                    val adapted = orig.cropAndScale(0, 0, orig.width, orig.height, ss.width, ss.height)
                    val adaptedFrame = VideoFrame(adapted, frame.rotation, frame.timestampNs)
                    val result = encoder.encode(adaptedFrame, info)
                    adapted.release()
                    result
                }
            }).get()
        }

        override fun setRateAllocation(a: VideoEncoder.BitrateAllocation?, fps: Int): VideoCodecStatus =
            executor.submit(Callable { encoder.setRateAllocation(a, fps) }).get()

        override fun getScalingSettings(): VideoEncoder.ScalingSettings =
            executor.submit(Callable { encoder.scalingSettings }).get()

        override fun getImplementationName(): String =
            executor.submit(Callable { encoder.implementationName }).get()

        override fun createNative(ref: Long): Long =
            executor.submit(Callable { encoder.createNative(ref) }).get()

        override fun isHardwareEncoder(): Boolean =
            executor.submit(Callable { encoder.isHardwareEncoder }).get()

        override fun setRates(p: VideoEncoder.RateControlParameters?): VideoCodecStatus =
            executor.submit(Callable { encoder.setRates(p) }).get()

        override fun getResolutionBitrateLimits(): Array<VideoEncoder.ResolutionBitrateLimits> =
            executor.submit(Callable { encoder.resolutionBitrateLimits }).get()

        override fun getEncoderInfo(): VideoEncoder.EncoderInfo =
            executor.submit(Callable { encoder.encoderInfo }).get()
    }

    private inner class StreamEncoderWrapperFactory(
        private val factory: VideoEncoderFactory,
    ) : VideoEncoderFactory {
        override fun createEncoder(info: VideoCodecInfo?): VideoEncoder? {
            val enc = factory.createEncoder(info) ?: return null
            if (enc is WrappedNativeVideoEncoder) return enc
            return StreamEncoderWrapper(enc)
        }
        override fun getSupportedCodecs(): Array<VideoCodecInfo> = factory.supportedCodecs
    }

    private val primary: VideoEncoderFactory
    private val fallback: VideoEncoderFactory
    private val native: SimulcastVideoEncoderFactory

    init {
        val hw = HardwareVideoEncoderFactory(sharedContext, enableIntelVp8Encoder, enableH264HighProfile)
        primary  = StreamEncoderWrapperFactory(hw)
        fallback = StreamEncoderWrapperFactory(FallbackFactory(primary))
        native   = SimulcastVideoEncoderFactory(primary, fallback)
    }

    override fun createEncoder(info: VideoCodecInfo?): VideoEncoder? = native.createEncoder(info)
    override fun getSupportedCodecs(): Array<VideoCodecInfo> = native.supportedCodecs
}

// ─────────────────────────────────────────────────────────────────────────────
// WrappedVideoDecoderFactory shim (references the real WrappedVideoDecoderFactory)
// ─────────────────────────────────────────────────────────────────────────────

private class WrappedVideoDecoderFactory : VideoDecoderFactory {
    private val wrapped = DefaultVideoDecoderFactory(null)
    override fun createDecoder(info: VideoCodecInfo): VideoDecoder? = wrapped.createDecoder(info)
    override fun getSupportedCodecs(): Array<VideoCodecInfo> = wrapped.supportedCodecs
}
