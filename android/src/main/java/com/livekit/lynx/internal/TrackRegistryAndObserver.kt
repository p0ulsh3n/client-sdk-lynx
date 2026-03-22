// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../internal/TrackRegistry.kt
// Thread-safe registry for MediaStreamTrack and MediaStream instances.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.internal

import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.util.concurrent.ConcurrentHashMap

object TrackRegistry {

    private val tracks  = ConcurrentHashMap<String, MediaStreamTrack>()
    private val streams = ConcurrentHashMap<String, MediaStream>()

    fun registerTrack(id: String, track: MediaStreamTrack) { tracks[id] = track }
    fun getTrack(id: String): MediaStreamTrack?             = tracks[id]
    fun removeTrack(id: String)                             { tracks.remove(id)?.dispose() }
    fun getAudioTrack(pcId: Int, trackId: String): AudioTrack? = tracks[trackId] as? AudioTrack

    fun registerStream(id: String, stream: MediaStream) { streams[id] = stream }
    fun getStream(id: String): MediaStream?              = streams[id]
    fun removeStream(id: String)                         { streams.remove(id) }
}

// ─────────────────────────────────────────────────────────────────────────────
// PeerConnectionObserver — routes WebRTC events to LK_PC_EVENT bus
// ─────────────────────────────────────────────────────────────────────────────





class PeerConnectionObserver(
    private val pcId: Int,
    private val emit: (String) -> Unit,
) : PeerConnection.Observer {

    private fun event(type: String, extra: Map<String, Any?> = emptyMap()): String =
        JSONObject().apply {
            put("type", type)
            put("pcId", pcId)
            extra.forEach { (k, v) -> if (v != null) put(k, v) else put(k, JSONObject.NULL) }
        }.toString()

    override fun onSignalingChange(state: PeerConnection.SignalingState) {
        emit(event("signalingStateChanged", mapOf("state" to state.toStringValue())))
    }

    override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
        emit(event("iceConnectionStateChanged", mapOf("state" to state.toStringValue())))
    }

    override fun onIceConnectionReceivingChange(receiving: Boolean) {}

    override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
        emit(event("iceGatheringStateChanged", mapOf("state" to state.toStringValue())))
    }

    override fun onIceCandidate(candidate: IceCandidate) {
        emit(event("gotIceCandidate", mapOf(
            "candidate" to mapOf(
                "candidate"      to candidate.sdp,
                "sdpMid"         to candidate.sdpMid,
                "sdpMLineIndex"  to candidate.sdpMLineIndex,
            )
        )))
    }

    override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) {}

    override fun onAddStream(stream: MediaStream) {
        val tracks = stream.audioTracks.map { t ->
            mapOf("trackId" to t.id(), "kind" to "audio", "streamIds" to listOf(stream.id))
        } + stream.videoTracks.map { t ->
            mapOf("trackId" to t.id(), "kind" to "video", "streamIds" to listOf(stream.id))
        }
        // Register tracks for later lookup
        stream.audioTracks.forEach { TrackRegistry.registerTrack(it.id(), it) }
        stream.videoTracks.forEach { TrackRegistry.registerTrack(it.id(), it) }
        TrackRegistry.registerStream(stream.id, stream)

        emit(event("addStream", mapOf("streamId" to stream.id, "tracks" to tracks)))
    }

    override fun onRemoveStream(stream: MediaStream) {
        emit(event("removeStream", mapOf("streamId" to stream.id)))
    }

    override fun onDataChannel(dc: DataChannel) {
        emit(event("dataChannelDidOpen", mapOf("channelId" to dc.id(), "label" to dc.label())))
    }

    override fun onRenegotiationNeeded() {
        emit(event("negotiationNeeded"))
    }

    override fun onAddTrack(receiver: RtpReceiver, streams: Array<MediaStream>) {
        val track = receiver.track() ?: return
        TrackRegistry.registerTrack(track.id(), track)
        val streamIds = streams.map { it.id }
        streams.forEach {
            it.audioTracks.forEach { t -> TrackRegistry.registerTrack(t.id(), t) }
            it.videoTracks.forEach { t -> TrackRegistry.registerTrack(t.id(), t) }
            TrackRegistry.registerStream(it.id, it)
        }
        emit(event("addTrack", mapOf(
            "receiver" to mapOf(
                "receiverId" to receiver.id(),
                "trackId"    to track.id(),
                "kind"       to if (track is AudioTrack) "audio" else "video",
                "streamIds"  to streamIds,
            )
        )))
    }

    override fun onRemoveTrack(receiver: RtpReceiver) {
        emit(event("removeTrack", mapOf("receiverId" to receiver.id())))
    }

    override fun onStandardizedIceConnectionChange(state: PeerConnection.IceConnectionState) {
        emit(event("connectionStateChanged", mapOf("state" to state.toStringValue())))
    }

    override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
        emit(event("connectionStateChanged", mapOf("state" to state.toStringValue())))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WebRTC enum → string helpers
// ─────────────────────────────────────────────────────────────────────────────

private fun PeerConnection.SignalingState.toStringValue() = when (this) {
    PeerConnection.SignalingState.STABLE                -> "stable"
    PeerConnection.SignalingState.HAVE_LOCAL_OFFER      -> "have-local-offer"
    PeerConnection.SignalingState.HAVE_REMOTE_OFFER     -> "have-remote-offer"
    PeerConnection.SignalingState.HAVE_LOCAL_PRANSWER   -> "have-local-pranswer"
    PeerConnection.SignalingState.HAVE_REMOTE_PRANSWER  -> "have-remote-pranswer"
    PeerConnection.SignalingState.CLOSED                -> "closed"
}

private fun PeerConnection.IceConnectionState.toStringValue() = when (this) {
    PeerConnection.IceConnectionState.NEW          -> "new"
    PeerConnection.IceConnectionState.CHECKING     -> "checking"
    PeerConnection.IceConnectionState.CONNECTED    -> "connected"
    PeerConnection.IceConnectionState.COMPLETED    -> "completed"
    PeerConnection.IceConnectionState.FAILED       -> "failed"
    PeerConnection.IceConnectionState.DISCONNECTED -> "disconnected"
    PeerConnection.IceConnectionState.CLOSED       -> "closed"
}

private fun PeerConnection.IceGatheringState.toStringValue() = when (this) {
    PeerConnection.IceGatheringState.NEW       -> "new"
    PeerConnection.IceGatheringState.GATHERING -> "gathering"
    PeerConnection.IceGatheringState.COMPLETE  -> "complete"
}

private fun PeerConnection.PeerConnectionState.toStringValue() = when (this) {
    PeerConnection.PeerConnectionState.NEW          -> "new"
    PeerConnection.PeerConnectionState.CONNECTING   -> "connecting"
    PeerConnection.PeerConnectionState.CONNECTED    -> "connected"
    PeerConnection.PeerConnectionState.DISCONNECTED -> "disconnected"
    PeerConnection.PeerConnectionState.FAILED       -> "failed"
    PeerConnection.PeerConnectionState.CLOSED       -> "closed"
}
