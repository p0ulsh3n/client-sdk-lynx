// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — android/.../LivekitLynxModule.kt
// Lynx NativeModule — AudioSession management.
// Full port of LivekitReactNativeModule.kt from the React Native SDK.
//
// Registration (LynxModuleAdapter):
//   LynxEnv.inst().registerModule("LivekitLynxModule", LivekitLynxModule::class.java)
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.util.Log
import com.livekit.lynx.audio.LynxAudioSinkManager
import com.livekit.lynx.audio.LynxAudioRecordDispatcher
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.tasm.behavior.LynxContext
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.audio.WebRtcAudioUtils

private const val TAG = "LivekitLynxModule"

class LivekitLynxModule(context: Context) : LynxModule(context) {

    private val lynxCtx get() = mContext as LynxContext
    private val audioManager = LynxAudioSwitchManager(lynxCtx.context.applicationContext)

    // ── configureAudio  (port of LivekitReactNativeModule.configureAudio) ───

    @LynxMethod
    fun configureAudio(configJson: String, callback: Callback) {
        val config = JSONObject(configJson)
        val androidCfg = config.optJSONObject("android") ?: run {
            callback.invoke(null, null); return
        }

        if (androidCfg.has("preferredOutputList")) {
            val arr = androidCfg.getJSONArray("preferredOutputList")
            audioManager.preferredDeviceList = (0 until arr.length())
                .mapNotNull { AudioDeviceKind.fromTypeName(arr.getString(it))?.audioDeviceClass }
        }

        if (androidCfg.has("audioTypeOptions")) {
            val opts = androidCfg.getJSONObject("audioTypeOptions")

            if (opts.has("manageAudioFocus")) {
                audioManager.setManageAudioFocus(opts.getBoolean("manageAudioFocus"))
            }
            opts.optString("audioMode").takeIf { it.isNotEmpty() }?.let { s ->
                AudioManagerUtils.audioModeFromString(s)?.let { audioManager.setAudioMode(it) }
            }
            opts.optString("audioFocusMode").takeIf { it.isNotEmpty() }?.let { s ->
                AudioManagerUtils.focusModeFromString(s)?.let { audioManager.setFocusMode(it) }
            }
            opts.optString("audioStreamType").takeIf { it.isNotEmpty() }?.let { s ->
                AudioManagerUtils.audioStreamTypeFromString(s)?.let { audioManager.setAudioStreamType(it) }
            }
            opts.optString("audioAttributesUsageType").takeIf { it.isNotEmpty() }?.let { s ->
                AudioManagerUtils.audioAttributesUsageTypeFromString(s)?.let {
                    audioManager.setAudioAttributesUsageType(it)
                }
            }
            opts.optString("audioAttributesContentType").takeIf { it.isNotEmpty() }?.let { s ->
                AudioManagerUtils.audioAttributesContentTypeFromString(s)?.let {
                    audioManager.setAudioAttributesContentType(it)
                }
            }
            if (opts.has("forceHandleAudioRouting")) {
                audioManager.setForceHandleAudioRouting(opts.getBoolean("forceHandleAudioRouting"))
            }
        }
        callback.invoke(null, null)
    }

    // ── startAudioSession ────────────────────────────────────────────────────

    @LynxMethod
    fun startAudioSession(callback: Callback) {
        audioManager.start()
        callback.invoke(null, null)
    }

    // ── stopAudioSession ─────────────────────────────────────────────────────

    @LynxMethod
    fun stopAudioSession(callback: Callback) {
        audioManager.stop()
        callback.invoke(null, null)
    }

    // ── getAudioOutputs ──────────────────────────────────────────────────────

    @LynxMethod
    fun getAudioOutputs(callback: Callback) {
        val deviceIds = audioManager.availableAudioDevices()
            .mapNotNull { AudioDeviceKind.fromAudioDevice(it)?.typeName }
        callback.invoke(null, JSONArray(deviceIds).toString())
    }

    // ── selectAudioOutput ────────────────────────────────────────────────────

    @LynxMethod
    fun selectAudioOutput(deviceId: String, callback: Callback) {
        audioManager.selectAudioOutput(AudioDeviceKind.fromTypeName(deviceId))
        callback.invoke(null, null)
    }

    // ── showAudioRoutePicker (no-op on Android) ──────────────────────────────

