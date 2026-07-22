import {cn} from '@/utils/utils';

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface ScoreScaleProps {
  label: string;
  /** One line explaining what this criterion means, shown under the label. */
  hint?: string;
  /** Words for the 1 and 10 ends, so the scale means something concrete. */
  lowLabel?: string;
  highLabel?: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * A 1-10 rating row rendered as discrete buttons rather than a slider.
 *
 * A slider invites a reviewer to leave the handle wherever it landed; ten
 * targets force a deliberate choice, and each value stays reachable in one tap
 * on touch devices.
 *
 * Unpicked buttons carry a visible border and hover lift so the row reads as
 * ten controls; picked reads as filled and slightly raised. An unanswered scale
 * says "Not answered yet" in words rather than an em dash, which testers read
 * as a broken value rather than an empty one.
 */
export default function ScoreScale({
  label,
  hint,
  lowLabel,
  highLabel,
  value,
  onChange,
  disabled = false,
}: ScoreScaleProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs tabular-nums',
            value === null
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 font-semibold text-primary',
          )}
        >
          {value === null ? 'Not answered yet' : `${value} / 10`}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-10 gap-1 sm:gap-1.5"
      >
        {VALUES.map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label}: ${n} out of 10`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              'flex h-10 items-center justify-center rounded-md border text-sm font-medium tabular-nums',
              'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              value === n
                ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                : 'border-input bg-background text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent',
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {lowLabel || highLabel ? (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
