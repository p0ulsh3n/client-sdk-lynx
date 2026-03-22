// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx-webrtc — android/.../LynxVideoComponent.kt
// Custom Native Component — renders a WebRTC video stream.
//
// Tag name: "livekit-webrtc-view"
//
// Registration (LynxUIFactory or equivalent):
//   registry.register("livekit-webrtc-view", LynxVideoComponent::class.java)
// ─────────────────────────────────────────────────────────────────────────────

package com.livekit.lynx

import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import com.livekit.lynx.internal.TrackRegistry
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.ui.LynxUI
import org.webrtc.EglBase
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

class LynxVideoComponent(context: LynxContext) : LynxUI<FrameLayout>(context) {

    private val eglBase: EglBase by lazy { EglBase.create() }

    private val renderer: SurfaceViewRenderer by lazy {
        SurfaceViewRenderer(mContext.context).also { r ->
            r.layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            r.init(eglBase.eglBaseContext, null)
        }
    }

    private val container: FrameLayout by lazy {
        FrameLayout(mContext.context).also { it.addView(renderer) }
    }

    private var currentTrack: VideoTrack? = null
    private var streamURL: String? = null

    // ── LynxUI lifecycle ─────────────────────────────────────────────────────

    override fun createView(context: Context): FrameLayout = container

    // ── Props ────────────────────────────────────────────────────────────────

    fun setStreamURL(urlString: String) {
        if (urlString == streamURL) return
        streamURL = urlString

        currentTrack?.removeSink(renderer)
        currentTrack = null

        val streamId = urlString.removePrefix("livekit-stream://")
        val stream = TrackRegistry.getStream(streamId) ?: return
        val track = stream.videoTracks.firstOrNull() ?: return
        track.addSink(renderer)
        currentTrack = track
    }

    /** "fill" = SCALE_ASPECT_FILL (default), "contain" = SCALE_ASPECT_FIT */
    fun setObjectFit(fit: String) {
        renderer.setScalingType(
            if (fit == "contain") RendererCommon.ScalingType.SCALE_ASPECT_FIT
            else RendererCommon.ScalingType.SCALE_ASPECT_FILL
        )
    }

    /** Mirror horizontally (useful for front-camera self-view). */
    fun setMirror(mirror: Boolean) {
        renderer.setMirror(mirror)
    }

    /** Z-order: 0 = below window, 1 = above window (media overlay). */
    fun setZOrder(z: Int) {
        renderer.setZOrderMediaOverlay(z > 0)
    }
}
