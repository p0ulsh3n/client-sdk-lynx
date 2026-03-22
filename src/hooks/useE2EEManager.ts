// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/hooks/useE2EEManager.ts
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

export function useRNE2EEManager(
  options: UseRNE2EEManagerOptions,
): RNE2EEManagerState {
  const { room, e2eeManager } = options;
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);

  useEffect(() => {
    if (!e2eeManager) return;

    e2eeManager.setup(room);

    // Use (...args: unknown[]) to match SimpleEventEmitter signature
    const onStatusChange = (...args: unknown[]) => {
      setIsEncryptionEnabled(args[0] as boolean);
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
