// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — android/.../LynxAudioSwitchManager.kt
// Port of AudioSwitchManager.java from the React Native SDK.
// Handles Android audio device selection and focus management.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.twilio.audioswitch.AudioDevice
import com.twilio.audioswitch.AudioSwitch

private const val TAG = "LynxAudioSwitchManager"

class LynxAudioSwitchManager(private val context: Context) {

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val handler = Handler(Looper.getMainLooper())
    private var audioSwitch: AudioSwitch? = null

    // ── Configuration ─────────────────────────────────────────────────────────
    var preferredDeviceList: List<Class<out AudioDevice>> = listOf(
        AudioDevice.BluetoothHeadset::class.java,
        AudioDevice.WiredHeadset::class.java,
        AudioDevice.Speakerphone::class.java,
        AudioDevice.Earpiece::class.java,
    )

    private var manageAudioFocus    = true
    private var focusMode           = AudioManager.AUDIOFOCUS_GAIN
    private var audioMode           = AudioManager.MODE_IN_COMMUNICATION
    private var audioStreamType     = AudioManager.STREAM_VOICE_CALL
    private var audioAttributeUsage = AudioAttributes.USAGE_VOICE_COMMUNICATION
    private var audioContentType    = AudioAttributes.CONTENT_TYPE_SPEECH
    private var forceHandleRouting  = false

    private var audioFocusRequest: AudioFocusRequest? = null
    private var savedAudioMode = AudioManager.MODE_NORMAL

    fun setManageAudioFocus(v: Boolean)        { manageAudioFocus    = v }
    fun setAudioMode(v: Int)                   { audioMode           = v }
    fun setFocusMode(v: Int)                   { focusMode           = v }
    fun setAudioStreamType(v: Int)             { audioStreamType     = v }
    fun setAudioAttributesUsageType(v: Int)    { audioAttributeUsage = v }
    fun setAudioAttributesContentType(v: Int)  { audioContentType    = v }
    fun setForceHandleAudioRouting(v: Boolean) { forceHandleRouting  = v }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    fun start() {
        handler.post {
            savedAudioMode = audioManager.mode

            if (manageAudioFocus) {
                requestAudioFocus()
                audioManager.mode = audioMode
            }

            if (audioSwitch == null) {
                audioSwitch = AudioSwitch(
                    context,
                    loggingEnabled = false,
                    preferredDeviceList = preferredDeviceList,
                ).also { it.start { _, _ -> } }
            }
            audioSwitch?.activate()
        }
    }

    fun stop() {
        handler.post {
            audioSwitch?.deactivate()
            audioSwitch?.stop()
            audioSwitch = null

            if (manageAudioFocus) {
                abandonAudioFocus()
                audioManager.mode = savedAudioMode
            }
        }
    }

    fun availableAudioDevices(): List<AudioDevice> {
        return audioSwitch?.availableAudioDevices ?: emptyList()
    }

    fun selectAudioOutput(kind: AudioDeviceKind?) {
        if (kind == null) return
        handler.post {
            val device = audioSwitch?.availableAudioDevices
                ?.firstOrNull { kind.audioDeviceClass.isInstance(it) }
            if (device != null) {
                audioSwitch?.selectDevice(device)
            } else {
                Log.w(TAG, "Audio device not found: $kind")
            }
        }
    }

    // ── Audio Focus ───────────────────────────────────────────────────────────

    private fun requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(audioAttributeUsage)
                .setContentType(audioContentType)
                .build()
            val req = AudioFocusRequest.Builder(focusMode)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener { }
                .build()
            audioFocusRequest = req
            audioManager.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                { },
                audioStreamType,
                focusMode,
            )
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus { }
        }
    }
}
