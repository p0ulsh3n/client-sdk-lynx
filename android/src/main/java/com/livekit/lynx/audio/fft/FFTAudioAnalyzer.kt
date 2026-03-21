// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../audio/fft/FFTAudioAnalyzer.kt
// Port of FFTAudioAnalyzer from the React Native SDK.
// Zero logic changes — package and import updated only.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.audio.fft

import android.media.AudioTrack
import com.livekit.lynx.audio.AudioFormat
import com.paramsen.noise.Noise
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import kotlin.math.max

/**
 * A Fast Fourier Transform analyser for raw PCM audio bytes.
 * Add bytes with [queueInput] and collect from [fftFlow].
 */
class FFTAudioAnalyzer {

    companion object {
        const val SAMPLE_SIZE = 1024
        private val EMPTY_BUFFER =
            ByteBuffer.allocateDirect(0).order(ByteOrder.nativeOrder())
        private const val BUFFER_EXTRA_SIZE = SAMPLE_SIZE * 8
        private const val SHORT_SIZE = 2
    }

    val isActive: Boolean get() = noise != null

    private var noise: Noise? = null
    private lateinit var inputAudioFormat: AudioFormat

    val configuredInputFormat: AudioFormat?
        get() = if (::inputAudioFormat.isInitialized) inputAudioFormat else null

    private var audioTrackBufferSize = 0
    private var fftBuffer: ByteBuffer = EMPTY_BUFFER
    private lateinit var srcBuffer: ByteBuffer
    private var srcBufferPosition = 0
    private val tempShortArray = ShortArray(SAMPLE_SIZE)
    private val src = FloatArray(SAMPLE_SIZE)

    private val mutableFftFlow = MutableSharedFlow<FloatArray>(
        replay = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val fftFlow: Flow<FloatArray> = mutableFftFlow

    fun configure(inputAudioFormat: AudioFormat) {
        this.inputAudioFormat = inputAudioFormat
        noise = Noise.real(SAMPLE_SIZE)
        audioTrackBufferSize = getDefaultBufferSizeInBytes(inputAudioFormat)
        srcBuffer = ByteBuffer.allocate(audioTrackBufferSize + BUFFER_EXTRA_SIZE)
    }

    fun release() {
        noise?.close()
        noise = null
    }

    fun queueInput(inputBuffer: ByteBuffer) {
        if (!isActive) return

        var position = inputBuffer.position()
        val limit = inputBuffer.limit()
        val frameCount = (limit - position) / (SHORT_SIZE * inputAudioFormat.numberOfChannels)
        val singleChannelOutputSize = frameCount * SHORT_SIZE

        if (fftBuffer.capacity() < singleChannelOutputSize) {
            fftBuffer = ByteBuffer.allocateDirect(singleChannelOutputSize)
                .order(ByteOrder.nativeOrder())
        } else {
            fftBuffer.clear()
        }

        while (position < limit) {
            var summed = 0
            for (ch in 0 until inputAudioFormat.numberOfChannels) {
                summed += inputBuffer.getShort(position + 2 * ch)
            }
            fftBuffer.putShort((summed / inputAudioFormat.numberOfChannels).toShort())
            position += inputAudioFormat.numberOfChannels * 2
        }
        inputBuffer.position(position)

        processFFT(fftBuffer)
    }

    private fun processFFT(buffer: ByteBuffer) {
        if (noise == null) return
        srcBuffer.put(buffer.array())
        srcBufferPosition += buffer.array().size
        val bytesToProcess = SAMPLE_SIZE * 2
        while (srcBufferPosition > bytesToProcess) {
            srcBuffer.position(0)
            srcBuffer.asShortBuffer().get(tempShortArray, 0, SAMPLE_SIZE)
            tempShortArray.forEachIndexed { index, sample ->
                src[index] = sample.toFloat() / Short.MAX_VALUE
            }
            srcBuffer.position(bytesToProcess)
            srcBuffer.compact()
            srcBufferPosition -= bytesToProcess
            srcBuffer.position(srcBufferPosition)
            val dst = FloatArray(SAMPLE_SIZE + 2)
            val fft = noise!!.fft(src, dst)
            mutableFftFlow.tryEmit(fft)
        }
    }

    private fun durationUsToFrames(sampleRate: Int, durationUs: Long): Long =
        durationUs * sampleRate / TimeUnit.MICROSECONDS.convert(1, TimeUnit.SECONDS)

    private fun getPcmFrameSize(channelCount: Int): Int = channelCount * 2

    private fun getAudioTrackChannelConfig(channelCount: Int): Int = when (channelCount) {
        1 -> android.media.AudioFormat.CHANNEL_OUT_MONO
        2 -> android.media.AudioFormat.CHANNEL_OUT_STEREO
        else -> android.media.AudioFormat.CHANNEL_INVALID
    }

    private fun getDefaultBufferSizeInBytes(audioFormat: AudioFormat): Int {
        val outputPcmFrameSize = getPcmFrameSize(audioFormat.numberOfChannels)
        val minBuffer = AudioTrack.getMinBufferSize(
            audioFormat.sampleRate,
            getAudioTrackChannelConfig(audioFormat.numberOfChannels),
            android.media.AudioFormat.ENCODING_PCM_16BIT,
        )
        check(minBuffer != AudioTrack.ERROR_BAD_VALUE)
        val multiplied = minBuffer * 4
        val minApp = durationUsToFrames(audioFormat.sampleRate, 30 * 1000).toInt() * outputPcmFrameSize
        val maxApp = max(
            minBuffer.toLong(),
            durationUsToFrames(audioFormat.sampleRate, 500 * 1000) * outputPcmFrameSize,
        ).toInt()
        val frames = multiplied.coerceIn(minApp, maxApp) / outputPcmFrameSize
        return frames * outputPcmFrameSize
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioFormat data class
// ─────────────────────────────────────────────────────────────────────────────
