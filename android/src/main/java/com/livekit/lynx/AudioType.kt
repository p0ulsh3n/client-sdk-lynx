// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — android/.../AudioType.kt
// Port of AudioType.kt from @livekit/react-native. Zero changes.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.media.AudioAttributes
import android.media.AudioManager

sealed class AudioType(
    val audioMode: Int,
    val audioAttributes: AudioAttributes,
    val audioStreamType: Int,
) {
    /**
     * Audio type for media playback (listener-only).
     * System handles routing automatically; bluetooth mic may not work.
     */
    class MediaAudioType : AudioType(
        AudioManager.MODE_NORMAL,
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build(),
        AudioManager.STREAM_MUSIC,
    )

    /**
     * Audio type for bidirectional communication (publishing mic).
     * Audio routing can be manually controlled.
     */
    class CommunicationAudioType : AudioType(
        AudioManager.MODE_IN_COMMUNICATION,
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build(),
        AudioManager.STREAM_VOICE_CALL,
    )

    /**
     * Custom audio type — supply your own AudioAttributes and stream type.
     */
    class CustomAudioType(
        audioMode: Int,
        audioAttributes: AudioAttributes,
        audioStreamType: Int,
    ) : AudioType(audioMode, audioAttributes, audioStreamType)
}
