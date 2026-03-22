// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../audio/LynxAudioProcessors.kt
// Port of VolumeProcessor, MultibandVolumeProcessor, AudioSinkProcessor.
// Only change: ReactContext.emit → callback lambda.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.audio

import com.livekit.lynx.audio.fft.AudioFormat
import com.livekit.lynx.audio.fft.FFTAudioAnalyzer
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.webrtc.AudioTrackSink
import java.nio.ByteBuffer
import kotlin.math.roundToInt
import kotlin.math.sqrt
import kotlin.time.Duration

// ─────────────────────────────────────────────────────────────────────────────
// BaseVolumeProcessor → LynxVolumeProcessor
// ─────────────────────────────────────────────────────────────────────────────

abstract class BaseLynxVolumeProcessor : AudioTrackSink {

    abstract fun onVolumeCalculated(volume: Double)

    override fun onData(
        audioData: ByteBuffer,
        bitsPerSample: Int,
        sampleRate: Int,
        numberOfChannels: Int,
        numberOfFrames: Int,
        absoluteCaptureTimestampMs: Long,
    ) {
        audioData.mark()
        audioData.position(0)

        val bytesPerSample = bitsPerSample / 8
        var sumSquares = 0L

        for (i in 0 until numberOfFrames) {
            val value: Long = when (bytesPerSample) {
                1 -> audioData.get().toLong()
                2 -> audioData.short.toLong()
                4 -> audioData.int.toLong()
                else -> throw IllegalArgumentException("Unsupported bitsPerSample: $bitsPerSample")
            }
            sumSquares += value * value
        }

        val rms = sqrt((sumSquares / numberOfFrames).toDouble()).toLong()
        val normalized = when (bytesPerSample) {
            1 -> rms.toDouble() / Byte.MAX_VALUE
            2 -> rms.toDouble() / Short.MAX_VALUE
            4 -> rms.toDouble() / Int.MAX_VALUE
            else -> throw IllegalArgumentException("Unsupported bitsPerSample: $bitsPerSample")
        }

        audioData.reset()
        onVolumeCalculated(normalized)
    }
}

