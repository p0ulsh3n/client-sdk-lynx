// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../internal/PCManager.kt
// Thread-safe registry of PeerConnection instances + factory setup.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.internal

import com.livekit.lynx.video.LynxCustomVideoDecoderFactory
import com.livekit.lynx.video.LynxCustomVideoEncoderFactory
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object PCManager {

    private val pcs = ConcurrentHashMap<Int, PeerConnection>()

    val factory: PeerConnectionFactory by lazy {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(null)
                .setInjectableLogger(null, Logging.Severity.LS_NONE)
                .createInitializationOptions()
        )
        PeerConnectionFactory.builder()
            .setVideoEncoderFactory(LynxCustomVideoEncoderFactory(null, true, true))
            .setVideoDecoderFactory(LynxCustomVideoDecoderFactory())
            .createPeerConnectionFactory()
    }

    fun create(pcId: Int, config: PeerConnection.RTCConfiguration, observer: PeerConnection.Observer): PeerConnection {
        require(pcId !in pcs) { "PeerConnection pcId=$pcId already exists" }
        val pc = factory.createPeerConnection(config, observer)
            ?: error("createPeerConnection returned null for pcId=$pcId")
        pcs[pcId] = pc
        return pc
    }

    fun get(pcId: Int): PeerConnection =
        pcs[pcId] ?: error("PeerConnection pcId=$pcId not found")

    fun close(pcId: Int) {
        pcs.remove(pcId)?.close()
    }

    fun dispose(pcId: Int) {
        pcs.remove(pcId)
    }

    fun parseConfiguration(json: String): PeerConnection.RTCConfiguration {
        val obj = JSONObject(json)
        val config = PeerConnection.RTCConfiguration(emptyList())

        if (obj.has("iceServers")) {
            val arr = obj.getJSONArray("iceServers")
            config.iceServers = (0 until arr.length()).map { i ->
                val srv = arr.getJSONObject(i)
                val urls = when {
                    srv.has("urls") && srv.get("urls") is JSONArray ->
                        (0 until srv.getJSONArray("urls").length()).map { j ->
                            srv.getJSONArray("urls").getString(j)
                        }
                    srv.has("urls") -> listOf(srv.getString("urls"))
                    else -> emptyList()
                }
                PeerConnection.IceServer.builder(urls).apply {
                    if (srv.has("username")) setUsername(srv.getString("username"))
                    if (srv.has("credential")) setPassword(srv.getString("credential"))
                }.createIceServer()
            }
        }

        if (obj.has("iceTransportPolicy")) {
            config.iceTransportsType = if (obj.getString("iceTransportPolicy") == "relay")
                PeerConnection.IceTransportsType.RELAY else PeerConnection.IceTransportsType.ALL
        }
        if (obj.has("bundlePolicy")) {
            config.bundlePolicy = when (obj.getString("bundlePolicy")) {
                "max-compat"  -> PeerConnection.BundlePolicy.MAXCOMPAT
                "max-bundle"  -> PeerConnection.BundlePolicy.MAXBUNDLE
                else          -> PeerConnection.BundlePolicy.BALANCED
            }
        }
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        return config
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspend extensions for PeerConnection (Kotlin coroutines style)
// ─────────────────────────────────────────────────────────────────────────────

suspend fun PeerConnection.createOfferSuspend(constraints: MediaConstraints): SessionDescription =
    suspendCancellableCoroutine { cont ->
        createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) = cont.resume(sdp)
            override fun onCreateFailure(err: String)             = cont.resumeWithException(Exception(err))
            override fun onSetSuccess()                           = Unit
            override fun onSetFailure(err: String)                = Unit
        }, constraints)
    }

suspend fun PeerConnection.createAnswerSuspend(constraints: MediaConstraints): SessionDescription =
    suspendCancellableCoroutine { cont ->
        createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) = cont.resume(sdp)
            override fun onCreateFailure(err: String)             = cont.resumeWithException(Exception(err))
            override fun onSetSuccess()                           = Unit
            override fun onSetFailure(err: String)                = Unit
        }, constraints)
    }

suspend fun PeerConnection.setLocalDescriptionSuspend(sdp: SessionDescription): Unit =
    suspendCancellableCoroutine { cont ->
        setLocalDescription(object : SdpObserver {
            override fun onCreateSuccess(p: SessionDescription) = Unit
            override fun onCreateFailure(err: String)           = Unit
            override fun onSetSuccess()                         = cont.resume(Unit)
            override fun onSetFailure(err: String)              = cont.resumeWithException(Exception(err))
        }, sdp)
    }

suspend fun PeerConnection.setRemoteDescriptionSuspend(sdp: SessionDescription): Unit =
    suspendCancellableCoroutine { cont ->
        setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p: SessionDescription) = Unit
            override fun onCreateFailure(err: String)           = Unit
            override fun onSetSuccess()                         = cont.resume(Unit)
            override fun onSetFailure(err: String)              = cont.resumeWithException(Exception(err))
        }, sdp)
    }

suspend fun PeerConnection.addIceCandidateSuspend(candidate: IceCandidate): Unit =
    suspendCancellableCoroutine { cont ->
        addIceCandidate(candidate, object : AddIceObserver {
            override fun onAddSuccess()              = cont.resume(Unit)
            override fun onAddFailure(err: String)   = cont.resumeWithException(Exception(err))
        })
    }

suspend fun PeerConnection.getStatsSuspend(): RTCStatsReport =
    suspendCancellableCoroutine { cont ->
        getStats { report -> cont.resume(report) }
    }
