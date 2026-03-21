// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/audio/AudioSession.ts
// Port of @livekit/react-native src/audio/AudioSession.ts
// Only change: import source updated to Lynx module.
// All types, constants and methods are identical to the RN SDK.
// ─────────────────────────────────────────────────────────────────────────────

import { LivekitLynxModule } from '../NativeModule';

// ─────────────────────────────────────────────────────────────────────────────
// Types (100% identical to RN SDK)
// ─────────────────────────────────────────────────────────────────────────────

export type AudioConfiguration = {
  android?: {
    preferredOutputList?: ('speaker' | 'earpiece' | 'headset' | 'bluetooth')[];
    audioTypeOptions: AndroidAudioTypeOptions;
  };
  ios?: {
    defaultOutput?: 'speaker' | 'earpiece';
  };
};

export type AndroidAudioTypeOptions = {
  manageAudioFocus?: boolean;
  audioMode?:
    | 'normal'
    | 'callScreening'
    | 'inCall'
    | 'inCommunication'
    | 'ringtone';
  audioFocusMode?:
    | 'gain'
    | 'gainTransient'
    | 'gainTransientExclusive'
    | 'gainTransientMayDuck';
  audioAttributesUsageType?:
    | 'alarm'
    | 'assistanceAccessibility'
    | 'assistanceNavigationGuidance'
    | 'assistanceSonification'
    | 'assistant'
    | 'game'
    | 'media'
    | 'notification'
    | 'notificationEvent'
    | 'notificationRingtone'
    | 'unknown'
    | 'voiceCommunication'
    | 'voiceCommunicationSignalling';
  audioAttributesContentType?:
    | 'movie'
    | 'music'
    | 'sonification'
    | 'speech'
    | 'unknown';
  audioStreamType?:
    | 'accessibility'
    | 'alarm'
    | 'dtmf'
    | 'music'
    | 'notification'
    | 'ring'
    | 'system'
    | 'voiceCall';
  forceHandleAudioRouting?: boolean;
};

export const AndroidAudioTypePresets: {
  communication: AndroidAudioTypeOptions;
  media: AndroidAudioTypeOptions;
} = {
  communication: {
    manageAudioFocus: true,
    audioMode: 'inCommunication',
    audioFocusMode: 'gain',
    audioStreamType: 'voiceCall',
    audioAttributesUsageType: 'voiceCommunication',
    audioAttributesContentType: 'speech',
  },
  media: {
    manageAudioFocus: true,
    audioMode: 'normal',
    audioFocusMode: 'gain',
    audioStreamType: 'music',
    audioAttributesUsageType: 'media',
    audioAttributesContentType: 'unknown',
  },
} as const;

export type AppleAudioMode =
  | 'default'
  | 'gameChat'
  | 'measurement'
  | 'moviePlayback'
  | 'spokenAudio'
  | 'videoChat'
  | 'videoRecording'
  | 'voiceChat'
  | 'voicePrompt';

export type AppleAudioCategory =
  | 'soloAmbient'
  | 'playback'
  | 'record'
  | 'playAndRecord'
  | 'multiRoute';

export type AppleAudioCategoryOption =
  | 'mixWithOthers'
  | 'duckOthers'
  | 'interruptSpokenAudioAndMixWithOthers'
  | 'allowBluetooth'
  | 'allowBluetoothA2DP'
  | 'allowAirPlay'
  | 'defaultToSpeaker';

export type AppleAudioConfiguration = {
  audioCategory?: AppleAudioCategory;
  audioCategoryOptions?: AppleAudioCategoryOption[];
  audioMode?: AppleAudioMode;
};

export type AudioTrackState =
  | 'none'
  | 'remoteOnly'
  | 'localOnly'
  | 'localAndRemote';

// ─────────────────────────────────────────────────────────────────────────────
// Helper (100% identical to RN SDK)
// ─────────────────────────────────────────────────────────────────────────────

export function getDefaultAppleAudioConfigurationForMode(
  mode: AudioTrackState,
  preferSpeakerOutput = true,
): AppleAudioConfiguration {
  if (mode === 'remoteOnly') {
    return {
      audioCategory: 'playback',
      audioCategoryOptions: ['mixWithOthers'],
      audioMode: 'spokenAudio',
    };
  }
  if (mode === 'localAndRemote' || mode === 'localOnly') {
    return {
      audioCategory: 'playAndRecord',
      audioCategoryOptions: ['allowBluetooth', 'mixWithOthers'],
      audioMode: preferSpeakerOutput ? 'videoChat' : 'voiceChat',
    };
  }
  return {
    audioCategory: 'soloAmbient',
    audioCategoryOptions: [],
    audioMode: 'default',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioSession class (100% identical to RN SDK — only module import changed)
// ─────────────────────────────────────────────────────────────────────────────

export default class AudioSession {

  static configureAudio = (config: AudioConfiguration): Promise<void> =>
    new Promise((resolve, reject) =>
      LivekitLynxModule.configureAudio(JSON.stringify(config), (err) => {
        if (err) reject(new Error(err));
        else resolve();
      }),
    );

  static startAudioSession = (): Promise<void> =>
    new Promise((resolve, reject) =>
      LivekitLynxModule.startAudioSession((err) => {
        if (err) reject(new Error(err));
        else resolve();
      }),
    );

  static stopAudioSession = (): Promise<void> =>
    new Promise((resolve, reject) =>
      LivekitLynxModule.stopAudioSession((err) => {
        if (err) reject(new Error(err));
        else resolve();
      }),
    );

  static setDefaultRemoteAudioTrackVolume = (volume: number): Promise<void> =>
    new Promise((resolve, reject) =>
      LivekitLynxModule.setDefaultAudioTrackVolume(volume, (err) => {
        if (err) reject(new Error(err));
        else resolve();
      }),
    );

  static getAudioOutputs = (): Promise<string[]> => {
    if (SystemInfo?.platform === 'ios') {
      return Promise.resolve(['default', 'force_speaker']);
    }
    if (SystemInfo?.platform === 'android') {
      return new Promise((resolve, reject) =>
        LivekitLynxModule.getAudioOutputs((err, result) => {
          if (err) reject(new Error(err));
          else resolve(JSON.parse(result!) as string[]);
        }),
      );
    }
    return Promise.resolve([]);
  };

  static selectAudioOutput = (deviceId: string): Promise<void> =>
    new Promise((resolve, reject) =>
      LivekitLynxModule.selectAudioOutput(deviceId, (err) => {
        if (err) reject(new Error(err));
        else resolve();
      }),
    );

  static showAudioRoutePicker = (): Promise<void> => {
    if (SystemInfo?.platform !== 'ios') return Promise.resolve();
    return new Promise((resolve, reject) =>
      LivekitLynxModule.showAudioRoutePicker((err) => {
        if (err) reject(new Error(err));
        else resolve();
      }),
    );
  };

  static setAppleAudioConfiguration = (
    config: AppleAudioConfiguration,
  ): Promise<void> => {
    if (SystemInfo?.platform !== 'ios') return Promise.resolve();
    return new Promise((resolve, reject) =>
      LivekitLynxModule.setAppleAudioConfiguration(
        JSON.stringify(config),
        (err) => {
          if (err) reject(new Error(err));
          else resolve();
        },
      ),
    );
  };
}
