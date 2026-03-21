// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — android/.../AudioDeviceKind.kt
// Port of AudioDeviceKind.java from @livekit/react-native.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import com.twilio.audioswitch.AudioDevice

enum class AudioDeviceKind(
    val typeName: String,
    val audioDeviceClass: Class<out AudioDevice>,
) {
    SPEAKER("speaker",    AudioDevice.Speakerphone::class.java),
    EARPIECE("earpiece",  AudioDevice.Earpiece::class.java),
    HEADSET("headset",    AudioDevice.WiredHeadset::class.java),
    BLUETOOTH("bluetooth", AudioDevice.BluetoothHeadset::class.java);

    companion object {
        fun fromTypeName(name: String?): AudioDeviceKind? =
            values().firstOrNull { it.typeName == name }

        fun fromAudioDevice(device: AudioDevice): AudioDeviceKind? = when (device) {
            is AudioDevice.Speakerphone    -> SPEAKER
            is AudioDevice.Earpiece        -> EARPIECE
            is AudioDevice.WiredHeadset    -> HEADSET
            is AudioDevice.BluetoothHeadset -> BLUETOOTH
            else                           -> null
        }
    }
}
