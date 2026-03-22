// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/components/LynxViewPortDetector.tsx
// Replaces @livekit/react-native ViewPortDetector.tsx
//
// The RN version used AppState + View.measure (polling every 1 s).
// Lynx has a native IntersectionObserver API which is more efficient.
// Falls back to a polling approach if IntersectionObserver is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from '@lynx-js/react';
import * as React from '@lynx-js/react';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface LynxViewPortDetectorProps {
  /** When true, visibility detection is disabled and onChange is never called. */
  disabled?: boolean;
  /** Called when the visibility state changes. */
  onChange?: (isVisible: boolean) => void;
  /** Polling interval in ms (only used if IntersectionObserver is unavailable). */
  delay?: number;
  /** When this value changes, the last-known visibility is reset. */
  propKey?: unknown;
  style?: Record<string, unknown>;
  children?: ReactNode;
}

const DEFAULT_DELAY = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects when a component enters or leaves the viewport.
 * Will not fire for zero-width or zero-height elements.
 */
export default function LynxViewPortDetector({
  disabled = false,
  onChange,
  delay = DEFAULT_DELAY,
  propKey,
  style,
  children,
}: LynxViewPortDetectorProps): React.ReactElement {
  const viewRef = useRef<Element | null>(null);
  // Track last emitted value to avoid redundant callbacks
  const lastValue = useRef<boolean | null>(null);

  const emit = useCallback(
    (visible: boolean) => {
      if (lastValue.current !== visible) {
        lastValue.current = visible;
        onChange?.(visible);
      }
    },
    [onChange],
  );

  // Reset last value when propKey changes so the next detection fires
  useEffect(() => {
    lastValue.current = null;
  }, [propKey]);

  useEffect(() => {
    if (disabled) return;
    const el = viewRef.current;
    if (!el) return;

    // ── Preferred path: Lynx IntersectionObserver (native, zero overhead) ──
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          // Guard: treat zero-size intersections as invisible
          const { width, height } = entry.boundingClientRect;
          emit(entry.isIntersecting && width > 0 && height > 0);
        },
        { threshold: 0 },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }

    // ── Fallback path: polling (mirrors the original RN implementation) ────
    let cleared = false;
    const poll = () => {
      if (cleared) return;
      // Lynx elements expose getBoundingClientRect on the main thread
      const rect =
        typeof (el as HTMLElement).getBoundingClientRect === 'function'
          ? (el as HTMLElement).getBoundingClientRect()
          : null;

      if (rect) {
        emit(rect.width > 0 && rect.height > 0);
      }
      if (!cleared) {
        timerId = window.setTimeout(poll, delay);
      }
    };
    let timerId = window.setTimeout(poll, delay);
    return () => {
      cleared = true;
      window.clearTimeout(timerId);
    };
  }, [disabled, delay, emit]);

  return (
    <view
      ref={viewRef as RefObject<Element>}
      style={style}
    >
      {children}
    </view>
  );
}
