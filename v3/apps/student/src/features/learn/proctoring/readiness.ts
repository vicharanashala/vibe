import { useCallback, useMemo, useState } from 'react';

import { ModelLoadError, type GroupProgress } from './model-loader';

/**
 * Where one proctoring check is in getting ready. `starting` is the time
 * between having its files and the check actually running (compiling the
 * runtime, warming up the model), which can take a few seconds on slow devices.
 */
export type ReadinessState = 'idle' | 'checking' | 'downloading' | 'stalled' | 'starting' | 'ready' | 'failed';

export interface Readiness {
  state: ReadinessState;
  received: number;
  /** null when the download size isn't known. */
  total: number | null;
  /** Every file came from the device instead of the network. */
  fromCache: boolean;
  /** False when the device refused to keep the files (they'll download again next time). */
  saved: boolean;
  /** Plain-language reason, when `state` is `failed`. */
  error: string | null;
}

export const IDLE_READINESS: Readiness = {
  state: 'idle',
  received: 0,
  total: null,
  fromCache: false,
  saved: true,
  error: null,
};

/** Already usable: nothing to download (e.g. blur detection), or the check is off. */
export const READY: Readiness = { ...IDLE_READINESS, state: 'ready' };

/** Turns anything a model load can throw into a reason students can act on. */
export function describeLoadError(error: unknown): string {
  if (error instanceof ModelLoadError) return error.message;
  const text = String((error as Error)?.message ?? error);
  if (/webgl|wasm|webassembly|simd|offscreen|backend/i.test(text))
    return 'This browser couldn’t start the check. Try an up-to-date Chrome, Edge or Firefox.';
  return 'The check couldn’t start.';
}

export interface ReadinessTracker {
  /** Back to the start (a fresh attempt). */
  begin: () => void;
  progress: (progress: GroupProgress) => void;
  /** Files are in hand; the check is starting up. */
  loaded: (group: { fromCache: boolean; saved: boolean }) => void;
  ready: () => void;
  fail: (error: unknown) => void;
}

/**
 * Readiness state for one check, plus `attempt`, which the check's loading
 * effect lists as a dependency so `retry()` re-runs only that check.
 */
export function useReadiness(): { readiness: Readiness; attempt: number; retry: () => void; track: ReadinessTracker } {
  const [readiness, setReadiness] = useState<Readiness>(IDLE_READINESS);
  const [attempt, setAttempt] = useState(0);

  const track = useMemo<ReadinessTracker>(
    () => ({
      begin: () => setReadiness({ ...IDLE_READINESS, state: 'checking' }),
      progress: ({ state, received, total }) =>
        setReadiness((r) => ({
          ...r,
          state: state === 'cached' || state === 'done' ? 'starting' : state,
          received,
          total,
          fromCache: state === 'cached',
        })),
      loaded: ({ fromCache, saved }) => setReadiness((r) => ({ ...r, state: 'starting', fromCache, saved })),
      ready: () => setReadiness((r) => ({ ...r, state: 'ready', error: null })),
      fail: (error) => setReadiness((r) => ({ ...r, state: 'failed', error: describeLoadError(error) })),
    }),
    [],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { readiness, attempt, retry, track };
}
