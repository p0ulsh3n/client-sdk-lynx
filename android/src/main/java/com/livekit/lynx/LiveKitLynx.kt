// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — android/.../LiveKitLynx.kt
// App-level setup. Port of LiveKitReactNative.kt from the React Native SDK.
//
// Call in your Application.onCreate() BEFORE the Lynx engine initialises:
//   LiveKitLynx.setup(this, AudioType.CommunicationAudioType())
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import com.livekit.lynx.audio.LynxAudioRecordDispatcher
import com.livekit.lynx.audio.LynxWebRTCDefaults
import com.livekit.lynx.internal.PCManager
import com.livekit.lynx.video.LynxCustomVideoDecoderFactory
import com.livekit.lynx.video.LynxCustomVideoEncoderFactory
import org.webrtc.audio.JavaAudioDeviceModule

/**
 * Initialises LiveKit for use within a Lynx application.
 *
 * Must be called from your [Application.onCreate] **before** any Lynx or
 * WebRTC initialisation.
 *
 * ```kotlin
 * class MyApp : Application() {
 *   override fun onCreate() {
 *     super.onCreate()
 *     LiveKitLynx.setup(this) // default: CommunicationAudioType
 *   }
 * }
 * ```
 */
object LiveKitLynx {

    @SuppressLint("StaticFieldLeak")
    private var _adm: JavaAudioDeviceModule? = null

    val audioDeviceModule: JavaAudioDeviceModule
        get() = _adm ?: error(
            "LiveKitLynx not initialised — call LiveKitLynx.setup() in Application.onCreate()"
        )

    @JvmStatic
    @JvmOverloads
    fun setup(
        context: Context,
        audioType: AudioType = AudioType.CommunicationAudioType(),
    ) {
        _setupAdm(context, audioType)

        // Configure the PCManager factory (from @livekit/lynx-webrtc)
        // This mirrors the WebRTCModuleOptions configuration in the RN SDK.
        LynxWebRTCModuleOptions.apply {
            videoEncoderFactory = LynxCustomVideoEncoderFactory(null, true, true)
            videoDecoderFactory = LynxCustomVideoDecoderFactory()
            audioDeviceModule   = this@LiveKitLynx._adm!!
            enableMediaProjection = true
        }
    }

    private fun _setupAdm(context: Context, audioType: AudioType) {
        val useHardware = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        _adm = JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(useHardware)
            .setUseHardwareNoiseSuppressor(useHardware)
            .setAudioAttributes(audioType.audioAttributes)
            .setSamplesReadyCallback(LynxAudioRecordDispatcher)
            .createAudioDeviceModule()
    }

    /** @internal Call when the module is re-initialised (e.g. on hot reload). */
    internal fun invalidate(context: Context) {
        _adm?.release()
        _adm = null
        _setupAdm(context, AudioType.CommunicationAudioType())
        LynxWebRTCModuleOptions.audioDeviceModule = _adm
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LynxWebRTCModuleOptions
// Mirrors WebRTCModuleOptions from @oney/WebRTCModule.
// ─────────────────────────────────────────────────────────────────────────────

object LynxWebRTCModuleOptions {
    var videoEncoderFactory: org.webrtc.VideoEncoderFactory? = null
    var videoDecoderFactory: org.webrtc.VideoDecoderFactory? = null
    var audioDeviceModule: JavaAudioDeviceModule? = null
    var enableMediaProjection: Boolean = false
    var defaultTrackVolume: Double = LynxWebRTCDefaults.defaultRemoteAudioVolume
}
