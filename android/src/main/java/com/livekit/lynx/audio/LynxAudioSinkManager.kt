// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../audio/LynxAudioSinkManager.kt
// Port of AudioSinkManager.kt from @livekit/react-native.
//
// Changes:
//   - ReactContext → LynxContext
//   - WebRTCModule.getTrack → TrackRegistry
//   - LiveKitReactNative.audioRecordSamplesDispatcher → LynxAudioRecordDispatcher
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.audio

import com.livekit.lynx.internal.TrackRegistry
import org.webrtc.AudioTrack
import org.webrtc.AudioTrackSink
import java.util.Collections
import java.util.UUID

private const val LOCAL_PC_ID = -1

/**
 * Thread-safe registry of `AudioTrackSink` instances.
 * Handles both local mic sinks (via [LynxAudioRecordDispatcher])
 * and remote track sinks.
 */
class LynxAudioSinkManager {

    private val sinks = Collections.synchronizedMap(
        mutableMapOf<String, AudioTrackSink>()
    )

    // ── Registration ─────────────────────────────────────────────────────────

    /**
     * Registers a sink and returns its tag.
     * The tag is used in all subsequent calls to identify this sink.
     */
    fun registerSink(sink: AudioTrackSink): String {
        val tag = UUID.randomUUID().toString()
        sinks[tag] = sink
        return tag
    }

    /** Removes the sink from the registry. Does NOT detach from tracks. */
    fun unregisterSink(tag: String) {
        sinks.remove(tag)
    }

    /** Removes the sink from the registry by reference. */
    fun unregisterSink(sink: AudioTrackSink) {
        synchronized(sinks) {
            sinks.entries.removeIf { it.value === sink }
        }
    }

    fun getSink(tag: String): AudioTrackSink? = sinks[tag]

    // ── Attach / Detach ───────────────────────────────────────────────────────

    /**
     * Attaches a sink to the audio track identified by [pcId] / [trackId].
     *
     * When `pcId == -1`, routes through [LynxAudioRecordDispatcher]
     * (local mic). Otherwise, calls `AudioTrack.addSink`.
     */
    fun attachSinkToTrack(sink: AudioTrackSink, pcId: Int, trackId: String) {
        if (pcId == LOCAL_PC_ID) {
            LynxAudioRecordDispatcher.registerSink(sink)
        } else {
            val track = TrackRegistry.getTrack(trackId) as? AudioTrack
                ?: throw IllegalArgumentException(
                    "Audio track not found: pcId=$pcId trackId=$trackId"
                )
            track.addSink(sink)
        }
    }

    fun detachSinkFromTrack(sink: AudioTrackSink, pcId: Int, trackId: String) {
        if (pcId == LOCAL_PC_ID) {
            LynxAudioRecordDispatcher.unregisterSink(sink)
        } else {
            val track = TrackRegistry.getTrack(trackId) as? AudioTrack
                ?: return  // Fail silently — track may already be released
            track.removeSink(sink)
        }
    }

    fun detachSinkFromTrack(tag: String, pcId: Int, trackId: String) {
        val sink = sinks[tag]
            ?: throw IllegalArgumentException("Sink not found for tag: $tag")
        detachSinkFromTrack(sink, pcId, trackId)
    }
}
