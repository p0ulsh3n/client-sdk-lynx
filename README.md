# client-sdk-lynx

[![Native Build](https://github.com/p0ulsh3n/client-sdk-lynx/actions/workflows/native_build.yaml/badge.svg)](https://github.com/p0ulsh3n/client-sdk-lynx/actions/workflows/native_build.yaml)
[![Test](https://github.com/p0ulsh3n/client-sdk-lynx/actions/workflows/test.yaml/badge.svg)](https://github.com/p0ulsh3n/client-sdk-lynx/actions/workflows/test.yaml)

> **LiveKit SDK for [Lynx](https://lynxjs.org) (ReactLynx)** — real-time video, audio and data.

---

## Quick Start

```bash
yarn add @livekit/lynx livekit-client
```

```ts
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
├── ios/          Swift + ObjC: LynxWebRTCModule, LynxVideoComponent, AudioSession
├── android/      Kotlin: LynxWebRTCModule, LynxVideoComponent, AudioSession
└── ci/           CI build configurations for iOS and Android
```

## License

Apache 2.0