class LynxVolumeProcessor(
    private val onVolume: (volume: Double, tag: String) -> Unit,
) : BaseLynxVolumeProcessor() {

    var reactTag: String? = null

    override fun onVolumeCalculated(volume: Double) {
        val tag = reactTag ?: return
        onVolume(volume, tag)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BaseMultibandVolumeProcessor → LynxMultibandVolumeProcessor
// ─────────────────────────────────────────────────────────────────────────────

abstract class BaseLynxMultibandVolumeProcessor(
    val minFrequency: Float,
    val maxFrequency: Float,
    val barCount: Int,
    val interval: Duration,
) : AudioTrackSink {

    private val analyzer = FFTAudioAnalyzer()
    private var scope: CoroutineScope? = null

    abstract fun onMagnitudesCollected(magnitudes: FloatArray)

    fun start() {
        scope?.cancel()
        val newScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        scope = newScope
        newScope.launch {
            val averages = FloatArray(barCount)
            analyzer.fftFlow.throttleLatest(interval).collect { fft ->
                val fmt = analyzer.configuredInputFormat ?: return@collect
                val lo = (minFrequency * fft.size / (fmt.sampleRate / 2)).roundToInt().coerceIn(fft.indices)
                val hi = (maxFrequency * fft.size / (fmt.sampleRate / 2)).roundToInt().coerceIn(fft.indices)
                val sliced = fft.slice(lo until hi)
                val magnitudes = calculateAmplitudeBars(sliced, averages, barCount)
                onMagnitudesCollected(magnitudes)
            }
        }
    }

    fun stop() { scope?.cancel(); scope = null }
    fun release() { stop(); analyzer.release() }

    override fun onData(
        audioData: ByteBuffer,
        bitsPerSample: Int,
        sampleRate: Int,
        numberOfChannels: Int,
        numberOfFrames: Int,
        absoluteCaptureTimestampMs: Long,
    ) {
        val cur = analyzer.configuredInputFormat
        if (cur == null ||
            cur.bitsPerSample != bitsPerSample ||
            cur.sampleRate != sampleRate ||
            cur.numberOfChannels != numberOfChannels
        ) {
            analyzer.configure(AudioFormat(bitsPerSample, sampleRate, numberOfChannels))
        }
        analyzer.queueInput(audioData)
    }
}

class LynxMultibandVolumeProcessor(
    minFrequency: Float,
    maxFrequency: Float,
    barCount: Int,
    interval: Duration,
    private val onMagnitudes: (FloatArray, String) -> Unit,
) : BaseLynxMultibandVolumeProcessor(minFrequency, maxFrequency, barCount, interval) {

    var reactTag: String? = null

    override fun onMagnitudesCollected(magnitudes: FloatArray) {
        val tag = reactTag ?: return
        onMagnitudes(magnitudes, tag)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioSinkProcessor → LynxAudioSinkProcessor
// ─────────────────────────────────────────────────────────────────────────────

abstract class BaseLynxAudioSinkProcessor : AudioTrackSink {
    abstract fun onAudioData(byteArray: ByteArray)

    override fun onData(
        audioData: ByteBuffer,
        bitsPerSample: Int,
        sampleRate: Int,
        numberOfChannels: Int,
        numberOfFrames: Int,
        absoluteCaptureTimestampMs: Long,
    ) {
        val bytes: ByteArray = if (audioData.hasArray()) {
            val arr = audioData.array()
            arr.copyOfRange(audioData.arrayOffset(), arr.size)
        } else {
            audioData.mark()
            audioData.position(0)
            ByteArray(audioData.remaining()).also {
                audioData.get(it)
                audioData.reset()
            }
        }
        onAudioData(bytes)
    }
}

class LynxAudioSinkProcessor(
    private val onData: (base64Data: String, tag: String) -> Unit,
) : BaseLynxAudioSinkProcessor() {

    var reactTag: String? = null

    override fun onAudioData(byteArray: ByteArray) {
        val tag = reactTag ?: return
        val encoded = android.util.Base64.encodeToString(byteArray, android.util.Base64.NO_WRAP)
        onData(encoded, tag)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — ported verbatim from MultibandVolumeProcessor.kt (RN SDK)
// ─────────────────────────────────────────────────────────────────────────────

private const val MIN_CONST = 2f
private const val MAX_CONST = 25f

private fun calculateAmplitudeBars(
    fft: List<Float>,
    averages: FloatArray,
    barCount: Int,
): FloatArray {
    val amplitudes = FloatArray(barCount)
    if (fft.isEmpty()) return amplitudes

    for (barIndex in 0 until barCount) {
        val prevLimit = (Math.round(fft.size.toFloat() / 2 * barIndex / barCount) * 2)
            .coerceIn(0, fft.size - 1)
        val nextLimit = (Math.round(fft.size.toFloat() / 2 * (barIndex + 1) / barCount) * 2)
            .coerceIn(0, fft.size - 1)

        var accum = 0f
        for (i in prevLimit until nextLimit step 2) {
            val realSq = fft[i].toDouble().let { it * it }
            val imagSq = fft[i + 1].toDouble().let { it * it }
            accum += Math.sqrt(realSq + imagSq).toFloat()
        }
        if ((nextLimit - prevLimit) != 0) accum /= (nextLimit - prevLimit)

        val sf = 5
        var avg = averages[barIndex]
        avg += (accum - avg / sf)
        averages[barIndex] = avg

        var amplitude = avg.coerceIn(MIN_CONST, MAX_CONST)
        amplitude -= MIN_CONST
        amplitude /= (MAX_CONST - MIN_CONST)
        amplitudes[barIndex] = amplitude
    }
    return amplitudes
}

private fun <T> Flow<T>.throttleLatest(interval: Duration): Flow<T> =
    conflate().transform {
        emit(it)
        delay(interval)
    }
