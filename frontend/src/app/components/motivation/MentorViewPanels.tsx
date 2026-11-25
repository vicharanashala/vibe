/**
 * MentorViewPanels — three derived panels for course mentors.
 *
 * Panel A — Stuck cards: students with items at n=0 after 3+ reviews.
 * Panel B — Next-badge proximity: students close to earning a badge.
 * Panel C — Learner categories: 2×2 quadrant derived from the
 *           two metrics (retention × coverage).
 *
 * All three panels render from the same `MentorViewResponse`. Any
 * panel with no rows shows a "None right now" empty state.
 */

import { cn } from '@/utils/utils';
import {
  LearnerCategory,
  LearnerCategoryRow,
  MentorViewResponse,
  NextBadgeProximity,
  StuckCardRow,
} from '@/types/motivation.types';

export interface MentorViewPanelsProps {
  data: MentorViewResponse | null | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function MentorViewPanels({
  data,
  isLoading = false,
  emptyMessage,
}: MentorViewPanelsProps): React.JSX.Element {
  if (isLoading) {
    return <MentorViewSkeleton />;
  }
  if (!data) {
    return (
      <section aria-label="Mentor view">
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? 'No mentor view data yet.'}
        </p>
      </section>
    );
  }
  // If every panel is empty, show the empty message.
  const allEmpty =
    data.stuckCards.length === 0 &&
    data.nextBadges.length === 0 &&
    data.learnerCategories.length === 0;
  if (allEmpty) {
    return (
      <section aria-label="Mentor view">
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? 'No mentor view data yet.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Mentor view" className="space-y-6">
      {/* Panel A — Stuck cards */}
      <div>
        <h3 className="text-base font-semibold mb-2">Stuck cards</h3>
        {data.stuckCards.length === 0 ? (
          <EmptyPanel>No stuck cards right now.</EmptyPanel>
        ) : (
          <PanelList<StuckCardRow>
            rows={data.stuckCards}
            columns={[
              { header: 'Student', render: (r) => r.studentName },
              {
                header: 'Stuck',
                render: (r) => formatStuckCount(r.stuckCount),
                align: 'right',
              },
              {
                header: 'Dipping',
                render: (r) => formatDippingCount(r.dippingCount),
                align: 'right',
              },
            ]}
          />
        )}
      </div>

      {/* Panel B — Next-badge proximity */}
      <div>
        <h3 className="text-base font-semibold mb-2">Next-badge proximity</h3>
        {data.nextBadges.length === 0 ? (
          <EmptyPanel>No students near a new badge.</EmptyPanel>
        ) : (
          <PanelList<NextBadgeProximity>
            rows={data.nextBadges}
            columns={[
              { header: 'Student', render: (r) => r.studentName },
              { header: 'Badge', render: (r) => r.badgeName },
              {
                header: 'Distance',
                render: (r) => `${r.distance} ${r.unit}`,
                align: 'right',
              },
            ]}
          />
        )}
      </div>

      {/* Panel C — Learner categories 2×2 quadrant */}
      <div>
        <h3 className="text-base font-semibold mb-2">Learner categories</h3>
        <LearnerCategoryGrid rows={data.learnerCategories} />
      </div>
    </section>
  );
}

// ── Generic panel list ─────────────────────────────────────────────────────

interface PanelColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
}

interface PanelListProps<T> {
  rows: T[];
  columns: PanelColumn<T>[];
}

