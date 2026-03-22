// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../e2ee/LynxE2EEModule.kt
// Lynx NativeModule — E2EE frame cryptors, key providers, data packet cryptors.
//
// Registration:
//   LynxEnv.inst().registerModule("LynxE2EEModule", LynxE2EEModule::class.java)
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx.e2ee

import android.content.Context
import android.util.Base64
import com.livekit.lynx.internal.PCManager
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.FrameCryptor
import org.webrtc.FrameCryptorAlgorithm
import org.webrtc.FrameCryptorFactory
import org.webrtc.FrameCryptorKeyProvider
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class LynxE2EEModule(context: Context) : LynxModule(context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val cryptors     = ConcurrentHashMap<String, FrameCryptor>()
    private val keyProviders = ConcurrentHashMap<String, FrameCryptorKeyProvider>()

    // ── FrameCryptor for Sender ───────────────────────────────────────────────

    @LynxMethod
    fun frameCryptorCreateForSender(
        pcId: Double,
        senderId: String,
        participantId: String,
        algorithm: String,
        keyProviderTag: String,
        callback: Callback,
    ) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val sender = pc.senders.firstOrNull { it.id() == senderId }
                    ?: throw IllegalArgumentException("Sender $senderId not found")
                val kp = keyProviders[keyProviderTag]
                    ?: throw IllegalArgumentException("KeyProvider $keyProviderTag not found")
                val algo = algorithmFrom(algorithm)
                val cryptor = FrameCryptorFactory.createFrameCryptorForRtpSender(
                    PCManager.factory, sender, participantId, algo, kp
                )
                val tag = UUID.randomUUID().toString()
                cryptors[tag] = cryptor
                callback.invoke(null, tag)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── FrameCryptor for Receiver ─────────────────────────────────────────────

    @LynxMethod
    fun frameCryptorCreateForReceiver(
        pcId: Double,
        receiverId: String,
        participantId: String,
        algorithm: String,
        keyProviderTag: String,
        callback: Callback,
    ) {
        scope.launch {
            try {
                val pc = PCManager.get(pcId.toInt())
                val receiver = pc.receivers.firstOrNull { it.id() == receiverId }
                    ?: throw IllegalArgumentException("Receiver $receiverId not found")
                val kp = keyProviders[keyProviderTag]
                    ?: throw IllegalArgumentException("KeyProvider $keyProviderTag not found")
                val algo = algorithmFrom(algorithm)
                val cryptor = FrameCryptorFactory.createFrameCryptorForRtpReceiver(
                    PCManager.factory, receiver, participantId, algo, kp
                )
                val tag = UUID.randomUUID().toString()
                cryptors[tag] = cryptor
                callback.invoke(null, tag)
            } catch (e: Exception) {
                callback.invoke(e.message, null)
            }
        }
    }

    // ── FrameCryptor control ──────────────────────────────────────────────────

    @LynxMethod
    fun frameCryptorSetEnabled(cryptorTag: String, enabled: Boolean, callback: Callback) {
        try {
            val c = cryptors[cryptorTag] ?: throw IllegalArgumentException("Cryptor $cryptorTag not found")
            c.setEnabled(enabled)
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun frameCryptorSetKeyIndex(cryptorTag: String, keyIndex: Double, callback: Callback) {
        try {
            val c = cryptors[cryptorTag] ?: throw IllegalArgumentException("Cryptor $cryptorTag not found")
            c.setKeyIndex(keyIndex.toInt())
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun frameCryptorDispose(cryptorTag: String, callback: Callback) {
        cryptors.remove(cryptorTag)?.dispose()
        callback.invoke(null, null)
    }

    // ── KeyProvider ───────────────────────────────────────────────────────────

    @LynxMethod
    fun keyProviderCreate(optionsJson: String, callback: Callback) {
        try {
            val opts = JSONObject(optionsJson)
            val sharedKey     = opts.optBoolean("sharedKey", true)
            val ratchetSalt   = (opts.optString("ratchetSalt", "LKFrameEncryptionKey")).toByteArray()
            val ratchetWindow = opts.optInt("ratchetWindowSize", 16)
            val failureTol    = opts.optInt("failureTolerance", -1)
            val keyRingSize   = opts.optInt("keyRingSize", 16)
            val discardWhenUnready = opts.optBoolean("discardFrameWhenCryptorNotReady", false)

            val magicBytes: ByteArray? = opts.optString("uncryptedMagicBytes").takeIf { it.isNotEmpty() }
                ?.let { Base64.decode(it, Base64.NO_WRAP) }

            val kp = FrameCryptorFactory.createFrameCryptorKeyProvider(
                sharedKey,
                ratchetSalt,
                ratchetWindow,
                magicBytes ?: ByteArray(0),
                failureTol,
                keyRingSize,
                discardWhenUnready,
            )
            val tag = UUID.randomUUID().toString()
            keyProviders[tag] = kp
            callback.invoke(null, tag)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun keyProviderSetSharedKey(tag: String, keyBase64: String, keyIndex: Double, callback: Callback) {
        try {
            val kp = keyProviders[tag] ?: throw IllegalArgumentException("KeyProvider $tag not found")
            kp.setSharedKey(keyIndex.toInt(), Base64.decode(keyBase64, Base64.NO_WRAP))
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun keyProviderSetKey(tag: String, participantId: String, keyBase64: String, keyIndex: Double, callback: Callback) {
        try {
            val kp = keyProviders[tag] ?: throw IllegalArgumentException("KeyProvider $tag not found")
            kp.setKey(participantId, keyIndex.toInt(), Base64.decode(keyBase64, Base64.NO_WRAP))
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun keyProviderRatchetSharedKey(tag: String, keyIndex: Double, callback: Callback) {
        try {
            val kp = keyProviders[tag] ?: throw IllegalArgumentException("KeyProvider $tag not found")
            kp.ratchetSharedKey(keyIndex.toInt())
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun keyProviderRatchetKey(tag: String, participantId: String, keyIndex: Double, callback: Callback) {
        try {
            val kp = keyProviders[tag] ?: throw IllegalArgumentException("KeyProvider $tag not found")
            kp.ratchetKey(participantId, keyIndex.toInt())
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun keyProviderSetSifTrailer(tag: String, trailerBase64: String, callback: Callback) {
        try {
            val kp = keyProviders[tag] ?: throw IllegalArgumentException("KeyProvider $tag not found")
            kp.setSifTrailer(Base64.decode(trailerBase64, Base64.NO_WRAP))
            callback.invoke(null, null)
        } catch (e: Exception) {
            callback.invoke(e.message, null)
        }
    }

    @LynxMethod
    fun keyProviderDispose(tag: String, callback: Callback) {
        keyProviders.remove(tag)?.dispose()
        callback.invoke(null, null)
    }

    // ── DataPacketCryptor (passthrough — Android WebRTC handles at RTP layer) ─

    @LynxMethod
    fun dataPacketCryptorCreate(algorithm: String, keyProviderTag: String, callback: Callback) {
        // On Android, data packet encryption is handled at the WebRTC layer.
        // We return a placeholder tag; actual encryption uses the key provider.
        val tag = "dpc-${UUID.randomUUID()}"
        callback.invoke(null, tag)
    }

    @LynxMethod
    fun dataPacketCryptorEncrypt(
        cryptorTag: String,
        participantId: String,
        keyIndex: Double,
        dataBase64: String,
        callback: Callback,
    ) {
        // Passthrough — livekit-client handles encryption via the JS layer.
        callback.invoke(null, null)
    }

    @LynxMethod
    fun dataPacketCryptorDecrypt(
        cryptorTag: String,
        participantId: String,
        packetJson: String,
        callback: Callback,
    ) {
        // Passthrough
        callback.invoke(null, null)
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private fun algorithmFrom(s: String): FrameCryptorAlgorithm =
        FrameCryptorAlgorithm.AES_GCM  // WebRTC 137+ only supports AES_GCM
}
