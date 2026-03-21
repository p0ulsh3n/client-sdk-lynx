// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — ios/LynxLiveKitSetup.h
// Objective-C header providing the full setup snippet for Lynx iOS apps.
//
// Copy the registration code below into your LynxInitProcessor.m
// (or equivalent Lynx app setup file).
// ─────────────────────────────────────────────────────────────────────────────

#ifndef LynxLiveKitSetup_h
#define LynxLiveKitSetup_h

/*
 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║  LYNX APP SETUP — copy into your LynxInitProcessor.m                       ║
 ╚══════════════════════════════════════════════════════════════════════════════╝

 1. Import the generated Swift headers at the top of your .m file:

     #import "livekit_lynx-Swift.h"
     #import "livekit_lynx_webrtc-Swift.h"

 2. In your setupLynxEnv method:

     - (void)setupLynxEnv {
         // ── 1. LiveKit setup (must come first) ──────────────────────────────
         [LivekitLynx setup];

         // ── 2. Register Native Modules ──────────────────────────────────────
         //   @livekit/lynx (AudioSession management)
         [globalConfig registerModule:LivekitLynxModule.class];

         //   @livekit/lynx-webrtc (WebRTC PeerConnection + getUserMedia)
         [globalConfig registerModule:LynxWebRTCModule.class];

         //   @livekit/lynx-webrtc (Audio volume processors)
         [globalConfig registerModule:LynxAudioModule.class];

         //   @livekit/lynx-webrtc (E2EE frame cryptors + key providers)
         [globalConfig registerModule:LynxE2EEModule.class];

         // ── 3. Register Custom Native Components ───────────────────────────
         //   Video renderer — tag must match exactly "livekit-webrtc-view"
         [globalConfig registerUI:@"livekit-webrtc-view"
                        withClass:LynxVideoComponentUI.class];

         // ... rest of your Lynx setup
     }

 3. In your Info.plist, add camera and microphone usage descriptions:

     <key>NSCameraUsageDescription</key>
     <string>Camera access for video calls</string>
     <key>NSMicrophoneUsageDescription</key>
     <string>Microphone access for audio calls</string>

 4. For background audio (optional):
     Add UIBackgroundModes → audio, voip in Info.plist.

 5. For screen sharing (optional):
     Follow the Broadcast Extension setup guide in the README.
*/

#endif /* LynxLiveKitSetup_h */
