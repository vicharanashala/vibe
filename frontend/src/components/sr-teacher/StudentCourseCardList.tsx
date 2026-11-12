import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HintPopover } from '@/components/sr-teacher/HintPopover';
import { QuestionSortMode, SearchAndSortBar } from '@/components/sr-teacher/SearchAndSortBar';
import { cn } from '@/utils/utils';
import { courseDisplay } from '@/lib/spaced-repetition-api';
import { efStripeClass, formatRelativeWhen, retentionColor } from '@/app/pages/teacher/TeacherSRDashboard.helpers';
import type { QuestionSummary, ReviewItem } from '@/types/spaced-repetition.types';

/**
 * Question-summary lookup map (added 2026-08-04). The dashboard fetches
 * one QuestionSummary per unique question_id via useQueries, then
 * stitches them into a Map so per-card render can do O(1) lookups.
 * Same shape used by the new course-grouped view below.
 */
export type QuestionSummaryMap = Map<string, QuestionSummary>;

/**
 * Action-loading key format used across the per-card row buttons.
 * `"${studentId}-${questionId}-${action}"`. The dashboard owns the
 * loading state and passes us the current key (or null if nothing is
 * loading) so we can disable the right button at the right moment.
 */
export type ActionLoadingKey = string | null;

export interface StudentCourseCardListProps {
  /** Student whose cards we're rendering. Used for `onClick` wiring of action buttons. */
  studentId: string;
  /** All review items for this student across the selected courses. May be empty. */
  items: ReviewItem[];
  /** Map of question_id -> QuestionSummary (or undefined while loading). */
  questionSummaryById: QuestionSummaryMap;
  /** Current action-loading key, or null if nothing is loading. */
  actionLoading: ActionLoadingKey;
  /** Per-card "Make due now" handler. */
  onBoost: (studentId: string, questionId: string) => void;
  /** Per-card "Send back" handler — opens the confirm dialog. */
  onRequestReset: (studentId: string, questionId: string) => void;
  /** Per-card "Add/Edit hint" handler — opens the hint editor dialog. */
  onOpenHintEditor: (studentId: string, questionId: string, existingHint: string | null) => void;
}

/**
 * Internal: a single review card row (one ReviewItem). Identical UX to
 * the original flat-list render that lived inline in TeacherSRDashboard
 * (added 2026-08-04). Extracted so the course-grouped view below can
 * reuse it.
 *
 * Note: the file previously inlined this as a `{items.map(item => ...)}`
 * block; pulling it out is a pure refactor (no behavioural change) and
 * keeps the new course-grouped wrapper readable.
 */
