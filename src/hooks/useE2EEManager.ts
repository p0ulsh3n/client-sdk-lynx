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

    const onStatusChange = (enabled: boolean) => {
      setIsEncryptionEnabled(enabled);
    };

    // @ts-expect-error — SimpleEventEmitter uses (...args: unknown[]) but
    // livekit-client EncryptionEvent sends a boolean as first arg
    e2eeManager.on(
      EncryptionEvent.ParticipantEncryptionStatusChanged,
      onStatusChange,
    );

    return () => {
      // @ts-expect-error — same as above
      e2eeManager.off(
        EncryptionEvent.ParticipantEncryptionStatusChanged,
        onStatusChange,
      );
    };
  }, [room, e2eeManager]);

  return { isEncryptionEnabled };
}
