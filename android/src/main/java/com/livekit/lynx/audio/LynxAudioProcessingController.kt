// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../audio/LynxAudioProcessingController.kt
// Port of CustomAudioProcessingFactory.kt + AudioProcessingController.kt
// from @livekit/react-native.
// Zero logic changes — only package, class names, and imports updated.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.audio

import org.webrtc.ExternalAudioProcessingFactory
import java.nio.ByteBuffer

// ─────────────────────────────────────────────────────────────────────────────
// LynxAudioProcessingController interface
// Port of AudioProcessingController.kt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exposes control over the WebRTC external audio processing pipeline.
 * Obtain an instance via [LynxCustomAudioProcessingController].
 */
interface LynxAudioProcessingController {

    /** Audio processor applied after capture (pre-send). */
    var capturePostProcessor: LynxAudioProcessorInterface?

    /** Audio processor applied before render (pre-play). */
    var renderPreProcessor: LynxAudioProcessorInterface?

    /** Bypass render pre-processing without removing the processor. */
    var bypassRenderPreProcessing: Boolean

    /** Bypass capture post-processing without removing the processor. */
    var bypassCapturePostProcessing: Boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxCustomAudioProcessingController
// Port of CustomAudioProcessingController.kt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Concrete implementation of [LynxAudioProcessingController].
 * Wires [LynxAudioProcessorInterface] implementations into the
 * `ExternalAudioProcessingFactory` used by WebRTC.
 *
 * Instantiated inside [LiveKitLynx.setup] and stored as a singleton.
 * The [externalAudioProcessor] is passed to `WebRTC`'s audio pipeline.
 */
class LynxCustomAudioProcessingController(
    capturePostProcessor: LynxAudioProcessorInterface? = null,
    renderPreProcessor:   LynxAudioProcessorInterface? = null,
    bypassRenderPreProcessing:   Boolean = false,
    bypassCapturePostProcessing: Boolean = false,
) : LynxAudioProcessingController {

    /** The WebRTC external audio processor — pass to `PeerConnectionFactory`. */
    val externalAudioProcessor: ExternalAudioProcessingFactory =
        ExternalAudioProcessingFactory()

    // ── capturePostProcessor ─────────────────────────────────────────────────
    override var capturePostProcessor: LynxAudioProcessorInterface? =
        capturePostProcessor
        set(value) {
            field = value
            externalAudioProcessor.setCapturePostProcessing(value.toBridge())
        }

    // ── renderPreProcessor ───────────────────────────────────────────────────
    override var renderPreProcessor: LynxAudioProcessorInterface? =
        renderPreProcessor
        set(value) {
            field = value
            externalAudioProcessor.setRenderPreProcessing(value.toBridge())
        }

    // ── bypass flags ─────────────────────────────────────────────────────────
    override var bypassCapturePostProcessing: Boolean =
        bypassCapturePostProcessing
        set(value) {
            field = value
            externalAudioProcessor.setBypassFlagForCapturePost(value)
        }

    override var bypassRenderPreProcessing: Boolean =
        bypassRenderPreProcessing
        set(value) {
            field = value
            externalAudioProcessor.setBypassFlagForRenderPre(value)
        }

    init {
        // Apply initial processors if provided
        this.capturePostProcessor = capturePostProcessor
        this.renderPreProcessor   = renderPreProcessor
        this.bypassCapturePostProcessing = bypassCapturePostProcessing
        this.bypassRenderPreProcessing   = bypassRenderPreProcessing
    }

    // ── Private bridge ────────────────────────────────────────────────────────

    private class ProcessingBridge(
        private val processor: LynxAudioProcessorInterface?,
    ) : ExternalAudioProcessingFactory.AudioProcessing {

        override fun initialize(sampleRateHz: Int, numChannels: Int) {
            processor?.initializeAudioProcessing(sampleRateHz, numChannels)
        }

        override fun reset(newRate: Int) {
            processor?.resetAudioProcessing(newRate)
        }

        override fun process(numBands: Int, numFrames: Int, buffer: ByteBuffer?) {
            buffer?.let { processor?.processAudio(numBands, numFrames, it) }
        }
    }

    private fun LynxAudioProcessorInterface?.toBridge(): ExternalAudioProcessingFactory.AudioProcessing =
        ProcessingBridge(this)
}
