import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { Metric } from './types';

/**
 * The change against the previous equal period: an arrow, the signed
 * difference, and green/red for better/worse (never colour alone: the arrow
 * and sign carry it too). Nothing when either period has no data.
 */
export function TrendBadge({
  metric,
  format = (n) => n.toLocaleString(),
  lowerIsBetter = false,
}: {
  metric: Metric;
  format?: (n: number) => string;
  lowerIsBetter?: boolean;
}) {
  if (metric.current == null || metric.previous == null) return null;
  const delta = Math.round((metric.current - metric.previous) * 10) / 10;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const better = direction === 'flat' ? null : (direction === 'up') !== lowerIsBetter;
  const Icon = direction === 'up' ? ArrowUpRightIcon : direction === 'down' ? ArrowDownRightIcon : MinusIcon;
  const text = direction === 'flat' ? '0' : `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}`;
  return (
    <Badge
      variant="secondary"
      data-direction={direction}
      className={cn(
        'gap-0.5 px-1.5 tabular-nums',
        better === true && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        better === false && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
        better === null && 'bg-muted text-muted-foreground',
      )}
    >
      <Icon aria-hidden className="size-3" />
      <span aria-hidden>{text}</span>
      <span className="sr-only">
        {direction === 'flat' ? 'No change' : `${direction === 'up' ? 'Up' : 'Down'} ${format(Math.abs(delta))}`} from the
        previous period
      </span>
    </Badge>
  );
}
