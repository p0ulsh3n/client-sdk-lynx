# LiveKit Lynx Example

Full TikTok-style LIVE room demo using `@livekit/lynx`.

> **Note:** Before running, update `LIVEKIT_URL` and `TOKEN_ENDPOINT` in `src/App.tsx` with your LiveKit server credentials. See [Getting a token](#getting-a-token) below.

## Prerequisites

- Node.js 20+ and Yarn
- **iOS:** Xcode 16+, CocoaPods (`gem install cocoapods`)
- **Android:** Android Studio (API 34), JDK 17

## Setup

```bash
# From the repo root
yarn install

# iOS only — install CocoaPods
cd example/ios && pod install && cd ../..
```

## Run on device

```bash
# iOS — opens Xcode on first run
cd example && yarn ios

# Android
cd example && yarn android
```

## Getting a Token

### Option A — LiveKit Cloud (free sandbox, no server needed)

1. Go to [cloud.livekit.io](https://cloud.livekit.io) → create a free project
2. Copy your **WebSocket URL** and **API key/secret**
3. Generate a token on the dashboard → **Sandbox** tab → copy the token

In `src/App.tsx`:
```ts
const LIVEKIT_URL = 'wss://your-project.livekit.cloud';
```
Paste the token directly for quick testing:
```ts
const TOKEN_ENDPOINT = ''; // leave blank
```
And change:
```ts
const join = useCallback(async () => {
  await AudioSession.startAudioSession();
  setToken('PASTE_TOKEN_HERE');
  setJoined(true);
}, []);
```

### Option B — livekit-cli (local dev server)

```bash
# Install
brew install livekit-cli   # macOS
# or: npm install -g @livekit/livekit-cli

# Start local dev server
livekit-server --dev

# Generate a token (default: URL is ws://localhost:7880)
lk token create --api-key devkey --api-secret secret \
  --join --room my-room --identity user1
```

Set in `src/App.tsx`:
```ts
const LIVEKIT_URL = 'ws://localhost:7880';
```

## Runtime Verification Checklist

Once the app is running, verify:

- [ ] App opens and shows the "Go Live" lobby screen
- [ ] Tapping "Start LIVE" connects without error
- [ ] Local camera video displays full-screen
- [ ] Remote participants appear in the side grid
- [ ] Chat messages send and receive via data channel
- [ ] `BarVisualizer` shows audio levels when AI agent is present
- [ ] Tapping ✕ disconnects cleanly
- [ ] On iOS: audio continues in background (with `UIBackgroundModes → audio`)

## Native Module Registration

If you're integrating `@livekit/lynx` into your own Lynx app (not this example), see the full registration guide in [SETUP.md](../SETUP.md).
