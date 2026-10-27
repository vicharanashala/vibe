import { useState, useMemo } from 'react';
import { BookOpen, Search, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { TeacherCourseSummary } from '@/types/spaced-repetition.types';
import { cn } from '@/utils/utils';

export interface CourseSelectCardProps {
  /** List of courses to render. When undefined, the loading skeleton is shown. */
  courses?: TeacherCourseSummary[];
  /** Currently-selected course id, or null if none. */
  selectedCourseId: string | null;
  /** Called when a course row is clicked. */
  onSelect: (courseId: string) => void;
  /** Optional className applied to the outer Card. */
  className?: string;
}

/**
 * Teacher-facing course picker for the SR dashboards (added 2026-08-03).
 * Lists the teacher's courses by NAME + student-count chip, click to
 * select. Replaces the previous "<Input placeholder='Enter Course ID'>"
 * pattern that required teachers to type opaque IDs by hand.
 *
 * Selection state is fully controlled by the parent so the page-level
 * `courseId` state stays the single source of truth. When the parent
 * clears the selection (e.g. on logout) the row simply becomes
 * un-highlighted; no internal state to forget about.
 *
 * **Search bar (added 2026-08-04):** case-insensitive substring match on
 * course name (course IDs are also matched as a debugging aid so a
 * teacher who has a course id in their clipboard can paste + filter).
 * Search is local-only; the parent never sees the query.
 *
 * Empty states: three distinct cases
 *   - `courses === undefined` → loading skeleton
 *   - `courses.length === 0`  → "No courses yet. Create one in the Courses module first."
 *   - filtered list is empty → "No courses match \"<query>\"."
 */
export function CourseSelectCard({
  courses,
  selectedCourseId,
  onSelect,
  className,
}: CourseSelectCardProps) {
  const isLoading = courses === undefined;
  const [query, setQuery] = useState('');

  // Apply the search filter whenever courses or query change.
  // Match by name OR id (id is a debugging escape hatch; teachers normally
  // search by name).
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

  return (
    <Card className={cn('p-5 gap-4', className)} data-testid="course-select-card">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Select a course</h2>
      </div>

      {!isLoading && courses && courses.length > 0 && (
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
            data-testid="course-search-input"
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
      ) : courses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No courses yet. Create one in the Courses module first.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No courses match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ScrollArea className="h-[260px] pr-3">
          <ul className="flex flex-col gap-2" role="listbox" aria-label="Courses">
            {filtered.map((course) => {
              const isSelected = course.id === selectedCourseId;
              return (
                <li key={course.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => onSelect(course.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2.5',
                      'flex items-center justify-between gap-3',
                      'motion-safe:transition-colors motion-safe:duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-muted/40',
                    )}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
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
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </Card>
  );
}
