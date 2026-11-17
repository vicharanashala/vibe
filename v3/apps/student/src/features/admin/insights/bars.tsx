import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Bar colours, from the chart palette, plus status tones for rates. */
export type BarTone = 'primary' | 'muted' | 'good' | 'warn' | 'bad' | 'strong';

const TONE: Record<BarTone, string> = {
  primary: 'bg-chart-1',
  strong: 'bg-chart-3',
  muted: 'bg-muted-foreground/35',
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
};

/** A thin rounded bar filled to `value` (0–1). Decorative: the row's text carries the number. */
export function Bar({
  value,
  tone = 'primary',
  color,
  className,
}: {
  value: number;
  tone?: BarTone;
  /** A CSS colour that overrides `tone` (e.g. to match a chart series). */
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span
      aria-hidden
      className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)}
    >
      <span
        className={cn('block h-full rounded-full', !color && TONE[tone])}
        // A non-zero value always shows a sliver, so "1" never looks like "0".
        style={{
          width: pct > 0 ? `max(${pct}%, 4px)` : 0,
          ...(color ? { background: color } : {}),
        }}
      />
    </span>
  );
}

/**
 * One row of a ranked list (Squarespace-style): label and value on one line, a
 * thin bar under it, an optional detail line. With `onClick` the whole row is a
 * button (and gets a chevron); `actionLabel` is its accessible name.
 */
export function BarRow({
  label,
  value,
  bar,
  tone,
  detail,
  leading,
  badge,
  onClick,
  actionLabel,
  extra,
}: {
  label: ReactNode;
  value: ReactNode;
  /** 0–1. */
  bar: number;
  tone?: BarTone;
  detail?: ReactNode;
  leading?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
  /** A second bar under the first (e.g. "finished" under "reached"). */
  extra?: ReactNode;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {label}
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {value}
          </span>
        </span>
        <Bar value={bar} tone={tone} className="mt-1.5" />
        {extra}
        {(detail || badge) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {detail && <span className="min-w-0 truncate">{detail}</span>}
            {badge}
          </span>
        )}
      </span>
      {onClick && (
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 self-center text-muted-foreground/70 transition-transform group-hover/row:translate-x-0.5"
        />
      )}
    </>
  );
  if (!onClick)
    return <div className="flex min-w-0 items-start gap-3 py-2.5">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel}
      className="group/row -mx-2 flex w-[calc(100%+1rem)] min-w-0 items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {body}
    </button>
  );
}

/** A list of BarRows with hairline separators. */
export function BarList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn('divide-y divide-border/70', className)}>{children}</ul>
  );
}

/**
 * The first `shown` items of a list, with the rest behind a "Show all" toggle,
 * so long lists stay short on a phone.
 */
export function ShowMoreList<T>({
  items,
  shown = 5,
  render,
  noun,
}: {
  items: T[];
  shown?: number;
  render: (item: T) => ReactNode;
  /** Plural noun for the toggle: "Show all 12 lessons". */
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const more = items.length > shown;
  return (
    <>
      <BarList>{(open ? items : items.slice(0, shown)).map(render)}</BarList>
      {more && (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          className="mt-1 -ml-2 text-muted-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Show fewer' : `Show all ${items.length} ${noun}`}
          <ChevronDownIcon
            aria-hidden
            className={cn('transition-transform', open && 'rotate-180')}
          />
        </Button>
      )}
    </>
  );
}
