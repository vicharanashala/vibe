import { useState, useMemo, type ReactNode } from 'react';
import { Mail, Search, User, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoPopover } from '@/components/InfoPopover';
import type { EnrichedStudent } from '@/types/spaced-repetition.types';
import { cn } from '@/utils/utils';

export interface StudentListPanelProps {
  /** List of enrolled students. When undefined, the loading skeleton is shown. */
  students?: EnrichedStudent[];
  /** Currently-selected student ids. Always treated as a string[] of Firebase UIDs. */
  selectedStudentIds: string[];
  /** Called when a row's checkbox is toggled. */
  onToggle: (studentId: string) => void;
  /** Called when "Select all" / "Clear" header button is clicked. */
  onToggleAll: () => void;
  /**
   * Hide the header "Select all"/"Clear" toggle (added 2026-08-03).
   * Use for pages where selection is single-student and "select all"
   * has no meaningful semantics (e.g. a single-student dashboard).
   * Defaults to false (toggle is shown).
   */
  hideSelectAll?: boolean;
  /** Optional className applied to the outer Card. */
  className?: string;
  /** Optional fixed height for the scroll area. Defaults to 260px (matches CourseSelectCard). */
  scrollHeightClass?: string;
  /**
   * Optional context chip slot rendered above the search bar (added 2026-08-04).
   * Used by the teacher dashboard to show "Course: Algebra Foundations" so
   * the teacher always sees what scope they're picking students in. Rendered
   * as a flex row, left-aligned. Defaults to nothing (no-op).
   */
  headerSlot?: ReactNode;
  /**
   * Optional CTA rendered inside the empty-state when there are no
   * students with a review schedule for the selected course (added
   * 2026-08-11 for audit G4). When provided, the empty state shows a
   * short explanation + a button so the teacher has a next step
   * instead of staring at a wall. The teacher dashboard passes
   * "Pick a different course" which scrolls back to the course picker.
   */
  emptyStateCta?: StudentListPanelEmptyStateCta;
}

/**
 * Teacher-facing student picker for the SR dashboards (added 2026-08-03).
 * Lists enrolled students by NAME + EMAIL, each with a checkbox. Includes
 * a header select-all toggle. Replaces the previous "Student ABCDE" stub
 * that showed only the first 5 chars of the Firebase UID.
 *
 * Selection state is fully controlled by the parent. The parent stores
 * student IDs (Firebase UIDs, because the bulk SR mutations still expect
 * string[] of UIDs); this component only renders names + emails and emits
 * the toggled id via onToggle().
 *
 * **Search bar (added 2026-08-04):** case-insensitive substring match on
 * EITHER student name OR email (per Emie's request — both searchable so
 * a teacher with an email-only roster can still find people). Search is
 * local-only; the parent never sees the query. Selection state is
 * preserved across search changes so a teacher can filter, click a row,
 * filter again, click another — without losing prior selections.
 *
 * Empty states: four distinct cases
 *   - `students === undefined` → loading skeleton
 *   - `students.length === 0`  → "No students have a review schedule yet."
 *      with an explanation + CTA (see G4 audit fix, 2026-08-11)
 *   - filtered list is empty   → "No students match \"<query>\"."
 *   - otherwise                → render the filtered list
 *
 * **G4 CTA copy (added 2026-08-11):** the empty state used to be a bare
 * sentence. New mentors had no idea what a "review schedule" was or why
 * students weren't there. Added: explanation ("Students get review
 * schedules after completing a course") + actionable CTA that scrolls
 * the page back up to the course picker where the teacher can pick a
 * different course if they have the wrong one selected.
 */
/** Empty-state CTA behaviour (added 2026-08-11 for audit G4). */
export interface StudentListPanelEmptyStateCta {
  /** Short label rendered on the CTA button, e.g. "Pick a different course". */
  label: string;
  /** Called when the teacher clicks the CTA. */
  onClick: () => void;
}