function PanelList<T extends { studentId: string; studentName: string }>({
  rows,
  columns,
}: PanelListProps<T>): React.JSX.Element {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div
        className={cn(
          'grid gap-3 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/40',
        )}
        style={{
          gridTemplateColumns: columns.map((c) => c.align === 'right' ? 'auto' : '1fr').join(' '),
        }}
        role="row"
      >
        {columns.map((c, i) => (
          <span
            key={i}
            className={c.align === 'right' ? 'text-right' : ''}
            role="columnheader"
          >
            {c.header}
          </span>
        ))}
      </div>
      {rows.map((row, idx) => (
        <div
          key={row.studentId}
          className={cn(
            'grid gap-3 px-3 py-2 text-sm items-center',
            idx !== rows.length - 1 && 'border-b border-border',
          )}
          style={{
            gridTemplateColumns: columns.map((c) => c.align === 'right' ? 'auto' : '1fr').join(' '),
          }}
          role="row"
        >
          {columns.map((c, i) => (
            <span
              key={i}
              className={cn(c.align === 'right' && 'text-right tabular-nums')}
              role="cell"
            >
              {c.render(row)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Learner category grid ──────────────────────────────────────────────────

const QUADRANT_LABEL: Record<LearnerCategory, { label: string; hint: string }> = {
  'all-rounder': { label: 'All-Rounders', hint: 'High mastery + high coverage' },
  'mastery-only': { label: 'Mastery-Only', hint: 'High mastery + low coverage' },
  sprinter: { label: 'Sprinters', hint: 'Low mastery + high coverage' },
  quiet: { label: 'Quiet', hint: 'Low mastery + low coverage' },
};

const QUADRANT_ORDER: LearnerCategory[] = [
  'mastery-only',
  'all-rounder',
  'quiet',
  'sprinter',
];

interface LearnerCategoryGridProps {
  rows: LearnerCategoryRow[];
}

function LearnerCategoryGrid({
  rows,
}: LearnerCategoryGridProps): React.JSX.Element {
  const grouped: Record<LearnerCategory, LearnerCategoryRow[]> = {
    'all-rounder': [],
    'mastery-only': [],
    sprinter: [],
    quiet: [],
  };
  for (const r of rows) grouped[r.category].push(r);

  return (
    <div className="grid grid-cols-2 gap-2">
      {QUADRANT_ORDER.map((cat) => {
        const students = grouped[cat];
        const { label, hint } = QUADRANT_LABEL[cat];
        return (
          <div
            key={cat}
            className="rounded-md border border-border p-3 min-h-[120px]"
          >
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
            <ul className="mt-2 space-y-1">
              {students.length === 0 ? (
                <li className="text-xs text-muted-foreground">—</li>
              ) : (
                students.map((s) => (
                  <li key={s.studentId} className="text-xs">
                    {s.studentName}
                    <span className="text-muted-foreground ml-2 tabular-nums">
                      {s.retention30d === null ? 'n/a' : `${s.retention30d}%`} ·{' '}
                      {s.coverage}%
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty panel helper ─────────────────────────────────────────────────────

function EmptyPanel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

// ── Panel A column formatters ───────────────────────────────────────────────
//
// Human-friendly format for the stuck / dipping counts per the
// PLAN_MOTIVATION_SYSTEM.md spec:
//
//   0  → "0 cards stuck"       / "0 cards in dip"
//   1  → "1 card stuck at n=0"  / "1 card in 2nd-attempt dip"
//   2+ → "N cards stuck at n=0" / "N cards in 2nd-attempt dip"
//
// Why inline helpers and not a single shared util: the two suffixes
// (`stuck at n=0` vs `in 2nd-attempt dip`) are domain-specific and
// unlikely to be reused outside this panel. Keeping them next to the
// panel keeps the rendering rule discoverable.

function formatStuckCount(n: number): string {
  if (n === 0) return '0 cards stuck';
  if (n === 1) return '1 card stuck at n=0';
  return `${n} cards stuck at n=0`;
}

function formatDippingCount(n: number): string {
  if (n === 0) return '0 cards in dip';
  if (n === 1) return '1 card in 2nd-attempt dip';
  return `${n} cards in 2nd-attempt dip`;
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function MentorViewSkeleton(): React.JSX.Element {
  return (
    <section aria-label="Mentor view" aria-busy="true" className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-5 w-32 rounded bg-muted animate-pulse mb-2" />
          <div className="h-24 rounded-md border border-border bg-muted/30 animate-pulse" />
        </div>
      ))}
    </section>
  );
}