function ReviewCardRow({
  studentId,
  item,
  summary,
  actionLoading,
  onBoost,
  onRequestReset,
  onOpenHintEditor,
}: {
  studentId: string;
  item: ReviewItem;
  summary: QuestionSummary | undefined;
  actionLoading: ActionLoadingKey;
  onBoost: (studentId: string, questionId: string) => void;
  onRequestReset: (studentId: string, questionId: string) => void;
  onOpenHintEditor: (studentId: string, questionId: string, existingHint: string | null) => void;
}) {
  const boostKey = `${studentId}-${item.question_id}-boost`;
  const resetKey = `${studentId}-${item.question_id}-reset`;
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background hover:bg-muted/30 motion-safe:transition-colors px-3 py-2.5 space-y-1.5',
        'border-l-4',
        efStripeClass(item.EF),
      )}
    >
      {/* TIER 1 — body line: course, question preview, memory strength */}
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-xs shrink-0" title={item.course_id}>
          {courseDisplay(item.course_id).name}
        </Badge>
        {summary ? (
          <span
            className="text-sm text-foreground/90 truncate flex-1 min-w-0"
            title={summary.body}
          >
            {summary.body}
          </span>
        ) : (
          <span
            className="text-xs text-muted-foreground font-mono shrink-0"
            title={item.question_id}
          >
            Q:{item.question_id.slice(0, 8)}
          </span>
        )}
        <span
          className={cn('text-sm font-bold shrink-0 tabular-nums', retentionColor(item.EF))}
          title="Memory strength. 1.3 (struggling) to 3.0 (rock-solid). Higher = stronger recall."
        >
          {item.EF.toFixed(2)}
        </span>
      </div>

      {/* TIER 2 — status row: badges + schedule. Skipped when empty */}
      {(item.is_paused || item.exam_prep_mode || item.remediation_hint) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {item.is_paused && (
            <Badge variant="secondary" className="text-[10px] py-0" title="Reminders for this card are paused.">
              Paused
            </Badge>
          )}
          {item.exam_prep_mode && (
            <Badge className="text-[10px] py-0 bg-indigo-600 dark:bg-indigo-700" title="Hardest-first sort.">
              Exam-prep
            </Badge>
          )}
          <HintPopover
            hint={item.remediation_hint ?? null}
            questionIdShort={item.question_id.slice(-6)}
            onEdit={() => onOpenHintEditor(studentId, item.question_id, item.remediation_hint ?? null)}
          />
        </div>
      )}

      {/* TIER 3 — schedule + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span
            className="whitespace-nowrap truncate"
            title={`When the algorithm thinks this card is next due. Interval: ${item.interval_days}d.`}
          >
            Due {formatRelativeWhen(item.next_review_at)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => onBoost(studentId, item.question_id)}
            disabled={actionLoading === boostKey}
            title="Make this card due for review right now. Useful for a hard concept the student needs to see again."
          >
            {actionLoading === boostKey ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3 text-orange-500 dark:text-orange-400" />
            )}
            <span className="ml-1">Make due now</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive"
            onClick={() => onRequestReset(studentId, item.question_id)}
            disabled={actionLoading === resetKey}
            title="Remove this card from the student's schedule. They'll have to relearn it on the next course completion."
          >
            {actionLoading === resetKey ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            <span className="ml-1">Send back</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-amber-600 dark:text-amber-400"
            onClick={() => onOpenHintEditor(studentId, item.question_id, item.remediation_hint ?? null)}
            title={item.remediation_hint ? `Edit hint: ${item.remediation_hint}` : "Write a short note your student will see next time they review this question"}
          >
            <MessageSquareText className="w-3 h-3" />
            <span className="ml-1">{item.remediation_hint ? 'Edit hint' : 'Add hint'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Internal: a single course group within the per-student drill-down.
 * Renders a clickable header (course name + card count + chevron) and
 * the list of cards for that course when expanded.
 *
 * Step 3 of the 2026-08-13 plan: each expanded course gets its own
 * search + sort bar. State is scoped per-course (per-instance) so
 * switching between courses doesn't bleed filters.
 */
function StudentCourseGroup({
  studentId,
  courseId,
  items,
  questionSummaryById,
  isExpanded,
  onToggle,
  actionLoading,
  onBoost,
  onRequestReset,
  onOpenHintEditor,
}: {
  studentId: string;
  courseId: string;
  items: ReviewItem[];
  questionSummaryById: QuestionSummaryMap;
  isExpanded: boolean;
  onToggle: () => void;
  actionLoading: ActionLoadingKey;
  onBoost: (studentId: string, questionId: string) => void;
  onRequestReset: (studentId: string, questionId: string) => void;
  onOpenHintEditor: (studentId: string, questionId: string, existingHint: string | null) => void;
}) {
  const courseName = courseDisplay(courseId).name;
  const groupId = `student-${studentId}-course-${courseId}`;

  /**
   * Per-course search + sort state. Lives here (not lifted to the
   * dashboard) because:
   *   - State is naturally scoped to "this course's view" — switching
   *     to a different course shouldn't preserve search terms.
   *   - Lifting to the dashboard would force a Map<courseId, …> shape
   *     that's harder to reason about.
   *
   * Note on persistence: `StudentCourseGroup` is always rendered for
   * every course (it's a sibling in the `groups.map(...)` loop) — only
   * its inner card list is conditionally rendered via `{isExpanded && ...}`.
   * That means search/sort state *survives* collapse+re-expand. The
   * teacher who types a query, collapses to glance at the cohort, and
   * re-expands still sees their filter. Switching to a different course
   * does reset that course's state, because the parent re-renders the
   * group tree when `items` changes (new course id = new entry in the
   * map = fresh `useState` initialiser for that branch).
   */
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortMode, setSortMode] = useState<QuestionSortMode>('alpha');

  /**
   * Debounce: keep `debouncedQuery` in sync with `searchQuery` after
   * ~150ms of idle keystrokes. The filter + sort memo downstream reads
   * `debouncedQuery`, so the heavy work (string lowercase + localeCompare
   * across all cards in the course) only runs when the teacher stops
   * typing. 150ms matches the SM-2 reaction-time feel — fast enough
   * to feel instant, slow enough to avoid recomputing on every key.
   */
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  /**
   * Filtered + sorted view of the course's items.
   * - Filter: case-insensitive substring match against the question
   *   body (from `questionSummaryById`). Items without a loaded summary
   *   fall back to the question_id short-form, so search still works
   *   when summaries are mid-load (less common now that the dashboard
   *   pre-loads them via useQueries, but cheap and safer).
   * - Sort (added 2026-08-13; `ef-desc` added 2026-08-22):
   *   - `alpha` → body A→Z (locale-aware).
   *   - `ef-asc` → lowest EF first ("hardest first"). Sort the
   *     cards the student is weakest at to the top of the list.
   *   - `ef-desc` → highest EF first ("easiest first"). Surfaces the
   *     cards the student has already mastered.
   *   In both EF modes, alpha breaks the tie so the order is stable
   *   across renders (sort isn't reference-stable today, but adding
   *   a tiebreaker keeps adjacent re-orders visually predictable).
   */
  const filteredItems = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    const needleMatched = needle.length > 0
      ? items.filter((item) => {
          const body = questionSummaryById.get(item.question_id)?.body ?? '';
          const haystack = body.length > 0 ? body : item.question_id;
          return haystack.toLowerCase().includes(needle);
        })
      : items;

    return [...needleMatched].sort((a, b) => {
      if (sortMode === 'ef-asc') {
        const efDiff = a.EF - b.EF;
        if (efDiff !== 0) return efDiff;
      } else if (sortMode === 'ef-desc') {
        const efDiff = b.EF - a.EF;
        if (efDiff !== 0) return efDiff;
      }
      const aBody = questionSummaryById.get(a.question_id)?.body ?? a.question_id;
      const bBody = questionSummaryById.get(b.question_id)?.body ?? b.question_id;
      return aBody.localeCompare(bBody);
    });
  }, [items, debouncedQuery, sortMode, questionSummaryById]);

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`${groupId}-cards`}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 motion-safe:transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
          {courseName}
        </span>
        <Badge variant="secondary" className="text-xs shrink-0" title={`${items.length} review card${items.length === 1 ? '' : 's'} for this student in this course.`}>
          {items.length} {items.length === 1 ? 'card' : 'cards'}
        </Badge>
      </button>
      {isExpanded && (
        <div id={`${groupId}-cards`} className="border-t border-border/60 px-3 py-2.5 space-y-2">
          {/*
            Per-course search + sort. Controlled: parent owns the state,
            debouncing lives here.

            `sortInfoText` disambiguates the sort modes. EF measures
            student recall strength (SM-2 easiness factor, 1.3 = struggling,
            3.0 = rock-solid) — NOT question difficulty. Teachers often
            conflate the two; surfacing this in a tooltip next to the
            dropdown closes that gap without cluttering the visible UI.
            The third mode (`ef-desc`, added 2026-08-22) was added at
            Emie's request and is also covered below.
          */}
          <SearchAndSortBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortMode={sortMode}
            onSortChange={setSortMode}
            resultCount={filteredItems.length}
            totalCount={items.length}
            sortInfoText="EF is the student’s recall strength (1.3 = struggling, 3.0 = rock-solid), not a question difficulty score. ‘EF (hardest first)’ shows the cards the student is weakest at first; ‘EF (easiest first)’ shows the cards they’ve already mastered; ‘Alphabetical’ sorts by question text A–Z."
          />
          {filteredItems.length === 0 ? (
            <div className="text-muted-foreground text-sm py-2">
              {debouncedQuery.trim().length > 0 ? (
                <>
                  <p>
                    No questions match &ldquo;
                    <span className="font-medium text-foreground/80">
                      {debouncedQuery.trim()}
                    </span>
                    &rdquo; in this course.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-1 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <p>No review cards in this course yet.</p>
              )}
            </div>
          ) : (
            filteredItems.map(item => (
              <ReviewCardRow
                key={item._id}
                studentId={studentId}
                item={item}
                summary={questionSummaryById.get(item.question_id)}
                actionLoading={actionLoading}
                onBoost={onBoost}
                onRequestReset={onRequestReset}
                onOpenHintEditor={onOpenHintEditor}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Per-student drill-down panel — the "inside the student's expanded row"
 * content. Added 2026-08-13 to replace the previous flat-list dump.
 *
 * Layout:
 *
 *   ┌─ empty state ──────────────────────────────────────────────┐
 *   │  No review cards yet. Students get a review schedule…       │
 *   └─────────────────────────────────────────────────────────────┘
 *
 *   ┌─ StudentCourseGroup  ▼ ──────────────────────── 62 cards ──┐
 *   │  [ SearchAndSortBar — added in Step 3 ]                    │
 *   │  ReviewCardRow                                             │
 *   │  ReviewCardRow                                             │
 *   │  ...                                                       │
 *   └────────────────────────────────────────────────────────────┘
 *   ┌─ StudentCourseGroup  ▶ ──────── 35 cards ──────────────────┐
 *
 * Default state:
 *   - First course (by courseDisplay().name alphabetical) auto-
 *     expanded so the teacher sees *something* on click.
 *   - All other courses collapsed.
 *   - User toggle is sticky per render — once the teacher collapses
 *     the first course or expands a second, we remember it for the
 *     lifetime of this component instance. (The component remounts
 *     each time the parent re-renders the student row, so the state
 *     is per-expansion — acceptable for now; promote to a ref or
 *     lifted state if teachers complain.)
 */
export function StudentCourseCardList({
  studentId,
  items,
  questionSummaryById,
  actionLoading,
  onBoost,
  onRequestReset,
  onOpenHintEditor,
}: StudentCourseCardListProps) {
  /**
   * Group items by course_id. Order of insertion = order of first
   * appearance in `items` (which is the order returned by the backend
   * schedule endpoint — typically EF-sorted or overdue-first, see the
   * Phase B / Phase 3 sort logic in getSchedule).
   *
   * We then re-order the groups by course name for stable display.
   * The first group (after sorting) auto-expands.
   */
  const groups = useMemo(() => {
    const map = new Map<string, ReviewItem[]>();
    for (const item of items) {
      const arr = map.get(item.course_id);
      if (arr) arr.push(item);
      else map.set(item.course_id, [item]);
    }
    // Sort groups by display name so the teacher's mental model is
    // "courses A → Z, top to bottom". Stable.
    return Array.from(map.entries())
      .map(([courseId, courseItems]) => ({ courseId, courseItems }))
      .sort((a, b) =>
        courseDisplay(a.courseId).name.localeCompare(courseDisplay(b.courseId).name),
      );
  }, [items]);

  const firstCourseId = groups[0]?.courseId;

  /**
   * Set of expanded course ids. Initial state is empty; the first
   * course is auto-expanded via the effect below once `groups` is
   * populated.
   *
   * Why an effect instead of an initializer: if the parent mounts this
   * component while `items` is still loading (an empty array),
   * `groups` is empty and `firstCourseId` is `undefined` at
   * initialization time. A `useState` initializer only runs once on
   * mount, so by the time `items` resolves and `groups` populates, the
   * set would already be locked to `Set([])` and no course would
   * auto-expand. The effect reacts to `firstCourseId` changes and adds
   * the first course to the set on first non-empty transition.
   */
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  // Auto-expand the first course when groups become available. Runs
  // when `firstCourseId` changes from `undefined` to a real id (the
  // initial loading → loaded transition). Does NOT fire when the
  // teacher manually toggles because we only add the id if it isn't
  // already present in the set.
  useEffect(() => {
    if (!firstCourseId) return
    setExpandedCourseIds(prev => {
      if (prev.has(firstCourseId)) return prev
      const next = new Set(prev)
      next.add(firstCourseId)
      return next
    })
  }, [firstCourseId])

  function toggleCourse(courseId: string) {
    setExpandedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-2">
        No review cards yet. Students get a review schedule after
        they finish a course - once they complete one, their cards
        will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map(({ courseId, courseItems }) => (
        <StudentCourseGroup
          key={courseId}
          studentId={studentId}
          courseId={courseId}
          items={courseItems}
          questionSummaryById={questionSummaryById}
          isExpanded={expandedCourseIds.has(courseId)}
          onToggle={() => toggleCourse(courseId)}
          actionLoading={actionLoading}
          onBoost={onBoost}
          onRequestReset={onRequestReset}
          onOpenHintEditor={onOpenHintEditor}
        />
      ))}
    </div>
  );
}
