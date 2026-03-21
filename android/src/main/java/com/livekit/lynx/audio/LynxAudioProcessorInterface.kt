// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../audio/LynxAudioProcessorInterface.kt
// Port of AudioProcessorInterface.kt from @livekit/react-native. Zero changes.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.audio

import java.nio.ByteBuffer

/**
 * Interface for external audio processing in the WebRTC pipeline.
 * Implement this and register via [LynxAudioProcessingController] to
 * intercept and modify captured or rendered audio frames.
 */
interface LynxAudioProcessorInterface {

    /** Whether this processor is currently active. */
    fun isEnabled(): Boolean

    /** Human-readable name for this processor (used in logging). */
    fun getName(): String

    /**
     * Called when the audio pipeline is initialised.
     * Always called before the first [processAudio] call.
     */
    fun initializeAudioProcessing(sampleRateHz: Int, numChannels: Int)

    /**
     * Called when the sample rate changes (e.g. device switch).
     */
    fun resetAudioProcessing(newRate: Int)

    /**
     * Process a 10 ms audio frame.
     *
     * **This is called on the WebRTC audio thread — keep it fast.**
     *
     * @param numBands  Number of frequency bands
     * @param numFrames Number of frames in the buffer
     * @param buffer    Interleaved PCM int16 data (direct ByteBuffer)
     */
    fun processAudio(numBands: Int, numFrames: Int, buffer: ByteBuffer)
}

/**
 * Extension of [LynxAudioProcessorInterface] that supports server-side
 * authentication (e.g. for noise-cancellation services).
 */
interface LynxAuthedAudioProcessorInterface : LynxAudioProcessorInterface {
    fun authenticate(url: String, token: String)
}
