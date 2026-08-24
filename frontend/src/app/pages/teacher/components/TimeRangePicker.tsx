import {useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useTimeRange, type RangeField} from '@/hooks/useTimeRange';
import {formatTime} from '@/utils/time';

interface TimeRangePickerProps {
  startSeconds: number;
  endSeconds: number;
  /** Video length in seconds; 0 while unknown. */
  duration: number;
  disabled?: boolean;
  /** Seek controls stay inert until a player can answer them. */
  playerReady?: boolean;
  onChange: (next: {start: number; end: number}) => void;
  onSeek?: (seconds: number) => void;
  /** Lets the modal disable Save while a committed value is invalid. */
  onValidityChange?: (hasBlockingError: boolean) => void;
}

/** ±1s from the arrows, ±10s with Shift, ±60s with Page Up/Down. */
const STEP_SECONDS = 1;
const STEP_SECONDS_LARGE = 10;
const STEP_SECONDS_PAGE = 60;

/**
 * Start/end timestamp entry for a video segment.
 *
 * Digits are typed right to left like a stopwatch — `840` becomes 08:40 — so no
 * colon and no modifier key is ever needed, and the numeric keypad works on a
 * tablet. Arrow keys nudge the value for fine adjustment. Both fields select
 * their contents on focus, so tabbing in and retyping is a single gesture.
 */
export default function TimeRangePicker({
  startSeconds,
  endSeconds,
  duration,
  disabled = false,
  playerReady = false,
  onChange,
  onSeek,
  onValidityChange,
}: TimeRangePickerProps) {
  const range = useTimeRange({startSeconds, endSeconds, duration, onChange});

  useEffect(() => {
    onValidityChange?.(range.hasBlockingError);
  }, [range.hasBlockingError, onValidityChange]);

  const renderField = (field: RangeField, label: string) => {
    const props = field === 'start' ? range.start : range.end;
    const describedBy = `${field}-time-note`;

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${field}-time-input`}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>

        <div className="flex items-center gap-1">
          <Input
            id={`${field}-time-input`}
            type="text"
            // Brings up the numeric keypad on the tablets a lot of instructors
            // actually author on.
            inputMode="numeric"
            autoComplete="off"
            value={props.value}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={props.issue?.severity === 'error'}
            className={`w-24 text-center font-mono tabular-nums bg-background ${
              props.issue?.severity === 'error'
                ? 'border-red-500 focus-visible:ring-red-500'
                : 'border-border'
            }`}
            // Select-all on focus is what makes "click in and retype" work; the
            // old field required deleting the existing value character by
            // character before anything could be entered.
            onFocus={event => {
              props.onFocus();
              event.target.select();
            }}
            onChange={event => props.onInput(event.target.value)}
            onBlur={props.onCommit}
            onPaste={event => {
              const text = event.clipboardData.getData('text');
              if (props.onPasteText(text)) event.preventDefault();
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
                return;
              }
              const step = event.shiftKey ? STEP_SECONDS_LARGE : STEP_SECONDS;
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                props.onStep(1, step);
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                props.onStep(-1, step);
              } else if (event.key === 'PageUp') {
                event.preventDefault();
                props.onStep(1, STEP_SECONDS_PAGE);
              } else if (event.key === 'PageDown') {
                event.preventDefault();
                props.onStep(-1, STEP_SECONDS_PAGE);
              }
            }}
          />

          <div className="flex flex-col">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={`Increase ${label} by one second`}
              className="px-1 leading-none text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => props.onStep(1, STEP_SECONDS)}
            >
              ▲
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={`Decrease ${label} by one second`}
              className="px-1 leading-none text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => props.onStep(-1, STEP_SECONDS)}
            >
              ▼
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!playerReady}
            onClick={() => onSeek?.(field === 'start' ? startSeconds : endSeconds)}
          >
            Go to
          </Button>
        </div>

        {/*
          * One line, three possible messages, so the control never changes
          * height as the teacher types and shifts the rest of the form.
          */}
        <p
          id={describedBy}
          className={`min-h-4 text-xs ${
            props.issue?.severity === 'error'
              ? 'text-red-500'
              : props.issue
                ? 'text-amber-600 dark:text-amber-500'
                : 'text-muted-foreground'
          }`}
        >
          {props.issue?.message ??
            (props.preview
              ? `= ${props.preview}`
              : props.clamped
                ? `Clamped to the video length (${formatTime(duration)})`
                : '')}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      {renderField('start', 'Start time')}
      {renderField('end', 'End time')}

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Length</span>
        <span className="flex h-9 items-center font-mono tabular-nums text-sm text-muted-foreground">
          {formatTime(range.lengthSeconds)}
        </span>
      </div>

      <p className="w-full text-xs text-muted-foreground">
        Type digits only — <span className="font-mono">840</span> becomes 08:40.
        Arrow keys nudge by a second, Shift by ten.
      </p>
    </div>
  );
}
