#ifndef LynxLiveKitSetup_h
#define LynxLiveKitSetup_h

/*
 Setup Guide — copy into your LynxInitProcessor.m

 1. Import the generated Swift headers:

     #import "livekit_lynx-Swift.h"
     #import "livekit_lynx_webrtc-Swift.h"

 2. In your setupLynxEnv method:

     - (void)setupLynxEnv {
         [LivekitLynx setup];

         [globalConfig registerModule:LivekitLynxModule.class];
         [globalConfig registerModule:LynxWebRTCModule.class];
         [globalConfig registerModule:LynxAudioModule.class];
         [globalConfig registerModule:LynxE2EEModule.class];

         [globalConfig registerUI:@"livekit-webrtc-view"
                        withClass:LynxVideoComponentUI.class];
     }

 3. In your Info.plist, add camera and microphone usage descriptions:

     <key>NSCameraUsageDescription</key>
     <string>Camera access for video calls</string>
     <key>NSMicrophoneUsageDescription</key>
     <string>Microphone access for audio calls</string>

 4. For background audio (optional):
     Add UIBackgroundModes -> audio, voip in Info.plist.

 5. For screen sharing (optional):
     Follow the Broadcast Extension setup guide in the README.
*/

#endif /* LynxLiveKitSetup_h */
