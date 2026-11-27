import { ChevronRightIcon } from 'lucide-react';

import { GeneratedAvatar } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useCourseEnrollmentStats, useCourseEnrollmentsPage } from './queries';
import { ErrorText, formatDate, SectionHeading } from './studio-ui';

/** How many finishers the Overview names; the rest are a click away in People. */
export const FINISHED_PREVIEW = 5;

/**
 * Students at 100% strict progress. The backend sorts the whole course by
 * progress, so the first few rows are the finishers; the count comes from the
 * same statistics as the "Finished" figure above it.
 */
export function FinishedStudents({
  courseId,
  versionId,
  onSeeAll,
}: {
  courseId: string;
  versionId: string;
  onSeeAll: () => void;
}) {
  const stats = useCourseEnrollmentStats(courseId, versionId);
  const top = useCourseEnrollmentsPage(courseId, versionId, {
    limit: FINISHED_PREVIEW,
    filter: 'STUDENT',
    sortBy: 'progress',
    sortOrder: 'desc',
  });
  const finished = (top.data?.enrollments ?? []).filter((e) => (e.progress ?? 0) >= 100);
  const count = stats.data?.completedCount ?? finished.length;

  return (
    <section aria-labelledby="finished-heading">
      <SectionHeading
        action={
          finished.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onSeeAll}>
              {count > finished.length ? `See all ${count.toLocaleString()}` : 'See in People'}
              <ChevronRightIcon aria-hidden />
            </Button>
          )
        }
      >
        <span id="finished-heading">Finished the course</span>
      </SectionHeading>
      {top.isPending && <Skeleton className="h-32 rounded-2xl" />}
      {top.isError && <ErrorText error={top.error} />}
      {top.data && finished.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
          No student has reached 100% yet.
        </p>
      )}
      {finished.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {finished.map((e) => (
            <li key={e.user._id} className="flex items-center gap-3 px-4 py-3">
              <GeneratedAvatar seed={e.user._id} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {e.user.firstName} {e.user.lastName ?? ''}
                </p>
                <p className="truncate text-xs text-muted-foreground">{e.user.email}</p>
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                Joined {formatDate(e.enrollmentDate)}
              </span>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 tabular-nums dark:text-emerald-300">
                100%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
