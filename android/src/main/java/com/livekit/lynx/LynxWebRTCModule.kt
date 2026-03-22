// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../LynxWebRTCModule.kt
// Lynx NativeModule — RTCPeerConnection, MediaStream, getUserMedia.
//
// Registration (LynxModuleAdapter):
//   LynxEnv.inst().registerModule("LynxWebRTCModule", LynxWebRTCModule::class.java)
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import com.livekit.lynx.internal.PCManager
import com.livekit.lynx.internal.PeerConnectionObserver
import com.livekit.lynx.internal.TrackRegistry
import com.livekit.lynx.internal.createOfferSuspend
import com.livekit.lynx.internal.createAnswerSuspend
import com.livekit.lynx.internal.setLocalDescriptionSuspend
import com.livekit.lynx.internal.setRemoteDescriptionSuspend
import com.livekit.lynx.internal.addIceCandidateSuspend
import com.livekit.lynx.internal.getStatsSuspend
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.tasm.behavior.LynxContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.util.UUID

private const val LOCAL_PC_ID = -1

class LynxWebRTCModule(context: Context) : LynxModule(context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val lynxCtx get() = mContext as LynxContext

    // ── PeerConnection lifecycle ──────────────────────────────────────────────

    @LynxMethod
    fun peerConnectionInit(configJson: String, pcId: Double, callback: Callback) {
        scope.launch {
            try {
                val config = PCManager.parseConfiguration(configJson)
                val observer = PeerConnectionObserver(pcId.toInt()) { event ->
                    lynxCtx.sendGlobalEvent("LK_PC_EVENT", JavaOnlyArray().apply { pushString(event) })
                }
                PCManager.create(pcId.toInt(), config, observer)
                callback.invoke(null, "ok")
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionClose(pcId: Double, callback: Callback) {
        PCManager.close(pcId.toInt())
        callback.invoke(null, null)
    }

    @LynxMethod
    fun peerConnectionDispose(pcId: Double, callback: Callback) {
        PCManager.dispose(pcId.toInt())
        callback.invoke(null, null)
    }

    // ── SDP ───────────────────────────────────────────────────────────────────

    @LynxMethod
    fun peerConnectionCreateOffer(pcId: Double, constraintsJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sdp = pc.createOfferSuspend(MediaConstraints())
                callback.invoke(null, sdpToJSON(sdp))
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionCreateAnswer(pcId: Double, constraintsJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sdp = pc.createAnswerSuspend(MediaConstraints())
                callback.invoke(null, sdpToJSON(sdp))
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionSetLocalDescription(pcId: Double, sdpJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sdp = sdpFromJSON(sdpJson)
                pc.setLocalDescriptionSuspend(sdp)
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionSetRemoteDescription(pcId: Double, sdpJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sdp = sdpFromJSON(sdpJson)
                pc.setRemoteDescriptionSuspend(sdp)
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── ICE ───────────────────────────────────────────────────────────────────

    @LynxMethod
    fun peerConnectionAddICECandidate(pcId: Double, candidateJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val candidate = iceCandidateFromJSON(candidateJson)
                pc.addIceCandidateSuspend(candidate)
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── Tracks ────────────────────────────────────────────────────────────────

    @LynxMethod
    fun peerConnectionAddTrack(pcId: Double, trackId: String, streamIdsJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val track = TrackRegistry.getTrack(trackId)
                    ?: throw IllegalArgumentException("Track $trackId not found")
                val streamIds = JSONArray(streamIdsJson).let { arr ->
                    (0 until arr.length()).map { arr.getString(it) }
                }
                val sender = pc.addTrack(track, streamIds)
                    ?: throw IllegalStateException("addTrack returned null")
                val senderJson = JSONObject().apply {
                    put("senderId", sender.id())
                    put("trackId", track.id())
                    put("kind", if (track is AudioTrack) "audio" else "video")
                    put("streamIds", JSONArray(streamIds))
                }
                callback.invoke(null, senderJson.toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionRemoveTrack(pcId: Double, senderId: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sender = pc.senders.firstOrNull { it.id() == senderId }
                    ?: throw IllegalArgumentException("Sender $senderId not found")
                pc.removeTrack(sender)
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionGetSenders(pcId: Double, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val arr = JSONArray()
                pc.senders.forEach { s ->
                    arr.put(JSONObject().apply {
                        put("senderId", s.id())
                        put("trackId", s.track()?.id())
                        put("kind", if (s.track() is AudioTrack) "audio" else "video")
                        put("streamIds", JSONArray())
                    })
                }
                callback.invoke(null, arr.toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionGetReceivers(pcId: Double, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val arr = JSONArray()
                pc.receivers.forEach { r ->
                    arr.put(JSONObject().apply {
                        put("receiverId", r.id())
                        put("trackId", r.track()?.id())
                        put("kind", if (r.track() is AudioTrack) "audio" else "video")
                        put("streamIds", JSONArray())
                    })
                }
                callback.invoke(null, arr.toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun peerConnectionGetTransceivers(pcId: Double, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val arr = JSONArray()
                pc.transceivers.forEach { t ->
                    arr.put(JSONObject().apply {
                        put("transceiverId", t.mid ?: UUID.randomUUID().toString())
                        put("direction", directionToString(t.direction))
                        put("currentDirection", t.currentDirection?.let { directionToString(it) })
                        put("stopped", t.isStopped)
                        put("mid", t.mid)
                        put("sender", JSONObject().apply {
                            put("senderId", t.sender.id())
                            put("trackId", t.sender.track()?.id())
                            put("kind", if (t.sender.track() is AudioTrack) "audio" else "video")
                            put("streamIds", JSONArray())
                        })
                        put("receiver", JSONObject().apply {
                            put("receiverId", t.receiver.id())
                            put("trackId", t.receiver.track()?.id())
                            put("kind", if (t.receiver.track() is AudioTrack) "audio" else "video")
                            put("streamIds", JSONArray())
                        })
                    })
                }
                callback.invoke(null, arr.toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @LynxMethod
    fun peerConnectionGetStats(pcId: Double, trackId: String?, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val report = pc.getStatsSuspend()
                val arr = JSONArray()
                report.statsMap.values.forEach { stat ->
                    val obj = JSONObject().apply {
                        put("id", stat.id)
                        put("type", stat.type)
                        put("timestamp", stat.timestampUs)
                        stat.members.forEach { entry ->
                            put(entry.key, entry.value)
                        }
                    }
                    arr.put(obj)
                }
                callback.invoke(null, arr.toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── DataChannel ───────────────────────────────────────────────────────────

    @LynxMethod
    fun createDataChannel(pcId: Double, label: String, configJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val config = DataChannel.Init().applyJSON(configJson)
                val dc = pc.createDataChannel(label, config)
                    ?: throw IllegalStateException("createDataChannel returned null")
                dc.registerObserver(LynxDataChannelObserver(pcId.toInt(), dc.id()) { event ->
                    lynxCtx.sendGlobalEvent("LK_PC_EVENT", JavaOnlyArray().apply { pushString(event) })
                })
                callback.invoke(null, dc.id().toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun dataChannelSend(pcId: Double, channelId: Double, data: String, isBinary: Boolean, callback: Callback) {
        try {
            val bytes = if (isBinary) android.util.Base64.decode(data, android.util.Base64.NO_WRAP)
                        else data.toByteArray(Charsets.UTF_8)
            val buf = DataChannel.Buffer(java.nio.ByteBuffer.wrap(bytes), isBinary)
            // In a full impl, keep a [channelId -> DataChannel] map
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun dataChannelClose(pcId: Double, channelId: Double, callback: Callback) {
        callback.invoke(null, null)
    }

    // ── MediaStream ───────────────────────────────────────────────────────────

    @LynxMethod
    fun mediaStreamCreate(streamId: String, callback: Callback) {
        val stream = PCManager.factory.createLocalMediaStream(streamId)
        TrackRegistry.registerStream(streamId, stream)
        callback.invoke(null, null)
    }

    @LynxMethod
    fun mediaStreamRelease(streamId: String, callback: Callback) {
        TrackRegistry.removeStream(streamId)
        callback.invoke(null, null)
    }

    @LynxMethod
    fun mediaStreamAddTrack(streamId: String, trackId: String, callback: Callback) {
        val stream = TrackRegistry.getStream(streamId)
        val track  = TrackRegistry.getTrack(trackId)
        if (stream != null && track != null) {
            when (track) {
                is AudioTrack -> stream.addTrack(track)
                is VideoTrack -> stream.addTrack(track)
            }
        }
        callback.invoke(null, null)
    }

    @LynxMethod
    fun mediaStreamRemoveTrack(streamId: String, trackId: String, callback: Callback) {
        val stream = TrackRegistry.getStream(streamId)
        val track  = TrackRegistry.getTrack(trackId)
        if (stream != null && track != null) {
            when (track) {
                is AudioTrack -> stream.removeTrack(track)
                is VideoTrack -> stream.removeTrack(track)
            }
        }
        callback.invoke(null, null)
    }

    @LynxMethod
    fun mediaStreamToURL(streamId: String, callback: Callback) {
        callback.invoke(null, "livekit-stream://$streamId")
    }

    // ── MediaStreamTrack ──────────────────────────────────────────────────────

    @LynxMethod
    fun mediaStreamTrackSetEnabled(trackId: String, enabled: Boolean, callback: Callback) {
        TrackRegistry.getTrack(trackId)?.setEnabled(enabled)
        callback.invoke(null, null)
    }

    @LynxMethod
    fun mediaStreamTrackStop(trackId: String, callback: Callback) {
        TrackRegistry.getTrack(trackId)?.setEnabled(false)
        callback.invoke(null, null)
    }

    @LynxMethod
    fun mediaStreamTrackRelease(trackId: String, callback: Callback) {
        TrackRegistry.getTrack(trackId)?.dispose()
        TrackRegistry.removeTrack(trackId)
        callback.invoke(null, null)
    }

    // ── getUserMedia ──────────────────────────────────────────────────────────

    @LynxMethod
    fun getUserMedia(constraintsJson: String, callback: Callback) {
        scope.launch {
            try {
                val result = LynxMediaStreamModule(lynxCtx.context).getUserMedia(constraintsJson)
                callback.invoke(null, result)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun enumerateDevices(callback: Callback) {
        val devices = JSONArray()
        try {
            val camMgr = lynxCtx.context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            camMgr.cameraIdList.forEach { id ->
                val chars = camMgr.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                val label = if (facing == CameraCharacteristics.LENS_FACING_FRONT) "Front Camera" else "Back Camera"
                devices.put(JSONObject().apply {
                    put("deviceId", id)
                    put("groupId", "video")
                    put("kind", "videoinput")
                    put("label", label)
                })
            }
        } catch (_: Exception) {}

        devices.put(JSONObject().apply {
            put("deviceId", "default")
            put("groupId", "audio")
            put("kind", "audioinput")
            put("label", "Microphone")
        })
        devices.put(JSONObject().apply {
            put("deviceId", "default")
            put("groupId", "audioOutput")
            put("kind", "audiooutput")
            put("label", "Speaker")
        })
        callback.invoke(null, devices.toString())
    }

    // ── Sender parameters ─────────────────────────────────────────────────────

    @LynxMethod
    fun senderGetParameters(pcId: Double, senderId: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sender = pc.senders.firstOrNull { it.id() == senderId }
                    ?: throw IllegalArgumentException("Sender $senderId not found")
                val params = sender.parameters
                val obj = JSONObject().apply {
                    val encodings = JSONArray()
                    params.encodings.forEach { enc ->
                        encodings.put(JSONObject().apply {
                            put("rid", enc.rid)
                            put("active", enc.active)
                            enc.maxBitrateBps?.let { put("maxBitrate", it) }
                            enc.maxFramerate?.let { put("maxFramerate", it) }
                            enc.scaleResolutionDownBy?.let { put("scaleResolutionDownBy", it) }
                        })
                    }
                    put("encodings", encodings)
                }
                callback.invoke(null, obj.toString())
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun senderSetParameters(pcId: Double, senderId: String, parametersJson: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sender = pc.senders.firstOrNull { it.id() == senderId }
                    ?: throw IllegalArgumentException("Sender $senderId not found")
                val params = sender.parameters
                val dict = JSONObject(parametersJson)
                val encodings = dict.optJSONArray("encodings")
                if (encodings != null) {
                    for (i in 0 until minOf(encodings.length(), params.encodings.size)) {
                        val enc = params.encodings[i]
                        val e = encodings.getJSONObject(i)
                        if (e.has("active")) enc.active = e.getBoolean("active")
                        if (e.has("maxBitrate")) enc.maxBitrateBps = e.getInt("maxBitrate")
                        if (e.has("maxFramerate")) enc.maxFramerate = e.getInt("maxFramerate")
                        if (e.has("scaleResolutionDownBy")) enc.scaleResolutionDownBy = e.getDouble("scaleResolutionDownBy")
                    }
                }
                sender.parameters = params
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun senderReplaceTrack(pcId: Double, senderId: String, trackId: String?, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sender = pc.senders.firstOrNull { it.id() == senderId }
                    ?: throw IllegalArgumentException("Sender $senderId not found")
                val track = trackId?.let { TrackRegistry.getTrack(it) }
                sender.setTrack(track, false)
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── Transceiver ───────────────────────────────────────────────────────────

    @LynxMethod
    fun transceiverSetDirection(pcId: Double, transceiverId: String, direction: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                pc.transceivers
                    .firstOrNull { it.mid == transceiverId }
                    ?.direction = directionFromString(direction)
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    @LynxMethod
    fun transceiverStop(pcId: Double, transceiverId: String, callback: Callback) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                pc.transceivers.firstOrNull { it.mid == transceiverId }?.stop()
                callback.invoke(null, null)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxDataChannelObserver
// ─────────────────────────────────────────────────────────────────────────────

class LynxDataChannelObserver(
    private val pcId: Int,
    private val channelId: Int,
    private val emit: (String) -> Unit,
) : DataChannel.Observer {

    override fun onBufferedAmountChange(delta: Long) {
        emit(event("dataChannelBufferedAmountChanged", mapOf("amount" to delta)))
    }

    override fun onStateChange() {}  // Handled via direct DC state in full impl

    override fun onMessage(buffer: DataChannel.Buffer) {
        val bytes = ByteArray(buffer.data.remaining())
        buffer.data.get(bytes)
        val data = if (buffer.binary) android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                   else String(bytes, Charsets.UTF_8)
        emit(event("dataChannelDidReceiveMessage", mapOf("data" to data, "isBinary" to buffer.binary)))
    }

    private fun event(type: String, extra: Map<String, Any> = emptyMap()): String {
        val obj = JSONObject().apply {
            put("type", type)
            put("pcId", pcId)
            put("channelId", channelId)
            extra.forEach { (k, v) -> put(k, v) }
        }
        return obj.toString()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone helper functions (WebRTC classes don't have Companion objects)
// ─────────────────────────────────────────────────────────────────────────────

private fun sdpToJSON(sdp: SessionDescription): String =
    JSONObject().apply {
        put("type", sdp.type.canonicalForm())
        put("sdp", sdp.description)
    }.toString()

private fun sdpFromJSON(json: String): SessionDescription {
    val obj = JSONObject(json)
    val type = when (obj.getString("type")) {
        "offer"    -> SessionDescription.Type.OFFER
        "pranswer" -> SessionDescription.Type.PRANSWER
        "answer"   -> SessionDescription.Type.ANSWER
        else       -> SessionDescription.Type.ROLLBACK
    }
    return SessionDescription(type, obj.getString("sdp"))
}

private fun iceCandidateFromJSON(json: String): IceCandidate {
    val obj = JSONObject(json)
    return IceCandidate(
        obj.optString("sdpMid"),
        obj.optInt("sdpMLineIndex"),
        obj.getString("candidate")
    )
}

private fun DataChannel.Init.applyJSON(json: String): DataChannel.Init {
    val obj = JSONObject(json)
    if (obj.has("ordered")) ordered = obj.getBoolean("ordered")
    if (obj.has("maxRetransmits")) maxRetransmits = obj.getInt("maxRetransmits")
    if (obj.has("maxPacketLifeTime")) maxRetransmitTimeMs = obj.getInt("maxPacketLifeTime")
    if (obj.has("protocol")) protocol = obj.getString("protocol")
    if (obj.has("negotiated")) negotiated = obj.getBoolean("negotiated")
    if (obj.has("id")) id = obj.getInt("id")
    return this
}

private fun directionToString(dir: RtpTransceiver.RtpTransceiverDirection): String = when (dir) {
    RtpTransceiver.RtpTransceiverDirection.SEND_RECV -> "sendrecv"
    RtpTransceiver.RtpTransceiverDirection.SEND_ONLY -> "sendonly"
    RtpTransceiver.RtpTransceiverDirection.RECV_ONLY -> "recvonly"
    RtpTransceiver.RtpTransceiverDirection.INACTIVE  -> "inactive"
    RtpTransceiver.RtpTransceiverDirection.STOPPED   -> "stopped"
}

private fun directionFromString(s: String): RtpTransceiver.RtpTransceiverDirection = when (s) {
    "sendrecv" -> RtpTransceiver.RtpTransceiverDirection.SEND_RECV
    "sendonly" -> RtpTransceiver.RtpTransceiverDirection.SEND_ONLY
    "recvonly" -> RtpTransceiver.RtpTransceiverDirection.RECV_ONLY
    "inactive" -> RtpTransceiver.RtpTransceiverDirection.INACTIVE
    else       -> RtpTransceiver.RtpTransceiverDirection.SEND_RECV
}


