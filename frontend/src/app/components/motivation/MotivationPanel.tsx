/**
 * MotivationPanel — slide-in panel that hosts the motivation surface.
 *
 * Hosts three tabs:
 *   - My Court (default): BadgeGrid + StatusCardTable + ExportButtons
 *   - Leaderboard: LeaderboardTable (requires `courseId`)
 *   - Mentor: MentorViewPanels (requires `isMentor`)
 *
 * Self-contained lifecycle:
 *   - Escape key closes
 *   - Click outside closes
 *   - Body scroll locked while open
 *   - Focus moves to close button on open
 */

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  DEMO_STUDENT_ID,
  isDemoStudentEmail,
} from '@/lib/spaced-repetition-api';
import { cn } from '@/utils/utils';
import {
  useGetCourseLeaderboard,
  useGetCourseMentorView,
  useGetMyMotivation,
} from '@/hooks/motivation-hooks';
import { BadgeGrid } from './BadgeGrid';
import { StatusCardTable } from './StatusCardTable';
import { LeaderboardTable } from './LeaderboardTable';
import { MentorViewPanels } from './MentorViewPanels';
import { ExportButtons } from './ExportButtons';

export interface MotivationPanelProps {
  open: boolean;
  onClose: () => void;
  /** Course ID for the Leaderboard + Mentor tabs. Optional. */
  courseId?: string;
  /** Whether the current user is a mentor of the course. */
  isMentor?: boolean;
}

type TabKey = 'my-court' | 'leaderboard' | 'mentor';

export function MotivationPanel({
  open,
  onClose,
  courseId,
  isMentor = false,
}: MotivationPanelProps): React.JSX.Element | null {
  const [tab, setTab] = useState<TabKey>('my-court');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Resolve current student (same pattern as RetentionDashboard).
  const { user } = useAuthStore();
  const studentId = isDemoStudentEmail(user?.email)
    ? DEMO_STUDENT_ID
    : user?.uid ?? '';

  // Wire up the three queries. The hook layer handles `enabled` gates.
  const meQuery = useGetMyMotivation(studentId);
  const leaderboardQuery = useGetCourseLeaderboard(courseId ?? '', studentId);
  const mentorQuery = useGetCourseMentorView(courseId ?? '');

  // Escape key closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the close button on open.
  useEffect(() => {
    if (open) {
      // Defer to next tick so the panel is in the DOM.
      const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return;
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Motivation panel"
    >
      {/* Overlay — click-outside closes. */}
      <button
        type="button"
        aria-label="Close motivation panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 cursor-default"
      />

      {/* Panel — slides in from the right. */}
      <aside
        className={cn(
          'absolute top-0 right-0 h-full w-full md:w-[480px]',
          'bg-card shadow-2xl border-l border-border',
          'flex flex-col',
          // CSS-only slide-in. `motion-safe` keeps reduced-motion users
          // at the resting position with no animation.
          'motion-safe:animate-vibe-slide-up motion-safe:animate-duration-200',
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Your Badges</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-md hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕
          </button>
        </header>

        {/* Tab bar */}
        <nav
          className="flex border-b border-border"
          role="tablist"
          aria-label="Motivation tabs"
        >
          <TabButton
            label="My Court"
            active={tab === 'my-court'}
            onClick={() => setTab('my-court')}
          />
          <TabButton
            label="Leaderboard"
            active={tab === 'leaderboard'}
            onClick={() => setTab('leaderboard')}
          />
          {isMentor && (
            <TabButton
              label="Mentor"
              active={tab === 'mentor'}
              onClick={() => setTab('mentor')}
            />
          )}
        </nav>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'my-court' && (
            <div className="space-y-6">
              <BadgeGrid
                badges={meQuery.data?.badges ?? []}
                isLoading={meQuery.isLoading}
              />
              <StatusCardTable
                status={meQuery.data?.status ?? []}
                isLoading={meQuery.isLoading}
              />
              <ExportButtons badges={meQuery.data?.badges ?? []} />
            </div>
          )}
          {tab === 'leaderboard' && (
            <LeaderboardTable
              data={leaderboardQuery.data}
              isLoading={leaderboardQuery.isLoading}
              emptyMessage={
                courseId
                  ? undefined
                  : 'No course selected. Open from a course page.'
              }
            />
          )}
          {tab === 'mentor' && isMentor && (
            <MentorViewPanels
              data={mentorQuery.data}
              isLoading={mentorQuery.isLoading}
              emptyMessage={
                courseId
                  ? undefined
                  : 'No course selected. Open from a course page.'
              }
            />
          )}
        </main>
      </aside>
    </div>
  );
}

// ── Internal: tab button ───────────────────────────────────────────────────

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex-1 py-2 text-sm font-medium',
        'border-b-2 -mb-px transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-[#FFA500] text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}