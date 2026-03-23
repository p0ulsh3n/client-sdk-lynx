# Setup Guide

## iOS

### 1. Add to Podfile

```ruby
pod 'livekit-lynx', :path => '../node_modules/@livekit/lynx'
```

### 2. Register in LynxInitProcessor.m

```objc
#import "livekit_lynx-Swift.h"

- (void)setupLynxEnv {
    // Step 1 — Setup (must be first)
    [LivekitLynx setup];

    // Step 2 — Native Modules
    [globalConfig registerModule:LivekitLynxModule.class];
    [globalConfig registerModule:LynxWebRTCModule.class];
    [globalConfig registerModule:LynxAudioModule.class];
    [globalConfig registerModule:LynxE2EEModule.class];

    // Step 3 — Custom Native Component
    [globalConfig registerUI:@"livekit-webrtc-view"
                   withClass:LynxVideoComponentUI.class];
}
```

### 3. Info.plist

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access for audio calls</string>
```

---

## Android

### 1. Add to settings.gradle

```groovy
include ':livekit-lynx'
project(':livekit-lynx').projectDir = new File(rootProject.projectDir, '../node_modules/@livekit/lynx/android')
```

### 2. Add to app/build.gradle

```groovy
implementation project(':livekit-lynx')
```

### 3. Application.kt

```kotlin
import com.livekit.lynx.LiveKitLynx

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        LiveKitLynx.setup(this)  // Must be FIRST
    }
}
```

### 4. LynxModuleAdapter

```kotlin
LynxEnv.inst().registerModule("LivekitLynxModule", LivekitLynxModule::class.java)
LynxEnv.inst().registerModule("LynxWebRTCModule",  LynxWebRTCModule::class.java)
LynxEnv.inst().registerModule("LynxAudioModule",   LynxAudioModule::class.java)
LynxEnv.inst().registerModule("LynxE2EEModule",    LynxE2EEModule::class.java)
```

### 5. LynxUIFactory

```kotlin
if (tag == "livekit-webrtc-view") return LynxVideoComponent(context)
```

### 6. AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

---

## JavaScript

```ts
// index.ts — app entry point (FIRST IMPORT)
import { registerGlobals } from '@livekit/lynx';
registerGlobals();
```

```tsx
// App.tsx
import { LiveKitRoom, VideoTrack, useTracks, AudioSession } from '@livekit/lynx';
import { Track } from 'livekit-client';

export default function App() {
  return (
    <LiveKitRoom
      serverUrl="wss://your-server.livekit.cloud"
      token={token}
      connect={true}
      audio={true}
      video={true}
    >
      <RoomView />
    </LiveKitRoom>
  );
}
```

---

## Testing & Verification

### Unit Tests (no device needed)

```bash
yarn test        # run once
yarn test:watch  # watch mode
```

### Runtime Testing on a Device

Fastest option: free sandbox at [cloud.livekit.io](https://cloud.livekit.io):

1. Create a free project → copy WebSocket URL
2. Dashboard → **Sandbox** → generate a token
3. In `example/src/App.tsx`, set `LIVEKIT_URL` and the token

```bash
cd example

# iOS
pod install --project-directory=ios
yarn ios

# Android
yarn android
```

See [example/README.md](./example/README.md) for the full guide.

### Verification Checklist

- [ ] Lobby screen appears on launch
- [ ] "Start LIVE" connects to the server
- [ ] Local camera video renders via `<livekit-webrtc-view>`
- [ ] Remote participant video appears
- [ ] Chat data channel sends and receives messages
- [ ] ✕ button disconnects cleanly
