/**
 * StatusCardTable — 5 status metrics × 2 views (all-time + 30-day).
 *
 * Each row shows the metric label, all-time value, and 30-day
 * value. A small delta indicator on the 30-day column shows the
 * change from all-time. Direction is per-metric:
 *   - retention / ef_stability / streak: higher is better
 *   - volume: higher is better (more effort)
 *   - stuck_cards: lower is better (fewer stuck)
 */

import { cn } from '@/utils/utils';
import {
  StatusMetric,
  StatusSnapshot,
  StatusValue,
} from '@/types/motivation.types';

export interface StatusCardTableProps {
  status: StatusSnapshot[];
  isLoading?: boolean;
}

export function StatusCardTable({
  status,
  isLoading = false,
}: StatusCardTableProps): React.JSX.Element {
  if (isLoading) {
    return <StatusTableSkeleton />;
  }
  if (status.length === 0) {
    return (
      <section aria-label="Status">
        <h3 className="text-base font-semibold mb-3">Status</h3>
        <p className="text-sm text-muted-foreground">
          No status data yet. Complete a review to start tracking your
          progress.
        </p>
      </section>
    );
  }

  // Order rows by METRIC_ORDER for stable display.
  const ordered = METRIC_ORDER.flatMap((m) => {
    const found = status.find((s) => s.metric === m);
    return found ? [found] : [];
  });

  return (
    <section aria-label="Status">
      <h3 className="text-base font-semibold mb-3">Status</h3>
      <div className="rounded-md border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
          <span>Metric</span>
          <span className="text-right w-20">All-time</span>
          <span className="text-right w-24">Last 30 days</span>
        </div>
        {/* Rows */}
        {ordered.map((snapshot, idx) => (
          <StatusRow
            key={snapshot.metric}
            snapshot={snapshot}
            isLast={idx === ordered.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────

const METRIC_ORDER: StatusMetric[] = [
  'retention',
  'streak',
  'ef_stability',
  'volume',
  'stuck_cards',
];

const METRIC_LABEL: Record<StatusMetric, string> = {
  retention: 'Retention',
  streak: 'Streak',
  ef_stability: 'EF stability',
  volume: 'Volume',
  stuck_cards: 'Stuck cards',
};

/** Higher is better for these metrics. */
const HIGHER_IS_BETTER: Record<StatusMetric, boolean> = {
  retention: true,
  streak: true,
  ef_stability: true,
  volume: true,
  stuck_cards: false,
};

// ── Single row ─────────────────────────────────────────────────────────────

interface StatusRowProps {
  snapshot: StatusSnapshot;
  isLast: boolean;
}

function StatusRow({ snapshot, isLast }: StatusRowProps): React.JSX.Element {
  const label = METRIC_LABEL[snapshot.metric];
  const higherIsBetter = HIGHER_IS_BETTER[snapshot.metric];

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-sm',
        !isLast && 'border-b border-border',
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="text-right w-20 tabular-nums">
        {formatValue(snapshot.allTime)}
      </span>
      <span className="text-right w-24 tabular-nums">
        <DeltaCell
          current={snapshot.last30Days}
          baseline={snapshot.allTime}
          higherIsBetter={higherIsBetter}
        />
      </span>
    </div>
  );
}

// ── Delta cell ─────────────────────────────────────────────────────────────

interface DeltaCellProps {
  current: StatusValue;
  baseline: StatusValue;
  higherIsBetter: boolean;
}

function DeltaCell({
  current,
  baseline,
  higherIsBetter,
}: DeltaCellProps): React.JSX.Element {
  const delta = current.value - baseline.value;
  if (delta === 0) {
    return (
      <span className="text-muted-foreground">{formatValue(current)}</span>
    );
  }
  const isImprovement =
    (higherIsBetter && delta > 0) || (!higherIsBetter && delta < 0);
  const color = isImprovement ? 'text-emerald-600' : 'text-rose-500';
  const arrow = delta > 0 ? '↑' : '↓';
  return (
    <span className={color}>
      {formatValue(current)}{' '}
      <span className="text-[10px] ml-1">
        {arrow} {Math.abs(delta).toFixed(unitDecimals(current.unit))}
      </span>
    </span>
  );
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatValue(v: StatusValue): string {
  switch (v.unit) {
    case 'percent':
      return `${v.value}%`;
    case 'days':
      return `${v.value}d`;
    case 'count':
      return v.value.toLocaleString();
    case 'score':
      // 0..1 score → display as 0-100 with 1 decimal.
      return `${(v.value * 100).toFixed(1)}%`;
    default:
      return String(v.value);
  }
}

function unitDecimals(unit: StatusValue['unit']): number {
  switch (unit) {
    case 'score':
      return 1;
    case 'percent':
      return 0;
    default:
      return 0;
  }
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function StatusTableSkeleton(): React.JSX.Element {
  return (
    <section aria-label="Status" aria-busy="true">
      <h3 className="text-base font-semibold mb-3">Status</h3>
      <div className="rounded-md border border-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-sm border-b border-border last:border-b-0"
          >
            <span className="h-4 w-20 rounded bg-muted animate-pulse" />
            <span className="h-4 w-12 rounded bg-muted animate-pulse" />
            <span className="h-4 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}