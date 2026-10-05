/**
 * LeaderboardTable — course-scoped ranking by 30-day retention.
 *
 * Top 3 get medal emojis (🥇🥈🥉). Opted-out students show "—"
 * for their numbers but their rank stays visible. The current
 * user's row is highlighted with a gold left border.
 *
 * Below the table, a callout shows the current user's rank and
 * percentile. n/a when no rank is available.
 */

import { cn } from '@/utils/utils';
import { LeaderboardResponse } from '@/types/motivation.types';

export interface LeaderboardTableProps {
  data: LeaderboardResponse | null | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
}

const MEDAL: Record<1 | 2 | 3, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export function LeaderboardTable({
  data,
  isLoading = false,
  emptyMessage,
}: LeaderboardTableProps): React.JSX.Element {
  if (isLoading) {
    return <LeaderboardSkeleton />;
  }
  if (!data || data.entries.length === 0) {
    return (
      <section aria-label="Leaderboard">
        <h3 className="text-base font-semibold mb-3">Leaderboard</h3>
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? 'No leaderboard data yet.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Leaderboard">
      <h3 className="text-base font-semibold mb-3">Leaderboard</h3>
      <div className="rounded-md border border-border overflow-hidden">
        {/* Header */}
        <div
          className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/40"
          role="row"
        >
          <span className="w-8 text-center" role="columnheader">Rank</span>
          <span role="columnheader">Student</span>
          <span className="text-right w-20 tabular-nums" role="columnheader">Retention</span>
          <span className="text-right w-20 tabular-nums" role="columnheader">Coverage</span>
        </div>
        {/* Rows */}
        {data.entries.map((entry, idx) => {
          const rank = entry.rank ?? idx + 1;
          const medal = rank in MEDAL ? MEDAL[rank as 1 | 2 | 3] : null;
          return (
            <div
              key={entry.studentId}
              role="row"
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2 text-sm items-center',
                idx !== data.entries.length - 1 && 'border-b border-border',
                entry.isCurrentUser && 'bg-[#FFD700]/10 border-l-4 border-l-[#FFA500] -ml-1 pl-4',
              )}
            >
              <span className="w-8 text-center tabular-nums font-medium" role="cell">
                {medal ?? rank}
              </span>
              <span
                className={cn(
                  entry.isCurrentUser && 'font-semibold',
                )}
                role="cell"
              >
                {entry.studentName}
                {entry.isOptedOut && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Opted out
                  </span>
                )}
              </span>
              <span className="text-right w-20 tabular-nums" role="cell">
                {entry.isOptedOut
                  ? '—'
                  : entry.retention30d === null
                    ? 'n/a'
                    : `${entry.retention30d}%`}
              </span>
              <span className="text-right w-20 tabular-nums" role="cell">
                {entry.isOptedOut ? '—' : `${entry.coverage}%`}
              </span>
            </div>
          );
        })}
      </div>
      {/* Your rank callout */}
      <YourRankCallout
        rank={data.currentUserRank}
        percentile={data.currentUserPercentile}
        total={data.totalStudents}
      />
    </section>
  );
}

// ── Callout ────────────────────────────────────────────────────────────────

interface YourRankCalloutProps {
  rank: number | null;
  percentile: number | null;
  total: number;
}

function YourRankCallout({
  rank,
  percentile,
  total,
}: YourRankCalloutProps): React.JSX.Element {
  if (rank === null) {
    return (
      <p className="text-sm text-muted-foreground mt-3">
        Your rank: n/a
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground mt-3">
      Your rank: <span className="font-semibold text-foreground">{rank}</span> of{' '}
      <span className="font-semibold text-foreground">{total}</span>
      {percentile !== null && (
        <>
          {' '}
          (<span className="font-semibold text-foreground">{percentile}th percentile</span>)
        </>
      )}
    </p>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function LeaderboardSkeleton(): React.JSX.Element {
  return (
    <section aria-label="Leaderboard" aria-busy="true">
      <h3 className="text-base font-semibold mb-3">Leaderboard</h3>
      <div className="rounded-md border border-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2 text-sm border-b border-border last:border-b-0"
          >
            <span className="h-4 w-6 rounded bg-muted animate-pulse" />
            <span className="h-4 w-24 rounded bg-muted animate-pulse" />
            <span className="h-4 w-12 rounded bg-muted animate-pulse" />
            <span className="h-4 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}