# Contributing to livekit-lynx

Thank you for contributing! This is a community port of the LiveKit SDK for
the [Lynx](https://lynxjs.org) framework.

## Prerequisites

- Node.js 20+
- Yarn 4+
- Xcode 16+ (iOS development)
- Android Studio Iguana+ with API 34 SDK (Android development)

## Setup

```bash
git clone https://github.com/livekit/livekit-lynx
cd livekit-lynx
yarn install
```

## Architecture

Read the [migration plan](docs/migration-plan.md) to understand how this
SDK maps to `@livekit/react-native` and `client-sdk-flutter`.

Key principle: **`livekit-client` (JS pure) is never modified.** All
changes are in the bridge layer only.

## Package structure

```
packages/
├── livekit-lynx-webrtc/   WebRTC polyfill (@livekit/lynx-webrtc)
├── livekit-lynx/          High-level SDK (@livekit/lynx)
└── example/               Demo app
```

## Running the example

```bash
# Start dev server
cd packages/example
yarn dev

# iOS (requires Xcode)
cd ios && pod install && cd ..
open ios/LiveKitLynxExample.xcworkspace

# Android
npx lynx-cli run android
```

## Type checking

```bash
yarn typecheck
```

## Submitting changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `feat: add screen sharing support`
4. Open a pull request with a clear description of what changed and why

## Reporting issues

Please include:
- Platform (iOS / Android) and OS version
- Lynx version
- `@livekit/lynx` and `@livekit/lynx-webrtc` versions
- Minimal reproduction case

## License

By contributing, you agree that your contributions will be licensed under
the Apache 2.0 license.
