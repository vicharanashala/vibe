import {cn} from '@/utils/utils';

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface ScoreScaleProps {
  label: string;
  /** One line explaining what this criterion means, shown under the label. */
  hint?: string;
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
 */
export default function ScoreScale({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: ScoreScaleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            'text-sm tabular-nums',
            value === null ? 'text-muted-foreground' : 'font-semibold',
          )}
        >
          {value === null ? '—' : `${value}/10`}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1.5"
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
              'h-9 w-9 rounded-md border text-sm tabular-nums transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              value === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