export function StudentListPanel({
  students,
  selectedStudentIds,
  onToggle,
  onToggleAll,
  hideSelectAll = false,
  className,
  scrollHeightClass = 'h-[260px]',
  headerSlot,
  emptyStateCta,
}: StudentListPanelProps) {
  const isLoading = students === undefined;
  const [query, setQuery] = useState('');

  // Apply the search filter. Match by name OR email (both searchable).
  // IDs are intentionally NOT included because teachers don't think in IDs —
  // adding id-search would clutter results and slow down the user.
  const filtered = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [students, query]);

  const list = students ?? [];
  const visibleCount = filtered.length;
  // allSelected/noneSelected are computed against the FILTERED list so the
  // header counter reflects what's on screen, not the full roster. This
  // matters when the teacher has filtered to a subset and clicks "Select all".
  const allSelected =
    !isLoading && visibleCount > 0 && filtered.every((s) => selectedStudentIds.includes(s.id));
  const noneSelected = selectedStudentIds.length === 0;

  return (
    <Card className={cn('p-5 gap-4', className)} data-testid="student-list-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Enrolled students</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {selectedStudentIds.length}/{list.length}
            </span>
          )}
          {/* ⓘ picker-specific help (updated 2026-08-08): converted from a
              native `title=` tooltip to the proper InfoPopover dialog so
              teachers get the same rich-help experience as the student
              retention dashboard. Body is scoped to this picker — the
              page-level InfoPopover still covers the broader "what is SR"
              question. */}
          <InfoPopover
            title="About the enrolled students picker"
            ariaLabel="Help about the enrolled students picker"
            triggerClassName="ml-0.5 h-5 w-5"
          >
            <p>
              Tick the students you want to check on. Pick one or many — the
              choice is yours.
            </p>
            <p>
              <strong>Who shows up here:</strong> only students from the
              &ldquo;main&rdquo; course you ticked above. Change the main
              course and this list updates on its own.
            </p>
            <p>
              <strong>Search:</strong> type a name or an email to find someone.
              Your earlier picks stay ticked even after you search, so feel
              free to filter and pick a few in a row.
            </p>
          </InfoPopover>
        </div>
        {!isLoading && list.length > 0 && !hideSelectAll && (
          <button
            type="button"
            onClick={onToggleAll}
            className={cn(
              'text-xs font-medium underline-offset-2',
              'hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
              allSelected ? 'text-primary' : 'text-muted-foreground',
            )}
            aria-label={allSelected ? 'Clear student selection' : 'Select all students'}
          >
            {allSelected ? 'Clear' : 'Select all'}
          </button>
        )}
      </div>

      {/* Optional context chip (added 2026-08-04): e.g. "Course: Algebra Foundations"
          so the teacher always knows what scope they're picking students in. */}
      {headerSlot && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="student-list-header-slot">
          {headerSlot}
        </div>
      )}

      {!isLoading && list.length > 0 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students by name or email…"
            aria-label="Search students by name or email"
            className="pl-8 pr-8"
            data-testid="student-search-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear student search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className={cn('flex flex-col gap-2 pr-3', scrollHeightClass)} aria-hidden="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.length === 0 ? (
        // Empty-state CTA (G4 audit fix, 2026-08-11): new mentors didn't
        // know what a "review schedule" was or why students weren't
        // showing up. Now we explain AND offer a next step.
        <div
          className="flex flex-col items-center gap-2 py-6 px-2 text-center"
          data-testid="student-list-empty-state"
        >
          <p className="text-sm font-medium text-foreground">
            No students have a review schedule for this course yet.
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Students get review schedules after completing a course. Once a
            student finishes one, they&rsquo;ll show up here.
          </p>
          {emptyStateCta && (
            <button
              type="button"
              onClick={emptyStateCta.onClick}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              data-testid="student-list-empty-cta"
            >
              {emptyStateCta.label}
            </button>
          )}
        </div>
      ) : visibleCount === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No students match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ScrollArea className={cn(scrollHeightClass, 'pr-3')}>
          <ul className="flex flex-col gap-1" role="list" aria-label="Enrolled students">
            {filtered.map((student) => {
              const checked = selectedStudentIds.includes(student.id);
              return (
                <li key={student.id}>
                  <label
                    className={cn(
                      'flex items-start gap-3 rounded-lg px-2 py-2 cursor-pointer',
                      'motion-safe:transition-colors motion-safe:duration-150',
                      'hover:bg-muted/40',
                      'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                      checked && 'bg-primary/5',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(student.id)}
                      aria-label={`Select ${student.name}`}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="truncate">{student.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                        <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{student.email}</span>
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {!isLoading && !noneSelected && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'} selected.
        </p>
      )}
    </Card>
  );
}
