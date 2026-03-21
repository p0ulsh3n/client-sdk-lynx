// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — src/components/BarVisualizer.tsx
// Port of @livekit/react-native src/components/BarVisualizer.tsx
//
// Key change: React Native `Animated` API → CSS `transition` via Lynx styles.
// All sequencer/animator logic is identical to the RN SDK.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type AgentState,
  type TrackReferenceOrPlaceholder,
  useMaybeTrackRefContext,
} from '@livekit/components-react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from '@lynx-js/react';
import { useMultibandTrackVolume } from '../hooks/useMultibandTrackVolume';

// ─────────────────────────────────────────────────────────────────────────────
// Types (100% identical to RN SDK)
// ─────────────────────────────────────────────────────────────────────────────

export type BarVisualizerOptions = {
  /** Decimal values from 0 to 1. Default: 1. */
  maxHeight?: number;
  /** Decimal values from 0 to 1. Default: 0.2. */
  minHeight?: number;
  barColor?: string;
  barWidth?: number | string;
  barBorderRadius?: number;
};

const defaultBarOptions = {
  maxHeight: 1,
  minHeight: 0.2,
  barColor: '#888888',
  barWidth: 24,
  barBorderRadius: 12,
} as const satisfies BarVisualizerOptions;

const sequencerIntervals = new Map<AgentState, number>([
  ['connecting',  2000],
  ['initializing', 2000],
  ['listening',    500],
  ['thinking',     150],
]);

function getSequencerInterval(
  state: AgentState | undefined,
  barCount: number,
): number {
  if (state === undefined) return 1000;
  let interval = sequencerIntervals.get(state);
  if (interval && state === 'connecting') interval /= barCount;
  return interval ?? 100;
}

/** @beta */
export interface BarVisualizerProps {
  /** Drives VoiceAssistant state transitions. */
  state?: AgentState;
  /** Number of bars. Default: 5. */
  barCount?: number;
  trackRef?: TrackReferenceOrPlaceholder;
  options?: BarVisualizerOptions;
  style?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// BarVisualizer component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visualises audio signals from a TrackReference as animated bars.
 * When `state` is provided, transitions between VoiceAssistant agent states.
 *
 * @beta
 */
export function BarVisualizer({
  style = {},
  state,
  barCount = 5,
  trackRef,
  options,
}: BarVisualizerProps): JSX.Element {
  let trackReference = useMaybeTrackRefContext();
  if (trackRef) trackReference = trackRef;

  const magnitudes = useMultibandTrackVolume(trackReference, { bands: barCount });
  const opts = { ...defaultBarOptions, ...options };
  const interval = getSequencerInterval(state, barCount);

  const highlightedIndices = useBarAnimator(state, barCount, interval);

  // ── Opacity state (replaces Animated.Value array from RN) ────────────────
  // We keep a float array of target opacities and let CSS `transition` handle
  // the interpolation — no need for the Animated API.
  const [opacities, setOpacities] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0.3),
  );

  useEffect(() => {
    setOpacities(
      Array.from({ length: barCount }, (_, i) =>
        highlightedIndices.includes(i) ? 1 : 0.3,
      ),
    );
  }, [highlightedIndices, barCount]);

  // ── Render ────────────────────────────────────────────────────────────────
  const bars: ReactNode[] = magnitudes.map((value, index) => {
    const coerced = Math.min(opts.maxHeight, Math.max(opts.minHeight, value));
    const pct = Math.min(100, Math.max(0, coerced * 100));

    return (
      <view
        key={index}
        style={{
          height: `${pct}%`,
          width: opts.barWidth,
          backgroundColor: opts.barColor,
          borderRadius: opts.barBorderRadius,
          opacity: opacities[index] ?? 0.3,
          // CSS transition — Lynx supports the `transition` property
          transition: 'opacity 250ms ease',
        } as Record<string, unknown>}
      />
    );
  });

  return (
    <view
      style={{
        ...style,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
      } as Record<string, unknown>}
    >
      {bars}
    </view>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useBarAnimator — 100% identical to RN SDK
// ─────────────────────────────────────────────────────────────────────────────

export function useBarAnimator(
  state: AgentState | undefined,
  columns: number,
  interval: number,
): number[] {
  const [index, setIndex] = useState(0);
  const [sequence, setSequence] = useState<number[][]>([[]] as number[][]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === 'thinking') {
      setSequence(generateListeningSequence(columns));
    } else if (state === 'connecting' || state === 'initializing') {
      setSequence([...generateConnectingSequence(columns)]);
    } else if (state === 'listening') {
      setSequence(generateListeningSequence(columns));
    } else if (state === undefined) {
      setSequence([Array.from({ length: columns }, (_, i) => i)]);
    } else {
      setSequence([[]]);
    }
    setIndex(0);
  }, [state, columns]);

  useEffect(() => {
    let startTime = performance.now();

    const animate = (time: number) => {
      if (time - startTime >= interval) {
        setIndex((prev) => prev + 1);
        startTime = time;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [interval, columns, state, sequence.length]);

  return sequence[index % sequence.length] ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sequence generators — identical to RN SDK
// ─────────────────────────────────────────────────────────────────────────────

function generateListeningSequence(columns: number): number[][] {
  const center = Math.floor(columns / 2);
  return [[center], [-1]];
}

function generateConnectingSequence(columns: number): number[][] {
  const seq: number[][] = [[]];
  for (let x = 0; x < columns; x++) {
    seq.push([x, columns - 1 - x]);
  }
  return seq;
}
