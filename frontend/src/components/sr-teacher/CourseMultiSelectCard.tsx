import { useState, useMemo } from 'react';
import { BookOpen, Search, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoPopover } from '@/components/InfoPopover';
import { cn } from '@/utils/utils';
import type { TeacherCourseSummary } from '@/types/spaced-repetition.types';

export interface CourseMultiSelectCardProps {
  /** List of courses to render. When undefined, the loading skeleton is shown. */
  courses?: TeacherCourseSummary[];
  /** Currently-selected course ids (multi-select). Empty = none. */
  selectedCourseIds: string[];
  /** Called when a row's checkbox is toggled. */
  onToggle: (courseId: string) => void;
  /** Called when the header "Select all"/"Clear" toggle is clicked. */
  onToggleAll: () => void;
  /** Optional className applied to the outer Card. */
  className?: string;
}

/**
 * Teacher-facing multi-select course picker for the SR dashboards
 * (added 2026-08-05, Phase 3). Mirrors CourseSelectCard's UX but adds
 * checkboxes so a teacher can aggregate stats across multiple courses
 * at once (e.g. "show me retention across all of Mr X's courses").
 *
 * Replaces the single-select CourseSelectCard for the teacher dashboard
 * page where aggregation is the goal. (Note: the single-student
 * ReviewScheduler view that previously used CourseSelectCard was
 * retired on 2026-08-09 in favour of TeacherSRDashboard.)
 *
 * Selection state is fully controlled by the parent. Order of ids in
 * `selectedCourseIds` is the order the user clicked them — the parent
 * can use this to maintain a stable "primary" course for stat tiles.
 *
 * **Search bar:** case-insensitive substring match on course name OR id
 * (id is a debugging escape hatch). Search is local-only.
 *
 * Empty states: four distinct cases
 *   - `courses === undefined` → loading skeleton
 *   - `courses.length === 0`  → "No courses yet. Create one in the Courses module first."
 *   - filtered list is empty → "No courses match \"<query>\"."
 *   - otherwise              → render the (filtered) list with checkboxes
 */
export function CourseMultiSelectCard({
  courses,
  selectedCourseIds,
  onToggle,
  onToggleAll,
  className,
}: CourseMultiSelectCardProps) {
  const isLoading = courses === undefined;
  const [query, setQuery] = useState('');

  // Apply the search filter. Match by name OR id (id is a debugging
  // escape hatch; teachers normally search by name).
  const filtered = useMemo(() => {
    if (!courses) return [];
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [courses, query]);

  const list = courses ?? [];
  const visibleCount = filtered.length;
  // allSelected/noneSelected are computed against the FILTERED list so
  // the header counter reflects what's on screen, not the full roster.
  const allSelected =
    !isLoading && visibleCount > 0 && filtered.every((c) => selectedCourseIds.includes(c.id));
  const noneSelected = selectedCourseIds.length === 0;

  return (
    <Card className={cn('p-5 gap-4', className)} data-testid="course-multi-select-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Select courses</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {selectedCourseIds.length}/{list.length}
            </span>
          )}
          {/* ⓘ picker-specific help (updated 2026-08-08): converted from a
              native `title=` tooltip to the proper InfoPopover dialog so
              teachers get the same rich-help experience as the student
              retention dashboard. Body is scoped to this picker — the
              page-level InfoPopover still covers the broader "what is SR"
              question. */}
          <InfoPopover
            title="About the courses picker"
            ariaLabel="Help about the courses picker"
            triggerClassName="ml-0.5 h-5 w-5"
          >
            <p>
              Check the courses you want to look at. You can pick just one, or
              tick several boxes to compare them side by side.
            </p>
            <p>
              <strong>Main course:</strong> the first course you tick becomes
              the &ldquo;main&rdquo; one. It decides which students show up in
              the list below, and which questions the action buttons work on.
            </p>
            <p>
              <strong>Search:</strong> type part of a course name to find it
              quickly. Useful when you teach a lot of classes.
            </p>
          </InfoPopover>
        </div>
        {!isLoading && list.length > 0 && (
          <button
            type="button"
            onClick={onToggleAll}
            className={cn(
              'text-xs font-medium underline-offset-2',
              'hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
              allSelected ? 'text-primary' : 'text-muted-foreground',
            )}
            aria-label={allSelected ? 'Clear course selection' : 'Select all courses'}
          >
            {allSelected ? 'Clear' : 'Select all'}
          </button>
        )}
      </div>

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
            placeholder="Search courses…"
            aria-label="Search courses by name"
            className="pl-8 pr-8"
            data-testid="course-multi-search-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear course search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No courses yet. Create one in the Courses module first.
        </p>
      ) : visibleCount === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No courses match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ScrollArea className="h-[260px] pr-3">
          <ul className="flex flex-col gap-2" role="list" aria-label="Courses">
            {filtered.map((course) => {
              const checked = selectedCourseIds.includes(course.id);
              return (
                <li key={course.id}>
                  <label
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 cursor-pointer',
                      'flex items-center justify-between gap-3',
                      'motion-safe:transition-colors motion-safe:duration-150',
                      'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                      checked
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-muted/40',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(course.id)}
                      aria-label={`Select ${course.name}`}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {course.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {course.id.length > 14 ? `${course.id.slice(0, 12)}…` : course.id}
                      </span>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {course.studentCount}
                    </Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {!isLoading && !noneSelected && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {selectedCourseIds.length} course{selectedCourseIds.length === 1 ? '' : 's'} selected — pairing with{' '}
          {selectedCourseIds.length} student list{selectedCourseIds.length === 1 ? '' : 's'} below.
        </p>
      )}
    </Card>
  );
}
