# Contributing to client-sdk-lynx

Thank you for contributing!

## Prerequisites

- Node.js 20+
- Yarn
- Xcode 16+ (iOS development)
- Android Studio with API 34 SDK (Android development)

## Setup

```bash
git clone https://github.com/p0ulsh3n/client-sdk-lynx
cd client-sdk-lynx
yarn install
```

## Project Structure

```
client-sdk-lynx/
├── src/          TypeScript: RTCPeerConnection, MediaStream, hooks, components
├── ios/          Swift + ObjC: native modules and video component
├── android/      Kotlin: native modules and video component
└── ci/           CI build configurations
```

Key principle: **`livekit-client` (JS) is never modified.** All changes are in the bridge layer only.

## Type Checking

```bash
yarn typescript
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `feat: add screen sharing support`
4. Open a pull request with a clear description

## Reporting Issues

Please include:
- Platform (iOS / Android) and OS version
- Lynx version
- `@livekit/lynx` version
- Minimal reproduction case

## License

By contributing, you agree that your contributions will be licensed under
the Apache 2.0 license.
