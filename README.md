# client-sdk-lynx

[![CI](https://github.com/YOUR_USERNAME/client-sdk-lynx/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/client-sdk-lynx/actions/workflows/ci.yml)
[![iOS](https://github.com/YOUR_USERNAME/client-sdk-lynx/actions/workflows/ios.yml/badge.svg)](https://github.com/YOUR_USERNAME/client-sdk-lynx/actions/workflows/ios.yml)
[![Android](https://github.com/YOUR_USERNAME/client-sdk-lynx/actions/workflows/android.yml/badge.svg)](https://github.com/YOUR_USERNAME/client-sdk-lynx/actions/workflows/android.yml)

> **LiveKit SDK for [Lynx](https://lynxjs.org) (ReactLynx)** — real-time video, audio and data.
>
> Port of [`@livekit/react-native`](https://github.com/livekit/client-sdk-react-native) adapted for Lynx (ByteDance).

---

## Quick start

```bash
yarn add @livekit/lynx livekit-client
```

```ts
// index.ts — FIRST IMPORT
import { registerGlobals } from '@livekit/lynx';
registerGlobals();
```

```tsx
import { LiveKitRoom, VideoTrack, useTracks } from '@livekit/lynx';
import { Track } from 'livekit-client';

export default function App() {
  return (
    <LiveKitRoom serverUrl="wss://..." token={token} connect audio video>
      <RoomView />
    </LiveKitRoom>
  );
}

function RoomView() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  return (
    <view style={{ flex: 1 }}>
      {tracks.map((t) => (
        <VideoTrack key={t.publication?.trackSid} trackRef={t} objectFit="cover" />
      ))}
    </view>
  );
}
```

Full setup guide: **[SETUP.md](./SETUP.md)**

---

## Architecture

```
client-sdk-lynx/
├── src/          TypeScript: RTCPeerConnection, MediaStream, hooks, components
├── ios/          Swift 6 + ObjC: LynxWebRTCModule, LynxVideoComponent, AudioSession
├── android/      Kotlin 2.0: LynxWebRTCModule, LynxVideoComponent, AudioSession
└── example/      TikTok-style LIVE room demo
```

## License

Apache 2.0
