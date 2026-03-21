// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/hooks/useE2EEManager.ts
// Port of @livekit/react-native src/hooks/useE2EEManager.ts
// Only change: `react` → `@lynx-js/react`
// ─────────────────────────────────────────────────────────────────────────────

import {
  EncryptionEvent,
  type Room,
} from 'livekit-client';
import { useEffect, useState } from '@lynx-js/react';
import type LynxE2EEManager from '../e2ee/LynxE2EEManager';

export interface UseRNE2EEManagerOptions {
  room: Room;
  e2eeManager?: LynxE2EEManager;
}

export interface RNE2EEManagerState {
  isEncryptionEnabled: boolean;
}

/**
 * Tracks the E2EE encryption state for the local participant.
 */
export function useRNE2EEManager(
  options: UseRNE2EEManagerOptions,
): RNE2EEManagerState {
  const { room, e2eeManager } = options;
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);

  useEffect(() => {
    if (!e2eeManager) return;

    e2eeManager.setup(room);

    const onStatusChange = (enabled: boolean) => {
      setIsEncryptionEnabled(enabled);
    };

    e2eeManager.on(
      EncryptionEvent.ParticipantEncryptionStatusChanged,
      onStatusChange,
    );

    return () => {
      e2eeManager.off(
        EncryptionEvent.ParticipantEncryptionStatusChanged,
        onStatusChange,
      );
    };
  }, [room, e2eeManager]);

  return { isEncryptionEnabled };
}