    @LynxMethod
    fun showAudioRoutePicker(callback: Callback) {
        callback.invoke(null, null)
    }

    // ── setAppleAudioConfiguration (no-op on Android) ────────────────────────

    @LynxMethod
    fun setAppleAudioConfiguration(configJson: String, callback: Callback) {
        callback.invoke(null, null)
    }

    // ── setDefaultAudioTrackVolume ───────────────────────────────────────────

    @LynxMethod
    fun setDefaultAudioTrackVolume(volume: Double, callback: Callback) {
        LynxWebRTCModuleOptions.defaultTrackVolume = volume
        callback.invoke(null, null)
    }

    override fun invalidate() {
        LiveKitLynx.invalidate(lynxCtx.context)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioManagerUtils — port of AudioManagerUtils.kt from RN SDK (zero changes)
// ─────────────────────────────────────────────────────────────────────────────

object AudioManagerUtils {

    fun audioModeFromString(s: String?): Int? = when (s) {
        "normal"          -> AudioManager.MODE_NORMAL
        "callScreening"   -> AudioManager.MODE_CALL_SCREENING
        "inCall"          -> AudioManager.MODE_IN_CALL
        "inCommunication" -> AudioManager.MODE_IN_COMMUNICATION
        "ringtone"        -> AudioManager.MODE_RINGTONE
        else              -> { Log.w(TAG, "Unknown audioMode: $s"); null }
    }

    fun focusModeFromString(s: String?): Int? = when (s) {
        "gain"                    -> AudioManager.AUDIOFOCUS_GAIN
        "gainTransient"           -> AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
        "gainTransientExclusive"  -> AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
        "gainTransientMayDuck"    -> AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
        else                      -> { Log.w(TAG, "Unknown audioFocusMode: $s"); null }
    }

    fun audioAttributesUsageTypeFromString(s: String?): Int? = when (s) {
        "alarm"                         -> AudioAttributes.USAGE_ALARM
        "assistanceAccessibility"       -> AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY
        "assistanceNavigationGuidance"  -> AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE
        "assistanceSonification"        -> AudioAttributes.USAGE_ASSISTANCE_SONIFICATION
        "assistant"                     -> AudioAttributes.USAGE_ASSISTANT
        "game"                          -> AudioAttributes.USAGE_GAME
        "media"                         -> AudioAttributes.USAGE_MEDIA
        "notification"                  -> AudioAttributes.USAGE_NOTIFICATION
        "notificationEvent"             -> AudioAttributes.USAGE_NOTIFICATION_EVENT
        "notificationRingtone"          -> AudioAttributes.USAGE_NOTIFICATION_RINGTONE
        "unknown"                       -> AudioAttributes.USAGE_UNKNOWN
        "voiceCommunication"            -> AudioAttributes.USAGE_VOICE_COMMUNICATION
        "voiceCommunicationSignalling"  -> AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING
        else                            -> { Log.w(TAG, "Unknown usageType: $s"); null }
    }

    fun audioAttributesContentTypeFromString(s: String?): Int? = when (s) {
        "movie"       -> AudioAttributes.CONTENT_TYPE_MOVIE
        "music"       -> AudioAttributes.CONTENT_TYPE_MUSIC
        "sonification"-> AudioAttributes.CONTENT_TYPE_SONIFICATION
        "speech"      -> AudioAttributes.CONTENT_TYPE_SPEECH
        "unknown"     -> AudioAttributes.CONTENT_TYPE_UNKNOWN
        else          -> { Log.w(TAG, "Unknown contentType: $s"); null }
    }

    fun audioStreamTypeFromString(s: String?): Int? = when (s) {
        "accessibility" -> AudioManager.STREAM_ACCESSIBILITY
        "alarm"         -> AudioManager.STREAM_ALARM
        "dtmf"          -> AudioManager.STREAM_DTMF
        "music"         -> AudioManager.STREAM_MUSIC
        "notification"  -> AudioManager.STREAM_NOTIFICATION
        "ring"          -> AudioManager.STREAM_RING
        "system"        -> AudioManager.STREAM_SYSTEM
        "voiceCall"     -> AudioManager.STREAM_VOICE_CALL
        else            -> { Log.w(TAG, "Unknown streamType: $s"); null }
    }
}
