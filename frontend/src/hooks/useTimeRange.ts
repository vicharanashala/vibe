import {useCallback, useMemo, useState} from 'react';
import {
  digitsToSeconds,
  formatTime,
  groupDigits,
  normalizeDigits,
  parsePastedTime,
} from '@/utils/time';

export type RangeField = 'start' | 'end';

export interface TimeIssue {
  message: string;
  /**
   * `error` blocks saving; `hint` is advisory. A field being typed into passes
   * through invalid intermediate states — typing 0, 8, 4, 0 towards 08:40 is
   * briefly "before the start time" — so its own problems stay hints until it
   * is committed. The other field's committed errors keep full weight.
   */
  severity: 'error' | 'hint';
}

interface UseTimeRangeArgs {
  startSeconds: number;
  endSeconds: number;
  /** Video length in seconds; 0 while unknown, which disables length checks. */
  duration: number;
  onChange: (next: {start: number; end: number}) => void;
}

/** Seconds to the digit string the masked field would hold. */
function secondsToDigits(seconds: number): string {
  return normalizeDigits(formatTime(seconds).replace(/\D/g, ''));
}

/**
 * Editing state for a start/end timestamp pair.
 *
 * Committed values stay in seconds and are owned by the caller; this holds only
 * the in-progress draft, and derives every error rather than storing one. The
 * previous implementation kept `range`, `timeInputs` and `errors` as three
 * copies of the same fact and reconciled them by hand across six effects, which
 * is why validation needed a `setTimeout(…, 0)` to read around its own stale
 * closure.
 */
export function useTimeRange({
  startSeconds,
  endSeconds,
  duration,
  onChange,
}: UseTimeRangeArgs) {
  /** Digits being typed, per field. null means "not editing, show committed". */
  const [draft, setDraft] = useState<Record<RangeField, string | null>>({
    start: null,
    end: null,
  });
  const [focused, setFocused] = useState<RangeField | null>(null);
  /** Set when a commit had to pull a value back to the video length. */
  const [clamped, setClamped] = useState<Record<RangeField, boolean>>({
    start: false,
    end: false,
  });

  const committed = useMemo(
    () => ({start: startSeconds, end: endSeconds}),
    [startSeconds, endSeconds],
  );

  /** What each field means right now, draft included. */
  const effective = useMemo(
    () => ({
      start: draft.start !== null ? digitsToSeconds(draft.start) : committed.start,
      end: draft.end !== null ? digitsToSeconds(draft.end) : committed.end,
    }),
    [draft, committed],
  );

  const issues = useMemo(() => {
    const result: Record<RangeField, TimeIssue | null> = {start: null, end: null};
    const severity = (field: RangeField): TimeIssue['severity'] =>
      focused === field ? 'hint' : 'error';

    if (duration > 0) {
      if (effective.start > duration) {
        result.start = {
          message: `Longer than the video (${formatTime(duration)})`,
          severity: severity('start'),
        };
      }
      if (effective.end > duration) {
        result.end = {
          message: `Longer than the video (${formatTime(duration)})`,
          severity: severity('end'),
        };
      }
    }

    // Both at zero is the untouched state for a video whose length is not known
    // yet — not something to shout about.
    const untouched = effective.start === 0 && effective.end === 0;
    if (!result.end && !untouched && effective.end <= effective.start) {
      result.end = {
        message: 'End must be after the start time',
        severity: severity('end'),
      };
    }

    return result;
  }, [effective, duration, focused]);

  const hasBlockingError =
    issues.start?.severity === 'error' || issues.end?.severity === 'error';

  /** Write a value through to the caller, clamping to the video length. */
  const commitSeconds = useCallback(
    (field: RangeField, seconds: number) => {
      const safe = Math.max(0, Math.floor(seconds));
      const bounded = duration > 0 ? Math.min(safe, duration) : safe;
      setClamped(prev => ({...prev, [field]: bounded !== safe}));
      onChange({...committed, [field]: bounded});
      return bounded;
    },
    [committed, duration, onChange],
  );

  const fieldProps = useCallback(
    (field: RangeField) => ({
      value:
        draft[field] !== null
          ? groupDigits(draft[field] as string)
          : formatTime(committed[field]),

      /**
       * The normalised reading of what is currently typed, shown beneath the
       * field when it differs from the raw digits — so `00:84` visibly means
       * 1:24 and there is never a moment of doubt about what the digits mean.
       */
      preview: (() => {
        if (draft[field] === null) return null;
        const asSeconds = digitsToSeconds(draft[field] as string);
        const shown = groupDigits(draft[field] as string);
        const normalised = formatTime(asSeconds);
        return shown === normalised ? null : normalised;
      })(),

      issue: issues[field],
      clamped: clamped[field],

      onFocus: () => {
        setFocused(field);
        setDraft(prev => ({...prev, [field]: secondsToDigits(committed[field])}));
        setClamped(prev => ({...prev, [field]: false}));
      },

      onInput: (raw: string) => {
        setDraft(prev => ({...prev, [field]: normalizeDigits(raw)}));
        setClamped(prev => ({...prev, [field]: false}));
      },

      onCommit: () => {
        const pending = draft[field];
        setFocused(null);
        setDraft(prev => ({...prev, [field]: null}));
        if (pending !== null) commitSeconds(field, digitsToSeconds(pending));
      },

      /** Arrows nudge; the modifier scales the step. */
      onStep: (direction: 1 | -1, step: number) => {
        const next = Math.max(0, effective[field] + direction * step);
        const bounded = commitSeconds(field, next);
        if (focused === field) {
          setDraft(prev => ({...prev, [field]: secondsToDigits(bounded)}));
        }
      },

      /** Returns true when the paste was understood and should not fall through. */
      onPasteText: (text: string) => {
        const seconds = parsePastedTime(text);
        if (seconds === null) return false;
        const bounded = commitSeconds(field, seconds);
        setDraft(prev => ({...prev, [field]: secondsToDigits(bounded)}));
        return true;
      },
    }),
    [draft, committed, issues, clamped, effective, focused, commitSeconds],
  );

  /** Point a field at a specific moment — used by "set to current". */
  const setFromSeconds = useCallback(
    (field: RangeField, seconds: number) => {
      const bounded = commitSeconds(field, seconds);
      if (focused === field) {
        setDraft(prev => ({...prev, [field]: secondsToDigits(bounded)}));
      }
    },
    [commitSeconds, focused],
  );

  return {
    start: fieldProps('start'),
    end: fieldProps('end'),
    issues,
    hasBlockingError,
    setFromSeconds,
    /** Committed length of the selected segment, for display. */
    lengthSeconds: Math.max(0, committed.end - committed.start),
  };
}
