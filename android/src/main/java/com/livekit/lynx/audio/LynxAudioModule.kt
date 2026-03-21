// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../audio/LynxAudioModule.kt
// Port of LivekitReactNativeModule audio methods to Lynx.
// Replaces ReactContext → LynxContext, RCTDeviceEventEmitter → sendGlobalEvent.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.audio

import android.content.Context
import com.livekit.lynx.internal.TrackRegistry
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.tasm.behavior.LynxContext
import org.json.JSONObject
import org.webrtc.AudioTrack
import org.webrtc.AudioTrackSink
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.milliseconds

private const val LOCAL_PC_ID = -1

class LynxAudioModule(context: Context) : LynxModule(context) {

    private val lynxCtx get() = mContext as LynxContext
    private val sinkManager = LynxAudioSinkManager()

    @LynxMethod
    fun createVolumeProcessor(pcId: Double, trackId: String, callback: Callback) {
        val processor = LynxVolumeProcessor { volume, tag ->
            lynxCtx.sendGlobalEvent(
                "LK_VOLUME_PROCESSED",
                JSONObject().apply { put("volume", volume); put("id", tag) }.toString()
            )
        }
        val tag = sinkManager.register(processor)
        processor.reactTag = tag
        attachSink(processor, pcId.toInt(), trackId)
        callback.invoke(null, tag)
    }

    @LynxMethod
    fun deleteVolumeProcessor(reactTag: String, pcId: Double, trackId: String, callback: Callback) {
        detachSink(reactTag, pcId.toInt(), trackId)
        sinkManager.unregister(reactTag)
        callback.invoke(null, null)
    }

    @LynxMethod
    fun createMultibandVolumeProcessor(optionsJson: String, pcId: Double, trackId: String, callback: Callback) {
        val opts = JSONObject(optionsJson)
        val bands    = opts.optInt("bands", 5)
        val minFreq  = opts.optDouble("minFrequency", 1000.0).toFloat()
        val maxFreq  = opts.optDouble("maxFrequency", 8000.0).toFloat()
        val interval = opts.optDouble("updateInterval", 40.0)

        val processor = LynxMultibandVolumeProcessor(
            minFrequency = minFreq,
            maxFrequency = maxFreq,
            barCount = bands,
            interval = interval.milliseconds
        ) { magnitudes, tag ->
            lynxCtx.sendGlobalEvent(
                "LK_MULTIBAND_PROCESSED",
                JSONObject().apply {
                    put("magnitudes", magnitudes.toList())
                    put("id", tag)
                }.toString()
            )
        }
        val tag = sinkManager.register(processor)
        processor.reactTag = tag
        attachSink(processor, pcId.toInt(), trackId)
        processor.start()
        callback.invoke(null, tag)
    }

    @LynxMethod
    fun deleteMultibandVolumeProcessor(reactTag: String, pcId: Double, trackId: String, callback: Callback) {
        val sink = sinkManager.getSink(reactTag)
        detachSinkObject(sink, pcId.toInt(), trackId)
        sinkManager.unregister(reactTag)
        (sink as? LynxMultibandVolumeProcessor)?.release()
        callback.invoke(null, null)
    }

    @LynxMethod
    fun createAudioSinkListener(pcId: Double, trackId: String, callback: Callback) {
        val processor = LynxAudioSinkProcessor { data, tag ->
            lynxCtx.sendGlobalEvent(
                "LK_AUDIO_DATA",
                JSONObject().apply { put("data", data); put("id", tag) }.toString()
            )
        }
        val tag = sinkManager.register(processor)
        processor.reactTag = tag
        attachSink(processor, pcId.toInt(), trackId)
        callback.invoke(null, tag)
    }

    @LynxMethod
    fun deleteAudioSinkListener(reactTag: String, pcId: Double, trackId: String, callback: Callback) {
        detachSink(reactTag, pcId.toInt(), trackId)
        sinkManager.unregister(reactTag)
        callback.invoke(null, null)
    }

    @LynxMethod
    fun setDefaultAudioTrackVolume(volume: Double, callback: Callback) {
        LynxWebRTCDefaults.defaultRemoteAudioVolume = volume
        callback.invoke(null, null)
    }

    // ── Attach / detach helpers ───────────────────────────────────────────────

    private fun attachSink(sink: AudioTrackSink, pcId: Int, trackId: String) {
        if (pcId == LOCAL_PC_ID) {
            LynxAudioRecordDispatcher.registerSink(sink)
        } else {
            (TrackRegistry.getAudioTrack(pcId, trackId) as? AudioTrack)
                ?.addSink(sink)
                ?: android.util.Log.w("LynxAudioModule", "Audio track not found: pcId=$pcId trackId=$trackId")
        }
    }

    private fun detachSink(reactTag: String, pcId: Int, trackId: String) {
        val sink = sinkManager.getSink(reactTag) ?: return
        detachSinkObject(sink, pcId, trackId)
    }

    private fun detachSinkObject(sink: AudioTrackSink?, pcId: Int, trackId: String) {
        if (sink == null) return
        if (pcId == LOCAL_PC_ID) {
            LynxAudioRecordDispatcher.unregisterSink(sink)
        } else {
            (TrackRegistry.getAudioTrack(pcId, trackId) as? AudioTrack)?.removeSink(sink)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxAudioSinkManager — thread-safe registry
// ─────────────────────────────────────────────────────────────────────────────

class LynxAudioSinkManager {
    private val sinks = ConcurrentHashMap<String, AudioTrackSink>()

    fun register(sink: AudioTrackSink): String {
        val tag = UUID.randomUUID().toString()
        sinks[tag] = sink
        return tag
    }

    fun unregister(tag: String) { sinks.remove(tag) }
    fun getSink(tag: String): AudioTrackSink? = sinks[tag]
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxWebRTCDefaults
// ─────────────────────────────────────────────────────────────────────────────

object LynxWebRTCDefaults {
    @Volatile var defaultRemoteAudioVolume: Double = 1.0
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxAudioRecordDispatcher — dispatches local mic samples to registered sinks
// Port of AudioRecordSamplesDispatcher from the RN SDK
// ─────────────────────────────────────────────────────────────────────────────

object LynxAudioRecordDispatcher : org.webrtc.audio.JavaAudioDeviceModule.SamplesReadyCallback {

    private val sinks = java.util.Collections.synchronizedSet(mutableSetOf<AudioTrackSink>())

    fun registerSink(sink: AudioTrackSink)   { sinks.add(sink) }
    fun unregisterSink(sink: AudioTrackSink) { sinks.remove(sink) }

    override fun onWebRtcAudioRecordSamplesReady(
        samples: org.webrtc.audio.JavaAudioDeviceModule.AudioSamples
    ) {
        val bitsPerSample = when (samples.audioFormat) {
            android.media.AudioFormat.ENCODING_PCM_8BIT  -> 8
            android.media.AudioFormat.ENCODING_PCM_16BIT -> 16
            android.media.AudioFormat.ENCODING_PCM_FLOAT -> 32
            else -> 16
        }
        val numFrames = samples.sampleRate / 100
        val ts = android.os.SystemClock.elapsedRealtime()
        val snapshot = synchronized(sinks) { sinks.toSet() }
        for (sink in snapshot) {
            val buf = java.nio.ByteBuffer.wrap(samples.data)
            sink.onData(buf, bitsPerSample, samples.sampleRate, samples.channelCount, numFrames, ts)
        }
    }
}
