// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../LynxMediaStreamModule.kt
// Handles getUserMedia (camera + microphone) on Android.
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.livekit.lynx.internal.PCManager
import com.livekit.lynx.internal.TrackRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.util.UUID

class LynxMediaStreamModule(private val context: Context) {

    // ── getUserMedia ──────────────────────────────────────────────────────────

    suspend fun getUserMedia(constraintsJson: String): String {
        val constraints = JSONObject(constraintsJson)
        val factory     = PCManager.factory
        val streamId    = "local-${UUID.randomUUID()}"
        val trackResults = JSONArray()

        // ── Audio ─────────────────────────────────────────────────────────────
        if (constraints.has("audio")) {
            checkPermission(Manifest.permission.RECORD_AUDIO)

            val source = factory.createAudioSource(
                MediaConstraints().apply {
                    mandatory.add(MediaConstraints.KeyValuePair("echoCancellation", "true"))
                    mandatory.add(MediaConstraints.KeyValuePair("noiseSuppression", "true"))
                    mandatory.add(MediaConstraints.KeyValuePair("autoGainControl",  "true"))
                }
            )
            val track = factory.createAudioTrack(UUID.randomUUID().toString(), source)
            TrackRegistry.registerTrack(track.id(), track)

            trackResults.put(JSONObject().apply {
                put("id",    track.id())
                put("kind",  "audio")
                put("label", "microphone")
                put("settings", JSONObject())
            })
        }

        // ── Video ─────────────────────────────────────────────────────────────
        if (constraints.has("video")) {
            checkPermission(Manifest.permission.CAMERA)

            val videoConstraints = constraints.opt("video")
            val facing      = extractFacingMode(videoConstraints)
            val width       = extractInt(videoConstraints, "width",     1280)
            val height      = extractInt(videoConstraints, "height",    720)
            val frameRate   = extractInt(videoConstraints, "frameRate", 30)

            val source  = factory.createVideoSource(false)
            val capturer = createCapturer(facing)
            capturer.initialize(
                SurfaceTextureHelper.create("CaptureThread", getEglContext()),
                context,
                source.capturerObserver,
            )
            capturer.startCapture(width, height, frameRate)

            val track = factory.createVideoTrack(UUID.randomUUID().toString(), source)
            TrackRegistry.registerTrack(track.id(), track)

            trackResults.put(JSONObject().apply {
                put("id",    track.id())
                put("kind",  "video")
                put("label", "camera")
                put("settings", JSONObject().apply {
                    put("width",      width)
                    put("height",     height)
                    put("frameRate",  frameRate)
                    put("facingMode", if (facing == "environment") "environment" else "user")
                })
            })
        }

        return JSONObject().apply {
            put("streamId", streamId)
            put("tracks",   trackResults)
        }.toString()
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun createCapturer(facingMode: String): CameraVideoCapturer {
        val cameraEnumerator = Camera2Enumerator(context)
        val deviceNames = cameraEnumerator.deviceNames

        // Prefer requested facing direction, fall back to first available
        val targetFront = facingMode != "environment"

        val name = deviceNames.firstOrNull { n ->
            if (targetFront) cameraEnumerator.isFrontFacing(n)
            else cameraEnumerator.isBackFacing(n)
        } ?: deviceNames.firstOrNull()
            ?: error("No camera device found")

        return cameraEnumerator.createCapturer(name, null)
    }

    private fun extractFacingMode(constraint: Any?): String {
        if (constraint is JSONObject) {
            val fm = constraint.optString("facingMode")
            if (fm.isNotEmpty()) return fm
            val exact = constraint.optJSONObject("facingMode")?.optString("exact") ?: ""
            val ideal = constraint.optJSONObject("facingMode")?.optString("ideal") ?: ""
            return exact.ifEmpty { ideal.ifEmpty { "user" } }
        }
        return "user"
    }

    private fun extractInt(constraint: Any?, key: String, default: Int): Int {
        if (constraint is JSONObject) {
            if (constraint.has(key)) {
                val v = constraint.opt(key)
                return when (v) {
                    is Int    -> v
                    is Double -> v.toInt()
                    is JSONObject -> v.optInt("ideal", v.optInt("exact", default))
                    else -> default
                }
            }
        }
        return default
    }

    private fun getEglContext(): EglBase.Context {
        return EglBase.create().eglBaseContext
    }

    private fun checkPermission(permission: String) {
        if (ContextCompat.checkSelfPermission(context, permission) !=
            PackageManager.PERMISSION_GRANTED) {
            throw SecurityException(
                "Permission $permission not granted. " +
                "Request it before calling getUserMedia()."
            )
        }
    }
}
